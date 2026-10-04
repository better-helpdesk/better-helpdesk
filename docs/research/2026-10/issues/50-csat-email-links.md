---
id: csat-email-links
epic: hours-feedback-reporting
wave: backlog
size: S
title: "feat(email): one-click rating links in the resolution email"
labels: enhancement, area: email, size: S, backlog
depends: [csat]
better_with: []
---
**Problem**

Customers who read the resolution by email never see the widget's rating prompt.

**Scope**

In: two signed links (good, bad) in the `customer-reply` email when the conversation was resolved, landing on a small HTML page under `basePath` that records the rating once and says thank you; signed with the identity-token pattern. Out: a comment form, surveys.

**Evidence**

Zendesk CSAT email 24 hours after Solved; Intercom email fallback after inactivity.
