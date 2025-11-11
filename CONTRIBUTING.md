# Contributing

Thanks for helping keep Friends Activity healthy! This repo runs in full TypeScript strict mode and blocks explicit `any`. Please read the guidelines below before opening a PR.

## Getting Started

1. Install Node.js 20+.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in the required values (GitHub token, DB connection, etc.).

## Branch Flow

1. Create an issue (or pick an existing one) and branch from `main` using `issue-<id>/<short-name>`.
2. Keep commits focused; include tests/docs with behavior changes.
3. Before opening a PR, run:
   - `npm run lint`
   - `npm run build`
   - Relevant `npm run test*` commands

## Type Safety Policy

- `tsconfig.json` enforces `"strict": true` + `"noImplicitAny": true`.
- ESLint treats `@typescript-eslint/no-explicit-any` as an error.
- The Husky pre-commit hook lints staged TypeScript files (`npx eslint --max-warnings=0`).
- Use typed helpers for raw DB queries (see `queryRows<T>()` in `GithubService`) and prefer `unknown` + narrowing over `any`.
- Common patterns and row types live in `docs/type-safety.md`. Update that doc whenever you add a new pattern so the next contributor can reuse it.

## Tests & Static Analysis

- Add or update tests when touching business logic (Jest for unit tests, scripts under `src/scripts` for manual verification).
- Lint fixes must pass locally; CI will block changes otherwise.

Need help? Open a discussion or tag a maintainer in your issue/PR. Happy hacking! 
