# Engineering design: support that stays up when the app doesn't

Head of Engineering report for the standby exploration, 22 October 2026.
Read in full: `docs/research/2026-10/standby/BRIEF.md`, `docs/product.md`,
`AGENTS.md`, `ROADMAP.md`, `site/content/docs/operations/production.mdx`,
and the code named below. Line numbers are from the tree at commit
`5d2567a` (1.0.0). "Verified" means I read the lines; "inferred" means I am
reasoning from them or from outside knowledge.

The short version: the documented recipe already is the whole answer for
Divio and needs no package change. The open-source standby is four small
package items (widget failover, idempotent import with kept references, a
relay fallback URL, an export route) plus one example app. The managed
standby is the same example app run per tenant on its own SQLite file; it
needs nothing from the package that the self-hosted standby does not.

## 0. What the code does today, as the design depends on it

Verified:

- The handler is one `Request → Response` function with route groups
  `widget/*`, `agent/*`, `inbound`, `jobs` (`src/http.ts:122-1782`). CORS
  is granted to `widget/*` only, for the union of every inbox's
  `allowedOrigins`, with `x-helpdesk-visitor` and `x-helpdesk-identity` as
  allowed headers (`src/http.ts:126-128`, `1744-1755`). Mutations from
  another origin are refused unless the path is `widget/*` and the origin
  is allowed (`src/http.ts:1762-1782`). `GET health` runs one query and
  answers `{ ok: true }` or 503 (`src/http.ts:590-597`, `src/db/store.ts:991-993`).
- The widget boots by calling `widget/session` keyed on
  `session:${inbox}:${locale}:${subject}:${orgId}`; the key does **not**
  include the API base (`src/widget/widget.tsx:384-392`). The `Api` object
  is memoised on `props.api` (`widget.tsx:362-375`). The visitor token is
  kept in `localStorage` under `helpdesk-visitor:<api>` (`widget.tsx:138-141`,
  `353-358`, `767`), so a different API base starts with no visitor. The
  events stream is a fetch-based SSE reader that reconnects with back-off
  up to 30 s and gives up to polling on 401/403/404 (`src/ui/api.ts:62-131`);
  it re-subscribes only when the `api` object changes (`api.ts:210-213`).
  `widget/events` answers 404 without a `realtime` adapter
  (`src/http.ts:260-261`). A failed session shows `LoadFailed` with a
  retry button (`widget.tsx:705-707`); a failed reply keeps the draft and
  shows `failed` (`widget.tsx:1760-1775`). Nothing in the widget or the API
  client distinguishes a network error from a 5xx, and no request has a
  timeout (`api.ts:32-42`).
- A customer is resolved by `identify(request)`, else by the identity token
  (HS256, shared secret, `isAgent` always false), else by the visitor token
  hash (`src/service.ts:217-266`, `src/identity-token.ts:49-76`). An
  anonymous write on a `public` inbox requires an email, mints a 32-byte
  visitor token and a contact with an unverified `email` identity
  (`service.ts:432-463`). A visitor is forgotten after 30 idle days
  (`service.ts:64`, `store.ts:483-500`).
- Agents exist only through `identify` returning `isAgent: true`;
  `touchAgent` creates the row (`service.ts:327-338`). The audit log is written per agent mutation with the agent id
  and the route's id (`src/http.ts:639-651`, `src/db/model.ts:357-365`).
- References come from a `counter` row read `forUpdate` inside the
  conversation's transaction (`store.ts:307-323`, `1033`); `number` is
  unique (`model.ts:245`). Inbound mail threads by `In-Reply-To`/`References`
  against stored `emailMessageId`s, else by the `+PREFIX-number` tag parsed
  with the primary's `referencePrefix` (`service.ts:1150-1169`,
  `src/domain.ts:5-14`). Only inbound messages carry an `emailMessageId`;
  outbound agent emails do not record one (`service.ts:1211,1243,1290`),
  so a customer's reply to an agent's email threads by the plus address
  or by a quoted inbound id.
- Export writes one conversation per line with people by email,
  attachments by storage key, events, and `emailMessageId` per message
  (`src/export.ts:12-50`, `55-142`). Import validates with zod
  (`export.ts:143-196`) and, for every line, **creates a new conversation
  with a new number** (`export.ts:314-356`), keeps the old reference in
  `context.imported` (`327-333`), starts no SLA clock (`355`), passes the
  first message without its `emailMessageId` (`352-355`), creates a
  nameless contact for a person without email (`253`), and ignores
  attachments and events (docstring `189-195`). `report.updated` is never
  incremented; there is no dedupe of any kind. The CLI and the docs say so:
  "run it once" (`bin/import.mjs:7-8`, `site/content/docs/operations/cli.mdx:36`,
  `switching.mdx:45`). Nothing looks a conversation up by
  `context.imported.reference` (grep over `src/service.ts`, `src/http.ts`,
  `src/db/store.ts`, `src/admin/`: no hit).
- The Cloudflare relay POSTs to one URL and forwards to `FALLBACK_ADDRESS`
  on any non-2xx or network error (`relays/cloudflare-email-worker.js:11-33`).
  Postmark and Mailgun relays answer 502 so the provider retries
  (`relays/postmark.ts:36-62`, `relays/README.md`).
- `onEvent` is awaited inside the request and its throw is logged
  (`src/config.ts:359-364`, `src/events.ts:33-45`). `resolveContext` and
  `links` are wrapped in try/catch but have no timeout
  (`service.ts:1726-1734`, `http.ts:984-999`).
