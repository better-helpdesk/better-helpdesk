---
id: tags
epic: inbox-workflow
wave: 2
size: M
title: "feat(admin): tag conversations and filter the inbox by tag"
labels: enhancement, area: admin, size: M, wave 2
depends: []
better_with: [on-event]
---
**Problem**

"Billing", "onboarding" and "bug-1234" live in agents' heads. `type` is the taxonomy the customer picked and `priority` is urgency; nothing groups conversations the way a support person keeps a week straight or hands a themed list to product. Named by all four competitor reports, marketing and sales as table-stakes.

**Scope**

In:
- `tags text[]` on `conversation`, mirroring `contact.tags`, with a GIN index; one generated migration.
- `PATCH agent/conversations/:id` accepts `tags` through the existing tags zod (`src/http.ts`, the contact one), lower-cased and de-duplicated.
- `GET agent/conversations?tag=` filters with `= ANY(tags)` in `store.listInbox`.
- `GET agent/tags` returns the fifteen most-used tags (`unnest` + `count`), consumed by a native `<datalist>`; no tag table, no colours, no settings CRUD.
- Editor: the comma-separated tags control from `crm.tsx` reused under the conversation title; tag chips on inbox rows (the row already receives the whole column through `agentView`); a tag filter in the inbox toolbar.
- `onEvent` carries `tags` in `conversation.updated` when present.
- `en` + `de` strings; integration test for the filter and the normalisation.

Out: tag rename or merge, tags on canned replies, tag reporting, AI tag suggestions, bulk tagging (bulk-actions issue).

**Approach**

Free text, lower-case unique per conversation; the cap of 50 tags × 50 chars is already in the zod. A join table would buy referential tags nobody manages.

**Acceptance**

- Integration suite green; `pnpm db:generate` output committed untouched.
- Screenshot of the inbox with chips and the filter active at 1440 and 375.

**Evidence**

Zendesk tags with the 15-most-used autocomplete over 60 days; Intercom tags with macro and workflow actions; Chatwoot labels with a filter and reports; Libredesk `tags` + `conversation_tags` and the "No tags on this conversation" nudge.
