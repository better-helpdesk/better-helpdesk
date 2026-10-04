---
id: mentions
epic: team-collaboration
wave: 4
size: M
title: "feat(admin): @mention a teammate in an internal note and email them"
labels: enhancement, area: admin, area: email, size: M, wave 4
depends: []
better_with: [timeline]
---
**Problem**

"Can you look at this?" happens in Slack with a pasted link, and the context the widget captured stays behind. The colleague has no list of things waiting on them. This is the moment the "support inside your product" story leaks.

**Scope**

In:
- `POST conversations/:id/messages` gains `notify?: uuid[]` (agent ids, max 20).
- The composer's `/` picker pattern extended to `@`: inserts `@Name` as text and keeps the id in state.
- A fifth `HelpdeskEmail` kind `agent-mention` (`to, locale, reference, subject, body, url, authorName`), one per id, sent through the existing notify job path; an event `mentioned` when the timeline exists.
- README `HelpdeskEmail` section updated; `en` + `de`; integration test asserting one email per mentioned agent.

Out: a `mention` table, followers, a "Mentions" filter (the email is the inbox at this team size), team mentions, chips in the rich format (upgrade path: a `mention` node), in-app notifications.

**Acceptance**

- Integration suite green; the demo prints the mention email to the terminal.

**Evidence**

Zendesk @mentions make the agent a follower; Intercom "Mentions" inbox; Chatwoot `mentions` table and Participating view; Libredesk `conversation_mentions` and "{author} mentioned you in #{referenceNumber}".
