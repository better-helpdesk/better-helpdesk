import pg from 'pg';

export const siteUrl = () =>
  (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// next dev re-evaluates modules on every edit; a fresh pool each time
// exhausts the server's connections within a few minutes.
const cache = globalThis as typeof globalThis & { sitePool?: pg.Pool };
cache.sitePool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
export const pool = cache.sitePool;
