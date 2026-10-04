---
id: full-page-conversations
epic: widget-customer
wave: backlog
size: M
title: "feat(widget): a full-page HelpdeskConversations component for an in-app Support page"
labels: enhancement, area: widget, size: M, backlog
depends: []
better_with: []
---
**Problem**

A signed-in user already sees their own and their company's conversations in the widget. Libredesk has a 20-comment thread asking for exactly this, because a standalone helpdesk does not know who the customer is. A full-page component turns the strongest post-launch differentiator into a visible feature.

**Scope**

In: export the widget's list and thread views as `<HelpdeskConversations>` without launcher or shadow root; the API client and `widget/*` routes unchanged; theming through the same tokens. Out: a help centre, authoring.

**Evidence**

Marketing §2 differentiator 3; Libredesk issue #221 (the author leaning towards "reply from the widget").
