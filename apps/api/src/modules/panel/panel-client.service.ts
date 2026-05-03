import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { serializeEvidence } from '../../common/serializers';

@Injectable()
export class PanelClientService {
  private readonly logger = new Logger(PanelClientService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Fire-and-forget POST to apps/panel. The panel posts vote/verdict/settlement
   * events back to /panel-callback/* on this app, and the existing SSE stream
   * relays them to the frontend untouched.
   */
  async startAdjudication(disputeId: string): Promise<void> {
    const url = `${this.panelBaseUrl}/adjudicate`;
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { evidence: { orderBy: { createdAt: 'asc' } } },
    });
    if (!dispute) {
      this.logger.warn(`startAdjudication: dispute ${disputeId} not found`);
      return;
    }

    const body = {
      disputeId,
      evidenceBundle: {
        disputeId,
        claimType: dispute.claimType,
        statement: dispute.statement,
        claimantEns: dispute.claimantEns,
        respondentEns: dispute.respondentEns,
        txHash: dispute.txHash,
        amountUsdc: Number(dispute.amountUsdc),
        files: dispute.evidence.map((row) => ({
          ...serializeEvidence(row),
          inlineContent: undefined,
        })),
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tribune-panel-secret': this.sharedSecret,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        this.logger.warn(
          `panel /adjudicate ${response.status} for ${disputeId}: ${text.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `panel /adjudicate fetch failed for ${disputeId}: ${(err as Error).message}`,
      );
    }
  }

  private get panelBaseUrl(): string {
    return (this.config.get<string>('PANEL_SERVICE_URL') ?? 'http://localhost:3002').replace(
      /\/$/,
      '',
    );
  }

  private get sharedSecret(): string {
    return this.config.get<string>('TRIBUNE_PANEL_SHARED_SECRET') ?? 'dev-only-change-me';
  }
}
