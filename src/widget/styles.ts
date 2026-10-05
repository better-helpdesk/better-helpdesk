export const widgetCss = `
:host {
  --s-accent: var(--helpdesk-accent, #0c2034);
  --s-accent-hover: var(--helpdesk-accent-hover, #243b53);
  --s-accent-fg: var(--helpdesk-accent-fg, #f0f4f8);
  --s-bg: var(--helpdesk-bg, #ffffff);
  --s-fg: var(--helpdesk-fg, #0c2034);
  --s-muted: var(--helpdesk-muted, #486581);
  --s-border: var(--helpdesk-border, #d9e2ec);
  --s-subtle: var(--helpdesk-subtle, #f0f4f8);
  --s-danger: var(--helpdesk-danger, #cf1124);
  --s-on-danger: #ffffff;
  --s-focus: var(--helpdesk-focus, #f55068);
  --s-launcher-bg: var(--helpdesk-launcher-bg, var(--s-accent));
  --s-launcher-fg: var(--helpdesk-launcher-fg, var(--s-accent-fg));
  --s-head-bg: var(--helpdesk-panel-header-bg, var(--s-accent));
  --s-head-fg: var(--helpdesk-panel-header-fg, var(--s-accent-fg));
  --s-radius: var(--helpdesk-radius, 12px);
  --s-r-control: calc(var(--s-radius) - 2px);
  --s-r-inner: calc(var(--s-radius) - 4px);
  --s-r-dialog: calc(var(--s-radius) + 4px);
  --s-r-round: calc(var(--s-radius) * 99);
  --s-shadow-color: color-mix(in srgb, var(--s-fg) 14%, transparent);
  --s-highlight: inset 0 1px 0 color-mix(in srgb, var(--s-fg) 4%, transparent);
  --s-shadow-pop: var(--helpdesk-shadow, var(--s-highlight), 0 8px 24px var(--s-shadow-color));
  --s-shadow-dialog: var(--helpdesk-shadow, var(--s-highlight), 0 24px 64px color-mix(in srgb, var(--s-fg) 25%, transparent));
  --s-offset: var(--helpdesk-offset-bottom, 20px);
  --s-fast: 120ms;
  --s-base: 200ms;
  --s-ease: cubic-bezier(0.16, 1, 0.3, 1);
  font-family: var(--helpdesk-font, system-ui, -apple-system, 'Segoe UI', sans-serif);
  font-size: 14px;
  line-height: 1.45;
  color: var(--s-fg);
  position: fixed;
  z-index: 2147483000;
  bottom: var(--s-offset);
  right: 20px;
}
* { box-sizing: border-box; }
button, input, textarea, select { font: inherit; color: inherit; }
button { cursor: pointer; }
:focus-visible { outline: 2px solid var(--s-focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.launcher {
  height: 56px; min-width: 56px; border-radius: var(--s-r-round); border: 0; padding: 0 16px;
  background: var(--s-launcher-bg); color: var(--s-launcher-fg);
  box-shadow: var(--s-shadow-pop);
  display: flex; align-items: center; justify-content: center; gap: 8px; position: relative;
  font-weight: 600; transition: transform var(--s-fast) ease;
}
.launcher:active { transform: scale(0.96); }
.launcher svg { width: 24px; height: 24px; transition: transform var(--s-base) ease; flex: none; }
.launcher[aria-expanded="true"] svg { transform: rotate(90deg); }
.agent-note { display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 13px; color: var(--s-fg); background: color-mix(in srgb, var(--s-accent) 8%, var(--s-bg)); border-bottom: 1px solid var(--s-border); text-decoration: none; }
.agent-note:hover .agent-note-link { text-decoration: underline; }
.agent-note-text { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-note-link { flex: none; font-weight: 600; color: var(--s-accent); }
.agent-dot { position: relative; flex: none; width: 8px; height: 8px; border-radius: var(--s-r-round); background: var(--s-accent); }
.agent-dot::after { content: ''; position: absolute; inset: 0; border-radius: var(--s-r-round); background: inherit; animation: agent-ping 4s cubic-bezier(0, 0, 0.2, 1) infinite; }
.agent-dot.on-launcher { position: absolute; top: 6px; right: 6px; background: var(--s-launcher-fg); box-shadow: 0 0 0 2px var(--s-launcher-bg); }
@keyframes agent-ping { 0% { transform: scale(1); opacity: 0.6; } 40%, 100% { transform: scale(2.6); opacity: 0; } }
.rich { display: grid; gap: 6px; }
.rich p, .rich ul, .rich ol { margin: 0; }
.rich ul, .rich ol { padding-left: 20px; }
.rich a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
.code { display: flex; flex-direction: column; min-width: 0; border: 1px solid color-mix(in srgb, currentColor 15%, transparent); border-radius: var(--s-r-inner); background: color-mix(in srgb, currentColor 6%, transparent); white-space: normal; }
.code pre { margin: 0; padding: 2px 10px 8px; overflow: auto; max-height: 240px; white-space: pre; tab-size: 4; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.code pre:focus-visible { outline-offset: -2px; }
.code-bar { order: -1; display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding: 4px 4px 0; font-size: 12px; }
.code-bar button { min-height: 24px; padding: 0 8px; border: 0; border-radius: var(--s-r-inner); background: transparent; color: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.code-bar button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
.rt-input pre { margin: 4px 0; padding: 8px 10px; border-radius: var(--s-r-inner); background: var(--s-subtle); white-space: pre-wrap; font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.rt-toolbar { display: flex; gap: 2px; margin-top: 4px; }
.rt-toolbar button { display: grid; place-items: center; width: 32px; height: 28px; border: 0; border-radius: var(--s-r-inner); background: transparent; color: var(--s-muted); cursor: pointer; }
.rt-toolbar button:hover { background: var(--s-subtle); color: var(--s-fg); }
.rt-toolbar button:focus-visible { outline: 2px solid var(--s-focus); outline-offset: 0; }
.rt-toolbar svg { width: 16px; height: 16px; }
.badge {
  position: absolute; top: -2px; right: -2px; min-width: 20px; height: 20px;
  border-radius: var(--s-r-round); background: var(--s-danger); color: var(--s-on-danger);
  font-size: 12px; line-height: 20px; padding: 0 6px; text-align: center;
}

.panel {
  position: absolute; bottom: 72px; right: 0;
  width: min(400px, calc(100vw - 40px)); height: min(640px, calc(100vh - 100px - var(--s-offset)));
  background: var(--s-bg); border: var(--helpdesk-panel-border, 1px solid var(--s-border));
  border-radius: var(--s-radius);
  box-shadow: var(--s-shadow-dialog);
  display: flex; flex-direction: column; overflow: hidden;
  animation: panel-in var(--s-base) var(--s-ease);
}
@keyframes panel-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.panel > .body, .panel > .form { animation: fade-in var(--s-fast) linear; }
@media (min-width: 481px) {
  .panel[data-fit] { height: auto; max-height: min(640px, calc(100vh - 100px - var(--s-offset))); }
}
@media (max-width: 480px) {
  .panel { position: fixed; inset: 0; width: 100vw; height: 100dvh; border-radius: 0; border: 0; bottom: 0; }
  .launcher[aria-expanded="true"] { display: none; }
  input, textarea, select, .rt-input { font-size: 16px !important; }
  .tabs button, .secondary, .switch { min-height: 44px; }
  .send { width: 44px; height: 44px; }
}

.head { background: var(--s-head-bg); color: var(--s-head-fg); padding: 8px 10px 14px 16px; }
.head-row { display: flex; align-items: center; gap: 4px; }
.head-title { flex: 1; min-width: 0; font-weight: 600; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.subject { display: block; overflow-wrap: anywhere; }
.icon-btn {
  width: 44px; height: 44px; border: 0; border-radius: var(--s-r-inner); background: transparent; color: inherit;
  display: grid; place-items: center; flex: none;
}
.panel .icon-btn { margin-left: -8px; margin-right: -2px; }
.icon-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); }
.icon-btn svg { width: 20px; height: 20px; }
.menu .icon-btn svg { stroke-width: 3.5; }
.presence { display: flex; align-items: center; gap: 10px; margin: 4px 0; padding-right: 8px; font-size: 13px; opacity: 0.9; }
.avatars { display: flex; }
.presence .avatars { height: 2lh; }
.presence .avatar { width: auto; height: 100%; aspect-ratio: 1; }
.avatar {
  width: 28px; height: 28px; border-radius: var(--s-r-round); display: grid; place-items: center; flex: none;
  --s-avatar-bg: color-mix(in srgb, var(--s-fg) 12%, var(--s-subtle));
  font-size: 11px; font-weight: 700; background: var(--s-avatar-bg); color: var(--s-accent);
  border: 2px solid var(--s-head-bg);
}
.avatars .avatar + .avatar { margin-left: -8px; }

.tabs { display: flex; border-bottom: 1px solid var(--s-border); }
.tabs button {
  flex: 1; padding: 12px; background: none; border: 0; border-bottom: 2px solid transparent;
  color: var(--s-muted); font-weight: 500;
}
.tabs button[aria-selected="true"] { color: var(--s-fg); border-bottom-color: var(--s-accent); }
.unread-dot { display: inline-block; width: 8px; height: 8px; border-radius: var(--s-r-round); background: var(--s-accent); margin-left: 6px; vertical-align: middle; }

.form { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.sent-fields { display: contents; }
.footer { border-top: 1px solid var(--s-border); padding: 16px; display: grid; gap: 8px; background: var(--s-bg); }
.composer-error { margin: 0; padding: 0 12px 10px; }
.resolve { display: flex; justify-content: flex-end; padding: 0 12px 8px; }
.resolve button { min-height: 32px; padding: 0 4px; border: 0; background: none; color: var(--s-muted); font-size: 13px; }
.resolve button:hover:not(:disabled) { color: var(--s-fg); text-decoration: underline; }
.resolve button:focus-visible { outline: 2px solid var(--s-focus); outline-offset: 2px; border-radius: min(4px, var(--s-r-inner)); }
.resolve button:disabled { cursor: default; opacity: 0.6; }
img.avatar { object-fit: cover; padding: 0; }
.body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.body > * { flex-shrink: 0; }
.types { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.type {
  display: grid; align-content: start; gap: 4px;
  text-align: left; padding: 12px; border: 1px solid var(--s-border);
  border-radius: var(--s-r-control); background: var(--s-subtle);
  transition: border-color var(--s-fast) ease, background-color var(--s-fast) ease;
}
.type:hover { border-color: color-mix(in srgb, var(--s-accent) 30%, var(--s-border)); background: color-mix(in srgb, var(--s-accent) 6%, var(--s-subtle)); }
.item:hover { background: var(--s-subtle); }
.type:active, .item:active { background: color-mix(in srgb, var(--s-fg) 8%, var(--s-subtle)); }
.type strong { font-weight: 600; }
.type small { color: var(--s-muted); font-size: 12px; line-height: 1.4; }

.field { display: grid; gap: 6px; font-size: 13px; font-weight: 500; }
.field .hint { color: var(--s-muted); font-weight: 400; }
.choices { border: 0; margin: 0; padding: 0; min-width: 0; }
.choices legend { padding: 0; margin-bottom: 6px; }
.choice { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; margin-top: 6px; padding: 8px 12px; text-align: left; font: inherit; font-weight: 400; color: inherit; background: var(--s-subtle); border: 1px solid transparent; border-radius: var(--s-r-control); cursor: pointer; }
.choice input { appearance: none; margin: 0; flex: none; width: 16px; height: 16px; border: 1.5px solid var(--s-muted); border-radius: var(--s-r-round); background: var(--s-bg); }
.choice input:checked { border: 5px solid var(--s-accent); }
.choice input:focus { outline: none; border-color: var(--s-muted); }
.choice input:checked:focus { border-color: var(--s-accent); }
.choice:hover { border-color: var(--s-border); }
.choice:has(input:checked) { background: color-mix(in srgb, var(--s-accent) 6%, var(--s-bg)); border-color: var(--s-accent); font-weight: 600; }
@media (max-width: 480px) { .choice { min-height: 44px; } }
.choice:has(input:focus-visible) { outline: 2px solid var(--s-accent); outline-offset: 2px; }
input[type="text"], input[type="email"], textarea, select {
  width: 100%; padding: 9px 11px; border: 1px solid var(--s-border);
  border-radius: var(--s-r-inner); background: var(--s-bg); color: var(--s-fg); font-size: 14px;
}
select { appearance: none; background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%); background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 30px; }
textarea { min-height: 88px; resize: none; }
.rt { display: grid; gap: 4px; min-width: 0; }
.rt-input {
  width: 100%; min-height: 88px; max-height: 240px; overflow-y: auto; padding: 9px 11px;
  border: 1px solid var(--s-border); border-radius: var(--s-r-inner); background: var(--s-bg); color: var(--s-fg);
  font-size: 14px; line-height: 1.5; font-weight: 400; overflow-wrap: anywhere; cursor: text;
}
.rt-input:focus { outline: 2px solid var(--s-focus); outline-offset: 0; border-color: transparent; }
.rt-input[data-empty]::before { content: attr(data-placeholder); color: var(--s-muted); pointer-events: none; }
.rt-input[data-empty] > :first-child:is(br, div:only-child) { display: none; }
.rt-input ul, .rt-input ol { margin: 0; padding-left: 20px; }
.rt-input a { color: var(--s-accent); text-decoration: underline; }
.rt-link { display: flex; gap: 6px; }
.rt-link input { flex: 1; min-width: 0; padding: 5px 8px; font-size: 13px; }
.rt-link button { flex: none; padding: 0 10px; border: 1px solid var(--s-border); border-radius: var(--s-r-inner); background: var(--s-bg); font-size: 13px; font-weight: 600; cursor: pointer; }
/* With a toolbar the field is one box: the border and focus ring wrap both, a hairline divides them. */
.rt-form { gap: 0; border: 1px solid var(--s-border); border-radius: var(--s-r-inner); background: var(--s-bg); overflow: hidden; }
.rt-form:focus-within { outline: 2px solid var(--s-focus); outline-offset: -1px; border-color: transparent; }
.rt-form .rt-input { border: 0; border-radius: 0; }
.rt-form .rt-input:focus { outline: none; }
.rt-form .rt-toolbar, .rt-form .rt-link { margin: 0; padding: 4px 6px; border-top: 1px solid var(--s-border); background: var(--s-bg); }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--s-focus); outline-offset: 0; border-color: transparent; }
.switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 32px; font-size: 13px; color: var(--s-fg); cursor: pointer; }
.switch input { appearance: none; flex: none; position: relative; width: 36px; height: 20px; margin: 0; border-radius: var(--s-r-round); background: var(--s-border); cursor: pointer; transition: background-color var(--s-fast); }
.switch input::before { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: var(--s-r-round); background: var(--s-bg); box-shadow: 0 1px 2px var(--s-shadow-color); transition: transform var(--s-fast); }
.switch input:checked { background: var(--s-accent); }
.switch input:checked::before { transform: translateX(16px); }
.switch input:focus { outline: none; }
.switch input:focus-visible { outline: 2px solid var(--s-focus); outline-offset: 2px; }
.check { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--s-fg); cursor: pointer; }
.check input { appearance: none; width: 18px; height: 18px; border: 1.5px solid var(--s-muted); border-radius: min(5px, var(--s-r-inner)); margin: 1px 0 0; flex: none; display: grid; place-items: center; background: var(--s-bg); }
.check input:checked { background: var(--s-accent); border-color: var(--s-accent); }
.check input:checked::after { content: ''; width: 5px; height: 9px; border: solid var(--s-accent-fg); border-width: 0 2px 2px 0; transform: rotate(45deg) translate(-1px, -1px); }

.primary {
  height: 42px; padding: 0 16px; border: 0; border-radius: var(--s-r-inner);
  background: var(--s-accent); color: var(--s-accent-fg); font-weight: 600;
}
.primary:hover { background: var(--s-accent-hover); }
.primary, .secondary, .send { transition: transform 80ms ease-out; }
.primary:active:not(:disabled), .secondary:active, .send:active:not(:disabled) { transform: scale(0.97); }
@media (prefers-reduced-motion: reduce) { .primary, .secondary, .send { transition: none; } }
.primary:disabled { background: var(--s-subtle); color: var(--s-muted); cursor: default; }
.secondary {
  height: 36px; padding: 0 12px; border: 1px solid var(--s-border); border-radius: var(--s-r-inner);
  background: var(--s-bg); display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500;
}
.secondary:hover { background: var(--s-subtle); }
.secondary svg { width: 16px; height: 16px; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.muted { color: var(--s-muted); font-size: 13px; }
.fine { color: var(--s-muted); font-size: 12px; }
.fine a { color: inherit; }
.your-turn { color: var(--s-fg); font-weight: 600; }
.your-turn::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: var(--s-r-round); background: var(--s-accent); vertical-align: 1px; }
.strip { padding: 8px 12px; border-radius: var(--s-r-inner); background: var(--s-subtle); color: var(--s-muted); font-size: 13px; }
.strip[data-your-turn] { color: var(--s-fg); font-weight: 600; }
.strip[data-your-turn]::before { content: ""; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: var(--s-r-round); background: var(--s-accent); vertical-align: 1px; }
.error { color: var(--s-danger); font-size: 13px; }

.box { border: 1px solid var(--s-border); border-radius: var(--s-r-control); background: var(--s-subtle); }
.box > summary { list-style: none; cursor: pointer; padding: 10px 12px; display: flex; gap: 8px; align-items: center; font-size: 13px; }
.box > summary::-webkit-details-marker { display: none; }
.box > summary .muted { margin-left: auto; }
.box-body { padding: 0 12px 12px; display: grid; gap: 8px; }
.help { overflow: hidden; }
.help-heading { display: block; padding: 8px 12px 4px; font-size: 12px; color: var(--s-muted); }
.help ul { list-style: none; margin: 0; padding: 0 0 4px; }
.help a { display: grid; gap: 1px; padding: 6px 12px; text-decoration: none; color: inherit; }
.help a:hover { background: color-mix(in srgb, var(--s-accent) 5%, transparent); }
.help-title { color: var(--s-accent); font-weight: 600; font-size: 13px; }
.help-excerpt { color: var(--s-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.context-value { word-break: break-all; color: var(--s-muted); }

.thumbs { display: flex; gap: 8px; flex-wrap: wrap; }
.thumb { position: relative; width: 72px; height: 72px; border: 1px solid var(--s-border); border-radius: var(--s-r-inner); overflow: hidden; }
.thumb img { width: 100%; height: 100%; object-fit: cover; }
.thumb span { display: grid; place-items: center; height: 100%; font-size: 11px; padding: 4px; text-align: center; word-break: break-all; }
.thumb button { position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; border: 0; border-radius: var(--s-r-inner); background: color-mix(in srgb, var(--s-fg) 65%, transparent); color: var(--s-bg); font-size: 12px; }

.list { display: grid; gap: 8px; }
.item {
  text-align: left; width: 100%; padding: 12px; border: 1px solid var(--s-border);
  border-radius: var(--s-r-control); background: var(--s-bg); display: grid; gap: 3px; min-width: 0; overflow: hidden;
  transition: background-color var(--s-fast) ease;
}
.item.your-turn-card { position: relative; }
.item.your-turn-card::before { content: ''; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 0 min(2px, var(--s-r-inner)) min(2px, var(--s-r-inner)) 0; background: var(--s-accent); }
.item > * { min-width: 0; }
.item-top { display: flex; gap: 8px; align-items: baseline; }
.item-top .fine { flex: none; }
.item-top strong { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item .preview { color: var(--s-muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item.unread strong::after { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: var(--s-r-round); background: var(--s-accent); margin-left: 6px; vertical-align: middle; }

.notice { border-radius: var(--s-r-control); padding: 12px; background: var(--s-subtle); font-size: 13px; display: grid; gap: 4px; }
.notice strong { font-weight: 600; }
.notice .book { margin-top: 4px; }
.notice a { color: var(--s-accent); font-weight: 600; }
.notice-danger .secondary { color: var(--s-fg); }
.notice-danger { background: color-mix(in srgb, var(--s-danger) 8%, var(--s-bg)); color: var(--s-danger); justify-items: start; gap: 8px; }
.msgs { display: flex; flex-direction: column; gap: 12px; }
.msg-row { display: flex; gap: 8px; align-items: flex-end; }
.msg-row.mine { justify-content: flex-end; }
.msg { max-width: 80%; padding: 9px 12px; border-radius: var(--s-radius); white-space: pre-wrap; word-wrap: break-word; }
.msg-row.mine .msg { background: var(--s-accent); color: var(--s-accent-fg); border-bottom-right-radius: min(4px, var(--s-r-inner)); }
.msg-row.theirs .msg { background: var(--s-subtle); border-bottom-left-radius: min(4px, var(--s-r-inner)); }
.msg-meta { display: block; font-size: 12px; margin-bottom: 2px; color: color-mix(in srgb, var(--s-fg) 80%, var(--s-subtle)); }
/* The accent pair is the host's own contrast ceiling, so mixing toward the accent could only lower it. */
.msg-row.mine .msg-meta { color: var(--s-accent-fg); }
.msg-row .avatar { width: 26px; height: 26px; font-size: 10px; border: 0; background: var(--s-accent); color: var(--s-accent-fg); }
.files a { display: block; color: var(--s-accent); font-size: 13px; padding: 2px 0; }

.composer { border-top: 1px solid var(--s-border); background: var(--s-subtle); padding: 10px 12px; display: flex; gap: 8px; align-items: flex-end; }
.rt-reply { flex: 1; min-width: 0; }
.rt-reply .rt-input { min-height: 42px; max-height: 160px; }
.send { width: 42px; height: 42px; border-radius: var(--s-r-round); border: 0; background: var(--s-accent); color: var(--s-accent-fg); display: grid; place-items: center; flex: none; }
.send:disabled { background: var(--s-subtle); color: var(--s-muted); }
.send svg { width: 18px; height: 18px; }
.menu { position: relative; }
.menu-pop { position: absolute; right: 0; top: 44px; min-width: 240px; background: var(--s-bg); color: var(--s-fg); border: 1px solid var(--s-border); border-radius: var(--s-r-control); padding: 8px 12px; box-shadow: var(--s-shadow-pop); z-index: 2; }

.redact { position: fixed; inset: 0; background: rgb(0 0 0 / 0.7); display: grid; place-items: center; padding: 20px; }
.redact-inner { background: var(--s-bg); border-radius: var(--s-r-dialog); padding: 16px; display: grid; gap: 10px; max-width: 95vw; max-height: 95vh; }
.redact canvas { max-width: calc(95vw - 32px); max-height: calc(95vh - 140px); cursor: crosshair; border: 1px solid var(--s-border); }

@media (prefers-reduced-motion: reduce) {
  :host { --s-fast: 0ms; --s-base: 0ms; }
  .panel { animation: fade-in 120ms linear; }
  .agent-dot::after { animation: none; opacity: 0; }
}

/* Dark follows the OS only when the host asks for it with theme="auto"; a
   host that themes through the variables stays in control otherwise. */
@media (prefers-color-scheme: dark) {
  :host([theme="auto"]) {
    --s-bg: var(--helpdesk-bg, #102a43);
    --s-fg: var(--helpdesk-fg, #f0f4f8);
    --s-muted: var(--helpdesk-muted, #bcccdc);
    --s-border: var(--helpdesk-border, #334e68);
    --s-subtle: var(--helpdesk-subtle, #243b53);
    --s-accent: var(--helpdesk-accent, #f0f4f8);
    --s-accent-hover: var(--helpdesk-accent-hover, #d9e2ec);
    --s-accent-fg: var(--helpdesk-accent-fg, #0c2034);
    --s-head-bg: var(--helpdesk-panel-header-bg, #243b53);
    --s-head-fg: var(--helpdesk-panel-header-fg, #f0f4f8);
  }
}
`;
