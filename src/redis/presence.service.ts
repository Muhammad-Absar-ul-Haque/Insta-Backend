import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

const PRESENCE_TTL_SECONDS = 60 * 60 * 6;

function key(userId: number): string {
  return `presence:user:${userId}`;
}

/**
 * Tracks which users currently have an open WebSocket connection, in Redis so
 * any API instance can answer "is this user online" regardless of which
 * instance actually holds their socket (delivery itself goes through the
 * Socket.IO Redis adapter, not this map).
 */
@Injectable()
export class PresenceService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addSocket(userId: number, socketId: string): Promise<void> {
    await this.redis.sadd(key(userId), socketId);
    await this.redis.expire(key(userId), PRESENCE_TTL_SECONDS);
  }

  async removeSocket(userId: number, socketId: string): Promise<void> {
    await this.redis.srem(key(userId), socketId);
  }

  async isOnline(userId: number): Promise<boolean> {
    const count = await this.redis.scard(key(userId));
    return count > 0;
  }
}
