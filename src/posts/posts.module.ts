import { Module } from '@nestjs/common';
import { LikesModule } from '../likes/likes.module';
import { SavedModule } from '../saved/saved.module';
import { PostsController } from './posts.controller';
import { UserPostsController } from './user-posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [LikesModule, SavedModule],
  controllers: [PostsController, UserPostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
