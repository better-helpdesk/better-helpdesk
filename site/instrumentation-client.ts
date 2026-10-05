import posthog from 'posthog-js';

// The project token is public by design: it only lets a browser send events.
if (process.env.NODE_ENV === 'production') {
  posthog.init('phc_AVRaWETn3mh9cKptxFjZWXW92hZE9yEprAA38aSjWeTp', {
    api_host: 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-05-30',
    // Nothing is stored in the browser; PostHog counts visitors by a daily hash.
    cookieless_mode: 'always',
    disable_session_recording: true,
    // The agent UI shows customers' conversations, so nothing leaves it.
    before_send: event =>
      /^\/(helpdesk|login)(\/|$)/.test(location.pathname) ? null : event,
  });
}
