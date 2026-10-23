# Product: what "support that stays up when your app doesn't" should become

Written 22 October 2026 for the standby exploration. Subject: product. One of
five independent reports in this folder; the shared brief is `BRIEF.md`.

## What I read, and what is verified versus inferred

Verified in the repository on 22 October 2026:

- `docs/research/2026-10/standby/BRIEF.md`, `docs/product.md`, `AGENTS.md`,
  `ROADMAP.md`, `docs/switching.md`,
  `site/content/docs/operations/production.mdx` ("Keep support reachable when
  your product is down"), `site/app/(site)/page.tsx`,
  `site/app/(site)/components/continuity-form.tsx`, `site/lib/helpdesk.ts`.
- `src/export.ts`: the JSON Lines shape (`ExportedConversation`), people
  named by email, messages with `emailMessageId`; `importConversations`
  creates the conversation with `context.imported`, passes `{ sla: false }`,
  matches contacts by email (`findContactByIdentity`, then
  `findContactByEmail`) and creates unverified ones otherwise. Nothing in it
  refuses a line that was imported before, so importing the same file twice
  creates the conversations twice (inferred from the code path; not run).
- `relays/cloudflare-email-worker.js`: forwards to `FALLBACK_ADDRESS` when
  the inbound route does not answer, otherwise rejects. `relays/README.md`:
  Postmark retries; Mailgun retries for eight hours.
- `src/http.ts` line 590: `GET health` answers `{ ok: true }` after
  `support.ping()`, 503 otherwise.
- `src/widget/element.tsx`: the element reads `api`, `inbox`, `locale`,
  `types`, `org`, `identity-token`. There is no second `api`, no status link
  and no outage copy. When the session or the widget fails to load, the
  widget shows `load.failed` ("This could not be loaded.") and "Try again"
  (`src/ui/i18n.ts` lines 73 and 496; `src/widget/widget.test.tsx` lines
  599 and 1122). A grep for banner, announcement, maintenance and status page
  in `src/widget/widget.tsx` and `src/config.ts` finds nothing.
- `site/lib/helpdesk.ts`: the website runs the package on its own Postgres,
  with a `continuity` inbox (public, no receipt) that the form writes into,
  and an `identify` that makes every signed-in site user an agent.
- `docs/gap-analysis-2026-10.md` mentions outages only as a reason for bulk
  actions (lines 35 and 916). Nobody in that research asked for a standby.
- The landing page says, in "What we won't do": "No hosted mode and no
  second login." Four sections later it announces a managed standby. Both
  are on the same page today.

Inferred, and marked as such where it matters below: everything about the
design partners (they are unnamed; I know only that two are about to
deploy), everything about Divio's architecture beyond what the brief says,
how many people are on the continuity list, and whether the list's "I'd pay"
checkbox has been ticked by anyone.

Method note: I framed section 1 the way Next Move Theory frames a Job, as a
transition from a situation to a desired result with success criteria, read
from `../flow/references/nmt-canon/Next-Move-Theory-Canon/Advanced-Jobs-To-Be-Done/job-structure.md`
and the riskiest-assumption ordering in
`.../Riskiest-Assumption-Test/rat-key-theses.md`. The rest is plain product
judgement against the repository.

## 1. The job, precisely

**Who has it.** The person who owns support at a company whose product's
uptime is what customers write in about: a PaaS, a hosting or infrastructure
provider, a payments or banking product, an API company, anything with a
status page. The job is the same for a founder answering tickets and a
support lead with four agents; what differs is who signs in during the
outage. Two people are in the picture, and the job belongs to the first:

- The support owner (the host, in the package's words). They carry the
  responsibility and the contract: enterprise tiers with response targets
  (`ROADMAP.md`, wave 5) do not pause because the product is down.
- The customer of that product, who is the one writing.

**The situation they start from (State A).** The product is down. The
helpdesk is mounted in it, so its routes, its database and its sign-in are
down too. The customer opens the widget on the marketing site and gets
"This could not be loaded." (`src/ui/i18n.ts` line 496). Mail to support@
is either forwarded to a mailbox nobody is reading at that moment
(`FALLBACK_ADDRESS`) or sitting in the relay's retry queue. The team is in
the incident channel and has no view of who is asking what. The only thing
talking to customers is the status page. The emotion on the host side is
specific: not "we lost tickets" but "we went silent at the one moment our
customers judge us". The customers' emotion is uncertainty: is it me, is it
them, does anyone know.

**The trigger.** An outage, or more often its post-mortem: "support was
dark for 40 minutes" is a line somebody writes in the incident review. A
second trigger is a procurement questionnaire asking how support is reached
during an incident. Both are concrete past events, which is what to
interview the private list against (section 6).

**The result they want (State B).** During the outage, customers can write
and a person answers them, and the team can see the queue. After the
outage, everything that happened sits in the product's database with the
rest of the history, so that in a week nobody remembers there was a second
system. Success criteria, as the support owner would state them:

1. A customer who writes during the outage gets a human reply, by email,
   within the usual response time. Not an auto-responder: a person with a
   name, which is the line the roadmap already draws for AI.
2. The widget says something true: that the product is having trouble,
   where the status page is, and that support is open. Not "This could not
   be loaded."
3. Nothing is lost or duplicated afterwards. Every conversation written
   during the outage is in the primary database when it is over, once, with
   its reference findable from the receipt the customer got.
4. It costs the team nothing to switch on. The outage is the moment the
   team has the least attention; a standby that needs a runbook step at
   03:00 underperforms exactly when it is needed.
5. The customer's earlier conversations are visible during the outage.

**The ranking of the three outcomes the brief names.** The brief asks for
customers write and get a reply, customers see their earlier conversations,
and a proactive status banner in the widget. In order:

1. **Customers can write and get a human reply.** Without it nothing else
   matters; it is the whole job.
2. **The widget tells the truth and points at the status page.** During an
   outage most new messages are "is it down?". A widget that answers that
   question before the form takes volume off the queue and anxiety off the
   customer. It also costs almost nothing: it is a package feature, not a
   standby (section 7).
3. **Earlier conversations visible.** Last. During an outage people write
   about the outage, not about last month's thread, and a customer with an
   open thread continues it by replying to the last email, which the relay
   queues and threads in later by message id (`relays/README.md`). This
   ranking matters for the architecture: showing earlier conversations
   during an outage requires the standby to hold a continuous copy of the
   primary's data before the outage, which is the one thing that turns "we
   see your data only while you are down" into "we see your data". Dropping
   it from the standby's scope is what makes a standby compatible with the
   positioning at all.

**What they do today.** Intercom or Zendesk, which never have this problem
because the widget talks to the vendor's servers, at the price the landing
page's comparison table names (the customer data lives with the vendor).
Or a status page plus support@ into a mailbox, with the team answering from
Gmail during the incident and nobody writing it into the helpdesk
afterwards. Or, for the ones who read `production.mdx`, a separate support
app on separate hosting. "Good enough" for the segment is honestly the
second one plus criteria 1 and 2: a channel that stays open, a human
answer, and a widget that does not lie. Criterion 3 is what separates a
product from a workaround.

**The problem, named the way the package's own docs would.** The solution
"helpdesk inside the product, on its database" underperforms one success
criterion of this segment, reachability during the product's own outage.
It performs every other criterion better than the alternatives. The
exploration is about whether to fix that one criterion with a recipe, with
a second install, or with a service.

## 2. The three shapes

### (a) The documented recipe: a separate support app as the only helpdesk

**What it is.** `production.mdx` already says it: mount the helpdesk in a
small Next.js app of its own, on separate hosting, with its own database.
The product embeds the widget cross-origin with an identity token; the
website carries the widget on a public inbox for anyone who cannot sign in;
agents sign into the support app with a sign-in that is not part of the
same outage; the relay's fallback catches mail. The website at
better-helpdesk.com runs this way for itself (`site/lib/helpdesk.ts`).

**Who it is for.** Any host whose product's uptime is what customers write
about, and who runs more than one deployment anyway. That is most of the
segment: a company with a status page has a second hosting account, a
second region, or at least a second project.

**What it costs the host.** One small Next.js app, one database, one deploy
pipeline, one sign-in that survives the product's outage (Google Workspace,
GitHub, a magic link; the site uses Better Auth), one identity-token secret
shared with the product, and the status page pointed at `health`. For a
team already deploying the product, this is a weekend, then nothing.

**How it squares with the positioning.** It keeps "your own database, we
never see your data" exactly. It bends "inside your own product": the
helpdesk is inside your own app, your own stack, your own Postgres, but it
is beside the product, not in it. It contradicts one sentence in
`docs/product.md`: "There is no second system to run and nothing to sync."
For this segment there is a second system to run; there is still nothing
to sync, because the CRM data comes through the identity token (user,
orgs, tier) rather than through shared tables. What the host loses is
calling the helpdesk as a function from the product's code (host functions,
`onEvent` in the product's process); for a product written in anything but
Next.js that was never available anyway.

**Credibility.** It is the honest answer, it is already documented, and the
project's own website lives by it. No damage.

**Does (a) make (b) unnecessary for most hosts?** Yes. A separate support
app on separate hosting is simpler than a standby with a handback, and it
is always on, so it needs no drill, no switch and no import. The hosts (a)
does not serve are the ones who chose Better Helpdesk precisely for the
in-product mount: the helpdesk reads the product's session, lives in its
deploy, calls host functions from product code. That is the pitch on the
landing page, so it is a real group, and it may well include the two design
partners (inferred: I do not know how they mount it). For them (a) is "give
up the reason you chose us", and (b) is the only answer that keeps both.

### (b) An open-source standby on the host's own account, with a handback

**What it is.** A second, smaller install of the same package: a tiny
Next.js app with one route handler, `sqliteAdapter` or a small Postgres, on
hosting the host owns that does not share the product's failure domain. It
holds nothing until the product goes down. When the product stops
answering, the widget switches to the standby's `api` (today the element
takes one `api` attribute; this needs a second), the relay sends mail to
the standby's inbound route instead of a mailbox, and agents sign into the
standby with the independent sign-in the recipe already demands. When the
product is back, the standby exports (`better-helpdesk-export`) and the
primary imports (`better-helpdesk-import conversations`), the conversations
arrive with `context.imported`, new references and no SLA clock (verified
in `src/export.ts`), and the standby empties.

