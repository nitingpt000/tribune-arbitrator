import { Injectable, NotImplementedException } from '@nestjs/common';

import type { SubmitEvidenceDto } from './dto/submit-evidence.dto';

@Injectable()
export class EvidenceService {
  submit(_disputeId: string, _input: SubmitEvidenceDto): never {
    throw new NotImplementedException('Evidence submission is not implemented');
  }
}
