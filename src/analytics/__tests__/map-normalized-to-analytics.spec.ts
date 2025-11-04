import { mapSilverToCurated } from '../mappers/map-normalized-to-analytics.js';
import { SilverBundle } from '../../normalized/types.js';


describe('mapSilverToCurated', () => {
  it('maps users, repos, and activities correctly', () => {
    const bundle: SilverBundle = {
      users: [
        {
          userId: 'u1',
          login: 'alice',
          name: 'Alice',
          avatarUrl: 'http://img',
          htmlUrl: 'http://gh',
          email: 'a@example.com',
          company: 'Acme',
          location: 'Earth',
          bio: 'Bio',
          type: 'User',
          siteAdmin: false,
          ghCreatedAt: '2024-01-01T00:00:00Z',
          ghUpdatedAt: '2024-01-02T00:00:00Z',
        },
      ],
      repos: [
        {
          repoId: 'r1',
          ownerUserId: 'u1',
          repoName: 'demo',
          visibility: 'public',
          defaultBranch: 'main',
          forkCount: 2,
          lastActivity: '2024-01-03T00:00:00Z',
          ghCreatedAt: '2024-01-01T00:00:00Z',
        },
      ],
      issues: [
        {
          authorUserId: 'u1',
          repoId: 'r1',
          createdAt: '2024-01-04T00:00:00Z',
          issueId: '',
          state: 'open',
          closedAt: null,
          updatedAt: null
        },
      ],
      prs: [
        {
          authorUserId: 'u1',
          repoId: 'r1',
          createdAt: '2024-01-05T00:00:00Z',
          prId: 'prId1',
          mergedAt: '2024-02-05T00:00:00Z',
          closedAt: '2024-02-05T00:00:00Z',
          updatedAt: '2024-02-05T00:00:00Z'
        },
      ],
      comments: [
        {
          authorUserId: 'u1',
          repoId: 'r1',
          createdAt: '2024-01-06T00:00:00Z',
          parentType: 'PR',
          commentId: 'commentId1',
          parentId: 'pId1'
        },
        {
          authorUserId: 'u1',
          repoId: 'r1',
          createdAt: '2024-06-06T00:00:00Z',
          parentType: 'Issue',
          commentId: 'commentId2',
          parentId: 'pId1'
        },
      ],
      commits: [
        {
          authorUserId: 'u1',
          repoId: 'r1',
          createdAt: '2024-01-07T00:00:00Z',
          commitId: 'commitId1'
        },
      ],
    };

    const { profiles, repos, activities } = mapSilverToCurated(bundle);

    // --- profiles ---
    expect(profiles).toHaveLength(1);
    const profile = profiles[0];
    expect(profile.userId).toBe('u1');
    expect(profile.login).toBe('alice');
    expect(profile.ghCreatedAt).toBeInstanceOf(Date);

    // --- repositories ---
    expect(repos).toHaveLength(1);
    const repo = repos[0];
    expect(repo.repoId).toBe('r1');
    expect(repo.ownerUserId).toBe('u1');
    expect(repo.forkCount).toBe(2);
    expect(repo.lastActivity).toBeInstanceOf(Date);

    // --- activities ---
    // 1 issue + 1 PR + 2 comment + 1 commit = 4 records
    expect(activities).toHaveLength(
      bundle.issues.length +
      bundle.prs.length +
      bundle.comments.length +
      bundle.commits.length
    );
    const types = activities.map(a => a.activityType).sort();
    expect(types).toEqual(['commit', 'issue', 'issue_comment', 'pr', 'pr_comment']);
    activities.forEach(a => {
      expect(a.userId).toBe('u1');
      expect(a.repoId).toBe('r1');
      expect(a.day).toBeInstanceOf(Date);
      expect(a.activityCount).toBe(1);
    });
  });

  it('handles empty or missing arrays gracefully', () => {
    const bundle: any = {}; // no users, repos, or activities
    const { profiles, repos, activities } = mapSilverToCurated(bundle);
    expect(profiles).toHaveLength(0);
    expect(repos).toHaveLength(0);
    expect(activities).toHaveLength(0);
  });
});
