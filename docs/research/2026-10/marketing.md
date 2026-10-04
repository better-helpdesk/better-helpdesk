# Better Helpdesk: gaps that matter for the story, and gaps to refuse

Head of Marketing, 2 October 2026. For the maintainer, to be cut into GitHub issues.

**What I had.** None of the five finished reports (`zendesk.md`, `intercom.md`, `chatwoot.md`, `libredesk.md`, `ux-review.md`) existed when I wrote this. I worked from the raw material in `research/`: Libredesk's README, docs, roadmap, release notes, schema and issue tracker; Chatwoot's release notes, schema and i18n feature files; and three Hacker News threads on Libredesk (the only buyer voice in the folder). Zendesk and Intercom appear here only as what `docs/product.md` states about them (per-seat pricing, data on their servers) and general knowledge; when those reports land, correct the comparison cells, not the argument.

**The one honesty line that binds everything below.** `docs/product.md` mirrors Payload's "used in production by the most innovative companies on earth". We have zero production deployments and two unnamed design partners. The claim we can make is "run inside your product, not next to it". The claim we cannot make yet is "used by". Nothing prospect-facing gets a "used by", a logo, a count or a testimonial until a partner is live and agrees to be named.

---

## 1. The positioning line and the proof it needs

The line: **the open-source Next.js helpdesk you run inside your product, not next to it.**

Every word carries a proof obligation. *Inside* means same process, same deploy, same database. *Your product* means your session, your routes, your design. *Next.js* means an App Router install, not an iframe. *Open-source* means MIT, not open-core. A developer on the GitHub page gives this about two minutes, and most of it goes to the first screen and the first image. The proof has to be visible there, not in a feature list.

### The four proofs that must exist and be visible

| # | Proof | Exists? | Visible in README? | Visible in demo? |
|---|---|---|---|---|
| 1 | **One route handler, one component, one migrate command.** `app/api/helpdesk/[...slug]/route.ts`, `<HelpdeskAdmin>`, `npx better-helpdesk-migrate`. | Yes | Yes, and it is the right first screen | Yes: "Agent inbox" is a tab in Harbor's own nav |
| 2 | **Host identity, no second login.** `identify(request)` returns `{ user, orgs, isAgent }`; a token from another origin never grants the agent UI. | Yes | Half. The example returns `null` with a comment, which reads as "you write the auth yourself" | Yes, the role switcher, but it says "a cookie, nothing more", which undercuts it |
| 3 | **Your Postgres, a `helpdesk` schema, generated SQL migrations.** The host can `JOIN helpdesk.conversation` to its own `users`. Backups, retention and data-subject exports the host already does cover support too. | Yes | One clause in the first paragraph | No. Nothing on the page shows a row in the database |
| 4 | **Host design tokens.** `--helpdesk-*` on an ancestor; the widget's shadow root inherits them; dark mode follows the page. | Yes | As a list of variable names, which is reference, not proof | Yes, step 3 of "What to try" is exactly this |

Two further proofs are in the code and absent from the README entirely. They are the sharpest "inside, not next to" evidence we have, because neither is possible for a helpdesk that runs next to the app:

- **Captured context plus `resolveContext`.** A conversation arrives with URL, title, viewport, locale, app version, recent JS errors, referrer and UTM, and whatever the host adds from its own tables (plan, seats, last deploy). This is the thing an Intercom seat buys. Chatwoot and Libredesk get a subset only if the host pushes custom attributes through their SDK or JWT.
- **The in-process API.** `buildHelpdesk()` returns `createConversation`, `addAgentMessage`, `track`, `triage`, `draftReply`, `runJobs` and the `store`. The host's own code opens a conversation from a failed-payment webhook, or `track()`s "plan upgraded" onto the contact's timeline, with no API key, no webhook and no network hop. API tokens and outbound webhooks exist in the other four products to approximate this.

### Gaps that undermine the claim if missing at launch

