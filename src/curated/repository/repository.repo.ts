import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { RepositoryEntity } from './repository.entity.js';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class RepositoryRepo extends Repository<RepositoryEntity> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(RepositoryEntity, dataSource.createEntityManager());
  }

  /** Insert or update many repository records */
  async upsertMany(rows: RepositoryEntity[]) {
    return this.createQueryBuilder()
      .insert()
      .into(RepositoryEntity)
      .values(rows)
      .orUpdate(
        [
          'owner_user_id',
          'repo_name',
          'visibility',
          'default_branch',
          'fork_count',
          'last_activity',
          'gh_created_at'
        ],
        ['repo_id']
      )
      .execute();
  }
}
