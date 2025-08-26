import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { FastifyAdapter } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter());
  await app.listen(3000, '0.0.0.0');
}
bootstrap().catch(err => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
