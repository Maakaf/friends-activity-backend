import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AnalyticsReportService } from '../../analytics/analytics-report.service.js';
import { AnalyticsService } from '../../analytics/analytics.service.js';
import { SilverOrchestratorService } from '../../normalized/orchestrator.js';
import { GithubService } from '../../raw/raw.service.js';
import { PipelineService } from '../pipeline.service.js';

const dataSourceStub = {
  query: () => Promise.resolve([]),
} as unknown as DataSource;

const createService = () =>
  new PipelineService(
    {} as GithubService,
    {} as SilverOrchestratorService,
    {} as AnalyticsService,
    {} as AnalyticsReportService,
    dataSourceStub,
  );

describe('PipelineService guards', () => {
  const sharedExpectations = async (
    fn: (service: PipelineService) => Promise<unknown>,
  ) => {
    const service = createService();
    await expect(fn(service)).rejects.toThrow(
      'Body must be { "users": string[] } with at least one username.',
    );
    await expect(fn(service)).rejects.toBeInstanceOf(BadRequestException);
  };

  it('run()', async () => {
    await sharedExpectations((s) => s.run([]));
  });

  it('generateReport()', async () => {
    await sharedExpectations((s) => s.generateReport([]));
  });

  it('removeUsers()', async () => {
    await sharedExpectations((s) => s.removeUsers([]));
  });

  it('addNewUsers()', async () => {
    await sharedExpectations((s) => s.addNewUsers([]));
  });
});
