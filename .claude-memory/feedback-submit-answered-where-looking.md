---
name: feedback-submit-answered-where-looking
description: "Every submit/save on any RIM surface must be answered visibly where the person is looking — confirmation scrolled into view, errors beside the button, nothing silent; prefill known member data"
metadata:
  node_type: memory
  type: feedback
  originSessionId: bcdfb916-cd56-4617-8ef1-8e84811b4612
  modified: 2026-10-13T21:59:30.960Z
---

Every form submit or save, on every surface (public, member, team, tool), must answer where the person is looking: the success message comes to them (scrolled into view, focused, role=status, not a 3-second flash), problems appear beside the button pressed (role=alert), the button shows "Sending…", and nothing fails silently. Signed-in forms prefill what RIM knows (first/last name, email, phone). Shared component: `components/FormDone.tsx` (+ `FormProblem`). Rule text lives in `RIM_Web_Design_Philosophy.md` → Forms as thresholds.

**Why:** 2026-10-13 Jesse sent the volunteer form; the page reloaded at the top while the thank-you sat far below, and last name wasn't prefilled. "We're designing for non-tech-savvy folks. This rule should apply across the board."

**How to apply:** when building or touching any form/save, check where success and error render relative to the button and viewport, and whether a failure is visible. When a pass finds the class, fix every instance (see [[feedback-fix-the-documented-class]]). Related: [[design-principles]], [[feedback-clear-seeing-is-correctness]].
