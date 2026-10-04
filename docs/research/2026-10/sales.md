# Better Helpdesk: what loses and what wins the deal

Head of Sales, 2 October 2026. For the maintainer, to turn into GitHub issues.

## What this rests on

- Canon: `docs/product.md`, `CONTEXT.md`, `AGENTS.md`, `README.md`, and the code
  (`src/config.ts`, `src/db/schema.ts`, the routes in `src/http.ts`,
  `examples/demo`).
- Competitor reports: **none of the five existed when I wrote this**
  (`zendesk.md`, `intercom.md`, `chatwoot.md`, `libredesk.md`, `ux-review.md`
  are all missing). I used the raw material already in the research directory:
  the Libredesk README, roadmap, release list and release notes, its docs on
  connecting inboxes, live chat, webhooks, help center, roles and context links,
  15 GitHub issues and 11 discussions, and the two Show HN threads; the Chatwoot
  locale strings (a feature map: advanced filters, attributes, audit logs,
  automation, bulk actions, canned, CSAT, custom roles, labels, macros, reports,
  SLA, snooze, teams, webhooks), its release notes and `schema.rb`. There was
  **no Zendesk or Intercom material** in the directory; what I say about them
  rests on the brief's price points and on what their switchers ask for in the
  threads above. Every vendor claim below is the vendor's, not ours.
- Context library (the authors' ideas, never ours, never for a prospect):
  C-0024 *The Innovator's Dilemma* (find the customers who value your current
  weaknesses; past "good enough", buyers choose on convenience and price),
  C-0015 *The Lean Startup* (the two design partners are a concierge MVP: learn
  what import and inbound email must do by doing it by hand first), C-0009
  *$100M Offers* (the value equation: cut effort, cut time-to-first-win, raise
  perceived likelihood with proof you actually have).

## The buyer, and why "free" still needs a trigger

The price is zero, so the real price is a head of engineering's two days plus
the support person's patience. Nobody spends that without a trigger. The
triggers I would qualify on, in the order they show up:

1. **The renewal or seat bump.** "We added two people and the Intercom bill
   doubled." The brief's numbers: Intercom from $29 per seat, Zendesk from $55
   per agent. At five seats that is CHF 2k to 4k a year for an inbox.
2. **A security questionnaire or DPA.** A customer asks where support
   conversations live. The honest answer today is "a US SaaS". That question
   lands on the founder, and it is the strongest trigger for the EU/Swiss
   buyer.
3. **The shared Gmail inbox breaks.** Two people answered the same customer; one
   customer waited four days; nobody knows who owns what.
4. **Chatwoot ops pain.** Redis, Sidekiq, a Rails upgrade, and the person who
   set it up has left.
5. **The product is already on Next.js and being rebuilt or extended.** The
   moment a library gets added is the moment they are already in the repo.
6. **Bug reports without context.** Support keeps asking "which browser, which
   page?" and engineering keeps asking support. This one is ours to own.

No trigger, no deal. Ask for it on the first call: "what happened that made you
look at support tooling this month?"

---

## 1. The evaluation as it actually happens

### First 30 minutes: README and the Harbor demo (the head of engineering, alone)

What they do: read the README top to bottom, run the demo (Docker Postgres,
`pnpm install`, `.env.local`, migrate, `dev`), send a message from the launcher,
switch to Rowan, answer it, flip dark mode. That path works and it is a good two
minutes. Then they open `HelpdeskConfig` and start mapping it to their stack.

Where they stop:

- **"How does support@ get in?"** The README offers one relay, a Cloudflare
  Email Worker, that POSTs raw MIME to `/inbound/`. A Google Workspace or
  Microsoft 365 shop reads that and sees a subdomain on Cloudflare, a routing
  rule, a worker, a secret. Their mental model is "forward support@ to an
  address" (Zendesk, Intercom) or "paste IMAP credentials" (Chatwoot,
  Libredesk; Libredesk's own docs lead with a Gmail app password). There is no
  recipe for their provider and no estimate of how long it takes. **This is
  the first and most common stop.**
