import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

interface InfoResponse {
  version: string;
  appProfile: 'local' | 'demo' | 'test' | 'replay' | 'unknown';
  panelMode: 'live' | 'replay' | 'test' | 'mock' | 'unknown';
  demoModeLabel: string;
  panelServiceUrl: string;
}

@ApiTags('info')
@Controller('info')
export class InfoController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Service info: version, profile, panel mode' })
  get(): InfoResponse {
    const profile = (this.config.get<string>('APP_PROFILE') ??
      'unknown') as InfoResponse['appProfile'];
    const panelMode: InfoResponse['panelMode'] =
      profile === 'local'
        ? 'live'
        : profile === 'demo'
          ? 'replay'
          : profile === 'replay'
            ? 'replay'
            : profile === 'test'
              ? 'test'
              : 'unknown';
    const labels: Record<InfoResponse['panelMode'], string> = {
      live: 'Live panel',
      replay: 'Replay',
      test: 'Test panel',
      mock: 'Mock panel',
      unknown: 'Unknown',
    };
    return {
      version: '0.3.0',
      appProfile: profile,
      panelMode,
      demoModeLabel: labels[panelMode],
      panelServiceUrl: this.config.get<string>('PANEL_SERVICE_URL') ?? 'http://localhost:3002',
    };
  }
}
