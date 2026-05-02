import { Injectable, NotImplementedException } from '@nestjs/common';

@Injectable()
export class AgentsService {
  getReputation(_ens: string): never {
    throw new NotImplementedException('Agent reputation is not implemented');
  }
}
