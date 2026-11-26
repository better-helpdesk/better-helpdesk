# Better Helpdesk in a Nuxt app

The helpdesk's handler is a plain `Request → Response` function, so it runs in
any framework that speaks web `Request`. This is the smallest Nuxt app that
shows it: the helpdesk routes under `/api/helpdesk`, the widget on the home
page, and the data in a SQLite file next to the app.

It installs `better-helpdesk` from npm, the way an app outside this repository
would, so it runs the published package rather than your edits to `src/`.

## Run it

You need Node 22.22.3 or newer, which Nuxt 4 asks for. From the repository
root:

```sh
pnpm install --filter better-helpdesk-nuxt
pnpm --filter better-helpdesk-nuxt dev
```

Open `http://localhost:3000` and send a message from the launcher. The server
creates `helpdesk.db` and migrates it before the first helpdesk request; look
at what the widget wrote:

```sh
sqlite3 examples/nuxt/helpdesk.db \
  "select number, inbox, type, subject from helpdesk_conversation"
```

The production build is a Node server from Nitro:

```sh
pnpm --filter better-helpdesk-nuxt build
PORT=3000 APP_URL=http://localhost:3000 pnpm --filter better-helpdesk-nuxt start
```

`APP_URL` is the URL the app is reached at: the handler refuses mutations from
any other origin, so a wrong one makes every widget message a 403. `PORT` and
`HOST` set where the server listens, and `HELPDESK_SQLITE` the database file.

## How it is wired

- **Builds the helpdesk** in `server/lib/helpdesk.ts`. Nuxt bundles `server/`
  for the server alone, so the database and the configuration never reach the
  browser. The module starts the migration once per server start and the
  route waits for it; on a server, run `better-helpdesk-migrate` as a deploy
  step instead.
- **Mounts the handler** in `server/api/helpdesk/[...path].ts`, a catch-all
  that receives every method under the base path. `toWebRequest(event)` turns
  the h3 event into the web `Request` the handler takes, and h3 sends the
  `Response` it returns as it is. `basePath` in the configuration must match
  the route.
- **Loads the widget** in `app/app.vue`: `onMounted` imports
  `better-helpdesk/widget` and defines `<helpdesk-widget>`, which the template
  already contains. `nuxt.config.ts` tells Vue that the tag is a custom
  element rather than a component to resolve. The widget is a web component
  built on React, which is why `react` and `react-dom` are dependencies of
  this app although no Vue component uses them.

## What is left out

- **Identity.** `identify` returns `null`, so everyone is an anonymous
  visitor. In your app, read your session from the `Request` (its cookies or
  headers) and return the signed-in user, with `isAgent: true` for your
  support team.
- **The agent UI.** `HelpdeskAdmin` is a React component, and this app renders
  Vue. Mount it in a small React app on the same origin, pointed at the same
  `/api/helpdesk`, or see `examples/astro`, which renders it as an island.
  Without it, the conversations are in the database but nobody can answer them.
- **Email, storage, AI and jobs**, which are optional adapters and routes;
  see the [documentation](https://better-helpdesk.com/docs).
