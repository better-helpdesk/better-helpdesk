---
id: work-the-queue
epic: inbox-workflow
wave: 4
size: S
title: "feat(admin): open the next conversation after sending"
labels: enhancement, area: admin, size: S, wave 4
depends: [ux-split-layout]
better_with: [presence, shortcuts]
---
**Problem**

An agent clearing thirty conversations goes list → conversation → list thirty times. With the list beside the thread, "send and move on" is one key.

**Scope**

In:
- A "Work the queue" toggle on the inbox that, when on, opens the next conversation in the current sort after Send or Send and resolve, with `n` to skip and "3 of 12" in the header; remembered in `localStorage`.
- Skips conversations another agent is viewing when presence exists.

Out: skip reasons, guided mode, per-view queues.

**Acceptance**

- Unit test for the next-after-send and the skip; screenshot of the header counter.

**Evidence**

Zendesk Play mode (Submit opens the next ticket, Skip, wraps around); Chatwoot "Resolve and move to next".
