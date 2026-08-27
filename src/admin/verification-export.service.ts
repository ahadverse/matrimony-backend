import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import archiver from 'archiver';
import type { Response } from 'express';
import {
  IdentityVerification,
  VerificationStatus,
} from '../verification/entities/identity-verification.entity';
import { User } from '../users/entities/user.entity';

const STATUS_VALUES = new Set<string>(Object.values(VerificationStatus));

@Injectable()
export class VerificationExportService {
  private readonly logger = new Logger('VerificationExportService');

  constructor(
    @InjectRepository(IdentityVerification)
    private readonly verifications: Repository<IdentityVerification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly http: HttpService,
  ) {}

  /** Streams a ZIP of verification submissions to `res`, one folder per user. */
  async streamExport(status: string | undefined, res: Response): Promise<void> {
    const submissions = await this.verifications.find({
      where:
        status && STATUS_VALUES.has(status)
          ? { status: status as VerificationStatus }
          : {},
      order: { createdAt: 'ASC' },
    });

    if (submissions.length === 0) {
      res.status(404).json({
        message: 'No verification submissions match this filter',
      });
      return;
    }

    // Deliberately two simple queries merged in memory, rather than a join across
    // IdentityVerification.userId (a plain column, no relation declared) — this
    // reuses the already-existing User.profile/Profile.photos relations only, so
    // it can never trigger a schema change via TypeORM's synchronize.
    const userIds = submissions.map((s) => s.userId);
    const users = await this.users.find({
      where: { id: In(userIds) },
      relations: { profile: { photos: true } },
    });
    const userById = new Map(users.map((u) => [u.id, u]));

    const filename = `verifications-export-${new Date().toISOString().slice(0, 10)}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
      this.logger.error(
        'Archive error during verification export',
        error as Error,
      );
      res.destroy(error);
    });
    archive.pipe(res);

    const usedFolderNames = new Set<string>();

    for (const submission of submissions) {
      const user = userById.get(submission.userId);
      const folder = this.buildFolderName(submission, user, usedFolderNames);
      const notes: string[] = [];

      archive.append(this.buildInfoText(submission, user), {
        name: `${folder}/info.txt`,
      });

      const selfieBuffer = await this.tryFetchImage(submission.selfieUrl);
      if (selfieBuffer) {
        archive.append(selfieBuffer, { name: `${folder}/selfie.webp` });
      } else {
        notes.push('The verification selfie could not be downloaded.');
      }

      const photos = user?.profile?.photos ?? [];
      const photoBuffers = await Promise.all(
        photos.map((photo) => this.tryFetchImage(photo.url)),
      );
      photoBuffers.forEach((buffer, index) => {
        if (buffer) {
          archive.append(buffer, { name: `${folder}/photo-${index + 1}.webp` });
        } else {
          notes.push(`Profile photo ${index + 1} could not be downloaded.`);
        }
      });

      if (notes.length > 0) {
        archive.append(notes.join('\n'), {
          name: `${folder}/download-notes.txt`,
        });
      }
    }

    await archive.finalize();
  }

  private async tryFetchImage(
    url: string | undefined | null,
  ): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const response = await firstValueFrom(
        this.http.get(url, { responseType: 'arraybuffer' }),
      );
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      this.logger.warn(
        `Failed to download image for export: ${url}`,
        error as Error,
      );
      return null;
    }
  }

  /** `Name_Phone`, de-duplicated, with filesystem-illegal characters stripped. */
  private buildFolderName(
    submission: IdentityVerification,
    user: User | undefined,
    used: Set<string>,
  ): string {
    const rawName = user?.profile?.name?.trim() || 'Unknown';
    const phone = user?.phone ?? submission.userId;
    const base = this.sanitize(`${rawName}_${phone}`);

    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${base}_${suffix}`;
      suffix += 1;
    }
    used.add(candidate);
    return candidate;
  }

  private sanitize(value: string): string {
    const cleaned = value
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[. ]+$/, '');
    return cleaned || 'Unknown';
  }

  private buildInfoText(
    submission: IdentityVerification,
    user: User | undefined,
  ): string {
    const profile = user?.profile;
    const lines: string[] = [];

    lines.push('==== Account ====');
    lines.push(`Name: ${profile?.name ?? 'N/A'}`);
    lines.push(`Phone: ${user?.phone ?? 'N/A'}`);
    lines.push(`Gender: ${user?.gender ?? 'N/A'}`);
    lines.push(`Date of birth: ${user?.dob ?? 'N/A'}`);
    lines.push(`Account status: ${user?.status ?? 'N/A'}`);
    lines.push(`Wallet balance: ${user?.walletBalance ?? 'N/A'}`);
    lines.push(
      `Joined: ${user?.createdAt ? new Date(user.createdAt).toLocaleString('en-US') : 'N/A'}`,
    );
    lines.push('');

    lines.push('==== Verification ====');
    lines.push(`NID number: ${submission.nidNumber}`);
    lines.push(`Status: ${submission.status}`);
    lines.push(
      `Submitted: ${new Date(submission.createdAt).toLocaleString('en-US')}`,
    );
    if (submission.reviewedAt) {
      lines.push(
        `Reviewed: ${new Date(submission.reviewedAt).toLocaleString('en-US')}`,
      );
    }
    if (submission.rejectionReason) {
      lines.push(`Rejection reason: ${submission.rejectionReason}`);
    }
    lines.push('');

    lines.push('==== Profile ====');
    if (profile) {
      lines.push(
        `District: ${[profile.subDistrict, profile.district].filter(Boolean).join(', ') || 'N/A'}`,
      );
      lines.push(`Marital status: ${profile.maritalStatus ?? 'N/A'}`);
      lines.push(`Profile created by: ${profile.profileCreatedBy ?? 'N/A'}`);
      lines.push(`Height (cm): ${profile.heightCm ?? 'N/A'}`);
      lines.push(`Blood group: ${profile.bloodGroup ?? 'N/A'}`);
      lines.push(`Complexion: ${profile.complexion ?? 'N/A'}`);
      lines.push(`Body type: ${profile.bodyType ?? 'N/A'}`);
      lines.push(`Education: ${profile.education ?? 'N/A'}`);
      lines.push(`College/University: ${profile.collegeUniversity ?? 'N/A'}`);
      lines.push(`Profession: ${profile.profession ?? 'N/A'}`);
      lines.push(`Company: ${profile.companyName ?? 'N/A'}`);
      lines.push(`Monthly income: ${profile.monthlyIncome ?? 'N/A'}`);
      lines.push(`Religion: ${profile.religion ?? 'N/A'}`);
      lines.push(`Mother tongue: ${profile.motherTongue ?? 'N/A'}`);
      lines.push(`English comfort: ${profile.englishComfort ?? 'N/A'}`);
      lines.push(`Residency status: ${profile.residencyStatus ?? 'N/A'}`);
      lines.push(`Grew up in: ${profile.growUpIn ?? 'N/A'}`);
      lines.push(`Father's occupation: ${profile.fatherOccupation ?? 'N/A'}`);
      lines.push(`Mother's occupation: ${profile.motherOccupation ?? 'N/A'}`);
      lines.push(
        `Siblings: ${profile.numberOfBrothers ?? 0} brother(s), ${profile.numberOfSisters ?? 0} sister(s)`,
      );
      lines.push(
        `Family financial status: ${profile.familyFinancialStatus ?? 'N/A'}`,
      );
      lines.push(`Present address: ${profile.presentAddress ?? 'N/A'}`);
      lines.push(`Permanent address: ${profile.permanentAddress ?? 'N/A'}`);
      lines.push(`Bio: ${profile.bio ?? 'N/A'}`);
      lines.push(`Partner preferences: ${profile.partnerPreferences ?? 'N/A'}`);
      lines.push(`Hobbies: ${profile.hobbies ?? 'N/A'}`);
      lines.push(`Profile approval status: ${profile.approvalStatus}`);
      lines.push(`Profile verified: ${profile.isVerified ? 'Yes' : 'No'}`);
    } else {
      lines.push('No profile submitted.');
    }

    return lines.join('\n');
  }
}
