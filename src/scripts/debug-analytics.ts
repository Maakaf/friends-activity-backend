import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source.js';

type GoldActivityRow = {
  user_id: string;
  activity_type: string;
  total_count: string;
};

type LoginRow = { login: string };

type TimeAnalysisRow = {
  login: string;
  earliest_activity: string | null;
  latest_activity: string | null;
  total_events: string;
};

async function debugAnalytics() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    console.log('📊 Gold Layer Data:');
    const goldActivity = await dataSource.query(`
      SELECT 
        user_id,
        activity_type,
        SUM(activity_count) as total_count
      FROM gold.user_activity ua
      JOIN bronze.github_repos r ON ua.repo_id = r.repo_node
      WHERE r.full_name = 'Maakaf/friends-activity-backend'
      GROUP BY user_id, activity_type
      ORDER BY total_count DESC
    `);

    console.log('Gold Activity:');
    for (const row of goldActivity) {
      const [user] = await dataSource.query(
        'SELECT login FROM bronze.github_users WHERE user_node = $1',
        [row.user_id],
      );
      const login = user?.login ?? row.user_id;
      console.log(`  ${login}: ${row.total_count} ${row.activity_type}`);
    }

    console.log('\n📊 Time Range Analysis:');
    const timeAnalysis = await dataSource.query(`
      SELECT 
        u.login,
        MIN(e.created_at) as earliest_activity,
        MAX(e.created_at) as latest_activity,
        COUNT(*) as total_events
      FROM bronze.github_events e
      JOIN bronze.github_users u ON e.actor_user_node = u.user_node
      JOIN bronze.github_repos r ON e.repo_node = r.repo_node
      WHERE r.full_name = 'Maakaf/friends-activity-backend'
        AND e.event_type = 'commit'
      GROUP BY u.login
      ORDER BY total_events DESC
    `);

    console.log('Time Range for Commits:');
    timeAnalysis.forEach((row) => {
      console.log(
        `  ${row.login}: ${row.total_events} commits (${row.earliest_activity} to ${row.latest_activity})`,
      );
    });

    await dataSource.destroy();
    console.log('✅ Debug completed');
  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

debugAnalytics();
