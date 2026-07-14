# RIM Next — Feature Reference

This document is the **current-state catalog** of what exists in the live RIM Next app: every significant feature, in plain language, with its routes, its status, and a pointer to where the deep detail lives.

**What it is NOT** — so it stays lean and true:
- It is **not the deep technical reference** for each subsystem. Those have dedicated docs (see the map below).
- It is **not the source of truth for the data model** — that's `prisma/schema.prisma`.
- It is **not the session history** (`session-log.md`), **in-progress work** (`UP_NEXT.md`), **cleanup residue** (`CLEANUP.md`), or **the wishlist** (`data/backlog.json`).

**Maintenance contract.** Update this file at the end of any session that adds, removes, or materially changes a feature. Keep each entry to the plain-language "what + where + status"; when a feature gains real depth, that depth belongs in its dedicated doc, and this file just points to it. If a feature is removed, move it to the **Removed / superseded** table — don't leave it inline as struck-through text.

> Rebuilt from a full live-codebase inventory on 2026-06-07 (session 139), replacing a 5,000-line accreted version whose numbering, TOC, and "planned" sections had drifted out of alignment with reality. The pre-rebuild file is preserved in git history.

---

## For depth, see

| Topic | Authoritative doc |
|---|---|
| System architecture (3-layer model, hubs, permissions) | `RIM_System_Architecture.md` |
| Roles & permissions | `RIM_Role_Design.md` |
| Design philosophy (clear seeing, restraint) | `RIM_Web_Design_Philosophy.md` |
| Stack, env vars, services, versions | `RIM_Stack_Reference.md` |
| Auth / sign-in / rate-limit | `RIM_Auth.md` |
| Programs vs Courses (the offering model) | `RIM_Offering_Model.md` |
| Registration / dana / Stripe | `RIM_Registration.md` |
| Hubs — model + per-callsite engineering rules | `RIM_Hub_Model.md`, `RIM_Hub_Engineering.md` |
| Mind Maps — spatial brainstorming + per-topic conversations | `RIM_MindMaps.md` |
| Scheduler tool | `RIM_Scheduler.md` |
| Program Manager | `RIM_ProgramEditor.md` |
| Course Manager | `RIM_CourseEditor.md` |
| Session room — Zoom (LiveKit room retired s159) | `RIM_Zoom.md` · `RIM_SessionRoom.md` (historical) |
| Email engineering (template gate, helpers) | `RIM_Email_Engineering.md` |
| Editor surfaces, blocks, placements | `RIM_Editor_Types.md` |
| Data model (canonical) | `prisma/schema.prisma` |
| Session history · in-progress · cleanup · backlog | `session-log.md` · `UP_NEXT.md` · `CLEANUP.md` · `data/backlog.json` |

---

## Platform at a glance

RIM Next is a **single, integrated Next.js 16 (App Router) application**. Public pages, member accounts, registrations, online courses, hubs, volunteer tools, the API, the database, business logic, scheduled jobs, the Tiptap editor surfaces, and the Zoom session entry all live in this one app.

**Three-layer architecture** (see `RIM_System_Architecture.md`):
- **Member Registry** (`/admin/members`) — the canonical record of every person. ADMIN + REGISTRAR only.
- **Hubs** (`/account/hub/[slug]`) — team workspaces for volunteer groups.
- **Tools** (`/tools/*`) — full operational applications (Scheduler, Program Manager, Course Manager).

**Live at** `rim-next.vercel.app`. The legacy Webflow public site at `rootedinmindfulness.org` is being **retired and rebuilt natively in this app** — the April-2026 Webflow-primary pivot was reversed (May 2026). The public-facing pages here exist but are early/rough; they are the next major build area.

**Verified surface (session 139):** 63 page routes · 106 API routes · 5 crons · 54 Prisma models/enums · 3 tools.

---

## Foundations

### Authentication & sign-in
Passwordless **6-digit sign-in code** via Resend (NextAuth v5 — no passwords, switched from magic links in session 119). Two doors over the same mechanism: `/login` for existing members, `/join` for new members (sets the Community Care Agreement, sends a welcome letter, enrolls the onboarding series). Code entry at `/login/check-email`; errors at `/login/error`.
- **Routes:** `/login`, `/login/check-email`, `/login/error`, `/join` · **API:** `/api/auth/[...nextauth]`, `/api/account/join`, `/api/account/check-email`
- **See:** `RIM_Auth.md` (flow, code generation, error states, membership-existence check, rate-limit thresholds).

### Roles & permissions
The `Role` enum still defines seven values, but the member profile now separates **system powers** ("Roles & access") from **team membership** ("Hub memberships"). Assignable powers: **ADMIN** (technical), **GUIDING_TEACHER** (dharma authority, soft-admin across every hub), **REGISTRAR** (registry + Program Manager), **TEACHER** (Course Manager), and **HOST_MANAGER** — surfaced as **"Scheduling manager"** (cross-hub rotation/coverage authority). The plain **HOST** role was **retired** in session 153 — being a host is now host-team *membership*, not a role (set in Hub memberships; a `retire_host_role_v1` migration stripped it from users). **SUPPORT** is residual (its Support Inbox was removed in session 100) and was dropped from the role UI. See `RIM_MemberRegistry.md` + `RIM_Role_Design.md`.
- **See:** `RIM_Role_Design.md`, and the permission framework in `RIM_System_Architecture.md`.

