import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { LikesModule } from '../likes/likes.module';
import { PostCommentsController } from './post-comments.controller';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [NotificationsModule, LikesModule],
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
