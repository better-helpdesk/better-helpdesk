---
id: bulk-actions
epic: inbox-workflow
wave: 3
size: M
title: "feat(admin): select several conversations and assign, change status or priority, or tag them at once"
labels: enhancement, area: admin, size: M, wave 3
depends: []
better_with: [tags]
---
**Problem**

After a weekend, a spam burst or an outage that produced twenty identical reports, every conversation has to be opened to be assigned or resolved.

**Scope**

In:
- Extract the body-to-patch logic of `PATCH conversations/:id` (status → `resolvedAt`/`waitingSince`, company → `sharedWithCompany`) into `conversationPatch(before, data)`.
- `POST agent/conversations/bulk` with `{ ids: uuid[] (max 100), ...sameBody }`, applied per row inside one transaction (the status transition depends on each row's current status), one `onEvent` per row. All-or-nothing.
- Admin: a checkbox column with shift-click range, a toolbar with assignee, status, priority and (when the tags issue has landed) tag controls reusing `Select`, and "Clear selection".
- `en` + `de`; integration test for a mixed-status batch.

Out: bulk delete (no conversation delete route exists), bulk reply, "18 updated, 2 skipped" partial results.

**Approach**

The same-origin check in `checkMutation` covers the new POST (JSON from `adminUrl`'s origin). Validate every id as a uuid and cap at 100.

**Acceptance**

- Integration suite green; screenshot of the toolbar with three rows selected.

**Evidence**

Zendesk bulk toolbar on up to 100 tickets; Chatwoot v4 bulk actions; Libredesk v2.3.0 bulk actions with `aria-live` count.
