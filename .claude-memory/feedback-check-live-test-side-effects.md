---
name: feedback-check-live-test-side-effects
description: "Before testing a schedule action on production, trace what doing AND undoing it sends (taking someone off a session within two weeks emails the whole team); ask how to test."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f46f68c1-e2ec-44ff-8d13-7765d7f83aa2
  modified: 2026-10-20T19:28:16.575Z
---

Before a live test on rim-next.vercel.app that changes the schedule (take, cancel, remove, rotation), trace the side effects of both the action and its undo, and put the choice to Jesse before acting.

**Why:** 2026-10-20 Jesse asked me to take a Dummy Test Program session from Updates and then take him off it. Taking him off a session within two weeks would have emailed the whole Hosting Team "needs a host" (the coverage gap notice). I checked first and offered "take it, keep me on"; he chose that. The Dummy Test Program was already causing the team angst with messages.

**How to apply:** for any production test, list who gets emailed or notified by each step (lib/coverageNotices.ts gap notices, confirmation and removal emails, Notifications), then ask with the least noisy option first. Related: [[project-prod-db-ops]], [[feedback-verify-state-not-docs]].
