// src/database/data-source.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';

const url = process.env.DATABASE_URL;

export const dataSource = new DataSource({
  type: 'postgres',
  url,
  // Neon requires SSL; set it explicitly (don’t rely on PG_SSL being set)
  ssl: { rejectUnauthorized: false },
  entities: [],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'typeorm_migrations',
  schema: 'public',
});
