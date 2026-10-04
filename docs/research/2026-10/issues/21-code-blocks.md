---
id: code-blocks
epic: agent-ui-craft
wave: 2
size: S
title: "feat(admin,widget): render pasted code and captured errors as copyable code blocks"
labels: enhancement, area: admin, area: widget, size: S, wave 2
depends: []
better_with: []
---
**Problem**

Customers paste stack traces, config snippets and log lines; agents paste commands back. The rich format has paragraphs, lists and links, so a pasted trace becomes one long paragraph. The captured JS errors already render in a `<pre>` but cannot be copied with one click.

**Scope**

In:
- A fenced `pre` block in the rich format (`src/ui/rich.tsx`): parser, renderer with a Copy button, editor paste of multi-line monospace text (or a toolbar toggle).
- The captured-context errors `<pre>` gets the same Copy button.
- Both UIs render it; `en` + `de` for the button and the copied state.

Out: syntax highlighting, language tags, a dependency.

**Acceptance**

- `rich.test.ts` and `rich-editor.test.ts` cover parse, render and round-trip.
- A pasted three-line trace in the widget arrives as a code block in the admin.

**Evidence**

Intercom Messenger code blocks with copy (September 2026); the Intercom report's next-tier item.
