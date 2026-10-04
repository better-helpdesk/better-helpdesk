---
id: on-event
epic: host-integration
wave: 1
size: S
title: "feat(config): call an optional onEvent hook when a conversation is created, a message is added or a conversation changes"
labels: enhancement, area: config, size: S, wave 1
depends: []
better_with: []
---
**Problem**

The host wants a Slack message on a new urgent bug, a Linear issue for a feature request, a PostHog event on resolution, or assignment by plan. Today it has to poll its own tables. Every "automation", "webhook", "round-robin" and "Jira integration" request in the research resolves to this one seam, and it is the feature marketing would hold the launch for.

**Scope**

In:
- `onEvent?(event: HelpdeskEvent): Promise<void>` on `HelpdeskConfig`.
- `src/events.ts` exporting the union `HelpdeskEvent`:
  - `{ kind: 'conversation.created', conversation, message }`
  - `{ kind: 'message.created', conversation, message, internal: boolean }`
  - `{ kind: 'conversation.updated', conversation, before: Partial<Conversation>, agentId: string | null }`
- One `emit(config, event)` helper that awaits the hook inside `try/catch` and logs a failure; it never throws into the request.
- Call sites after the write has committed: `createConversation`, the threaded branch of `handleInbound`, `addCustomerMessage`, `addAgentMessage`, the agent `PATCH conversations/:id` route and the suggestion-accept route (`before` is the row the route already loaded; diff it against the patch keys).
- README: a Slack `fetch` example and a round-robin example that calls `helpdesk.store.updateConversation` over `store.listAgents()` filtered by `awayUntil`.
- Integration test: a conversation created through the widget route reaches a recording `onEvent`; a throwing `onEvent` still returns 201.

Out: HTTP delivery, signatures, retries, a delivery log, a UI. The host owns transport and already has secrets and a queue if it wants one.

**Approach**

No table, no route, no migration. Emit only outside store transactions so the host never sees uncommitted rows. Document "keep the handler fast or enqueue": it is awaited inside the request.

**Acceptance**

- `pnpm lint`, `pnpm test` and the integration suite green.
- The README recipe for Slack works against the demo (a console log stands in for the fetch).
- A handler that throws is logged and does not change the response status.

**Evidence**

Intercom webhooks (`conversation.user.created`, `conversation.admin.assigned`, `X-Hub-Signature`, one retry), Chatwoot `webhooks` table and "Send Webhook Event" automation action, Libredesk `webhook_event` enum and issue #306, Zendesk triggers. In an embedded library the host's own function replaces the HTTP hop.
