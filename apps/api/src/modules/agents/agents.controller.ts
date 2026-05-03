import { Controller, Get, HttpCode, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { AgentsService } from './agents.service';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get(':ens/reputation')
  @HttpCode(501)
  @ApiOperation({ summary: 'Get an agent reputation by ENS' })
  getReputation(@Param('ens') ens: string): never {
    return this.agents.getReputation(ens);
  }
}
