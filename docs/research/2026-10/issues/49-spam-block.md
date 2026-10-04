---
id: spam-block
epic: host-integration
wave: backlog
size: S
title: "feat(service): block a sender so a public inbox stops accepting their messages"
labels: enhancement, area: config, size: S, backlog
depends: []
better_with: []
---
**Problem**

Public inboxes get form-bot spam within days. The honeypot field and the per-IP hourly limit stop some of it; today the only cleanup is `deleteContact`, which hard-deletes the person and their conversations.

**Scope**

In, when a partner reports it: `blocked boolean` on `contact`, set from the contact page; `createConversation` and inbound answer 404 for a blocked email; the inbox hides their open conversations. Out: content filters, a held list.

**Evidence**

Sales §1 week-one complaint "the sales inbox is full of spam"; Zendesk "Mark as spam"; Chatwoot block contact.
