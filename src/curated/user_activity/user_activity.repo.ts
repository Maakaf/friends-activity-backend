import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { UserActivityEntity } from './user_activity.entity.js';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class UserActivityRepo extends Repository<UserActivityEntity> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(UserActivityEntity, dataSource.createEntityManager());
  }

  /** Bulk insert or update activity counts */
  async upsertMany(rows: UserActivityEntity[]) {
    return this.createQueryBuilder()
      .insert()
      .into(UserActivityEntity)
      .values(rows)
      .orUpdate(
        ['activity_count'],                 // update only the count on conflict
        ['user_id', 'day', 'repo_id', 'activity_type']
      )
      .execute();
  }
}
