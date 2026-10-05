# Intercom (now "Fin") vs Better Helpdesk — competitive analysis, October 2026

Scope: Intercom's Inbox, Messenger, Help Center/Articles, Fin AI Agent, Copilot, Workflows and Outbound as they stand in autumn 2026, measured against Better Helpdesk v0.1.3. Primary sources were preferred (intercom.com/pricing, fin.ai/pricing and the Fin pricing help article, the changelog at intercom.com/changes/en, help articles, developers.intercom.com). Where a help article body could not be retrieved (Intercom's help pages render the article behind a very long navigation tree and several fetches returned only that tree), the fact is sourced from the article's search excerpt and marked as such. Where I could not verify a detail, I say so rather than guess.

---

## 1. Snapshot

### What it is in 2026

Intercom is a customer-service platform sold as four layers: a per-seat helpdesk (the Inbox, tickets, a Messenger, a Help Center, reporting, Workflows), an AI agent for customers (Fin), an AI assistant for support staff inside the Inbox (Copilot), and an outbound/engagement layer (Proactive Support Plus: Posts, Checklists, Product Tours, Surveys, Series). Everything runs on Intercom's hosted infrastructure; the host installs a JavaScript Messenger plus mobile SDKs and talks to the rest through the REST API and webhooks.

Two corporate facts frame any 2026 analysis:

