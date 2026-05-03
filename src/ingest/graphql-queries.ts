import { MAX_REPOSITORIES, PAGE_SIZE } from './constants.js';

export const USER_ACTIVITY_QUERY = `
query UserActivity($login: String!, $since: DateTime!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    id databaseId login name avatarUrl url bio location company
    websiteUrl twitterUsername createdAt
    followers { totalCount }
    following { totalCount }
    repositories(privacy: PUBLIC) { totalCount }
    contributionsCollection(from: $since) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
      totalRepositoriesWithContributedPullRequests
      totalRepositoriesWithContributedIssues
      totalRepositoriesWithContributedPullRequestReviews
      commitContributionsByRepository(maxRepositories: ${MAX_REPOSITORIES}) {
        repository { id databaseId nameWithOwner }
        contributions(first: ${PAGE_SIZE}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt commitCount }
        }
      }
      pullRequestContributionsByRepository(maxRepositories: ${MAX_REPOSITORIES}) {
        repository { id databaseId nameWithOwner }
        contributions(first: ${PAGE_SIZE}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt }
        }
      }
      issueContributionsByRepository(maxRepositories: ${MAX_REPOSITORIES}) {
        repository { id databaseId nameWithOwner }
        contributions(first: ${PAGE_SIZE}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt }
        }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: ${MAX_REPOSITORIES}) {
        repository { id databaseId nameWithOwner }
        contributions(first: ${PAGE_SIZE}) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { occurredAt }
        }
      }
    }
    issueComments(last: ${PAGE_SIZE}) {
      totalCount
      pageInfo { hasPreviousPage startCursor }
      nodes {
        createdAt
        repository { id databaseId nameWithOwner }
        issue { id }
        pullRequest { id }
      }
    }
  }
}`;

export const USER_COMMENTS_PAGE_QUERY = `
query UserCommentsPage($login: String!, $before: String!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    issueComments(last: ${PAGE_SIZE}, before: $before) {
      totalCount
      pageInfo { hasPreviousPage startCursor }
      nodes {
        createdAt
        repository { id databaseId nameWithOwner }
        issue { id }
        pullRequest { id }
      }
    }
  }
}`;

export const REPO_METADATA_QUERY = `
query RepoMetadata($ids: [ID!]!) {
  rateLimit { limit cost remaining resetAt }
  nodes(ids: $ids) {
    ... on Repository {
      id
      databaseId
      nameWithOwner
      description
      url
      forkCount
      isPrivate
      stargazerCount
      primaryLanguage { name color }
      licenseInfo { name spdxId }
      repositoryTopics(first: ${PAGE_SIZE}) {
        pageInfo { hasNextPage endCursor }
        nodes { topic { name } }
      }
    }
  }
}`;

export const REPO_TOPICS_PAGE_QUERY = `
query RepoTopicsPage($id: ID!, $after: String!) {
  rateLimit { limit cost remaining resetAt }
  node(id: $id) {
    ... on Repository {
      repositoryTopics(first: ${PAGE_SIZE}, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { topic { name } }
      }
    }
  }
}`;

export const REPOS_CONTRIBUTED_TO_QUERY = `
query ReposContributedTo(
  $login: String!,
  $types: [RepositoryContributionType!],
  $after: String
) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    repositoriesContributedTo(
      first: ${PAGE_SIZE},
      after: $after,
      contributionTypes: $types,
      includeUserRepositories: true
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { id databaseId nameWithOwner forkCount }
    }
  }
}`;

export const USER_PR_REVIEWS_QUERY = `
query UserPRReviews($login: String!, $since: DateTime!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestReviewContributions(first: ${PAGE_SIZE}) {
        pageInfo { hasNextPage endCursor }
        nodes {
          pullRequestReview {
            createdAt
            repository { id databaseId nameWithOwner }
            comments { totalCount }
          }
        }
      }
    }
  }
}`;

export const REPO_COMMITS_HISTORY_QUERY = `
query RepoCommitsHistory(
  $owner: String!,
  $name: String!,
  $since: GitTimestamp!,
  $authorId: ID!,
  $after: String
) {
  rateLimit { limit cost remaining resetAt }
  repository(owner: $owner, name: $name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(since: $since, author: { id: $authorId }, first: ${PAGE_SIZE}, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes { committedDate }
          }
        }
      }
    }
  }
}`;

export const FLAT_PR_CONTRIBUTIONS_QUERY = `
query FlatPRContributions($login: String!, $since: DateTime!, $after: String) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestContributions(first: ${PAGE_SIZE}, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { occurredAt pullRequest { repository { nameWithOwner forkCount } } }
      }
    }
  }
}`;

export const FLAT_ISSUE_CONTRIBUTIONS_QUERY = `
query FlatIssueContributions($login: String!, $since: DateTime!, $after: String) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      issueContributions(first: ${PAGE_SIZE}, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { occurredAt issue { repository { nameWithOwner forkCount } } }
      }
    }
  }
}`;

export const FLAT_REVIEW_CONTRIBUTIONS_QUERY = `
query FlatReviewContributions($login: String!, $since: DateTime!, $after: String) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestReviewContributions(first: ${PAGE_SIZE}, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes { occurredAt pullRequestReview { repository { nameWithOwner forkCount } } }
      }
    }
  }
}`;

export const USER_PR_REVIEWS_PAGE_QUERY = `
query UserPRReviewsPage($login: String!, $since: DateTime!, $after: String!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestReviewContributions(first: ${PAGE_SIZE}, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          pullRequestReview {
            createdAt
            repository { id databaseId nameWithOwner }
            comments { totalCount }
          }
        }
      }
    }
  }
}`;
