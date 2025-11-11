import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source.js';

type RepoAnalysisRow = {
  login: string;
  pr_count: string;
  commit_count: string;
  pr_commit_count: string;
  direct_commit_count: string;
};

type DuplicateCommitRow = {
  sha: string;
  count: string;
  ulids: string[];
  targets: (string | null)[];
};

async function debugPRCommits() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    const repoAnalysis = await queryRows<RepoAnalysisRow>(`
      SELECT 
        u.login,
        COUNT(CASE WHEN e.event_type = 'pull_request' THEN 1 END) as pr_count,
        COUNT(CASE WHEN e.event_type = 'commit' THEN 1 END) as commit_count,
        COUNT(CASE WHEN e.event_type = 'commit' AND e.target_node IS NOT NULL THEN 1 END) as pr_commit_count,
        COUNT(CASE WHEN e.event_type = 'commit' AND e.target_node IS NULL THEN 1 END) as direct_commit_count
      FROM bronze.github_events e
      JOIN bronze.github_users u ON e.actor_user_node = u.user_node
      JOIN bronze.github_repos r ON e.repo_node = r.repo_node
      WHERE r.full_name = 'Maakaf/friends-activity-backend'
      GROUP BY u.login
      ORDER BY pr_count DESC
    `);

    console.log('📊 PR vs Commit Analysis for friends-activity-backend:');
    repoAnalysis.forEach((row) => {
      console.log(`  ${row.login}:`);
      console.log(`    PRs: ${row.pr_count}`);
      console.log(`    Total Commits: ${row.commit_count}`);
      console.log(`    PR Commits: ${row.pr_commit_count}`);
      console.log(`    Direct Commits: ${row.direct_commit_count}`);
      console.log('');
    });

    const duplicateCommits = await queryRows<DuplicateCommitRow>(`
      SELECT 
        provider_event_id as sha,
        COUNT(*) as count,
        array_agg(event_ulid) as ulids,
        array_agg(target_node) as targets
      FROM bronze.github_events 
      WHERE event_type = 'commit'
        AND repo_node IN (SELECT repo_node FROM bronze.github_repos WHERE full_name = 'Maakaf/friends-activity-backend')
      GROUP BY provider_event_id
      HAVING COUNT(*) > 1
    `);

    console.log('🔍 Duplicate commit SHAs:');
    if (duplicateCommits.length === 0) {
      console.log('  No duplicates found');
    } else {
      duplicateCommits.forEach((row) => {
        console.log(`  SHA: ${row.sha} (${row.count} times)`);
        console.log(`    ULIDs: ${row.ulids.join(', ')}`);
        console.log(`    Targets: ${row.targets.join(', ')}`);
      });
    }

    await dataSource.destroy();
    console.log('✅ Debug completed');
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

void debugPRCommits();

function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return dataSource.query(sql, params);
}
