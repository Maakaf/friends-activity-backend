import { Injectable, Logger, Inject } from '@nestjs/common';
import { UserBronzeRepo } from './user.repo.js';
import { mapUserFromPayload, pickUserObjectForActor, mergeUser } from '../mappers.js';
import type { User } from '../types.js';

@Injectable()
export class UserSilverService {
  private readonly log = new Logger(UserSilverService.name);
  constructor(@Inject(UserBronzeRepo) private readonly repo: UserBronzeRepo) {}

  /**
   * Build Silver users by taking the latest bronze row per actor_user_node
   * and mapping the *actor*'s user object from that payload (fallback {id}).
   */
  async getUsersByLatestActor(params: {
    sinceIso: string;
    untilIso?: string;
    repoId?: string;
  }): Promise<User[]> {
    const rows = await this.repo.loadLatestByActor(params);

    const byId = new Map<string, User>();
    for (const r of rows) {
      const actorId = String(r.actor_user_node);
      const uObj = pickUserObjectForActor(r.raw_payload, actorId);
      const mapped = mapUserFromPayload(uObj);
      if (!mapped) continue;

      const prev = byId.get(mapped.userId);
      if (!prev) byId.set(mapped.userId, mapped);
      else byId.set(mapped.userId, mergeUser(prev, mapped));
    }

    const out = [...byId.values()];
    this.log.debug(`silver.users (latest-actor): ${out.length} users from ${rows.length} actor rows`);
    return out;
  }
}
