import {
  CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Expression,
  type ExpressionBuilder,
  Kysely,
  MssqlDialect,
  type MssqlDialectConfig,
  MysqlDialect,
  type MysqlPool,
  PostgresDialect,
  type PostgresPool,
  type SqlBool,
  type SqliteDatabase,
  SqliteDialect,
  sql,
  type Transaction,
} from 'kysely';

import {
  type AdapterInput,
  type Capabilities,
  createAdapter,
  type Data,
  type FindQuery,
  isIncrement,
  type Notification,
  type Where,
} from './adapter';
import { column, type FieldKind, helpdeskModel, type ModelName } from './model';

export type Family = 'postgres' | 'mysql' | 'sqlite' | 'mssql';

// biome-ignore lint/suspicious/noExplicitAny: table names are built at runtime from the model
type AnyDb = Kysely<any>;
// biome-ignore lint/suspicious/noExplicitAny: as above
type Eb = ExpressionBuilder<any, any>;

/** The tables live in a `helpdesk` schema where the database has schemas, and carry a prefix where it has not. */
export const tableName = (family: Family, model: ModelName) =>
  family === 'postgres' || family === 'mssql'
    ? `helpdesk.${model}`
    : `helpdesk_${model}`;

const fieldsOf = (model: ModelName) =>
  helpdeskModel[model].fields as Record<string, { kind: FieldKind }>;

const LIKE_ESCAPE = '!';

/** The built-in adapters: any Kysely dialect of a family Better Helpdesk knows. */
export function kyselyAdapter({
  dialect,
  family,
}: {
  dialect: Dialect;
  family: Family;
}) {
  const db: AnyDb = new Kysely({ dialect });
  const adapter = createAdapter(build(db, family, false));
  return Object.assign(adapter, { kysely: db, family });
}

export type KyselyAdapter = ReturnType<typeof kyselyAdapter>;

