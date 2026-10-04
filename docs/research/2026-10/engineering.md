# Engineering: which gaps fit the library, how to build each, in what order

Head of Engineering, 2 October 2026. Read against the code as of commit
`4571983`. Sizes are scope and blast radius (S: one layer, one PR a reviewer
reads in one sitting; M: schema + service + UI + test; L: touches routing or
several screens), never calendar time. Every build item includes the
integration test through `createHarness` and the `en` + `de` strings.

What the code already gives us, which several reports missed:

- `store.appendMessage` already reopens a resolved conversation on a customer
  message (status `open`, `resolvedAt` cleared, `waitingSince` set) and the
  test "reopens a resolved conversation when the customer writes again" covers
  it. What is missing is only the *email* to agents.
- `agent` rows carry `lastSeenAt` (upserted on every agent request) and
  `awayUntil`; `widget/session` already returns `team` (three recent agents
  with avatars) and `awayUntil`; the widget already renders the avatars.
- The conversation view polls `agent/conversations/:id` every 5 s, the inbox
  polls every 10 s, both through `useResource`. Those two polls are the only
  transport we need for presence, unread and counts.
- `agentView` spreads the whole conversation row to the admin, so a new column
  reaches the list and the detail with no payload work. `customerView` is an
  allowlist, so anything the widget must see is added by hand.
- `aiSuggestion`, the draft button and the triage route are already gated on
  `config.ai` / `me.ai` (`conversation.tsx:473`, `http.ts:666`).
- `track()`, `deleteContact()`, `deleteCompany()` and `store` are exported on
  `buildHelpdesk()`: the in-process API the docs items ask for exists.

## 1. Verdict per candidate

### on-event-adapter (= events-hook)
- verdict: **build**, wave 1. The seam every other "automation" request
  (triage rules, round-robin, Slack, Linear, PostHog) resolves to.
- lazy shape: `src/events.ts` exports the union `HelpdeskEvent =
  | { kind: 'conversation.created'; conversation; message }
  | { kind: 'message.created'; conversation; message; internal: boolean }
  | { kind: 'conversation.updated'; conversation; before: Partial<Conversation>; agentId: string | null }`
  and one function `emit(config, event)` that does
  `try { await config.onEvent?.(event) } catch (e) { console.error('[helpdesk] onEvent failed', e) }`.
  Config: `onEvent?(event: HelpdeskEvent): Promise<void>` on `HelpdeskConfig`,
  no new table, no route. Call sites: `createConversation` and
  `handleInbound` (after `store.createConversation` returns, which is after
  its transaction committed), `addCustomerMessage`, `addAgentMessage`,
  and the agent `PATCH conversations/:id` and `suggestion` accept routes
  (`before` is the row the route already loaded via `requireConversation`;
  diff it against the patch keys). README: a 15-line Slack `fetch` example
  and a round-robin example that calls `helpdesk.store.updateConversation`.
- trust / data loss: the adapter is awaited inside the request, so a slow host
  handler slows the reply; document "keep it fast or enqueue". Never throw
  past the catch: a broken Slack hook must not turn replies into 500s. Do not
  emit from inside a store transaction (the host would see uncommitted data).
- size: S.
- depends on: nothing. Better with `events-timeline`, which persists a subset
  of the same union.
- ponytail: no retries, no delivery log; upgrade path is the host enqueuing
  into its own queue, or a later `store.enqueueJob('emit', …)` mode.

### reopen-on-reply
- verdict: **build**, wave 1, as "email agents when a customer reopens a
  resolved conversation". The reopen itself already exists.
- lazy shape: `addCustomerMessage` and the threaded branch of `handleInbound`
  both hold `conversation` from before the append; add
  `if (conversation.status === 'resolved') await store.enqueueJob('notify-agents', { conversationId, reopened: true })`
  once, in a tiny `afterCustomerMessage(conversation)` both call. The
  `notify-agents` handler reads `payload.reopened` and sets a new optional
  `reopened?: boolean` on the `agent-new` kind (no fifth kind). No Reopen
  button: the status select already offers `open`. Test: resolve, customer
  writes, `runDueJobs()`, assert one `agent-new` with `reopened: true` in
  `h.emails`.
- trust: the resolved check must read the pre-append row, not re-fetch after
  `appendMessage` (which already flipped it to `open`).
- size: S. depends on: nothing.

