import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FollowsModule } from './follows/follows.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HashtagsModule } from './hashtags/hashtags.module';
import { PostsModule } from './posts/posts.module';
import { LikesModule } from './likes/likes.module';
import { SavedModule } from './saved/saved.module';
import { CommentsModule } from './comments/comments.module';
import { FeedModule } from './feed/feed.module';
import { JobsModule } from './jobs/jobs.module';
import { StoriesModule } from './stories/stories.module';
import { ReelsModule } from './reels/reels.module';
import { MessagesModule } from './messages/messages.module';
import { SearchModule } from './search/search.module';
import { ReportsModule } from './reports/reports.module';
import { AdminModule } from './admin/admin.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingMiddleware } from './common/middleware/logging.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 20,
      },
    ]),
    PrismaModule,
    RedisModule,
    JobsModule,
    MailModule,
    MediaModule,
    AuthModule,
    UsersModule,
    FollowsModule,
    NotificationsModule,
    HashtagsModule,
    PostsModule,
    LikesModule,
    SavedModule,
    CommentsModule,
    FeedModule,
    StoriesModule,
    ReelsModule,
    MessagesModule,
    SearchModule,
    ReportsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Every route requires a valid JWT by default; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
