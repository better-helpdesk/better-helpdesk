# Candidate work items, merged across reports (working file)

Columns: id | title | size | sources (Z=Zendesk, I=Intercom, C=Chatwoot, L=Libredesk, U=UX, M=Marketing, S=Sales) | depends on | notes

## From Intercom (I)
- office-hours | feat(config): office hours per inbox; waiting colours, reminders and widget "back at" respect them | M | I | - | replyTime per inbox; nextOpening helper
- widget-home-team | feat(widget): team avatars, expected reply time and back-at time on the home screen | S | I | office-hours (soft) |
- snooze | feat(admin): snooze with presets and automatic wake-up in runJobs | M | I | office-hours (soft, timezone) | key z; customer reply clears
- presence | feat(admin): who is viewing / replying, via the poll tick | M | I | - | presence table pruned in runJobs; setting to turn off
- tags | feat(admin): conversation tags, filter, tag actions on canned replies | M | I | - |
- mentions | feat(admin): @mentions in notes, Mentions filter, email notification | M | I | - |
- events-timeline | feat(admin): conversation event timeline in the thread | M | I | - | customer-safe subset in widget
- on-event-adapter | feat(config): optional events adapter (emit after commit) | S | I | events-timeline |
- csat | feat(widget): rating after resolve, shown in admin, disappointed reopens | M | I | - | one-click signed links in email
- overview | feat(admin): overview page: volume, first response, resolution, ratings per inbox/type/agent | M | I | - | SQL in store, CSV
- cmdk | feat(admin): command palette listing every action with its key | S | I | - |
- seen | feat(widget): "Seen" state via polling when agent focuses composer | S | I | - |
- realtime-adapter | feat(config): optional realtime adapter (publish/subscribe) with polling default | L | I | - |
- collapsible-panel-drafts | feat(admin): collapsible customer panel and per-conversation draft persistence | S | I | - |
- merge-conversations | feat(admin): merge two conversations (and contact merge preview) | M | I | - |
- code-blocks | fix(admin): render pasted code and captured JS errors as copyable code blocks | S | I | - |

## From Marketing (M)
- public-demo | examples(demo): deploy Harbor as a public demo with scheduled DB reset, "peek at the database" card | M | M | - | launch-blocking; Harbor is a host app, not a hosted mode
- readme-hero | docs(readme): lead with screenshots, 90s recording, five "inside not next to" proofs; real identify example | M | M | public-demo (soft) | launch
- events-hook | feat(config): events hook handled in-process (same as on-event-adapter) | M | M, I | - | marketing says hold launch for it; removes 5 table rows
- roadmap-nongoals | docs: ROADMAP.md with non-goals ("we will never" list) | S | M | - | launch
- comparison-table | docs(readme): comparison table vs Chatwoot, Libredesk, Intercom, Zendesk | S | M | - | launch
- inprocess-api-docs | docs(readme): document in-process API with two recipes (createConversation from webhook; track from billing) | S | M | - |
- adapter-examples | docs(examples): one worked adapter each: storage, email, AI, help search, jobs | M | M | - |
- presence (dup) | S per marketing |
- tags (dup) | M |
- snooze (dup) | M |
- sql-views-reports | feat(db): SQL views for first response, resolution time, volume per inbox + docs page | S | M | - | alternative/complement to admin overview page
- system-messages-history | feat(conversations): record status/assignee/priority changes as system messages | S | M | - | overlaps events-timeline (I) — cheaper variant
- (post-launch) full-page-conversations | feat(widget): full-page <HelpdeskConversations> component for an in-app Support page | M | M | - | customer portal story
- Non-goals (M): social channels, help-centre CMS, AI answering customers, rule builder, SLA engine with calendars, roles matrix, multi-brand, campaigns/surveys, own login, hosted mode, API tokens, mobile app, second process. CSAT: let a partner ask.

