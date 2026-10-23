# Support that stays up when the app doesn't: the standby exploration

Researched 22 October 2026, the day 1.0.0 shipped. It answers the website's
"Not public yet" section ("a managed standby that keeps your widget and
inbox reachable while your app is down, then hands everything back to your
database") and Divio's need for the same thing, in one pass: what an
open-source route and a managed route would each be, what they cost, and
which to take.

## How this was made

Five independent reports from one brief
(`docs/research/2026-10/standby/BRIEF.md`), none with sight of the others:
an industry baseline from primary sources (vendor docs, pricing pages,
post-mortems), the Head of Engineering in ponytail mode against the code at
commit `5d2567a`, the Head of Product, the Head of Finance and the Head of
Legal (Swiss law, statute text quoted verbatim). The reports sit in
`docs/research/2026-10/standby/`; this document is the convergence.

Three claims were verified in the code before they became decisions: the
import opens a new conversation for every line on every run
(`src/export.ts:192-198`; `report.updated` never moves), the first
message's `emailMessageId` is dropped on import (`src/export.ts:352-355`),
and the widget keys its visitor id by API base
(`src/widget/widget.tsx:138-141`). Two facts come from Divio's own
repositories: `control.divio.com` is a Django backend with a React
single-page frontend, so the package cannot be mounted in it at all, and
`www.divio.com` is a Next.js 15.5 app. Divio runs Intercom today, with
`support@divio.com` as the documented fallback and `status.divio.com` as
the status page.

## The problem in one sentence

"Stays up when your app doesn't" has exactly one mechanism, a separate
failure domain, and the only question is whose and for how long: the host's
own, permanently (the recipe already in `production.mdx`, "Keep support
reachable when your product is down"); the host's own, only during
outages, with a handback (an open-source standby); or the maintainer's
company's, only during outages (a managed standby). Intercom and Zendesk
have the first by construction: their messenger loads from their CDN, talks
to their hosts, and the customer's backend only signs an identity token.
The baseline found no helpdesk, paid or open source, that offers the
second or the third. Crisp has a rescue websocket relay, Zammad a
maintenance mode; nothing hands back. The website's promise is unoccupied
ground because only the embedded model needs it.

## Where the five views converge

| Claim | Held by |
| --- | --- |
| The documented recipe is the whole answer for Divio and the first answer for anyone whose product's uptime is what customers write in about | 5 of 5 |
| A self-hosted standby is the same package in a second small app on the host's own hosting, plus small package pieces, and crosses nothing in `AGENTS.md` | 5 of 5 |
| The standby is cold and append-only: new conversations and replies to them, no replica of the product's data, deleted after handback | 5 of 5 |
| The import must become idempotent before any handback exists | engineering, product, baseline |
| Do not build the managed standby now | product, finance, engineering; legal sets the conditions under which it may be sold at all |
| The widget should carry a status-page link and an outage line whether or not a standby exists | product, baseline |
| The widget is where a standby pays off first; inbound mail already has a buffer with a deadline (Postmark about 10.5 hours, Mailgun 8 hours, the Cloudflare worker's fallback mailbox without one) | baseline, engineering |

## The decision

1. **Divio runs on the recipe, now, with nothing built.** A support app of
   its own on a provider that is not Divio Cloud, the widget on
   `control.divio.com` cross-origin with an identity token the Django
   backend signs, the same widget on `www.divio.com` and, if the status
   page vendor allows a script tag, on `status.divio.com`, both on a
   `public` inbox. Details in the next section.
2. **Two package pieces ship regardless**, because they are small, generic
   and every handback and every outage needs them: the import keeps the
   first message's `emailMessageId` and refuses to import a line twice
   (items 1 and 2 below), and the widget gets a `status-url` attribute and
   an outage line when the handler is unreachable (item 0).
3. **Ask before building.** Interview the private list and both design
   partners with the five questions at the end of this document, within
   two weeks. The riskiest assumption in the whole exploration is that
   uptime-sensitive companies mount the helpdesk inside the product at all;
   if they take the recipe, the standby has no customer.
4. **The open-source standby on signal**: items 3, 4, 6 and 7. It is the
   relay pattern applied to the helpdesk (example code the host deploys on
   its own account), and it keeps every sentence in `ROADMAP.md` true.
5. **The managed standby only after the open-source one exists, and only
   on a stronger signal**: ten paid pre-orders and a second person who can
   share an on-call schedule. Swiss or EU hosting with no US
   sub-processor in the default configuration, one DPA, monthly billing,
   a deletion certificate the import report produces. Item 5 is the one
   package piece it adds.

## Divio

The control panel cannot host the package, so the question for Divio was
never "inside the product with a standby" but only where the separate app
lives. Two candidates:

- **A dedicated support app** (`support.divio.com`) on a provider other
  than Divio Cloud, so it survives the worst Divio outage and not only the
  typical one. Engineering's pick: Fly.io, one machine in an EU region,
  SQLite on a volume through `sqliteAdapter`, `memoryRealtime()` for the
  stream, the `instrumentation.ts` timer for jobs, Litestream for backups.
  Finance prices it at CHF 50 to 80 a month on EU hosting or CHF 80 to 145
  on Swiss hosting. Vercel Pro plus Neon is the second choice if nobody
  wants to own a machine. This is the recommendation.
- **Mounting it in `www.divio.com`**, which is Next.js, with its own
  Postgres. Cheapest, no new app, but only if the marketing site is
  already outside the control panel's failure domain, including the
  platform it deploys on; a platform-wide incident would take both.

What degrades during a control-panel outage under the recipe, and the
answer to each (engineering, section A):

- No identity token can be minted, but no page of `control.divio.com` is
  up to hold a widget either. On `www` and `status` customers were
  anonymous anyway: the `public` inbox asks for an email and sends a
  receipt. The outage conversation lands on a visitor contact; it joins
  the customer's signed-in contact when they reply to the receipt by
  email (DKIM proves the address) or when an agent merges the two
  contacts by hand.
- `widget.js` must be served from each surviving page's own `public/`,
  never from the control panel's origin.
- Agents must sign in through something that is not Keycloak if Keycloak
  can be part of the same outage: Better Auth with Google Workspace OAuth
  restricted to the company domain, and the email-and-password break-glass
  the marketing site already uses for itself.
- The host hooks that call into the product (`resolveContext`, `links`,
  `orgNames`) are caught on throw but have no timeout, so a hanging
  control panel hangs the company card. Wrap them in
  `AbortSignal.timeout(2000)` and return empty. One sentence for
  `production.mdx`.
- The relay keeps pointing at the support app, which is up. The widget on
  the control panel is a web component, so a React single-page frontend
  carries it like any page; only the helpdesk host needs Next.js.

What Divio gives up against Intercom: nothing in reachability, since both
are a separate failure domain, and it keeps the data in its own database.
What it gives up against the package's purity: one more small app to run,
which for a PaaS company is a rounding error next to the first outage it
covers.

## Route 1: the open-source standby

For a host that keeps the helpdesk inside the product and wants a standby
only during outages. The design, from the engineering report, with the
other reports' amendments:

**Failover lives in `createApi`**, not in the widget, so every request and
the events stream go through it. One `api-standby` attribute (and
`data-api-standby` on the script tag). The primary counts as down on a
network error, a 502, 503 or 504, or a timeout (there is none today; add
eight seconds). Before switching, probe the standby's `health/` once; if
it is down too, show the load failure as today. The switch is sticky for
the page session and remembered for ten minutes in `sessionStorage`; a
fresh load retries the primary first. No automatic switch back
mid-session: a conversation lives where it was created. The widget never
auto-retries a write, so the switch happens only on a failed GET or a POST
that threw before any response; a 5xx on a POST keeps the draft and the
next request decides. An `Idempotency-Key` on `widget/conversations` is
the named upgrade path if a design partner ever sees a duplicate. One new
string in four languages tells the customer they are on the backup line
and will be emailed.

**The standby app** is `examples/standby/`: the same package, SQLite, the
host's config module mirrored (inboxes, types, priorities, prefix,
`allowedOrigins`), no storage adapter, its own email adapter, Better Auth
with an outside OAuth provider and an allow-list, a magic link through the
standby's own email adapter as break-glass, the jobs timer, a Dockerfile
and `fly.toml`, and a README runbook. The largest maintenance tail of the
whole route is this app, not the package items: a second example whose
Next.js and Better Auth versions drift, kept honest by the CI build.

**References keep the same prefix and a reserved range** (the standby's
counter seeded at 900000) rather than a second prefix, because the
primary's inbound route parses only its own prefix and nothing looks up
`context.imported.reference`. A kept number means `support+ACME-900012@`
threads into the right conversation before and after the handback with no
schema change.

**Handback is the existing export and import**, made safe to run twice:
`--keep-references` creates the conversation with the exported number when
that number is free and skips it when present (`number` is unique, so a
race fails loudly instead of duplicating); `--update` appends messages
newer than the primary's newest for a conversation that already exists,
which is what a flapping outage needs. Manual first, idempotent always:
"when the primary's health is green again, run the handback; run it again
an hour later for stragglers". The health route is what a human watches,
never a hook the package fires, because an automatic import on a flipping
probe is a split-brain generator. Documented limitations, not built:
attachments (no storage adapter on the standby), audit log (the standby's
database is the audit record of the outage; keep its file for the
retention period), seen markers, SLA clock (none; the policy was not
running), assignee and snooze.

**The inbound relay gets a second destination**, `HELPDESK_STANDBY_URL`,
tried after the primary and before the fallback mailbox, in all three
relays.

**Cold by default.** A warm standby fed by `onEvent` would mean a write
route on an always-on service and latency inside the product's requests;
a host that wants history on the standby runs a periodic `export --since`
through the same idempotent import. Hosting order for the docs: Fly.io
with SQLite first, Vercel plus Neon second, a plain VM third. Cloudflare
Workers with D1 was rejected for the first recipe because the CRUD
contract needs real transactions and `forUpdate` for references.

### Work items

Each is one PR, completable alone, green CI as the bar, sized by the
maintainer's decisions and the tail it leaves.

| # | Item | Decisions for the maintainer | Tail | Needed by |
| --- | --- | --- | --- | --- |
| 0 | Widget: `status-url` attribute, and an outage line with that link when the handler is unreachable | the wording in four languages | none | everyone, now |
| 1 | Import keeps the first message's `emailMessageId` | none | none | B, C, now |
| 2 | `--keep-references` and `--update` on the import; `createConversation` takes an optional `number`; `report.updated` moves; the 900000 range documented | whether `--keep-references` is on by default for `--source standby` | small; the round-trip test run twice | B, C, now |
| 3 | `api-standby`: failover in `createApi`, sticky switch, session key and stream follow the active base, `widget.standby` string | the timeout, the ten-minute stickiness, the wording | moderate: a second base in every widget request path, kept inside `createApi` | B, C |
| 4 | `HELPDESK_STANDBY_URL` in the three relays | none | none | B, C |
| 5 | `GET {basePath}/export/?since=` behind an `exportSecret`, streaming JSON Lines; the import CLI reads a URL with `--token` | the secret's name | small, but a new secret and route to keep secure | C only |
| 6 | `examples/standby/` on Fly.io with SQLite, Better Auth, runbook; CI builds it like the demo | which IdP the example shows; the allow-list shape | the largest: an example app that drifts | B; C runs it per tenant |
| 7 | Docs: `operations/standby.mdx` (runbook, threat model, hosting table) and the recipe refinements in `production.mdx` (host-hook timeouts, `widget.js` from `public/`, the status-page script) | the hosting order | small | A now, B, C |
| 8 | Later: attachments on import when the primary's storage has the key; `rating*` on `--update`; seen markers in the format | whether to extend the format | small | none of the first slices |

Dependencies: 1 before 2; 5 after 2; 6 after 2, 3 and 4; 7's recipe part
can land first on its own. 0, 3 and 4 depend on nothing. Thinnest slices:
Divio is 7's `production.mdx` paragraph; the open-source standby is 0, 1,
2, 3, 4, 6, 7; the managed standby adds 5 and nothing else.

## Route 2: the managed standby

**What it is.** The `examples/standby` app run by the maintainer's company,
one tenant per SQLite file, tenancy by database and never by a column (the
package has no tenant id and should not get one), the hostname selecting a
tenant record and a cached `buildHelpdesk` per tenant. Customers write as
visitors with their email; the product's `identityTokenSecret` is never
shared. Email goes out from the company's sender with the tenant's name,
or from the tenant's domain if they delegate a subdomain's DKIM;
`replyToAddress` points at the tenant's own relay address so replies keep
threading. Agents sign in by magic link to pre-registered addresses. The
tenant's own import command pulls the handback from the export route; the
company never writes into a tenant's database. After the tenant confirms
the import, the standby's copy is deleted. Nothing in the open-source
standby changes for multi-tenancy.

**What it must satisfy (legal).** The company is the host's processor
under Art. 9 DSG and Art. 28 GDPR, with one DPA drafted to Art. 28 para. 3
GDPR plus three Swiss additions (the EDÖB, the Art. 24 para. 3 DSG breach
notice, a secrecy warranty). Sub-processors (hosting, email, any edge) go
in an annex with country and transfer basis. Hosting in Switzerland or the
EU has no transfer question in either direction; any US email provider or
edge is a disclosure abroad under Art. 16 DSG, allowed only under the
Swiss-US Data Privacy Framework or recognised clauses, and it erases the
"your data does not leave" argument against Intercom and Zendesk, so the
default sender must be Swiss or EU. Breaches reach the host within 24
hours with the Art. 15 DSV content. "We delete it after handback" has to
be defined: live rows and attachments within 24 hours of the confirmed
import, encrypted backups on a stated rotation, logs without bodies, and a
deletion record the import report itself produces. The host must tell its
end users at collection that a standby run by the company exists; the
package should ship that privacy snippet. Liability: Art. 100 para. 1 OR is
the ceiling, below it a cap at twelve months' fees and service credits as
the exclusive remedy; the marketing may say "stays reachable" with the
measured availability beside it, never "guaranteed". Two things could stop
it: Art. 404 OR may make a prepaid year unenforceable (so bill monthly
until a lawyer says otherwise), and a US-hosted default. A Rechtsanwalt is
needed for the DPA and AGB before the first signature, for any EU host,
and for the name, which is unregistered and close to descriptive.

**What it costs and earns (finance).** All numbers are the finance
report's and change with providers.

| | Per month |
| --- | --- |
| Hosting, email, status page, on-call tooling | CHF 60 to 215 |
| Routine operations and tenant work | CHF 500 to 1,300 |
| One person's on-call duty, 52 weeks, at the European stipend benchmark | CHF 2,000 to 4,200 |
| Fully loaded, and it does not fall with zero customers | CHF 2,500 to 5,800 |
| Price: flat per install, the Statuspage band, billed monthly | CHF 100 (USD 120) |
| Break-even on hosting / on routine attention / on on-call | 2 to 3 / 8 to 16 / 30 to 55 paying installs |

At the one to five percent install-to-paid conversion the comparable
projects suggest (Sentry, Cal.com, Plausible, Payload Cloud, Sidekiq),
breaking even on the on-call needs 1,000 to 5,000 production installs.
Production installs today: zero, with two design partners about to deploy.
The "I'd pay for this" tick tells us interest intensity among readers who
reached the bottom of the page and gives an interview list; it says nothing
about price, company or budget owner. Finance's alternative for revenue
from this work without hosting anything: an onboarding and support
contract with each design partner that includes setting up a self-hosted
standby, CHF 15,000 to 28,000 in year one, with no fixed cost, no on-call
and no customer data; and a refundable pre-order link for everyone who
ticked the box.

**Why not now.** Four reasons, one per report: product, because as the
only good answer it would read as open-core on a page that promises no
paid features and no hosted mode, and the credibility of the open-source
project is the asset; finance, because the on-call tax runs from day one
and the break-even sits beyond any plausible install count this year;
legal, because the first signature needs a DPA, AGB and a hosting choice a
lawyer has looked at; engineering, because the one package piece it adds
(item 5) is a new secret and a new route to keep secure before any tenant
exists. What would change the call: buyers on the list and the partners
who refuse the self-hosted standby because they do not want a second app
either; then the convertible share is higher than the comparables say and
the managed standby is the product, not the add-on. The cheapest way to
find out is the pre-order link, not the build.

## Where the reports disagree, and how this weighs them

- **Annual or monthly billing.** Finance recommends annual only at CHF
  1,200; legal says Art. 404 OR and BGE 115 II 464 make a prepaid term
  uncertain. Monthly wins on enforceability; the price level stands.
- **An idempotency key on widget submissions.** The baseline wants a
  client-generated id on every submission from day one; engineering
  defers it because the widget never auto-retries a write and the
  handback dedupes by kept reference number. Engineering's slice first;
  the key is the named upgrade path, added on the first observed duplicate.
- **Hosting.** Engineering puts Fly.io first for the self-run standby;
  legal rules out a US sub-processor by default for the managed one. They
  describe different objects: the self-run standby is the host's choice,
  documented with the DSG note; the managed one goes to a Swiss or EU
  provider.
- **Warm standby.** The baseline and product rank "customers see their
  earlier conversations" last; engineering offers a periodic export for
  hosts who want it anyway; legal notes a warm managed standby ends "we
  see your data only while you are down". Cold by default, warm only
  self-hosted.

## The words

Today the landing page says "No hosted mode and no second login" and, lower
down, announces a managed standby; `ROADMAP.md` says "no data-processing
agreement to sign, because we never see your data". They must say the same
thing. Product drafted the sentences for each outcome in its section 5:

- **Open source only**: the roadmap's hosted-mode bullet gains "and so is
  the standby: a second, smaller install of the same package on hosting of
  your own, which takes the widget and the mail while your app is down and
  hands the conversations back to your database when it is up"; the
  landing-page section becomes a link to "Run a standby" in the docs, and
  the list gets one email and is closed.
- **Open source plus managed**: the same bullet states the one exception
  inside it ("The one thing we run is the managed standby ... We see your
  data only while you are down, and the package never depends on it: the
  standby in the repository is the one we run"), and "What we won't do"
  reads "No hosted helpdesk and no second login. The managed standby is
  the one thing we run, and only while your app is down." Legal adds that
  the roadmap line must be rewritten the day a standby ships (Art. 3 para.
  1 lit. b UWG), and that the privacy page must name the company with an
  address as the controller, list the stored "would pay" answer, and set
  `receipt` on the continuity inbox as proof of consent.
- **Dropped for the recipe**: a new roadmap bullet "A standby we run for
  you. We explored a managed standby in October 2026 and dropped it", the
  landing-page section becomes the recipe without a form, and the list is
  told and deleted.

Until the interviews are done the current section can stay as the signal
collector it is, since it says "Not built yet" and "The open-source
package will never depend on it"; after them, one of the three outcomes is
applied in a single PR together with `AGENTS.md`, which needs no change in
any outcome because the managed standby would live in a repository of its
own.

## What to validate, within two weeks

Ask each person on the list, by reply from the `continuity` inbox, and the
two design partners directly (their answer weighs more, because the
roadmap says their feedback sets the order):

1. When was your product last down for more than ten minutes, and what
   happened to support during it: where did customers write, who answered,
   from what, and did it end up in the helpdesk afterwards?
2. Where does your helpdesk run today, and does it share the product's
   failure domain? If it is Intercom or Zendesk, what would make you move
   it inside the product knowing it then shares the product's fate?
3. Do you already run a second hosting account, region or project? Who
   signs your agents in if your product's own sign-in is down?
4. Shown both options in a paragraph each: would you run a separate
   support app beside the product, or do you need the helpdesk inside the
   product's database, and for what exactly?
5. If you ticked "I'd pay": for what, the hosting, the handback, or the
   person on call? What per month, and would your legal side accept a
   Swiss company holding conversations only during outages, under a DPA?

The open-source standby is justified when people mount or want to mount the
helpdesk inside the product, have a second hosting account, and name the
missing piece as "no recipe and no handback". The managed one is justified
when a handful answer 1 with a real outage where support went dark, 4 with
"inside the product", 3 with "nobody", and 5 with a number and a yes on the
DPA, and at least one design partner would use it; fewer than that is a
consulting engagement for one customer, not a product. Drop it when the
common answer to 1 is "nobody wrote; they watched the status page" or "mail
waited and we answered from Gmail", or the common answer to 4 is "beside
the product is fine"; then the recipe is the product and item 0 ships
anyway.

## Open questions for the maintainer

1. Is `www.divio.com` hosted outside the control panel's failure domain,
   including its platform, or does Divio's support app need a provider of
   its own? This decides between the two Divio candidates.
2. Does Divio use Google Workspace, so agents can sign into the support
   app through it rather than Keycloak? If not, which identity provider is
   not part of a control-panel outage?
3. How do the two design partners mount the helpdesk: in the product or in
   an app of their own? One sentence from each, and the riskiest
   assumption is settled.
4. How many people are on the continuity list and how many ticked "I'd
   pay"? The PostHog event `continuity_joined` answers it in one query.
5. Is being on call during other companies' outages something the company
   wants to be, at any price, and is there a second person who could share
   a schedule? This decides the managed standby before any signal does.
6. Can the maintainer's company sell to Divio at all, given the
   employment there, or only document the conflict?
7. Will standby data ever be used for anything of the company's own
   (metrics, research, AI drafting)? If yes, the processor role in the
   legal report no longer holds and a second privacy notice is needed.
8. Which outbound email provider is the default for a standby, and is it
   Swiss, EU, or Swiss-US DPF certified? Every US component is a line in
   the sub-processor annex and in every host's privacy notice.
