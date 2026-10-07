export const adminCss = `
.sa {
  --a-accent: var(--helpdesk-accent, #0c2034);
  --a-accent-hover: var(--helpdesk-accent-hover, #243b53);
  --a-accent-fg: var(--helpdesk-accent-fg, #f0f4f8);
  --a-bg: var(--helpdesk-bg, #ffffff);
  --a-fg: var(--helpdesk-fg, #0c2034);
  --a-muted: var(--helpdesk-muted, #486581);
  --a-border: var(--helpdesk-border, #e6e9ef);
  --a-subtle: var(--helpdesk-subtle, #f6f7f9);
  --a-head: var(--helpdesk-header-bg, #d9e2ec);
  --a-note-border: var(--helpdesk-note-border, #f0b429);
  --a-note: var(--helpdesk-note, color-mix(in srgb, var(--a-note-border) 12%, var(--a-bg)));
  --a-danger: var(--helpdesk-danger, #cf1124);
  --a-warn: var(--helpdesk-warning, #b44d12);
  --a-focus: var(--helpdesk-focus, #f55068);
  --a-radius: var(--helpdesk-radius, 10px);
  --a-r-control: calc(var(--a-radius) - 2px);
  --a-r-inner: calc(var(--a-radius) - 4px);
  --a-r-dialog: calc(var(--a-radius) + 4px);
  --a-shadow-color: color-mix(in srgb, var(--a-fg) 14%, transparent);
  --a-highlight: inset 0 1px 0 color-mix(in srgb, var(--a-fg) 4%, transparent);
  --a-shadow-pop: var(--a-highlight), 0 8px 24px var(--a-shadow-color);
  --a-shadow-dialog: var(--a-highlight), 0 24px 64px color-mix(in srgb, var(--a-fg) 25%, transparent);
  color: var(--a-fg);
  font-size: 14px;
  line-height: 1.45;
  display: grid;
  gap: 16px;
  container-type: inline-size;
}
.sa * { box-sizing: border-box; }
/* Safari ignores scrollbar-color and gets the pseudo-elements; elsewhere they would be ignored anyway. */
@supports (scrollbar-color: auto) {
  .sa { scrollbar-color: color-mix(in srgb, var(--a-fg) 22%, transparent) transparent; }
  .sa, .sa * { scrollbar-width: thin; }
}
@supports not (scrollbar-color: auto) {
  .sa ::-webkit-scrollbar { width: 10px; height: 10px; }
  .sa ::-webkit-scrollbar-track { background: transparent; }
  .sa ::-webkit-scrollbar-thumb { border: 3px solid transparent; border-radius: 999px; background: color-mix(in srgb, var(--a-fg) 22%, transparent) padding-box; }
  .sa ::-webkit-scrollbar-thumb:hover { background-color: color-mix(in srgb, var(--a-fg) 40%, transparent); }
}
.sa button, .sa input, .sa select, .sa textarea { font: inherit; color: inherit; }
.sa button { cursor: pointer; }
.sa a { color: inherit; }
.sa :focus-visible { outline: 2px solid var(--a-focus); outline-offset: 2px; }
.sa .num { font-variant-numeric: tabular-nums; }

/*
 * Top-level section chrome: a rail of tabs on a hairline, one level above the
 * page's own .sa-seg filter, so an agent never reads the two as one control.
 * Weight is uniform — switching it on the active tab would reflow the row.
 */
.sa-nav {
  display: flex; align-items: stretch; gap: 2px; height: 44px; padding: 0 2px;
  border-bottom: 1px solid var(--a-border);
  overflow-x: auto; overflow-y: hidden; scrollbar-width: none; scroll-padding-inline: 16px;
}
.sa-nav::-webkit-scrollbar { display: none; }
.sa .sa-nav button {
  position: relative; flex: none; height: 100%; padding: 0 12px;
  border: 0; border-radius: var(--a-r-control) var(--a-r-control) 0 0; background: transparent;
  color: var(--a-muted); font-size: 13px; font-weight: 600; white-space: nowrap;
  transition: color 150ms cubic-bezier(0.2, 0, 0, 1);
}
/* The marker grows from the centre, so only transform and opacity animate. */
.sa .sa-nav button::after {
  content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 2px;
  border-radius: min(2px, var(--a-r-inner)) min(2px, var(--a-r-inner)) 0 0; background: color-mix(in srgb, var(--a-fg) 25%, transparent);
  transform: scaleX(0); transition: transform 150ms cubic-bezier(0.2, 0, 0, 1);
}
.sa .sa-nav button:hover { color: var(--a-fg); }
.sa .sa-nav button:hover::after { transform: scaleX(1); }
.sa .sa-nav button:active { transform: translateY(1px); }
.sa .sa-nav button[aria-current="page"] { color: var(--a-fg); }
.sa .sa-nav button[aria-current="page"]::after { background: var(--a-accent); transform: scaleX(1); }
/* An offset ring would be clipped by the scroll container at either end. */
.sa .sa-nav :focus-visible { outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) {
  .sa .sa-nav button, .sa .sa-nav button::after { transition: none; }
}
/* Six labels cannot fit a phone; the fade says the rail scrolls. */
@container (max-width: 720px) {
  .sa-nav { mask-image: linear-gradient(90deg, var(--a-fg) 0 calc(100% - 20px), transparent); }
}
/* Who you are and whether you are away sit at the rail's end, apart from any one page. */
.sa-rail { display: flex; }
.sa-rail .sa-nav { flex: 1; min-width: 0; }
.sa-me { flex: none; display: flex; align-items: center; gap: 8px; padding-left: 8px; border-bottom: 1px solid var(--a-border); }

.sa-toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sa-toolbar .sa-grow { flex: 1; min-width: 200px; }
.sa-toggle { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; white-space: nowrap; }
.sa-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.sa-fields .sa-select { width: 100%; min-width: 0; text-overflow: ellipsis; }
.sa-snooze-pick { display: flex; gap: 6px; align-items: center; grid-column: 1 / -1; }
.sa-props { margin: 0; min-width: 0; gap: 4px 12px; align-items: end; padding: 8px 12px; border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-subtle); }
.sa-prop { display: grid; gap: 2px; min-width: 0; }
.sa-eyebrow { font-size: 11px; font-weight: 600; color: var(--a-muted); text-transform: uppercase; letter-spacing: 0.06em; }
/* The properties card and the inbox's filter panel share one quiet control: text until hovered. */
:is(.sa-prop, .sa-props, .sa-filters .sa-field) > :is(.sa-select, .sa-input) { height: 32px; padding-left: 8px; margin-left: -8px; width: calc(100% + 8px); border-color: transparent; background-color: transparent; }
:is(.sa-prop, .sa-props, .sa-filters .sa-field) > :is(.sa-select, .sa-input):is(:hover, :focus) { border-color: var(--a-border); background-color: var(--a-bg); }
.sa-input, .sa-select, .sa-textarea {
  height: 36px; padding: 0 12px; border: 1px solid var(--a-border); border-radius: var(--a-r-control);
  background: var(--a-bg); width: 100%; font-size: 14px;
}
.sa-textarea { height: auto; min-height: 110px; padding: 10px 12px; resize: vertical; line-height: 1.5; }
.sa-select {
  appearance: none; padding-right: 32px; width: auto;
  background-image: linear-gradient(45deg, transparent 50%, var(--a-muted) 50%), linear-gradient(135deg, var(--a-muted) 50%, transparent 50%);
  background-position: calc(100% - 17px) 50%, calc(100% - 12px) 50%;
  background-size: 5px 5px; background-repeat: no-repeat;
}
.sa-input:focus, .sa-select:focus, .sa-textarea:focus { outline: 2px solid var(--a-focus); outline-offset: -1px; }

.sa-btn {
  height: 36px; padding: 0 14px; border: 1px solid var(--a-border); border-radius: var(--a-r-control);
  background: var(--a-bg); display: inline-flex; align-items: center; gap: 6px; font-weight: 500; white-space: nowrap;
  text-decoration: none; transition: transform 80ms ease-out;
}
.sa-btn:hover { background: var(--a-subtle); }
.sa .sa-btn:active:not(:disabled), .sa .sa-seg button:active { transform: translateY(1px); }
@media (prefers-reduced-motion: reduce) { .sa-btn { transition: none; } }
.sa-btn svg { width: 16px; height: 16px; }
.sa .sa-btn:disabled { opacity: 1; background: var(--a-subtle); color: var(--a-muted); cursor: default; }
.sa .sa-primary { background: var(--a-accent); border-color: var(--a-accent); color: var(--a-accent-fg); font-weight: 600; }
.sa .sa-primary:hover { background: var(--a-accent-hover); border-color: var(--a-accent-hover); }
.sa .sa-primary:disabled { border-color: transparent; background: color-mix(in srgb, var(--a-accent) 40%, var(--a-bg)); color: var(--a-accent-fg); }
.sa-ghost { border-color: transparent; background: transparent; }
.sa .sa-quiet { color: var(--a-muted); }
.sa-pill[data-status="open"] { color: var(--a-fg); }
.sa-pill[data-tone="muted"] { color: var(--a-muted); background: transparent; }
.sa-identity { display: flex; justify-content: space-between; gap: 8px; align-items: center; font-size: 13px; }
.sa-identity span:first-child { min-width: 0; overflow-wrap: anywhere; }
.sa-note-input { min-height: 36px !important; height: 36px; overflow: hidden; padding-top: 7px !important; padding-bottom: 7px !important; resize: none; transition: min-height 150ms, height 150ms; }
.sa-note-input:focus, .sa-note-input:not(:placeholder-shown) { min-height: 96px !important; height: 96px; overflow: auto; resize: vertical; }
.sa-pill[data-status="pending"] { color: var(--a-muted); }
.sa-pill[data-status="resolved"] { color: var(--a-muted); background: transparent; }
.sa-pill.sa-rating { align-self: center; }
.sa-pill[data-rating="bad"] { color: var(--a-danger); border-color: currentColor; background: transparent; }

.sa .sa-danger { color: var(--a-danger); }
.sa .sa-destructive { background: var(--a-danger); border-color: var(--a-danger); color: var(--a-bg); font-weight: 600; }
.sa .sa-destructive:hover { background: color-mix(in srgb, var(--a-danger) 85%, var(--a-fg)); }

/* 36px, not the app TabsList's 38: it shares a row with 36px inputs and selects. */
.sa-seg { margin: 0; min-width: 0; display: inline-flex; align-items: center; gap: 3px; height: 36px; padding: 3px; border-radius: var(--a-radius); background: var(--a-bg); border: 1px solid var(--a-border); }
.sa .sa-seg button { height: 100%; padding: 0 10px; border: 1px solid transparent; border-radius: var(--a-r-inner); background: transparent; color: var(--a-fg); font-size: 13px; font-weight: 500; white-space: nowrap; transition: background-color 120ms; }
.sa .sa-seg button:hover { background: var(--a-subtle); }
.sa .sa-seg button[aria-pressed="true"] { background: var(--a-accent); color: var(--a-accent-fg); }

.sa-card { border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-bg); padding: 14px 16px; display: grid; gap: 10px; }
.sa-card > h3 { margin: 0; font-size: 11px; font-weight: 600; color: var(--a-muted); text-transform: uppercase; letter-spacing: 0.06em; }

.sa-table-wrap { border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-bg); overflow: hidden; }
.sa-card .sa-table-wrap { border: 0; border-radius: 0; margin-inline: -16px; background: transparent; }
/* The last row's own padding is the card's bottom edge. */
.sa-card > .sa-table-wrap:last-child { margin-bottom: -14px; border-radius: 0 0 calc(var(--a-radius) - 1px) calc(var(--a-radius) - 1px); }
.sa-card .sa-table th { background: transparent; }
.sa-table { width: 100%; border-collapse: collapse; }
.sa-table th { text-align: left; font-weight: 600; background: var(--a-subtle); color: var(--a-muted); padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; white-space: nowrap; }
.sa-table td { padding: 12px 16px; border-top: 1px solid var(--a-border); vertical-align: middle; }
/* Inbox rows run to several lines; their pills sit on the first. */
.sa-table:has(.sa-cell) td { vertical-align: top; }
.sa-table tbody tr { cursor: pointer; }
.sa-table tbody tr:hover td, .sa-table tbody tr:focus-within td { background: var(--a-subtle); }
.sa-table tbody tr[data-active="true"] td { background: color-mix(in srgb, var(--a-accent) 7%, var(--a-bg)); }
.sa-table tbody tr[data-selected] td { background: color-mix(in srgb, var(--a-accent) 4%, var(--a-bg)); }
.sa-table .sa-check { width: 1%; padding-right: 4px; cursor: default; }
.sa-check input { display: block; width: 18px; height: 18px; margin: 0; accent-color: var(--a-accent); cursor: pointer; }
.sa-bulk { position: sticky; bottom: 16px; z-index: 1; margin-top: 12px; padding: 8px 12px; border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-bg); box-shadow: var(--a-highlight), 0 12px 32px -12px var(--a-shadow-color); }
.sa-table [data-unread] .sa-cell-title a { font-weight: 700; }
.sa-dot { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--a-accent); vertical-align: middle; }
.sa .sa-seg .sa-count { font-weight: 400; opacity: .7; }
.sa-cell-title a { font-weight: 500; text-decoration: none; }
.sa-cell-title a:hover { text-decoration: underline; }
.sa-cell-title { display: grid; gap: 2px; min-width: 0; }
.sa-cell { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.sa-type { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: var(--a-r-inner); color: var(--a-muted); background: var(--a-subtle); }
.sa-type svg { width: 15px; height: 15px; }
.sa-type[data-type="bug"] { color: var(--a-danger); background: color-mix(in srgb, var(--a-danger) 10%, var(--a-bg)); }
.sa-type[data-type="feature"] { color: var(--a-warn); background: color-mix(in srgb, var(--a-warn) 12%, var(--a-bg)); }
.sa-type[data-type="lead"] { color: var(--a-accent); background: color-mix(in srgb, var(--a-accent) 8%, var(--a-bg)); }
.sa-cell-title .sa-preview { color: var(--a-muted); font-weight: 400; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60ch; }
.sa-empty { display: grid; justify-items: center; gap: 4px; padding: 48px 24px; text-align: center; }
.sa-empty strong { font-weight: 600; color: var(--a-fg); }
.sa-empty p { margin: 0; max-width: 46ch; color: var(--a-muted); text-wrap: balance; }
.sa-empty .sa-btn { margin-top: 12px; }
@container (max-width: 720px) { .sa-empty { padding: 32px 16px; } }

.sa-muted { color: var(--a-muted); font-size: 13px; }
.sa-fine { color: var(--a-muted); font-size: 12px; }
.sa-pill { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--a-subtle); border: 1px solid var(--a-border); white-space: nowrap; }
.sa-pill-danger { color: var(--a-danger); border-color: color-mix(in srgb, var(--a-danger) 40%, var(--a-border)); }
.sa-pill[data-tone="high"] { color: var(--a-warn); border-color: currentColor; background: transparent; }
.sa-pill[data-tone="urgent"] { color: var(--a-danger); border-color: currentColor; background: transparent; }
.sa-pill[data-tone="late"] { color: var(--a-danger); }
.sa-pill[data-tone="soon"] { color: var(--a-warn); }
.sa-who { display: flex; align-items: center; gap: 10px; min-width: 0; }
.sa-avatar { width: 28px; height: 28px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 11px; font-weight: 700; background: var(--a-head); color: var(--a-fg); }
.sa-avatar[data-agent="true"] { background: var(--a-accent); color: var(--a-accent-fg); }
.sa-viewers { display: inline-flex; vertical-align: middle; margin-inline-start: 6px; }
.sa-viewers .sa-avatar { width: 20px; height: 20px; font-size: 9px; box-shadow: 0 0 0 2px var(--a-bg); }
.sa-viewers .sa-avatar + .sa-avatar { margin-inline-start: -6px; }
.sa-viewing { display: flex; align-items: center; gap: 6px; }
.sa-viewing .sa-viewers { margin: 0; }
.sa-viewing-warning:empty { position: absolute; }
.sa-viewing-warning { margin: 0; font-size: 13px; color: var(--a-warn); }

.sa-page-head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
.sa-page-head h2 { margin: 0; font-size: 18px; font-weight: 600; line-height: 32px; }
/* A conversation's head: back, the title with its tags, and its actions together at the end. */
.sa-convo-head { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start; gap: 8px 12px; }
.sa-convo-title { display: grid; gap: 2px; min-width: 0; }
.sa-convo-title h2 { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.sa-convo-title h2 > .num { flex: none; font-size: 14px; }
.sa-convo-actions { display: flex; align-items: center; gap: 8px; }
.sa-convo-actions .sa-btn { height: 32px; }
@container (max-width: 560px) {
  .sa-convo-head { grid-template-columns: auto minmax(0, 1fr); }
  .sa-convo-actions { grid-column: 1 / -1; }
}
/* 32px, the h2's line box, so the button sits on the title's first line. */
.sa .sa-back { height: 32px; padding: 0 10px 0 6px; flex: none; }
.sa-split { display: grid; grid-template-columns: minmax(0, 1fr) clamp(260px, 30%, 320px); gap: 24px; align-items: start; }
.sa-split > * { min-width: 0; grid-template-columns: minmax(0, 1fr); }
/* Details stay a column to the right until the thread itself would be too narrow. */
@container (max-width: 640px) { .sa-split { grid-template-columns: 1fr; } }
.sa-split > [hidden] { display: none; }
.sa-thread-pane > .sa { min-height: 100dvh; grid-template-rows: auto minmax(0, 1fr); }
.sa-thread-pane .sa-split { align-items: stretch; }
.sa-thread-pane .sa-split > aside { align-self: start; }
.sa-thread-pane .sa-split > .sa:first-child { display: flex; flex-direction: column; }
/* The inbox list beside an open thread on a wide container; below it the thread replaces the list. */
.sa-panes { display: grid; gap: 24px; align-items: start; }
.sa-panes > * { min-width: 0; }
.sa-panes[data-open] > .sa-list-pane { display: none; }
@container (min-width: 960px) {
  .sa-panes[data-open] { grid-template-columns: 380px minmax(0, 1fr); }
  /* Open details take their width from the list, not the thread. */
  .sa-panes[data-open]:has(.sa-split > aside:not([hidden])) { grid-template-columns: 320px minmax(0, 1fr); }
  .sa-panes[data-open] > .sa-list-pane { display: block; position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
  .sa-panes[data-open] .sa-back { display: none; }
}
.sa-split:has(> [hidden]) { grid-template-columns: minmax(0, 1fr); }
/* Beside an open thread the table's columns would squeeze the subject; each row stacks instead. */
.sa-panes[data-open] .sa-table thead { display: none; }
.sa-panes[data-open] :is(.sa-table, .sa-table tbody) { display: block; }
.sa-panes[data-open] .sa-table tr { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 10px; padding: 12px 14px; border-top: 1px solid var(--a-border); }
.sa-panes[data-open] .sa-table tbody tr:first-child { border-top: 0; }
.sa-panes[data-open] .sa-list-pane .sa-table td { padding: 0; border: 0; background: none; box-shadow: none; }
.sa-panes[data-open] .sa-table .sa-check { grid-row: 1 / span 2; width: auto; padding: 2px 0 0; }
.sa-panes[data-open] .sa-col-main { grid-column: 2; grid-row: 1 / span 2; min-width: 0; }
.sa-panes[data-open] .sa-col-wait { grid-column: 3; grid-row: 1; justify-self: end; }
.sa-panes[data-open] .sa-col-pri { grid-column: 3; grid-row: 2; justify-self: end; }
.sa-panes[data-open] .sa-col-pri:empty { display: none; }
.sa-panes[data-open] .sa-type { display: none; }
.sa-panes[data-open] .sa-cell-title a { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.sa-panes[data-open] .sa-table tbody tr:hover, .sa-panes[data-open] .sa-table tbody tr:focus-within { background: var(--a-subtle); }
.sa-panes[data-open] .sa-table tbody tr[data-selected] { background: color-mix(in srgb, var(--a-accent) 4%, var(--a-bg)); }
.sa-panes[data-open] .sa-table tbody tr:is([data-active="true"], [aria-current]) { background: color-mix(in srgb, var(--a-accent) 7%, var(--a-bg)); }
.sa .sa-aside-toggle { height: 32px; margin-inline-start: auto; flex: none; }
.sa-queue { display: flex; align-items: center; gap: 8px; margin-inline-start: auto; flex: none; }
.sa-queue .sa-btn { height: 32px; }
.sa .sa-queue + .sa-aside-toggle { margin-inline-start: 0; }
.sa-kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; font-size: 13px; margin: 0; }
.sa-kv dt { color: var(--a-muted); }
.sa-kv dd { margin: 0; overflow-wrap: anywhere; }
/* The details column is too narrow for two columns: each label sits above its value. */
.sa-split > aside .sa-kv { grid-template-columns: minmax(0, 1fr); gap: 0; }
.sa-split > aside .sa-kv dt { font-size: 12px; }
.sa-split > aside .sa-kv dd + dt { margin-top: 10px; }
.sa-details > summary { cursor: pointer; color: var(--a-muted); font-size: 13px; list-style: none; display: flex; align-items: center; gap: 6px; }
.sa-details > summary::-webkit-details-marker { display: none; }
.sa-details > summary::before { content: ''; width: 6px; height: 6px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: rotate(-45deg); transition: transform 150ms; }
.sa-details[open] > summary::before { transform: rotate(45deg); }
.sa-details > pre { white-space: pre-wrap; word-break: break-word; margin: 8px 0 0; font-size: 12px; max-height: 160px; overflow: auto; background: var(--a-subtle); padding: 8px; border-radius: var(--a-r-inner); }

.sa-thread { display: grid; gap: 24px; padding-block: 8px; }
.sa-event { margin: 0; text-align: center; color: var(--a-muted); font-size: 12px; text-wrap: balance; }
.sa .rich { display: grid; gap: 6px; }
.sa .rich p, .sa .rich ul, .sa .rich ol { margin: 0; }
.sa .rich ul { padding-left: 20px; list-style: disc; }
.sa .rich ol { padding-left: 20px; list-style: decimal; }
.sa .rich a { color: var(--a-accent); text-decoration: underline; text-underline-offset: 2px; }
.sa .code { display: flex; flex-direction: column; min-width: 0; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: var(--a-r-control); background: color-mix(in srgb, currentColor 6%, transparent); white-space: normal; }
.sa .code pre { margin: 0; padding: 2px 10px 8px; overflow: auto; max-height: 320px; white-space: pre; tab-size: 4; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.sa .code pre:focus-visible { outline-offset: -2px; }
.sa .code-bar { order: -1; display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 4px 4px 0; font-size: 12px; }
.sa .code-bar button { min-height: 24px; padding: 0 8px; border: 0; border-radius: var(--a-r-inner); background: transparent; color: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.sa .code-bar button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.sa-details .code { position: relative; margin-top: 8px; }
/* A host's own code styles would otherwise paint inside the block. */
.sa .code code { padding: 0; border: 0; border-radius: 0; background: none; color: inherit; font: inherit; }
/* In the details column the error wraps, and Copy sits in the corner instead of taking a row. */
.sa-details .code pre { padding: 8px 52px 8px 10px; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.sa-details .code-bar { position: absolute; top: 4px; right: 4px; padding: 0; }
.sa-details .code-bar [role="status"]:not(:empty) { position: absolute; right: 100%; padding-right: 6px; white-space: nowrap; }
.sa .rt-toolbar { display: flex; gap: 2px; }
.sa .rt-toolbar button { display: grid; place-items: center; width: 30px; height: 28px; border: 0; border-radius: var(--a-r-inner); background: transparent; color: var(--a-muted); cursor: pointer; }
.sa .rt-toolbar button:hover { background: var(--a-subtle); color: var(--a-fg); }
.sa .rt-toolbar svg { width: 16px; height: 16px; }
.sa-msg { display: grid; grid-template-columns: 28px 1fr; gap: 12px; }
.sa-msg-body { border-radius: var(--a-radius); padding: 14px 18px; white-space: pre-wrap; word-wrap: break-word; border: 1px solid var(--a-border); background: var(--a-bg); }
.sa-msg[data-author="agent"] .sa-msg-body { position: relative; background: var(--a-subtle); }
.sa-msg[data-author="agent"] { grid-template-columns: 1fr 28px; }
.sa-msg[data-author="agent"] > :first-child { order: 2; }
.sa-msg > div { display: grid; justify-items: start; min-width: 0; }
.sa-msg[data-author="agent"] > div { justify-items: end; }
.sa-msg-body { max-width: min(100%, 65ch); }
.sa-msg[data-internal="true"] .sa-msg-body { background: var(--a-note); border: 1px dashed var(--a-note-border); }
.sa-msg header { font-size: 12px; color: var(--a-muted); margin-bottom: 6px; white-space: normal; }
.sa-msg header strong { color: var(--a-fg); font-weight: 600; }

.sa-suggest { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; border-radius: var(--a-radius); background: var(--a-subtle); border: 1px solid var(--a-border); font-size: 13px; }
.sa-suggest svg { width: 16px; height: 16px; }
.sa-suggest > svg { color: var(--a-focus); }
.sa-suggest .sa-grow { flex: 1; min-width: 200px; display: grid; gap: 2px; }
.sa-clamp { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.sa-composer { position: sticky; bottom: 0; z-index: 1; margin-top: auto; background: var(--a-bg); border: 1px solid var(--a-border); border-radius: var(--a-radius); padding: 12px; display: grid; gap: 8px; box-shadow: var(--a-highlight), 0 -4px 24px -8px var(--a-shadow-color); container-type: inline-size; }
.sa-composer:has(.rt-input:focus) { border-color: color-mix(in srgb, var(--a-focus) 60%, var(--a-border)); }
.sa-composer[data-internal="true"] { background: var(--a-note); border-color: var(--a-note-border); }
.sa .rt { display: grid; gap: 4px; min-width: 0; }
.sa .rt-input { min-height: 90px; max-height: 400px; overflow-y: auto; padding: 6px 4px; line-height: 1.5; overflow-wrap: anywhere; cursor: text; outline: none; }
.sa .rt-dialog { gap: 0; border: 1px solid var(--a-border); border-radius: var(--a-r-control); background: var(--a-bg); overflow: hidden; }
.sa .rt-dialog:focus-within { outline: 2px solid var(--a-focus); outline-offset: -1px; }
.sa .rt-dialog .rt-input { min-height: 110px; padding: 10px 12px; }
.sa .rt-dialog .rt-toolbar, .sa .rt-dialog .rt-link { padding: 4px 6px; border-top: 1px solid var(--a-border); }
/* In the composer card the toolbar sits under a hairline, inside the box. */
.sa .rt-composer .rt-toolbar, .sa .rt-composer .rt-link { padding-top: 6px; border-top: 1px solid var(--a-border); }
.sa-composer .rt-input { background: transparent; border: 0; padding: 6px 2px; }
.sa-composer-foot .sa-canned-pop { left: auto; right: 0; }
.sa .rt-input[data-empty]::before { content: attr(data-placeholder); color: var(--a-muted); pointer-events: none; }
.sa .rt-input[data-empty] > :first-child:is(br, div:only-child) { display: none; }
.sa .rt-input ul { margin: 0; padding-left: 20px; list-style: disc; }
.sa .rt-input ol { margin: 0; padding-left: 20px; list-style: decimal; }
.sa .rt-input a { color: var(--a-accent); text-decoration: underline; }
.sa .rt-input pre { margin: 4px 0; padding: 8px 10px; border-radius: var(--a-r-inner); background: var(--a-subtle); white-space: pre-wrap; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.sa .rt-link { display: flex; gap: 6px; max-width: 480px; }
.sa .rt-link input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid var(--a-border); border-radius: var(--a-r-inner); font-size: 13px; }
.sa .rt-link button { flex: none; height: 30px; padding: 0 10px; border: 1px solid var(--a-border); border-radius: var(--a-r-inner); background: var(--a-bg); font-size: 13px; font-weight: 600; }
.sa-canned { position: relative; }
.sa-canned-pop { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 20; width: min(420px, 80vw); display: grid; gap: 6px; padding: 8px; border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-bg); box-shadow: var(--a-shadow-pop); }
.sa-canned-pop .sa-slash { border: 0; padding: 0; }
.sa-canned-empty { margin: 0; padding: 10px; }
.sa-canned-foot { padding: 6px 10px 2px; border-top: 1px solid var(--a-border); font-size: 12px; color: var(--a-muted); }
.sa-canned-foot:hover { color: var(--a-fg); }
.sa-slash { display: grid; gap: 2px; border: 1px solid var(--a-border); border-radius: var(--a-r-control); background: var(--a-bg); padding: 4px; max-height: 260px; overflow: auto; }
.sa-slash button { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; text-align: left; border: 0; background: transparent; padding: 8px 10px; border-radius: var(--a-r-inner); }
.sa-slash button .sa-fine { grid-column: 1 / -1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sa-slash button[aria-selected="true"] { background: var(--a-subtle); }
.sa-composer > .sa-seg { justify-self: start; }
.sa-composer-foot { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sa-composer-foot .sa-grow { flex: 1; min-width: 0; overflow: hidden; }
/* Where the hint would squeeze the buttons, it gives up its place; the send buttons carry the shortcuts as titles. */
@container (max-width: 520px) { .sa-composer-foot .sa-kbd { visibility: hidden; } }

.sa-board { display: grid; grid-template-columns: repeat(var(--cols), minmax(180px, 1fr)); gap: 12px; }
@container (max-width: 1100px) { .sa-board { grid-auto-flow: column; grid-template-columns: none; grid-auto-columns: 220px; overflow-x: auto; } }
.sa-column { background: var(--a-subtle); border: 1px solid var(--a-border); border-radius: var(--a-radius); padding: 10px; display: grid; gap: 8px; align-content: start; min-height: 200px; }
.sa-column[data-over="true"] { outline: 2px dashed var(--a-muted); outline-offset: -2px; }
.sa-column-head { display: flex; justify-content: space-between; align-items: baseline; font-weight: 600; font-size: 13px; padding: 2px 4px; }
.sa-deal { background: var(--a-bg); border: 1px solid var(--a-border); border-radius: var(--a-r-control); padding: 10px 12px; display: grid; gap: 4px; cursor: grab; text-align: left; width: 100%; }
.sa-deal:hover { border-color: var(--a-muted); }
.sa-deal strong { font-weight: 600; }
.sa-deal-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; }

.sa-dialog { margin: auto; border: 1px solid var(--a-border); border-radius: var(--a-r-dialog); padding: 0; width: min(480px, calc(100vw - 32px)); background: var(--a-bg); color: var(--a-fg); box-shadow: var(--a-shadow-dialog); }
.sa-dialog::backdrop { background: color-mix(in srgb, var(--a-fg) 45%, transparent); }
.sa-dialog form, .sa-dialog .sa-dialog-body { padding: 20px; display: grid; gap: 14px; }
.sa-dialog .sa-card { border: 0; padding: 20px; }
.sa-summary { grid-template-columns: auto 1fr auto auto; align-items: start; gap: 14px; }
.sa-summary h2 { margin: 0; font-size: 18px; font-weight: 600; }
.sa-summary .sa-avatar { width: 44px; height: 44px; font-size: 15px; }
.sa-menu { position: relative; }
.sa-menu > summary { list-style: none; }
.sa-menu > summary::-webkit-details-marker { display: none; }
.sa-menu-pop { position: absolute; right: 0; top: 40px; z-index: 5; display: grid; min-width: 260px; padding: 6px; border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-bg); box-shadow: var(--a-shadow-pop); }
.sa-menu-pop .sa-btn { justify-content: flex-start; }
.sa-bell > summary { position: relative; }
.sa-bell-count { position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--a-accent); color: var(--a-accent-fg); font-size: 11px; line-height: 16px; text-align: center; }
.sa-bell-pop { width: min(340px, calc(100vw - 32px)); max-height: 420px; overflow-y: auto; gap: 2px; }
.sa .sa-bell-item { height: auto; padding: 8px; display: grid; gap: 2px; text-align: left; white-space: normal; }
.sa-bell-pop > p { margin: 8px; }
.sa-bell-pop > .sa-toggle { margin: 6px 8px 2px; padding-top: 8px; border-top: 1px solid var(--a-border); }
.sa-dialog h2 { margin: 0; font-size: 17px; font-weight: 600; }
.sa-dialog h3 { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--a-muted); }
.sa-keys { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; }
.sa-keys > div { display: contents; }
.sa-keys dd { margin: 0; font-size: 13px; }
.sa-field { display: grid; gap: 6px; font-size: 13px; font-weight: 500; }
.sa-dialog-foot { display: flex; justify-content: flex-end; gap: 8px; }
/* Cancel, written first, takes the left edge; Delete and then Save close the row on the right. */
.sa-dialog-foot > :first-child:not(:only-child) { margin-inline-end: auto; }
.sa-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.sa-error { color: var(--a-danger); }
.sa-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border: 1px solid color-mix(in srgb, var(--a-danger) 30%, var(--a-border)); border-radius: var(--a-radius); background: color-mix(in srgb, var(--a-danger) 6%, var(--a-bg)); color: var(--a-danger); }
.sa-stats { margin: 0; }
.sa-page-head .sa-grow { flex: 1; }
.sa-stats dd { margin: 0; font-size: 24px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sa-report { min-width: 560px; }
.sa-card .sa-table-wrap:has(.sa-report) { overflow-x: auto; }
.sa-report tbody tr { cursor: default; }
.sa-report tbody tr:hover td { background: none; }
.sa-report :is(th, td) + :is(th, td) { text-align: right; font-variant-numeric: tabular-nums; }
.sa-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--a-accent); color: var(--a-accent-fg); padding: 8px 14px; border-radius: var(--a-r-control); font-size: 13px; z-index: 50; }
.sa-toast:empty { padding: 0; }
.sa-notice .sa-btn { color: var(--a-fg); }
.sa-toast:not(:empty) { animation: sa-wait 150ms ease-out; }
.sa-timeline { display: grid; gap: 10px; list-style: none; padding: 0; margin: 0; }
.sa-timeline li { border-left: 2px solid var(--a-border); padding-left: 12px; }
.sa-kbd { font-size: 12px; color: var(--a-muted); white-space: nowrap; }
.sa-hint { white-space: nowrap; }
.sa-team { margin-left: 6px; }
.sa-deal [data-stale] { color: var(--a-warn); font-weight: 600; }
.sa .sa-title-edit { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: inherit; line-height: 32px; color: inherit; background: none; border: 0; padding: 0 4px; margin: 0 -4px; border-radius: var(--a-r-inner); cursor: text; text-align: left; }
.sa .sa-title-edit:hover { background: var(--a-subtle); }
/* The same box as .sa-title-edit, so the title does not move when it turns into a field. */
.sa .sa-title-input { flex: 1; min-width: 0; width: auto; height: 32px; padding: 0 4px; margin: 0 -4px; border: 0; border-radius: var(--a-r-inner); background: var(--a-bg); font: inherit; line-height: 32px; box-shadow: 0 0 0 1px var(--a-border); }
.sa-tags-edit { margin: 0; padding: 0; border: 0; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 24px; }
.sa .sa-tag-chip { height: 24px; padding: 0 2px 0 9px; gap: 2px; color: var(--a-fg); }
.sa .sa-tag-chip button { display: grid; place-items: center; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--a-muted); }
.sa .sa-tag-chip button:hover { background: color-mix(in srgb, var(--a-fg) 10%, transparent); color: var(--a-fg); }
.sa .sa-tag-chip svg { width: 12px; height: 12px; }
.sa .sa-tag-add { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px 0 6px; border: 1px dashed var(--a-border); border-radius: 999px; background: transparent; color: var(--a-muted); font-size: 12px; font-weight: 500; }
.sa .sa-tag-add:hover { border-style: solid; color: var(--a-fg); }
.sa .sa-tag-add svg { width: 12px; height: 12px; }
.sa .sa-tag-new { width: 140px; height: 24px; padding: 0 9px; border: 1px solid var(--a-border); border-radius: 999px; background: var(--a-bg); font-size: 12px; }
.sa .sa-tag-new:focus { outline: 2px solid var(--a-focus); outline-offset: -1px; }
.sa-tag-filter { width: 160px; }
.sa-row-actions { display: flex; justify-content: flex-end; gap: 4px; }
.sa-row-actions .sa-btn { height: 32px; }
/* The row's hover already tints the background, so the buttons lift to the card colour. */
.sa-row-actions .sa-btn:hover { background: var(--a-bg); border-color: var(--a-border); }
.sa-canned-table td:last-child { width: 1%; white-space: nowrap; }
.sa-canned-table .sa-clamp { max-width: 60ch; }
.sa-filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px 12px; padding: 8px 12px; border: 1px solid var(--a-border); border-radius: var(--a-radius); background: var(--a-subtle); }
.sa-filters[hidden] { display: none; }
.sa-filters .sa-field { gap: 2px; margin: 0; color: var(--a-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
/* The controls inherit the label's type through ".sa select". */
.sa-filters :is(.sa-select, .sa-input) { font-size: 14px; font-weight: 400; text-transform: none; letter-spacing: normal; color: var(--a-fg); }
.sa-btn[aria-expanded="true"] { background: var(--a-subtle); }
.sa-btn > .sa-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: var(--a-accent); color: var(--a-accent-fg); font-size: 11px; line-height: 18px; text-align: center; }
.sa-links { display: flex; flex-wrap: wrap; gap: 4px; }
.sa-links .sa-btn svg { width: 12px; height: 12px; }
.sa-views { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; margin: 0; padding: 0; border: 0; }
.sa-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; }
.sa-meta .sa-viewers { margin: 0; }
.sa .sa-tag { height: 20px; padding: 0 7px; font-size: 12px; font-weight: 500; color: var(--a-muted); }
.sa button.sa-tag:hover { color: var(--a-fg); border-color: var(--a-muted); }
.sa-chip-warn::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--a-warn); }
.sa .sa-chip-warn[aria-pressed="true"]::before { background: currentColor; }
.sa .sa-chip[aria-pressed="true"] { background: var(--a-accent); border-color: var(--a-accent); color: var(--a-accent-fg); }
.sa-drop-hint { margin: 0; padding: 14px 8px; border: 1px dashed var(--a-border); border-radius: var(--a-radius); text-align: center; font-size: 12px; color: var(--a-muted); }
@container (max-width: 1400px) { .sa-hint { display: none; } }
.sa-kbd kbd { font: inherit; font-size: 12px; padding: 1px 6px; border: 1px solid var(--a-border); border-bottom-width: 2px; border-radius: min(5px, var(--a-r-inner)); background: var(--a-bg); }

.sa-sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* Held back briefly so a fast load does not flash it; the space is kept meanwhile. */
.sa-skeleton { animation: sa-wait 0s 300ms backwards; }
@keyframes sa-wait { from { opacity: 0; } }
.sa-bone {
  display: inline-block; vertical-align: middle; flex: none; max-width: 100%; height: 1em;
  border-radius: var(--a-r-inner); background: color-mix(in srgb, var(--a-fg) 8%, var(--a-bg));
  animation: sa-pulse 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite alternate;
}
@keyframes sa-pulse { to { opacity: 0.5; } }
@media (prefers-reduced-motion: reduce) { .sa-bone { animation: none; } }
`;
