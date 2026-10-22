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

// Existing conversations were all started through a form or an email, so they are tickets.
const KIND_AND_TYPING = '0002_conversation_kind_and_typing';
// Tiers and SLA clocks, the channel a conversation came in on, a score behind
// the rating, agent roles and the audit log. The channel and the first response
// are read back from the messages; deadlines start with the policy, not before.
const ENTERPRISE = '0003_tiers_sla_roles_audit';

const BIN = 'collate Latin1_General_100_BIN2';

/** Runs each statement on its own: SQL Server binds a new column only in a later batch. */
async function run(db: Db, statements: string[]) {
  for (const statement of statements) await sql.raw(statement).execute(db);
}

const enterprise: Record<Family, Migration> = {
  postgres: {
    up: db =>
      run(db, [
        `ALTER TABLE helpdesk.conversation
          ADD COLUMN tier text,
          ADD COLUMN channel text NOT NULL DEFAULT 'widget',
          ADD COLUMN rating_score integer,
          ADD COLUMN first_responded_at timestamp with time zone,
          ADD COLUMN respond_by timestamp with time zone,
          ADD COLUMN resolve_by timestamp with time zone,
          ADD COLUMN sla_due_at timestamp with time zone,
          ADD COLUMN sla_paused_at timestamp with time zone,
          ADD COLUMN sla_paused_seconds integer NOT NULL DEFAULT 0,
          ADD COLUMN respond_notice text,
          ADD COLUMN resolve_notice text`,
        `UPDATE helpdesk.conversation c SET channel = 'email'
          WHERE EXISTS (SELECT 1 FROM helpdesk.message m WHERE m.conversation_id = c.id
            AND m.email_message_id IS NOT NULL AND m.created_at = c.created_at)`,
        `UPDATE helpdesk.conversation c SET first_responded_at = (SELECT min(m.created_at)
          FROM helpdesk.message m WHERE m.conversation_id = c.id AND m.author_type = 'agent' AND NOT m.internal)`,
        'CREATE INDEX conversation_sla_due_idx ON helpdesk.conversation (sla_due_at)',
        `ALTER TABLE helpdesk.agent ADD COLUMN role text NOT NULL DEFAULT 'agent'`,
        `CREATE TABLE helpdesk.audit_log (
          id uuid PRIMARY KEY,
          agent_id uuid REFERENCES helpdesk.agent(id) ON DELETE SET NULL,
          action text NOT NULL,
          target text,
          data jsonb NOT NULL,
          created_at timestamp with time zone NOT NULL)`,
        'CREATE INDEX audit_log_created_idx ON helpdesk.audit_log (created_at)',
      ]),
  },
  mysql: {
    up: db =>
      run(db, [
        `ALTER TABLE helpdesk_conversation
          ADD COLUMN tier varchar(255) NULL,
          ADD COLUMN channel varchar(255) NOT NULL DEFAULT 'widget',
          ADD COLUMN rating_score int NULL,
          ADD COLUMN first_responded_at datetime(3) NULL,
          ADD COLUMN respond_by datetime(3) NULL,
          ADD COLUMN resolve_by datetime(3) NULL,
          ADD COLUMN sla_due_at datetime(3) NULL,
          ADD COLUMN sla_paused_at datetime(3) NULL,
          ADD COLUMN sla_paused_seconds int NOT NULL DEFAULT 0,
          ADD COLUMN respond_notice varchar(255) NULL,
          ADD COLUMN resolve_notice varchar(255) NULL`,
        `UPDATE helpdesk_conversation c SET channel = 'email'
          WHERE EXISTS (SELECT 1 FROM helpdesk_message m WHERE m.conversation_id = c.id
            AND m.email_message_id IS NOT NULL AND m.created_at = c.created_at)`,
        `UPDATE helpdesk_conversation c SET first_responded_at = (SELECT min(m.created_at)
          FROM helpdesk_message m WHERE m.conversation_id = c.id AND m.author_type = 'agent' AND m.internal = false)`,
        'CREATE INDEX helpdesk_conversation_sla_due_idx ON helpdesk_conversation (sla_due_at)',
        `ALTER TABLE helpdesk_agent ADD COLUMN role varchar(255) NOT NULL DEFAULT 'agent'`,
        `CREATE TABLE helpdesk_audit_log (
          id char(36) NOT NULL,
          agent_id char(36) NULL,
          action varchar(255) NOT NULL,
          target varchar(255) NULL,
          data json NOT NULL,
          created_at datetime(3) NOT NULL,
          CONSTRAINT helpdesk_audit_log_pkey PRIMARY KEY (id),
          CONSTRAINT helpdesk_audit_log_agent_id_fkey FOREIGN KEY (agent_id)
            REFERENCES helpdesk_agent(id) ON DELETE SET NULL)
          engine = InnoDB default charset = utf8mb4 collate = utf8mb4_bin`,
        'CREATE INDEX helpdesk_audit_log_created_idx ON helpdesk_audit_log (created_at)',
      ]),
  },
  sqlite: {
    up: db =>
      run(db, [
        'ALTER TABLE helpdesk_conversation ADD COLUMN tier text',
        `ALTER TABLE helpdesk_conversation ADD COLUMN channel text NOT NULL DEFAULT 'widget'`,
        'ALTER TABLE helpdesk_conversation ADD COLUMN rating_score integer',
        'ALTER TABLE helpdesk_conversation ADD COLUMN first_responded_at text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN respond_by text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN resolve_by text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN sla_due_at text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN sla_paused_at text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN sla_paused_seconds integer NOT NULL DEFAULT 0',
        'ALTER TABLE helpdesk_conversation ADD COLUMN respond_notice text',
        'ALTER TABLE helpdesk_conversation ADD COLUMN resolve_notice text',
        `UPDATE helpdesk_conversation SET channel = 'email'
          WHERE EXISTS (SELECT 1 FROM helpdesk_message m WHERE m.conversation_id = helpdesk_conversation.id
            AND m.email_message_id IS NOT NULL AND m.created_at = helpdesk_conversation.created_at)`,
        `UPDATE helpdesk_conversation SET first_responded_at = (SELECT min(m.created_at)
          FROM helpdesk_message m WHERE m.conversation_id = helpdesk_conversation.id
            AND m.author_type = 'agent' AND m.internal = 0)`,
        'CREATE INDEX helpdesk_conversation_sla_due_idx ON helpdesk_conversation (sla_due_at)',
        `ALTER TABLE helpdesk_agent ADD COLUMN role text NOT NULL DEFAULT 'agent'`,
        `CREATE TABLE helpdesk_audit_log (
          id text NOT NULL,
          agent_id text NULL,
          action text NOT NULL,
          target text NULL,
          data text NOT NULL,
          created_at text NOT NULL,
          CONSTRAINT helpdesk_audit_log_pkey PRIMARY KEY (id),
          CONSTRAINT helpdesk_audit_log_agent_id_fkey FOREIGN KEY (agent_id)
            REFERENCES helpdesk_agent(id) ON DELETE SET NULL)`,
        'CREATE INDEX helpdesk_audit_log_created_idx ON helpdesk_audit_log (created_at)',
      ]),
  },
  mssql: {
    up: db =>
      run(db, [
        `ALTER TABLE helpdesk.conversation ADD
          tier nvarchar(255) ${BIN} NULL,
          channel nvarchar(255) ${BIN} NOT NULL CONSTRAINT conversation_channel_default DEFAULT 'widget',
          rating_score int NULL,
          first_responded_at datetime2(3) NULL,
          respond_by datetime2(3) NULL,
          resolve_by datetime2(3) NULL,
          sla_due_at datetime2(3) NULL,
          sla_paused_at datetime2(3) NULL,
          sla_paused_seconds int NOT NULL CONSTRAINT conversation_sla_paused_seconds_default DEFAULT 0,
          respond_notice nvarchar(255) ${BIN} NULL,
          resolve_notice nvarchar(255) ${BIN} NULL`,
        `UPDATE c SET channel = 'email' FROM helpdesk.conversation c
          WHERE EXISTS (SELECT 1 FROM helpdesk.message m WHERE m.conversation_id = c.id
            AND m.email_message_id IS NOT NULL AND m.created_at = c.created_at)`,
        `UPDATE c SET first_responded_at = (SELECT min(m.created_at)
          FROM helpdesk.message m WHERE m.conversation_id = c.id AND m.author_type = 'agent' AND m.internal = 0)
          FROM helpdesk.conversation c`,
        'CREATE INDEX conversation_sla_due_idx ON helpdesk.conversation (sla_due_at)',
        `ALTER TABLE helpdesk.agent ADD role nvarchar(255) ${BIN} NOT NULL CONSTRAINT agent_role_default DEFAULT 'agent'`,
        `CREATE TABLE helpdesk.audit_log (
          id nvarchar(36) ${BIN} NOT NULL,
          agent_id nvarchar(36) ${BIN} NULL,
          action nvarchar(255) ${BIN} NOT NULL,
          target nvarchar(255) ${BIN} NULL,
          data nvarchar(max) NOT NULL,
          created_at datetime2(3) NOT NULL,
          CONSTRAINT helpdesk_audit_log_pkey PRIMARY KEY (id),
          CONSTRAINT helpdesk_audit_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES helpdesk.agent(id))`,
        'CREATE INDEX helpdesk_audit_log_created_idx ON helpdesk.audit_log (created_at)',
      ]),
  },
};