1. **No hosted demo.** The two minutes become twenty with Docker and pnpm. Both Libredesk HN threads show what a demo does: the first reactions were "great demo", "looks great", "loads fast", and the only sustained complaint in the second thread was the landing page. Deploying Harbor is not a hosted mode of the package: Harbor is a host app, and deploying one is what every host does. `AGENTS.md` is not crossed.
2. **No image.** Libredesk's and Chatwoot's READMEs open with a hero screenshot. Ours opens with a shell command. A developer decides whether to read by the image.
3. **The `identify` example returns `null`.** The one place the reader asks "do I have to build auth?" is the one place the README shrugs. Replace with a six-line example that calls the host's own session helper.
4. **Nothing shows the data in the host's database.** "Your Postgres" is the claim the EU/Swiss buyer cares about most and the one with no evidence on the page. One `psql` block, or a "peek at the table" card in Harbor, fixes it.
5. **Calling the widget "live chat".** The widget polls every 10 seconds. The README does not say live chat, and must not: the HN reader who hears "live chat" expects typing indicators and sub-second delivery, and bounces when they are missing. Call it a support widget, messages, a conversation. The positioning carries this, no feature needed.

---

## 2. Table stakes versus differentiators

The reader is the developer-founder or CTO of a 1-to-10-agent B2B SaaS on Next.js, arriving from an HN or Reddit thread titled "alternative to Intercom". What that reader asked Libredesk, in order of frequency across the three threads: how does a customer file a ticket, does it do email, canned responses, is there an API, a knowledge base, chat, which channels, where is the roadmap, how is it funded, mobile, how deep is SLA, can it link to Jira or GitHub issues, can tickets be merged (Libredesk's top-voted open issue, +11), can customers see their past tickets (a 20-comment thread).

### Launch-blocking (the reader bounces without it)

- **A public demo** (above).
- **Screenshots and a 90-second recording** in the README (above).
- **An events hook the host handles in-process.** The first question a developer asks of any library is "how do I hook into it?". Libredesk and Chatwoot answer with a webhooks admin page; Zendesk with triggers. For a library the answer is a function in `HelpdeskConfig` that runs in the host's process with the host's imports: Slack on a new bug, a Linear issue for a `feature`, assignment by plan. One hook makes four other gaps disappear from the story (no automation rules, no round-robin, no webhooks, no Jira/GitHub integration) without building any of them.
- **One worked example per adapter.** "Everything else is optional" is true and reads as "everything else is on you". The reader needs to see that the storage adapter is S3 presign in twenty lines, email is one `send` call, AI is one `generate` with a Zod schema, help search is a query over the MDX they already have, jobs is one cron hitting `runJobs()`. `relays/` already does this for inbound email; the pattern needs finishing.
- **A `ROADMAP.md` with the non-goals.** "No documentation or visible roadmap, so I can't evaluate it" was said to Libredesk verbatim; so was "if you posted a roadmap you'd get traction".

### Expected within the first months (the design partners will ask before HN does)

- **Tags on conversations** with an inbox filter. Every competitor has them. `type` and `priority` cover the host-defined taxonomy; tags are the ad-hoc one agents invent on Tuesday.
- **Collision indicator** ("Rowan is viewing"), from the poll that already runs. Two agents answering the same customer is the canonical shared-inbox failure, and all four competitors show it.
- **Snooze** until a date, reopened by `runJobs()`. `pending` is a customer-side status ("awaiting your reply") and does not cover "hide this until Thursday".
- **Change history as system messages**: status, assignee and priority changes in the thread. Libredesk has activity logs; Chatwoot gates audits behind Enterprise; the compliance-minded EU buyer asks "who changed what".
- **Reporting as SQL views** plus a docs page: first response, resolution time, volume per inbox. Every competitor has a reports tab. Ours is a query against the host's own database, which is the story, not a concession. Ship the views and one Metabase or PostHog warehouse example.
- **Business hours on an inbox**, so the reply promise and `awayUntil` are honest on a Friday evening. Small, and it is the honest half of what SLA tools do.
- **Bulk resolve and assign** in the inbox list. Operational, small.
- **Merge conversations.** Libredesk's most-voted request. Medium; needs a design partner to ask first.

### Differentiators worth a story (only possible because it lives inside the host)

1. **Captured context, zero integration.** URL, viewport, app version, recent JS errors, UTM, plus `resolveContext` from the host's tables. "You know what the customer saw when they wrote."
2. **Host identity.** No second login, no seats to provision, no invitation flow. `isAgent` comes from the host's own role model; customers are verified by the host's session, not by an email they typed. A token from another origin never grants the agent UI.
3. **Customer portal for free.** A signed-in user already sees their own conversations and, with `sharedWithCompany`, their colleagues'. Libredesk has a 20-comment open issue asking for exactly this, because a standalone helpdesk does not know who the customer is. After launch, a full-page `<HelpdeskConversations>` component for an in-app "Support" page turns this into a visible feature.
4. **Your Postgres.** `JOIN` support to your own tables; your backups, your `retentionDays`, your data-subject export; no DPA with a helpdesk vendor because none of us see the data. Reports are SQL.
5. **Your design tokens.** The widget and inbox look like the product on day one; dark mode follows the page.
6. **The in-process API.** Open a conversation from a webhook, `track()` an event onto a timeline, triage in code. No API key, no outbound webhook, no second network.
7. **One upgrade path.** `pnpm up better-helpdesk` and the migrate command in the release step. Libredesk ships an upgrade guide; Chatwoot's release notes carry "please upgrade for the latest security fixes" every month. Ours is the host's own deploy.
8. **English and Swiss Standard German, typed.** A missing translation fails `tsc`. For the DACH ICP it is a row in the table, not a headline.

### Dilutes the story: stated non-goals

Social and messaging channels (WhatsApp, Instagram, Telegram, Facebook); a help-centre CMS; an AI that answers customers; a rule builder with dropdowns; an SLA policy engine with calendars and holidays; roles and permission matrices beyond `isAgent`; multi-brand; campaigns, proactive messages and surveys; an own login or SSO settings; a hosted mode; API tokens; a mobile app; a second process, database or queue. Each is in section 3 with the sentence that makes refusing it a reason to choose us.

---

## 3. The "we will never" list as a marketing asset

This belongs in the README under a heading like **What it will not do**, and in `ROADMAP.md`. Short, declarative, no apology. Each line names the refusal and then the reason it is better for the host.

| We will never | Who does it | The sentence that turns it into a reason to choose us |
|---|---|---|
| Have its own login, users table or SSO settings | Libredesk (OIDC, Google, Microsoft; `users`, `roles`), Chatwoot (`users`, SAML), Zendesk, Intercom | Your users are already signed in. An agent is whoever your app says is one. There is no second user table to keep in sync and no seat to invite. |
| Offer a hosted or cloud mode | Chatwoot Cloud (US-only free tier, noted on HN), Zendesk and Intercom are the cloud; Libredesk has a Railway template | It ships where your app ships. No second deploy, no second status page, no data-processing agreement with us, because we never see your data. |
| Run a second process, database or queue | Chatwoot (Rails, Redis, Sidekiq), Libredesk (Go binary, Postgres, Redis) | One `helpdesk` schema in the Postgres you already back up. `runJobs()` runs on whatever schedule you already have. |
| Add social or messaging channels | Chatwoot (ten channel tables, WhatsApp campaigns and calls), Libredesk (WhatsApp shipped, Telegram in progress), Zendesk, Intercom | Email comes in through any relay that can POST a message. Everything else is your product's own surface. A WhatsApp poller would be a thing running next to your app, and then there would be a thing next to your app. |
| Let an AI answer your customers | Libredesk (AI assistant answers live chat), Chatwoot (Captain), Intercom (Fin), Zendesk (AI agents) | An agent is a person. AI drafts and triages for the person; what the customer reads was sent by someone with a name. (An HN reader asked Libredesk "if the AI promises something I cannot deliver, who is liable?" The answer was "you are".) |
| Charge per seat, or at all | Intercom from $29 per seat, Zendesk from $55 per agent, Chatwoot open-core with SLA, audit logs and Captain tagged Enterprise, Libredesk AGPL | MIT. Add the tenth agent the way you added the first: `isAgent: true`. |
| Ship a rule builder or an SLA policy engine | Chatwoot automations, Libredesk automations and SLA, Zendesk triggers | Your rules are code in your repository, reviewed in a pull request, with your own imports. One hook, not a dropdown. One reminder threshold per inbox, not a calendar of holidays. |
| Host a help centre | Libredesk help center (collections, articles, feedback), Chatwoot portals, Zendesk Guide, Intercom Articles | Your docs already live in your Next.js app. We search them. We do not keep a second copy. |
| Expose API tokens or a public REST API | Zendesk, Intercom, Libredesk API keys, Chatwoot access tokens | Your app calls the helpdesk as a function. If you want HTTP, it is one route in your app, behind your own auth. |

The rule-builder line is only honest once the events hook exists (work item 3). Ship them together or say "planned" in the README until then.

---

## 4. Launch surface

### README, in this order, above the fold

1. The line, then the three-line install (route handler, component, migrate). Already right; keep it first.
2. Two screenshots: the widget open in Harbor, light and dark side by side; the inbox inside Harbor's own navigation with a conversation open and the context panel visible. Then the 90-second recording as a GIF or a linked video.
3. **Inside, not next to**: five proof blocks of three to eight lines each. `identify` calling a real session helper; a `psql` query joining `helpdesk.conversation` to `users`; the `--helpdesk-*` tokens on `:root`; a `resolveContext` returning plan and seats; `helpdesk.createConversation()` from a webhook route and `helpdesk.track()` from a billing event.
4. **What it will not do** (section 3, trimmed to eight lines).
5. **Compared with** (the table below).
6. Adapters, one worked example each, or links into `examples/`.
7. Theming reference, development, licence.

The current README's `return null` in `identify` becomes something like:

```ts
identify: async request => {
  const session = await getSession(request); // your app's own helper
  if (!session) return null;
  return {
    user: { id: session.user.id, email: session.user.email, emailVerified: true, name: session.user.name },
    orgs: session.orgs.map(o => ({ id: o.id, name: o.name })),
    isAgent: session.user.role === 'support',
  };
},
```

### The demo, as a public Harbor

Deploy Harbor (Vercel or similar plus a managed Postgres) with `DEMO_UNSAFE_AUTH=1`, the anonymous rate limit as shipped, and a scheduled reset of the `helpdesk` schema. The 90-second flow, which is also the recording:

1. As a visitor, open the launcher and send "The customs form fails on step 3". The panel shows the reference `HRB-1042` and the receipt note.
2. Switch to Nadia (signed-in customer). The widget already knows her and Brightline Logistics; her conversation list is there. That is the customer portal.
3. Switch to Rowan. Open "Agent inbox" in Harbor's own nav; no login screen. The conversation shows the captured URL, viewport, locale, the JS error, and "Plan: Growth, 14 seats" from `resolveContext`. Type `/` for a canned reply, send and resolve with the shortcut.
4. Flip dark. Both UIs follow.
5. A "Peek at the database" card on the page runs `select reference, status, inbox from helpdesk.conversation order by id desc limit 5` against the live demo database and shows the rows.

Step 5 is the cheapest strong proof on the page and the one nobody else can show. Harbor is a host app, so it may carry PostHog; the package never does. Success events for the launch: `demo_widget_sent`, `demo_agent_replied`, `demo_db_peeked`, and the README-to-demo click. If `demo_agent_replied` divided by `demo_widget_sent` is low, the role switcher is not understood.

### The future docs page

Install; Identity (session and token); Adapters (one page each with a worked example); Recipes (open a conversation from a webhook, track a billing event, assign by plan, Slack on a new bug); Theming; Email (the relay); Non-goals; Compared with; Upgrading (`pnpm up` plus migrate in the release step). Diátaxis split: the recipes are how-to, the adapters reference, the non-goals explanation.

### Comparison table rows, and what they expose

Dated, coarse cells (yes / no / paid tier / planned), no superlatives, no "only" or "most complete". Rows:

| Row | Us today | Exposes us? |
|---|---|---|
| Runs as | Library in your Next.js app | No, this is the headline |
| Database | Your Postgres, `helpdesk` schema | No |
| Identity | Your session or signed token | No |
| Licence | MIT | No (Libredesk AGPL, Chatwoot MIT plus Enterprise) |
| Pricing | None | No |
| Install | npm, one route, one component, one migrate | No |
| Upgrade | `pnpm up` plus migrate in your release | No |
| Channels | Widget, email via relay | Yes: all four list more channels |
| Real-time delivery | Polling, 10 s | Yes: all four have WebSocket chat |
| Captured context | URL, viewport, locale, errors, UTM, host data | No, nobody else gets host data for free |
| Customer sees past conversations | Yes, from the host session | No, and Libredesk's open issue says so |
| Tags | No | Yes |
| Snooze | No | Yes |
| Collision indicator | No | Yes |
| SLA | One reminder threshold per inbox | Yes, by design; say so |
| Automation | Events hook in your code (planned until item 3 ships) | Yes until item 3 ships |
| Reporting | SQL views over your database (planned until item 11) | Yes until item 11 ships |
| CSAT | No | Yes; low for the ICP, leave it blank honestly |
| Help centre | Search adapter over your own docs | Yes, by design |
| AI | Suggestion and draft for the agent | By design; say so plainly |
| Events out | In-process hook (planned until item 3) | Yes until item 3 ships |
| API | In-process functions | By design |
| Roles | `isAgent` | Yes, by design for 1 to 10 agents |
| Languages | English, Swiss German, typed | Yes against Chatwoot's forty-plus and Libredesk's Crowdin |
| Theming | CSS custom properties, shadow root | No |

Fill the Zendesk and Intercom cells from those reports when they exist; until then, keep those columns to what their public pricing pages state and date the row.

---

## 5. Recommended work items, ranked

Sizes for one maintainer who puts quality first: S under a day, M one to three days, L a week or more. Every item is a single PR, respects the library-and-adapters architecture, adds no hosted mode and no own auth.

| # | Title (changelog line) | Why it matters for the story | Size | Made visible by |
|---|---|---|---|---|
| 1 | `examples(demo): deploy Harbor as a public demo with a scheduled database reset` | Turns the two-minute claim into two actual minutes. Without it a Show HN burns the one shot on "install it and see". Harbor is a host app; deploying one is what every host does. Add a "peek at the database" card and the three PostHog success events. | M | Libredesk (demo.libredesk.io, praised in both HN threads), Chatwoot (hosted trial) |
| 2 | `docs(readme): lead with screenshots, a 90-second recording and the five "inside, not next to" proofs` | The GitHub page is the launch page. Replace `identify` returning `null` with a real session example; show the `psql` join, the tokens, `resolveContext`, and the in-process call. The image is what gets the README read. | M | All four; every competitor README or landing opens with a hero image |
| 3 | `feat(config): add an events hook the host handles in-process` | One optional field, `events?(event: HelpdeskEvent): Promise<void>`, fired after commit for conversation created, message added, status, assignee and priority changed; failures logged or queued through the `job` table, never thrown into the request. Expose `assign` and `setPriority` on the built helpdesk so a handler can act. Removes "no automation, no webhooks, no round-robin, no Slack, no Jira" from the comparison in one stroke. | M | Libredesk webhooks, Chatwoot webhooks and integrations, Zendesk triggers; HN asked Libredesk for Jira and GitHub links |
| 4 | `docs: add ROADMAP.md with the non-goals` | "No visible roadmap, so I can't evaluate it" was the sharpest HN critique of Libredesk's launch. The non-goals list is the marketing asset in section 3; the roadmap is the next four items of this table. | S | Libredesk (added a roadmap after HN asked), Chatwoot (public roadmap) |
| 5 | `docs(readme): add a comparison table against Chatwoot, Libredesk, Intercom and Zendesk` | The "alternative to Intercom" reader scans for this table. Dated, coarse cells, by-design rows labelled as such. Honest blanks beat inflated cells; the kill-list applies to table cells too. | S | All four |
| 6 | `docs(readme): document the in-process API with two recipes` | `createConversation()` from a failed-payment webhook route and `track()` from a billing event. The clearest proof that "inside" is not a metaphor, and the answer to "is there an API?". | S | Zendesk and Intercom API tokens, Libredesk API keys, Chatwoot access tokens |
| 7 | `docs(examples): add one worked adapter each for storage, email, AI, help search and jobs` | Converts "everything else is optional" from a shrug into five twenty-line files. The reader asks "what do I have to write?" and the answer should be visible, not inferred from `config.ts`. `relays/` already sets the pattern for inbound. | M | Chatwoot and Libredesk ship batteries; a library must show its batteries are small |
| 8 | `feat(admin): show who else is viewing a conversation` | Collision is the canonical shared-inbox failure and the first thing a second agent notices. A `viewing` heartbeat on the existing conversation poll, rendered as a line under the header. | S | Chatwoot (typing and viewing), Libredesk (`conversation_last_seen`), Zendesk (agent collision) |
| 9 | `feat(conversations): add tags with an inbox filter` | The one row every support person checks. Schema, generated migration, PATCH, filter chip; host-defined `types` stay as the fixed taxonomy. | M | All four |
| 10 | `feat(conversations): add snooze until a date, reopened by runJobs` | `pending` means "with the customer"; snooze means "not now". The second-most visible blank in the table after tags, and it fits the jobs runner that already exists. | M | Libredesk, Chatwoot, Zendesk (on-hold), Intercom |
| 11 | `feat(db): add SQL views for first response, resolution time and volume per inbox` | Answers the reports row with the story rather than a dashboard: the data is in your Postgres, query it with what you already have. Ship the views plus a short docs page with a Metabase or PostHog warehouse example. | S | All four have a reports tab; Chatwoot's is a 32 KB i18n file on its own |
| 12 | `feat(conversations): record status, assignee and priority changes as system messages` | The thread becomes its own change history. Cheap because `system` messages already exist; it answers "who changed what" for the compliance-minded buyer and removes the audit-log blank. | S | Libredesk activity logs, Chatwoot audits (Enterprise), Zendesk events |

Items 1, 2, 4 and 5 are the launch. Item 3 is the one feature I would hold the launch for, because it changes five table rows and the rule-builder sentence in section 3 depends on it. Items 6 and 7 are the same week as the launch. Items 8 to 12 are the first months, in the order the design partners ask.

Left out on purpose: CSAT (low for a 1-to-10-agent B2B team; let a partner ask), @mentions and in-app notifications (email `agent-new` covers it at this size), merge and split (Libredesk's top vote, but M and nobody here has asked), custom conversation fields (`types` plus context cover it), per-inbox forms (the host renders its own form and calls `createConversation`), a full-page conversations component (the strongest post-launch differentiator; after a partner ships).

---

## What I would not do

- **No Show HN before item 1 is live.** The second Libredesk thread is the cautionary tale: real product, blank landing page, and the one memorable reply was a web designer's pitch.
- **No "live chat" in any copy.** Polling is fine for support. The phrase invites a comparison we lose and do not need.
- **No "used by", no logos, no numbers.** Two unnamed design partners are not social proof, and `docs/product.md`'s Payload line must not be copied until a partner is named.
- **No channel expansion to chase the "omnichannel" comparison.** Every channel added is a process running next to the app, and the line dies.
- **No AI headline.** Suggestion and draft stay a footnote; the HN crowd punished Libredesk's "Add Empathy" button, and the liability question got a one-word answer.
- **No marketing site before the README earns one.** The README is the site until the demo and the recipes exist; a landing page now would carry claims the README cannot back.

---

## The riskiest assumption, and the test for this week

The riskiest messaging assumption is that **"inside your Next.js app" attracts the buyer rather than filtering out everyone except the developer**. A support lead picks by inbox features; only the developer-founder or CTO picks by architecture. If the buyer is the developer, the whole README is right and the comparison table is a footnote. If the buyer turns out to be the support lead, the table is the page and the architecture is the footnote.

Test it in a week with the two design partners and five Next.js founders found on r/nextjs or X: show them only the top half of the README (item 2, drafted, no demo yet) and ask two questions. "What is this?" and "What would you have to run?" The line lands if they say "a helpdesk I npm install" and nobody asks "so where does it host?". The channel assumption to test at the same time: ask whether they would read a Show HN or a post in the Next.js Discord first. That decides where the launch goes, and it costs one afternoon.
