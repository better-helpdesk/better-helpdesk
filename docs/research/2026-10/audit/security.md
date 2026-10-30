# Security audit: Better Helpdesk working tree (PR #302 on main), 30 October 2026

Read-only review of `src/`, `relays/`, `examples/adapters/` and `site/lib/`, checked against `site/content/docs/operations/security.mdx`. Nothing was run. **No critical or high findings.** The core trust boundaries hold. What remains are privacy leaks, defaults that fail open, and abuse limits.

## Findings, most severe first

**1. Medium: the widget sends the full landing URL, with query and fragment, and the customer never sees it. CONFIRMED (the code path). The token exposure is PLAUSIBLE.**
`src/widget/widget.tsx:183` stores `location.href` in sessionStorage on mount (`:559`). `:1163` sends `landingPage`, `referrer` and `utm` through `attribution()` for every non-technical type. These keys are not in `CONTEXT_KEYS` (`:1003`), so they are never shown and cannot be unticked. The server accepts any string (`src/service.ts:397-398`).
- **Scenario:** a visitor lands from a magic link or password reset (`#access_token=…&refresh_token=…` in the Supabase implicit flow, or `?token=…`). They later open a sales chat in the same tab session. The refresh token is now stored in `conversation.context` and readable by every agent and in every export.
- **Gap against the docs:** security.mdx says the context "is shown to the customer before sending, and they can untick anything".
- **Fix:** drop the fragment, keep only `utm_*` from the query (or only the origin and path), and list attribution in the review panel.

**2. Medium: abuse limits depend on a client-IP default that is wrong for common proxy chains. PLAUSIBLE.**
`src/service.ts:770-777` takes the last `X-Forwarded-For` hop, then `X-Real-IP`, then `'unknown'`. Two scenarios:
- **Behind a CDN and a load balancer:** the last hop is the CDN's egress address. Every visitor then shares one bucket, so one attacker spending 20 writes in an hour blocks the public widget for everyone.
- **With no proxy, or a proxy that passes headers through:** both headers are attacker-chosen, and the per-IP limit is gone.

`site/lib/helpdesk.ts` sets no `clientIp`.
**Fix:** require `clientIp`, or warn once at startup when no XFF arrives. Treat `'unknown'` as refuse-or-log, not as a shared bucket.

**3. Low-medium: unsigned inbound mail has no global cap. CONFIRMED.**
`src/service.ts:1203-1220` limits per sender (30) and per domain (100) only. Unsigned From addresses are free to forge, so rotating domains creates unlimited contacts, conversations and stored attachments (`:1272+`). Agent mail and triage are capped downstream; database growth and inbox noise are not.
**Fix:** add a global hourly cap on unsigned new conversations. Past it, drop quietly, as the per-domain cap already does.

**4. Low: the Mailgun relay accepts replays, and its comment's reasoning is wrong. CONFIRMED.**
`relays/mailgun.ts:70-89` has no timestamp window and no token-reuse check. Mailgun's HMAC covers only `timestamp+token`, never `body-mime`. One leaked signed triple (from logs or a proxy) lets anyone post any MIME to `/inbound` indefinitely, bypassing Mailgun's own filtering.
- **Why the comment is wrong:** it says a replay "re-posts a message whose Message-ID the helpdesk already skips". The attacker chooses the body, and with it a fresh Message-ID.
- **What still holds:** DKIM verification still applies, so forged mail stays unverified.
- **Fix:** reject timestamps older than about 5 minutes, and say so.

