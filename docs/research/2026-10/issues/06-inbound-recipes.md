---
id: inbound-recipes
epic: launch
wave: 1
size: M
title: "docs(relays): Google Workspace, Microsoft 365 and Postmark inbound recipes with a dual-delivery cutover, and a Postmark relay"
labels: documentation, area: email, size: M, wave 1
depends: []
better_with: []
---
**Problem**

"How does our support@ get in? We are on Google Workspace." is the first and most common stop in an evaluation. The README offers one relay, a Cloudflare Email Worker, which a Google or Microsoft shop reads as "a subdomain on Cloudflare, a routing rule, a worker, a secret" with no time estimate. Their mental model is "forward support@ to an address" (Zendesk, Intercom) or "paste IMAP credentials" (Chatwoot, Libredesk).

**Scope**

In:
- `relays/postmark.ts` (or `.mjs`): a second relay that accepts Postmark's inbound webhook with `RawEmail` and POSTs the raw message to `{basePath}/inbound/` with the bearer secret. Same shape as the Cloudflare worker.
- `relays/README.md` with one recipe per provider, each ending with a time estimate and the two-week dual-delivery step:
  - Google Workspace: a routing rule that delivers to Gmail and to the relay address; what to switch off after the cutover.
  - Microsoft 365: a mail flow rule to the relay address.
  - Postmark: inbound domain, the webhook URL, the secret.
  - Cloudflare Email Routing (existing, moved here).
- A short "Switching" section in the README: keep the old tool read-only for 60 to 90 days, new conversations start here from the cutover date, re-point support@, swap the widget script; Intercom's `user_hash` and Chatwoot's `identifier_hash` map one-to-one onto the identity token.

Out: IMAP polling (a second process), a hosted relay (makes us a subprocessor), conversation history import (see the CSV import backlog item).

**Acceptance**

- The Postmark relay is covered by a unit test that feeds a recorded Postmark payload and asserts the POST body and headers.
- Each recipe has been walked once against a real account of that provider, or says it has not.

**Evidence**

Sales §2 item 1 (lose the deal without a trusted path); Libredesk's docs open with a Gmail app password; Chatwoot offers IMAP, Google and Microsoft OAuth; Zendesk and Intercom offer "forward to an address".
