// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

describe('standalone loader', () => {
  it('brings only its own widget to life, never one already in the markup', async () => {
    document.body.innerHTML =
      '<helpdesk-widget api="https://attacker.test/x" inbox="sales"></helpdesk-widget>';
    const planted = document.querySelector('helpdesk-widget');

    await import('./standalone');

    const widgets = document.querySelectorAll('helpdesk-widget');
    expect(widgets).toHaveLength(2);
    expect(planted?.shadowRoot).toBeNull();
    const own = widgets[1];
    expect(own?.shadowRoot).not.toBeNull();
    expect(own?.getAttribute('api')).toBe(
      new URL('/api/helpdesk', location.href).href
    );

    document.body.innerHTML = '';
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});
