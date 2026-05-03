import { Body, Controller, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddEvidenceInput, type Evidence } from '@tribune/types';

import { ZodValidationPipe } from '../../common/zod.pipe';

import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@Controller('disputes/:id/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post()
  @ApiOperation({ summary: 'Attach evidence metadata to a dispute' })
  async submit(
    @Param('id', new ParseUUIDPipe()) disputeId: string,
    @Body(new ZodValidationPipe(AddEvidenceInput)) body: AddEvidenceInput,
  ): Promise<Evidence> {
    const result = await this.evidence.submit(disputeId, body);
    if (!result) throw new NotFoundException(`Dispute ${disputeId} not found`);
    return result;
  }
}
