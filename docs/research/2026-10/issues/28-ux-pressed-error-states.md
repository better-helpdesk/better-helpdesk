---
id: ux-pressed-error-states
epic: agent-ui-craft
wave: 3
size: S
title: "fix(admin,widget): pressed states, tinted composer tray, sending label and error retry"
labels: enhancement, area: admin, area: widget, accessibility, size: S, wave 3
depends: []
better_with: [ux-tokens-radii]
---
**Problem**

Buttons change colour on hover and nothing on press; Send gives no feedback while it works; a load failure shows "Something went wrong." with no way to retry; a focused table row has no highlight.

**Scope**

In:
- `:active` rules (scale or 1px shift) in both stylesheets; reduced motion removes the transform transition.
- The composer as a tray with the editor as its core; the amber note tint stays.
- "Sending…" on the primary button while busy; a danger notice with "Try again" where a resource failed to load, which refetches.
- `tr:focus-within` row highlight; the toast's fade.
- Three i18n keys, `en` + `de`.

Out: optimistic sends, offline queueing.

**Acceptance**

- A screenshot with a button held down at 1440; the network tab blocked shows the notice with Try again, which refetches.
- Tab through the inbox shows a highlighted row.

**Evidence**

UX review §2 States, §4(c), work item 7.