- **"Where is the email adapter?"** `email.send` is an interface. They already
  have Resend, Postmark or SES. Ten lines would end the question; today they
  have to guess what `HelpdeskEmail` wants rendered.
- **"How do I wire `identify`?"** The README stub returns `null`. They are on
  Better Auth, NextAuth or Clerk. A worked example per library is fifteen
  minutes of their time saved and one less reason to close the tab.
- **"Attachments need S3?"** `StorageAdapter` has presign methods and no
  example.
- **"Is it live chat?"** Polling at ten seconds. They will ask once (see §2).
- **The inbox is empty.** Nothing to look at until they create data. No
  captured-context panel appears because the Harbor page throws no error. The
  best features (context, JS errors, screenshot with redaction, qualifying
  question, company panel) are invisible in the two-minute path.
- **There is no public demo.** Running it locally is the whole first 30
  minutes. Libredesk's HN reception was carried by `demo.libredesk.io`
  ("great demo", "loads fast"). This is the biggest top-of-funnel lever we
  have; see §3.

The support person is not in the room yet.

### First week with real customers (the support person, 1 to 5 of them)

The widget is on the product, email is wired, real customers write in. The
buyer stops looking and the support person starts judging. What they say to the
founder by Friday:

- **"We both answered Nadia."** No collision indicator. With two or more people
  answering, this happens in week one. Every one of the four competitors shows
  "X is viewing / typing".
- **"I can't label anything."** Contacts and companies have tags; conversations
  do not. "billing", "onboarding", "bug-1234" is how a support person keeps a
  week straight and how they report to the founder.
- **"I asked Lea in a note and she never saw it."** No @mention, no
  notification. So the question moves to Slack, and the context the widget
  captured stays behind. This is the moment the "support inside your product"
  story leaks.
- **"Nothing told me a new one came in."** The `agent-new` email exists; the
  admin polls. If the tab is in the background, nothing pings. Libredesk ships
  as a PWA with push; the others have browser notifications.
- **"They sent two emails about the same thing."** No merge. Libredesk's
  most-upvoted open issue is ticket merging (+11). Gmail switchers' customers
  do this constantly.
- **"Why does the email look plain?"** The host renders `customer-reply`. If
  the head of engineering wired a bare template in the 30-minute pass, the
  support person sees it in week one and blames the tool.
- **"The sales inbox is full of spam."** Public inboxes get spam within days.
  The anonymous rate limit is per IP per hour; it does not stop a form bot.

What they do not complain about: polling, no typing indicator, no SLA
policies, no roles. At this size none of that is on their list.

### First month (the founder asks "how are we doing?")

- **"What's our first-response time?"** No reporting. The founder wants one
  number a month for the investor update or the board; the support lead wants
  open-by-type to argue for a hire. The true answer today, "it is your
  Postgres, here are three queries", satisfies the head of engineering and
  nobody else. This is where a team that signed drifts back.
- **"Everything is red on Monday morning."** The waiting indicator (amber at
  6 h, red at 24 h) and `reminderAfterHours` ignore weekends. By week three the
  colours mean nothing and the reminder email goes to spam in their heads.
- **"Can I resolve these forty at once?"** No bulk actions; see spam above.
- **"We used to have a CSAT score."** Intercom and Zendesk switchers have
  reported one for years. Losing it is a visible regression to a founder who
  quotes it.
- **"Can engineers see conversations without being able to delete them?"**
  `isAgent` is the only role. At five agents this is asked once and accepted.
- **"Who resolved this, and when?"** No event timeline on a conversation. A
  support lead asks within a month; an EU buyer may ask for it under
  "accountability" in a questionnaire, rarely at this size.
- **"When a bug comes in, put it in Linear / Slack."** No events. This is the
  head of engineering's first integration request and the one they expected
  to be trivial in a library. The HN threads repeat it (Jira sync, GitHub
  issues, "upvote a bug from a case").

---

## 2. Deal-losing gaps, ranked by how often they come up

Categories: **lose the deal** (they do not deploy), **lose goodwill** (the
support person tells the founder the tool is worse), **ask once** (they ask,
accept the answer, move on). Sizes refer to §6.

