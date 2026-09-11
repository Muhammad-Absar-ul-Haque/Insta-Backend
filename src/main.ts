import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { initSentry } from './common/sentry/sentry';
import { RedisIoAdapter } from './common/ws/redis-io.adapter';

initSentry();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  const config = app.get(ConfigService);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis();
  app.useWebSocketAdapter(redisIoAdapter);

  // Swagger UI needs inline scripts/styles, which helmet's default CSP blocks —
  // relax CSP only on the docs route, keep the strict default everywhere else.
  const strictHelmet = helmet();
  const relaxedHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req, res, next) => {
    if (req.path.startsWith('/docs')) {
      return relaxedHelmet(req, res, next);
    }
    return strictHelmet(req, res, next);
  });
  app.use(compression());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: config.get<string>('corsOrigin'),
    credentials: true,
  });

  const apiPrefix = config.get<string>('apiPrefix')!;
  app.setGlobalPrefix(apiPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Instagram Clone API')
    .setDescription(
      'Auth, profiles, posts, stories, reels, feed, DMs, notifications and admin moderation',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('port')!;
  await app.listen(port);

  logger.log(`API listening on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
}
bootstrap();
