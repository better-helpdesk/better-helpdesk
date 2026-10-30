# UX audit: agent UI and widget

Working tree at `21fb771`, 30 October 2026: the source, plus the seeded demo
in headless Chromium at 1440×900 and 390×844. *Verified* means seen in the
browser; the rest is from the code.

## High

**1. The split pane is sized to the viewport, not to the space it has.**
`styles.ts:240-245` makes both panes `position: sticky; top: 0; height: 100vh`.
Inside any host with chrome above it, the bottom of the pane sits below the
fold. *Verified:* in the demo, opening HRB-1000 puts the composer's top at
y=838 of 900, and Send is off-screen until the window scrolls 347px. Then the
host's sticky header covers the conversation title. The agent never sees the
title and Send together. Fix: set `height: calc(100dvh - var(--sa-pane-top))`, with the
pane's measured top in that variable, and a `--helpdesk-sticky-top` for the
host's sticky header.

**2. One failed poll wipes the open conversation.** `useResource` keeps the
data when a poll fails (`api.ts:151-160`), but `conversation.tsx:331` checks
`error` before `data`. *Verified:* after 33s offline the thread and composer
are replaced by "This could not be loaded. Try again", and they are still gone
6s after the network returns. The same pattern is in `crm.tsx:338,783`. In
`inbox.tsx:451` and `crm.tsx:214,702` a red banner appears above the list and
pushes it down. Fix: show `LoadError` only when there is no data. With data,
show a quiet "Offline, last updated 14:02" line in a slot that is always
mounted, and refresh on `online` and `visibilitychange`.

**3. The agent UI overflows on phones and in narrow containers.** *Verified*
at 390px: the admin grid is 785px wide, the document 901px, the table is
clipped and the thread scrolls sideways. `.sa` is a grid whose implicit `auto`
column (`styles.ts:29`) grows to fit the `nowrap` inbox bar (`styles.ts:471`).
So `useNarrow(root, 720)` (`inbox.tsx:87`) never reports narrow. Fix:
`grid-template-columns: minmax(0, 1fr)` on `.sa`, plus `min-width: 0` on the
panes.

**4. Property selects jump back before they change.** Status, assignee,
priority, tier, type and inbox are controlled by server data
(`conversation.tsx:735-812`). React restores the old value until the PATCH and
the refetch both land. *Verified* locally; on a real network it takes two
round trips. A failure has no handler: it falls to the global "Something went
wrong." paragraph (`index.tsx:150-160`), which pushes the whole UI down and
has no retry. Fix: keep an optimistic value per field, show pending and error
at the field, and revert with a message.

**5. Changing a tab, view or filter blanks the list.** `useResource` sets
`data` to null on every key change (`api.ts:163-166`). The table becomes an
invisible 300ms skeleton, then the new table: *verified* as a blank flash.
The High & urgent chip only exists while the current rows hold urgent ones
(`inbox.tsx:211`), so it drops out and back on each switch and reflows the
one-line bar. Fix: keep the last rows while the new key loads (`aria-busy`,
dimmed after 300ms). Keep the chip mounted, disabled at 0.

## Medium

6. **The thread opens at its oldest message.** The only scroll is
   `root.scrollIntoView({block: 'nearest'})` (`conversation.tsx:312-315`). In
   a long thread the agent scrolls to find what the customer just wrote, and
   a message that arrives while they read gives no cue. Fix: open at the
   newest or first unread message, and show a "New message ↓" pill.
7. **Composer mode and resolve.** In note mode the button still says "Send"
   (`conversation.tsx:1137`), the wrong word for something the customer never
   sees. "Send and resolve" sits behind a chevron (`:1141`), so the most
   common end of the loop takes two clicks or a shortcut someone has to know.
   Fix: "Add note" in note mode, and put the shortcut in the button's title.
