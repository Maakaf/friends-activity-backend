import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PipelineService } from '../pipeline/pipeline.service.js';
import { SyncStatusRepo } from './sync-status.repo.js';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly BATCH_SIZE = 10; // Process 10 users at a time
  private readonly DELAY_BETWEEN_BATCHES_MS = 60000; // 1 minute delay between batches

  constructor(
    private readonly pipelineService: PipelineService,
    private readonly syncStatusRepo: SyncStatusRepo,
  ) {}

  // Run every day at 2 AM
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleDailySync() {
    this.logger.log('Starting daily user sync...');

    try {
      const usersToSync = await this.syncStatusRepo.getUsersToSync(24);
      this.logger.log(`Found ${usersToSync.length} users to sync`);

      if (usersToSync.length === 0) {
        this.logger.log('No users need syncing');
        return;
      }

      await this.processBatches(usersToSync);

      this.logger.log('Daily sync completed successfully');
    } catch (error) {
      this.logger.error('Daily sync failed', error.stack);
    }
  }

  private async processBatches(usernames: string[]): Promise<void> {
    const totalBatches = Math.ceil(usernames.length / this.BATCH_SIZE);

    for (let i = 0; i < usernames.length; i += this.BATCH_SIZE) {
      const batch = usernames.slice(i, i + this.BATCH_SIZE);
      const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
      
      this.logger.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} users)`);
      
      // Process batch in parallel
      const results = await Promise.allSettled(
        batch.map(username => this.syncUser(username))
      );

      // Log batch results
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      this.logger.log(`Batch ${batchNumber} complete: ${succeeded} succeeded, ${failed} failed`);

      // Delay between batches to respect rate limits
      if (i + this.BATCH_SIZE < usernames.length) {
        this.logger.log(`Waiting ${this.DELAY_BETWEEN_BATCHES_MS / 1000}s before next batch...`);
        await this.delay(this.DELAY_BETWEEN_BATCHES_MS);
      }
    }
  }

  private async syncUser(username: string): Promise<void> {
    this.logger.log(`Syncing user: ${username}`);
    
    try {
      await this.syncStatusRepo.markInProgress(username);

      // Call your existing pipeline
      await (this.pipelineService as any).processUser(username);

      await this.syncStatusRepo.markCompleted(username);
      this.logger.log(`Successfully synced user: ${username}`);
    } catch (error) {
      this.logger.error(`Failed to sync user ${username}:`, error.message);
      await this.syncStatusRepo.markFailed(username, error.message);
      throw error; // Re-throw to be caught by Promise.allSettled
    }
  }

  // Manual trigger for testing
  async triggerSyncForUser(username: string): Promise<void> {
    this.logger.log(`Manual sync triggered for user: ${username}`);
    await this.syncUser(username);
  }

  // Manual trigger for all users
  async triggerFullSync(): Promise<void> {
    this.logger.log('Manual full sync triggered');
    await this.handleDailySync();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}