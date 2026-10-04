---
id: readme-hero
epic: launch
wave: 1
size: M
title: "docs(readme): lead with screenshots, a 90-second recording and the five \"inside, not next to\" proofs"
labels: documentation, area: docs, size: M, wave 1
depends: [demo-seed]
better_with: [worked-adapters, comparison-table, roadmap-nongoals]
---
**Problem**

The GitHub page is the launch page and the README opens with a shell command. Libredesk's and Chatwoot's READMEs open with a hero screenshot; a developer decides whether to read by the image. The claim "inside your product, not next to it" has four proofs in the code and only one of them is visible on the page.

**Scope**

In, above the fold and in this order:
1. The line, then the three-line install (already right).
2. Two screenshots from the seeded demo: the widget open in Harbor (light and dark side by side) and the inbox inside Harbor's own navigation with a conversation open and the context panel visible. A 90-second recording as a GIF or linked video: visitor sends → Nadia sees her list → Rowan answers inside Harbor's nav, no login → dark switch → `psql` shows the row.
3. "Inside, not next to": five proof blocks of three to eight lines each: `identify` calling a real session helper; a `psql` query joining `helpdesk.conversation` to the host's users; `--helpdesk-*` tokens on `:root`; `resolveContext` returning plan and seats; `helpdesk.createConversation()` from a webhook route.
4. "What it will not do" (eight lines, from `ROADMAP.md`).
5. "Compared with" (the table issue).
6. Adapters, theming, development, licence (existing).

Out: a marketing site, "used by" claims, logos, the word "live chat" anywhere.

**Acceptance**

- Images are committed under `docs/` or linked from a release asset, under 1 MB each.
- The Head of Docs pass reviews the copy; no claim the README cannot back.

**Evidence**

Marketing §1 (four proofs, two invisible), §4 (README order), §5 item 2. Sales §1 (first 30 minutes).
