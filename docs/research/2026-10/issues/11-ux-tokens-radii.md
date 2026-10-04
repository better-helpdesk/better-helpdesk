---
id: ux-tokens-radii
epic: agent-ui-craft
wave: 1
size: S
title: "fix(admin,widget): derive every radius and shadow from the host's tokens"
labels: enhancement, area: admin, area: widget, size: S, wave 1
depends: []
better_with: []
---
**Problem**

A host that sets `--helpdesk-radius: 4px` gets 4px cards next to 8px buttons and a 14px dialog, because the values in `src/admin/styles.ts` and `src/widget/styles.ts` are right by hand (10/8/7/6/14) but not derived. Shadows are navy whatever the host's ink, and the widget's are plain black. In the dark theme the internal-note surface is not readable unless the host sets `--helpdesk-note`.

**Scope**

In:
- Derived radii in both stylesheets: outer surfaces at the token, controls at token−2, inner elements at token−4, the dialog at token+4, pills at 999; applied through private variables (`--a-r*` / `--s-r*`).
- Shadows and hairlines via `color-mix()` from the foreground token with an inset top highlight; one default per variable across both files.
- The note surface derived from `--helpdesk-note-border` when `--helpdesk-note` is unset.
- README Theming: one sentence that radius drives everything.

Out: nesting changes (pressed/error-states issue), the table-head treatment (empty-states issue).

**Acceptance**

- Screenshots at 1440 in the demo light and dark, plus one with `--helpdesk-radius: 4px` and one with `20px` showing concentric corners.
- Dark theme without `--helpdesk-note` shows a readable note.
- No literal colour remains in either stylesheet except the `:host` defaults block and the redactor overlay.

**Evidence**

UX review §2 Colour and Layout findings, §4(b), work item 2. Lock 2 of the review: one radius system.