- `sqliteAdapter` takes `node:sqlite` or `better-sqlite3`
  (`src/db/kysely.ts:439-490`); the CLIs open a `.sqlite`/`file:` URL with
  `node:sqlite` (`bin/database.mjs:84-88`). `memoryRealtime` covers one
  process; `postgresRealtime` needs a pooled LISTEN connection
  (`src/realtime.ts:20-56`). Jobs (every email, receipts, reminders, SLA,
  retention) run only when `runJobs` is called (`service.ts` `runJobs`,
  `site/content/docs/operations/jobs.mdx:7`).
- `widget.js` is an IIFE bundle of `src/widget/standalone.ts`
  (`scripts/build.mjs:50-60`), exported as `better-helpdesk/widget.js`
  (`package.json:88`); the script tag's `data-*` become element attributes
  (`standalone.ts:26-38`). Four runtime dependencies (`package.json`
  `dependencies`). The site is the first production host, with its own
  Better Auth email+password sign-in and a `continuity` inbox for the
  private list (`site/lib/helpdesk.ts:13-58`, `site/lib/auth.ts:12-16`).

## A. The lazy version for Divio

### Is the documented recipe the whole answer?

Yes. The recipe in `production.mdx:129-136` (support app on separate
hosting with its own database, product embeds the widget cross-origin with
an identity token, website carries the widget on a `public` inbox, mail
relay with a fallback, health route on the status page) covers the
scenario end to end with **zero package changes**. What follows is what
degrades during the outage and the smallest fix for each.

### What breaks during the outage, and the smallest fix

