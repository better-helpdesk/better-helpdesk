---
id: ux-widget-accent
epic: widget-customer
wave: 3
size: M
title: "fix(widget): accent for highlights, readable meta, pressed tiles and a panel that fits its view"
labels: bug, area: widget, accessibility, size: M, wave 3
depends: []
better_with: [ux-tokens-radii]
---
**Problem**

The focus colour marks unread dots, the selected tab and the agent dot, so a host's accessible focus colour leaks into the UI as decoration. "You · just now" on the accent bubble fails 4.5:1. The home view shows 300px of nothing under the four cards, which reads as "something failed to load". Tabs and secondary buttons stay under 44px on phones.

**Scope**

In:
- `.tabs [aria-selected]`, `.unread-dot`, `.item.unread strong::after`, `.agent-dot`, `.agent-note` use the accent; `--helpdesk-focus` is only the focus ring (README Theming updated).
- `.msg-meta` at 12px and full opacity with a mixed colour that passes 4.5:1 on both bubbles.
- Type and item tiles tone-on-tone with `:active`.
- The panel's height fits its view for home and form; the view-change fade; motion variables and the reduced-motion block for the widget.
- 44px tabs, secondary buttons, switch and send under 480px.

Out: field order, the home's content, the thread's bubble model, animating the panel's height (not transform or opacity).

**Acceptance**

- Screenshots at 1440 of home, form and thread in the demo's light and dark themes and in the untouched default palette (no pink); 375 and 390 of the full-screen sheet.
- Contrast of `.msg-meta` measured on both bubbles; `widget.test.tsx` green; Tab stays inside the sheet on phones.

**Evidence**

UX review §2 Colour (C-3), T-6 contrast, §3 widget findings 1 and 6, §4(g), work item 9.
