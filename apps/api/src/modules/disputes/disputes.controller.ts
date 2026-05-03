import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateDisputeInput,
  DisputeListQuery,
  type Dispute,
  type DisputeListResponse,
  type StatsResponse,
} from '@tribune/types';

import { ZodValidationPipe } from '../../common/zod.pipe';
import { StatsService } from '../stats/stats.service';

import { DisputesService } from './disputes.service';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(
    private readonly disputes: DisputesService,
    private readonly stats: StatsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'File a new dispute and start adjudication' })
  @UsePipes(new ZodValidationPipe(CreateDisputeInput))
  async create(@Body() body: CreateDisputeInput): Promise<Dispute> {
    return this.disputes.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'List disputes with optional filters' })
  async list(
    @Query(new ZodValidationPipe(DisputeListQuery)) query: DisputeListQuery,
  ): Promise<DisputeListResponse> {
    return this.disputes.list(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Aggregate dispute stats (cached 30s)' })
  async getStats(): Promise<StatsResponse> {
    return this.stats.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full dispute by id' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<Dispute> {
    return this.disputes.getById(id);
  }
}
