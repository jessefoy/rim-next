---
name: feedback-community-not-anonymous
description: "A community isn't a community if it's anonymous. RIM community surfaces require real names; never default to anonymous or single-field flows for community membership."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ea07421c-4bea-484a-a6ea-33595fb3a4fe
---

> *"A community isn't a community if it's anonymous."* — Jesse, session 132

This is a community design principle, not a UX preference. RIM is an intentional community, and identity is part of the threshold. Surfaces that ask someone to participate in the community should require — and treat as load-bearing — first and last names. Don't default to anonymous flows, email-only sign-ups, or single-field "minimum friction" threshold designs to make sign-up faster.

**Why it matters:** Real names are not friction to minimize. They are a feature of intentional community. A flow that collects only an email lets people drift in without the small act of self-presentation that makes a community possible. Future-me may be tempted to "simplify" sign-up to one field for speed metrics — don't. RIM's design philosophy explicitly trades convenience for intentionality at threshold moments (see [[design-principles]] and `RIM_Web_Design_Philosophy.md` "Forms as Thresholds").

**Triggered by:** Session 132, when designing `/join`. I asked Jesse whether to collect names on `/join` or defer to a later step. He said: *"It definitely needs the first and last name because they are joining a community. A community isn't a community if it's anonymous."* That framing turned what I had treated as a UX choice into a principle.

**How to apply:**

- **Sign-up / join flows** — always require first and last name. Don't offer a "skip" or "add later" affordance for names on threshold surfaces.
- **Profile completion** (`/account/welcome` Path C) — same rule. Real names required.
- **Program registration** — same rule. RegistrationForm already collects names for non-signed-in registrants; preserve that.
- **Future peer-led hub flows, conversation threads, hub-document authoring** — any surface that creates a community-visible artifact should display real names, not handles or initials-only displays. Authorship of community artifacts is part of the community.
- **Pseudonymous / handle-based community features** — push back if proposed. RIM's frame is the meditation hall, not the forum. Naming yourself when you arrive is part of the practice.
- **Imported / migrated user records** — when bringing in members from another system (Memberstack, etc.), preserve the names. A row without a real name is a row that hasn't yet crossed the threshold.

**Exceptions:** Public anonymous surfaces (the public site reading articles, viewing the public program list, etc.) are reading-not-participating contexts and don't fall under this rule. The rule is for surfaces that *create membership* or *create community-visible artifacts*. When in doubt: is this person about to *be* in the community, or *read about* the community? The first requires the name; the second doesn't.

Related: [[design-principles]], [[user-jesse]] (holistic thinker; identity matters), [[feedback-clear-seeing-is-correctness]] (RIM's design standards are correctness criteria, not polish).
