import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserActivityEntity } from './user_activity.entity.js';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserActivityRepo {
  constructor(
    @InjectRepository(UserActivityEntity)
    private readonly repository: Repository<UserActivityEntity>
  ) {}

  /** Bulk insert or update activity counts */
  async upsertMany(rows: UserActivityEntity[]) {
    return this.repository.createQueryBuilder()
      .insert()
      .into(UserActivityEntity)
      .values(rows)
      .orUpdate(
        ['activity_count'],                 // update only the count on conflict
        ['user_id', 'day', 'repo_id', 'activity_type']
      )
      .execute();
  }

  async findAll(): Promise<UserActivityEntity[]> {
    return this.repository.find();
  }
}
