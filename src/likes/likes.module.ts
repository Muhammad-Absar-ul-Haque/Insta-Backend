import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LikesService } from './likes.service';

@Module({
  imports: [NotificationsModule],
  providers: [LikesService],
  exports: [LikesService],
})
export class LikesModule {}
