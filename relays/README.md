# Getting support@ into the helpdesk

Better Helpdesk takes inbound mail on one route: a relay POSTs each raw
message as `message/rfc822` to `{basePath}/inbound/` with
`Authorization: Bearer <inboundWebhookSecret>`. Your mailbox stays where it
is; it hands a copy of each message to a relay address, and the relay hands
it to the app.

Pick the recipe for where support@ lives today, then the relay it forwards
to:

| support@ lives in    | Forward with                         | Relay                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------ |
| Google Workspace     | [a Gmail routing rule](#google-workspace) | [Postmark](#postmark), [Mailgun](#mailgun) or [Cloudflare](#cloudflare-email-routing) |
| Microsoft 365        | [a mail flow rule](#microsoft-365)   | [Postmark](#postmark), [Mailgun](#mailgun) or [Cloudflare](#cloudflare-email-routing) |
| A domain on Cloudflare | nothing                            | [Cloudflare](#cloudflare-email-routing)          |

Every recipe below ends with the same cutover:

1. **Two weeks of dual delivery.** support@ keeps arriving where it does
   today *and* in the helpdesk. Answer from the helpdesk; the old mailbox is
   the safety net if a message does not show up.
2. **Cut over.** Switch the old mailbox's copy off (each recipe says how).
   From that date new conversations start in the helpdesk only.

Replies to the helpdesk's emails come back to `support+<reference>@…` when
`replyToAddress` is set that way, so every forwarding rule has to match the
plus-addressed form as well as the bare address.

If conversations arrive marked as unsigned, a step on the way changed the
message (a subject tag, a footer, a disclaimer) and broke its DKIM signature.
Exempt the relay copy from that step.

## Google Workspace

About 15 minutes, plus the relay. *Not yet walked against a real Google
Workspace account.*

1. In the Admin console, open **Apps → Google Workspace → Gmail → Routing**
   and add a **Routing** rule.
2. Messages to affect: **Inbound**. Under **Envelope filter**, tick **Only
   affect specific envelope recipients**, choose **Pattern match** and enter
   `support(\+.*)?@example\.com`.
3. Under **Also deliver to**, add the relay address (your Postmark inbound
   address or `support@in.example.com` on Cloudflare).
4. Save. Send a test from an outside address and check it lands in both
   Gmail and the helpdesk.

Cutover: edit the rule, tick **Change envelope recipient** and set it to the
relay address, and remove the **Also deliver to** entry. Gmail stops getting
a copy. Turn off the old mailbox's vacation responder, filters and
forwarding first, so customers do not get two acknowledgements. If support@
is a group rather than a user, the same rule works, or add the relay address
as a group member and later remove the others.

## Microsoft 365

About 15 minutes, plus the relay. *Not yet walked against a real Microsoft
365 tenant.*

1. In the Exchange admin center, open **Mail flow → Rules** and **Add a rule
   → Create a new rule**.
2. **Apply this rule if**: *The recipient is* support@example.com.
3. **Do the following**: *Add recipients → to the Bcc box*, the relay
   address.
4. Put the rule first and save. Send a test from an outside address and
   check it lands in both Outlook and the helpdesk.

If the copy never arrives, check whether the outbound anti-spam policy
blocks automatic external forwarding for the tenant.

Cutover: change the action to *Redirect the message to* the relay address.
Outlook stops getting a copy. Turn off the old mailbox's automatic replies
and inbox rules first, so customers do not get two acknowledgements.

## Postmark

About 30 minutes. *Not yet walked against a real Postmark account.*

[`postmark.ts`](postmark.ts) receives Postmark's inbound webhook and POSTs
the raw message to the helpdesk. It is a `fetch(request, env)` handler that
deploys as a Cloudflare Worker (`wrangler deploy`) and runs on Deno or Bun
unchanged.

1. Deploy the relay with three variables: `HELPDESK_INBOUND_URL`
   (`https://app.example.com/api/helpdesk/inbound/`),
   `HELPDESK_INBOUND_SECRET` (the host's `inboundWebhookSecret`) and
   `POSTMARK_WEBHOOK_SECRET` (a new random string).
2. In Postmark, create a server and open its **Default Inbound Stream →
   Settings**. Set the webhook URL to
   `https://postmark:<POSTMARK_WEBHOOK_SECRET>@relay.example.com/` and tick
   **Include raw email content in JSON payload**.
3. Use the inbound address Postmark shows on that page as the relay address,
   or set an inbound domain there (an MX record for `in.example.com`
   pointing at `inbound.postmarkapp.com`) and use `support@in.example.com`.
4. Send a test to the relay address and check it lands in the helpdesk.

The relay answers Postmark 200 when the helpdesk took the message, 403 when
the helpdesk can never take it (Postmark then stops retrying) and 502
otherwise, so Postmark retries while the app is down. Messages that failed
for good stay in Postmark's inbound activity, where they can be retried by
hand.

Then forward support@ to the relay address with the Google Workspace or
Microsoft 365 recipe above.

## Mailgun

About 30 minutes. *Not yet walked against a real Mailgun account.*

[`mailgun.ts`](mailgun.ts) receives the form a Mailgun inbound route posts
and POSTs the raw message to the helpdesk. It is a `fetch(request, env)`
handler that deploys as a Cloudflare Worker (`wrangler deploy`) and runs on
Deno or Bun unchanged.

1. Deploy the relay with three variables: `HELPDESK_INBOUND_URL`
   (`https://app.example.com/api/helpdesk/inbound/`),
   `HELPDESK_INBOUND_SECRET` (the host's `inboundWebhookSecret`) and
   `MAILGUN_WEBHOOK_SIGNING_KEY` (**Settings → Webhooks** in Mailgun).
2. In Mailgun, add a receiving domain such as `in.example.com` with the MX
   records it shows, then under **Receiving → Routes** create a route whose
   filter matches `support(\+.*)?@in\.example\.com` and whose action is
   **Forward** to `https://relay.example.com/mime`. The URL has to end in
   `mime`: that is what makes Mailgun post the raw message.
3. Use `support@in.example.com` as the relay address.
4. Send a test to the relay address and check it lands in the helpdesk.

The relay checks the signature on every post against the signing key,
answers Mailgun 200 when the helpdesk took the message, 406 when the
helpdesk can never take it (Mailgun then stops retrying) and 502 otherwise,
so Mailgun retries for eight hours while the app is down.

Then forward support@ to the relay address with the Google Workspace or
Microsoft 365 recipe above.

## Cloudflare Email Routing

About 30 minutes, if the domain's DNS is on Cloudflare. *Not yet walked
against a real Cloudflare account since moving here.*

[`cloudflare-email-worker.js`](cloudflare-email-worker.js) is an Email
Worker that relays each message unmodified.

1. Enable Email Routing on a subdomain, for instance `in.example.com`, so
   the main domain's MX records stay as they are.
2. Create a Worker from `cloudflare-email-worker.js` and bind
   `HELPDESK_INBOUND_URL`, `HELPDESK_INBOUND_SECRET` and, optionally,
   `FALLBACK_ADDRESS`: a verified address that gets the message when the
   app cannot take it.
3. Add a routing rule that sends `support@in.example.com` to the Worker.
4. Send a test to the relay address and check it lands in the helpdesk.

When support@ is itself on this domain, route it to the Worker directly.
Email Routing sends an address to one destination, so there is no second
copy for the two weeks; set your current destination as `FALLBACK_ADDRESS`
so a message the app cannot take still reaches it. Otherwise forward
support@ to `support@in.example.com` with the Google Workspace or Microsoft
365 recipe above.
