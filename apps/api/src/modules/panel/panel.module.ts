import { Module } from '@nestjs/common';

import { MockPanelService } from './mock-panel.service';
import { ReasoningTemplateService } from './reasoning-templates';

@Module({
  providers: [MockPanelService, ReasoningTemplateService],
  exports: [MockPanelService],
})
export class PanelModule {}
