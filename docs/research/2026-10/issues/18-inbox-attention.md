---
id: inbox-attention
epic: inbox-workflow
wave: 2
size: S
title: "feat(admin): open counts on the assignee tabs and unread rows"
labels: enhancement, area: admin, size: S, wave 2
depends: []
better_with: []
---
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
