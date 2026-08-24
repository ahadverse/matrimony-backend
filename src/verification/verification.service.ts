import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IdentityVerification,
  VerificationStatus,
} from './entities/identity-verification.entity';
import { User } from '../users/entities/user.entity';
import { PhotoStorageService } from '../common/storage/photo-storage.service';
import { SubmitVerificationDto } from './dto/submit-verification.dto';
import { AdminNotificationsGateway } from '../notifications/admin-notifications.gateway';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger('VerificationService');

  constructor(
    @InjectRepository(IdentityVerification)
    private readonly verifications: Repository<IdentityVerification>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly photoStorage: PhotoStorageService,
    private readonly adminNotifications: AdminNotificationsGateway,
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
      const saved = await this.verifications.save(existing);
      await this.notifyAdminsOfSubmission(saved);
      return saved;
    }

    const saved = await this.verifications.save(
      this.verifications.create({
        userId,
        nidNumber: dto.nidNumber,
        selfieUrl: url,
        status: VerificationStatus.PENDING,
      }),
    );
    await this.notifyAdminsOfSubmission(saved);
    return saved;
  }

  private async notifyAdminsOfSubmission(
    verification: IdentityVerification,
  ): Promise<void> {
    try {
      const user = await this.users.findOne({
        where: { id: verification.userId },
      });
      this.adminNotifications.notifyVerificationSubmitted({
        id: verification.id,
        userId: verification.userId,
        nidNumber: verification.nidNumber,
        phone: user?.phone ?? '',
        submittedAt: new Date(),
      });
    } catch (error) {
      this.logger.error('Failed to push admin notification', error as Error);
    }
  }
}