function build(
  db: AnyDb,
  family: Family,
  inTransaction: boolean
): AdapterInput {
  const table = (model: ModelName) => tableName(family, model);

  const toColumns = (model: ModelName, data: Data) => {
    const kinds = fieldsOf(model);
    const out: Data = {};
    for (const [key, value] of Object.entries(data)) {
      // Sent as JSON text: node-pg would send a JS array as a Postgres
      // array, and mysql2 an object as a list of assignments.
      out[column(key)] =
        (family === 'postgres' || family === 'mysql') &&
        kinds[key]?.kind === 'json' &&
        value !== null
          ? JSON.stringify(value)
          : value;
    }
    return out;
  };

  const fromColumns = (model: ModelName, row: Data) => {
    const out: Data = {};
    for (const key of Object.keys(fieldsOf(model))) {
      const value = row[column(key)];
      if (value !== undefined) out[key] = value;
    }
    return out;
  };

  const like = (value: string, prefix: boolean) => {
    const escaped = value.replace(
      family === 'mssql' ? /[!%_[]/g : /[!%_]/g,
      c => `${LIKE_ESCAPE}${c}`
    );
    return prefix ? `${escaped}%` : `%${escaped}%`;
  };

  function condition(eb: Eb, where: Where): Expression<SqlBool> {
    if ('and' in where) {
      return where.and.length === 0
        ? sql<SqlBool>`1 = 1`
        : eb.and(where.and.map(w => condition(eb, w)));
    }
    if ('or' in where) {
      return where.or.length === 0
        ? sql<SqlBool>`1 = 0`
        : eb.or(where.or.map(w => condition(eb, w)));
    }
    if ('not' in where) return eb.not(condition(eb, where.not));
    if ('native' in where) return where.native as Expression<SqlBool>;
    const ref = sql.ref(column(where.field));
    if ('select' in where) {
      const sub = db
        .selectFrom(table(where.select.model))
        .select(sql.ref(column(where.select.field)).as('v'))
        .where(inner =>
          where.select.where
            ? condition(inner, where.select.where)
            : sql<SqlBool>`1 = 1`
        );
      return eb(ref, where.op === 'in' ? 'in' : 'not in', sub);
    }
    const op = where.op ?? 'eq';
    const { value } = where;
    // ponytail: SQLite's lower() folds ASCII only, so "über" misses "Über" there; a lowercased copy of the searched text when that matters.
    const lower = (e: Expression<unknown>) =>
      where.insensitive ? eb.fn('lower', [e]) : e;
    const val = (v: unknown) =>
      where.insensitive && typeof v === 'string' ? v.toLowerCase() : v;
    switch (op) {
      case 'eq':
        return value === null
          ? eb(ref, 'is', null)
          : eb(lower(ref), '=', val(value));
      case 'ne':
        return value === null
          ? eb(ref, 'is not', null)
          : eb(lower(ref), '<>', val(value));
      case 'lt':
        return eb(ref, '<', value);
      case 'lte':
        return eb(ref, '<=', value);
      case 'gt':
        return eb(ref, '>', value);
      case 'gte':
        return eb(ref, '>=', value);
      case 'in':
      case 'notIn': {
        const values = (value as unknown[]).map(val);
        const negated = op === 'notIn' ? sql`not in` : sql`in`;
        // SQL Server takes about 2000 parameters per query: a long list goes as one JSON one.
        if (family === 'mssql' && values.length > 1000) {
          return sql<SqlBool>`${lower(ref)} ${negated} (select value from openjson(${JSON.stringify(values)}))`;
        }
        return eb(lower(ref), op === 'notIn' ? 'not in' : 'in', values);
      }
      case 'contains':
      case 'startsWith':
        return sql<SqlBool>`${lower(ref)} like ${like(
          String(val(value)),
          op === 'startsWith'
        )} escape ${sql.lit(LIKE_ESCAPE)}`;
    }
  }

  const where =
    (w: Where | undefined) =>
    (eb: Eb): Expression<SqlBool> =>
      w ? condition(eb, w) : sql<SqlBool>`1 = 1`;

  // SQL Server takes a lock as a table hint, written after the table.
  const from = (model: ModelName, forUpdate?: boolean) =>
    forUpdate && family === 'mssql'
      ? (sql`${sql.table(table(model))} with (updlock, rowlock)` as never)
      : table(model);

  function select(model: ModelName, query: FindQuery) {
    let q = db
      .selectFrom(from(model, query.forUpdate))
      .where(where(query.where));
    q = query.select
      ? q.select(query.select.map(f => sql.ref(column(f)).as(column(f))))
      : q.selectAll();
    for (const o of query.orderBy ?? []) {
      const ref = sql.ref(column(o.field));
      const dir = o.direction === 'desc' ? sql`desc` : sql`asc`;
      if (o.nulls && (family === 'mysql' || family === 'mssql')) {
        q = q.orderBy(
          sql`case when ${ref} is null then ${o.nulls === 'last' ? 1 : 0} else ${o.nulls === 'last' ? 0 : 1} end`
        );
        q = q.orderBy(sql`${ref} ${dir}`);
      } else {
        q = q.orderBy(
          o.nulls
            ? sql`${ref} ${dir} nulls ${o.nulls === 'last' ? sql`last` : sql`first`}`
            : sql`${ref} ${dir}`
        );
      }
    }
    if (family === 'mssql') {
      // SQL Server has no LIMIT: TOP without an offset, OFFSET … FETCH with one.
      if (query.offset !== undefined) {
        if (!query.orderBy?.length) q = q.orderBy(sql`(select null)`);
        q = q.offset(query.offset);
        if (query.limit !== undefined) q = q.fetch(query.limit);
      } else if (query.limit !== undefined) {
        q = q.top(query.limit);
      }
    } else {
      if (query.limit !== undefined) q = q.limit(query.limit);
      if (query.offset !== undefined) q = q.offset(query.offset);
    }
    if (query.forUpdate && (family === 'postgres' || family === 'mysql')) {
      q = q.forUpdate();
    }
    return q;
  }

  const capabilities: Capabilities = {
    async lastMessages(ids) {
      if (ids.length === 0) return [];
      const ranked = db
        .selectFrom(table('message'))
        .selectAll()
        .select(
          sql<number>`row_number() over (partition by conversation_id order by created_at desc)`.as(
            'rank_in_conversation'
          )
        )
        .where('conversation_id', 'in', ids)
        .where(
          'internal',
          '=',
          family === 'sqlite' || family === 'mssql' ? 0 : false
        );
      const rows = await db
        .selectFrom(ranked.as('ranked'))
        .selectAll()
        .where('rank_in_conversation', '=', 1)
        .execute();
      return rows.map(r => fromColumns('message', r));
    },
    async topTags(limit) {
      const rows = await db
        .selectFrom(table('conversation_tag'))
        .select(['tag', sql<number>`count(*)`.as('uses')])
        .groupBy('tag')
        .orderBy(sql`count(*)`, 'desc')
        .orderBy('tag')
        .$call(q => (family === 'mssql' ? q.top(limit) : q.limit(limit)))
        .execute();
      return rows.map(r => String(r.tag));
    },
    async contactIdsByActivity(w, limit) {
      const latest = db
        .selectFrom(table('conversation'))
        .select(['contact_id', sql`max(last_message_at)`.as('latest')])
        .groupBy('contact_id');
      const rows = await db
        .selectFrom(table('contact'))
        .leftJoin(latest.as('activity'), 'activity.contact_id', 'id')
        .select('id')
        .where(where(w))
        .orderBy(sql`case when activity.latest is null then 1 else 0 end`)
        .orderBy('activity.latest', 'desc')
        .orderBy('created_at', 'desc')
        .$call(q => (family === 'mssql' ? q.top(limit) : q.limit(limit)))
        .execute();
      return rows.map(r => String(r.id));
    },
    ...(family === 'postgres' && {
      async notificationsFor(agentId, since, limit) {
        const result = await sql<Notification>`
          WITH n AS (
            SELECT 'assigned' AS kind, e.conversation_id, e.created_at AS at, a.name AS who
            FROM helpdesk.conversation_event e
            LEFT JOIN helpdesk.agent a ON a.id = e.agent_id
            WHERE e.kind = 'assigneeId' AND e.data->>'to' = ${agentId}
              AND e.agent_id IS DISTINCT FROM ${agentId}::uuid
              AND e.created_at > ${since}
            UNION ALL
            SELECT 'mentioned', e.conversation_id, e.created_at, a.name
            FROM helpdesk.conversation_event e
            LEFT JOIN helpdesk.agent a ON a.id = e.agent_id
            WHERE e.kind = 'mentioned' AND e.data->'agentIds' ? ${agentId}
              AND e.created_at > ${since}
            UNION ALL
            SELECT 'reply', m.conversation_id, m.created_at, coalesce(ct.name, ct.email)
            FROM helpdesk.message m
            JOIN helpdesk.conversation c ON c.id = m.conversation_id
            LEFT JOIN helpdesk.contact ct ON ct.id = m.contact_id
            WHERE m.author_type = 'contact' AND NOT m.internal
              AND c.assignee_id = ${agentId}::uuid
              AND m.created_at > ${since}
              AND m.created_at > coalesce(
                (SELECT max(created_at) FROM helpdesk.conversation_event
                  WHERE conversation_id = c.id AND kind = 'assigneeId' AND data->>'to' = ${agentId}),
                c.created_at)
          )
          SELECT n.kind, n.conversation_id, c.number, coalesce(c.title, c.subject) AS subject,
            n.who, to_char(n.at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS at
          FROM n JOIN helpdesk.conversation c ON c.id = n.conversation_id
          ORDER BY n.at DESC
          LIMIT ${limit}`.execute(db);
        return result.rows.map(r => ({ ...r, number: Number(r.number) }));
      },
      searchConversations(query) {
        const q = sql`websearch_to_tsquery('simple', ${query})`;
        return {
          native: sql<SqlBool>`(search @@ ${q} or id in (select conversation_id from helpdesk.message where search @@ ${q}))`,
        };
      },
      async duplicateCandidates(exceptId, words) {
        const result = await sql<{
          id: string;
          number: number;
          subject: string | null;
          title: string | null;
        }>`
          select c.id, c.number, c.subject, c.title, max(ts_rank(m.search, q)) as rank
          from helpdesk.conversation c
          join helpdesk.message m on m.conversation_id = c.id and not m.internal,
            to_tsquery('simple', ${words.join(' | ')}) q
          where c.id <> ${exceptId}::uuid and (m.search @@ q or c.search @@ q)
          group by c.id
          order by rank desc
          limit 5`.execute(db);
        return result.rows.map(r => ({
          id: r.id,
          number: Number(r.number),
          subject: r.subject,
          title: r.title,
        }));
      },
    }),
  };

  const input: AdapterInput = {
    id: family,
    supports: {
      // tedious would send a Date as DATETIME, which rounds to 3 ms.
      dates: family !== 'sqlite' && family !== 'mssql',
      booleans: family !== 'sqlite',
      json: family === 'postgres' || family === 'mysql',
    },
    async create(model, data) {
      await db
        .insertInto(table(model))
        .values(toColumns(model, data))
        .execute();
    },
    async findMany(model, query) {
      const rows = await select(model, query).execute();
      return rows.map(r => fromColumns(model, r as Data));
    },
    async count(model, w) {
      const row = await db
        .selectFrom(table(model))
        .select(sql<number>`count(*)`.as('count'))
        .where(where(w))
        .executeTakeFirst();
      return Number(row?.count ?? 0);
    },
    async updateMany(model, w, set) {
      const values: Data = {};
      for (const [key, value] of Object.entries(toColumns(model, set))) {
        values[key] = isIncrement(value)
          ? sql`${sql.ref(key)} + ${value.increment}`
          : value;
      }
      const result = await db
        .updateTable(table(model))
        .set(values)
        .where(where(w))
        .executeTakeFirst();
      return Number(result.numUpdatedRows);
    },
    async deleteMany(model, w) {
      const result = await db
        .deleteFrom(table(model))
        .where(where(w))
        .executeTakeFirst();
      return Number(result.numDeletedRows);
    },
    transaction(fn) {
      if (inTransaction) return fn(input);
      // SQLite's default transaction takes its write lock only at the first
      // write; two that read first then deadlock instead of waiting.
      if (family === 'sqlite') {
        return db.connection().execute(async conn => {
          await sql`begin immediate`.execute(conn);
          try {
            const result = await fn(build(conn as AnyDb, family, true));
            await sql`commit`.execute(conn);
            return result;
          } catch (error) {
            await sql`rollback`.execute(conn);
            throw error;
          }
        });
      }
      return db
        .transaction()
        .execute(trx =>
          fn(build(trx as Transaction<unknown> as AnyDb, family, true))
        );
    },
    capabilities,
  };
  return input;
}

/** The Postgres adapter. It shares the host's pool and never opens its own. */
export function postgresAdapter({ pool }: { pool: PostgresPool }) {
  return kyselyAdapter({
    dialect: new PostgresDialect({ pool }),
    family: 'postgres',
  });
}

type NodeSqliteStatement = {
  columns(): unknown[];
  all(...parameters: unknown[]): unknown[];
  run(...parameters: unknown[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
  iterate(...parameters: unknown[]): IterableIterator<unknown>;
};

/** A database from `node:sqlite` or `better-sqlite3`. */
export type SqliteDatabaseInput =
  | SqliteDatabase
  | { prepare(sql: string): NodeSqliteStatement; close(): void };

// node:sqlite spreads parameters and has no `reader`; Kysely expects better-sqlite3's shape.
function asSqliteDatabase(database: SqliteDatabaseInput): SqliteDatabase {
  const probe = database.prepare('select 1') as { reader?: boolean };
  if (typeof probe.reader === 'boolean') return database as SqliteDatabase;
  const node = database as {
    prepare(sql: string): NodeSqliteStatement;
    close(): void;
  };
  return {
    close: () => node.close(),
    prepare(query) {
      const statement = node.prepare(query);
      return {
        reader: statement.columns().length > 0,
        all: parameters => statement.all(...parameters),
        run: parameters => statement.run(...parameters),
        iterate: parameters => statement.iterate(...parameters),
      };
    },
  };
}

/**
 * The SQLite adapter, over a database the host opened. It turns foreign keys
 * on, so no row points at one that is gone, and waits up to five seconds for
 * another process's write.
 */
export function sqliteAdapter({ database }: { database: SqliteDatabaseInput }) {
  return kyselyAdapter({
    dialect: new SqliteDialect({
      database: asSqliteDatabase(database),
      async onCreateConnection(connection: DatabaseConnection) {
        await connection.executeQuery(
          CompiledQuery.raw('pragma foreign_keys = on')
        );
        await connection.executeQuery(
          CompiledQuery.raw('pragma busy_timeout = 5000')
        );
        const { rows } = await connection.executeQuery<{
          foreign_keys: number;
        }>(CompiledQuery.raw('pragma foreign_keys'));
        if (Number(rows[0]?.foreign_keys) !== 1) {
          throw new Error(
            'helpdesk: SQLite refused to turn foreign keys on, so rows could point at ones that are gone'
          );
        }
      },
    }),
    family: 'sqlite',
  });
}

/**
 * The MySQL adapter, over the host's mysql2 pool (8.4 or newer). The pool
 * must be created with `timezone: 'Z'`: times are kept as UTC `DATETIME`
 * and mysql2 converts them in that zone.
 */
export function mysqlAdapter({ pool }: { pool: MysqlPool }) {
  const config = (
    pool as {
      config?: {
        connectionConfig?: {
          timezone?: string;
          dateStrings?: unknown;
          jsonStrings?: unknown;
        };
      };
    }
  ).config?.connectionConfig;
  if (
    config &&
    (!['Z', '+00:00', 'UTC'].includes(config.timezone ?? '') ||
      config.dateStrings ||
      config.jsonStrings)
  ) {
    throw new Error(
      "helpdesk: create the mysql2 pool with `timezone: 'Z'` and without `dateStrings` or `jsonStrings`, so times are stored in UTC and JSON comes back parsed"
    );
  }
  return kyselyAdapter({
    dialect: new MysqlDialect({ pool }),
    family: 'mysql',
  });
}

/**
 * The SQL Server adapter (2022 or newer), over the tedious and tarn modules
 * and the connection the host configures, as Kysely's `MssqlDialect` takes them.
 */
export function mssqlAdapter(config: MssqlDialectConfig) {
  return kyselyAdapter({ dialect: new MssqlDialect(config), family: 'mssql' });
}
