---
id: merge-conversations
epic: inbox-workflow
wave: 4
size: M
title: "feat(admin): merge a duplicate conversation into another"
labels: enhancement, area: admin, size: M, wave 4
depends: []
better_with: [timeline]
---
**Problem**

The same customer writes by email and then in the widget, or twice by email. The AI suggestion already says "possible duplicate of ACME-1041", but the only action is to resolve one by hand and lose its messages. Merging is Libredesk's most-voted open request and standard in the other three.

**Scope**

In:
- `merged_into_id uuid` (FK conversation, set null) on `conversation`; one generated migration.
- `POST agent/conversations/:id/merge { targetId }` in one transaction: move `message` and `attachment` rows to the target, insert the source contact as a participant of the target (`ON CONFLICT DO NOTHING`, so `canCustomerSee` holds), set the source `resolved` with `resolvedAt` and `mergedIntoId`, record one event on each side when the timeline exists.
- `handleInbound` follows `mergedIntoId` once after `getConversationByNumber` for plus-addressed replies; Message-Id threading needs no work (it follows the moved message's `conversationId`).
- Admin: "Merge into…" with reference search, prefilled from the AI duplicates when present; a confirm that warns when the contacts differ; the source page shows a banner linking to the target.
- `en` + `de`; integration test for messages, attachments, participant and the inbound redirect.

Out: bulk merge, unmerge, merging a merged conversation (refused), source = target (refused).

**Trust and data loss**

Irreversible. Refuse when either side is already merged. Retention later deletes the resolved source, which ends the redirect; its messages already live on the target.

**Acceptance**

- Integration suite green with the refusal cases.
- Screenshot of the merge dialog and the source banner.

**Evidence**

Zendesk "Merge into another ticket" (warns on different requester, `closed_by_merge`); Intercom merge suggestions (September 2026); Libredesk issue #177 (+11, unbuilt).
