import { Injectable, NotImplementedException } from '@nestjs/common';

import type { CreateDisputeDto } from './dto/create-dispute.dto';

@Injectable()
export class DisputesService {
  create(_input: CreateDisputeDto): never {
    throw new NotImplementedException('Dispute creation is not implemented');
  }

  list(): never {
    throw new NotImplementedException('Dispute listing is not implemented');
  }

  get(_id: string): never {
    throw new NotImplementedException('Dispute retrieval is not implemented');
  }
}
