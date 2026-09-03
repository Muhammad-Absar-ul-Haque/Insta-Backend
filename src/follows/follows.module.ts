import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { FollowsController } from './follows.controller';
import { UserFollowsController } from './user-follows.controller';
import { FollowsService } from './follows.service';

@Module({
  imports: [NotificationsModule],
  controllers: [FollowsController, UserFollowsController],
  providers: [FollowsService],
  exports: [FollowsService],
})
export class FollowsModule {}
