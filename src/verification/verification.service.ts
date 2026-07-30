import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityVerification,
  VerificationStatus,
} from './entities/identity-verification.entity';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(IdentityVerification)
    private readonly verifications: Repository<IdentityVerification>,
    private readonly photoStorage: PhotoStorageService,
  ) {}

  async getMine(userId: string): Promise<IdentityVerification | null> {
    return this.verifications.findOne({ where: { userId } });
  }

  async submit(
    userId: string,
    dto: SubmitVerificationDto,
    selfieBuffer: Buffer,
  ): Promise<IdentityVerification> {
    const existing = await this.verifications.findOne({ where: { userId } });

    if (existing?.status === VerificationStatus.APPROVED) {
      throw new BadRequestException('Your identity is already verified');
    }
    if (existing?.status === VerificationStatus.PENDING) {
      throw new BadRequestException(
        'Your verification submission is already pending review',
      );
    }

    const { url } = await this.photoStorage.saveDocument(selfieBuffer);

    if (existing) {
      await this.photoStorage.deleteDocument(existing.selfieUrl);
      existing.nidNumber = dto.nidNumber;
      existing.selfieUrl = url;
      existing.status = VerificationStatus.PENDING;
      existing.rejectionReason = null;
      existing.reviewedBy = null;
      existing.reviewedAt = null;
      return this.verifications.save(existing);
    }

    return this.verifications.save(
      this.verifications.create({
        userId,
        nidNumber: dto.nidNumber,
        selfieUrl: url,
        status: VerificationStatus.PENDING,
      }),
    );
  }
}
