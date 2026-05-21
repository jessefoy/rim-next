# RIM Architecture Pivot — Headless Webflow + RIM Next — ARCHIVED

> ⚠️ **This document is archived historical context.** It records the April 2026 decision memo when the Webflow-primary architecture was still being scoped. The architecture is now policy, documented in [`RIM_Architecture_Directive.md`](RIM_Architecture_Directive.md).
>
> As of session 94 (2026-04-24), the pivot is committed, not tentative. The Directive is authoritative. This file is kept only to preserve the original decision's framing and rationale.
>
> **Do not read this as part of the opening ritual.** It is not required reading. Read the Directive instead.

---

**Original content below — preserved as written.**

---

**Date:** April 2026
**Status:** Decided, in transition
**Audience:** Claude Code, and any future reader of this project

This document records a significant change in how RIM's digital presence is built. Read this before working on any UI-related task.

---

## The decision in one paragraph

RIM Next is becoming a **headless backend**. The public site and most member-facing pages move to **Webflow** for visual design. RIM Next continues to own the database, business logic, authentication, registrations, dana handling, and all genuinely interactive app surfaces (editor, learning internals, task boards, Support Inbox, hubs, admin tooling). A custom JavaScript library — **`rim-connect.js`** — bridges the two: Webflow elements get tagged with `data-rim-*` attributes, and the library fetches from RIM Next API endpoints and populates them.

---

## The problem that led to this decision

Design work across the application was producing six compounding failure modes simultaneously:

1. Generic / AI-ish visual output
2. Visual inconsistency across surfaces
3. Design tokens (spacing, typography, color) not landing as specified in specs
4. No visibility into results until built and deployed
5. Existing patterns ignored and rebuilt from scratch across new surfaces
6. Specs taking a long time to write and still not capturing design intent

Root cause: there was no effective visual intermediate between design intent and code implementation. Specs described layout in words; the translation from words to visual output lost fidelity every time. Memory controls, better process discipline, and a design-system audit had all been attempted previously without sticking. The issue was structural, not procedural — Jesse is a non-developer, and the spec-to-code pipeline was fundamentally lossy for the visual qualities he cares most about.

