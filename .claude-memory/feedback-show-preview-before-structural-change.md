---
name: feedback-show-preview-before-structural-change
description: "On a page with its own recorded composition (Donate), send Jesse the preview picture before building a structural change; a description isn't enough"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fed1b4b7-de3b-49ae-bc87-82dafebcff76
  modified: 2026-10-22T21:25:40.098Z
---

On a public page whose composition is recorded as its own (Donate, the program pages' grammar, anything `RIM_Public_Pages.md` says "keeps its own composition"), a structural change (reordering, re-laying a section, retiring a pattern) waits until Jesse has seen the preview picture: inject the CSS on the live page, take the screenshot, send it with SendUserFile, and build on his yes. Small fixes inside the existing structure (a measure, a size, a gap) don't need this.

**Why:** 2026-10-22, I described Donate's zig-zag reflections becoming one column, Jesse approved ("Yes, build both"), and once he saw it live he asked *"What happened to my donation page styling?"* and chose to restore the zig-zag. He confirmed the rule: *"on a page with its own recorded composition, send me the preview picture before building a structural change."*

**How to apply:** Check `RIM_Public_Pages.md` for the page's recorded decisions before proposing; for a structural change, preview it with an injected `<style>` in the built-in browser, send the screenshot (before and after where it helps), and ask. When he asks what happened to a page, list that page's changes from the day and let him pick what to undo, as worked here. Pairs with [[feedback-layout-composition]] and [[feedback-honor-the-reference]].
