import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMocker, MockMetadata } from 'jest-mock';
import { DataSource } from 'typeorm';
import { GithubService } from '../../raw/raw.service.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';
import { v4 as uuid4 } from 'uuid';
import { GITHUB_CLIENT } from '../../raw/github-client.token.js';
import type { GithubClient } from '../../raw/github-client-interface.js';
import { jest } from '@jest/globals';

const moduleMocker = new ModuleMocker(global);

describe('GithubService', () => {
    let service: GithubService;
    let mockDataSource: DataSource;
    let mockMemoryStore: RawMemoryStore;
    let nestTestmodule: TestingModule;

    const createService = async () => {
        const mockDataSourceValue = moduleMocker.generateFromMetadata(
            moduleMocker.getMetadata(DataSource) as MockMetadata<any, any>
        );

        const mockGithubClient: GithubClient = {
            // Users
            getUserByUsername: jest.fn(),
            // Repos
            getRepo: jest.fn(),
            listRepoCommits: jest.fn(),
            // Issues & PRs
            listIssuesAndPullsForRepo: jest.fn(),
            getIssue: jest.fn(),
            getPull: jest.fn(),
            // Comments
            listIssueCommentsForRepo: jest.fn(),
            listReviewCommentsForRepo: jest.fn(),
            // PR commits
            listCommitsForPull: jest.fn(),
            // Search
            searchIssuesAndPulls: jest.fn(),
            searchCommits: jest.fn(),
        } as unknown as GithubClient;

        nestTestmodule = await Test.createTestingModule({
            providers: [
                GithubService,
                {
                    provide: DataSource,
                    useValue: mockDataSourceValue,
                },
                {
                    provide: RawMemoryStore,
                    useValue: moduleMocker.generateFromMetadata(
                        moduleMocker.getMetadata(RawMemoryStore) as MockMetadata<any, any>
                    ),
                },
                {
                    provide: GITHUB_CLIENT,
                    useValue: mockGithubClient,
                },
            ],
        }).compile();

        service = nestTestmodule.get<GithubService>(GithubService);
        mockDataSource = nestTestmodule.get<DataSource>(DataSource);
        mockMemoryStore = nestTestmodule.get<RawMemoryStore>(RawMemoryStore);
    };

    afterEach(async () => {
        if (nestTestmodule) {
            await nestTestmodule.close();
        }
    });

    it('Should create service even if GITHUB_TOKEN is missing (client injected)', async () => {
        delete process.env.GITHUB_TOKEN;
        expect(process.env.GITHUB_TOKEN).toBeUndefined();

        await expect(createService()).resolves.toBeUndefined();
        expect(service).toBeDefined();
    });

    it('Should throw for empty users array', async () => {
        process.env.GITHUB_TOKEN = uuid4();
        await createService();

        await expect(service.ingestEachUserInTheirRepos([], '')).rejects.toThrow('users list is required');
    });
});