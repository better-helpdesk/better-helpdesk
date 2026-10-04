# Chatwoot in 2026, compared with Better Helpdesk

Researched 2 October 2026 from the Chatwoot repository (`chatwoot/chatwoot` at the
commit pushed 2026-10-02), its release notes, `db/schema.rb`, the dashboard and
widget locale files (`app/javascript/dashboard/i18n/locale/en/*.json`,
`app/javascript/widget/i18n/locale/en.json`), the help centre
(`chatwoot.com/hc/user-guide`), the developer docs, the pricing pages, and user
threads on GitHub and Hacker News. Reddit is not reachable by the search tool;
Reddit sentiment below is quoted second-hand and marked as such. Where I could
not verify something I say so.

## 1. Snapshot

**What it is.** Chatwoot is a self-hosted, omnichannel customer-support
platform: a Rails 7.2 API and job system, a Vue 3 dashboard, a live-chat widget
and SDK, a Help Center portal, and (since v4) "Captain", an AI layer. The
repository describes itself as "the modern customer support platform, an
open-source alternative to Intercom, Zendesk, Salesforce Service Cloud etc."
GitHub on 2 October 2026: 37,427 stars, 9,103 forks, 1,526 open issues.
Chatwoot Inc (YC W21, founders Pranav Raj, Sojan Jose, Nithin David) runs
Chatwoot Cloud at app.chatwoot.com and sells self-hosted licences.

**Who runs it.** Three populations show up in the issues and release notes:
self-hosters on a VPS or Kubernetes who want to escape per-seat SaaS (the HN
"we switched from Front, self-hosted, 5 brands, 4 channels each" crowd);
WhatsApp-first SMBs and agencies (WhatsApp Cloud API, templates, embedded
signup, coexistence, BSUIDs, calling and campaigns dominate 2026 release notes);
and cloud customers on the $19–$99 per agent plans. The project ships a
monthly minor release; there were 37 v4 tags between January 2025 and
September 2026.

