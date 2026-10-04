import { defineHelpdeskWidget } from './element';

const OWNED = Symbol.for('better-helpdesk.owned');

/**
 * Script-tag entry: `<script src=".../support/widget.js" data-api="…"
 * data-inbox="sales" data-locale="de" data-types="lead" async>`. Mounts one
 * `<helpdesk-widget>` configured from the tag's data attributes.
 *
 * Only the element this script creates comes alive: a `<helpdesk-widget>`
 * already in the markup could have been put there by anyone who can inject
 * HTML, pointing `api` wherever they like.
 */
const script = document.currentScript as HTMLScriptElement | null;
// Shared by every run of this script: a page that adds the tag again (a
// locale switch) gets a new element, but the class the first run registered
// is the one that checks it.
const registry = globalThis as { [OWNED]?: WeakSet<Element> };
registry[OWNED] ??= new WeakSet<Element>();
const owned = registry[OWNED];

defineHelpdeskWidget('helpdesk-widget', {
  owns: element => owned.has(element),
});

function mount() {
  for (const existing of document.querySelectorAll('helpdesk-widget')) {
    if (owned.has(existing)) return;
  }
  const element = document.createElement('helpdesk-widget');
  owned.add(element);
  for (const [name, value] of Object.entries(script?.dataset ?? {})) {
    // `data-identity-token` arrives as `identityToken`.
    const attribute = name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
    if (value !== undefined) element.setAttribute(attribute, value);
  }
  document.body.append(element);
}

if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount);
