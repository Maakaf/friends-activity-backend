import 'reflect-metadata';
import 'dotenv/config';
import dataSource from '../database/data-source.js';

type TempUserRow = { login: string };

type DeleteResult =
  | { affectedRows?: number }
  | { rowCount?: number }
  | Record<string, unknown>;

function getAffectedCount(result: DeleteResult, fallback: number): number {
  if (typeof (result as { affectedRows?: number }).affectedRows === 'number') {
    return (result as { affectedRows: number }).affectedRows;
  }
  if (typeof (result as { rowCount?: number }).rowCount === 'number') {
    return (result as { rowCount: number }).rowCount;
  }
  return fallback;
}

async function cleanupTempUsers() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    // First, show which users will be deleted
    const tempUsers: TempUserRow[] = await dataSource.query(
      "SELECT login FROM bronze.github_users WHERE user_node LIKE 'temp_%'",
    );

    console.log(
      `Found ${tempUsers.length} temp users:`,
      tempUsers.map((r) => r.login),
    );

    if (!tempUsers.length) {
      console.log('No temp users to delete.');
      await dataSource.destroy();
      return;
    }

    // Delete users with temp_ user_node values
    const result: DeleteResult = await dataSource.query(
      "DELETE FROM bronze.github_users WHERE user_node LIKE 'temp_%'",
    );

    const deletedCount = getAffectedCount(result, tempUsers.length);
    console.log(`🗑️ Deleted ${deletedCount} temp users`);

    await dataSource.destroy();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

void cleanupTempUsers();
