---
id: snooze
epic: inbox-workflow
wave: 2
size: M
title: "feat(admin): snooze a conversation until a time and wake it in runJobs or on a customer reply"
labels: enhancement, area: admin, size: M, wave 2
depends: []
better_with: [timeline, shortcuts]
---
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
