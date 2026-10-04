---
id: customer-resolve
epic: widget-customer
wave: 2
size: S
title: "feat(widget): let the customer mark a conversation resolved"
labels: enhancement, area: widget, size: S, wave 2
depends: []
better_with: [on-event]
---
**Problem**

A customer who solved it themselves, or got the answer, has no way to say so; the conversation stays open until an agent notices, and the agent's reminder fires for a question that is already answered.

**Scope**

In:
- `PATCH widget/conversations/:id` (already exists for sharing) accepts `status: 'resolved'` for the author only, through the same 403 branch; sets `resolvedAt` and `waitingSince` as the agent route does; emits `conversation.updated` with `agentId: null`.
- One "Mark as resolved" button in the widget thread footer while the status is not resolved; the customer-side status flips to "Resolved".
- `en` + `de` strings; widget integration test.

Out: a reopen button for the customer (writing again reopens it already), a rating (CSAT issue), a DELETE route (the cross-origin CORS method list has no DELETE).

**Acceptance**

- Widget test and integration suite green.
- Cross-origin: the PATCH passes the preflight (methods list unchanged).

**Evidence**

Chatwoot `enableEndConversation`; Zendesk end-user "mark as solved" on messaging; the research's "customer-side mark as resolved" next-tier item.