8. **The composer and the header change size as the agent works.** The three
   rewrite buttons mount on the first keystroke (`:1225`) and wrap the footer.
   The viewers line and "Customer sees" mount in the header (`:615-629`).
   Fix: one "Rewrite" menu, always there and disabled while the box is empty.
   Move viewers into the actions row.
9. **Bulk changes apply as soon as a select changes** (`inbox.tsx:574-605`).
   No confirm, no undo. On Windows an arrow key on a closed select fires
   `change`, which can resolve 100 conversations at once. Bulk reply's "Send"
   does not say how many customers it reaches. Fix: menu buttons, a confirm
   that states the count ("Resolve 12"), and an undo toast.
10. **The widget on phones.** Opening it focuses the search field
    (`widget.tsx:519-528`), so the keyboard covers half the sheet. The
    full-screen sheet has no `env(safe-area-inset-bottom)`
    (`widget/styles.ts:102`). Hover styles stay on after a tap: *verified*,
    the Help tab stays tinted after tapping the launcher. Fix: on
    `(pointer: coarse)`, focus the panel heading instead; add safe-area
    padding; put hover styles under `@media (hover: hover)`.
11. **The read-only viewer hears values without names.** The properties are a
    `<dl>` of `Property` divs whose labels are `aria-hidden`
    (`conversation.tsx:689-721`, `ui.tsx` `Property`). Fix: use `dt`/`dd`.
12. **The audit log disappears silently on error** (`settings.tsx:85`
    returns null). For a compliance buyer, a missing audit trail with no
    message is the worst way to fail. Fix: `LoadError` with retry.
13. **The lead form's placeholder is devguard's copy.** "We run ISO 27001 for
    12 clients… mandates" ships to every host in all four languages
    (`i18n.ts:90,718,1357,1984`). Fix: a neutral example.
14. **The launcher hides its unread count from screen readers.** Its
    `aria-label` replaces the visible badge (`widget.tsx:929-949`). Fix: add
    the count to the label.

## Low

- **German:** "Senden und lösen", "Ohne Antwort lösen" and "Lösen" are
  unidiomatic: use "erledigen", or the widget's "Als gelöst markieren".
  "Wartet auf Kunde" lacks its article and breaks the "Kundschaft"
  convention.
- **Italian:** sentences use Lei, buttons use tu ("Rispondi", "Smaltisci la
  coda", and "smaltire" reads as waste disposal). Pick one rule for buttons.
- **Error copy:** "Something went wrong." covers six or more cases; a failed
  AI draft shows as a send error (`conversation.tsx:1216,1246`).
- **Back button:** "← Inbox" still shows in the split pane, because the
  container query resolves against the 730px thread (`styles.ts:246`).
- **Confirmations:** three patterns: a modal, an inline second click with no
  danger styling (`settings.tsx:321-345`), and none (bulk).
- **Widget:** email validation bubbles appear in the browser's language
  (`widget.tsx:1369`). Every new message scrolls the thread to the end, even
  mid-read, and in inline mode `scrollIntoView` can move the host page
  (`:1754`). Nav labels are 11px.
- **Motion:** `.sa-note-input` still animates `height` (`styles.ts:137`).

## Quick wins and larger changes

Mechanical: 3, 11, 12, 13, 14, "Add note" (7), safe-area and hover (10), the
German strings and the back button. Need a design decision: pane height (1),
stale-while-revalidate and an offline state (2, 5), optimistic properties (4),
where a thread opens (6), bulk confirm and undo (9), a stable composer (8).

## Already good

The filter tray opens only on click, with a count on its button. The list
stays mounted beside the thread and keeps its cursor. Skeletons wait 300ms
and keep their space. Drafts persist per conversation. Reply or Note is chosen
first. Focus rings, Escape back to the row, and switchable single-key
shortcuts (WCAG 2.1.4). Native dialogs with Cancel focused. Empty states tell
"filtered out" from "empty". Widget errors keep the draft. The four languages
are typed for parity.
