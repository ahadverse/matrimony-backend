import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { S3StorageService } from './s3-storage.service';

@Injectable()
export class ChatImageStorageService {
  constructor(private readonly s3: S3StorageService) {}

  async saveImage(buffer: Buffer): Promise<{ url: string }> {
    const filename = `${randomUUID()}.webp`;
    let resized: Buffer;
    try {
      resized = await sharp(buffer)
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Invalid or corrupted image file');
    }

    const url = await this.s3.upload(`chat/${filename}`, resized, 'image/webp');
    return { url };
  }
}
