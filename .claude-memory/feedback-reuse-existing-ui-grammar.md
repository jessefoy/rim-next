---
name: feedback-reuse-existing-ui-grammar
description: "Before giving a page its own filters/nav, use the established grammar (the Scheduler's pills + View picker, now components/FilterBar.tsx); Jesse: \"Consistency is key.\""
metadata:
  node_type: memory
  type: feedback
  originSessionId: f46f68c1-e2ec-44ff-8d13-7765d7f83aa2
  modified: 2026-10-20T18:57:15.832Z
---

When a page needs filters, types or tabs, use `components/FilterBar.tsx` (FilterPills, ViewPicker, SectionTabs: the Scheduler's grammar). Never invent a page's own column of folders, segment or chips.

**Why:** 2026-10-20 I built the Updates inbox with its own types column and All/Unread switch. Jesse: "We already have a general navigation for these kinds of things… I don't think we should have too many different configurations. That's confusing for people. Consistency is key." The fix moved Updates, Conversations and Files onto the one grammar.

**How to apply:** before designing any UI control, look for the pattern the app already uses for the same job (the Scheduler is the reference for filtering) and reuse its component; if none fits, extend the shared component rather than adding a page-local one. Record in `RIM_Hub_Engineering.md` → "One filter grammar". Related: [[feedback-honor-the-reference]], [[feedback-visual-design]].
