import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMocker, MockMetadata } from 'jest-mock';
import { DataSource } from 'typeorm';
import { GithubService } from '../../raw/raw.service.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';
import { v4 as uuid4 } from 'uuid';

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

    it('Should throw if GITHUB_TOKEN is missing', async () => {
        delete process.env.GITHUB_TOKEN;
        expect(process.env.GITHUB_TOKEN).toBeUndefined();

        // This should throw during service creation
        await expect(createService()).rejects.toThrow('GITHUB_TOKEN environment variable is required');
    });

    it('Should throw for empty users array', async () => {
        process.env.GITHUB_TOKEN = uuid4();
        await createService();

        await expect(service.ingestEachUserInTheirRepos([], '')).rejects.toThrow('users list is required');
    });
});