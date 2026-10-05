# Switching from another helpdesk

This guide moves a support team from Intercom, Zendesk, a shared Gmail inbox
or Chatwoot to Better Helpdesk. It assumes the
[Quickstart](../README.md#quickstart) is done: the handler is mounted, the
agent UI renders and inbound email is configured as in
[Email](../README.md#email).

Better Helpdesk does not import conversation history. What moves over is
contacts, companies and saved replies; the history stays readable in the old
tool for as long as you keep it.

## Run the two tools side by side

Pick a cutover date. From that date every new conversation starts in Better
Helpdesk, and the old tool stays open read-only for 60 to 90 days, so an
agent can look up what a customer said last month. Once support@ points
here, a reply to an old thread arrives as a new conversation; the earlier
messages are in the old tool.

## Import contacts, companies and saved replies

The agent routes that the agent UI uses also take imports. Open the agent
UI, signed in as an agent, and run a loop over your export in the browser
console. With the default `basePath`:

```js
const post = (path, body) =>
  fetch(`/api/helpdesk/agent/${path}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());

// rows parsed from your export
for (const row of companies) {
  const { company } = await post('companies', { name: row.name, domain: row.domain });
  row.id = company.id;
}
for (const row of contacts) {
  await post('contacts', {
    name: row.name || row.email,
    email: row.email,
    companyId: companies.find(c => c.name === row.company)?.id,
  });
}
for (const row of macros) {
  await post('canned', { title: row.title, body: row.body });
}
```

A contact needs a `name`; `email`, `companyId` and `leadStage` are optional.
A saved reply takes a `title`, a `body` and an optional `locale` (`en` or
`de`). In a saved reply, `{firstName}` and `{reference}` are filled in when
an agent inserts it, so rewrite the old tool's placeholders to those two.

An imported contact is not linked to anyone's login. When the same person
later writes in or signs in, they may arrive as a second contact; open the
older one and use **Merge another contact into this one**.

## From Intercom

1. Export contacts from Intercom as CSV and import them as above.
2. Copy the macros you still use into a CSV (title, body), replace `{{first_name}}` with `{firstName}`, and import it
   as saved replies.
3. Re-point support@ from Intercom's forwarding address to your relay
   ([recipes](../relays/README.md)).
4. Replace the Messenger script with [the widget](../README.md#the-widget).
5. Where your backend signed `user_hash` for identity verification, sign an
   identity token instead and pass it to the widget, as in
   [Signed-in users on another origin](../README.md#signed-in-users-on-another-origin).
   When the widget runs inside your own app, `identify` reads your session
   and no token is needed.

## From Zendesk

1. Export users and organizations through Zendesk's data export or the
   Users and Organizations APIs, and import them as contacts and companies.
2. Fetch macros through the Macros API and import their comment text as
   saved replies. Replace `{{ticket.requester.first_name}}` with
   `{firstName}` and `{{ticket.id}}` with `{reference}`.
3. Re-point support@ from Zendesk's support address to your relay
   ([recipes](../relays/README.md)).
4. Customers and agents keep quoting a ticket number: every conversation has
   a reference such as `ACME-1042`, built from `referencePrefix`, in the
   receipt, the reply subjects and the agent UI.

## From a shared Gmail inbox

1. There is nothing to import; the mail stays in Gmail.
2. For the side-by-side weeks, add the Gmail routing rule from
   [the Google Workspace recipe](../relays/README.md#google-workspace), which
   delivers support@ to Gmail as before and also to your relay. Both get
   every message.
3. From the cutover date the team answers in Better Helpdesk only and stops
   replying from Gmail, so no customer gets two answers. Once the weeks are
   over, cut over as the recipe describes.

## From Chatwoot

1. Chatwoot runs on Postgres too, so contacts can be read straight from its
   tables and imported as above.
2. Importing Chatwoot conversations is planned but not built; ask on the
   issue tracker if you need it.
3. Re-point support@ from Chatwoot's email inbox to your relay, and replace
   the Chatwoot widget script with [the widget](../README.md#the-widget).
4. Where your backend computed `identifier_hash`, sign an identity token
   instead, as in
   [Signed-in users on another origin](../README.md#signed-in-users-on-another-origin).
