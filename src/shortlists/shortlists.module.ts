import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Shortlist } from './entities/shortlist.entity';
import { ShortlistsService } from './shortlists.service';
import { ShortlistsController } from './shortlists.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Shortlist]), UsersModule],
  providers: [ShortlistsService],
  controllers: [ShortlistsController],
})
export class ShortlistsModule {}
