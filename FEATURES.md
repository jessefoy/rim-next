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
| Scheduler tool | `RIM_Scheduler.md` |
| Session room (LiveKit) | `RIM_SessionRoom.md` |
| Email engineering (template gate, helpers) | `RIM_Email_Engineering.md` |
| Editor surfaces, blocks, placements | `RIM_Editor_Types.md` |
| Data model (canonical) | `prisma/schema.prisma` |
| Session history · in-progress · cleanup · backlog | `session-log.md` · `UP_NEXT.md` · `CLEANUP.md` · `data/backlog.json` |

---

## Platform at a glance

RIM Next is a **single, integrated Next.js 16 (App Router) application**. Public pages, member accounts, registrations, online courses, hubs, volunteer tools, the API, the database, business logic, scheduled jobs, the Tiptap editor surfaces, and the LiveKit session room all live in this one app.

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
Seven roles in the `Role` enum: **HOST**, **HOST_MANAGER**, **REGISTRAR**, **ADMIN**, **TEACHER**, **SUPPORT**, **GUIDING_TEACHER**. Assigned via the Member Registry (`/admin/members/[id]` → "Roles" / "Sangha-wide authority"). `GUIDING_TEACHER` is dharma authority (soft-admin at the content layer across every hub); `ADMIN` is technical authority. `SUPPORT` is residual (the Support Inbox it served was removed in session 100 — see Removed table; flagged in `CLEANUP.md`).
- **See:** `RIM_Role_Design.md`, and the permission framework in `RIM_System_Architecture.md`.

