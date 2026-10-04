---
id: worked-adapters
epic: launch
wave: 1
size: M
title: "docs(readme): worked examples for identify, email, storage, AI, help search and jobs, plus three reporting queries"
labels: documentation, area: docs, size: M, wave 1
depends: []
better_with: []
---
**Problem**

"Everything else is optional" reads as "everything else is on you". The `identify` example returns `null` with a comment, which is the one place the reader asks "do I have to build auth?" and the README shrugs. `email.send`, `StorageAdapter`, `AiAdapter`, `help.search` and `runJobs()` are interfaces with no example; the reader has to infer what to write from `config.ts`. The founder's month-one question, "what is our first-response time?", has a three-query answer that is nowhere.

**Scope**

In, each under twenty lines, in the README or linked from it under `examples/`:
- `identify` for Better Auth and for NextAuth (session → `{ user, orgs, isAgent }`), replacing the `return null` stub.
- `email.send` with Resend rendering the four (five with the mention kind) `HelpdeskEmail` kinds.
- `storage` with S3 presigned POST and GET.
- `ai.generate` with the Anthropic SDK and the Zod schema passed through.
- `help.search` over a static index of the host's own docs (Pagefind or a JSON index).
- `runJobs()` from a Vercel cron route and from a plain `setInterval` in a long-running host.
- "Reporting from your own database": three SQL queries (median first response, median resolution, volume per inbox and type over 30 days) against `helpdesk.*`, and one sentence on pointing Metabase or a PostHog warehouse at the schema.

Out: SQL views in the schema (a maintenance tail on every future migration), a docs site, more providers.

**Acceptance**

- Each snippet type-checks against the published types (a `pnpm pack` + scratch-directory check, as CI's smoke test does).
- The three queries run against the demo database and return rows.

**Evidence**

Sales: the first 30 minutes stop at `identify`, `email` and storage. Marketing: "one worked example per adapter" is launch-blocking. Libredesk and Chatwoot ship batteries; a library must show its batteries are small.
