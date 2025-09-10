import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { IssueSilverService } from '../normalized/issue.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const service = app.get(IssueSilverService);

  const issues = await service.getIssuesSince({
    sinceIso: '2025-01-01T00:00:00Z',   // adjust window
    untilIso: '2025-12-31T23:59:59Z',
  });

  console.log(JSON.stringify(issues, null, 2));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
