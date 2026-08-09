---
name: feedback-verify-external-pricing
description: "Before quoting any external service's pricing, limits, or specs, check the live/authoritative source — don't assert from memory"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6701f809-b23e-4f5d-8d5d-dfd59f7456cd
---

Before quoting any external service's pricing, limits, tiers, or specs to Jesse, verify against the live/authoritative source — the vendor's own page (WebFetch/WebSearch), the actual console/dashboard, or the installed SDK/package. Don't assert numbers from memory.

**Why:** In session 150 I gave confident figures from memory that were wrong three times — LiveKit's bandwidth cost model, the all-cameras-on Cloud monthly total (I said ~$130; real ~$260–620), and Hetzner's US price (I said ~$35; real ~$141, ~4× EU because the cheap line is EU-only). Each was caught only by checking the live page or a console screenshot Jesse shared. The errors cost his trust and our time, and nearly drove a wrong decision (abandon the platform). External facts drift and memory misremembers them — this is a recurring failure mode, not a one-off.

**How to apply:** For any cost/limit/spec that informs a decision, fetch the vendor source or read the actual console/SDK *before* stating the number; if you can't verify, flag the uncertainty rather than guess. Where verification is cheap, prefer "measure/test it" over "estimate on paper" — read the real dashboard, spin up the by-the-hour server, check the actual config — because two AIs estimating the same thing produced a $50-to-$715 spread this session, and only real data settled it. Pairs with [[feedback-measure-before-agreeing]] and [[feedback-verify-state-not-docs]].
