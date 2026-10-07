// A database adapter that keeps everything in memory, written against the
// public contract alone: no capabilities, so the store takes its portable
// path for everything. A starting point for an adapter of your own, and the
// adapter `better-helpdesk/testing` is checked against. Data is gone when the
// process ends.
import {
  type AdapterInput,
  type Data,
  type FindQuery,
  helpdeskModel,
  type ModelName,
  type OrderBy,
  type Where,
} from 'better-helpdesk/adapters';

type Table = Data[];

export function memoryAdapter(): AdapterInput {
  const tables = new Map<ModelName, Table>();
  // One operation or transaction at a time: each sees the others whole.
  let queue: Promise<unknown> = Promise.resolve();
  const serially = <T>(work: () => T | Promise<T>): Promise<T> => {
    const run = queue.then(work);
    queue = run.catch(() => undefined);
    return run;
  };

  const rows = (model: ModelName) => {
    const table = tables.get(model) ?? [];
    tables.set(model, table);
    return table;
  };

  function compare(a: unknown, b: unknown) {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  }

  // Dates arrive as ISO strings (`supports.dates` is false), so they compare as text.
  function matches(model: ModelName, row: Data, where: Where): boolean {
    if ('and' in where) return where.and.every(w => matches(model, row, w));
    if ('or' in where) return where.or.some(w => matches(model, row, w));
    if ('not' in where) return !matches(model, row, where.not);
    if ('native' in where) throw new Error('memory: no native conditions');
    const value = row[where.field] ?? null;
    if ('select' in where) {
      const { model: from, field, where: inner } = where.select;
      const found = new Set(
        rows(from)
          .filter(r => !inner || matches(from, r, inner))
          .map(r => r[field])
      );
      return value !== null && found.has(value) === (where.op === 'in');
    }
    const fold = (v: unknown) =>
      where.insensitive && typeof v === 'string' ? v.toLowerCase() : v;
    const op = where.op ?? 'eq';
    if (where.value === null) {
      if (op === 'eq') return value === null;
      if (op === 'ne') return value !== null;
    }
    // As in SQL, NULL matches nothing else.
    if (value === null) return false;
    const left = fold(value);
    switch (op) {
      case 'eq':
        return left === fold(where.value);
      case 'ne':
        return left !== fold(where.value);
      case 'lt':
        return compare(left, where.value) < 0;
      case 'lte':
        return compare(left, where.value) <= 0;
      case 'gt':
        return compare(left, where.value) > 0;
      case 'gte':
        return compare(left, where.value) >= 0;
      case 'in':
        return (where.value as unknown[]).map(fold).includes(left);
      case 'notIn':
        return !(where.value as unknown[]).map(fold).includes(left);
      case 'contains':
        return String(left).includes(String(fold(where.value)));
      case 'startsWith':
        return String(left).startsWith(String(fold(where.value)));
    }
  }

  function sort(table: Table, orderBy: OrderBy[] = []) {
    return [...table].sort((a, b) => {
      for (const { field, direction = 'asc', nulls } of orderBy) {
        const x = a[field] ?? null;
        const y = b[field] ?? null;
        if (x === y) continue;
        // NULLs sort last ascending and first descending, as on Postgres.
        const nullsLast =
          (nulls ?? (direction === 'asc' ? 'last' : 'first')) === 'last';
        if (x === null) return nullsLast ? 1 : -1;
        if (y === null) return nullsLast ? -1 : 1;
        const order = compare(x, y);
        if (order !== 0) return direction === 'asc' ? order : -order;
      }
      return 0;
    });
  }

  // The keys the model declares, which the store relies on to refuse duplicates.
  function checkKeys(model: ModelName, row: Data, others: Table) {
    const spec = helpdeskModel[model];
    const keys = [
      { fields: spec.primaryKey },
      ...((spec as { unique?: { fields: string[]; where?: string }[] })
        .unique ?? []),
    ];
    for (const key of keys) {
      if (key.where && !row[key.where]) continue;
      if (key.fields.some(f => row[f] === null || row[f] === undefined)) {
        continue;
      }
      const clash = others.some(
        other =>
          other !== row &&
          (!key.where || other[key.where]) &&
          key.fields.every(f => other[f] === row[f])
      );
      if (clash) {
        throw new Error(`memory: duplicate ${model} ${key.fields.join(', ')}`);
      }
    }
  }

  function build(inTransaction: boolean): AdapterInput {
    const now = <T>(work: () => T | Promise<T>) =>
      inTransaction ? Promise.resolve().then(work) : serially(work);
    const adapter: AdapterInput = {
      id: 'memory',
      supports: { dates: false, booleans: true, json: true },
      create: (model, data) =>
        now(() => {
          const table = rows(model);
          const row = structuredClone(data);
          checkKeys(model, row, table);
          table.push(row);
        }),
      findMany: (model, query: FindQuery) =>
        now(() => {
          const found = sort(
            rows(model).filter(
              r => !query.where || matches(model, r, query.where)
            ),
            query.orderBy
          ).slice(
            query.offset ?? 0,
            query.limit === undefined
              ? undefined
              : (query.offset ?? 0) + query.limit
          );
          return found.map(r => {
            const copy = structuredClone(r);
            if (!query.select) return copy;
            return Object.fromEntries(query.select.map(f => [f, copy[f]]));
          });
        }),
      count: (model, where) =>
        now(
          () =>
            rows(model).filter(r => !where || matches(model, r, where)).length
        ),
      updateMany: (model, where, set) =>
        now(() => {
          const table = rows(model);
          const hits = table.filter(r => !where || matches(model, r, where));
          const updated = hits.map(r => {
            const next = { ...r };
            for (const [field, value] of Object.entries(set)) {
              next[field] =
                value && typeof value === 'object' && 'increment' in value
                  ? Number(r[field]) + Number(value.increment)
                  : structuredClone(value);
            }
            return next;
          });
          for (const next of updated) {
            checkKeys(
              model,
              next,
              table.filter(r => !hits.includes(r)).concat(updated)
            );
          }
          for (const [i, r] of hits.entries()) Object.assign(r, updated[i]);
          return hits.length;
        }),
      deleteMany: (model, where) =>
        now(() => {
          const table = rows(model);
          const kept = table.filter(r => where && !matches(model, r, where));
          tables.set(model, kept);
          return table.length - kept.length;
        }),
      transaction(fn) {
        if (inTransaction) return fn(adapter);
        return serially(async () => {
          const before = structuredClone(new Map(tables));
          try {
            return await fn(build(true));
          } catch (error) {
            tables.clear();
            for (const [model, table] of before) tables.set(model, table);
            throw error;
          }
        });
      },
    };
    return adapter;
  }

  return build(false);
}
