import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

interface ContractAddresses {
  arbitrator: string | null;
  panelRegistry: string | null;
  exampleEscrow: string | null;
  settlementToken: string | null;
  chainId: number;
  explorerBaseUrl: string;
}

interface InfoResponse {
  version: string;
  appProfile: 'local' | 'demo' | 'test' | 'replay' | 'unknown';
  panelMode: 'live' | 'live-onchain' | 'replay' | 'replay-onchain' | 'test' | 'mock' | 'unknown';
  demoModeLabel: string;
  panelServiceUrl: string;
  contracts: ContractAddresses;
}

@ApiTags('info')
@Controller('info')
export class InfoController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Service info: version, profile, panel mode, contract addresses' })
  get(): InfoResponse {
    const profile = (this.config.get<string>('APP_PROFILE') ??
      'unknown') as InfoResponse['appProfile'];
    const arbitrator = this.config.get<string>('ARBITRATOR_ADDRESS') ?? null;
    const onchain = Boolean(arbitrator);

    const panelMode: InfoResponse['panelMode'] =
      profile === 'local'
        ? onchain
          ? 'live-onchain'
          : 'live'
        : profile === 'demo'
          ? onchain
            ? 'replay-onchain'
            : 'replay'
          : profile === 'replay'
            ? 'replay'
            : profile === 'test'
              ? 'test'
              : 'unknown';

    const labels: Record<InfoResponse['panelMode'], string> = {
      live: 'Live panel',
      'live-onchain': 'Onchain (testnet)',
      replay: 'Replay',
      'replay-onchain': 'Replay · onchain',
      test: 'Test panel',
      mock: 'Mock panel',
      unknown: 'Unknown',
    };

    return {
      version: '0.4.0',
      appProfile: profile,
      panelMode,
      demoModeLabel: labels[panelMode],
      panelServiceUrl: this.config.get<string>('PANEL_SERVICE_URL') ?? 'http://localhost:3002',
      contracts: {
        arbitrator,
        panelRegistry: this.config.get<string>('PANEL_REGISTRY_ADDRESS') ?? null,
        exampleEscrow: this.config.get<string>('EXAMPLE_ESCROW_ADDRESS') ?? null,
        settlementToken: this.config.get<string>('SETTLEMENT_TOKEN_ADDRESS') ?? null,
        chainId: Number(this.config.get<string>('CHAIN_ID') ?? 16601),
        explorerBaseUrl:
          this.config.get<string>('EXPLORER_BASE_URL') ?? 'https://chainscan-galileo.0g.ai',
      },
    };
  }
}
