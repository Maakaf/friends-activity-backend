// src/database/data-source.ts
import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const DATABASE_URL = process.env.DATABASE_URL;

const migrationsGlob = isProd
  ? path.join(__dirname, 'migrations', '*.js')
  : path.join(__dirname, 'migrations', '*.ts');

const entitiesArr: string[] = [
  // Raw entities
  path.join(__dirname, '..', 'raw', '**', '*.entity.{ts,js}'),
  // Curated entities
  path.join(__dirname, '..', 'analytics', '**', '*.entity.{ts,js}'),
];

const dataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  ssl: { rejectUnauthorized: false },

  entities: entitiesArr,

  migrations: [migrationsGlob],
  migrationsTableName: 'typeorm_migrations',
  schema: 'public',
  logging: false,
});

export default dataSource;
