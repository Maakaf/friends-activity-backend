import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import dataSource from '../database/data-source.js';

async function cleanupTempUsers() {
  try {
    await dataSource.initialize();
    console.log('🔗 Database connected');

    // First, show which users will be deleted
    const tempUsers = await dataSource.query(
      "SELECT login FROM bronze.github_users WHERE user_node LIKE 'temp_%'"
    );
    
    console.log(`Found ${tempUsers.length} temp users:`, tempUsers.map((r: any) => r.login));

    // Delete users with temp_ user_node values
    const result = await dataSource.query(
      "DELETE FROM bronze.github_users WHERE user_node LIKE 'temp_%'"
    );

    console.log(`🗑️ Deleted ${result.affectedRows || tempUsers.length} temp users`);

    await dataSource.destroy();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupTempUsers();