import { Controller, Get, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('panel')
@Controller()
class PanelHealthController {
  constructor(private readonly config: ConfigService) {}

  @Get('health')
  @ApiOperation({ summary: 'Liveness check' })
  health(): { status: 'ok'; profile: string; uptimeSec: number } {
    return {
      status: 'ok',
      profile: this.config.get<string>('APP_PROFILE') ?? 'test',
      uptimeSec: Math.round(process.uptime()),
    };
  }

  @Get('info')
  @ApiOperation({ summary: 'Panel version + active profile' })
  info(): { service: 'panel'; version: string; profile: string } {
    return {
      service: 'panel',
      version: '0.3.0',
      profile: this.config.get<string>('APP_PROFILE') ?? 'test',
    };
  }
}

@Module({ controllers: [PanelHealthController] })
export class HealthModule {}
