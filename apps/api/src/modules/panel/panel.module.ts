import { Module } from '@nestjs/common';

import { PanelCallbackController } from './panel-callback.controller';
import { PanelClientService } from './panel-client.service';

@Module({
  controllers: [PanelCallbackController],
  providers: [PanelClientService],
  exports: [PanelClientService],
})
export class PanelModule {}
