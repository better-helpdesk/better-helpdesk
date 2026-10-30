# Audit, 30 October 2026

Three independent audits of the working tree with PR #302 on top of `main`. Each was done by a separate agent:

- [security.md](security.md): a code read.
- [ux.md](ux.md): a code read, plus the Harbor demo in headless Chromium at 1440×900 and 390×844.
- [code.md](code.md): a code read, plus lint, unit tests and integration tests on Postgres, SQLite, memory and MySQL.

The findings below were checked against the code before being listed here.

## Fix first

| # | Area | Finding | Where |
| --- | --- | --- | --- |
| 1 | Security | The widget sends the full landing URL, including the query string and fragment, with every non-technical message. The customer never sees or can untick it, which contradicts `security.mdx`. Tokens from magic links or password resets end up readable by every agent. | `src/widget/widget.tsx:183`, `:1163` |
| 2 | Code | The Postgres realtime adapter can release a pooled client twice: once on unsubscribe, then again on a later `error`. pg-pool throws on that inside an event handler, which can crash the host during a database failover. A failed `LISTEN` also leaks a connection. | `src/realtime.ts:76-88`, `:122-129` |
| 3 | UX | In the split view, both panes are `100vh` sticky and ignore host chrome. The composer and Send start below the fold. | `src/admin/styles.ts:240-245` |
| 4 | UX | A single failed poll replaces the open conversation, and the draft being written, with "could not be loaded". The error check runs before the data check. | `src/admin/conversation.tsx:331`, `crm.tsx:338`, `:783` |
| 5 | Code | Every remote `typing` event makes every agent tab refetch the inbox, views, counts and notifications. The widget does the same. | `src/admin/index.tsx:102-105`, `src/widget/widget.tsx:404-412` |
| 6 | UX | At phone width the agent UI is 901px wide, because the `.sa` grid column grows to its content. | `src/admin/styles.ts`, `.sa` |
| 7 | Docs | The jobs runbook looks for parked jobs at `run_at = 'infinity'`, but the code parks them at `9999-12-31`. | `operations/jobs.mdx:111`, `:118`, `database/tables.mdx:280` |
| 8 | UX | The lead form placeholder is devguard's own copy, and it ships to every host in four languages. | `src/ui/i18n.ts:90` and its translations |

## Next

- **Jobs that send email.** `notify-agents` and `notify-mentioned` send to every recipient in one job, so a retry mails earlier recipients again. Nothing stops a handler from running past its two-minute lease. (code)
- **Inbox limits.** The inbox silently stops at 200 rows while the counts show the true total. No index exists on `conversation.assignee_id` or on `conversation_event (kind, created_at)`. (code)
- **Supervisor-only actions.** The supervisor gate stays open until a supervisor has made a first request. Contact erasure is not supervisor-only. Viewers can rename and delete shared views. (security)
- **Abuse limits.** Rate limits depend on `clientIp` being right for the host's proxy setup. Unsigned inbound mail has no global cap. The Mailgun relay accepts replayed requests. The bearer secrets have no minimum length. (security)
- **UI state.** Property selects snap back to the old value until the refetch lands. Lists blank on every tab switch. Bulk changes apply with no confirm or undo. (UX)
- **Widget on phones.** Opening the widget focuses the search field, so the keyboard covers half the sheet. The sheet has no safe-area padding. (UX)

Everything else is ranked in the three reports.
