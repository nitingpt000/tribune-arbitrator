import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  DisputeStatus,
  PanelVoteChoice,
  PanelVoteStatus,
  Prisma,
  SettlementStepStatus,
  SettlementStepType,
} from '@prisma/client';

import { hashMod } from '../../common/hash';
import { PrismaService } from '../../prisma/prisma.service';

import { MockPanelService } from './mock-panel.service';
import { ReasoningTemplateService } from './reasoning-templates';

interface DisputeRow {
  id: string;
  status: DisputeStatus;
  claimantEns: string;
  respondentEns: string;
  claimType: string;
  amountUsdc: Prisma.Decimal;
}

interface PanelVoteRow {
  id: string;
  disputeId: string;
  modelName: string;
  vote: PanelVoteChoice;
  confidence: Prisma.Decimal;
  reasoning: string;
  status: PanelVoteStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface SettlementStepRow {
  id: string;
  disputeId: string;
  step: SettlementStepType;
  status: SettlementStepStatus;
  txHash: string | null;
  detail: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

interface VerdictRow {
  id: string;
  disputeId: string;
  outcome: PanelVoteChoice;
  votesFor: number;
  votesAgainst: number;
  totalDurationMs: number;
  totalCostUsd: Prisma.Decimal;
  createdAt: Date;
}

class InMemoryPrisma {
  private disputes = new Map<string, DisputeRow>();
  private panelVotes = new Map<string, PanelVoteRow>();
  private settlementSteps = new Map<string, SettlementStepRow>();
  private verdicts = new Map<string, VerdictRow>();
  private reputations = new Map<
    string,
    {
      ens: string;
      totalDisputes: number;
      disputesWon: number;
      disputesLost: number;
      lastVerdictId: string | null;
    }
  >();
  private idCounter = 0;
  private nextId(): string {
    this.idCounter += 1;
    return `id-${this.idCounter}`;
  }

  seedDispute(claimType = 'service_not_delivered'): DisputeRow {
    const id = this.nextId();
    const dispute: DisputeRow = {
      id,
      status: DisputeStatus.PENDING,
      claimantEns: 'alice.test.eth',
      respondentEns: 'bob.test.eth',
      claimType,
      amountUsdc: new Prisma.Decimal(100),
    };
    this.disputes.set(id, dispute);
    for (const model of ['qwen3.6-plus', 'glm-5-fp8', 'llama-4-70b']) {
      const voteId = this.nextId();
      this.panelVotes.set(voteId, {
        id: voteId,
        disputeId: id,
        modelName: model,
        vote: PanelVoteChoice.ABSTAIN,
        confidence: new Prisma.Decimal(0),
        reasoning: '',
        status: PanelVoteStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    for (const step of [
      SettlementStepType.VERDICT_ONCHAIN,
      SettlementStepType.KEEPER_CLAIMED,
      SettlementStepType.FUNDS_RELEASED,
      SettlementStepType.ENS_REPUTATION,
    ]) {
      const stepId = this.nextId();
      this.settlementSteps.set(stepId, {
        id: stepId,
        disputeId: id,
        step,
        status: SettlementStepStatus.PENDING,
        txHash: null,
        detail: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
      });
    }
    return dispute;
  }

  asPrisma(): PrismaService {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self: InMemoryPrisma = this;
    return {
      dispute: {
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<DisputeRow>;
        }): Promise<DisputeRow> => {
          const row = { ...self.disputes.get(where.id)!, ...data } as DisputeRow;
          self.disputes.set(where.id, row);
          return Promise.resolve(row);
        },
        findUniqueOrThrow: ({
          where,
          include,
        }: {
          where: { id: string };
          include?: { panelVotes?: unknown };
        }): Promise<DisputeRow & { panelVotes?: PanelVoteRow[] }> => {
          const dispute = self.disputes.get(where.id);
          if (!dispute) throw new Error('not found');
          const result: DisputeRow & { panelVotes?: PanelVoteRow[] } = { ...dispute };
          if (include?.panelVotes) {
            result.panelVotes = [...self.panelVotes.values()].filter(
              (v) => v.disputeId === where.id,
            );
          }
          return Promise.resolve(result);
        },
      },
      panelVote: {
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<PanelVoteRow>;
        }): Promise<PanelVoteRow> => {
          const row = { ...self.panelVotes.get(where.id)!, ...data, updatedAt: new Date() };
          self.panelVotes.set(where.id, row);
          return Promise.resolve(row);
        },
        findUniqueOrThrow: ({ where }: { where: { id: string } }): Promise<PanelVoteRow> =>
          Promise.resolve(self.panelVotes.get(where.id)!),
        findMany: ({ where }: { where: { disputeId: string } }): Promise<PanelVoteRow[]> =>
          Promise.resolve(
            [...self.panelVotes.values()].filter((v) => v.disputeId === where.disputeId),
          ),
      },
      settlementStep: {
        findMany: ({ where }: { where: { disputeId: string } }): Promise<SettlementStepRow[]> =>
          Promise.resolve(
            [...self.settlementSteps.values()]
              .filter((s) => s.disputeId === where.disputeId)
              .sort((a, b) => a.step.localeCompare(b.step)),
          ),
        update: ({
          where,
          data,
        }: {
          where: { id: string };
          data: Partial<SettlementStepRow>;
        }): Promise<SettlementStepRow> => {
          const row = { ...self.settlementSteps.get(where.id)!, ...data };
          self.settlementSteps.set(where.id, row);
          return Promise.resolve(row);
        },
        findUniqueOrThrow: ({ where }: { where: { id: string } }): Promise<SettlementStepRow> =>
          Promise.resolve(self.settlementSteps.get(where.id)!),
      },
      verdict: {
        create: ({ data }: { data: Omit<VerdictRow, 'id' | 'createdAt'> }): Promise<VerdictRow> => {
          const id = self.nextId();
          const row: VerdictRow = { id, createdAt: new Date(), ...data };
          self.verdicts.set(id, row);
          return Promise.resolve(row);
        },
        findUniqueOrThrow: ({ where }: { where: { id: string } }): Promise<VerdictRow> =>
          Promise.resolve(self.verdicts.get(where.id)!),
        findUnique: ({ where }: { where: { disputeId: string } }): Promise<VerdictRow | null> =>
          Promise.resolve(
            [...self.verdicts.values()].find((v) => v.disputeId === where.disputeId) ?? null,
          ),
      },
      agentReputation: {
        upsert: ({
          where,
          update,
          create,
        }: {
          where: { ens: string };
          update: Record<string, unknown>;
          create: Record<string, unknown>;
        }): Promise<void> => {
          const existing = self.reputations.get(where.ens);
          if (!existing) {
            self.reputations.set(where.ens, create as never);
          } else {
            // simple incrementer
            const next = { ...existing };
            const upd = update as Record<string, unknown>;
            if (
              typeof upd.totalDisputes === 'object' &&
              upd.totalDisputes &&
              'increment' in upd.totalDisputes
            ) {
              next.totalDisputes += (upd.totalDisputes as { increment: number }).increment;
            }
            if (
              typeof upd.disputesWon === 'object' &&
              upd.disputesWon &&
              'increment' in upd.disputesWon
            ) {
              next.disputesWon += (upd.disputesWon as { increment: number }).increment;
            }
            if (
              typeof upd.disputesLost === 'object' &&
              upd.disputesLost &&
              'increment' in upd.disputesLost
            ) {
              next.disputesLost += (upd.disputesLost as { increment: number }).increment;
            }
            self.reputations.set(where.ens, next);
          }
          return Promise.resolve();
        },
      },
    } as unknown as PrismaService;
  }

  getDispute(id: string): DisputeRow {
    return this.disputes.get(id)!;
  }
  getPanelVotes(id: string): PanelVoteRow[] {
    return [...this.panelVotes.values()].filter((v) => v.disputeId === id);
  }
  getSettlement(id: string): SettlementStepRow[] {
    return [...this.settlementSteps.values()].filter((s) => s.disputeId === id);
  }
  getVerdict(id: string): VerdictRow | undefined {
    return [...this.verdicts.values()].find((v) => v.disputeId === id);
  }
  getReputation(
    ens: string,
  ): { totalDisputes: number; disputesWon: number; disputesLost: number } | undefined {
    return this.reputations.get(ens) as
      | { totalDisputes: number; disputesWon: number; disputesLost: number }
      | undefined;
  }
}

describe('MockPanelService', () => {
  let service: MockPanelService;
  let store: InMemoryPrisma;

  beforeEach(async () => {
    store = new InMemoryPrisma();
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        MockPanelService,
        ReasoningTemplateService,
        { provide: PrismaService, useValue: store.asPrisma() },
      ],
    }).compile();
    service = module.get(MockPanelService);
    // Speed up the lifecycle: use minimal delays for tests.
    service.setPhasesForTests({
      preAdjudicationMs: 1,
      perVoteMinReasoningMs: 1,
      perVoteMaxReasoningMs: 2,
      settlementStepMs: {
        VERDICT_ONCHAIN: 1,
        KEEPER_CLAIMED: 1,
        FUNDS_RELEASED: 1,
        ENS_REPUTATION: 1,
      },
    });

    // Make event emissions synchronous-ish for the test by using the EventEmitter2 default config.
    const events = module.get(EventEmitter2);
    expect(events).toBeDefined();
  });

  it('runs the full lifecycle and writes a deterministic verdict', async () => {
    const dispute = store.seedDispute('service_not_delivered');

    await service.startAdjudication(dispute.id);

    const after = store.getDispute(dispute.id);
    expect(['SETTLED', 'REJECTED']).toContain(after.status);

    const votes = store.getPanelVotes(dispute.id);
    expect(votes).toHaveLength(3);
    for (const v of votes) {
      expect(v.status).toBe(PanelVoteStatus.VOTED);
      expect(['REFUND', 'REJECT']).toContain(v.vote);
      expect(v.reasoning.length).toBeGreaterThan(0);
      expect(Number(v.confidence)).toBeGreaterThanOrEqual(0.7);
      expect(Number(v.confidence)).toBeLessThanOrEqual(0.95);
    }

    const verdict = store.getVerdict(dispute.id);
    expect(verdict).toBeDefined();
    const expectedOutcome =
      hashMod(dispute.id, 10) < 7 ? PanelVoteChoice.REFUND : PanelVoteChoice.REJECT;
    expect(verdict!.outcome).toBe(expectedOutcome);

    const settlement = store.getSettlement(dispute.id);
    expect(settlement).toHaveLength(4);
    for (const s of settlement) expect(s.status).toBe(SettlementStepStatus.COMPLETED);

    const claimantRep = store.getReputation(dispute.claimantEns);
    const respondentRep = store.getReputation(dispute.respondentEns);
    expect(claimantRep?.totalDisputes).toBe(1);
    expect(respondentRep?.totalDisputes).toBe(1);
  });

  it('produces the same verdict outcome for the same disputeId (determinism)', async () => {
    const a = store.seedDispute('service_not_delivered');
    a.id = 'fixed-deterministic-id';
    store['disputes'].set('fixed-deterministic-id', a);
    // re-key panelVotes/settlementSteps to the new id
    for (const [, vote] of store['panelVotes'])
      if (vote.disputeId === 'id-1') vote.disputeId = 'fixed-deterministic-id';
    for (const [, step] of store['settlementSteps'])
      if (step.disputeId === 'id-1') step.disputeId = 'fixed-deterministic-id';

    await service.startAdjudication(a.id);
    const v1 = store.getVerdict(a.id)!;

    const expected = hashMod(a.id, 10) < 7 ? PanelVoteChoice.REFUND : PanelVoteChoice.REJECT;
    expect(v1.outcome).toBe(expected);
  });
});
