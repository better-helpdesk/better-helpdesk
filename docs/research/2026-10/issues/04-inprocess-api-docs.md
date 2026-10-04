---
id: inprocess-api-docs
epic: launch
wave: 1
size: S
title: "docs(readme): document the in-process API with two recipes"
labels: documentation, area: docs, size: S, wave 1
depends: []
better_with: [on-event]
---
**Problem**

The first question a developer asks of any helpdesk is "is there an API?". The answer is yes and better than the competitors' (no token, no network hop, no rate limit): `buildHelpdesk()` returns `createConversation`, `addAgentMessage`, `track`, `triage`, `draftReply`, `deleteContact`, `runJobs` and `store`. None of that is in the README, so the comparison table reads "no API".

**Scope**

In:
- A README section "Calling it from your own code" with two worked recipes:
  1. Open a conversation from a failed-payment webhook route (shows how to build the server-side `Request` that `identify` needs, or how to call `store.createConversation` with a known contact).
  2. `helpdesk.track()` a "plan upgraded" event onto a contact's timeline from a billing handler.
- One sentence on `helpdesk.store` for reads, with the three reporting queries cross-referenced from the worked-adapters issue.
- A note on what is *not* needed: API tokens, webhooks, a REST client.

Out: a generated API reference, new exports.

**Acceptance**

- Both recipes compile against the demo (`examples/demo`) as a type check, even if not wired to a page.
- Reviewed by the Head of Docs pass for Diátaxis shape (how-to, not reference).

**Evidence**

Marketing: the in-process API is one of the five "inside, not next to" proofs. Sales: "Where are the API tokens?" is a week-two question with a one-sentence answer. Zendesk, Intercom and Libredesk sell API keys; Chatwoot sells access tokens.
