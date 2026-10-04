---
id: overview
epic: hours-feedback-reporting
wave: 4
size: M
title: "feat(admin): overview page with volume, first-response and resolution times"
labels: enhancement, area: admin, size: M, wave 4
depends: []
better_with: [worked-adapters, tags, csat, business-hours]
---
**Problem**

The founder cannot answer "how fast do we reply and is it getting better?" without SQL; every per-seat tool they left had this page. The three documented queries (worked-adapters issue) satisfy the head of engineering and nobody else.

**Scope**

In:
- One Overview section with a 7/30/90-day select.
- Four numbers (new, resolved, median first response, median resolution) and a table by inbox and by agent, from `store.overview(sinceDays)` as plain SQL (`percentile_cont(0.5)` over first agent message minus `createdAt` and `resolvedAt` minus `createdAt`), rendered as a `<table>`; business hours used when configured; the rating split when CSAT exists; top tags when tags exist.
- `en` + `de`; integration test asserting the medians on seeded data.

Out: charts, CSV export, custom reports, scheduled emails, SLA attainment, SQL views in the schema.

**Acceptance**

- Screenshot at 1440 and 375; the numbers match the README queries on the demo database.

**Evidence**

Intercom prebuilt reports (Essential plan ships "Pre-built reports" only); Libredesk's two-year-old minimal overview page; Chatwoot reports; Zendesk Quick Reports.
