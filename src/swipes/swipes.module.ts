import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Swipe } from './entities/swipe.entity';
import { ProfileViewUnlock } from '../profile-view/entities/profile-view-unlock.entity';
import { SwipesService } from './swipes.service';
import { SwipesController } from './swipes.controller';
import { UsersModule } from '../users/users.module';
import { MatchesModule } from '../matches/matches.module';
import { ChatModule } from '../chat/chat.module';
import { ProfilesModule } from '../profiles/profiles.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Swipe, ProfileViewUnlock]),
    UsersModule,
    MatchesModule,
    ChatModule,
    ProfilesModule,
  ],
  providers: [SwipesService],
  controllers: [SwipesController],
})
export class SwipesModule {}
