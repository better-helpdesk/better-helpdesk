# Security policy

Better Helpdesk stores customer email, conversations and contact details in
the host's database, so we treat a vulnerability report as the most urgent
thing in the issue tracker.

## Supported versions

The project is at 0.x. Security fixes go into the latest minor release only,
as a patch release on it. Upgrade to the latest `0.x` to receive them.

## Reporting a vulnerability

Please do not open a public issue, discussion or pull request.

Report it privately through
[GitHub's private vulnerability reporting](https://github.com/better-helpdesk/better-helpdesk/security/advisories/new).
Include the version, the affected route, component or adapter, the steps to
reproduce, and what an attacker gains. A proof of concept against the demo
in `examples/demo` or a local install is ideal; please do not test against
someone else's deployment.

## What happens next

- We confirm that we received the report and ask any questions in the
  private advisory.
- Once the problem is confirmed, we fix it in a private fork of the advisory
  and agree on a disclosure date with you.
- The fix ships as a patch release, and the advisory is published with it,
  with a CVE when one applies. We credit you unless you ask us not to.

## Scope

In scope is the `better-helpdesk` package: the route handler, the agent UI,
the widget, inbound email parsing and verification, the built-in database
adapters, the migrations and the CLIs.

Out of scope is code the host writes and owns: its `identify` function, its
session handling, and the storage, email, AI or help-search adapters it
implements. The example relay in `relays/` and the demo in `examples/demo`
are examples; report a flaw in them all the same if a host copying them
would inherit it.