**1. "How does our support@ email get in? We're on Google Workspace."**
Frequency: every email-based switcher, in the first 30 minutes.
Category: lose the deal when there is no path they trust; ask once when there
is a recipe with a time estimate.
Answer today: "Any forwarder that can POST a raw message to a URL. We ship a
Cloudflare Email Worker; with Email Routing on a subdomain that is about twenty
minutes. The message is DKIM-verified and threaded by Message-Id or by the
plus-addressed reference in Reply-To." True, but it assumes Cloudflare.
Fix: recipes for Google Workspace and Microsoft 365 (route a copy to the relay
subdomain, keep delivering to Gmail during the switch) and a Postmark inbound
relay (its `RawEmail` option); §6 item 1.

**2. "We'd lose our Intercom/Zendesk contacts and history."**
Frequency: every Intercom, Zendesk and Chatwoot switcher, on the first call.
Category: lose the deal if there is no landing place for contacts and canned
replies; ask once for conversation history, if we give them a parallel-run
plan.
Answer today: "Contacts and companies have a create endpoint, so a script can
load a CSV. History: keep the old account read-only for sixty to ninety days;
new conversations start here from the cutover date." Honest; it leaves the
script to them.
Fix: a `better-helpdesk-import` CLI for contacts, companies and canned replies
from CSV (§6 item 5). Conversation import only for Chatwoot (Postgres to
Postgres) and only if a design partner needs it.

**3. "When a bug comes in we want it in Slack / Linear / GitHub."**
Frequency: every head of engineering, first week.
Category: lose goodwill fast; it is the thing they assumed a library would do
better than a SaaS.
Answer today: "The built helpdesk exposes the service, so your own route can
read conversations; there is no hook on create or reply yet." Weak.
Fix: `onEvent` in `HelpdeskConfig` (§6 item 4). This is also the cheapest
differentiator we have: Chatwoot and Libredesk make you stand up a webhook
receiver and verify an HMAC; we hand you a typed function in your own process.

**4. "Is it live chat?"**
Frequency: every Intercom switcher, first 30 minutes.
Category: ask once for a 5-to-50-person B2B SaaS; lose the deal only for a
PLG team that sells through chat and staffs it. Do not chase those.
Answer today: "Replies reach the widget within ten seconds without a refresh,
and by email if they have closed the tab. What you do not get is a typing
indicator. The widget states a reply promise and shows when the team is away,
which is what one to five people can honestly keep." That answer wins with
founders who have been burned by a chat bubble that lied.
Fix: none. Hold this line; it is the segment that values the limit (C-0024).

**5. "Two of us answer. How do we not both reply to the same customer?"**
Frequency: every team with two or more agents, week one, from the support
person.
Category: lose goodwill.
Answer today: none. "Assign it to yourself first" is a workaround they will
forget.
Fix: "Lea has this open" from the existing poll (§6 item 6). Small.

**6. "How do we know how we're doing?"**
Frequency: every founder, by week four.
Category: lose goodwill at month one; lose the account by month three if the
founder cannot get first-response time without an engineer.
Answer today: "It is your Postgres. `helpdesk.conversation` has
`created_at`, `waiting_since`, `resolved_at`, and `helpdesk.message` has the
first agent reply; the three queries are in the README." They are not in the
README yet; put them there this week regardless.
Fix: a Reports section with four numbers (§6 item 10).

**7. "Can we tag conversations?"**
Frequency: support person, week one or two.
Category: lose goodwill.
Answer today: "Type and priority, plus tags on the contact and the company."
Fix: §6 item 7; the contact tag pattern already exists.

**8. "What about our help centre?"**
Frequency: every Intercom Articles and Zendesk Guide user, first call.
Category: ask once for a Next.js team with a docs site (point `help.search` at
it); lose the deal only if they authored everything in Intercom and have no
docs site, which is rare for a team with engineers.
Answer today: "Point the help adapter at your docs search; the widget suggests
articles while the customer types. We do not host a help centre, on purpose:
your docs are already a site." Give one worked adapter (a static index or
Algolia/Pagefind) in the README.
Fix: documentation only. Do not build authoring; Libredesk and Chatwoot both
run one and it is a product in itself.

