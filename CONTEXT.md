# Better Helpdesk: the words

Several everyday words have one fixed meaning in this code. The first entry
matters most for anyone reading this file.

## Agent

A **support team member**: a host user whose identity came back with
`isAgent: true`. Their first request writes an `agent` row keyed by the
host's user id. Agents use the agent UI (`HelpdeskAdmin`, "the admin"),
answer conversations and own deals. **An agent is never an AI.** AI is the
optional `ai` adapter, and what it produces is a **suggestion**
(`aiSuggestion`: a triage of type, priority, title and likely duplicates that
an agent accepts or dismisses) or a **draft** reply an agent may send. In
prose about this repository, the software doing the coding is "an assistant"
or "a coding agent", never "an agent".

## Host, identity, visitor, customer

- The **host** is the Next.js app the package is mounted in. It owns users,
  sessions and organisations. `identify(request)` turns a host request into
  an `Identity`: a `user`, the `orgs` they belong to, and `isAgent`. From
  another origin the host signs an **identity token** (HS256 JWT) instead;
  a token never grants the agent UI.
- An **identity** row is one way we know a person: a `channel` (`host`,
  `email`, `visitor`, `github`), the id in that channel, and whether it is
  `verified`. A contact can have several.
- A **visitor** is an anonymous widget user, known only through a `visitor`
  identity. A **customer** is anyone on the widget side, signed in or not.

## Contact, company, participant

- A **contact** is a person. A **company** is an organisation, mapped to a
  host org by `externalOrgId`. Both carry a `leadStage`, `tags` and `custom`
  field values; this is the CRM.
- A **participant** is a contact on a conversation. A conversation belongs
  to its contact; `sharedWithCompany` lets other contacts of the same
  company see and join it.

## Conversation

The unit of support work. The README calls the feature ticketing; the code
says **conversation**. Each has:

- A **reference**, `PREFIX-number` such as `ACME-1042`, from
  `referencePrefix` and a sequence that starts at 1000. Customers and emails
  go by it.
- An **inbox**, a key of `config.inboxes` (`support`, `sales`). The inbox
  config decides whether anonymous visitors may write (`public`) and from
  which origins, the reminder delay, and the widget's title and reply
  promise. "Inbox" also names the agent UI screen that lists conversations.
- A **type** (`question`, `bug`, `feature`, `lead` by default; hosts add
  their own), a **status** and a **priority** (`low`, `normal`, `high`,
  `urgent`). The statuses read from the customer's side: `open` is "with
  our team", `pending` is "awaiting your reply", `resolved` is done.
- A **subject**, what the customer called it and the only name they ever
  see, and a **title**, the team's name from triage or a rename, which
  agents see first.
- **Tags**, free text the team adds, lower-cased and unique per
  conversation; the inbox filters by one.
- **Messages** by a `contact`, an `agent` or the `system`. An **internal**
  message is a note only agents see. **Attachments** go to the storage
  adapter; the package stores keys and metadata.
- **Waiting**: `waitingSince` is set while the last word is the customer's.
  Once it is older than the inbox's `reminderAfterHours`, an
  `agent-reminder` email goes to the agents, once (`remindedAt`).
  `customerSeenAt` records what the customer has read, so a `notify-customer`
  job can skip emailing a reply they already saw.
- **Context**: what the widget captured when the report was made (URL,
  viewport, locale, recent errors, referrer, UTM), plus whatever the host
  adds through `resolveContext`.

## Deal and activity

A **deal** is a company's: it moves through `dealStages`, has a value in a
currency and an owning agent, and losing the person leaves it without a
contact. An **activity** is a note, call, meeting or event logged against a
contact, company or deal. Lead stage is on the person or company, deal stage
is on the deal; they are different ladders.

## Email

- **Outbound** goes through the host's `email.send` adapter as one of four
  `HelpdeskEmail` kinds: `customer-reply`, `customer-receipt` (the
  acknowledgement a visitor gets when the inbox has `receipt`), `agent-new`
  and `agent-reminder`.
- **Inbound** arrives when a **relay** (any forwarder; `relays/` has a
  Cloudflare Email Worker) POSTs the raw message to `{basePath}/inbound/`
  with `inboundWebhookSecret`. `src/inbound/` parses it and checks DKIM;
  `verified` means the From domain signed it. A reply finds its
  conversation by the message ids in `In-Reply-To` and `References`, or by
  the plus-addressed reference (`support+ACME-1042@…`) that
  `replyToAddress` put into the Reply-To.

## Jobs and retention

A **job** is queued work in the `job` table, run by a handler keyed on its
`kind`. `helpdesk.runJobs()` on the host's schedule, or
`POST {basePath}/jobs` with `jobsSecret`, first sends due reminders, then
applies **retention** (resolved conversations are deleted `retentionDays`
after resolution), then works through due jobs within a time budget.

## Widget and admin

Two UIs over one API client (`src/ui/api.ts`):

- The **widget** is `<helpdesk-widget>`, a launcher and panel in a shadow
  root; `HelpdeskWidget` wraps it for React and `widget.js` is the
  standalone build. It talks to the `widget/*` routes, cross-origin when the
  inbox lists the origin in `allowedOrigins`.
- The **admin** is `HelpdeskAdmin`, the agent UI, which the host renders
  under its own `basePath` and which talks to `agent/*`. `adminUrl` is its
  absolute URL: agent emails link to it, and its origin is the one
  mutations must come from. A mismatch between `adminUrl` and the origin in
  the browser turns every reply into a 403.

## Canned reply, settings

A **canned reply** is a saved answer agents insert. **Settings** are the few
values agents change in the admin, one JSON value per key in the `setting`
table.