### Route protection
Per-page `auth()` from `auth.ts`, plus a route-group layout at `app/account/(authenticated)/layout.tsx` that structurally enforces three gates for the whole authenticated member area: session present → `agreedToTerms` → not `archivedAt`. `proxy.ts` is an intentional no-op (NextAuth v5 + Prisma adapter can't verify sessions in Edge without login loops).

### Rate limiting
Postgres-backed fixed-window limiter (`RateLimitWindow`, `lib/rateLimit.ts`) on the sign-in and callback endpoints — cross-instance, no Redis. Daily cleanup cron. **See:** `RIM_Auth.md`.

---

## Public site

> The next major build area — these exist but are early/rough.

- **Community programs listing** — `/community-programs`. The public catalog of offerings, grouped by category.
- **Program detail** — `/programs/[slug]`. Hero, schedule, dana, and a **status-aware "what to do next" CTA** that keys off the offering kind + registration state (session 138): the viewer's own standing first (registered / waitlisted, surviving registration close), then Register → / Join the waitlist → / "Registration isn't open yet" / format-aware "how to join" for drop-ins.
- **Program registration** — `/programs/[slug]/register`. The registration form + dana step.
- **This Week schedule** — `/this-week`. Dynamic weekly schedule (Mon–Sun, `?week=next`), shared occurrence logic with the Scheduler.
- **Teachers directory** — `/teachers`, `/teachers/[slug]`. Public teacher profiles (`isTeacher` + `TeacherProfile`).
- **Public course pages** — `/courses` (index), `/course/[slug]` (public landing, mirrors program-detail shape), `/lessons/[slug]` (lesson reader, access-gated).
- **Join / membership threshold** — `/join`. The new-member door (see Auth).
- **Content / static pages** — `/diversity`, `/donate`, `/kalyana-mitta/*` (3: community-groups-events, guidelines, application), `/volunteerism/volunteer` + thanks page.
- **Nav & footer** — `components/Nav.tsx` (sticky, CSS-only dropdowns, `isMemberArea`/`isAdmin` aware), footer in the root layout.

---

## Member area (`/account`)

- **Dashboard** — `/account/dashboard`. The member home: "Today" (live/joinable sessions, host early-open window) and "Coming up for you" (registered offerings). Placement keys off offering kind + registration (session 137). `DashboardAutoRefresh` handles live-state epoch transitions. A one-time, dismissible **host-welcome panel** (session 143, `HostWelcomePanel`) greets a pre-staged host who's just onboarded — shown when they belong to a hub and have hosting assigned and haven't dismissed it (`User.hostWelcomeSeenAt`); links to their Scheduler view. Dismiss/follow → `POST /api/account/host-welcome-seen`.
- **My Profile** — `/account/dashboard-my-profile`. Name, contact, preferences; avatar + bio.
- **My Programs** — `/account/programs`, `/account/programs/[slug]`. Registration history, status, join button, calendar links, pending-dana prompts, self-service cancellation.
- **My Courses** — `/account/courses`. Enrolled courses + access.
- **Account lifecycle** — `/account/welcome` (Community Care Agreements for first-time members), `/account/reactivate` (archived-member reactivation). Both sit *outside* the `(authenticated)` gate so its redirects can't loop.

---

## Offerings — Programs & Registration

The **offering model** (Programs vs Courses, the orthogonal access flags, the kind/registration two-axis) is canonically documented in `RIM_Offering_Model.md`. Read it before any registration/enrollment work.

### Programs
`Program` + `ProgramCategory` + `ProgramCoverageHub`. A program carries schedule (structured `startDatetime`/`endDatetime` + recurrence: `recurrenceFreq`/`recurrenceInterval`/`recurrenceDays`/`recurrenceCount`), format (in-person / virtual / hybrid), venue, dana config, hosting hub, and auto-cached date/time labels (`lib/programUtils.ts`, recomputed server-side on every write).
- **Offering KIND** — `ProgramCategory.kind` (`lib/programKind.ts`: DROP_IN / COMMUNITY_GROUP / CLASS / EVENT / RETREAT / SERVICE / PRIVATE). The category *name* is editorial; *kind* drives behavior via `isOpenlyDroppable(kind, registrationEnabled)` (session 137).
- **"No host needed"** — `Program.hostingRequired` (default true; the toggle on the editor's Hosting & Access tab). False = self-led / community-led (Recovery Dharma, drop-in groups): excluded from the Scheduler, standing-rotation generation, and the new-program-needs-host email — never shown as "Needs Coverage." It governs the **primary host only** (auxiliary AV/greeter coverage is independent), and does NOT affect the public schedule, dashboard, program page, or the session room. Session 142. The third axis beside kind + registration (*does any team staff it*).
- **Occurrence logic** — `lib/scheduleUtils.ts::isOccurrenceOnDate` (shared by dashboard, This Week, Scheduler, standing rotations, session-room join gate). `endDatetime` is a per-occurrence end *time*, not a series cutoff, for recurring programs (session 137 fix).

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

---

## Offerings — Courses & Learning

`Course` + `Lesson` + `CourseLesson` + `CourseCategory`, with `CourseAccess` (manual grants), `SeriesEnrollment` (enrollment), and `ProgramCourse` (a program can unlock a course). Course access uses orthogonal flags (`allowSelfEnroll`, `selfEnrollDanaRequired`, `requiredRoles`, …) resolved by `lib/courseAccess.ts::getCourseAccessState`; dana parity with programs (four modes). Session 123 brought the course editor to program-editor parity.
- **Public:** `/course/[slug]` (landing), `/courses`, `/lessons/[slug]` · **API:** `/api/courses/[slug]/checkout`, `/api/courses/[slug]/enroll`, `/api/courses/categories`.
- **Lessons** carry rich media — `heroImageUrl`, `audioUrl` (in-page `AudioPlayer`), `videoUrl` (YouTube/Vimeo), downloadable `resources`, `durationMinutes` — plus progress (`LessonProgress`), notes (`LessonNote`), and per-lesson teachers (`LessonTeacher`). API under `/api/lessons/[slug]/*`.
- **Course Manager tool** — `/tools/learning` (+ `/[courseSlug]`, `/new`, `/lessons`, `/lessons/[lessonSlug]`, `/lessons/new`). TEACHER / ADMIN. 8-tab editor (Content / Lessons / Landing / Categories / Access / Schedule / Dana / Visibility).
- **See:** `RIM_Offering_Model.md`.

---

## Hubs — team workspaces

Hubs are team-centric workspaces. Each provides a **Home**, **Conversations**, **Documents**, **Members**, **Activity**, and **Trash** views. `HubType` ∈ OPERATIONAL / GOVERNANCE / COMMUNITY_GROUP; all managed at `/admin/hubs` (the source of truth for the full set — ~16 hubs). Tool-linked hubs: **host-team**, **courses**, **registrar**, **support**. Scheduler-using hubs also include **peer-led-silent-meditation**, **audio-visual**, **greeter**.

- **Workspace routes:** `/account/hub/[slug]` + `/activity`, `/conversations`, `/conversations/[id]`, `/documents`, `/documents/[id]`, `/documents/[id]/edit`, `/documents/new`, `/members`, `/trash`. API under `/api/hub/[slug]/*` and `/api/hubs/[slug]/*`.
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
- **See:** `RIM_Scheduler.md`.

---

## Session Room — LiveKit

Each virtual/hybrid program has a full-page video room at `/session/[slug]` (LiveKit Cloud, replaced Google Meet in session 86; Zoom-aligned redesign session 117). Members join from their dashboard with only their RIM login — no Google/Zoom accounts, no downloads.

- **Permission model** — identity vs. capability split (`lib/livekitAuth.ts::resolveSessionRole`): `isSessionHost` (assignment-only) drives the Host pill; `hasEndAllAuthority` (Host + ADMIN + GT + teacher-when-no-host) drives End-for-All; `isCoHost` drives mute-others / share / Bell mode. Three orthogonal metadata pills (Host / Teacher / Host Volunteer).
- **Features** — custom Zoom-style control bar, Speaker/Gallery toggle, persistent chat with DMs (`SessionChatMessage`), local Pin, fullscreen screen share, raised-hand speaking queue, persistent ✓/✗ vote signals + timed ❤️/🙏 reactions, three-way audio profiles, H.264 + simulcast, Krisp noise cancellation with a **Bell mode** toggle (passes bells/bowls unfiltered), greenroom join-muted/unseen flow, full names on tiles/roster/chat.
- **Time-gated tokens + per-session rooms** — tokens refuse outside the session window (`lib/sessionWindow.ts`); room names are `slug-YYYY-MM-DD` so chat scopes per session. API: `/api/livekit/token`, `/guest-token`, `/chat`, `/end-session`, `/mute-participant`, `/mute-all`, `/step-in`.
- **Open Access** — `isOpenAccess` + `guestAccessKey` allow guest join at `/session/[slug]?key=…` (`/api/livekit/guest-token`).
- **Pre-launch hardening** (session 144, on branch `claude/session-room-hardening` — not yet merged) — a multi-agent integrity audit + fixes across security (testRoom ADMIN gate, guest chat-identity binding, rate-limiting on chat + guest-token), reliability (connect-failure recovery, truthful disconnect screens, audio-only join for no-camera devices, reconnecting banner), host controls (End-for-All now fails loudly, mute resilience), Step-In concurrency (per-session advisory lock), and a forge-proof guest badge. Per-finding detail in `RIM_SessionRoom.md`.
- **See:** `RIM_SessionRoom.md` and the Video Conferencing section of `RIM_System_Architecture.md` (the authoritative permission model). Host/volunteer-facing changelog: `SESSION_ROOM_FOR_VOLUNTEERS.md`.

---

## Member Registry & Admin

- **Member Registry** — `/admin/members`, `/admin/members/[id]`. The canonical member record (profile, status, tags, roles, course access, teacher profile, household). Uses the **section registry pattern** (`lib/memberSectionRegistry.tsx`); sections gated by role or per-viewer `sectionGrants`. ADMIN + REGISTRAR. API `/api/admin/members/*`.
  - **Add member** (session 142) — a "+ Add member" modal + `POST /api/admin/members` creates a person directly (the deliberate use case is **pre-launch staging**: add a host who isn't a participant yet, then assign their role + schedule). Created as a **staged account** — no `agreedToTerms`, no `emailVerified`, no email — so it's silent until they complete the normal new-member sign-up (which matches by email, updates their name, and preserves everything wired to the id). Kept alive by the cleanup-cron's staged-account guard (role/hub holders aren't swept); kept silent by the pre-threshold email gate (see Notifications). ADMIN + REGISTRAR.
- **Households** — `/admin/households`, `/admin/households/[id]`. Group members into family households with a shared address, an optional display name, and named relationships (`RelationshipType`: spouse / partner / parent / child / sibling / other). Surfaced on a member's profile via `HouseholdSection`; backed by `Household` / `HouseholdMember`. API `/api/admin/households/*`.
- **Teachers** — `TeacherProfile` (public profile + `isTeacher`), `ProgramTeacher` (links a teacher account to a program; drives the session-room Teacher pill + bell-friendly audio).
- **Email Template Manager** — `/admin/emails`, `/admin/emails/[slug]`. Database-backed (`EmailTemplate`); the source of truth for templated sends. See `RIM_Email_Engineering.md`.
- **LiveKit test** — `/admin/livekit-test`. A diagnostic page for verifying LiveKit env/connectivity.

---

## Content & Editor

All rich-text authoring uses **`RimTiptapEditor`** (`components/rim-tiptap/`) — Tiptap 3, one component, three variants (`minimal` / `message` / `document`), storing **plain HTML strings**. Custom blocks: Callout (note/decision), PullQuote, VerseQuote, PracticeSuggestion, Reflection. A selection bubble menu handles inline marks; the top toolbar handles insertion. Output renders into `.rim-content` wrappers. Legacy BlockNote was fully removed in session 97; renderers still format-detect to display any unmigrated rows.
- **See:** `RIM_Editor_Types.md` (canonical reference — block library + placement registry).

---

## Notifications & Email

Transactional email via **Resend**. Most sends go through the database-backed template manager (`sendTemplatedEmail("slug", …)` → `EmailTemplate` row, markdown body authored at `/admin/emails` via `EmailTemplateEditor`). A small number are hardcoded inline-markdown sends (long-form, set-and-forget role assignments).
- **The Email Template Gate** (see `CLAUDE.md` + `RIM_Email_Engineering.md`): every `sendTemplatedEmail` call site must have a matching seed in `prisma/migrate.mjs` or the recipient silently gets nothing.
- **URL helpers** — `hubScopedUrl` / `hubHomeUrl` keep outbound links hub-correct; `emailButtonHtml` is the canonical CTA button.
- **Pre-threshold gate** (session 142) — member-directed *team* emails (role-assigned, hub-welcome, host/standing-assignment, new-program-needs-host, hub conversations/documents/sub-requests) are suppressed for accounts that haven't completed sign-in (`emailVerified === null`), so an admin can pre-stage a person before launch and they stay silent until they personally log in. Two layers: `getHubNotificationRecipients` excludes `emailVerified:null` members (covers every hub-pool email), and `recipientHasOnboarded` + `PRE_THRESHOLD_GATED_SLUGS` in `lib/email.ts` cover the direct/1:1 and subscription/document emails. **Sign-in codes and the join-welcome letter are deliberately NOT gated** (they must reach mid-signup people). See `RIM_Email_Engineering.md`.
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
