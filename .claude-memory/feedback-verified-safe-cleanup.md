---
name: feedback-verified-safe-cleanup
description: "Session 171: Jesse green-lights broad cleanup/optimization — including auth-behavior changes — when every item carries verified evidence, and welcomes proactive discovery of adjacent staleness beyond the asked scope. His condition is integrity, not caution: 'make sure we're not breaking any of the integrity.'"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4191d0e2-2a15-4ac6-b38f-562c72d6ecc2
  modified: 2026-08-09T15:42:31.032Z
---

In the session-171 optimization pass (a `/doctor` run that grew into a
whole-system hygiene session), Jesse accepted every recommended action —
disabling unused extensions, deleting spent docs and merged branches, a
1,700-line UP_NEXT trim, a 330-rule CSS prune, and an auth-behavior change
(ACTIVE-only coordinator authority) — and at each widening said yes: *"wow,
can you go through these?"*, *"Anything else to optimize?"*, *"If you feel
like it's safe to address all of these, please do."* His one condition:
*"just make sure we're not breaking any of the integrity."*

**Why:** every proposal carried its evidence in hand — lifetime usage
counters, merge-ancestry checks, zero-reference greps, session-log coverage
verified before trimming, doc-backed precedent for the auth change, and an
adversarial reviewer gate on each round. The delegation was to *verified*
judgment, not to enthusiasm; and discoveries beyond the asked scope
(stale docs contradicting reality, my own stale memory, the 17-vs-6 callsite
class) were welcomed, not treated as creep.

**How to apply:** on cleanup/optimization work, (1) proactively sweep for the
*class* of rot, not just the cited instance ([[feedback-pattern-audit]]);
(2) attach the verification to each item and act on the verified set without
re-asking per item — reserve questions for genuine policy calls (the
`effectiveCoordinator` status question was correctly parked as backlog
`2026-08-08-005` rather than decided); (3) gate each round with
[[feedback-reviewer-subagent]] and report reviewer nuances honestly. Extends
[[feedback-full-fix-when-verified]] from single fixes to whole passes.
