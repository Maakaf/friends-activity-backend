import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UserSilverService } from '../normalized/user.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const svc = app.get(UserSilverService);
  const users = await svc.getUsersByLatestActor({
    sinceIso: '2024-01-01T00:00:00Z',
    // untilIso: '2025-12-31T23:59:59Z',
    // repoId: '123456',
  });

  console.log(`count=${users.length}`);
  console.log(JSON.stringify(users.slice(0, 5), null, 2));

  await app.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
