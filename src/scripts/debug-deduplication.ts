import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source.js';

type GoldActivityRow = { day: string; activity_count: number | null };
type BronzeCommitRow = { day: string; commit_count: string };

async function debugDeduplication() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    const goldActivity = await queryRows<GoldActivityRow>(`
      SELECT 
        ua.day,
        ua.activity_type,
        ua.activity_count,
        r.full_name
      FROM gold.user_activity ua
      JOIN bronze.github_users u ON ua.user_id = u.user_node
      JOIN bronze.github_repos r ON ua.repo_id = r.repo_node
      WHERE u.login = 'Lidor57' 
        AND r.full_name = 'Maakaf/friends-activity-backend'
        AND ua.activity_type = 'commit'
      ORDER BY ua.day DESC
    `);

    console.log(
      '📊 Gold Activity for Lidor57 (commits in friends-activity-backend):',
    );
    if (goldActivity.length === 0) {
      console.log('  No commit activities found in gold layer');
    } else {
      goldActivity.forEach((row) => {
        console.log(`  ${row.day}: ${row.activity_count ?? 0} commits`);
      });
      const goldTotal = goldActivity.reduce(
        (sum, row) => sum + (row.activity_count ?? 0),
        0,
      );
      console.log(`  Total: ${goldTotal} commits`);
    }

    const bronzeCommits = await queryRows<BronzeCommitRow>(`
      SELECT 
        DATE(e.created_at) as day,
        COUNT(*) as commit_count
      FROM bronze.github_events e
      JOIN bronze.github_users u ON e.actor_user_node = u.user_node
      JOIN bronze.github_repos r ON e.repo_node = r.repo_node
      WHERE u.login = 'Lidor57' 
        AND r.full_name = 'Maakaf/friends-activity-backend'
        AND e.event_type = 'commit'
      GROUP BY DATE(e.created_at)
      ORDER BY day DESC
    `);

    console.log('\n📊 Bronze Commits for Lidor57 by day:');
    if (bronzeCommits.length === 0) {
      console.log('  No commits found in bronze layer');
    } else {
      bronzeCommits.forEach((row) => {
        console.log(`  ${row.day}: ${row.commit_count} commits`);
      });
      const bronzeTotal = bronzeCommits.reduce(
        (sum, row) => sum + Number(row.commit_count),
        0,
      );
      console.log(`  Total: ${bronzeTotal} commits`);
    }

    await dataSource.destroy();
    console.log('✅ Debug completed');
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

void debugDeduplication();

function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  return dataSource.query(sql, params);
}
