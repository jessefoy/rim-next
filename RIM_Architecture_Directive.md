# RIM Architecture Directive

**Read this file at the start of every session. Before writing code. Before editing files. Before proposing anything.**

This document is authoritative. It supersedes any earlier instructions, memory, or conventions that conflict with what's below. Last updated April 2026.

---

## The one-paragraph summary

RIM's digital presence is built in two halves that work together. **Webflow** is the visible surface — every page the member sees, designed visually by Jesse. **RIM Next** is the engine underneath — the Next.js application that holds the database, authentication, APIs, business logic, scheduled jobs, and a small set of genuinely interactive surfaces (the BlockNote editor; anything real-time). A custom library called **`rim-connect.js`** bridges them: Webflow elements tagged with `data-rim-*` attributes are populated and made interactive by the library, which calls RIM Next APIs under the hood. Both halves share the parent domain `rootedinmindfulness.org`, so authentication cookies flow between them automatically.

---

## The principle

**Webflow is the default for anything visible. RIM Next is the engine plus the narrow handful of stateful interactive surfaces that genuinely belong there.**

This is a principle, not a hard split. Admin surfaces are not a separate category — they follow the same rule. A dense working table that people spend hours in may stay in RIM Next. A member-list view that's mostly read may move to Webflow. The question is always: is this surface better served by Jesse designing it visually in Webflow, or by a React application with deep state? When the answer is ambiguous, ask Jesse.

---

## Why this change was made

For months, the project was built entirely as a Next.js application. The pattern of designing member-facing surfaces through specs-to-code produced six compounding problems: generic/AI-ish output, visual inconsistency, tokens not landing as specified, no visibility into results until deployed, existing patterns ignored and rebuilt, specs that took long to write and still didn't capture intent.

The root cause was structural: Jesse is a non-developer, and the spec-to-code pipeline is lossy for visual quality. No amount of memory-management or process discipline fixes this; it needs a different pipeline for visual surfaces.

Webflow gives Jesse direct visual control. `rim-connect.js` lets Webflow surfaces use the full power of the RIM Next backend. The combination restores design quality to the surfaces where it matters most, without losing anything RIM Next already does well.

---

## The domain plan

- `www.rootedinmindfulness.org` — **Webflow.** The public face. All visitor-facing and most member-facing pages.
- `app.rootedinmindfulness.org` — **RIM Next.** Serves the API, hosts the few interactive surfaces that stay in Next.js (BlockNote editor, anything real-time), serves `rim-connect.js`.

Members never type `app.` They may never see it. It's the address `fetch()` calls go to, invisibly.

Cookies from NextAuth are scoped to `.rootedinmindfulness.org` (the parent), so a member who signs in anywhere is signed in everywhere. This is why the subdomain split is the right shape.

**Until cutover:** RIM Next continues to run at `rim-next.vercel.app`. The Webflow site at `rootedinmindfulness.org` continues to serve the legacy public pages. The cutover happens when the new Webflow site is ready to replace it.

---

## What moves to Webflow

Designed by Jesse directly in Webflow. Populated by `rim-connect.js` from RIM Next APIs. **Do not build, extend, or refactor the Next.js versions of these pages unless Jesse explicitly asks.** The existing Next.js versions remain in place only until the Webflow versions are live and verified, at which point they are deleted.

- `/` (home)
- `/community-programs`
- `/programs/[slug]`
- `/donate`
- `/team/[slug]`
- `/magazine-articles/[slug]`
- `/glossary/[slug]`
- `/diversity`
- `/kalyana-mitta/*` (all three)
- `/volunteer-positions/[slug]`
- `/volunteerism/volunteer` and thank-you
- `/community-membership`
- `/login`, `/login/check-email`, `/login/error`
- `/account/welcome`
- `/account/dashboard`
- `/account/dashboard-my-registrations`
- `/account/dashboard-my-library` (overview — individual `/lessons/[slug]` stays in RIM Next)
- `/account/dashboard-my-profile`
- `/account/dashboard-member-care-agreements`
- `/volunteer`
- `/volunteer/programs/[slug]`
- `/admin/members`
- `/admin/members/[id]`
- `/admin/sitemap`
- `/admin/manual`

Admin surfaces that are read-heavy or light-interaction are included in the Webflow list deliberately. Jesse wants the admin area visually coherent with the member area.

---

## What stays in RIM Next

