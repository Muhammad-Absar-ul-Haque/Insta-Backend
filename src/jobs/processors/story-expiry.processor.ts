import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue.constants';

/** Runs on a repeatable schedule (see JobsModule bootstrap) and sweeps stories past
 * their expiresAt, flipping isActive so they drop out of GET /stories/feed. */
@Processor(QUEUE_NAMES.STORY_EXPIRY)
export class StoryExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(StoryExpiryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(): Promise<void> {
    const { count } = await this.prisma.story.updateMany({
      where: { isActive: true, expiresAt: { lt: new Date() } },
      data: { isActive: false },
    });
    if (count > 0) {
      this.logger.log(`Expired ${count} stor${count === 1 ? 'y' : 'ies'}`);
    }
  }
}
