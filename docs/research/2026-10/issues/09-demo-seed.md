---
id: demo-seed
epic: launch
wave: 1
size: S
title: "feat(examples): seed Harbor with conversations, account context and a bug that carries a JS error"
labels: enhancement, area: examples, size: S, wave 1
depends: []
better_with: []
---
**Problem**

The demo's inbox is empty until the visitor creates data, and the Harbor page throws no error, so the differentiators (captured context, recent JS errors, redacted screenshot, company panel, `resolveContext`) are invisible in the two-minute path. The engineer-buyer never sees the thing that makes them lean forward.

**Scope**

In:
- `examples/demo/scripts/seed.ts` using `helpdesk.store.createContact`, `createConversation` and `appendMessage`: a dozen invented people on `.test` domains across both inboxes, with types, priorities, one resolved thread, one with an internal note and a reply, one sales lead with a qualifying answer, context with URL, viewport, locale, app version and a recent error. Idempotent (skips when the reference sequence is past 1000).
- A "Try the broken button" on the Harbor page that throws, so a bug report filed afterwards shows "1 recent error" in the context summary.
- `resolveContext` in `examples/demo/lib/helpdesk.ts` returning plan and usage for `demo-org` so the company panel shows account context.
- `privacyUrl` on the demo's inboxes so the widget's privacy line renders.
- README "What to try" step for the broken button and a `psql` block that selects the five newest conversations from `helpdesk.conversation`.

Out: a reset endpoint and public deployment (backlog: public demo), PostHog events.

**Acceptance**

- `pnpm --filter better-helpdesk-demo seed` fills the inbox; the CI `example` job still passes (seed is not run there, or is and is asserted).
- Screenshot of the conversation view showing captured context with an error and the company card with plan and usage.

**Evidence**

Sales §1 (the inbox is empty; the best features are invisible) and §3; marketing §4 (the 90-second flow, the "peek at the database" moment). Fixtures use invented people on `.test` domains per `AGENTS.md`.
