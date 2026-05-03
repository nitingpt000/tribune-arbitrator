import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DisputeStatus,
  PanelVoteChoice,
  PanelVoteStatus,
  Prisma,
  SettlementStepStatus,
  SettlementStepType,
} from '@prisma/client';
import {
  type DisputeStatusEvent,
  type SettlementStepEvent,
  type VerdictCreatedEvent,
  type VoteUpdateEvent,
} from '@tribune/types';

import { hashMod } from '../../common/hash';
import {
  serializeDispute,
  serializePanelVote,
  serializeSettlementStep,
  serializeVerdict,
} from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

import { ReasoningTemplateService } from './reasoning-templates';

interface PhaseConfig {
  preAdjudicationMs: number;
  perVoteMinReasoningMs: number;
  perVoteMaxReasoningMs: number;
  settlementStepMs: Record<SettlementStepType, number>;
}

const DEFAULT_PHASES: PhaseConfig = {
  preAdjudicationMs: 2_000,
  perVoteMinReasoningMs: 3_000,
  perVoteMaxReasoningMs: 5_000,
  settlementStepMs: {
    VERDICT_ONCHAIN: 1_000,
    KEEPER_CLAIMED: 500,
    FUNDS_RELEASED: 1_000,
    ENS_REPUTATION: 500,
  },
};

