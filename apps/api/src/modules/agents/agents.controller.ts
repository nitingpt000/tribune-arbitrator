import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type AgentReputationResponse,
  DisputeListQuery,
  type DisputeListResponse,
  EnsName,
} from '@tribune/types';

import { ZodValidationPipe } from '../../common/zod.pipe';
import { DisputesService } from '../disputes/disputes.service';

import { AgentsService } from './agents.service';

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agents: AgentsService,
    private readonly disputes: DisputesService,
  ) {}

  @Get(':ens/reputation')
  @ApiOperation({ summary: 'Agent reputation, auto-created at zero if unknown' })
  async getReputation(@Param('ens') ens: string): Promise<AgentReputationResponse> {
    const parsed = EnsName.safeParse(ens);
    if (!parsed.success) throw new BadRequestException(parsed.error.errors[0]?.message);
    return this.agents.getReputation(parsed.data);
  }

  @Get(':ens/disputes')
  @ApiOperation({ summary: 'Disputes involving this agent (claimant or respondent)' })
  async listDisputes(
    @Param('ens') ens: string,
    @Query(new ZodValidationPipe(DisputeListQuery)) query: DisputeListQuery,
  ): Promise<DisputeListResponse> {
    const parsed = EnsName.safeParse(ens);
    if (!parsed.success) throw new BadRequestException(parsed.error.errors[0]?.message);
    return this.disputes.listForEns(parsed.data, query);
  }
}