export const migrations: Record<Family, Record<string, Migration>> = {
  postgres: {
    ...postgres,
    [KIND_AND_TYPING]: {
      async up(db: Db) {
        await sql`ALTER TABLE helpdesk.conversation
          ADD COLUMN kind text NOT NULL DEFAULT 'ticket',
          ADD COLUMN agent_typing_until timestamp with time zone`.execute(db);
      },
    },
    [ENTERPRISE]: enterprise.postgres,
  },
  mysql: {
    '0000_baseline': { up: (db: Db) => createBaseline(db, 'mysql') },
    [KIND_AND_TYPING]: {
      async up(db: Db) {
        await sql`ALTER TABLE helpdesk_conversation
          ADD COLUMN kind varchar(255) NOT NULL DEFAULT 'ticket',
          ADD COLUMN agent_typing_until datetime(3) NULL`.execute(db);
      },
    },
    [ENTERPRISE]: enterprise.mysql,
  },
  sqlite: {
    '0000_baseline': { up: (db: Db) => createBaseline(db, 'sqlite') },
    [KIND_AND_TYPING]: {
      async up(db: Db) {
        await sql`ALTER TABLE helpdesk_conversation ADD COLUMN kind text NOT NULL DEFAULT 'ticket'`.execute(
          db
        );
        await sql`ALTER TABLE helpdesk_conversation ADD COLUMN agent_typing_until text`.execute(
          db
        );
      },
    },
    [ENTERPRISE]: enterprise.sqlite,
  },
  mssql: {
    '0000_baseline': { up: (db: Db) => createBaseline(db, 'mssql') },
    [KIND_AND_TYPING]: {
      async up(db: Db) {
        await sql`ALTER TABLE helpdesk.conversation ADD
          kind nvarchar(255) collate Latin1_General_100_BIN2 NOT NULL
            CONSTRAINT conversation_kind_default DEFAULT 'ticket',
          agent_typing_until datetime2(3) NULL`.execute(db);
      },
    },
    [ENTERPRISE]: enterprise.mssql,
  },
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
