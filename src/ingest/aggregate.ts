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
  const c = user.contributionsCollection;

  const ensure = (r: {
    databaseId: number | null;
    nameWithOwner: string;
  }): RepoAggregate => {
    const key = r.nameWithOwner;
    let bucket = perRepo.get(key);
    if (!bucket) {
      const m = metadata.get(key);
      const topics = (m?.repositoryTopics.nodes ?? [])
        .map((n) => n?.topic?.name)
        .filter((n): n is string => typeof n === 'string');
      bucket = {
        repoDatabaseId: r.databaseId ?? m?.databaseId ?? 0,
        nameWithOwner: key,
        description: m?.description ?? null,
        url: m?.url ?? '',
        forkCount: m?.forkCount ?? 0,
        stargazerCount: m?.stargazerCount ?? 0,
        primaryLanguage: m?.primaryLanguage?.name ?? null,
        primaryLanguageColor: m?.primaryLanguage?.color ?? null,
        licenseName: m?.licenseInfo?.name ?? null,
        licenseSpdx: m?.licenseInfo?.spdxId ?? null,
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

  for (const cb of c.commitContributionsByRepository) {
    ensure(cb.repository).commits = cb.contributions.totalCount;
  }
  for (const cb of c.pullRequestContributionsByRepository) {
    ensure(cb.repository).pullRequests = cb.contributions.totalCount;
  }
  for (const cb of c.issueContributionsByRepository) {
    ensure(cb.repository).issues = cb.contributions.totalCount;
  }
  for (const cb of c.pullRequestReviewContributionsByRepository) {
    ensure(cb.repository).prReviews = cb.contributions.totalCount;
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
    const m = metadata.get(nameWithOwner);
    const bucket = ensure({
      databaseId: m?.databaseId ?? null,
      nameWithOwner,
    });
    if (counts.commits > 0) bucket.commits = counts.commits;
    if (counts.prs > 0) bucket.pullRequests = counts.prs;
    if (counts.issues > 0) bucket.issues = counts.issues;
    if (counts.reviews > 0) bucket.prReviews = counts.reviews;
  }

  return perRepo;
}
