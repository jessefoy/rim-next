---
name: feedback-label-never-decides-access
description: "A display label (Category, Format) must never quietly decide access; access gets its own explicit, visible per-program setting. Jesse reversed a brief that told me to derive access from Format."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 03b6a02a-2411-46ed-90e9-52a9cc6e7801
  modified: 2026-10-02T21:33:04.630Z
---

A label must never quietly decide access. Category and Format on a program are display and grouping only. Who may join without registering, enter the Zoom room, or see a Join on My Home's Today is its own explicit per-program setting (`Program.openEntry`, read by `hasOpenEntry`), visible in the Program Manager beside registration.

**Why:** 2026-10-02. The program-categories brief (C0) told me to keep the old droppable rule "identical" by deriving it from Format = Drop-in. I built that and proved it identical for all 20 programs, and flagged the coupling in my report. Jesse reversed it on reading the mapping: "Format must not decide access", and open entry must be "a setting he can turn on for any program." Changing a Format in the editor would have silently changed who may enter a Zoom room, and a registrar editing a label would never know. He said this is the point that matters most.

**How to apply:**
- When a brief or my own plan derives a permission, entry rule, visibility rule, money rule or notification from a label or category field, stop and propose a separate explicit setting instead. Preserve today's behavior by backfilling the new setting from the old rule, not by coupling the two.
- Check first whether an existing setting already does the job; do not stretch a nearby one. (`isOpenAccess` is a secret guest link for people with no account, so it was not the same thing.)
- Show the setting's consequence in the editor's readout, and say plainly in the UI when a label is only a label ("Format is a label").
- Prove "no one's access changed" with a before-and-after table on every real row, and by flipping the label through every combination.
- Related: the show-but-can't-act shape in [[feedback-shared-surface-audit]], and hierarchy and state as correctness in [[feedback-clear-seeing-is-correctness]].
