import type { GraphqlClient } from './graphql-client.js';
import type {
  RepoMetadata,
  RepoMetadataResponse,
  RepoTopicsPageResponse,
} from './graphql-types.js';
import {
  REPO_METADATA_QUERY,
  REPO_TOPICS_PAGE_QUERY,
} from './graphql-queries.js';

const NODES_BATCH_SIZE = 100;

export async function fetchRepoMetadata(
  client: GraphqlClient,
  ids: string[],
): Promise<Map<string, RepoMetadata>> {
  const map = new Map<string, RepoMetadata>();
  if (ids.length === 0) return map;

  for (let i = 0; i < ids.length; i += NODES_BATCH_SIZE) {
    const chunk = ids.slice(i, i + NODES_BATCH_SIZE);
    const res = await client.call<RepoMetadataResponse>(REPO_METADATA_QUERY, {
      ids: chunk,
    });
    for (const n of res.nodes) {
      if (n && n.nameWithOwner) map.set(n.nameWithOwner, n);
    }
  }

  await Promise.all(
    [...map.values()]
      .filter((m) => m.repositoryTopics.pageInfo.hasNextPage)
      .map((m) => paginateTopics(client, m)),
  );

  return map;
}

async function paginateTopics(
  client: GraphqlClient,
  meta: RepoMetadata,
): Promise<void> {
  let cursor = meta.repositoryTopics.pageInfo.endCursor;
  let hasNext = meta.repositoryTopics.pageInfo.hasNextPage;
  while (hasNext && cursor) {
    const page = await client.call<RepoTopicsPageResponse>(
      REPO_TOPICS_PAGE_QUERY,
      { id: meta.id, after: cursor },
    );
    if (!page.node) break;
    const conn = page.node.repositoryTopics;
    const nextCursor = conn.pageInfo.endCursor;
    if (nextCursor === cursor) break;
    meta.repositoryTopics.nodes.push(...conn.nodes);
    cursor = nextCursor;
    hasNext = conn.pageInfo.hasNextPage;
  }
}
