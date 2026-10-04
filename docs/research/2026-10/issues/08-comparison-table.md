---
id: comparison-table
epic: launch
wave: 1
size: S
title: "docs(readme): add a dated comparison table against Chatwoot, Libredesk, Intercom and Zendesk"
labels: documentation, area: docs, size: S, wave 1
depends: []
better_with: [roadmap-nongoals]
---
**Problem**

The reader arriving from an "alternative to Intercom" thread scans for a comparison table and bounces without one. The rows also show which gaps the launch exposes, so the table doubles as the honest status board.

**Scope**

In:
- A README section "Compared with" with coarse, dated cells (yes / no / paid tier / planned / by design), no superlatives. Rows: runs as, database, identity, licence, pricing, install, upgrade, channels, real-time delivery, captured context, customer sees past conversations, tags, snooze, collision indicator, SLA, automation, reporting, CSAT, help centre, AI, events out, API, roles, languages, theming.
- Zendesk and Intercom cells from the two research reports (Zendesk per-agent tiers $19/$55/$115 yearly, Copilot +$50; Intercom seats $29 to $139, Fin per resolution, EU residency on Advanced/Expert annual only); Chatwoot (MIT core, Enterprise-gated SLA, audit logs, roles, Captain); Libredesk (AGPL, Postgres + Redis).
- "By design" rows link to `ROADMAP.md`.

Out: superlatives, "used by" claims, logos, feature counts.

**Acceptance**

- Every cell about a competitor cites a public page in a footnote or the research report.
- Cells for Better Helpdesk reflect `main` on the date in the heading.

**Evidence**

Marketing §4 comparison rows; the four competitor reports' feature inventories.
