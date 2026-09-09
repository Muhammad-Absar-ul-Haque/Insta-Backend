import { Module } from '@nestjs/common';
import { LikesModule } from '../likes/likes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessagesModule } from '../messages/messages.module';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  imports: [LikesModule, NotificationsModule, MessagesModule],
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule {}
