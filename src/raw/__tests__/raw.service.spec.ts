import { DataSource } from 'typeorm';
import { GithubService } from '../../raw/raw.service.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';

const dataSourceStub: Pick<DataSource, 'query'> = {
  query: () => Promise.resolve([]),
};

const buildService = () =>
  new GithubService(dataSourceStub as DataSource, new RawMemoryStore());

describe('GithubService guards', () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  it('throws if GITHUB_TOKEN is missing', () => {
    expect(() => buildService()).toThrow(
      'GITHUB_TOKEN environment variable is required',
    );
  });

  it('throws when ingestEachUserInTheirRepos receives empty array', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const service = buildService();
    await expect(service.ingestEachUserInTheirRepos([], '')).rejects.toThrow(
      'users list is required',
    );
  });
});