### snooze
- verdict: **build**, wave 2.
- lazy shape: `snoozedUntil` column on `conversation` (`ts('snoozed_until')`)
  plus a partial index `WHERE snoozed_until IS NOT NULL`; status stays
  `pending` (see §2b). `PATCH agent/conversations/:id` accepts
  `snoozedUntil: z.iso.datetime({ offset: true }).nullable().optional()`;
  a non-null value also sets `status: 'pending'`. `runJobs()` gets a `wake`
  step before `reminders`: `UPDATE helpdesk.conversation SET status='open', snoozed_until=NULL WHERE status='pending' AND snoozed_until <= now() RETURNING id`
  (one `store.wakeSnoozed()`). `appendMessage` adds `snoozedUntil: null` to
  the contact-message patch (customer reply wakes it). `claimReminders` adds
  `AND snoozed_until IS NULL`. Resolving sets `snoozedUntil: null`. Admin:
  a `Snooze` button beside the status select with four `<button>`s
  (later today 18:00, tomorrow 09:00, next Monday 09:00) and a native
  `<input type="datetime-local">`, computed in the agent's browser time zone
  (no server time zone needed), key `z`. Inbox: `status=snoozed` filter value
  mapped in `listInbox` to `status='pending' AND snoozed_until IS NOT NULL`;
  the row's waiting cell shows "until {date}" when snoozed.
- trust / data loss: the wake query is guarded by `status = 'pending'`, so a
  stale `snoozedUntil` on a resolved conversation never reopens it (the
  Libredesk v2.2.1 bug); test exactly that. Resolve and the customer reply
  both null the column, so no stale value survives.
- size: M. depends on: nothing. Better with `events-timeline` (a `snoozed`
  line) and `shortcuts`.
- ponytail: woken conversations sort after every waiting one
  (`waiting_since ASC NULLS LAST`); for a 1–10 person inbox that is visible
  enough. Upgrade: set `waitingSince = coalesce(waitingSince, now())` on wake
  if partners lose them.

### tags
- verdict: **build**, wave 2.
- lazy shape: `tags: text('tags').array().notNull().default(sql\`'{}'\`)` on
  `conversation`, mirroring `contact.tags`, with
  `index('conversation_tags_idx').using('gin', t.tags)`. The PATCH route
  reuses the existing `tags` zod (`http.ts:767`) with
  `.transform(t => [...new Set(t.map(s => s.toLowerCase()))])`. Filter:
  `tag` search param → `sql\`${tag} = ANY(${conversations.tags})\`` in
  `listInbox`. Autocomplete without code: `GET agent/tags` returns
  `SELECT unnest(tags) AS tag, count(*) FROM helpdesk.conversation GROUP BY 1 ORDER BY 2 DESC LIMIT 15`
  and the composer uses a native `<datalist>`. Editor: the comma-separated
  input `crm.tsx:788` already does tags for contacts; same control under the
  title. Chips on rows via `agentView` (already spreads the column). No tag
  table, no colours, no settings CRUD (Chatwoot's label table is YAGNI with
  free text + lowercase).
- trust: cap 50 tags × 50 chars (already in the zod).
- size: S–M (M only because of inbox filter + chips + test). depends on: nothing.
- ponytail: no rename/merge of tags; upgrade is one `UPDATE … array_replace`.

### events-timeline (+ system-messages-history, activity-lines)
- verdict: **build**, wave 2, as one item. Shape: a `conversation_event`
  table, not system messages (see §2a).
- lazy shape: table `conversation_event` (`id`, `conversationId` FK cascade,
  `agentId` FK set null, `kind text`, `data jsonb`, `createdAt`), index
  `(conversation_id, created_at)`. `store.recordEvent()`; `emit()` from
  `on-event-adapter` gains a second line that persists `conversation.updated`
  diffs as one row per changed key (`status`, `priority`, `assigneeId`,
  `type`, `inbox`, `title`, `tags`, `snoozedUntil`), plus `reopened` from
  `afterCustomerMessage`, `suggestion.accepted|dismissed`, `participant.added`,
  and `email.sent` from the job handlers (recipient + kind). The detail route
  adds `events: await store.listEvents(id)`; the thread interleaves them by
  `createdAt` as one grey line rendered through i18n
  (`event.status`: "{name} set status to {to}"), German included. No widget
  subset (YAGNI).
- trust / data loss: cascade delete with the conversation, so retention
  removes them; nothing else to clean. `agentId` set null keeps the line when
  an agent row is deleted.
- size: M. depends on: `on-event-adapter` (vocabulary and the single `emit`).
- ponytail: before/after only for the diffed keys; no account-level audit log.

### counts (+ ux-waiting-count-nav)
- verdict: **build**, wave 2, together with `unread-state` as one PR
  "inbox attention".
