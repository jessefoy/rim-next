---
name: feedback-match-zoom-session-room
description: "In the LiveKit session room specifically, default to matching Zoom's behavior/IA (members' muscle memory). NOT the rest of RIM, which keeps its own warm design language."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 143a817b-27ad-44fd-8db1-7192685b9e85
---

For the **LiveKit session room** (`/session/*`, the live video meeting), make it **as Zoom-like as possible** — match Zoom's behaviors, controls, layout, and information architecture by default. Confirmed when Jesse chose to keep crop-to-fill tiles (`object-fit: cover`) once told that's what Zoom does: *"if this function is just like Zoom… that should always be our model… because that's what people are used to."*

**Why:** RIM's members are largely older / less tech-comfortable; the session room exists to remove friction, and matching the tool they already know means their muscle memory transfers — fewer surprises, less to learn. Extends the deliberate session-117 "Zoom-aligned redesign" foundation.

**How to apply:** When a session-room behavior or control could go several ways, pick the one that matches Zoom — use "what does Zoom do here?" as the tiebreaker — unless `RIM_Web_Design_Philosophy.md` or a contemplative-specific need overrides it (join-unseen, Bell mode, the calm/quiet tone, sangha-language pills over corporate labels). **Scope: the session room ONLY.** The rest of RIM (public pages, member area, admin) follows its own warm, calm, dharma-rooted design language ([[design-principles]]) — do NOT Zoom-ify the whole app. See `RIM_SessionRoom.md` → "Device selection + tile framing."

Related: [[design-principles]], [[feedback-honor-the-reference]].
