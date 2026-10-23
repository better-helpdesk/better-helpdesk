# Brief: "Support that stays up when your app doesn't" (standby exploration, 22 October 2026)

Shared brief for the subject reports in this folder. Read it fully before
starting. Then read, in the repository root: `docs/product.md`,
`AGENTS.md` (especially "The architecture is settled" and "Off-limits"),
`ROADMAP.md` ("What it will not do"), and
`site/content/docs/operations/production.mdx` (section "Keep support
reachable when your product is down").

## What Better Helpdesk is

An MIT npm package that mounts a support inbox, ticketing and a light CRM
inside the host's own Next.js app: one route handler, one React component
for the agent UI, one widget (`<helpdesk-widget>`, also a standalone
`widget.js`), and its tables in the host's own database (Postgres, MySQL,
SQLite, MS SQL via Kysely adapters; `DatabaseAdapter` in
`src/db/adapter.ts` is a small CRUD contract a host can implement). It is a
library the host mounts, never a service running next to the product.
Everything optional is an adapter the host implements (storage, email, AI,
help search, realtime); inbound email and jobs are routes the host's relay
and scheduler call. The host owns identity: `identify(request)` or a signed
HS256 identity token for a widget on another origin (`identityTokenSecret`);
`isAgent` on the identity is the only thing that grants the agent UI.
Version 1.0.0 shipped on 22 October 2026. One maintainer. Two unnamed design
partners about to deploy. Positioning: "the open-source Next.js helpdesk that
innovative companies run inside their own product rather than next to it".

## The promise on the website (not built)

better-helpdesk.com has a section, eyebrow "Not public yet":

> Support that stays up when your app doesn't.
> We're quietly exploring a managed standby that keeps your widget and inbox
> reachable while your app is down, then hands everything back to your
> database. Join the private list to hear about it first and help decide
> what it becomes.
> Not built yet. The open-source package will never depend on it. No
> newsletter, only news about this.

The form collects an email and a checkbox "I'd pay for this."

## The problem, with a concrete scenario

Because the helpdesk lives inside the product and shares its database, an
outage of the product is an outage of support, at the moment customers need
it most. Intercom and Zendesk do not have this problem: their widget talks to
their servers, a separate failure domain, at the price of the customer data
living with them.

Scenario (Divio, a Swiss PaaS; the maintainer also works there and needs
this for Divio):

- `control.divio.com` (the control panel, the product) goes down. Users
  cannot open it. If the helpdesk is mounted there, its routes and database
  are unreachable.
- `www.divio.com` and `status.divio.com` still work. The widget can be
  opened there, but every call to the helpdesk fails, so nobody can submit.
- Customers can only watch `status.divio.com`. Agents cannot answer anyone
  through the helpdesk. With Intercom or Zendesk, both sides would still be
  talking.

Wanted: customers can still write (and ideally read replies), agents can
still answer, and when the product is back, everything lands in the product's
database as if the standby had never existed.

## Hard constraints (from AGENTS.md and ROADMAP.md)

- Off-limits in the package: a standalone server, a Docker image run beside
  the app, a hosted or cloud mode, its own login, its own database, a second
  ORM. No per-seat pricing or gated feature: the package is MIT, all of it.
- The roadmap says no hosted mode or hosted relay "because we never see your
  data". The inbound relay is example code the host deploys on its own
  account (`relays/`), and that is the accepted pattern for anything that
  must run outside the app.
- The website says the open-source package will never depend on the managed
  standby. Whatever the package gains must work with a self-hosted standby
  just as well.
- Four runtime dependencies (kysely, zod, mailparser, mailauth); adding one
  needs a reason.
- No data from the design partners anywhere. Invented names on `.test`
  domains only.

## What already exists that a solution can lean on

- The documented recipe today (production.mdx): mount the helpdesk in a
  small Next.js app of its own on separate hosting with its own database; the
  product embeds the widget cross-origin with an identity token; the website
  carries the same widget on a `public` inbox for anyone who cannot sign in;
  give the support app a sign-in that is not part of the same outage.
- `GET {basePath}/health/` answers `{ ok: true }` after one database query,
  503 otherwise, for status pages.
- The Cloudflare Email Worker relay (`relays/cloudflare-email-worker.js`)
  forwards to `FALLBACK_ADDRESS` when the inbound route does not answer;
  Postmark and Mailgun retry on their own. Waiting mail threads in later by
  message ids.
- Export and import (`src/export.ts`, `bin/export.mjs`, `bin/import.mjs`):
  JSON Lines, one conversation per line with messages (each with an optional
  `emailMessageId`), participants named by email never by id, attachments by
  storage key, events. An imported conversation gets a new reference, keeps
  the old one in `context.imported`, and starts no SLA clock.
- The widget takes an `api` attribute (the handler's base URL, default
  `/api/helpdesk`), `inbox`, `identity-token`, `org`, `locale`. The API
  client (`src/ui/api.ts`) is `fetch` with credentials `same-origin`; events
  come over a fetch-based SSE stream with polling as the fallback.
- `sqliteAdapter({ database })` takes `node:sqlite` or `better-sqlite3`.
- `onEvent(event)` on the config fires on every helpdesk event; host
  functions (`createConversation`, notes, changes) let host code write.
- Reference `PREFIX-number` from `referencePrefix`, sequence from 1000.
- Anonymous visitors on a `public` inbox get a receipt email when the inbox
  has `receipt`; they are known by a `visitor` identity.

## Rules for every report

- Write only to your own file in `docs/research/2026-10/standby/`. Do not
  commit, do not push, do not touch GitHub, do not edit any other file.
- Cite what you read (file paths, URLs). Separate what you verified from
  what you infer. Dates absolute.
- End with a section "What I recommend" (one recommendation, with the
  alternatives you rejected and why) and a section "Open questions for the
  maintainer".
