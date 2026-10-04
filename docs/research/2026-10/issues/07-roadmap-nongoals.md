---
id: roadmap-nongoals
epic: launch
wave: 1
size: S
title: "docs: add ROADMAP.md with the non-goals and the next waves"
labels: documentation, area: docs, size: S, wave 1
depends: []
better_with: []
---
**Problem**

"No documentation or visible roadmap, so I can't evaluate it" was the sharpest Hacker News critique of Libredesk's launch, and "if you posted a roadmap you'd get traction" followed. Better Helpdesk's scope decisions live in `AGENTS.md` (for coding agents) and `docs/product.md`; nothing prospect-facing states what it will not do, which is the strongest line it has.

**Scope**

In:
- `ROADMAP.md` at the repository root with two parts:
  1. "What it will not do", each line a refusal and the reason it is better for the host: its own login or SSO; a hosted mode or hosted relay; a second process, database or queue; social and messaging channels; an AI that answers customers; per-seat pricing or any gated feature; a rule builder or SLA policy engine; a hosted help centre; API tokens.
  2. "Next", the wave-2 to wave-4 items from this research by title, dated, with "on request" for the backlog.
- A link from the README and from `docs/product.md`.

Out: dates or promises per item, a public issue board embed.

**Acceptance**

- The Head of Docs pass reviews tone (declarative, no apology).
- Every refusal is consistent with `AGENTS.md` "Off-limits".

**Evidence**

Marketing §3 (the "we will never" list as a marketing asset) and §5 item 4; Libredesk added a roadmap after HN asked; Chatwoot keeps a public roadmap.
