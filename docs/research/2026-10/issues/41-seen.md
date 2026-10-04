---
id: seen
epic: widget-customer
wave: backlog
size: S
title: "feat(widget): show \"Seen\" under the customer's last message once an agent has opened it"
labels: enhancement, area: widget, size: S, backlog
depends: [inbox-attention]
better_with: []
---
**Problem**

A customer cannot tell whether anyone has looked at their message.

**Scope**

In: `customerView` adds `agentSeenAt` (from the inbox-attention issue); the widget shows "Seen" under the last customer message when `agentSeenAt` is later than its `createdAt`; `en` + `de`. Out: typing indicators, per-agent read state.

**Evidence**

Intercom "Seen" / "Not yet seen" states; Chatwoot read receipts.
