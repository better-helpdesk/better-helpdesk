---
id: ux-empty-states
epic: agent-ui-craft
wave: 1
size: S
title: "feat(admin): empty states that say how to fill the screen, with a filter reset"
labels: enhancement, area: admin, size: S, wave 1
depends: []
better_with: []
---
**Problem**

"Nothing here yet." on an inbox filtered to Status: Open does not tell a new agent that resolved conversations exist, where the first message will come from, or that a filter is hiding rows. Companies with one row and three empty columns, an empty deals board and an empty canned-replies list say the same sentence.

**Scope**

In:
- `<Empty>` in `src/admin/ui.tsx` with a title and one line of guidance.
- The inbox distinguishes "empty" from "filtered" and offers "Clear filters", which navigates to the bare inbox route.
- Copy per screen (seven i18n keys, `en` + `de`): inbox empty, inbox filtered, contacts, companies, canned replies, deals (all columns empty), timeline (existing key reused).
- The table-head eyebrow treatment from the UX review's type proposal, in the same PR because the empty state sits in that frame.

Out: illustrations, onboarding checklists.

**Acceptance**

- Screenshots at 1440 and 375 of inbox-empty, inbox-filtered, contacts, companies, canned, deals.
- `tsc` proves every new key has a German string.

**Evidence**

UX review §2 States, §3 finding 7, §4(f) microcopy, work item 6.