- lazy shape: `GET agent/conversations` returns `counts: { all, mine, unassigned }`
  from one aggregate
  `SELECT count(*) AS all, count(*) FILTER (WHERE assignee_id = $me) AS mine, count(*) FILTER (WHERE assignee_id IS NULL) AS unassigned FROM helpdesk.conversation WHERE status = 'open'`
  (not `rows.length`: the list is capped at 200). Pills on the three
  segment buttons. The existing `agent/unread` keeps serving the widget.
- size: S. depends on: nothing.

### unread-state
- verdict: **build**, wave 2, in the same PR as `counts`.
- lazy shape: `agentSeenAt` column on `conversation`, written by the detail
  GET (`updateConversation(id, { agentSeenAt: dbNow() })`, team-wide, like
  Chatwoot's `agent_last_seen_at`). Unread = `waitingSince && (!agentSeenAt || agentSeenAt < lastMessageAt)`,
  computed in the row (both fields already arrive via `agentView`); bold
  title + dot. No mark-unread menu, no unread counts per label (Chatwoot
  reverted those).
- trust: a GET writing one timestamp is the same precedent as `touchAgent`;
  keep it out of `HELPDESK_CHANGED` (it is a GET, so it already is).
- size: S. depends on: nothing. Better with `seen`.

### presence
- verdict: **build**, wave 3.
- lazy shape: two columns on `agent`: `viewingId uuid` (FK conversation, set
  null) and `viewingAt timestamptz`. The detail GET that already polls every
  5 s does `UPDATE agent SET viewing_id=$c, viewing_at=now() WHERE id=$me`
  and returns `viewers: SELECT name, avatar_url FROM agent WHERE viewing_id=$c AND viewing_at > now() - interval '15 seconds' AND id <> $me`.
  The inbox list adds the same subquery as `viewers text[]` per row for the
  avatar stack. Header line "{name} is viewing". No presence table, no
  pruning job (the 15 s window prunes), no heartbeat route, no "is typing",
  no setting to turn it off.
- trust: nothing cross-tenant (one host, one team). Make sure
  `touchAgent`'s upsert `set` does not clobber the two columns (it only sets
  name/email/avatar/lastSeenAt today; keep it that way).
- size: S–M. depends on: nothing. Better with `shortcuts` (j/k skip rows
  someone else holds).
- ponytail: one viewing slot per agent; a second tab overwrites the first.
  Upgrade: a `presence` table keyed `(agent_id, tab_id)`.

### business-hours (= office-hours; absorbs widget-home-team's back-at line)
- verdict: **build**, wave 3, the minimal sales-report version.
- lazy shape: `hours?: { timeZone: string; weekly: Partial<Record<'mon'|…|'sun', [string, string][]>> }`
  on `InboxConfig`, plus `src/ui/hours.ts` (shared by server and both UIs,
  no Node imports) with `openHoursBetween(from, to, hours)` and
  `nextOpening(at, hours)` built on
  `Intl.DateTimeFormat(…, { timeZone }).formatToParts` (DST handled by Intl,
  no dependency). The default when unset is Mon–Fri all day, which is what
  `nextWorkday` hard-codes today, so `nextWorkday` is replaced by
  `nextOpening` and the receipt's `backOn` and the widget's away line keep
  their behaviour. Reminders: `claimReminders` becomes select candidates in
  SQL (`waiting_since IS NOT NULL AND status <> 'resolved' AND (reminded_at IS NULL OR reminded_at < waiting_since)`),
  filter in JS by `openHoursBetween(waitingSince, now) >= reminderAfterHours`,
  then the same guarded `UPDATE … RETURNING` for those ids (the guard keeps
  concurrent runners from double-sending). Indicator: `agent/me` returns
  `inboxHours`; the inbox row computes `openHoursBetween` instead of wall
  hours for the amber/red thresholds. Widget: `widget/session` returns
  `open: boolean, nextOpening: string | null`; header line "Back Monday
  08:00" when closed; the away date per agent and the schedule combine as
  `max(nextOpening(awayUntil), nextOpening(now))`. No `dueAt` column, no
  `firstReplyTargetHours` (`reminderAfterHours` is the target), no holidays,
  no settings UI (it is config, like everything per inbox).
- trust: the reminder guard stays in SQL, never in JS.
- size: M. depends on: nothing. Better with `snooze` (presets could use the
  inbox time zone; not needed).
- ponytail: `openHoursBetween` walks day by day from `from` to `to`; a
  conversation waiting a year costs 365 iterations, fine. No holidays;
  upgrade is a `holidays: string[]` list consulted in the same loop.

