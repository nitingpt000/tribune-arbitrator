import { Module } from '@nestjs/common';

import { PanelModule } from '../panel/panel.module';
import { StatsModule } from '../stats/stats.module';

import { DisputeStreamController } from './dispute-stream.controller';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';

@Module({
  imports: [PanelModule, StatsModule],
  controllers: [DisputesController, DisputeStreamController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
