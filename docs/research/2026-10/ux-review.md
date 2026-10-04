# Better Helpdesk: UX and visual craft review (Preserve mode)

Reviewed 2 October 2026 against the demo screenshots at 1440×900 and the
source at `main` (`4571983`). Mode is **Preserve**: information architecture,
labels, routes, form field order and behaviour stay; craft, hierarchy, states,
density, motion and microcopy may move. No files under `src/` were edited.

Files read: `CONTEXT.md`, `docs/product.md`, `README.md` (Theming),
`src/admin/styles.ts`, `src/widget/styles.ts`, `src/admin/index.tsx`,
`src/admin/inbox.tsx`, `src/admin/conversation.tsx`, `src/admin/ui.tsx`,
`src/admin/context.tsx`, `src/admin/settings.tsx`, `src/admin/crm.tsx` and
`src/admin/deals.tsx` and `src/admin/canned.tsx` (skimmed),
`src/widget/widget.tsx`, `src/ui/rich-editor.tsx` (skimmed), `src/ui/api.ts`
(`useResource`), `src/ui/icons.ts`, `src/ui/i18n.ts`,
`examples/demo/app/demo.css`, `examples/demo/app/helpdesk/[[...slug]]/page.tsx`.
There is no `docs/ui.md` or other binding design document; the constraints in
the brief (theme only through `--helpdesk-*`, CSS strings, no dependency, both
languages, accessibility bar) are the canon this pass runs inside.

**What could not be verified.** No phone or tablet screenshots exist; every
responsive statement below comes from reading the media queries and is marked
"(from CSS)". Dark mode was not captured either; the one dark finding is also
from CSS. Nothing in the demo exercised the AI suggestion strip
(`.sa-suggest`), the deal cards, the canned-reply popover with entries, the
screenshot redactor, the help-article box or the "away" states.

---

## 1. Brief, dials and locks

**Brief, one line.** A dense, all-day support inbox and a small customer
widget, both rendered inside a host product's chrome in the host's font and
colours, for a two-to-five person B2B support team and the customers who write
to them; it must feel like a native part of a serious product, never like a
third-party chat bubble.

**Dials, inherited from the current UI.**

| Dial | Admin | Widget | Why it fits |
|---|---|---|---|
| Variance | 3 | 2 | A table, a thread, a column of cards. Agents scan the same screen hundreds of times a day; a layout that rearranges itself costs them seconds each time. The widget's variance is lower still because it is a guest in the host's page. |
| Motion | 3 | 3 | State feedback only (press, marker, panel arrival). Nothing choreographed, because a support agent reads this screen while a customer waits. Motion above 4 would have to actually move, and there is nothing here that should. |
| Density | 6 | 4 | The inbox is a working list: 6 rows per 400px with a preview line each (07). That is right for the job; Linear and Libredesk sit here. The widget is a form a stranger fills once; it stays airier. |

**Locks.**

1. **One accent.** The host's `--helpdesk-accent`, used for: the selected
   segment, primary buttons, the agent's message rule, the active nav marker,
   the active table row. It is not used for anything decorative. (Finding
   C-3 below: the focus colour is currently doing accent work in five places
   and must stop.)
2. **One radius system.** Everything derives from `--helpdesk-radius`
   (admin default 10px, widget 12px): outer surfaces at the token, controls at
   token−2, inner elements at token−4, the dialog at token+4, pills at 999.
   Today the values are right by hand (10/8/7/6/14) but not derived, so a host
   that sets `--helpdesk-radius: 4px` gets 4px cards next to 8px buttons.
3. **One theme at a time.** The host decides light or dark through the
   variables; the package never flips a surface on its own. The widget's
   `theme="auto"` only applies when no variables are set.

**Reference the design should feel like:** Linear's issue view and sidebar,
in the host's colours. Not because it is fashionable, but because it is the
one product that proves a dense property list (status, priority, assignee as
quiet inline selects) and a long reading column can share a screen without
either shouting, and because it reads as serious to the B2B buyers the design
partners sell to. For the widget: Intercom's Messenger home (team avatars plus
an expected reply time at the top), which the widget already has in `.presence`.

---

## 2. Fingerprint inventory

Walked over `src/admin/styles.ts` (A) and `src/widget/styles.ts` (W). Line
numbers refer to those files unless another is named.

### Type

| # | Finding | Evidence |
|---|---|---|
| T-1 | **Already good.** The package ships no font and inherits the host's (`--helpdesk-font`). The admin does not even set `font-family`, so it inherits by default; the widget falls back to `system-ui`. | A:18–20 (no font-family), W:19 |
| T-2 | Admin scale is 12/13/14/17/18 with 1.08× steps; nothing is "display" and nothing is "fine", so hierarchy leans on weight and colour alone. | A:19 (14), A:45 nav 13, A:114 h3 12, A:151 h2 18, A:241 dialog h2 17, A:139 muted 13, A:140 fine 12 |
| T-3 | Weights are 400/500/600/700, so the "only 400 and 700" tell is absent. The single 700 is the waiting row's title (A:126) and avatar initials (A:147). | 07: bold titles on every row because every row is waiting |
| T-4 | No measure on message bodies. `.sa-msg-body` fills the thread column; in a host that gives the admin the full viewport that is 100+ characters a line at 14px. | A:176; 16 shows ~95ch at 1440 |
| T-5 | Tabular figures exist (`.num`) and are applied to references and the Waiting cell, but not to the pill text inside it, nor to deal column totals. | A:29, inbox.tsx:332, deals.tsx:98 |
| T-6 | Widget `.msg-meta` is 11px at 75% opacity, and on the accent bubble ("You · just now", 06) the blended contrast is under 4.5:1 in the demo palette. | W:261, 06 |
| T-7 | **Already good.** Sentence case everywhere, no exclamation marks, no title case. German is Swiss Standard ("schliessen", W/i18n). | i18n.ts |

### Colour

