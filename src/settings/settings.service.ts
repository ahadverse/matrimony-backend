import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from '../admin/entities/app-settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly settings: Repository<AppSettings>,
  ) {}

  async get(): Promise<AppSettings> {
    let row = await this.settings.findOne({ where: {} });
    if (!row) {
      row = await this.settings.save(this.settings.create({}));
    }
    return row;
  }

  async update(
    patch: Partial<
      Pick<
        AppSettings,
        | 'profileViewCost'
        | 'minTopupAmount'
        | 'spotlightCost'
        | 'spotlightDurationHours'
        | 'statVerifiedMembers'
        | 'statMatchesMade'
        | 'statDistrictsCovered'
        | 'statAverageRating'
        | 'statProfilesReviewedPercent'
        | 'whatsappNumber'
        | 'bkashMerchantNumber'
        | 'smsTemplateOtpRegister'
        | 'smsTemplateOtpLogin'
        | 'smsTemplateOtpReset'
      >
    >,
  ): Promise<AppSettings> {
    const row = await this.get();
    Object.assign(row, patch);
    return this.settings.save(row);
  }

  async getPublicStats() {
    const row = await this.get();
    return {
      statVerifiedMembers: row.statVerifiedMembers,
      statMatchesMade: row.statMatchesMade,
      statDistrictsCovered: row.statDistrictsCovered,
      statAverageRating: row.statAverageRating,
      statProfilesReviewedPercent: row.statProfilesReviewedPercent,
      whatsappNumber: row.whatsappNumber,
    };
  }
}
