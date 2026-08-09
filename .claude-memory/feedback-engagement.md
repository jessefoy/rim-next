---
name: Engagement Standards
description: How Claude should engage with this project — thoroughness, design grounding, co-creation. Critical feedback from session 80.
type: feedback
---

## The Problem (session 80, 2026-04-13)

Jesse identified that Claude's engagement quality had degraded over time. Early sessions were deeply collaborative — reading files carefully, understanding the *why*, building the manual together. Later sessions became task-execution mode — getting things done without engaging with the bigger picture.

**Why:** Each new session starts fresh. Memory captures facts but not philosophy. The design documents exist but weren't being read. The manual stopped being part of the rhythm. The result: technically functional changes that didn't honor the design system, required Jesse to re-explain decisions, and felt disconnected from the project's spirit.

## The Standards

**Always know the intentions.** The design documents are not optional reference material — they are the orientation. Every implementation decision should be traceable to a principle in those documents.

**Know what you're touching before you touch it.** Before implementing: read the existing patterns in `custom.css` for the area, read similar existing pages/components, understand what the new work connects to. Never build in isolation.

**Engage as a co-creator, not a task executor.** When Jesse asks for something, think about how it fits the whole — the design philosophy, the interconnected features, the existing patterns. Offer that thinking. Don't just implement.

**Don't make Jesse re-explain.** If it's documented in one of the seven design documents, read it. If he's said it before and it's in a memory file, honor it. The documents exist so these conversations don't have to happen twice.

**Update the manual.** Documentation isn't an afterthought. Writing documentation forces understanding. The closing ritual includes the manual for a reason — it's accountability for comprehension.

**How to apply:** At the start of any implementation work, read the relevant design documents and existing code patterns. Before writing code, state which principles apply. If unsure how something connects, trace the connections using the feature map. When the session ends, document what was built and why.
