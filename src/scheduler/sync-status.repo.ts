import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSyncStatus } from './sync-status.entity.js';

@Injectable()
export class SyncStatusRepo {
  constructor(
    @InjectRepository(UserSyncStatus)
    private readonly repo: Repository<UserSyncStatus>,
  ) {}

  async findByUsername(username: string): Promise<UserSyncStatus | null> {
    return this.repo.findOne({ where: { username } });
  }

  async createOrUpdate(username: string, data: Partial<UserSyncStatus>): Promise<UserSyncStatus> {
    const existing = await this.findByUsername(username);
    
    if (existing) {
      Object.assign(existing, data);
      return this.repo.save(existing);
    }
    
    return this.repo.save(this.repo.create({ username, ...data }));
  }

  async markInProgress(username: string): Promise<void> {
    await this.createOrUpdate(username, {
      status: 'in_progress',
      errorMessage: null,
    });
  }

  async markCompleted(username: string): Promise<void> {
    await this.createOrUpdate(username, {
      status: 'completed',
      lastSyncAt: new Date(),
      errorMessage: null,
      retryCount: 0,
    });
  }

  async markFailed(username: string, error: string): Promise<void> {
    const existing = await this.findByUsername(username);
    await this.createOrUpdate(username, {
      status: 'failed',
      errorMessage: error,
      retryCount: (existing?.retryCount || 0) + 1,
    });
  }

  async getUsersToSync(olderThanHours: number = 24): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - olderThanHours);

    const results = await this.repo
      .createQueryBuilder('sync')
      .select('sync.username')
      .where('sync.lastSyncAt IS NULL OR sync.lastSyncAt < :cutoffDate', { cutoffDate })
      .andWhere('sync.status != :status', { status: 'in_progress' })
      .getMany();

    return results.map(r => r.username);
  }

  async getAllUsernames(): Promise<string[]> {
    const results = await this.repo.find({ select: ['username'] });
    return results.map(r => r.username);
  }
}