### Route protection
Per-page `auth()` from `auth.ts`, plus a route-group layout at `app/account/(authenticated)/layout.tsx` that structurally enforces three gates for the whole authenticated member area: session present → `agreedToTerms` → not `archivedAt`. `proxy.ts` is an intentional no-op (NextAuth v5 + Prisma adapter can't verify sessions in Edge without login loops).

### Rate limiting
Postgres-backed fixed-window limiter (`RateLimitWindow`, `lib/rateLimit.ts`) on the sign-in and callback endpoints — cross-instance, no Redis. Daily cleanup cron. **See:** `RIM_Auth.md`.

---

## Public site

> The next major build area — the rebuild began in earnest **session 148** (warm three-shade palette + program-detail redesign + the flush-nav decision). The design system — palette, the card-lift / recede-panel surface language, and the tombstones (the reverted floating nav + chapter band) — lives in **`RIM_Public_Pages.md`**; read it before any public-page UI/CSS work. Other pages are still early/rough.

- **Community programs listing** — `/community-programs`. The public catalog of offerings, grouped by category.
- **Program detail** — `/programs/[slug]`. **Redesigned session 148; refined session 162** onto the warm palette + editorial card language (see `RIM_Public_Pages.md`): image/blue hero, required quote card, open description, optional recede Notes, a quiet **Gathering details** card with a separated state-aware action, and linked facilitator portraits. The **"what to do next" CTA** keys off offering kind + registration + viewer state: registered/waitlisted first, then Register / waitlist / not-open-yet / format-aware drop-in entry. Logged-in online participants go to My Home; visitors sign in first.
- **Program registration** — `/programs/[slug]/register`. The registration form + dana step.
- **This Week schedule** — `/this-week`. Dynamic weekly schedule (Mon–Sun, `?week=next`), shared occurrence logic with the Scheduler.
- **Teachers directory** — `/teachers`, `/teachers/[slug]`. Public teacher profiles (`isTeacher` + `TeacherProfile`). The Member Registry supports direct portrait upload; normal source images are circularly cropped by CSS on facilitator/profile surfaces.
- **Public course pages** — `/courses` (index), `/course/[slug]` (public landing, mirrors program-detail shape), `/lessons/[slug]` (lesson reader, access-gated).
- **Join / membership threshold** — `/join`. The new-member door (see Auth).
- **Content / static pages** — `/diversity`, `/donate`, `/kalyana-mitta/*` (3: community-groups-events, guidelines, application), `/volunteerism/volunteer` + thanks page.
- **Nav & footer** — `components/Nav.tsx` (sticky **flush** full-width white bar, CSS-only dropdowns, `isMemberArea`/`isAdmin` aware), footer in the root layout. Public nav slimmed (session 148) to **Programs ▾ · Get Involved ▾ · Members ▾ · Donate** (Courses + Teachers dropped from the bar; "Member Area" → "Members"). A floating-pill nav was tried and reverted — see the tombstone in `RIM_Public_Pages.md`.

---

## Member area (`/account`)

The authenticated experience uses one quiet member header and a role-aware account rail. Personal destinations, team links, and administration share this shell; entering a hub replaces the account rail with the hub-specific workspace rail. Session 162 unified the warm ground, compact interface typography, white working surfaces, widths, spacing, actions, and responsive behavior across member, admin, hub, and tool destinations without changing their permission boundaries.

- **Dashboard** — `/account/dashboard`. The member home: "Today" groups the single immediate/live offering from later sessions, with one balanced time/title/context/action row and no redundant “Zoom is open” message; "Coming up for you" holds registered offerings. Host early-entry and member-entry language are distinct. Placement keys off offering kind + registration (session 137); `DashboardAutoRefresh` handles state transitions. A one-time, dismissible **host-welcome panel** (session 143, `HostWelcomePanel`) greets a pre-staged host who's just onboarded — shown when they belong to a hub, have hosting assigned, and haven't dismissed it (`User.hostWelcomeSeenAt`); links to their Scheduler view. Dismiss/follow → `POST /api/account/host-welcome-seen`.
- **My Profile** — `/account/dashboard-my-profile`. Name, contact, preferences; avatar + bio.
- **My Programs** — `/account/programs`, `/account/programs/[slug]`. Registration history, status, join button, calendar links, pending-dana prompts, self-service cancellation.
- **My Courses** — `/account/courses`. Enrolled courses + access.
- **Account lifecycle** — `/account/welcome` (Community Care Agreements for first-time members), `/account/reactivate` (archived-member reactivation). Both sit *outside* the `(authenticated)` gate so its redirects can't loop.

### Administration surfaces

`/admin/*` remains role-gated per feature but now renders inside the shared account shell. Session 162 standardized the Member Registry, households, hub administration, email manager, and Zoom diagnostic around semantic page headings, restrained tables/forms, responsive overflow, and the compact authenticated type scale. The shell provides orientation only; existing page/API authorization remains authoritative.

---

## Offerings — Programs & Registration

The **offering model** (Programs vs Courses, the orthogonal access flags, the kind/registration two-axis) is canonically documented in `RIM_Offering_Model.md`. Read it before any registration/enrollment work.

### Programs
`Program` + `ProgramCategory` + `ProgramCoverageHub`. A program carries schedule (structured `startDatetime`/`endDatetime` + recurrence: `recurrenceFreq`/`recurrenceInterval`/`recurrenceDays`/`recurrenceCount`), format (in-person / virtual / hybrid), venue, dana config, hosting hub, and auto-cached date/time labels (`lib/programUtils.ts`, recomputed server-side on every write).
- **Offering KIND** — `ProgramCategory.kind` (`lib/programKind.ts`: DROP_IN / COMMUNITY_GROUP / CLASS / EVENT / RETREAT / SERVICE / PRIVATE). The category *name* is editorial; *kind* drives behavior via `isOpenlyDroppable(kind, registrationEnabled)` (session 137).
- **"No host needed"** — `Program.hostingRequired` (default true; the toggle on the editor's Hosting & Access tab). False = self-led / community-led (Recovery Dharma, drop-in groups): excluded from the Scheduler, standing-rotation generation, and the new-program-needs-host email — never shown as "Needs Coverage." It governs the **primary host only** (auxiliary AV/greeter coverage is independent), and does NOT affect the public schedule, dashboard, program page, or the session room. Session 142. The third axis beside kind + registration (*does any team staff it*).
- **Occurrence logic** — `lib/scheduleUtils.ts::isOccurrenceOnDate` (shared by dashboard, This Week, Scheduler, standing rotations, session-room join gate). `endDatetime` is a per-occurrence end *time*, not a series cutoff, for recurring programs (session 137 fix). **Monthly recurrence is weekday-of-month** (session 153): a MONTHLY program repeats on the same weekday-and-position as its start date — "last Sunday", "2nd Wednesday" ("last" stays last in 5-week months) — derived from `startDatetime`, no extra field. Labels read "Last Sunday of the month" (via `monthlyPatternPhrase`, mirrored across the four `computeDateText`/`buildDateLabel` copies + the recache). The `.ics` export still recurs by date-of-month (backlog `2026-06-17-004`).

### Registration
`Registration` with `RegistrationStatus` (**PENDING_PAYMENT** / REGISTERED / WAITLISTED / APPROVED / CANCELLED) and `DonationStatus` (NOT_REQUIRED / PENDING / COMPLETED / WAIVED). **Completion-follows-the-choice model** (session 136): free → registered + confirmation at submit; voluntary dana → registered at submit, confirmation deferred to give/decline; required payment → a held `PENDING_PAYMENT` row (no account, no email, holds a seat, invisible everywhere) completed by the Stripe webhook on payment, discarded on abandonment. Single confirmation choke point `lib/registrationConfirmation.ts` (also fires the support@ notification).
- **Routes/API:** `/api/registrations`, `/api/registrations/[id]`, `/api/registrations/[id]/decline-dana`, `/api/account/registrations/[id]/cancel`, `/api/programs/[slug]/registrations` (CSV export), `/api/programs/[slug]/ical`, `/api/programs/[slug]/send-reminder`.
- **Member self-service:** cancel a registration (`CancelRegistrationButton`); update questionnaire responses via a registrar-sent tokenized link (`/update/[token]` + `editToken` on `Registration`).
- **Dana & Stripe:** `danaMode` ∈ none / voluntary / base_plus_dana / fixed; Stripe Checkout (`/api/stripe/checkout` + `/api/stripe/webhook`); `Donation` write-only ledger.
- **Calendar & reminders:** `lib/calendarLinks.ts` (Google + `.ics`), reminder emails via the `send-reminders` cron.
- **See:** `RIM_Registration.md`.

### Program Manager tool
`/tools/programs` — program CRUD, scheduling, registration settings, categories. REGISTRAR / ADMIN.
- **Routes:** `/tools/programs`, `/tools/programs/new`, `/tools/programs/[programSlug]`, `/tools/programs/[programSlug]/edit`, `/tools/programs/categories` · **API:** `/api/programs-pg/*`, `/api/programs-pg/categories/*`.
- ProgramEditor tabs: Content / Schedule / Hosting & Access / Categories / Registration / Dana / Visibility. The Registration tab carries a read-only "How this appears to visitors" readout (session 138).
- **See:** `RIM_ProgramEditor.md` (full ecosystem trace, access, hub context, editor and design contract).

---

## Offerings — Courses & Learning

`Course` + `Lesson` + `CourseLesson` + `CourseCategory`, with `CourseAccess` (manual grants), `SeriesEnrollment` (enrollment), and `ProgramCourse` (a program can unlock a course). Course access uses orthogonal flags (`allowSelfEnroll`, `selfEnrollDanaRequired`, `requiredRoles`, …) resolved by `lib/courseAccess.ts::getCourseAccessState`; dana parity with programs (four modes). Session 123 brought the course editor to program-editor parity.
- **Public:** `/course/[slug]` (landing), `/courses`, `/lessons/[slug]` · **API:** `/api/courses/[slug]/checkout`, `/api/courses/[slug]/enroll`, `/api/courses/categories`.
- **Lessons** carry rich media — `heroImageUrl`, `audioUrl` (in-page `AudioPlayer`), `videoUrl` (YouTube/Vimeo), downloadable `resources`, `durationMinutes` — plus progress (`LessonProgress`), notes (`LessonNote`), and per-lesson teachers (`LessonTeacher`). API under `/api/lessons/[slug]/*`.
- **Course Manager tool** — `/tools/learning` (+ `/[courseSlug]`, `/new`, `/lessons`, `/lessons/[lessonSlug]`, `/lessons/new`). TEACHER / ADMIN. 8-tab editor (Content / Lessons / Landing / Categories / Access / Schedule / Dana / Visibility).
- **See:** `RIM_Offering_Model.md`, `RIM_CourseEditor.md`.

---

## Hubs — team workspaces

Hubs are team-centric workspaces. Each provides **Home**, **Activity**, **Conversations**, **Documents**, **Mind Maps**, **Members**, and coordinator-gated **Trash** views inside one shared hub rail. `HubType` ∈ OPERATIONAL / GOVERNANCE / COMMUNITY_GROUP; all managed at `/admin/hubs` (the source of truth for the full set — ~16 hubs). Tool-linked hubs: **host-team**, **courses**, **registrar**, **support**. Scheduler-using hubs also include **peer-led-silent-meditation**, **audio-visual**, **greeter**.

- **Workspace routes:** `/account/hub/[slug]` + `/activity`, `/conversations`, `/conversations/[id]`, `/documents`, `/documents/[id]`, `/documents/[id]/edit`, `/documents/new`, `/mindmaps`, `/members`, `/trash`. API under `/api/hub/[slug]/*` and `/api/hubs/[slug]/*`.
- **Documents** — rich-text + PDF upload (Vercel Blob), per-document Basecamp-style notifications (`HubDocumentNotification`), document conversations (`HubConversationThread.documentId`), author/ADMIN/GT lock + presence.
- **Conversations** — threads with a subscription model (`HubThreadSubscription`: subscribers get every reply), Follow/Unfollow, editable categories, emoji reactions (reactor names on hover, plus a compact tap-to-reveal list for mobile), and per-reply edit/delete (author edits own; author or coordinator/GT/ADMIN deletes — session 141).
- **Three-stage lifecycle** — Active → Archived → Trash (`archivedAt` / `deletedAt` on documents and threads). Trash gated by `canManageTrash`.
- **Activity stream** — `/activity`, a computed union of document + conversation events.
- **Membership as authority** — `HubMember` is authoritative for hosting capability, communications, and pause status when a row exists (`lib/hubMemberAuth.ts`); coordinator-owned fields; no-delete-on-role-revoke. See `RIM_System_Architecture.md` ("Hub Membership as Authority").
- **Access door** — `lib/hubAuth.ts::canAccessHub(member, roles)`: a `HubMember` row **or** `GUIDING_TEACHER` (session 135). ADMIN-alone does not get hub *content* access (it configures from `/admin/hubs`).
- **See:** `RIM_Hub_Model.md`, `RIM_Hub_Engineering.md` (the four routing layers every callsite must respect).

### Hub admin
`/admin/hubs`, `/admin/hubs/new`, `/admin/hubs/[slug]/edit` — create/edit/archive hubs, app links, coverage copy, schedule flags. ADMIN only. New hubs auto-write a coordinator `HubMember` for the creating admin.

---

## Mind Maps

A spatial brainstorming surface for the Sangha (session 160) — a draggable canvas of **topics** organized into branches, where **each topic opens a real conversation**. RIM's **second portable resource** after Documents, and a **built-in hub module** alongside Documents/Conversations. Built on `@xyflow/react` (React Flow). Read **`RIM_MindMaps.md`** before touching any mind-map surface.

- **Create/edit** — `/account/mindmaps` (cross-hub directory: your hubs → Community → Projects) and the per-hub **Mind Maps tab** `/account/hub/[slug]/mindmaps`. The canvas editor at `/account/mindmaps/[id]` (full-screen React Flow): add/rename/note/drag/**reparent** topics, **floating edges**, **"Tidy up"** auto-layout, debounced **autosave**.
- **Portable** — `MindMap` + `MindMapNode` (+ `MindMapPlacement`); created standalone or hub-owned, **shared into other hubs** with **visibility** (Hub / Coordinators / Community) and a per-map **edit option** (`editPolicy`: collaborative *vs* coordinators-only) via the share modal. Access via `lib/mindMapAuth.ts::canAccessMindMap` (mirrors `canAccessDocument`).
- **Conversation per topic** — one shared discussion per topic across every hub the map's in, anchored via `HubConversationThread.mindMapNodeId` (reuses the conversation tables behind map-scoped routes; `lib/mindMapConversation.ts`). Plain-text comments, 5-emoji reactions, Follow/Unfollow; coordinators of the map's hubs auto-follow; followers emailed via the **`mindmap-topic-comment`** template.
- **Routes/API:** pages above + `/api/mindmaps`, `/api/mindmaps/[id]` (+ `/placements`, `/visibility`), `/api/mindmaps/[id]/nodes/[nodeId]/{conversation,follow}`, `/api/mindmaps/[id]/comments/[replyId]/react`. CSS prefix `mm-`.
- **Deferred:** rich-text comments, comment-count badges, per-topic unread, comment edit/delete, real-time multiplayer.

---

## Scheduler & Hosting

The **Scheduler** (`/tools/schedule`) is the staffing tool: a calendar + card list where hosts claim sessions, request subs, and coordinators run standing rotations — all scoped per hub via `?hub=`. HOST / HOST_MANAGER / ADMIN / active member of the active hub; the Rotations tab is coordinator-gated.

- **Routes:** `/tools/schedule`, `/tools/schedule/program/[slug]` (cross-hub staffing view).
- **Assignments** — `HostAssignment` (per `programSlug` + `sessionDate` + `hubSlug`). API `/api/host/assignments`, `/api/host/assignments/[id]`, `/clear`, `/reassign`.
- **Sub-requests** — `SubRequest` / `SubClaim` (`SubStatus`). API `/api/host/sub-requests`, `/[id]`, `/[id]/claim`. (Multi-claim hubs have no sub-request semantic — release-my-claim only.)
- **Standing rotations** — `StandingAssignment` (`StandingOccurrence` 1st–5th, patterns) applied forward by `lib/applyStandingAssignments.ts` + the `apply-standing-assignments` cron. API `/api/host/standing-assignments` + `/[id]`, `/apply`, `/preview`, `/end-bundle`, `/release-host`, `/api/host/programs/[slug]/clear-rotations`.
- **Auxiliary-hub coverage** — `ProgramCoverageHub` lets one program be staffed by many hubs, each a different role; single-slot (host-team / peer-led / audio-visual) vs multi-claim open sign-up (greeter). `Hub.allowsMultipleAssignments` + `Hub.appliesToFormats`.
- **Hub-configurable copy** — `coverageNoun` / `coverageVerb` / `coverageAction` on `Hub` (so "host" reads "AV" / "Greeter" / "Facilitator" per hub).
- **Coordinator gap-first + assign-in-place** (session 140) — a per-gap "Assign someone…" picker lets a coordinator (incl. hub coordinators) fill an uncovered session in place. The same session hardened the rotation editor: "Replace all" now protects manual self-claims, pattern-editor removals clean up orphaned assignments, and the conflict modal is hub-scoped.
- **Trust + clarity finish** (session 141) — "Enter room →" shows only when a session is actually enterable; entry-window timing unified in `lib/sessionWindowConstants.ts` (host/early-open 30 min before, member "Join now" 10 min before, close +30); the coverage-gap banner folded into an amber "Needs help" pill; the cross-hub staffing link deep-links to the Rotations editor; and the rotation editor confirms a save **in place** (a "✓ [Day]'s rotation saved" panel with the next sessions). A desktop Coverage grid was built and reverted (fragile on mobile + multi-day programs) — the time-ordered agenda stays the coordinator's home.
- **Coordinator coverage authority** (sessions 142–143) — a hub coordinator (not just HOST_MANAGER/ADMIN) can now manage their own hub's coverage end-to-end: **assign** (s140), **remove/unassign** + **reassign-to-me** (covered rows), **clear a cover request** (needs-sub rows), and **request a sub on a host's behalf** (s143 — an "Ask the team to cover" button on a covered row, with a host-named modal). Every coverage mutation route gates on `isManager(roles) || isHubCoordinator(resource.hubSlug)`, scoped to the assignment's own hub — a plain host still acts only on their own; no privilege escalation. Removing a host notifies them — on both the single-slot unclaim and the greeter `DELETE` (s143: a greeter coordinator's removal now emails the removed person, while a self-cancel stays silent — distinguished by `removedUserId !== self`). **Multi-hub note:** the Scheduler is one surface shared by four hubs that use it differently (host-team/peer-led single-slot; AV single-slot aux; greeter multi-claim aux). "No host needed" scopes to the primary host only; single-slot affordances never render on greeter (multi-claim) rows. **Any change to the Scheduler must be checked in both directions** — see `RIM_Scheduler.md`.
- **Membership invariant + per-hub gating** (session 146) — "covers ⇒ member": anyone assigned to cover a session in a hub must be a member of that hub. The Scheduler is gated **per-hub** (`lib/hubAuth.ts::canAccessHubScheduler` — a member of the hub OR HOST_MANAGER/ADMIN/GT) at the page, the month-nav GET, and the create POST (previously tool-level only, so any HOST role-holder could open any hub's board). Enforced at every write — self-claim auto-enrolls, assign-others requires membership, Step-In auto-enrolls, the apply cron drops non-member candidates, member hard-removal cleans up their future assignments + rotation rules — plus a one-time heal for existing orphans. Fixes the "shown as covering but absent from the member picker" class (the `HostAssignment` ledger vs the `HubMember` roster disagreeing). The member-view pill filter is now claimant-aware (`sessionBelongsTo`), and the multi-claim header + empty-state speak the hub's coverage noun/verb. See `RIM_Scheduler.md` ("The membership invariant").
- **See:** `RIM_Scheduler.md`.

---

## Session Room — Zoom (LiveKit retired, session 159)

> **✅ Sessions run on Zoom (cutover complete, session 159) — "RIM orchestrates, Zoom is the room."** RIM keeps everything it does well (program → auto-provision → assignment → dashboard "Join" → host identity); **Zoom is the actual room** (native app: familiar, reliable, best echo cancellation, phone dial-in). Every virtual/hybrid program's "Join" routes to `/session/[slug]/enter` → a Zoom meeting is provisioned on a pool seat → member (or open-access guest) joins by name; designated host / alternate / teacher get a one-tap Claim-Host code. The legacy `/session/[slug]` URL redirects to `/enter`. The in-browser LiveKit room was **retired** (code removed; `useZoom` flag dropped). **`RIM_Zoom.md`** is the integration reference — account model, S2S provisioning, per-occurrence meeting + self-heal, own-name hosting, the no-registration/rate-limit pitfall, cutover. Host-facing guide: `ZOOM_HOST_GUIDE.md`. **The LiveKit feature detail below is historical** (the retired room).

**Current state (the Zoom orchestration — session 159):**
- **Scheduling integrity** — Zoom meetings are per-occurrence on a 2-seat pool. Editing a program's schedule tears down its stale future meeting so it can't orphan on a seat (Layer 1), and saving runs a recurrence-aware seat-conflict check that warns the coordinator — non-blocking — when overlaps would exceed the seats (Layer 2, `lib/sessionConflicts.ts`, surfaced as a banner in the ProgramEditor). See `RIM_Zoom.md` → "Scheduling integrity."
- **Host guides** — `ZOOM_HOST_GUIDE.md` (signing in + claiming host), plus two volunteer companions given to Jesse to place ("Once You're Hosting", "What It Means to Host at RIM"). The old `SESSION_ROOM_FOR_VOLUNTEERS.md` is retired (a Zoom tombstone); the in-app `host-session-room` manual chapter is LiveKit-stale (reseed pending).

_The remainder of this section is historical — the retired LiveKit room._

Each virtual/hybrid program has a full-page video room at `/session/[slug]` (self-hosted LiveKit on DigitalOcean as of session 150 — migrated off LiveKit Cloud for cost; server `wss://livekit.rootedinmindfulness.org`. **Noise cancellation is RNNoise** — in-browser (session 151), replacing Cloud-only Krisp; Bell mode preserved. Originally LiveKit Cloud, replaced Google Meet in session 86; Zoom-aligned redesign session 117). Members join from their dashboard with only their RIM login — no Google/Zoom accounts, no downloads.

- **Permission model** — identity vs. capability split (`lib/livekitAuth.ts::resolveSessionRole`): `isSessionHost` (assignment-only) drives the Host pill; `hasEndAllAuthority` (Host + ADMIN + GT + teacher-when-no-host) drives End-for-All; `isCoHost` drives mute-others / share / Bell mode / **remove participant**. Two session-true identity pills (Host / Teacher); the capability-as-identity "Host Volunteer" pill was removed (session 151) — co-host controls still work, just unlabeled.
- **Features** — custom Zoom-style control bar (**centered cluster with End pinned right** — session 149), Speaker/Gallery toggle, persistent chat with DMs (`SessionChatMessage`), **chat + participants share a right column on desktop (overlay on phones)**, local Pin, fullscreen screen share, raised-hand speaking queue, persistent ✓/✗ vote signals + timed ❤️/🙏 reactions, **ask-to-unmute** (co-host invites from a participant's **tile hover** or the roster; member taps — session 149 added the tile surface), a **decluttered roster** (clean name + role pill; the mic glyph + empty signal gap removed — session 149), three-way audio profiles, H.264 + simulcast, **RNNoise noise cancellation** (in-browser, session 151) with a **Bell mode** toggle (passes bells/bowls unfiltered), a **custom synchronous focus layout** (session 151 — stage + filmstrip, replacing LiveKit's looping CarouselLayout), crisp screen share (1440p capture + detail hint + 8 Mbps), greenroom join-muted/unseen flow, **first name + last initial** on tiles/roster/chat. Device settings always offer **Default** (resets a saved camera/mic — session 157); listener audio raised to 96 kbps (session 157). Tiles crop-to-fill (`object-fit: cover`), Zoom-style — kept deliberately.
- **Host controls** — mute-others, **Mute All (on the control bar — session 149)**, End-for-All, ask-to-unmute, **context-aware Step-In** (button reads "No host yet — Step in" / "Take over as host" by detected host-presence, with a confirm), and **Remove participant** (co-host gated; remove-can-rejoin OR remove-for-the-session, the latter writing a `SessionBan` row the token/guest-token/step-in routes all honor; removed users see an honest "You've been removed" screen). Session 147. **Host Spotlight** (session 157) — a co-host pins one participant onto everyone's stage (distributed via room metadata; a viewer's own pin still wins; auto-clears when the spotlighted person leaves).
- **Crash safety net** (session 147) — `RoomErrorBoundary` wraps the room: any render crash (e.g. the screen-share receiver crash that white-screened every remote participant via Next's default error page) degrades to a contained "Something interrupted the room — Rejoin" screen and logs `[rim-room-crash]` + component stack, instead of taking down the whole app. **The specific screen-share crash was root-caused + fixed in session 151** (a React #185 measure-loop in LiveKit's `CarouselLayout` → replaced with a custom synchronous focus layout).
- **Keyboard mute controls** (session 147) — **`M` toggles mute for everyone** (the free answer to self-echo: mute while others talk); **hold `Space` for push-to-talk, co-hosts/teachers only** (talk while muted, release to re-mute). Both ignore keystrokes while typing in a field; push-to-talk engages only when already muted and has window-blur + visibilitychange backstops so it can't get stuck open. See `RIM_SessionRoom.md` → "Keyboard controls."
- **Time-gated tokens + per-session rooms** — tokens refuse outside the session window (`lib/sessionWindow.ts`); room names are `slug-YYYY-MM-DD` so chat + session bans scope per session. API: `/api/livekit/token`, `/guest-token`, `/chat`, `/end-session`, `/mute-participant`, `/mute-all`, `/step-in`, `/remove-participant`.
- **Open Access** — `isOpenAccess` + `guestAccessKey` allow guest join at `/session/[slug]?key=…` (`/api/livekit/guest-token`).
- **Audio & echo** (session 147 decision) — echo cancellation is on for all profiles; self-echo is an *endpoint* problem (a source on speakers / split-device, which browser AEC can't fully cancel), not a code bug. Fix is endpoint-side (headphones/output routing). LiveKit Krisp **BVC** (in-room background-voice-cancellation) is the escalation but needs the **Ship plan (~$55–90/mo)** — shelved on cost. Native-app rebuild rejected (session 120, reaffirmed). Full rationale in `RIM_SessionRoom.md`.
- **Pre-launch hardening** (session 144) — a multi-agent integrity audit + fixes across security (testRoom ADMIN gate, guest chat-identity binding, rate-limiting on chat + guest-token), reliability (connect-failure recovery, truthful disconnect screens, audio-only join for no-camera devices, reconnecting banner), host controls (End-for-All now fails loudly, mute resilience), Step-In concurrency (per-session advisory lock), and a forge-proof guest badge. Per-finding detail in `RIM_SessionRoom.md`.
- **See:** `RIM_SessionRoom.md` and the Video Conferencing section of `RIM_System_Architecture.md` (the authoritative permission model). Host/volunteer-facing changelog: `SESSION_ROOM_FOR_VOLUNTEERS.md`.

---

## Member Registry & Admin

- **Member Registry** — `/admin/members`, `/admin/members/[id]`. The canonical member record (profile, status, tags, roles, course access, teacher profile, household). Uses the **section registry pattern** (`lib/memberSectionRegistry.tsx`); sections gated by role or per-viewer `sectionGrants`. ADMIN + REGISTRAR. API `/api/admin/members/*`.
  - **Add member** (session 142) — a "+ Add member" modal + `POST /api/admin/members` creates a person directly (the deliberate use case is **pre-launch staging**: add a host who isn't a participant yet, then assign their role + schedule). Created as a **staged account** — no `agreedToTerms`, no `emailVerified`, no email — so it's silent until they complete the normal new-member sign-up (which matches by email, updates their name, and preserves everything wired to the id). Kept alive by the cleanup-cron's staged-account guard (role/hub holders aren't swept); kept silent by the pre-threshold email gate (see Notifications). ADMIN + REGISTRAR.
  - **Legacy migration & the quiet pool** (session 145) — ~1,500 Memberstack members were imported as inert **`isLegacyUnclaimed`** accounts: silent (pre-threshold gate), cleanup-cron-exempt, and **hidden from the default registry** (server-side `where` = OR of `isLegacyUnclaimed:false` / has-role / has-hub). A `?pool=legacy` toggle reveals them with a muted "Unclaimed" status pill. They promote into the active list automatically when they first log in and cross the agreement gate (`isLegacyUnclaimed → false` at both the `/login`→complete-profile and `/join` doors), preserving any pre-staged role/hub/schedule. Memberstack activity is parked on the existing `legacy*` columns. The one-time browser import tool (`/admin/import-legacy`) was used and then removed. See `RIM_Auth.md`.
  - **Send sign-in code** (session 145) — an "Account access" action on the member profile (`POST /api/admin/members/[id]/send-signin`) sends the member a fresh 6-digit code (reuses `signIn("resend")`, rate-limited, refuses archived) — the pastoral "help a stuck member in," in place of a password reset.
  - **Name normalization** (session 145) — `lib/nameCase.ts::toProperName` proper-cases names on entry (join / registration / welcome / add-member) and a one-time migration cleaned existing rows. Conservative: only all-caps/all-lower are re-cased; intentional mixed-case (McDonald, DeShawn, van der Berg) is left as typed. Not applied to the admin member-edit or a member's own profile edit (the type-exactly hand-fix path).
  - **Hub memberships + Roles & access** (session 153) — the profile now has a **Hub memberships** (Teams) section: every active hub as **Off / Member / Coordinator**, the single place to set team membership (incl. pre-staging a legacy person by id), with role-derived hubs (Courses ← Teacher, Registrar ← Registrar) rendered locked "via role." Alongside it, a slimmed **Roles & access** section for system powers only. Built on `HubMember` + the shared `lib/removeHubMembership.ts` FK-safe cleanup, via `/api/admin/members/[id]/hubs`. The plain **HOST** role was retired here (host-team membership is now the source of truth for being a host); the legacy pool is excluded from every person-picker. ADMIN + REGISTRAR; GT excluded by design. See `RIM_MemberRegistry.md`.
- **Households** — `/admin/households`, `/admin/households/[id]`. Group members into family households with a shared address, an optional display name, and named relationships (`RelationshipType`: spouse / partner / parent / child / sibling / other). Surfaced on a member's profile via `HouseholdSection`; backed by `Household` / `HouseholdMember`. API `/api/admin/households/*`.
- **Teachers** — `TeacherProfile` (public profile + `isTeacher`), `ProgramTeacher` (links a teacher account to a program; drives the session-room Teacher pill + bell-friendly audio).
- **Email Template Manager** — `/admin/emails`, `/admin/emails/[slug]`. Database-backed (`EmailTemplate`); the source of truth for templated sends. See `RIM_Email_Engineering.md`.
- **Zoom self-test** — `/admin/zoom-test`. ADMIN diagnostic for the Zoom connection + provisioning round-trip. (The old `/admin/livekit-test` was removed with the LiveKit room, session 159.)

---

## Content & Editor

All rich-text authoring uses **`RimTiptapEditor`** (`components/rim-tiptap/`) — Tiptap 3, one component, four variants (`minimal` / `message` / `document` / `doc`), storing **plain HTML strings**. Custom blocks: Callout (note/decision), PullQuote, VerseQuote, PracticeSuggestion, Reflection. A selection bubble menu handles inline marks; the top toolbar handles insertion. Output renders into `.rim-content` wrappers. Legacy BlockNote was fully removed in session 97; renderers still format-detect to display any unmigrated rows.
- **See:** `RIM_Editor_Types.md` (canonical reference — block library + placement registry).

> **Direction shift (session 163):** **Google Workspace is replacing native documents as RIM's document & file system** — see the Google Workspace Files section below. Native documents remain live and coexist until the cutover (Slice 4); the two document surfaces sit side by side (Documents tab + Files tab) during the transition.

**Native documents, filing & directory** — Native documents are the supported in-RIM writing path: a full-screen Tiptap editor with an optional directory summary, single-editor presence/stale-save safeguards, and true Markdown plus print-to-PDF export. Links and uploaded PDFs remain useful resources. Each hub's Documents tab leads with **"Updated <when>"** freshness, search across title/summary/category/author, and recency-first category groups. Categories are tended, not gated. One canonical document can be shared into other hubs through `HubDocumentPlacement`; visibility is Hub / Coordinators / Community and the origin hub owns the lifecycle. The master directory at `/account/documents` gathers each document a member can access. The `ONLYOFFICE` test system was retired in session 161; see `RIM_Documents.md` for the supported model and `RIM_OnlyOffice.md` for the retirement record.

---

## Google Workspace Files (in progress — session 163)

RIM's document & file system is moving to **Google Workspace** — "RIM orchestrates, Google is the file cabinet" (the Zoom pattern applied to files). Google provides the editors (Docs/Sheets/Slides), storage (PDFs/audio/images), real co-editing, and version history; RIM keeps identity, team membership, permissions, and the calm front door. **Authority: `RIM_GoogleWorkspace.md`.** Being built slice by slice; **replaces native documents** at cutover (they coexist until then).

- **The model** — one Google Cloud **service account** (`rim-files@…`) is RIM's only Google identity, a Manager on each org-owned Shared Drive. **No member or volunteer gets a Google account.** RIM's database is the permission system; the service account performs every Drive operation server-side. Editing uses **link-as-key** (files are anyone-with-link-editable; RIM hands the link only to authorized members — the accepted Zoom-style trade); reading happens **inside RIM** (Google Docs rendered from sanitized HTML export, so members need zero Google literacy). **Drive folders are the filing system**, live-browsed so Drive is the source of truth and can't drift.
- **Shipped (Slices 1–2):** server-only `lib/google/*` (JWT via `node:crypto`, no new deps) + `lib/googleFiles.ts` (places + authorization: `getAccessiblePlaces` / `resolveDriveAccess` / `authorizeFileRequest` / `memberHasFilesAccess`, all one rule); `Hub.googleDriveId`/`googleRootFolderId`/`googleFilesEnabled` + the `GoogleFileAudit` model; the `/admin/hubs` Drive-mapping picker; the `/admin/google-test` diagnostic. The **Finder**: per-hub **Files** tab (`/account/hub/[slug]/files`) + system-wide `/account/files` (`FilesBrowser`) — places sidebar (Community + team drives), folders-first browse, breadcrumbs, phone drill-down; the in-app Google Doc reader (`/account/files/doc/[id]`); API `/api/files/list`, `/api/files/stream/[fileId]`, `/api/files/open/[fileId]`. CSS prefix `gf-`.
- **Access** — Community drive (matched by exact reserved name) is readable + editable by every signed-in member; hub drives require ACTIVE membership or GUIDING_TEACHER; ADMIN-alone does not pass (the session-128 boundary). The per-hub rollout switch is `Hub.googleFilesEnabled` (default off). Env: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (server-only).
- **Not yet built:** writing (Create doc / New folder / upload — Slice 3), cutover + native-doc migration (Slice 4), an **admin link revoke/lockdown** action (backlog `2026-07-14-001` — minted links are currently permanent), and per-folder scoping enforcement (`2026-07-14-002`).

## Notifications & Email

Transactional email via **Resend**. Most sends go through the database-backed template manager (`sendTemplatedEmail("slug", …)` → `EmailTemplate` row, markdown body authored at `/admin/emails` via `EmailTemplateEditor`). A small number are hardcoded inline-markdown sends (long-form, set-and-forget role assignments).
- **The Email Template Gate** (see `CLAUDE.md` + `RIM_Email_Engineering.md`): every `sendTemplatedEmail` call site must have a matching seed in `prisma/migrate.mjs` or the recipient silently gets nothing.
- **URL helpers** — `hubScopedUrl` / `hubHomeUrl` keep outbound links hub-correct; `emailButtonHtml` is the canonical CTA button.
- **Pre-threshold gate** (session 142) — member-directed *team* emails (role-assigned, hub-welcome, host/standing-assignment, new-program-needs-host, hub conversations/documents/sub-requests) are suppressed for accounts that haven't completed sign-in (`emailVerified === null`), so an admin can pre-stage a person before launch and they stay silent until they personally log in. Two layers: `getHubNotificationRecipients` excludes `emailVerified:null` members (covers every hub-pool email), and `recipientHasOnboarded` + `PRE_THRESHOLD_GATED_SLUGS` in `lib/email.ts` cover the direct/1:1 and subscription/document emails. **Sign-in codes and the join-welcome letter are deliberately NOT gated** (they must reach mid-signup people). See `RIM_Email_Engineering.md`.
- **Every scheduler hub gets the new-coverage heads-up** (session 146) — when a program is tagged for an auxiliary hub's coverage (AV / greeter), that hub's team is notified the same way the primary host hub is: on create AND when added on edit (the `programs-pg` PUT diffs `coverageHubSlugs` against existing rows so re-saving doesn't re-notify; removals stay silent). Helper `lib/email.ts::notifyHubOfNewProgramCoverage`; reuses the hub-neutral `new-program-needs-host` template (each hub's own coverage noun + scoped link). The shared-base principle: every hub behaves the same, differing only by its copy and needs.
- **Hub-relative coverage copy** (sessions 130, 145) — shared host/sub emails read the assignment hub's `coverageNoun`/`verb`/`action` (or stay hub-neutral) so an AV/greeter member never sees "host." The standing-rotation builders take a `coverageCopy` param; the assignment/sub/new-program templates were re-seeded hub-neutral (`update_coverage_email_copy_v1`; `new-program-needs-host` gains `{{coverageNoun}}`).
- **`welcome-back`** (session 145) — a returning legacy member's one-time letter, fired on promotion from the agreement-completion endpoints (the returning counterpart of `join-welcome`).
- **Reliability** — background sends use `after()` from `next/server` (not `void`/`.catch`), which survives Vercel serverless teardown.
- **See:** `RIM_Email_Engineering.md`.

---

## Platform infrastructure

- **Crons (5, in `vercel.json`):** `send-reminders` (0 14 * * *), `cleanup-incomplete-accounts` (0 5), `apply-standing-assignments` (0 8), `cleanup-rate-limits` (15 10), `cleanup-pending-registrations` (30 5). All validate `CRON_SECRET`.
- **Data model** — `prisma/schema.prisma` (54 models/enums) is canonical. Migrations + idempotent seeds run through `prisma/migrate.mjs` (flag-guarded via `MigrationFlag`).
- **File uploads** — Vercel Blob via `/api/upload` (images in editors, PDFs in hub documents).
- **CSS** — all custom styles in `public/css/custom.css`, per-page prefixes + design tokens. Rules + the two hygiene scripts (`css-prune.mjs`, `css-cut.mjs`) are in `CLAUDE.md`. Never edit `normalize.css` / `webflow.css` / `rim.webflow.css`.
- **Redirects (8, in `vercel.json`)** — legacy paths fold into current ones (`/account/registrar*` → `/tools/programs*`, `/account/hub/teacher*` → `/account/hub/courses*`, `/account/dashboard-my-registrations` → `/account/programs`, `/account/dashboard-my-library` → `/account/courses`, …).
- **Tool access** — `lib/toolRegistry.ts` is the single source of truth for the 3 tools; `hasToolAccess()` resolves role, hub-membership, or individual `UserToolAccess` grants.

---

## Removed / superseded features

Kept as a tombstone so future work doesn't re-discover or re-propose them. Full detail survives in git history + `session-log.md` (and `CLEANUP.md` where code residue remains).

| Feature | Removed | Why | Detail |
|---|---|---|---|
| Google Meet integration | s86 | Replaced by LiveKit | session-log s86 |
| Support Inbox (+ security hardening) | s100 | Never launched to volunteers; support@ read via Gmail directly | session-log s100; `Role.SUPPORT` enum value still residual → `CLEANUP.md` |
| Tasks module (TaskList/Task/Subtask) | s96 | Never adopted in practice | session-log s96 |
| Alerts module (Alert + AlertType) | s96 | Bell UI never shipped | session-log s96 |
| Virtual Host Attendance + Session Tracking | s89 | Built s43–45, never reached operational use | session-log s89 |
| Site-Wide Banner | s100 | Removed | session-log s100 |
| Sanity Studio access for staff | s54 | Programs/courses/lessons left Sanity for Postgres | session-log; Sanity now effectively retired |
| Course drip system | s100 | No courses used it | `CLEANUP.md` #37 |
| Memberstack CSV import (+ `legacyMemberstackId`) | s100 | Migration complete | `CLEANUP.md` #43 |
| Phase-2 scaffolding (MembershipType / UserMembership / AttendanceRecord) | s100 | Speculative; never used | `CLEANUP.md` #44 |
| UserHubAccess model | s100 | `HubMember` is authoritative | `CLEANUP.md` #40 |
| `/account/host` "Host Area" | — | Superseded by hubs + the Scheduler tool | session-log |
| BlockNote editor (RimBlockEditor / RimProseEditor) | s97 | Replaced by `RimTiptapEditor` | session-log s97 |
| Staff Manual (in-app) | s139 | Unused; was woven across ~50 sites + 35 seed scripts. `manual_sections` table left dormant | session-log s139; `CLEANUP.md` |
| Schedule PDF export | s139 | Unused; `@react-pdf/renderer` now removable | session-log s139; `CLEANUP.md` |
| Reflection Questions (lesson Q&A) | s139 | Unused; kept the separate `reflectionPrompt`. `reflection_*` tables + `questionsRequired` column left dormant | session-log s139 |

---

## Planned / not built

To avoid a second home for "things we might build," this file does **not** keep its own planned-features list. Instead:
- **Absences** (designed/discussed, never built — e.g. self-service email change, a Donation Management read UI, member self-check-in) live in `CLEANUP.md` under **"Not on this list."**
- **Wants** (prioritized feature requests) live in `data/backlog.json`.

When one of those ships, it gets a real entry above and is removed from its list.
