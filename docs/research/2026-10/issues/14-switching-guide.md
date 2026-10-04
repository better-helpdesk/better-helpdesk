---
id: switching-guide
epic: launch
wave: 1
size: S
title: "docs(readme): a switching guide from Intercom, Zendesk, a shared Gmail inbox and Chatwoot"
labels: documentation, area: docs, size: S, wave 1
depends: []
better_with: [inbound-recipes]
---
**Problem**

Every switcher asks "we'd lose our contacts and history" on the first call. The honest answer today (contacts and companies have create endpoints, keep the old tool read-only for 60 to 90 days, new conversations start here) is nowhere in writing, so each evaluator rediscovers it.

**Scope**

In: a README section (or `docs/switching.md`) with one short block per source:
- Intercom: export contacts as CSV, paste macros into a CSV, re-point support@, swap the Messenger script, sign the identity JWT where `user_hash` was signed.
- Zendesk: users and macros via export/API, re-point support@, the `ACME-1042` reference keeps the ticket-number habit.
- Shared Gmail: nothing to import; the dual-delivery routing rule from the relays README; the team stops replying from Gmail.
- Chatwoot: Postgres to Postgres; contacts and conversations are importable on request (backlog); `identifier_hash` maps onto the identity token.
- The parallel-run rule in one paragraph.

Out: the importer itself (backlog item), a hosted migration service.

**Acceptance**

- Head of Docs pass for shape (how-to).
- Links to the relays README and the identity-token section.

**Evidence**

Sales §4 (migration and switching costs; must-haves ranked), marketing §3 ("no hosted mode" sentence).
