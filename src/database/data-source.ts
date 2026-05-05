import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';
import { fileURLToPath } from 'url';
import path from 'path';

import { InitSchemas1755604729706 } from './migrations/1755604729706-InitSchemas.js';
import { AddUserProfile1755614062187 } from './migrations/1755614062187-AddUserProfile.js';
import { AddBronzeUsersAndRepos1755615000000 } from './migrations/1755615000000-AddBronzeUsersAndRepos.js';
import { AddGoldRepository1755616000000 } from './migrations/1755616000000-AddGoldRepository.js';
import { AddProcessingStatusToUsers1755617000000 } from './migrations/1755617000000-AddProcessingStatusToUsers.js';
import { AddProcessingQueue1755618000000 } from './migrations/1755618000000-AddProcessingQueue.js';
import { AddMissingFields1755620000000 } from './migrations/1755620000000-AddMissingFields.js';
import { AddOwnerUserIdToRepository1755625000000 } from './migrations/1755625000000-AddOwnerUserIdToRepository.js';
import { AddLastSyncedAtToUsers1755630000000 } from './migrations/1755630000000-AddLastSyncedAtToUsers.js';
import { CreateGraphqlPipelineTables1755900000000 } from './migrations/1755900000000-CreateGraphqlPipelineTables.js';
import { AddUserRollingActivity1756000000000 } from './migrations/1756000000000-AddUserRollingActivity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

const entitiesArr: string[] = [
  path.join(__dirname, '..', 'raw', '**', '*.entity.{ts,js}'),
  path.join(__dirname, '..', 'analytics', '**', '*.entity.{ts,js}'),
  path.join(__dirname, 'entities', '**', '*.entity.{ts,js}'),
];

const ssl =
  process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false };

const dataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  ssl,

  entities: entitiesArr,

  migrations: [
    InitSchemas1755604729706,
    AddUserProfile1755614062187,
    AddBronzeUsersAndRepos1755615000000,
    AddGoldRepository1755616000000,
    AddProcessingStatusToUsers1755617000000,
    AddProcessingQueue1755618000000,
    AddMissingFields1755620000000,
    AddOwnerUserIdToRepository1755625000000,
    AddLastSyncedAtToUsers1755630000000,
    CreateGraphqlPipelineTables1755900000000,
    AddUserRollingActivity1756000000000,
  ],
  migrationsTableName: 'typeorm_migrations',
  schema: 'public',
  logging: false,
});

export default dataSource;
