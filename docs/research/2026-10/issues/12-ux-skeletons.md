---
id: ux-skeletons
epic: agent-ui-craft
wave: 1
size: S
title: "feat(admin): skeleton loading shaped like the inbox and the conversation"
labels: enhancement, area: admin, size: S, wave 1
depends: []
better_with: []
---
**Problem**

Every navigation blanks the screen to "Loading…" and then the full layout lands: `useResource` nulls its data on key change (`src/ui/api.ts`), so an agent opening forty conversations a day sees forty jumps. The split layout (wave 4) will make this more visible, not less.

**Scope**

In:
- `<Skeleton kind="table" | "thread" | "cards">` in `src/admin/ui.tsx`, shaped like the final layout (row heights, the aside's cards), with an opacity pulse that reduced motion turns static.
- Used in `inbox.tsx`, `conversation.tsx` and the CRM lists in `crm.tsx`; `aria-busy` kept.
- A unit test that asserts `aria-busy` is present while loading.

Out: optimistic rendering of the thread from the list row (a follow-up with the split layout).

**Acceptance**

- Screenshot of each skeleton at 1440 and 375.
- Throttled network shows no layout shift between skeleton and content (CLS 0 for the navigation).

**Evidence**

UX review §2 States, §3 finding 1, work item 5; engineering trap: `useResource` `setData(null)`.
