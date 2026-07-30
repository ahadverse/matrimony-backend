import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3StorageService {
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cloudfrontDomain: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('AWS_BUCKET_NAME', '');
    this.region = this.config.get<string>('AWS_BUCKET_REGION', '');
    this.cloudfrontDomain = this.config.get<string>(
      'AWS_CLOUDFRONT_DOMAIN',
      '',
    );
  }

  private getClient(): S3Client {
    if (!this.bucket || !this.region || !this.cloudfrontDomain) {
      throw new InternalServerErrorException(
        'S3 upload is not configured (missing AWS_BUCKET_NAME, AWS_BUCKET_REGION or AWS_CLOUDFRONT_DOMAIN)',
      );
    }
    if (!this.client) {
      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID', ''),
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY', ''),
        },
      });
    }
    return this.client;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return `https://${this.cloudfrontDomain}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  /** Recovers the S3 key from a CloudFront URL previously returned by upload(). */
  keyFromUrl(url: string): string | null {
    const prefix = `https://${this.cloudfrontDomain}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}
