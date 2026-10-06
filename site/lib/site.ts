import pg from 'pg';

export const siteUrl = () =>
  (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// next dev re-evaluates modules on every edit; a fresh pool each time
// exhausts the server's connections within a few minutes.
const cache = globalThis as typeof globalThis & { sitePool?: pg.Pool };
if (!cache.sitePool) {
  cache.sitePool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
  });
  // An idle connection the server ends (a restart, a failover) would
  // otherwise be an uncaught exception that takes the whole site down.
  cache.sitePool.on('error', error =>
    console.error('[site] database connection lost', error)
  );
}
export const pool = cache.sitePool;
