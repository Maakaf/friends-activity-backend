import { Injectable, BadRequestException } from '@nestjs/common';
import { GithubService } from '../raw/raw.service.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { CuratedService } from '../analytics/analytics.service.js';
import { AnalyticsReportService } from '../analytics/analytics-report.service.js';

@Injectable()
export class PipelineService {
  constructor(
    private readonly github: GithubService,
    private readonly silver: SilverOrchestratorService,
    private readonly curated: CuratedService,
    private readonly analytics: AnalyticsReportService,
  ) {}

  /**
   * Run the complete Raw -> Silver -> Curated -> Analytics pipeline.
   */
  async run(users: string[]): Promise<unknown> {
    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new BadRequestException(
        'Body must be { "users": string[] } with at least one username.',
      );
    }

    // 1. Bronze layer: ingest raw GitHub data
    const ingestResult = await this.github.ingestEachUserInTheirRepos(users);

    // 2. Silver layer: build normalized bundle
    const silverBundle = await this.silver.buildBundle({
      sinceIso: ingestResult.since,
      untilIso: ingestResult.until,
    });

    // 3. Curated/Gold: refresh analytics tables
    await this.curated.refreshAll();

    // 4. Analytics report for the frontend
    return this.analytics.generateFrontendReport(users);
  }

  /**
   * Generate analytics report only (Curated + Analytics).
   */
  async generateReport(users: string[]): Promise<unknown> {
    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new BadRequestException(
        'Body must be { "users": string[] } with at least one username.',
      );
    }

    await this.curated.refreshAll();
    return this.analytics.generateFrontendReport(users);
  }
}
