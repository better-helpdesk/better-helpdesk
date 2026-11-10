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
  // The widget renders in a shadow root, so its own events are the signal.
  document.addEventListener('helpdesk:open', () =>
    posthog.capture('widget_opened')
  );
  document.addEventListener('helpdesk:message-sent', event => {
    const { inbox, type } = (
      event as CustomEvent<{ inbox: string; type: string }>
    ).detail;
    posthog.capture('widget_message_sent', { inbox, type });
  });
  // The agent UI emits no event for a reply, so the demo's own API call is the signal.
  // ponytail: wraps fetch; listen for an agent UI event instead once the package has one.
  const send = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await send(input, init);
    if (
      response.ok &&
      init?.method === 'POST' &&
      typeof input === 'string' &&
      /^\/demo\/api\/agent\/conversations\/[^/]+\/messages\/?$/.test(input)
    ) {
      posthog.capture('demo_agent_replied', {
        internal: String(init.body).includes('"internal":true'),
      });
    }
    return response;
  };
}
