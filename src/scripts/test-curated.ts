import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CuratedService } from '../analytics/analytics.service.js';
import { GithubService } from '../raw/raw.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    console.log('🔄 Ingesting sample data first...');
    
    const githubService = app.get(GithubService);
    await githubService.ingestEachUserInTheirRepos(['barlavi1'], '2025-01-01T00:00:00Z');
    
    console.log('✅ Sample data ingested. Running curated refresh...');

    const curatedService = app.get(CuratedService);
    await curatedService.refreshAll();

    console.log('✅ Curated refresh completed successfully!');

  } finally {
    await app.close();
    console.log('\n🏁 Done. Application context closed.');
  }
}

main().catch((e) => { 
  console.error('❌ Error while testing curated layer:', e);
  process.exit(1);
});