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

Export what you have as CSV and run the import CLI against the same database
as the migrations:

```sh
HELPDESK_DATABASE_URL=postgres://… npx better-helpdesk-import contacts people.csv
HELPDESK_DATABASE_URL=postgres://… npx better-helpdesk-import canned replies.csv
```

It prints how many rows it created, updated and left alone, and a line for
each value it had to leave out. Column names are read without regard to
case, and a header row is required. A quote that is never closed stops the
import with its line number, before anything is written.

- **Contacts** need an `email`; `name`, `tags` (separated by `;` or `|`) and
  `lead_stage` are optional. A lead stage must be one of the stages the
  agent UI knows, in any case: the defaults (`lead`, `qualified`,
  `customer`, `churned`), or, if you set `leadStages`, the same list as
  `--lead-stages Lead,Trial,Customer`; it is stored as the list spells it. Tags longer than 50 characters and
  names longer than 200 are left out, as the agent UI would refuse them.
- **Companies** come from the same file: a row with a `domain` joins the
  company with that domain, and a row with only a `company` joins the
  company with that name. A missing company is created; an existing one is
  never renamed, and only gains a domain it did not have. A name or domain
  longer than 200 characters is left out.
- **Saved replies** need a `title` of at most 200 characters and a `body` of
  at most 20,000; `locale` (`en` or `de`) is optional. In a saved reply, `{firstName}` and `{reference}` are filled in
  when an agent inserts it, so rewrite the old tool's placeholders to those
  two.

Running it again is safe, also after agents have started working. A contact
whose email is already known, from an earlier import or because the person
already wrote in, only gains what it lacks: empty fields are filled and
tags are added, and nothing an agent changed is undone. A saved reply whose
title and locale exist is left alone. So fix the export and run the whole
file again.

An imported contact is not linked to anyone's login. When the same person
later writes in or signs in, they may arrive as a second contact; open the
older one and use **Merge another contact into this one**.

## From Intercom

1. Export contacts from Intercom as CSV and import them as above.
2. Copy the macros you still use into a CSV (title, body), replace
   `{{first_name}}` with `{firstName}`, and import it as saved replies.
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
