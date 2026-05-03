import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HttpTriggerController } from '../adapters/trigger/http-trigger.adapter';
import { TRIGGER_CONFIG } from '../adapters/trigger/trigger.tokens';
import { AdjudicationService } from '../domain/adjudication.service';
import { SystemClock } from '../infrastructure/clock/system-clock';
import { readPanelConfig } from '../infrastructure/config/config.schema';
import { buildAdjudication } from '../infrastructure/di/adapters';
import { ConsoleDomainLogger } from '../infrastructure/logging/pino-logger';

@Module({
  controllers: [HttpTriggerController],
  providers: [
    {
      provide: AdjudicationService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AdjudicationService => {
        const panelConfig = readPanelConfig({
          APP_PROFILE: config.get<string>('APP_PROFILE'),
          PANEL_PORT: config.get<string>('PANEL_PORT'),
          TRIBUNE_API_URL: config.get<string>('TRIBUNE_API_URL'),
          TRIBUNE_PANEL_SHARED_SECRET: config.get<string>('TRIBUNE_PANEL_SHARED_SECRET'),
          OG_RPC_URL: config.get<string>('OG_RPC_URL'),
          OG_STORAGE_INDEXER_URL: config.get<string>('OG_STORAGE_INDEXER_URL'),
          PANEL_PRIVATE_KEY: config.get<string>('PANEL_PRIVATE_KEY'),
          PANEL_FIXTURES_DIR: config.get<string>('PANEL_FIXTURES_DIR'),
        });
        const logger = new ConsoleDomainLogger({
          service: 'panel',
          profile: panelConfig.appProfile,
        });
        const built = buildAdjudication({
          config: panelConfig,
          logger,
          clock: new SystemClock(),
        });
        return built.service;
      },
    },
    {
      provide: TRIGGER_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        sharedSecret: config.get<string>('TRIBUNE_PANEL_SHARED_SECRET') ?? 'dev-only-change-me',
      }),
    },
  ],
  exports: [AdjudicationService],
})
export class AdjudicationModule {}
