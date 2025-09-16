// src/scripts/test-prs.ts
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PRSilverService } from '../normalized/pr/pr.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const prs = await app.get(PRSilverService).getPRsSince({
    sinceIso: '2024-01-01T00:00:00Z',
    // untilIso: '2024-12-31T23:59:59Z',
  });

  console.log(`count=${prs.length}`);
  console.log(JSON.stringify(prs.slice(0, 5), null, 2));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
