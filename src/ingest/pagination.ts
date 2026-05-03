import type { GraphqlClient } from './graphql-client.js';
import type {
  IssueCommentNode,
  PullRequestReviewNode,
  UserCommentsPageResponse,
  UserNode,
  UserPRReviewsResponse,
} from './graphql-types.js';
import {
  USER_COMMENTS_PAGE_QUERY,
  USER_PR_REVIEWS_PAGE_QUERY,
  USER_PR_REVIEWS_QUERY,
} from './graphql-queries.js';

export async function paginateIssueComments(
  client: GraphqlClient,
  login: string,
  user: UserNode,
  sinceMs: number,
): Promise<{ nodes: IssueCommentNode[]; pagesFetched: number }> {
  let nodes: IssueCommentNode[] = user.issueComments.nodes;
  let pagesFetched = 1;
  let cursor = user.issueComments.pageInfo.startCursor;
  let hasPrevious = user.issueComments.pageInfo.hasPreviousPage;

  while (
    hasPrevious &&
    cursor &&
    nodes.length > 0 &&
    new Date(nodes[0].createdAt).getTime() >= sinceMs
  ) {
    const page = await client.call<UserCommentsPageResponse>(
      USER_COMMENTS_PAGE_QUERY,
      { login, before: cursor },
    );
    if (!page.user) break;
    const nextCursor = page.user.issueComments.pageInfo.startCursor;
    if (nextCursor === cursor) break;
    nodes = [...page.user.issueComments.nodes, ...nodes];
    cursor = nextCursor;
    hasPrevious = page.user.issueComments.pageInfo.hasPreviousPage;
    pagesFetched++;
  }

  return { nodes, pagesFetched };
}

export async function fetchPRReviewsInWindow(
  client: GraphqlClient,
  login: string,
  since: string,
): Promise<{ reviewsInWindow: PullRequestReviewNode[]; pagesFetched: number }> {
  const reviewsInWindow: PullRequestReviewNode[] = [];
  let pagesFetched = 0;
  let cursor: string | null = null;
  let hasNext = true;

  while (hasNext) {
    const page: UserPRReviewsResponse = cursor
      ? await client.call<UserPRReviewsResponse>(USER_PR_REVIEWS_PAGE_QUERY, {
          login,
          since,
          after: cursor,
        })
      : await client.call<UserPRReviewsResponse>(USER_PR_REVIEWS_QUERY, {
          login,
          since,
        });
    pagesFetched++;
    if (!page.user) break;
    const conn =
      page.user.contributionsCollection.pullRequestReviewContributions;
    const nextCursor = conn.pageInfo.endCursor;
    if (cursor !== null && nextCursor === cursor) break;
    for (const n of conn.nodes) {
      if (n.pullRequestReview) reviewsInWindow.push(n.pullRequestReview);
    }
    hasNext = conn.pageInfo.hasNextPage;
    cursor = nextCursor;
  }

  return { reviewsInWindow, pagesFetched };
}
