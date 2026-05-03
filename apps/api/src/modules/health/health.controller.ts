import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, type HealthCheckResult } from '@nestjs/terminus';

import { PrismaHealthIndicator } from './prisma.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness + DB connectivity check' })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }
}
