# Industry baseline: support that stays up when the product does not

Subject report for the standby exploration, 22 October 2026. Brief:
`docs/research/2026-10/standby/BRIEF.md`. Repository files read:
`docs/product.md`, `AGENTS.md`, `ROADMAP.md`,
`site/content/docs/operations/production.mdx` ("Keep support reachable when
your product is down"), `relays/cloudflare-email-worker.js`.

How to read the labels. **Verified** means I read it on the vendor's or
project's own page (fetched, or quoted by the search tool from that page).
**Reported** means a third party says it (status aggregators, comparison
sites, community threads). **Inferred** means my reasoning from the verified
facts. Prices are list prices as shown on 22 October 2026, USD unless noted.

## Summary

- Every SaaS helpdesk keeps support reachable during a customer's outage by
  one mechanism only: the messenger is loaded from the vendor's CDN and
  talks to the vendor's API, so it never touches the customer's backend
  except for an identity token that the customer's server signs. There is
  no "standby" product anywhere; the separate failure domain is the whole
  answer. (Section 1.)
- No open-source helpdesk (Chatwoot, Libredesk, Zammad, FreeScout, UVdesk,
  Helpy) documents failover, a read-only mode, a queued widget, or a
  two-instance recipe. Zammad's "maintenance mode" is the only named mode
  and it logs agents and customers out. (Section 2.)
- Nobody in the market does "standby, then hand back". The prior art for
  hand-back lives in adjacent products: inbound-mail retry (Postmark about
  10.5 hours, Mailgun 8 hours, SendGrid 72 hours), browser outboxes
  (Workbox, Sentry) that need an idempotency key, CouchDB's revision tree
  for merging, and Cloudflare Always Online for a stale read-only copy with
  a banner. (Section 3.)
- PaaS vendors run support on a separate domain and a separate tool, put
  the status page on a third party (five of seven on Atlassian Statuspage or
  incident.io), and fall back to plain email. Post-mortems from Heroku (June
  2025), Atlassian (April 2022), AWS (October 2025) and Cloudflare (November
  2025) all record support or status channels failing with the product.
  (Section 4.)
- Status pages are priced by audience, monthly, in a $20 to $99 band for
  small teams and $300 to $1,499 above that; uptime monitors sit at $9 to
  $77. That is the "insurance-like add-on" the market already pays for.
  (Section 5.)

## 1. SaaS helpdesks

Common shape, verified per vendor below and inferred as a pattern: the
messenger script is served from a vendor hostname, its API and websocket
live on vendor hostnames, and the customer's own backend is involved only
to sign an identity token (Intercom `user_hash` or JWT, Zendesk messaging
JWT) for logged-in users. On a page that still renders during the
customer's outage, that page's server already produced the token, so the
messenger keeps working. Anonymous visitors need no token. If the
customer's product is down, the messenger on the marketing site keeps
working because nothing in it depends on the product. If the vendor is
down, the customer's product keeps working minus the launcher, because the
loader is an async script (inferred from the install snippets; no vendor
documents a degraded mode).

No vendor documents an offline queue or a read-only mode for the web
messenger. Zendesk's "offline form" is for when no agent is online, not for
an outage. Crisp has a vendor-side "rescue" websocket for its own relay
tier. Status-in-messenger is a plugin category (Atlassian Statuspage,
Sorry, Statuspal, Better Stack, incident.io), not a built-in.

### Intercom

- Hosting. Verified: the install snippet injects an async script from
  `widget.intercom.io/widget/<app_id>`; the API base is
  `api-iam.intercom.io` (EU `api-iam.eu.intercom.io`, AU likewise, set by
  `api_base`). https://www.intercom.com/help/en/articles/168-install-intercom-on-your-website-to-support-and-onboard-logged-in-users,
  https://c15t.com/docs/integrations/intercom
- Dependency on the customer's backend. Verified: identity verification
  needs "an HMAC on your server for each logged-in user", the secret must
  never reach the client, and once enforced "any requests without user
  hashes will be rejected". The article marks identity verification as
  deprecated in favour of JWTs.
  https://www.intercom.com/help/en/articles/183-set-up-identity-verification-for-web-and-mobile
- Status page in the messenger. Verified: the Statuspage app "automatically
  show[s] your most recent status update" on the Messenger home screen;
  customers can open it to subscribe by email or text; agents share it in a
  conversation by hand; with a data connector, Fin "can automatically
  resolve outage-related conversations".
  https://www.intercom.com/help/en/articles/1827049-statuspage-app-notify-customers-about-issues
  Sorry, Statuspal, Better Stack and incident.io offer the same slot (see
  section 6).
- Offline queue. Not found. Reported: a 2025 community thread about messages
  "stuck in Sending" with no fix; a March 2023 incident showed "Lost
  Connection" errors.
  https://community.intercom.com/helpdesk-9/messages-stuck-in-sending-status-anyone-else-facing-this-9861,
  https://www.intercomstatus.com/incidents/53fmm091bz04
- Uptime commitment. Verified: 99.8% per calendar month for the Core
  Platform (Messenger and Inbox) and for Fin, "commercially reasonable
  efforts", effective 11 July 2025. No service credits; the only remedy is
  termination with a refund after two consecutive missed months.
  https://www.intercom.com/legal/service-level-agreement
- When they go down. Verified: the status page moved to
  https://www.finstatus.com/ (intercomstatus.com redirects), hosted on
  incident.io, one page per hosting region. Write-ups: 20 October 2025, US
  region "unreachable from 06:48 to 09:24 UTC" during the AWS us-east-1
  DynamoDB DNS event; 25 January 2025, two PlanetScale shards unhealthy;
  16 March 2026, EU region, telemetry pipeline out-of-memory.
  https://www.intercomstatus.com/us-hosting/incidents/01K806QKYFHM9TEA167TNMT12F/write-up,
  https://www.intercomstatus.com/eu-hosting/incidents/01KKVNFPVWF2QZJ22YX9Z1JJRR/write-up

### Zendesk

- Hosting. Verified: "assets.zendesk.com and static.zdassets.com must be
  reachable because Zendesk's web apps and related features load core
  static resources from those domains".
  https://support.zendesk.com/hc/en-us/articles/4408842860186-Configuring-your-firewall-for-use-with-Zendesk
  Reported: Zendesk publishes no exhaustive domain list and messaging needs
  `wss:` origins. https://docs.report-uri.com/platforms/zendesk/
  Verified: an allowlist in Admin Center decides on which customer domains
  the widget shows.
  https://support.zendesk.com/hc/en-us/articles/10212540848538-Using-an-allowlist-to-manage-where-the-Web-Widget-appears
- Dependency on the customer's backend. Verified: for authenticated
  messaging the developer builds "a back-end service that creates and
  returns signed JWTs"; a rejected JWT means "the conversation begins with
  the user in an unauthenticated state". The article says nothing about the
  JWT endpoint being unavailable.
  https://support.zendesk.com/hc/en-us/articles/4411666638746-Enabling-authenticated-visitors-for-messaging-with-Zendesk-SDKs
- Status page. Verified: the Guide integration uploads
  `statuspage-widget.js` as a theme asset and a snippet in `header.hbs`;
  "the status widget appears in the help center only when there's an impact
  to service"; Growth plan or higher. The Support and Chat integrations show
  incidents to agents beside tickets (Team plan or higher).
  https://support.zendesk.com/hc/en-us/articles/4408821704090-Setting-up-the-Atlassian-Statuspage-integration-for-Guide,
  https://support.zendesk.com/hc/en-us/articles/360039652793
- Offline queue. Not found. Verified: the offline form appears "when your
  widget is offline", meaning no agent online.
  https://support.zendesk.com/hc/en-us/articles/4408825567002-Managing-offline-form-settings
  Reported: a Zendesk product manager wrote that chats are tied to the
  browser session and a disconnected visitor "will be viewed as offline".
  https://support.zendesk.com/hc/en-us/community/posts/4409217434010-Answering-offline-customer
- Uptime commitment. Verified: "at least 99.9% service availability" for
  Premier Support customers on qualifying plans, covering Support,
  Knowledge, Community, Chat and Sunshine Conversations; "Historically,
  Zendesk has maintained a 99.99% level"; credits are claimed by email
  within 60 days and expire after a year.
  https://support.zendesk.com/hc/en-us/articles/9974862958746-About-Zendesk-service-availability,
  https://support.zendesk.com/hc/en-us/articles/10576729658010
- When they go down. Verified: 22 June 2026, 13:33 to 14:23 UTC, "an outage
  with our CDN provider" left Support dashboards blank with login failures
  on several pods, fixed by "a temporary traffic reroute"; further incidents
  24 July 2026 and 4 August 2026.
  https://support.zendesk.com/hc/en-us/articles/10932459149210-Service-Incident-June-22-2026-Support-Multiple-Pods-Support-dashboard-blank-page-errors-and-login-failures,
  https://support.zendesk.com/hc/en-us/articles/11062823488026-Service-Incident-July-24-2026-Support-Multiple-Pods-Customers-experiencing-server-errors-when-trying-to-access-their-Zendesk-instances

### Help Scout

- Hosting. Verified: Beacon loads from `beacon-v2.helpscout.net`;
  `connect-src` needs `beaconapi.helpscout.net` and
  `chatapi.helpscout.net`.
  https://docs.helpscout.com/article/815-csp-settings-for-beacon
  Ad blockers block a file named `beacon.js`; Help Scout expects to stay on
  EasyList. https://docs.helpscout.com/article/911-beacon-and-ad-blockers
- Status page, uptime. Verified: "Over the last 12 months, Help Scout has
  been online 99.99% of the time"; status.helpscout.com "is hosted outside
  of Help Scout's infrastructure and will always be available even if the
  Help Scout app is not accessible". No contractual SLA on the page, and
  nothing about Beacon's behaviour in an outage.
  https://docs.helpscout.com/article/1069-help-scout-uptime
- Offline queue or status integration in Beacon. Not found.

### Crisp

- Hosting. Verified: `client.crisp.chat` (required, "Chat will not work
  without it"), `wss://client.relay.crisp.chat` (required),
  `image.crisp.chat`, `storage.crisp.chat`; and
  `wss://client.relay.rescue.crisp.chat`, "WebSocket (rescue mode)",
  "Fallback if primary WebSocket servers are down (rare)".
  https://docs.crisp.chat/guides/others/whitelisting-our-systems/crisp-domain-names/
  This is the only vendor-side standby I found in the category: a second
  relay the client falls over to. It is Crisp's own redundancy, not
  something the customer gets for its product.
- Status page. Verified: https://status.crisp.chat/ is "Monitored with
  Vigil" (Crisp's open-source monitor) and lists a "Socket rescue tunnel"
  component. No public SLA found. Reported: a partial outage of about 18
  minutes on 3 November 2025.
  https://isdown.app/status/danaconnect/incidents/518602-crisp-services-partial-service-outage
- Offline queue. Not found.

### Plain

- Hosting. Verified: script from `chat.cdn-plain.com`, connections to
  `chat.uk.plain.com`, images from Plain-owned S3 buckets.
  https://help.plain.com/article/chat
- Status page, uptime. Verified: https://status.plain.com/ on incident.io
  with a "Chat API" component and a "Report a problem" link to
  help@plain.com; "for uptime commitments or Service Level Agreements
  (SLAs), please contact our sales team". Support response targets for
  the top tier are P0 3 hours, P1 8 hours.
  https://help.plain.com/article/status
- Offline queue. Not found.

### Front

- Hosting. Verified: `connect-src` needs `chat-assets.frontapp.com`,
  `chat.frontapp.com`, regional `*-chat-server.frontapp.com` hosts,
  `wss://front-us-realtime.ably.io`, `wss://front-eu-realtime.ably.io`,
  `chat-webhook.frontapp.com`; scripts are allowed by nonce.
  https://dev.frontapp.com/docs/content-security-policy
- Uptime commitment, status page. Not found in public pages;
  status.front.com does not resolve. Reported only through aggregators.
  https://incidenthub.cloud/status/front/front-chat
- Offline queue. Not found.

### Freshdesk

- Hosting. Verified: the firewall list names `*.freshdesk.com`,
  `*.freshworks.com`, `*.freshworksapi.com`, `*.rtschannel.com` and
  `*.freshchat.com`; the help widget's hostname is not named separately
  (it falls under the wildcard).
  https://support.freshdesk.com/support/solutions/articles/234412-freshdesk-domains-to-whitelist-in-your-firewall
- Uptime commitment. Not found on a public Freshworks page. Reported: a
  2014 community thread cited 99.8% for Freshservice.
  https://community.freshworks.com/how-do-i-11341/fresh-service-availability-11312
- Status page in the widget, offline queue. Not found.

## 2. Open-source helpdesks

None found, for all six. Specifics:

- Chatwoot. Verified: the production architecture page lists web servers,
  workers, PostgreSQL, Redis, an email service and object storage, and has
  no sentence on high availability, failover, redundancy or what happens
  when a component is down.
  https://developers.chatwoot.com/self-hosted/deployment/architecture
  Reported: Control Plane's template runs several web replicas sharing the
  database and Redis and requires object storage because local attachments
  would 404 from another replica.
  https://docs.controlplane.com/template-catalog/templates/chatwoot
  Nothing found on what the widget does when the server is unreachable.
- Libredesk. Verified: the docs describe a product "distributed as a single
  binary" and contain nothing on high availability, failover, backup,
  multiple instances, read-only mode or widget behaviour when the server
  is down. https://docs.libredesk.io/
- Zammad. Verified: maintenance mode "will restrict access to
  administrative roles only", logs agents and customers off, and offers a
  login banner and a broadcast message to active sessions; the page does
  not say it is read-only and does not mention multiple nodes.
  https://admin-docs.zammad.org/en/latest/system/maintenance.html
  Reported: in the community, "there are currently no guides or plans to
  create a HA setup", and a request to support more than one Elasticsearch
  node. https://community.zammad.org/t/how-to-make-zammad-highly-available/6276,
  https://community.zammad.org/t/support-for-multiple-elasticsearch-nodes/18137
- FreeScout. Partially verified: the wiki index has a "Backup" page and no
  page on high availability, failover or maintenance mode; page bodies did
  not load. https://github.com/freescout-help-desk/freescout/wiki
- UVdesk, Helpy. Nothing found beyond marketplace listings.

Inferred: the open-source answer to "what if it is down" is a managed
host's load balancer and database replication, which keeps the one
instance up but is not a standby that hands back.

## 3. Prior art for "standby, then hand back"

### Cloudflare Always Online

Verified: triggers only on Cloudflare's 520 to 527 codes (origin
unreachable), not on an origin that answers 5xx; serves a stale cached copy
first, then "the most recently archived version" from the Internet Archive;
the archive crawls popular URLs every 30 days on Free, 15 on Pro, 5 on
Business and Enterprise; "dynamic content cannot be served"; visitors see a
banner and a Refresh button; available on all plans.
https://developers.cloudflare.com/cache/about/always-online

Borrow: the honest banner ("you are seeing a standby; refresh to check")
and the trigger discipline (fire on unreachable, not on every error). It
cannot accept writes, so it is a floor, not a model.

### Inbound email retry (Postmark, Mailgun, SendGrid)

- Postmark. Verified: 10 retries, "1 minute, 5 minutes, 10 minutes (x3),
  15 minutes, 30 minutes, 1 hour, 2 hours, 6 hours", "roughly 10.5 hours";
  403 stops retries; afterwards the message is marked Inbound Error and can
  be retried by hand from the UI or `PUT /messages/inbound/{id}/retry`.
  https://postmarkapp.com/support/article/understanding-inbound-webhook-retries-in-postmark,
  https://postmarkapp.com/support/article/1309-how-to-manually-retry-a-failed-inbound-message
- Mailgun. Verified: webhooks are retried "during 8 hours" at 5, 10, 15
  minutes, 1, 2 and 4 hours; 200 succeeds, 406 rejects without retry. The
  page does not say whether forward-to-URL routes follow the same table.
  https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/webhook-retries
  Reported: a feedback thread says receiving "waits and tries again 8
  times". https://feedback.mailgun.com/forums/914635-general-feedback/suggestions/32743354-when-sending-email-to-web-hook-receiving-send-al
- SendGrid. Reported from SendGrid's own article as quoted by search:
  inbound parse retries "for 72 hours from the initial failure".
  https://support.sendgrid.com/hc/en-us/articles/46513815674395
- The repository's Cloudflare Email Worker (`relays/cloudflare-email-worker.js`)
  forwards to `FALLBACK_ADDRESS` on any non-2xx, so it has no retry at
  all: the mailbox is the buffer.

Borrow: the provider's retry queue is already a store-and-forward buffer
with a deadline, and every provider keeps a manual replay. The
reconciliation problem they solved is simply idempotency by message id,
which the helpdesk already has (`emailMessageId` on import). The deadline
matters: an outage longer than 8 to 10.5 hours loses mail unless something
answers the webhook.

### Statuspage subscriber updates

Verified: subscribers get email, SMS and Slack from the page's settings;
webhooks fire on incident creation or update; component subscriptions
exist. https://support.atlassian.com/statuspage/docs/add-and-manage-end-user-subscriptions/
Reported: a component status change without an incident sends no email or
SMS. https://community.atlassian.com/forums/Statuspage-questions/Mail-SMS-notifications/qaq-p/2707685

Borrow: subscription as the customer's side of "read replies": a customer
who wrote during standby subscribes to that conversation and is told when
the product is back and where the thread now lives.

### PWA Background Sync and Workbox

Verified: `BackgroundSyncPlugin` stores failed requests in IndexedDB and
hooks `fetchDidFail`, which "is only invoked if there's an exception
thrown", so a 5xx is not queued unless the app throws on it; with native
Background Sync the browser replays "at an interval managed by the browser,
likely using exponential backoff"; without it Workbox replays "whenever your
service worker starts up"; a failed replay "is put back in the same position
in the queue"; the example retention is 24 hours.
https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
Verified: MDN marks the Background Synchronization API "Limited
availability", "not Baseline because it does not work in some of the most
widely-used browsers". https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API
Reported: an implementation guide recommends "a client-generated request ID
sent as an idempotency key to prevent duplicate orders on replay" and an
`online`-event fallback for Firefox and Safari.
https://blog.openreplay.com/offline-form-submission-background-sync/

Borrow: the idempotency key per submission. Reject as the main mechanism:
the queue lives in one browser tab's IndexedDB, replays only when that
browser returns, and the agent side sees nothing until then.

### Sentry's offline transport

Verified: `makeBrowserOfflineTransport` wraps the fetch transport and queues
envelopes in IndexedDB; `maxQueueSize` defaults to 30; `flushAtStartup`;
`shouldStore` can drop an envelope; "once your application comes back
online, all events will be sent together"; ordering is not documented.
https://docs.sentry.io/platforms/javascript/best-practices/offline-caching/

Borrow: the small bounded queue and the explicit "should I store this"
hook. Same limit as Workbox: client-only.

### Store and forward (Guaranteed Delivery)

Verified: "Use Guaranteed Delivery to make messages persistent so that they
are not lost even if the messaging system crashes"; a send completes only
once the message is in the sender's local store, and it leaves a store only
after the next hop has stored it.
https://www.enterpriseintegrationpatterns.com/patterns/messaging/GuaranteedMessaging.html

Borrow: the acknowledgement rule for hand-back. The standby deletes nothing
until the product has acknowledged the import.

### CouchDB and PouchDB replication

Verified: PouchDB implements CouchDB's replication; offline edits produce
"eventual" conflicts; CouchDB "will choose an arbitrary winner based on a
deterministic algorithm", losing revisions stay in the tree, and the
application resolves them by writing a new revision or deleting the losers.
https://pouchdb.com/guides/conflicts.html,
https://docs.couchdb.org/en/latest/replication/conflicts.html

Borrow: if two sides can ever edit the same record, keep both and pick a
deterministic winner. Better still, design so that they cannot: an
append-only standby (new conversations, new messages) never conflicts with
the product's data, because the product was down.

### Read-only modes in applications

Verified: Jira Data Center's read-only mode lets users search and view
while writes are blocked, with administrators exempt; Confluence Data Center
has the same. https://community.developer.atlassian.com/t/is-your-app-ready-for-read-only-mode-what-jira-data-center-vendors-should-know/101750,
https://confluence.atlassian.com/x/LYCmb
Inferred: these are the shape of an "agents can read, nobody can write"
degraded mode, which is not what the brief wants (customers must write).

### Post-mortems that touch support reachability

- Heroku, 10 June 2025. Verified: "our own tools and the Heroku Status Page
  were also impacted"; "Our status page failed you when you needed it most
  because our primary communication tools were affected by the outage";
  updates went out on X through a workaround at 13:58 UTC; remediation "We
  are building backup communication channels that are fully independent".
  https://www.heroku.com/blog/summary-of-june-10-outage/
- Atlassian, April 2022. Verified: the deletion removed contact data,
  "customers could not file support tickets as they normally would"
  because the form required a valid site URL; remediation "Backup authorized
  account contact information outside of the product instance" and "Create
  mechanisms for customers without a valid site URL or Atlassian ID".
  https://www.atlassian.com/engineering/post-incident-review-april-2022-outage
- AWS, 19 to 20 October 2025. Verified: "customers were unable to create,
  view, and update support cases through the AWS Support Console and API"
  between 11:48 PM PDT and 2:40 AM PDT. https://aws.amazon.com/message/101925/
- Cloudflare, 18 November 2025. Verified: "The status page is hosted
  completely off Cloudflare's infrastructure with no dependencies on
  Cloudflare"; the dashboard was down because "most users were unable to log
  in due to Turnstile being unavailable on the login page".
  https://blog.cloudflare.com/18-november-2025-outage/

Inferred lesson, common to all four: the thing that failed was never the
ticket store, it was the path to it (status page, login, contact data,
form validation). A standby earns its keep on that path first.

## 4. PaaS and infrastructure companies

| Vendor | Helpdesk tool | Support entry (domain) | Status page (host) | Status page links to | Email fallback |
|---|---|---|---|---|---|
| Vercel | Not public. Dashboard "Support Center" with an AI chat that opens a case; replies by email. | vercel.com/help, vercel.com/help#issues | vercel-status.com (Atlassian Statuspage) | "support site" → vercel.com/help | None listed |
| Heroku | Salesforce (help.heroku.com carries the Salesforce footer; status also at status.salesforce.com/products/Heroku) | help.heroku.com | status.heroku.com (own; failed in June 2025) | "Visit Heroku Status" from the help site | Not documented |
| Render | Not public. "Support portal you can sign into" plus email. | dashboard.render.com?contact-support, support@render.com | status.render.com (Atlassian Statuspage) | "support site" → community.render.com (forum sunset 24 March 2026, read-only) and support@render.com in a notice | support@render.com |
| Fly.io | Plain (migrated from Help Scout); portal built on Plain's API | `<org>@support.fly.io`, Support tab in dashboard, community.fly.io (Discourse) for free tier | status.flyio.net (incident.io) | "Report a problem" → docs.fly.io/about/support | Per-organisation address |
| Netlify | Not public. Own "Support Hub" in the dashboard (Enterprise, 16 October 2026) | netlify.com/support form, support@netlify.com, answers.netlify.com (Discourse) | netlifystatus.com (Atlassian Statuspage) | "support site" → netlify.com/support | support@netlify.com, all plans |
| Railway | Own "Central Station" | station.railway.com, Discord | status.railway.com (host not shown on page) | component "Support & Community — station.railway.com" | None: "Railway does not provide support via email" |
| DigitalOcean | cloudsupport.digitalocean.com (`/s/` paths; Salesforce Experience Cloud, inferred) | cloudsupport.digitalocean.com/s/createticket, public form digitalocean.com/company/contact/support | status.digitalocean.com (Atlassian Statuspage) | "support site" → digitalocean.com/support; incident text links the ticket portal | Reported: contact@digitalocean.com; no phone |

Sources, verified unless marked: Vercel https://vercel.com/legal/support-terms
("check this source first before seeking support" about the status page;
Enterprise first-response targets, Severity 1 under 4 business hours
Standard, under 2 hours 24/7 Premium), https://vercel.com/docs/support-center,
https://www.vercel-status.com/. Heroku https://help.heroku.com/,
https://www.heroku.com/blog/summary-of-june-10-outage/. Render
https://render.com/docs/community, https://status.render.com/. Fly.io
https://docs.fly.io/about/support, https://www.plain.com/customers/fly-io
("Whether customers reach out via email or Fly.io's support portal, all
threads go into Plain"; "Free-tier customers are supported through Fly.io's
Discourse community"), https://status.flyio.net/. Netlify
https://docs.netlify.com/manage/support/overview/,
https://www.netlify.com/changelog/2026-10-16-support-tickets-in-the-netlify-ui,
https://www.netlifystatus.com/. Railway https://docs.railway.com/reference/support
(Pro "usually within 72 hours"; Business Class P1 acknowledged within one
hour), https://status.railway.com/. DigitalOcean https://status.digitalocean.com/,
reported fallbacks from status updates quoted by search:
https://isdown.app/status/digitalocean/incidents/655352-support-portal-service-disruption
("submit your request via Support Contact form"),
https://isdown.app/status/digitalocean/incidents/632948-cloud-control-panel-access.

What the table says, inferred:

- Support never lives on the product's domain. Every vendor has a separate
  hostname for support and a third-party or separate status host. Five of
  seven status pages are on Atlassian Statuspage or incident.io, and the one
  that was self-hosted (Heroku) is the one with a post-mortem about it.
- The status page is the agreed "front door" during an outage, and every
  one links to the support entry, but that link points at the main domain
  (vercel.com/help, netlify.com/support), which can be inside the outage.
  Render's link points at a forum that closed in March 2026.
- Email is the universal fallback for five of seven. The two that refuse
  it (Vercel lists none; Railway refuses by policy) route everything through
  a dashboard or a forum.
- Nobody documents what to do when the support entry itself is down,
  except DigitalOcean's ad-hoc "use the public contact form" in incident
  updates and Fly.io's docs saying to check the status page.
- Helpdesk tooling is mostly not public. Fly.io (Plain) and Heroku
  (Salesforce) are visible; Vercel, Netlify and Railway present their own
  front ends; the backend is unknown.

## 5. Price comparables

All verified on the vendor's pricing page on 22 October 2026 unless
marked. "Who buys" is inferred from the tier limits.

| Product | Plan | Price | Limits that set the tier | Who buys (inferred) |
|---|---|---|---|---|
| Atlassian Statuspage https://www.atlassian.com/software/statuspage/pricing | Free | $0 | 100 subscribers, 2 team members | Side projects |
| | Hobby | $29/month | 250 subscribers, 5 members, email only | Small SaaS, 1 to 5 agents |
| | Startup | $99/month | 1,000 subscribers, 10 members, SMS and webhook | Funded startup |
| | Business | $300/month | 5,000 subscribers, 25 members | Mid-market |
| | Enterprise | $1,499/month | 25,000 subscribers, 50 members | Enterprise |
| | Private page | same ladder; audience-specific "from $300/month" | | |
| Instatus https://instatus.com/pricing | Starter | Free | 200 subscribers, 15 monitors, 2-minute checks | Side projects |
| | Pro | from $20/month (25% off yearly) | 5,000 subscribers, 50 monitors, 30-second checks, 50 members | Startups |
| | Business | not printed on the page; reported $300/month, $225 annual https://hyperping.com/blog/instatus-pricing | 25,000 subscribers, 1,000 monitors, SAML SSO | Mid-market |
| | Enterprise | custom, "99.99% uptime SLA" | | Enterprise |
| Better Stack https://betterstack.com/pricing | Free | $0 | 10 monitors, 1 status page | Side projects |
| | Paid | $34 per responder/month ($29 yearly); +50 monitors $25/month; extra public status page $15/month; password-protected page $50/page/month; white-label $250/page/month | per seat plus add-ons | Engineering teams buying on-call |
| Hyperping https://hyperping.com/pricing | Free | $0 | 20 monitors, 1 basic page, 5-minute checks | Side projects |
| | Essentials | $24/month annual ($290/year) | 50 monitors, 1 custom-domain page, 3 members | Small SaaS |
| | Pro | $74/month annual ($890/year) | 250 monitors, 3 pages, 10 members | Startup |
| | Business | $249/month annual, $299 monthly | 1,000 monitors, 10 pages, 20 members | Mid-market |
| UptimeRobot https://uptimerobot.com/pricing | Free | $0 | 50 monitors, 5-minute checks, 1 status page | Everyone |
| | Solo | $9/month annual (about $10 monthly) | 10 monitors at 60 seconds, 3 status pages | Solo developers |
| | Team | $35/month annual (about $41 monthly) | 100 monitors, 30 seconds, 100 status pages | Small teams |
| | Scale | $65/month annual (about $77 monthly) | 200 monitors, 15 seconds | Larger teams |
| Sorry https://www.sorryapp.com/pricing/ | Status Page | $99/month | 1,000 subscribers, 5 members, SAML SSO, Intercom app included | Small SaaS |
| incident.io https://incident.io/pricing | Team / Pro | $19 ($15 annual) / $25 per user/month, status page bundled | 1 public page; unlimited subscribers | Teams buying incident management |

Observations, inferred:

- Status pages are priced by audience (subscribers), not by seats, and
  monthly. That is the closest existing "insurance" line item: a thing you
  pay for every month and hope never to need.
- The entry band for a company that would run Better Helpdesk (1 to 10
  agents, hundreds to low thousands of customers) is $20 to $99 per month.
  $300 per month is where buyers have thousands of subscribers and a
  procurement process.
- Uptime monitors are cheaper ($9 to $77) because they do nothing for
  customers; status pages cost more because customers see them. A standby
  that customers use sits with the status pages, not the monitors.
- Enterprise tiers attach an SLA number (Instatus 99.99%). The SaaS
  helpdesks themselves promise 99.8% (Intercom) and 99.9% (Zendesk, Premier
  only), so a standby's own promise would be judged against those.

## 6. Anything else

- No vendor sells a "backup inbox" or an outage-mode helpdesk. The whole
  category assumes separation (SaaS) or a load balancer (self-hosted).
- Status-in-messenger is a mature plugin slot: Intercom's Statuspage app
  (above), Sorry ("When you post an incident on your Sorry status page, it
  shows on your Messenger home screen too", included with every Sorry page,
  can target "customers who use the affected part of your product")
  https://www.sorryapp.com/intercom-messenger-app/, Statuspal's Intercom
  app and a standalone banner widget for websites and help desks
  https://help.statuspal.io/article/56-integrate-your-status-page-in-intercom-messenger,
  https://docs.statuspal.io/platform/status-badge-and-banner-widget, Better
  Stack's and incident.io's Intercom apps with subscription from inside the
  widget (reported) https://betterstack.com/docs/uptime/integrations/integrating-with-better-uptime/intercom.md,
  https://docs.incident.io/integrations/intercom. Nothing equivalent exists
  for Chatwoot, Crisp or Zendesk messaging in my searches.
- Small vendors publish an "if our form is down" route: Growform's help
  article offers a dedicated option "We have support on-call 24-7 with this
  option". https://growform.helpscoutdocs.com/article/55-my-form-appears-to-be-down-or-broken-how-do-i-contact-you
  Institutions do the same by channel: a university help desk "activated
  our backup system" for phones and told users to "try chat or email".
  https://kb.wisc.edu/helpdesk/news.php?id=3573. One IT notice warns users
  to "refrain from submitting tickets during the outage window, as messages
  may be lost while the server is offline".
  https://cc-sox.cc.gatech.edu/alerts/helpccgatechedu-update-111722
- Crisp's "rescue" relay is the one piece of vendor vocabulary for a
  standby in this category (section 1).
- Third-party monitors disagree with vendors' uptime claims by a wide
  margin (Help Scout 99.99% claimed, 97.80% to 98.89% reported over 90
  days). Reported, and the monitors measure different things, but a buyer
  comparing numbers will see both.
  https://pingoru.io/providers/helpscout, https://pulsetic.com/compare/livechat-vs-helpscout/
- Intercom's identity verification by HMAC is deprecated in favour of JWTs,
  which matches the helpdesk's own HS256 identity token for other origins.

## What this means for Better Helpdesk

- The gap is real and the market has only one answer to it. Intercom and
  Zendesk reach "support stays up" by architecture, not by a feature, and
  no helpdesk, SaaS or open source, offers a standby that hands back. The
  website's claim is unoccupied ground, and it is unoccupied because the
  embedded model is the only one that needs it.
- The industry's minimum is already in production.mdx: a separate app on
  separate hosting, a status page on a third party, email as the fallback.
  Section 4 shows that is exactly what PaaS vendors do, and section 3 shows
  how it fails (status page in the outage, login in the outage, contact
  data in the outage). A standby that only reproduces that minimum adds
  nothing over the documented recipe.
- Hand-back is a solved problem only for append-only data with stable ids.
  Mail providers hand back by message id; browser outboxes hand back by an
  idempotency key; CouchDB hands back anything but makes the app resolve
  conflicts. The helpdesk's import already gives a conversation a new
  reference, keeps the old one in `context.imported`, threads mail by
  `emailMessageId`, names people by email. Those are the primitives the
  prior art uses. What is missing is an idempotency id on a widget
  submission and on an agent reply made during standby.
- Deadlines bound the design. Postmark's 10.5 hours and Mailgun's 8 hours
  mean inbound email survives a short outage with no standby at all; the
  widget has no such buffer and dies at the first failed fetch. The widget
  is where a standby pays off first; email is where the relay already
  points at a fallback address.
- Identity is the only dependency SaaS messengers keep on the customer's
  backend, and the helpdesk's identity token is HS256 with a shared secret,
  so a standby can verify the product's tokens without the product. Visitor
  flows on a `public` inbox need none.
- Buyers already pay $20 to $99 per month for the "front door during an
  outage" (a status page) and judge vendors on 99.8% or 99.9%. A standby is
  an upgrade of that line item, not a new category to explain.

## What I recommend

One recommendation: shape the standby as an append-only intake with a
banner and a dated hand-back, modelled on inbound-mail retry rather than on
a second helpdesk.

Concretely, in the terms this report has verified: the widget and a minimal
agent view talk to a standby endpoint only when the product's handler is
unreachable (Always Online's trigger discipline: unreachable, not any
error); the standby accepts new conversations and replies to conversations
it created, each carrying a client-generated id (the Workbox idempotency
key), stores them before acknowledging (Guaranteed Delivery), shows every
customer a banner that this is the standby and where the status page is
(Always Online's banner, Statuspage's subscription), lets agents answer
those conversations and nothing older, and hands back through the existing
import path keyed by those ids, deleting nothing until the product has
acknowledged (the Postmark model, including a manual replay). It never
edits a record the product owns, so there is nothing to merge.

Alternatives rejected:

- A second full instance with two-way sync (CouchDB style). No helpdesk
  does it, it needs conflict resolution on every table, and it turns the
  package's "one database" into two with a reconciliation job the host must
  understand. The brief's hard constraints rule out a second database in
  the package, and the open-source projects in section 2 show nobody has
  wanted it enough to document it.
- A client-side outbox in the widget only (Workbox, Sentry). Chromium-only
  native sync, lost with the tab, invisible to agents, and it does not let
  support answer, which is half of the brief. Worth adding later as a
  belt-and-braces detail (section 3), not as the product.
- A read-only mirror (Always Online, Jira read-only mode). Customers cannot
  write, which is the one thing the scenario needs.
- Doing nothing beyond production.mdx plus the mail fallback. It is what
  the PaaS vendors do, and their post-mortems are the evidence it is not
  enough; it also leaves the widget dead on pages that stay up, which is
  the exact moment the website's promise addresses.

## Open questions for the maintainer

1. Scope of writes during standby: only new conversations and replies to
   standby-created ones (no conflicts, as recommended), or also replies to
   conversations the product owns (then a reference lookup must survive the
   outage, and merge rules are needed)?
2. Can customers read during standby? Prior art says no (Always Online
   serves only what was cached). If "read replies" means replies to what
   they wrote during the outage, the append-only model covers it; if it
   means history, the standby needs a snapshot and a staleness rule.
3. Trigger and hand-back signals: who decides the product is "down" and
   "back", the widget (failed fetch), the status page (a component state,
   which Statuspage does not notify on without an incident), or the host's
   health route? Flapping must not create duplicates; the idempotency id
   handles that only if the product sees it.
4. Identity on the standby: verify the product's HS256 token with the same
   secret (works for logged-in users on pages that still render), visitor
   only, or both? Agents need a sign-in that is not in the outage, which
   production.mdx already asks for; is that acceptable as a precondition?
5. Email during standby: should the standby also answer the inbound webhook
   (so Postmark and Mailgun stop retrying and the 8 to 10.5 hour deadline no
   longer applies), and may it send receipts under the host's sender?
6. Pricing frame: by audience like a status page ($29 to $99 band for the
   design partners' size), or flat? And should the self-hosted standby (the
   website's promise that the package never depends on the managed one) be
   the Cloudflare Worker pattern the relay already uses?
7. Independent of the standby: should the widget get the status-in-widget
   slot that every SaaS messenger has (section 6), since it costs nothing
   and the PaaS table shows the status page is the agreed front door?
