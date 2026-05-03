import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  UnauthorizedException,
  Headers as HttpHeaders,
  Logger,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdjudicationService } from '../../domain/adjudication.service';
import type { TriggerHandler } from '../../domain/ports/trigger.port';
import type { EvidenceBundle, EvidenceFile } from '../../domain/types/evidence';

import { TRIGGER_CONFIG } from './trigger.tokens';

interface AdjudicateRequest {
  disputeId: string;
  evidenceBundle: EvidenceBundle;
}

interface TriggerConfig {
  sharedSecret: string;
}

@ApiTags('panel')
@Controller()
export class HttpTriggerController implements TriggerHandler {
  private readonly logger = new Logger(HttpTriggerController.name);

  constructor(
    @Inject(AdjudicationService) private readonly adjudication: AdjudicationService,
    @Inject(TRIGGER_CONFIG) private readonly config: TriggerConfig,
  ) {}

  @Post('adjudicate')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger adjudication for a dispute (fire-and-forget)' })
  trigger(
    @HttpHeaders('x-tribune-panel-secret') secret: string | undefined,
    @Body() body: AdjudicateRequest,
  ): { accepted: true; disputeId: string } {
    if (!secret || secret !== this.config.sharedSecret) {
      throw new UnauthorizedException('panel shared secret mismatch');
    }
    if (!body || typeof body.disputeId !== 'string') {
      throw new BadRequestException('disputeId is required');
    }
    if (!body.evidenceBundle) {
      throw new BadRequestException('evidenceBundle is required');
    }
    const bundle = normaliseBundle(body.evidenceBundle, body.disputeId);
    void this.handle({ disputeId: body.disputeId, evidenceBundle: bundle }).catch((err) => {
      this.logger.error(
        `adjudication failed for ${body.disputeId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });
    return { accepted: true, disputeId: body.disputeId };
  }

  async handle(input: { disputeId: string; evidenceBundle: EvidenceBundle }): Promise<void> {
    await this.adjudication.adjudicate(input);
  }
}

function normaliseBundle(input: EvidenceBundle, disputeId: string): EvidenceBundle {
  return {
    disputeId,
    claimType: String(input.claimType),
    statement: String(input.statement),
    claimantEns: String(input.claimantEns),
    respondentEns: String(input.respondentEns),
    txHash: String(input.txHash),
    amountUsdc: Number(input.amountUsdc) || 0,
    files: Array.isArray(input.files) ? input.files.map(normaliseFile) : [],
  };
}

function normaliseFile(file: EvidenceFile): EvidenceFile {
  return {
    id: String(file.id ?? ''),
    filename: String(file.filename ?? ''),
    mimeType: String(file.mimeType ?? 'application/octet-stream'),
    sizeBytes: Number(file.sizeBytes ?? 0),
    storageUri: String(file.storageUri ?? ''),
    inlineContent: file.inlineContent ? String(file.inlineContent) : undefined,
  };
}
