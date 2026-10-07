import { rm } from 'node:fs/promises';

import pg from 'pg';

import { migrate } from '../src/db/migrate';
import { sqlitePath, testAdapter, testFamily } from './database';
import { testDatabaseUrl } from './database-url';

/** Gives the run an empty database at the latest migration. */
export async function setup() {
  if (testFamily === 'sqlite') {
    for (const suffix of ['', '-wal', '-shm']) {
      await rm(`${sqlitePath()}${suffix}`, { force: true });
    }
  } else {
    await createPostgresDatabase();
  }
  const { builtIn, close } = testAdapter();
  try {
    await migrate(builtIn);
  } finally {
    await close();
  }
}

async function createPostgresDatabase() {
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
}
