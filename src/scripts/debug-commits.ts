import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source.js';

type CountRow = { count: string };
type CommitByUserRow = { login: string; commit_count: string };
type RecentCommitRow = CommitByUserRow & {
  earliest: string | null;
  latest: string | null;
};

async function debugCommits() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    // Check total commits in bronze
    const totalCommits = await dataSource.query(
      "SELECT COUNT(*) as count FROM bronze.github_events WHERE event_type = 'commit'",
    );
    console.log(`📊 Total commits in bronze: ${totalCommits[0]?.count ?? '0'}`);

    // Check commits by user
    const commitsByUser = await dataSource.query(`
      SELECT 
        u.login,
        COUNT(*) as commit_count
      FROM bronze.github_events e
      JOIN bronze.github_users u ON e.actor_user_node = u.user_node
      WHERE e.event_type = 'commit'
      GROUP BY u.login
      ORDER BY commit_count DESC
    `);

    console.log('📊 Commits by user:');
    commitsByUser.forEach((row) => {
      console.log(`  ${row.login}: ${row.commit_count} commits`);
    });

    // Check recent commits (last 7 days)
    const recentCommits = await dataSource.query(`
      SELECT 
        u.login,
        COUNT(*) as commit_count,
        MIN(e.created_at) as earliest,
        MAX(e.created_at) as latest
      FROM bronze.github_events e
      JOIN bronze.github_users u ON e.actor_user_node = u.user_node
      WHERE e.event_type = 'commit' 
        AND e.created_at >= NOW() - INTERVAL '7 days'
      GROUP BY u.login
      ORDER BY commit_count DESC
    `);

    console.log('📊 Recent commits (last 7 days):');
    recentCommits.forEach((row) => {
      console.log(
        `  ${row.login}: ${row.commit_count} commits (${row.earliest} to ${row.latest})`,
      );
    });

    await dataSource.destroy();
    console.log('✅ Debug completed');
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugCommits();
