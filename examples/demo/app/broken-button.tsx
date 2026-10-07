'use client';

import { shatter } from './glass';

let pressedUntil = 0;

const BUG_REPORT = {
  type: 'bug',
  subject: 'The broken button threw an error',
  message:
    'I pressed the broken button on the Harbor page, and it threw an error.',
};

/**
 * Throws on purpose: the widget records the error, and opens on a bug report
 * that offers it. The page's ground cracks first, behind the content.
 */
export function BrokenButton() {
  return (
    <button
      type="button"
      className="btn btn-quiet btn-step"
      onClick={event => {
        const now = performance.now();
        // A repeat press while the glass is up adds no layer and no duplicate error.
        if (now < pressedUntil) return;
        pressedUntil = now + 2000;
        const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!calm) {
          const button = event.currentTarget;
          const box = button.getBoundingClientRect();
          // detail is 0 for Enter and Space: crack from the button's centre.
          shatter(
            event.detail ? event.clientX : box.left + box.width / 2,
            event.detail ? event.clientY : box.top + box.height / 2
          );
          button.animate(
            [
              { transform: 'translateX(2px)', easing: 'steps(1)' },
              { transform: 'translateX(-2px)', easing: 'steps(1)' },
              { transform: 'none' },
            ],
            { duration: 120 }
          );
        }
        setTimeout(
          () => document.querySelector('helpdesk-widget')?.open(BUG_REPORT),
          calm ? 0 : 480
        );
        throw new TypeError(
          "Cannot read properties of undefined (reading 'eta')"
        );
      }}>
      Try the broken button
    </button>
  );
}
