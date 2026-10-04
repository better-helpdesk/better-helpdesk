import { defineHelpdeskWidget } from './element';

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
const owned = new WeakSet<Element>();

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
    if (value !== undefined) element.setAttribute(name, value);
  }
  // Relative to the script, so without `data-api` it talks to where it came from.
  element.setAttribute(
    'api',
    new URL(
      script?.dataset.api ?? '/api/helpdesk',
      script?.src || location.href
    ).href.replace(/\/$/, '')
  );
  document.body.append(element);
}

if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount);
