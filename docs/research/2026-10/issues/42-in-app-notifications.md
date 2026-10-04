---
id: in-app-notifications
epic: team-collaboration
wave: backlog
size: L
title: "feat(admin): in-app notification bell for assignments, mentions and replies"
labels: enhancement, area: admin, size: L, backlog
depends: []
better_with: [mentions, timeline]
---
**Problem**

An agent working in another tab learns about a reply only when the inbox is next in view.

**Scope**

Skipped for now: at one to ten agents, email, counts and unread rows cover it. Revisit after mentions ship. When built: a `notification` table derived from events, polled on the existing cycle, a bell with a list, the count in `document.title`, mute per agent in `localStorage`. Out: browser push, sounds.

**Evidence**

Zendesk notifications list with favicon dot and mute; Chatwoot notification preferences matrix.
