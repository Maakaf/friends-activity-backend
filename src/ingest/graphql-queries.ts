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
      commitContributionsByRepository(maxRepositories: 100) {
        repository { id databaseId nameWithOwner }
        contributions { totalCount }
      }
      pullRequestContributionsByRepository(maxRepositories: 100) {
        repository { id databaseId nameWithOwner }
        contributions { totalCount }
      }
      issueContributionsByRepository(maxRepositories: 100) {
        repository { id databaseId nameWithOwner }
        contributions { totalCount }
      }
      pullRequestReviewContributionsByRepository(maxRepositories: 100) {
        repository { id databaseId nameWithOwner }
        contributions { totalCount }
      }
    }
    issueComments(last: 100) {
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
    issueComments(last: 100, before: $before) {
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
      repositoryTopics(first: 100) {
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
      repositoryTopics(first: 100, after: $after) {
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
      first: 100,
      after: $after,
      contributionTypes: $types,
      includeUserRepositories: true
    ) {
      pageInfo { hasNextPage endCursor }
      nodes { id databaseId nameWithOwner }
    }
  }
}`;

export const USER_PR_REVIEWS_QUERY = `
query UserPRReviews($login: String!, $since: DateTime!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestReviewContributions(first: 100) {
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

export const USER_PR_REVIEWS_PAGE_QUERY = `
query UserPRReviewsPage($login: String!, $since: DateTime!, $after: String!) {
  rateLimit { limit cost remaining resetAt }
  user(login: $login) {
    contributionsCollection(from: $since) {
      pullRequestReviewContributions(first: 100, after: $after) {
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
