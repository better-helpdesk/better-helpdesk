import { rm } from 'node:fs/promises';

import { sql } from 'kysely';
import { createConnection } from 'mysql2/promise';
import pg from 'pg';

import { migrate } from '../src/db/migrate';
import {
  mssqlTestAdapter,
  mysqlUrls,
  sqlitePath,
  testAdapter,
  testDatabaseName,
  testFamily,
} from './database';
import { testDatabaseUrl } from './database-url';

/** Gives the run an empty database at the latest migration. */
export async function setup() {
  if (testFamily === 'sqlite') {
    for (const suffix of ['', '-wal', '-shm']) {
      await rm(`${sqlitePath()}${suffix}`, { force: true });
    }
  } else if (testFamily === 'mssql') {
    const master = mssqlTestAdapter('master');
    const name = testDatabaseName();
    await sql
      .raw(
        `if db_id('${name}') is not null begin alter database [${name}] set single_user with rollback immediate; drop database [${name}] end; create database [${name}]`
      )
      .execute(master.kysely);
    await master.kysely.destroy();
  } else if (testFamily === 'mysql') {
    const { server, name } = mysqlUrls();
    const connection = await createConnection(server);
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin`
    );
    await connection.end();
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
