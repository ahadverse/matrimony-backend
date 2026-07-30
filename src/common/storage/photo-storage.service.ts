import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { S3StorageService } from './s3-storage.service';

const BLUR_SIGMA = 25;
const BLUR_MAX_WIDTH = 200;

@Injectable()
export class PhotoStorageService {
  constructor(private readonly s3: S3StorageService) {}

  async savePhoto(
    buffer: Buffer,
  ): Promise<{ url: string; blurredUrl: string }> {
    const filename = `${randomUUID()}.webp`;
    let original: Buffer;
    let blurred: Buffer;
    try {
      original = await sharp(buffer)
        .rotate()
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      blurred = await sharp(buffer)
        .rotate()
        .resize({ width: BLUR_MAX_WIDTH })
        .blur(BLUR_SIGMA)
        .webp({ quality: 60 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or corrupted image file');
    }

    const [url, blurredUrl] = await Promise.all([
      this.s3.upload(`photos/${filename}`, original, 'image/webp'),
      this.s3.upload(`photos/blurred/${filename}`, blurred, 'image/webp'),
    ]);

    return { url, blurredUrl };
  }

  async deletePhoto(url: string, blurredUrl: string): Promise<void> {
    await Promise.all(
      [url, blurredUrl].map(async (photoUrl) => {
        const key = this.s3.keyFromUrl(photoUrl);
        if (key) await this.s3.delete(key);
      }),
    );
  }

  async saveDocument(buffer: Buffer): Promise<{ url: string }> {
    const filename = `${randomUUID()}.webp`;
    let processed: Buffer;
    try {
      processed = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or corrupted image file');
    }

    const url = await this.s3.upload(
      `verifications/${filename}`,
      processed,
      'image/webp',
    );
    return { url };
  }

  async deleteDocument(url: string): Promise<void> {
    const key = this.s3.keyFromUrl(url);
    if (key) await this.s3.delete(key);
  }
}
