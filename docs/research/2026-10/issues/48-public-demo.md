---
id: public-demo
epic: launch
wave: backlog
size: M
title: "examples(demo): deploy Harbor as a public demo with a scheduled reset"
labels: enhancement, area: examples, size: M, backlog
depends: [demo-seed]
better_with: [readme-hero]
---
**Problem**

Running the demo locally is the whole first thirty minutes. Libredesk's HN reception was carried by its hosted demo ("great demo", "loads fast"). Harbor is a host app; deploying one is what every host does, so this is not a hosted mode of the package. The maintainer decides whether that reading holds.

**Scope**

In: deploy Harbor with `DEMO_UNSAFE_AUTH=1` and `DEMO_URL` set to the public origin (or every mutation is a 403), the anonymous rate limit as shipped, a `POST /reset` route guarded by a secret that truncates `helpdesk.*` and re-seeds, called by the platform's cron; a "peek at the database" card showing the five newest rows; a link from the README. Out: analytics in the package (Harbor may carry PostHog; the package never does), a login.

**Evidence**

Marketing §5 item 1 ("no Show HN before this is live"); sales §3.
