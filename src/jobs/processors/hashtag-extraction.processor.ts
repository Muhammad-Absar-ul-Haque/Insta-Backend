import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { HashtagsService } from '../../hashtags/hashtags.service';
import { QUEUE_NAMES } from '../queue.constants';

export interface HashtagExtractionJobData {
  postId: number;
  caption: string | null;
}

@Processor(QUEUE_NAMES.HASHTAG_EXTRACTION)
export class HashtagExtractionProcessor extends WorkerHost {
  constructor(private readonly hashtags: HashtagsService) {
    super();
  }

  async process(job: Job<HashtagExtractionJobData>): Promise<void> {
    const tags = this.hashtags.extractTags(job.data.caption);
    if (tags.length > 0) {
      await this.hashtags.linkPostHashtags(job.data.postId, tags);
    }
  }
}
