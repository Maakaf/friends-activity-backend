import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserProfileEntity } from './user_profile.entity.js';

@Injectable()
export class UserProfileRepo extends Repository<UserProfileEntity> {
  constructor(dataSource: DataSource) {
    super(UserProfileEntity, dataSource.createEntityManager());
  }

  /** Insert or update many user profiles in a single query */
  async upsertMany(rows: UserProfileEntity[]) {
    return this.createQueryBuilder()
      .insert()
      .into(UserProfileEntity)
      .values(rows)
      .orUpdate(
        [
          'node_id',
          'login',
          'name',
          'avatar_url',
          'html_url',
          'email',
          'company',
          'location',
          'bio',
          'type',
          'site_admin',
          'gh_created_at',
          'gh_updated_at',
          'fetched_at'
        ],
        ['user_id']           // conflict target (PRIMARY KEY)
      )
      .execute();
  }
}