**9. "Business hours? SLAs?"**
Frequency: half the founders, month one; the support person when Monday is
red.
Category: ask once; the weekend-red indicator is a goodwill leak.
Answer today: "`reminderAfterHours` per inbox and the reply promise in the
widget. No SLA policies." Fine for this buyer. Real SLA policies (Libredesk's
HN thread has a user wanting per-severity, per-timezone, per-holiday clocks)
are an enterprise-customer problem, not a 5-to-50 one.
Fix: business hours that the waiting indicator and reminders respect (§6
item 9). Nothing more.

**10. "Roles: engineers see, support answers, sales gets the CRM only."**
Frequency: a third of founders, month one.
Category: ask once at five agents or fewer.
Answer today: "`isAgent` is the one role; the host decides who gets it. It
keeps identity entirely yours." Hold; revisit at the first design partner with
more than five agents.

**11. "CSAT?"**
Frequency: Intercom and Zendesk switchers, month one.
Category: ask once; goodwill for founders who report it.
Fix: a rating link on resolve (§6 item 12).

**12. "Who maintains this? One person."**
Frequency: every founder who reads `product.md`, and the HN crowd said the
same of Libredesk ("lack of a monetisation strategy is a concern").
Category: ask once, if answered straight. Never bluff.
Answer today: "One maintainer, MIT, no server of ours in the loop. The
package lives in your `node_modules`, the data in your Postgres, the schema is
plain SQL under `migrations/`. Worst case you own a TypeScript package you
already run and can fork. Two companies are deploying it now; I will name them
when they are live, not before." No proof inflation: no "used by" until the
partners are in production and agree.

**13. "Can we script it? Where are the API tokens?"**
Frequency: head of engineering, week two.
Category: ask once.
Answer today: "You do not need a token for your own code: `buildHelpdesk`
returns the service alongside the handler, so a cron route or a server action
can call it with your own auth in front." Put that sentence in the README.

