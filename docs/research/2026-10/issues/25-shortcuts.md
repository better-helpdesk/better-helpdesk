---
id: shortcuts
epic: inbox-workflow
wave: 3
size: S
title: "feat(admin): shortcuts for resolve, assign, reply, note and snooze, with a ? cheat sheet"
labels: enhancement, area: admin, size: S, wave 3
depends: []
better_with: [snooze, presence]
---
**Problem**

j/k and ⌘↵ exist; everything else needs the mouse, and nothing tells a new agent which keys exist. Triaging forty conversations means forty mouse trips to the status select.

**Scope**

In:
- `useShortcuts(map)` in `src/admin/ui.tsx` reusing the guard from `inbox.tsx` plus `target.isContentEditable`.
- `e` resolve, `a` assign to me, `r` reply, `n` internal note, `z` snooze (when present), `?` opens the existing `Dialog` with a `<kbd>` list grouped by screen; platform-aware ⌘/Ctrl as the composer already does.
- With presence: j/k show the viewer avatars so an agent can skip a held conversation.
- `en` + `de` for the sheet.

Out: a ⌘K command palette (six sections and three filters do not need one; the UX review reached the same verdict), configurable bindings, "work the queue" (wave 4, after the split layout).

**Acceptance**

- `inbox.test.tsx` gains cases for the new keys and for the contenteditable guard.
- The sheet lists every key the UI honours.

**Evidence**

Zendesk Ctrl+Alt shortcuts and the "Submit as" split button; Chatwoot `SHORTCUT_KEYS` and ⌘K; Libredesk `KeyboardShortcutsDialog.vue`; Intercom R / N / ⌘⇧Y.
