import 'dotenv/config';
import { Client } from 'pg';

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // ssl: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
  });
  await client.connect();

  const schemas = await client.query(
    `select schema_name from information_schema.schemata where schema_name in ('bronze','gold') order by 1`
  );
  console.log('Schemas:', schemas.rows);

  const tables = await client.query(
    `select table_schema, table_name from information_schema.tables where table_schema in ('bronze','gold') order by 1,2`
  );
  console.log('Tables:', tables.rows);

  await client.end();
})();
    