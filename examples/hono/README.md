# Better Helpdesk in a Hono app

The helpdesk's handler is a plain `Request → Response` function, so it runs in
any framework that speaks web `Request`. This is the smallest Hono app that
shows it: the helpdesk routes under `/api/helpdesk`, the widget on the home
page, and the data in a SQLite file next to the server.

It installs `better-helpdesk` from npm, the way an app outside this repository
would, so it runs the published package rather than your edits to `src/`.

## Run it

You need Node 22.19 or newer, which runs `server.ts` without a build step.
From the repository root:

```sh
pnpm install --filter better-helpdesk-hono
pnpm --filter better-helpdesk-hono start
```

Open `http://localhost:3000` and send a message from the launcher. The first
start creates `helpdesk.db` and migrates it; look at what the widget wrote:

```sh
sqlite3 examples/hono/helpdesk.db \
  "select number, inbox, type, subject from helpdesk_conversation"
```

`PORT` changes the port, `APP_URL` the URL the app is reached at, and
`HELPDESK_SQLITE` the database file.

## How it is wired

`server.ts` does three things:

- **Mounts the handler.** `app.all('/api/helpdesk/*', c => helpdesk.handler(c.req.raw))`
  hands Hono's raw `Request` to the helpdesk and returns its `Response`.
  `basePath` in the configuration must match the path the routes are mounted
  under.
- **Serves the widget.** The published package ships `widget.js`, a standalone
  build of `<helpdesk-widget>` with React included. The handler does not serve
  it, so the app does, at `/widget.js`, and the page loads it with a script
  tag.
- **Migrates on start.** `migrate(db)` brings the SQLite tables up to date.
  On a server, run `better-helpdesk-migrate` as a deploy step instead.

## What is left out

- **Identity.** `identify` returns `null`, so everyone is an anonymous
  visitor. In your app, return the signed-in user from your session, with
  `isAgent: true` for your support team.
- **The agent UI.** `HelpdeskAdmin` is a React component, and this app renders
  no React. Mount it in a React page of your app, or in a small React app on
  the same origin, pointed at the same `/api/helpdesk`. Without it, the
  conversations are in the database but nobody can answer them.
- **Email, storage, AI and jobs**, which are optional adapters and routes;
  see the [documentation](https://better-helpdesk.com/docs).
