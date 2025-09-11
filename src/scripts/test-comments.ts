import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { CommentSilverService } from '../normalized/comment.service.js';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const service = app.get(CommentSilverService);

  const comments = await service.getCommentsSince({
    sinceIso: '2025-01-01T00:00:00Z',
    untilIso: '2025-12-31T23:59:59Z',
  });

  console.log(JSON.stringify(comments, null, 2));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
