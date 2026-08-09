---
name: feedback-preview-before-production
description: SUPERSEDED s170 — push design work straight to main, including new compositional elements; don't hold a branch waiting for Jesse to look
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5ca4b53d-026b-4508-ad83-c16623e03018
  modified: 2026-08-07T23:35:20.223Z
---

**Push to `main`.** Jesse, session 170, unprompted, after I finished a public-page rebuild on a `claude/*` branch and held it for his review: *"Oh, please always go ahead and push to main."*

This **supersedes the session-148 rule** that new *compositional* elements (a band, a section pattern, a new card type) must sit on a preview branch until he had looked. That distinction is retired — tweaks and new elements alike go to `main`.

**Why:** RIM's loop is push-to-see. Vercel deploys `main` in ~1–2 min and Jesse looks at the real site, not a preview URL. A branch held for review stalls the loop and puts the work behind a link he has to go find — it costs more than a wrong pattern does, because a revert is one commit. The session-148 chapters/band revert was cheap; waiting is not.

**How to apply:** work on a `claude/*` branch for the reviewer/type-check gates if useful, then fast-forward `main` and delete the branch **in the same turn** — don't end a turn with finished, verified work parked on a branch. Verify it yourself first (type-check, rendered measurement, contrast) — pushing straight to production raises the bar on self-verification, it doesn't lower it. Composes with [[feedback-merge-by-default]] (now the unconditional rule) and [[feedback-restraint-over-new-surfaces]] (a genuinely new *surface* still clears a higher design bar before it's built at all — that's about scope, not about where it lands). Still say clearly what shipped and what you'd revert if he dislikes it.
