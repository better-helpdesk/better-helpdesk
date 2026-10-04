# Better Helpdesk: working in this repository

Better Helpdesk is an npm package (`better-helpdesk`, MIT) that puts a support
inbox, ticketing and a lightweight CRM inside a host's Next.js app: one route
handler, one React component for the agent UI, one widget, and a `helpdesk`
schema in the host's own Postgres. It is a library the host mounts, never a
service the host runs next to its product. `docs/product.md` has the
positioning and the stage the project is at. `CONTEXT.md` has the words; read
it before touching `src/`, starting with the first entry: an *agent* is a
support team member here, never an AI.

## The architecture is settled

The repository as it stood on 28 September 2026 is the architecture. Extend
it; do not re-platform it, and do not add a second way of doing something the
code already does. Concretely:

- **Embedded, Next.js first.** The handler is a plain `Request → Response`
  function (`src/http.ts`), so adapters for other frameworks may come later,
  but the embedded model is not up for discussion. The core never imports
  Next: Biome fails the build on it, and `next.mjs` is the one file allowed
  to.
- **TypeScript strict, ESM, Node 20 or newer, React 19** for the agent UI and
  the widget alike. pnpm with a frozen lockfile.
- **Postgres only, and Drizzle owns the schema.** Tables live in
  `src/db/schema.ts` under the `helpdesk` schema. Migrations are SQL that
  `pnpm db:generate` writes into `migrations/` and `better-helpdesk-migrate`
  (`bin/migrate.mjs`) applies. A schema change is: edit `schema.ts`, run
  `pnpm db:generate`, commit the generated SQL and snapshot untouched, run
  the integration tests. Hand-written or hand-edited migration SQL is a bug.
- **Four runtime dependencies**: `drizzle-orm`, `zod`, `mailparser`,
  `mailauth`. Adding one needs a stated reason in the PR and an
  MIT-compatible licence (MIT, BSD, Apache 2.0, ISC).
- **Everything optional is an adapter.** Storage, email, inbound email, AI,
  help search and jobs are interfaces in `src/config.ts` that the host
  implements. A new capability takes the same shape: an optional field on
  `HelpdeskConfig`, nothing the package runs or hosts itself.
- **The host owns identity.** Better Helpdesk stores no passwords and no
  sessions. It takes the host's `identify(request)` or a signed identity JWT
  (`src/identity-token.ts`), and `isAgent` on that identity is the only
  thing that grants the agent UI.
- **The widget is a web component**, `<helpdesk-widget>` in
  `src/widget/element.tsx`, with a shadow root and a React wrapper. Theming
  happens only through `--helpdesk-*` CSS custom properties; the styles are
  the CSS strings in `src/widget/styles.ts` and `src/admin/styles.ts`.
- **English and German.** Every user-facing string is a key in
  `src/ui/i18n.ts` with both languages. The `de` table is typed against the
  `en` keys, so a missing or extra translation fails `tsc`. German is Swiss
  Standard German (`ss`, never `ß`) and addresses the reader as "Sie".

## Off-limits

- Pushing to `main`, or pushing a tag, without the maintainer's explicit
  approval in the current conversation.
- Anything that makes Better Helpdesk its own instance: a standalone server,
  a Docker image run beside the app, a hosted or cloud mode, its own login,
  its own database. Swapping Drizzle or adding a second ORM.
- Changing `.github/workflows/ci.yml`, `release.yml` or the npm publishing
  setup outside a PR the maintainer approved.
- Secrets or tokens anywhere in the repository or in CI configuration.
  Publishing uses npm trusted publishing (OIDC), so none is needed.
- Data from the design-partner companies in tests, fixtures, issues or PRs.
  Fixtures use invented people on `.test` domains, as `test/harness.ts` and
  the demo do.

## Map

- `src/config.ts`: `HelpdeskConfig`, the adapter interfaces, and the defaults
  (`STATUSES`, `PRIORITIES`, `DEFAULT_TYPES`, the stages).
- `src/http.ts`: every route under `basePath`, in four groups: `widget/*`
  for visitors and customers, `agent/*` for the agent UI, `inbound` for the
  email relay webhook, `jobs`. Also CORS and the same-origin check on
  mutations.
- `src/service.ts`: the behaviour (conversations, emails, reminders, jobs,
  retention). `src/db/store.ts`: the queries, over `src/db/schema.ts`.
- `src/admin/`: the agent UI, `HelpdeskAdmin`. `src/widget/`: the widget.
  `src/ui/`: shared i18n, the API client and rich text.
- `src/inbound/`: parsing and DKIM verification of inbound email. `relays/`:
  an example relay (a Cloudflare Email Worker) that forwards to `/inbound`.
- `test/`: integration tests against a real Postgres through
  `createHarness`. Unit tests sit next to their source as `*.test.ts(x)`.
- `examples/demo`: "Harbor", a Next.js app with the package installed the
  way the README describes; its README says how to run it. It is a workspace
  package, so a root `pnpm install` also downloads its Next.js, which is why
  CI installs with `--filter better-helpdesk`. CI builds the demo against
  the packed tarball on the current and the previous Next.js major.
- `scripts/build.mjs`: the esbuild and `tsc` build that `pnpm pack` runs.
  The published entry points are `package.json`'s `publishConfig.exports`.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm lint                 # Biome, then tsc --noEmit; CI runs this first
pnpm test                 # unit tests
TEST_DATABASE_URL=postgres://postgres@localhost:5432/db pnpm test:integration
```

The integration tests create a `helpdesk_test` database next to the one the
URL names and migrate it; a `postgres:18-alpine` container started with
`POSTGRES_HOST_AUTH_METHOD=trust` is enough. Green means all three passed.
When a change touches `package.json` exports, `scripts/build.mjs` or `bin/`,
also do what CI's smoke test does: `pnpm pack`, then `npm install` the
tarball into a scratch directory outside the repository and import it.

## How work is done

- **Quality over speed.** There is no deadline and no release cadence; a
  release ships when it is ready. When the two conflict, quality wins.
- **Green CI is the bar for every PR**: lint, unit tests, integration tests,
  the tarball smoke test and the demo build.
- **Tests assert outcomes**: the response, the rows in the test database, the
  rendered output, the email the fake adapter received. A test that only
  checks what was called proves nothing. UI tests put
  `// @vitest-environment jsdom` at the top of the file; the default
  environment is node.
- **Comments default to none.** One earns its line by carrying intent, a
  rationale or a trap the code cannot show, in a line or two. Delete a
  comment that restates the code, and delete a wrong one rather than reword
  it. Never write a claim the code does not enforce: no counts, no
  measurements, no "the only place that".
- **Commit messages** take the conventional form the history uses
  (`fix(widget): …`, `feat(examples): …`, `ci(release): …`,
  `docs(readme): …`), with a subject that describes the behaviour change.
- **PR titles become the release notes.** `release.yml` lists the titles of
  the pull requests merged since the previous tag, so write a title that
  reads as a changelog line.
- **Dependencies** move through `pnpm add` and `pnpm up` so the lockfile
  moves with them. `pnpm-lock.yaml` is never edited by hand or deleted.
- **A release** is a version bump PR, then a `vX.Y.Z` tag on `main` that
  equals `package.json`'s version. `release.yml` publishes to npm with
  provenance and creates the GitHub Release. The tag push needs the
  maintainer's approval.
