import { Injectable, Logger } from '@nestjs/common';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { UserProfileRepo } from './user_profile/user_profile.repo.js';
import { UserActivityRepo } from './user_activity/user_activity.repo.js';
import { RepositoryRepo } from './repository/repository.repo.js';
import { mapSilverToCurated } from './mappers/map-normalized-to-curated.js';

@Injectable()
export class CuratedService {
  private readonly logger = new Logger(CuratedService.name);

  constructor(
    private readonly silver: SilverOrchestratorService,
    private readonly userProfileRepo: UserProfileRepo,
    private readonly userActivityRepo: UserActivityRepo,
    private readonly repositoryRepo: RepositoryRepo,
  ) {}

  /**
   * Fetch normalized (silver) bundle and populate curated tables.
   */
  async refreshAll(): Promise<void> {
    this.logger.log('Starting curated refresh…');

    const bundle = await this.silver.buildBundle(); // optional args since/until

    const { profiles, activities, repos } = mapSilverToCurated(bundle);

    await Promise.all([
      this.userProfileRepo.upsertMany(profiles),
      this.userActivityRepo.upsertMany(activities),
      this.repositoryRepo.upsertMany(repos),
    ]);

    this.logger.log('Curated refresh complete.');
  }
}
