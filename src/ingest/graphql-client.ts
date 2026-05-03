import type { GraphqlErrorBody } from './graphql-types.js';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const USER_AGENT = 'maakaf-friends-activity/1.0';
const MAX_ATTEMPTS = 3;

export class GraphqlClient {
  constructor(private readonly token: string) {}

  async call<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    let res: Response | undefined;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        res = await fetch(GITHUB_GRAPHQL_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT,
          },
          body: JSON.stringify({ query, variables }),
        });
        if (res.ok) break;
        if (res.status < 500 || attempt === MAX_ATTEMPTS) break;
      } catch (e) {
        lastErr = e;
        if (attempt === MAX_ATTEMPTS) throw e;
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    if (!res) {
      if (lastErr instanceof Error) throw lastErr;
      throw new Error('GitHub GraphQL: no response');
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `GitHub GraphQL HTTP ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`,
      );
    }

    const body = (await res.json()) as { data: T } & Partial<GraphqlErrorBody>;
    if (body.errors && body.errors.length > 0) {
      const msgs = body.errors.map((e) => e.message).join('; ');
      throw new Error(`GitHub GraphQL error: ${msgs}`);
    }
    return body.data;
  }
}
