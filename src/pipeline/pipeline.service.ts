import { Injectable, BadRequestException } from '@nestjs/common';
import { GithubService } from '../raw/raw.service.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { AnalyticsReportService } from '../analytics/analytics-report.service.js';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class PipelineService {
  constructor(
    private readonly github: GithubService,
    private readonly silver: SilverOrchestratorService,
    private readonly analytics: AnalyticsService,
    private readonly analyticsReport: AnalyticsReportService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) { }

  /**
   * Run the complete Raw -> Silver -> Curated -> Analytics pipeline.
   */
  async run(users: string[]): Promise<unknown> {
    this.throwOnEmptyUsersArr(users);

    // Get users from github_users table
    const readyUsers = await this.getUsersByStatus(users, ['ready']);
    const failedUsers = await this.getUsersByStatus(users, ['failed']);

    // Get users from processing_queue table
    const queueResult = await this.dataSource.query(
      'SELECT user_login, status FROM bronze.processing_queue WHERE user_login = ANY($1)',
      [users]
    );
    const pendingUsers = queueResult.filter((r: any) => r.status === 'pending').map((r: any) => r.user_login);
    const processingUsers = queueResult.filter((r: any) => r.status === 'processing').map((r: any) => r.user_login);

    // Find users that don't exist in either table
    const allExistingUsers = [...readyUsers, ...failedUsers, ...pendingUsers, ...processingUsers];
    const nonExistentUsers = users.filter(u => !allExistingUsers.includes(u));

    const skippedProcessingUsers = [...processingUsers, ...failedUsers];
    const pendingProcessingUsers = pendingUsers;

    if (readyUsers.length === 0) {
      return {
        message: 'No ready users to process',
        skippedProcessing: skippedProcessingUsers,
        pendingProcessing: pendingProcessingUsers,
        nonExistentUsers: nonExistentUsers,
        processed: []
      };
    }

    // Calculate 2 days ago for stats endpoint
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

    // 1. Bronze layer: ingest raw GitHub data (only ready users, 2 days data)
    const ingestResult = await this.github.ingestEachUserInTheirRepos(readyUsers, twoDaysAgo, now);

    // 2. Silver layer: build normalized bundle
    const silverBundle = await this.silver.buildBundle({
      sinceIso: twoDaysAgo,
      untilIso: now,
    });

    // 3. Curated/Gold: refresh analytics tables
    await this.analytics.refreshAll();

    // 4. Analytics report for the frontend
    const report = await this.analyticsReport.generateFrontendReport(readyUsers, ingestResult.excludedUsers);

    return {
      ...report,
      skippedProcessing: skippedProcessingUsers,
      pendingProcessing: pendingProcessingUsers,
      nonExistentUsers: nonExistentUsers
    };
  }

  /**
   * Generate analytics report only (Curated + Analytics).
   */
  async generateReport(users: string[]): Promise<unknown> {
    this.throwOnEmptyUsersArr(users);

    await this.analytics.refreshAll();
    return this.analyticsReport.generateFrontendReport(users, []);
  }

  /**
   * Remove users and their data from all database tables.
   */
  async removeUsers(users: string[]): Promise<unknown> {
    this.throwOnEmptyUsersArr(users);

    // Filter users by status - only remove ready and failed users
    const removableUsers = await this.getUsersByStatus(users, ['ready', 'failed']);
    const skippedUsers = users.filter(u => !removableUsers.includes(u));

    if (removableUsers.length === 0) {
      return {
        message: 'No users available for removal',
        skippedProcessing: skippedUsers,
        removed: []
      };
    }

    // Remove only the removable users using bronze-based removal
    const result = await this.removeUsersByStatus(removableUsers);

    return {
      ...result,
      skippedProcessing: skippedUsers
    };
  }

  /**
   * Add new users with async processing.
   */
  async addNewUsers(users: string[]): Promise<unknown> {
    this.throwOnEmptyUsersArr(users);

    // Check which users already exist (any status)
    const existingUsers = await this.getUsersByStatus(users, ['ready', 'processing', 'failed']);
    const newUsers = users.filter(u => !existingUsers.includes(u));

    if (newUsers.length === 0) {
      return {
        message: 'All users already exist',
        existing_users: existingUsers,
        processing_started: []
      };
    }

    // Process users synchronously and wait for completion
    const processingResult = await this.processUsersAsync(newUsers);

    return {
      message: 'User processing completed',
      successfulUsers: processingResult.successful,
      failedUsers: processingResult.failed,
      existingUsers: existingUsers
    };
  }

  /**
   * List all users grouped by their processing status.
   */
  async listUsers(): Promise<unknown> {
    // Cleanup: Remove queue entries only for users that are completed (ready/failed)
    await this.dataSource.query(
      `DELETE FROM bronze.processing_queue 
       WHERE user_login IN (
         SELECT login FROM bronze.github_users 
         WHERE processing_status IN ('ready', 'failed')
       )`
    );

    // Get users from github_users table
    const githubUsers = await this.dataSource.query(
      'SELECT login, processing_status FROM bronze.github_users ORDER BY login'
    );

    // Get users from processing_queue table
    const queueUsers = await this.dataSource.query(
      'SELECT user_login, status FROM bronze.processing_queue ORDER BY user_login'
    );

    const ready: string[] = [];
    const processing: string[] = [];
    const pending: string[] = [];
    const failed: string[] = [];

    // Process github_users results
    for (const row of githubUsers) {
      switch (row.processing_status) {
        case 'ready':
          ready.push(row.login);
          break;
        case 'processing':
          processing.push(row.login);
          break;
        case 'failed':
          failed.push(row.login);
          break;
      }
    }

    // Get all users already in github_users to avoid duplicates
    const githubUserLogins = new Set(githubUsers.map((r: any) => r.login));

    // Process processing_queue results (only if not already in github_users)
    for (const row of queueUsers) {
      if (!githubUserLogins.has(row.user_login)) {
        switch (row.status) {
          case 'processing':
            processing.push(row.user_login);
            break;
          case 'pending':
            pending.push(row.user_login);
            break;
        }
      }
    }

    const total = ready.length + processing.length + pending.length + failed.length;

    return {
      total,
      ready: { count: ready.length, users: ready },
      processing: { count: processing.length, users: processing },
      pending: { count: pending.length, users: pending },
      failed: { count: failed.length, users: failed }
    };
  }

  private throwOnEmptyUsersArr(users: string[]) {
    if (!users || !Array.isArray(users) || users.length === 0) {
      throw new BadRequestException(
        'Body must be { "users": string[] } with at least one username.',
      );
    }
  }

  private async processUsersAsync(users: string[]): Promise<{ successful: string[], failed: string[]; }> {
    const successful: string[] = [];
    const failed: string[] = [];

    // Clear any previous processing queue
    await this.dataSource.query('TRUNCATE bronze.processing_queue');

    // Insert all users as 'pending' in processing queue
    for (const user of users) {
      await this.dataSource.query(
        'INSERT INTO bronze.processing_queue (user_login, status) VALUES ($1, $2)',
        [user, 'pending']
      );
    }

    // Process each user sequentially
    for (const user of users) {
      try {
        // Update queue status to 'processing'
        await this.dataSource.query(
          'UPDATE bronze.processing_queue SET status = $1 WHERE user_login = $2',
          ['processing', user]
        );

        // Run GitHub pipeline with 6-month data collection for new users
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
        const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        await this.github.ingestNewUsersOnly([user], sixMonthsAgo, now);
        await this.analytics.refreshAll();

        // Set user status to ready in github_users
        await this.setUserStatus(user, 'ready');

        // Remove from processing queue (completed)
        await this.dataSource.query(
          'DELETE FROM bronze.processing_queue WHERE user_login = $1',
          [user]
        );

        successful.push(user);
      } catch (error) {
        // Set status to failed in github_users (if user was created)
        try {
          await this.setUserStatus(user, 'failed');
        } catch {
          // User might not exist in github_users yet, that's ok
        }

        // Remove from processing queue (failed)
        await this.dataSource.query(
          'DELETE FROM bronze.processing_queue WHERE user_login = $1',
          [user]
        );

        failed.push(user);
        console.error(`Failed to process user ${user}:`, error);
      }
    }

    return { successful, failed };
  }

  // Status management utilities
  private async getUsersByStatus(users: string[], allowedStatuses: string[]) {
    const placeholders = allowedStatuses.map((_, i) => `$${i + 2}`).join(', ');
    const result = await this.dataSource.query(
      `SELECT login FROM bronze.github_users WHERE login = ANY($1) AND processing_status IN (${placeholders})`,
      [users, ...allowedStatuses]
    );
    return result.map((row: any) => row.login);
  }

  private async setUserStatus(login: string, status: 'ready' | 'processing' | 'failed') {
    await this.dataSource.query(
      'UPDATE bronze.github_users SET processing_status = $1 WHERE login = $2',
      [status, login]
    );
  }

  private async removeUsersByStatus(users: string[]) {
    const removedUsers: string[] = [];
    const failedUsers: string[] = [];

    for (const user of users) {
      try {
        // Get user_node for this specific user from bronze table
        const userNodeResult = await this.dataSource.query(
          'SELECT user_node FROM bronze.github_users WHERE login = $1',
          [user]
        );

        if (userNodeResult.length === 0) {
          continue; // User not found, skip
        }

        const userNode = userNodeResult[0].user_node;

        // Delete from all layers
        await this.dataSource.query('DELETE FROM bronze.github_events WHERE actor_user_node = $1', [userNode]);
        await this.dataSource.query('DELETE FROM gold.user_activity WHERE user_id = $1', [userNode]);
        await this.dataSource.query('DELETE FROM gold.user_profile WHERE login = $1', [user]);
        await this.dataSource.query('DELETE FROM bronze.github_users WHERE login = $1', [user]);

        removedUsers.push(user);
      } catch (error) {
        failedUsers.push(user);
      }
    }

    return {
      message: 'User removal completed',
      summary: {
        requested: users.length,
        removed: removedUsers.length,
        failed: failedUsers.length
      },
      removedUsers,
      failedUsers
    };
  }
}
