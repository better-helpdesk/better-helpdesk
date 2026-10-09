# What Better Helpdesk is

Written 1 October 2026. The stage section goes stale first; the rest is
positioning and changes only on purpose.

## What it does

Better Helpdesk is an open-source (MIT) support inbox, ticketing system and
lightweight CRM that mounts into your own Next.js app instead of running as a
separate service. You install one npm package, mount one route handler,
render one React component for the agent UI and drop one widget onto your
site. All data lives in your existing database: Postgres, MySQL, SQL Server or
SQLite through built-in adapters, or any other through an adapter you write.
Everything else (file storage, outbound email, inbound email, AI, help-centre
search, background jobs) is an optional adapter.

The positioning mirrors Payload (payloadcms.com), which describes itself as
"the open-source Next.js backend used in production by the most innovative
companies on earth". Better Helpdesk aims to be that for customer support:
the open-source Next.js helpdesk that innovative companies run inside their
own product rather than next to it.

## Why it is different

Intercom (from $29 per seat per month) and Zendesk (from $55 per agent per
month) are per-seat SaaS, and the customer data sits on their servers.
Chatwoot (Rails, about 37k GitHub stars) and Libredesk (Go, about 3k stars)
are open source, but each is a separate application you host, operate and
integrate. Better Helpdesk is a library, not an app. It reuses the host app's
authentication (its session, or a signed JWT for other origins), its
database, its deploy pipeline and its design tokens. There is no second
system to run and nothing to sync.

That is also the line the code must never cross. "Off-limits" in
`AGENTS.md` spells it out for contributors, and
[`ROADMAP.md`](../ROADMAP.md) states it for everyone evaluating the
package.

## What exists

- A shared inbox with several inboxes (for example support and sales),
  priorities, human-readable references like `ACME-1042`, reminder emails
  when a customer has waited too long, canned responses and keyboard
  navigation.
- A lightweight CRM: contacts and organisations taken from the host app's
  identity, lead stages, deal stages and custom fields.
- An embeddable widget as a React component or a standalone script,
  cross-origin capable, with one qualifying question, a privacy link, a
  booking link, receipts for anonymous visitors and a dark theme.
- Email: outbound through your own sender, inbound through a webhook from
  any relay with DKIM verification, replies threaded back into the
  conversation.
- Adapters for storage, AI (schema-typed prompts), help search and scheduled
  jobs. Data retention and anonymous rate limits are configurable.
- English, German, French and Italian. Theming through CSS custom properties. Peer
  dependencies are React 19 and your database's driver, on Node 22.19 or newer. A migrations CLI
  runs in your release step.

## Stage (October 2026)

Pre-launch. First public commit and first npm publish on 28 September 2026,
followed by releases up to 0.3.0. The website at better-helpdesk.com runs
the package for its own widget and inbox, and the documentation lives at
better-helpdesk.com/docs (sources in `site/content/docs/`). No production
deployments yet. Two companies
are about to deploy it as design partners, and their feedback drives the
roadmap. They are not named in this repository, and nothing of theirs goes
into tests, fixtures, issues or pull requests.

## Team and pace

One maintainer, Angelo Dini (GitHub: FinalAngel), and no other contributors
so far. There is no deadline and no release cadence: a release ships when it
is ready, and when speed and quality conflict, quality wins.