The pivot resolves this by giving Jesse a medium he can work in directly (Webflow's visual designer) for the surfaces where design quality matters most, while preserving all the backend logic and the genuinely interactive app surfaces in the existing Next.js application.

---

## What moves to Webflow

Designed by Jesse directly in Webflow. Populated by `rim-connect.js` from RIM Next APIs. **Do not build or refactor the Next.js versions of these pages going forward unless explicitly asked.** The existing Next.js versions remain in place only until the Webflow versions are live and verified.

- `/` (home)
- `/community-programs`
- `/programs/[slug]`
- `/donate`
- `/team/[slug]`
- `/magazine-articles/[slug]`
- `/glossary/[slug]`
- `/diversity`
- `/kalyana-mitta/*` (all three pages)
- `/volunteer-positions/[slug]`
- `/volunteerism/volunteer` and thank-you
- `/login`, `/login/check-email`, `/login/error`
- `/account/welcome`
- `/account/dashboard`
- `/account/dashboard-my-registrations`
- `/account/dashboard-my-library` (overview only — individual lesson pages stay in RIM Next)
- `/account/dashboard-my-profile`
- `/account/dashboard-member-care-agreements`
- `/volunteer`
- `/volunteer/programs/[slug]`
- `/community-membership`

---

## What stays in RIM Next

Built in Next.js as React applications. These surfaces have stateful, interactive UIs that Webflow cannot meaningfully render. **Continue developing these with the existing patterns and the design system in `public/css/custom.css`.**

- BlockNote editor and all its usages (lesson authoring, announcements, conversations)
- `/lessons/[slug]` — lesson player with autosave, reflections, personal notes
- `/course/[slug]` — course detail with interactive elements
- **Registrar Hub** — ProgramsTableClient, VolunteerTable, ProgramEditor
- **Host Hub** — session live view, post-session form, sub board, calendar
- **Teacher Hub** — course and lesson content management
- **Course Hub** — course content management
- **Support Inbox** — Gmail-integrated shared inbox with threading, replies, internal notes, templates
- **Email Template Manager**
- **Shared hub tab pages** — Announcements, Conversations, Documents, Members (inside any hub)
- **Admin surfaces** — `/admin/members`, `/admin/members/[id]`, `/admin/sitemap`, `/admin/manual`, etc.
- `/update/[token]` — token-gated self-service edit utility
- Any future interactive tooling

Once the cutover happens, these likely live at a subdomain like `app.rootedinmindfulness.org`; the root domain becomes Webflow. Until cutover, they continue at `rim-next.vercel.app`.

---

## The new library: rim-connect.js

A small, custom, RIM-specific JavaScript library that Webflow loads as a single `<script>` tag. It reads `data-rim-*` attributes on Webflow-designed elements and populates them from RIM Next API endpoints.

**Build philosophy:** narrow, focused, RIM-specific. No generic framework. Do exactly what RIM needs; add capabilities only as surfaces demand them. Start minimal, grow intentionally.

**Hosting:** Served from the RIM Next deployment at a stable URL. Likely candidate: `https://app.rootedinmindfulness.org/rim-connect.js` once the subdomain is set up; `https://rim-next.vercel.app/rim-connect.js` during transition. File lives at `public/rim-connect.js` in this repo.

**Attribute vocabulary (v1 — list rendering only):**

- `data-rim-list="{collection}"` — marks a container as a list template
- `data-rim-item` — marks the item template inside a list
- `data-rim-field="{fieldName}"` — inside an item, marks where a field value goes (sets `textContent`; use `[fieldName]` tokens in href values for interpolation)

**State elements (siblings of `data-rim-item` inside the container):**
- `data-rim-state="loading"` — visible during fetch, hidden when done
- `data-rim-state="empty"` — visible when zero results
- `data-rim-state="error"` — visible if fetch fails

**Not in v1, expected in later versions as surfaces need them:**

- `data-rim-form="{action}"` — form submissions
- `data-rim-member="{field}"` — authenticated member data
- `data-rim-if="{condition}"` — conditional visibility
- `data-rim-action="{name}"` — button-triggered mutations

Build the library incrementally. Resist the temptation to pre-implement capabilities before surfaces need them.

---

## API surface

API endpoints for Webflow-consumed surfaces should live under a clear public path:
- `/api/public/*` — unauthenticated endpoints
- `/api/member/*` — authenticated endpoints (future; requires cross-domain cookie scoping)

**CORS:** Public endpoints need CORS headers configured to accept requests from the Webflow-hosted domain. Start permissive for the proof; tighten for production.

**Authentication across domains:** The existing NextAuth session (6-digit sign-in code, established session 119) is cookie-based. For Webflow pages to share auth state with the RIM Next app subdomain, cookies need to be scoped to the parent domain (`rootedinmindfulness.org`). This is configurable in NextAuth but requires care. Not needed for v1 (public endpoints only).

---

## How Claude Code should approach work from here

**When you receive a task, first classify the surface.**

1. **Is it a page in the "moves to Webflow" list?** → Your job is typically to build or extend an API endpoint and/or `rim-connect.js` capability. Document the `data-rim-*` attribute pattern Jesse should use in Webflow. **Do not rebuild the Next.js version of the page.**

2. **Is it a page in the "stays in RIM Next" list?** → Work as before. Use the existing design system CSS prefixes (`db-`, `mr-`, `vol-`, etc.) in `public/css/custom.css`. Follow existing React patterns.

3. **Is it a new API endpoint?** → Build it. Follow existing conventions in `app/api/`. Add CORS headers if it's public. Document it in FEATURES.md.

4. **Is it an extension to `rim-connect.js`?** → Build it narrow and focused. Add only what the triggering surface requires. Update this document and FEATURES.md with the new capability.

**When a request is ambiguous about which side it belongs on:** ask Jesse before building. Err on the side of treating it as a Webflow surface unless it has clear stateful-application characteristics (live state, multi-step workflows, rich text editing, drag-to-reorder, real-time updates, admin tooling).

**Do not:**

- Build new Next.js pages under `app/account/*` or similar for surfaces in the Webflow-destined list, unless explicitly asked
- Remove or delete the existing Next.js versions of Webflow-destined pages until the Webflow version is live and verified
- Try to recreate the visual design system in code for Webflow-destined pages
- Propose re-integrating Webflow-destined surfaces back into Next.js without explicit discussion

**Do:**

- Continue building and refining the interactive app surfaces that stay in RIM Next
- Build clean, documented, CORS-configured API endpoints when Webflow surfaces need data
- Extend `rim-connect.js` minimally as Webflow surfaces are migrated
- Update FEATURES.md with new API endpoints and library capabilities
- Update RIM_System_Architecture.md to reflect the split as migration progresses

---

## What hasn't changed

- The entire RIM Next backend — database schema, Prisma models, business logic, auth, Stripe, Resend, Gmail, Google Meet, Sanity — remains intact
- The reference files (`FEATURES.md`, `RIM_Stack_Reference.md`, `RIM_System_Architecture.md`, `RIM_Role_Design.md`, `RIM_Web_Design_Philosophy.md`) remain the source of truth
- The working relationship: Claude Chat for strategy and specs, Claude Code for implementation, Jesse for Webflow design and decisions
- The core values: design for the moment of panic, clear seeing, nothing in production yet so build it right
- The existing Sanity CMS usage for non-program content (may be reviewed later)
- The session-log.md continues as the historical record

---

## First concrete task: the proof

Before scaling the pattern, validate it on one page end to end. No other migration work until this succeeds.

The proof target: **public Programs & Events listing** (`/community-programs`). Pure read, no auth, no user data.

Required:

1. **`GET /api/public/programs`** — returns programs from Postgres. Fields: `id`, `slug`, `name`, `category`, `programImage`, `scheduleLabel` (pre-computed), `programFormat`, `tagline`, `specialAnnouncement`, `danaText`, `registrationEnabled`. Cache-friendly. No auth. CORS configured.

2. **`rim-connect.js` v1** — minimal library supporting `data-rim-list`, `data-rim-item`, `data-rim-field`. Hosted at `public/rim-connect.js`.

3. **Jesse's work (not Claude Code's):** designs the listing page in Webflow with the data attributes.

4. **Verification:** load the Webflow page, programs appear.

5. **Decision:** if the pattern feels sustainable to Jesse, proceed to broader migration. If not, stop and discuss.

---

## Companion reference: the RIM Atlas

Two HTML files were generated during the architectural conversation:

- `rim-atlas.html` — v0.1, static visual map of pages, components, and user journeys
- `rim-atlas-v2.html` — v0.2, interactive version with rendered component approximations, design tokens, and click-to-detail drawer

The atlas is the current best visual reference for what RIM Next contains and what the design language is aiming for. The tokens section of v0.2 names the color, typography, and spacing intentions — these are the reference for what Jesse builds in Webflow, but only as a starting point. The real tokens live in his Webflow style panel going forward.

Keep the atlas files in sync as the system evolves, or deprecate them once Webflow becomes the living reference.

---

*End of document.*
