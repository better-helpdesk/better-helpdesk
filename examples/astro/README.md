# Better Helpdesk in an Astro app

The helpdesk's handler is a plain `Request → Response` function, so it runs in
any framework that speaks web `Request`. Astro also renders React components,
so this app shows the whole integration outside Next.js: the helpdesk routes
under `/api/helpdesk`, the widget on the home page, the agent UI at
`/helpdesk/`, and the data in a SQLite file next to the app.

It installs `better-helpdesk` from npm, the way an app outside this repository
would, so it runs the published package rather than your edits to `src/`.

## Run it

You need Node 22.23.4 or newer, which Astro 7 asks for. From the repository
root:

```sh
pnpm install --filter better-helpdesk-astro
pnpm --filter better-helpdesk-astro dev
```

Open `http://localhost:4321` and send a message from the launcher. Then press
**Sign in as an agent** and open the agent inbox at `/helpdesk/` to answer it.
The server creates `helpdesk.db` and migrates it on the first request; look at
what the widget wrote:

```sh
sqlite3 examples/astro/helpdesk.db \
  "select number, inbox, type, subject from helpdesk_conversation"
```

The production build is a Node server from `@astrojs/node`:

```sh
pnpm --filter better-helpdesk-astro build
PORT=4321 APP_URL=http://localhost:4321 DEMO_UNSAFE_AUTH=1 \
  pnpm --filter better-helpdesk-astro start
```

`APP_URL` is the URL the app is reached at: the handler refuses mutations from
any other origin. The sign-in button sets a cookie anyone could set, so the
build answers every request with an error until `DEMO_UNSAFE_AUTH=1` says you
mean it. `PORT` and `HOST` set where the server listens, and `HELPDESK_SQLITE`
the database file.

## How it is wired

- **Builds the helpdesk** in `src/lib/helpdesk.ts`, which migrates the
  database once per server start; on a server, run `better-helpdesk-migrate`
  as a deploy step instead. `identify` makes anyone with the `example-role`
  cookie an agent.
- **Mounts the handler** in `src/pages/api/helpdesk/[...path].ts`. Its `ALL`
  export receives every method under the base path and hands Astro's
  `request` to `helpdesk.handler`. `basePath` in the configuration must match
  the route. `output: 'server'` in `astro.config.mjs` renders every route on
  demand, and Astro's default `trailingSlash: 'ignore'` lets through the
  trailing-slash paths both UIs request.
- **Loads the widget** in `src/pages/index.astro`: a `<script>` that Astro
  bundles imports `better-helpdesk/widget` and defines `<helpdesk-widget>`,
  which the markup already contains.
- **Renders the agent UI** in `src/pages/helpdesk/[...slug].astro`:
  `HelpdeskAdmin` is a React component, rendered as an island with
  `client:only="react"` through `@astrojs/react`. The rest parameter serves
  the same page for the agent UI's own paths, such as
  `/helpdesk/conversations/…`, and the page checks the cookie too, so a
  visitor gets a notice instead of the agent UI's shell.
- **Signs in** in `src/pages/role.ts`, a form endpoint that sets or clears the
  cookie and goes back to the home page.

## What is left out

- **Real identity.** In your app, `identify` reads your session from the
  `Request` (its cookies or headers, as your middleware does) and returns the
  signed-in user, with `isAgent: true` for your support team. Drop the cookie
  and `DEMO_UNSAFE_AUTH` with it.
- **Email, storage, AI and jobs**, which are optional adapters and routes;
  see the [documentation](https://better-helpdesk.com/docs).
