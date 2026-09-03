import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from './queue.constants';

/** Registers the repeatable jobs this app needs at boot (BullMQ dedupes repeatable
 * definitions by their pattern + jobId, so re-adding on every restart is safe). */
@Injectable()
export class JobsBootstrap implements OnModuleInit {
  private readonly logger = new Logger(JobsBootstrap.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.STORY_EXPIRY)
    private readonly storyExpiryQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.storyExpiryQueue.add(
      'sweep',
      {},
      { repeat: { pattern: '*/5 * * * *' }, jobId: 'story-expiry-sweep' },
    );
    this.logger.log('Scheduled story-expiry sweep every 5 minutes');
  }
}
