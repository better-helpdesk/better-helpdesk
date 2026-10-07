import { randomUUID } from 'node:crypto';

import { type FieldKind, helpdeskModel, type ModelName } from './model';

export type Op =
  | 'eq'
  | 'ne'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'notIn'
  /** Substring match; `%`, `_` and the like in the value are literal. */
  | 'contains'
  | 'startsWith';

/**
 * A condition on a model's fields. `eq` and `ne` with `null` test for NULL;
 * otherwise NULL never matches, as in SQL. An empty `and` holds, an empty
 * `or` does not.
 */
export type Where =
  | { field: string; op?: Op; value: unknown; insensitive?: boolean }
  | {
      field: string;
      op: 'in' | 'notIn';
      /** The values of `field` in the rows of `model` that match `where`. */
      select: { model: ModelName; field: string; where?: Where };
    }
  | { and: Where[] }
  | { or: Where[] }
  | { not: Where }
  /** A condition only the adapter that returned it understands. */
  | { native: unknown };

export type OrderBy = {
  field: string;
  direction?: 'asc' | 'desc';
  /** Where NULLs sort; by default as the database puts them. */
  nulls?: 'first' | 'last';
};

export type FindQuery = {
  where?: Where;
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  /** Only these fields; all of them by default. */
  select?: string[];
  /** Lock the rows until the transaction ends. */
  forUpdate?: boolean;
};

export type Data = Record<string, unknown>;
/** In `updateMany`, adds to the stored number instead of replacing it. */
export type Increment = { increment: number };

/**
 * What the store needs from a database beyond the CRUD methods. Each is
 * optional: without it the store falls back to the CRUD methods, slower but
 * with the same results.
 */
export type Capabilities = {
  /** A condition on `conversation` for the inbox search box. */
  searchConversations?(query: string): Where;
  /** Conversations sharing words with `words`, best first. */
  duplicateCandidates?(
    exceptId: string,
    words: string[]
  ): Promise<
    {
      id: string;
      number: number;
      subject: string | null;
      title: string | null;
    }[]
  >;
  /** The newest message per conversation, leaving out internal notes. */
  lastMessages?(conversationIds: string[]): Promise<Data[]>;
  /** The most used conversation tags. */
  topTags?(limit: number): Promise<string[]>;
  /** Ids of contacts matching `where`, those with the latest conversation first. */
  contactIdsByActivity?(where: Where, limit: number): Promise<string[]>;
};

/** What an adapter author implements. Values arrive and leave in the forms `supports` declares. */
export type AdapterInput = {
  id: string;
  supports: {
    /** `Date` objects in and out; otherwise ISO strings. */
    dates: boolean;
    /** Booleans in and out; otherwise 1 and 0. */
    booleans: boolean;
    /** JSON values in and out; otherwise JSON text. */
    json: boolean;
  };
  create(model: ModelName, data: Data): Promise<void>;
  findMany(model: ModelName, query: FindQuery): Promise<Data[]>;
  count(model: ModelName, where?: Where): Promise<number>;
  /** Returns how many rows changed. */
  updateMany(
    model: ModelName,
    where: Where | undefined,
    set: Record<string, unknown>
  ): Promise<number>;
  /** Returns how many rows went. */
  deleteMany(model: ModelName, where: Where | undefined): Promise<number>;
  /** Runs `fn` atomically; a throw rolls everything back. */
  transaction<T>(fn: (tx: AdapterInput) => Promise<T>): Promise<T>;
  capabilities?: Capabilities;
};

/** An adapter as the store uses it: rows in their app types, defaults applied. */
export type DatabaseAdapter = {
  id: string;
  create<T = Data>(model: ModelName, data: Data): Promise<T>;
  findMany<T = Data>(model: ModelName, query?: FindQuery): Promise<T[]>;
  findOne<T = Data>(model: ModelName, query?: FindQuery): Promise<T | null>;
  count(model: ModelName, where?: Where): Promise<number>;
  updateMany(
    model: ModelName,
    where: Where | undefined,
    set: Record<string, unknown>
  ): Promise<number>;
  deleteMany(model: ModelName, where: Where | undefined): Promise<number>;
  transaction<T>(fn: (tx: DatabaseAdapter) => Promise<T>): Promise<T>;
  capabilities: Capabilities;
  /** The adapter as written, for migrations and tests. */
  raw: AdapterInput;
};

const kindOf = (model: ModelName, field: string): FieldKind | undefined =>
  (helpdeskModel[model].fields as Record<string, { kind: FieldKind }>)[field]
    ?.kind;

/**
 * Wraps an adapter so the store can use it: ids and defaults are set by the
 * app, and values are converted to and from the forms the adapter supports.
 */
