import { createHash } from 'node:crypto';

import { type Kysely, sql } from 'kysely';
import { type Migration, Migrator } from 'kysely/migration';

import { createBaseline } from './baseline';
import type { Family, KyselyAdapter } from './kysely';
import { postgresBaseline } from './postgres-baseline';

// biome-ignore lint/suspicious/noExplicitAny: migrations work on tables the model describes, not typed ones
type Db = Kysely<any>;

const postgres: Record<string, Migration> = {
  // Installs from before the adapters ran these through drizzle, which kept
  // `helpdesk.__migrations`: only the ones newer than its last row run.
  '0000_baseline': {
    async up(db: Db) {
      await sql`CREATE SCHEMA IF NOT EXISTS helpdesk`.execute(db);
      await sql`CREATE TABLE IF NOT EXISTS helpdesk.__migrations (
        id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`.execute(
        db
      );
      const { rows } = await sql<{ last: string | null }>`
        SELECT max(created_at)::text AS last FROM helpdesk.__migrations`.execute(
        db
      );
      const last = Number(rows[0]?.last ?? 0);
      for (const migration of postgresBaseline) {
        if (migration.when <= last) continue;
        for (const statement of migration.sql.split(
          '--> statement-breakpoint'
        )) {
          if (statement.trim()) await sql.raw(statement).execute(db);
        }
        await sql`INSERT INTO helpdesk.__migrations (hash, created_at) VALUES (${createHash(
          'sha256'
        )
          .update(migration.sql)
          .digest('hex')}, ${migration.when})`.execute(db);
      }
    },
  },
  '0001_tags_and_counter': {
    async up(db: Db) {
      for (const [owner, model] of [
        ['conversation_id', 'conversation'],
        ['contact_id', 'contact'],
        ['company_id', 'company'],
      ] as const) {
        await sql
          .raw(`CREATE TABLE helpdesk.${model}_tag (
            ${owner} uuid NOT NULL REFERENCES helpdesk.${model}(id) ON DELETE CASCADE,
            tag text NOT NULL,
            position integer NOT NULL,
            PRIMARY KEY (${owner}, tag))`)
          .execute(db);
        await sql
          .raw(
            `CREATE INDEX ${model}_tag_tag_idx ON helpdesk.${model}_tag (tag)`
          )
          .execute(db);
        await sql
          .raw(`INSERT INTO helpdesk.${model}_tag (${owner}, tag, position)
            SELECT id, tag, min(position)::int - 1
            FROM helpdesk.${model}, unnest(tags) WITH ORDINALITY AS t(tag, position)
            GROUP BY id, tag`)
          .execute(db);
        await sql
          .raw(`ALTER TABLE helpdesk.${model} DROP COLUMN tags`)
          .execute(db);
      }
      await sql`CREATE TABLE helpdesk.counter (name text PRIMARY KEY, value integer NOT NULL)`.execute(
        db
      );
      // The next reference continues where the sequence stopped.
      await sql`INSERT INTO helpdesk.counter (name, value)
        SELECT 'reference', greatest(
          (SELECT CASE WHEN is_called THEN last_value + 1 ELSE last_value END FROM helpdesk.reference_seq),
          (SELECT coalesce(max(number) + 1, 1000) FROM helpdesk.conversation))`.execute(
        db
      );
    },
  },
};

export const migrations: Record<Family, Record<string, Migration>> = {
  postgres,
  mysql: {
    '0000_baseline': { up: (db: Db) => createBaseline(db, 'mysql') },
  },
  sqlite: {
    '0000_baseline': { up: (db: Db) => createBaseline(db, 'sqlite') },
  },
  mssql: {},
};

/** Brings the database up to date. Safe to run on every deploy and from several processes at once. */
export async function migrate(adapter: KyselyAdapter) {
  const { family } = adapter;
  const schema = family === 'postgres' || family === 'mssql';
  const migrator = new Migrator({
    db: adapter.kysely,
    provider: { getMigrations: async () => migrations[family] },
    ...(schema
      ? {
          migrationTableSchema: 'helpdesk',
          migrationTableName: 'migration',
          migrationLockTableName: 'migration_lock',
        }
      : {
          migrationTableName: 'helpdesk_migration',
          migrationLockTableName: 'helpdesk_migration_lock',
        }),
  });
  const { error, results } = await migrator.migrateToLatest();
  const failed = results?.find(r => r.status === 'Error');
  if (error) {
    throw failed
      ? new Error(`helpdesk: migration ${failed.migrationName} failed`, {
          cause: error,
        })
      : error;
  }
  return (results ?? []).map(r => r.migrationName);
}
