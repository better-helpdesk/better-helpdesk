# Roadmap

Written 5 October 2026. Better Helpdesk is a library that lives inside your
Next.js app, so what it leaves out matters as much as what it adds.

## What it will not do

- **Its own login, users table or SSO.** Your users are already signed in.
  An agent is whoever your app says is one, so there is no second user table
  to keep in sync and no seat to invite.
- **A hosted mode or a hosted relay.** It ships where your app ships: no
  second deploy to run and no data-processing agreement to sign, because we
  never see your data. The inbound relay is example code you deploy on your
  own account.
- **A second process, database or queue.** One `helpdesk` schema sits in the
  Postgres you already back up, and `runJobs()` runs on the scheduler you
  already have.
- **Social and messaging channels.** Email comes in through any relay that
  can POST a message, and the widget lives in your product. A WhatsApp poller
  would be a service running next to your app, for you to host and patch.
- **An AI that answers your customers.** AI triages and drafts for an agent;
  every reply a customer reads was sent by a person with a name.
- **Per-seat pricing or a gated feature.** It is MIT, all of it. You add the
  tenth agent the way you added the first: `isAgent: true`.
- **A rule builder or an SLA policy engine.** Your rules are code in your
  repository, reviewed in a pull request, on the events hook. You get one
  reminder threshold and one set of business hours per inbox, not a
  dropdown of conditions.
- **A hosted help centre.** Your docs already live in your app. The widget
  searches them through the help adapter and keeps no second copy.
- **API tokens or a public REST API.** Your app calls the helpdesk as a
  function, so there is no token to issue, rotate or leak. If you want HTTP,
  it is one route in your app, behind your own auth.

## Next

The design partners' feedback sets the order, so items move between waves.

### Wave 2: the data the inbox leans on (shipped)

- Tags, and an inbox filtered by tag
- Snooze until a time, woken by the jobs run or a customer reply
- A timeline of conversation events in the thread
- Open counts on the assignee tabs, and unread rows
- Customers can mark a conversation resolved from the widget
- An unsent draft kept per conversation across navigation
- Pasted code and captured errors shown as copyable code blocks

### Wave 3: working the queue

- Who else has a conversation open (shipped)
- Business hours per inbox (shipped)
- Bulk assign, status, priority and tags (shipped)
- Keyboard shortcuts with a `?` cheat sheet (shipped)
- A collapsible details sidebar (shipped)
- Status, priority, type, inbox and assignee as a properties card
- Clear pressed, sending and error states in the agent UI and the widget
- The reply and note switch placed first in the composer
- An accent colour and readable metadata in the widget
- The context review and the privacy line visible on the widget's first form

### Wave 4: bigger surfaces

- A list and thread side by side on wide screens
- Merge a duplicate conversation into another
- @mention a teammate in an internal note (shipped)
- A rating after resolution, shown in the agent UI
- An overview of volume, first-response and resolution times
- Open the next conversation after sending

### On request

Built when a team running Better Helpdesk asks for it:

- Saved views, personal or shared
- "Seen" under the customer's last message
- An in-app notification bell
- CSV import of contacts, companies and canned replies
- Deep links into your app from the contact and company cards
- References like `ACME-1042` linked in notes and replies
- Shorten, formalise and translate a draft through the AI adapter
- A full-page conversations component for an in-app Support page
- A public demo with a scheduled reset
- Blocking a sender from a public inbox
- One-click rating links in the resolution email
