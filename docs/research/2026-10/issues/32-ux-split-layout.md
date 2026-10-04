---
id: ux-split-layout
epic: agent-ui-craft
wave: 4
size: L
title: "feat(admin): split the inbox into list and thread when the container is wide enough"
labels: enhancement, area: admin, size: L, wave 4
depends: [ux-collapsible-aside]
better_with: [ux-skeletons, ux-properties-card, presence]
---
**Problem**

Inbox → conversation → back is a full page swap: opening a row unmounts the list, "< Inbox" remounts it, refetches, and loses the j/k cursor. Across forty conversations a day that is forty blank flashes and forty lost positions, and an agent cannot glance at what is waiting while answering. The route already keeps the filters in the query string, so a split costs no routing work.

**Scope**

In:
- `container-type` on the admin root; every admin media query becomes a container query.
- `index.tsx` renders `Inbox` and `ConversationView` side by side at a wide container (380px list pane, sticky, own scroll) and at a medium one with the aside collapsed; single pane below, identical to today.
- A `ConversationList` row component in `inbox.tsx` sharing data and the j/k hook with the table; `aria-current` on the selected row; the back link hidden in split; the j/k guard adds `target.isContentEditable`; Escape in the thread focuses the list.
- The list keeps polling every 10 seconds with the cursor kept; `useResource` keys must not change on every poll.

Out: the aside toggle and properties card (earlier issues), virtualised lists, drag to resize the panes, "work the queue" (next issue).

**Acceptance**

- Screenshots at 1440 (split with aside), 1100 (split, aside collapsed), 768 and 375 (single pane) in the demo card and in a full-viewport host.
- j, k, Enter on the list while a thread is open; typing j in the composer inserts "j"; Escape from the composer focuses the selected row; Tab order is list → thread → aside.
- `inbox.test.tsx` gains a case for `isContentEditable`; reduced motion shows no transition on pane change; lint, unit tests and the demo build on both Next majors green.

**Evidence**

UX review §3 finding 1 and work item 1; Zendesk, Intercom, Chatwoot and Libredesk all keep the list beside the thread.
