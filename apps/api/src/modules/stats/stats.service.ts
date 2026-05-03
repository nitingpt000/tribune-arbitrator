import { Injectable } from '@nestjs/common';
import { DisputeStatus, PanelVoteChoice } from '@prisma/client';
import type { StatsResponse } from '@tribune/types';

import { PrismaService } from '../../prisma/prisma.service';

const TTL_MS = 30_000;

@Injectable()
export class StatsService {
  private cached: { value: StatsResponse; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<StatsResponse> {
    const now = Date.now();
    if (this.cached && this.cached.expiresAt > now) return this.cached.value;
    const value = await this.compute();
    this.cached = { value, expiresAt: now + TTL_MS };
    return value;
  }

  invalidate(): void {
    this.cached = null;
  }

  private async compute(): Promise<StatsResponse> {
    const [total, active, settled, refunds, verdictAgg] = await Promise.all([
      this.prisma.dispute.count(),
      this.prisma.dispute.count({
        where: { status: { in: [DisputeStatus.PENDING, DisputeStatus.ADJUDICATING] } },
      }),
      this.prisma.dispute.count({ where: { status: DisputeStatus.SETTLED } }),
      this.prisma.dispute.findMany({
        where: { status: DisputeStatus.SETTLED, verdict: { outcome: PanelVoteChoice.REFUND } },
        select: { amountUsdc: true },
      }),
      this.prisma.verdict.aggregate({
        _avg: { totalDurationMs: true, totalCostUsd: true },
      }),
    ]);

    const refundedUsdc = refunds.reduce((acc, d) => acc + Number(d.amountUsdc), 0);
    const avgSettlementSeconds = verdictAgg._avg.totalDurationMs
      ? Number(verdictAgg._avg.totalDurationMs) / 1000
      : 0;
    const avgCostUsd = verdictAgg._avg.totalCostUsd ? Number(verdictAgg._avg.totalCostUsd) : 0;

    return {
      total,
      active,
      settled,
      refundedUsdc,
      avgSettlementSeconds: Number(avgSettlementSeconds.toFixed(1)),
      avgCostUsd: Number(avgCostUsd.toFixed(4)),
    };
  }
}