**Who it is for.** Hosts who want the in-product mount and the outage
cover, and have the ops habit to run one more small thing. The same pattern
as `relays/`: example code the host deploys.

**What it costs the host.** The same as (a) (a second app, database, sign-in
and pipeline) plus the parts that make it a standby: shared secrets (the
identity-token secret, or a second one dedicated to the standby), a relay
configured with a second destination, the switch rule in the widget, the
handback step, and a drill now and then so the thing is known to work. That
is strictly more than (a). The host accepts it to keep the primary helpdesk
inside the product.

**What the package would need.** Small, and all of it useful to self-hosters
and a managed standby alike, which the website promises ("The open-source
package will never depend on it"):

- The widget: a `standby-api` (or `fallback-api`) attribute, a rule for
  when to use it (the primary's `health` says 503 or does not answer within
  a short timeout), and honest copy with a `status-url`. This is also the
  ranked-second outcome from section 1, so it earns its place on its own.
- References: the standby must not issue references the primary will also
  issue. A `referencePrefix` of its own (`DIVIO-S1001`) or a sequence that
  starts elsewhere; the receipt quotes it, and after the handback the
  conversation gets a primary reference with the standby one kept in
  `context.imported` (that part exists).
- Import: refuse a conversation it has imported before, keyed on the
  source install and conversation id in `context.imported`, so a handback
  can run twice without duplicates. Today it would duplicate (inferred from
  `importConversations`; the brief's "nothing lost or duplicated" depends on
  it).
- Inbound: either the relay learns a second URL (a Cloudflare Worker change
  in `relays/`) or the standby's inbound route is the `FALLBACK` target.
  Message ids are already carried through export and import.
- A docs page, "Run a standby", next to "Go to production", and an
  `examples/standby` app that is nothing but the handler, SQLite and a
  sign-in. One drill button or CLI step: switch the widget to the standby
  for ten minutes on purpose, write a test conversation, hand back, read
  the report.

None of this crosses "Off-limits" in `AGENTS.md`: the standby is a host
app, not a mode of the package; it uses the host's sign-in; its database is
the host's. The package gains attributes and a CLI behaviour, not a server.

**How it squares with the positioning.** Fully. "We never see your data"
stays literally true. The roadmap's "no hosted mode or hosted relay" stays
true; the standby is the relay pattern applied to the helpdesk itself.

**Credibility.** Good, and it is what makes (c) safe to offer: the
open-source answer exists, works, and is what the paid thing runs.

**Does (b) make (c) thin?** Yes, by design, and that is the point. With (b)
in the package, (c) is "we run the standby app for you": hosting, the
sign-in, the status page for the standby, the drill, the handback, and
someone who answers when it does not work. The only way (c) could be "more"
than that is by holding a continuous replica so that earlier conversations
show during an outage, which is the one feature section 1 ranks last and
the one that would make "we see your data only while you are down" false.
(c) should stay thin. A thin (c) is the honest (c).

### (c) A managed standby the maintainer's company hosts for money

**Who it is for.** Hosts with no second hosting account, no appetite for a
runbook, or a small team for whom "someone else makes sure it works at
03:00" is the product. Also, plausibly, hosts who would pay to not think
about the drill.

**What it costs the host.** Money, a data-processing agreement, trust in a
one-person company's uptime, and a dependency the roadmap promised they
would never have. It costs the maintainer more: being on call during other
companies' outages, which are by nature unplanned, with founder attention
as the scarce resource (`docs/product.md`: one maintainer, no cadence,
quality wins).

**How it squares with the positioning.** It does not, unless the sentence
changes. `ROADMAP.md` says no hosted mode "because we never see your data";
`AGENTS.md` forbids a hosted or cloud mode in the package; the landing page
says "No hosted mode and no second login." A managed standby is a hosted
mode with a second login, for a bounded time. The honest reconciliation is
a narrower promise: the package has no hosted mode; the managed standby is
a separate service that holds conversations only while you are down and
deletes them after the handback. Section 5 has the sentences.

**Credibility if (c) were the only good answer.** It would read as
open-core with the reliability story behind the paywall, on a page that
says "No seats and no paid features in the package" and "the open-source
package will never depend on it". That is the one outcome to avoid. (c) is
acceptable only after (b) is documented, runnable from the repository, and
what (c) itself runs.

## 3. The Divio case

**Which shape.** Shape (a), and not inside `control.divio.com`.

The reasoning is the brief's own scenario: the control panel's outages are
the main reason customers write. A helpdesk mounted there is down exactly
when it is needed, every time, by construction. A standby (b) would then
fail over on every incident, which means the handback runs after every
incident, which means the "normal" path is the exceptional one. When the
failure is the common case, the primary should be the thing that survives
it. So: a small support app on a failure domain that does not include the
control panel, with the widget embedded in `control.divio.com` with an
identity token and on `www.divio.com` on a public inbox, the status page
pointed at the support app's `health`, and agents signing in through
something that is not the control panel's own session.

Two things I cannot verify from the repository and that change the answer
if wrong (open questions, section "Open questions"): whether
`control.divio.com` is a Next.js app at all (if it is not, an in-product
mount was never available and the Divio case is a weak proxy for the
standby's segment), and whether an app deployed on Divio keeps running
when the control panel is down. If deployed apps keep running, the support
app can be a Divio project in another region; if a control-panel outage
can take deployed apps with it, the support app must live off Divio, which
is also the only honest place for Divio's standby in any shape.

**The trade-off.** In the product, the helpdesk would read the control
panel's session, know the organisation, the subscription and the projects,
and could be called from the control panel's code (host functions, events
to a pager). Beside the product, it knows what the identity token carries:
user, organisations and a tier, which is enough for contacts, companies
and SLA tiers; the rest comes as deep links back into the control panel
from the contact and company cards (`ROADMAP.md`, "On request"), which the
agent follows when the control panel is up. During an outage the token
cannot be minted (the control panel mints it), so signed-in customers
arrive as visitors on the public inbox and are matched by email, unverified.
That is acceptable: the agent sees the email, and after the outage the
contact is the same one.

**Recommendation.** Independence wins. Linkage through the token and deep
links is 80% of the CRM value at none of the outage exposure. The remaining
exposure, the support app's own hosting going down, is ordinary and is
what the health route on `status.divio.com` is for. For Divio, (b) is not
needed and (c) would be Divio paying the maintainer's company to run what
Divio can run itself.

## 4. If the managed standby is built: the MVP

Written on the assumption that (b) exists first and (c) runs it. If (b) does
not exist, do not build (c).

**In.**

- The widget takeover: the host's existing widget, with `standby-api` and
  `status-url` set, switches on its own when the primary's `health` fails.
  Signed-in customers who still hold a valid identity token are recognised
  (the standby verifies with a secret the host dedicates to it, so a token
  minted for the standby is never trusted by the primary); everyone else
  writes as a visitor on a public inbox with a receipt.
- One inbox, support, with receipts on. Priorities and the host's types,
  because the import keeps them.
- The agent inbox, at a URL of its own, with a sign-in of its own (magic
  link to agent addresses the host listed before any outage).
- Email out through the host's own sender, so the receipt and the replies
  come from the host's domain. Email in through the host's relay pointed at
  the standby's inbound route as its second destination.
- The handback, automatic, with a report.
- The drill: the host can switch to the standby on purpose for ten
  minutes, from the standby's own page, and gets the same report.

**Out.** CRM beyond the contact and company the token or email gives
(no lead or deal stages, no custom fields), AI, statistics, saved views,
tags, SLA clocks (the import starts none anyway), attachments (the widget
says they can be sent once the product is back), snooze, canned replies,
roles beyond agent. The standby is an inbox with a widget and email,
nothing an agent would miss for the length of an outage.

**Customer-facing behaviour during the outage.** The widget opens with a
line above the form: "{product} is having trouble. Support is open, and
replies come by email." with the status page linked. Conversations written
during the outage show in the widget for that visitor (they live on the
standby). Earlier conversations do not; the widget says "Your earlier
conversations will be back when {product} is." The receipt email comes from
the host's domain, carries the standby reference (`PREFIX-S1001`), says
support is open and the product is being worked on, and says the
conversation will be in the customer's account when systems are back, under
a reference the team will quote.

**Agent-facing behaviour.** A separate URL, a separate sign-in, the ordinary
agent UI with the surface trimmed as above. A banner on the standby's inbox:
"Standby since 14:02. Primary down." When the primary is back, the standby
hands back and the banner changes to "Handed back at 15:10, 23 conversations,
report sent. This inbox is read-only and will be deleted on 29 October." In
the primary, the conversations arrive open, with their standby reference in
`context.imported`, a system event "Written on the standby during the outage
of 22 October 14:02 to 15:10", and a new primary reference. A reply the
customer sends to the standby's receipt after the handback still threads in
by message id.

**The handback as a product moment.** Automatic: once the primary's `health`
has answered `{ ok: true }` for fifteen minutes, the standby exports, the
primary imports (through the host's jobs route or a host-side CLI step the
host scheduled), the import refuses anything it has seen before, and a
report goes to the agents who were signed in and to the host's contact:
window, number of conversations, how many are still open, the standby and
primary reference of each, anything that did not import and why. The report
is the thing the team reads in the post-mortem; it is also the evidence the
host's procurement wanted. The standby then goes read-only and deletes its
copy after seven days, and the report says so. A flapping primary is
handled by the fifteen minutes and by the import's refusal of duplicates,
not by asking a human at 03:00.

**What must be true for a host to trust it.**

- A status page for the standby itself, monitored from somewhere that is
  neither the standby nor the maintainer's own hosting.
- Data location named: Swiss hosting, named provider, and never the host's
  own platform (a standby for a PaaS cannot run on that PaaS).
- Deletion after handback, automatic, within a stated number of days,
  confirmed in the report, and no backups that outlive it.
- The line "we see your data only while you are down", kept literally: the
  standby holds nothing before an outage, no replica, no contact sync.
- A data-processing agreement under Swiss law, short, naming the above.
- The drill, so the host has seen it work before the first real outage.
- The same standby runnable from the repository by the host alone, so the
  host can leave the managed one without losing anything.

## 5. The words

The constraint: `ROADMAP.md` says "A hosted mode or a hosted relay. It
ships where your app ships: no second deploy to run and no data-processing
agreement to sign, because we never see your data." The landing page says
"No hosted mode and no second login." and, lower down, announces a managed
standby. All three must say the same thing. The open-source package's
independence from the managed thing stays a stated guarantee in every
outcome.

### Outcome A: built as open source only (shape b)

`ROADMAP.md`, "What it will not do", replacing the hosted-mode bullet:

> - **A hosted mode or a hosted relay.** It ships where your app ships: no
>   second deploy to run and no data-processing agreement to sign, because
>   we never see your data. The inbound relay is example code you deploy on
>   your own account, and so is the standby: a second, smaller install of
>   the same package on hosting of your own, which takes the widget and the
>   mail while your app is down and hands the conversations back to your
>   database when it is up.

Landing page, the section replacing "Not public yet":

> Support that stays up when your app doesn't.
> A standby is a second install of the same package on separate hosting
> you own. The widget switches to it when your app stops answering, your
> relay sends mail there, and when your app is back every conversation
> lands in your database with a report of what happened while you were
> away. It's in the package, MIT, like everything else.
> [Run a standby, in the docs]

"What we won't do" keeps "No hosted mode and no second login." unchanged.
The private list gets one email: it is built, it is open source, here is the
page; the list is closed.

### Outcome B: open source plus managed (shapes b and c)

`ROADMAP.md`, the same bullet, with one exception stated inside it:

> - **A hosted mode or a hosted relay.** It ships where your app ships: no
>   second deploy to run and no data-processing agreement to sign, because
>   we never see your data. The inbound relay is example code you deploy on
>   your own account, and so is the standby. The one thing we run is the
>   managed standby: the same standby, on our Swiss hosting, for a team
>   that would rather not run it. It holds the conversations your customers
>   write while your app is down, hands them back when it is up, and
>   deletes its copy. We see your data only while you are down, and the
>   package never depends on it: the standby in the repository is the one
>   we run.

Landing page, the section:

> Support that stays up when your app doesn't.
> A standby is a second install of the same package on separate hosting
> you own. The widget switches to it when your app stops answering, your
> relay sends mail there, and when your app is back every conversation
> lands in your database with a report. Run it yourself from the docs, or
> let us run it: a managed standby on Swiss hosting, with its own status
> page, that sees your conversations only while you are down and deletes
> them after the handback.
> [Run a standby] [Ask about the managed one]
> The package will never depend on the managed standby; it runs the same
> code you can run yourself.

"What we won't do", the first bullet:

> - No hosted helpdesk and no second login. The managed standby is the one
>   thing we run, and only while your app is down.

`AGENTS.md` "Off-limits" needs no change: the package still has no hosted
mode; the managed standby is a host app on the maintainer's account, in a
repository of its own, which is where it belongs so that nothing in this
repository depends on it.

### Outcome C: dropped, replaced by the documented recipe (shape a)

`ROADMAP.md`, a new bullet at the end of "What it will not do":

> - **A standby we run for you.** We explored a managed standby in October
>   2026 and dropped it. When your product's uptime is what customers write
>   in about, mount the helpdesk in a small app of its own on separate
>   hosting, as Go to production describes: it stays your app and your
>   database, and there is nothing to hand back.

Landing page, replacing the section, no form:

> Support that stays up when your app doesn't.
> When your product's uptime is what customers write in about, mount the
> helpdesk in a small app of its own on separate hosting, embed the widget
> in your product with an identity token, and point your status page at
> the helpdesk's health route. Your app, your database, one more small
> deploy. The guide covers it.
> [Keep support reachable, in the docs]

The private list gets one email saying so, with the guide, and is deleted.
"What we won't do" is unchanged.

In every outcome the sentence "The open-source package will never depend on
it" survives, as the last line of the section in outcome B and as the fact
of the matter in A and C.

## 6. What to validate with the private list before building anything

The form (`continuity-form.tsx`) collects an email and "I'd pay for this",
into the `continuity` inbox. A tick is a sentiment, not a signal: nobody has
been told a price, a data location or what "this" is. Interview against
past events, not hypotheticals. Ask each person, by reply from the inbox:

1. When was your product last down for more than ten minutes, and what
   happened to support during it? (Where did customers write, who answered,
   from what, and did it end up in the helpdesk afterwards?) This is the
   only question that says whether the job exists for them.
2. Where does your helpdesk run today, and does it share the product's
   failure domain? If they are on Intercom or Zendesk: what would make you
   move it inside the product knowing it then shares the product's fate?
3. Do you already run a second hosting account, region or project? Who
   signs your agents in if your product's own sign-in is down?
4. Shown the two options in a paragraph each: would you run a separate
   support app beside the product (the recipe), or do you need the
   helpdesk inside the product's database, and for what exactly?
5. If you ticked "I'd pay": for what, the hosting, the handback, or the
   person on call? What would you expect to pay per month, and would your
   legal side accept a Swiss company holding conversations only during
   outages, under a DPA?

Also ask the two design partners questions 1 to 4, directly. Their answer
weighs more than the list's, because the roadmap says their feedback sets
the order.

**Signal that justifies (b):** people on the list, or a design partner,
mount or want to mount the helpdesk inside the product, have a second
hosting account, and name the missing piece as "no recipe for a standby and
no handback". Then (b) is a docs page and the small package changes in
section 2, and it can be scheduled.

**Signal that justifies (c):** at least a handful on the list answer
question 1 with a real outage where support went dark, answer question 4
with "inside the product", answer question 3 with "no" or "nobody", and
answer question 5 with a number and a yes on the DPA. And at least one
design partner says they would use it. Fewer than that and (c) is a service
for one customer, which is a consulting engagement, not a product.

**Signal that says drop it:** the common answer to question 1 is "nobody
wrote; they watched the status page" or "mail waited and we answered from
Gmail, fine", or the common answer to question 4 is "beside the product is
fine". Then the recipe is the product, outcome C in section 5 applies, and
the ranked-second outcome (the widget's status line) ships anyway.

## 7. The roadmap position

**Where it sits.** After the design partners' first production feedback,
not before. `docs/product.md` records no production deployments yet and two
partners about to deploy; `ROADMAP.md` says their feedback sets the order
and waves 3 and 4 still have open items (the properties card, pressed and
error states, the side-by-side layout, merging duplicates). A standby is a
feature for a segment that has not yet run the product in production once.
Building it now spends the scarce resource (one maintainer's attention)
on a hypothesis while two real customers are about to produce facts.

**Two pieces that ship regardless, because they are the package's and
they are small in surface:**

1. The widget's outage copy: a `status-url` attribute and an honest line
   when the API does not answer, instead of "This could not be loaded." This
   is the ranked-second outcome from section 1, it serves every host, and
   it is one attribute, one i18n key in four languages, and one test. It
   can go into wave 3 next to "Clear pressed, sending and error states in
   the agent UI and the widget", which is where it belongs.
2. The import refusing a conversation it has imported before, keyed on
   `context.imported`. This makes export and import safe to re-run, which
   is worth having for migrations alone, and it is the thing any handback
   needs.

**What (b) would displace.** Nothing in waves 3 and 4; it is a wave of its
own ("Wave 6: a standby", or an "On request" item until someone asks). It
competes with the "On request" list for attention and should lose to any
item a design partner asks for.

**What (c) would displace.** The design partners. A managed standby is a
second business: contracts, a DPA, hosting, a status page, on-call during
other companies' incidents, and support for the support. For a one-person
project that just shipped 1.0.0, that is not a roadmap item; it is a
change of what the company does. If the list produces the signal in
section 6, the decision is a company decision, and the roadmap entry is
the smallest part of it.

**The riskiest assumption in the whole proposal.** That companies whose
uptime is what customers write about will mount their helpdesk inside the
product at all. If they take the recipe (shape a) because it is simpler,
the standby has no customer, managed or not. It is cheap to test: question
4 above, asked of the list and the two design partners, in the next two
weeks, before any code.

## What I recommend

**Ship the recipe as the answer, add the two small package pieces, keep
the standby as an open-source recipe for later, and do not build the
managed standby now.**

Concretely, in this order:

1. Make `production.mdx`'s "Keep support reachable" section the official
   answer and link the landing-page section to it (outcome C words from
   section 5, or outcome A words once the recipe includes a standby).
2. Ship the widget's `status-url` and outage line, and the import's refusal
   of duplicates. Both are package work, small, useful to everyone.
3. Interview the private list and the two design partners with the five
   questions in section 6, within two weeks.
4. If the signal for (b) arrives: write "Run a standby" (a docs page, an
   `examples/standby` app, the `standby-api` attribute, a standby reference
   prefix, the relay's second destination). It is the relay pattern applied
   to the helpdesk, and it keeps every sentence on the roadmap true.
5. Only if (b) exists and the signal for (c) arrives: offer the managed
   standby as "we run the standby for you", thin by design, with the words
   from outcome B, in a repository of its own, under a DPA, with its own
   status page and deletion after handback.

For Divio: shape (a), outside `control.divio.com`, on a failure domain that
does not include the control panel, with the identity token and deep links
carrying the CRM linkage.

**Alternatives rejected, and why.**

- *Build (b) now, ahead of the partners' feedback.* Rejected because no one
  has asked for it (the gap analysis does not contain it; the list has not
  been interviewed), and because the partners' first weeks in production
  will reorder everything else; a standby built now could be built for the
  wrong mount.
- *Build (c) first, with (b) following.* Rejected because it would make the
  paid thing the only good answer for a while, on a page that promises no
  paid features and no hosted mode. The credibility cost lands on the
  open-source project, which is the asset.
- *A standby that replicates continuously so earlier conversations show
  during an outage.* Rejected because it is the lowest-ranked outcome and
  the only one that makes "we see your data only while you are down"
  false.
- *Mount Divio's helpdesk in the control panel with a standby in front.*
  Rejected because the control panel's outages are the common case there;
  a standby that fails over on every incident is the primary with extra
  steps.
- *Keep the landing-page section as it is.* Rejected because it contradicts
  "No hosted mode and no second login" on the same page, and because a list
  with a "pay" checkbox and no questions produces sentiment, not evidence.

## Open questions for the maintainer

1. Is `control.divio.com` a Next.js app, and was an in-product mount ever
   on the table for Divio? If not, Divio is a weak proxy for the standby's
   segment and the Divio need is simply the recipe.
2. When the control panel is down, do apps deployed on Divio keep running?
   This decides whether Divio's support app can be a Divio project in
   another region or must live off Divio.
3. How many people are on the continuity list, and how many ticked "I'd
   pay"? And have either of the design partners mentioned outages or
   support reachability?
4. How do the two design partners mount the helpdesk: in the product, or in
   an app of their own? This is the riskiest assumption and they can answer
   it in one sentence.
5. Is being on call during other companies' outages something the company
   wants to be, at any price? The answer decides (c) before any signal does.
6. For a managed standby, would the host's own sender be used for the
   receipt and replies (so mail comes from the host's domain), or would the
   standby send from its own domain? The first is right and needs the host
   to hand over sending credentials for a dedicated stream.
7. Does `importConversations` already refuse a line it has imported before
   somewhere I did not see? I read it as creating a new conversation every
   time; if that is wrong, one of the two "ship regardless" items falls
   away.
