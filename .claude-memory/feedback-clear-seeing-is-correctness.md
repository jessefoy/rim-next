---
name: feedback-clear-seeing-is-correctness
description: "For RIM UI work, visual hierarchy + self-recognition + plain-language state headers are part of correctness, not polish to defer. Don't ship \"minimum viable\" comma-lists, status labels, or implicit state."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9a4213e4-3ee3-482f-a292-821151ddbb5b
---

When building any RIM UI surface, do not frame visual hierarchy, plain-language state, and self-recognition as "polish for after we use it." They are *correctness criteria* per `RIM_Web_Design_Philosophy.md`.

**Why:** Session 129 multi-claim Scheduler — I shipped a comma-separated list of names plus a single button and framed it as "minimum viable; refine after testing." Jesse pushed back: this is below the RIM standard. The philosophy doc explicitly requires plain-language state headers (sentences, not labels), one visually dominant action, restraint that means "smallest set that produces clear seeing" (not "smallest set that renders"), and design that fosters relational/community connection (not transactional). A flat comma list of greeter names fails on all four counts — a volunteer can't find themselves at a glance, can't see the count, and the row reads as a CSV instead of as a community of people.

**How to apply:**
- For any RIM UI surface I build, the first pass must already include: a plain-English state sentence, one dominant action, a self-recognition affordance when "is this me?" matters, and visual treatment that matches the human relationship the surface mediates (greeting = relational, not transactional).
- "Ship minimum, refine after testing" is not the right cadence for new UI in RIM. The right cadence is "ship to the design standard, refine after testing." The standard is named and documented; meeting it is part of the build, not a follow-on.
- If I'm tempted to call something "polish for later," check it against [[design-principles]] and the philosophy doc first. If it touches clear seeing, self-recognition, or relational tone — it isn't polish; it's the work.
- This applies to volunteer-facing and admin-facing surfaces alike. Admin-as-a-utility framing is not the RIM frame — see `RIM_Web_Design_Philosophy.md` "The member experience" + "Designing for real users under pressure" sections; same standard applies to volunteer tools.
