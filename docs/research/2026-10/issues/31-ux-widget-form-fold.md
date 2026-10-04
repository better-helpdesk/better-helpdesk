---
id: ux-widget-form-fold
epic: widget-customer
wave: 3
size: S
title: "fix(widget): keep the context review and the privacy line in sight on the first form"
labels: enhancement, area: widget, size: S, wave 3
depends: []
better_with: [demo-seed]
---
**Problem**

On the anonymous bug form the disclosure of what is sent ("5 details about this page · Review") is cut off at the bottom of the scroll area at the 640px panel height, and it is the privacy-relevant part. The six-icon formatting toolbar under the message is space a bug reporter will not use. After sending, the confirmation repeats the header's reply promise in a second voice.

**Scope**

In:
- `margin-top: auto` on the context box inside the form body so it sits above the pinned footer; the message toolbar collapsed to one toggle on the bug and feature forms using the existing `toolbar` prop.
- `thread.confirmEmail` / `thread.confirmHere` shortened so the header's promise is the only promise; `en` + `de` (the Settings placeholder shows the new default).
- (If not already done by the demo seed issue) the demo inbox gains a `privacyUrl`.

Out: reordering or removing fields, a two-step form.

**Acceptance**

- Screenshot at 1440 of the anonymous bug form with the context box and the privacy line both visible without scrolling at the 640px panel height, and at 375 as a sheet.
- `widget.integration.test.ts` still proves the context keys are sent and the unticked ones are not.

**Evidence**

UX review §3 widget findings 2, 3 and 5, work item 10.
