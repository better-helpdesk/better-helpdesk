import pg from 'pg';

import { migrate } from '../src/db/migrate';
import { testAdapter } from './database';
import { testDatabaseUrl } from './database-url';

export async function setup() {
  const url = new URL(testDatabaseUrl());
  const name = url.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name]
    );
    if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  } finally {
    await client.end();
  }
  const { builtIn, close } = testAdapter();
  try {
    await migrate(builtIn);
  } finally {
    await close();
  }
}
