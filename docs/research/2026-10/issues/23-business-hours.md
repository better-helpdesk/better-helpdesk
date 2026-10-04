---
id: business-hours
epic: hours-feedback-reporting
wave: 3
size: M
title: "feat(config): business hours per inbox that the waiting colours, reminders, receipts and widget respect"
labels: enhancement, area: config, area: widget, area: admin, size: M, wave 3
depends: []
better_with: [snooze]
---
**Problem**

A Swiss team is offline from Friday 17:00 to Monday 08:00. The waiting indicator turns red on Saturday, the reminder email fires at 02:00, and the widget promises "within a few hours" to someone writing on Sunday. By week three the colours mean nothing.

**Scope**

In:
- `hours?: { timeZone: string; weekly: Partial<Record<'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun', [string, string][]>> }` on `InboxConfig`. Unset means Monday to Friday all day, which is what `nextWorkday` hard-codes today.
- `src/ui/hours.ts` (no Node imports, shared by server and both UIs): `openHoursBetween(from, to, hours)` and `nextOpening(at, hours)` on `Intl.DateTimeFormat(…, { timeZone }).formatToParts`; DST handled by Intl, no dependency. `nextOpening` replaces `nextWorkday` for the receipt's `backOn` and the widget's away line.
- Reminders: `claimReminders` selects candidates in SQL, filters in JS by `openHoursBetween(waitingSince, now) >= reminderAfterHours`, then runs the same guarded `UPDATE … RETURNING` for those ids (the guard stays the claim).
- Indicator: `agent/me` returns `inboxHours`; the inbox row computes open hours for the amber and red thresholds.
- Widget: `widget/session` returns `open` and `nextOpening`; the header line says "Back Monday 08:00" when closed; the per-agent away date and the schedule combine as the later of the two.
- Integration test: a customer writes Friday 17:30 with a 6-hour reminder; `runJobs()` on Saturday sends nothing; on Monday 10:00 it sends.

Out: a `dueAt` column (a second clock that drifts when the schedule changes), first-reply targets beyond `reminderAfterHours`, holidays, a settings UI (it is config like everything per inbox), an auto-reply.

**Acceptance**

- Integration suite green; `recentAgents` and `teamAwayUntil` still drive the away line when the team is on holiday.
- Screenshot of the widget header when closed.

**Evidence**

Intercom office hours and "Typically replies in…"; Zendesk SLA business hours and schedules; Chatwoot `working_hours` and `TEAM_AVAILABILITY` strings; Libredesk business hours with SLA.
