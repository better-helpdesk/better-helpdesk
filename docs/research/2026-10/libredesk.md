# Libredesk vs Better Helpdesk — competitive analysis (2 October 2026)

Method: primary sources only where possible. I read the GitHub repository (README, ROADMAP.md, `schema.sql`, `config.sample.toml`, `internal/automation/models/models.go`, `internal/conversation/{message.go,queries.sql}`, `frontend/DESIGN.md`, `frontend/apps/main/src/**` component list and the templates of the list row, SLA badge, nudge, empty states and shortcuts dialog, `i18n/en-US.json` with 1,820 keys), all 48 release notes, the docs at docs.libredesk.io (via `llms.txt` and the Markdown pages), the GitHub API for stars/issues/discussions/contributors, the three Hacker News threads via the Algolia API, and two third-party round-ups. Reddit is not fetchable from here, so r/selfhosted opinion is second-hand (one round-up calls Libredesk "the one r/selfhosted keeps surfacing"). Where I could not verify something I say so.

Vocabulary note: Libredesk calls its support staff "agents" and its LLM features "AI assistant", "Copilot" (named "Juno") and "AI agent". In this report "agent" means a human, as in Better Helpdesk's `CONTEXT.md`.

---

## 1. Snapshot

**What it is.** "Open source, self-hosted customer support software for email, live chat, and WhatsApp. Distributed as a single binary." (README). Landing page: "The open-source customer support desk. Self-hosted and free. Live chat, email, and more in a single binary you run on your own server." It is a classic standalone helpdesk app: its own login, its own users table, its own admin, a Vue SPA served by a Go server, with a visitor-facing chat widget and a public help centre.

