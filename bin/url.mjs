import { fileURLToPath } from 'node:url';

/**
 * The database a connection string names: its family, and for SQLite the
 * path. `file:` URLs may be relative (`file:./app.db`), and a bare path may
 * be a Windows one (`C:\data\app.db`).
 */
export function databaseOf(url) {
  if (/^file:/i.test(url)) {
    return {
      family: 'sqlite',
      path: /^file:\/\//i.test(url)
        ? fileURLToPath(url)
        : decodeURIComponent(url.slice('file:'.length)),
    };
  }
  if (/\.(db|sqlite3?)$/i.test(url) && !/^[a-z][a-z0-9+.-]+:\/\//i.test(url)) {
    return { family: 'sqlite', path: url };
  }
  // A one-letter scheme is a Windows drive, not a database.
  const scheme = url.match(/^([a-z][a-z0-9+.-]+):/i)?.[1]?.toLowerCase();
  const family = {
    postgres: 'postgres',
    postgresql: 'postgres',
    mysql: 'mysql',
    mssql: 'mssql',
    sqlserver: 'mssql',
  }[scheme];
  return family ? { family } : { family: undefined, scheme };
}
