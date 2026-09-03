import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignedUpload {
  uploadUrl: string;
  storageKey: string;
  cdnUrl: string;
}

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('s3.bucket')!;
    this.cdnBaseUrl = this.config.get<string>('s3.cdnBaseUrl')!;
    this.client = new S3Client({
      endpoint: this.config.get<string>('s3.endpoint'),
      region: this.config.get<string>('s3.region'),
      forcePathStyle: this.config.get<boolean>('s3.forcePathStyle'),
      credentials: {
        accessKeyId: this.config.get<string>('s3.accessKeyId')!,
        secretAccessKey: this.config.get<string>('s3.secretAccessKey')!,
      },
    });
  }

  /** Builds a namespaced object key so different upload kinds/users never collide. */
  buildKey(folder: string, ownerId: number, extension: string): string {
    return `${folder}/${ownerId}/${randomUUID()}.${extension.replace(/^\./, '')}`;
  }

  async createPresignedUpload(
    storageKey: string,
    contentType: string,
  ): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });
    return { uploadUrl, storageKey, cdnUrl: this.buildCdnUrl(storageKey) };
  }

  buildCdnUrl(storageKey: string): string {
    return `${this.cdnBaseUrl.replace(/\/$/, '')}/${storageKey}`;
  }

  async deleteObject(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }),
    );
  }
}
