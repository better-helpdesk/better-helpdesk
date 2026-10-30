# Code audit: Better Helpdesk working tree

Branch `feat/ai-settings-audit-log-steady-inbox` at 21fb771, 30 October 2026. Read-only, judged against the architecture AGENTS.md settles.

**Runs:** `pnpm lint` is clean in `src/` (all 21 warnings are in `site/` CSS and `docs/research`). `pnpm test`: 405 passed. Integration passed on Postgres (native and portable), SQLite, memory and MySQL. SQL Server was not run locally.

**Labels:** CONFIRMED means traced through the code; PLAUSIBLE means it depends on runtime conditions I did not reproduce.

## Findings, most important first

1. **High, PLAUSIBLE. `src/realtime.ts:76-81`, `:85-88`, `:122-129`: a database failover can crash the host.**
   - **Failure:** the `'error'` listener stays on a client after it is released (on unsubscribe, and on the early `subscribers === 0` return). An idle-client error during a Postgres restart or failover calls `next.release(error)` again. pg-pool throws on the double release inside an EventEmitter callback, an uncaught exception.
   - **Related, CONFIRMED:** a rejected `LISTEN` never releases `next`, so each retry leaks a pooled connection.
   - **Fix:** release on setup failure, keep a per-client `released` flag, and remove the listeners before every release.

2. **Medium, CONFIRMED. `src/service.ts:838-870` (`notify-agents`, `notify-mentioned`): a retry emails people twice.**
   - **Failure:** one job mails every recipient in a loop. One failed send fails the job, and each retry (up to five) mails the earlier recipients again.
   - **Fix:** one job per recipient.

3. **Medium, PLAUSIBLE. `store.ts:2148`, `:2183-2195`, `service.ts:1820-1836`: a slow job can run twice.**
   - **Failure:** a claim is a 2-minute lease, but handlers (AI, SMTP) are unbounded, and `completeJob`/`failJob` write by id alone. A handler slower than 2 minutes, with the next `/jobs` tick overlapping it, runs twice.
   - **Fix:** fence both writes on `at('lockedUntil', lease)`, and abort the handler before the lease ends.

4. **Medium, CONFIRMED. `src/admin/index.tsx:102-105` with `service.ts:753-767`: typing reloads every agent tab.**
   - **Failure:** a remote `typing` change fires `HELPDESK_CHANGED`. While anyone types, every agent tab refetches about every 3 s:
     - the inbox: the list, three counts, previews and viewers;
     - `agent/views`: up to 100 `countInbox`, at `http.ts:945-967`;
     - notifications.
   - **Widget too:** `widget.tsx:404-412` reloads the whole session on every event.
   - **Fix:** skip `kind === 'typing'` in both places, as `conversation.tsx:214` already does.

5. **Medium, PLAUSIBLE. `store.ts:1665-1790` and `baseline.ts:266-279`: the notifications read grows with the tables.**
   - **Fallback:** without the Postgres capability, it loads 30 days of all agents' assignment and mention events into memory, plus an unbounded per-agent assignment history.
   - **Indexes:** none on `conversation.assignee_id` (also behind the "Mine" count) or on `conversation_event (kind, created_at)`. Finding 4 multiplies the cost.
   - **Fix:** add both indexes as a migration for each database family, and bound the fallback by `since`.

6. **Medium, CONFIRMED. `store.ts:1298`, `http.ts:878-906`: the inbox stops at 200 rows without saying so.**
   - **Failure:** the counts show the true total ("All 450"), and rows 201 onwards are reachable only by search. Bulk select sees only the loaded rows.
   - **Same pattern:** timelines stop at 200, the contact and company lists at 100, and the widget's own list at 100. The docs mention none of these caps.
   - **Fix:** a `(sortKey, id)` cursor, or "200 of N" plus a line in the reference.

7. **Medium, CONFIRMED. `operations/jobs.mdx:111`, `:118`, `database/tables.mdx:280`: the parked-jobs runbook matches nothing.**
   - **Failure:** the docs query `run_at = 'infinity'`, but the code parks jobs at `9999-12-31` (`store.ts:67`, `:2192`). The SQL is also Postgres-only.
   - **Fix:** document `run_at >= '9999-01-01'` for each family, or add a list-and-requeue store method.

8. **Medium, PLAUSIBLE. `http.ts:1139-1187` (bulk): a retried bulk reply goes out twice.**
   - **Failure:** the field changes commit, then up to 100 `addAgentMessage` calls run outside the transaction. One failure answers 500 after part of the work is done; a retry re-sends the replies.
   - **Fix:** return the ids that got the reply, or key the replies on a request id.

