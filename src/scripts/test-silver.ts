import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log('🔄 Building Silver bundle (this may take a moment)...');

    const silver = await app.get(SilverOrchestratorService).buildBundle({
      sinceIso: '2025-01-01T00:00:00Z',
      // untilIso: '2025-09-12T00:00:00Z',
      // limit: 200,
    });

    console.log('✅ Silver bundle built successfully.');
    console.log(`📊 Counts:
      users:    ${silver.users?.length ?? 0}
      repos:    ${silver.repos?.length ?? 0}
      issues:   ${silver.issues.length}
      prs:      ${silver.prs.length}
      comments: ${silver.comments.length}
      commits:  ${silver.commits.length}`);

    // Show a small preview of each dataset:
    console.log('\n👤 First 2 Users:');
    console.log(JSON.stringify(silver.users?.slice(0, 2) ?? [], null, 2));

    console.log('\n📦 First 2 Repos:');
    console.log(JSON.stringify(silver.repos?.slice(0, 2) ?? [], null, 2));

    console.log('\n🔧 First 2 PRs:');
    console.log(JSON.stringify(silver.prs.slice(0, 2), null, 2));

    console.log('\n📝 First 2 Issues:');
    console.log(JSON.stringify(silver.issues.slice(0, 2), null, 2));

    console.log('\n💬 First 2 Comments:');
    console.log(JSON.stringify(silver.comments.slice(0, 2), null, 2));

    console.log('\n✅ First 2 Commits:');
    console.log(JSON.stringify(silver.commits.slice(0, 2), null, 2));

    // Example aggregation to prove we can work with the bundle
    const prCountByUser = silver.prs.reduce<Record<string, number>>((acc, pr) => {
      if (!pr.authorUserId) return acc;
      acc[pr.authorUserId] = (acc[pr.authorUserId] ?? 0) + 1;
      return acc;
    }, {});
    console.log('\n📈 Aggregation Example: PR count by user');
    console.log(prCountByUser);

  } finally {
    await app.close();
    console.log('\n🏁 Done. Application context closed.');
  }
}

main().catch((e) => { 
  console.error('❌ Error while building Silver bundle:', e);
  process.exit(1);
});
