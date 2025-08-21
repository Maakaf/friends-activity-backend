import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubModule } from './github/github.module';
import 'dotenv/config';

@Module({
    imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      ssl: { rejectUnauthorized: false },
      // Do NOT use synchronize in prod; migrations will handle schema.
      synchronize: false,
    }),
    GithubModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
