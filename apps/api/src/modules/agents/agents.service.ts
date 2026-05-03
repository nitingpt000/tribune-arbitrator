import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AgentReputationDisputeRow, AgentReputationResponse } from '@tribune/types';

import { serializeAgentReputation } from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReputation(ens: string): Promise<AgentReputationResponse> {
    const reputation = await this.prisma.agentReputation.upsert({
      where: { ens },
      update: {},
      create: {
        ens,
        totalDisputes: 0,
        disputesWon: 0,
        disputesLost: 0,
        frivolityIndex: new Prisma.Decimal(0),
        evidenceQualityScore: new Prisma.Decimal(0),
      },
    });

    const recent = await this.prisma.dispute.findMany({
      where: { OR: [{ claimantEns: ens }, { respondentEns: ens }] },
      include: { verdict: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const recentDisputes: AgentReputationDisputeRow[] = recent.map((d) => {
      const isClaimant = d.claimantEns === ens;
      return {
        id: d.id,
        status: d.status,
        outcome: d.verdict?.outcome ?? null,
        amountUsdc: Number(d.amountUsdc),
        counterparty: isClaimant ? d.respondentEns : d.claimantEns,
        role: isClaimant ? 'claimant' : 'respondent',
        closedAt: d.verdict ? d.verdict.createdAt : null,
      };
    });

    return {
      ...serializeAgentReputation(reputation),
      recentDisputes,
    };
  }
}