Built in Next.js as React applications. Embedded into Webflow pages where appropriate (via iframe or direct embed), or accessed directly at `app.rootedinmindfulness.org`.

- The **BlockNote editor** and any surface that embeds it (lesson authoring, announcement composers, conversation composers)
- `/lessons/[slug]` — lesson player with autosave, reflections, personal notes
- `/course/[slug]` — course detail with interactive elements, if it retains them
- Any **real-time surface** that emerges (live session views, live registrations counters if built)
- All **background processing** — cron jobs, Stripe webhooks, email sending, Gmail sync
- All **APIs** consumed by Webflow via `rim-connect.js`

**Working-tool admin surfaces are a judgment call.** Jesse has stated a preference for moving more to Webflow than less, including working tools. When a task touches one of these, check the Webflow list above: if it's listed, treat it as a Webflow surface. If it isn't listed, ask Jesse before assuming it stays in RIM Next. Current tools not yet decided:

- Registrar Hub's ProgramsTableClient, VolunteerTable, ProgramEditor
- Host Hub session live view and post-session form
- Teacher Hub course and lesson authoring
- Course Hub
- Support Inbox (Gmail-integrated thread management)
- Email Template Manager
- Shared hub tab pages (Announcements, Conversations, Documents, Members tabs inside hubs)

Some of these may ultimately move to Webflow with enhanced `rim-connect.js` support. Some will stay. The principle applies; the judgment is Jesse's.

---

## The `rim-connect.js` library

A small, custom, RIM-specific JavaScript library. **Not a general-purpose framework.** Built and maintained in the RIM Next repository. Served from `https://app.rootedinmindfulness.org/rim-connect.js` (or an equivalent stable URL during transition).

**Build philosophy: narrow, focused, additive.** Start minimal. Add capabilities only when a real Webflow surface needs them. Resist pre-implementing features. Resist generalizing prematurely. Every addition gets a spec and intent before it's written.

**Proposed attribute vocabulary:**

- `data-rim-list="{collection}"` — fill with list from an endpoint
- `data-rim-item` — template for each item
- `data-rim-field="{field}"` — where a data field goes
- `data-rim-form="{action}"` — form that submits to an API
- `data-rim-member="{field}"` — signed-in member's data
- `data-rim-if="{condition}"` — conditional visibility
- `data-rim-action="{name}"` — button that triggers a mutation

**v1 only includes `data-rim-list`, `data-rim-item`, `data-rim-field`.** Other attributes are added in later versions as their triggering surfaces are migrated.

Document every attribute in FEATURES.md as it's added. Keep examples in the codebase at `/public/examples/rim-connect/` so Jesse has reference snippets he can paste into Webflow.

---

## The API surface

API endpoints for Webflow-consumed surfaces use these conventions:

- `/api/public/*` — unauthenticated endpoints (public content)
- `/api/member/*` — authenticated endpoints (require valid session cookie)
- `/api/admin/*` — admin-only endpoints (require specific role)

Every endpoint consumed by Webflow must have **CORS headers** configured to accept requests from the Webflow domain. During development this is permissive; before go-live it tightens to the production Webflow domain specifically.

Many existing pages that move to Webflow currently read data via Next.js server components with direct Prisma calls. **That data must be exposed as API endpoints before the Webflow page can consume it.** This is new work, expected for each migrated surface.

Document every new endpoint in FEATURES.md — URL, method, auth requirement, request shape, response shape.

---

## Session protocol for Claude Code

The runtime opening-ritual order is defined in `CLAUDE.md` (the "Session Opening — Required" section). **`CLAUDE.md` is authoritative for what Claude reads at session start**; this directive is authoritative for the architectural policy that reading applies.

If a later file contradicts this directive on an architectural question, **this directive wins.** Flag the contradiction and ask Jesse before proceeding.

---

## Before writing code, classify the task

When Jesse brings a task, classify it before proposing anything:

1. **Is it on a page in the "moves to Webflow" list?**
   Then the work is probably building or extending an API endpoint, and/or extending `rim-connect.js`, and/or documenting the `data-rim-*` attribute pattern for Jesse to apply in Webflow. **Do not build or modify the Next.js version of that page.**

2. **Is it on a page in the "stays in RIM Next" list?**
   Work as before. Use existing design system conventions (`public/css/custom.css`, prefixed CSS classes, existing React patterns).