**14. "Snooze / remind me Thursday", "merge these two", "mobile"**
Frequency: support person, month one.
Category: ask once. `pending` covers most of snooze; merge is the one that
compounds (Libredesk's top issue). Mobile: narrow-screen styles exist down to
720 px, not phone-first; say so.

---

## 3. Deal-winning features Intercom and Zendesk cannot match for this buyer

Each one is a sentence on the first call and a moment in the demo. The demo
moments marked *(add)* need §6 item 3.

**Data in their own Postgres.**
Line: "Your support conversations are rows in your database, under a
`helpdesk` schema, with your retention policy. Your subprocessor list does not
grow." Demo: open `psql` next to the inbox and run
`select number, status, waiting_since from helpdesk.conversation;` while the
conversation they just sent is on screen. Put those three lines in the demo
README under "Your data".

**Their own auth, no seats.**
Line: "Whoever your session says is an agent is an agent. Add every engineer;
it costs nothing, so the person who broke it can answer it." Demo: show
`identify` in `examples/demo/lib/helpdesk.ts`, then the Better Auth version
from the README (item 2). The role switcher already makes the point that there
is no second login.

**Captured context, JS errors and a redacted screenshot on a bug report.**
This is the feature that makes an engineer-buyer lean forward, and today the
demo never shows it. Line: "A bug report arrives with the page, the viewport,
the app version, the last JS errors and a screenshot the customer blacked out
themselves. Support stops asking 'which browser'." Demo *(add)*: a "Try the
broken button" on the Harbor page that throws; open the widget, pick "Report a
bug", see "1 recent error" in the context summary, capture, drag-to-redact,
send; open the inbox and read the context panel.

**Account context from the host.**
`resolveContext(externalOrgId)` exists and the demo does not use it. Line:
"The contact panel shows what your own database knows: plan, usage, last
login. No sync, no CRM integration, a function." Demo *(add)*: Harbor returns
`{ plan: 'Pro', shipmentsThisMonth: '1,240' }` for Brightline. This is the
single best demo moment for a SaaS founder: the support person sees the
account without leaving.

**Design tokens.**
Already in the demo (the dark switch). Line: "It reads your CSS variables, so
the widget looks like your product, not like a vendor's." Keep it as step 3.

**No second deploy.**
Line: "One route file, one component, migrations in your release step. The
widget ships with your app. There is no instance to upgrade, back up or forget
about." Demo: the route file and `bin/migrate.mjs`, thirty seconds. CI already
proves it against two Next.js majors; say that.

**A sales inbox with one qualifying question, straight into a CRM.**
Already in the demo (Harbor's "Talk to sales"). Line: "The same widget takes a
lead, asks one qualifying question, opens a conversation at high priority and
creates the contact and company. That is a feature Intercom sells as a bot."
Demo: send as a visitor through the sales inbox, then show the company panel
and the deal board.

**An honest reply promise and away status.**
Line: "The widget says 'we reply within a business day' and, when your team is
away, when they are back. No chat bubble pretending someone is there."
Demo: set Rowan away and open the widget.

**English and Swiss Standard German.**
Line, for Swiss buyers only: "`Sie`, `ss`, both UIs." Thirty seconds, it
lands.

**The event hook *(add, item 4)*.**
Line: "A bug conversation is a function call in your app; make it a Linear
issue in five lines." Demo: Harbor logs `would create Linear issue for
HRB-1042` in the terminal.

**A public demo.**
Not a package feature, the biggest lever: deploy Harbor with
`DEMO_UNSAFE_AUTH=1`, a throwaway Postgres and a nightly reset, and link it
from the README. It cuts the first 30 minutes to three. I read it as the
example app hosted, not as a hosted mode of the package; the maintainer
decides whether that reading holds. If it does, do it before any item in §6.

---

## 4. Migration and switching costs

What a team needs, by where they come from. "Must" means the switch does not
happen without it.

**From Intercom.**
Contacts (CSV export: must, via item 5). Open conversations (Intercom exports
JSON; a parallel run of 60 to 90 days with Intercom read-only is what teams
this size actually do: nice-to-have). Macros (not exportable in bulk; 10 to 30
of them, paste into a CSV: must, item 5). Articles (export to their own docs
site, then point `help.search` there: their project, not ours). Email: support@
currently forwards to an Intercom address; re-point to the relay (must, item
1). Widget: swap the script; Intercom's `user_hash` identity verification maps
one-to-one onto our identity token, which is a selling line ("you already sign
a hash; sign a JWT instead").

**From Zendesk.**
Users and tickets export as CSV/JSON (contacts: must). Macros via API (must,
as CSV). Guide articles via API (their docs site). Email: support@ forwards to
`support@company.zendesk.com`; re-point (must). Zendesk users live by the
ticket number in the subject; our `ACME-1042` reference and plus-addressing
keep that habit intact. Say so.

**From a shared Gmail inbox.**
No import needed and none wanted; old threads stay in Gmail. Must: a
dual-delivery cutover in Google Workspace (a routing rule that delivers to
Gmail *and* to the relay subdomain for two weeks), documented step by step.
Must: the team stops replying from Gmail, which is a habit, not a feature;
the reference in the subject and the receipt email make the new place
visible. The whole switching cost here is the inbound recipe (item 1).

**From Chatwoot.**
Postgres to Postgres. Contacts, conversations, messages, labels and canned
responses all sit in Chatwoot's schema (its `schema.rb` is in the research
directory). A Chatwoot switcher is leaving to stop operating it, not to lose
its data, so a one-off import script is a must for that source (and only that
source). Chatwoot's `identifier_hash` maps onto our identity token the same
way Intercom's does.

**Must-haves for a switch, ranked:**

1. An inbound email recipe for their provider with a dual-delivery cutover
   (all sources). Item 1.
2. Contacts, companies and canned replies from CSV (Intercom, Zendesk). Item 5.
3. A parallel-run plan in writing: old tool read-only for 60 to 90 days, new
   conversations here from day one. A paragraph in the README; no code.
4. Conversation history import: only for Chatwoot, only when a design partner
   is on it. Item 5's second PR.
5. Help centre: a worked `help.search` adapter for a docs site. Documentation.

---

## 5. Pricing and packaging from the buyer's side

The package is MIT and the buyer at 5 to 50 people expects to pay nothing for
it. Their only money worry is the opposite one: "if nobody pays, will this
still exist in two years?" (the HN thread says it about Libredesk in those
words). So the packaging question is what they would pay for, and whether
charging for it makes the free thing more credible or less.

- **A hosted inbound relay.** The buyer would pay for it because it is the
  fiddly part. Do not offer it. A relay handles their customers' email: that
  makes us a subprocessor with a DPA, uptime and an inbox outage at 2 a.m.,
  which is exactly the thing the buyer is leaving. It also crosses the
  architecture line in spirit. Three documented relays (Cloudflare, Postmark,
  SES) and let them pick.
- **A migration service.** The engineer-buyer runs the CSV import themselves.
  The founder with no engineer-hours would pay a fixed fee for "we move your
  Intercom in a week". Do it by hand for the two design partners and the next
  switcher, free, as research (C-0015): it tells us what the importer must do.
  Not a product line; one maintainer has no capacity to sell labour.
- **A support agreement.** The one thing a company running open source in
  production reliably pays for: someone answers within a working day when an
  upgrade breaks. Flat, not per seat (per seat is the thing they left). The
  signal from the raw material: "happy to pay a bit to keep the project
  sustainable". Offer it only once the two design partners are live and
  only to teams in production; a price now would be guessing.
- **Hold back features?** No. Nothing gated, ever. Chatwoot's release notes
  tag features `[Enterprise]` and the HN crowd punishes it; Libredesk's whole
  pitch is "100% free and open-source" against "open-core alternatives that
  lock essential features". Gating one feature hands them the argument and
  costs the trust that makes a one-maintainer package deployable.
- **Design-partner terms.** Free, in exchange for a weekly feedback call and a
  named reference once they are in production. Until then they are "two
  companies", unnamed, as `product.md` already says.

**Recommendation:** everything stays MIT; no hosted anything; sell nothing
until the two design partners are in production; then the one paid thing is a
flat annual support agreement; migrations are done by hand for the first three
switchers and written up as the importer's spec.

---

## 6. Recommended work items, ranked

Sizes: S is a day or less, M is two to five days, L is more than a week. Each
item is one PR, respects the architecture (library, adapters, no hosted mode,
no own auth, four runtime dependencies) and stands on its own.

**1. `docs(relays): add Google Workspace, Microsoft 365 and Postmark inbound recipes with a dual-delivery cutover`**
Objection: "How does our support@ get in? We're on Google Workspace."
Size: S (M if the Postmark relay becomes a second file in `relays/`).
Visible against: Zendesk and Intercom (forward to an address), Chatwoot and
Libredesk (IMAP form; Libredesk's docs open with a Gmail app password).
Each recipe ends with a time estimate and the two-week dual-delivery step.

**2. `docs(readme): add worked identify() for Better Auth and NextAuth, a Resend email adapter and an S3 storage adapter`**
Objection: "What do I actually wire here?" (the first 30 minutes).
Size: S.
Visible against: all four, which have settings forms where we have interfaces.
Also add the "scripting it" sentence (§2 item 13) and the three reporting
queries (§2 item 6) while in the file.

**3. `feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error`**
Objection: "What does it do that Intercom doesn't?" (asked in the demo).
Size: S.
Visible against: all four; this is where our differentiators are invisible
today. A dozen invented conversations on `.test` domains, `resolveContext`
returning plan and usage for Brightline, a "Try the broken button" that throws
so the bug report shows "1 recent error", and the `psql` lines in the README.

**4. `feat(config): call an onEvent hook when a conversation is created, replied to, assigned or resolved`**
Objection: "When a bug comes in we want it in Slack / Linear / GitHub."
Size: M.
Visible against: Chatwoot and Libredesk webhooks (HMAC receivers), Zendesk
triggers, Intercom webhooks. One optional field on `HelpdeskConfig`, a typed
union of events, called in-process after the write; the host does the HTTP.
No queue, no retries: the host has `jobs` if it wants them.

**5. `feat(bin): import contacts, companies and canned replies from CSV with better-helpdesk-import`**
Objection: "We'd lose our Intercom/Zendesk contacts and macros."
Size: M.
Visible against: Chatwoot ("Import contacts", an Intercom/Freshdesk import),
Zendesk and Intercom (whose exports need a landing place).
A sibling of `bin/migrate.mjs`, idempotent on email and domain. Second PR, only
if a design partner is on Chatwoot: `feat(bin): import conversations, messages
and labels from a Chatwoot database` (M to L).

**6. `feat(admin): show who else has a conversation open`**
Objection: "We both answered the same customer."
Size: S.
Visible against: all four (viewing/typing presence).
`viewingConversationId` and `viewingAt` on the agent row, set by the existing
poll, shown as "Lea has this open" with a warning on the reply box.

**7. `feat(admin): tag conversations and filter the inbox by tag`**
Objection: "I can't label anything."
Size: M.
Visible against: Chatwoot labels, Zendesk tags, Intercom tags, Libredesk tags.
Same shape as contact tags; a filter chip in the inbox; `onEvent` carries it.

**8. `feat(admin): mention a teammate in an internal note and email them`**
Objection: "I asked Lea in a note and she never saw it."
Size: M.
Visible against: all four.
`@` picker over the agent list in the note editor, a fifth `HelpdeskEmail`
kind (`agent-mention`) through the existing adapter, deep link to the
conversation. Keeps the escalation, and the captured context, inside the
helpdesk instead of Slack.

**9. `feat(config): keep the waiting indicator and reminders inside business hours`**
Objection: "Everything is red on Monday morning."
Size: S.
Visible against: Zendesk, Chatwoot and Libredesk business hours and SLA.
`businessHours` on the config (days, start, end, time zone); `waitingSince`
ages only inside them; reminders are not sent outside them. No SLA policies.

**10. `feat(admin): report first response, resolution time and volume per inbox, type and agent`**
Objection: "How do we know how we're doing?"
Size: M.
Visible against: all four (Zendesk Explore, Intercom reports, Chatwoot
reports, Libredesk analytics).
One Reports section, four numbers over 7, 30 and 90 days, one store query.
Document the SQL so the host can put it on their own dashboard.

**11. `feat(admin): select several conversations and resolve, assign or reprioritise them at once`**
Objection: "Can I resolve these forty at once?" (spam, Monday).
Size: M.
Visible against: Chatwoot bulk actions, Libredesk's command palette, Zendesk.
Checkboxes in the inbox list, a bar with three actions, one PATCH per id.

**12. `feat(widget): ask for a rating when a conversation is resolved and show it in the inbox`**
Objection: "We used to have a CSAT score."
Size: M.
Visible against: Chatwoot and Libredesk CSAT, Intercom, Zendesk.
A one-click rating in the resolved `customer-reply` email and in the widget
thread, stored on the conversation, averaged in item 10.

**Deliberately not on the list, with the sales answer:** live chat and typing
indicators (polling plus an honest reply promise is the pitch), help-centre
authoring (their docs site, our search adapter), roles beyond `isAgent` (the
host's problem, by design), SLA policies, social and messaging channels
(Chatwoot and Libredesk are racing on WhatsApp, Telegram and Instagram; our
buyer's customers write from the product or by email), a hosted relay, API
tokens (they have the service in-process), and any feature gate.

---

## The one thing to validate next

Before any item above is built: sit with each design partner's **support
person**, not the founder, for the first week they are live, and log every
time they leave the helpdesk to do something (Slack, Gmail, a spreadsheet,
the old tool). That log is the ranking of §6, with real weights, and it will
tell us whether item 1 (inbound email) or item 6 to 8 (collision, tags,
mentions) is what actually makes a two-person team go back to Intercom. The
founder will tell us about reporting in month two; the support person decides
in week one.