- **The company renamed itself to Fin on 12 May 2026.** CEO Eoghan McCabe announced it on LinkedIn; the "Intercom" name survives as the name of the helpdesk product, the corporate brand is now the AI agent's name, and all ~1,400 employees moved to the new entity. The company's own help centre and pricing pages now mix "Fin" and "Intercom" freely.
- **Salesforce agreed to acquire Fin for about $3.6B in cash, announced 15 June 2026.** The deal is signed but not closed (expected around Salesforce's FQ4 2027, pending regulatory approval). Salesforce's stated plan is to fold Fin's customer-agent technology into Agentforce; coverage I found says nothing about the long-term fate of the per-seat helpdesk and Messenger. For a buyer this is roadmap uncertainty; for Better Helpdesk it is a selling point (see section 4).

### Who it is for

Sacra's April 2026 note describes the customer base as SMB and mid-market, B2B over B2C ("higher-value interactions but lower volume"). Fin is also sold standalone on top of Zendesk, Salesforce, HubSpot and Freshdesk helpdesks, which is how Intercom reaches larger enterprises without displacing their ticketing.

### Scale

- ARR ~$400M in April 2026, up from ~$382M at end of 2025; ~27% YoY (Sacra).
- Fin crossed $100M ARR, growing ~350%/yr; ~8,000 businesses on Fin (Sacra); "nearly 2 million" resolutions per week; 67% average resolution rate across 7,000+ customers (Sacra). Acquisition coverage cites "more than 30,000 business customers" (all products) and "roughly 76%" of inbound requests closed without a human; the two resolution figures are from different sources and dates, so treat them as a range.
- Net revenue retention moved from 112% to 146% after Fin's outcome pricing (Sacra). Intercom's own support team reportedly resolves 81% of volume with Fin.

### Pricing (intercom.com/pricing and fin.ai/pricing, October 2026)

Per-seat helpdesk plans (annual billing; monthly in brackets). Essential was checked on intercom.com/pricing on 5 October 2026; Advanced and Expert are still from third-party pricing round-ups:

| Plan | Price | What it adds (pricing page wording) |
|---|---|---|
| Essential | $19/seat/mo ($29 monthly) | "Fin for service, sales & ecommerce, Messenger, Shared inbox and ticketing system, Pre-built reports, Public help center"; simple automations; Slack |
| Advanced | $85/seat/mo ($99 monthly) | "Multiple team Inboxes, Workflows automation builder, Round robin assignment, Private and multilingual Help Center, Includes 20 free Lite seats" |
| Expert | $132/seat/mo ($139 monthly) | "SSO & identity management, HIPAA support, Service level agreements (SLAs), Multibrand Messenger / Help Center, Includes 50 free Lite seats"; balanced assignment and Messenger queue position are also Expert-only |

Fin AI Agent (usage, on top of every plan):

- "$0.99 per outcome". The Fin pricing help article defines a Resolution as "an outcome where the customer confirms Fin resolved the issue or does not request more help after Fin answers": a *confirmed* resolution ("Ok thanks") or an *assumed* resolution (customer leaves and does not come back within 24 hours). Also billable at $0.99: a Procedure handoff ("Fin successfully executes a Procedure that you've configured to end in a handoff to a human or a workflow"), disqualification and self-serve routing. Lead qualification (Fin for Sales) is $9.99 per outcome. Billed once per conversation. Not billed: default escalations, procedure failures, abandoned clarifying questions, explicit "talk to a human" before any answer.
- Fin without an Intercom helpdesk: "No seats required", "Minimum monthly commitment applies"; the help article describes a $49/month base that includes 50 outcomes, overage at $0.99, unused outcomes expire monthly.
- Third-party analyses date a March 2026 change that kept the $0.99 price but widened the billable set to procedure handoffs, which raises bills without touching the rate card.

Add-ons:

- **Copilot**: "$29 per agent/mo" on intercom.com/pricing ("Free to use in 10 Copilot and 10 AI Auto-translation conversations per agent/mo"); fin.ai/pricing shows "$35 per user per month". The two pages disagree; I could not establish which is current.
- **Pro**: "$99/mo", "analysis of 1,000 conversations/month and 2,000 credits"; brings Fin Operator, CX Score, AI Topics, custom AI Scorecards.
- **Proactive Support Plus**: "$99/mo" including 500 "messages sent"; covers Posts, Checklists, Product Tours, Surveys, Series. Posts, Tours, Surveys, Mobile Push, Carousels and Series are metered per presentation (a tour shown twice to one user counts twice); Checklists, News, A/B testing, webhooks, versioning, event-based messaging are unmetered.
- **Channels**: "free, unlimited live chat, support email, in-app chats, banners, and tooltips" on every plan; email campaigns, SMS, WhatsApp and Phone are "Pay-as-you-go".
- **Seats**: Lite seats are free on Advanced (20) and Expert (50), paid at full price on Essential. A Lite seat can read a conversation it is linked to or @mentioned in and add internal notes, but "cannot reply directly to customers", cannot search, cannot see the full details sidebar, and cannot be assigned conversations.
- 14-day trial "Includes all features, Fin, and add-ons"; an Early Stage programme offers "93% off Intercom and an entire year of Fin completely free".

Illustrative total for a 5-agent EU team on Advanced with Copilot and modest Fin use: 5 × $85 + 5 × $29 + ~300 outcomes × $0.99 ≈ $870/month before channels, and EU data hosting requires an annual contract via sales.

### What changed recently (changelog at intercom.com/changes/en; the /changelog URL is dead)

- **Oct 2025** "Fin UI & Messenger Experience Updates": simplified sender names and metadata in the conversation, an expanded web composer with file attachments, and the Messenger "now clearly shows when Fin hands over a conversation to a human teammate". Also: 13-dataset CSV export; Supademo embeds in Help Center.
- **Nov–Dec 2025**: native Slack integration (channels, broadcasts, tickets, Fin in Slack); customisable AI topic taxonomy; BPO visibility toggles with redaction; a single place to manage Fin's knowledge; a timestamped changelog for Fin Guidance/Tasks/Content; "A more natural, empathetic Fin" (10% shorter answers); CX Score improvements.
- **Feb 2026**: search inside Views and duplicate a View.
- **Mar–Apr 2026**: edit internal notes (with "edited" timestamp); "Find urgent conversations faster with SLA based sorting"; separate drafts for replies and notes; separate reply windows for tickets vs conversations; inline thumbs up/down on translations; side-conversation export; ticket resolution time in office hours; Fin for Sales; Spam inbox view; Fin reads PDFs and images; Fin CLI; AI-generated Procedures with simulations and versioning.
- **May 2026**: company renamed to Fin.
- **Jun 2026**: Role-based sidebar templates; branded customer-facing workspace name; on-demand Inbox translation for up to 10 languages; Banners API for custom surfaces; ticket forms over WhatsApp/SMS/Facebook/Instagram/email; Fin over Telegram; Fin Voice 2; Fin email follow-ups, spam guidance, previews, multi-participant controls; Monitors & Scorecards for teammates. Salesforce deal announced.
- **Jul 2026**: "A faster, modern design for your Help Center" (persistent sidebar, breadcrumbs, instant page transitions); voice transcription in the Messenger; wrap-up protection on chat and email; per-teammate office hours in reporting; snooze-time metrics; Fin Memory across channels; Procedures "Wait for Webhook" and "Wait step".
- **Aug 2026**: Incident Detection (flags an emerging incident within minutes); "Control which conversations teammates can take or drop"; phone real-time queue dashboard.
- **Sep 2026**: "See who's viewing a conversation, now in Table view" (up to three avatars per row, "+N" overflow, requires "Show teammates presence"); "Export a saved View exactly as you see it" to CSV; "Merge duplicate users into one profile"; "Apply a macro when creating a ticket"; code blocks in conversations with syntax highlighting, line numbers and copy; "Configurable Unsnooze Controls"; scheduled export of teammate and activity-log data; custom metrics in reporting; ready-made data-connector templates (Stripe, Shopify, Statuspage) and a Snowflake connector for Fin.

Mobile: the teammate app "Intercom Conversations" (iOS/Android) is officially "in maintenance mode" — no new features, only severe bugs. Customer-side iOS/Android Messenger SDKs with push continue.

---

## 2. Feature inventory vs Better Helpdesk

Verdict key: **table-stakes** = a 1–10 person B2B team misses it in week one; **expected** = they would expect it within months; **differentiator** = could set Better Helpdesk apart; **skip** = not for the embedded-library positioning.

| Area | Intercom (2026) | Better Helpdesk today | Verdict |
|---|---|---|---|
| Inbox layout & speed | "Next-gen" Inbox: three panes, every side panel collapsible, Table layout for managers, dark mode, "10x performance" claim, composer drafts auto-saved, separate reply/note drafts, delay send / undo send, Copilot side pane. | Two/three-pane list + conversation + customer panel; 10-second polling; dark theme via tokens. No collapsible details panel, no draft persistence, no undo send. | expected (collapsible panel, drafts); differentiator (lightweight, no page weight) |
| Keyboard & command bar | ⌘K / Ctrl-K command menu for every action incl. "Select all matching" (up to 10,000); direct keys documented: R reply, N note, ⌘⇧Y close; "Manage > Keyboard shortcuts" list. | j/k list navigation, ⌘↵ send, ⌘⇧↵ send and resolve. | expected |
| Views & filters | Filters by status, assignee, tags, priority, channel, SLA, waiting since, ticket type, customer attributes; saved Views (search within, duplicate, export CSV); sort by Date started, Last activity, Waiting since, Next SLA, any sortable attribute; status buttons. | all/mine/unassigned, inbox, status, search, sort longest-waiting or priority, "High & urgent" chip. No saved views, no tag filter. | table-stakes (tag filter, assignee filter); expected (saved views) |
| Macros / canned replies | Macros = content + actions (tag, assign, snooze, close, re-open, set ticket state), applied via `\`, `#word`, ⌘K or Copilot suggestion (Tab to insert, Esc to reject); permissions on who may create/edit. | Canned replies via `/` with {firstName}/{reference}. No actions. | expected (actions on a canned reply) |
| Workflows / automation | Visual Workflows builder (Advanced+): triggers "Customer sends their first message", "Customer opens a new conversation in the Messenger", "Customer visits a page", "Customer clicks a website element", "Customer sends any message", "Customer or teammate has been unresponsive", "Teammate changes conversation state", "When a conversation receives a CX Score rating"; steps assign/tag/priority/send message/ask for details/branch/Fin/snooze/close/set SLA/wait/"Wait for Webhook". Templates: auto-close unresponsive, auto reassign, route by language, CSAT on close, Slack notify. | AI triage suggestion (type, priority, title, duplicates) with apply/dismiss; reminder email after N hours per inbox; retention job. No rules engine. | expected (a few declarative rules: auto-resolve after N days pending, auto-assign by inbox/type); skip (visual builder) |
| SLA & office hours | SLA targets (Expert): first response, next response, time to close, time to resolve; conditions; "SLA at risk"/"Breached" labels; pause on snooze; SLA-based sorting; office hours per workspace and per team; per-teammate hours in reporting; holiday hours; reply-time expectation shown to customers; "Ticket time to resolve in office hours". | Waiting indicator amber at 6h / red at 24h, wall clock only; per-agent away date; reply promise text. No office hours, no targets. | table-stakes (office hours); expected (a first-response target per inbox) |
| Assignment & routing | Round robin (Advanced), Balanced by fewest open (Expert), assignment limits, "Skip away mode", auto-away, "Away and reassigning", custom away reasons, auto-reassign from unresponsive teammates, wrap-up protection, "Control which conversations teammates can take or drop". | Manual assignee; per-agent away until date (widget shows when team is back). | expected (round-robin or "assign to me" with away-aware default); skip (balanced, limits) |
| Collaboration | Internal notes with @teammate and @team mentions; "Mentions" inbox with Mentions / Reactions / Unread filters; edit notes; reactions on notes; side conversations (email a third party from inside the thread, export the thread); presence: "Show teammates presence" avatars on rows (3 + "+N") and in the conversation. | Reply vs internal note; participants (add contact, share with company). No mentions, no presence, no side conversations. | table-stakes (presence/collision for ≥2 agents); expected (mentions) |
| Tags & attributes | Tags (manual, macro, workflow; reporting template "Conversation tags"); Conversation data attributes (CvDAs: text, list, number, decimal, boolean, date, reference, file) with "Required attribute" before close ("The following attributes are required before closing the conversation"); AI Topics taxonomy. | Type (question/bug/feature/lead + host-defined), priority, title; contact/company custom fields. No conversation tags, no custom conversation fields. | table-stakes (tags); expected (custom conversation fields via host config) |
| CSAT | Conversation ratings (emoji scale, optional remark) sent via Workflow on close over Messenger or email; email fallback after 3 minutes of inactivity; ineligible under 250 characters or with multiple participants; expiry (commonly 7 days); CSAT report with "topics driving dissatisfaction"; CX Score (AI-inferred, Pro add-on). | None. | expected |
| Reporting | Templates: Conversations, Conversation tags, Surveyed CSAT, Effectiveness, Responsiveness, SLAs, Team inbox performance, Teammate performance, Tickets, Fin AI Agent, Copilot; Holistic overview; Real-time dashboard; custom reports and custom metrics; scheduled external reports; 13-dataset CSV export. | None beyond the "High & urgent · N" chip and waiting colours. | expected (a single overview page: volume, first-response, resolution time, per agent, per type) |
| Messenger: home & spaces | Home space with "Send us a message" and "Search for help" apps, teammate avatars, expected reply time ("Typically replies in a few minutes / in a few hours / in a day", "Match teammate expectations"), office hours; spaces Home / Messages / Help / Tickets / News / Tasks; Spotlight Messenger (search-bar style, built for Fin for Sales); fully custom launcher; brand colour, logo, background; visibility rules; welcome messages per audience. | Home with type cards (question/bug/feature/lead), per-type placeholders, qualifying question per inbox, booking link, messages list, help suggestions while typing. Reply promise is static text. | table-stakes (dynamic reply time + away); differentiator (type cards with context capture and screenshot, which Intercom has no equivalent for) |
| Messenger: conversation UX | Message "Seen" / "Not yet seen" states (first message is only "Seen" when a teammate starts typing a reply); typing indicator (only after the teammate's first reply); queue position "#3 in queue" (Expert, balanced assignment); handover indicator from Fin to human; expanded composer; file/image attachments, GIF picker (disableable), emoji, voice transcription; code blocks with copy; "Prevent replies after you close a conversation"; email fallback when the customer leaves. | Thread with reply, attachments, paste image, unread dot, statuses "With our team / Awaiting your reply / Resolved", away notice. No seen/typing, no queue. | expected (seen state through polling); skip (GIFs, voice, queue) |
| Help centre | Hosted Help Center with collections, multilingual and private (Advanced+), multi-brand (Expert), custom domain, July 2026 redesign, article reactions (happy / neutral / disappointed; a negative reaction auto-opens a conversation), AI-assist article generator, Knowledge Hub (public articles, internal articles, snippets) feeding Fin and Copilot; Help space in the Messenger. | `help` adapter: host's own search returns suggestions while the visitor types. No authoring, no hosting. | differentiator (adapter: the host's existing docs site is the help centre); expected (deflection counter: "visitor opened article X before writing") |
| Email handling | Inbound via forwarding or custom domain; outbound from your own address with DKIM/DMARC; threading article exists (body not retrievable); Bcc from the Inbox; "Detect customers in forwarded emails"; link tooltips warning on untrusted URLs; Spam inbox view with manual override; Fin over email with follow-ups; reply-by-email notifications for customers. | Outbound via host adapter (4 templates); inbound via webhook relay with DKIM verification; threading by Message-Id/References or plus-addressed reference; reminder emails; skips emailing what the customer already read in the widget. | table-stakes (spam/bounce handling, quoted-text collapsing if not present); differentiator (no mail infrastructure to run; relay example provided) |
| Channels | Chat, email, phone (native, with recording consent), SMS, WhatsApp, Facebook, Instagram, Telegram, Discord, Slack (native), in-app mobile SDKs. | Widget (web) and email. | skip (phone/social); expected later (Slack notify only, via adapter) |
| Tickets & portal | Customer, Back-office and Tracker ticket types; ticket forms with attributes delivered over five channels; Tickets space in the Messenger and a Help Center customer portal; ticket states; linking. | Conversations only; widget messages list is the customer's "portal". | skip (ticket types); expected (status visibility in widget is already there) |
| Roles & permissions | Custom roles with granular permissions (split delete replies vs notes, macro CRUD, merge, participants, export, billing), inbox-level visibility, BPO separation, SSO/SAML and SCIM (Expert), Lite seats. | `isAgent` only; host owns identity. | expected (two levels: agent vs admin for settings/canned replies/retention, still host-asserted); skip (custom roles, seat types) |
| Audit | Teammate activity logs on all plans (teammate, activity, time, IP), 1-year retention, Activity Logs API, scheduled export (Sep 2026), `admin.activity_log_event.created` webhook; conversation events shown in the thread ("Conversation events in the Inbox"). | None (no event timeline). | expected (conversation event timeline); differentiator (events live in the host's Postgres, queryable with the host's own tooling) |
| API & webhooks | REST API v2.14 (conversations, contacts, companies, tickets, articles, custom objects); webhook topics across conversation.*, ticket.*, contact.*, company.*, article.*, call.*, content_stat.*, admin.*; `X-Hub-Signature` SHA-1 HMAC with the app's `client_secret`; 5-second response window, one retry after 1 minute; EU webhook ceiling 20,000 events/min vs 150,000 US. Messenger JS API: `boot`, `update`, `shutdown`, `show`, `hide`, `showSpace`, `showNewMessage`, `startConversation`, `showArticle`, `showTicket`, `startTour`, `startSurvey`, `startChecklist`, `trackEvent`, `onUnreadCountChange`, `onUserEmailSupplied`, `getVisitorId`. Messenger security by JWT (HS256, `user_id` required); HMAC `user_hash` deprecated. | HTTP routes under `basePath` (widget/*, agent/*, inbound, jobs); identity JWT for cross-origin widget. No outbound events, no API tokens, no documented JS API on the element. | expected (outbound events adapter; a small widget JS API: open, openWithType, setIdentity, onUnreadCountChange); differentiator (the host already has the tables, so there is no "API" to rate-limit) |
| AI: Fin | Autonomous agent over chat, email, phone, Telegram, Slack, Discord; Guidance, Procedures (if/else, code blocks, wait, webhook, "Ask a teammate"), Tasks, data connectors (Stripe, Shopify, Statuspage, Snowflake, Zapier MCP), Fin Memory, reads PDFs/images, tone presets (Friendly, Neutral, Matter-of-fact, Professional, Humorous), answer length, batch tests and simulations, Incident Detection, escalation reporting. Billed per outcome. | AI adapter `generate({system, prompt, schema})`; triage suggestions and draft replies only; an "agent" is always a human. | skip (autonomous customer-facing agent); differentiator (BYO model, no per-outcome billing, host chooses an EU model) |
| AI: Copilot | Side pane in the Inbox: ask a question, answers from help centre, internal docs, snippets and past conversations with citations; "Use this answer"; suggested macro with Tab/Esc; Summarize; tone adjustments (My tone of voice, More friendly, More formal, Rephrase, Expand, Translate to); AI Inbox Translation (45+ languages, on-demand for 10); permission controls and usage insights. | Triage suggestion (type, priority, title, duplicates) and draft reply, both through the adapter. No summary, no tone, no translation. | expected (summarize on hand-over; rephrase/tone; translate DE↔EN); differentiator (model chosen by host) |
| Outbound / proactive | Proactive Support Plus: Posts, Checklists, Product Tours, Surveys, Series; Banners and Tooltips on all plans; email campaigns, SMS, push metered; "Start a conversation from the Inbox" (outbound to a contact). | None. | skip (tours, series, surveys); expected (agent starts a conversation with a contact from the CRM) |
| Mobile | Teammate app in maintenance mode; customer SDKs for iOS/Android with push, carousels, multi-brand push. | Admin is responsive React inside the host; widget is web only. | skip (native SDKs); expected (admin usable on a phone, email as the notification channel) |
| Data location | US, EU (AWS eu-west-1, Dublin), AU; EU only on Advanced/Expert annual via sales; no migration between regions ("direct migration of existing workspace data from one region to another is not possible"); billing data processed in the US regardless; AI processing location not stated in the hosting article. | Data lives in the host's own Postgres, wherever that is; AI adapter is the host's choice. | differentiator |

---

## 3. UI/UX patterns worth adopting

1. **"Send us a message" card with reply time and faces (Messenger home).** The home space shows teammate avatars, a one-line expectation ("Typically replies in a few minutes" / "in a few hours" / "in a day", or "Match teammate expectations" derived from live data) and, outside office hours, when the team will be back; "Show office hours after team assignment" delays the notice until a team is known. It works because it answers the visitor's only question (will a person see this, and when?) before they type. In Better Helpdesk: the widget home already has a reply promise and an away notice; make them one card above the type cards: inbox-specific reply time from settings, the two or three agents who are not away as avatars (host supplies `agents[].avatarUrl`), and "Back on Monday 09:00" when office hours say so. Receipt email repeats the same line.

2. **"Seen" and "Not yet seen" with deliberately conservative rules.** Intercom marks a customer's first message "Seen" only when a teammate starts typing a reply, so triage, assignment and notes do not raise expectations; after a first reply, later customer messages flip to "Seen" when any teammate clicks into the composer. The typing indicator appears only after the teammate's first reply. This is a product principle, not a technical limit. In Better Helpdesk: a `seenAt` on customer messages set by `POST agent/conversations/:id/seen` when the composer gains focus (not on open), surfaced in the widget thread as a small "Seen" under the last customer message on the next poll. No typing indicator until a realtime adapter exists.

3. **Queue position instead of a vague wait.** "#3 in queue" updates live when all teammates are busy and replaces the generic reply-time estimate. Even without routing, the honest equivalent is the agent-side "N conversations waiting" that Better Helpdesk already shows agents inside the widget; show the customer "You're 3rd in line for the support team" computed from unassigned-older-than-mine in the same inbox, only while status is open and unanswered. Cheap and truthful on polling.

4. **Three panes, each side collapsible, Table layout as a second view.** Inbox switching, conversation events and customer context are collapsible panels; managers get a Table layout with configurable columns (waiting time, SLA, assignee) and, since September 2026, presence avatars in rows. In Better Helpdesk: make the customer side panel collapsible with the state remembered per agent (localStorage), and give the list a compact "table" density toggle with columns reference, subject, type, priority, assignee, waiting. Skip saved column layouts.

5. **⌘K as the discoverable shortcut surface.** Intercom's own words: traditional shortcuts are "fiddly and hard to remember", so ⌘K lists every action with its key, and "Keyboard shortcuts" lives inside that menu. Direct keys that matter: R reply, N note, ⌘⇧Y close, plus "Select all matching". In Better Helpdesk: a palette over the conversation view with Reply, Note, Resolve, Mark pending, Assign to…, Set priority…, Insert canned reply…, Go to inbox…, each showing its key; j/k already exist.

6. **Reply/Note toggle that keeps two drafts and lets you edit a note.** Since April 2026 switching between reply and note no longer loses either draft; since March 2026 notes can be edited with an "edited" timestamp; notes carry @mentions and reactions. In Better Helpdesk: persist the two drafts per conversation in localStorage keyed by conversation id, colour the note composer amber (already a convention), allow editing one's own note.

7. **Macros carry actions and are reachable from the composer.** `\` or `#word` opens the macro picker; a macro can also assign, tag, snooze, close or re-open; Copilot can propose a macro inline, accepted with Tab, rejected with Esc. In Better Helpdesk: canned replies gain optional actions (set status, set type, assign to me/agent, add tag) and the `/` picker shows the action chips next to the title; the AI draft can be accepted with Tab the same way.

8. **Snooze with presets and configurable wake-up.** Presets plus "Custom" date/time; "Snooze until tomorrow" is 9:00 in the workspace timezone; a customer reply unsnoozes; since September 2026 admins can stop notes or assignment from waking a snoozed conversation; reporting shows snoozed time. In Better Helpdesk: a fourth state is not needed; `snoozedUntil` on an open conversation hides it from "all/mine" and the waiting colour, `runJobs()` clears it, a customer reply clears it, the row shows "Snoozed until Thu 09:00".

9. **Guardrails at close.** "Required attribute" on a conversation attribute blocks closing with the message "The following attributes are required before closing the conversation" (enforced only for humans in the Inbox, not for Fin or the API). In Better Helpdesk: per-inbox "require type before resolve" and "require tag before resolve" settings; the Resolve button becomes a tooltip with the missing field. Keep it human-only, as Intercom does.

10. **Presence avatars on the list row.** Up to three avatars of teammates currently viewing a conversation, "+N" overflow, gated by a workspace setting "Show teammates presence". It prevents the double reply that two-person teams hit on day one. In Better Helpdesk: a heartbeat `POST agent/presence {conversationId}` every poll tick, a `helpdesk.presence` row per agent with `lastSeenAt`, avatars on rows and "Anna is viewing" in the conversation header, decayed after 30 seconds.

11. **One rating language everywhere.** Article reactions and conversation ratings use the same happy / neutral / disappointed faces; a negative article reaction automatically opens a conversation ("a second chance to resolve their problem"); conversation ratings under 250 characters or with multiple participants are never requested; the request moves to email after 3 minutes of inactivity in the Messenger; it expires (commonly 7 days). In Better Helpdesk: after "Resolved", the widget thread shows three faces and an optional remark; the resolution email carries the same three links; skip the request for conversations shorter than a threshold; the admin conversation shows the rating next to the status.

12. **Visible hand-over and quiet sender metadata.** The October 2025 Messenger update reduced sender names and metadata to the minimum and made it explicit when the conversation moves from Fin to a person. Better Helpdesk never has an AI speaking, but the same clarity applies to agent changes: a thin system line "Marco joined the conversation" or "Reassigned to Lea" in the widget thread keeps the customer oriented and is a free by-product of an event timeline.

13. **Code blocks that respect developers.** Since September 2026 code in a conversation renders in its own scrollable block with syntax highlighting, line numbers and a copy button on both sides. For B2B SaaS support, where customers paste stack traces and API responses, this is cheap and visibly thoughtful; Better Helpdesk already captures recent JS errors, so rendering them and pasted code as blocks is consistent.

14. **Away mode that reassigns, with reasons.** "Away and reassigning" hands the agent's open conversations back to the inbox; custom away reasons (April 2025) and "Skip away mode in Round Robin" keep routing honest; wrap-up protection (July 2026) holds a freed slot briefly. In Better Helpdesk: extend the existing away-until date with a "reassign my open conversations to the inbox" checkbox and a reason shown in the agent list.

15. **Safety tooltips on links in email.** Since March 2024, URLs in email conversations show a tooltip distinguishing trusted from untrusted destinations. Inbound email to a support inbox is a phishing vector; Better Helpdesk verifies DKIM but renders links plainly. Showing the real host on hover, and dimming links whose text and target hosts differ, costs an afternoon.

---

## 4. What users complain about, and how Better Helpdesk can turn it

**Pricing is unpredictable and stacks.** The most consistent theme on G2 (4.5/5 from ~3,855 reviews, but "pricing complexity: stacked add-ons, usage-based Fin billing that is hard to forecast, and annual price increases"; "Everything is an upsell"), Capterra ("The price is way too high for a startup"; a reviewer who left "due to a price increase that more than doubled their costs"), Trustpilot (2.9/5 from 529 reviews; 30 Jun 2026: "forced us off their legacy pricing plans onto their new plans for a 25% increase in costs") and the widely shared r/SaaS post "Why my Intercom bill jumped from $4k to $9k/month" (40 agents, after adopting Fin). Seat creep: Lite seats are free only from Advanced; on Essential a developer who wants to read a thread is a $29 seat. Better Helpdesk's answer is structural, not a discount: MIT licence, no seats, no metered outcomes, the only bill is the host's own Postgres and model provider. Say it plainly on the README: "the fourth support person costs nothing".

**Fin's "assumed resolution" charges for silence.** The Fin pricing article itself defines an assumed resolution as the customer not coming back within 24 hours. In the Intercom community thread "Fin's flawed assumed resolved & pricing design", a hardware-support lead (bosbeest) reports a ~12% real resolution rate while being billed $0.99 whenever a human steps in before the customer clicks "Speak to a human": "you are incentivising me to let the customer try the wrong answer". Intercom's support engineer eventually conceded the model "doesn't adequately recognise when a teammate takes the reins at the right moment". Better Helpdesk's vocabulary (AI produces suggestions and drafts; a human sends) is exactly the opposite incentive, and the AI adapter means the host pays its model provider per token, not per customer who gave up.

**Complexity grows with ambition.** Trustpilot, 3 Aug 2026: "The more you want to do with Intercom, the less user-friendly it gets"; 24 Jul 2026: "setting up Fin has been the full-time project of 2 of our Management Team"; 31 Jul 2026: "There is ZERO support to set up. We had to use an outside vendor." The Opencom author on HN cites "frequent layout and UX changes" as a reason to leave. Better Helpdesk's surface is small by design; keep the settings page to one screen and resist a workflow builder.

**Support of the support tool.** Trustpilot, 17 Jul 2026: "Responding to your message or question takes over 4 hours... then you have to wait days"; 18 May 2026: "Two weeks of circular support, contradictory answers, and zero resolution"; 24 Jul 2026: "woke up to no access to the service, hundreds of lost emails, all staff locked out". An embedded library cannot lock anyone out, and inbound mail lands in the host's database even if nobody is reading it.

**The Messenger is heavy.** Intercom's own engineering post documents the Messenger growing to nearly 600 KB gzipped before a rewrite brought it to 240 KB; community threads and third-party Lighthouse tests report a Time-to-Interactive hit large enough that lazy-loading libraries (react-live-chat-loader) exist specifically for it. Better Helpdesk's widget is a web component; publish its gzipped size in the README and keep it a fraction of 240 KB, loaded on interaction.

**EU data location is gated and one-way.** Regional hosting (EU in AWS Dublin) is only on Advanced and Expert annual contracts and only through sales; "direct migration of existing workspace data from one region to another is not possible" (rebuilding a workspace loses conversation history); billing data is processed in the US regardless, and the hosting article does not say where Fin's model inference runs. For Swiss and EU buyers this is the single clearest argument for data living in their own Postgres with an AI adapter they choose.

**Lock-in and the "trojan horse".** HN commenters on the Chatwoot launch (mosdl) describe the Messenger as a wedge for engagement tracking; the EU-migration write-up shows what leaves with you (contacts, articles via API) and what does not (conversations, workflows, macros, reports). Better Helpdesk's data is in `helpdesk.*` tables the host already backs up; export is `pg_dump`.

**Roadmap uncertainty.** The rename to Fin and the pending Salesforce acquisition mean the per-seat helpdesk is now a secondary product inside a company that sells "customer agents". A small B2B team that wants humans to answer tickets is buying against the vendor's strategy; Better Helpdesk's "an agent is a human" is the counter-position, and should be stated as such.

**Mobile is frozen.** The teammate app is in maintenance mode. A responsive admin that works on a phone through the host's own login, plus email notifications, is enough for a 1–10 person team and avoids an app store entirely.

---

## 5. What NOT to copy

- **An autonomous customer-facing AI (Fin).** It contradicts "an agent is a human", it needs a knowledge pipeline, testing harness, escalation rules and billing that would dwarf the rest of the package, and the market's loudest complaint is its pricing. Keep AI to suggestions and drafts behind the host's adapter.
- **Outcome- or resolution-based metering of anything.** Better Helpdesk has no billing surface; adding usage counters would only serve a hosted product that the architecture forbids.
- **Proactive Support Plus (Product Tours, Posts, Series, Surveys, Checklists, News, Banners).** These are product-engagement features; a Next.js host has better tools for onboarding and announcements, and the widget's job is support. A survey engine in a support library is scope creep with no design-partner demand.
- **Omnichannel (phone, SMS, WhatsApp, Instagram, Facebook, Telegram, Discord).** Each is a provider integration with its own compliance; the positioning is "support inside your product plus email", not a contact centre.
- **A visual Workflows builder.** Branching flow editors are a product in themselves; the host already has code. A handful of declarative per-inbox rules (auto-resolve, auto-assign, required fields) covers 1–10 person teams.
- **Ticket types (Customer / Back-office / Tracker), ticket states and a separate Tickets space.** Better Helpdesk's conversation model with type and status is the simpler object; tracker tickets exist to coordinate across large teams the target users do not have.
- **Seat types and custom roles.** The host owns identity; `isAgent` plus at most an `isAdmin` flag asserted by the host keeps the package out of the permissions business.
- **Hosted Help Center authoring.** The `help` adapter lets the host point at docs it already has (Next.js MDX, a docs site, Notion). Building an editor, theming, multilingual publishing and a customer portal would recreate Intercom's Articles product and compete with the host's own CMS.
- **Spotlight Messenger, voice transcription, GIF picker.** Sales-chat and chat-app ornaments; the widget's type cards and context capture are the differentiator, not chattiness.
- **Native mobile SDKs and a teammate app.** The target host is a Next.js web product; the admin runs inside it.
- **A general REST API with tokens and rate limits.** The host has the schema and the Drizzle client; outbound events and a small typed service API in-process are the embedded equivalent. Public API tokens would mean building auth the package is forbidden to own.
- **A real-time dashboard / Table layout for shift managers.** There are no shift managers in a 1–10 person team; a single overview report is enough.

---

## 6. Top 10 recommended work items

Each item stands alone, uses adapters for anything external, does background work only inside `runJobs()`, and never introduces auth, a server or a second process.

### 1. feat(settings): add office hours per inbox and make waiting times and reminders respect them

- **problem**: A customer who writes on Friday 18:00 sees "usually within one business day" but the inbox turns red at 24 hours on Saturday, the reminder email fires on Sunday, and the widget cannot say when the team is back unless an agent has set an away date.
- **scope**: In: `officeHours` (weekday ranges, timezone) and `replyTime` (`minutes` | `hours` | `day`) on `helpdesk.inboxes`; a `nextOpening(inbox, at)` helper in service; the waiting indicator and the `reminderAfterHours` job count only office hours; `GET widget/config` returns `isOpen`, `backAt`, `replyTime`; settings UI with a weekly grid; de/en strings. Out: holidays, per-agent hours, SLA targets, reporting.
- **size**: M
- **depends on**: none
- **layers**: schema, service, http, admin, widget, docs
- **evidence**: Intercom's SLAs count office hours ("a message received at 5:50pm will have an expected response time of 9:05am on the next working day"), reply-time expectation is set under Settings > Workspace > Office Hours, and ticket resolution time "now with office hours" shipped in April 2026.

### 2. feat(widget): show the team's expected reply time, avatars and back-at time on the home screen

- **problem**: The visitor cannot tell whether a human will see the message or when; the current reply promise is the same static sentence for every inbox at every hour.
- **scope**: In: a card above the type cards with up to three avatars of agents who are not away (host passes `agents[].name/avatarUrl` through `HelpdeskConfig.identify` or an `agents` list), the inbox's reply-time line ("Usually replies within a few hours"), and "Back Monday 09:00" when office hours say closed (falls back to the per-agent away date when item 1 is absent); the same line repeated at the top of a new thread and in the receipt email; `--helpdesk-*` tokens for the card. Out: live "match teammate expectations" calculation, queue position, typing indicators.
- **size**: S
- **depends on**: none (better with 1)
- **layers**: http, widget, adapter (email receipt template), docs
- **evidence**: The Messenger Home's "Send us a message" app shows teammate avatars and "Typically replies in a few minutes / in a few hours / in a day", with "when your team will be back online outside office hours".

### 3. feat(admin): snooze conversations with presets and automatic wake-up

- **problem**: "Waiting for the customer's screenshot on Tuesday" has no state: agents either leave it open and red or resolve it and lose it.
- **scope**: In: `snoozedUntil` on conversations; presets Later today, Tomorrow 09:00, Next Monday 09:00, One week, Custom (times in the inbox timezone); snoozed conversations leave all/mine/unassigned and the waiting colour, appear under a "Snoozed" filter with "Snoozed until Thu 09:00"; `runJobs()` clears expired snoozes and, if the agent is away, unassigns; a customer reply clears the snooze and marks the row; keyboard `z`. Out: snooze reporting, snoozing via rules, team-level unsnooze policy.
- **size**: M
- **depends on**: none (timezone from 1 if present)
- **layers**: schema, service, http, admin, docs
- **evidence**: Intercom's snooze offers presets plus "Custom", "Snooze until tomorrow" defaults to 9:00 AM workspace time, customer replies unsnooze, and September 2026 added "Configurable Unsnooze Controls" plus "Auto-unsnooze" and "Unassign unsnoozed conversations".

### 4. feat(admin): show who is viewing a conversation so two agents do not answer the same customer

- **problem**: With two agents and a 10-second poll, both open the newest conversation and both reply; the customer gets two answers and the team looks uncoordinated.
- **scope**: In: `helpdesk.presence` (agentId, conversationId, lastSeenAt, composing boolean) upserted by the existing poll tick while a conversation is open and when the composer gains focus; list rows show up to three avatars with "+N"; the conversation header shows "Lea is viewing" / "Lea is replying"; rows older than 30 seconds are ignored and pruned in `runJobs()`; a workspace setting to turn presence off. Out: locking, typing text preview, WebSocket transport.
- **size**: M
- **depends on**: none
- **layers**: schema, service, http, admin, docs
- **evidence**: September 2026 changelog: "See who's viewing a conversation, now in Table view" — up to three teammate avatars per row, "+N" overflow, gated by "Show teammates presence".

### 5. feat(admin): add conversation tags with a filter and tag actions on canned replies

- **problem**: Nothing groups "billing" or "SSO" conversations across inboxes; the team cannot find last month's similar cases or hand a themed list to product.
- **scope**: In: `helpdesk.tags` and `conversation_tags`; a tag picker in the conversation header (create on the fly, colour); tag chips on rows; a tag filter in the list; a canned reply may carry actions (add tags, set status, set type, assign to me) shown as chips in the `/` picker and applied on send; tags included in the AI triage suggestion schema as optional. Out: tag reporting, tag rules, required tags on resolve (see 9).
- **size**: M
- **depends on**: none
- **layers**: schema, service, http, admin, docs
- **evidence**: Intercom tags are applied manually, via macro or Workflow and filtered in Views; macros "group common message content and actions — like tagging, assigning, snoozing, or closing — and apply them with one click".

### 6. feat(admin): @mention agents in internal notes with a Mentions filter and an email notification

- **problem**: Asking a colleague to look at a conversation means pasting a link into Slack; the colleague has no list of things waiting on them.
- **scope**: In: `@` autocomplete in the note composer over the host-provided agent list; `helpdesk.mentions` rows (noteId, agentId, readAt); a "Mentions" filter in the inbox list with an unread count; an `agent-mention` email template through the existing email adapter sent by `runJobs()` with a short debounce; "mark as read" when the mentioned agent opens the conversation; de/en strings. Out: team mentions, reactions, in-app toasts, push.
- **size**: M
- **depends on**: none
- **layers**: schema, service, http, admin, adapter (email template), docs
- **evidence**: Intercom: "select Note in the inbox composer and then type @"; a "Mentions" inbox with Mentions / Reactions / Unread filters; mentions send notification emails and push.

### 7. feat(admin): record a conversation event timeline (assignment, status, priority, type, tags, snooze, participants)

- **problem**: Nobody can see that Marco reassigned the ticket to Lea on Tuesday, who resolved it, or why a conversation reopened; the thread shows messages only.
- **scope**: In: `helpdesk.conversation_events` (conversationId, actorAgentId or system/customer, kind, payload, createdAt) written by every service mutation; grey one-line entries interleaved in the thread ("Lea assigned to Marco", "Priority set to urgent", "Reopened by customer reply"); customer-safe subset rendered in the widget thread ("Marco joined the conversation"); retention job deletes events with the conversation. Out: a separate audit UI, export, filters by event, webhooks (see 8).
- **size**: M
- **depends on**: none
- **layers**: schema, service, admin, widget, docs
- **evidence**: Intercom shows "Conversation events in the Inbox" in the thread and keeps "Teammate activity logs" (teammate, activity, time, IP) on every plan for a year, with a scheduled export added September 2026.

### 8. feat(config): add an optional `onEvent` adapter so the host can react to helpdesk events

- **problem**: The host wants a Slack ping on new urgent bugs, a Linear issue for a feature request, or a PostHog event on resolution, and today has to poll its own tables.
- **scope**: In: `events?: { emit(event: HelpdeskEvent): Promise<void> }` on `HelpdeskConfig`, called after commit for `conversation.created`, `conversation.replied` (by customer / by agent), `conversation.status.changed`, `conversation.assigned`, `conversation.priority.changed`, `conversation.tagged`, `contact.created`, `company.created`, `deal.stage.changed`; a typed union exported from the package; failures logged, never block the request; an `examples/demo` handler that posts to Slack via fetch. Out: a URL registry, signatures, retries, delivery log (the host owns transport and can queue).
- **size**: S
- **depends on**: 7 (event model and names)
- **layers**: service, adapter, docs
- **evidence**: Intercom webhooks cover `conversation.user.created`, `conversation.admin.replied`, `conversation.admin.assigned`, `conversation.priority.updated`, `conversation.rating.added`, `contact.*`, `company.*`, signed with `X-Hub-Signature` and retried once; in an embedded library the host's own function replaces the HTTP hop.

### 9. feat(widget): ask for a rating after a conversation is resolved and show it in the admin

- **problem**: The team has no signal on whether a resolved conversation actually helped, and no way to catch an unhappy customer before they churn quietly.
- **scope**: In: three faces (happy / neutral / disappointed) with an optional remark shown in the widget thread once status becomes resolved; the same three links in the resolution email (signed one-click tokens, existing pattern from the identity JWT); skip the request for conversations with fewer than N characters of agent reply or more than one customer participant; expire after 7 days; `rating` and `ratingRemark` on the conversation; rating shown next to the status in the admin, a "Rated disappointed" filter; a disappointed rating reopens the conversation as open with an event; de/en strings. Out: CSAT reports (see 10), NPS, surveys.
- **size**: M
- **depends on**: none (events from 7 if present)
- **layers**: schema, service, http, admin, widget, adapter (email template), docs
- **evidence**: Intercom's conversation ratings are sent on close over Messenger or email (email after 3 minutes of inactivity), are not requested for conversations under 250 characters or with multiple participants, expire (commonly 7 days), and a negative Help Center reaction automatically opens a conversation.

### 10. feat(admin): add an overview page with volume, first-response time, resolution time and ratings per inbox, type and agent

- **problem**: A team lead cannot answer "how many bugs came in last month, how long did we take to answer, who is overloaded" without writing SQL against `helpdesk.*`.
- **scope**: In: one page under the admin with a date range (7/30/90 days) and four cards: new conversations by type, median first response in office hours (uses item 1 when present, wall clock otherwise), median time to resolve, rating split (from 9 when present); a table by agent (assigned, resolved, median first response) and by inbox; all computed by SQL in `store.ts` with no cache; CSV download of the table; de/en strings. Out: custom reports, charts beyond simple bars, scheduled emails, SLA attainment.
- **size**: M
- **depends on**: none (richer with 1 and 9)
- **layers**: service, http, admin, docs
- **evidence**: Intercom's prebuilt templates are Conversations, Responsiveness, Effectiveness, Teammate performance, Team inbox performance, Surveyed CSAT and Conversation tags; the Essential plan ships "Pre-built reports" only, which is the level a 1–10 person team uses.

### Next in line (not in the ten)

- feat(admin): ⌘K palette listing every action with its key (R reply, N note, E resolve, A assign, P priority, z snooze) — S; evidence: Intercom's Command-K replaces "fiddly" shortcuts.
- feat(widget): "Seen" on the customer's last message when an agent focuses the composer — S; evidence: Intercom's "Not yet seen" / "Seen" rules.
- feat(config): optional `realtime` adapter (`publish(channel, event)` on the server, `subscribe(channel)` in admin and widget) so hosts with SSE/Pusher/Ably get sub-second updates and typing indicators while polling stays the default — L.
- feat(admin): collapsible customer panel and draft persistence per conversation — S.
- feat(admin): merge two conversations and merge duplicate contacts in one preview step — M; evidence: September 2026 "Merge duplicate users into one profile".
- fix(admin): render pasted code and captured JS errors as copyable code blocks — S; evidence: September 2026 code-block rendering.

---

## 7. Sources

Primary (Intercom/Fin):

- https://www.intercom.com/pricing
- https://fin.ai/pricing
- https://fin.ai/help/en/articles/13975800-fin-pricing-outcomes
- https://fin.ai/updates
- https://www.intercom.com/changes/en (pages 1, 2, 4, 8, 11, 14, 18, 24)
- https://www.intercom.com/changes/en/114298-fin-ui-messenger-experience-updates
- https://www.intercom.com/changes/en/131839-search-and-duplicate-inbox-views
- https://www.intercom.com/changes/en/86901-inbox-sorting-more-options-better-control
- https://www.intercom.com/helpdesk/inbox
- https://www.intercom.com/blog/announcing-intercoms-next-gen-inbox/
- https://www.intercom.com/blog/reducing-intercom-messenger-bundle-size/
- https://www.intercom.com/help/en/articles/6612589-set-up-and-customize-the-messenger
- https://www.intercom.com/help/en/articles/6612588-messenger-explained
- https://www.intercom.com/help/en/articles/6612597-messenger-faqs
- https://www.intercom.com/help/en/articles/732436-share-your-expected-response-time (search excerpt)
- https://www.intercom.com/help/en/articles/258-real-time-messaging-explained (search excerpt)
- https://www.intercom.com/help/en/articles/15431584-show-customers-their-queue-position-in-the-messenger (search excerpt)
- https://www.intercom.com/help/en/articles/8313203-tickets-space-in-the-messenger (search excerpt)
- https://www.intercom.com/help/en/articles/8450754-customer-portal-explained
- https://www.intercom.com/help/en/articles/6258745-the-inbox-explained
- https://www.intercom.com/help/en/articles/6516006-inbox-search-and-filter
- https://www.intercom.com/help/en/articles/6989006-inbox-sorting (search excerpt)
- https://www.intercom.com/help/en/articles/6272267-how-to-use-command-k-with-intercom-inbox (search excerpt)
- https://www.intercom.com/help/en/articles/8838656-inbox-faqs (search excerpt)
- https://www.intercom.com/help/en/articles/6564538-snooze-a-conversation (search excerpt)
- https://www.intercom.com/help/en/articles/6584504-using-macros-in-the-inbox and 6433193-creating-and-managing-macros (search excerpts)
- https://www.intercom.com/help/en/articles/6525765-loop-teammates-or-teams-into-conversations (search excerpt)
- https://www.intercom.com/help/en/articles/6546210-create-and-use-conversation-data-attributes-cvdas-in-the-inbox (search excerpt)
- https://www.intercom.com/help/en/articles/6546152-set-slas-for-conversations-and-tickets
- https://www.intercom.com/help/en/articles/9263617-slas-and-office-hours (search excerpt)
- https://www.intercom.com/help/en/articles/6512504-round-robin-deep-dive and 6553774-balanced-assignment-deep-dive (search excerpts)
- https://www.intercom.com/help/en/articles/6522874-manage-teammate-inbox-status (search excerpt)
- https://www.intercom.com/help/en/articles/7434613-how-to-trigger-a-workflow
- https://www.intercom.com/help/en/articles/6559143-examples-of-inbox-automation-using-workflows
- https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot
- https://www.intercom.com/help/en/articles/6955446-ai-features-available-in-the-inbox (search excerpt)
- https://www.intercom.com/help/en/articles/13177409-customize-fin-ai-agent-tone-of-voice-and-answer-length (search excerpt)
- https://www.intercom.com/help/en/articles/7837535-fin-ai-agent-faqs
- https://www.intercom.com/help/en/articles/9061648-proactive-support-plus-add-on (search excerpt)
- https://www.intercom.com/help/en/articles/56651-get-quick-article-feedback-with-reactions (search excerpt)
- https://www.intercom.com/help/en/articles/3107388-support-multiple-languages-in-your-help-center (search excerpt)
- https://www.intercom.com/help/en/articles/9634546-ask-customers-for-a-conversation-rating and 7872853-measure-customer-satisfaction-with-conversation-ratings (search excerpts)
- https://www.intercom.com/help/en/articles/200-intercom-reports-explained and 8651875-teammate-performance-reporting (search excerpts)
- https://www.intercom.com/help/en/articles/176-teammate-permissions-how-to-control-workspace-access
- https://www.intercom.com/help/en/articles/8205716-seats and 6604606-how-do-inbox-seats-work (search excerpts)
- https://www.intercom.com/help/en/articles/4667982-review-actions-taken-in-your-workspace-with-teammate-activity-logs (search excerpt)
- https://www.intercom.com/help/en/articles/6124430-regional-data-hosting (search excerpt)
- https://www.intercom.com/help/en/articles/447-respond-to-users-and-visitors-on-the-go-with-the-intercom-conversations-app (search excerpt)
- https://www.intercom.com/help/en/articles/10589769-authenticating-users-in-the-messenger-with-json-web-tokens-jwts (search excerpt)
- https://developers.intercom.com/installing-intercom/web/methods
- https://developers.intercom.com/docs/references/webhooks/webhook-models
- https://developers.intercom.com/docs/webhooks/webhook-notifications (search excerpt)
- https://community.intercom.com/ask-the-intercom-team-about-fin-54/fin-s-flawed-assumed-resolved-pricing-design-8929

Company, scale, corporate events:

- https://sacra.com/c/intercom/
- https://thenextweb.com/news/salesforce-acquires-fin-intercom-3-6-billion
- https://aitoolly.com/ai-news/article/2026-05-14-intercom-rebrands-corporate-entity-to-fin-a-strategic-pivot-toward-ai-customer-agents (rename date; corroborated by several outlets in the search results)

User opinion and third-party analysis:

- https://www.trustpilot.com/review/intercom.io
- https://www.g2.com/products/intercom/reviews (rating and summary via search excerpt; page itself returned 403)
- https://www.capterra.com/p/134347/Intercom/reviews/ (quotes via search excerpts; page itself is behind a CAPTCHA)
- https://news.ycombinator.com/item?id=26501527 (Launch HN: Chatwoot)
- https://news.ycombinator.com/item?id=46058193 (Show HN: code-first Intercom alternative)
- https://news.ycombinator.com/item?id=47194196 (Show HN: Opencom)
- https://news.ycombinator.com/item?id=47833870 (Show HN: Libredesk)
- https://clonepartner.com/blog/intercom-eu-data-hosting-trap-the-us-to-eu-migration-guide
- https://www.kommunicate.io/blog/intercom-pricing-breakdown/ and https://www.getmacha.com/blog/intercom-pricing-explained (r/SaaS "$4k to $9k" post quoted; the Reddit URL itself did not surface in search)
- https://www.voiceflow.com/blog/intercom-pricing and https://clearfeed.ai/blogs/intercom-pricing (monthly-billing prices)
- https://calibreapp.com/blog/fast-live-chat and https://community.intercom.com/messenger-8/messenger-on-mobile-page-performance-8447 (Messenger weight)