| # | Finding | Evidence |
|---|---|---|
| C-1 | Default greys are one cool family (navy-tinted) in both UIs, but the two stylesheets ship different defaults for the same variable: border `#e6e9ef` (A:9) vs `#d9e2ec` (W:9), subtle `#f6f7f9` (A:10) vs `#f0f4f8` (W:11). A host that sets nothing gets two shades of the same product. | A:3–17, W:3–18 |
| C-2 | Shadows are untinted black in the widget (`rgb(0 0 0 / .25)` launcher W:37, `.22` panel W:73, `.12` menu W:272) and tinted to the *default* navy in the admin regardless of the host's ink (`rgb(12 32 52 / 0.12)` A:208, A:239; `rgb(0 0 0 / .25)` dialog A:229). On the demo's warm cream, a navy shadow is a second grey family. | 02 panel shadow; 08 has no popover open |
| C-3 | The focus colour (`--helpdesk-focus`, default `#f55068` pink) does accent work: the widget's selected tab underline (W:116), the unread dot (W:117, W:249), the agent ping dot and its note surface (W:44–49), and the admin's AI sparkle (A:185). In the demo focus = accent so this is invisible; in the default palette navy + pink is two accents, and a host that sets a high-contrast focus colour for accessibility gets that colour on every unread dot. | W:44–49, 116–117, 249; A:185 |
| C-4 | The internal-note surface defaults to a literal cream `#fffbea` (A:12). In a dark host that does not set `--helpdesk-note` (the demo's dark theme does not), notes render light text on cream. (From CSS; not captured.) | A:12, A:179; demo.css dark block sets no `--helpdesk-note` |
| C-5 | **Already good.** Status and priority tones are restrained: open/pending/resolved differ by text colour only, high/urgent are outlined pills in warn/danger, nothing is filled red. The type tile colours (bug danger at 10%, feature warn at 12%, lead accent at 8%) are the one place colour carries meaning, and it is quiet. | A:96–103, 131–135, 141–145; 07 |
| C-6 | **Already good.** Agent messages are marked by a 2px accent rule on the left of a subtle surface, not by a filled bubble, so a long agent reply stays readable; the internal note is a dashed amber box. Both are the right Chatwoot-style cues. | A:177–179; 16 |

### Layout

| # | Finding | Evidence |
|---|---|---|
| L-1 | The admin has no container of its own; it fills whatever the host gives it. That is correct for an embedded library, but the aside is a fixed 320px and the split collapses on a *viewport* media query at 1100px (A:154–155), not on the container's width. A host that mounts the admin in a 900px column at a 1440px viewport gets a 580px thread and a 320px aside with no way to collapse it. | A:154–155 |
| L-2 | Radii are consistent by hand (10 outer, 8 controls, 7 segment inner, 6 toolbar, 14 dialog) but none is derived from `--a-radius` except the outer ones. | A:72, 85, 108–109, 172, 229 |
| L-3 | The conversation's property selects (Status, Priority, Type, Inbox, Assignee) wrap to a second line at 1440 inside the demo's 1180px card, leaving "Unassigned" alone on its row. They use the identical `.sa-select` as the inbox's *filter* selects (07 vs 08): same look, opposite meaning (one narrows a list, one mutates a record). | 07, 08; conversation.tsx:248–288 |
| L-4 | The composer footer's keyboard hint wraps mid-phrase ("Send and / resolve") at 1440. | 08, 16; conversation.tsx:498–501, A:217 |
| L-5 | The inbox toolbar wraps to two rows at 1440 (07) with "Set away…" (an agent setting) sitting among list filters. | 07; inbox.tsx:147 |
| L-6 | The widget panel is a fixed `min(640px, …)` tall in every view (W:70). Home shows four 60px cards and ~300px of empty white (02, 04); the thread after a first send shows one bubble, one notice and ~200px of void (06). | W:70; 02, 04, 06 |
| L-7 | **Already good.** The segmented control is concentric (radius 10, padding 3, inner 7: A:108–109) and sized 36px to share a row with inputs (comment at A:107). The nav rail is a rail, not a glued bar: it sits inside the host's card on a hairline with a scaleX marker (A:36–67). The composer's upward fade (`0 -8px 24px` of the bg colour, A:189) lets the thread disappear under the sticky composer without a hard edge. These are the deliberate parts. |
| L-8 | **Already good.** Table columns appear only when they carry information: Status hides when the list is filtered to one status, Priority appears only when any row is high or urgent (inbox.tsx:163–164, 268–270). |
| L-9 | (From CSS) `.sa-table-wrap` is `overflow: hidden` (A:116) and `th` is `white-space: nowrap` (A:120); the admin has no rule below 720px except the nav mask. At 375px the five-column table is clipped, not scrolled, and the 36px controls stay 36px. |

### States

| # | Finding | Evidence |
|---|---|---|
| S-1 | Pressed states exist only on the nav tabs (A:56) and the launcher (W:41). `.sa-btn`, `.sa-primary`, `.sa-seg button`, `.sa-deal`, `.sa-slash button`, the widget's `.type`, `.item`, `.primary`, `.secondary`, `.send`, `.choice` have hover but no `:active`. | A:84–95, 109, 214, 225; W:127–133, 193–204, 237–241, 268 |
| S-2 | **Already good.** A visible focus ring on every control, in both UIs, with the inset offset where a scroll container would clip it (A:28, A:60, A:82, W:31, W:60, W:152, W:165, W:175, W:186). The widget traps focus on phones and locks body scroll (widget.tsx:168–185, 323–331). |
| S-3 | Loading is the string "Loading…" in an empty box (`Loading` in ui.tsx:28–34; inbox.tsx:156–160). Opening a conversation blanks the whole view to that string, then the full layout lands: a visible layout shift on every open. `useResource` keeps data across polls (api.ts:69–82), so only navigations blank. | ui.tsx:28, conversation.tsx:122 |
| S-4 | Empty is "Nothing here yet." in the inbox, contacts, companies and canned replies (01, 10, 12), regardless of whether the list is empty or the filter excludes everything. The deals board ("Drag a deal here", 11) and the timeline ("Notes, calls and meetings you log appear here.", 14) are the good ones: they say how to fill the space. | i18n `admin.empty`; 01, 11, 12, 14 |
| S-5 | Error is one string, "Something went wrong.", with no retry and no distinction between "could not load" and "could not save" (`admin.error` used in index.tsx:128, inbox.tsx:155, conversation.tsx:120, 450). The widget's errors are better: inline, under the composer, with the draft kept (widget.tsx:1369–1373). |
| S-6 | Sending has no visible state in the admin: `busy === 'send'` only disables the buttons; the label stays "Send". The widget says "Sending…" (`form.sending`). | conversation.tsx:510–516 |
| S-7 | Three easing families: `cubic-bezier(0.2, 0, 0, 1)` (A:46), browser default `ease` (A:109 `120ms`, A:161, W:39, W:42, W:131, W:181) and `cubic-bezier(0.16, 1, 0.3, 1)` (W:75). One height animation: `.sa-note-input` transitions `min-height` and `height` (A:100), against the transform-and-opacity rule. Reduced motion is honoured for the nav, the panel, the switch and the ping, not for the details chevron, the segment, the type card or the note input. |
| S-8 | The toast appears and vanishes instantly (A:246), fixed to the viewport bottom-centre. |

### Content

**Already good** throughout: sentence case, no exclamation marks, lived-in
demo data (HRB-1001…1006, "14 containers arriving Thursday", a German row,
uneven timestamps). Two findings:

- CT-1: Two promises in one view. The widget header says "We answer within a
  few hours on weekdays." and the confirmation notice under the first message
  says "We'll get back to you as soon as possible." (06). The second is vaguer
  and competes with the host's own promise.
- CT-2: The composer's placeholder carries the mode ("Reply · Type / for
  canned replies") while the mode switch sits below the editor (08). A
  placeholder is doing a label's job.

### Clichés

None of the listed ones. No three equal feature cards, no modal for
everything (the native `<dialog>` is used for create forms only), no pills on
everything. The deals board is five equal columns (11), which is what a
pipeline is.

### Icons

**Already good.** One set, one stroke (`strokeWidth="2"`, round caps) drawn
in-house for the four types plus a dozen UI glyphs (`src/ui/icons.ts`,
`admin/ui.tsx:3–26`, `widget.tsx:141–152`), sized by CSS to the text beside
them (15/16/18/20/24). The one break: the widget's "more" menu bumps its
stroke to 3.5 (W:100) so three dots read at 20px. Acceptable, and documented
by the selector.

### Hygiene

- H-1: Inline styles in three places: `style={{ marginTop: 6 }}` (crm.tsx:339),
  `style={{ justifySelf: 'start' }}` (conversation.tsx:551, crm.tsx:957),
  the honeypot's off-screen position (widget.tsx:893, acceptable).
- H-2: `!important` in `.sa-note-input` (A:100–101) to beat `.sa-textarea`.
- H-3: Z-indexes are small and named by role (1 composer, 2 widget menu, 5
  menu, 20 canned popover, 50 toast) except the widget host's `2147483000`
  (W:24), which is the standard "above everything on the host page" value and
  is right for a widget.
- H-4: Shadow values, the dialog's 14px radius and the toast's 8px are
  literals rather than derived from the tokens.

### Forgotten

- A way back exists from every admin page (`.sa-back`) and the widget (header
  back). Deep links exist for every screen (`context.tsx:79–98`).
- The conversation's `TitleEditor` is a button that looks like text; the only
  affordance is a hover background and a `title` tooltip (A:253–254). An agent
  does not discover renaming.
- No "someone else is viewing" (collision) cue and no per-agent unread marker:
  bold rows mean *waiting on the team* (A:126, inbox.tsx:329), which is a sound
  choice for a small team, but it is not what bold means in every other inbox
  an agent uses. It needs to be said in the README's Inbox section, not
  changed.
- The inbox nav tab carries no count. The widget already computes
  `agent.waiting` for a signed-in agent (widget.tsx:332); the admin's own rail
  does not show it.

---

## 3. Wayfinding and workflow findings

### An agent's day

1. **Inbox → conversation → back is a full page swap.** Opening a row
   unmounts the list, blanks to "Loading…" (S-3), renders the thread; "< Inbox"
   remounts the list, which refetches (inbox.tsx:44–51) and loses the j/k
   cursor (`activeId` is component state, inbox.tsx:265). Across forty
   conversations a day that is forty blank flashes and forty lost positions.
   The route already keeps the filters in the query string
   (`/conversations/<id>/?status=open&assignee=me`), so a split layout costs
   no routing work.
2. **Triage controls look like filters** (L-3). The five selects above the
   thread are the same component, size and position as the five filters above
   the table. An agent who just left the inbox reads "Status: Open" as the
   filter they set, not as the record's state.
3. **The composer decides the mode last.** Reply / Internal note sits in the
   footer (08, 15). The amber surface is a good mode cue once chosen, but the
   choice is made after typing starts; Zendesk, Intercom and Chatwoot all put
   it first. CT-2 follows from this.
4. **"Send and resolve" is the right button, not a split button.** Two plain
   buttons with ⌘↵ and ⌘⇧↵ (conversation.tsx:498–516) beat Zendesk's "Submit
   as…" dropdown; keep them. The hint text's wrap (L-4) is the only fault.
5. **The context panel is the differentiator and it is already right.**
   Captured context (page, title, browser, window size, language, app
   version, referrer, raw UA and errors behind `<details>`; 08) is what
   Intercom charges for in an app. Contact, Company (with "Create company
   nordwind.test" from the domain), Participants: the order is right. What
   it lacks is a way to collapse it (L-1) and the property list (finding 2)
   that would make it the single "about this conversation" column.
6. **CRM pages are tables and cards that do their job** (09, 10, 14). The
   contact view's tray-and-cards (summary, Timeline, Conversations, Company,
   Deals, Identities) is the cleanest screen in the product. Companies with
   one row and three empty columns (10) is only an empty-state problem.
   Deals (11) at five columns is fine at 1180px; (from CSS) under 1100px it
   becomes a horizontal scroll of 220px columns (A:221), which is right.
7. **Empty states do not teach** (S-4). "Nothing here yet." on an inbox that
   is filtered to Status: Open does not tell a new agent that resolved
   conversations exist, nor that the first message will arrive from the widget
   or email.
8. **Freshness is quiet, which is right, and slightly too quiet.** The list
   polls every 10s, the thread every 5s, both only while the tab is visible
   (api.ts:75–81), and every agent mutation fires `HELPDESK_CHANGED` for an
   immediate refetch (index.tsx:62–66). A new customer message simply appears
   in the thread with no cue and no scroll (the admin has no `scrollIntoView`;
   the widget does, widget.tsx:1199–1205). The list re-sorts under the cursor
   (handled by id, inbox.tsx:264–267). Nothing tells an agent that a colleague
   has the same conversation open; for a team of two to five that is a real
   collision risk but a server feature, not a design one (left out, §6).
9. **"Set away…" is misplaced** (L-5). It changes what the widget promises
   customers; it is about the agent, not the list. It belongs with the agent's
   identity, which in this UI is the nav rail.
10. **Keyboard.** j/k/Enter in the list, ⌘↵ / ⌘⇧↵ in the composer, / for
    canned replies with arrow keys, Escape everywhere: the right set for v1,
    and tested (inbox.test.tsx). The j/k guard (inbox.tsx:276–281) does not
    cover `contenteditable`, which does not matter today because the editor
    is never mounted next to the list; it becomes a bug the moment a split
    layout mounts both (work item 1).

### A customer in the widget

1. **Home (02, 04) is honest and short**: the host's title, team avatar and
   reply promise in the header, four typed entry points with a hint each. It
   is Intercom's home without the marketing. The 300px of white under the
   cards (L-6) is the only fault; it reads as "something failed to load".
2. **The anonymous bug form (03) is six controls tall** before the fold:
   message (with a formatting toolbar), work email, name, subject, screenshot,
   attach, and then the context-review box is cut off at the bottom edge of
   the scroll area (the sliver at y≈605). Field names and order are Preserve
   locks, so the lever is rhythm, not the list: the toolbar under the message
   is six icons a bug reporter will not use (bold a bug report?), and the
   context box deserves to be visible without scrolling because it is the
   privacy-relevant part.
3. **The privacy line.** It renders inside the pinned footer, above the Send
   button (widget.tsx:1064–1070), so it is not under the fold when it exists.
   At 03 it does not render at all, which means the demo inbox sets no
   `privacyUrl`. Two things follow: the demo should set one so the line is
   seen, and the context-review box ("5 details about this page · Review"),
   which *is* the data-sharing disclosure, is the thing under the fold.
4. **The signed-in Question form (05)** is right: message, subject, share
   toggle, screenshot/attach, context box visible. The share toggle's label
   "Share with my organization" sits left with the switch far right across
   the full width; fine at 400px.
5. **After sending (06)** the customer sees their own bubble in the accent,
   then a grey notice "Thank you for your question / We'll get back to you as
   soon as possible. You'll be notified at … and here, under HRB-1006." That
   is the right content. Two faults: CT-1 (the promise competes with the
   header's), and the notice's 13px on `--s-subtle` is the same surface as an
   agent message would be, so the first real reply will look like a second
   system notice.
6. **The thread** uses chat bubbles (own = accent, right; theirs = subtle,
   left with an agent avatar), Enter to send, Shift+Enter for a line. The
   meta line's contrast (T-6) is the only accessibility fault found in the
   widget from the screenshots.
7. **(From CSS) On a phone** the panel becomes a full-screen sheet with no
   radius, the launcher hides, inputs go to 16px to stop iOS zoom, and the
   `.choice` rows grow to 44px (W:83–87, W:151). The tabs (`.tabs button`,
   12px padding ≈ 41px, W:112–115) and the secondary buttons (36px, W:199–202)
   stay under 44px. Not captured.

---

## 4. Proposals

Sizes: S under a day, M a few days, L a week or more, as the brief defines
them.

### (a) Type scale, weights, hierarchy

**What changes.** A scale with real steps instead of 1.08×, applied to the
existing selectors; the host font stays.

| Selector | Now | Proposed |
|---|---|---|
| `.sa` base | 14px / 1.45 | 14px / 1.45 (unchanged; dense tool) |
| `.sa-msg-body` | inherits 14/1.45, no measure | 14px / 1.55, `max-width: 72ch` |
| `.sa-page-head h2` | 18px / 600 / lh 32px | 20px / 600 / `letter-spacing: -0.01em` / lh 32px (so `.sa-back` still aligns) |
| `.sa-card > h3` | 12px / 600 / uppercase / 0.04em | 11px / 600 / uppercase / 0.06em (an eyebrow, one per card; the only eyebrow pattern in the UI) |
| `.sa-table th` | 13px / 600 on `--a-head` fill | 11px / 600 / uppercase / 0.06em / `--a-muted` on `--a-subtle` (same eyebrow as the cards, so heads stop reading as a bar) |
| `.sa-pill` | 12 / 600 | 12 / 600 + `font-variant-numeric: tabular-nums` |
| `.sa-fine` | 12 | 12, floor; nothing below 12 anywhere |
| `.sa-dialog h2` | 17 / 600 | 20 / 600 (same as page title; one title size) |
| `.sa-summary h2` (contact view) | 18 / 600 | 20 / 600 |
| `.sa-waiting .sa-cell-title a` | 700 | 700 (kept on purpose as the single 700) |
| `.sa-avatar` | 11 / 700 | 11 / 600 |
| widget `:host` | 14 / 1.45 | unchanged |
| widget `.head-title` | 16 / 600 | 16 / 600 / `letter-spacing: -0.01em` |
| widget `.msg` | 14 / inherits 1.45 | 14 / 1.5 |
| widget `.msg-meta` | 11px, opacity .75 | 12px, opacity 1, colour `color-mix(in srgb, currentColor 78%, transparent)` on theirs; on `.mine` keep `currentColor` at 100% (the accent-fg already contrasts) |
| widget `.notice` | 13 | 13 for the body, `strong` 14 (so the first real reply at 14 does not look smaller than the notice) |

**Why.** Hierarchy by size first, then weight, then colour. The admin uses
weight and colour for everything today because the sizes are a whisper apart.
**Files.** `src/admin/styles.ts`, `src/widget/styles.ts`. **Size.** S.

### (b) Surfaces, radii, shadows, nesting

**Radii derived from the token** (both files), clamped so a host's `4px`
still works:

```
.sa { --a-r: var(--a-radius); --a-r-ctl: max(4px, calc(var(--a-radius) - 2px));
      --a-r-in: max(3px, calc(var(--a-radius) - 4px)); --a-r-out: calc(var(--a-radius) + 4px); }
```
`.sa-card`, `.sa-table-wrap`, `.sa-msg-body`, `.sa-composer`, `.sa-column`,
`.sa-suggest`, `.sa-drop-hint` → `--a-r`; `.sa-input/.sa-select/.sa-textarea`,
`.sa-btn`, `.sa-deal`, `.rt-dialog`, `.sa-slash` → `--a-r-ctl`; `.rt-toolbar
button`, `.sa-slash button`, `.sa-type`, `.sa-details pre`, `.sa-title-edit` →
`--a-r-in`; `.sa-dialog` → `--a-r-out`; `.sa-seg` stays `--a-r` with its 3px
padding and inner `calc(var(--a-r) - 3px)` (already concentric). Widget the
same with `--s-radius` (12): `.panel` 12, `.type/.item/.box/.notice/.menu-pop`
10, inputs and buttons 8, `.msg` `calc(var(--s-radius) + 2px)`, toolbar 6.

**Hairlines at alpha by default** so the untouched package already looks
tone-on-tone: `--a-border: var(--helpdesk-border, color-mix(in srgb, var(--a-fg)
10%, transparent))`, same in the widget (`--s-fg` 12%). The host override wins
as before. This also unifies C-1: one default per variable, computed from fg.

**Shadows tinted by the host's ink, lit from above:**
- `.sa-canned-pop`, `.sa-menu-pop`: `0 8px 24px -8px color-mix(in srgb, var(--a-fg) 18%, transparent)`.
- `.sa-dialog`: `0 24px 64px -24px color-mix(in srgb, var(--a-fg) 40%, transparent)`.
- widget `.panel`: `0 16px 48px -16px color-mix(in srgb, var(--s-fg) 30%, transparent)`; `.launcher`: `0 8px 24px -8px color-mix(in srgb, var(--s-fg) 32%, transparent)`; `.menu-pop` `0 8px 24px -8px … 18%`.
In a dark host, `--s-fg` is light, so the shadow becomes a faint light halo;
add `, inset 0 1px 0 color-mix(in srgb, var(--s-fg) 6%, transparent)` on
`.panel` and `.sa-dialog` for the inner top highlight that dark surfaces need.

**Note surface that survives dark hosts (C-4):**
`--a-note: var(--helpdesk-note, color-mix(in srgb, var(--a-note-border) 10%, var(--a-bg)))`.
Light: cream. Dark: a dim amber on the dark bg. The host override still wins.

**Nesting, admin.** The composer becomes a tray with a core: `.sa-composer`
background `color-mix(in srgb, var(--a-subtle) 55%, var(--a-bg))`, padding 10
→ 8, and `.rt-composer` gets its own `background: var(--a-bg)`, hairline
border and radius `calc(var(--a-r) - 8px)` so the corners are concentric. The
internal-note tint stays on the tray (`[data-internal="true"]`), with the core
at `var(--a-bg)` so typing surface never turns yellow (readability of long
notes). Message bodies stay flat on the thread (a card inside a card inside
the host's card would be three deep, which the skill forbids). The table and
the cards keep their single hairline.

**Nesting, widget.** The panel is the tray (host `--s-bg`); the type cards
and items are flat on it today. Change `.type` and `.item` to tone-on-tone:
`background: color-mix(in srgb, var(--s-subtle) 60%, var(--s-bg))`, border
`transparent`, hover border `--s-border`, pressed `translateY(1px)`. Four
bordered white cards on white (02) is the template tell; four soft tiles is
not.

**Table head (T-8 above)** on `--a-subtle` not `--a-head`; `--a-head` stays
for avatars so the documented variable keeps a job.

**Files.** `src/admin/styles.ts`, `src/widget/styles.ts`, README Theming (one
sentence that defaults are now derived from `--helpdesk-fg`). **Size.** S for
radii and shadows, S for the note surface, M for the two nesting changes
together (they need screenshots at three widths and both themes).

### (c) Pressed, focus, loading, empty, error states

**Pressed (S).** One rule set, both files:
`.sa-btn:active, .sa .sa-seg button:active, .sa-slash button:active,
.sa-deal:active, .sa .sa-nav button:active { transform: translateY(1px); }`;
widget `.type:active, .item:active, .primary:active, .secondary:active,
.choice:active { transform: translateY(1px); } .send:active { transform:
scale(0.94); }`. Hover on `.sa-primary` keeps the colour change; the press is
the physical part.

**Focus (S).** Already present. Add `tr:focus-within td { background:
var(--a-subtle); }` so a Tab user sees which row holds the focused link, the
same way a j/k user sees the cursor. Do not move focus with j/k (it would
trigger the handler's own guard).

**Loading (M).** Replace `Loading` (ui.tsx:28) with skeletons shaped like the
final layout, in `src/admin/ui.tsx` as `<Skeleton kind="table" | "thread">`:
- table: five rows, each a 26px tile, a 55% bar and a 30% bar, inside
  `.sa-table-wrap`;
- thread: a page-head bar, two message blocks (28px circle, 40% header bar,
  3-line body), the composer at its real height, and in the aside three card
  outlines with an eyebrow bar and two rows.
CSS: `.sa-skel { background: var(--a-subtle); border-radius: var(--a-r-in);
animation: sa-pulse 1.2s var(--a-ease) infinite alternate; } @keyframes
sa-pulse { to { opacity: .55 } }` — opacity only; reduced motion → no
animation. `aria-busy="true"` stays on the wrapper. The thread skeleton
removes the layout shift (S-3) because the aside's width is reserved from the
first frame.

**Empty (S, copy in (f)).** One `<Empty title body action?>` in `ui.tsx`
used by inbox, contacts, companies, canned; it keeps the table's border so
the surface does not collapse. The inbox distinguishes "no conversations at
all" from "nothing matches these filters" by whether any filter differs from
the defaults (`assignee`, `inbox`, `q`, `priority` set, or `status !== 'open'`)
and offers a "Clear filters" button (`navigate({})`) in the second case.

**Error (S, copy in (f)).** `admin.errorRetry` + a "Try again" button that
calls the resource's `refresh` where a *load* failed (index.tsx:126,
inbox.tsx:155, conversation.tsx:120); `admin.error` stays for saves. Rendered
as `.sa-notice[data-tone="danger"]`: a hairline box in `color-mix(in srgb,
var(--a-danger) 8%, var(--a-bg))`, not bare red text on white.

**Sending (S).** `busy === 'send'` swaps the primary's label to
`admin.sending`; the "Sent" toast stays.

### (d) Layout

**d-1. Split list + thread when the container is wide enough (L).** This is
the one proposal that changes how a day feels. Mechanism, inside a host
container:

1. `.sa` root (index.tsx:147) gets `container-type: inline-size;
   container-name: helpdesk`. Every `@media (max-width: 1100px)`,
   `(max-width: 720px)` and `(max-width: 1400px)` in `admin/styles.ts`
   becomes `@container helpdesk (max-width: …)`. Container queries are
   baseline since 2023 and the package already requires React 19 and Node 20;
   a browser without them gets the wide layout, which is today's behaviour.
2. `index.tsx`: when `route.conversation` is set, render `<Inbox
   selected={route.conversation} />` *and* `<ConversationView>` inside a
   `.sa-shell` grid instead of swapping them. CSS decides the arrangement:
   - `@container helpdesk (min-width: 1180px)`: `grid-template-columns:
     380px minmax(0, 1fr)`; the list pane is sticky (`top: 0; max-height:
     100dvh; overflow: auto`), the thread scrolls the page; the aside shows.
   - `(min-width: 900px) and (max-width: 1179px)`: same two panes, the aside
     collapsed into a "Details" toggle (d-2).
   - `(max-width: 899px)`: `.sa-shell` shows only the thread when a
     conversation is selected, only the list otherwise (today's behaviour);
     `.sa-back` visible only here.
3. In the split, the list is a row list, not the table: a new
   `ConversationList` in `inbox.tsx` sharing the row data and the j/k hook
   with `ConversationTable`; each row is the title cell as it exists
   (`.sa-cell` with the type tile, reference, title, preview, "Question ·
   Support") plus the waiting pill top-right and the contact's initials. The
   selected row carries `data-active` and `aria-current="page"`. The table
   stays for the single-pane case and for the contact view.
4. Keyboard: j/k keep working while the thread is open; the guard in
   inbox.tsx:276 adds `target.isContentEditable` so typing a "j" in the
   composer never moves the cursor. Enter opens; Escape in the thread returns
   focus to the list (new, S). Opening by j/k while already in split mode
   only changes the right pane; the list keeps scroll and cursor because it
   no longer unmounts.
5. The inbox's `useResource` keeps polling the list in split mode (same 10s);
   the thread's 5s poll is unchanged.

Acceptance and the issue text are in §5, item 1.

**d-2. A collapsible context aside (M).** A `Details` toggle button at the
right end of `.sa-page-head`, `aria-expanded`, `aria-controls` the aside;
state in `localStorage['helpdesk.aside']` (`try/catch`, default open when
`min-width: 1180px`, closed below). Collapsed, the aside is `display: none`
and the thread column takes the width; the measure in (a) stops the text from
running wide. On narrow containers the aside is already below the thread; the
toggle hides it there too.

**d-3. Properties into the aside (M; the one real design decision).** The
five selects (conversation.tsx:248–288) move to a first card in the aside,
`h3` = `admin.properties`, rendered as a `dl`-like list: label (11px eyebrow,
muted) above a borderless `select.sa-select.sa-prop` (`border-color:
transparent; background: transparent; padding-left: 0; height: 32px`) that
gains the hairline on hover and the focus ring on focus. The `Select` helper
keeps prefixing the option text with its label ("Status: Open") so the closed
control still names itself when a host renders it elsewhere, but visually the
label is the eyebrow. On containers under 900px the same card renders first,
above the thread, as a two-column grid, so a phone sees status and assignee
before the first message. Why: it removes the filter/property confusion
(L-3), fixes the wrap (L-3), and makes the aside the one "about this
conversation" column, the way Linear and Libredesk do it. Risk: agents in the
pilot expect the row; test it with the two design partners before merging
(the riskiest assumption, §7).

**d-4. Composer (S).** Reorder inside `.sa-composer`: top row = the Reply /
Internal note segment left, Canned replies and Draft with AI right (`.sa-
composer-head`, `display:flex; justify-content: space-between`); then the
editor with its toolbar; then `.sa-composer-foot` = the shortcut hint
(`white-space: nowrap`, hidden under 900px container) pushed left, "Send and
resolve" and "Send" right. The placeholder becomes just `admin.slashHint`
("Type / for canned replies"); the mode is named by the segment above. The
amber tint stays. Mode before text, every time.

**d-5. Away control into the rail (S).** `AwayControl` renders at the right
end of `.sa-nav` (`margin-left: auto`) when the package renders the nav, and
falls back to its current toolbar slot when `nav={false}`. It is the one
agent-level control and the rail is the one agent-level row.

**d-6. Widget panel height per view (S).** `.panel[data-view="home"],
.panel[data-view="form"] { height: auto; max-height: min(640px, calc(100vh -
100px - var(--s-offset))); }`; list and thread keep the fixed height so the
composer sits at the bottom and the list scrolls. The panel is anchored at
`bottom: 72px`, so it grows upward and the launcher never moves. No height
animation (guardrail); the view already re-renders. Phones are unaffected
(`inset: 0`).

**d-7. Widget form rhythm (S, within the Preserve locks).** No reorder. The
message editor's toolbar collapses to a single "Aa" toggle on the bug and
feature forms (`toolbar` prop already exists on `RichEditor`; the Question
form keeps it), which returns ~36px; the context-review `details.box` gets
`margin-top: auto` inside `.body` so it pins to the bottom of the scroll
area and is visible at 640px without scrolling for the anonymous bug form.
The demo sets `privacyUrl` so the footer line is seen.

### (e) Motion

One curve, one duration table, in both files, zeroed under reduced motion
the way `demo.css` already does it:

```
.sa { --a-ease: cubic-bezier(0.2, 0, 0, 1); --a-state: 150ms; --a-arrive: 240ms; }
@media (prefers-reduced-motion: reduce) { .sa { --a-state: 1ms; --a-arrive: 1ms; } .sa * { animation: none !important; } }
```
(widget: `:host`, `--s-ease`, same values.) Every `transition:` and
`animation:` then references the variables, which removes the three easing
families (S-7) and the forgotten reduced-motion cases in one diff.

| Motion | Justification | Reduced motion |
|---|---|---|
| Nav marker `scaleX` 150ms (exists) | State change: which section | none (instant) |
| Press `translateY(1px)` 150ms (new) | Feedback: the button took the click | none |
| Widget panel fade-up 8px, 240ms (exists, re-timed) | Arrival: the panel came from the launcher | plain fade 120ms (exists) |
| Widget view change: incoming view `opacity 0→1` 150ms (new, `.panel > [data-view]`) | Feedback that back/forward happened; no slide, because a slide implies a stack the widget does not have | none |
| Toast fade-up 6px 150ms in, fade 150ms out (new) | Arrival of a confirmation the agent did not click | fade only |
| New message in the admin thread: `opacity 0→1` 240ms on `article[data-new]` (new; the id was absent from the previous poll) | Story: "this just arrived while you were reading"; it is the only cue the poll gives | none |
| Skeleton pulse, opacity .55↔1 (new) | Loading state that reads as alive | static |
| Details chevron rotate 150ms (exists) | State: open/closed | none |
| Switch thumb translate 150ms (exists) | State | none (exists) |
| Agent ping on the launcher dot, 4s loop (exists) | Attention: the only continuous motion, and only for a signed-in agent | off (exists) |
| `.sa-note-input` height transition (exists) | Removed: animates height | — |

Nothing scrolls, nothing parallaxes, nothing staggers in the admin: a list
that animates in every time it refetches would be noise on a 10s poll.

**Files.** both `styles.ts`; `conversation.tsx` for `data-new` (a `Set` of
seen ids in a ref, S). **Size.** S for the variables and the table; S for the
new-message cue.

### (f) Microcopy

All additions; existing keys change only where stated. Swiss Standard German,
"Sie".

| Key | en | de |
|---|---|---|
| `admin.emptyInbox` | No conversations yet. The first message from the widget or by email shows up here. | Noch keine Unterhaltungen. Die erste Nachricht aus dem Widget oder per E-Mail erscheint hier. |
| `admin.emptyFiltered` | Nothing matches these filters. | Keine Unterhaltungen für diese Filter. |
| `admin.clearFilters` | Clear filters | Filter zurücksetzen |
| `admin.emptyContacts` | No contacts yet. A contact is created with a person's first message, or add one by hand. | Noch keine Kontakte. Ein Kontakt entsteht mit der ersten Nachricht einer Person, oder Sie legen ihn von Hand an. |
| `admin.emptyCompanies` | No companies yet. Link a contact to a company, or create one from a work email's domain. | Noch keine Firmen. Verknüpfen Sie einen Kontakt mit einer Firma, oder legen Sie eine aus der Domain einer Geschäftsadresse an. |
| `admin.emptyCanned` | No canned replies yet. Save an answer you type often; in the reply box, / inserts it. | Noch keine Textbausteine. Speichern Sie eine Antwort, die Sie oft schreiben; im Antwortfeld fügt / sie ein. |
| `admin.emptyDeals` | No deals yet. Create one here, or from a sales lead's conversation. | Noch keine Deals. Legen Sie einen hier an oder aus der Unterhaltung eines Sales-Leads. |
| `admin.sending` | Sending… | Wird gesendet… |
| `admin.errorRetry` | Could not load. | Konnte nicht geladen werden. |
| `admin.retry` | Try again | Erneut versuchen |
| `admin.properties` | Properties | Eigenschaften |
| `admin.details` | Details | Details |
| `admin.hideDetails` | Hide details | Details ausblenden |
| `admin.newMessage` (visually hidden `role="status"` when `data-new` lands) | New message in this conversation | Neue Nachricht in dieser Unterhaltung |
| `admin.waitingTab` (count on the Inbox tab, needs the API field; §6) | {count} waiting | {count} wartend |
| `thread.confirmEmail` (change) | You'll be notified at {email} and here, under {reference}. | Sie werden per E-Mail an {email} und hier benachrichtigt (Referenz {reference}). |
| `thread.confirmHere` (change) | You'll be notified here, under {reference}. | Sie werden hier benachrichtigt (Referenz {reference}). |
| `admin.confirmationHint` (change, follows the above) | Shown in the widget under "Thank you for your question" (or report, suggestion, message). {email} and {reference} are filled in. Leave empty for the default below. | unchanged in meaning; the German already matches |
| `admin.rename` (unchanged; the pencil icon gets this as its `aria-label`) | Rename conversation | Unterhaltung umbenennen |

Changing `thread.confirmEmail` drops "We'll get back to you as soon as
possible", which competed with the header promise (CT-1). The Settings
placeholder (settings.tsx:56) shows the new default automatically.

### (g) Phone layout (from CSS; to be verified with the 375 and 390 shots)

Admin, all under `@container helpdesk (max-width: 720px)` once (d-1) lands,
or `@media` until then:

- `.sa-btn, .sa-input, .sa-select, .sa-seg, .rt-toolbar button { min-height: 44px }`;
  `.sa-seg` padding 4, inner radius adjusts; `.sa-nav` is already 44.
- `.sa-table`: `thead` visually hidden; `tr` becomes `display: grid;
  grid-template-columns: auto 1fr; gap: 4px 10px; padding: 12px 16px`; the
  Waiting pill and Contact initials sit on the title row; Status and Priority
  render inline as pills after the fine print. No horizontal scroll, no
  clipping. `.sa-table-wrap` to `overflow: clip` either way.
- `.sa-toolbar`: the three selects become a single "Filters" `details` with
  the selects stacked inside; search and the segment stay visible. The j/k
  hint is already hidden.
- `.sa-composer`: `position: sticky; bottom: 0` stays; `.rt-input
  min-height` 90 → 72; "Send and resolve" wraps under "Send" as full-width
  buttons (`flex: 1 1 100%`).
- `.sa-board`: already horizontal scroll at 220px columns; add
  `scroll-snap-type: x mandatory` and `scroll-snap-align: start` on columns.
- `.sa-dialog` width is already `calc(100vw - 32px)`.
- Body text stays 14; nothing under 12.

Widget: `.tabs button { min-height: 44px }`; `.secondary { min-height: 44px
}` under 480px; `.switch { min-height: 44px }`; `.send` 42 → 44. Everything
else (full-screen sheet, 16px inputs, focus trap, scroll lock) is already in
place and should be kept exactly.

**Files.** both `styles.ts`; `inbox.tsx` for the stacked-row markup
(the table needs a `data-label` per cell or the grid rule). **Size.** M.

---

## 5. Top 10 work items

Each stands alone; "depends on" is a recommendation of order, not a blocker,
unless marked hard.

### 1. `feat(admin): split the inbox into list and thread when the container is wide enough`

- **Problem.** An agent opening forty conversations a day sees forty blank
  "Loading…" flashes, loses the list's scroll and j/k cursor on every "< Inbox",
  and cannot glance at what is waiting while answering.
- **Scope, in.** `container-type` on `.sa`; all admin media queries become
  container queries; `index.tsx` renders `Inbox` and `ConversationView` side
  by side at ≥1180px container (380px list pane, sticky, own scroll) and
  ≥900px with the aside collapsed; a `ConversationList` row component in
  `inbox.tsx` sharing data and the j/k hook with `ConversationTable`;
  `data-active` + `aria-current` on the selected row; `.sa-back` hidden in
  split; the j/k guard adds `target.isContentEditable`; Escape in the thread
  focuses the list.
- **Scope, out.** The aside toggle (item 3), the property card (item 4),
  virtualised lists, drag to resize the panes.
- **Size.** L. **Depends on.** none hard; item 5 (skeletons) makes the first
  paint better. **Layers.** admin, i18n (none), docs (README: "On a wide
  screen the inbox shows the list beside the conversation").
- **Acceptance.** Screenshots at 1440 (split with aside), 1100 (split, aside
  collapsed), 768 and 375 (single pane; identical to today) in the demo card
  and in a full-viewport host. j, k, Enter on the list while a thread is open;
  typing j in the composer inserts "j"; Escape from the composer puts focus on
  the selected row; Tab order is list → thread → aside. `inbox.test.tsx` gains
  a case for `isContentEditable`. Polling: the list refetches every 10s with
  the cursor kept. Reduced motion: no transition on pane change. Lint and
  the existing unit tests green; the demo build on both Next majors green.

### 2. `fix(admin): derive every radius and shadow from the host's tokens`

- **Problem.** A host that sets `--helpdesk-radius: 4px` gets 4px cards next
  to 8px buttons and a 14px dialog; shadows are navy whatever the host's ink,
  and the widget's are plain black.
- **Scope, in.** The `--a-r*` / `--s-r*` derived radii and their application
  per (b); shadows via `color-mix` from `--a-fg` / `--s-fg` with the inset top
  highlight; default hairlines at alpha from fg; the note surface derived
  from `--a-note-border`; one default per variable across both files.
- **Scope, out.** Nesting changes (item 7), the table-head treatment (item 6).
- **Size.** S. **Depends on.** none. **Layers.** admin, widget, docs (README
  Theming: one sentence).
- **Acceptance.** Screenshots at 1440 in the demo light and dark; a third
  screenshot with `--helpdesk-radius: 4px` and one with `20px` showing
  concentric corners; dark theme without `--helpdesk-note` set shows a
  readable note. No literal colour remains in either stylesheet except the
  `:host` defaults block and the `.badge`/redactor overlays.

### 3. `feat(admin): collapsible details sidebar with a remembered state`

- **Problem.** In a 900px host column the fixed 320px aside leaves a 560px
  thread; there is no way to give the conversation the room.
- **Scope, in.** `Details` / `Hide details` toggle in `.sa-page-head`,
  `aria-expanded` + `aria-controls`, `localStorage['helpdesk.aside']` in
  try/catch, default open ≥1180px container; `.sa-split` collapses to one
  column when hidden; the measure on `.sa-msg-body`.
- **Scope, out.** Moving properties (item 4), per-card collapse.
- **Size.** M. **Depends on.** item 1 for the container breakpoints (works
  on media queries without it). **Layers.** admin, i18n (`admin.details`,
  `admin.hideDetails`).
- **Acceptance.** Screenshots at 1440 open/closed and 768; state survives a
  reload and a private window (no storage) falls back to the default; the
  toggle is reachable by Tab, announces its state, and keyboard focus is not
  lost when the aside hides (it moves to the toggle).

### 4. `feat(admin): show status, priority, type, inbox and assignee as a properties card`

- **Problem.** The five selects above the thread look exactly like the
  inbox's filters and wrap to two lines at 1440; an agent reads "Status:
  Open" as the filter they just set.
- **Scope, in.** A first aside card titled Properties with eyebrow labels
  over borderless `.sa-prop` selects; the same card renders above the thread
  as a two-column grid under 900px; the `Select` helper unchanged in
  behaviour; the toolbar row removed from `ConversationView`.
- **Scope, out.** New fields, inline editing of anything else, the title
  editor.
- **Size.** M. **Depends on.** item 3 (so the card has a home when the aside
  is hidden: it then renders above the thread). **Layers.** admin, i18n
  (`admin.properties`), docs (README screenshot if any).
- **Acceptance.** Screenshots 1440/768/375; each select keeps its
  `aria-label` and the option text keeps the "Label: value" prefix; Tab order
  is thread → composer → properties → contact; the PATCH on change unchanged
  (`agent.integration.test.ts` untouched and green); a design-partner agent
  finds status and assignee in under five seconds on first sight (one
  observed session, see §7).

### 5. `feat(admin): skeleton loading shaped like the inbox and the conversation`

- **Problem.** Every navigation blanks the screen to "Loading…" and then the
  full layout lands, a visible jump forty times a day.
- **Scope, in.** `<Skeleton kind>` in `ui.tsx`; table and thread shapes per
  (c); `.sa-skel` opacity pulse; `aria-busy` kept; used in `inbox.tsx`,
  `conversation.tsx`, `crm.tsx` lists.
- **Scope, out.** Optimistic rendering from the list row's data (worth doing
  later: the row already has title, reference, contact).
- **Size.** S. **Depends on.** none. **Layers.** admin.
- **Acceptance.** Screenshot of each skeleton at 1440 and 375; throttled
  network shows no layout shift between skeleton and content (CLS 0 in
  DevTools for the navigation); reduced motion shows a static skeleton;
  `admin.test.tsx` asserts `aria-busy` is present while loading.

### 6. `feat(admin): empty states that say how to fill the screen, with a filter reset`

- **Problem.** "Nothing here yet." on an inbox filtered to Open does not tell
  a new agent that resolved conversations exist or where the first message
  will come from.
- **Scope, in.** `<Empty>` in `ui.tsx`; copy per (f); the inbox distinguishes
  empty from filtered and offers Clear filters; contacts, companies, canned
  replies, deals board (all columns empty) use their own copy; the table head
  eyebrow treatment from (a) in the same PR because the empty state sits in
  that frame.
- **Scope, out.** Illustrations, onboarding checklists.
- **Size.** S. **Depends on.** none. **Layers.** admin, i18n (seven keys, en
  + de).
- **Acceptance.** Screenshots at 1440 and 375 of inbox-empty, inbox-filtered,
  contacts, companies, canned, deals; Clear filters navigates to the bare
  inbox route; `tsc` proves every new key has a German string.

### 7. `fix(admin): pressed states, tinted composer tray, sending label and error retry`

- **Problem.** Buttons change colour on hover and nothing on press; a load
  failure shows "Something went wrong." with no way to retry; Send gives no
  feedback while it works.
- **Scope, in.** `:active` rules per (c) in both files; `.sa-composer` as a
  tray with the editor as its core (b); `admin.sending` on the primary while
  `busy === 'send'`; `.sa-notice[data-tone="danger"]` with `admin.errorRetry`
  + `admin.retry` where a resource failed to load; `tr:focus-within` row
  highlight; the toast's fade.
- **Scope, out.** Optimistic sends, offline queueing.
- **Size.** S. **Depends on.** item 2 for the radius variables (can ship with
  literals and be rebased). **Layers.** admin, widget, i18n (three keys).
- **Acceptance.** A screenshot with a button held down (DevTools `:active`)
  at 1440; the network tab blocked → the inbox shows the notice with Try
  again, which refetches; composer in note mode shows an amber tray and a
  white core; Tab through the inbox shows a highlighted row; reduced motion
  shows no transform transition.

### 8. `feat(admin): composer with the reply/note switch first and the actions in one row`

- **Problem.** The mode is chosen after typing; the keyboard hint wraps
  mid-phrase; the placeholder is doing a label's job.
- **Scope, in.** Reorder per (d-4); `white-space: nowrap` on the hint and
  hidden under 900px container; placeholder becomes `admin.slashHint`; the
  label stays `aria-label`; amber tint unchanged; `AwayControl` moves to the
  rail with the `nav={false}` fallback (d-5) in the same PR because both are
  "put the control where its meaning is".
- **Scope, out.** Split "Submit as" button, macros, scheduled sends.
- **Size.** S. **Depends on.** none. **Layers.** admin.
- **Acceptance.** Screenshots 1440/768/375 in reply and note mode; ⌘↵ and
  ⌘⇧↵ still send and resolve (`admin.test.tsx` or a new case); the segment is
  the first focusable element of the composer; with `nav={false}` the away
  control is still reachable in the toolbar.

### 9. `fix(widget): accent for highlights, readable meta, pressed tiles and a panel that fits its view`

- **Problem.** The focus colour marks unread dots and the selected tab, so a
  host's accessible focus colour leaks into the UI; "You · just now" fails
  contrast on the accent bubble; the home view shows 300px of nothing.
- **Scope, in.** `.tabs [aria-selected]`, `.unread-dot`, `.item.unread
  strong::after`, `.agent-dot`, `.agent-note` → accent; `.msg-meta` 12px at
  full opacity with the mixed colour; `.type` / `.item` tone-on-tone with
  `:active`; `.panel[data-view]` auto height for home and form (d-6); the
  view-change fade; the motion variables and reduced-motion block for the
  widget; 44px tabs, secondary buttons, switch and send under 480px.
- **Scope, out.** Any change to field order, the home's content, the thread's
  bubble model.
- **Size.** M. **Depends on.** none. **Layers.** widget, docs (README
  Theming: `--helpdesk-focus` is now only the focus ring).
- **Acceptance.** Screenshots at 1440 of home, form and thread in the demo's
  light and dark themes and in the untouched default palette; 375 and 390 of
  the full-screen sheet; contrast of `.msg-meta` on both bubbles ≥ 4.5:1
  measured; the default palette shows no pink; `widget.test.tsx` green; Tab
  stays inside the sheet on phones (existing behaviour, re-checked).

### 10. `fix(widget): keep the context review and the privacy line in sight on the first form`

- **Problem.** On the anonymous bug form the disclosure of what is sent ("5
  details about this page") is cut off at the fold, and the demo sets no
  privacy URL so the line that would explain the data use never shows.
- **Scope, in.** `margin-top: auto` on the context `details.box` inside
  `.body`; the message toolbar collapsed to one toggle on bug and feature
  forms using the existing `toolbar` prop; `thread.confirmEmail` /
  `thread.confirmHere` shortened (f) so the header's promise is the only
  promise; the demo's inbox config gains a `privacyUrl`.
- **Scope, out.** Reordering fields, removing fields, a two-step form.
- **Size.** S. **Depends on.** none. **Layers.** widget, i18n (two changed
  keys, en + de), examples/demo.
- **Acceptance.** Screenshot at 1440 of the anonymous bug form with the
  context box and the privacy line both visible without scrolling at the
  640px panel height, and at 375 as a sheet; `widget.integration.test.ts`
  still proves the context keys are sent and the unticked ones are not; the
  Settings placeholder shows the new default.

---

## 6. Left out on purpose

- **Reordering the widget's form fields** (subject after name): the Preserve
  mode forbids changing field order, and the integration tests pin the
  payload; rhythm (item 10) gets most of the value.
- **A command palette (⌘K).** Six sections and three filters do not need one;
  j/k, /, and Escape cover the day. Add it when there are views to jump to.
- **Collision avoidance ("Rowan is viewing").** Real need for a team of
  three, but it is a presence feature in `service.ts` and `http.ts`, not a
  design lever; file it as a product issue.
- **A waiting count on the Inbox tab.** Worth having; needs `agent/me` to
  return the count (the widget's session already computes it for agents).
  One line in the API, then S in the rail; filed as a follow-up, not here.
- **Optimistic rendering of the thread from the list row.** The skeleton
  removes the jump; painting the title from the row is the next step and
  belongs with item 1's second iteration.
- **Snooze.** Chatwoot and Intercom have it; this product has "Waiting on
  customer" and a reminder email, which is the small-team version. Not a
  design gap.
- **AI summary at the top of the thread.** The suggestion strip exists and
  is opt-in by adapter; promoting it is product, not craft.
- **Dark-mode parity in the admin's own defaults.** The host owns the theme;
  the one derived default that mattered (the note surface) is in item 2.
- **A custom display font, icons from a library, Tailwind.** All forbidden
  by the architecture and all wrong for a package that must disappear into
  the host.
- **Animating the panel's height change** between views: height is not
  transform or opacity; the jump is accepted and the panel grows upward
  from a fixed anchor so nothing else moves.

---

## 7. The riskiest assumption and the cheapest test

**Assumption.** That agents want the triage properties *beside* the
conversation (item 4, the Linear/Libredesk arrangement) rather than *above*
it, and that moving them does not slow the two pilot teams who learned the
row. Everything else in this review is craft that cannot make an agent
slower; this one can.

**Test this week.** Build item 4 behind the container query (it is M), deploy
it to the demo, and watch one agent from each design partner open three
conversations over a shared screen: time from open to "status changed" and
to "assigned to me", and whether they look at the aside first or the thread
first. Two sessions, fifteen minutes each, no prototype tooling. If both
reach for the top of the thread, keep the row and ship only the visual
distinction (eyebrow labels, borderless selects) in place.

---

## Checklist

Brief read and dials stated (3/3/6 admin, 2/3/4 widget) · three locks hold
(one accent, radii derived from one token, one host theme) · no default fonts
(host font), no default icons (one in-house set, one stroke), no flat
mid-grey borders after item 2 (alpha hairlines from fg), no untinted shadows
after item 2, no glued bar (the rail sits on a hairline inside the host's
card) · archetype per surface: working table (inbox), reading column with a
property aside (conversation), tray of cards (contact), five-column pipeline
(deals), sheet (widget); none repeated on adjacent surfaces · nested surfaces
on the composer and the widget tiles, none three deep · no hero (not a
marketing surface) · eyebrows rationed to card titles and table heads only ·
buttons are 8px-radius controls by the host's token, not pills, by design
for a dense tool; the one pill family is status/priority · section padding
is the host's · one easing family and one duration table after (e) · arrivals
present only where justified (panel, new message, toast), nothing staggered
· four states per component after items 5–7 · lived-in demo content ·
one-column collapse described for 375/390/768/1024/1440 but **verified only
at 1440** · 44px targets after (g), 14px body floor held, 12px floor on meta
· contrast and focus rings on every control (one failure found, T-6, fixed
in item 9) · transform and opacity only after the note-input fix · blur only
on the host's bar · reduced motion honoured by variables · wayfinding: a way
back from everywhere, deep links everywhere, active marker in the rail ·
reads as the host's own tool, not a template, once the derived tokens land.
