---
name: Measure before agreeing a system is broken
description: When Jesse reports a performance or behavior problem, measure before validating the framing or proposing architecture changes
type: feedback
originSessionId: a83a13b7-ba67-4174-926e-c3ce4999b8c4
---
When Jesse reports that something feels slow / broken / unacceptable, measure before agreeing the framing is correct. Numbers often tell a different story than frustrated perception, and the real fix is often smaller than the proposed one.

**Why:** In session 94, Jesse was ready to abandon the Webflow pivot entirely because pages felt like they took "a few seconds" to render. I nearly agreed and scoped a full architecture reversal (Webflow CMS sync). When we measured instead, cached responses were ~115ms and cold misses ~180ms — well under a second. The real problem was a race condition showing Webflow placeholder text before the fetch completed, which was solvable in 20 minutes with a hide-until-populated CSS rule. Had I accepted the premise without measuring, we'd have thrown out a correct architecture over a 120ms CSS fix.

**How to apply:**
- When a user describes a performance or behavior problem, default response is "let me measure" before "yes that's broken."
- For web latency: `curl -s -o /dev/null -w "ttfb: %{time_starttransfer}s"` is enough. Also check `x-vercel-cache`, `age`, response Cache-Control.
- For flicker/flash: ask whether it's consistent or varying. Variance ≈ race condition, not speed problem.
- If measurement confirms the complaint, proceed with the fix at hand. If measurement contradicts it, share the numbers and re-ask whether the proposed fix is still what they want.
- Don't skip this step to avoid being annoying. "Let me measure first" respects their time more than a wrong architectural pivot would.
