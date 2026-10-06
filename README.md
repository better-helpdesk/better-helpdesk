<p align="center">
  <img alt="Better Helpdesk" src="https://raw.githubusercontent.com/better-helpdesk/better-helpdesk/main/.github/assets/logo.gif" width="96" height="96">
</p>

<h1 align="center">Better Helpdesk</h1>

<p align="center">
  The open-source helpdesk that lives inside your Next.js app.<br>
  Support inbox, ticketing and a lightweight CRM, in your Postgres, behind your login.
</p>

<p align="center">
  <a href="https://github.com/better-helpdesk/better-helpdesk/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/better-helpdesk/better-helpdesk/ci.yml?branch=main&label=CI"></a>
  <a href="https://www.npmjs.com/package/better-helpdesk"><img alt="npm version" src="https://img.shields.io/npm/v/better-helpdesk"></a>
  <a href="https://github.com/better-helpdesk/better-helpdesk/blob/main/LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/better-helpdesk/better-helpdesk"></a>
  <a href="https://nodejs.org/"><img alt="Node.js version" src="https://img.shields.io/node/v/better-helpdesk"></a>
</p>

<p align="center">
  <a href="#why-better-helpdesk">Why</a> ·
  <a href="#features">Features</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#guides">Guides</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="https://github.com/better-helpdesk/better-helpdesk/tree/main/examples/demo">Demo</a> ·
  <a href="https://github.com/better-helpdesk/better-helpdesk/releases">Releases</a>
</p>

Better Helpdesk is an npm package, not a service. You mount one route
handler, render one React component for your support team and drop one
widget onto your site. Conversations, contacts and companies live in a
`helpdesk` schema inside the Postgres you already run, and your app's own
session decides who is a customer and who is on the team. There is no second
system to deploy, no users to sync and no per-seat bill.

```sh
npm install better-helpdesk pg
```

## Why Better Helpdesk

Hosted helpdesks keep your customer data on their servers and charge per
seat. Self-hosted ones are a second application with its own login, database
and deploy pipeline, which you then integrate with your product. Better
Helpdesk is a library. It reuses what your app already has: its session, its
database, its deploy and its design tokens.

|                | Better Helpdesk              | Hosted (Intercom, Zendesk) | Self-hosted apps (Chatwoot, Libredesk) |
| -------------- | ---------------------------- | -------------------------- | -------------------------------------- |
| Runs           | inside your Next.js app      | on the vendor's servers    | as a separate app you operate          |
| Customer data  | your Postgres                | the vendor's database      | its own database                       |
| Sign-in        | your existing session        | separate agent accounts    | separate agent accounts                |
| Look and feel  | your CSS custom properties   | vendor theming             | vendor theming                         |
| Cost           | MIT, free                    | per seat, per month        | free, plus the hosting                 |

## Features

- **Shared inbox.** Several inboxes (say, support and sales), priorities,
  human-readable references like `ACME-1042`, internal notes, canned replies,
  keyboard navigation, saved views of the inbox filters for one agent or the
  whole team, and reminder emails when a customer has waited too long.
- **Lightweight CRM.** Contacts and companies taken from your app's identity,
  lead stages, deals with stages and values, logged activities, tags and
  custom fields.
- **Widget.** A `<helpdesk-widget>` web component with a React wrapper and a
  standalone script for sites that are not React. Cross-origin capable, with
  one qualifying question, a privacy link, a booking link, receipts for
  anonymous visitors, captured page context (URL, viewport, recent errors,
  referrer, UTM) and a dark theme.
- **Email.** Outbound through your own sender. Inbound through a webhook from
  any relay, verified against DKIM and threaded back into the conversation.
- **Everything optional is an adapter.** File storage, AI suggestions and
  draft replies, help-centre search and scheduled jobs are small interfaces
  you implement, or leave out.
- **Your identity, your data.** No passwords and no sessions are stored.
  Your `identify(request)`, or a signed identity token from another origin,
  decides who someone is. Retention and rate limits are yours to set.
- **English and German**, with every string overridable. Theming through
  `--helpdesk-*` CSS custom properties.
- **TypeScript, ESM, four runtime dependencies**: `drizzle-orm`, `zod`,
  `mailparser` and `mailauth`. Peer dependencies are `pg` and React 19.

## Compared with