## From Zendesk (Z)
- tags (dup) | S per Z | autocomplete over 15 most-used tags of last 60 days; host can pre-set tags from widget context
- presence (dup) | M | plus "New reply from the customer · Show" banner instead of reflowing the thread when composer has text; j/k skip conversations someone else is viewing
- events-timeline (dup) | M | includes emails sent (recipient, result), reminders, AI suggestion applied/dismissed; before/after jsonb; "Activity" toggle on thread
- shortcuts-queue | feat(admin): shortcuts for note/reply, status; split Send button remembering last choice; "Work the queue" mode (next after send, n to skip, "3 of 12") | S | Z | presence (soft) |
- bulk-actions | feat(admin): select several conversations; assign/status/priority/tag/resolve/delete; cap 100; "18 updated, 2 skipped" | M | Z, L | tags (for Tag action) |
- business-hours (dup of office-hours) | M | Z | schedule + firstReplyTargetHours; dueAt stored; indicator uses dueAt; reminder job on dueAt; widget "back Monday 08:00"
- mentions-followers | feat(admin): @mention makes follower + email; Follow button; "Following" filter | M | Z | events-timeline (soft) | note: Zendesk couples mention with follow
- in-app-notifications | feat(admin): bell with list, document.title count, favicon dot, mute | M | Z | events-timeline, mentions |
- csat (dup) | M | Z | 👍/👎 + comment; email ask 24h after resolve via runJobs; widget asks immediately; rating chip in inbox
- merge-conversations (dup) | M | Z | warn when contacts differ; source resolved with mergedInto; email threading table updated; reference redirects
- (next) held-inbound-dkim | feat(inbound): a "held" list for inbound email that fails DKIM with accept/reject | S | Z |
- (next) bounce-line | feat(email): delivery-failure line under a message when the adapter reports a bounce | S | Z |
- (next) customer-resolve | feat(widget): customer-side "mark as resolved" | S | Z |
- (next) ai-draft-tools | feat(ai): draft tools shorten / formal tone / translate EN↔DE | S | Z |
- (next) canned-actions (dup of tags' canned actions) | S | Z |
- (next) sse-realtime (dup of realtime-adapter) | L | Z |
- expected (Z): unsaved-draft indicator; hard-close after N days that turns a late reply into a new conversation

## From Libredesk (L)
- tags (dup) | S–M | L | lowercase-unique; tag names in search tsvector
- reopen-on-reply | feat(service): reopen a resolved conversation when the customer replies; agent-new "reopened" email; Reopen action | S | L | - | trap: stale snoozed_until must not reopen resolved
- counts | feat(admin): open counts on Mine / Unassigned / All and per inbox | S | L | - |
- snooze (dup) | M | L | presets + date-time; status pending + snoozed_until; wake in runJobs; "Snoozed" filter
- bulk-actions (dup) | M | L | POST agent/conversations/bulk, up to 100, one transaction, partial-failure toast
- saved-views | feat(admin): save current filters as a view, personal or shared, with counts | M | L | counts, tags (soft) |
- shortcuts-dialog | feat(admin): e resolve, a assign-me, p priority, r/n reply/note, ? dialog | S | L | - | overlaps shortcuts-queue (Z) and cmdk (I)
- mentions (dup) | M | L | "Mentions" bucket with count; agent-mention mail kind
- on-event-adapter (dup) | S | L | discriminated union; after commit; errors logged
- overview (dup) | M | L | inline SVG bars, no chart dep; median/p90
- (next) triage-rules-config | feat(config): host-defined triage rules on new conversations (conditions → assign/priority/tag/title), no UI | L | L | - | marketing prefers the events hook instead
- (next) activity-lines (dup of system-messages-history) | S | L |
- (next) hide-ai-controls | fix(admin): hide AI suggestion/draft controls when no ai adapter | S | L |
- (next) ref-autolink | feat(admin): #ACME-1042 autolinks in notes | S | L |
- (next) host-links | feat(config): links(contact, company) for host deep links in the customer panel | S | L |
- Libredesk's top open request: merge conversations (#177 +11); customers seeing past tickets (we have it).

## From Chatwoot (C)
- tags (dup, "labels") | M | C | label table with en/de name + colour; CRUD in settings; side-panel picker; chips; filter
- unread-state | feat(admin): unread conversations (agentSeenAt team-wide), bold row + dot, counts per tab, mark read/unread, sort unread first | M | C | - | Chatwoot reverted per-label counts for perf; keep counts to Mine/Unassigned/All
- reopen-on-reply + snooze (dup; C bundles them) | M | C | status `snoozed` vs Libredesk's pending+snoozed_until; "Resolve ▾" split: Mark as pending / Snooze until next reply / tomorrow / next week / pick time; widget maps snoozed → "With our team"
- events-timeline (dup) | M | C | inline grey one-liners; includes email delivery outcomes
- mentions + participating | feat(admin): @mentions + Mentions and Participating views; auto-participation on reply/note/mention; "Join conversation" | M | C | - |
- in-app-notifications (dup) | L | C | notification table polled on the 10s cycle; bell; per-agent email prefs per kind
- cmdk + shortcuts (dup) | S | C | ⌘K palette; e resolve; ⌘⇧e resolve and next; p/r note/reply; s snooze; [ toggle side panel; ? sheet
- on-event-adapter (dup) | S | C | includes message.created with internal flag, contact.created, deal.stage_changed
- business-hours (dup) | M | C | widget header "We're online / We're away — back Monday 08:00"; receipt states next opening; agent-side "Outside hours" chip
- auto-assign-round-robin | feat(service): round-robin among present agents (awayUntil unset, lastSeenAt recent) per inbox; "Assign to me" banner when thread not yours | M | C | - | Intercom verdict: expected (round-robin or assign-to-me); marketing says rules live in the events hook
- (next) saved-views (dup) | M | C |
- (next) csat (dup) | M | C |
- (next) custom-conversation-attributes with "required on resolve" | M | C |
- (next) bulk-actions (dup) | M | C |
- (next) realtime-adapter (dup) | L | C |
- (next) admin-dark-mode | ? | C | note: dark already follows host tokens; check what is missing

## Convergence count (how many of Z/I/C/L/M name it)
- tags: 5/5 (Z I C L M) — table-stakes everywhere
- snooze: 5/5
- presence/collision: 4 (Z I M, L next-tier; C via auto-assign banner)
- events timeline / activity lines: 5 (Z I C, L next-tier, M as system messages)
- events hook (onEvent): 5 (Z next, I, C, L, M)
- mentions: 4 (Z I C L)
- business hours / office hours: 4 (Z I C, L next-tier)
- bulk actions: 3 (Z L, C next)
- overview/reports: 4 (I L, M as SQL views, C next via CSAT report)
- CSAT: 3 (Z I, C/L next; M says let a partner ask)
- shortcuts / palette: 4 (Z I C L)
- counts per tab: 2 (L, C) + unread (C)
- reopen on reply: 2 (L, C) — a correctness gap, cheap
- saved views: 3 (L, C next, I expected)
- merge conversations: 3 (Z I, L next; L's top open request)
- in-app notifications: 2 (Z, C)
- auto-assign: 1 (C) + I expected
- realtime adapter: 3 next-tier (I, Z, C)
- widget team/reply-time card: 1 (I) + business-hours widget state (C)
- launch docs/demo items: M only (expected; other agents were not asked)

## From Sales (S)
- inbound-recipes | docs(relays): Google Workspace, Microsoft 365 and Postmark inbound recipes with dual-delivery cutover and time estimates | S–M | S | - | #1 first-30-minutes stop; Postmark relay as a second file in relays/
- worked-adapters (dup of adapter-examples, M) | docs(readme): identify() for Better Auth and NextAuth, Resend email adapter, S3 storage adapter; "scripting it" sentence; three reporting SQL queries | S | S, M | - |
- demo-seed | feat(examples): seed Harbor with conversations, resolveContext (plan, usage) for Brightline, a "Try the broken button" that throws so a bug report carries a JS error; psql lines in README | S | S | - | makes differentiators visible; pairs with public-demo (M)
- events-hook (dup) | M | S | #3 goodwill loss
- csv-import | feat(bin): better-helpdesk-import for contacts, companies, canned replies from CSV (idempotent on email/domain); second PR: Chatwoot DB import only if a partner needs it | M | S | - |
- presence (dup) | S | S | "Lea has this open" + warning on the reply box
- tags (dup) | M | S |
- mentions (dup) | M | S | fifth HelpdeskEmail kind agent-mention
- business-hours (dup) | S | S | minimal: waiting indicator and reminders inside hours only
- overview (dup) | M | S |
- bulk-actions (dup) | M | S |
- csat (dup) | M | S |
- spam-public-inbox | (gap named, no item) public inboxes get form-bot spam; honeypot `website` exists; consider a "mark as spam" + sender block | ? | S | - |
- parallel-run-docs | docs: a parallel-run migration paragraph (old tool read-only 60–90 days) | S | S | - |
- Hold the line (S): no live chat/typing; no help-centre authoring; no roles beyond isAgent; no SLA policies; no social channels; no hosted relay; no API tokens; no gating.

## From UX review (U) — Preserve mode; dials admin V3/M3/D6, widget V2/M3/D4; reference feel: Linear's issue view in the host's colours
- ux-split-layout | feat(admin): split the inbox into list and thread when the container is wide enough (container queries; 380px list pane ≥1180px; j/k guard for contenteditable; Escape focuses list) | L | U | ux-skeletons (soft) | fixes 40 blank flashes/day and lost j/k cursor
- ux-tokens-radii | fix(admin): derive every radius and shadow from the host's tokens (token−2/−4/+4; color-mix shadows; note surface derived) | S | U | - |
- ux-collapsible-aside | feat(admin): collapsible details sidebar with remembered state (localStorage, aria-expanded) | M | U | ux-split-layout (soft) | overlaps I's collapsible-panel-drafts
- ux-properties-card | feat(admin): status/priority/type/inbox/assignee as a Properties card in the aside (above thread under 900px) | M | U | ux-collapsible-aside | riskiest assumption; test with a partner agent first
- ux-skeletons | feat(admin): skeleton loading shaped like the inbox and the conversation | S | U | - |
- ux-empty-states | feat(admin): empty states that say how to fill the screen, with Clear filters; distinguishes empty vs filtered | S | U | - | 7 i18n keys
- ux-pressed-error-states | fix(admin): pressed states, tinted composer tray, "Sending…" label, error retry notice, tr:focus-within | S | U | ux-tokens-radii (soft) |
- ux-composer-order | feat(admin): reply/note switch first, actions in one row, hint nowrap, AwayControl moves to the rail | S | U | - |
- ux-widget-accent | fix(widget): accent (not focus colour) for highlights, readable meta (contrast), pressed tiles, panel height fits view, 44px targets under 480px, reduced motion | M | U | - |
- ux-widget-form-fold | fix(widget): keep context review and privacy line in sight on the first form; demo gets privacyUrl; shorter confirm copy | S | U | - |
- (follow-up) ux-waiting-count-nav | feat(admin): waiting count on the Inbox tab (agent/me returns count) | S | U | - | overlaps counts (L, C)
- (follow-up) optimistic thread render from list row | S | U | ux-split-layout |
- Left out by UX (by design): ⌘K palette (not needed with 6 sections), collision (product, not design), snooze (product), AI summary, custom font/icons/Tailwind.
