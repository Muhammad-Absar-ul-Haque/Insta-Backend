import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue.constants';

export interface MediaProcessingJobData {
  storageKey: string;
  mediaType: 'image' | 'video';
}

/**
 * Would resize images to multiple sizes / transcode video / generate thumbnails
 * (sharp + ffmpeg in a real deployment). Wiring the trigger for real requires an
 * S3 upload-complete event (S3/MinIO -> SQS or a webhook -> this queue), which is
 * beyond what the docker-compose MinIO setup provides out of the box — so this
 * processor exists and is registered, but nothing enqueues a job onto it yet.
 */
@Processor(QUEUE_NAMES.MEDIA_PROCESSING)
export class MediaProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaProcessingProcessor.name);

  async process(job: Job<MediaProcessingJobData>): Promise<void> {
    this.logger.log(
      `[stub] would resize/transcode ${job.data.storageKey} (${job.data.mediaType})`,
    );
  }
}
