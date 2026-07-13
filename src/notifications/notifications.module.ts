import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ExpoPushService } from './expo-push.service';

@Module({
  providers: [NotificationsService, ExpoPushService],
  exports: [NotificationsService, ExpoPushService],
})
export class NotificationsModule {}