export function createAdapter(raw: AdapterInput): DatabaseAdapter {
  const { supports } = raw;

  const write = (kind: FieldKind | undefined, value: unknown): unknown => {
    if (value === null || value === undefined) return value ?? null;
    if (kind === 'date' && !supports.dates) {
      return (
        value instanceof Date ? value : new Date(String(value))
      ).toISOString();
    }
    if (kind === 'boolean' && !supports.booleans) return value ? 1 : 0;
    if (kind === 'json' && !supports.json) return JSON.stringify(value);
    return value;
  };

  const read = (kind: FieldKind | undefined, value: unknown): unknown => {
    if (value === null || value === undefined) return null;
    switch (kind) {
      case 'date':
        return value instanceof Date ? value : new Date(value as string);
      case 'boolean':
        return typeof value === 'boolean' ? value : Boolean(Number(value));
      case 'json':
        return !supports.json && typeof value === 'string'
          ? JSON.parse(value)
          : value;
      case 'integer':
        return Number(value);
      case 'decimal':
        return String(value);
      default:
        return value;
    }
  };

  const readRow = (model: ModelName, row: Data): Data => {
    const out: Data = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = read(kindOf(model, key), value);
    }
    return out;
  };

  const whereFor = (model: ModelName, where: Where | undefined) =>
    where && convertWhere(model, where);

  function convertWhere(model: ModelName, where: Where): Where {
    if ('and' in where)
      return { and: where.and.map(w => convertWhere(model, w)) };
    if ('or' in where) return { or: where.or.map(w => convertWhere(model, w)) };
    if ('not' in where) return { not: convertWhere(model, where.not) };
    if ('native' in where) return where;
    if ('select' in where) {
      return {
        ...where,
        select: {
          ...where.select,
          where: whereFor(where.select.model, where.select.where),
        },
      };
    }
    const kind = kindOf(model, where.field);
    if (where.op === 'contains' || where.op === 'startsWith') return where;
    if (where.op === 'in' || where.op === 'notIn') {
      const values = (where.value as unknown[]).map(v => write(kind, v));
      if (values.length === 0)
        return where.op === 'in' ? { or: [] } : { and: [] };
      return { ...where, value: values };
    }
    return { ...where, value: write(kind, where.value) };
  }

  function wrap(input: AdapterInput): DatabaseAdapter {
    const adapter: DatabaseAdapter = {
      id: input.id,
      raw: input,
      async create<T>(model: ModelName, data: Data) {
        const row: Data = {};
        for (const [key, spec] of Object.entries(
          helpdeskModel[model].fields as Record<
            string,
            { kind: FieldKind; nullable: boolean; default?: unknown }
          >
        )) {
          let value = data[key];
          if (value === undefined) {
            value =
              spec.default === 'uuid'
                ? randomUUID()
                : spec.default === 'now'
                  ? new Date()
                  : spec.default !== undefined
                    ? structuredClone(spec.default)
                    : null;
          }
          row[key] = value;
        }
        const stored: Data = {};
        for (const [key, value] of Object.entries(row)) {
          stored[key] = write(kindOf(model, key), value);
        }
        await input.create(model, stored);
        return row as T;
      },
      async findMany<T>(model: ModelName, query: FindQuery = {}) {
        const rows = await input.findMany(model, {
          ...query,
          where: whereFor(model, query.where),
        });
        return rows.map(r => readRow(model, r)) as T[];
      },
      async findOne<T>(model: ModelName, query: FindQuery = {}) {
        const [row] = await adapter.findMany<T>(model, { ...query, limit: 1 });
        return row ?? null;
      },
      async count(model, where) {
        return Number(await input.count(model, whereFor(model, where)));
      },
      async updateMany(model, where, set) {
        const stored: Data = {};
        for (const [key, value] of Object.entries(set)) {
          if (value === undefined) continue;
          stored[key] = isIncrement(value)
            ? value
            : write(kindOf(model, key), value);
        }
        if (Object.keys(stored).length === 0) return 0;
        return input.updateMany(model, whereFor(model, where), stored);
      },
      async deleteMany(model, where) {
        return input.deleteMany(model, whereFor(model, where));
      },
      transaction(fn) {
        return input.transaction(tx => fn(wrap(tx)));
      },
      capabilities: {
        ...input.capabilities,
        ...(input.capabilities?.lastMessages && {
          lastMessages: async ids =>
            ((await input.capabilities?.lastMessages?.(ids)) ?? []).map(r =>
              readRow('message', r)
            ),
        }),
      },
    };
    return adapter;
  }

  return wrap(raw);
}

export const isIncrement = (value: unknown): value is Increment =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Date) &&
  Object.keys(value).length === 1 &&
  typeof (value as Increment).increment === 'number';
