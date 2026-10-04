---
id: drafts
epic: inbox-workflow
wave: 2
size: S
title: "fix(admin): keep an unsent draft per conversation across navigation"
labels: bug, area: admin, size: S, wave 2
depends: []
better_with: []
---
**Problem**

The conversation view remounts on `key={id}` and loses the composer's `body`. An agent who opens the inbox to check something, or whose tab reloads, loses a half-written reply.

**Scope**

In:
- `sessionStorage['helpdesk.draft.' + id]` written on change and cleared on send, wrapped in `try/catch` (private windows, blocked storage); the mode (reply or note) stored with it.
- Restored on mount; an unsaved-draft dot on the inbox row is optional and in scope if it is one line.

Out: server-side drafts, drafts shared between agents, undo send.

**Acceptance**

- Unit test: type, navigate away, come back, the text is there; send clears it.

**Evidence**

Intercom auto-saves separate reply and note drafts; Zendesk shows an unsaved-change dot on ticket tabs; UX review §3 finding 1.
