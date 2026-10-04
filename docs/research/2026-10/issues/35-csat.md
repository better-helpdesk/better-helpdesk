---
id: csat
epic: hours-feedback-reporting
wave: 4
size: M
title: "feat(widget): ask for a rating after a conversation is resolved and show it in the admin"
labels: enhancement, area: widget, area: admin, size: M, wave 4
depends: []
better_with: [timeline]
---
**Problem**

The team has no signal on whether a resolution helped, and a founder who reported a CSAT number from Intercom or Zendesk sees its absence as a regression. Marketing and sales both say to let a design partner ask first; the first review will.

**Scope**

In:
- `rating text` (`good` | `bad`), `rating_comment text`, `rated_at` on `conversation`; one generated migration.
- `POST widget/conversations/:id/rating` for the author only (`requireVisible` plus the `contactId` check), once (`WHERE rating IS NULL`).
- The widget thread shows two buttons and an optional comment once the status is resolved and no rating exists; `customerView` adds `rating`.
- A `bad` rating reopens the conversation (`open`, `waitingSince`) and records an event when the timeline exists.
- Admin: a rating chip next to the status in the header and on the inbox row; a "Rated bad" filter.
- `en` + `de`; integration test for once-only and author-only.

Out: email one-click links (a signed GET is a new HTML surface; backlog), 1 to 5 scales, reasons, reports (overview issue), surveys.

**Acceptance**

- Integration suite and widget test green; screenshot of the prompt and the chip.

**Evidence**

Intercom conversation ratings on close with a 7-day expiry and no request under 250 characters; Zendesk CSAT 24 hours after Solved; Chatwoot and Libredesk CSAT surveys.
