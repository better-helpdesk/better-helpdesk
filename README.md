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
  keyboard navigation, and reminder emails when a customer has waited too
  long.
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
deliberate scope decision; see [Status](#status).

|                         | Better Helpdesk                                   | Chatwoot                                       | Libredesk                          | Intercom                                     | Zendesk                                       |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------- | ---------------------------------- | -------------------------------------------- | --------------------------------------------- |
| Runs as                 | a library in your Next.js app                     | a Rails app you host, or Chatwoot Cloud [^c1]  | a Go binary you host [^l1]         | hosted [^i1]                                 | hosted [^z1]                                  |
| Database                | your Postgres, `helpdesk` schema                  | its own Postgres and Redis [^c2]               | its own Postgres and Redis [^l2]   | the vendor's [^i1]                           | the vendor's [^z1]                            |
| Identity                | your session or a signed token                    | own logins; SAML on Enterprise [^c3]           | own logins, OIDC [^l3]             | own logins; SSO on Expert [^i2]              | own logins [^z1]                              |
| Licence                 | MIT                                               | MIT core, proprietary Enterprise [^c4]         | AGPL-3.0 [^l4]                     | proprietary [^i1]                             | proprietary [^z1]                              |
| Pricing                 | free                                              | free to $99, Cloud and self-hosted [^c3]       | free [^l5]                         | $29 / $85 / $132 [^i2]                       | $19 / $55 / $115 [^z2]                        |
| Install                 | npm, one route, one component, one migrate        | Docker, Helm or a VM script [^c5]              | binary, Docker Compose [^l6]       | a script tag or mobile SDK [^i3]             | a script tag [^z4]                            |
| Upgrade                 | `pnpm up` plus migrate in your release            | new image, then a database task [^c5]          | `--upgrade`, after a backup [^l7]  | the vendor's [^i1]                            | the vendor's [^z1]                             |
| Channels                | widget, email through a relay                     | web, email, social, SMS, voice [^c6]           | web, email, WhatsApp [^l8]         | chat, email, phone, SMS, social [^i4]        | web, email, social, voice, SMS [^z3]          |
| Real-time delivery      | polling, 5 s in an open conversation              | WebSocket [^c7]                                | WebSocket [^l9]                    | yes, typing and seen [^i5]                   | yes, typing and read [^z4]                    |
| Captured context        | URL, viewport, locale, errors, UTM, your own data | language, country, referrer [^c8]              | last visited pages [^l10]          | pages visited, as a trigger [^i6]            | device and pages viewed [^z5]                 |
| Customer sees past conversations | yes, from your session                   | not documented [^c1]                          | planned [^l8]                      | yes [^i7]                                    | yes [^z6]                                     |
| Tags                    | yes                                               | yes [^c9]                                      | yes [^l10]                         | yes [^i8]                                    | yes [^z7]                                     |
| Snooze                  | yes                                               | yes [^c10]                                     | yes [^l10]                         | yes [^i9]                                    | on-hold status [^z8]                          |
| Collision indicator     | yes                                               | yes [^c11]                                     | no [^l10]                          | yes [^i10]                                   | yes [^z9]                                     |
| SLA                     | business hours and a reminder per inbox, by design | paid tier [^c3]                               | yes [^l10]                         | Expert [^i11]                                | yes [^z10]                                    |
| Automation              | `onEvent` in your code                            | yes [^c12]                                     | yes [^l11]                         | Advanced and up [^i2]                        | yes [^z11]                                    |
| Reporting               | SQL over your database                            | yes [^c13]                                     | an overview page [^l10]            | yes [^i12]                                   | yes [^z12]                                    |
| CSAT                    | no                                                | yes [^c14]                                     | yes [^l10]                         | yes [^i13]                                   | yes [^z13]                                    |
| Help centre             | search over your own docs, by design              | Startups and up [^c3]                          | yes [^l12]                         | yes [^i2]                                    | yes [^z2]                                     |
| AI                      | suggestions and drafts for the agent, by design   | Captain, paid tier [^c15]                      | your OpenAI-compatible key [^l13]  | Fin, $0.99 per outcome [^i14]                | Copilot, +$50 [^z2]                           |
| Events out              | `onEvent` in your code                            | webhooks [^c16]                                | webhooks [^l14]                    | webhooks [^i15]                              | webhooks [^z14]                               |
| API                     | in-process functions, by design                   | REST [^c17]                                    | REST with API keys [^l10]          | REST [^i1]                                   | REST [^z1]                                    |
| Roles                   | `isAgent`, by design                              | custom roles, paid tier [^c18]                 | custom roles [^l3]                 | custom roles [^i16]                          | custom roles on Enterprise [^z15]             |
| Languages               | English and Swiss German                          | many, community-translated [^c1]               | 13 [^l15]                          | many [^i1]                                   | many [^z1]                                    |
| Theming                 | CSS custom properties                             | widget settings [^c19]                         | widget settings [^l16]             | brand colour, logo, launcher [^i17]          | widget presets and options [^z16]             |

Intercom hosts in the EU only on Advanced or Expert annual contracts
[^i18].

[^c1]: [github.com/chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) and the [Chatwoot report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/chatwoot.md).
[^c2]: [Chatwoot requirements](https://developers.chatwoot.com/self-hosted/deployment/requirements).
[^c3]: [Chatwoot pricing](https://www.chatwoot.com/pricing) and [self-hosted plans](https://www.chatwoot.com/pricing/self-hosted-plans).
[^c4]: [Chatwoot Enterprise Edition](https://www.chatwoot.com/hc/user-guide/articles/1677776492-enterprise-edition).
[^c5]: [Chatwoot Docker deployment](https://developers.chatwoot.com/self-hosted/deployment/docker).
[^c6]: [Chatwoot report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/chatwoot.md), "Other channels".
[^c7]: [Chatwoot WebSocket connection](https://www.chatwoot.com/hc/user-guide/articles/1677691027-how-to-setup-a-web_socket-connection).
[^c8]: [Chatwoot conversation filters](https://www.chatwoot.com/hc/user-guide/articles/1677688192-how-to-use-conversation-filters).
[^c9]: [Chatwoot labels](https://www.chatwoot.com/hc/user-guide/articles/1677496066-how-to-add-labels).
[^c10]: [Chatwoot report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/chatwoot.md), "Snooze".
[^c11]: [Chatwoot agent collision](https://www.chatwoot.com/hc/user-guide/articles/1732243644-preventing-agent-collision).
[^c12]: [Chatwoot automation](https://www.chatwoot.com/hc/user-guide/articles/1677689800-how-to-use-automation).
[^c13]: [Chatwoot reports](https://www.chatwoot.com/hc/user-guide/articles/1677693459-how-to-read-overview-reports-realtime).
[^c14]: [Chatwoot CSAT](https://www.chatwoot.com/hc/user-guide/articles/1677503828-how-to-enable-csat-surveys).
[^c15]: [Captain on self-hosted installations](https://www.chatwoot.com/hc/user-guide/articles/1755284287-how-to-enable-captain-on-self_hosted-installations) and [Captain credits](https://www.chatwoot.com/hc/user-guide/articles/1765223602-how-ai-credits-work-in-captain).
[^c16]: [Chatwoot webhooks](https://www.chatwoot.com/hc/user-guide/articles/1677693021-how-to-use-webhooks).
[^c17]: [Chatwoot API](https://developers.chatwoot.com/api-reference/introduction).
[^c18]: [Chatwoot roles and permissions](https://www.chatwoot.com/hc/user-guide/articles/1741923706-manage-team-access-control-with-flexible-role_based-permissions).
[^c19]: [Chatwoot live chat settings](https://www.chatwoot.com/hc/user-guide/articles/1677580558-website-live-chat-settings-explained).
[^l1]: [github.com/abhinavxd/libredesk](https://github.com/abhinavxd/libredesk).
[^l2]: `config.sample.toml` in [the Libredesk repository](https://github.com/abhinavxd/libredesk).
[^l3]: [Libredesk roles](https://docs.libredesk.io/roles/overview.md).
[^l4]: `LICENSE` in [the Libredesk repository](https://github.com/abhinavxd/libredesk).
[^l5]: [libredesk.io](https://libredesk.io/).
[^l6]: [Libredesk installation](https://docs.libredesk.io/getting-started/installation.md).
[^l7]: [Libredesk releases](https://github.com/abhinavxd/libredesk/releases).
[^l8]: `README.md` and `ROADMAP.md` in [the Libredesk repository](https://github.com/abhinavxd/libredesk).
[^l9]: [Libredesk widget API](https://docs.libredesk.io/api-reference/widget-api.md).
[^l10]: [Libredesk report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/libredesk.md), section 2, from the Libredesk schema and docs.
[^l11]: [Libredesk automation models](https://github.com/abhinavxd/libredesk/blob/main/internal/automation/models/models.go).
[^l12]: [Libredesk help center](https://docs.libredesk.io/configuration/help-center.md).
[^l13]: [Libredesk AI](https://docs.libredesk.io/configuration/ai.md).
[^l14]: [Libredesk webhooks](https://docs.libredesk.io/configuration/webhooks.md).
[^l15]: [Libredesk `i18n`](https://github.com/abhinavxd/libredesk/tree/main/i18n).
[^l16]: [Libredesk live chat](https://docs.libredesk.io/configuration/livechat.md).
[^i1]: [Intercom report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/intercom.md), sections 1 and 2.
[^i2]: [Intercom pricing](https://www.intercom.com/pricing).
[^i3]: [Installing Intercom](https://developers.intercom.com/installing-intercom/web/methods).
[^i4]: [Intercom report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/intercom.md), "Channels".
[^i5]: [Intercom real-time messaging](https://www.intercom.com/help/en/articles/258-real-time-messaging-explained).
[^i6]: [Intercom workflow triggers](https://www.intercom.com/help/en/articles/7434613-how-to-trigger-a-workflow).
[^i7]: [Intercom customer portal](https://www.intercom.com/help/en/articles/8450754-customer-portal-explained).
[^i8]: [Intercom inbox search and filter](https://www.intercom.com/help/en/articles/6516006-inbox-search-and-filter).
[^i9]: [Intercom snooze](https://www.intercom.com/help/en/articles/6564538-snooze-a-conversation).
[^i10]: [Intercom changes](https://www.intercom.com/changes/en).
[^i11]: [Intercom SLAs](https://www.intercom.com/help/en/articles/6546152-set-slas-for-conversations-and-tickets).
[^i12]: [Intercom reports](https://www.intercom.com/help/en/articles/200-intercom-reports-explained).
[^i13]: [Intercom conversation ratings](https://www.intercom.com/help/en/articles/9634546-ask-customers-for-a-conversation-rating).
[^i14]: [Fin pricing](https://fin.ai/pricing).
[^i15]: [Intercom webhooks](https://developers.intercom.com/docs/references/webhooks/webhook-models).
[^i16]: [Intercom teammate permissions](https://www.intercom.com/help/en/articles/176-teammate-permissions-how-to-control-workspace-access).
[^i17]: [Customize the Messenger](https://www.intercom.com/help/en/articles/6612589-set-up-and-customize-the-messenger).
[^i18]: [Intercom regional data hosting](https://www.intercom.com/help/en/articles/6124430-regional-data-hosting).
[^z1]: [Zendesk report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/zendesk.md), sections 1 and 2.
[^z2]: [Zendesk pricing](https://www.zendesk.com/pricing/).
[^z3]: [Zendesk report](https://github.com/better-helpdesk/better-helpdesk/blob/main/docs/research/2026-10/zendesk.md), "Channels".
[^z4]: [Zendesk Web Widget capabilities](https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/capabilities/).
[^z5]: [Customer context in a ticket](https://support.zendesk.com/hc/en-us/articles/4408829170458-Viewing-customer-context-in-a-ticket).
[^z6]: [Zendesk customer portal](https://support.zendesk.com/hc/en-us/articles/4408846805530-Submitting-and-tracking-requests-in-the-help-center-Customer-Portal).
[^z7]: [Zendesk ticket tags](https://support.zendesk.com/hc/en-us/articles/4408835059482-Working-with-ticket-tags).
[^z8]: [Zendesk ticket statuses](https://support.zendesk.com/hc/en-us/articles/8263915942938-About-the-ticket-lifecycle-and-ticket-statuses).
[^z9]: [Zendesk agent collision](https://support.zendesk.com/hc/en-us/articles/9186264597146-Avoiding-agent-collision).
[^z10]: [Zendesk SLA policies](https://support.zendesk.com/hc/en-us/articles/5600997516058-About-SLA-policies-and-how-they-work).
[^z11]: [Zendesk triggers](https://support.zendesk.com/hc/en-us/articles/4408893545882-Ticket-trigger-conditions-and-actions-reference).
[^z12]: [Zendesk Support dashboard](https://support.zendesk.com/hc/en-us/articles/4408835985434-Overview-of-the-Zendesk-Support-dashboard).
[^z13]: [Zendesk CSAT](https://support.zendesk.com/hc/en-us/articles/4408886173338-About-the-CSAT-Customer-Satisfaction-user-experience-for-email-and-messaging).
[^z14]: [Zendesk webhooks](https://developer.zendesk.com/documentation/webhooks/creating-and-monitoring-webhooks/).
[^z15]: [Zendesk user roles](https://support.zendesk.com/hc/en-us/articles/4408883763866-Understanding-standard-user-roles-for-Zendesk-Support).
[^z16]: [Zendesk Web Widget API](https://developer.zendesk.com/api-reference/widget-messaging/web/core/).

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

- Node.js 20 or newer
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

### Signed-in users on another origin

When the widget runs where `identify` cannot see your session, your backend
signs an HS256 JWT with `identityTokenSecret` and the page passes it as
`identity-token` (`identityToken` in React):

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

**Outbound** mail goes through your sender. The adapter receives one of four
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
    }
  },
},
```

`mailer` and `receiptText` stand for whatever you send mail with. A receipt
carries the responder's name, their away date when the team is out, and the
inbox's booking link, so your template can show them. An `agent-new` with
`reopened: true` means a customer wrote on a resolved conversation; its body
is what they wrote then.

**Inbound** mail arrives through a webhook. Any relay that can forward a raw
message to a URL will do; [`relays/`](https://github.com/better-helpdesk/better-helpdesk/tree/main/relays)
has a Cloudflare Email Worker. Configure:

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
is spent.

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
| Widget    | `--helpdesk-launcher-bg`, `-launcher-fg`, `-panel-header-bg`, `-panel-header-fg` (both default to the accent), `-panel-border`, `-offset-bottom`                                        |
| Agent UI  | `--helpdesk-header-bg` (table heads and avatars), `-note`, `-note-border`, `-warning`                                                                                                 |

For a dark theme, set the panel header too: a light accent reads well on
buttons and links, but not as the header's background.

### Languages

Both UIs ship in English and German (`locale="en"` or `"de"`). The widget
falls back to the browser's language. Inbox copy such as `name`, `title`,
`replyPromise` and the qualifying question is given per locale in the
config, and `HelpdeskAdmin` takes a `messages` prop that overrides any of the
package's own strings by key, for example `admin.inbox`.

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
| `identityTokenSecret`                                                 |          | Verifies identity tokens from other origins. Consulted only when `identify` returns `null`.             |
| `resolveContext(externalOrgId)`, `orgNames(externalOrgIds)`           |          | Extra context and display names for your organisations.                                                 |
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
| `defaultPriority`                | Priority new conversations start with, for example `high` for sales.                |
| `title`, `replyPromise`          | The widget's header and what it promises about replies, per locale.                 |
| `qualify`                        | One qualifying question with options, asked before the first message.               |
| `privacyUrl`                     | Linked under the first-message form, per locale.                                    |
| `receipt`                        | Email a receipt to people who write in.                                             |
| `bookingUrl`, `bookingLink(ref)` | A meeting link offered once someone has written, in the widget and in the receipt.  |

Statuses are `open`, `pending` and `resolved`, read from the customer's
side. Priorities are `low`, `normal`, `high` and `urgent`. The default lead
stages are `lead`, `qualified`, `customer`, `churned`, and the default deal
stages `new`, `qualified`, `proposal`, `won`, `lost`.

## Demo

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
