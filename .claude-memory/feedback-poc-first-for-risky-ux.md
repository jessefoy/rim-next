---
name: feedback-poc-first-for-risky-ux
description: "For a novel/risky UX metaphor, ship a throwaway no-auth POC to judge fit before committing any schema"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4ee5de99-071e-4de5-b38d-f24a31ff3e94
---

When a feature hinges on an unproven UX metaphor — especially one in tension with RIM's calm/mobile-first restraint (e.g. a free-form spatial canvas) — build a **throwaway proof-of-concept first**: hardcoded sample data, no DB/schema, deployed somewhere Jesse can actually open it, purely to judge whether the metaphor fits the Sangha and the aesthetic. Only commit the real schema/build after he's seen it. (Session 160: a no-auth `/mindmap-preview` React-Flow canvas validated the mind-map idea — Jesse "looks pretty good to start with"; his one note, connections "line up funny," became the floating-edge decision — before any of the 3 real slices landed.)

**Why:** the riskiest thing isn't the engineering, it's whether the metaphor belongs in RIM at all; a cheap POC answers that for real (in the actual aesthetic) instead of in the abstract, and the early reaction shapes the build. It also embodies restraint — prove it before piling on machinery.

**How to apply:** make the POC reachable where Jesse can open it — the Vercel preview-login gap means an **auth-gated** preview won't work, so use a **no-auth route** (hardcoded data is safe) or ship to prod unlinked. Keep it deletable (isolated files + one dep) and remove it when the real slice lands, but keep any styling worth reusing. Pairs with [[feedback-preview-before-production]] (new compositional elements → a look before production) and [[feedback-restraint-over-new-surfaces]] (a new surface must clear a higher bar).
