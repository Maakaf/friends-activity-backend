export const MIN_FORK_COUNT = 3;

// GitHub's GraphQL caps. contributionsCollection's *ByRepository fields
// return at most MAX_REPOSITORIES entries; pagination connections we use
// fetch PAGE_SIZE nodes per call. Used both in queries and in overflow
// detection in daily-contributions.ts.
export const MAX_REPOSITORIES = 100;
export const PAGE_SIZE = 100;