**Licensing: MIT core, proprietary `enterprise/`.** `LICENSE` says everything
outside `enterprise/` is "MIT Expat"; `enterprise/LICENSE` says that code "may
only be used in production if you ... have a valid Chatwoot Enterprise License
for the correct number of user seats" (modifying it for development and testing
is allowed). The same repository builds both editions; the help-centre
"Enterprise Edition" article recommends installing EE from the start "to
upgrade to a paid tier in the future without having to reinstall". What lives
in `enterprise/app/models` today, and is therefore gated: `sla_policy`,
`applied_sla`, `sla_event`, `custom_role`, `agent_capacity_policy`,
`inbox_capacity_limit`, `account_saml_settings`, `call` (voice),
`campaign_recipient`, `conversation_monitors`, `conversation_outcome`,
`captain/*`, `captain_inbox`, `copilot_thread`, `copilot_message`,
`article_embedding`. `enterprise/app/services` adds `captain`, `llm`,
`firecrawl`, `cloudflare`, `twilio`, `voice`, `whatsapp` (parts),
`sla`, `conversation_monitors`, `device_verification`. Paywall strings in the
dashboard locale confirm the gating: SLA and custom roles are "only available
in the Business and Enterprise plans" (cloud) and "only available in the paid
plans" (self-hosted); SAML is "only available in the Enterprise plans";
"Upgrade to a paid plan to access advanced features like audit logs, agent
capacity, and more." Captain on self-hosted "requires Chatwoot Enterprise
Edition with a paid plan" plus an OpenAI (or compatible) key configured in the
Super Admin console (`gpt-4o-mini` default, custom endpoint allowed). What
remains MIT and is substantial: labels, canned responses, macros, automation
rules (including delayed rules), custom attributes, conversation filters and
folders, teams, round-robin assignment ("Assignment V2 is now available on all
installations", v4.12), CSAT, the report suite, webhooks, the Help Center
portal, campaigns, agent bots, Dashboard Apps, Slack/Linear/Shopify/Dialogflow
integrations, 2FA, all channels.

**Pricing.** Cloud, per agent per month (annual): Hacker $0 (2 agents, 500
conversations/month, "Live chat" channel only, 30-day retention); Startups $19
(all channels, Help Center, 300 Captain credits, 1-year retention); Business
$39 (adds Teams, Automation rules, Voice, Companies, SLA, custom roles,
required attributes, Monitors, CSAT review notes; 500 credits; 2 years);
Enterprise $99 (adds SSO/SAML, Audit logs; 800 credits; 3 years). Extra Captain
credits are "$20 / 1,000 credits"; "all actions consume 1 credit per message".
Self-hosted: Community $0; Premium Support $19/agent ("Captain AI", "Voice
calls", "Custom branding", "Agent capacity", "Roles & permissions", "Priority
support"); Enterprise $99/agent (adds "SSO / SAML", "SLA policies"). The
1-credit-per-action metering and the "Captain V1 is retiring: every account
moves to the new Captain" notice (28 Sep 2026) show Captain is now the
commercial centre of the product.

**Deployment footprint.** `docker-compose.production.yaml` runs four services:
`rails` (Puma), `sidekiq`, `postgres` (must be a pgvector image since v4) and
`redis`. Documented minimums: 4 GB RAM and 4 cores "supports up to 10,000
conversations a day"; Redis 7+; Ruby 3.2+ (3.4.4 since v4.3); Sidekiq "can use
1GB+ memory on active servers"; the docs recommend separate Sidekiq and Rails
machines at scale. Real-time is ActionCable over `wss://<host>/cable`
(`RoomChannel`, `pubsub_token`), pushing `message.created`, `message.updated`,
`conversation.created`, `conversation.status_changed`,
`conversation.typing_on/off`, `assignee.changed`, `team.changed`,
`conversation.read`, `presence.update`, `notification_created`. Install paths:
Docker, Linux VM via `cwctl`, Helm, Heroku button, DigitalOcean 1-click
Kubernetes, plus cloud-provider guides. Upgrades: pull new image tags, run
`rails db:chatwoot_prepare`; "if your installation is very old, upgrade
iteratively through intermediate Docker image tags". Mobile apps are React
Native (`chatwoot-mobile-app`, v4.9.0 in August 2026).

**Recent direction (2025–2026).**
- v4.0 (Jan–Apr 2025): Vue 3 rewrite, "New Sidebar Navigation", the "Inbox
  View" notification inbox, redesigned Contacts and Help Center, Captain
  (Assistant, Copilot, FAQs, Memories); v4.4 removed the v3 UI.
- Captain v2: "Captain Editor" in the composer (Improve reply, Change tone, Fix
  grammar and spelling, Suggest a reply, Summarize the conversation, Ask
  Copilot; v4.11), Custom Tools (v4.7/4.13), Scenarios, Playground, Guardrails,
  "Captain can now decide when to resolve conversations" (v4.12), FAQ
  generation from resolved conversations, "Control who Captain replies to and
  when" (audience + schedule), Monitors (natural-language conversation
  monitors with a "Monitor Matched" automation event), per-message "How was
  this reply generated?" with steps, sources, model and credits.
- Conversation workflow: "Conversation Workflows" settings page with
  auto-resolve and "Attributes required on resolution" (v4.11); delayed
  automations ("Run after a wait": "Customer hasn't replied", "No teammate has
  replied", "Conversation stays in a status", 10 minutes to 30 days); labels
  as automation actions; macros from the editor via `#`; right-click label
  removal; "Participating" tab (v4.13); unread counts (v4.15.0) partly
  reverted a day later "due to performance related issues" (v4.15.1);
  conversation history navigation inside a thread (v4.18).
- Channels: WhatsApp everything, TikTok (alpha), Voice (Twilio and WhatsApp
  calling, calls dashboard, recording and transcription), Telegram Business.
- Platform: 2FA (v4.6), SAML (v4.6/4.7), audit-log filters, security hardening
  in nearly every release, Intercom/Freshdesk/Front/Zendesk importers,
  Companies (EE), Linear and Shopify integrations, Elasticsearch message search
  (EE), "SMTP configuration independent of IMAP" (v4.18).

## 2. Feature inventory vs Better Helpdesk

Verdict scale: `table-stakes` (a small B2B team misses it in week one),
`expected` (within months), `differentiator` (could set us apart), `skip` (not
for our positioning).

| Area | Chatwoot | Better Helpdesk today | Verdict |
|---|---|---|---|
| Conversation list tabs | "Mine / Unassigned / All" assignee tabs; status filter "Open / Pending / Snoozed / Resolved / All"; sidebar views "All Conversations", "Mentions", "Unattended", "Participating", then Folders, Inboxes, Labels, Teams. | all/mine/unassigned, inbox, status open/pending/resolved, search, sort. | table-stakes (have the core) |
| Unread state and counts | Bold rows, `agent_last_seen_at` / `assignee_last_seen_at` on `conversations`, "Mark as unread / Mark as read" in the card context menu, sort "Unread Count: Highest first", "9+" badge. Counts on Mentions/Participating/Folders were reverted for performance. | Waiting indicator (amber 6h, red 24h); no read/unread per agent. | table-stakes |
| Mentions / Participating | `mentions` and `conversation_participants` tables; "@" picker for "Agents" and "Teams"; "Mentions" and "Participating" sidebar views; "Join conversation" / "You are participating" in the side panel. | Internal notes exist; no @mention, no participating view for agents (participants are customer contacts). | expected |
| Snooze | `snoozed_until`; "Resolve" split button → "Mark as pending", "Snooze until: Next reply / Tomorrow / Next week" + custom natural-language time ("an hour from now", "next month"); header "Snoozed until tomorrow"; `Alt+M` toggles the snooze menu; snoozed wake on reply. | None. | table-stakes |
| Reopen on customer reply | Incoming message on a resolved or snoozed conversation reopens it (`app/models/message.rb`, `reopen_conversation`). | Not stated; listed as a gap. | table-stakes |
| Filters and saved views | "Filter conversations" modal with AND/OR groups over Status, Assignee, Inbox, Team, Conversation identifier, Campaign, Labels, Browser language, Priority, Country, Referer link, Created at, Last activity and custom attributes; operators "Equal to / Not equal to / Contains / Is present / Is greater than / Is x days before…"; "Save filter" → a Folder in the sidebar (`custom_filters` table). | Fixed filters only. | expected |
| Labels | `labels` table (name, description, colour, "Show label on sidebar"), `taggings`, `cached_label_list`; "Conversation Labels" accordion, right-click "Assign label", bulk "Assign labels / Remove labels", label filter, Labels report, AI "Suggested labels". Also labels on contacts. | Tags on contacts and companies; none on conversations. | table-stakes |
| Custom attributes | `custom_attribute_definitions`: "Applies to" Conversation / Contact / Company; types Text, Number, Link, Date, List, Checkbox; regex validation; badges "Pre-chat" and "Resolution"; "Conversation Information" accordion with inline add/edit; usable in filters, automations, pre-chat forms, and "Attributes required on resolution". | Custom fields on contacts and companies; none on conversations. | expected |
| Automation rules | Events "Conversation Created / Updated / Resolved / Opened", "Message Created", "Monitor Matched"; conditions on inbox, status, labels, priority, message content, email, subject, language, country, custom attributes; actions "Assign to Agent / a Team", "Add / Remove a Label", "Change Priority", "Add SLA", "Snooze / Mute / Resolve", "Send a Message", "Add a Private Note", "Send Webhook Event", "Send an Email to Team", "Send an Email Transcript", "Send Attachment"; "Run instantly" vs "Run after a wait"; clone and toggle. Cloud: Business+. | None (AI triage suggests type/priority; reminder email after N hours per inbox). | expected (a small subset) |
| Macros | Ordered multi-action scripts, "Public" vs "Private", run from the side panel, `#` in the editor, the command bar, and bulk; "Macro executed. The conversation was not resolved because required attributes are missing." | Canned replies with "Send and resolve". | skip (canned reply + send-and-resolve covers it) |
| Canned responses | `/shortcode` picker with preview and search, "Add to canned responses" from a message's context menu, template variables `{{contact.name}}` with a "No value for this conversation" preview and an "Undefined variables" confirm. | `/` picker with `{firstName}`/`{reference}`. | table-stakes (have) |
| Assignment | Inbox "Enable auto assignment" round-robin among members whose availability is Online; "Assignment V2" policies (order "Round Robin" / "Balanced", priority "Earliest Created" / "Longest Waiting", fair-distribution limit per window, exclude stale conversations); Enterprise "Agent Capacity Policies" (per-inbox caps, exclude labels / older than N hours); "Assign to me" banner; `Last Responding Agent` as an automation target. | Manual assignee only. | expected (round-robin), skip (capacity/balanced) |
| Teams | `teams`, `team_members`, "Allow auto assign for this team", assign a team and an agent, team filter, @mention a team, Team report. Cloud: Business+. | Only `isAgent`. | skip for now (expected if customers grow past ~10 agents) |
| SLA | EE `sla_policies` with "First Response Time", "Next Response Time", "Resolution Time", "Only during business hours"; header chip "FRT due / missed"; "SLA Misses" list; SLA report ("Hit Rate", "Number of Misses"); notifications "SLA breach". | `waitingSince`, waiting colours, `reminderAfterHours` per inbox. | expected (lite: per-inbox targets, no policy engine) |
| Business hours | Per inbox: "Enable business availability", timezone, per-day hours, "Unavailable message"; auto-reply once per day per conversation, suppressed if an agent replied in the last 5 minutes; pauses SLA clocks; "business hours" toggle in reports. | Per-agent "away until"; widget shows when the team is back. | expected |
| CSAT | Per inbox "Enable CSAT", emoji or star scale, custom message, rules by label; survey after resolve in the widget ("Rate your conversation", "Tell us more…"); CSAT report with "Satisfaction score", "Response rate", "Review notes" (EE). | None. | expected |
| Reports | "Overview" (realtime: Open / Unattended / Unassigned, Agent status Online/Busy/Offline, conversation-traffic heatmap, conversations by agent/team), "Conversations" (Conversations, Messages received/sent, First Response Time, Resolution Time, Resolution Count, Customer waiting time), Agents, Labels, Inbox, Team, CSAT, Bot, SLA; drill-down to conversations; CSV download. | "High & urgent · N" chip only. | expected (one page with 5 numbers) |
| Contacts and notes | Contacts with filters and "Segments", merge, notes, custom attributes, "Previous Conversations", "Active" contacts, CSV import/export, Companies (EE, 2026). | Contacts with identities, lead stage, tags, custom fields, merge, timeline; companies; deals kanban; activities. | table-stakes (have; CRM is deeper than Chatwoot's) |
| Widget: pre-chat form | "Enable pre-chat form", message, fields Full Name / Email Address / Phone Number plus custom attributes, each with Required, Label, Placeholder, reorder. | Work email + name for anonymous visitors, one qualifying question per inbox. | table-stakes (have the 80%) |
| Widget: availability | Header "We are online" / "We are away at the moment", "Typically replies in a few minutes / a few hours / a day", "We will be back online at {time} / on {day} / tomorrow". | Reply promise text, away notice from per-agent `awayUntil`. | expected (team-level hours, see above) |
| Widget: typing, read receipts | Agent typing shown to the visitor and vice versa over WebSocket; "Sending / Sent / Delivered / Read" per message. | `customerSeenAt` used to skip notify emails; no typing. | expected (receipts), differentiator (typing, only with a host transport) |
| Widget: uploads, emoji | File drag-and-drop, "Record audio", emoji picker (`enableEmojiPicker`), `enableFileUpload`, `enableEndConversation`. | Attachments, paste image, screenshot with redaction. | table-stakes (have; redaction is a differentiator) |
| Widget: CSAT, transcript | "Rate your conversation", "Request a conversation transcript", "End Conversation". | Receipt email. | expected (CSAT), skip (transcript) |
| Widget: campaigns | "Ongoing" proactive messages by URL (wildcards) and "Time on page", "One off" SMS/WhatsApp blasts by label audience. | None. | skip |
| Widget: identity | `setUser(identifier, {identifier_hash})` HMAC, "Enforce user identity validation", "The identity of this user is not verified" banner, secret rotation (v4.18). | `identify(request)` or signed JWT, verified/unverified in the panel. | table-stakes (have) |
| Widget: SDK surface | `window.$chatwoot`: `setUser`, `setCustomAttributes`, `setConversationCustomAttributes`, `setLabel`, `setLocale`, `toggle`, `toggleBubbleVisibility`, `popoutChatWindow`, `reset`; events `chatwoot:ready`, `on-message`, `on-widget-open/close`, `on-start-conversation`; settings `position`, `type: standard | expanded_bubble`, `launcherTitle`, `darkMode`, `hideMessageBubble`, `showUnreadMessagesDialog`. | Web component attributes, React wrapper, standalone script, context capture, `--helpdesk-*` theming. | expected (document a small JS API: open/close, set attributes, events) |
| Help centre / portal | Full CMS: portals, categories, locales, draft/staged edits, custom domain + SSL, article search, "Popular Articles" in the widget, "Recommend categories and articles", AI translation, analytics hooks. | `help.search(query, locale)` adapter → suggestions while typing. | skip authoring (host owns docs); differentiator (search adapter) |
| Email | Channel with IMAP/SMTP, Google and Microsoft OAuth, SES ingress, inbound via Action Mailbox, quoted replies, CC/BCC, forward, "Expand email", "Show quoted text", signatures; continuity emails for widget chats. | Adapter `email.send` + webhook relay with DKIM verification; threading by Message-Id/References or plus-address. | table-stakes (have the model; IMAP polling = skip) |
| Other channels | Facebook, Instagram, WhatsApp (Cloud API, Twilio, 360Dialog), Telegram, LINE, SMS (Twilio, Bandwidth), TikTok, Twitter/X, API channel, Voice. | Widget + email. | skip (see §5) |
| Roles and permissions | "Administrator" / "Agent"; EE "Custom Roles" with "Manage all conversations", "Manage unassigned conversations and those assigned to them", "Manage participating conversations…", "Manage contacts", "Manage reports", "Manage knowledge base"; inbox membership ("Inbox collaborators"). | `isAgent`. | expected (admin vs agent; inbox membership) |
| Audit logs | EE: "Audit Logs" with Activity / Time / Location / IP, event groups "Access", "Agents & teams", "Configuration", "Conversations" (sign in/out, agents, teams, inbox collaborators, account settings, inboxes, webhooks, automation rules, macros, conversation and message deletions). Conversation-level changes are rendered inline as activity messages. | None; no event timeline. | expected (conversation timeline), skip (account audit log; host has its own) |
| Webhooks and events | Settings → Integrations → Webhooks: `conversation_created`, `conversation_updated`, `conversation_status_changed`, `message_created`, `message_updated`, `webwidget_triggered`, `conversation_typing_on/off` (+ inbox events since v4.14); headers `X-Chatwoot-Signature` (`sha256=HMAC-SHA256(secret, "{timestamp}.{body}")`), `X-Chatwoot-Timestamp`, `X-Chatwoot-Delivery`; automation action "Send Webhook Event". | None. | expected (an `events.onEvent` adapter; the host turns it into a webhook if it wants) |
| API | Application API (user access token), Client API (`inbox_identifier` + `contact_identifier`), Platform API (super admin); Swagger; "Public API" rate limits and spam gating (v4.16). | HTTP routes under `basePath`; the host also has the DB. | expected (document the service as the API; add API tokens only if a design partner asks) |
| Integrations | Slack (reply from threads, "Alerts-only mode"), Linear (create/link issues, "Linked Linear Issues" accordion), Shopify orders, Dashboard Apps (iframe side panel), Google Translate, Dialogflow, OpenAI, LeadSquared, Cloudflare RealtimeKit video. | None. | differentiator (Linear/Slack via events adapter), skip (Dialogflow, video, Shopify) |
| Captain AI | Assistant (customer-facing, per inbox, handoff, "Take over"), Copilot side-panel chat ("Use this"), composer actions, FAQs, Memories, Monitors, Scenarios, Tools, Playground, label suggestions ("Suggest with Captain"), audio transcription, "Report message" on AI replies, credit metering. | `ai.generate({system, prompt, schema})` → triage suggestion (type, priority, title, duplicates) and draft reply. | differentiator (adapter-based, no metering); expected (composer actions: improve, shorten, tone, translate) |
| Mobile apps | iOS and Android (React Native), push notifications. | Responsive admin inside the host app. | skip (native); expected (admin usable on a phone) |
| Notifications | "My Inbox" notification view; types "Assigned to you", "Mentioned", "New Conversation", "New message", "SLA breach"; per-agent Email and Push preferences per event; audio alerts with "only if the browser window is not active" and "every 30s until all the assigned conversations are read"; browser push; "Mark all as read", snooze a notification. | Email `agent-new` and `agent-reminder` to agents; widget shows "N conversations waiting". | table-stakes (in-app bell + per-agent email prefs) |
| Keyboard | `⌘K` command bar (context-aware: Resolve/Reopen, Snooze → options, Mute, Send transcript, Assign agent/team, Add label, Go to…); shortcuts `Alt+J/K` open conversation, `Alt+E` resolve, `⌘+Alt+E` "Resolve and move to next", `Alt+P` private note, `Alt+L` reply, `Alt+M` snooze menu, `Alt+O` toggle sidebar, `Alt+N` next tab, `Alt+C/V/R/S` go to conversations/contacts/reports/settings, `⌘+Alt+A` attachment, `⌘/` list shortcuts, `/` focus search. | j/k, `⌘↵` send, `⌘⇧↵` send and resolve. | expected |
| Dark mode | Dashboard theme light/dark/auto; widget `darkMode: "auto"`. | Widget dark/auto; admin theming via CSS variables. | expected (admin dark) |
| Bulk actions | Select rows → "{n} selected", "Assign agent", "Assign team", "Assign labels / Remove labels", "Change status", "Snooze", "Execute macro"; note "Conversations visible on this page are only selected." | None. | expected |
| Merge conversations | Not available; issue #9264 (23 👍, open since April 2024). | None. | skip (match Chatwoot; link instead) |
| Multi-brand / multi-account | Accounts with switcher, Super Admin, Platform API; "Better multi-tenancy support" #11109 still open. | One host app = one tenant. | skip |

## 3. UI/UX patterns worth adopting

1. **Three-pane layout with a collapsible, sectioned side panel.** List · thread
   · right panel. The panel has two tabs, "Contact" and "Copilot", and the
   Contact tab is an accordion of "Conversation Actions" (assignee, team,
   priority, labels), "Conversation Information" (custom attributes),
   "Contact Details", "Contact Notes", "Contact Attributes", "Previous
   Conversations", "Attachments" (media and files, "Jump to message"), plus
   integration sections ("Linked Linear Issues"). `Alt+O` toggles the panel;
   open/closed state and section order persist. Why it works: the thread stays
   wide, and everything that changes rarely is one click away but never in the
   way. For Better Helpdesk: keep the customer panel, make it collapsible, and
   order it Actions → Captured context → Contact → Company → Previous
   conversations; remember collapse per agent in `localStorage`.

2. **A status split-button, not three buttons.** The header's primary action
   reads "Resolve" for open conversations, "Reopen" for resolved ones, with a
   caret menu "Mark as pending" and "Snooze until → Next reply / Tomorrow /
   Next week / custom". Snoozed conversations show "Snoozed until tomorrow" in
   the header and reopen on the customer's reply. Keyboard: `Alt+E` resolve,
   `⌘+Alt+E` "Resolve and move to next", `Alt+M` opens the snooze menu. For
   Better Helpdesk: replace the status select with "Resolve ▾" (Pending,
   Snooze…) and make "Send and resolve" the composer's twin of it; add
   "Resolve and next" so a triage pass is one key per ticket.

3. **`⌘K` command bar with context-aware sections.** Inside a conversation the
   first section is "Conversation": Resolve/Reopen, Snooze (with child
   options), Mute, Send transcript, Assign agent, Assign team, Add label; then
   "Go to" pages. The empty thread state advertises it: "⌘K to open command
   menu · ⌘/ to view keyboard shortcuts". Why it works: discoverability for
   every action without more toolbar buttons, and assigning or labelling
   becomes type-ahead. For Better Helpdesk: one palette over the existing
   actions (status, priority, assignee, type, canned reply, "Go to inbox",
   "Go to contact"), rendered inside `HelpdeskAdmin`, bound to `⌘K`.

4. **Reply / Private Note as tabs with an unmistakable note style.** The
   composer has two tabs, "Reply" and "Private Note"; the note mode turns the
   editor yellow and swaps the hint text: "Shift + enter for new line. Start
   with '/' to select a Canned Response." vs "This will be visible only to
   Agents". Notes in the thread carry "Private Note: Only visible to you and
   your team". `Alt+P`/`Alt+L` switch modes. The editor also has pickers for
   `/` canned responses (with preview), `#` macros, `@` agents and teams, `{{`
   variables (showing "Value" or "No value for this conversation"), and an
   "Undefined variables … send anyway?" guard. For Better Helpdesk: keep the
   reply/note toggle but make it a tab pair with a coloured note surface and
   keyboard switch; add `@` for teammates once mentions exist.

5. **Message metadata that explains delivery.** Each outgoing message shows
   "Sending / Sent / Delivered / Read" or "Failed to send · retry"; inbound
   email shows a collapsible header ("From / To / Cc / Subject / Date", "Expand
   email") and "Show quoted text"; list rows say "Received via email"; bot and
   AI messages are labelled ("Bot", "Generated by Captain" with "How was this
   reply generated?" → steps, "Knowledge base" sources, model, credits). For
   Better Helpdesk: show "via widget / via email" and "seen by customer at
   10:42" (from `customerSeenAt`) on agent messages, "Email delivered /
   bounced" once the email adapter reports it, and the AI draft's provenance
   when an agent applies one.

6. **Right-click and bulk actions on list rows.** The card context menu:
   "Mark as pending", "Mark as resolved", "Mark as unread / read", "Snooze →
   Until next reply / tomorrow / next week", "Assign agent", "Assign label",
   "Assign team", "Open in new tab", "Copy conversation link", "Delete
   conversation". Checkbox selection yields a bar "{n} selected" with Assign
   agent / team, Assign or Remove labels, Change status, Snooze, Execute macro,
   and the honest notice "Conversations visible on this page are only
   selected." For Better Helpdesk: a row menu with status, assign, label,
   "Mark as unread", copy link (the `ACME-1042` reference URL), then a
   selection bar for status and assignee.

7. **A separate notification inbox ("My Inbox") instead of toasts.** v4 made
   notifications a first-class list: each row is typed ("Assigned to you",
   "Mentioned", "New Conversation", "New message", "SLA breach"), can be
   snoozed ("Snoozed for {time}"), read/unread, deleted; menu "Mark all as
   read", "Delete all read"; "Display: Snoozed, Read, Labels, Conversation
   ID"; sort Newest / Oldest / Priority. The bell badge counts unread. Per-agent
   preferences for Email and Push per event. For Better Helpdesk: a bell in the
   admin header backed by a `notification` table and the existing 10-second
   poll; the first three types are assignment, mention and new customer
   message on your conversations.

8. **Widget availability and reply-time expectation in the header.** The
   widget header switches between "We are online" and "We are away at the
   moment", adds "Typically replies in a few minutes / a few hours / a day"
   (an inbox setting) and, with business hours, "We will be back online at
   {time} / on {day} / tomorrow". Below it: "Start Conversation" vs "Continue
   conversation", an unread dialog "You have unread messages → See new
   messages" when the launcher is closed, the pre-chat form with "Required"
   markers, CSAT "Rate your conversation" after resolve, "Request a
   conversation transcript", and a popout button. For Better Helpdesk: derive
   the header line from inbox business hours and agent presence rather than
   per-agent `awayUntil` only; keep the reply promise as the "typically
   replies" line; add the unread dialog on the launcher.

9. **Collision and takeover banners.** When an agent opens a conversation not
   assigned to them: "This conversation is not assigned to you. Would you like
   to assign this conversation to yourself?" with "Assign to me". While another
   agent types: "{user} is typing", "{user} and {secondUser} are typing". When
   an AI assistant holds it: "This conversation is currently handled by {name}"
   with "Take over". For Better Helpdesk: the "Assign to me" banner needs no
   real-time at all and prevents most double replies; "someone is viewing"
   can be a cheap heartbeat (`agent_viewing` row written on open, read in the
   poll) before any typing indicator.

10. **Contact history inside the thread.** v4.18 added "Previous conversation
    with {name} · {time}" / "Next conversation" links at the top and bottom of
    a thread, "Reply to this older conversation" and "Go to latest
    conversation". Why it works: the agent never leaves the thread to check
    whether this customer wrote last week. For Better Helpdesk: the contact
    timeline already exists; add prev/next links in the thread header for the
    same contact and company.

11. **Sort and "Unattended" as first-class views.** The sort menu is explicit
    about direction and intent: "Last activity: Newest first", "Created at:
    Oldest first", "Priority: Highest first", "Pending Response: Longest
    first", "Priority: Highest first, Created: Oldest first", "Unread Count:
    Highest first". "Unattended" is a dedicated view for conversations with no
    agent reply yet (`first_reply_created_at` / `waiting_since`). Better
    Helpdesk already sorts by longest waiting and priority; add the combined
    "Priority, then oldest" and a "Needs first reply" chip next to "High &
    urgent".

12. **Empty states that teach, and list pages with a count and a "Learn more".**
    "Uh oh! Looks like there are no messages from customers in your inbox.",
    "All conversations loaded 🎉", "Please select a conversation from left
    pane"; settings pages open with a one-paragraph description, "Learn more
    about labels", "{n} labels", a search box; empty SLA and Monitors lists show
    example entries ("Enterprise P0", "Login problems", "Cancellation intent")
    to start from. For Better Helpdesk: apply the header + description + count
    pattern to Canned replies and Settings, and give the inbox an empty state
    that points at the widget install snippet.

13. **Required attributes on resolve, as a modal, not a validation error.**
    Clicking Resolve with missing required fields opens "Resolve conversation —
    Please fill in the following custom attributes before resolving this
    conversation" with typed inputs and a single "Resolve conversation"
    button; bulk resolve skips and reports the ones that fail. For Better
    Helpdesk: the same modal is the right home for "type is still `question`"
    or "no title set" if a host wants clean reporting.

14. **AI suggestions as accept/dismiss chips, with provenance.** "Suggested
    labels" appear as chips with "Add selected labels", "Add all labels",
    "Dismiss"; the composer's Captain menu lists verbs (Improve reply, Change
    tone, Fix grammar and spelling, Suggest a reply, Summarize the
    conversation); AI messages carry a "Report message" option with reasons
    (Incorrect information, Inappropriate response, Incomplete, Outdated).
    Better Helpdesk's triage suggestion already uses apply/dismiss; extend the
    same chip pattern to label suggestions and add the composer verbs through
    the existing `ai.generate` adapter.

## 4. What users complain about

- **Upgrades break, especially across majors.** v4 "requires the pgvector
  extension" (the Helm chart's Bitnami Postgres lacks it); upgrading straight
  from v3.x to v4.2+ fails in migration
  `20250416182131_flip_chatwoot_v4_default_feature_flag_installation_config.rb`
  (#12088, workaround: go through v4.1 first); fresh Docker installs of
  v4.2–v4.4 crash-looped before migrations could run (#12078); v4.5.1 was a
  hotfix for "migration issues affecting upgrades of Community Edition
  instances"; the official Docker guide now says "upgrade iteratively through
  intermediate Docker image tags". Better Helpdesk's answer is already in
  place: SQL migrations generated by Drizzle, applied by `better-helpdesk-migrate`
  inside the host's own deploy, in the host's own Postgres. Selling point:
  "an upgrade is `pnpm up better-helpdesk` and one migrate command".
- **Redis and Sidekiq are a second system to babysit.** Sidekiq exits on Redis
  older than 7 (discussion #10740), `REDIS_PASSWORD` handling in Docker
  (#10753), "Memory overcommit must be enabled" warnings, Redis eviction
  silently dropping jobs and Postgres pool exhaustion in production write-ups
  (dev.to "5 failures the docs don't warn you about"), docs drift about "7
  docker-compose services and REDIS_URL" (#14837). Chatwoot's own
  `POST /messages` returns 200 before Sidekiq delivers. Better Helpdesk has no
  Redis and no worker; `runJobs()` runs on the host's schedule. Keep it that
  way and say so on the README.
- **Resource use and slowness at modest scale.** Minimum 4 GB RAM / 4 cores;
  Sidekiq alone "1GB+"; 1.8 GB RAM for ~350k messages on a 4-container VPS
  (dev.to measurement); "very slow with 10–15 users" where
  `update_last_seen` took 3 s (#3425, closed as investigation); 15–28 s
  dashboard loads at ~100k conversations and 40 agents, CPU-bound serialization
  fixed by Puma tuning (discussion #14838); unread counts for mentions,
  participating and folders reverted a day after release "due to performance
  related issues" (v4.15.1). Lesson for Better Helpdesk: every list badge must
  be one indexed query; never compute counts across folders on every poll.
- **Enterprise gating of things small teams consider basic.** Captain is not in
  the Community Edition at all (HN on 4.0: "it doesn't seem to support ollama …
  can't use it for self-hosted model with our own RAG"; now a custom endpoint
  is allowed but still only in paid EE); SLA, custom roles, audit logs, agent
  capacity, SAML and voice are paid; community asks keep piling up ("Feature
  (CE): Template Builder" #10886, 18 👍; "Custom Roles and Permissions" #4216,
  open since March 2022 and labelled Enterprise). At launch, HN commenters
  already worried about a "bait-and-switch" and screenshotted the MIT promise.
  Better Helpdesk's AI adapter means AI drafting works with any model the host
  pays for, metered by nobody. Keep every feature in the one MIT package.
- **Email channel friction.** "General Email Channel Issues only make app
  compatible with simple setups" (#11515): SMTP coupled to IMAP, Microsoft 365
  OAuth needing a licence per mailbox, no shared mailboxes or aliases, Mailgun
  documented but absent; IMAP sync stalls (#8626, #3869); v4.0.1 hotfixed
  IMAP/SMTP sync; "SMTP configuration independent of IMAP" only landed in
  v4.18 (September 2026). Better Helpdesk's relay-plus-adapter model sidesteps
  mailbox polling entirely, but it needs copy-paste recipes for the three
  relays a Swiss SaaS actually uses (Cloudflare Email Workers exists; add
  Postmark/Resend inbound and Microsoft 365 via Graph subscription as examples).
- **Locale and EU details.** "UI date/time format is hardcoded (12-hour and US
  style) instead of being locale-driven" (#12730, 9 👍). German exists via
  Crowdin but is community-maintained. Better Helpdesk's typed `en`/`de` tables
  and Swiss Standard German are a concrete advantage; make date formats follow
  the host locale from day one.
- **UI and workflow gaps users keep asking for.** Merge conversations (#9264,
  23 👍, no maintainer reply), streaming AI replies (#10315, 38 👍), scheduled
  send (#9484), emoji reactions (#10411), "mark as unread forever" bug after a
  perf workaround (#3425), inconsistent browser notifications and a weak mobile
  app (HN 32982485; the team acknowledged a redesign), Meta app-review pain for
  social channels.
- **Operational burden as a theme.** Secondary roundups quote a Reddit user
  calling their setup "the Chatwoot that fell constantly" and summarise the
  cost as "your attention, at inconvenient hours" (eesel.ai, dev.to). Even the
  friendly HN migration story lists Facebook/Instagram setup as "considerable
  effort". The positioning line writes itself: no second deployment, no second
  login, no second database.

## 5. What NOT to copy

- **Social and messaging channel connectors** (WhatsApp, Instagram, Facebook,
  Telegram, LINE, TikTok, SMS, Twitter). They need Meta app reviews, template
  approval, 24-hour reply windows, webhook receivers and workers; roughly half
  of Chatwoot's 2026 release notes are WhatsApp maintenance. Out of scope for an
  embedded library whose channels are the host's product and email.
- **Multi-account, Super Admin and the Platform API.** Chatwoot is a
  multi-tenant SaaS codebase (accounts, account switcher, installation configs,
  platform apps). Better Helpdesk has exactly one tenant: the host app.
- **Its own identity stack.** Sign-in, password reset, invitations, 2FA/MFA,
  SAML, agent sessions, "Availability: Online / Busy / Offline" presence in
  Redis. The host owns identity; presence can be `agents.lastSeenAt`.
- **Sidekiq, ActionCable and Redis as architecture.** Real-time fan-out and
  a job queue are what make Chatwoot a deployment. Keep `runJobs()` and
  polling; offer real-time only as an optional host-provided transport.
- **The Help Center CMS.** Portals, categories, locales, staged edits, custom
  domains and SSL, article analytics: a second product. Hosts already have
  docs; the `help.search` adapter is the right seam.
- **Captain as a metered platform** (credits, Monitors, Memories, Scenarios,
  Playground, assistant per inbox, agent-bot framework, Dialogflow). The
  vocabulary is also wrong for us: an agent is a person. Keep AI to adapter
  calls that produce suggestions and drafts an agent reviews.
- **Campaigns** (ongoing widget pop-ups by URL and time-on-page; one-off
  SMS/WhatsApp blasts). Marketing automation with consent, scheduling and
  workers; the host's own product analytics tool does this better.
- **Voice and video** (Twilio and WhatsApp calling, calls dashboard,
  recording, transcription, Cloudflare RealtimeKit). Telephony is a separate
  business.
- **Dashboard Apps (iframe embeds of internal tools).** Better Helpdesk already
  runs inside the host; expose a React render slot in the customer panel
  instead of an iframe protocol.
- **Macros as a flow builder** ("Start Flow / End Flow", drag-ordered action
  nodes, public/private visibility). For 1–10 agents, a canned reply plus
  "Send and resolve" and a couple of automation actions cover it.
- **Paywall UI patterns** ("Upgrade now", "You can change or cancel your plan
  anytime", Enterprise badges). There is nothing to upsell.
- **Elasticsearch search (EE), Year in Review, onboarding wizards, testimonial
  feeds, feature-flag-driven "feature spotlight" cards.** Product-marketing
  surface for a SaaS, not a library.
- **Importers from Intercom/Zendesk/Freshdesk/Front.** Reasonable later, but
  each is a maintained data-mapping project; a documented CSV contact import
  is enough for the design partners.

## 6. Top 10 recommended work items

Layers refer to Better Helpdesk's own structure: `schema` =
`src/db/schema.ts` + generated migration, `service` = `src/service.ts` and
`src/db/store.ts`, `http` = `src/http.ts`, `admin` = `src/admin/*`, `widget` =
`src/widget/*`, `adapter` = `src/config.ts`, `docs` = README/CONTEXT.md, plus
`src/ui/i18n.ts` for every user-facing string (en + de).

1. **feat(admin): label conversations and filter the inbox by label**
   - problem: "Billing", "bug-confirmed", "waiting-on-customer" live in agents'
     heads today; nobody can pull up all open billing questions.
   - scope: in: `label` table (slug, name en/de, colour) and a
     `conversation_label` join; CRUD in Settings; a "Labels" section in the
     conversation side panel with a type-ahead picker; chips on list rows;
     `label` filter in the inbox; `removeLabel` by clicking the chip. Out:
     labels on contacts (tags exist), label reports, AI label suggestions, bulk.
   - size: M. depends on: none. layers: schema, service, http, admin, i18n.
   - evidence: Chatwoot `labels` + `taggings` + `conversations.cached_label_list`
     (`db/schema.rb`); side panel accordion "Conversation Labels"; filter
     attribute "Labels"; "Show label on sidebar" in `labelsMgmt.json`.

2. **feat(admin): show unread conversations, count them per tab, and mark read or unread**
   - problem: after lunch an agent cannot tell which of 30 open tickets got a
     customer reply; the waiting colour only says how long, not "new since I
     looked".
   - scope: in: `agentSeenAt` on `conversation` (team-wide, like Chatwoot's
     `agent_last_seen_at`) set when an agent opens the thread; "unread" =
     `lastMessageAt > agentSeenAt` and last author is the customer; bold row +
     dot; counts on Mine / Unassigned / All computed in the same list query
     with an index on `(status, last_message_at)`; row menu "Mark as unread /
     Mark as read"; sort "Unread first". Out: per-agent read state, counts per
     label or inbox (Chatwoot reverted exactly those for performance).
   - size: M. depends on: none. layers: schema, service, http, admin, i18n.
   - evidence: `conversations.agent_last_seen_at`, `assignee_last_seen_at`,
     `contact_last_seen_at` in `db/schema.rb`; `CARD_CONTEXT_MENU.MARK_AS_UNREAD`;
     v4.15.0 "Conversation unread counts, sidebar badges" and v4.15.1 revert.

3. **feat(service): reopen resolved conversations on a customer reply and snooze until a time or the next reply**
   - problem: a customer answers a resolved ticket by email and nobody sees it;
     an agent waiting for Monday has no way to park a ticket without losing it.
   - scope: in: `snoozedUntil` column, status `snoozed`; service rule: any
     customer message on `resolved` or `snoozed` sets `open` and `waitingSince`;
     `runJobs()` wakes expired snoozes; header "Resolve ▾" with "Mark as
     pending" and "Snooze until: Next reply / Tomorrow / Next week / Pick a
     time"; list status filter "Snoozed"; widget maps `snoozed` to "With our
     team"; receipts and notify-customer unchanged. Out: mute, natural-language
     time parsing, auto-resolve after N days (retention covers deletion).
   - size: M. depends on: none. layers: schema, service, http, admin, widget,
     i18n.
   - evidence: `conversations.snoozed_until`; `SNOOZE_OPTIONS` in
     `app/javascript/dashboard/constants/globals.js`; `RESOLVE_DROPDOWN` in
     `conversation.json`; reopen on incoming message in `app/models/message.rb`
     (`reopen_conversation`); automation event "Conversation Opened".

4. **feat(admin): record status, assignment and priority changes as a timeline in the thread**
   - problem: "who resolved this and when, and why is it urgent?" is
     unanswerable; the thread only shows messages.
   - scope: in: `event` table (conversation_id, agent_id, kind, data, created_at)
     written by the service for status, assignee, priority, type, title,
     labels, snooze, reopen-by-reply, AI suggestion applied, email delivery
     outcomes; rendered inline as grey one-liners ("Priya resolved this ·
     14:02"); included in the conversation payload. Out: account-level audit
     log, IP/location, agent sign-in events (the host has those).
   - size: M. depends on: none (3 and 1 add kinds). layers: schema, service,
     http, admin, i18n.
   - evidence: Chatwoot renders activity messages inline in the thread
     (`message_type: activity`, `conversation.status_changed`,
     `assignee.changed` WebSocket events) and keeps `audits` for EE "Audit
     Logs" with groups "Conversations", "Configuration", "Agents & teams".

5. **feat(admin): @mention teammates in internal notes and add Mentions and Participating views**
   - problem: "@Priya can you check the invoice?" has no way to reach Priya;
     agents who commented on a ticket are not told when it moves.
   - scope: in: `@` picker in the note editor listing agents (`agents` table);
     `mention` table (conversation_id, message_id, agent_id, read_at);
     `conversation_agent` participation (auto-added on reply, note or
     mention; "Join conversation" button); inbox views "Mentions" and
     "Participating" next to Mine/Unassigned/All; agent-mention email through
     the existing `agent-new` kind. Out: team mentions, mention counts in the
     sidebar.
   - size: M. depends on: none. layers: schema, service, http, admin
     (`src/ui/rich-editor.tsx`), i18n.
   - evidence: `mentions` and `conversation_participants` tables;
     `MENTION.AGENTS/TEAMS` and `CONVERSATION_PARTICIPANTS` strings in
     `conversation.json`; "Participating tab for conversations" (v4.13).

6. **feat(admin): in-app notification bell with per-agent email preferences**
   - problem: an assignment or a reply on "my" ticket is only visible if the
     agent happens to be looking at the right filter; email is the only alert.
   - scope: in: `notification` table (agent_id, kind, conversation_id,
     read_at); kinds "Assigned to you", "Mentioned", "New message" (on assigned
     or participating conversations), "New conversation" (opt-in per inbox);
     created by the service; `agent/notifications` endpoint polled with the
     existing 10-second cycle; header bell with unread count and a list with
     "Mark all as read"; per-agent toggles for which kinds also send email
     (reuse `agent-new`/`agent-reminder` kinds). Out: browser push, sounds,
     snoozing a notification.
   - size: L. depends on: 5 (mentions), optionally 4. layers: schema, service,
     http, admin, adapter (email kinds), i18n.
   - evidence: `notifications`, `notification_settings`,
     `notification_subscriptions` tables; `INBOX.TYPES_NEXT` in `inbox.json`;
     "Notification preferences" matrix (Email / Push per event) in
     `settings.json`; v4 "Inbox View".

7. **feat(admin): command palette and status shortcuts (resolve, resolve-and-next, reply/note, snooze, panel)**
   - problem: triaging 40 tickets means 40 mouse trips to the status select;
     j/k gets the agent to the ticket but not through it.
   - scope: in: `⌘K` palette listing conversation actions (Resolve, Reopen,
     Mark pending, Snooze…, Set priority, Assign to…, Set type, Insert canned
     reply) and navigation (inbox, contacts, settings); shortcuts `e` resolve,
     `⌘⇧e` resolve and open next, `p`/`r` note/reply, `s` snooze menu, `[`
     toggle side panel, `?` shortcut sheet; all listed in a modal. Out: bulk
     actions from the palette.
   - size: S. depends on: 3 for snooze entries. layers: admin, i18n, docs.
   - evidence: `app/javascript/dashboard/helper/commandbar/actions.js`;
     `SHORTCUT_KEYS` in
     `app/javascript/dashboard/components/widgets/modal/constants.js`
     ("Resolve and move to next", "Switch to Private Note", "Toggle snooze
     dropdown"); help-centre "Working with command bar".

8. **feat(config): emit conversation events to a host-provided `events` adapter**
   - problem: hosts want "post to Slack when a lead arrives" and "create a
     Linear issue from this bug" without Better Helpdesk shipping either
     integration.
   - scope: in: optional `events?: { onEvent(event): Promise<void> }` on
     `HelpdeskConfig` receiving typed events (`conversation.created`,
     `conversation.status_changed`, `conversation.assigned`,
     `message.created` with `internal` flag, `contact.created`,
     `deal.stage_changed`) with full payloads; dispatched after commit; the
     README shows a 20-line Slack example and a Linear example. Out: retries,
     signing, a webhook UI (the host writes the fetch; it already has its own
     secrets).
   - size: S. depends on: 4 for the shared event vocabulary. layers: adapter,
     service, docs.
   - evidence: `webhooks` table, `app/jobs/webhook_job.rb`, events
     `conversation_created / status_changed / updated`, `message_created /
     updated`; automation action "Send Webhook Event"; Slack "Alerts-only mode"
     (v4.18).

9. **feat(config): business hours per inbox drive widget availability, receipts and reminders**
   - problem: a Swiss team closes at 17:30; the widget still implies someone
     will answer, the receipt promises nothing concrete, and the 24-hour red
     indicator fires over the weekend.
   - scope: in: `InboxConfig.hours` (timezone, per-weekday ranges) and
     `replyTime: 'minutes' | 'hours' | 'day'`; widget header "We're online" /
     "We're away — back Monday 08:00" computed from hours plus agent
     `awayUntil`; receipt email states the next opening; `waitingSince`
     colours and `reminderAfterHours` count business hours only; agent-side
     "Outside hours" chip in the thread header. Out: an auto-reply message to
     the customer, SLA policies, holidays.
   - size: M. depends on: none. layers: adapter, service, widget, admin, i18n,
     docs.
   - evidence: `working_hours` table; inbox "Business Hours" tab ("Enable
     business availability", timezone, "Unavailable message"); widget strings
     `TEAM_AVAILABILITY.*` and `REPLY_TIME.*` in `widget/i18n/locale/en.json`;
     SLA "Only during business hours".

10. **feat(service): auto-assign new conversations round-robin to present agents, with an "Assign to me" banner**
    - problem: every ticket starts unassigned; two agents open the same one and
      both reply.
    - scope: in: `InboxConfig.autoAssign?: boolean` and an optional agent list
      per inbox; on create, pick the next agent in rotation among agents whose
      `awayUntil` is unset and `lastSeenAt` is within the last N minutes, else
      leave unassigned; a `conversation_assignment_cursor` row per inbox for
      rotation; thread banner "This conversation isn't assigned to you — Assign
      to me" when an unassigned or other-assigned thread is opened; event in
      the timeline. Out: balanced assignment, capacity limits, teams,
      reassignment when an agent goes away.
    - size: M. depends on: none (4 for the event). layers: schema, service,
      http, admin, adapter, i18n.
    - evidence: inbox "Enable auto assignment" with online-availability
      round-robin; `assignment_policies` and `inbox_assignment_policies`
      ("Round Robin", "Longest Waiting", exclude stale, v4.12–4.16);
      `NOT_ASSIGNED_TO_YOU` / `ASSIGN_TO_ME` strings; help-centre "Preventing
      Agent Collision".

Next tier after these, in order: saved views over the filter bar
(`custom_filters`), CSAT after resolve in the widget plus a one-page report,
conversation-level custom attributes with "required on resolve", bulk status
and assignee changes, an optional `realtime` adapter (host SSE/WebSocket) that
replaces polling and enables typing indicators, admin dark mode.

## 7. Sources

Repository and code (read via the GitHub API on 2 October 2026):
- https://github.com/chatwoot/chatwoot (README, LICENSE, `enterprise/LICENSE`, tree)
- https://github.com/chatwoot/chatwoot/releases (v4.0.0 → v4.18.0 bodies)
- https://github.com/chatwoot/chatwoot/blob/develop/db/schema.rb
- https://github.com/chatwoot/chatwoot/tree/develop/enterprise/app/models and `/services`
- https://github.com/chatwoot/chatwoot/tree/develop/app/models and `/app/jobs`
- https://github.com/chatwoot/chatwoot/tree/develop/app/javascript/dashboard/i18n/locale/en (conversation, chatlist, inbox, settings, advancedFilters, bulkActions, snooze, sla, automation, macros, customRole, auditLogs, labelsMgmt, attributesMgmt, cannedMgmt, report, search, teamsSettings)
- https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/widget/i18n/locale/en.json
- https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/helper/commandbar/actions.js
- https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/components/widgets/modal/constants.js
- https://github.com/chatwoot/chatwoot/blob/develop/app/javascript/dashboard/constants/globals.js
- https://github.com/chatwoot/chatwoot-mobile-app
- https://api.github.com/search/issues?q=repo:chatwoot/chatwoot+is:issue+sort:reactions-%2B1-desc

Official docs and site:
- https://www.chatwoot.com/pricing
- https://www.chatwoot.com/pricing/self-hosted-plans
- https://www.chatwoot.com/changelog
- https://www.chatwoot.com/captain and https://www.chatwoot.com/captain/monitors
- https://www.chatwoot.com/docs/product (help-centre index)
- https://www.chatwoot.com/hc/user-guide/articles/1677776492-enterprise-edition
- https://www.chatwoot.com/hc/user-guide/articles/1738101283-captain-_-introduction
- https://www.chatwoot.com/hc/user-guide/articles/1738101547-creating-an-assistant-with-captain
- https://www.chatwoot.com/hc/user-guide/articles/1738110272-how-to-use-captain-copilot
- https://www.chatwoot.com/hc/user-guide/articles/1755284287-how-to-enable-captain-on-self_hosted-installations
- https://www.chatwoot.com/hc/user-guide/articles/1765223602-how-ai-credits-work-in-captain
- https://www.chatwoot.com/hc/user-guide/articles/1677697180-working-with-command-bar
- https://www.chatwoot.com/hc/user-guide/articles/1677698168-working-with-keyboard-shortcuts
- https://www.chatwoot.com/hc/user-guide/articles/1732243644-preventing-agent-collision
- https://www.chatwoot.com/hc/user-guide/articles/1677580558-website-live-chat-settings-explained
- https://www.chatwoot.com/hc/user-guide/articles/1677688647-how-to-use-pre_chat-forms
- https://www.chatwoot.com/hc/user-guide/articles/1677688192-how-to-use-conversation-filters
- https://www.chatwoot.com/hc/user-guide/articles/1677698771-group-chats-with-filters-save-as-folders
- https://www.chatwoot.com/hc/user-guide/articles/1677696868-assigning-conversations-in-a-round_robin-fashion
- https://www.chatwoot.com/hc/user-guide/articles/1763978164-chatwoot-assignment-v2
- https://www.chatwoot.com/hc/user-guide/articles/1741998212-agent-capacity
- https://www.chatwoot.com/hc/user-guide/articles/1777421876-business-hours-and-auto_responder
- https://www.chatwoot.com/hc/user-guide/articles/1677503828-how-to-enable-csat-surveys
- https://www.chatwoot.com/hc/user-guide/articles/1677496066-how-to-add-labels
- https://www.chatwoot.com/hc/user-guide/articles/1677502327-how-to-create-and-use-custom-attributes
- https://www.chatwoot.com/hc/user-guide/articles/1677689800-how-to-use-automation
- https://www.chatwoot.com/hc/user-guide/articles/1679978392-how-to-use-macros
- https://www.chatwoot.com/hc/user-guide/articles/1692251809-how-to-use-audit-logs
- https://www.chatwoot.com/hc/user-guide/articles/1741923706-manage-team-access-control-with-flexible-role_based-permissions
- https://www.chatwoot.com/hc/user-guide/articles/1731478912-setting-up-notifications
- https://www.chatwoot.com/hc/user-guide/articles/1740546374-how-does-sorting-work
- https://www.chatwoot.com/hc/user-guide/articles/1769161760-required-conversation-attributes
- https://www.chatwoot.com/hc/user-guide/articles/1677587761-how-to-continue-conversations-through-email
- https://www.chatwoot.com/hc/user-guide/articles/1677587234-how-to-send-additional-user-information-to-chatwoot-using-sdk
- https://www.chatwoot.com/hc/user-guide/articles/1677587479-how-to-enable-identity-validation-in-chatwoot
- https://www.chatwoot.com/hc/user-guide/articles/1677738682-how-to-use-campaigns
- https://www.chatwoot.com/hc/user-guide/articles/1677492970-adding-teams
- https://www.chatwoot.com/hc/user-guide/articles/1677693459-how-to-read-overview-reports-realtime
- https://www.chatwoot.com/hc/user-guide/articles/1677693021-how-to-use-webhooks
- https://www.chatwoot.com/hc/user-guide/articles/1677691027-how-to-setup-a-web_socket-connection
- https://developers.chatwoot.com/self-hosted/deployment/requirements
- https://developers.chatwoot.com/self-hosted/deployment/architecture
- https://developers.chatwoot.com/self-hosted/deployment/docker
- https://developers.chatwoot.com/self-hosted/runbooks/upgrade-to-chatwoot-v4
- https://developers.chatwoot.com/api-reference/introduction

User opinion:
- https://news.ycombinator.com/item?id=26501527 (Launch HN, 2021)
- https://news.ycombinator.com/item?id=43840012 (Show HN: Chatwoot 4.0)
- https://news.ycombinator.com/item?id=32982485 (switched from Front)
- https://github.com/chatwoot/chatwoot/issues/11515 (email channel), #8626, #3869
- https://github.com/chatwoot/chatwoot/issues/3425 and https://github.com/orgs/chatwoot/discussions/14838 (performance)
- https://github.com/chatwoot/chatwoot/issues/12088, #12078, #11614, #11274, #10753, #14837, https://github.com/orgs/chatwoot/discussions/10740 (upgrade and Docker)
- https://github.com/chatwoot/chatwoot/issues/4216 (custom roles), #10886, #9264 (merge), #10315 (streaming), #12730 (date format), #11109 (multi-tenancy), #9484, #10411
- https://dev.to/achiya-automation/self-hosted-chatwoot-5-failures-the-docs-dont-warn-you-about-47c3
- https://dev.to/achiya-automation/i-measured-what-self-hosted-chatwoot-actually-uses-348703-messages-18-gb-of-ram-4cp1
- Secondary roundups, used only for the Reddit quote and the "operational burden" framing: https://www.eesel.ai/blog/chatwoot, https://martechsignal.com/tools/chatwoot/, https://puzzleinbox.com/tools/chatwoot/
