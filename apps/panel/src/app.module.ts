import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { configValidationSchema } from './infrastructure/config/config.schema';
import { AdjudicationModule } from './modules/adjudication.module';
import { HealthModule } from './modules/health.module';
import { MetricsModule } from './modules/metrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false, allowUnknown: true },
    }),
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
    HealthModule,
    MetricsModule,
    AdjudicationModule,
  ],
})
export class AppModule {}