**Who builds it and why.** One person, Abhinav Kadam (`abhinavxd`, HN `avr5500`), an engineer at Zerodha (the README carries the Zerodha Tech badge; this is the shop behind listmonk, and the DB upgrade mechanism was "adapted from listmonk"). Of roughly 2,520 commits, 2,277 are his; the next contributor has 44. His own words: "I originally built Libredesk for what we needed at work, we were on osticket and wanted something cleaner" and "These days I work on Libredesk in evenings and weekends alongside a full-time job, so response times on issues aren't instant" (Show HN, 2026). On why not fork Frappe Helpdesk: "I just wanted to build something that didn't exist. Libredesk is a high-performance, free, and open-source helpdesk, unlike other open-core alternatives... I would've ended up fighting the existing architecture" (discussion #83). Business model: none. "No plans to monetize; yes, it's a labor of love." Asked about SaaS: "No plans, cloud deployment platforms like Railway can take care of it." Landing page FAQ: "Every feature is included, and there are no paid tiers."

**Licence.** AGPL-3.0. Raised on HN as a deterrent versus Chatwoot's MIT ("Chatwoot has a lot more features with its MIT license"); the author did not engage beyond the positioning that AGPL stops open-core forks.

**Stars and activity (GitHub API, 2 Oct 2026).** 2,982 stars, 291 forks, 101 open issues, 53 discussions, last push 28 Sep 2026. Repo created 12 May 2024; first public release v0.1.0-alpha on 23 Feb 2025 (Show HN: 376 points, ~74 comments). Commits landed on 78 of the last ~92 days. Contributors are starting to appear (nine first-time contributors in the current RC; a community PR made the agent UI mobile-usable). A recurring complaint is review latency: "It took ~5 weeks to get a reply to this ticket" (issue #259).

**Deployment footprint.** Go binary with the Vue assets embedded, plus **PostgreSQL** and **Redis** (both required: `[db]` and `[redis]` blocks in `config.sample.toml`; sessions live in Redis, see the v0.11.1 fix "Redis session keys would never expire"). Filesystem or S3 for uploads. All queues (incoming/outgoing mail, notifications, automations, AI agent, webhooks) are in-process worker pools with configurable sizes. `./libredesk --install`, `--upgrade`, `--set-system-user-password`. Docker Compose and a Railway one-click template. Author's own number: "On an instance with about ~5,000 conversations a day and ~500 agents logged in, memory stays between 180 MB and 560 MB." HN pushback on day one: "It still needs postgres and redis" and "Why not use an embedded db like sqlite and make it truly 'single binary'?"; SQLite is still an open request (#489).

**Explicit scope choices.** There is no "what we won't build" document. ROADMAP.md is six lines: Near term "WhatsApp channel - WIP, Web / Customer Portal to manage tickets - WIP, 2FA for password login - WIP, Telegram channel - WIP"; Mid term "Extensive conversation reports - TODO, Contact merging - TODO". The real scope decisions are in HN replies and issue threads:

- Email first, everything else later. At launch: "Right now the only way to create a ticket/request is by adding an inbox, and sending an email." Live chat "yes, once Libredesk is stable" (shipped 14 months later, v2.1.0, April 2026).
- No hosted/SaaS, no monetisation.
- Mobile "is not the focus, it can be done later" (a user later built it and it was merged, v2.8.0).
- No customer portal as a separate app. In issue #221 the author lays out "Option 1: Web portal has only help articles... To reply to any ticket/conversation, you reply from the widget" versus "Option 2: full login/logout system" and says "I'm leaning more towards Option 1... this also keeps conversations in one central place."
- Default statuses are locked ("Open is what new/reopened, Snoozed drives the snooze/wake-up flow, and Resolved/Closed drive SLA and resolution logic. Deleting or renaming them would break those flows", #432).
- MCP server: "I'd lean toward this living as a separate MCP server project that wraps libredesk's existing API" (#265).
- Kanban/table views: "a bit too early for this right now. Planning to add Whatsapp and other channels first" (#278).

**Version and cadence.** Current stable v2.8.0 (22 Aug 2026); v2.9.0-rc.8 (25 Sep 2026) adds WhatsApp. 48 releases in 19 months; since v1.0.0 (28 Jan 2026) a minor every three to six weeks, each with a human-written "What's new / What's fixed / Upgrade notes" section and "Always take a database backup before upgrading."

**Direction.** Omnichannel (WhatsApp now, Telegram WIP), AI (assistant that answers live chat from a knowledge base with human handoff, copilot, "custom AI tools" with agent approval), a public help centre with custom domains, PWA with push notifications, a widget that doubles as the customer portal. The target has drifted from "small team replacing osTicket" towards "500 agents", and the feature surface now rivals Chatwoot's. The getmacha round-up (Sep 2026) ranks it below Chatwoot and Zammad on maturity: "a 2026 project hasn't been through the upgrade cycles that shake out data-migration bugs."

**Stack details worth knowing.** Vue 3 + shadcn-vue + Tailwind, Tiptap editor, unovis charts, Geist font, Cypress e2e, Mintlify docs with an OpenAPI spec, Crowdin with 13 locale files (`de-DE`, not Swiss), 93 Go module dependencies.

---

## 2. Feature inventory vs Better Helpdesk

Verdict legend: **table-stakes** = a 1–10 person B2B team misses it in week one; **expected** = within months; **differentiator** = could set us apart; **skip** = not for the embedded positioning.

| Area | Libredesk (as of v2.8 / v2.9-rc) | Better Helpdesk today | Verdict |
|---|---|---|---|
| **Conversation list, fixed lists** | Sidebar: "New conversation", "My Inbox", "Mentions", "Unassigned", "All", then "TEAM INBOXES", "VIEWS", "SHARED VIEWS". Each entry has an open count badge (`sidebarCounts.*`, v2.9). Row: avatar (hover = checkbox), name (bold when unread), priority ladder icon, channel icon, relative time, subject (optional, "Show subject in conversation list" setting), last-message preview with an arrow when the agent replied, green unread-count badge, "Typing…" live. Right-click: "Mark as unread". | all / mine / unassigned, inbox, status, search, two sorts, "High & urgent · N" chip, waiting indicator, j/k. No counts. | Counts: **table-stakes**. Unread/bold state: **expected**. |
| **Custom views** | `views` table: name + `filters` JSONB + visibility `user`/`team`/`all`. Filter builder with groups, "Click to switch between and / or", operators per field type ("contains any of", "contains none of"), nested AND/OR groups (v2.4), fields: status, priority, team, agent, inbox, tags, created_at, waiting_since, snoozed_until, last_message_at, last_interaction_at, next_sla_deadline_at, contact email, external id, "last interaction by" (contact/agent), SLA policy, channel, plus contact custom attributes. Shared views managed in Admin. | None. | **expected** (a flat version; see work item 6). |
| **Sorting** | "Newest activity", "Oldest activity", "Priority first", "Started first", "Started last", "Waiting longest", "Next SLA target". | Longest waiting, priority. | Parity for a small team; add "newest activity" (**expected**). |
| **Statuses** | Defaults Open / Snoozed / Resolved / Closed (locked), custom statuses, each with a category `open` / `waiting` / `resolved` that drives behaviour (open ones count toward auto-assignment caps). Status change from header pill, from reply split button "Send and set as…", from palette, Alt+E resolve / Alt+O reopen. | open / pending / resolved, fixed. | Custom statuses: **skip** (categories are the lesson, not the CRUD). Reopen-on-reply: **table-stakes**. |
| **Snooze** | `snoozed_until`, Snoozed status, `unsnoozer.go` wakes it; "Pick a snooze time", free text "e.g. 30m, 3h, 2h30m", Alt+Z; a customer reply reopens. Automation action "snooze". | None (pending is a manual stand-in). | **table-stakes** |
| **Priorities** | `conversation_priorities` table (names only, "Low" seen in the demo), priority marker ("ladders") on each row, Alt+P. | low/normal/high/urgent, chip. | Parity. |
| **Tags** | `tags` + `conversation_tags`; tag picker in the sidebar "Select tags"; "Suggest tags" (AI) ; inbox option "Prompt to tag on reply" → reply-box nudge "No tags on this conversation. Tagging helps with reporting and triage." with "Send anyway"; tags in views, automations, macros, reports ("Tag distribution"); CSV tag importer. | Tags on contacts and companies only. | **table-stakes** |
| **Custom attributes** | Definitions with `applies_to` contact or conversation, `data_type` text/number/checkbox/date/link/list, regex validation; editable in the sidebar; usable in views and automation conditions; writable from the widget JWT (`contact_custom_attributes`). | Custom fields on contacts and companies (host-defined). | Conversation attributes: **skip** for now; `type` + host-defined types already cover the triage need. |
| **Assignment** | Agent and team assignee, teams with "Auto assignment type: Round robin / Manual", "Maximum auto-assigned conversations" per agent, autoassigner every 5 min, agent availability `online/away/away_manual/offline/away_and_reassigning` ("Away and Reassigning: ... any new activity on previously assigned conversations will automatically un-assign"), idle detection, self-assign nudge after replying to an unassigned conversation. | Single assignee, away-until date. | Round-robin: **expected** for 3+ agents. Teams: **skip** (host orgs/roles own this). Self-assign nudge: **differentiator** (cheap). |
| **SLA policies & business hours** | `sla_policies` with first response, next response, resolution; per-metric warning and breach alerts to assignee/team/users ("Add warning alert", "Immediately on breach", "After specific duration"); `business_hours` with weekly hours + holidays, "Always open (24/7)"; team-level hours and timezone; `next_sla_deadline_at` for sorting; `SlaBadge` with live countdown ("Due in", "Overdue by", "SLA met"); report "SLA performance". HN reviewer (`registeredcorn`) wanted severity-based SLAs and holiday handling; the author conceded "this SLA system is not flexible enough". | `reminderAfterHours` per inbox + reminder email. | **expected** (a single first-response target with business hours is enough; see "also considered"). |
| **Automation rules** | Three rule types: `new_conversation`, `conversation_update` (events: incoming/outgoing message, status change, priority change, user/team assigned) and `time_trigger` ("Rules that run once an hour", 90-day lookback). Conditions on subject, content, status, priority, assignee, team, inbox, "to", contact email, hours since created/first reply/last reply/resolved/last resolved, previous_* values, contact custom attributes; operators contains/not contains/equals/not equals/set/not set/greater/less/starts with, case-sensitive flag; groups with AND/OR. Actions: assign_team, assign_user, set_status, set_priority, send_private_note, send_reply, set_sla, add/set/remove tags, send_csat, notify (custom subject/message to agents), snooze, trigger_webhook. "Execute all matching rules" vs "first matching", drag-and-drop weight, loop protection. | None. | **expected** as a small host-side rule set, not a UI builder. |
| **Macros** | Saved reply + actions in one ("One macro can send the message, set tags, and assign the conversation to a team"), visibility all/team/user, "visible when" replying / starting conversation / adding private note, `usage_count`, Ctrl+M, searchable in the palette. Open ask: insert at cursor instead of overwrite (#364). | Canned replies via `/` with `{firstName}`/`{reference}`. | Actions on canned replies: **expected**; the rest is parity. |
| **Canned responses** | See macros. | Yes. | Parity. |
| **CSAT** | Per-inbox "Send customer satisfaction surveys when a conversation is marked as resolved", or via automation; rating 0–5 + feedback, one-shot link, standalone page ("Rate your interaction with us") or embeddable widget, editable email template, rating shown in sidebar, report card "Customer satisfaction: Avg Rating / Responses / Response Rate". | None. | **expected** |
| **Reports** | One "Overview" page: Open conversations, Awaiting First Reply, Agent status (online/away/offline counts), Conversation trends (new vs resolved chart), Message volume (incoming/outgoing/per conversation), SLA performance (met/breached/compliance, avg first/next/resolution), Tag distribution, CSAT; day-range filter; `reports:manage` permission. "Extensive conversation reports" is still on the roadmap. | None. | **expected** |
| **Contacts & notes** | Contacts list, create/edit, block/unblock, delete (cascade), GDPR export, notes (in sidebar too), previous conversations, "Last visited pages", channel identities (email/livechat/whatsapp), `external_user_id`. **No companies/organisations** (open asks #490, #551: "one of the main dealbreakers"), **no merge** (roadmap), no deals. | Contacts with identities, lead stage, tags, custom fields, merge, timeline; companies; deals kanban; activities. | **differentiator** — BH is ahead; keep it. Block contact: **expected** (spam). |
| **Live chat widget** | One `<script>` tag; HS256 JWT identity with `external_user_id`; pre-chat form (incl. phone with country detection); home screen "apps" (help articles card, announcements, links); greeting/intro/notice banner; office hours; proactive messages ("Who sees it / Where and when", URL patterns, device, business hours, dwell time, once per person/session); help centre browsing inside the widget; transcript download; typing + read receipts; connection states "Connecting / Connected / Reconnecting"; trusted domains, blocked IPs, rate limits; JS API `show/hide/toggle/setUser/logout/onShow/onHide/onUnreadCountChange`; documented Widget API + WebSocket protocol for custom frontends; "Conversation continuity" (unread agent replies emailed after `offline_threshold`, replies thread back). | Launcher + panel, type cards, qualifying question, context + screenshot capture, help suggestions, receipt email, booking link, thread with statuses, away notice, dark/auto, identity token, "N conversations waiting" for agents, notify-customer job (same idea as continuity). | Real-time delivery: **expected** (polling is acceptable at launch). JS API with unread callback: **expected**. Screenshot/redact + context capture: **differentiator** (Libredesk has none). |
| **Email channel** | IMAP polling (5 min default, "Scan Inbox Since"), SMTP, Google/Microsoft OAuth, app passwords; plus-addressing, Reply-To, "From display name template" (`{{ .Agent.FirstName }} at {{ .Inbox.Name }}`), loop-detection header, auto-reply discard, quoted-text folding, inline images, CC/BCC with "Contact email not in recipients" guard; Go-template email templates with `{{ .Conversation.ReferenceNumber }}`, `{{ .CSATLink }}`, `{{ .SLA.DueIn }}` etc. | Adapter send; inbound via relay webhook + DKIM; threading by Message-Id/References/plus address; four mail kinds. | Parity in model; the host-adapter design is the right call. Quoted-text folding and CC: **expected**. |
| **Channels** | email, livechat, whatsapp (Meta Cloud API, templates, 24-hour window UX); Telegram WIP. HN day-one ask: "Shopify, ebay, whatsapp, woocommerce". | widget + email (+ host identities github/visitor). | **skip** |
| **Roles & permissions** | Roles with ~45 `object:action` permissions (e.g. `conversations:read_team_inbox`, `messages:write_private`, `contacts:export`); locked Admin role; docs warn "`users:manage` is effectively full access"; SSO via Google/Microsoft/any OIDC, "SSO-only" mode, 2FA WIP. | `isAgent` from the host. | **skip** (host owns identity). A read-only/limited agent flag may come later. |
| **Activity / audit log** | `activity_logs` only for: agent login/logout, away/online changes, password set, role permission changes, contact deleted, contact data exported. Conversation changes are not in it; they are `activity` messages inside the thread ("Agent assigned", "Team assigned", status changes). | None. | In-thread activity lines: **expected**. Admin audit log: **skip**. |
| **Webhooks** | Admin-configured URLs, events `conversation.created / status_changed / tags_changed / assigned / unassigned`, `message.created / updated`, HMAC signature header, retries, 5 workers, optional SSRF guard; automation action "trigger webhook" with a custom event name. Open ask: templated payloads for Discord (#306). | None. | **expected**, as a host hook not HTTP. |
| **API** | Per-agent API key/secret, permission-scoped REST (conversations, messages, contacts, notes, agents, teams, tags, views, reports, search, media, help centre), OpenAPI, `source_id` on create for idempotent integrations. | None beyond the mounted routes. | **skip** as tokens; the host calls `service` directly. |
| **AI** | Provider: "any OpenAI-compatible endpoint" (enum `openai`), API key in Admin; AI assistants (persona, instructions, guardrails, languages, max turns, fallback team, "Offer handoff to a human", test harness); Copilot "Juno" sidebar tab ("Ask Juno anything. It can search your knowledge base"); "Generate reply"; editor prompts (rewrite: the HN-mocked "Add Empathy"); "Summarize with AI" → private note; "Suggest tags"; knowledge snippets + "Learn from resolved conversations" (draft FAQ snippets to approve); custom tools with per-call agent approval; email OTP to verify contacts before tools act. Complaint: "the UI is filled with AI-related buttons which I won't use" when no provider is set (#639). | `generate({system,prompt,schema})` adapter; triage suggestion; draft reply. | Adapter model is better for us. "Summarize to note": **expected**. Hide AI affordances when no adapter: **table-stakes** hygiene. Autonomous assistant: **skip**. |
| **Notifications (agent)** | In-app bell + panel, email, browser push (PWA), per-agent preferences per type × channel; types: mention, assignment, new reply (assigned / participating), reopened, SLA warning/breach per metric, automation "notify". Notification sound only when tab unfocused. | agent-new and agent-reminder emails. | In-app list + "assigned to you" email: **expected**. Push: **skip**. |
| **Keyboard** | ⌘K palette ("Search or jump to…"), ⌘/ shortcuts dialog; Alt+J/K prev/next, Alt+Z snooze, Alt+P priority, Alt+A assign, Alt+R reply, Alt+N note, Alt+X select, Alt+E resolve, Alt+O reopen, Alt+C new; ⌘M macros, ⌘P toggle reply/note, Alt+M minimise, Ctrl+Enter send, ⌘B/I. | j/k, ⌘↵, ⌘⇧↵, `/` canned. | **expected** (small set + dialog). |
| **i18n** | 13 locales via Crowdin (en-US, de-DE, fr, es, it, nl, da, pt-BR, pt-PT, ja, zh-CN, fa, mr); backend strings fall back to English; widget auto-detects browser language; help centre per-locale articles. Known pluralisation issues (#291, #427). | EN + Swiss Standard German, typed. | Parity for our market; the typed `de` table is a quality edge. |
| **Dark mode** | Yes, since v0.6; "Switch to dark mode" in palette; email bodies forced onto a light canvas in dark mode; help centre light/dark/system. Design tokens documented in `DESIGN.md`. | Widget dark/auto. Admin: not listed. | Admin dark mode: **expected**. |
| **Bulk actions** | v2.3: select via avatar checkbox, "{count} selected" toolbar with assign agent/team, status, tags, "Clear selection"; also from the palette ("Selected conversations" section); Alt+X. | None. | **expected** |
| **Collision detection** | None as such (no "X is viewing"); has typing indicators and read receipts for live chat via WebSocket. | None. | A light "viewing" chip: **differentiator**. |
| **Merge conversations** | None; the single most up-voted open issue (#177, +11). | None. | **differentiator** if cheap; otherwise expected. |
| **Customer portal** | Via the widget + help centre (author's "Option 1"); ROADMAP "Web / Customer Portal - WIP". | Widget is the portal. | Parity; BH's model is the one Libredesk is converging on. |
| **Help centre** | Full CMS: collections, articles, locales, linked translations, two layouts, theme/CSS/JS, custom domain, search with suggestions, feedback, search insights, AI answers. | Help-search adapter. | **skip** (host already has docs). |
| **Attachments & editor** | Tiptap with tables, callouts, collapsibles, code blocks, YouTube, inline images with resize, image lightbox, audio player, drafts auto-saved per reply type. | Bold/italic/underline/lists/links, attachments, paste image. | Drafts persistence: **expected**. Rich blocks: skip. |
| **Search** | Trigram search over message text, contact email/phone, reference; dedicated results page with filters, highlighting, cursor pagination. | tsvector over title/subject. | Message-body search: **expected**. |
| **Retention / GDPR** | Contact delete + export; media sweeper; no resolved-conversation retention setting that I could find. | Retention after N days. | Parity/ahead. |

---

## 3. UI/UX patterns worth adopting

Taken from the hero screenshot (demo data, dark theme), the component templates and the i18n strings. Quotes are actual UI labels.

1. **Counted sidebar with three groups.** Left rail (icons for inbox, contacts, reports, admin) plus a 230 px sidebar: "+ New conversation", then "My Inbox 12", "Mentions 1", "Unassigned 4", "All 41", then section labels in `text-xs uppercase tracking-wider`: "TEAM INBOXES" (emoji + name), "VIEWS", "SHARED VIEWS", each row carrying an open count on the right. Why it works: the count answers "is there anything for me?" without a click, which is exactly issue #367 ("when 'My Inbox' is selected, there is no visibility of new messages sitting in Unassigned"). In Better Helpdesk: turn the current all/mine/unassigned toggle into a left column with counts, group inboxes under "INBOXES" (support, sales) with counts, and later "VIEWS". The counts ride on the existing 10 s poll.

2. **List header as two dropdowns: status and sort.** The pane title "All" sits above "29 Open ▾ ... Newest activity ▾". Status is a filter *and* a count in one control; sort is a dropdown with seven options. Why it works: it keeps the toolbar to one line and makes the count part of the filter's label. In BH: replace the status `<select>` and sort `<select>` with the same two controls and show the count in the status label ("12 open").

3. **Row anatomy that encodes state without colour blocks.** Name bold only when unread; the preview line is `text-foreground font-medium` when unread and muted otherwise; a left-pointing arrow in the preview means "last message was ours" (so an unanswered customer message has no arrow); a tiny priority "ladder" icon and a channel icon sit before the relative time in `tabular-nums`; the unread count is a small green pill; while the customer types the preview is replaced by "Typing…". Why: one glance distinguishes "they wrote, we owe a reply" from "we wrote, waiting on them". In BH: add unread-per-agent (needs `conversation_last_seen`-style table), the reply arrow, and move the amber/red waiting indicator to the time slot.

4. **Reply box: segmented "Reply | Private note", hint line, split send, minimise with draft peek.** The composer header is a two-tab segment; the private-note mode tints the editor with the `private` token (amber-ish) so a note cannot be mistaken for a reply; under the editor a muted hint reads "Shift + Enter to add a new line. Ctrl + Enter to send. Ctrl + K to open command bar."; the Send button has a chevron for "Send and set as [status]"; a minimise button collapses the box and "show[s] the draft text on the collapsed reply box"; a fullscreen toggle. Two guards: "Contact email not in recipients — The contact's email ({email}) is not included in to, cc, or bcc" and the per-inbox "No tags on this conversation... You can still send without tagging." with "Send anyway". In BH: the tabs and tint are a small CSS change; the hint line costs one i18n key; "Send and resolve" could become "Send and set as" once snooze exists.

5. **Self-assign nudge after a reply.** `AssignSelfNudge.vue`: a floating pill at the bottom of the thread, "This conversation isn't assigned to anyone." + [Assign to me] + ×, with a 200 ms slide-in. Why: it fixes the commonest hygiene failure (answering without owning) at the moment it happens, without forcing it. In BH: render after a reply on an unassigned conversation; dismissible per conversation.

6. **Command palette with contextual sections and a free-text snooze.** ⌘K opens "Search or jump to…" with sections "Go to", "Conversation list", "Selected conversations"; commands include "Assign to me", "Filter by status", "Snooze for", "Pick a snooze time" with placeholder "e.g. 30m, 3h, 2h30m", "Switch to private note", "Set status to away", "Switch to dark mode", "New view". A ⌘/ dialog lists shortcuts in three groups (General / Conversations / Reply editor) with `<kbd>` chips and platform-aware ⌘ vs Ctrl. In BH: a palette is a medium build; the shortcuts dialog is small and worth doing first.

7. **Right sidebar with "Details | Juno" tabs and collapsible blocks.** Contact card: avatar, name with external-link icon, email with a shield icon ("Identity verified" / "Identity not verified") and a copy button, phone, country; then "Context links" rendered as plain link rows ("Stripe customer", "HubSpot contact", "Internal admin lookup"); then an "Actions" block (agent select, team select, priority select, tag chips with ×, "Suggest tags"); then "Information" (Inbox with channel icon, Subject, Reference number, Initiated at, First reply at); further down custom attributes, "Previous conversations", notes. Why: actions are grouped where the eye lands after reading, and the verified badge answers the question agents ask most in B2B ("is this really the customer?"). In BH: the customer panel already has verified/unverified; adopt the collapsible "Actions / Information" grouping and let the host supply link rows (see work item 9's `links` idea in "also considered").

8. **SLA badge with a live countdown and semantic colour.** `SlaBadge.vue`: clock + "First response 1h 20m" in warning amber while remaining, alert icon + "Overdue by 2h" in destructive red, check + "SLA met" in success green; recomputed every 30 s client-side. `DESIGN.md` fixes the mapping: success = met/verified/online, warning = away/approaching, destructive = breached/overdue, "Do not color a number unless the color means something." In BH: the amber-6h/red-24h waiting indicator already follows this; a "Due in" label from `reminderAfterHours` would be the first step.

9. **Thread readability: day separators, grouped bubbles, folded quotes, activity lines.** Messages are grouped by day ("2 Sep 2026"), consecutive messages from one sender collapse into one group, long emails get an expand button, "Show quoted text / Hide quoted text" folds the reply chain, system events render as small centred activity lines ("Agent assigned", status changes), live-chat messages show a double tick when read, and continuity replies are marked "Sent via email". In BH: day separators and quoted-text folding are small; activity lines need an `activity` message kind.

10. **Empty, loading and first-run states.** Skeleton rows while loading; "No conversations found / Try adjusting filters" with a thin 40 px icon at 40 % opacity; "All conversations loaded" at the end of the list; "Select a conversation from the left panel." in the empty detail pane; and on a fresh install the detail pane becomes a checklist "Complete your setup: ○ Create your first inbox [Set up] ○ Invite teammates [Invite]". A floating "connection status" pill appears when the socket drops ("Reconnecting"). In BH: the first-run checklist maps to "configure an email adapter / add the widget / invite an agent" and could read the host config to tick items.

11. **Bulk selection without a dedicated mode.** Hovering a row swaps the avatar for a checkbox (`can-hover:group-hover:flex`), on touch there is a context-menu entry "start bulk selection"; a toolbar appears above the list with "{count} selected" (aria-live), icon buttons for assign/team/status/tags, and "Clear selection". In BH: same mechanic once bulk endpoints exist.

12. **Widget touches.** Pre-chat form only for anonymous visitors ("Allow start conversation" separately for users and visitors), home-screen cards ("Add help articles"), a notice banner ("Our response times are slower than usual…"), "Download transcript", and the connection banner. BH already has most of this; "Download transcript" and a notice banner are small additions.

---

## 4. Deliberate scope decisions to mirror or consciously differ from

| Libredesk decision | Mirror / differ | Reasoning for Better Helpdesk |
|---|---|---|
| **Email first, channels later; live chat only after a year of stabilising** | Mirror | BH's two channels (widget, email) are the ones a B2B SaaS actually needs. Libredesk's day-one HN thread was dominated by channel asks, and the author still waited 14 months. Do not add WhatsApp/Telegram/social. |
| **One deployable artifact** | Mirror in spirit, differ in substance | Their "single binary" still needs Postgres and Redis, and HN called that out immediately. BH's equivalent promise is stronger: one npm package, the host's Postgres, no Redis, no second process. Say that explicitly in positioning. |
| **No hosted mode, no monetisation** | Mirror the "no hosted mode"; differ on sustainability | Same product stance; but BH has design partners and a reason to exist beyond a hobby, which answers the HN worry ("without monetization strategy, project risks abandonment"). |
| **Statuses: locked defaults + category (open/waiting/resolved)** | Mirror the category idea, not custom statuses | The category is what makes snooze, reopen-on-reply and counts behave. BH's open/pending/resolved already map to the three categories; adding `snoozedUntil` as a timed `pending` is enough. Skip custom statuses (users mostly wanted to rename them, #432). |
| **Views over fixed tabs** | Adopt both | Libredesk keeps My Inbox/Unassigned/All *and* saved views. BH should keep its three tabs and add flat saved views; nested AND/OR groups came in v2.4 and are overkill for 1–10 people. |
| **Macros = reply + actions, scoped by visibility and "visible when"** | Partly mirror | Add optional actions (set status, assign, tag) to canned replies. Skip team/user visibility until there are teams. |
| **Roles with 45 permissions, SSO, 2FA** | Differ | The host owns identity. The `users:manage` warning in their docs shows how quickly this gets dangerous. Keep `isAgent`. |
| **Customer portal = widget + help centre (Option 1)** | Mirror, already true | Libredesk's author independently arrived at BH's model. Use this in marketing: there is no portal to build or log into; the host's app *is* the portal. |
| **AI configured in-app, assistant that answers autonomously, tools with approval** | Differ | BH's adapter is the better abstraction for a library. Mirror two things: hide every AI affordance when no adapter is configured (#639 is a real irritation), and keep AI output as suggestions/drafts with explicit apply. |
| **Help centre CMS with custom domains** | Differ | The host already has docs; the help adapter is correct. |
| **Webhooks with HMAC, retries, SSRF guard** | Differ in mechanism | A library should expose an `onEvent` callback, not run an HTTP delivery queue. Same event names. |
| **Audit log limited to security events** | Mirror the restraint | They log logins, availability changes, permission changes, contact delete/export, and nothing else. For BH the useful subset is in-thread activity lines plus contact delete/export in the host's own audit trail. |
| **GDPR: contact delete + export** | Mirror | EU/Swiss buyers ask for it. BH has retention; add export of a contact's data (JSON) and cascade delete. |
| **Mobile: not a focus, later done by the community** | Differ cautiously | For 1–10 person teams the owner answers on a phone at weekends. The widget already works on phones; the admin should at least not break at 375 px. |
| **Reports: one overview page, nothing else, "extensive reports" still on the roadmap** | Mirror the minimal page | A single overview page with six cards satisfies most small teams; dashboards are a sink. |
| **Context links to external systems from the sidebar** | Mirror cheaply | Their best idea for integrations: no sync, just deep links with the contact's id. In BH the host can supply `links(contact, company)` returning labelled URLs; the host *is* the CRM/billing system, so this is a one-liner for them. |
| **Scale target drifting to "500 agents"** | Differ | BH's positioning is 1–10 agents inside a product. Do not chase their worker pools, WebSocket hub or search page; polling with ETag-style change detection is fine at that size. |

---

## 5. What users complain about or ask for

Ranked by GitHub reactions and comments (open unless noted), then HN.

1. **Ticket merging** — #177, +11 reactions, the top open ask; also "Contact merging" on the roadmap. (BH already merges contacts; conversations not yet.)
2. **More channels** — #241 (+5): WhatsApp (now shipped), Telegram (WIP), then "Facebook Messenger, Instagram, X, TikTok, Voice". HN launch: "Integration... Shopify, ebay, whatsapp, woocommerce... is the hard and most important part."
3. **Customer web portal** — #221 (20 comments), discussion #267 "Public Page for Customers": customers want to see all their past tickets. Author leaning to widget-as-portal.
4. **SQLite / fewer moving parts** — #489 (+3) and the HN "it still needs postgres and redis" thread.
5. **MCP endpoint for external AI agents** — #265 (+3).
6. **Sidebar counts** — #367 (+2) and #466; shipped in v2.9 via community PR. Confirms counts are table-stakes.
7. **Companies / organisations** — #490 "Map Contacts to Organizations", discussion #551 "group contacts by customer... one of the main dealbreakers for many of them that prevents us from choosing libredesk", including auto-tagging by sender domain. (BH has companies with domain suggestion.)
8. **Table view and Kanban** — #465, discussion #278; deferred by the author.
9. **Rename/delete default statuses** — #432; refused because behaviour is tied to them.
10. **Webhook configurability** (templated payloads for Discord) — #306 (+2).
11. **Email handling details** — "Include quoted history in outgoing replies" #517, "Mark fetched emails as read" #354, "Leave messages on server" #352, "Ingest the Sent folder so replies written outside Libredesk appear" #623, "Microsoft shared mailboxes" #416, "prevent each email from becoming a ticket" #383 (author's answer: filter in Gmail, scan a label), "Move ticket to different inbox" #307, "Reply-To as From" #227, "Hide auto-replies" #258, "Multiple outgoing email templates" #242, "Previous message template variable" #202, "Google Groups header remapping" #348.
12. **Search by custom attribute** — #303 ("Would need a GIN index... totally possible").
13. **Macro inserts at cursor instead of overwriting** — #364 (user has a fork).
14. **Time display** — "Display Times in Configured Timezone" #178, "12/24 hour" #72 (closed).
15. **Paste images into replies** — discussion #243 (+4), "I migrated from Zendesk... a feature my team used a lot"; shipped v2.3.
16. **Link tickets from private notes with `#ref`** — #468, shipped in v2.9-rc.
17. **Mobile agent UI** — #106 (closed by stale bot), #470 PoC merged into v2.8: "I run a self-hosted libredesk instance and wanted to be able to triage tickets from my phone."
18. **Disable AI from the UI when unused** — discussion #639 (+1, with a follow-up asking again).
19. **Email notification on new customer email** — #271 (6 comments) and "Browser Notification" discussion #560: both now covered by notification preferences + push.
20. **Agent-side details** — agent signature (#87), "Position" field for agents (#160), SSO user provisioning (#266), bulk agent import (#115, shipped), SSO-only mode (shipped).
21. **Maintainer bandwidth** — #259: "many PR's taking weeks to get a response... It took ~5 weeks to get a reply."
22. **HN launch feedback** — docs and roadmap missing (fixed), SLA too simplistic for contract-driven teams (severity levels, time zones, holidays), "Add Empathy" AI rewrite ridiculed, canned responses, knowledge base (built), API (built), Jira/GitHub issue linking and "upvote a bug from within a support case" (not built), resizable panes (built).

What this says: even a deliberately lean helpdesk could not skip tags, snooze, views, counts, bulk actions, mentions, CSAT, a report page, webhooks, merge, and companies. The asks that never go away in Libredesk's tracker are exactly the ones Better Helpdesk lists as gaps, minus the ones its CRM already covers.

---

## 6. What NOT to copy

- **Redis, WebSocket hub, in-process worker pools.** They exist because Libredesk is a long-running server; BH has `runJobs()` and polling, and adding a second process or a broker breaks the "no second system" promise.
- **Own login, roles with 45 permissions, OIDC/SSO, 2FA, API keys per agent, activity log of logins.** All of it is identity, and the host owns identity; `isAgent` is the whole model.
- **IMAP polling, Google/Microsoft OAuth inbox setup, SMTP pools.** BH's adapter + relay webhook keeps the package free of mail-server operations and works on serverless hosts.
- **WhatsApp, Telegram, social channels, WhatsApp template management.** Wrong market (B2B SaaS support inside the product), and every channel is a permanent maintenance tax.
- **Help centre CMS (collections, locales, themes, custom domain, search insights).** The host already has docs; the help adapter is the correct seam.
- **Autonomous AI assistant with tools, approval flows, OTP verification, "learn from resolved conversations".** It conflicts with "an agent is a human" and with the adapter philosophy; keep AI as suggestions and drafts.
- **Proactive widget campaigns ("messages visitors first").** Marketing automation, not support; the widget should stay quiet.
- **Custom statuses CRUD.** Users mostly wanted to rename the defaults; the category concept is the useful part.
- **Nested AND/OR filter groups and a full search page with cursor pagination.** Over-scaled for 1–10 agents.
- **PWA + browser push.** Push needs a service worker and VAPID keys owned by the host app; leave notifications to email and the host's own notification system via `onEvent`.
- **White-labelling via a custom static directory and Go email templates.** BH already themes with `--helpdesk-*` properties and lets the host render emails in its adapter.
- **Kanban/table views for conversations.** Libredesk itself declined; BH's kanban belongs to deals, not support.
- **Agent availability state machine (`away_and_reassigning`, idle detection).** BH's away-until date covers the small-team case.

---

## 7. Top 10 recommended work items

All respect: library only, adapters for anything optional, background work inside `runJobs()`, no own auth, no Redis, no second process. Sizes: S < 1 day, M = a few days, L = a week or more. Layers refer to `src/db/schema.ts` (schema), `src/service.ts` + `src/db/store.ts` (service), `src/http.ts` (http), `src/admin/*` (admin), `src/widget/*` (widget), `src/config.ts` (adapter), `src/ui/i18n.ts` is implied by any UI change.

### 1. feat(admin): tag conversations and filter the inbox by tag
- **problem:** An agent cannot mark a conversation "billing" or "onboarding" and later find all of them; the only grouping is `type`, which the customer picked.
- **scope:** In: `conversation_tag` join table (free-text tag names, lowercase-unique per host), tag chips in the conversation header with a picker that creates on enter, a `tag` filter in the inbox list and route, tag names in the search tsvector, EN/DE strings. Out: tag colours, AI "Suggest tags", bulk tagging (item 5), reporting.
- **size:** S–M
- **depends on:** none
- **layers:** schema, service, http, admin
- **evidence:** `tags` + `conversation_tags` tables in `schema.sql`; `admin.tag.help` = "Tags can be used to filter conversations and as conditions in automations"; the reply-box nudge "No tags on this conversation" (`replyBox.missingTagsTitle`).

### 2. feat(service): reopen a resolved conversation when the customer replies
- **problem:** A customer answers "actually it's still broken" on a resolved thread and nobody sees it, because the list defaults to open.
- **scope:** In: on any inbound customer message (widget or inbound email) to a `resolved` conversation set status back to `open`, clear `resolvedAt`, set `waitingSince`; send `agent-new` to the assignee with a "reopened" subject; a "Reopen" action in the conversation header; a retention guard (reopen is not allowed after the conversation was deleted by retention — it becomes a new one with a reference link). Out: a configurable reopen window (Libredesk only has that for WhatsApp), per-inbox toggle.
- **size:** S
- **depends on:** none
- **layers:** service, http, admin, adapter (new `subject` for `agent-new`)
- **evidence:** `ProcessIncomingMessageHooks` → `ReOpenConversation` in `internal/conversation/message.go` ("Reopen conversation if it's not Open"), notification type `conversation_reopened` ("Conversation assigned to me is reopened by a reply"), v0.7.1 fix "conversation would sometimes not reopen when a contact replies".

### 3. feat(admin): show open counts next to Mine, Unassigned, All and each inbox
- **problem:** Working in "Mine", an agent cannot tell that four new conversations are sitting unassigned.
- **scope:** In: one grouped count query (`status in open categories` by assignee bucket and by inbox), returned with the list poll, rendered as small count pills on the three tabs and on the inbox filter options; the "High & urgent" chip stays. Out: per-view counts (item 6 adds them), unread-per-agent counts.
- **size:** S
- **depends on:** none
- **layers:** service, http, admin
- **evidence:** `internal/conversation/sidebar_counts.go`, strings `conversation.sidebarCounts.unassigned` = "{count} open unassigned conversations", issue #367 (author: "we've also received requests for this from our team"), v2.9 "Sidebar counts".

### 4. feat(admin): snooze a conversation and wake it on a timer or a customer reply
- **problem:** "Waiting for the customer's upgrade next Tuesday" currently sits in Pending forever or clutters Open; nobody is reminded when Tuesday comes.
- **scope:** In: `snoozed_until` column; snooze action (presets "1 hour / Tomorrow 9:00 / Next Monday" plus a date-time field) that sets status `pending` and the timestamp; list row shows "Snoozed until {time}"; a `wake` step in `runJobs()` that flips `pending` + past `snoozed_until` back to `open` and sets `waitingSince`; a customer reply wakes it immediately (reuses item 2's path); filter "Snoozed". Out: free-text durations ("2h30m"), per-agent snooze, automation action.
- **size:** M
- **depends on:** item 2 (shared reopen path), nothing hard
- **layers:** schema, service, http, admin, docs (runJobs behaviour)
- **evidence:** `conversations.snoozed_until` with index, `internal/conversation/unsnoozer.go`, Snoozed status in category `waiting`, palette commands "Snooze for" / "Pick a snooze time", shortcut Alt+Z, v2.2.1 fix "Resolved or closed conversations no longer reopen due to a stale snoozed_until" (a trap to test for).

### 5. feat(admin): select several conversations and assign, resolve or tag them at once
- **problem:** After a spam burst or an outage, closing or reassigning twenty conversations one by one takes ten minutes.
- **scope:** In: hover-checkbox over the avatar, shift-click range, toolbar "{n} selected" with assignee, status and tag actions and "Clear selection", one `POST agent/conversations/bulk` endpoint that applies a single change to up to 100 ids in one transaction, partial-failure toast. Out: bulk delete, bulk reply, keyboard range selection.
- **size:** M
- **depends on:** item 1 for the tag action (ship without it if needed)
- **layers:** service, http, admin
- **evidence:** v2.3.0 "Bulk actions on conversations - select multiple conversations to assign, change status, or set tags"; `ConversationBulkActionToolbar.vue` (role="toolbar", aria-live count); `conversation.bulkActions.failedToast` = "Some conversations couldn't be updated".

### 6. feat(admin): save a filter as a view, for yourself or the whole team
- **problem:** "Sales inbox, unassigned, lead type" is a three-click filter an agent rebuilds every morning; the team lead cannot hand colleagues a "Urgent & high, any inbox" list.
- **scope:** In: `view` table (name, filters JSON, `agentId` or null for shared, createdBy), a "Save as view" button that captures the current route filters (inbox, status, assignee bucket, type, priority, tag, sort, query), a "VIEWS" group in the sidebar with counts (reuses item 3's query per view), rename/delete, EN/DE. Out: a filter builder UI, nested groups, date-range filters, per-view notifications.
- **size:** M
- **depends on:** item 3 (counts), item 1 (tag filter) optional
- **layers:** schema, service, http, admin
- **evidence:** `views` table (`filters JSONB`, `visibility user/team/all`), `view.form.description` = "Create and save custom filter views for quick access to your conversations.", `useConversationFilters.js` field list, v0.9.1 "Shared views", v2.4 "Nested filter groups in views" (explicitly out of scope here).

### 7. feat(admin): shortcuts for assign, resolve, priority and note, with a ⌘/ dialog
- **problem:** Power users already use j/k and ⌘↵; everything else still needs the mouse, and nothing tells a new agent which keys exist.
- **scope:** In: `e` resolve, `a` assign to me, `p` open priority picker, `r` reply / `n` internal note focus, `u` toggle unread (once item 3's follow-up adds unread), `?` or ⌘/ opens a dialog listing shortcuts in groups with `<kbd>` chips, platform-aware ⌘/Ctrl, all ignored while typing in a field. Out: a command palette, user-configurable bindings.
- **size:** S
- **depends on:** none (snooze key `z` lands with item 4)
- **layers:** admin
- **evidence:** `KeyboardShortcutsDialog.vue` groups General / Conversations / Reply editor (Alt+J/K, Alt+Z, Alt+P, Alt+A, Alt+R/N, Alt+X, Alt+E, Alt+O, ⌘M, ⌘P, Alt+M, Ctrl+Enter); editor hint "Shift + Enter to add a new line. Ctrl + Enter to send. Ctrl + K to open command bar."

### 8. feat(admin): @mention a teammate in an internal note and email them
- **problem:** An agent needs an engineer's eyes on a thread; today she has to paste the link into Slack by hand, and the engineer has no "things waiting for me" list.
- **scope:** In: `@` autocomplete over agents in the internal-note editor, `conversation_mention` table (conversation, message, mentionedAgent, by), a "Mentions" bucket in the list with a count, a new mail kind `agent-mention` on the email adapter (`{author} mentioned you in {reference}` + note excerpt + url), mention marks rendered as chips. Out: team mentions, in-app notification centre, `#ref` links (small follow-up).
- **size:** M
- **depends on:** item 3 (count pill pattern)
- **layers:** schema, service, http, admin, adapter, docs (new mail kind)
- **evidence:** `conversation_mentions` table, sidebar item "Mentions 1" in the hero screenshot, `notification.mentionedInConversation` = "{author} mentioned you in #{referenceNumber}", v0.11 "Mention agents or entire teams in private notes using @. Mentioned users receive both in-app and email notifications."

### 9. feat(config): `onEvent` hook for conversation and message events
- **problem:** The host wants "post to Slack when a new conversation arrives" or "create a Linear issue when type = bug" and has no seam; Libredesk users ask the same of webhooks (#306).
- **scope:** In: optional `onEvent?(event): Promise<void>` on `HelpdeskConfig` with a discriminated union `conversation.created | conversation.status_changed | conversation.assigned | conversation.tags_changed | message.created`, each carrying the conversation, the actor (agent id or `customer`/`system`) and the previous value where relevant; called after commit, errors logged not thrown; documented examples (Slack, Linear). Out: HTTP delivery, retries, signatures, a UI, time-based events.
- **size:** S
- **depends on:** item 1 for `tags_changed` (omit until then)
- **layers:** adapter, service, docs
- **evidence:** `webhook_event` enum (`conversation.created, status_changed, tags_changed, assigned, unassigned, message.created, message.updated`), docs "Webhooks: Receive real-time HTTP notifications for Libredesk events", v0.11 "Conversation webhook events now include the full conversation object".

### 10. feat(admin): overview page with volume, first-response and resolution times
- **problem:** The founder cannot answer "how fast do we reply and is it getting better?" without SQL; every per-seat tool they left had this page.
- **scope:** In: one `Overview` section with a 7/30/90-day range: open now, awaiting first reply now, new vs resolved per day (inline SVG bars, no chart dependency), median and p90 first-response and resolution time computed from `createdAt`, first agent message and `resolvedAt`, breakdown by inbox and by type, top tags (after item 1). Out: per-agent leaderboards, CSAT (lands with CSAT), SLA compliance, exports.
- **size:** M
- **depends on:** item 1 optional
- **layers:** service, http, admin
- **evidence:** report strings `report.openConversations`, `report.awaitingFirstReply`, `report.chart.newConversations`/`resolvedConversations`, `report.messages.*`, `report.tags.topTags`; API `Get Overview Counts / Charts / Message Volume / Tag Distribution`; v0.6 "Report overview... SLA performance overview card with day filters"; roadmap still lists "Extensive conversation reports - TODO" (a minimal page was enough for two years).

### Also considered (next tier)
- **feat(admin): CSAT rating after resolve, in the widget and by email** — M; `csat_responses` (rating 0–5 + feedback, one-shot), per-inbox `csat_enabled`, "Rate your interaction with us", rating in sidebar; BH version: a rating link in the resolve email and a rating row in the widget thread.
- **feat(config): host-defined triage rules on new conversations** — L; Libredesk's `new_conversation` rules with `assign_user / set_priority / add_tags` actions; BH version: a `rules` array in config (conditions on inbox, type, contact domain, subject contains, company lead stage → assign/priority/tag/title), evaluated in service, no UI.
- **feat(admin): first-response target with business hours and a "due in" badge** — L; `sla_policies` + `business_hours` with holidays, `SlaBadge` "Due in / Overdue by / SLA met", sort "Next SLA target"; BH version: evolve `reminderAfterHours` into `{ firstResponseHours, businessHours, timezone, holidays }` per inbox.
- **feat(admin): merge two conversations** — M; Libredesk's top open request (#177, +11), unbuilt there; BH could ship it first (move messages, keep both references, redirect the old one).
- **feat(admin): activity lines in the thread for assignment, status and priority changes** — S; `message_type 'activity'`, `ActivityMessageBubble.vue`; doubles as the per-conversation audit trail.
- **fix(admin): hide AI suggestion and draft controls when no `ai` adapter is configured** — S; discussion #639.
- **feat(admin): `#1042` autolinks to a conversation in notes** — S; PR #475 ("just like mentions").
- **feat(admin): "{agent} is viewing" chip on a conversation** — S–M; piggyback a `viewing` heartbeat on the 10 s poll; Libredesk has typing/read receipts over WebSocket but no collision chip, so this would be a genuine small differentiator.
- **feat(config): `links(contact, company)` for host deep links in the customer panel** — S; Libredesk "Context links" ("Stripe customer", "HubSpot contact"); for an embedded library the host already knows its own URLs.

---

## 8. Sources

Repository and code (via GitHub API/raw):
- https://github.com/abhinavxd/libredesk (README, ROADMAP.md, VERSION, go.mod, config.sample.toml, schema.sql)
- https://github.com/abhinavxd/libredesk/releases (all 48 release notes, v0.1.0-alpha … v2.9.0-rc.8)
- https://github.com/abhinavxd/libredesk/blob/main/internal/automation/models/models.go
- https://github.com/abhinavxd/libredesk/blob/main/internal/conversation/message.go and `queries.sql`
- https://github.com/abhinavxd/libredesk/blob/main/internal/inbox/models/models.go
- https://github.com/abhinavxd/libredesk/blob/main/i18n/en-US.json
- https://github.com/abhinavxd/libredesk/blob/main/frontend/DESIGN.md
- https://github.com/abhinavxd/libredesk/tree/main/frontend/apps/main/src (component tree; `KeyboardShortcutsDialog.vue`, `composables/useConversationFilters.js`, `composables/useSla.js`, `features/conversation/list/ConversationListItem.vue`, `ConversationBulkActionToolbar.vue`, `ConversationEmptyList.vue`, `ConversationPlaceholder.vue`, `PriorityMarker.vue`, `message/AssignSelfNudge.vue`, `features/sla/SlaBadge.vue`)
- GitHub API: repo metadata, contributors, commits since 2026-07-01, issue search (open/closed by reactions and comments), discussions via GraphQL
- Issues: #177, #221, #241, #259, #265, #306, #335, #364, #367, #383, #432, #465, #468, #470, #489
- Discussions: #83, #125, #146, #243, #267, #278, #303, #304, #551, #584, #639

Documentation and website:
- https://docs.libredesk.io/llms.txt (full nav)
- https://docs.libredesk.io/introduction.md
- https://docs.libredesk.io/getting-started/installation.md
- https://docs.libredesk.io/configuration/connecting-inboxes.md
- https://docs.libredesk.io/configuration/livechat.md
- https://docs.libredesk.io/configuration/help-center.md
- https://docs.libredesk.io/configuration/email-templates.md
- https://docs.libredesk.io/configuration/ai.md
- https://docs.libredesk.io/configuration/webhooks.md
- https://docs.libredesk.io/configuration/context-links.md
- https://docs.libredesk.io/roles/overview.md
- https://docs.libredesk.io/api-reference/widget-api.md
- https://libredesk.io/ (marketing copy, FAQ, `hero-dark.png`, `og.png` screenshots)

Community opinion:
- https://news.ycombinator.com/item?id=43158166 (Show HN, Feb 2025, 376 points; read via hn.algolia.com API)
- https://news.ycombinator.com/item?id=47833870 (Show HN, 2026, "A year later, it's omni-channel")
- https://news.ycombinator.com/item?id=46419232 (link post, no comments)
- https://news.ycombinator.com/item?id=49451823 (Qisutu thread comparison, Sep 2026)
- https://www.getmacha.com/blog/best-open-source-ticketing-systems (Sep 2026 round-up)
- https://opsily.com/blog/open-source-helpdesk-alternatives (checked; does not cover Libredesk)
- Reddit: not reachable from this environment; r/selfhosted sentiment is reported second-hand via the getmacha article only.
