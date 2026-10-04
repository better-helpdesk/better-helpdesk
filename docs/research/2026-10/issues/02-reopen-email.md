---
id: reopen-email
epic: host-integration
wave: 1
size: S
title: "feat(email): email agents when a customer reopens a resolved conversation"
labels: enhancement, area: email, size: S, wave 1
depends: []
better_with: []
---
**Problem**

A customer answers "actually it is still broken" on a resolved thread. `store.appendMessage` already flips the conversation back to `open` (covered by the test "reopens a resolved conversation when the customer writes again"), but nobody is told: the inbox defaults to open, the assignee is not emailed, and the reply can sit for days.

**Scope**

In:
- A small `afterCustomerMessage(conversation)` in `src/service.ts` called by `addCustomerMessage` and by the threaded branch of `handleInbound`, which enqueues `notify-agents` with `reopened: true` when the pre-append row was `resolved`.
- The `notify-agents` job handler reads `payload.reopened` and sets a new optional `reopened?: boolean` on the existing `agent-new` email kind, so the subject can say "reopened". No fifth kind.
- `en` and `de` subject strings.
- Integration test: resolve, customer writes, `runDueJobs()`, exactly one `agent-new` with `reopened: true` in the harness's emails.

Out: a Reopen button (the status select already offers Open), a configurable reopen window, auto-close after N days.

**Approach**

Read the resolved check from the row loaded before `appendMessage`, never re-fetch after it (the append already set `open`).

**Acceptance**

- Integration suite green with the new case.
- README's `HelpdeskEmail` section mentions the optional `reopened` flag on `agent-new`.

**Evidence**

Libredesk `ReOpenConversation` hook and the `conversation_reopened` notification type; Chatwoot `reopen_conversation` in `message.rb`; Zendesk reopens Solved tickets on a requester reply and reassigns to the solving agent.
