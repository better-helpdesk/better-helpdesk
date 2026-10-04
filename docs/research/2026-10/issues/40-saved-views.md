---
id: saved-views
epic: inbox-workflow
wave: backlog
size: M
title: "feat(admin): save the current filters as a view, personal or shared"
labels: enhancement, area: admin, size: M, backlog
depends: []
better_with: [inbox-attention, tags]
---
**Problem**

"Sales inbox, unassigned, lead type" is a three-click filter an agent rebuilds every morning; the team lead cannot hand colleagues an "Urgent and high, any inbox" list.

**Scope**

In: a `setting` key holding named query strings (the URL already is the view), personal (keyed by agent) or shared; "Save as view" captures the current route filters; a Views group in the rail with counts from the inbox-attention aggregate; rename and delete. Out: a filter builder, nested groups, date ranges, per-view notifications.

**Evidence**

Libredesk `views` table with `user`/`team`/`all` visibility; Zendesk personal and shared views; Intercom saved Views; Chatwoot `custom_filters`.
