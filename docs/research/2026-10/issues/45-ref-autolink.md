---
id: ref-autolink
epic: inbox-workflow
wave: backlog
size: S
title: "feat(admin): link references like ACME-1042 in notes and replies"
labels: enhancement, area: admin, size: S, backlog
depends: []
better_with: []
---
**Problem**

Agents write "same as ACME-1041" in notes and then search for it by hand.

**Scope**

In: `RichText` turns `[A-Z]{2,}-\d{4,}` into a link to the inbox search for that reference (no lookup). Out: previews, backlinks.

**Evidence**

Libredesk PR #475 (`#1042` autolinks "just like mentions").
