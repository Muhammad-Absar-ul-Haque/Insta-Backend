import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { HashtagsModule } from '../hashtags/hashtags.module';
import { FeedCacheService } from '../feed/feed-cache.service';
import { FeedFanoutProcessor } from './processors/feed-fanout.processor';
import { NotificationDispatchProcessor } from './processors/notification-dispatch.processor';
import { HashtagExtractionProcessor } from './processors/hashtag-extraction.processor';
import { MediaProcessingProcessor } from './processors/media-processing.processor';
import { StoryExpiryProcessor } from './processors/story-expiry.processor';
import { ReportEscalationProcessor } from './processors/report-escalation.processor';
import { JobsBootstrap } from './jobs.bootstrap';

const QUEUE_NAME_LIST = Object.values(QUEUE_NAMES);

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    BullModule.registerQueue(...QUEUE_NAME_LIST.map((name) => ({ name }))),
    NotificationsModule,
    HashtagsModule,
  ],
  providers: [
    FeedCacheService,
    FeedFanoutProcessor,
    NotificationDispatchProcessor,
    HashtagExtractionProcessor,
    MediaProcessingProcessor,
    StoryExpiryProcessor,
    ReportEscalationProcessor,
    JobsBootstrap,
  ],
  exports: [BullModule, FeedCacheService],
})
export class JobsModule {}
