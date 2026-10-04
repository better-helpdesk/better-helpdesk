## What the four products are in October 2026

**Zendesk.** Private-equity owned, about $2B ARR, sold as a "Resolution Platform" for mid-market and enterprise support operations. Per agent, billed yearly: Support Team $19, Suite Team $55, Suite Professional $115, Enterprise on request; Copilot is another $50 per agent and automated resolutions cost $1.50 to $2.00 each. Sell, its CRM, is retired on 31 August 2027. Trustpilot sits at 1.8 of 5, mostly about Zendesk's own support and billing. SLAs and CSAT need the Growth tier or above.

**Intercom.** Renamed itself Fin on 12 May 2026 and agreed to be acquired by Salesforce for about $3.6B on 15 June 2026 (signed, not closed). About $400M ARR; Fin, the AI agent, is sold per resolution and is the growth engine. Seats from $29 to $139 per month; Copilot $29 to $35 per seat; EU data residency only on Advanced or Expert annual plans via sales and a workspace cannot move regions. The per-seat helpdesk's long-term fate under Salesforce is unstated.

**Chatwoot.** Rails 7.2 plus Vue 3, about 37k stars, MIT core with an Enterprise edition that gates SLA, audit logs, custom roles and Captain AI. Needs Postgres, Redis and Sidekiq. 2026 releases are dominated by WhatsApp (Cloud API, templates, calling, campaigns); v4 added the "Captain" AI layer and an Inbox view. Users praise the breadth and complain about upgrades, resource use and gated features.

**Libredesk.** Go single binary plus Postgres and Redis, AGPL, about 3k stars, one author working evenings and weekends with 2,277 of 2,520 commits. Email first; live chat arrived 14 months after launch; WhatsApp shipped in 2026. Deliberate scope: no hosted mode, no customer portal as a separate app, locked default statuses. Its most-voted open request is merging conversations; a 20-comment thread asks for customers to see their past tickets, which Better Helpdesk already has through the host session.

## Where the seven views converge

Every analyst was given the same inventory and the same architecture limits and asked for ten work items. The items below were named independently by the number of reports shown; the count is the strongest signal in this research.

| Gap | Named by | Reports' verdict |
|---|---|---|
| Conversation tags with an inbox filter | 6 of 7 | table-stakes in every competitor report |
| Snooze with a timed wake-up | 5 of 7 | table-stakes |
| Events hook the host handles in-process | 6 of 7 | the one feature marketing would hold the launch for |
| Conversation event timeline (who changed what) | 6 of 7 | expected; cheap once events exist |
| Collision indicator ("Lea has this open") | 6 of 7 | the first week-one complaint from a two-person team |
| @mentions in internal notes | 5 of 7 | the moment escalation leaks to Slack |
| Business hours that the waiting colours, reminders and widget respect | 5 of 7 | "everything is red on Monday" |
| Bulk actions on the inbox list | 4 of 7 | spam bursts, outages |
| Keyboard shortcuts beyond j/k, with a cheat sheet | 4 of 7 | small, agent-facing |
| Overview page or SQL views for first response, resolution, volume | 5 of 7 | the founder's month-one question |
| CSAT rating after resolve | 4 of 7 | expected; marketing and sales say let a partner ask first |
| Reopen a resolved conversation on a customer reply | 2 of 7 | a correctness gap, cheap |
| Open counts on Mine / Unassigned / All | 3 of 7 | small |
| Merge two conversations | 3 of 7 | Libredesk's top request; AI already finds duplicates |
| Saved views | 3 of 7 | expected later |
| Launch surface: public demo, README screenshots, worked adapters, inbound email recipes, CSV import, roadmap with non-goals, comparison table | marketing and sales | launch-blocking; the other five were not asked |
| Admin craft: split list and thread, properties card, collapsible aside, skeletons, empty states, pressed and error states, token-derived radii; widget accent and fold fixes | UX review | Preserve mode; keep the IA, raise the craft |

## What every view says not to build

Social and messaging channels, a help-centre CMS, an AI that answers customers, a visual rule builder, an SLA policy engine with calendars, roles beyond `isAgent`, multi-brand, campaigns and surveys, an own login, a hosted mode or hosted relay, API tokens, a mobile app, a second process. Live chat with typing indicators stays out: polling plus an honest reply promise is the pitch, and marketing asks that the word "live chat" never appears in copy. Nothing gets gated.
