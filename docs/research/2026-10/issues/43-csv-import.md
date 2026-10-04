---
id: csv-import
epic: launch
wave: backlog
size: M
title: "feat(bin): import contacts, companies and canned replies from CSV"
labels: enhancement, area: config, size: M, backlog
depends: []
better_with: [switching-guide]
---
**Problem**

"We would lose our Intercom or Zendesk contacts and macros." Each switcher writes the same script.

**Scope**

In: `bin/import.mjs` as a sibling of `bin/migrate.mjs`; a 25-line RFC 4180 reader (no dependency); contacts and companies idempotent on email and domain through the existing store; canned replies as a second file. Out: conversation history (a Chatwoot Postgres-to-Postgres import only when a design partner is on Chatwoot), a hosted migration service.

**Evidence**

Sales §4 must-have 2; Chatwoot "Import contacts"; Libredesk CSV tag importer.
