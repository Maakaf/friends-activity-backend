import 'dotenv/config';
import { writeFileSync } from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { GithubService } from '../raw/raw.service.js';
import { SilverOrchestratorService } from '../normalized/orchestrator.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    console.log('🔄 Running raw layer ingestion...');

    const githubService = app.get(GithubService);
    const ingestResult = await githubService.ingestEachUserInTheirRepos(
      ['barlavi1', 'UrielOfir', 'Lidor57'],
      '2025-01-01T00:00:00Z',
    );

    console.log('✅ Raw layer complete. Running normalized layer...');

    const silver = app.get(SilverOrchestratorService);
    const silverBundle = await silver.buildBundle({
      sinceIso: ingestResult.since,
      untilIso: ingestResult.until,
    });

    console.log('✅ Normalized layer complete. Writing to file...');

    const output = {
      metadata: {
        timestamp: new Date().toISOString(),
        since: ingestResult.since,
        until: ingestResult.until,
        counts: {
          users: silverBundle.users?.length || 0,
          repos: silverBundle.repos?.length || 0,
          issues: silverBundle.issues?.length || 0,
          prs: silverBundle.prs?.length || 0,
          comments: silverBundle.comments?.length || 0,
          commits: silverBundle.commits?.length || 0,
        },
      },
      data: silverBundle,
    };

    writeFileSync('normalized-output.json', JSON.stringify(output, null, 2));
    console.log('✅ Normalized data written to normalized-output.json');
  } finally {
    await app.close();
    console.log('🏁 Done.');
  }
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
