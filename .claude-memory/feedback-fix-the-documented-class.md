---
name: feedback-fix-the-documented-class
description: "When my own audit documents a defect CLASS, fix every live instance before reporting done — twice in s172 I fixed one instance of a documented class and Jesse hit the rest in the wild"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a4e75970-b032-4d44-8df4-2a3591405cdc
  modified: 2026-08-10T11:38:32.766Z
---

Twice in one session (172) an audit I ran **documented a defect class**, I fixed **one instance**, reported the work done — and Jesse then hit the remaining instances browsing the real site:

1. The tools-chrome audit documented that tool tables clip at 431–900px (`overflow: hidden` wrappers / no wrappers). I wrapped only the Course Manager's tables. Jesse: "a lot is cut off" — the Programs, registrations, admin, and rotation tables were all still clipping.
2. The same report's root cause (no global border-box + `width:100% `+ padding) was a *class*; fixing the two containers Jesse screenshotted would have repeated the mistake — the deterministic sweep of all 98 backend `width:100%` rules found 14 more live instances.

**Why:** an audit finding phrased as a class ("tables clip between 431–900px") is a claim about every member of the class. Fixing the cited instance and shipping converts the audit from protection into false assurance — worse than not auditing, because "audited ✓" reads as "covered."

**How to apply:** when an audit (mine or a reviewer's) names a defect class, enumerate the class deterministically (grep/sweep all candidates), fix every live instance or explicitly list what's deferred and why, and only then report done. This extends [[feedback-pattern-audit]] (reviewer-flagged class → grep the whole codebase) to my own audit output. Related: [[project-css-no-global-box-sizing]] (the instance that taught it).
