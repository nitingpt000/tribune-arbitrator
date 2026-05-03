import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PANELIST_MODELS,
  type CreateDisputeInput,
  type Dispute,
  type DisputeListQuery,
  type DisputeListResponse,
} from '@tribune/types';

import {
  serializeDispute,
  serializeDisputeSummary,
  type DisputeWithRelations,
} from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';
import { PanelClientService } from '../panel/panel-client.service';

const DEFAULT_INCLUDE = {
  evidence: { orderBy: { createdAt: 'asc' as const } },
  panelVotes: { orderBy: { createdAt: 'asc' as const } },
  verdict: true,
  settlementSteps: { orderBy: { step: 'asc' as const } },
};

const SUMMARY_INCLUDE = {
  verdict: true,
  _count: { select: { evidence: true, panelVotes: true } },
};

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly panel: PanelClientService,
  ) {}

  async create(input: CreateDisputeInput): Promise<Dispute> {
    const created = await this.prisma.dispute.create({
      data: {
        claimantEns: input.claimantEns,
        respondentEns: input.respondentEns,
        claimType: input.claimType,
        statement: input.statement,
        txHash: input.txHash,
        amountUsdc: new Prisma.Decimal(input.amountUsdc),
        panelVotes: {
          create: PANELIST_MODELS.map((model) => ({ modelName: model })),
        },
        settlementSteps: {
          create: [
            { step: 'VERDICT_ONCHAIN' as const },
            { step: 'KEEPER_CLAIMED' as const },
            { step: 'FUNDS_RELEASED' as const },
            { step: 'ENS_REPUTATION' as const },
          ],
        },
      },
      include: DEFAULT_INCLUDE,
    });

    void this.panel.startAdjudication(created.id);

    return serializeDispute(created as DisputeWithRelations);
  }

  async list(query: DisputeListQuery): Promise<DisputeListResponse> {
    const where: Prisma.DisputeWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.claimantEns) where.claimantEns = query.claimantEns;
    if (query.respondentEns) where.respondentEns = query.respondentEns;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: rows.map(serializeDisputeSummary),
      total,
      hasMore: query.offset + rows.length < total,
    };
  }

  async listForEns(ens: string, query: DisputeListQuery): Promise<DisputeListResponse> {
    const where: Prisma.DisputeWhereInput = {
      OR: [{ claimantEns: ens }, { respondentEns: ens }],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.dispute.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.dispute.count({ where }),
    ]);

    return {
      disputes: rows.map(serializeDisputeSummary),
      total,
      hasMore: query.offset + rows.length < total,
    };
  }

  async getById(id: string): Promise<Dispute> {
    const row = await this.prisma.dispute.findUnique({
      where: { id },
      include: DEFAULT_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Dispute ${id} not found`);
    return serializeDispute(row as DisputeWithRelations);
  }
}
