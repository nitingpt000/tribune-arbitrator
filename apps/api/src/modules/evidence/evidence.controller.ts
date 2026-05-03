import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { SubmitEvidenceDto } from './dto/submit-evidence.dto';
import { EvidenceService } from './evidence.service';

@ApiTags('evidence')
@Controller('disputes/:id/evidence')
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}

  @Post()
  @HttpCode(501)
  @ApiOperation({ summary: 'Submit evidence to a dispute' })
  submit(
    @Param('id', new ParseUUIDPipe()) disputeId: string,
    @Body() body: SubmitEvidenceDto,
  ): never {
    return this.evidence.submit(disputeId, body);
  }
}
