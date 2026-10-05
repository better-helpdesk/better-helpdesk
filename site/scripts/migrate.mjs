// Divio names the database DATABASE_URL; the package's CLI reads
// HELPDESK_DATABASE_URL. Run as a Divio release command.
process.env.HELPDESK_DATABASE_URL ||= process.env.DATABASE_URL;
await import(
  new URL('../node_modules/better-helpdesk/bin/migrate.mjs', import.meta.url)
    .href
);
