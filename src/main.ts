import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new FastifyAdapter(), {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Friends Activity API')
    .setDescription('Endpoint for GitHub Data')
    .setVersion('1.0.0')
    .addApiKey(
      { type: 'apiKey', name: 'X-API-Key', in: 'header' },
      'X-API-Key',  // Changed from 'api-key' to match the header name
    )
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, doc);

  await app.listen(3000, '0.0.0.0');

  const environment = process.env.NODE_ENV || 'development';
  const authStatus = environment === 'production' ? '🔒 API Key Required' : '🔓 Open Access';
  
  console.log('📚 Swagger documentation: http://localhost:3000/docs');
  console.log(`🌍 Environment: ${environment}`);
  console.log(`🔐 Authentication: ${authStatus}`);
}
bootstrap().catch(err => {
  console.error('Application failed to start:', err);
  process.exit(1);
});
