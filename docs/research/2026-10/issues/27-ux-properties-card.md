---
id: ux-properties-card
epic: agent-ui-craft
wave: 3
size: M
title: "feat(admin): show status, priority, type, inbox and assignee as a properties card"
labels: enhancement, area: admin, size: M, wave 3
depends: [ux-collapsible-aside]
better_with: []
---
**Problem**

The five selects above the thread are the same component, size and position as the five filters above the inbox table, and they wrap to two lines at 1440. An agent who just left the inbox reads "Status: Open" as the filter they set, not as the record's state.

**Scope**

In:
- A first aside card titled "Properties" with eyebrow labels over borderless selects; the same card renders above the thread as a two-column grid when the aside is hidden or the container is narrow.
- The `Select` helper unchanged in behaviour; the PATCH calls byte-identical; the toolbar row removed from `ConversationView`.
- One i18n key.

Out: new fields, inline editing of anything else, the title editor.

**Risk and the test first**

This is the one change in the UX review that can make an agent slower. Before merging, watch one agent from each design partner open three conversations over a shared screen: time to "status changed" and to "assigned to me", and whether they look at the aside or the thread first. If both reach for the top of the thread, keep the row and ship only the visual distinction (eyebrow labels, borderless selects) in place.

**Acceptance**

- Screenshots at 1440, 768 and 375; each select keeps its `aria-label`.
- `agent.integration.test.ts` untouched and green.

**Evidence**

UX review §3 finding 2, work item 4, §7 (riskiest assumption); Linear's issue view; Libredesk's header selects.
