import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';

import { configValidationSchema } from './common/config.schema';
import { AgentsModule } from './modules/agents/agents.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { HealthModule } from './modules/health/health.module';
import { PanelModule } from './modules/panel/panel.module';
import { StatsModule } from './modules/stats/stats.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 64 }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        ...(process.env.NODE_ENV !== 'production'
          ? {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:standard' },
              },
            }
          : {}),
      },
    }),
    PrismaModule,
    HealthModule,
    PanelModule,
    StatsModule,
    DisputesModule,
    EvidenceModule,
    AgentsModule,
  ],
})
export class AppModule {}
