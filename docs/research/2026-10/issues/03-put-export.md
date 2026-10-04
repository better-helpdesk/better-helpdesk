---
id: put-export
epic: launch
wave: 1
size: S
title: "fix(docs): export PUT from the route handler in the README and the demo so settings can be saved"
labels: bug, area: docs, area: examples, size: S, wave 1
depends: []
better_with: []
---
**Problem**

`src/http.ts` defines `PUT agent/settings`, but the README's route snippet and `examples/demo/app/api/helpdesk/[...slug]/route.ts` export only GET, POST, PATCH, DELETE and OPTIONS. Every host that follows the README gets a 405 from Next.js when an agent saves the confirmation text in Settings.

**Scope**

In:
- Add `handle as PUT` to the README snippet and the demo route.
- A CI smoke step or integration check that saves a setting through the demo route (the `example` job already drives the demo; add the Settings save to it).

Out: changing the route to PATCH (would break hosts that already added PUT).

**Acceptance**

- Saving the confirmation text in the demo's Settings page succeeds.
- The demo CI job exercises it.

**Evidence**

Found by the engineering feasibility pass while tracing `agentRoute('PUT', 'settings')` against both route exports.
