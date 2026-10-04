---
id: ux-collapsible-aside
epic: agent-ui-craft
wave: 3
size: M
title: "feat(admin): collapsible details sidebar with a remembered state"
labels: enhancement, area: admin, size: M, wave 3
depends: []
better_with: [ux-tokens-radii]
---
**Problem**

In a 900px host column the fixed 320px aside leaves a 560px thread, and there is no way to give the conversation the room. The split layout (wave 4) only works at 1180px if the aside can collapse.

**Scope**

In:
- A "Details" / "Hide details" toggle in the conversation page head with `aria-expanded` and `aria-controls`; focus moves to the toggle when the aside hides.
- `localStorage['helpdesk.aside']` in `try/catch`; default open at a wide container, closed below.
- `.sa-split` collapses to one column when hidden; a reading measure on the message body.
- Two i18n keys, `en` + `de`.

Out: moving the properties (next issue), per-card collapse, drag to resize.

**Acceptance**

- Screenshots at 1440 open and closed, and at 768.
- The state survives a reload; a private window falls back to the default.
- Keyboard: the toggle is reachable by Tab and announces its state.

**Evidence**

UX review work item 3; Intercom's collapsible details sidebar; Zendesk's resizable context panel.