9. **Medium, CONFIRMED. `http.ts:268-287` (`widget/events`): fanout costs queries per open widget.**
   - **Failure:** a change on a conversation a stream has not seen in the last 60 s costs `getConversation` plus participants for each open widget.
   - **Fix:** carry `contactId`/`companyId` on `RealtimeChange`.

10. **Low, CONFIRMED. `service.ts:1080-1150`: a crash can lose a reminder or SLA notice.**
    - **Failure:** the claim and the enqueue are separate writes, so a crash between them loses the notice.
    - **Fix:** one transaction.

11. **Low, CONFIRMED. `kysely.ts:251-261` against `store.ts:1426-1444`: the capability and the fallback disagree.**
    - **Failure:** the `topTags` capability counts all-time use; the fallback counts the last 90 days. The contract says they match, and no test covers it.
    - **Fix:** the 90-day window in the SQL.

12. **Low, CONFIRMED. `store.ts:2203-2219`: the rate limit writes more than it needs and flakes on the hour.**
    - **Write cost:** `hitRateLimit` deletes expired windows on every hit.
    - **Flake:** it buckets on the `Date.now()` hour, which is the known flake in `hardening.integration.test.ts`.
    - **Fix:** prune in `runJobs`, and freeze time with `tick()` in that test.

13. **Low, CONFIRMED: gaps on this branch and near it.**
    - **Rating:** on the 2-point scale, `score` is accepted and wins (`http.ts:442-455`).
    - **Audit paging:** `?before=` skips rows that tie on `createdAt` (`store.ts:1567`).
    - **AI settings:** `PUT settings` read-modify-writes `ai` without a lock.
    - **Accepted suggestions:** accepting stores the filtered suggestion, so turning a switch back on restores nothing, unlike what `suggestions.mdx` implies (`http.ts:1325`).
    - **Missing docs row:** the `ai` key is missing from `tables.mdx:233-239`.

14. **Low, CONFIRMED: small UI bugs.**
    - **Typeahead:** stale responses win (`admin/pickers.tsx:47-59`, `widget.tsx:1125-1139`).
    - **Re-renders:** the `AdminProvider` value is not memoized (`admin/index.tsx:171-193`).
    - **AI settings card:** it vanishes on a load error (`settings.tsx:249-252`).

15. **Low, PLAUSIBLE: inbound mail and client IP.**
    - **Inbound size:** a chunked `inbound` body is read in full before its size is checked (`http.ts:1757-1759`).
    - **Orphaned files:** uploads are orphaned when the create for a new inbound conversation fails (`service.ts:1273`).
    - **Shared IP bucket:** without proxy headers, every anonymous visitor shares the `'unknown'` bucket (`service.ts:770-778`).

16. **Low, CONFIRMED: contributor docs are out of date.**
    - **Capabilities:** `AGENTS.md:28` names capabilities the code does not have.
    - **Exports:** `exports.mdx:51` leaves out `Feature`, `Family`, `KyselyAdapter`, `SqliteDatabaseInput`, `ModelName` and `Row`.

17. **Low: split along the seams that already exist.**
    - **`http.ts`:** widget, agent, CRM, mail/jobs and the router core, with a shared route-context module.
    - **`widget.tsx`:** shell, form, thread and help.
    - **`admin/conversation.tsx`:** thread, composer, side panel and canned replies.
    - **`store.ts`:** per-area modules composed into the one `createStore`.

## What is solid

- **Store:**
  - Claims are compare-and-set updates.
  - Locks are taken in id order.
  - `purge` emulates the cascades SQL Server refuses.
  - IN lists are chunked, with an `openjson` path on SQL Server.
  - Identifiers compare case-sensitively (`utf8mb4_bin`, `BIN2`).
  - No SQL crosses the store boundary.
- **Auth:**
  - Every agent route goes through `requireAgent` and the role gate.
  - Widget routes call `requireVisible` and check that the caller is the author.
  - Secrets are compared in constant time, and the JWT is pinned to HS256.
  - DKIM requires From alignment.
  - JSON bodies are read as a capped stream.
- **UI:** latest-request guards, stream backoff with a polling fallback, views keyed by id, and a web component that cleans up on disconnect.
- **Docs:** the route table matches all 66 routes, and 6fd6d91 updated its reference pages.

**Highest risk:** finding 1. The cheapest check is a fake pool that throws on a double release: subscribe, unsubscribe, then emit `'error'` on the released client.