3. **Is it a new API endpoint for a Webflow surface?**
   Build it. Follow `/api/public/*` or `/api/member/*` convention. Configure CORS. Document in FEATURES.md.

4. **Is it a new `rim-connect.js` capability?**
   Spec the attribute vocabulary clearly before building. Keep it narrow. Add only what the requesting surface requires. Document in FEATURES.md. Commit an example to `/public/examples/rim-connect/`.

5. **Is it ambiguous?**
   Ask Jesse. Do not guess. Err toward treating a surface as Webflow-destined unless it has clear stateful-application characteristics (live state, multi-step workflows, rich text editing, drag-to-reorder, real-time updates).

---

## Hard rules

**Do not** build new Next.js pages for surfaces in the "moves to Webflow" list, unless Jesse explicitly asks.

**Do not** delete existing Next.js versions of Webflow-destined pages until the Webflow version is live and verified.

**Do not** recreate the visual design system in code for Webflow-destined pages. They'll be designed directly in Webflow.

**Do not** propose re-integrating Webflow-destined surfaces back into Next.js without explicit discussion with Jesse.

**Do not** pre-build capabilities in `rim-connect.js` before a specific surface needs them.

**Do not** assume a feature needs to be built because it was built before. Some RIM Next features were built during a period of "we could, so we did." Ask Jesse whether a feature is still wanted before porting or extending it.

**Do not** ship changes silently. Every significant change gets logged in session-log.md and, if it affects structure, reflected in FEATURES.md.

**Do** continue developing and refining interactive app surfaces that belong in RIM Next.

**Do** build clean, CORS-configured, documented API endpoints when Webflow surfaces need data.

**Do** extend `rim-connect.js` deliberately as Webflow surfaces are migrated.

**Do** update FEATURES.md with every new endpoint, attribute, and capability.

**Do** ask clarifying questions before writing code when intent isn't clear.

---

## The first concrete task

Before scaling the pattern, validate it end to end on one page. No other migration work happens until this succeeds.

**Target:** public Programs & Events listing (`/community-programs`). Read-only, no auth, no user data.

**Deliverables:**

1. **`GET /api/public/programs`** — returns programs from Postgres with the fields a listing card needs. CORS configured. No auth. Documented.

2. **`rim-connect.js` v1** — minimal library supporting `data-rim-list`, `data-rim-item`, `data-rim-field`. Served from a stable URL. Example documented and committed.

3. **Jesse's work (not Claude Code's):** designs the listing page in Webflow with the data attributes.

4. **Verification:** the Webflow page displays the real program list. Performance and correctness confirmed.

5. **Decision point:** if the pattern feels right, proceed to migrate the broader public site. If it doesn't, stop and discuss.

Wait for Jesse to write specs for these two deliverables in a new conversation with Claude Chat. Do not build them preemptively.

---

## Companion reference files

These three HTML files contain visual references Jesse uses to think about the system. Not source of truth — reference material. Kept in `/atlas/` (or wherever Jesse places them).

- `rim-atlas-v2.html` — interactive map of pages, components, and design tokens
- `rim-layers.html` — conceptual explanation of how the layers work
- `rim-stack.html` — named technologies and where each sits

When system structure changes significantly, offer to regenerate these. Don't regenerate unprompted.

---

## What survives unchanged from before this pivot

- The entire RIM Next **backend** — database schema, Prisma models, auth, business logic, Stripe, Resend, Gmail, Google Meet, Sanity, Vercel Blob
- All **reference files** (FEATURES.md, RIM_Stack_Reference.md, RIM_System_Architecture.md, RIM_Role_Design.md, RIM_Web_Design_Philosophy.md) — as authoritative sources of their respective concerns
- The **working relationship** — Claude Chat for strategy and specs, Claude Code for implementation, Jesse for Webflow design and architectural decisions
- The **core values** — design for the moment of panic, clear seeing is the prerequisite for wise response, build correctly from the start, nothing in production yet
- The **session log** — continues as the historical record
- The **closing ritual** after significant sessions — regenerate reference files, add ManualSection upserts, update FEATURES.md

---

## Change log

- **April 2026** — Initial version of this directive. Pivot to Webflow + `rim-connect.js` + RIM Next headless backend committed.

When this directive changes, note it here with a date and a sentence describing the change.

---

*End of directive. Read at the start of every session.*
