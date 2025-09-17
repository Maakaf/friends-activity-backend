import { Injectable, Logger, Inject } from '@nestjs/common';
import { UserBronzeRepo } from './user.repo.js';
import { mapUserFromBronzeRow, pickUserObjectForActor, mergeUser } from '../mappers.js';
import type { User } from '../types.js';

@Injectable()
export class UsersSilverService {
  private readonly log = new Logger(UsersSilverService.name);
  constructor(@Inject(UserBronzeRepo) private readonly repo: UserBronzeRepo) {}

  async getUsersSince(params: {
    sinceIso?: string;
    untilIso?: string;
    userIds?: string[];
    logins?: string[];
    limit?: number;
  }): Promise<User[]> {
    const rows = await this.repo.loadFromBronzeUsers(params);
    const users: User[] = [];

    for (const row of rows) {
      const u = mapUserFromBronzeRow(row);
      if (u) users.push(u);
    }

    this.log.debug(`silver.users: ${users.length} (from ${rows.length} bronze rows)`);
    return users;
  }
}
