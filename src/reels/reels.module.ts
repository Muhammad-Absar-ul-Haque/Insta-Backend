import { Module } from '@nestjs/common';
import { LikesModule } from '../likes/likes.module';
import { ReelsController } from './reels.controller';
import { ReelsService } from './reels.service';

@Module({
  imports: [LikesModule],
  controllers: [ReelsController],
  providers: [ReelsService],
})
export class ReelsModule {}
