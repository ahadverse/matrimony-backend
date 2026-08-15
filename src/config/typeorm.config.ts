import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Client } from 'pg';
import { User } from '../users/entities/user.entity';
import { Profile } from '../profiles/entities/profile.entity';
import { Photo } from '../profiles/entities/photo.entity';
import { OtpVerification } from '../auth/entities/otp-verification.entity';
import { Swipe } from '../swipes/entities/swipe.entity';
import { WalletTransaction } from '../wallet/entities/wallet-transaction.entity';
import { ProfileViewUnlock } from '../profile-view/entities/profile-view-unlock.entity';
import { AppSettings } from '../admin/entities/app-settings.entity';
import { Match } from '../matches/entities/match.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { Message } from '../chat/entities/message.entity';
import { IdentityVerification } from '../verification/entities/identity-verification.entity';
import { Shortlist } from '../shortlists/entities/shortlist.entity';
import { AssistantRequest } from '../assistant-requests/entities/assistant-request.entity';
import { ContactMessage } from '../contact-messages/entities/contact-message.entity';

// synchronize:true issues CREATE TABLE statements that assume uuid-ossp is
// already installed (every @PrimaryGeneratedColumn('uuid') defaults to
// uuid_generate_v4()). A fresh Postgres instance (e.g. a new Render database)
// doesn't have it enabled yet, so make sure it exists before TypeORM's own
// connection runs its sync — otherwise the very first boot fails.
async function ensureUuidExtension(
  url: string | undefined,
  useSsl: boolean,
): Promise<void> {
  if (!url) return;
  const client = new Client({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } finally {
    await client.end();
  }
}

export const buildTypeOrmOptions = async (
  config: ConfigService,
): Promise<TypeOrmModuleOptions> => {
  const isProduction = config.get<string>('NODE_ENV') === 'production';
  const url = config.get<string>('DATABASE_URL');

  await ensureUuidExtension(url, isProduction);

  return {
    type: 'postgres',
    url,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    // Every entity must be listed here. `forFeature([X])` in a feature module
    // resolves against this array — an entity missing from it has no metadata,
    // so its repository throws at request time and synchronize never creates
    // its table. That is exactly how assistant_requests went missing.
    entities: [
      User,
      Profile,
      Photo,
      OtpVerification,
      Swipe,
      WalletTransaction,
      ProfileViewUnlock,
      AppSettings,
      Match,
      Conversation,
      Message,
      IdentityVerification,
      Shortlist,
      AssistantRequest,
      ContactMessage,
    ],
    // No migrations exist yet — auto-sync schema from entities in every
    // environment, including production, until a real migration workflow
    // is introduced (see deployment notes).
    synchronize: true,
    logging: config.get<string>('NODE_ENV') === 'development' ? ['error', 'warn'] : false,
  };
};
