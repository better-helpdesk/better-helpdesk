import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

import { serve } from '@hono/node-server';
import { buildHelpdesk, migrate, sqliteAdapter } from 'better-helpdesk';
import { Hono } from 'hono';

const db = sqliteAdapter({
  database: new DatabaseSync(process.env.HELPDESK_SQLITE ?? 'helpdesk.db'),
});
await migrate(db);

const port = Number(process.env.PORT ?? 3000);
const url = process.env.APP_URL ?? `http://localhost:${port}`;

const helpdesk = buildHelpdesk({
  db,
  basePath: '/api/helpdesk',
  referencePrefix: 'HONO',
  // The same-origin check on mutations compares against this origin.
  adminUrl: `${url}/helpdesk/`,
  inboxes: {
    support: { name: { en: 'Support' }, public: true },
  },
  // Visitors only. A real app returns the signed-in user here, and
  // `isAgent: true` for the support team.
  identify: async () => null,
});

const widget = await readFile(
  createRequire(import.meta.url).resolve('better-helpdesk/widget.js')
);

const app = new Hono();

app.all('/api/helpdesk/*', c => helpdesk.handler(c.req.raw));

app.get('/widget.js', c =>
  c.body(widget, 200, { 'content-type': 'text/javascript; charset=utf-8' })
);

app.get('/', c =>
  c.html(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Hono with Better Helpdesk</title></head>
  <body>
    <h1>Hono with Better Helpdesk</h1>
    <p>The launcher is in the corner.</p>
    <script src="/widget.js" data-api="/api/helpdesk" data-inbox="support" async></script>
  </body>
</html>`)
);

serve({ fetch: app.fetch, port });
console.log(url);
