# The Better Helpdesk website

The marketing site, and the package's first host in production. It installs
`better-helpdesk` from npm the way the README tells everyone else to: the
launcher in the corner and the design-partner form write into this site's own
`helpdesk` schema, and the maintainer answers from `<HelpdeskAdmin />` at
`/helpdesk/`.

It depends on the published package, not the workspace link the demo uses, so
the site runs what users get. After a release, bump `better-helpdesk` in
`package.json` with `pnpm --filter better-helpdesk-site up better-helpdesk`.
pnpm holds back versions younger than the workspace's minimum release age, so
a fresh release also needs its entry in `minimumReleaseAgeExclude` in
`pnpm-workspace.yaml`, which `pnpm add` writes for you.

## Run it

```sh
docker run --rm -p 5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=helpdesk_site postgres:18-alpine
```

From the repository root:

```sh
pnpm install
cp site/.env.example site/.env.local
pnpm --filter better-helpdesk-site db:migrate
pnpm --filter better-helpdesk-site dev
```

`http://localhost:3000`. The inbox is at `/helpdesk/`; the browser asks for
`SITE_AGENT_USER` and `SITE_AGENT_PASSWORD`.

## How it is wired

- `lib/helpdesk.ts` builds the helpdesk with two public inboxes: `support` for
  the widget and `partners` for the form. The handler is mounted at
  `/helpdesk/api/` so that the agent UI and its API share one path, and the
  browser sends the agent's Basic credentials to both.
- `proxy.ts` asks for those credentials on `/helpdesk/` and on
  `/helpdesk/api/agent/*`. The widget, inbound and jobs routes stay open and
  are guarded by the handler itself. `identify` checks the same header again,
  so the proxy is the prompt, not the lock.
- `instrumentation.ts` runs `helpdesk.runJobs()` every minute inside the
  server. The package queues its email (receipts, agent alerts, replies to
  customers), so without it nothing goes out.
- `lib/mail.ts` sends plain text through `SMTP_URL`. Unset, it logs that a
  message was not sent and the reply only exists in the inbox.

## Divio Cloud

The `Dockerfile` at the repository root builds this directory only; Divio
expects it there. In the Control Panel:

1. Add a Postgres database service. Divio provides it as `DATABASE_URL`.
2. Under Settings, add the release command
   `node scripts/migrate.mjs`. It applies the package's migrations before each
   deployment goes live.
3. Under Env Variables, per environment: `SITE_URL` (the origin visitors open,
   for example `https://better-helpdesk.com`), `SITE_AGENT_USER`,
   `SITE_AGENT_PASSWORD` (sensitive), and optionally `SITE_AGENT_NAME`,
   `SITE_AGENT_EMAIL`, `SMTP_URL` (sensitive) and `MAIL_FROM`. Set
   `DATABASE_SSL=true` if the database requires TLS.
4. Deploy. Test and Live build from `main` unless the environment says
   otherwise.

`SITE_URL` must match the domain exactly: the handler refuses every mutation
from any other origin, so a mismatch turns each widget message into a 403.

The build stage has no access to these variables, and nothing in `next build`
needs them. Metadata and the robots and sitemap routes read `SITE_URL` per
request.
