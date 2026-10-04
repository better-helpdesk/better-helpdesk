---
id: presence
epic: team-collaboration
wave: 3
size: M
title: "feat(admin): show who else has a conversation open"
labels: enhancement, area: admin, size: M, wave 3
depends: []
better_with: [shortcuts]
---
**Problem**

With two agents and a 10-second poll, both open the newest conversation and both reply; the customer gets two answers. It is the first week-one complaint from every two-person team in the sales analysis, and every competitor shows "X is viewing".

**Scope**

In:
- Two columns on `agent`: `viewing_id uuid` (FK conversation, set null) and `viewing_at timestamptz`; one generated migration.
- The detail GET that already polls every 5 seconds writes `viewing_id`/`viewing_at` for the caller and returns `viewers` (name, avatar) of other agents with `viewing_at` in the last 15 seconds.
- The inbox list adds the same subquery per row for an avatar stack; the conversation header shows "{name} is viewing" and the composer shows a warning line when someone else is viewing.
- Integration test: two agents open the same conversation; each sees the other; a stale `viewing_at` is not shown.

Out: a presence table, a pruning job (the 15-second window prunes), a heartbeat route, "is typing", locking, a setting to turn it off, WebSockets.

**Approach**

Written on the GET on purpose (a POST would fire `HELPDESK_CHANGED`). `touchAgent`'s upsert must not clobber the two columns. One viewing slot per agent: a second tab overwrites the first; the upgrade path is a `(agent_id, tab_id)` table.

**Acceptance**

- Screenshot of a row with two avatars and a header with the viewing line.
- Integration suite green.

**Evidence**

Zendesk agent collision (eye icon, avatars, "Ticket updated" banner); Intercom "Show teammates presence" (September 2026); Chatwoot typing and viewing; Libredesk `conversation_last_seen`.
