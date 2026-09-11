import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { ServerOptions } from 'socket.io';

/**
 * Attaches the Socket.IO Redis adapter so `server.to(room).emit(...)` reaches
 * sockets connected to any API instance, not just the one that emitted it.
 * Without this, notifications/DMs only work correctly when running a single
 * instance.
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  constructor(private readonly app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const config = this.app.get(ConfigService);
    const redisOptions = {
      host: config.get<string>('redis.host'),
      port: config.get<number>('redis.port'),
      password: config.get<string>('redis.password'),
    };

    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (!this.adapterConstructor) {
      throw new Error(
        'RedisIoAdapter.connectToRedis() must be called before the server is created',
      );
    }
    server.adapter(this.adapterConstructor);
    return server;
  }
}
