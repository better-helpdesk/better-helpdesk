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
pnpm --filter better-helpdesk-site agent you@example.com "Your Name"
pnpm --filter better-helpdesk-site dev
```

Set `BETTER_AUTH_SECRET` in `.env.local` first (`openssl rand -base64 32`).
The `agent` script asks for a password and creates the account, or sets a new
password if the account exists. `http://localhost:3000`; the inbox is at
`/helpdesk/` and signs you in at `/login/`.

## How it is wired

- `lib/helpdesk.ts` builds the helpdesk with three public inboxes: `support`
  for the widget, `partners` for the story form and `continuity` for the
  standby list. The handler is mounted at `/helpdesk/api/`.
- `lib/auth.ts` is Better Auth with email and password, its tables (`user`,
  `session`, `account`, `verification`) in the `public` schema next to
  `helpdesk`. Sign-up is off: `scripts/agent.mjs` makes accounts, so every
  account is an agent. `identify` reads the Better Auth session, and the
  inbox page redirects to `/login/` without one; the handler checks the
  session again on every agent call.
- `instrumentation.ts` runs `helpdesk.runJobs()` every minute inside the
  server. The package queues its email (receipts, agent alerts, replies to
  customers), so without it nothing goes out.
- `lib/mail.ts` sends plain text through `SMTP_URL`. Unset, it logs that a
  message was not sent and the reply only exists in the inbox.

## The live demo

`/demo` is Harbor, a pretend freight product, with a second helpdesk
(`lib/demo.ts`, handler at `/demo/api/`, inbox at `/demo/inbox/`). Visitors
pick a role with a cookie, so anyone can be the agent. It needs a database
of its own in `DEMO_DATABASE_URL`: the helpdesk schema is fixed, and
`instrumentation.ts` truncates it and seeds invented conversations at start
and on every quarter hour. The reset refuses to run against the site's
database. It has no email adapter, so nothing typed into it is ever mailed.
Without `DEMO_DATABASE_URL`, `/demo` says it is not set up.

It runs the same published version as the rest of the site, so bumping
`better-helpdesk` after a release updates the demo too.

Everyone shares that inbox, so the demo limits what a link-post spike can
do to it. Anonymous visitors get 5 messages per address per hour and the
customer role 15 (`anonymousRateLimit` and `customerRateLimit` in
`lib/demo.ts`); the customer role is one contact per address, so nobody sees
what another visitor wrote as Nadia; whoever plays the agent can block a
sender, and the next message from that address is refused; and the
quarter-hour reset wipes all of it, blocks and rate-limit windows included.
The agent role still sees every conversation, which is the point of the demo.

Load test, 9 October 2026, against a local production build (`next build`,
`next start`, Postgres 18 in Docker, Apple silicon laptop), with the live
instance left alone:

| Run | Result |
| --- | --- |
| 200 visitors, 7 messages each, 50 in flight (`x-forwarded-for` per visitor) | 1,400 POSTs in 4.3 s, 325 req/s, p50 99 ms, p99 818 ms; 201 until each address's budget, 429 after, no 5xx |
| One address, 30 messages, 10 in flight | 5 × 201, then 429 for the rest |
| `GET /demo/`, 20 connections, 15 s (autocannon) | 536 req/s, p50 35 ms, p99 56 ms, no errors |

Under a burst from one address the limiter counts the requests still in
flight, so it refuses earlier than the budget, never later.

## Divio Cloud

`site/Dockerfile` builds this directory only, with the repository root as
the build context, so `.dockerignore` sits at the root. In the Control Panel:

1. Add a Postgres database service. Divio provides it as `DATABASE_URL`.
   For the live demo, add a second one and make its URL available as
   `DEMO_DATABASE_URL`.
2. Under Settings, add the release command
   `node scripts/migrate.mjs`. It applies the package's migrations and the
   auth tables before each deployment goes live.
3. Under Env Variables, per environment: `SITE_URL` (the origin visitors open,
   for example `https://better-helpdesk.com`), `BETTER_AUTH_SECRET`
   (sensitive, `openssl rand -base64 32`), and optionally `SMTP_URL`
   (sensitive) and `MAIL_FROM`. Set `DATABASE_SSL=true` if the database
   requires TLS and its certificate is signed by a CA Node trusts, or
   `DATABASE_SSL=no-verify` for a self-signed one. Releases up to 0.3.0
   accepted any certificate for `true`.
4. Deploy. Test and Live build from `main` unless the environment says
   otherwise.
5. Create your account once from a shell in the running container:
   `node scripts/agent.mjs you@example.com "Your Name"`.

`SITE_URL` must match the domain exactly: the handler refuses every mutation
from any other origin, so a mismatch turns each widget message into a 403.

The build stage has no access to these variables, and nothing in `next build`
needs them. The robots and sitemap routes read `SITE_URL` per request. Page
metadata uses the fixed production origin in `app/layout.tsx` instead, so the
pages stay static and a CDN can cache them.