**5. Low: the supervisor gate fails open. CONFIRMED.**
`src/http.ts:124,633-641` and `audit` (`:731`) check `store.hasSupervisors()`, which counts only *active* agent rows (`src/db/store.ts:914`). A row exists only after its owner's first agent request.
- **Scenario:** the host has assigned supervisors, but none has opened the UI yet, or the last one was deactivated. Until then, any agent, and any viewer for `GET audit`, can read the audit log, switch AI features (#302) and deactivate agents.
- **Fix:** let the host declare that roles are in use (config flag), or gate on "host sends roles" rather than on stored rows.

**6. Low: every non-viewer agent can erase a contact. CONFIRMED.**
`DELETE contacts/:id` (`src/http.ts:1519`) is not in `SUPERVISOR_ONLY`. It is irreversible and deletes conversations and files across threads.
**Fix:** add it, together with `POST contacts/:id/merge`, to `SUPERVISOR_ONLY`.

**7. Low: a viewer can rename and delete shared saved views. CONFIRMED.**
`VIEWER_WRITES` (`src/http.ts:117`) allows `views/:id`, and `findView` also searches `views:shared`.
**Fix:** for viewers, limit `findView` to the agent's own key.

**8. Low: the audit log has gaps and fails open. CONFIRMED.**
- A failed `recordAudit` is logged and the change still succeeds (`src/http.ts:650-661`).
- Host-side calls are never audited: `helpdesk.deleteContact()`, `deleteCompany()`, `changeConversation(…, null)`.
- Reads of personal data are not logged.
- **Fix:** audit the host API entry points with a `host` actor. Document that reads and failures go unrecorded, or fail the write.

**9. Low: the inbound body is buffered without a size bound when there is no `Content-Length`. CONFIRMED (requires the secret).**
`src/http.ts:1759` calls `arrayBuffer()` before checking the 25 MiB limit. A chunked body from a leaked relay secret can exhaust memory.
**Fix:** stream with a running byte count, as `readJson` does.

**10. Low: the bearer secrets have no length floor. CONFIRMED.**
`inboundWebhookSecret` and `jobsSecret` (`src/config.ts:352,372`) accept any length, and the routes have no attempt limit. Contrast `identityTokenSecret`, which requires 32 bytes or more.
**Fix:** apply the same 32-byte check.

**11. Low: the widget's unauthenticated routes are unthrottled. PLAUSIBLE.**
- `GET widget/help` (`src/http.ts:591`) forwards any query to the host's search adapter, which may be paid, with no limit.
- `GET widget/events` (`:268`) allows unlimited SSE streams per contact. Each stream queries the database once per change, with a 60-second cache.
- **Fix:** put `limitCustomer`/`limitAnonymous` on help, and cap open streams per contact.

**12. Info: prompt-injection reach is narrow but not zero. CONFIRMED.**
`transcript()` (`src/service.ts:1498`) puts customer text inside `<conversation>` tags without escaping them, so a customer can close the tag. What model output can do:
- Suggest a type, priority, title or summary. These are schema-checked and applied only when an agent accepts them.
- Pick duplicates, restricted to the candidate list.
- Write drafts, which an agent sends.

What is exposed: drafts include `resolveContext` data (plan, seats) and help results, so an injected "quote your context" can surface host-internal facts in a draft. The duplicate pass also sends other customers' conversation titles to the model provider.
**Fix:** escape or strip the delimiter tags. Document that customer context and other customers' titles reach the model.

**13. Info: identity tokens and DKIM are scoped coarsely. CONFIRMED.**
- Tokens carry no `aud` or `iss` and have no maximum lifetime (`src/identity-token.ts`). A host that reuses the HS256 secret elsewhere has those JWTs accepted as helpdesk identities.
- "Verified" inbound mail proves the *domain* signed it, not the mailbox (`src/inbound/verify.ts`). On a domain whose MTA signs any From, a colleague can post into a thread owned by someone else at that domain.
- **Fix:** document both. Optionally check `aud: "better-helpdesk"` and cap `exp - now`.

## Checked and found sound

- **Authorization:** every `agent/*` route goes through `requireAgent` and the viewer gate. A token never grants agent access.
- **Customer ownership:** `canCustomerSee` (owner, participant, or company share with proven membership). Author-only PATCH, rating and upload. Sharing is reset when an agent moves a thread to another company.
- **Attachment IDOR:** the conversation id must match on complete and download. Keys are sanitised and random. Merging threads of different owners asks for confirmation.
- **CSRF and CORS:** POSTs must be JSON, Origin is checked, CORS covers only `widget/*` and sends no credentials, and `null` origins are refused.
- **Secrets and signatures:** constant-time comparison of SHA-256 digests. JWT: signature checked first, then alg pinned to HS256 and `exp` required. Rating links are HMAC-signed with an expiry, served with no-referrer and framing denied, and only the POST button records.
- **XSS:** React rendering, `safeHref` allows only http, https and mailto, and the editor HTML is escaped. Context and host links render only http(s). There is no `dangerouslySetInnerHTML`.
- **SQL:** Kysely parameters throughout. LIKE input is escaped. Raw SQL is limited to migrations and code-defined identifiers. tsquery words are filtered to letters and digits.
- **Inbound mail:** header-size gate, DKIM requirements (aligned, From signed, no `l=`, at most 5 signatures, deadline), unsigned automated mail dropped, a guessed plus-address reference never appends, and Message-ID dedup.
- **Mail abuse:** receipts carry no customer text and are capped. A subject is echoed only when its author is proven.
- **Erasure and retention:** files are deleted first and the deletion is verified. Participants' messages are deleted too. Rate-limit rows are pruned daily.
- **Exports:** the `setting` table (rating key) is not exported, and the audit log stores field names only.
