import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import type { AddEvidenceInput, Evidence } from '@tribune/types';

import { serializeEvidence } from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EvidenceService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(disputeId: string, input: AddEvidenceInput): Promise<Evidence | null> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      select: { id: true },
    });
    if (!dispute) return null;

    const created = await this.prisma.evidence.create({
      data: {
        disputeId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageUri: `0g://storage/${randomUUID()}`,
      },
    });
    return serializeEvidence(created);
  }
}
