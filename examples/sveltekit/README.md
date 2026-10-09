# Better Helpdesk in a SvelteKit app

The helpdesk's handler is a plain `Request → Response` function, so it runs in
any framework that speaks web `Request`. This is the smallest SvelteKit app
that shows it: the helpdesk routes under `/api/helpdesk`, the widget on the
home page, and the data in a SQLite file next to the app.

It installs `better-helpdesk` from npm, the way an app outside this repository
would, so it runs the published package rather than your edits to `src/`.

## Run it

You need Node 22.19 or newer. From the repository root:

```sh
pnpm install --filter better-helpdesk-sveltekit
pnpm --filter better-helpdesk-sveltekit dev
```

Open `http://localhost:5173` and send a message from the launcher. The first
request creates `helpdesk.db` and migrates it; look at what the widget wrote:

```sh
sqlite3 examples/sveltekit/helpdesk.db \
  "select number, inbox, type, subject from helpdesk_conversation"
```

The production build is a Node server from `@sveltejs/adapter-node`:

```sh
pnpm --filter better-helpdesk-sveltekit build
ORIGIN=http://localhost:3000 pnpm --filter better-helpdesk-sveltekit start
```

`ORIGIN` is the URL the app is reached at. The handler refuses mutations from
any other origin, so without it every widget message is a 403. `PORT` changes
the port and `HELPDESK_SQLITE` the database file.

## How it is wired

- **Builds the helpdesk** in `src/lib/server/helpdesk.ts`. SvelteKit keeps
  everything under `src/lib/server` out of client code, so the database and
  the configuration never reach the browser. `migrate(db)` runs when the
  module loads; on a server, run `better-helpdesk-migrate` as a deploy step
  instead.
- **Mounts the handler** in `src/routes/api/helpdesk/[...path]/+server.ts`.
  Its `fallback` export receives every method under the base path and hands
  SvelteKit's `request` to `helpdesk.handler`. `basePath` in the configuration
  must match the route. `trailingSlash = 'ignore'` keeps SvelteKit from
  redirecting the trailing-slash paths both UIs request.
- **Loads the widget** in `src/routes/+page.svelte`: `onMount` imports
  `better-helpdesk/widget` and defines `<helpdesk-widget>`, which the markup
  already contains. The widget is a web component built on React, which is
  why `react` and `react-dom` are dependencies of this app although no Svelte
  component uses them.

## What is left out

- **Identity.** `identify` returns `null`, so everyone is an anonymous
  visitor. In your app, read your session from the `Request` (its cookies or
  headers, the same way your `hooks.server.ts` does) and return the signed-in
  user, with `isAgent: true` for your support team.
- **The agent UI.** `HelpdeskAdmin` is a React component, and this app renders
  Svelte. Mount it in a small React app on the same origin, pointed at the
  same `/api/helpdesk`. Without it, the conversations are in the database but
  nobody can answer them.
- **Email, storage, AI and jobs**, which are optional adapters and routes;
  see the [documentation](https://better-helpdesk.com/docs).
