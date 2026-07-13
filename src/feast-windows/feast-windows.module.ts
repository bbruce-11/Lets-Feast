import { Module } from '@nestjs/common';
import { FeastWindowsController } from './feast-windows.controller';
import { FeastWindowsService } from './feast-windows.service';
import { FeastWindowExpiryService } from './feast-window-expiry.service';

@Module({
  controllers: [FeastWindowsController],
  providers: [FeastWindowsService, FeastWindowExpiryService],
})
export class FeastWindowsModule {}
