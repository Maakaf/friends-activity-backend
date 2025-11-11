# Type Safety Guide

This backend compiles with `"strict": true` and rejects any explicit `any`.  
Use the following patterns to keep the type system helpful for everyone.

## Core Principles

- Introduce concrete interfaces for every SQL row or external payload.
- Prefer `unknown` over `any`, and narrow values immediately with helpers.
- Keep TypeORM entities, DTOs, and service method signatures fully typed.
- Use helper functions (e.g., `queryRows<T>()`) whenever you need to convert raw query results into typed objects.

## Common Patterns

### Database Queries

```ts
type GithubUserRow = { login: string; processing_status: ProcessingStatus };

const rows = await this.queryRows<GithubUserRow>(
  'SELECT login, processing_status FROM bronze.github_users WHERE login = ANY($1)',
  [users],
);
```

### Octokit Payloads

Rely on official types:

```ts
type IssueListParams =
  RestEndpointMethodTypes['issues']['listForRepo']['parameters'];
```

Extend them via intersection if you need to annotate extra metadata.

### Scripts

All scripts under `src/scripts` must cast query results into typed arrays:

```ts
const recentCommits = await queryRows<RecentCommitRow>(`SELECT ...`);
recentCommits.forEach((row) => console.log(row.login));
```

### DTOs & Controllers

Define DTO classes with explicit properties and decorators.  
Do not rely on implicit `any` for request/response bodies.

## Escape Hatches (Use Sparingly)

- `unknown`: Accept unknown input and narrow it before use.
- `never`: Use for exhaustive switch statements.
- Type assertions (`as SomeType`) only when the invariant has just been proven.

## PR Checklist

1. `npm run lint`
2. `npm run build`
3. No `any` usages (`rg "\bany\b" src` should return zero matches)
4. Update docs/tests when you touch observable behavior

Found a repeating typing pattern? Document it here so the next contributor can follow it too.
