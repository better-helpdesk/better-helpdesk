---
id: ux-composer-order
epic: agent-ui-craft
wave: 3
size: S
title: "feat(admin): put the reply/note switch first and move \"Set away\" to the rail"
labels: enhancement, area: admin, size: S, wave 3
depends: []
better_with: []
---
**Problem**

The mode is chosen after typing: Reply / Internal note sits in the footer, so an agent decides whether the text is public after writing it. The keyboard hint wraps mid-phrase. "Set away…" sits in the inbox toolbar although it changes what the widget promises customers; it is about the agent, not the list.

**Scope**

In:
- Reorder the composer: the reply/note segment first, actions in one row, `white-space: nowrap` on the hint and hidden under a narrow container; the placeholder becomes the slash hint and the label stays `aria-label`.
- `AwayControl` moves to the nav rail next to the agent's identity, with the toolbar fallback when the host renders `nav={false}`.

Out: a split "Submit as" button (two plain buttons with ⌘↵ and ⌘⇧↵ are better), macros, scheduled sends.

**Acceptance**

- Screenshots at 1440, 768 and 375 in reply and note mode; ⌘↵ and ⌘⇧↵ still send and resolve; the segment is the first focusable element of the composer.
- With `nav={false}` the away control is still reachable.

**Evidence**

UX review §3 findings 3, 4 and 9, work item 8; Zendesk, Intercom and Chatwoot put the public/internal choice first.
