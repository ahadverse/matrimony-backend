import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './entities/match.entity';
import { canonicalPair } from './utils/canonical-pair';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly matches: Repository<Match>,
  ) {}

  async createMatchIfNotExists(
    userId1: string,
    userId2: string,
  ): Promise<Match> {
    const [userAId, userBId] = canonicalPair(userId1, userId2);

    const existing = await this.matches.findOne({
      where: { userAId, userBId },
    });
    if (existing) return existing;

    try {
      return await this.matches.save(this.matches.create({ userAId, userBId }));
    } catch {
      // Unique-constraint race: another concurrent swipe created it first.
      return this.matches.findOneOrFail({ where: { userAId, userBId } });
    }
  }
}