As of 5 October 2026. Better Helpdesk's column describes `main` on that
date; the others come from their public pages, read on 2 October 2026 and
collected in [`docs/research/2026-10`](https://github.com/better-helpdesk/better-helpdesk/tree/main/docs/research/2026-10). Pricing is per
agent or seat per month, billed yearly, in US dollars. *By design* means a
deliberate scope decision; see [`ROADMAP.md`](https://github.com/better-helpdesk/better-helpdesk/blob/main/ROADMAP.md).

|                         | Better Helpdesk                                   | Chatwoot                                       | Libredesk                          | Intercom                                     | Zendesk                                       |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Runs as                 | a library in your Next.js app                     | a Rails app you host, or Chatwoot Cloud  | a Go binary you host         | hosted                                 | hosted                                  |
| Database                | your Postgres, `helpdesk` schema                  | its own Postgres and Redis               | its own Postgres and Redis   | the vendor's                           | the vendor's                            |
| Identity                | your session or a signed token                    | own logins; SAML on Enterprise           | own logins, OIDC             | own logins; SSO on Expert              | own logins                              |
| Licence                 | MIT                                               | MIT core, proprietary Enterprise         | AGPL-3.0                     | proprietary                             | proprietary                              |
| Pricing                 | free                                              | free to $99, Cloud and self-hosted       | free                         | $29 / $85 / $132                       | $19 / $55 / $115                        |
| Install                 | npm, one route, one component, one migrate        | Docker, Helm or a VM script              | binary, Docker Compose       | a script tag or mobile SDK             | a script tag                            |
| Upgrade                 | `pnpm up` plus migrate in your release            | new image, then a database task          | `--upgrade`, after a backup  | the vendor's                            | the vendor's                             |
| Channels                | widget, email through a relay                     | web, email, social, SMS, voice           | web, email, WhatsApp         | chat, email, phone, SMS, social        | web, email, social, voice, SMS          |
| Real-time delivery      | polling, 5 s in an open conversation              | WebSocket                                | WebSocket                    | yes, typing and seen                   | yes, typing and read                    |
| Captured context        | URL, viewport, locale, errors, UTM, your own data | language, country, referrer              | last visited pages          | pages visited, as a trigger            | device and pages viewed                 |
| Customer sees past conversations | yes, from your session                   | not documented                          | planned                      | yes                                    | yes                                     |
| Tags                    | yes                                               | yes                                      | yes                         | yes                                    | yes                                     |
| Snooze                  | yes                                               | yes                                     | yes                         | yes                                    | on-hold status                          |
| Collision indicator     | yes                                               | yes                                     | no                          | yes                                   | yes                                     |
| SLA                     | business hours and a reminder per inbox, by design | paid tier                               | yes                         | Expert                                | yes                                    |
| Automation              | `onEvent` in your code                            | yes                                     | yes                         | Advanced and up                        | yes                                    |
| Reporting               | SQL over your database                            | yes                                     | an overview page            | yes                                   | yes                                    |
| CSAT                    | no                                                | yes                                     | yes                         | yes                                   | yes                                    |
| Help centre             | search over your own docs, by design              | Startups and up                          | yes                         | yes                                    | yes                                     |
| AI                      | suggestions and drafts for the agent, by design   | Captain, paid tier                      | your OpenAI-compatible key  | Fin, $0.99 per outcome                | Copilot, +$50                           |
| Events out              | `onEvent` in your code                            | webhooks                                | webhooks                    | webhooks                              | webhooks                               |
| API                     | in-process functions, by design                   | REST                                    | REST with API keys          | REST                                   | REST                                    |
| Roles                   | `isAgent`, by design                              | custom roles, paid tier                 | custom roles                 | custom roles                          | custom roles on Enterprise             |
| Languages               | English and German                                | many, community-translated               | 13                          | many                                   | many                                    |
| Theming                 | CSS custom properties                             | widget settings                         | widget settings             | brand colour, logo, launcher          | widget presets and options             |

Intercom hosts in the EU only on Advanced or Expert annual contracts.

## How it works

One route handler serves four groups of routes under `basePath`. Your
`identify` function runs on every request, and everything is written to the
`helpdesk` schema in your database.

| Who                     | Uses                                                        | Talks to               |
| ----------------------- | ----------------------------------------------------------- | ---------------------- |
| Visitors and customers  | `<HelpdeskWidget />`, or `widget.js` on any site            | `{basePath}/widget/*`  |
| Your support team       | `<HelpdeskAdmin />`, open only when `identify` says `isAgent` | `{basePath}/agent/*`   |
| Your mail relay         | POSTs each raw inbound email                                | `{basePath}/inbound`   |
| Your scheduler          | `helpdesk.runJobs()`, or a POST with a bearer secret        | `{basePath}/jobs`      |

In this project an *agent* is a member of your support team. It is never an
AI; AI only ever produces a suggestion or a draft that a person reviews.

## Requirements

- Node.js 22.19 or newer
- PostgreSQL 14 or newer
- React 19 and `pg`, as peer dependencies
- Next.js 15 or newer for the examples below. The handler is a plain
  function from `Request` to `Response`, so any server with that shape can
  mount it.

## Quickstart

### 1. Install

```sh
npm install better-helpdesk pg
```

`react` and `react-dom` are peer dependencies that a Next.js app already has.

### 2. Create the schema

```sh
HELPDESK_DATABASE_URL=postgres://… npx better-helpdesk-migrate
```

The CLI opens one connection, creates the `helpdesk` schema and its tables,
and exits, so it fits into a release step next to your own migrations. It
also reads `APP_DATABASE_URL`, and `DATABASE_SSL=true` turns on TLS.

### 3. Let Next.js compile the package

```js
// next.config.mjs
import { withHelpdesk } from 'better-helpdesk/next';

export default withHelpdesk({
  // Both UIs request paths with a trailing slash. Without this every call
  // pays a redirect first, and a widget on another origin fails its CORS
  // preflight.
  trailingSlash: true,
});
```

### 4. Build the helpdesk and mount the handler

```ts
// lib/helpdesk.ts
import { buildHelpdesk, postgresAdapter } from 'better-helpdesk';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.HELPDESK_DATABASE_URL });

export const helpdesk = buildHelpdesk({
  db: postgresAdapter({ pool }),
  referencePrefix: 'ACME',
  adminUrl: 'https://app.example.com/helpdesk/',
  inboxes: {
    support: { receipt: true },
    sales: { public: true, allowedOrigins: ['https://www.example.com'] },
  },
  identify: async request => {
    const session = await getSession(request); // however your app does it
    if (!session) return null; // an anonymous visitor
    return {
      user: { id: session.user.id, email: session.user.email, emailVerified: true, name: session.user.name },
      orgs: session.orgs.map(org => ({ id: org.id, name: org.name })),
      isAgent: session.user.role === 'support',
    };
  },
});
```

```ts
// app/api/helpdesk/[...slug]/route.ts
import { helpdesk } from '@/lib/helpdesk';

const handle = (request: Request) => helpdesk.handler(request);
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE, handle as OPTIONS };
```

Two things to get right here:

- `isAgent` is the only thing that grants the agent UI, and `orgs` must list
  only the organisations the user is an active member of.
- `adminUrl` must be the URL your team actually opens in the browser. The
  handler refuses mutations from any other origin, so a mismatch turns every
  reply into a 403.

Worked `identify` functions for [Better Auth](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/identify-better-auth.ts)
and [Auth.js](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/identify-nextauth.ts) are in `examples/adapters/`, next to
one for every other adapter below.

### 5. Render the agent UI

```tsx
// app/helpdesk/[[...slug]]/page.tsx
import { HelpdeskAdmin } from 'better-helpdesk/admin';

export default function Page() {
  return <HelpdeskAdmin api="/api/helpdesk" basePath="/helpdesk" locale="en" />;
}
```

Put the page behind your own agent check as well. The API refuses anyone who
is not an agent either way.

### 6. Add the widget

```tsx
import { HelpdeskWidget } from 'better-helpdesk/widget';

export function Layout({ children }) {
  return (
    <>
      {children}
      <HelpdeskWidget inbox="support" locale="en" />
    </>
  );
}
```

Send a message from the widget, open `/helpdesk` as an agent and answer it.
That is the whole loop. [`examples/demo`](https://github.com/better-helpdesk/better-helpdesk/tree/main/examples/demo)
has it wired up end to end.

## Guides

### The widget

`HelpdeskWidget` takes `api`, `inbox`, `locale`, `types`, `orgId`,
`identityToken`, `appVersion`, `context` and `label`. `context` is a map of
strings that is attached to every conversation the widget opens, alongside
what it captures itself.

On a page that is not React, serve `widget.js` from the published package
(for instance by copying `node_modules/better-helpdesk/dist/widget.js` into
`public/` during your build) and load it:

```html
<script
  src="https://app.example.com/helpdesk/widget.js"
  data-api="https://app.example.com/api/helpdesk"
  data-inbox="sales"
  data-locale="de"
  async
></script>
```

Every `data-*` attribute maps to a widget prop. The script brings only the
widget it creates to life; a `<helpdesk-widget>` already in the page's markup
stays inert. `theme="auto"` on the element follows the operating system's
dark mode.

To run the widget on another origin, list that origin in the inbox's
`allowedOrigins` and keep `trailingSlash: true` in your Next config: a host
that redirects the widget's requests fails the CORS preflight.

The widget dispatches DOM events such as `helpdesk:open`,
`helpdesk:message-sent` and `helpdesk:booking-clicked`, so analytics can
listen without touching the package.

### A Support page in your app

`HelpdeskConversations` is the widget's conversation list and threads in the
page itself, for a Support page: no launcher and nothing to close, and a
signed-in customer sees their own conversations and the ones their company
shares, as in the widget. It takes the same props as `HelpdeskWidget` except
`label`, uses the same routes and `--helpdesk-*` tokens, and
`--helpdesk-page-height` sets its height (640px by default).

```tsx
import { HelpdeskConversations } from 'better-helpdesk/widget';

<HelpdeskConversations inbox="support" locale="de" />
```

Like the widget it renders into its own shadow root, so your page's styles
and its styles never meet; outside React, `defineHelpdeskConversations()`
registers `<helpdesk-conversations>` with the same attributes.

### Signed-in users on another origin

When the widget runs where `identify` cannot see your session, your backend
signs an HS256 JWT with `identityTokenSecret` and the page passes it as
`identity-token` (`identityToken` in React). Every signed-in user holds such a
token, so the secret must resist offline guessing: the helpdesk refuses one
shorter than 32 bytes. `openssl rand -base64 32` makes one.

```ts
import { signIdentityToken } from 'better-helpdesk';

const token = signIdentityToken(
  {
    sub: user.id,
    email: user.email,
    email_verified: user.emailVerified,
    name: user.name,
    orgs: [{ id: org.id, name: org.name }],
  },
  process.env.HELPDESK_IDENTITY_SECRET!,
  { expiresInSeconds: 3600 }
);
```

Any JWT library works: `sub` and `exp` are required. A forged or expired
token is refused with 401, and a token never grants the agent UI.

### Email

**Outbound** mail goes through your sender. The adapter receives one of five
message kinds and decides how each is rendered and sent:

```ts
email: {
  async send(message) {
    switch (message.kind) {
      case 'customer-reply':
        return mailer.send({
          to: message.to,
          subject: `Re: ${message.subject ?? message.reference}`,
          text: message.body,
          replyTo: message.replyTo,
          inReplyTo: message.inReplyTo,
        });
      case 'customer-receipt':
        return mailer.send({ to: message.to, subject: `We got your message (${message.reference})`, text: receiptText(message) });
      case 'agent-new':
      case 'agent-reminder':
        return mailer.send({
          to: message.to,
          subject: message.reopened ? `Reopened: ${message.subject}` : message.subject,
          text: `${message.body}\n\n${message.url}`,
        });
      case 'agent-mention':
        return mailer.send({
          to: message.to,
          subject: `${message.authorName} mentioned you in ${message.reference}`,
          text: `${message.body}\n\n${message.url}`,
        });
    }
  },
},
```

`mailer` and `receiptText` stand for whatever you send mail with;
[`email-resend.ts`](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/email-resend.ts) is the same adapter on Resend. A receipt
carries the responder's name, their away date when the team is out, and the
inbox's booking link, so your template can show them. An `agent-new` with
`reopened: true` means a customer wrote on a resolved conversation; its body
is what they wrote then. An `agent-mention` goes to each teammate picked with
`@` in an internal note; its body is the note.

**Inbound** mail arrives through a webhook. Any relay that can forward a raw
message to a URL will do. [`relays/`](https://github.com/better-helpdesk/better-helpdesk/tree/main/relays)
has a relay for Postmark's inbound webhook and a Cloudflare Email Worker,
and recipes for forwarding support@ from Google Workspace and Microsoft 365
with two weeks of dual delivery before the cutover. Configure:

```ts
inboundWebhookSecret: process.env.HELPDESK_INBOUND_SECRET,
inboundInbox: 'support',
replyToAddress: reference => `support+${reference}@example.com`,
```

The relay POSTs the message as `message/rfc822` to `{basePath}/inbound/`
with `Authorization: Bearer <secret>`. A reply finds its conversation through
`In-Reply-To` and `References`, or through the plus-addressed reference that
`replyToAddress` put into the Reply-To header. DKIM is verified against the
From domain; set `dnsResolver` if the system resolver is not the one to use.

### Jobs and retention

Run the scheduled work from your own scheduler, either in process or over
HTTP:

```ts
await helpdesk.runJobs({ budgetMs: 20_000 });
```

```sh
curl -X POST -H "Authorization: Bearer $HELPDESK_JOBS_SECRET" https://app.example.com/api/helpdesk/jobs/
```

A run wakes due snoozes, then sends due reminder emails, deletes resolved conversations that are
older than `retentionDays`, then works through queued jobs until the budget
is spent. [`jobs-vercel-cron.ts`](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/jobs-vercel-cron.ts) runs it from a
Vercel cron route, and [`jobs-interval.ts`](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/jobs-interval.ts) from a timer
in a long-running server.

### Events

`onEvent` is told about every new conversation, every new message and every
change an agent makes, once it is stored. Use it to post to Slack, open an
issue in your tracker, record an analytics event or assign the conversation.
There is no webhook: your own function is the integration.

| `kind`                 | Fields                                                                     |
| ---------------------- | -------------------------------------------------------------------------- |
| `conversation.created` | `conversation`, `message` (the first one). From the widget or by email.    |
| `message.created`      | `conversation` as it stands after the message, `message`, `internal`.      |
| `conversation.updated` | `conversation`, `before` (the changed fields as they were), `agentId`.     |

The handler is awaited inside the request, including the email relay's
webhook, so keep it fast or put the work on your own queue. What it throws is
logged and never changes the response.

```ts
export const helpdesk = buildHelpdesk({
  // …
  onEvent: async event => {
    const { conversation } = event;
    const urgentBug = conversation.type === 'bug' && conversation.priority === 'urgent';
    const justBecameOne =
      event.kind === 'conversation.created' ||
      (event.kind === 'conversation.updated' && ('type' in event.before || 'priority' in event.before));
    if (!urgentBug || !justBecameOne) return;
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: `Urgent bug ${helpdesk.reference(conversation)}: ${conversation.subject}`,
      }),
    });
  },
});
```

Round-robin assignment to the agents who are not away:

```ts
onEvent: async event => {
  if (event.kind !== 'conversation.created') return;
  const now = new Date();
  const agents = (await helpdesk.store.listAgents()).filter(
    agent => !agent.awayUntil || agent.awayUntil <= now
  );
  const next = agents[event.conversation.number % agents.length];
  if (!next) return;
  await helpdesk.store.updateConversation(event.conversation.id, { assigneeId: next.id });
},
```

Writes through `helpdesk.store` raise no events, so a handler cannot set off
itself. A customer reply that reopens a resolved conversation raises only
`message.created`; its `conversation.status` is `open` again.

### Calling it from your own code

The object `buildHelpdesk()` returns is the API. Your server code calls it
in process, so there is no API token to issue, no webhook to register and no
REST client to install.

To open a conversation when a payment fails, sign an identity token for the
customer (this needs `identityTokenSecret`, as in
[Signed-in users on another origin](#signed-in-users-on-another-origin)) and
hand `createConversation` a request that carries it. The request carries no
session, so `identify` returns null for it and the token decides who the
customer is:

```ts
// app/api/billing/webhook/route.ts
import { signIdentityToken } from 'better-helpdesk';
import { helpdesk } from '@/lib/helpdesk';

export async function POST(request: Request) {
  const event = await verifyBillingWebhook(request); // however your provider does it
  if (event.type !== 'invoice.payment_failed') return new Response(null, { status: 204 });
  const { user, invoice } = event;

  const token = signIdentityToken(
    { sub: user.id, email: user.email, email_verified: true, name: user.name },
    process.env.HELPDESK_IDENTITY_SECRET!,
    { expiresInSeconds: 60 }
  );
  const { conversation } = await helpdesk.createConversation(
    new Request(request.url, { headers: { 'x-helpdesk-identity': token } }),
    {
      inbox: 'billing',
      type: 'question',
      subject: `Payment failed for invoice ${invoice.number}`,
      body: `The card on file was declined for invoice ${invoice.number}.`,
    }
  );
  return Response.json({ reference: conversation && helpdesk.reference(conversation) });
}
```

The conversation lands on the customer's contact, creating it if they never
wrote in, and goes through the same path as one from the widget: agents are
notified, AI triage runs when `ai` is set and `onEvent` hears
`conversation.created`. The body is stored as the customer's first message.
Give `billing` an entry in `inboxes` without `receipt`, or the customer is
mailed a receipt for a message they did not send.

To put a "plan upgraded" event on a contact's timeline from your billing
code:

```ts
await helpdesk.track({
  externalUserId: user.id,
  event: 'plan.upgraded',
  props: { from: 'starter', to: 'team' },
});
```

`track` returns `false` and records nothing when that user has no contact
yet. Pass `externalOrgId` instead to put the event on the company's
timeline.

For reads, `helpdesk.store` holds the queries the agent UI runs, such as
`listInbox`, `listContacts` and `listActivities`; writes through it skip
`onEvent`. Both recipes are type-checked in
[`examples/demo/lib/recipes.ts`](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/demo/lib/recipes.ts).

### Links to your own tools

`links` gives agents one click from a customer to the pages you already have
for them. It gets the contact and the company with your own ids, `userId`
for someone your app signed in and `orgId` for their organisation, and
returns labelled URLs:

```ts
links: (contact, company) => [
  ...(contact?.userId
    ? [{ label: { en: 'Open in admin', de: 'In der Verwaltung öffnen' }, url: `https://app.example.com/admin/users/${contact.userId}` }]
    : []),
  ...(company?.orgId
    ? [{ label: { en: 'Billing' }, url: `https://billing.example.com/orgs/${company.orgId}` }]
    : []),
],
```

They show under the contact in a conversation, and on the contact and
company pages, and open in a new tab. Only `http` and `https` URLs are
shown; if the hook throws, the page shows none and the error is logged.

### Storage, AI and help search

- `storage` presigns uploads and downloads and stores attachments, so an
  S3-compatible bucket fits directly. The package stores keys and metadata.
  `maxAttachmentBytes` caps the size.
- `ai.generate({ system, prompt, schema })` returns an object that satisfies
  the given Zod schema. The package uses it for triage suggestions (type,
  priority, title, likely duplicates) and for draft replies that an agent
  accepts, edits or dismisses.
- `help.search(query, locale)` returns `{ title, url, excerpt }` results that
  the widget suggests to customers.

Worked adapters: [S3 with presigned POST and GET](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/storage-s3.ts),
[the Anthropic SDK](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/ai-anthropic.ts) and
[a static JSON index of your docs](https://github.com/better-helpdesk/better-helpdesk/blob/main/examples/adapters/help-search.ts).

### Reporting from your own database

Everything lives in the `helpdesk` schema of your Postgres, so reports are
SQL. Median first response, counting only replies the customer saw:

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY first_reply - c.created_at)
  AS median_first_response
FROM helpdesk.conversation c
JOIN LATERAL (
  SELECT min(m.created_at) AS first_reply
  FROM helpdesk.message m
  WHERE m.conversation_id = c.id AND m.author_type = 'agent' AND NOT m.internal
) r ON first_reply IS NOT NULL
WHERE c.created_at > now() - interval '30 days' AND c.merged_into_id IS NULL;
```

Median time to resolution:

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY resolved_at - created_at)
  AS median_resolution
FROM helpdesk.conversation
WHERE status = 'resolved' AND resolved_at > now() - interval '30 days'
  AND merged_into_id IS NULL;
```

Volume per inbox and type:

```sql
SELECT inbox, type, count(*) AS conversations
FROM helpdesk.conversation
WHERE created_at > now() - interval '30 days' AND merged_into_id IS NULL
GROUP BY inbox, type
ORDER BY conversations DESC;
```

For dashboards, point Metabase or a PostHog data warehouse source at the same
database with a read-only role limited to the `helpdesk` schema.

### When someone leaves the team

Call `helpdesk.removeAgent(user.id)` when a user stops being an agent in your
app. They stop receiving agent emails until they next open the agent UI as an
agent. Agents can also remove each other under Settings. As a backstop for a
host that cannot always tell, an agent who has not opened the agent UI for 30
days gets no agent emails until they do again.

### Theming

Both UIs read CSS custom properties from an ancestor, so they inherit into
the widget's shadow root:

```css
:root {
  --helpdesk-accent: #0f766e;
  --helpdesk-accent-hover: #115e59;
  --helpdesk-accent-fg: #ffffff;
  --helpdesk-radius: 8px;
}
```

| Scope     | Properties                                                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared    | `--helpdesk-font`, `-bg`, `-fg`, `-muted`, `-border`, `-subtle`, `-accent`, `-accent-hover`, `-accent-fg`, `-focus`, `-danger`, `-radius`                                             |
| Widget    | `--helpdesk-launcher-bg`, `-launcher-fg`, `-panel-header-bg`, `-panel-header-fg` (both default to the accent), `-panel-border`, `-offset-bottom`, `-shadow`                             |
| Agent UI  | `--helpdesk-header-bg` (table heads and avatars), `-note`, `-note-border`, `-warning`                                                                                                 |

`--helpdesk-radius` drives every corner: cards and panels take it as given,
controls and the elements inside them step down from it and dialogs step up,
so the corners stay concentric at any value. Shadows are tinted from
`--helpdesk-fg`, and `--helpdesk-shadow: none` turns the widget's off.
Without `--helpdesk-note` the note colour is mixed from
`--helpdesk-note-border` and the background.

`--helpdesk-focus` colours the focus ring and nothing else; unread dots, the
selected tab and the agent note take the accent. For a dark theme, set the
panel header too: a light accent reads well on
buttons and links, but not as the header's background.

### Languages

Both UIs ship in English and German (`locale="en"` or `"de"`). The widget
falls back to the browser's language. Inbox copy such as `name`, `title`,
`replyPromise` and the qualifying question is given per locale in the
config, and `HelpdeskAdmin` takes a `messages` prop that overrides any of the
package's own strings by key, for example `admin.inbox`.

### Switching from another helpdesk

[`docs/switching.md`](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/switching.md) walks through it for Intercom,
Zendesk, a shared Gmail inbox and Chatwoot. In short:

- **Import contacts, companies and saved replies** from CSV with
  `npx better-helpdesk-import contacts people.csv` and
  `npx better-helpdesk-import canned replies.csv`, against the same
  `HELPDESK_DATABASE_URL` as the migrations. Running it again adds what is
  new and undoes nothing an agent changed.

- **Pick a cutover date.** New conversations start here from that date;
  history is not imported. Keep the old tool read-only for 60 to 90 days so
  agents can look up what came before.
- **Re-point support@** with the recipe for your mail provider in
  [`relays/`](https://github.com/better-helpdesk/better-helpdesk/tree/main/relays),
  with two weeks of dual delivery before the cutover.
- **Swap the widget script** for [the widget](#the-widget) on the cutover
  date.
- **Identity verification carries over.** Where your backend computes
  Intercom's `user_hash` or Chatwoot's `identifier_hash` for a user id, it
  signs an [identity token](#signed-in-users-on-another-origin) with that
  id as `sub` instead.

## Configuration

Everything `buildHelpdesk` accepts. The types in `better-helpdesk` carry the
full documentation.

| Field                                                                 | Required | What it does                                                                                            |
| --------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------- |
| `db`                                                                  |   yes    | `postgresAdapter({ pool })` over a `pg.Pool`.                                                           |
| `referencePrefix`                                                     |   yes    | Prefix of the references customers and emails use, as in `ACME-1042`.                                  |
| `adminUrl`                                                            |   yes    | Absolute URL of the agent UI. Agent emails link to it, and mutations must come from its origin.         |
| `inboxes`                                                             |   yes    | The inboxes by key. See the table below.                                                                |
| `identify(request)`                                                   |   yes    | Your session as `{ user, orgs, isAgent }`, or `null` for an anonymous visitor.                         |
| `basePath`                                                            |          | Mount path of the handler. Default `/api/helpdesk`.                                                     |
| `types`                                                               |          | Conversation types. Default `question`, `bug`, `feature`, `lead`.                                       |
| `teamName`, `agentTitles`                                             |          | How the team and individual agents are named where they sign, per locale.                               |
| `identityTokenSecret`                                                 |          | Verifies identity tokens from other origins, 32 bytes or more. Consulted only when `identify` returns `null`. |
| `resolveContext(externalOrgId)`, `orgNames(externalOrgIds)`           |          | Extra context and display names for your organisations.                                                 |
| `links(contact, company)`                                             |          | Links into your own tools (your admin, Stripe, a CRM), shown with the contact and company. `http(s)` only. |
| `storage`, `maxAttachmentBytes`                                       |          | Attachments. Without `storage` there are none.                                                          |
| `email.send(message)`                                                 |          | Outbound mail.                                                                                          |
| `inboundWebhookSecret`, `inboundInbox`, `replyToAddress`, `dnsResolver` |        | Inbound mail.                                                                                           |
| `help.search(query, locale)`                                          |          | Help-centre search for the widget.                                                                      |
| `ai.generate({ system, prompt, schema })`                             |          | Triage suggestions and draft replies for agents.                                                        |
| `onEvent(event)`                                                      |          | Told about new conversations, new messages and agent changes. See [Events](#events).                   |
| `jobsSecret`                                                          |          | Bearer secret for `POST {basePath}/jobs`.                                                               |
| `clientIp(request)`                                                   |          | How to read the caller's address behind your proxy. Default: the last `X-Forwarded-For` hop.           |
| `leadStages`, `dealStages`, `customFields`                            |          | The CRM's ladders and fields for contacts, companies and deals.                                         |
| `retentionDays`                                                       |          | Delete resolved conversations this many days after resolution.                                          |
| `anonymousRateLimit`, `customerRateLimit`                             |          | Posts allowed per hour, per anonymous IP and per signed-in customer.                                    |

Each inbox is configured on its own:

| Field                            | What it does                                                                        |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `name`                           | What agents see instead of the key, per locale.                                     |
| `public`                         | Anonymous visitors may open conversations here.                                     |
| `allowedOrigins`                 | Origins allowed to call the widget API cross-origin.                                |
| `reminderAfterHours`             | Email the agents when a customer has waited this long.                              |
| `hours`                          | Opening hours. Reminders and waiting colours then count only these.                 |
| `defaultPriority`                | Priority new conversations start with, for example `high` for sales.                |
| `title`, `replyPromise`          | The widget's header and what it promises about replies, per locale.                 |
| `qualify`                        | One qualifying question with options, asked before the first message.               |
| `privacyUrl`                     | Linked under the first-message form, per locale.                                    |
| `receipt`                        | Email a receipt to people who write in.                                             |
| `bookingUrl`, `bookingLink(ref)` | A meeting link offered once someone has written, in the widget and in the receipt.  |

`hours` takes an IANA time zone and spans per weekday, `mon` to `sun`. A day
left out is closed, `24:00` ends a span at midnight, and a span whose end is
not after its start runs into the next day:

```ts
support: {
  reminderAfterHours: 4,
  hours: {
    timeZone: 'Europe/Zurich',
    weekly: {
      mon: [['08:00', '12:00'], ['13:00', '17:00']],
      tue: [['08:00', '17:00']],
      wed: [['08:00', '17:00']],
      thu: [['08:00', '17:00']],
      fri: [['08:00', '15:00']],
    },
  },
},
```

Four hours there are four open hours: a message at 14:00 on Friday reminds
the agents at 11:00 on Monday. While the inbox is closed, the receipt and the
widget say when the team is back. Without `hours`, every hour counts and the
team is back on the next weekday.

Statuses are `open`, `pending` and `resolved`, read from the customer's
side. Priorities are `low`, `normal`, `high` and `urgent`. The default lead
stages are `lead`, `qualified`, `customer`, `churned`, and the default deal
stages `new`, `qualified`, `proposal`, `won`, `lost`.

## Demo

Try it without installing anything at
[better-helpdesk.com/demo](https://better-helpdesk.com/demo/): write in as a
customer, answer as the agent, and see the rows land in Postgres. Everyone
shares that inbox, and it starts over every quarter hour.

[`examples/demo`](https://github.com/better-helpdesk/better-helpdesk/tree/main/examples/demo)
is Harbor, a pretend shipping product with the package installed the way this
README describes: one route handler, the agent UI at `/helpdesk`, the widget
in the corner. With a local Postgres running:

```sh
pnpm install
cp examples/demo/.env.example examples/demo/.env.local
pnpm --filter better-helpdesk-demo db:migrate
pnpm --filter better-helpdesk-demo dev
```

Its README explains the role switcher and what the demo deliberately gets
wrong. CI builds and runs the same app against the packed tarball on the
current and the previous major of Next.js, and against `next@canary` once a
week.

## Status

Better Helpdesk is young and under active development. Until 1.0 a minor
version may change the API, and every release's notes list the pull requests
it contains. Releases are published to npm with provenance through trusted
publishing. The architecture is settled, though: embedded in the host, Next.js
first, Postgres only, the host owns identity. A standalone server, a hosted
mode or its own login are not planned.
[`ROADMAP.md`](https://github.com/better-helpdesk/better-helpdesk/blob/main/ROADMAP.md)
lists what Better Helpdesk will not do and what comes next.

## Contributing

Issues and pull requests are welcome. Before you start, read
[`AGENTS.md`](https://github.com/better-helpdesk/better-helpdesk/blob/main/AGENTS.md)
for how the repository works and what is off-limits, and
[`CONTEXT.md`](https://github.com/better-helpdesk/better-helpdesk/blob/main/CONTEXT.md)
for the vocabulary the code uses.

```sh
pnpm install --frozen-lockfile
pnpm lint                 # Biome, then tsc --noEmit
pnpm test                 # unit tests
TEST_DATABASE_URL=postgres://postgres@localhost:5432/db pnpm test:integration
```

The integration tests create a `helpdesk_test` database next to the one the
URL names. A `postgres:18-alpine` container started with
`POSTGRES_HOST_AUTH_METHOD=trust` is enough. Green CI (lint, both test
suites, the tarball smoke test and the demo build) is the bar for every pull
request. Commit messages follow the conventional form in the history
(`fix(widget): …`, `feat(admin): …`), and pull request titles become the
release notes, so write them as changelog lines.

## Security

Better Helpdesk stores no passwords and no sessions. Mutations are checked
against the agent UI's origin, inbound mail is verified against DKIM,
identity tokens are signed and expire, and anonymous and customer traffic is
rate limited. Attachments go to your storage, never through the package's
own hosting.

If you find a vulnerability, please do not open a public issue. Report it
privately through
[GitHub's security advisories](https://github.com/better-helpdesk/better-helpdesk/security/advisories/new)
for this repository.

## License

[MIT](https://github.com/better-helpdesk/better-helpdesk/blob/main/LICENSE) © 2026 devguard AG
