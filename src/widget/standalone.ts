import { defineHelpdeskWidget } from './element';

/**
 * Script-tag entry: `<script src=".../support/widget.js" data-api="…"
 * data-inbox="sales" data-locale="de" data-types="lead" async>`. Mounts one
 * `<helpdesk-widget>` configured from the tag's data attributes.
 */
const script = document.currentScript as HTMLScriptElement | null;

defineHelpdeskWidget();

function mount() {
  if (document.querySelector('helpdesk-widget')) return;
  const element = document.createElement('helpdesk-widget');
  for (const [name, value] of Object.entries(script?.dataset ?? {})) {
    if (value !== undefined) element.setAttribute(name, value);
  }
  document.body.append(element);
}

if (document.body) mount();
else document.addEventListener('DOMContentLoaded', mount);
