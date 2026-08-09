---
name: feedback-honor-the-reference
description: "When Jesse points at a specific reference page or design, match its actual choices. Don't combine its content with structure or text from other contexts and call that 'comprehensive.'"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea07421c-4bea-484a-a6ea-33595fb3a4fe
---

When Jesse points at a specific reference — *"look at the actual page,"* *"see the live site,"* *"here's the existing pattern,"* *"look at this draft"* — match what the reference actually shows. Don't combine its content with structure or text drawn from other contexts and frame the result as comprehensive.

**Triggered by:** Session 132, `/join` page. Jesse pointed me at the Webflow Community Membership page (a one-line-per-agreement numbered list) and said *"I like the version that's on the web page best."* I fetched it via `curl`, read the short-form text — and then on `/join` rendered BOTH the short cards AND the long-form paragraphs from `WelcomeForm` and `RegistrationForm`. I read "include both forms" as "be thorough." It was actually duplication. Jesse caught it: *"You did a lot of good work, but I'm not sure you looked at the actual page, did you?"*

**Why it matters:** The instinct to "include everything" reads like thoroughness but produces redundancy and breaks the integrity of the design that was referenced. If a reference matters enough to be cited, it carries design choices — what's there, what isn't, what the proportions are. Adding stuff from elsewhere alongside it doesn't honor those choices; it dilutes them. The simpler, smaller version is often the right one — that's why Jesse picked it.

**How to apply:**

- When Jesse cites a specific page, design, draft, or pattern as the reference — read it carefully, then *match its shape*. Same content elements, same proportions, same omissions.
- If the reference has a short version and you know a long version exists elsewhere, **don't show both unless Jesse explicitly asks for a "comprehensive" combination**. The default is: honor what's actually there.
- When unsure whether the reference is meant as "use exactly this" vs. "this plus what's reasonable," ask. A one-line clarification is cheap; an over-engineered ship is expensive.
- This applies across reference types:
  - **Live site / URL** — match the actual page shape (`curl` + read; see [[feedback-audit-webflow-by-html]]).
  - **Existing component** — match the existing pattern (read it first; see [[feedback-engagement]]).
  - **A draft Jesse pasted** — match the structure even if you'd write it differently. He's signaling intent.
  - **A screenshot** — match what's actually visible, including what's NOT visible (Webflow's short cards weren't paired with paragraphs; that was the design).

**Anti-pattern this rule replaces:** "I'll include both short and long versions for completeness." If both versions existed for a reason on three separate surfaces, Jesse would have shown me three surfaces. He showed one. Match the one.

Related: [[feedback-engagement]] (engage with the actual design, not the task description), [[feedback-audit-webflow-by-html]] (verify what's actually on the reference page before designing around it), [[feedback-clear-seeing-is-correctness]] (restraint is correctness, not "minimum viable").
