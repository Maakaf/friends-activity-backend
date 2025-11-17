import { jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { GithubService } from '../../raw/raw.service.js';
import { RawMemoryStore } from '../../raw/raw-memory.store.js';
import { RequestError } from '@octokit/request-error';

// Minimal stub data source
const dataSourceStub: Pick<DataSource, 'query'> = {
  query: () => Promise.resolve([]),
};

const buildService = () =>
  new GithubService(dataSourceStub as DataSource, new RawMemoryStore());

/**
 * Narrow type used only in tests to access private members we need to mock.
 * This avoids using `any` while still letting us spy on internals.
 */
type GithubServiceInternals = {
  octokit: {
    paginate: (...args: unknown[]) => Promise<unknown>;
  };
  retryWithBackoff: (...args: unknown[]) => Promise<unknown>;
  logger: {
    error: (message: string) => void;
  };
  discoverReposForUser: (
    login: string,
    sinceIso: string,
  ) => Promise<Array<{ owner: string; repo: string }>>;
};

const asInternals = (service: GithubService): GithubServiceInternals =>
  service as unknown as GithubServiceInternals;

describe('GithubService', () => {
  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ------------------------------------------------------
  // GUARD TESTS (original ones)
  // ------------------------------------------------------

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

  // ------------------------------------------------------
  // NEW TEST #1 — Query contains required qualifiers
  // ------------------------------------------------------

  it('builds GitHub issues search query with required qualifiers', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const service = buildService();
    const internals = asInternals(service);

    const capturedParamsList: Array<{ q?: string }> = [];

    // Mock paginate to capture *all* query params (issues + commits)
    jest
      .spyOn(internals.octokit, 'paginate')
      .mockImplementation((...args: unknown[]) => {
        const params = args[1] as { q?: string };
        capturedParamsList.push(params);
        return Promise.resolve([]); // Fake empty response
      });

    await internals.discoverReposForUser('testuser', '2025-01-01T00:00:00Z');

    expect(capturedParamsList.length).toBeGreaterThan(0);

    // Find the issues/PRs search call (the one with involves:testuser)
    const issuesParams = capturedParamsList.find(
      (p) => typeof p.q === 'string' && p.q.includes('involves:testuser'),
    );

    expect(issuesParams).toBeDefined();

    const q = issuesParams!.q as string;

    expect(q).toContain('involves:testuser');
    expect(q).toContain('created:>=2025-01-01T00:00:00Z');
    expect(q).toContain('is:issue');
    expect(q).toContain('is:pull-request');

    // Ensure deprecated param is gone on that call
    expect('advanced_search' in issuesParams!).toBe(false);
  });

  // ------------------------------------------------------
  // NEW TEST #2 — Graceful handling of GitHub 422 error
  // ------------------------------------------------------

  it('handles GitHub 422 validation errors gracefully', async () => {
    process.env.GITHUB_TOKEN = 'test-token';
    const service = buildService();
    const internals = asInternals(service);

    // Simulate a 422 Validation Failed from GitHub
    const requestError = new RequestError('Validation Failed', 422, {
      request: {
        method: 'GET',
        url: 'https://api.github.com/search/issues',
        headers: {},
      },
      response: {
        status: 422,
        url: 'https://api.github.com/search/issues',
        headers: {},
        data: {
          message: 'Validation Failed',
          errors: [],
        },
      },
    });

    // Make retryWithBackoff throw the 422
    jest.spyOn(internals, 'retryWithBackoff').mockRejectedValue(requestError);

    const loggerSpy = jest
      .spyOn(internals.logger, 'error')
      .mockImplementation(() => {});

    const result = await internals.discoverReposForUser(
      'testuser',
      '2025-01-01T00:00:00Z',
    );

    // On 422 we return an empty array of repos
    expect(result).toEqual([]);

    // Ensure the 422 error was logged
    expect(loggerSpy).toHaveBeenCalled();
    expect(loggerSpy.mock.calls[0][0]).toContain('Validation Failed (422)');
  });
});
