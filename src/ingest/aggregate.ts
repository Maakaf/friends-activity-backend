import type {
  IssueCommentNode,
  PullRequestReviewNode,
  RepoMetadata,
  UserNode,
} from './graphql-types.js';
import type { OverflowCounts } from './overflow.js';

export interface RepoAggregate {
  repoDatabaseId: number;
  nameWithOwner: string;
  description: string | null;
  url: string;
  forkCount: number;
  stargazerCount: number;
  primaryLanguage: string | null;
  primaryLanguageColor: string | null;
  licenseName: string | null;
  licenseSpdx: string | null;
  topics: string[];
  commits: number;
  pullRequests: number;
  issues: number;
  prReviews: number;
  issueComments: number;
  prComments: number;
}

export function aggregate(
  user: UserNode,
  commentsInWindow: IssueCommentNode[],
  reviewsInWindow: PullRequestReviewNode[],
  metadata: Map<string, RepoMetadata>,
  overflowCounts: Map<string, OverflowCounts>,
): Map<string, RepoAggregate> {
  const perRepo = new Map<string, RepoAggregate>();
  const cc = user.contributionsCollection;

  const ensure = (repo: {
    databaseId: number | null;
    nameWithOwner: string;
  }): RepoAggregate => {
    const key = repo.nameWithOwner;
    let bucket = perRepo.get(key);
    if (!bucket) {
      const meta = metadata.get(key);
      const topics = (meta?.repositoryTopics.nodes ?? [])
        .map((n) => n?.topic?.name)
        .filter((name): name is string => typeof name === 'string');
      bucket = {
        repoDatabaseId: repo.databaseId ?? meta?.databaseId ?? 0,
        nameWithOwner: key,
        description: meta?.description ?? null,
        url: meta?.url ?? '',
        forkCount: meta?.forkCount ?? 0,
        stargazerCount: meta?.stargazerCount ?? 0,
        primaryLanguage: meta?.primaryLanguage?.name ?? null,
        primaryLanguageColor: meta?.primaryLanguage?.color ?? null,
        licenseName: meta?.licenseInfo?.name ?? null,
        licenseSpdx: meta?.licenseInfo?.spdxId ?? null,
        topics,
        commits: 0,
        pullRequests: 0,
        issues: 0,
        prReviews: 0,
        issueComments: 0,
        prComments: 0,
      };
      perRepo.set(key, bucket);
    }
    return bucket;
  };

  for (const bucket of cc.commitContributionsByRepository) {
    ensure(bucket.repository).commits = bucket.contributions.totalCount;
  }
  for (const bucket of cc.pullRequestContributionsByRepository) {
    ensure(bucket.repository).pullRequests = bucket.contributions.totalCount;
  }
  for (const bucket of cc.issueContributionsByRepository) {
    ensure(bucket.repository).issues = bucket.contributions.totalCount;
  }
  for (const bucket of cc.pullRequestReviewContributionsByRepository) {
    ensure(bucket.repository).prReviews = bucket.contributions.totalCount;
  }

  for (const comment of commentsInWindow) {
    if (!comment.repository) continue;
    const bucket = ensure(comment.repository);
    if (comment.pullRequest != null) bucket.prComments++;
    else if (comment.issue != null) bucket.issueComments++;
  }

  for (const review of reviewsInWindow) {
    if (!review.repository) continue;
    ensure(review.repository).prComments += review.comments.totalCount;
  }

  for (const [nameWithOwner, counts] of overflowCounts) {
    const meta = metadata.get(nameWithOwner);
    const bucket = ensure({
      databaseId: meta?.databaseId ?? null,
      nameWithOwner,
    });
    if (counts.commits > 0) bucket.commits = counts.commits;
    if (counts.prs > 0) bucket.pullRequests = counts.prs;
    if (counts.issues > 0) bucket.issues = counts.issues;
    if (counts.reviews > 0) bucket.prReviews = counts.reviews;
  }

  return perRepo;
}
