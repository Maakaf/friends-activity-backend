import type { PR, Repository } from './types.js';

export interface MergedForkPR {
  prId: string;
  forkRepoId: string;
  parentRepoId: string;
  authorUserId: string | null;
  mergedAt: string;
  commits: string[];
}

/**
 * Analyzes PRs and repos to identify merged PRs from forks to parent repos
 */
export class ForkPRAnalyzer {
  
  /**
   * Find PRs that were merged from fork repos to their parent repos
   */
  static findMergedForkPRs(prs: PR[], repos: Repository[]): MergedForkPR[] {
    // Create repo lookup maps
    const repoById = new Map<string, Repository>();
    const forksByParent = new Map<string, Repository[]>();
    
    for (const repo of repos) {
      repoById.set(repo.repoId, repo);
      
      if (repo.parentRepoId) {
        if (!forksByParent.has(repo.parentRepoId)) {
          forksByParent.set(repo.parentRepoId, []);
        }
        forksByParent.get(repo.parentRepoId)!.push(repo);
      }
    }
    
    const mergedForkPRs: MergedForkPR[] = [];
    
    for (const pr of prs) {
      // Skip if not merged
      if (!pr.mergedAt || !pr.repoId) continue;
      
      const targetRepo = repoById.get(pr.repoId);
      if (!targetRepo) continue;
      
      // Check if this PR targets a repo that has forks
      const forks = forksByParent.get(targetRepo.repoId);
      if (!forks || forks.length === 0) continue;
      
      // For now, we'll identify these PRs but we need more info to determine
      // which fork they came from. This would typically require checking
      // the PR's head.repo vs base.repo in the GitHub API data.
      
      // TODO: This is a simplified version. In a real implementation,
      // we'd need to check the PR's source repo (head.repo) vs target repo (base.repo)
      // For now, we'll mark this as a potential fork PR if the target has forks
      
      mergedForkPRs.push({
        prId: pr.prId,
        forkRepoId: '', // TODO: Need to determine source repo
        parentRepoId: targetRepo.repoId,
        authorUserId: pr.authorUserId,
        mergedAt: pr.mergedAt,
        commits: pr.commits || [],
      });
    }
    
    return mergedForkPRs;
  }
}