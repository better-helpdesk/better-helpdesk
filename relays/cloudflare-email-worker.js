/**
 * Cloudflare Email Worker that relays each message, unmodified, to the
 * helpdesk's `/inbound/` route. Deploy it on the subdomain your mailbox
 * forwards to and bind:
 *   HELPDESK_INBOUND_URL    e.g. https://app.example.com/api/helpdesk/inbound/
 *   HELPDESK_INBOUND_SECRET the host's inboundWebhookSecret
 *   FALLBACK_ADDRESS        optional verified address that gets the mail if
 *                           the app cannot take it
 */
export default {
  async email(message, env) {
    const raw = await new Response(message.raw).arrayBuffer();
    let status = 0;
    try {
      const response = await fetch(env.HELPDESK_INBOUND_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.HELPDESK_INBOUND_SECRET}`,
          'content-type': 'message/rfc822',
        },
        body: raw,
      });
      status = response.status;
    } catch {
      status = 0;
    }
    if (status >= 200 && status < 300) return;
    if (env.FALLBACK_ADDRESS) {
      await message.forward(env.FALLBACK_ADDRESS);
      return;
    }
    message.setReject(`Support inbox unavailable (${status || 'unreachable'})`);
  },
};
