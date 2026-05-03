import {
  BadRequestException,
  Body,
  Controller,
  Headers as HttpHeaders,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DisputeStatus,
  PanelVoteChoice,
  PanelVoteStatus,
  Prisma,
  SettlementStepStatus,
  SettlementStepType,
} from '@prisma/client';
import type {
  DisputeStatusEvent,
  SettlementStepEvent,
  VerdictCreatedEvent,
  VoteUpdateEvent,
} from '@tribune/types';

import {
  serializePanelVote,
  serializeSettlementStep,
  serializeVerdict,
} from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

interface VoteUpdatePayload {
  disputeId: string;
  modelName: string;
  status: 'REASONING' | 'VOTED' | 'FAILED';
  vote?: 'REFUND' | 'REJECT' | 'ABSTAIN';
  confidence?: number;
  reasoning?: string;
}

interface SettlementStepPayload {
  disputeId: string;
  step: SettlementStepType;
  status?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  txHash?: string;
  detail?: string;
}

interface VerdictPayload {
  disputeId: string;
  outcome: 'REFUND' | 'REJECT' | 'ABSTAIN' | 'FAILED';
  votesFor: number;
  votesAgainst: number;
  bundleUri: string;
  totalDurationMs: number;
  totalCostUsd: number;
}

@ApiTags('panel')
@Controller('panel-callback')
export class PanelCallbackController {
  private readonly logger = new Logger(PanelCallbackController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  @Post('vote-update')
  @HttpCode(204)
  @ApiOperation({ summary: 'Panel reports a vote status / vote completion' })
  async voteUpdate(
    @HttpHeaders('x-tribune-panel-secret') secret: string | undefined,
    @Body() body: VoteUpdatePayload,
  ): Promise<void> {
    this.assertSecret(secret);
    const { disputeId, modelName, status } = body;
    if (!disputeId || !modelName || !status) {
      throw new BadRequestException('disputeId, modelName, status required');
    }

    const data: Prisma.PanelVoteUpdateInput = {
      status: status as PanelVoteStatus,
    };
    if (status === 'VOTED') {
      if (!body.vote || typeof body.confidence !== 'number') {
        throw new BadRequestException('VOTED requires vote and confidence');
      }
      data.vote = body.vote as PanelVoteChoice;
      data.confidence = new Prisma.Decimal(body.confidence);
      data.reasoning = body.reasoning ?? '';
    } else if (status === 'FAILED') {
      data.vote = PanelVoteChoice.ABSTAIN;
      data.confidence = new Prisma.Decimal(0);
      data.reasoning = body.reasoning ?? '';
    }

    const vote = await this.prisma.panelVote
      .update({
        where: { disputeId_modelName: { disputeId, modelName } },
        data,
      })
      .catch((err) => {
        this.logger.warn(
          `panel-callback vote-update failed for ${disputeId} ${modelName}: ${(err as Error).message}`,
        );
        return null;
      });
    if (!vote) return;

    if (status === 'REASONING') {
      await this.prisma.dispute
        .update({
          where: { id: disputeId },
          data: { status: DisputeStatus.ADJUDICATING },
        })
        .catch(() => undefined);
      const statusEvent: DisputeStatusEvent = {
        type: 'dispute.status',
        disputeId,
        status: 'ADJUDICATING',
      };
      this.events.emit(`dispute.${disputeId}`, statusEvent);
    }

    const event: VoteUpdateEvent = {
      type: 'vote.update',
      disputeId,
      panelVote: serializePanelVote(vote),
    };
    this.events.emit(`dispute.${disputeId}`, event);
  }

  @Post('verdict')
  @HttpCode(204)
  @ApiOperation({ summary: 'Panel reports a final verdict' })
  async verdict(
    @HttpHeaders('x-tribune-panel-secret') secret: string | undefined,
    @Body() body: VerdictPayload,
  ): Promise<void> {
    this.assertSecret(secret);
    const { disputeId } = body;
    if (!disputeId) throw new BadRequestException('disputeId required');

    const isFailed = body.outcome === 'FAILED' || body.outcome === 'ABSTAIN';
    const finalStatus =
      body.outcome === 'REFUND'
        ? DisputeStatus.SETTLED
        : body.outcome === 'REJECT'
          ? DisputeStatus.REJECTED
          : isFailed
            ? DisputeStatus.REJECTED
            : DisputeStatus.SETTLED;

    const verdict = await this.prisma.verdict
      .upsert({
        where: { disputeId },
        update: {
          outcome: (body.outcome === 'FAILED' ? 'ABSTAIN' : body.outcome) as PanelVoteChoice,
          votesFor: body.votesFor,
          votesAgainst: body.votesAgainst,
          totalDurationMs: body.totalDurationMs,
          totalCostUsd: new Prisma.Decimal(body.totalCostUsd),
        },
        create: {
          disputeId,
          outcome: (body.outcome === 'FAILED' ? 'ABSTAIN' : body.outcome) as PanelVoteChoice,
          votesFor: body.votesFor,
          votesAgainst: body.votesAgainst,
          totalDurationMs: body.totalDurationMs,
          totalCostUsd: new Prisma.Decimal(body.totalCostUsd),
        },
      })
      .catch((err) => {
        this.logger.warn(
          `panel-callback verdict upsert failed for ${disputeId}: ${(err as Error).message}`,
        );
        return null;
      });

    await this.prisma.dispute
      .update({ where: { id: disputeId }, data: { status: finalStatus } })
      .catch(() => undefined);

    if (verdict) {
      const event: VerdictCreatedEvent = {
        type: 'verdict.created',
        disputeId,
        verdict: serializeVerdict(verdict),
      };
      this.events.emit(`dispute.${disputeId}`, event);
    }
    const statusEvent: DisputeStatusEvent = {
      type: 'dispute.status',
      disputeId,
      status: finalStatus,
    };
    this.events.emit(`dispute.${disputeId}`, statusEvent);
  }

  @Post('settlement-step')
  @HttpCode(204)
  @ApiOperation({ summary: 'Panel reports a settlement-step transition' })
  async settlementStep(
    @HttpHeaders('x-tribune-panel-secret') secret: string | undefined,
    @Body() body: SettlementStepPayload,
  ): Promise<void> {
    this.assertSecret(secret);
    const { disputeId, step } = body;
    if (!disputeId || !step) {
      throw new BadRequestException('disputeId and step required');
    }
    const status: SettlementStepStatus = (body.status ?? 'COMPLETED') as SettlementStepStatus;
    const data: Prisma.SettlementStepUpdateInput = { status };
    if (status === 'IN_PROGRESS') data.startedAt = new Date();
    if (status === 'COMPLETED' || status === 'FAILED') data.completedAt = new Date();
    if (body.txHash) data.txHash = body.txHash;
    if (body.detail) data.detail = body.detail;

    const updated = await this.prisma.settlementStep
      .update({
        where: { disputeId_step: { disputeId, step } },
        data,
      })
      .catch((err) => {
        this.logger.warn(
          `panel-callback settlement-step failed for ${disputeId} ${step}: ${(err as Error).message}`,
        );
        return null;
      });
    if (!updated) return;

    const event: SettlementStepEvent = {
      type: 'settlement.step',
      disputeId,
      settlementStep: serializeSettlementStep(updated),
    };
    this.events.emit(`dispute.${disputeId}`, event);
  }

  private assertSecret(secret: string | undefined): void {
    const expected = this.config.get<string>('TRIBUNE_PANEL_SHARED_SECRET') ?? 'dev-only-change-me';
    if (!secret || secret !== expected) {
      throw new UnauthorizedException('panel shared secret mismatch');
    }
  }
}