### bulk-actions
- verdict: **build**, wave 3.
- lazy shape: extract the body-to-patch logic of `PATCH conversations/:id`
  (status → `resolvedAt`/`waitingSince`, company → `sharedWithCompany`) into
  `conversationPatch(before, data)`; add
  `POST agent/conversations/bulk` with `{ ids: uuid[] (max 100), ...sameBody }`,
  applied per row inside one `db.transaction` (per row, because the status
  transition depends on each row's current status), one `emit` per row.
  All-or-nothing; no "18 updated, 2 skipped" (YAGNI for ten agents).
  Admin: a checkbox column (`<input type="checkbox">`, shift-click range is
  ten lines), a toolbar with assignee/status/priority/tag selects reusing
  `Select`. No bulk delete (no conversation delete route exists today).
- trust: the same-origin check in `checkMutation` covers it (JSON POST from
  `adminUrl`'s origin). Cap and validate every id as uuid.
- size: M. depends on: `tags` for the tag action (ship without it otherwise).

### shortcuts (= shortcuts-queue + shortcuts-dialog + cmdk)
- verdict: **build** the keys, wave 3; **skip** the ⌘K palette (six
  sections; the UX review reached the same verdict); **build-later** "work
  the queue" once `ux-split-layout` has the list beside the thread.
- lazy shape: one `useShortcuts(map)` hook in `admin/ui.tsx` reusing the
  guard from `inbox.tsx:274` plus `target.isContentEditable`; `e` resolve,
  `a` assign to me, `r`/`n` reply/note, `z` snooze, `?` opens the existing
  `Dialog` with a `<kbd>` list. Platform-aware ⌘/Ctrl is already handled
  in the composer.
- size: S. depends on: nothing (`z` lands with snooze).

### overview
- verdict: **build-later**, wave 4, after the reporting queries are
  documented and CSAT exists.
- lazy shape: one `Overview` section with a 7/30/90-day select; four numbers
  (new, resolved, median first response, median resolution) and a table by
  inbox and by agent, all from `store.overview(sinceDays)` as plain SQL
  (`percentile_cont(0.5)` over `first agent message - created_at` and
  `resolved_at - created_at`), rendered as `<table>`; no chart, no CSV.
- size: M. depends on: nothing. Better with `tags`, `csat`, `business-hours`.

### sql-views-reports
- verdict: **fold-into:worked-adapters** as documented queries; **skip** the
  views. A view pins columns: the next column rename or type change on
  `conversation` fails until the view is dropped, which is a maintenance
  tail every future migration pays. Three queries in the README cost nothing.
- size: S.

### csat
- verdict: **build-later**, wave 4 (marketing: let a partner ask; the first
  review will).
- lazy shape: `rating text` (`good|bad`), `ratingComment text`, `ratedAt` on
  `conversation`; `POST widget/conversations/:id/rating` (author only, via
  `requireVisible` + `contactId` check, once); the widget thread shows two
  buttons once `status === 'resolved'` and no rating; `customerView` adds
  `rating`; admin shows a chip. A `bad` rating sets `status='open',
  waitingSince=now()` and records an event. Email one-click links are a
  second PR: a signed `GET {basePath}/rate?…` is a new HTML surface.
- trust: once per conversation (`WHERE rating IS NULL`), author only.
- size: M. depends on: nothing. Better with `events-timeline`.

### mentions (+ mentions-followers, mentions+participating)
- verdict: **build-later**, wave 4.
- lazy shape: `POST conversations/:id/messages` gains `notify?: uuid[]`
  (agent ids, max 20). The composer's `/` picker pattern
  (`conversation.tsx:163`) is extended to `@`: it inserts `@Name` as text and
  keeps the id in state. Server: a fifth `HelpdeskEmail` kind `agent-mention`
  (`to, locale, reference, subject, body, url, authorName`), one per id,
  sent through the existing `notify-*` job path; an event `mentioned`. No
  `mention` table, no followers, no "Mentions" filter (the email is the
  inbox at this team size).
- size: M. depends on: nothing. Better with `events-timeline`.
- ponytail: text mentions, no chips; upgrade is a `mention` node in the rich
  format.

### merge-conversations
- verdict: **build-later**, wave 4. Libredesk's top open request, and the AI
  duplicate suggestion already points at the target.
- lazy shape: `mergedIntoId uuid` (FK set null) on `conversation`;
  `POST agent/conversations/:id/merge { targetId }` in one transaction:
  `UPDATE message SET conversation_id=$t WHERE conversation_id=$s`, same for
  `attachment`, `INSERT participant … ON CONFLICT DO NOTHING` (source contact
  becomes a participant of the target, so `canCustomerSee` still holds),
  source set `status='resolved', resolvedAt=now(), mergedIntoId=$t`, one
  event on each side. Email threading needs no work: `findMessageByEmailId`
  follows the moved message's `conversationId`. Plus-address replies:
  `handleInbound` follows `mergedIntoId` once after `getConversationByNumber`.
  Admin: "Merge into…" with reference search, confirm warning when contacts
  differ; the source page shows a banner linking to the target.
- trust / data loss: irreversible; refuse when `target.mergedIntoId` is set,
  when source = target, when either is already merged, and across inboxes
  with different `replyToAddress` semantics is not a thing here (one
  address function), so allow. Retention later deletes the resolved source,
  which ends the redirect; messages already live on the target.
- size: M. depends on: nothing. Better with `events-timeline`.

### in-app-notifications
- verdict: **skip** for now (YAGNI at 1–10 agents: email, counts and unread
  rows cover it). Revisit after `mentions`.

### auto-assign-round-robin
- verdict: **skip**: a README recipe on `on-event-adapter`
  (`conversation.created` → `helpdesk.store.updateConversation(id, { assigneeId })`
  over `store.listAgents()` filtered by `awayUntil`). "Assign to me" is the
  `a` shortcut.

### widget-home-team
- verdict: **fold-into:business-hours**. Avatars and `awayUntil` already
  render; what is missing is the "back at" line from a schedule.

### seen
- verdict: **build-later**, S, after `unread-state`: `customerView` adds
  `agentSeenAt`; the widget shows "Seen" under the customer's last message
  when `agentSeenAt > createdAt`.

### realtime-adapter (= sse-realtime)
- verdict: **skip** until a second transport exists (see §2h). Polling at
  5 s / 10 s is the design; one interface with one implementation is a
  layer nobody uses.

### collapsible-panel-drafts
- verdict: split. Panel → **fold-into:ux-collapsible-aside**. Drafts →
  **build**, wave 2, S: `sessionStorage['helpdesk.draft.'+id]` in try/catch,
  written on change, cleared on send (the view remounts on `key={id}` and
  loses `body` today).

### code-blocks
- verdict: **build**, wave 2, S. The rich format (`src/ui/rich.tsx`) has
  `p`/`ul`/`ol` blocks; add a fenced `pre` block (parser, renderer with a
  copy button, editor paste of multi-line monospace text). Captured
  `context.errors` already render in `<pre>` (`conversation.tsx:711`); give
  it the same copy button.

### held-inbound-dkim
- verdict: **skip**. Unverified mail already never threads into an existing
  conversation and lands as a new one from an unverified contact; that is
  the safe default. A held list is a second inbox nobody asked for.

### bounce-line
- verdict: **skip**. Bounces arrive at the host's provider webhook; the
  library sees `send()` resolve. If a partner asks: `recordEvent(kind:
  'email.bounced')` exposed as `helpdesk.store.recordEvent` for the host to
  call. S then.

### customer-resolve
- verdict: **build**, wave 2, S. `PATCH widget/conversations/:id` already
  exists for sharing; extend its zod with `status: z.literal('resolved')`
  (author only, same 403 branch), set `resolvedAt`/`waitingSince` as the
  agent route does, emit `conversation.updated` with `agentId: null`.
  Widget: one button in the thread footer.

### ai-draft-tools
- verdict: **build-later**, S. `POST conversations/:id/draft` gains
  `{ mode?: 'shorten'|'formal'|'translate', text?: string }` and reuses
  `ai.generate` with a second system prompt. Low priority.

### canned-actions
- verdict: **skip** for now. "Send and resolve" exists; tags via canned
  replies is a second way to set tags.

### triage-rules-config
- verdict: **skip**: a rules DSL in config with no UI is `on-event-adapter`
  with a worse interface. Recipe in the README instead.

### hide-ai-controls
- verdict: **skip**: already the case (`me.ai &&` guards the draft button;
  suggestions only exist when `config.ai` enqueued `ai-triage`). Close the
  item with a pointer to the lines.

### ref-autolink
- verdict: **build-later**, S: in `RichText`, `\b[A-Z]{2,}-\d{4,}\b` →
  `href({ q: ref })` (the inbox search already resolves a reference number),
  no lookup.

### host-links
- verdict: **build-later**, S, when a partner asks: `links?(contact, company): { label: Record<Locale,string>; url: string }[]`
  on config, returned in the detail route, rendered in the contact card.

### spam-public-inbox
- verdict: **build-later**. Today: honeypot + per-IP hourly limit +
  `deleteContact` (hard-deletes the person and their conversations) is the
  spam button. If it shows up: `blocked_email` would be a column on
  `contact` plus a 404 in `createConversation`, S.

### csv-import
- verdict: **build-later**, M, when a partner migrates. `bin/import.mjs`
  for contacts and companies only; a 25-line RFC 4180 reader (no dependency);
  idempotent on `findContactByIdentity('email')` / `companies.domain`;
  canned replies as a second file. Chatwoot DB import only on request.

### inbound-recipes / worked-adapters (= adapter-examples) / inprocess-api-docs / roadmap-nongoals / comparison-table / readme-hero / parallel-run-docs
- verdict: **build** the docs, wave 1, each S, no code except
  `relays/postmark.ts` as a second relay. Engineering notes for the writers:
  the in-process API is `helpdesk.createConversation(request, body)` (needs a
  `Request` for identity; document a server-side `Request` with the host's
  session header), `helpdesk.track()`, `helpdesk.store.*`. The README route
  snippet and the demo route export no `PUT`, so `PUT agent/settings`
  returns 405 in every host that follows the README: fix both in the first
  docs PR.

### demo-seed
- verdict: **build**, wave 1, S. `examples/demo/scripts/seed.ts` using
  `helpdesk.store.createContact/createConversation/appendMessage` (invented
  people on `.test` domains); a "Try the broken button" that throws on the
  demo page so a bug report carries `context.errors`; `resolveContext` in
  `examples/demo/lib/helpdesk.ts` returning plan and usage for `demo-org`.

### public-demo
- verdict: **build-later**, M, marketing-owned; engineering shape: deploy
  Harbor with `DEMO_UNSAFE_AUTH=1` and `DEMO_URL` set to the public origin
  (or every mutation is a 403), a `POST /reset` route guarded by a secret
  that truncates `helpdesk.*` and re-seeds, called by the platform's cron.
  No hosted mode: it is a host app with a cookie for a login.

### full-page-conversations
- verdict: **build-later**, M. Export the widget's list + thread views as
  `<HelpdeskConversations>` without launcher and shadow root; the API client
  and `widget/*` routes are unchanged.

### ux-tokens-radii / ux-skeletons / ux-empty-states
- verdict: **build**, wave 1, S each. Pure `styles.ts` / `ui.tsx` work;
  `ux-empty-states` adds seven keys (`de` typed, so `tsc` enforces them).
  `ux-skeletons` fixes the `useResource` blank on key change
  (`setData(null)`), which the split layout will otherwise make more
  visible.

### ux-pressed-error-states / ux-composer-order / ux-widget-form-fold
- verdict: **build**, wave 3, S each. `ux-composer-order` moves
  `AwayControl` out of the inbox toolbar into the rail.

### ux-widget-accent
- verdict: **build**, wave 3, M (contrast, 44 px targets, reduced motion,
  panel height). Test with the demo on both themes.

### ux-collapsible-aside
- verdict: **build**, wave 3, M. `localStorage['helpdesk.aside']` in
  try/catch, `aria-expanded`, `.sa-split` collapses to one column.

### ux-properties-card
- verdict: **build**, wave 3, M, right after the aside (it needs the aside
  for a home). Keep the PATCH calls byte-identical.

### ux-split-layout
- verdict: **build**, wave 4, L. Last of the UX items (see §2i).

### admin-dark-mode
- verdict: **skip**: dark follows host tokens already; `ux-tokens-radii`
  covers the derived surfaces.

### custom-conversation-attributes
- verdict: **skip** for now: `tags` and `context.host` cover the two
  partner cases we know; "required on resolve" is a rule engine.

## 2. Merges and splits

- (a) **Timeline shape**: one `conversation_event` table, not system
  messages. `authorType: 'system'` is typed but nothing writes it, and an
  audit line is structured data that must render in two languages, which
  means jsonb, not a text body. Rows in `message` would also pollute the
  generated `search` tsvector, stretch `internal` to mean "not a message",
  and ride every `listMessages` call. Keep `'system'` for a future
  customer-visible notice (a merge). `system-messages-history` and
  `activity-lines` are the same issue as `events-timeline`.
- (b) **Snooze** is `pending` + `snoozedUntil`. `STATUSES` is `as const`
  and feeds `z.enum`, the i18n keys, the inbox status filter,
  `countWaiting`, `claimReminders`, retention and `customerView` (which
  derives the customer's status from `waitingSince`, so the widget needs
  no change at all). A fourth status touches every one of those.
- (c) **Tags** are `text[]` like contacts: same zod, same editor, one GIN
  index, autocomplete from `unnest`. A join table buys referential tags
  nobody manages.
- (d) **Adapter before timeline.** The adapter is S, launch-relevant, and
  defines the vocabulary; the timeline persists a subset through the same
  `emit()`. Doing it the other way round means renaming event kinds later.
- (e) **One poll each, no new endpoint.** `counts` and `unread` ride the
  inbox's 10 s `GET agent/conversations`; `presence` writes on the detail's
  5 s GET and reads on both. Writing on a GET is deliberate: a POST would
  fire `HELPDESK_CHANGED` and refetch the inbox every 5 s.
- (f) **Queries in the README first, overview page later.** The page is one
  `store.overview()` over the same SQL once the numbers have been read by a
  partner; views are a migration tail.
- (g) **One clock.** The database decides what is due (`now()` in
  `claimReminders`, `enqueueJob`); the JS helper only converts a span into
  open hours. `reminderAfterHours` keeps its meaning ("open hours waited"),
  `waitingSince` keeps its meaning (set in SQL), the agent's `awayUntil`
  keeps its meaning, and `nextOpening()` replaces `nextWorkday()` as the one
  function that answers "when is someone back", for the receipt, the widget
  and the reminder alike. No `dueAt` column: it would be a second clock
  that drifts when the schedule changes.
- (h) **No realtime interface now.** One implementation (polling) does not
  earn an interface. When a host brings SSE or Pusher, the seam is
  `useResource`'s `refresh`: a `subscribe(channel, refresh)` prop on the
  two UIs and a `publish()` call next to `emit()`. Nothing else in the code
  needs to know.
- (i) **Aside, then properties, then split.** The aside is M on media
  queries alone and the properties card needs it; both change only
  `conversation.tsx`. The split (L) rewrites `index.tsx`, `inbox.tsx` and
  the j/k hook, and at 1180 px only works with the aside collapsible.
  Landing the two smaller PRs first keeps the L PR about layout.
- Merged issues: `counts` + `unread-state` + `ux-waiting-count-nav` →
  "inbox attention". `office-hours` + `business-hours` +
  `widget-home-team` → "business hours". `shortcuts-queue` +
  `shortcuts-dialog` + `cmdk` → "shortcuts" (palette dropped).
  `events-timeline` + `system-messages-history` + `activity-lines` →
  "timeline". `on-event-adapter` + `events-hook` → "onEvent".
  `adapter-examples` + `worked-adapters` + `sql-views-reports` (as
  queries) → "worked adapters and reporting queries".
- Split issues: `csat` → widget rating (M) and email one-click links (S,
  later). `collapsible-panel-drafts` → aside (UX) and drafts (S).
  `mentions` → notify-by-id (M) and chip rendering (later).

## 3. Build order

**Wave 1, launch surface and correctness; no schema change.**
`on-event-adapter` · `reopen-on-reply` (email) · README/demo `PUT` export
fix · docs: `inprocess-api-docs`, `worked-adapters` with the three reporting
queries, `inbound-recipes` + `relays/postmark.ts`, `roadmap-nongoals`,
`comparison-table`, `parallel-run-docs` · `demo-seed` · `ux-tokens-radii` ·
`ux-skeletons` · `ux-empty-states` · close `hide-ai-controls`.
Reason: the partners deploy against this; every item is S, independent, and
none of them opens a migration.

**Wave 2, the three columns and one table everything else leans on.**
`tags` · `snooze` · `events-timeline` · `counts` + `unread-state` ·
`customer-resolve` · drafts (sessionStorage) · `code-blocks`.
Reason: four migrations (`tags`, `snoozed_until`, `agent_seen_at`,
`conversation_event`), each its own PR with `pnpm db:generate`; the
timeline needs the wave-1 `emit()`; `snooze` and `tags` have 5/5
convergence and are the first things an agent reaches for.

**Wave 3, working the queue.**
`presence` · `business-hours` · `bulk-actions` · `shortcuts` ·
`ux-collapsible-aside` → `ux-properties-card` · `ux-pressed-error-states` ·
`ux-composer-order` · `ux-widget-accent` · `ux-widget-form-fold`.
Reason: all build on wave 2 data (bulk tags, `z`, snooze lines in the
thread); the two aside PRs reshape `conversation.tsx` before the split
rewrites the page.

**Wave 4, bigger surfaces, each on partner pull.**
`ux-split-layout` · `merge-conversations` · `mentions` · `csat` ·
`overview` · "work the queue" (next after send).

**Backlog, on request:** `saved-views` (a `setting` key holding named query
strings; the URL already is the view), `seen`, `in-app-notifications`,
`csv-import`, `host-links`, `ref-autolink`, `ai-draft-tools`,
`full-page-conversations`, `public-demo`, `spam-public-inbox`,
email one-click rating links.

## 4. Traps in the code these items will hit

- **`PUT` is not exported.** `agentRoute('PUT', 'settings')` exists, but the
  README route snippet and `examples/demo/app/api/helpdesk/[...slug]/route.ts`
  export only GET/POST/PATCH/DELETE/OPTIONS; Next answers 405. Fix in wave 1
  and add `PUT` to any future host instructions.
- **Bodiless POSTs become GETs.** `createApi` picks `GET` when `body` is
  undefined; a new POST route without a body must be called as
  `api(path, { method: 'POST', body: {} })` (the widget `seen` call does
  this). Otherwise `checkMutation` never runs and the route is not matched.
- **`checkMutation`** requires `application/json` on POST and the `Origin`
  to equal `adminUrl`'s origin (or an inbox's `allowedOrigins` for
  `widget/*`). New `agent/*` routes get this for free; a widget route must
  stay under `widget/`. The CORS `allow-methods` list is
  `GET, POST, PATCH, OPTIONS`: a widget `DELETE` would fail preflight
  cross-origin, so `customer-resolve` is a PATCH.
- **`HELPDESK_CHANGED`** fires on every non-GET `api` call and refetches
  the inbox; heartbeats and read-receipts must be GET side effects, not
  POSTs, or the inbox refetches at the heartbeat rate.
- **`de` is `Record<MessageKey, string>`**: every new `en` key fails `tsc`
  until its German twin exists (Swiss `ss`, "Sie"). `admin.test.tsx` and
  `inbox.test.tsx` hold a literal `me` fixture: new `agent/me` fields must
  be optional in `Me` or the fixtures break.
- **`agentView` spreads the row** to the admin; `customerView` is an
  allowlist. New columns leak to agents automatically (fine so far) and
  never to customers unless added (add `rating`, `agentSeenAt` by hand).
- **`touchAgent` upserts on every agent request** with a fixed `set`; new
  columns on `agent` (presence) must not be in that `set`.
- **`appendMessage` owns the status machine** (`contact` → `open`, public
  `agent` → `pending`, resolved stays resolved). Snooze, merge and CSAT must
  go through it or its `CASE` expressions, never set `status` beside it.
- **Retention deletes resolved conversations** (`applyRetention`) and
  everything that cascades: messages, attachments (files first), events,
  participants. A merged source is resolved and will go; `mergedIntoId` on
  other rows is `set null`. Nothing may reference a conversation without
  `onDelete` set.
- **`listInbox` is capped at 200 rows, no pagination.** Counts are an
  aggregate query, never `rows.length`; bulk actions take ids from the
  client, capped at 100.
- **`useResource` nulls data on key change** (`setData(null)`), which is
  the blank flash the skeletons fix; the split layout must not change
  keys on every poll.
- **Schema changes ship only through `pnpm db:generate`**; commit the SQL
  and `migrations/meta/*` untouched. Drizzle 0.31.7 generates column adds
  and indexes cleanly; it cannot express a changed generated column without
  a drop/add, which is one more reason to keep the timeline out of
  `message.search`.
- **`test/harness.ts` `reset()` lists tables for `TRUNCATE … CASCADE`.** A
  table with an FK to a listed table is truncated by the cascade
  (`conversation_event`); a standalone table (a `view` table, say) must be
  added to the list or rows leak between tests.
- **The demo's `adminUrl` is `DEMO_URL`**; a public deployment with the
  wrong origin turns every mutation into a 403 (`checkMutation`).
- **`recentAgents(3)` and `teamAwayUntil`** drive the widget's "away" line
  from `lastSeenAt` in the last 30 days; business hours must combine with
  them, not replace them, or a team on holiday loses its notice.
- **The reminder guard** `(reminded_at IS NULL OR reminded_at < waiting_since)`
  is what makes concurrent `runJobs()` safe (test "claims each job once
  under concurrent runners"); any business-hours filtering in JS must keep
  the final `UPDATE … RETURNING` as the claim.

The single highest-risk item is `snooze`'s wake step reopening the wrong
rows. Cheapest check: an integration test that snoozes, resolves, moves
`snoozed_until` into the past with one `UPDATE`, runs `runJobs()`, and
asserts `status = 'resolved'` and `snoozed_until IS NULL`.
