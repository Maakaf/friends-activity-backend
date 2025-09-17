import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserProfileEntity } from './user_profile.entity.js';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UserProfileRepo {
  constructor(
    @InjectRepository(UserProfileEntity)
    private readonly repository: Repository<UserProfileEntity>
  ) {}

  /** Insert or update many user profiles in a single query */
  async upsertMany(rows: UserProfileEntity[]) {
    return this.repository.createQueryBuilder()
      .insert()
      .into(UserProfileEntity)
      .values(rows)
      .orUpdate(
        [
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

  async findAll(): Promise<UserProfileEntity[]> {
    return this.repository.find();
  }
}
