import { Module } from '@nestjs/common';

import { DisputesModule } from '../disputes/disputes.module';

import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [DisputesModule],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
