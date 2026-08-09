---
name: Plain-English explanations for design decisions
description: How Jesse wants decisions explained to him before he makes them — what a thing is, where it shows up, and the decision, not just the technical tradeoff
type: feedback
originSessionId: 6e92db7e-914c-41c8-a560-795cfcd2d595
---
When presenting a design decision for Jesse to make, explain each item in this format:

1. **What it is** — in plain user/staff terms, not schema terms. "A note a registrar writes that shows up to registrants" — not "a Json? field on the Program model."
2. **Where it shows up** — the actual page, email, or screen where the member, staff, or public encounters it. Verified against the code, not guessed.
3. **The decision** — what's being chosen between, framed as an understandable tradeoff.
4. **My recommendation** — a single clear call with a one-sentence reason.

**Why:** In session 89 I gave Jesse a summary of drift points in pure technical terms (context names, engine names, registered-vs-not). He named explicitly that he wanted the plain-English version — what each thing IS in the experience, where it lives, what the call is about — so he could make design decisions as a co-creator, not decode jargon. He said: "This is how I would like you to explain stuff to me. Remember this in the future."

**How to apply:**
- Before presenting a list of decisions, verify each one against the code — know where it actually renders. Guessing is worse than asking.
- Lead with the human-facing what and where. Technical name (field, context, file path) comes last or in a footnote, not first.
- When the decision has downstream implications, name them in the recommendation line — don't make Jesse trace them.
- Length: one short paragraph per section per item, not a wall of text. Tables work when the items are parallel.
- This applies any time a design/architecture decision is on the table, not just for editor work. The pattern — what it is, where it shows up, the decision, the recommendation — generalizes.
