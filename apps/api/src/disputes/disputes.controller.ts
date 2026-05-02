import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post()
  @HttpCode(501)
  @ApiOperation({ summary: 'File a new dispute' })
  create(@Body() body: CreateDisputeDto): never {
    return this.disputes.create(body);
  }

  @Get()
  @HttpCode(501)
  @ApiOperation({ summary: 'List disputes' })
  list(): never {
    return this.disputes.list();
  }

  @Get(':id')
  @HttpCode(501)
  @ApiOperation({ summary: 'Get a dispute by id' })
  get(@Param('id', new ParseUUIDPipe()) id: string): never {
    return this.disputes.get(id);
  }
}
