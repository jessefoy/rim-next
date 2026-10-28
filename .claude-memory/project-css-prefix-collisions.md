---
name: project-css-prefix-collisions
description: Grep public/css/custom.css for a new CSS prefix before using it; the program setup's ps- was already the Scheduler staffing page's and reshaped it for hours (2026-10-28)
metadata:
  type: project
---

Before giving a new surface a CSS prefix, grep `public/css/custom.css` (and components) for `.<prefix>-` first. `custom.css` is one large file, and the per-page prefix list in CLAUDE.md is not complete.

**Why:** the step-by-step program setup (Phase 2, 2026-10-28) took `ps-`, which the Scheduler's staffing page (`/tools/schedule/program/[slug]`) already used. Its rules, such as `.ps-page`, reshaped that page (width, its table) from Phase 2 until `607a6f0` renamed the setup's to `psu-`. tsc, the harness and the setup's own screens all passed; only checking a different page showed it.

**How to apply:** `grep -n "\.<prefix>-" public/css/custom.css` returns nothing before the prefix is used. After a CSS change, measure one page that shares the shell, not only the page built. Related: [[project-css-no-global-box-sizing]], [[feedback-visual-bugs-verify]].
