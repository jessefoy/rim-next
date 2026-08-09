---
name: Architecture — single integrated Next.js app (Webflow pivot REVERSED)
description: REVERSED May 2026. RIM is ONE integrated Next.js app — public, member, volunteer, admin all live here. The April 2026 Webflow-primary pivot was abandoned; Webflow is being retired and rebuilt natively. rim-connect.js + /api/public/* removed.
type: project
originSessionId: a83a13b7-ba67-4174-926e-c3ce4999b8c4
---
**Status: REVERSED (May 2026).** The April 2026 Webflow-primary pivot is dead. RIM is **one integrated Next.js application** — public pages, member area, volunteer tools, and admin all live in this app. There is no headless-backend / Webflow-frontend split anymore.

**What this means for work:**
- Build public-facing pages **natively in this app** (App Router pages + the `custom.css` design system). Do NOT reach for Webflow, `rim-connect.js`, `data-rim-*` attributes, or `/api/public/*` bridge endpoints — they have all been removed.
- The public pages (`/`, `/community-programs`, `/programs/[slug]`, `/donate`, `/diversity`, `/teachers`, `/this-week`, `/kalyana-mitta/*`, `/volunteerism/*`, etc.) exist but are **early/rough**. They are the next major build area — the canvas, not duplicates of something live elsewhere.
- The legacy Webflow public site at `rootedinmindfulness.org` is being retired and replaced by this app. Until cutover the app runs at `rim-next.vercel.app`.

**Why the reversal:** Jesse decided to recreate the whole site here as one integrated experience rather than maintain a Webflow + bridge split. (The original pivot's premise — that the spec-to-code pipeline was too lossy for Jesse's visual standards — is addressed instead by working iteratively in-app, not by moving to Webflow.)

**Historical record (superseded, do not treat as current):**
- `RIM_Architecture_Directive.md` — the April 2026 Webflow-primary policy (banner-superseded in-repo).
- `RIM_Architecture_Pivot.md` — the original decision memo (banner-archived in-repo).
- The Webflow-workflow memory files were deleted in session 134 — there is no Webflow workflow left to preserve.

**Legacy Webflow CSS shim (the durable remnant).** ~230 lines at the bottom of `custom.css` still recreate ~25 Webflow classes (`.w-*`, `.section`, `.content-container`, …) using design tokens, plus a runtime `.ProseMirror` block. It's load-bearing for the not-yet-redesigned public pages; delete the whole block only when the last legacy page is rebuilt (backlog `2026-06-01-001`). This absorbs the former `webflow-removal.md` memory, retired in session 141.
