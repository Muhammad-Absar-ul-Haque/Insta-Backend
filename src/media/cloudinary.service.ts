import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';

export type CloudinaryResourceType = 'image' | 'video';

export interface SignedUpload {
  /** Fixed Cloudinary endpoint the client POSTs the file to (multipart/form-data), not a per-upload URL. */
  uploadUrl: string;
  /** The final delivery URL — deterministic from cloudName + resourceType + publicId, known before the upload happens. */
  cdnUrl: string;
  publicId: string;
  apiKey: string;
  timestamp: number;
  signature: string;
}

@Injectable()
export class CloudinaryService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;

  constructor(private readonly config: ConfigService) {
    this.cloudName = this.config.get<string>('cloudinary.cloudName')!;
    this.apiKey = this.config.get<string>('cloudinary.apiKey')!;
    this.apiSecret = this.config.get<string>('cloudinary.apiSecret')!;
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
    });
  }

  /**
   * Unlike S3's presigned PUT, the upload itself always happens client-side directly
   * against Cloudinary's fixed upload endpoint — this only generates a short-lived
   * signature authorizing one specific upload (public_id + timestamp), the same
   * authorization role the presigned URL played before. The client POSTs the raw file
   * plus these signed params as multipart/form-data straight to `uploadUrl`.
   *
   * Deliberately NOT sending a separate `folder` param to Cloudinary: `publicId`
   * already encodes the full desired path (`{folder}/{ownerId}/{uuid}`), and Cloudinary
   * *concatenates* `folder` + `public_id` when both are given — sending both produced
   * a doubled path (`avatars/avatars/3/...`), confirmed against a real upload.
   */
  createSignedUpload(
    folder: string,
    ownerId: number,
    resourceType: CloudinaryResourceType,
  ): SignedUpload {
    const publicId = `${folder}/${ownerId}/${randomUUID()}`;
    const timestamp = Math.floor(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request({ public_id: publicId, timestamp }, this.apiSecret);

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`,
      cdnUrl: `https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/${publicId}`,
      publicId,
      apiKey: this.apiKey,
      timestamp,
      signature,
    };
  }

  async deleteObject(
    publicId: string,
    resourceType: CloudinaryResourceType = 'image',
  ): Promise<void> {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }
}
