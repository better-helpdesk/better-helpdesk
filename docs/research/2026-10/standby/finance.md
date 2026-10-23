# Finance: is a managed standby worth building, and how to price it

Written 22 October 2026 by the Head of Finance, for the standby exploration
in `docs/research/2026-10/standby/BRIEF.md`. One of five subject reports.

**Bottom line.** A managed standby is a cheap thing to host (CHF 60 to 215 a
month before anyone pays) and an expensive thing to promise: the moment the
website says "stays up", one person owns a 24/7 on-call duty that European
employers price at EUR 500 to 1,050 per week. At the price buyers of an MIT
helpdesk will accept, CHF 1,200 per install per year, the standby pays its
hosting at 2 to 3 installs, the maintainer's routine hours at 8 to 16, and the
on-call duty only at 30 to 55 paying installs, which at open-source
conversion rates of 1 to 5 percent needs 1,000 to 5,000 production installs.
There are zero today. Build the self-hosted standby (the package needs it
anyway), sell onboarding and support contracts to the two design partners
now, take refundable pre-orders for the managed version, and build it only
when ten of them have paid.

## What I read and how I converted money

Read in full: `BRIEF.md`, `docs/product.md`, `AGENTS.md`, `ROADMAP.md`,
`site/content/docs/operations/production.mdx` ("Keep support reachable when
your product is down"), `site/app/(site)/page.tsx`,
`site/app/(site)/components/sponsor.tsx` (the sponsor button renders only
when `SITE_SPONSOR_URL` is set) and
`site/app/(site)/components/continuity-form.tsx` (the list form posts to a
`continuity` inbox with `host.pay = yes|no` and captures a PostHog event
`continuity_joined` with `would_pay`).

Exchange rates are the ECB reference rates of 22 October 2026 via
[frankfurter.app](https://api.frankfurter.app/latest?from=USD&to=CHF,EUR):
USD 1 = CHF 0.822 = EUR 0.892; EUR 1 = CHF 0.921. Every price below is
excl. VAT and taken from the vendor page on 22 October 2026 unless a
third-party source is named. "Estimate" means my own figure with no source.

Prices of the kind "this is what it costs today" I verified; what a solo
operator's time is worth, how many installs will convert, and what a buyer
will pay I inferred and say so each time.

## 1. Cost to run a managed standby

### Shape assumed for the cost

One multi-tenant Next.js app running the package, one Postgres cluster with
one database per tenant (the package owns a `helpdesk` schema per
connection), one outbound email account, inbound through a relay, a status
page for the standby itself, daily backups plus an off-site copy, uptime and
error monitoring, and Stripe for billing. Two regions where the provider
makes that cheap. How the tenants are configured, how the widget switches
over and how handback works is the engineering report's question; the cost
shape is the same under every answer I can imagine, because the marginal
tenant costs nothing until the cluster is full.

### Hosting, per month, for the whole standby (not per tenant)

| Option | Components | Vendor price | CHF |
|---|---|---|---|
| Fly.io, two EU regions, managed Postgres | 2 × shared-cpu-1x 1 GB at USD 6.70; Managed Postgres Basic USD 38 plus 10 GB at USD 0.28/GB ([docs.fly.io/about/pricing](https://docs.fly.io/about/pricing)) | USD 54 | 45 |
| Vercel Pro plus Neon Launch (eu-central) | Vercel Pro USD 20 ([docs.vercel.com/docs/plans/pro-plan](https://docs.vercel.com/docs/plans/pro-plan)); Neon Launch at USD 0.106 per CU-hour, 0.25 CU always on is about USD 19, plus storage USD 0.35/GB and instant restore USD 0.20/GB ([neon.com/pricing](https://neon.com/pricing)) | USD 45 | 37 |
| Hetzner, Falkenstein plus Helsinki, self-managed Postgres | 2 × CX23 at EUR 5.99 incl. IPv4 and 1 × CX23 for Postgres ([hetzner.com/cloud](https://www.hetzner.com/cloud/) says "from EUR 5.99"; CX23 = EUR 5.99 and CAX11 = EUR 6.49 in the [August 2026 comparison](https://kimmo.suominen.com/stuff/cpc-2026-08.txt)); LB11 EUR 7.49 ([hetzner.com/cloud/load-balancer](https://www.hetzner.com/cloud/load-balancer/)); backups and an object-storage bucket about EUR 10 (estimate) | EUR 35 | 33 |
| Exoscale, Zurich plus Geneva, DBaaS | 2 × Standard Small at about EUR 17 each (third-party EUR table of EUR 0.0233/h, undated, via the extended search; Exoscale's own page renders only "starting at CHF 0.00729/h" for Micro, [exoscale.com/pricing](https://www.exoscale.com/pricing/)); PostgreSQL Hobbyist-2 about CHF 48 per 30 days or Startup-4 about CHF 113 (older [VSHN table](https://products.vshn.ch/appcat/exoscale_dbaas.html), marked deprecated; entry DBaaS "about EUR 42" per [eucloudcost.com](https://www.eucloudcost.com/providers/exoscale/)) | — | 80 to 145 |

Hetzner's prices moved twice in 2026 and several lines were marked "currently
not available" in August ([findstack](https://findstack.com/resources/hetzner-price-increase-2026)),
so the EUR 5.99 is the one to re-check before a decision. Exoscale is the only
Swiss option; the price fields on its pages are template placeholders and I
could not read a live CHF figure, so treat the Exoscale row as plus or minus
30 percent. Hetzner's self-managed Postgres is the cheapest row and the one
that costs the most hours: patching, failover and restore drills are yours.

### Everything around the hosting, per month

| Item | Price | CHF |
|---|---|---|
| Outbound and inbound email: Postmark Pro, 10,000 emails, inbound processing included, 10 custom sending domains ([postmarkapp.com/pricing](https://postmarkapp.com/pricing)); Resend Pro is USD 20 for 50,000 ([resend.com/pricing](https://www.resend.com/pricing.md)) | USD 16.50 | 14 |
| Failover switch and email worker: Cloudflare Workers Paid, 10 M requests included, no egress charge ([developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing/)) | USD 5 | 4 |
| Status page for the standby itself: Better Stack free tier, 10 monitors and 1 status page ([betterstack.com/pricing](https://betterstack.com/pricing)); Instatus Starter and Hyperping Free are also USD 0 ([instatus.com/pricing](https://instatus.com/pricing), [hyperping.com/pricing](https://hyperping.com/pricing)) | USD 0 | 0 |
| On-call tooling with phone and SMS alerts and a schedule: Better Stack responder licence USD 29 yearly or 34 monthly; PagerDuty Professional USD 21 per user yearly ([incident.io's comparison](https://incident.io/blog/pagerduty-pricing-breakdown-2026)) | USD 29 | 24 |
| Error tracking: Sentry Developer USD 0 (5k errors, 1 user) or Team USD 26 yearly ([sentry.io/pricing](https://sentry.io/pricing/)) | USD 0 to 26 | 0 to 21 |
| Off-site backup copy, object storage | estimate | 5 |
| Billing: Stripe 2.9 percent plus CHF 0.30 on Swiss cards, 3.25 percent plus CHF 0.30 on foreign cards plus 2 percent for conversion, Stripe Billing 0.7 percent ([stripe.com/ch/pricing](https://stripe.com/ch/pricing)) | about 3.6 to 6 percent of revenue | — |

Add-ons: CHF 23 at the minimum, CHF 68 with on-call tooling and Sentry Team.

**Cash total before any customer: CHF 60 to 115 a month on EU hosting, CHF 105
to 215 on Swiss hosting.** Per tenant the marginal cost is email volume and
storage, a franc or two a month until the cluster needs the next size.

Insurance, if the company does not already carry it (I do not know; the
finance ledger is out of scope here): a Swiss Berufshaftpflicht for an IT
service firm starts at CHF 277.70 net per year at exali and averages CHF 506
([exali.ch](https://www.exali.ch/dienstleister-haftpflicht/produktuebersicht/));
a guide puts IT consultants with CHF 1 to 3 M cover at CHF 800 to 1,500 a
year ([gryps.ch](https://www.gryps.ch/produkte/betriebshaftpflicht-149/berufshaftpflicht/)).
Cyber cover is priced on revenue and data; the only Swiss figure I found is a
KMU paying CHF 12,000 to 29,000 a year for CHF 3 M of cover
([vermoegenszentrum.ch](https://www.vermoegenszentrum.ch/wissen/cyber-versicherung)),
far above this case; my estimate for a micro firm with CHF 1 M of cover is
CHF 1,000 to 3,000 a year. Together CHF 120 to 375 a month.

### The human cost, honestly

Three layers, each my estimate, each with its anchor:

1. **Routine operation**: 4 to 8 hours a month for upgrades, dependency
   bumps, certificate and domain hygiene, a monthly restore drill, invoices
   and the odd billing question. At a Swiss senior rate (a DevOps median
   salary of CHF 116,000 over 1,920 hours is about CHF 60 gross per hour,
   [payscale](https://www.payscale.com/research/CH/Job=Senior_Development_Operations_(DevOps)_Engineer/Salary);
   freelance-equivalent with overhead and 50 to 70 percent utilisation CHF
   85 to 120 per hour, [magicheidi.ch](https://magicheidi.ch/de/hourly-rates))
   that is **CHF 400 to 1,000 a month**.
2. **Incidents and tenants**: one to three incidents a year at 4 to 8 hours
   each, 2 hours to onboard each tenant, an hour a quarter per tenant for
   questions: **CHF 100 to 300 a month** at ten tenants.
3. **Being reachable**: the promise is to be up when the customer is down,
   which is at night and at weekends. European employers pay a flat stipend
   for a week of carrying the pager: Zalando and SumUp EUR 1,050, HelloFresh
   EUR 1,000, N26 EUR 880, Klarna EUR 500, Wise about GBP 300
   ([pagerly.io, 28 August 2026, Pragmatic Engineer data](https://www.pagerly.io/blog/oncall-compensation-benchmarks-2026-08-28)).
   Those are for a week in a rotation of several people. One person carrying
   it 52 weeks a year is EUR 26,000 to 55,000, **CHF 2,000 to 4,200 a
   month**, whether or not the maintainer ever writes that cheque to himself.
   That is the number that makes or breaks the product, and it does not fall
   with zero customers.

**Fully loaded: CHF 2,500 to 5,800 a month.** Cash only: CHF 60 to 215, or
CHF 180 to 590 with insurance.

One more cost that is a design choice rather than a line item: a single
operator cannot credibly promise availability through holidays, flights and
illness. "Credible" means either a second responder (a retainer with a small
Swiss or EU ops firm for a shared seat on the schedule, my estimate CHF 500
to 1,500 a month, not sourced) or a product promise that needs no human at
all: the standby queues, shows the customer their ticket, and never promises
that a person answers while the standby is the only thing up. The second is
the one that fits a one-person company, and it caps the price.

## 2. Pricing

The standby is insurance: paid every month, used a few hours a year, worth a
lot in those hours. The nearest products with the same shape are status
pages, also paid monthly and only valuable during incidents.

### What the status-page market charges

| Product | Entry | Mid | Upper | Source |
|---|---|---|---|---|
| Atlassian Statuspage | Free (100 subscribers); Hobby USD 29 | Startup USD 99 | Business USD 300, Enterprise USD 1,499 | [atlassian.com/software/statuspage/pricing](https://www.atlassian.com/software/statuspage/pricing) |
| Instatus | Starter free (15 monitors, 200 subscribers) | Pro USD 20 | Business about USD 300 per [hyperping's guide](https://hyperping.com/blog/instatus-pricing) | [instatus.com/pricing](https://instatus.com/pricing) |
| Better Stack | Free (10 monitors, 1 page) | Responder USD 29 yearly, 34 monthly | extra pages USD 12 to 15 each | [betterstack.com/pricing](https://betterstack.com/pricing) |
| Hyperping | Free (20 monitors, 1 page) | Essentials USD 24, Pro USD 74 | Business USD 249 yearly, 299 monthly | [hyperping.com/pricing](https://hyperping.com/pricing) |

Entry prices cluster at USD 20 to 30 a month, the business tier at USD 99 to
300, and the tiering lever is subscribers and pages, never incidents. Nobody
charges per outage.

The other anchor is what the buyer avoided by choosing Better Helpdesk:
Intercom Essential USD 29 to 39 per seat ([dragapp](https://dragapp.com/blog/intercom-pricing/)),
Zendesk Suite Team USD 55 per agent yearly ([eesel](https://www.eesel.ai/blog/zendesk-suite-pricing)),
Chatwoot Cloud Startups USD 19 per agent ([chatwoot.com/pricing](https://chatwoot.com/pricing)).
A five-agent team pays Zendesk USD 3,300 a year; a standby that keeps the
same team reachable is worth a fraction of that, and a fraction is what we
can charge.

### The models, compared

| Model | For | Against | Verdict |
|---|---|---|---|
| Flat monthly per install (status-page model) | Simple; matches the market shape; predictable | Monthly churn on a thing nobody uses in a good month; a Stripe fee per invoice | Good, but bill it yearly |
| Tiers by conversations handled during outages | Cheap to meter (the standby sees every conversation) | The customer pays more on their worst day; volumes are tiny (a four-hour outage carries tens of conversations), so revenue is near zero | Reject as the price; keep as a fair-use cap |
| Annual only | Insurance is annual; one invoice; no monthly "do we still need this"; under most managers' sign-off threshold at CHF 1,200 (inference) | A harder first yes; refunds on shutdown | Recommended |
| Usage-billed per outage hour | Pay for value | We earn when they suffer; zero revenue in a good year, so it cannot fund on-call; collection and disputes | Reject |
| Bundled with a support contract | Sells to the two design partners now; the standby rides on a relationship that already carries trust | Not a price list; does not scale past a handful | Recommended for the first customers |

### Recommendation: CHF 1,200 per install per year, annual only

List it as **CHF 1,200 per install per year** (CHF 100 a month equivalent),
**USD 1,450** or USD 119 a month billed yearly, **EUR 1,300**. One install,
one region, a fair-use cap of, say, 2,000 conversations a year through the
standby, and no promise that a human answers while the standby is the only
thing up: the promise is that the widget takes the message, the customer sees
their ticket, agents can answer from the standby's inbox, and everything
lands back in the product's database afterwards.

Why that number:

- It is Statuspage's Startup tier (USD 99 a month, USD 1,188 a year), the
  product a company with a status page already pays for at the same moment,
  for the same reason. A buyer who has Statuspage understands the price in
  one sentence.
- It is about a third of Zendesk for five agents, and far below the first
  hour of a serious outage for a company whose product is the thing its
  customers write in about. For a hobby install it is too much, and that is
  fine: a hobby install does not need a standby.
- Annual billing cuts the Stripe cost from twelve invoices to one, turns
  churn into a yearly decision, and gives a cash cushion to run the thing.
- It does not fund on-call. Nothing a self-hosted MIT buyer will pay funds
  on-call below 30 installs (section 3), and a higher list price (CHF 3,000)
  would only shrink the buyer pool to the companies that would rather run the
  self-hosted standby themselves. Price for the pool that exists and let the
  count, not the price, decide whether on-call is affordable.

A second tier, "standby with response" at CHF 3,600 a year with a named
response window, is sellable only once a second responder exists. Not before.

### What the "I'd pay for this" checkbox can and cannot tell us

It can tell us: how many people who scrolled to the bottom of the landing
page care enough to leave an email, and what share of those tick the box
(the PostHog event `continuity_joined` with `would_pay` makes that a single
query). It gives a list of people to interview and to send a priced offer to.

It cannot tell us: a price (none is shown), a company (an email at a `.com`
is not a buyer), a budget owner (the person ticking may be an engineer with
no purchasing power), or a conversion rate. Ticking costs nothing and
commits to nothing; stated willingness to pay is the weakest evidence in
pricing, and I would discount it heavily: my estimate, not a sourced figure,
is that 5 to 20 percent of ticks become a paid pre-order when a real price
and a real card form appear, and that the rest were polite.

Make it tell us more at no cost: reply to every tick within a week with the
price above and a refundable Stripe payment link for a one-year pre-order.
A paid pre-order is revealed preference; ten of them is the build signal
(section 4). Zero of them after fifty ticks is the signal too.

## 3. Revenue potential, honestly

### Three scenarios at CHF 1,200 per install per year

Stripe fees at about 3.6 percent (Swiss card plus Billing); hosting from
section 1, scaled with the tenant count; "attention" is layers 1 and 2 of
the human cost; "on-call" is layer 3.

| Paying installs | Revenue per year | Per month | Fees | Hosting and tooling | Contribution per month | What it covers |
|---|---|---|---|---|---|---|
| 10 | CHF 12,000 | CHF 1,000 | CHF 36 | CHF 150 to 250 | **CHF 715 to 815** | Hosting, tooling and insurance; about half of the routine hours; none of the on-call |
| 50 | CHF 60,000 | CHF 5,000 | CHF 180 | CHF 400 to 700 (bigger cluster, Postmark overage, two regions, a shared on-call seat) | **CHF 4,100 to 4,400** | Routine hours, incidents, and the on-call duty at the low end of the European benchmark |
| 200 | CHF 240,000 | CHF 20,000 | CHF 720 | CHF 1,000 to 2,000 hosting plus a part-time operator at CHF 3,000 to 5,000 | **CHF 12,000 to 15,000** | Everything, with a second responder on payroll and a margin |

Break-even counts, same price:

- Hosting and tooling only (CHF 150 to 300 a month): **2 to 3 installs**.
- Plus the maintainer's routine attention (CHF 500 to 1,300): **8 to 16**.
- Plus on-call at the European stipend benchmark (CHF 2,000 to 4,200):
  **30 to 55 installs**.

### How many installs that needs

Nobody publishes install-to-paid conversion for a hosted add-on to a free
package; what exists is secondary and inconsistent, so I give the range and
the sources and reason on the low end:

- Open-source free-to-paid conversion is "often between 0.5 and 3 percent",
  and "1 to 5 percent" is attributed to OpenView's 2022 benchmarks, both via
  a single consultancy blog I could not verify against the original
  ([getmonetizely](https://www.getmonetizely.com/articles/whats-the-optimal-conversion-rate-from-free-to-paid-in-open-source-saas)).
- Cal.com's co-founder cited about 25,000 to 30,000 users and roughly 10
  percent paid in 2022, for users of the hosted product, not self-hosters
  ([getlatka interview](https://getlatka.com/interviews/calcom-bailey-pumfleet-2022));
  Cal.com later moved its main codebase private and left a community fork
  ([sacra](https://sacra.com/chat/h/d1cda8de-7bc0-4156-ad04-f9e1b128fbb2/)),
  which is what "the open source did not pay" looks like from outside.
- Sentry: "10,000+ installations out in the wild" of the self-hosted
  version per a then-employee ([openpath.quest](https://openpath.quest/2024/widespread-use-of-a-fair-source-product/))
  against 50,000 paying SaaS customers and USD 128 M ARR in 2023
  ([sacra](https://sacra.com/chat/h/7f792f9b-2e48-4bbf-a6ef-7e02e3781a8e/));
  David Cramer: "We enable self-hosting because not everyone can use a
  cloud service, otherwise we probably wouldn't even spend energy on it"
  (quoted by [bugsink](https://www.bugsink.com/self-hosted-sentry-support/)).
  Self-hosted is a compliance exception for them, not a funnel.
- PostHog no longer supports self-hosted deployments and refers them to
  legacy docs ([posthog.com handbook](https://posthog.com/handbook/marketing/partners)).
- Plausible: about USD 3.1 M ARR by late 2024 ([tinyempires](https://tinyempires.substack.com/p/inside-a-tiny-empire-plausible-analytics)),
  10,000 to 20,000 paying subscribers depending on which copy of their own
  page you read; the Community Edition gets two releases a year and lacks
  funnels, revenue goals and SSO ([plausible.io/docs/self-hosting](https://plausible.io/docs/self-hosting)).
  Their conversion lever is feature gating, which `ROADMAP.md` rules out.
- Umami Cloud: Hobby USD 0, Pro USD 20, Business USD 200 ([umami.is/pricing](https://umami.is/pricing));
  no conversion data published.
- Payload Cloud, the closest cousin (a hosted add-on to an MIT Next.js
  package, and the project `docs/product.md` names as the positioning
  model): "deployment of new projects is currently paused" after the Figma
  acquisition, existing projects keep running, "no pricing changes are
  currently planned" ([payloadcms.com/cloud-pricing](https://payloadcms.com/cloud-pricing)).
  The hosted add-on did not survive as a priority even with Payload's
  install base.
- The counter-example is Sidekiq: one person, about USD 80,000 a month
  ([indiehackers](https://www.indiehackers.com/interview/sidekiq-6e71309457)),
  and it is sold on gated Pro and Enterprise features, which is exactly what
  this package has promised not to do.

Inference: without a feature gate, the convertible population is the subset
of installs whose own product's uptime is the support topic: PaaS, infra,
fintech, anything with an SLA. Call that 20 to 30 percent of installs, of
whom 5 to 15 percent buy a standby, so **1 to 5 percent of installs**. Ten
paying installs then needs 200 to 1,000 production installs; fifty needs
1,000 to 5,000. The package has none today and two design partners about to
deploy ([docs/product.md](../../../product.md)). The honest revenue
potential over the next twelve months is the design partners, as a bundle,
and single digits of strangers.

## 4. The opportunity cost

The maintainer's attention is the scarce input; every option below is
measured in his hours and in what it does to the "we never see your data"
line.

| Option | Year-one cash (estimate) | Hours | Fixed cost before revenue | Touches customer data | Verdict |
|---|---|---|---|---|---|
| Sponsorship (on the page already, button only if `SITE_SPONSOR_URL` is set) | CHF 0 to 2,400 | about 0 | 0 | No | Keep on; count on nothing. Tidelift's 2024 survey: 60 percent of maintainers are unpaid hobbyists, 26 percent earn over USD 1,000 a year, and donations are the source for 47 percent of those paid at all ([devops.com](https://devops.com/survey-most-open-source-software-maintainers-want-to-get-paid/), [tfir.io](https://tfir.io/almost-half-of-open-source-maintainers-are-unpaid-volunteers-survey/)) |
| Paid onboarding and support contracts with the two design partners | CHF 15,000 to 28,000 (a fixed onboarding fee of CHF 4,000 to 8,000 each, 3 to 5 days at a CHF 1,200 to 1,600 day rate, plus a retainer of CHF 3,600 to 6,000 a year each for a named contact, upgrade help and a two-business-day response) | 10 to 20 days, billed | 0 | No | **First.** The hours are billed, the partners are already talking to him, and a retainer at the price of Zendesk for five agents is easy to say yes to |
| "Install it for us" as a productised service on the site | CHF 2,500 to 5,000 per sale, demand unknown | 1 to 3 days per sale | 0 | No | Second; it is the same offer as above with a price on the website, and it sells off the docs with no code to write |
| Managed standby | CHF 0 to 12,000 at ten installs | 15 to 30 days to build (my estimate; the engineering report owns this) plus on-call forever | CHF 60 to 215 a month plus insurance | **Yes**, during every outage | Last, and only on pre-orders |
| Nothing: pure open source feeding the company's other work | CHF 0 direct | 0 | 0 | No | The baseline every other option must beat; it is not a bad one |

What I would pursue first: **the design-partner contracts, this quarter**,
with the self-hosted standby recipe bundled into the onboarding offer ("we
set up your standby app and your failover"). The brief says the package must
work with a self-hosted standby either way, so that work is not optional; it
should be billed to the first two customers rather than given away ahead of
a hosted product that may never ship. Set `SITE_SPONSOR_URL` the same
afternoon.

The managed standby comes third, gated on evidence: ten refundable one-year
pre-orders at CHF 1,200 (CHF 12,000 in the bank, which pays the hosting for
years and a third of the build), a second responder lined up, and the
design-partner standbys running self-hosted for a quarter so that the
handback path has been exercised with real outages.

## 5. The downside

### A failed launch

- **Build spent**: 15 to 30 maintainer days, CHF 18,000 to 45,000 at a
  freelance-equivalent day rate (estimate; the engineering report will have
  its own figure).
- **Running at a loss**: CHF 60 to 215 a month cash plus insurance, for as
  long as the shutdown notice runs.
- **Shutdown**: a notice period (90 days is the usual SaaS courtesy; Payload
  chose "no rush" and indefinite support for existing projects, which is the
  comparison people will draw), pro-rata refunds of annual fees (ten
  customers with half a year left is CHF 6,000), and a verified handback
  export for every tenant, about an hour each with the export tooling in
  `src/export.ts` and `bin/export.mjs`.
- **Credibility**: `ROADMAP.md` says no hosted mode "because we never see
  your data". A managed standby sees customer conversations during every
  outage, needs a data-processing agreement, and a later shutdown makes the
  reversal public twice. The cash cost is small; the cost is that the
  positioning line carries a footnote. Mitigation, if it is built at all: a
  separate name and a separate contract, the package never depending on it
  (already promised on the site), and the self-hosted recipe published
  first so that the managed version is visibly a convenience, not the
  design.

### The standby going down during a customer's outage

Money view only; legal has its own report.

- **Reputation**: the product has exactly one promise, and a double outage
  at one customer breaks it in public. The natural gesture is a full refund
  of the year (CHF 1,200) and a written post-mortem; comparable products
  settle in service credits of a share of the fee, never in damages.
- **Liability exposure**: the fee is CHF 1,200; a customer's loss from
  unreachable support during an outage is unbounded and unprovable, so the
  contract must cap liability at fees paid (legal), and a Berufshaftpflicht
  at CHF 400 to 1,500 a year (section 1) covers the Vermögensschaden claim
  that gets through anyway.
- **The likeliest failure is correlated**: if the standby runs on the same
  provider as the customer (a Cloudflare, AWS eu-central or Hetzner-wide
  incident), the "independent failure domain" claim fails exactly when it is
  tested. The fix, a second provider, doubles the hosting bill and the
  operational surface. The second-likeliest failure is the one operator
  being unreachable, which no amount of hosting fixes.

## 6. For Divio as a customer

Cheapest credible setup per month under each shape in the brief, so a number
can go next to each in the Divio discussion. The constraint from the brief:
Divio Cloud is out, because the outage is Divio's control plane, so every
shape sits on independent hosting. Email and a status component are the same
in all three (Divio already runs status.divio.com; `GET {basePath}/health/`
plugs in at no cost).

| Shape | Hosting | Email | Divio's own hours | CHF per month | Notes |
|---|---|---|---|---|---|
| **A. Separate self-run support app** (the recipe in `production.mdx` today) | Vercel Pro plus Neon Launch about USD 45, or Fly.io 1 GB plus Managed Postgres Basic about USD 48: **CHF 37 to 40**; Swiss alternative Exoscale Small plus DBaaS Hobbyist-2 about **CHF 65**, Startup-4 about **CHF 130**; Hetzner CX23 with Postgres on the box about **CHF 12** | Postmark Pro CHF 14 | 1 to 2 hours a month for upgrades, plus a sign-in that is not Divio's own IdP | **CHF 50 to 80 (EU), 80 to 145 (Swiss)** | The support app is the system of record, so there is no handback; the helpdesk simply never lived in the control panel. Nothing to build |
| **B. Self-run standby** (helpdesk in the control panel, a standby app on independent hosting, handback by export and import) | Same as A | Same | Same, plus a failover drill of 2 to 4 hours a quarter (estimate) | **CHF 55 to 90 (EU), 85 to 155 (Swiss)**: shape A plus Cloudflare Workers Paid USD 5 for the switch | Needs the standby mode the engineering report scopes; the package work is unpaid unless bundled into a Divio contract |
| **C. Managed standby** at the recommended price | Ours | Ours | An annual drill | **CHF 100** (CHF 1,200 a year) | A solo operator, who also works at Divio, promising availability to a PaaS whose customers watch status.divio.com: Divio would reasonably ask why it does not run shape B on its own non-control-plane infrastructure instead |

Two observations for that discussion. Divio's own public plan pages show
resources and support tiers but render no prices
([divio.com/pricing](https://www.divio.com/pricing), [divio.com/plans](https://www.divio.com/plans)),
and its Priority support promises under one business day with a 99.50
percent expected monthly uptime; a standby sold to Divio must at least match
what Divio sells. And Divio should pay list price for whichever shape it
takes, as a design partner on a contract rather than as a favour: the first
reference customer paying nothing is the fastest way to a product nobody
else pays for either.

## What I recommend

**Do not build the managed standby now. Sell the design partners an
onboarding and support contract that includes setting up a self-hosted
standby, set the sponsor URL, and turn the "I'd pay for this" list into
refundable pre-orders at CHF 1,200 per install per year. Build the managed
version when ten pre-orders have paid and a second responder is lined up.**

Numbers behind it: cash cost of the managed standby CHF 60 to 215 a month,
fully loaded with the on-call duty CHF 2,500 to 5,800; break-even on the full
cost at 30 to 55 paying installs, which needs 1,000 to 5,000 production
installs at the 1 to 5 percent conversion the comparable projects suggest;
production installs today: zero. The design-partner contracts are worth CHF
15,000 to 28,000 in year one with no fixed cost, no on-call and no customer
data.

Rejected:

- *Build it now at CHF 1,200 a year*: covers hosting at three customers and
  nothing else; the on-call tax runs from day one with no customers.
- *Build it now at a premium price (CHF 3,000 and up with a response
  promise)*: funds the on-call at ten customers on paper, but the buyers who
  would pay that are the ones who can run shape B themselves, and a
  response promise from one person is not credible without a second
  responder, who costs most of the margin.
- *Usage-billed or per-outage-hour pricing*: earns when customers suffer
  and nothing in a good year, so it can never fund being ready.
- *Only sponsorship*: Tidelift's numbers say that funds a hobby, not hours.
- *Nothing at all*: a fine baseline, but it leaves CHF 15,000 to 28,000 of
  design-partner money on the table for work the brief says must happen
  anyway.

The one financial risk that would change this: if the design partners and
the first pre-orders show that buyers want the hosted thing and refuse the
self-hosted one (because they do not want a second app to run either), then
the convertible share is higher than 1 to 5 percent and the managed standby
becomes the product rather than the add-on. The cheapest way to find out is
the pre-order link, not the build.

## Open questions for the maintainer

1. Does the company already carry a Berufshaftpflicht or cyber policy that
   would cover a hosted service, or would the standby be the first reason
   to buy one (CHF 120 to 375 a month in section 1)?
2. How many emails are on the continuity list today, and what share ticked
   "I'd pay for this"? The PostHog event `continuity_joined` answers it in
   one query; I had no access to the numbers.
3. Is `SITE_SPONSOR_URL` set in the site's Divio environment? The button
   renders only when it is.
4. Would the design partners sign a paid onboarding and support contract
   this quarter, and at what day rate are you willing to bill them? My
   CHF 1,200 to 1,600 a day is a Swiss freelance-equivalent, not your
   number.
5. Is there a second person (a contractor, a design partner's ops team, a
   friend in the trade) who could plausibly share an on-call schedule? If
   the answer is no, the managed standby's promise has to be written
   without a human in it, which caps the price at what I recommend.
6. For Divio specifically: is the maintainer's employment there a reason
   Divio cannot be a paying customer of his company at all, or just a
   reason to document the conflict? That decides whether shape C is even
   on Divio's table.
7. Which provider's control plane would you accept as the standby's
   failure domain? Exoscale is the only Swiss option and the one I could
   not price from its own pages; the EU options are a third of its cost.
