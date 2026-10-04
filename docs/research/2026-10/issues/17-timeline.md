---
id: timeline
epic: host-integration
wave: 2
size: M
title: "feat(admin): record a conversation event timeline and show it in the thread"
labels: enhancement, area: admin, size: M, wave 2
depends: [on-event]
better_with: [tags, snooze]
---
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