@Injectable()
export class MockPanelService {
  private readonly logger = new Logger(MockPanelService.name);
  private readonly running = new Set<string>();
  private readonly phases: PhaseConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly templates: ReasoningTemplateService,
  ) {
    this.phases = DEFAULT_PHASES;
  }

  setPhasesForTests(overrides: Partial<PhaseConfig>): void {
    Object.assign(this.phases, overrides);
  }

  async startAdjudication(disputeId: string): Promise<void> {
    if (this.running.has(disputeId)) return;
    this.running.add(disputeId);
    try {
      await this.run(disputeId);
    } catch (err) {
      this.logger.error(`Adjudication for ${disputeId} crashed`, err as Error);
    } finally {
      this.running.delete(disputeId);
    }
  }

  private async run(disputeId: string): Promise<void> {
    const start = Date.now();

    await this.delay(this.phases.preAdjudicationMs);

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.ADJUDICATING },
    });
    this.emitDisputeStatus(disputeId, updated.status);

    const winningVote = this.deterministicWinner(disputeId);
    const dissenterIndex = hashMod(`${disputeId}:dissenter`, 6);
    const dispute = await this.prisma.dispute.findUniqueOrThrow({
      where: { id: disputeId },
      include: { panelVotes: { orderBy: { createdAt: 'asc' } } },
    });

    for (let i = 0; i < dispute.panelVotes.length; i++) {
      const vote = dispute.panelVotes[i]!;
      await this.prisma.panelVote.update({
        where: { id: vote.id },
        data: { status: PanelVoteStatus.REASONING },
      });
      const reasoningRecord = await this.prisma.panelVote.findUniqueOrThrow({
        where: { id: vote.id },
      });
      this.emitVoteUpdate(disputeId, reasoningRecord);

      const reasoningWindow = this.phases.perVoteMaxReasoningMs - this.phases.perVoteMinReasoningMs;
      const reasoningMs =
        this.phases.perVoteMinReasoningMs +
        hashMod(`${disputeId}:${vote.modelName}:wait`, Math.max(1, reasoningWindow));
      await this.delay(reasoningMs);

      const dissents = i === dissenterIndex && this.phases.perVoteMaxReasoningMs >= 0;
      const choice: PanelVoteChoice = dissents
        ? winningVote === PanelVoteChoice.REFUND
          ? PanelVoteChoice.REJECT
          : PanelVoteChoice.REFUND
        : winningVote;

      const reasoning = this.templates.pickReasoning(
        disputeId,
        vote.modelName,
        dispute.claimType,
        choice as 'REFUND' | 'REJECT',
      );
      const confidence = this.templates.pickConfidence(disputeId, vote.modelName);

      const finalVote = await this.prisma.panelVote.update({
        where: { id: vote.id },
        data: {
          vote: choice,
          confidence: new Prisma.Decimal(confidence),
          reasoning,
          status: PanelVoteStatus.VOTED,
        },
      });
      this.emitVoteUpdate(disputeId, finalVote);
    }

    const finalVotes = await this.prisma.panelVote.findMany({
      where: { disputeId },
      orderBy: { createdAt: 'asc' },
    });
    const refundCount = finalVotes.filter((v) => v.vote === PanelVoteChoice.REFUND).length;
    const rejectCount = finalVotes.filter((v) => v.vote === PanelVoteChoice.REJECT).length;
    const outcome: PanelVoteChoice =
      refundCount >= 2 ? PanelVoteChoice.REFUND : PanelVoteChoice.REJECT;
    const finalStatus =
      outcome === PanelVoteChoice.REFUND ? DisputeStatus.SETTLED : DisputeStatus.REJECTED;
    const totalDurationMs = Date.now() - start;

    const verdict = await this.prisma.verdict.create({
      data: {
        disputeId,
        outcome,
        votesFor: outcome === PanelVoteChoice.REFUND ? refundCount : rejectCount,
        votesAgainst: outcome === PanelVoteChoice.REFUND ? rejectCount : refundCount,
        totalDurationMs,
        totalCostUsd: new Prisma.Decimal(0.5),
      },
    });
    const settled = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { status: finalStatus },
    });
    this.emitVerdictCreated(disputeId, verdict);
    this.emitDisputeStatus(disputeId, settled.status);

    await this.runSettlementSteps(disputeId, outcome, settled.claimantEns, settled.respondentEns);
  }

  private async runSettlementSteps(
    disputeId: string,
    outcome: PanelVoteChoice,
    claimantEns: string,
    respondentEns: string,
  ): Promise<void> {
    const steps = await this.prisma.settlementStep.findMany({
      where: { disputeId },
      orderBy: { step: 'asc' },
    });

    for (const step of steps) {
      const startedAt = new Date();
      await this.prisma.settlementStep.update({
        where: { id: step.id },
        data: { status: SettlementStepStatus.IN_PROGRESS, startedAt },
      });

      await this.delay(this.phases.settlementStepMs[step.step]);

      const txHash =
        step.step === SettlementStepType.VERDICT_ONCHAIN ||
        step.step === SettlementStepType.FUNDS_RELEASED ||
        step.step === SettlementStepType.KEEPER_CLAIMED
          ? this.fakeTxHash(disputeId, step.step)
          : null;

      const detail = this.detailFor(step.step, outcome);

      const completed = await this.prisma.settlementStep.update({
        where: { id: step.id },
        data: {
          status: SettlementStepStatus.COMPLETED,
          completedAt: new Date(),
          txHash,
          detail,
        },
      });
      this.emitSettlementStep(disputeId, completed);

      if (step.step === SettlementStepType.ENS_REPUTATION) {
        const lastVerdict = await this.prisma.verdict.findUnique({ where: { disputeId } });
        await this.bumpReputation(
          claimantEns,
          outcome === PanelVoteChoice.REFUND ? 'won' : 'lost',
          lastVerdict?.id ?? null,
        );
        await this.bumpReputation(
          respondentEns,
          outcome === PanelVoteChoice.REFUND ? 'lost' : 'won',
          lastVerdict?.id ?? null,
        );
      }
    }
  }

  private async bumpReputation(
    ens: string,
    outcome: 'won' | 'lost',
    lastVerdictId: string | null,
  ): Promise<void> {
    await this.prisma.agentReputation.upsert({
      where: { ens },
      update: {
        totalDisputes: { increment: 1 },
        disputesWon: { increment: outcome === 'won' ? 1 : 0 },
        disputesLost: { increment: outcome === 'lost' ? 1 : 0 },
        lastVerdictId,
      },
      create: {
        ens,
        totalDisputes: 1,
        disputesWon: outcome === 'won' ? 1 : 0,
        disputesLost: outcome === 'lost' ? 1 : 0,
        frivolityIndex: new Prisma.Decimal(0),
        evidenceQualityScore: new Prisma.Decimal(0),
        lastVerdictId,
      },
    });
  }

  private deterministicWinner(disputeId: string): PanelVoteChoice {
    return hashMod(disputeId, 10) < 7 ? PanelVoteChoice.REFUND : PanelVoteChoice.REJECT;
  }

  private fakeTxHash(disputeId: string, step: SettlementStepType): string {
    const tag = step
      .toLowerCase()
      .replace(/[^a-z]/g, '')
      .slice(0, 6);
    const id = disputeId
      .replace(/[^a-f0-9]/g, '')
      .padEnd(40, '0')
      .slice(0, 40);
    return `0x${tag.padEnd(8, '0')}${id}${'00'.padEnd(16, '0')}`.slice(0, 66);
  }

  private detailFor(step: SettlementStepType, outcome: PanelVoteChoice): string {
    if (outcome === PanelVoteChoice.REJECT && step === SettlementStepType.FUNDS_RELEASED) {
      return 'no settlement (panel rejected claim)';
    }
    switch (step) {
      case SettlementStepType.VERDICT_ONCHAIN:
        return 'verdict signed 3/3 and submitted via KeeperHub';
      case SettlementStepType.KEEPER_CLAIMED:
        return 'guaranteed by KeeperHub bond';
      case SettlementStepType.FUNDS_RELEASED:
        return 'routed via Uniswap V4, 0.05% slippage';
      case SettlementStepType.ENS_REPUTATION:
        return 'verdikt.eth reverse record updated';
    }
  }

  private emitVoteUpdate(disputeId: string, vote: { id: string }): void {
    void (async () => {
      const fresh = await this.prisma.panelVote.findUniqueOrThrow({ where: { id: vote.id } });
      const event: VoteUpdateEvent = {
        type: 'vote.update',
        disputeId,
        panelVote: serializePanelVote(fresh),
      };
      this.events.emit(`dispute.${disputeId}`, event);
    })();
  }

  private emitDisputeStatus(disputeId: string, status: DisputeStatus): void {
    const event: DisputeStatusEvent = {
      type: 'dispute.status',
      disputeId,
      status,
    };
    this.events.emit(`dispute.${disputeId}`, event);
  }

  private emitVerdictCreated(disputeId: string, verdict: { id: string }): void {
    void (async () => {
      const fresh = await this.prisma.verdict.findUniqueOrThrow({ where: { id: verdict.id } });
      const event: VerdictCreatedEvent = {
        type: 'verdict.created',
        disputeId,
        verdict: serializeVerdict(fresh),
      };
      this.events.emit(`dispute.${disputeId}`, event);
    })();
  }

  private emitSettlementStep(disputeId: string, step: { id: string }): void {
    void (async () => {
      const fresh = await this.prisma.settlementStep.findUniqueOrThrow({
        where: { id: step.id },
      });
      const event: SettlementStepEvent = {
        type: 'settlement.step',
        disputeId,
        settlementStep: serializeSettlementStep(fresh),
      };
      this.events.emit(`dispute.${disputeId}`, event);
    })();
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise<void>((res) => setTimeout(res, ms));
  }
}

// Re-export to satisfy circular dependency concerns; serializeDispute used elsewhere.
export { serializeDispute };
