import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RepositoryEntity } from './repository.entity.js';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class RepositoryRepo {
  constructor(
    @InjectRepository(RepositoryEntity)
    private readonly repository: Repository<RepositoryEntity>,
  ) {}

  /** Insert or update many repository records */
  async upsertMany(rows: RepositoryEntity[]) {
    return this.repository
      .createQueryBuilder()
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
          'gh_created_at',
        ],
        ['repo_id'],
      )
      .execute();
  }

  async findAll(): Promise<RepositoryEntity[]> {
    return this.repository.find();
  }
}
