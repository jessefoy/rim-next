---
name: feedback-derive-from-existing-data
description: "Before proposing a new schema field or input, check whether existing data already encodes it; Jesse steers to deriving from what's already captured"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 1303d913-99f8-4c22-b0fb-eb0ef06ff016
---

Before proposing a new schema field, column, or editor input, check whether the information is **already encoded in existing data** and can be derived. Jesse repeatedly steers to the simpler "use what we already have" path.

**Why:** Session 153 (monthly recurrence) — I proposed adding a schema field (or an editor picker) to capture "which weekday of the month" a monthly program meets. Jesse pushed back: *"Don't we already have a specific day that these are offered on? Wouldn't that be able to define it?"* — and he was right. The program's **start date** already encodes both the weekday and the position-in-month ("last Sunday"), so monthly recurrence derives from it with **no new field and no new input**. The schema-field option would have added a migration + UI + ongoing maintenance for data we already had.

**How to apply:**
- When a feature seems to need a new field/input, first ask what existing fields already imply it: a start date implies weekday + month-position; a category implies kind ([[feature-interconnections]]); a stored datetime implies the CT day. Derive at read time before storing something new.
- Adding a field/column is the last resort, not the first — it carries migration + editor + mirror-copy cost.
- Relates to [[feedback-restraint-over-new-surfaces]] (restraint on new surfaces) and [[feedback-server-compute-caches]] (recompute from source fields rather than store a second source of truth).
