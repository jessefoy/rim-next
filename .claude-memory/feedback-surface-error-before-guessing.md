---
name: feedback-surface-error-before-guessing
description: "When my own fix doesn't take, surface/instrument the actual error before iterating on more guesses — don't ship speculative fixes for a symptom whose cause I haven't seen"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd11edcf-118f-4f64-a690-de34acd4b8e8
---

When a fix I shipped doesn't resolve the symptom, **stop guessing and surface the real error first** — log it, show it on screen, or otherwise instrument the actual failure — before iterating on another speculative fix. Each blind guess costs a deploy cycle and Jesse's testing time, and a symptom can have a cause nothing in my mental model predicts.

**Why:** In session 158 the Zoom join "blinked" (bounced to the dashboard) on re-entry. I guessed twice — first a stale-meeting self-heal, then a time-window/ban issue — and shipped both without seeing the actual error. Neither helped. The move that solved it was **surfacing the real error to admins on the entry screen**, which immediately revealed a Zoom **429 Add-Registrant rate limit (~3/day/email)** — a cause I'd never have guessed (and one a reviewer had actually flagged, which I'd waved off). Two wasted deploy/test cycles before I looked. The lesson is the debugging-time twin of [[feedback-measure-before-agreeing]]: that one says measure before validating *Jesse's* framing; this one says instrument before trusting *my own* hypothesis about a bug.

**How to apply:**
- When fix #1 for a symptom doesn't work, the next step is **make the failure visible**, not fix #2. Add a temporary error surface (admin-only on-screen message, a `console`/server log of the caught error, the raw API response body) and reproduce.
- Especially for **external-API failures**: catch and log the actual status + response body. The real error (`429`, `3001`, an `approval_type` you didn't set) is usually unambiguous once you see it.
- Treat "it'll probably be fine / the service dedupes / fine for the pilot" as a flag to **verify**, not a reason to skip instrumenting — the same optimism that dismisses a reviewer flag ([[feedback-verify-external-pricing]]) is what makes me guess instead of look.
- Prefer a fix that owns the logic once the cause is seen, over incremental guesses against a black box ([[feedback-read-library-source]]).
