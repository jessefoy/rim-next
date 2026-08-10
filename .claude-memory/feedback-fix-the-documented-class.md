---
name: feedback-fix-the-documented-class
description: "When my own audit documents a defect CLASS, fix every live instance before reporting done — and \"I can't verify it from here\" is a reason to build a harness, not to defer; Jesse will just ask for the deferred items"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a4e75970-b032-4d44-8df4-2a3591405cdc
  modified: 2026-08-10T18:11:58.367Z
---

Twice in one session (172) an audit I ran **documented a defect class**, I fixed **one instance**, reported the work done — and Jesse then hit the remaining instances browsing the real site:

1. The tools-chrome audit documented that tool tables clip at 431–900px (`overflow: hidden` wrappers / no wrappers). I wrapped only the Course Manager's tables. Jesse: "a lot is cut off" — the Programs, registrations, admin, and rotation tables were all still clipping.
2. The same report's root cause (no global border-box + `width:100%` + padding) was a *class*; fixing the two containers Jesse screenshotted would have repeated the mistake — the deterministic sweep of all 98 backend `width:100%` rules found 14 more live instances.

**Why:** an audit finding phrased as a class ("tables clip between 431–900px") is a claim about every member of the class. Fixing the cited instance and shipping converts the audit from protection into false assurance — worse than not auditing, because "audited ✓" reads as "covered."

**The deferral clause is narrower than I read it (session 173).** I enumerated 18 further candidates, deferred all of them as unmeasurable-behind-login, wrote them to the backlog, and reported done. Jesse's next message: *"Can you address the things that you found?"* The answer wasn't blind-patching (that would have violated [[feedback-visual-bugs-verify]]) and it wasn't deferring — it was **getting evidence a different way**, by rebuilding each candidate's real ancestor chain in a harness on the production origin. That found 3 real bugs among 15 false positives, including two that `border-box` wouldn't have fixed at all.

**How to apply:** when an audit (mine or a reviewer's) names a defect class, enumerate the class deterministically, then **measure** each candidate — a pattern match is not a finding. Fix every live instance. Reserve deferral for work genuinely blocked *on Jesse* — his dashboards, his data, his eyes on behavior — not for work that is merely awkward for me to reach; if the obstacle is "I can't see it," build the harness first. When something truly is deferred, record the method alongside it so the next session doesn't re-derive it. Extends [[feedback-pattern-audit]] to my own audit output; the how-to-measure half lives in [[feedback-visual-bugs-verify]]. Related: [[project-css-no-global-box-sizing]] (the instance that taught it), [[feedback-verified-safe-cleanup]] (Jesse delegates whole verified sets; the condition is evidence, not permission).
