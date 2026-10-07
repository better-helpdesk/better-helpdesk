// Opens the database a URL names, through the driver the host installed:
// postgres:// (pg), mysql:// (mysql2), mssql:// or sqlserver:// (tedious and
// tarn), and file: or a path ending in .db, .sqlite or .sqlite3 (node:sqlite).
// One connection, closed by `close`.
import {
  mssqlAdapter,
  mysqlAdapter,
  postgresAdapter,
  sqliteAdapter,
} from '../dist/index.js';

async function load(name, family) {
  try {
    return await import(name);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error(
      `helpdesk: ${family} needs the ${name} package; install it next to better-helpdesk`
    );
  }
}

export async function openDatabase(url) {
  const scheme = url.match(/^([a-z0-9+]+):/i)?.[1]?.toLowerCase();
  if (scheme === 'postgres' || scheme === 'postgresql') {
    const pg = (await load('pg', 'Postgres')).default;
    const pool = new pg.Pool({
      connectionString: url,
      max: 1,
      ssl:
        process.env.DATABASE_SSL === 'no-verify'
          ? { rejectUnauthorized: false }
          : process.env.DATABASE_SSL === 'true',
    });
    return { adapter: postgresAdapter({ pool }), close: () => pool.end() };
  }
  if (scheme === 'mysql') {
    const mysql = await load('mysql2', 'MySQL');
    const pool = (mysql.default ?? mysql).createPool({
      uri: url,
      timezone: 'Z',
      connectionLimit: 1,
    });
    const adapter = mysqlAdapter({ pool });
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  if (scheme === 'mssql' || scheme === 'sqlserver') {
    const tedious = await load('tedious', 'SQL Server');
    const tarn = await load('tarn', 'SQL Server');
    const parsed = new URL(url);
    const options = Object.fromEntries(parsed.searchParams);
    const adapter = mssqlAdapter({
      tarn: { ...tarn, options: { min: 0, max: 1 } },
      tedious: {
        ...tedious,
        connectionFactory: () =>
          new tedious.Connection({
            server: parsed.hostname,
            authentication: {
              type: 'default',
              options: {
                userName: decodeURIComponent(parsed.username),
                password: decodeURIComponent(parsed.password),
              },
            },
            options: {
              port: Number(parsed.port) || 1433,
              database:
                decodeURIComponent(parsed.pathname.slice(1)) || undefined,
              encrypt: options.encrypt !== 'false',
              trustServerCertificate: options.trustServerCertificate === 'true',
            },
          }),
      },
    });
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  if (scheme === 'file' || (!scheme && /\.(db|sqlite3?)$/i.test(url))) {
    const { DatabaseSync } = await import('node:sqlite');
    const path =
      scheme === 'file' ? decodeURIComponent(new URL(url).pathname) : url;
    const adapter = sqliteAdapter({ database: new DatabaseSync(path) });
    return { adapter, close: () => adapter.kysely.destroy() };
  }
  throw new Error(
    `helpdesk: no adapter for ${scheme ? `${scheme}:` : url}; use postgres://, mysql://, mssql://, file: or a .sqlite path`
  );
}
