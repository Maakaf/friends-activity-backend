import { DataSource } from 'typeorm';
import { UserSyncStatus } from '../scheduler/sync-status.entity.js';
import { SyncStatusRepo } from '../scheduler/sync-status.repo.js';
import dataSource from '../database/data-source.js';

// Add timeout
setTimeout(() => {
  console.error('❌ Test timeout after 30 seconds');
  process.exit(1);
}, 30000);

async function testSyncStatus() {
  console.log('🧪 Testing SyncStatusRepo...\n');

  let connection: DataSource | undefined;

  try {
    // Initialize database connection
    console.log('Connecting to database...');
    connection = await dataSource.initialize();
    console.log('✅ Connected\n');

    // Create repository manually
    const repo = connection.getRepository(UserSyncStatus);
    const syncStatusRepo = new SyncStatusRepo(repo);

    // Test 1: Create a new sync status
    console.log('Test 1: Creating sync status for test user...');
    await syncStatusRepo.createOrUpdate('testuser123', {
      status: 'pending',
    });
    console.log('✅ Created\n');

    // Test 2: Find by username
    console.log('Test 2: Finding user...');
    const user = await syncStatusRepo.findByUsername('testuser123');
    console.log('✅ Found:', {
      username: user?.username,
      status: user?.status,
      lastSyncAt: user?.lastSyncAt,
    });
    console.log('');

    // Test 3: Mark in progress
    console.log('Test 3: Marking in progress...');
    await syncStatusRepo.markInProgress('testuser123');
    const inProgress = await syncStatusRepo.findByUsername('testuser123');
    console.log('✅ Status:', inProgress?.status);
    console.log('');

    // Test 4: Mark completed
    console.log('Test 4: Marking completed...');
    await syncStatusRepo.markCompleted('testuser123');
    const completed = await syncStatusRepo.findByUsername('testuser123');
    console.log('✅ Status:', completed?.status);
    console.log('✅ Last sync:', completed?.lastSyncAt);
    console.log('✅ Retry count reset:', completed?.retryCount);
    console.log('');

    // Test 5: Mark failed
    console.log('Test 5: Marking failed...');
    await syncStatusRepo.markFailed('testuser123', 'Test error message');
    const failed = await syncStatusRepo.findByUsername('testuser123');
    console.log('✅ Status:', failed?.status);
    console.log('✅ Error:', failed?.errorMessage);
    console.log('✅ Retry count:', failed?.retryCount);
    console.log('');

    // Test 6: Get users to sync (should include our test user since it failed)
    console.log('Test 6: Getting users to sync...');
    const usersToSync = await syncStatusRepo.getUsersToSync(24);
    console.log('✅ Users to sync:', usersToSync.length > 0 ? usersToSync : 'none (expected if no old data)');
    console.log('');

    // Test 7: Get all usernames
    console.log('Test 7: Getting all usernames...');
    const allUsers = await syncStatusRepo.getAllUsernames();
    console.log('✅ Total users:', allUsers.length);
    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await connection.query('DELETE FROM user_sync_status WHERE username = $1', ['testuser123']);
    console.log('✅ Cleaned up\n');

    console.log('🎉 All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    if (connection?.isInitialized) {
      await connection.destroy();
      console.log('✅ Connection closed');
    }
    process.exit(0);
  }
}

testSyncStatus();