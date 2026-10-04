# Better Helpdesk against Zendesk, Intercom, Chatwoot and Libredesk

Researched 2 October 2026. 48 GitHub issues in seven epics, scheduled in four waves and a backlog, each completable on its own.

## How this was made

Seven independent analyses, each by its own agent with the same brief (what Better Helpdesk is, what exists, what is off-limits) and no sight of the others: one per competitor (Zendesk, Intercom, Chatwoot, Libredesk, from primary sources: pricing pages, help centres, release notes, repositories, schemas and locale files, Hacker News and review sites), a UX review of the demo at 1440×900 under the `/ask-ux` pass in Preserve mode, and the Head of Marketing and Head of Sales under `/ask-marketing` and `/ask-sales`. Their proposed work items were merged into one candidate list with a convergence tally, which the Head of Engineering (`/ask-dev`, in ponytail mode) then sized against the code at commit `4571983`, deciding the lazy shape of each, what to fold or drop, and the build order. The full reports sit in `docs/research/2026-10/`; this document is the synthesis.

Four of the engineering plan's load-bearing claims were verified in the code before they became tickets: `store.appendMessage` already reopens a resolved conversation on a customer message (`test/agent.integration.test.ts`), `PUT agent/settings` exists but neither the README nor the demo exports `PUT`, the AI controls are already gated on the adapter, and a bodiless `POST` through `createApi` becomes a `GET`.


## What the four products are in October 2026

**Zendesk.** Private-equity owned, about $2B ARR, sold as a "Resolution Platform" for mid-market and enterprise support operations. Per agent, billed yearly: Support Team $19, Suite Team $55, Suite Professional $115, Enterprise on request; Copilot is another $50 per agent and automated resolutions cost $1.50 to $2.00 each. Sell, its CRM, is retired on 31 August 2027. Trustpilot sits at 1.8 of 5, mostly about Zendesk's own support and billing. SLAs and CSAT need the Growth tier or above.

**Intercom.** Renamed itself Fin on 12 May 2026 and agreed to be acquired by Salesforce for about $3.6B on 15 June 2026 (signed, not closed). About $400M ARR; Fin, the AI agent, is sold per resolution and is the growth engine. Seats from $29 to $139 per month; Copilot $29 to $35 per seat; EU data residency only on Advanced or Expert annual plans via sales and a workspace cannot move regions. The per-seat helpdesk's long-term fate under Salesforce is unstated.

**Chatwoot.** Rails 7.2 plus Vue 3, about 37k stars, MIT core with an Enterprise edition that gates SLA, audit logs, custom roles and Captain AI. Needs Postgres, Redis and Sidekiq. 2026 releases are dominated by WhatsApp (Cloud API, templates, calling, campaigns); v4 added the "Captain" AI layer and an Inbox view. Users praise the breadth and complain about upgrades, resource use and gated features.

**Libredesk.** Go single binary plus Postgres and Redis, AGPL, about 3k stars, one author working evenings and weekends with 2,277 of 2,520 commits. Email first; live chat arrived 14 months after launch; WhatsApp shipped in 2026. Deliberate scope: no hosted mode, no customer portal as a separate app, locked default statuses. Its most-voted open request is merging conversations; a 20-comment thread asks for customers to see their past tickets, which Better Helpdesk already has through the host session.

## Where the seven views converge

Every analyst was given the same inventory and the same architecture limits and asked for ten work items. The items below were named independently by the number of reports shown; the count is the strongest signal in this research.

| Gap | Named by | Reports' verdict |
|---|---|---|
| Conversation tags with an inbox filter | 6 of 7 | table-stakes in every competitor report |
| Snooze with a timed wake-up | 5 of 7 | table-stakes |
| Events hook the host handles in-process | 6 of 7 | the one feature marketing would hold the launch for |
| Conversation event timeline (who changed what) | 6 of 7 | expected; cheap once events exist |
| Collision indicator ("Lea has this open") | 6 of 7 | the first week-one complaint from a two-person team |
| @mentions in internal notes | 5 of 7 | the moment escalation leaks to Slack |
| Business hours that the waiting colours, reminders and widget respect | 5 of 7 | "everything is red on Monday" |
| Bulk actions on the inbox list | 4 of 7 | spam bursts, outages |
| Keyboard shortcuts beyond j/k, with a cheat sheet | 4 of 7 | small, agent-facing |
| Overview page or SQL views for first response, resolution, volume | 5 of 7 | the founder's month-one question |
| CSAT rating after resolve | 4 of 7 | expected; marketing and sales say let a partner ask first |
| Reopen a resolved conversation on a customer reply | 2 of 7 | a correctness gap, cheap |
| Open counts on Mine / Unassigned / All | 3 of 7 | small |
| Merge two conversations | 3 of 7 | Libredesk's top request; AI already finds duplicates |
| Saved views | 3 of 7 | expected later |
| Launch surface: public demo, README screenshots, worked adapters, inbound email recipes, CSV import, roadmap with non-goals, comparison table | marketing and sales | launch-blocking; the other five were not asked |
| Admin craft: split list and thread, properties card, collapsible aside, skeletons, empty states, pressed and error states, token-derived radii; widget accent and fold fixes | UX review | Preserve mode; keep the IA, raise the craft |

## What every view says not to build

Social and messaging channels, a help-centre CMS, an AI that answers customers, a visual rule builder, an SLA policy engine with calendars, roles beyond `isAgent`, multi-brand, campaigns and surveys, an own login, a hosted mode or hosted relay, API tokens, a mobile app, a second process. Live chat with typing indicators stays out: polling plus an honest reply promise is the pitch, and marketing asks that the word "live chat" never appears in copy. Nothing gets gated.


## The epics

