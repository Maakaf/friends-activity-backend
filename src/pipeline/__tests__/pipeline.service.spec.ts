import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MockMetadata, ModuleMocker } from 'jest-mock';
import { DataSource } from 'typeorm';
import { AnalyticsReportService } from '../../analytics/analytics-report.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { SilverOrchestratorService } from '../../normalized/orchestrator';
import { GithubService } from '../../raw/raw.service';
import { PipelineService } from '../pipeline.service';

const moduleMocker = new ModuleMocker(global);


describe('PipelineService', () => {
    let service: PipelineService;
    let mockDataSource: DataSource;
    let nestTestmodule: TestingModule;

    const createService = async () => {
        const mockDataSourceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(DataSource) as MockMetadata<DataSource, DataSource>
        );
        const mockGithubServiceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(GithubService) as MockMetadata<GithubService, GithubService>
        );
        const mockSilverOrchestratorServiceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(SilverOrchestratorService) as MockMetadata<SilverOrchestratorService, SilverOrchestratorService>
        );
        const mockAnalyticsServiceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(AnalyticsService) as MockMetadata<AnalyticsService, AnalyticsService>
        );
        const mockAnalyticsReportServiceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(AnalyticsReportService) as MockMetadata<AnalyticsReportService, AnalyticsReportService>
        );


        nestTestmodule = await Test.createTestingModule({
            providers: [
                PipelineService,
                {
                    provide: DataSource,
                    useValue: mockDataSourceValue,
                },
                {
                    provide: GithubService,
                    useValue: mockGithubServiceValue,
                },
                {
                    provide: SilverOrchestratorService,
                    useValue: mockSilverOrchestratorServiceValue,
                },
                {
                    provide: AnalyticsService,
                    useValue: mockAnalyticsServiceValue,
                },
                {
                    provide: AnalyticsReportService,
                    useValue: mockAnalyticsReportServiceValue,
                },


            ],
        }).compile();

        service = nestTestmodule.get<PipelineService>(PipelineService);
        mockDataSource = nestTestmodule.get<DataSource>(DataSource);
    };
    afterEach(async () => {
        if (nestTestmodule) {
            await nestTestmodule.close();
        }
    });
    describe('run', () => {
        it('Should throw if users array is empty', async () => {
            await createService();
            await expect(service.run([]))
                .rejects
                .toThrow('Body must be { "users": string[] } with at least one username.');
            await expect(service.run([])).rejects.toBeInstanceOf(BadRequestException);
        });
    });
    describe('generateReport', () => {
        it('Should throw if users array is empty', async () => {
            await createService();
            await expect(service.generateReport([]))
                .rejects
                .toThrow('Body must be { "users": string[] } with at least one username.');
            await expect(service.generateReport([])).rejects.toBeInstanceOf(BadRequestException);
        });
    });
    describe('removeUsers', () => {
        it('Should throw if users array is empty', async () => {
            await createService();
            await expect(service.removeUsers([]))
                .rejects
                .toThrow('Body must be { "users": string[] } with at least one username.');
            await expect(service.removeUsers([])).rejects.toBeInstanceOf(BadRequestException);
        });
    });
    describe('addNewUsers', () => {
        it('Should throw if users array is empty', async () => {
            await createService();
            await expect(service.addNewUsers([]))
                .rejects
                .toThrow('Body must be { "users": string[] } with at least one username.');
            await expect(service.addNewUsers([])).rejects.toBeInstanceOf(BadRequestException);
        });
    });
    describe('listUsers', () => { });
});
