import { Injectable, Logger, Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { UserProfileEntity } from './user_profile/user_profile.entity.js';
import { UserActivityEntity } from './user_activity/user_activity.entity.js';
import { RepositoryEntity } from './repository/repository.entity.js';
import { mapSilverToCurated } from './mappers/map-normalized-to-analytics.js';

@Injectable()
export class CuratedService {
  private readonly logger = new Logger(CuratedService.name);

  constructor(
    @Inject(SilverOrchestratorService) private readonly silver: SilverOrchestratorService,
    @InjectRepository(UserProfileEntity) private readonly userProfileRepo: Repository<UserProfileEntity>,
    @InjectRepository(UserActivityEntity) private readonly userActivityRepo: Repository<UserActivityEntity>,
    @InjectRepository(RepositoryEntity) private readonly repositoryRepo: Repository<RepositoryEntity>,
  ) {}

  /**
   * Fetch normalized (silver) bundle and populate curated tables.
   */
  async refreshAll(): Promise<void> {
    this.logger.log('Starting curated refresh…');

    const bundle = await this.silver.buildBundle(); // optional args since/until

    const { profiles, activities, repos } = mapSilverToCurated(bundle);

    this.logger.log(`Processing ${profiles.length} profiles, ${activities.length} activities, ${repos.length} repos`);

    await Promise.all([
      this.upsertUserProfiles(profiles),
      this.upsertUserActivities(activities),
      this.upsertRepositories(repos),
    ]);

    this.logger.log('Curated refresh complete.');
  }

  private async upsertUserProfiles(profiles: UserProfileEntity[]) {
    if (profiles.length === 0) return;
    return this.userProfileRepo.upsert(profiles, ['userId']);
  }

  private async upsertUserActivities(activities: UserActivityEntity[]) {
    if (activities.length === 0) return;
    return this.userActivityRepo.upsert(activities, ['userId', 'day', 'repoId', 'activityType']);
  }

  private async upsertRepositories(repos: RepositoryEntity[]) {
    if (repos.length === 0) return;
    return this.repositoryRepo.upsert(repos, ['repoId']);
  }
}
