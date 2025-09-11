import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CommitSilverService } from '../normalized/commit.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const svc = app.get(CommitSilverService);
  const commits = await svc.getCommitsSince({
    sinceIso: '2024-01-01T00:00:00Z',
    // untilIso: '2024-12-31T23:59:59Z',
    // repoId: '123456',
    // authorUserIds: ['111','222'],
  });

  console.log(`count=${commits.length}`);
  console.log(JSON.stringify(commits.slice(0, 5), null, 2));

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