1. **Identity tokens cannot be minted.** The signer is the product's
   backend (`identity/other-origin.mdx:27-50`). While `control.divio.com`
   is down there is no token, but there is also no page of
   `control.divio.com` to hold a widget, so the token is moot where it
   matters. On `www.divio.com` and `status.divio.com` the customer was
   anonymous anyway. Fix: none in the package; the `public` inbox already
   asks for an email and sends a receipt (`service.ts:436`, `receipt` in
   `config.ts:170`). Consequence (verified): the outage conversation sits
   on a `visitor` contact with an unverified email identity
   (`service.ts:443-463`); it will not appear in the same customer's
   signed-in widget on `control.divio.com` afterwards, because that
   customer is a different contact (the `host` identity, `service.ts:224-226`).
   Inferred: the automatic merge in `linkVerified` only fires for a
   *verified* email identity (`service.ts:182-194`, `findContactByIdentity(..., { verifiedOnly: true })`),
   so an agent merges the two contacts by hand ("Merge another contact into
   this one", `switching.mdx:35`), or the customer replies to the receipt
   by email, which proves the address through DKIM and links it.
   Acceptable for an outage; no code.

2. **The widget on the product's own pages is down with the product.**
   Nothing to fix; that surface is gone. What must be up is the widget on
   `www` and `status`: load `widget.js` from a copy in each site's own
   `public/` (the upgrade step already assumes a copy, `production.mdx:155`)
   or from the support app's origin, with `data-api` pointing at the
   support app, and both origins in `allowedOrigins`
   (`widget/add.mdx` "On another origin"). Inferred: whether
   `status.divio.com` can carry a script tag depends on the status page
   vendor; if it cannot, a "Contact support" link to a page on `www` that
   carries `<helpdesk-conversations>` is the fallback.

3. **Agent sign-in.** The support app must not authenticate through
   anything on `control.divio.com`. The site already shows the pattern:
   Better Auth with email+password and no self-signup
   (`site/lib/auth.ts:12-16`), accounts created by a script
   (`site/README.md`). For Divio I would use Better Auth with Google
   Workspace OAuth restricted to the company domain plus the email+password
   break-glass. Host code only.

4. **The CRM link to the product's orgs.** `resolveContext(externalOrgId)`,
   `links(contact, company)` and `orgNames` call into the product
   (`config.ts:336-343`). Throws are caught (`service.ts:1729-1734`,
   `http.ts:985-999`) but nothing times them out: a host that hangs on a
   dead `control.divio.com` hangs the company card and the AI draft
   (`service.ts:1563-1566`). Fix, host code: wrap each with
   `fetch(url, { signal: AbortSignal.timeout(2000) })` and return `{}` or
   `[]` on failure. Also `resolveTier` (`config.ts:322`) falls back to
   null on throw (`service.ts:360-370`), which is fine. Worth one
   sentence in `production.mdx`.

5. **Email keeps working.** The support app's outbound adapter and the
   relay point at the support app, which is up. The only coupling is if
   Divio's mail provider shares the outage, which it does not in the brief.

### Where to host it for Divio

Off Divio Cloud. Inferred nuance: the brief's outage is the control plane;
deployed apps on Divio Cloud may keep serving, but a support app has to
survive the *worst* Divio outage, not the typical one, so it lives on
another provider and its database with it. Cheapest credible options:

- **Fly.io, one machine, SQLite on a volume** (`sqliteAdapter`,
  `bin/database.mjs:84-88`), `memoryRealtime()` for SSE (one process), the
  `instrumentation.ts` timer for jobs (`jobs.mdx:14-27`), Litestream (or a
  nightly `cp`) for backups. Everything in the package already works
  unchanged on it. Fewest moving parts; this is what I would pick.
- **Vercel Pro + Neon Postgres**: no server to keep, but per-minute cron
  needs Pro (`production.mdx:127`), and SSE through a serverless function
  with `postgresRealtime`'s LISTEN connection is awkward (`realtime.ts:48-56`);
  polling covers it (`api.ts:80-87`). Pick this if nobody wants to own a
  machine.
- A Hetzner/any VM with Docker Compose: fine, most operations.

Prices are inferred and change; the point is that any of these is a
rounding error next to the first outage it covers.

## B. The open-source standby

Scenario: the host keeps the helpdesk inside the product and wants a
standby only during outages. The standby is **the same package** in a
second small Next.js app, on a separate failure domain, with its own
database, mounted the same way. The package gains the minimum that makes
failover and handback mechanical; the app and its hosting are an example
the host deploys on its own account, like `relays/`.

Where each piece lives:

| Piece | Lives in |
| --- | --- |
| Widget failover (`api-standby`, probe, banner, stickiness) | package (`src/ui/api.ts`, `src/widget/`, `src/ui/i18n.ts`) |
| Idempotent import, kept references, append mode | package (`src/export.ts`, `bin/import.mjs`) |
| `GET {basePath}/export/` behind a secret | package (`src/http.ts`, `src/config.ts`) |
| Relay fallback URL | `relays/` (three files) |
| Standby app: config mirror, SQLite, sign-in, jobs timer, Dockerfile/fly.toml | `examples/standby/` |
| Hosting recipes, runbook, threat model | docs (`site/content/docs/operations/standby.mdx`, a section in `production.mdx`) |

Hard constraints respected: no standalone server (the standby is a host
app that mounts the package), no hosted mode in the package, no new
runtime dependency (everything below is `fetch`, zod and the store), the
package never knows the managed thing exists.

### B1. Widget failover

**Detection.** In `createApi` (`api.ts:26-56`), not in the widget: every
component already goes through it, including the events stream. A primary
is "down" when a request to it throws (network), returns 502/503/504, or
does not answer within a timeout (today there is none; add
`AbortSignal.timeout(8000)` to `call` and leave the stream without one).
Before switching, probe `GET {standby}/health/` once (`http.ts:590-597`);
if the standby is not healthy either, stay on the primary and show
`LoadFailed` as today. I would not probe the primary's health route before
switching: the request that failed *was* the probe.

**Attribute.** One `api-standby` attribute (and `data-api-standby` on the
script tag, which `standalone.ts:32-36` already maps; add it to
`observedAttributes` in `element.tsx:48-57` and to the React props in
`react.tsx:11-25`). A list of endpoints is a generalisation nobody asked
for; one standby is the product, and `api-standby` can grow into a
space-separated list later without breaking anyone.

**Switch semantics.** `createApi(primary, headers, { standby })` keeps a
mutable `active` base and an `onSwitch` callback. The widget passes
`onSwitch` to bump a state value that goes into the session key
(`widget.tsx:391`, which today omits the base) so the session reloads on
the standby, and into the `useEvents` dependency so the stream
re-subscribes (`api.ts:210-213`); `followEvents` reads the active base at
each `connect` (`api.ts:72-75`). Sketch:

```ts
export function createApi(base, headers = () => ({}), { standby, onSwitch } = {}) {
  let root = base.replace(/\/$/, '');
  const fallback = standby?.replace(/\/$/, '');
  const switchToStandby = async () => {
    if (!fallback || root === fallback) return false;
    const ok = await fetch(`${fallback}/health/`).then(r => r.ok, () => false);
    if (!ok) return false;
    root = fallback;
    onSwitch?.(root);
    return true;
  };
  const call = async (path, init = {}) => {
    const run = () => fetch(`${root}/${withSlash(path)}`, { ..., signal: AbortSignal.timeout(8000) });
    let response;
    try { response = await run(); } catch (e) { if (await switchToStandby()) response = await run(); else throw e; }
    if ([502, 503, 504].includes(response.status) && (await switchToStandby())) response = await run();
    ...
  };
}
```

**Stickiness and flapping.** Once switched, the page stays on the standby
until it is unloaded; the choice is written to `sessionStorage` with the
time, and a fresh page load retries the primary first unless the switch
happened in the last ten minutes. No automatic switch back mid-session: a
conversation lives where it was created, and moving back mid-thread would
show an empty list and a dead thread id. This is also the split-brain
answer: the widget never writes to both within one page session.

**Double submission.** The dangerous case is a POST that reached the
primary but whose response was lost; retrying it on the standby creates
the conversation twice, in two databases. The widget already never
auto-retries a write: a failed send keeps the draft and the customer
presses Send again (`widget.tsx:1769`, `1228`). Keep that, and make the
automatic switch happen only on a failed **GET** or on a POST that threw
*before a response* (`TypeError` from fetch). A 5xx on a POST is answered
as it is today (error state, draft kept) and the *next* request decides
the switch. `ponytail:` an `Idempotency-Key` header on
`widget/conversations` is the upgrade path if a design partner sees
duplicates in practice; it needs a table or a unique index and is not in
the first slice.

**Visitor id.** Per API base (`widget.tsx:141`), so the standby starts
with no visitor. On the first write the standby mints its own token
(`service.ts:443`) and the widget stores it under the standby's key
(`widget.tsx:767`). Never share tokens across bases: the hash lives in one
database only (`store.ts:483-500`). After recovery the customer's primary
list does not show the outage conversation unless the import matched them
by email to the same contact (B4).

**Identity token.** The standby verifies it only if it holds the same
`identityTokenSecret` (`service.ts:260-266`). While the product is down no
new token is minted; the one in the page lasts an hour
(`identity-token.ts:38`). Note (verified): the documented refresh sets the
token to `undefined` on any non-ok response and leaves it alone when
`fetch` throws (`other-origin.mdx:134-138`), so a product that answers 502
drops the customer to anonymous within ten minutes, while one that is
unreachable keeps them signed in for the rest of the hour. Either way the
standby's inboxes must be `public` so the fall-through to the email form
works. For the self-hosted standby I would share the secret (same trust
domain, same team); for the managed one, never (C).

**SSE and the list.** With `memoryRealtime()` on a one-process standby the
stream works; on a serverless standby `widget/events` answers 404 and the
client polls (`api.ts:81-87`, `widget.tsx:1715`). The conversation list on
a cold standby is empty by construction; the customer sees the home screen
with the banner.

**Telling the customer.** One new string, four languages, typed against
`en` (`src/ui/i18n.ts`): `widget.standby` ("You are talking to our backup
support line. We will email you when we reply." / Swiss Standard German
with "Sie" / "vous" / "Lei"). Rendered as a `notice` at the top of the
panel while `active !== base`. The agent UI needs nothing: the standby's
`HelpdeskAdmin` is a separate app with its own `adminUrl`, and the host
can title its inbox "Standby" through `inboxes[*].name`.

**Serving `widget.js` from the surviving origin.** Document, do not build:
each page host (`www`, `status`) serves its own copy from `public/`
(`production.mdx:155` already expects one), with `data-api` on the primary
and `data-api-standby` on the standby. A script loaded from the product's
origin dies with the product; one loaded from the standby's origin couples
the normal path to the standby. A local copy couples to neither.

### B2. The standby app (`examples/standby/`)

Laid out like `examples/demo` (`lib/helpdesk.ts`, one catch-all route,
one admin page, `instrumentation.ts`; `examples/demo/app/api/helpdesk/[...slug]/route.ts:1-12`,
`examples/demo/lib/helpdesk.ts:128-274`):

- **Database.** `sqliteAdapter({ database: new DatabaseSync(path) })` on a
  persistent volume; `better-helpdesk-migrate` with `HELPDESK_DATABASE_URL=file:/data/standby.sqlite`
  in the release step (`bin/database.mjs:84-88`). Postgres is a one-line
  swap for a host that already has a second Postgres off-platform.
- **Config mirroring.** Inboxes, `types`, `priorities`, `priorityLabels`,
  `teamName`, `allowedOrigins` and `referencePrefix` must match the
  primary, because the import filters on inbox and type
  (`export.ts:258-271`) and a line with an unknown priority is kept as-is
  (`export.ts:320`). The example puts them in one `helpdesk.shared.ts` the
  host copies to both apps (or imports from a workspace package in a
  monorepo). Docs say: a change to the primary's config is a change to the
  standby's, same PR.
- **References.** Same `referencePrefix`, **reserved range**: the standby's
  `counter` is seeded at 900000 (`store.ts:313-316` seeds 1001 when the
  row is missing, so the example's migrate step runs one
  `update helpdesk_counter set value = 900000`). A standby conversation is
  `ACME-900001`, distinguishable at a glance, parseable by the primary's
  `parseReference` (`domain.ts:5-14`), and, with the import keeping
  numbers (B4), the same reference before and after handback. I reject a
  second prefix (`ACME-S`): the primary's inbound route parses only its own
  prefix (`service.ts:1162-1163`), so a customer replying to
  `support+ACME-S-1000@` after recovery would open a new conversation
  unless a new lookup path is built.
- **Email.** Outbound through the same provider with a second API token
  scoped to the standby, same From and the same `replyToAddress` shape
  (`config.ts:347`). DKIM is signed by the provider for the domain, not per
  app, so no second signer is needed; a dedicated standby sender
  (`standby@`) is only worth it if the primary's sender is self-hosted on
  the platform that is down. Inferred: Postmark/Mailgun/SES tokens are
  per-server/per-key, so revoking the standby's token is one click.
- **Inbound.** The relay gets `HELPDESK_STANDBY_URL`: try the primary,
  on non-2xx or network error try the standby, then `FALLBACK_ADDRESS`
  (`cloudflare-email-worker.js:15-32`); the Postmark and Mailgun relays
  the same before they answer 502. The standby's `inboundWebhookSecret` is
  its own; the relay holds both. A message that lands on the standby
  because the primary timed out while actually up is a stray conversation
  on a monitored inbox, and the handback import brings it home.
- **Jobs.** The standby must run `runJobs` or no receipt or reply email
  leaves (`jobs.mdx:7`). On one machine, the `instrumentation.ts` timer
  (`jobs.mdx:16-27`); on serverless, a cron hitting `POST jobs` with
  `jobsSecret`.
- **Attachments.** Simplest: no `storage` adapter on the standby; the
  widget then hides uploads (`http.ts:248`, `widget.tsx:1444`). Bring the
  storage adapter over with a `standby/` key prefix only once the import
  can carry attachments (B4, deferred).
- **Realtime.** `memoryRealtime()`; one process.
- **Health.** `GET {basePath}/health/` on the standby for the status page
  too, so "backup support line" is a component customers can see.

### B3. Agent sign-in on the standby

The package stays out of this: "the host owns identity" (`AGENTS.md`),
and a token never makes an agent (`identity-token.ts:49`, `74`). The
example app ships a sign-in that is not the product's. Options:

| Option | Threat model | Verdict |
| --- | --- | --- |
| **Separate OAuth provider** (Google Workspace / Microsoft / GitHub via Better Auth), restricted to the company domain, plus an allow-list `STANDBY_AGENTS` of emails | Depends on a third-party IdP that is not in the product's failure domain; compromise of a workspace account = agent access, same as every other SaaS the team uses | **Recommended default** |
| **Break-glass identity token signed with a standby secret** | Would need the package to accept `isAgent` from a token, a new auth path that the roadmap rules out ("its own login"), and a long-lived bearer secret shared among agents in a password manager | Rejected |
| **Magic link** through the standby's own email adapter to the pre-registered agent list (Better Auth `magicLink` plugin) | Mailbox compromise = agent access, same as password reset anywhere; depends on the mail provider being up, which the standby already requires | **Recommended as the fallback** when the IdP is part of the outage (self-hosted SSO on the product) |

Both are host code in `examples/standby/lib/auth.ts`, modelled on
`site/lib/auth.ts`. `identify` returns `isAgent: true` for a session whose
email is on the allow-list, with `role` from an env map if the host uses
roles.

### B4. Handback

Direction: `better-helpdesk-export` on the standby, `better-helpdesk-import
conversations` on the primary (`bin/export.mjs`, `bin/import.mjs`). What
today's import keeps and drops is in section 0. The gaps that matter for a
standby, and what to do about each:

1. **Idempotency (blocking).** Today every run creates every line again
   (`export.ts:314`, `400`; `report.updated` never moves). Fix:
   `--keep-references`: when the line's `reference` parses with the
   primary's prefix (`parseReference`) and `getConversationByNumber(number)`
   finds nothing (`store.ts:1075`), create the conversation **with that
   number** instead of `nextReference`; when it exists, do not create. This
   needs `createConversation` to take an optional `number`
   (`store.ts:1006-1033`; `number` is unique, `model.ts:245`, so a race
   fails loudly instead of duplicating). A number inside the primary's own
   range that is already taken is skipped with a note. Running the handback
   twice is then a no-op, which is the whole point.
2. **Append mode (blocking for a flapping outage).** A conversation that
   was imported, then received more messages on the standby, must get them
   on the second run. `--update`: for an existing conversation (found by
   number), append the line's messages whose `createdAt` is later than the
   primary's newest message of that conversation, through `createMessage`
   (`store.ts:1061-1064`), and update `lastMessageAt`, `waitingSince` and
   `status` the way the fresh path computes them (`export.ts:297-306`,
   `338-342`). `ponytail:` keyed on `createdAt`, which the standby's clock
   makes unique per millisecond (`src/db/adapter.ts:152-163`); a stable
   message id in the export format is the upgrade if two sources ever
   interleave.
3. **First message's `emailMessageId` (small, real).** Dropped on the way in
   (`export.ts:352-355`) although `createConversation` takes it
   (`store.ts:1013-1019`). An email-born standby conversation whose customer
   replies after recovery would open a new conversation on the primary.
   One-line fix.
4. **Threading of later replies.** With 1 and 3 done, an email reply after
   recovery threads either by a quoted inbound id (`service.ts:1150-1155`,
   messages keep their ids on import, `export.ts:390`) or by the plus
   address `support+ACME-900001@` (`service.ts:1159-1167`), because the
   number was kept. Without 1, neither path works for the plus address and
   a new lookup by `context.imported.reference` would be needed; the CRUD
   `Where` has no JSON operator (`src/db/adapter.ts:23-35`), so that would
   mean a new indexed column and four migrations. Keeping numbers is the
   cheaper design by a wide margin.
5. **The widget after recovery.** A signed-in customer's primary contact is
   found by email on import (`export.ts:237-253`), so the outage
   conversation shows in their list if their primary contact carries that
   email. A visitor who was anonymous on the primary too has a different
   visitor token on each side and will not see it; the receipt email with
   the reference is their handle. Document; do not build.
6. **SLA clock.** `sla: false` on import (`export.ts:355`) and no
   `respondBy`. For outage conversations this is the honest reading: the
   policy was not running. An agent can still set priority/tier and the
   store restarts the clock on a status change if the host wants one.
   Document; no flag.
7. **Audit log.** Not exported, keyed on the standby's agent ids and
   conversation ids (`model.ts:357-365`). The standby's database is the
   audit record of the outage; keep its file (or a snapshot) for the
   retention period instead of extending the export format. Document.
8. **Anonymous visitors without an email.** Cannot exist from the widget:
   a public-inbox write without an email is refused (`service.ts:436`),
   and email-born conversations have one by definition. The "nameless
   contact per run" path (`export.ts:253`) is for other tools' exports.
   No change; the standby's inboxes already require an email.
9. **Attachments.** Exported by key (`export.ts:125-133`), never imported.
   With no storage adapter on the standby (B2) there is nothing to lose.
   Later: `--attachments` that creates the rows when `storage.exists(key)`
   on the primary, which requires the two apps to share a bucket or a copy
   step. Deferred.
10. **Ratings.** Carried over (`export.ts:343-350`); rating links in a
    resolution email sent by the standby point at the standby's `rate`
    route, signed with the standby's own `rating-link-secret`
    (`service.ts:1648-1649`, `http.ts:1699-1700`) and keep working while
    it is up. A rating given after the last export is lost unless the
    export runs again (`--update` carries `rating` only on create today;
    extend `--update` to copy `rating*` when the primary has none).
11. **Seen markers.** `customerSeenAt`/`agentSeenAt` are not in the format,
    so imported rows read as unread for agents and, once the team holds the
    ball, for customers (`http.ts:157-161`). Cosmetic; document.
12. **Merged conversations, assignee, snooze.** Not in the format; a
    standby merge arrives as two conversations. Agents and their assignment
    do not carry over, by design (people by email only, `export.ts:7-11`).
    Document.

**Manual or automatic.** Manual first, idempotent always: the runbook is
"when `health` on the primary is green again, run the handback; run it
again an hour later for stragglers". Automation is then a one-line cron
the host owns. The health route is the trigger a human watches, not a
hook the package fires: a package that writes into the primary when a
probe flips is a split-brain generator (a flapping primary would import
mid-outage, then receive more standby messages, which `--update` tolerates
but a human should still be the one who says "the outage is over").

**Transport.** For the self-hosted standby a file is enough (`export >
file; scp; import`). The managed standby needs the file to travel over
HTTPS: `GET {basePath}/export/?since=<iso>` on the standby, behind a new
`exportSecret` bearer like `jobsSecret` (`http.ts:1733-1740`), streaming
`exportConversations` as JSON Lines; and `bin/import.mjs` accepting a URL
plus `--token` in place of a file path. The same route serves a self-hosted
host that prefers a pull to an scp. This is the only new authenticated
route the design adds.

### B5. Warm or cold

A warm standby mirrors open conversations so customers see history and
agents see context during the outage. Two ways to feed it, both wrong for
the first version:

- `onEvent` pushing each change to a write route on the standby: awaited
  inside the primary's request (`config.ts:360-363`), so a slow standby
  slows the product unless the host enqueues; and it needs a **write route
  on the standby that accepts conversation data**, a new attack surface on
  a service that is live all the time.
- A periodic `export --since` from the primary piped into the standby's
  import: no new route, and with `--keep-references --update` it is the
  same idempotent mechanism as the handback, in the other direction. The
  reserved range keeps mirrored numbers and standby-born numbers apart.
  Customer replies on a mirrored thread during the outage come back with
  the handback's `--update`.

Cost either way: a second copy of every open conversation to protect, back
up, retain and delete; a second place a subject-access request has to
look. For the self-hosted standby that is the host's call and the periodic
export is the right shape when they want it. For the **managed** standby a
warm copy means devguard holds customer data every day, not only during an
outage, and the "we never see your data" line (`ROADMAP.md`, "A hosted
mode or a hosted relay") is gone for good, with a DPA to match. Cold by
default; the pitch is "customers can write and agents can answer", not
"nothing changes".

### B6. Threat model

- **Shared secrets.** `identityTokenSecret` shared with the standby means a
  standby compromise impersonates any customer on the primary for as long
  as a token lasts; share it only inside one team's trust domain (B), never
  with a managed standby (C). `inboundWebhookSecret` and `jobsSecret` are
  per app; the relay holds the inbound secrets of both. The new
  `exportSecret` is read-only on the standby's data. Rotate all three with
  the primary's.
- **The standby is live all the time.** A public inbox on the open
  internet with `anonymousRateLimit` (`config.ts:389-390`), an agent UI
  behind its own sign-in, a health route anyone can hit. It is a second
  production app: TLS, CSP (`production.mdx:138-146`), secret store,
  backups, the same package version as the primary (the export format is
  zod-validated and non-strict, so a minor skew degrades to skipped lines
  with notes, `export.ts:235-247`, never to corrupt rows).
- **Handback is a write path into the primary's database.** The import
  trusts the file: a line with `author: 'agent'` and a real agent's email
  becomes that agent's words (`export.ts:385-386`); contacts and companies
  are created from it (`export.ts:237-293`). Mitigations: the host runs the
  import, pulls over TLS with the secret from a URL it configured, and the
  rows carry `context.imported.source = 'standby'` so the agent UI can show
  provenance (`export.ts:327-333`); bodies are bounded (`export.ts:186`)
  and rendered as the widget's rich text, not HTML. For the managed case
  the tenant is trusting devguard with the *content* of outage
  conversations, which is inherent to the product; it is not trusting
  devguard with its database, because the import runs on the tenant's side.
- **Flapping.** Covered in B1 (sticky switch, no auto-retry of writes) and
  B4 (`--update`, numbers kept).

### B7. Hosting the self-run standby

| Option | What already works | What does not | Verdict |
| --- | --- | --- | --- |
| **Fly.io machine, SQLite on a volume** | `sqliteAdapter`, migrate CLI, `memoryRealtime`, jobs timer, `widget.js` from `public/`; Litestream for off-box backup | A single machine: no HA, which is fine for a standby | **Document first.** Nothing in the package changes; one `fly.toml` and a Dockerfile in the example |
| Vercel + Neon | Everything but SSE; Pro plan for per-minute cron (`production.mdx:127`) | Serverless SSE with `postgresRealtime`'s LISTEN connection (`realtime.ts:48-56`); polling covers it | Second recipe, for teams that refuse to own a machine |
| Cloudflare Workers (OpenNext) + D1 through a custom adapter | The CRUD contract is small (`adapter.ts:104-128`) | D1 has no interactive transactions; the contract requires `transaction` and the counter uses `forUpdate` (`adapter.ts:125-126`, `52`, `store.ts:307-311`), so references would race; `node:crypto`, `mailparser`/`mailauth` under `nodejs_compat` are unproven; the adapter would have to pass `better-helpdesk/testing` | Last. A community adapter at best (`docs/database/community-adapters.mdx`) |
| A plain VM | Everything | Most operations | Fine; document as "the same as Fly, with your own backups" |

## C. The managed standby

devguard runs the **same `examples/standby` app** for money, one tenant per
database file. Tenancy is by database, not by column: the package has no
tenant id anywhere and should not get one. Per request, the hostname
(`acme.standby.better-helpdesk.com`) selects a tenant record (devguard's own
table, outside the package) and a cached `buildHelpdesk({ db:
sqliteAdapter({ database: open(tenant) }), ...tenant.config })`;
`allowedOrigins` is read when the handler is built (`http.ts:126-128`), so
a config change rebuilds that tenant's instance. Isolation is a file per
tenant plus a process-level cache; rate limits, counters and jobs are per
instance for free.

What the package needs for C, and it is exactly B's list:

- `api-standby` in the widget (B1).
- Idempotent import with kept references and append (B4 items 1-3).
- `GET {basePath}/export/` behind `exportSecret`, and the import CLI
  reading a URL (B4, transport): the tenant's own `better-helpdesk-import
  conversations https://acme.standby.…/api/helpdesk/export/?since=…
  --token …` pulls the handback into its own database. devguard never
  writes into a tenant's database.
- Relay fallback URL (B2), so the tenant's relay has somewhere to go.

What C changes in B, all outside the package:

- **No `identityTokenSecret` sharing.** Customers on the managed standby
  write as visitors with their email; the identity token is ignored
  (`service.ts:262`). Inferred cost: no org-shared conversations during the
  outage.
- **Email.** Sent from devguard's sender domain with the tenant's name in
  the From display name, or from the tenant's domain only if they delegate
  a subdomain's DKIM to devguard's provider. `replyToAddress` points at the
  tenant's own relay address so replies keep threading, through the relay's
  standby URL while the primary is down and to the primary afterwards (the
  numbers are kept, so the plus address resolves either way).
- **Agent sign-in** is devguard's: magic links to the tenant's
  pre-registered agent emails (B3 fallback becomes the default, because
  devguard cannot be in every tenant's IdP).
- **Deletion after handback.** The tenant's import reports `created`/
  `updated`/`skipped`; the tenant confirms in devguard's panel, and devguard
  deletes the standby conversations (host code over the store, or
  `retentionDays` on the tenant instance as the backstop,
  `config.ts:386-387`). Nothing new in the package; the standby file is
  small and can simply be replaced with an empty migrated one.
- **Tenant config** mirrors inboxes, types, priorities, prefix,
  `allowedOrigins`, `anonymousRateLimit`; stored by devguard, validated by
  `resolveConfig` at build time (`config.ts:427-509`).

Nothing in B would have to change for multi-tenancy, because B already
puts every tenant-specific thing in `HelpdeskConfig` and the database
adapter, and C instantiates those per tenant. The one thing I would watch
is memory: one `buildHelpdesk` per active tenant in one process, with an
LRU and an idle close on the SQLite handle.

## Work items for the package

Each is one PR, completable alone, with green CI as the bar. Sized by what
the maintainer has to decide and review, and by the tail it leaves. No
elapsed-time estimates.

| # | Item | Files | Decisions for the maintainer | Review load | Maintenance tail | Needed by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | First message keeps its `emailMessageId` on import | `src/export.ts:352-355`, `test/transfer.integration.test.ts` | none | one line, one assertion | none | B, C |
| 2 | `--keep-references` and `--update` on `importConversations`; `createConversation` takes an optional `number`; `report.updated` finally moves | `src/export.ts`, `src/db/store.ts:1006-1033`, `bin/import.mjs`, `cli.mdx`, `switching.mdx` | the reserved-range convention (900000) as the documented default; whether `--keep-references` is on by default for `--source standby` | the dedupe key and the `--update` append; run on all four databases | small: one more path in one function, covered by the round-trip test run twice | B, C (A benefits) |
| 3 | `api-standby` attribute, failover in `createApi`, sticky switch, `widget.standby` string in four languages, session key includes the active base, stream re-subscribes | `src/ui/api.ts`, `src/widget/{element,react,widget}.tsx`, `src/widget/standalone.ts` (none: `data-*` already maps), `src/ui/i18n.ts`, `widget/reference.mdx` | the request timeout value; switch only on GET failure and pre-response POST errors; the ten-minute stickiness; the wording | the state machine and its jsdom tests (dead primary, dead both, primary back on reload) | moderate: a second base in every widget request path, forever; keep the policy in `createApi` so the widget stays ignorant of it | B, C |
| 4 | Relay fallback URL `HELPDESK_STANDBY_URL` in the three relays | `relays/cloudflare-email-worker.js`, `relays/postmark.ts`, `relays/mailgun.ts`, `relays/README.md`, `email/receive.mdx` | none | small; relay unit tests exist (`relays/*.test.ts`) | none | B, C |
| 5 | `GET {basePath}/export/?since=` behind `exportSecret`, streaming JSONL; `bin/import.mjs` reads a URL with `--token` | `src/http.ts`, `src/config.ts`, `bin/import.mjs`, `reference/routes`, `cli.mdx` | the secret's name; whether the route is on by default when the secret is set (yes, like `jobs`) | one authenticated route; one integration test; the CLI smoke test | small, but it is a new secret and a new route to keep secure | C (optional for B) |
| 6 | `examples/standby/`: SQLite, shared config module, Better Auth OAuth + magic link, jobs timer, Dockerfile + `fly.toml`, README runbook | new folder, `pnpm-workspace.yaml`, CI builds it like the demo | which IdP the example shows; the allow-list shape | an example app, reviewed like the demo | the largest tail: a second example app whose Next.js and Better Auth versions drift; CI build keeps it honest | B; C is this app run per tenant |
| 7 | Docs: `operations/standby.mdx` (runbook, threat model, hosting table) and the A refinements in `production.mdx` (timeouts on host hooks, `widget.js` from `public/`, status-page script) | `site/content/docs/` | the hosting order (Fly first) | prose | small | A, B, C |
| 8 | Later: attachments on import when the primary's storage has the key; `rating*` on `--update`; seen markers in the format | `src/export.ts` | whether to extend the format | moderate | small | none of the first slices |

Dependencies: 1 before 2 (same file, trivial rebase). 5 depends on 2
(pulling twice must be safe before a pull route exists). 6 depends on 2, 3
and 4. 7 lands last, or the A part first on its own. 3 and 4 are
independent of everything.

Thinnest slices:

- **A (Divio):** item 7's `production.mdx` paragraph. No package change.
- **B (self-hosted standby):** 1, 2, 3, 4, 6, 7.
- **C (managed):** B plus 5. Nothing else.

## Verified versus inferred

Verified by reading: every claim with a `file:line` above; the absence of
dedupe in the import; the absence of a lookup by `context.imported`; the
session key omitting the API base; the first message losing its
`emailMessageId`; the anonymous email requirement; the identity token's
`isAgent: false`; the relays' behaviour; the site's own sign-in.

Inferred: the behaviour of a status-page vendor regarding script tags; the
providers' DKIM and token scoping; D1's transaction limits and Workers'
Node compatibility for `mailparser`/`mailauth`; the practical price order
of the hosting options; that the documented token refresh drops to
anonymous on a 5xx is read from the doc's own snippet, not tested; the
merge behaviour of a visitor contact after recovery, read from
`linkVerified` without running it.

## What I recommend

Build the self-hosted standby as four small package PRs and one example
app, in this order: 1 (`emailMessageId` on the first message), 2
(`--keep-references` + `--update`, reserved range 900000), 4 (relay
standby URL), 3 (`api-standby` in the widget), then 6 (`examples/standby`
on Fly.io with SQLite) and 7 (docs). Ship Divio on the existing recipe
today with the `production.mdx` paragraph from item 7 and nothing else.
Hold item 5 (the export route) until the managed standby has a paying
tenant, because the self-hosted handback works with a file and the route
is a new secret to keep.

Rejected:

- **A second reference prefix for the standby** (`ACME-S`): breaks inbound
  threading after handback unless the package learns to look up imported
  references, which means a new column and four migrations. A reserved
  number range with the same prefix needs no schema change and keeps the
  customer's reference true before and after.
- **Automatic handback triggered by the health route**: turns a flapping
  primary into a split-brain generator; the idempotent import makes a
  manual (or host-cron) run safe and boring instead.
- **A warm standby fed by `onEvent`**: a write route on an always-on
  service plus latency inside the product's requests, and for the managed
  case it ends "we never see your data". If a host wants history on the
  standby, a periodic `export --since` through the same idempotent import
  does it with no new surface.
- **An agent token for break-glass sign-in**: a new login path in the
  package, which the roadmap rules out; Better Auth with an outside IdP or
  a magic link in the example app covers it.
- **Cloudflare Workers + D1 as the first hosting recipe**: the CRUD
  contract needs real transactions and `forUpdate` for references; D1's
  batch model does not give them.
- **A list of standby endpoints**: one attribute, one standby; a list is
  a later additive change if a host ever has two.

## Open questions for the maintainer

1. Reserved range: is 900000 with the same prefix acceptable as the
   documented convention, or do you want the standby's start value to be a
   config option (`referenceStart`) rather than a migrate-time `update`?
2. Should `--keep-references` be implied by `--source standby`, or stay an
   explicit flag for every source (an Intercom import would then also keep
   numeric references if they parse, which is probably unwanted)?
3. For item 3, do you want the failover policy in `createApi` (my
   recommendation, so the agent UI could reuse it) or confined to the
   widget?
4. Which IdP should `examples/standby` show: Google Workspace (most
   Swiss SMEs), GitHub (most of our likely early hosts), or only the magic
   link to keep the example dependency-light?
5. Does Divio's status page allow a script tag? If not, the A recipe
   needs a "Contact support" page on `www.divio.com` with
   `<helpdesk-conversations>` instead.
6. For the managed standby: cold only (my recommendation) or is a warm
   option with a DPA on the table from the start? It decides whether item
   5 needs an inbound mirror route as well, which I have left out.
7. Should the `continuity` inbox on the site (`site/lib/helpdesk.ts:37-41`)
   be where these design questions go to the private list, so the answers
   land in the same tool?
