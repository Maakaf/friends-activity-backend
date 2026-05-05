import type { GraphqlErrorBody } from './graphql-types.js';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const USER_AGENT = 'maakaf-friends-activity/1.0';
const MAX_ATTEMPTS = 5;
// Backoff before each retry attempt, in milliseconds. Heavy queries can hit
// transient GitHub 5xx errors; the daily cron has plenty of time so we wait
// generously to give GitHub's load shedding a chance to clear.
//   1: ~1s  2: ~30s  3: ~3min  4: ~10min  5: ~30min  (total max ≈ 43min)
const BACKOFF_MS = [1_000, 30_000, 180_000, 600_000, 1_800_000];

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
        // Retry 5xx (transient server errors) and 403 with Retry-After
        // (secondary rate limit / abuse detection). Don't retry 401, 404,
        // 422, etc. — those are real failures.
        const isTransient =
          res.status >= 500 ||
          (res.status === 403 && res.headers.get('Retry-After') != null);
        if (!isTransient || attempt === MAX_ATTEMPTS) break;
      } catch (e) {
        lastErr = e;
        if (attempt === MAX_ATTEMPTS) throw e;
      }
      // If GitHub told us how long to wait (Retry-After in seconds), honor it
      // and add a small buffer + positive-only jitter — never undercut what
      // GitHub asked. Otherwise use our backoff schedule with ±20% jitter
      // so concurrent users don't all retry at the same instant.
      const retryAfterSec = Number(res?.headers.get('Retry-After'));
      let ms: number;
      if (Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
        // GitHub said wait N seconds → wait N + 5s buffer + 0-3s jitter.
        ms = retryAfterSec * 1000 + 5_000 + Math.round(Math.random() * 3_000);
      } else {
        const baseMs =
          BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1];
        ms = Math.round(baseMs * (0.8 + Math.random() * 0.4));
      }
      await new Promise((r) => setTimeout(r, ms));
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
