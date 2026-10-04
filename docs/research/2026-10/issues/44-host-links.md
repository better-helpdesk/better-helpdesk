---
id: host-links
epic: host-integration
wave: backlog
size: S
title: "feat(config): host deep links in the contact and company cards"
labels: enhancement, area: config, size: S, backlog
depends: []
better_with: []
---
**Problem**

The support person wants one click from the contact card to the host app's own customer page, Stripe or the CRM.

**Scope**

In: `links?(contact, company): { label: Record<Locale, string>; url: string }[]` on `HelpdeskConfig`, returned by the detail route, rendered under the contact card. Out: anything the host cannot express as a URL.

**Evidence**

Libredesk "Context links" (Stripe customer, HubSpot contact); for an embedded library the host already knows its own URLs.
