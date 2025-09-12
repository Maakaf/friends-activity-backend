import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { UsersSilverService } from '../normalized/user.service.js';

async function main() {
  // Boot a DI-only Nest context (no HTTP server)
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const svc = app.get(UsersSilverService);

    // You can tweak these or read from process.env/argv if you want
    const users = await svc.getUsersSince({
      sinceIso: '2024-01-01T00:00:00Z',
      // untilIso: '2025-12-31T23:59:59Z',
      // userIds: ['12345'],
      // logins: ['barlavi1', 'UrielOfir'],
      // limit: 100,
    });

    console.log(`count=${users.length}`);
    console.log(JSON.stringify(users.slice(0, 5), null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});