<a id="epic-launch"></a>
**Epic: launch surface.** Everything a developer meets in the first thirty minutes: the README, the demo, the adapters they have to write, how email gets in, how they switch. Marketing and sales both called these launch-blocking; none opens a migration. Issues: [put-export](#put-export), [inprocess-api-docs](#inprocess-api-docs), [worked-adapters](#worked-adapters), [inbound-recipes](#inbound-recipes), [roadmap-nongoals](#roadmap-nongoals), [comparison-table](#comparison-table), [demo-seed](#demo-seed), [readme-hero](#readme-hero), [switching-guide](#switching-guide), [csv-import](#csv-import), [public-demo](#public-demo).

<a id="epic-host-integration"></a>
**Epic: host integration.** The seams the host app plugs into: the in-process events hook, what the package emails and records on its own, and small config fields that let the host hand the helpdesk what it already knows. Issues: [on-event](#on-event), [reopen-email](#reopen-email), [timeline](#timeline), [host-links](#host-links), [ai-draft-tools](#ai-draft-tools), [spam-block](#spam-block).

<a id="epic-inbox-workflow"></a>
**Epic: inbox workflow.** What an agent reaches for while working the queue: tags, snooze, counts and unread rows, bulk actions, shortcuts, merge, drafts. Tags and snooze were named by every report. Issues: [tags](#tags), [snooze](#snooze), [inbox-attention](#inbox-attention), [drafts](#drafts), [bulk-actions](#bulk-actions), [shortcuts](#shortcuts), [merge-conversations](#merge-conversations), [work-the-queue](#work-the-queue), [saved-views](#saved-views), [ref-autolink](#ref-autolink).

<a id="epic-team-collaboration"></a>
**Epic: team collaboration.** What a team of two to ten needs so two people do not answer the same customer and an escalation stays inside the helpdesk: presence, mentions, and later in-app notifications. Issues: [presence](#presence), [mentions](#mentions), [in-app-notifications](#in-app-notifications).

<a id="epic-hours-feedback-reporting"></a>
**Epic: business hours, feedback and reporting.** The founder's month-one questions: are the colours honest over a weekend, did the resolution help, how fast do we reply. Business hours first, then a rating, then one overview page over the same SQL. Issues: [business-hours](#business-hours), [csat](#csat), [overview](#overview), [csat-email-links](#csat-email-links).

<a id="epic-agent-ui-craft"></a>
**Epic: agent UI craft.** The UX review in Preserve mode: keep the information architecture and labels, raise the craft. Token-derived surfaces, skeletons, empty states, pressed and error states, then the aside, the properties card and finally the split list-and-thread layout. Issues: [ux-tokens-radii](#ux-tokens-radii), [ux-skeletons](#ux-skeletons), [ux-empty-states](#ux-empty-states), [code-blocks](#code-blocks), [ux-collapsible-aside](#ux-collapsible-aside), [ux-properties-card](#ux-properties-card), [ux-pressed-error-states](#ux-pressed-error-states), [ux-composer-order](#ux-composer-order), [ux-split-layout](#ux-split-layout).

<a id="epic-widget-customer"></a>
**Epic: widget and customer side.** What the customer sees: accent and contrast fixes, the first form's fold, marking a conversation resolved, "Seen", and later a full-page conversations component for an in-app Support page. Issues: [customer-resolve](#customer-resolve), [ux-widget-accent](#ux-widget-accent), [ux-widget-form-fold](#ux-widget-form-fold), [seen](#seen), [full-page-conversations](#full-page-conversations).

## The plan

| Wave | Issues | Why this order |
|---|---|---|
| Wave 1: launch surface and correctness, no schema change | [on-event](#on-event), [reopen-email](#reopen-email), [put-export](#put-export), [inprocess-api-docs](#inprocess-api-docs), [worked-adapters](#worked-adapters), [inbound-recipes](#inbound-recipes), [roadmap-nongoals](#roadmap-nongoals), [comparison-table](#comparison-table), [demo-seed](#demo-seed), [readme-hero](#readme-hero), [ux-tokens-radii](#ux-tokens-radii), [ux-skeletons](#ux-skeletons), [ux-empty-states](#ux-empty-states), [switching-guide](#switching-guide) | The design partners deploy against this. Every item is small, independent, and none opens a migration. |
| Wave 2: the columns and the table everything else leans on | [tags](#tags), [snooze](#snooze), [timeline](#timeline), [inbox-attention](#inbox-attention), [customer-resolve](#customer-resolve), [drafts](#drafts), [code-blocks](#code-blocks) | Four generated migrations (`tags`, `snoozed_until`, `agent_seen_at`, `conversation_event`), each its own PR. The timeline needs the wave-1 events hook. Tags and snooze were named by every report and are the first things an agent reaches for. |
| Wave 3: working the queue | [presence](#presence), [business-hours](#business-hours), [bulk-actions](#bulk-actions), [shortcuts](#shortcuts), [ux-collapsible-aside](#ux-collapsible-aside), [ux-properties-card](#ux-properties-card), [ux-pressed-error-states](#ux-pressed-error-states), [ux-composer-order](#ux-composer-order), [ux-widget-accent](#ux-widget-accent), [ux-widget-form-fold](#ux-widget-form-fold) | All build on wave-2 data (bulk tagging, the `z` key, snooze lines in the thread). The two aside PRs reshape the conversation view before the split layout rewrites the page. |
| Wave 4: bigger surfaces, on partner pull | [ux-split-layout](#ux-split-layout), [merge-conversations](#merge-conversations), [mentions](#mentions), [csat](#csat), [overview](#overview), [work-the-queue](#work-the-queue) | Each is a larger surface or a feature a partner should ask for first. |
| Backlog: on request | [saved-views](#saved-views), [seen](#seen), [in-app-notifications](#in-app-notifications), [csv-import](#csv-import), [host-links](#host-links), [ref-autolink](#ref-autolink), [ai-draft-tools](#ai-draft-tools), [full-page-conversations](#full-page-conversations), [public-demo](#public-demo), [spam-block](#spam-block), [csat-email-links](#csat-email-links) | Written up so the answer exists when someone asks; not scheduled. |

## Considered and declined

Each was proposed by at least one report. The reason is the engineering verdict; "later" means it returns when a design partner asks.

- **A realtime adapter (SSE, Pusher, WebSockets).** One implementation (polling at 5 and 10 seconds) does not earn an interface. The seam, when a host brings a transport, is `useResource`'s `refresh` and a `publish()` next to `emit()`. Nothing else needs to know.
- **A ⌘K command palette.** Six sections and three filters do not need one; the UX review reached the same verdict. Shortcuts and a `?` sheet instead.
- **Round-robin auto-assignment.** A README recipe on the events hook (`conversation.created` → `store.updateConversation` over `store.listAgents()` filtered by `awayUntil`); "assign to me" is the `a` key.
- **Host-defined triage rules in config.** A rules DSL with no UI is the events hook with a worse interface. Recipe instead.
- **SQL views for reporting.** A view pins columns; every later column change on `conversation` fails until the view is dropped. Three documented queries cost nothing; the overview page comes later.
- **Canned replies that also set tags or status.** "Send and resolve" exists; a second way to set tags is a second way.
- **A held list for inbound mail that fails DKIM.** Unverified mail already never threads into an existing conversation and lands as a new one from an unverified contact, which is the safe default.
- **A bounce line under a message.** Bounces arrive at the host's provider; the library sees `send()` resolve. If asked: `store.recordEvent` exposed for the host to call.
- **Hiding the AI controls when no adapter is configured.** Already the case (`me.ai` gates the draft button; suggestions exist only when the adapter enqueued triage).
- **Custom conversation attributes with "required on resolve".** Tags and `context.host` cover the two partner cases known; "required on resolve" is a rule engine.
- **Admin dark mode as a feature.** Dark already follows the host's tokens; the derived note surface lands with the radii fix.
- **In-app notifications now.** Email, counts and unread rows cover one to ten agents; written up in the backlog for after mentions.
- **Everything in the non-goals list**: social channels, a help-centre CMS, an AI that answers customers, a rule builder, an SLA engine, roles beyond `isAgent`, multi-brand, campaigns and surveys, own login, hosted mode or relay, API tokens, a mobile app, a second process, per-seat pricing or any gated feature, and the words "live chat".


## The issues

### Wave 1: launch surface and correctness, no schema change

<a id="on-event"></a>
#### feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes

Labels: `enhancement` `area: config` `size: S` `wave 1`

**Problem**

The host wants a Slack message on a new urgent bug, a Linear issue for a feature request, a PostHog event on resolution, or assignment by plan. Today it has to poll its own tables. Every "automation", "webhook", "round-robin" and "Jira integration" request in the research resolves to this one seam, and it is the feature marketing would hold the launch for.

**Scope**

In:
- `onEvent?(event: HelpdeskEvent): Promise<void>` on `HelpdeskConfig`.
- `src/events.ts` exporting the union `HelpdeskEvent`:
  - `{ kind: 'conversation.created', conversation, message }`
  - `{ kind: 'message.created', conversation, message, internal: boolean }`
  - `{ kind: 'conversation.updated', conversation, before: Partial<Conversation>, agentId: string | null }`
- One `emit(config, event)` helper that awaits the hook inside `try/catch` and logs a failure; it never throws into the request.
- Call sites after the write has committed: `createConversation`, the threaded branch of `handleInbound`, `addCustomerMessage`, `addAgentMessage`, the agent `PATCH conversations/:id` route and the suggestion-accept route (`before` is the row the route already loaded; diff it against the patch keys).
- README: a Slack `fetch` example and a round-robin example that calls `helpdesk.store.updateConversation` over `store.listAgents()` filtered by `awayUntil`.
- Integration test: a conversation created through the widget route reaches a recording `onEvent`; a throwing `onEvent` still returns 201.

Out: HTTP delivery, signatures, retries, a delivery log, a UI. The host owns transport and already has secrets and a queue if it wants one.

**Approach**

No table, no route, no migration. Emit only outside store transactions so the host never sees uncommitted rows. Document "keep the handler fast or enqueue": it is awaited inside the request.

**Acceptance**

- `pnpm lint`, `pnpm test` and the integration suite green.
- The README recipe for Slack works against the demo (a console log stands in for the fetch).
- A handler that throws is logged and does not change the response status.

**Evidence**

Intercom webhooks (`conversation.user.created`, `conversation.admin.assigned`, `X-Hub-Signature`, one retry), Chatwoot `webhooks` table and "Send Webhook Event" automation action, Libredesk `webhook_event` enum and issue #306, Zendesk triggers. In an embedded library the host's own function replaces the HTTP hop.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: host integration](#epic-host-integration)

---

<a id="reopen-email"></a>
#### feat(email): email agents when a customer reopens a resolved conversation

Labels: `enhancement` `area: email` `size: S` `wave 1`

**Problem**

A customer answers "actually it is still broken" on a resolved thread. `store.appendMessage` already flips the conversation back to `open` (covered by the test "reopens a resolved conversation when the customer writes again"), but nobody is told: the inbox defaults to open, the assignee is not emailed, and the reply can sit for days.

**Scope**

In:
- A small `afterCustomerMessage(conversation)` in `src/service.ts` called by `addCustomerMessage` and by the threaded branch of `handleInbound`, which enqueues `notify-agents` with `reopened: true` when the pre-append row was `resolved`.
- The `notify-agents` job handler reads `payload.reopened` and sets a new optional `reopened?: boolean` on the existing `agent-new` email kind, so the subject can say "reopened". No fifth kind.
- `en` and `de` subject strings.
- Integration test: resolve, customer writes, `runDueJobs()`, exactly one `agent-new` with `reopened: true` in the harness's emails.

Out: a Reopen button (the status select already offers Open), a configurable reopen window, auto-close after N days.

**Approach**

Read the resolved check from the row loaded before `appendMessage`, never re-fetch after it (the append already set `open`).

**Acceptance**

- Integration suite green with the new case.
- README's `HelpdeskEmail` section mentions the optional `reopened` flag on `agent-new`.

**Evidence**

Libredesk `ReOpenConversation` hook and the `conversation_reopened` notification type; Chatwoot `reopen_conversation` in `message.rb`; Zendesk reopens Solved tickets on a requester reply and reassigns to the solving agent.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: host integration](#epic-host-integration)

---

<a id="put-export"></a>
#### fix(docs): export PUT from the route handler in the README and the demo so settings can be saved

Labels: `bug` `area: docs` `area: examples` `size: S` `wave 1`

**Problem**

`src/http.ts` defines `PUT agent/settings`, but the README's route snippet and `examples/demo/app/api/helpdesk/[...slug]/route.ts` export only GET, POST, PATCH, DELETE and OPTIONS. Every host that follows the README gets a 405 from Next.js when an agent saves the confirmation text in Settings.

**Scope**

In:
- Add `handle as PUT` to the README snippet and the demo route.
- A CI smoke step or integration check that saves a setting through the demo route (the `example` job already drives the demo; add the Settings save to it).

Out: changing the route to PATCH (would break hosts that already added PUT).

**Acceptance**

- Saving the confirmation text in the demo's Settings page succeeds.
- The demo CI job exercises it.

**Evidence**

Found by the engineering feasibility pass while tracing `agentRoute('PUT', 'settings')` against both route exports.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)

---

<a id="inprocess-api-docs"></a>
#### docs(readme): document the in-process API with two recipes

Labels: `documentation` `area: docs` `size: S` `wave 1`

**Problem**

The first question a developer asks of any helpdesk is "is there an API?". The answer is yes and better than the competitors' (no token, no network hop, no rate limit): `buildHelpdesk()` returns `createConversation`, `addAgentMessage`, `track`, `triage`, `draftReply`, `deleteContact`, `runJobs` and `store`. None of that is in the README, so the comparison table reads "no API".

**Scope**

In:
- A README section "Calling it from your own code" with two worked recipes:
  1. Open a conversation from a failed-payment webhook route (shows how to build the server-side `Request` that `identify` needs, or how to call `store.createConversation` with a known contact).
  2. `helpdesk.track()` a "plan upgraded" event onto a contact's timeline from a billing handler.
- One sentence on `helpdesk.store` for reads, with the three reporting queries cross-referenced from the worked-adapters issue.
- A note on what is *not* needed: API tokens, webhooks, a REST client.

Out: a generated API reference, new exports.

**Acceptance**

- Both recipes compile against the demo (`examples/demo`) as a type check, even if not wired to a page.
- Reviewed by the Head of Docs pass for Diátaxis shape (how-to, not reference).

**Evidence**

Marketing: the in-process API is one of the five "inside, not next to" proofs. Sales: "Where are the API tokens?" is a week-two question with a one-sentence answer. Zendesk, Intercom and Libredesk sell API keys; Chatwoot sells access tokens.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)
**Better with:** [feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes](#on-event)

---

<a id="worked-adapters"></a>
#### docs(readme): worked examples for identify, email, storage, AI, help search and jobs, plus three reporting queries

Labels: `documentation` `area: docs` `size: M` `wave 1`

**Problem**

"Everything else is optional" reads as "everything else is on you". The `identify` example returns `null` with a comment, which is the one place the reader asks "do I have to build auth?" and the README shrugs. `email.send`, `StorageAdapter`, `AiAdapter`, `help.search` and `runJobs()` are interfaces with no example; the reader has to infer what to write from `config.ts`. The founder's month-one question, "what is our first-response time?", has a three-query answer that is nowhere.

**Scope**

In, each under twenty lines, in the README or linked from it under `examples/`:
- `identify` for Better Auth and for NextAuth (session → `{ user, orgs, isAgent }`), replacing the `return null` stub.
- `email.send` with Resend rendering the four (five with the mention kind) `HelpdeskEmail` kinds.
- `storage` with S3 presigned POST and GET.
- `ai.generate` with the Anthropic SDK and the Zod schema passed through.
- `help.search` over a static index of the host's own docs (Pagefind or a JSON index).
- `runJobs()` from a Vercel cron route and from a plain `setInterval` in a long-running host.
- "Reporting from your own database": three SQL queries (median first response, median resolution, volume per inbox and type over 30 days) against `helpdesk.*`, and one sentence on pointing Metabase or a PostHog warehouse at the schema.

Out: SQL views in the schema (a maintenance tail on every future migration), a docs site, more providers.

**Acceptance**

- Each snippet type-checks against the published types (a `pnpm pack` + scratch-directory check, as CI's smoke test does).
- The three queries run against the demo database and return rows.

**Evidence**

Sales: the first 30 minutes stop at `identify`, `email` and storage. Marketing: "one worked example per adapter" is launch-blocking. Libredesk and Chatwoot ship batteries; a library must show its batteries are small.

**Size:** M, a few days · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)

---

<a id="inbound-recipes"></a>
#### docs(relays): Google Workspace, Microsoft 365 and Postmark inbound recipes with a dual-delivery cutover, and a Postmark relay

Labels: `documentation` `area: email` `size: M` `wave 1`

**Problem**

"How does our support@ get in? We are on Google Workspace." is the first and most common stop in an evaluation. The README offers one relay, a Cloudflare Email Worker, which a Google or Microsoft shop reads as "a subdomain on Cloudflare, a routing rule, a worker, a secret" with no time estimate. Their mental model is "forward support@ to an address" (Zendesk, Intercom) or "paste IMAP credentials" (Chatwoot, Libredesk).

**Scope**

In:
- `relays/postmark.ts` (or `.mjs`): a second relay that accepts Postmark's inbound webhook with `RawEmail` and POSTs the raw message to `{basePath}/inbound/` with the bearer secret. Same shape as the Cloudflare worker.
- `relays/README.md` with one recipe per provider, each ending with a time estimate and the two-week dual-delivery step:
  - Google Workspace: a routing rule that delivers to Gmail and to the relay address; what to switch off after the cutover.
  - Microsoft 365: a mail flow rule to the relay address.
  - Postmark: inbound domain, the webhook URL, the secret.
  - Cloudflare Email Routing (existing, moved here).
- A short "Switching" section in the README: keep the old tool read-only for 60 to 90 days, new conversations start here from the cutover date, re-point support@, swap the widget script; Intercom's `user_hash` and Chatwoot's `identifier_hash` map one-to-one onto the identity token.

Out: IMAP polling (a second process), a hosted relay (makes us a subprocessor), conversation history import (see the CSV import backlog item).

**Acceptance**

- The Postmark relay is covered by a unit test that feeds a recorded Postmark payload and asserts the POST body and headers.
- Each recipe has been walked once against a real account of that provider, or says it has not.

**Evidence**

Sales §2 item 1 (lose the deal without a trusted path); Libredesk's docs open with a Gmail app password; Chatwoot offers IMAP, Google and Microsoft OAuth; Zendesk and Intercom offer "forward to an address".

**Size:** M, a few days · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)

---

<a id="roadmap-nongoals"></a>
#### docs: add ROADMAP.md with the non-goals and the next waves

Labels: `documentation` `area: docs` `size: S` `wave 1`

**Problem**

"No documentation or visible roadmap, so I can't evaluate it" was the sharpest Hacker News critique of Libredesk's launch, and "if you posted a roadmap you'd get traction" followed. Better Helpdesk's scope decisions live in `AGENTS.md` (for coding agents) and `docs/product.md`; nothing prospect-facing states what it will not do, which is the strongest line it has.

**Scope**

In:
- `ROADMAP.md` at the repository root with two parts:
  1. "What it will not do", each line a refusal and the reason it is better for the host: its own login or SSO; a hosted mode or hosted relay; a second process, database or queue; social and messaging channels; an AI that answers customers; per-seat pricing or any gated feature; a rule builder or SLA policy engine; a hosted help centre; API tokens.
  2. "Next", the wave-2 to wave-4 items from this research by title, dated, with "on request" for the backlog.
- A link from the README and from `docs/product.md`.

Out: dates or promises per item, a public issue board embed.

**Acceptance**

- The Head of Docs pass reviews tone (declarative, no apology).
- Every refusal is consistent with `AGENTS.md` "Off-limits".

**Evidence**

Marketing §3 (the "we will never" list as a marketing asset) and §5 item 4; Libredesk added a roadmap after HN asked; Chatwoot keeps a public roadmap.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)

---

<a id="comparison-table"></a>
#### docs(readme): add a dated comparison table against Chatwoot, Libredesk, Intercom and Zendesk

Labels: `documentation` `area: docs` `size: S` `wave 1`

**Problem**

The reader arriving from an "alternative to Intercom" thread scans for a comparison table and bounces without one. The rows also show which gaps the launch exposes, so the table doubles as the honest status board.

**Scope**

In:
- A README section "Compared with" with coarse, dated cells (yes / no / paid tier / planned / by design), no superlatives. Rows: runs as, database, identity, licence, pricing, install, upgrade, channels, real-time delivery, captured context, customer sees past conversations, tags, snooze, collision indicator, SLA, automation, reporting, CSAT, help centre, AI, events out, API, roles, languages, theming.
- Zendesk and Intercom cells from the two research reports (Zendesk per-agent tiers $19/$55/$115 yearly, Copilot +$50; Intercom seats $29 to $139, Fin per resolution, EU residency on Advanced/Expert annual only); Chatwoot (MIT core, Enterprise-gated SLA, audit logs, roles, Captain); Libredesk (AGPL, Postgres + Redis).
- "By design" rows link to `ROADMAP.md`.

Out: superlatives, "used by" claims, logos, feature counts.

**Acceptance**

- Every cell about a competitor cites a public page in a footnote or the research report.
- Cells for Better Helpdesk reflect `main` on the date in the heading.

**Evidence**

Marketing §4 comparison rows; the four competitor reports' feature inventories.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)
**Better with:** [docs: add ROADMAP.md with the non-goals and the next waves](#roadmap-nongoals)

---

<a id="demo-seed"></a>
#### feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error

Labels: `enhancement` `area: examples` `size: S` `wave 1`

**Problem**

The demo's inbox is empty until the visitor creates data, and the Harbor page throws no error, so the differentiators (captured context, recent JS errors, redacted screenshot, company panel, `resolveContext`) are invisible in the two-minute path. The engineer-buyer never sees the thing that makes them lean forward.

**Scope**

In:
- `examples/demo/scripts/seed.ts` using `helpdesk.store.createContact`, `createConversation` and `appendMessage`: a dozen invented people on `.test` domains across both inboxes, with types, priorities, one resolved thread, one with an internal note and a reply, one sales lead with a qualifying answer, context with URL, viewport, locale, app version and a recent error. Idempotent (skips when the reference sequence is past 1000).
- A "Try the broken button" on the Harbor page that throws, so a bug report filed afterwards shows "1 recent error" in the context summary.
- `resolveContext` in `examples/demo/lib/helpdesk.ts` returning plan and usage for `demo-org` so the company panel shows account context.
- `privacyUrl` on the demo's inboxes so the widget's privacy line renders.
- README "What to try" step for the broken button and a `psql` block that selects the five newest conversations from `helpdesk.conversation`.

Out: a reset endpoint and public deployment (backlog: public demo), PostHog events.

**Acceptance**

- `pnpm --filter better-helpdesk-demo seed` fills the inbox; the CI `example` job still passes (seed is not run there, or is and is asserted).
- Screenshot of the conversation view showing captured context with an error and the company card with plan and usage.

**Evidence**

Sales §1 (the inbox is empty; the best features are invisible) and §3; marketing §4 (the 90-second flow, the "peek at the database" moment). Fixtures use invented people on `.test` domains per `AGENTS.md`.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)

---

<a id="readme-hero"></a>
#### docs(readme): lead with screenshots, a 90-second recording and the five "inside, not next to" proofs

Labels: `documentation` `area: docs` `size: M` `wave 1`

**Problem**

The GitHub page is the launch page and the README opens with a shell command. Libredesk's and Chatwoot's READMEs open with a hero screenshot; a developer decides whether to read by the image. The claim "inside your product, not next to it" has four proofs in the code and only one of them is visible on the page.

**Scope**

In, above the fold and in this order:
1. The line, then the three-line install (already right).
2. Two screenshots from the seeded demo: the widget open in Harbor (light and dark side by side) and the inbox inside Harbor's own navigation with a conversation open and the context panel visible. A 90-second recording as a GIF or linked video: visitor sends → Nadia sees her list → Rowan answers inside Harbor's nav, no login → dark switch → `psql` shows the row.
3. "Inside, not next to": five proof blocks of three to eight lines each: `identify` calling a real session helper; a `psql` query joining `helpdesk.conversation` to the host's users; `--helpdesk-*` tokens on `:root`; `resolveContext` returning plan and seats; `helpdesk.createConversation()` from a webhook route.
4. "What it will not do" (eight lines, from `ROADMAP.md`).
5. "Compared with" (the table issue).
6. Adapters, theming, development, licence (existing).

Out: a marketing site, "used by" claims, logos, the word "live chat" anywhere.

**Acceptance**

- Images are committed under `docs/` or linked from a release asset, under 1 MB each.
- The Head of Docs pass reviews the copy; no claim the README cannot back.

**Evidence**

Marketing §1 (four proofs, two invisible), §4 (README order), §5 item 2. Sales §1 (first 30 minutes).

**Size:** M, a few days · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)
**Depends on:** [feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error](#demo-seed)
**Better with:** [docs(readme): worked examples for identify, email, storage, AI, help search and jobs, plus three reporting queries](#worked-adapters), [docs(readme): add a dated comparison table against Chatwoot, Libredesk, Intercom and Zendesk](#comparison-table), [docs: add ROADMAP.md with the non-goals and the next waves](#roadmap-nongoals)

---

<a id="ux-tokens-radii"></a>
#### fix(admin,widget): derive every radius and shadow from the host's tokens

Labels: `enhancement` `area: admin` `area: widget` `size: S` `wave 1`

**Problem**

A host that sets `--helpdesk-radius: 4px` gets 4px cards next to 8px buttons and a 14px dialog, because the values in `src/admin/styles.ts` and `src/widget/styles.ts` are right by hand (10/8/7/6/14) but not derived. Shadows are navy whatever the host's ink, and the widget's are plain black. In the dark theme the internal-note surface is not readable unless the host sets `--helpdesk-note`.

**Scope**

In:
- Derived radii in both stylesheets: outer surfaces at the token, controls at token−2, inner elements at token−4, the dialog at token+4, pills at 999; applied through private variables (`--a-r*` / `--s-r*`).
- Shadows and hairlines via `color-mix()` from the foreground token with an inset top highlight; one default per variable across both files.
- The note surface derived from `--helpdesk-note-border` when `--helpdesk-note` is unset.
- README Theming: one sentence that radius drives everything.

Out: nesting changes (pressed/error-states issue), the table-head treatment (empty-states issue).

**Acceptance**

- Screenshots at 1440 in the demo light and dark, plus one with `--helpdesk-radius: 4px` and one with `20px` showing concentric corners.
- Dark theme without `--helpdesk-note` shows a readable note.
- No literal colour remains in either stylesheet except the `:host` defaults block and the redactor overlay.

**Evidence**

UX review §2 Colour and Layout findings, §4(b), work item 2. Lock 2 of the review: one radius system.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)

---

<a id="ux-skeletons"></a>
#### feat(admin): skeleton loading shaped like the inbox and the conversation

Labels: `enhancement` `area: admin` `size: S` `wave 1`

**Problem**

Every navigation blanks the screen to "Loading…" and then the full layout lands: `useResource` nulls its data on key change (`src/ui/api.ts`), so an agent opening forty conversations a day sees forty jumps. The split layout (wave 4) will make this more visible, not less.

**Scope**

In:
- `<Skeleton kind="table" | "thread" | "cards">` in `src/admin/ui.tsx`, shaped like the final layout (row heights, the aside's cards), with an opacity pulse that reduced motion turns static.
- Used in `inbox.tsx`, `conversation.tsx` and the CRM lists in `crm.tsx`; `aria-busy` kept.
- A unit test that asserts `aria-busy` is present while loading.

Out: optimistic rendering of the thread from the list row (a follow-up with the split layout).

**Acceptance**

- Screenshot of each skeleton at 1440 and 375.
- Throttled network shows no layout shift between skeleton and content (CLS 0 for the navigation).

**Evidence**

UX review §2 States, §3 finding 1, work item 5; engineering trap: `useResource` `setData(null)`.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)

---

<a id="ux-empty-states"></a>
#### feat(admin): empty states that say how to fill the screen, with a filter reset

Labels: `enhancement` `area: admin` `size: S` `wave 1`

**Problem**

"Nothing here yet." on an inbox filtered to Status: Open does not tell a new agent that resolved conversations exist, where the first message will come from, or that a filter is hiding rows. Companies with one row and three empty columns, an empty deals board and an empty canned-replies list say the same sentence.

**Scope**

In:
- `<Empty>` in `src/admin/ui.tsx` with a title and one line of guidance.
- The inbox distinguishes "empty" from "filtered" and offers "Clear filters", which navigates to the bare inbox route.
- Copy per screen (seven i18n keys, `en` + `de`): inbox empty, inbox filtered, contacts, companies, canned replies, deals (all columns empty), timeline (existing key reused).
- The table-head eyebrow treatment from the UX review's type proposal, in the same PR because the empty state sits in that frame.

Out: illustrations, onboarding checklists.

**Acceptance**

- Screenshots at 1440 and 375 of inbox-empty, inbox-filtered, contacts, companies, canned, deals.
- `tsc` proves every new key has a German string.

**Evidence**

UX review §2 States, §3 finding 7, §4(f) microcopy, work item 6.

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)

---

<a id="switching-guide"></a>
#### docs(readme): a switching guide from Intercom, Zendesk, a shared Gmail inbox and Chatwoot

Labels: `documentation` `area: docs` `size: S` `wave 1`

**Problem**

Every switcher asks "we'd lose our contacts and history" on the first call. The honest answer today (contacts and companies have create endpoints, keep the old tool read-only for 60 to 90 days, new conversations start here) is nowhere in writing, so each evaluator rediscovers it.

**Scope**

In: a README section (or `docs/switching.md`) with one short block per source:
- Intercom: export contacts as CSV, paste macros into a CSV, re-point support@, swap the Messenger script, sign the identity JWT where `user_hash` was signed.
- Zendesk: users and macros via export/API, re-point support@, the `ACME-1042` reference keeps the ticket-number habit.
- Shared Gmail: nothing to import; the dual-delivery routing rule from the relays README; the team stops replying from Gmail.
- Chatwoot: Postgres to Postgres; contacts and conversations are importable on request (backlog); `identifier_hash` maps onto the identity token.
- The parallel-run rule in one paragraph.

Out: the importer itself (backlog item), a hosted migration service.

**Acceptance**

- Head of Docs pass for shape (how-to).
- Links to the relays README and the identity-token section.

**Evidence**

Sales §4 (migration and switching costs; must-haves ranked), marketing §3 ("no hosted mode" sentence).

**Size:** S, under a day · **Wave 1** · **Epic:** [Epic: launch surface](#epic-launch)
**Better with:** [docs(relays): Google Workspace, Microsoft 365 and Postmark inbound recipes with a dual-delivery cutover, and a Postmark relay](#inbound-recipes)

---

### Wave 2: the columns and the table everything else leans on

<a id="tags"></a>
#### feat(admin): tag conversations and filter the inbox by tag

Labels: `enhancement` `area: admin` `size: M` `wave 2`

**Problem**

"Billing", "onboarding" and "bug-1234" live in agents' heads. `type` is the taxonomy the customer picked and `priority` is urgency; nothing groups conversations the way a support person keeps a week straight or hands a themed list to product. Named by all four competitor reports, marketing and sales as table-stakes.

**Scope**

In:
- `tags text[]` on `conversation`, mirroring `contact.tags`, with a GIN index; one generated migration.
- `PATCH agent/conversations/:id` accepts `tags` through the existing tags zod (`src/http.ts`, the contact one), lower-cased and de-duplicated.
- `GET agent/conversations?tag=` filters with `= ANY(tags)` in `store.listInbox`.
- `GET agent/tags` returns the fifteen most-used tags (`unnest` + `count`), consumed by a native `<datalist>`; no tag table, no colours, no settings CRUD.
- Editor: the comma-separated tags control from `crm.tsx` reused under the conversation title; tag chips on inbox rows (the row already receives the whole column through `agentView`); a tag filter in the inbox toolbar.
- `onEvent` carries `tags` in `conversation.updated` when present.
- `en` + `de` strings; integration test for the filter and the normalisation.

Out: tag rename or merge, tags on canned replies, tag reporting, AI tag suggestions, bulk tagging (bulk-actions issue).

**Approach**

Free text, lower-case unique per conversation; the cap of 50 tags × 50 chars is already in the zod. A join table would buy referential tags nobody manages.

**Acceptance**

- Integration suite green; `pnpm db:generate` output committed untouched.
- Screenshot of the inbox with chips and the filter active at 1440 and 375.

**Evidence**

Zendesk tags with the 15-most-used autocomplete over 60 days; Intercom tags with macro and workflow actions; Chatwoot labels with a filter and reports; Libredesk `tags` + `conversation_tags` and the "No tags on this conversation" nudge.

**Size:** M, a few days · **Wave 2** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes](#on-event)

---

<a id="snooze"></a>
#### feat(admin): snooze a conversation until a time and wake it in runJobs or on a customer reply

Labels: `enhancement` `area: admin` `size: M` `wave 2`

**Problem**

"Waiting for the customer's upgrade next Tuesday" has no state. Agents leave it open and red, or resolve it and lose it. `pending` means "with the customer" and does not mean "not now". Named by all four competitor reports and marketing as table-stakes.

**Scope**

In:
- `snoozed_until timestamptz` on `conversation` with a partial index `WHERE snoozed_until IS NOT NULL`; one generated migration. Status stays `pending`.
- `PATCH agent/conversations/:id` accepts `snoozedUntil` (ISO with offset, nullable); a non-null value also sets `status: 'pending'`. Resolving sets it null.
- `runJobs()` gains a `wake` step before reminders: `UPDATE … SET status='open', snoozed_until=NULL WHERE status='pending' AND snoozed_until <= now()`.
- `appendMessage` nulls `snoozedUntil` on a contact message (a customer reply wakes it). `claimReminders` adds `AND snoozed_until IS NULL`.
- Admin: a Snooze control beside the status select with three presets (later today 18:00, tomorrow 09:00, next Monday 09:00) and a native `<input type="datetime-local">`, computed in the agent's browser time zone; key `z` (lands with or without the shortcuts issue).
- Inbox: a `snoozed` status filter value mapped to `status='pending' AND snoozed_until IS NOT NULL`; the waiting cell shows "until {date}" when snoozed.
- Widget: no change (`customerView` derives the customer's status from `waitingSince`).
- `en` + `de` strings.

Out: free-text durations, per-agent snooze, unassign on wake, a server time zone.

**Trust and data loss**

The wake query is guarded by `status = 'pending'`, so a stale `snoozedUntil` on a resolved conversation never reopens it (Libredesk's v2.2.1 bug). The integration test must snooze, resolve, move `snoozed_until` into the past with one `UPDATE`, run `runJobs()`, and assert `status = 'resolved'` and `snoozed_until IS NULL`.

**Acceptance**

- Integration suite green with the wake and the stale-value cases.
- Screenshot of the snooze control and the snoozed filter.

**Evidence**

Intercom snooze presets plus "Custom" and auto-unsnooze; Chatwoot "Resolve ▾ → Snooze until: Next reply / Tomorrow / Next week"; Libredesk `snoozed_until`, `unsnoozer.go`, Alt+Z; Zendesk On-hold.

**Size:** M, a few days · **Wave 2** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(admin): record a conversation event timeline and show it in the thread](#timeline), [feat(admin): shortcuts for resolve, assign, reply, note and snooze, with a ? cheat sheet](#shortcuts)

---

<a id="timeline"></a>
#### feat(admin): record a conversation event timeline and show it in the thread

Labels: `enhancement` `area: admin` `size: M` `wave 2`

**Problem**

"Why is this urgent?", "who moved it to pending?", "did the customer get our reply?" have no answer: only messages are stored. A support lead asks within a month; the compliance-minded EU buyer asks under "accountability". Named by six of seven reports.

**Scope**

In:
- `conversation_event` table: `id`, `conversation_id` (FK, cascade), `agent_id` (FK, set null), `kind text`, `data jsonb`, `created_at`; index `(conversation_id, created_at)`; one generated migration.
- `store.recordEvent()`; the wave-1 `emit()` gains a second line that persists `conversation.updated` diffs as one row per changed key (`status`, `priority`, `assigneeId`, `type`, `inbox`, `title`, `tags`, `snoozedUntil`), plus `reopened` from `afterCustomerMessage`, `suggestion.accepted|dismissed`, `participant.added`, and `email.sent` (kind and recipient) from the job handlers.
- `GET agent/conversations/:id` returns `events`; the thread interleaves them by `createdAt` as one grey line each, rendered through i18n (`event.status`: "{name} set status to {to}"), `de` included.
- Integration test: a status change and an assignment produce the expected rows; retention removes them with the conversation.

Out: a separate audit UI, an account-level audit log, export, a customer-visible subset, before/after for keys other than the diffed ones.

**Approach**

A table, not system messages: `authorType: 'system'` is typed but nothing writes it, and an audit line is structured data that must render in two languages (jsonb, not a text body). Rows in `message` would pollute the generated `search` tsvector and ride every `listMessages` call. Keep `'system'` for a future customer-visible notice.

**Acceptance**

- Integration suite green; `test/harness.ts` `reset()` covers the table through the cascade.
- Screenshot of a thread with three event lines.

**Evidence**

Zendesk ticket events view with the previous value struck through; Intercom "Conversation events in the Inbox" and teammate activity logs; Chatwoot `activity` messages and Enterprise audit logs; Libredesk activity log.

**Size:** M, a few days · **Wave 2** · **Epic:** [Epic: host integration](#epic-host-integration)
**Depends on:** [feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes](#on-event)
**Better with:** [feat(admin): tag conversations and filter the inbox by tag](#tags), [feat(admin): snooze a conversation until a time and wake it in runJobs or on a customer reply](#snooze)

---

<a id="inbox-attention"></a>
#### feat(admin): open counts on the assignee tabs and unread rows

Labels: `enhancement` `area: admin` `size: S` `wave 2`

**Problem**

Working in "Assigned to me", an agent cannot tell that four new conversations are sitting unassigned. After lunch, nobody can tell which of thirty open conversations got a customer reply: the waiting colour says how long, not "new since I looked".

**Scope**

In:
- `GET agent/conversations` returns `counts: { all, mine, unassigned }` from one aggregate over `status = 'open'` (never `rows.length`: the list is capped at 200). Count pills on the three segment buttons.
- `agent_seen_at timestamptz` on `conversation`, written by the detail GET (team-wide, like Chatwoot's `agent_last_seen_at`); one generated migration.
- Unread in the row = `waitingSince` set and (`agentSeenAt` null or older than `lastMessageAt`): bold title and a dot. Both fields already reach the row through `agentView`.
- Optional: the Inbox tab in the rail shows the open count (`agent/me` returns it).
- Integration test for the counts and the unread predicate.

Out: a mark-unread menu, per-tag or per-inbox counts (Chatwoot reverted those for performance), per-agent read state.

**Approach**

Both ride the existing 10-second inbox poll; the seen timestamp is written on a GET on purpose (a POST would fire `HELPDESK_CHANGED` and refetch the inbox).

**Acceptance**

- Screenshot with pills and one unread row.
- `admin.test.tsx` and `inbox.test.tsx` fixtures still compile (new `Me` fields optional).

**Evidence**

Libredesk sidebar counts (v2.9, issue #367); Chatwoot bold rows and `agent_last_seen_at`; Zendesk views with counts; UX review follow-up "waiting count on the Inbox tab".

**Size:** S, under a day · **Wave 2** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)

---

<a id="customer-resolve"></a>
#### feat(widget): let the customer mark a conversation resolved

Labels: `enhancement` `area: widget` `size: S` `wave 2`

**Problem**

A customer who solved it themselves, or got the answer, has no way to say so; the conversation stays open until an agent notices, and the agent's reminder fires for a question that is already answered.

**Scope**

In:
- `PATCH widget/conversations/:id` (already exists for sharing) accepts `status: 'resolved'` for the author only, through the same 403 branch; sets `resolvedAt` and `waitingSince` as the agent route does; emits `conversation.updated` with `agentId: null`.
- One "Mark as resolved" button in the widget thread footer while the status is not resolved; the customer-side status flips to "Resolved".
- `en` + `de` strings; widget integration test.

Out: a reopen button for the customer (writing again reopens it already), a rating (CSAT issue), a DELETE route (the cross-origin CORS method list has no DELETE).

**Acceptance**

- Widget test and integration suite green.
- Cross-origin: the PATCH passes the preflight (methods list unchanged).

**Evidence**

Chatwoot `enableEndConversation`; Zendesk end-user "mark as solved" on messaging; the research's "customer-side mark as resolved" next-tier item.

**Size:** S, under a day · **Wave 2** · **Epic:** [Epic: widget and customer side](#epic-widget-customer)
**Better with:** [feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes](#on-event)

---

<a id="drafts"></a>
#### fix(admin): keep an unsent draft per conversation across navigation

Labels: `bug` `area: admin` `size: S` `wave 2`

**Problem**

The conversation view remounts on `key={id}` and loses the composer's `body`. An agent who opens the inbox to check something, or whose tab reloads, loses a half-written reply.

**Scope**

In:
- `sessionStorage['helpdesk.draft.' + id]` written on change and cleared on send, wrapped in `try/catch` (private windows, blocked storage); the mode (reply or note) stored with it.
- Restored on mount; an unsaved-draft dot on the inbox row is optional and in scope if it is one line.

Out: server-side drafts, drafts shared between agents, undo send.

**Acceptance**

- Unit test: type, navigate away, come back, the text is there; send clears it.

**Evidence**

Intercom auto-saves separate reply and note drafts; Zendesk shows an unsaved-change dot on ticket tabs; UX review §3 finding 1.

**Size:** S, under a day · **Wave 2** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)

---

<a id="code-blocks"></a>
#### feat(admin,widget): render pasted code and captured errors as copyable code blocks

Labels: `enhancement` `area: admin` `area: widget` `size: S` `wave 2`

**Problem**

Customers paste stack traces, config snippets and log lines; agents paste commands back. The rich format has paragraphs, lists and links, so a pasted trace becomes one long paragraph. The captured JS errors already render in a `<pre>` but cannot be copied with one click.

**Scope**

In:
- A fenced `pre` block in the rich format (`src/ui/rich.tsx`): parser, renderer with a Copy button, editor paste of multi-line monospace text (or a toolbar toggle).
- The captured-context errors `<pre>` gets the same Copy button.
- Both UIs render it; `en` + `de` for the button and the copied state.

Out: syntax highlighting, language tags, a dependency.

**Acceptance**

- `rich.test.ts` and `rich-editor.test.ts` cover parse, render and round-trip.
- A pasted three-line trace in the widget arrives as a code block in the admin.

**Evidence**

Intercom Messenger code blocks with copy (September 2026); the Intercom report's next-tier item.

**Size:** S, under a day · **Wave 2** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)

---

### Wave 3: working the queue

<a id="presence"></a>
#### feat(admin): show who else has a conversation open

Labels: `enhancement` `area: admin` `size: M` `wave 3`

**Problem**

With two agents and a 10-second poll, both open the newest conversation and both reply; the customer gets two answers. It is the first week-one complaint from every two-person team in the sales analysis, and every competitor shows "X is viewing".

**Scope**

In:
- Two columns on `agent`: `viewing_id uuid` (FK conversation, set null) and `viewing_at timestamptz`; one generated migration.
- The detail GET that already polls every 5 seconds writes `viewing_id`/`viewing_at` for the caller and returns `viewers` (name, avatar) of other agents with `viewing_at` in the last 15 seconds.
- The inbox list adds the same subquery per row for an avatar stack; the conversation header shows "{name} is viewing" and the composer shows a warning line when someone else is viewing.
- Integration test: two agents open the same conversation; each sees the other; a stale `viewing_at` is not shown.

Out: a presence table, a pruning job (the 15-second window prunes), a heartbeat route, "is typing", locking, a setting to turn it off, WebSockets.

**Approach**

Written on the GET on purpose (a POST would fire `HELPDESK_CHANGED`). `touchAgent`'s upsert must not clobber the two columns. One viewing slot per agent: a second tab overwrites the first; the upgrade path is a `(agent_id, tab_id)` table.

**Acceptance**

- Screenshot of a row with two avatars and a header with the viewing line.
- Integration suite green.

**Evidence**

Zendesk agent collision (eye icon, avatars, "Ticket updated" banner); Intercom "Show teammates presence" (September 2026); Chatwoot typing and viewing; Libredesk `conversation_last_seen`.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: team collaboration](#epic-team-collaboration)
**Better with:** [feat(admin): shortcuts for resolve, assign, reply, note and snooze, with a ? cheat sheet](#shortcuts)

---

<a id="business-hours"></a>
#### feat(config): business hours per inbox that the waiting colours, reminders, receipts and widget respect

Labels: `enhancement` `area: config` `area: widget` `area: admin` `size: M` `wave 3`

**Problem**

A Swiss team is offline from Friday 17:00 to Monday 08:00. The waiting indicator turns red on Saturday, the reminder email fires at 02:00, and the widget promises "within a few hours" to someone writing on Sunday. By week three the colours mean nothing.

**Scope**

In:
- `hours?: { timeZone: string; weekly: Partial<Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', [string, string][]>> }` on `InboxConfig`. Unset means Monday to Friday all day, which is what `nextWorkday` hard-codes today.
- `src/ui/hours.ts` (no Node imports, shared by server and both UIs): `openHoursBetween(from, to, hours)` and `nextOpening(at, hours)` on `Intl.DateTimeFormat(…, { timeZone }).formatToParts`; DST handled by Intl, no dependency. `nextOpening` replaces `nextWorkday` for the receipt's `backOn` and the widget's away line.
- Reminders: `claimReminders` selects candidates in SQL, filters in JS by `openHoursBetween(waitingSince, now) >= reminderAfterHours`, then runs the same guarded `UPDATE … RETURNING` for those ids (the guard stays the claim).
- Indicator: `agent/me` returns `inboxHours`; the inbox row computes open hours for the amber and red thresholds.
- Widget: `widget/session` returns `open` and `nextOpening`; the header line says "Back Monday 08:00" when closed; the per-agent away date and the schedule combine as the later of the two.
- Integration test: a customer writes Friday 17:30 with a 6-hour reminder; `runJobs()` on Saturday sends nothing; on Monday 10:00 it sends.

Out: a `dueAt` column (a second clock that drifts when the schedule changes), first-reply targets beyond `reminderAfterHours`, holidays, a settings UI (it is config like everything per inbox), an auto-reply.

**Acceptance**

- Integration suite green; `recentAgents` and `teamAwayUntil` still drive the away line when the team is on holiday.
- Screenshot of the widget header when closed.

**Evidence**

Intercom office hours and "Typically replies in…"; Zendesk SLA business hours and schedules; Chatwoot `working_hours` and `TEAM_AVAILABILITY` strings; Libredesk business hours with SLA.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: business hours, feedback and reporting](#epic-hours-feedback-reporting)
**Better with:** [feat(admin): snooze a conversation until a time and wake it in runJobs or on a customer reply](#snooze)

---

<a id="bulk-actions"></a>
#### feat(admin): select several conversations and assign, change status or priority, or tag them at once

Labels: `enhancement` `area: admin` `size: M` `wave 3`

**Problem**

After a weekend, a spam burst or an outage that produced twenty identical reports, every conversation has to be opened to be assigned or resolved.

**Scope**

In:
- Extract the body-to-patch logic of `PATCH conversations/:id` (status → `resolvedAt`/`waitingSince`, company → `sharedWithCompany`) into `conversationPatch(before, data)`.
- `POST agent/conversations/bulk` with `{ ids: uuid[] (max 100), ...sameBody }`, applied per row inside one transaction (the status transition depends on each row's current status), one `onEvent` per row. All-or-nothing.
- Admin: a checkbox column with shift-click range, a toolbar with assignee, status, priority and (when the tags issue has landed) tag controls reusing `Select`, and "Clear selection".
- `en` + `de`; integration test for a mixed-status batch.

Out: bulk delete (no conversation delete route exists), bulk reply, "18 updated, 2 skipped" partial results.

**Approach**

The same-origin check in `checkMutation` covers the new POST (JSON from `adminUrl`'s origin). Validate every id as a uuid and cap at 100.

**Acceptance**

- Integration suite green; screenshot of the toolbar with three rows selected.

**Evidence**

Zendesk bulk toolbar on up to 100 tickets; Chatwoot v4 bulk actions; Libredesk v2.3.0 bulk actions with `aria-live` count.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(admin): tag conversations and filter the inbox by tag](#tags)

---

<a id="shortcuts"></a>
#### feat(admin): shortcuts for resolve, assign, reply, note and snooze, with a ? cheat sheet

Labels: `enhancement` `area: admin` `size: S` `wave 3`

**Problem**

j/k and ⌘↵ exist; everything else needs the mouse, and nothing tells a new agent which keys exist. Triaging forty conversations means forty mouse trips to the status select.

**Scope**

In:
- `useShortcuts(map)` in `src/admin/ui.tsx` reusing the guard from `inbox.tsx` plus `target.isContentEditable`.
- `e` resolve, `a` assign to me, `r` reply, `n` internal note, `z` snooze (when present), `?` opens the existing `Dialog` with a `<kbd>` list grouped by screen; platform-aware ⌘/Ctrl as the composer already does.
- With presence: j/k show the viewer avatars so an agent can skip a held conversation.
- `en` + `de` for the sheet.

Out: a ⌘K command palette (six sections and three filters do not need one; the UX review reached the same verdict), configurable bindings, "work the queue" (wave 4, after the split layout).

**Acceptance**

- `inbox.test.tsx` gains cases for the new keys and for the contenteditable guard.
- The sheet lists every key the UI honours.

**Evidence**

Zendesk Ctrl+Alt shortcuts and the "Submit as" split button; Chatwoot `SHORTCUT_KEYS` and ⌘K; Libredesk `KeyboardShortcutsDialog.vue`; Intercom R / N / ⌘⇧Y.

**Size:** S, under a day · **Wave 3** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(admin): snooze a conversation until a time and wake it in runJobs or on a customer reply](#snooze), [feat(admin): show who else has a conversation open](#presence)

---

<a id="ux-collapsible-aside"></a>
#### feat(admin): collapsible details sidebar with a remembered state

Labels: `enhancement` `area: admin` `size: M` `wave 3`

**Problem**

In a 900px host column the fixed 320px aside leaves a 560px thread, and there is no way to give the conversation the room. The split layout (wave 4) only works at 1180px if the aside can collapse.

**Scope**

In:
- A "Details" / "Hide details" toggle in the conversation page head with `aria-expanded` and `aria-controls`; focus moves to the toggle when the aside hides.
- `localStorage['helpdesk.aside']` in `try/catch`; default open at a wide container, closed below.
- `.sa-split` collapses to one column when hidden; a reading measure on the message body.
- Two i18n keys, `en` + `de`.

Out: moving the properties (next issue), per-card collapse, drag to resize.

**Acceptance**

- Screenshots at 1440 open and closed, and at 768.
- The state survives a reload; a private window falls back to the default.
- Keyboard: the toggle is reachable by Tab and announces its state.

**Evidence**

UX review work item 3; Intercom's collapsible details sidebar; Zendesk's resizable context panel.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)
**Better with:** [fix(admin,widget): derive every radius and shadow from the host's tokens](#ux-tokens-radii)

---

<a id="ux-properties-card"></a>
#### feat(admin): show status, priority, type, inbox and assignee as a properties card

Labels: `enhancement` `area: admin` `size: M` `wave 3`

**Problem**

The five selects above the thread are the same component, size and position as the five filters above the inbox table, and they wrap to two lines at 1440. An agent who just left the inbox reads "Status: Open" as the filter they set, not as the record's state.

**Scope**

In:
- A first aside card titled "Properties" with eyebrow labels over borderless selects; the same card renders above the thread as a two-column grid when the aside is hidden or the container is narrow.
- The `Select` helper unchanged in behaviour; the PATCH calls byte-identical; the toolbar row removed from `ConversationView`.
- One i18n key.

Out: new fields, inline editing of anything else, the title editor.

**Risk and the test first**

This is the one change in the UX review that can make an agent slower. Before merging, watch one agent from each design partner open three conversations over a shared screen: time to "status changed" and to "assigned to me", and whether they look at the aside or the thread first. If both reach for the top of the thread, keep the row and ship only the visual distinction (eyebrow labels, borderless selects) in place.

**Acceptance**

- Screenshots at 1440, 768 and 375; each select keeps its `aria-label`.
- `agent.integration.test.ts` untouched and green.

**Evidence**

UX review §3 finding 2, work item 4, §7 (riskiest assumption); Linear's issue view; Libredesk's header selects.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)
**Depends on:** [feat(admin): collapsible details sidebar with a remembered state](#ux-collapsible-aside)

---

<a id="ux-pressed-error-states"></a>
#### fix(admin,widget): pressed states, tinted composer tray, sending label and error retry

Labels: `enhancement` `area: admin` `area: widget` `accessibility` `size: S` `wave 3`

**Problem**

Buttons change colour on hover and nothing on press; Send gives no feedback while it works; a load failure shows "Something went wrong." with no way to retry; a focused table row has no highlight.

**Scope**

In:
- `:active` rules (scale or 1px shift) in both stylesheets; reduced motion removes the transform transition.
- The composer as a tray with the editor as its core; the amber note tint stays.
- "Sending…" on the primary button while busy; a danger notice with "Try again" where a resource failed to load, which refetches.
- `tr:focus-within` row highlight; the toast's fade.
- Three i18n keys, `en` + `de`.

Out: optimistic sends, offline queueing.

**Acceptance**

- A screenshot with a button held down at 1440; the network tab blocked shows the notice with Try again, which refetches.
- Tab through the inbox shows a highlighted row.

**Evidence**

UX review §2 States, §4(c), work item 7.

**Size:** S, under a day · **Wave 3** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)
**Better with:** [fix(admin,widget): derive every radius and shadow from the host's tokens](#ux-tokens-radii)

---

<a id="ux-composer-order"></a>
#### feat(admin): put the reply/note switch first and move "Set away" to the rail

Labels: `enhancement` `area: admin` `size: S` `wave 3`

**Problem**

The mode is chosen after typing: Reply / Internal note sits in the footer, so an agent decides whether the text is public after writing it. The keyboard hint wraps mid-phrase. "Set away…" sits in the inbox toolbar although it changes what the widget promises customers; it is about the agent, not the list.

**Scope**

In:
- Reorder the composer: the reply/note segment first, actions in one row, `white-space: nowrap` on the hint and hidden under a narrow container; the placeholder becomes the slash hint and the label stays `aria-label`.
- `AwayControl` moves to the nav rail next to the agent's identity, with the toolbar fallback when the host renders `nav={false}`.

Out: a split "Submit as" button (two plain buttons with ⌘↵ and ⌘⇧↵ are better), macros, scheduled sends.

**Acceptance**

- Screenshots at 1440, 768 and 375 in reply and note mode; ⌘↵ and ⌘⇧↵ still send and resolve; the segment is the first focusable element of the composer.
- With `nav={false}` the away control is still reachable.

**Evidence**

UX review §3 findings 3, 4 and 9, work item 8; Zendesk, Intercom and Chatwoot put the public/internal choice first.

**Size:** S, under a day · **Wave 3** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)

---

<a id="ux-widget-accent"></a>
#### fix(widget): accent for highlights, readable meta, pressed tiles and a panel that fits its view

Labels: `bug` `area: widget` `accessibility` `size: M` `wave 3`

**Problem**

The focus colour marks unread dots, the selected tab and the agent dot, so a host's accessible focus colour leaks into the UI as decoration. "You · just now" on the accent bubble fails 4.5:1. The home view shows 300px of nothing under the four cards, which reads as "something failed to load". Tabs and secondary buttons stay under 44px on phones.

**Scope**

In:
- `.tabs [aria-selected]`, `.unread-dot`, `.item.unread strong::after`, `.agent-dot`, `.agent-note` use the accent; `--helpdesk-focus` is only the focus ring (README Theming updated).
- `.msg-meta` at 12px and full opacity with a mixed colour that passes 4.5:1 on both bubbles.
- Type and item tiles tone-on-tone with `:active`.
- The panel's height fits its view for home and form; the view-change fade; motion variables and the reduced-motion block for the widget.
- 44px tabs, secondary buttons, switch and send under 480px.

Out: field order, the home's content, the thread's bubble model, animating the panel's height (not transform or opacity).

**Acceptance**

- Screenshots at 1440 of home, form and thread in the demo's light and dark themes and in the untouched default palette (no pink); 375 and 390 of the full-screen sheet.
- Contrast of `.msg-meta` measured on both bubbles; `widget.test.tsx` green; Tab stays inside the sheet on phones.

**Evidence**

UX review §2 Colour (C-3), T-6 contrast, §3 widget findings 1 and 6, §4(g), work item 9.

**Size:** M, a few days · **Wave 3** · **Epic:** [Epic: widget and customer side](#epic-widget-customer)
**Better with:** [fix(admin,widget): derive every radius and shadow from the host's tokens](#ux-tokens-radii)

---

<a id="ux-widget-form-fold"></a>
#### fix(widget): keep the context review and the privacy line in sight on the first form

Labels: `enhancement` `area: widget` `size: S` `wave 3`

**Problem**

On the anonymous bug form the disclosure of what is sent ("5 details about this page · Review") is cut off at the bottom of the scroll area at the 640px panel height, and it is the privacy-relevant part. The six-icon formatting toolbar under the message is space a bug reporter will not use. After sending, the confirmation repeats the header's reply promise in a second voice.

**Scope**

In:
- `margin-top: auto` on the context box inside the form body so it sits above the pinned footer; the message toolbar collapsed to one toggle on the bug and feature forms using the existing `toolbar` prop.
- `thread.confirmEmail` / `thread.confirmHere` shortened so the header's promise is the only promise; `en` + `de` (the Settings placeholder shows the new default).
- (If not already done by the demo seed issue) the demo inbox gains a `privacyUrl`.

Out: reordering or removing fields, a two-step form.

**Acceptance**

- Screenshot at 1440 of the anonymous bug form with the context box and the privacy line both visible without scrolling at the 640px panel height, and at 375 as a sheet.
- `widget.integration.test.ts` still proves the context keys are sent and the unticked ones are not.

**Evidence**

UX review §3 widget findings 2, 3 and 5, work item 10.

**Size:** S, under a day · **Wave 3** · **Epic:** [Epic: widget and customer side](#epic-widget-customer)
**Better with:** [feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error](#demo-seed)

---

### Wave 4: bigger surfaces, on partner pull

<a id="ux-split-layout"></a>
#### feat(admin): split the inbox into list and thread when the container is wide enough

Labels: `enhancement` `area: admin` `size: L` `wave 4`

**Problem**

Inbox → conversation → back is a full page swap: opening a row unmounts the list, "< Inbox" remounts it, refetches, and loses the j/k cursor. Across forty conversations a day that is forty blank flashes and forty lost positions, and an agent cannot glance at what is waiting while answering. The route already keeps the filters in the query string, so a split costs no routing work.

**Scope**

In:
- `container-type` on the admin root; every admin media query becomes a container query.
- `index.tsx` renders `Inbox` and `ConversationView` side by side at a wide container (380px list pane, sticky, own scroll) and at a medium one with the aside collapsed; single pane below, identical to today.
- A `ConversationList` row component in `inbox.tsx` sharing data and the j/k hook with the table; `aria-current` on the selected row; the back link hidden in split; the j/k guard adds `target.isContentEditable`; Escape in the thread focuses the list.
- The list keeps polling every 10 seconds with the cursor kept; `useResource` keys must not change on every poll.

Out: the aside toggle and properties card (earlier issues), virtualised lists, drag to resize the panes, "work the queue" (next issue).

**Acceptance**

- Screenshots at 1440 (split with aside), 1100 (split, aside collapsed), 768 and 375 (single pane) in the demo card and in a full-viewport host.
- j, k, Enter on the list while a thread is open; typing j in the composer inserts "j"; Escape from the composer focuses the selected row; Tab order is list → thread → aside.
- `inbox.test.tsx` gains a case for `isContentEditable`; reduced motion shows no transition on pane change; lint, unit tests and the demo build on both Next majors green.

**Evidence**

UX review §3 finding 1 and work item 1; Zendesk, Intercom, Chatwoot and Libredesk all keep the list beside the thread.

**Size:** L, a week or more · **Wave 4** · **Epic:** [Epic: agent UI craft](#epic-agent-ui-craft)
**Depends on:** [feat(admin): collapsible details sidebar with a remembered state](#ux-collapsible-aside)
**Better with:** [feat(admin): skeleton loading shaped like the inbox and the conversation](#ux-skeletons), [feat(admin): show status, priority, type, inbox and assignee as a properties card](#ux-properties-card), [feat(admin): show who else has a conversation open](#presence)

---

<a id="merge-conversations"></a>
#### feat(admin): merge a duplicate conversation into another

Labels: `enhancement` `area: admin` `size: M` `wave 4`

**Problem**

The same customer writes by email and then in the widget, or twice by email. The AI suggestion already says "possible duplicate of ACME-1041", but the only action is to resolve one by hand and lose its messages. Merging is Libredesk's most-voted open request and standard in the other three.

**Scope**

In:
- `merged_into_id uuid` (FK conversation, set null) on `conversation`; one generated migration.
- `POST agent/conversations/:id/merge { targetId }` in one transaction: move `message` and `attachment` rows to the target, insert the source contact as a participant of the target (`ON CONFLICT DO NOTHING`, so `canCustomerSee` holds), set the source `resolved` with `resolvedAt` and `mergedIntoId`, record one event on each side when the timeline exists.
- `handleInbound` follows `mergedIntoId` once after `getConversationByNumber` for plus-addressed replies; Message-Id threading needs no work (it follows the moved message's `conversationId`).
- Admin: "Merge into…" with reference search, prefilled from the AI duplicates when present; a confirm that warns when the contacts differ; the source page shows a banner linking to the target.
- `en` + `de`; integration test for messages, attachments, participant and the inbound redirect.

Out: bulk merge, unmerge, merging a merged conversation (refused), source = target (refused).

**Trust and data loss**

Irreversible. Refuse when either side is already merged. Retention later deletes the resolved source, which ends the redirect; its messages already live on the target.

**Acceptance**

- Integration suite green with the refusal cases.
- Screenshot of the merge dialog and the source banner.

**Evidence**

Zendesk "Merge into another ticket" (warns on different requester, `closed_by_merge`); Intercom merge suggestions (September 2026); Libredesk issue #177 (+11, unbuilt).

**Size:** M, a few days · **Wave 4** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(admin): record a conversation event timeline and show it in the thread](#timeline)

---

<a id="mentions"></a>
#### feat(admin): @mention a teammate in an internal note and email them

Labels: `enhancement` `area: admin` `area: email` `size: M` `wave 4`

**Problem**

"Can you look at this?" happens in Slack with a pasted link, and the context the widget captured stays behind. The colleague has no list of things waiting on them. This is the moment the "support inside your product" story leaks.

**Scope**

In:
- `POST conversations/:id/messages` gains `notify?: uuid[]` (agent ids, max 20).
- The composer's `/` picker pattern extended to `@`: inserts `@Name` as text and keeps the id in state.
- A fifth `HelpdeskEmail` kind `agent-mention` (`to, locale, reference, subject, body, url, authorName`), one per id, sent through the existing notify job path; an event `mentioned` when the timeline exists.
- README `HelpdeskEmail` section updated; `en` + `de`; integration test asserting one email per mentioned agent.

Out: a `mention` table, followers, a "Mentions" filter (the email is the inbox at this team size), team mentions, chips in the rich format (upgrade path: a `mention` node), in-app notifications.

**Acceptance**

- Integration suite green; the demo prints the mention email to the terminal.

**Evidence**

Zendesk @mentions make the agent a follower; Intercom "Mentions" inbox; Chatwoot `mentions` table and Participating view; Libredesk `conversation_mentions` and "{author} mentioned you in #{referenceNumber}".

**Size:** M, a few days · **Wave 4** · **Epic:** [Epic: team collaboration](#epic-team-collaboration)
**Better with:** [feat(admin): record a conversation event timeline and show it in the thread](#timeline)

---

<a id="csat"></a>
#### feat(widget): ask for a rating after a conversation is resolved and show it in the admin

Labels: `enhancement` `area: widget` `area: admin` `size: M` `wave 4`

**Problem**

The team has no signal on whether a resolution helped, and a founder who reported a CSAT number from Intercom or Zendesk sees its absence as a regression. Marketing and sales both say to let a design partner ask first; the first review will.

**Scope**

In:
- `rating text` (`good` | `bad`), `rating_comment text`, `rated_at` on `conversation`; one generated migration.
- `POST widget/conversations/:id/rating` for the author only (`requireVisible` plus the `contactId` check), once (`WHERE rating IS NULL`).
- The widget thread shows two buttons and an optional comment once the status is resolved and no rating exists; `customerView` adds `rating`.
- A `bad` rating reopens the conversation (`open`, `waitingSince`) and records an event when the timeline exists.
- Admin: a rating chip next to the status in the header and on the inbox row; a "Rated bad" filter.
- `en` + `de`; integration test for once-only and author-only.

Out: email one-click links (a signed GET is a new HTML surface; backlog), 1 to 5 scales, reasons, reports (overview issue), surveys.

**Acceptance**

- Integration suite and widget test green; screenshot of the prompt and the chip.

**Evidence**

Intercom conversation ratings on close with a 7-day expiry and no request under 250 characters; Zendesk CSAT 24 hours after Solved; Chatwoot and Libredesk CSAT surveys.

**Size:** M, a few days · **Wave 4** · **Epic:** [Epic: business hours, feedback and reporting](#epic-hours-feedback-reporting)
**Better with:** [feat(admin): record a conversation event timeline and show it in the thread](#timeline)

---

<a id="overview"></a>
#### feat(admin): overview page with volume, first-response and resolution times

Labels: `enhancement` `area: admin` `size: M` `wave 4`

**Problem**

The founder cannot answer "how fast do we reply and is it getting better?" without SQL; every per-seat tool they left had this page. The three documented queries (worked-adapters issue) satisfy the head of engineering and nobody else.

**Scope**

In:
- One Overview section with a 7/30/90-day select.
- Four numbers (new, resolved, median first response, median resolution) and a table by inbox and by agent, from `store.overview(sinceDays)` as plain SQL (`percentile_cont(0.5)` over first agent message minus `createdAt` and `resolvedAt` minus `createdAt`), rendered as a `<table>`; business hours used when configured; the rating split when CSAT exists; top tags when tags exist.
- `en` + `de`; integration test asserting the medians on seeded data.

Out: charts, CSV export, custom reports, scheduled emails, SLA attainment, SQL views in the schema.

**Acceptance**

- Screenshot at 1440 and 375; the numbers match the README queries on the demo database.

**Evidence**

Intercom prebuilt reports (Essential plan ships "Pre-built reports" only); Libredesk's two-year-old minimal overview page; Chatwoot reports; Zendesk Quick Reports.

**Size:** M, a few days · **Wave 4** · **Epic:** [Epic: business hours, feedback and reporting](#epic-hours-feedback-reporting)
**Better with:** [docs(readme): worked examples for identify, email, storage, AI, help search and jobs, plus three reporting queries](#worked-adapters), [feat(admin): tag conversations and filter the inbox by tag](#tags), [feat(widget): ask for a rating after a conversation is resolved and show it in the admin](#csat), [feat(config): business hours per inbox that the waiting colours, reminders, receipts and widget respect](#business-hours)

---

<a id="work-the-queue"></a>
#### feat(admin): open the next conversation after sending

Labels: `enhancement` `area: admin` `size: S` `wave 4`

**Problem**

An agent clearing thirty conversations goes list → conversation → list thirty times. With the list beside the thread, "send and move on" is one key.

**Scope**

In:
- A "Work the queue" toggle on the inbox that, when on, opens the next conversation in the current sort after Send or Send and resolve, with `n` to skip and "3 of 12" in the header; remembered in `localStorage`.
- Skips conversations another agent is viewing when presence exists.

Out: skip reasons, guided mode, per-view queues.

**Acceptance**

- Unit test for the next-after-send and the skip; screenshot of the header counter.

**Evidence**

Zendesk Play mode (Submit opens the next ticket, Skip, wraps around); Chatwoot "Resolve and move to next".

**Size:** S, under a day · **Wave 4** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Depends on:** [feat(admin): split the inbox into list and thread when the container is wide enough](#ux-split-layout)
**Better with:** [feat(admin): show who else has a conversation open](#presence), [feat(admin): shortcuts for resolve, assign, reply, note and snooze, with a ? cheat sheet](#shortcuts)

---

### Backlog: on request

<a id="saved-views"></a>
#### feat(admin): save the current filters as a view, personal or shared

Labels: `enhancement` `area: admin` `size: M` `backlog`

**Problem**

"Sales inbox, unassigned, lead type" is a three-click filter an agent rebuilds every morning; the team lead cannot hand colleagues an "Urgent and high, any inbox" list.

**Scope**

In: a `setting` key holding named query strings (the URL already is the view), personal (keyed by agent) or shared; "Save as view" captures the current route filters; a Views group in the rail with counts from the inbox-attention aggregate; rename and delete. Out: a filter builder, nested groups, date ranges, per-view notifications.

**Evidence**

Libredesk `views` table with `user`/`team`/`all` visibility; Zendesk personal and shared views; Intercom saved Views; Chatwoot `custom_filters`.

**Size:** M, a few days · **Backlog** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)
**Better with:** [feat(admin): open counts on the assignee tabs and unread rows](#inbox-attention), [feat(admin): tag conversations and filter the inbox by tag](#tags)

---

<a id="seen"></a>
#### feat(widget): show "Seen" under the customer's last message once an agent has opened it

Labels: `enhancement` `area: widget` `size: S` `backlog`

**Problem**

A customer cannot tell whether anyone has looked at their message.

**Scope**

In: `customerView` adds `agentSeenAt` (from the inbox-attention issue); the widget shows "Seen" under the last customer message when `agentSeenAt` is later than its `createdAt`; `en` + `de`. Out: typing indicators, per-agent read state.

**Evidence**

Intercom "Seen" / "Not yet seen" states; Chatwoot read receipts.

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: widget and customer side](#epic-widget-customer)
**Depends on:** [feat(admin): open counts on the assignee tabs and unread rows](#inbox-attention)

---

<a id="in-app-notifications"></a>
#### feat(admin): in-app notification bell for assignments, mentions and replies

Labels: `enhancement` `area: admin` `size: L` `backlog`

**Problem**

An agent working in another tab learns about a reply only when the inbox is next in view.

**Scope**

Skipped for now: at one to ten agents, email, counts and unread rows cover it. Revisit after mentions ship. When built: a `notification` table derived from events, polled on the existing cycle, a bell with a list, the count in `document.title`, mute per agent in `localStorage`. Out: browser push, sounds.

**Evidence**

Zendesk notifications list with favicon dot and mute; Chatwoot notification preferences matrix.

**Size:** L, a week or more · **Backlog** · **Epic:** [Epic: team collaboration](#epic-team-collaboration)
**Better with:** [feat(admin): @mention a teammate in an internal note and email them](#mentions), [feat(admin): record a conversation event timeline and show it in the thread](#timeline)

---

<a id="csv-import"></a>
#### feat(bin): import contacts, companies and canned replies from CSV

Labels: `enhancement` `area: config` `size: M` `backlog`

**Problem**

"We would lose our Intercom or Zendesk contacts and macros." Each switcher writes the same script.

**Scope**

In: `bin/import.mjs` as a sibling of `bin/migrate.mjs`; a 25-line RFC 4180 reader (no dependency); contacts and companies idempotent on email and domain through the existing store; canned replies as a second file. Out: conversation history (a Chatwoot Postgres-to-Postgres import only when a design partner is on Chatwoot), a hosted migration service.

**Evidence**

Sales §4 must-have 2; Chatwoot "Import contacts"; Libredesk CSV tag importer.

**Size:** M, a few days · **Backlog** · **Epic:** [Epic: launch surface](#epic-launch)
**Better with:** [docs(readme): a switching guide from Intercom, Zendesk, a shared Gmail inbox and Chatwoot](#switching-guide)

---

<a id="host-links"></a>
#### feat(config): host deep links in the contact and company cards

Labels: `enhancement` `area: config` `size: S` `backlog`

**Problem**

The support person wants one click from the contact card to the host app's own customer page, Stripe or the CRM.

**Scope**

In: `links?(contact, company): { label: Record<Locale, string>; url: string }[]` on `HelpdeskConfig`, returned by the detail route, rendered under the contact card. Out: anything the host cannot express as a URL.

**Evidence**

Libredesk "Context links" (Stripe customer, HubSpot contact); for an embedded library the host already knows its own URLs.

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: host integration](#epic-host-integration)

---

<a id="ref-autolink"></a>
#### feat(admin): link references like ACME-1042 in notes and replies

Labels: `enhancement` `area: admin` `size: S` `backlog`

**Problem**

Agents write "same as ACME-1041" in notes and then search for it by hand.

**Scope**

In: `RichText` turns `[A-Z]{2,}-\d{4,}` into a link to the inbox search for that reference (no lookup). Out: previews, backlinks.

**Evidence**

Libredesk PR #475 (`#1042` autolinks "just like mentions").

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: inbox workflow](#epic-inbox-workflow)

---

<a id="ai-draft-tools"></a>
#### feat(ai): shorten, make formal and translate a draft through the AI adapter

Labels: `enhancement` `area: config` `size: S` `backlog`

**Problem**

An agent writing in German to an English customer, or trimming a long reply, leaves the composer to do it.

**Scope**

In: `POST conversations/:id/draft` gains `{ mode: "shorten" | "formal" | "translate", text }` reusing `ai.generate` with a second system prompt; three buttons shown only when `me.ai`. Out: tone presets, summaries of the thread.

**Evidence**

Intercom Copilot tone and translation; Zendesk writing tools; Libredesk editor prompts (and the HN reaction to "Add Empathy": keep it to three plain verbs).

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: host integration](#epic-host-integration)

---

<a id="full-page-conversations"></a>
#### feat(widget): a full-page HelpdeskConversations component for an in-app Support page

Labels: `enhancement` `area: widget` `size: M` `backlog`

**Problem**

A signed-in user already sees their own and their company's conversations in the widget. Libredesk has a 20-comment thread asking for exactly this, because a standalone helpdesk does not know who the customer is. A full-page component turns the strongest post-launch differentiator into a visible feature.

**Scope**

In: export the widget's list and thread views as `<HelpdeskConversations>` without launcher or shadow root; the API client and `widget/*` routes unchanged; theming through the same tokens. Out: a help centre, authoring.

**Evidence**

Marketing §2 differentiator 3; Libredesk issue #221 (the author leaning towards "reply from the widget").

**Size:** M, a few days · **Backlog** · **Epic:** [Epic: widget and customer side](#epic-widget-customer)

---

<a id="public-demo"></a>
#### examples(demo): deploy Harbor as a public demo with a scheduled reset

Labels: `enhancement` `area: examples` `size: M` `backlog`

**Problem**

Running the demo locally is the whole first thirty minutes. Libredesk's HN reception was carried by its hosted demo ("great demo", "loads fast"). Harbor is a host app; deploying one is what every host does, so this is not a hosted mode of the package. The maintainer decides whether that reading holds.

**Scope**

In: deploy Harbor with `DEMO_UNSAFE_AUTH=1` and `DEMO_URL` set to the public origin (or every mutation is a 403), the anonymous rate limit as shipped, a `POST /reset` route guarded by a secret that truncates `helpdesk.*` and re-seeds, called by the platform's cron; a "peek at the database" card showing the five newest rows; a link from the README. Out: analytics in the package (Harbor may carry PostHog; the package never does), a login.

**Evidence**

Marketing §5 item 1 ("no Show HN before this is live"); sales §3.

**Size:** M, a few days · **Backlog** · **Epic:** [Epic: launch surface](#epic-launch)
**Depends on:** [feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error](#demo-seed)
**Better with:** [docs(readme): lead with screenshots, a 90-second recording and the five "inside, not next to" proofs](#readme-hero)

---

<a id="spam-block"></a>
#### feat(service): block a sender so a public inbox stops accepting their messages

Labels: `enhancement` `area: config` `size: S` `backlog`

**Problem**

Public inboxes get form-bot spam within days. The honeypot field and the per-IP hourly limit stop some of it; today the only cleanup is `deleteContact`, which hard-deletes the person and their conversations.

**Scope**

In, when a partner reports it: `blocked boolean` on `contact`, set from the contact page; `createConversation` and inbound answer 404 for a blocked email; the inbox hides their open conversations. Out: content filters, a held list.

**Evidence**

Sales §1 week-one complaint "the sales inbox is full of spam"; Zendesk "Mark as spam"; Chatwoot block contact.

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: host integration](#epic-host-integration)

---

<a id="csat-email-links"></a>
#### feat(email): one-click rating links in the resolution email

Labels: `enhancement` `area: email` `size: S` `backlog`

**Problem**

Customers who read the resolution by email never see the widget's rating prompt.

**Scope**

In: two signed links (good, bad) in the `customer-reply` email when the conversation was resolved, landing on a small HTML page under `basePath` that records the rating once and says thank you; signed with the identity-token pattern. Out: a comment form, surveys.

**Evidence**

Zendesk CSAT email 24 hours after Solved; Intercom email fallback after inactivity.

**Size:** S, under a day · **Backlog** · **Epic:** [Epic: business hours, feedback and reporting](#epic-hours-feedback-reporting)
**Depends on:** [feat(widget): ask for a rating after a conversation is resolved and show it in the admin](#csat)

---

