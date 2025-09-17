import 'dotenv/config';
import { Client } from 'pg';

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const tables = ['bronze.github_users', 'bronze.github_repos', 'bronze.github_events'];
  
  for (const table of tables) {
    try {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`${table}: ${result.rows[0].count} rows`);
    } catch (e) {
      console.log(`${table}: Error - ${e.message}`);
    }
  }

  await client.end();
})();