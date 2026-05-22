# RIM System Architecture
**Structural decisions and the reasoning behind them**

This document records the foundational architectural decisions for how RIM's member data system and volunteer hub system work together. It is not a features doc — that's FEATURES.md. It is not a design philosophy doc — that's RIM_Web_Design_Philosophy.md. It is the structural model that governs how those features are built.

**Claude Code: Read this before working on any hub, member data, role, or permission-related feature.**

**Companion docs:**
- `RIM_Offering_Model.md` — the canonical reference for Programs vs Courses as offering types, the orthogonal-flags access model on `Course`, and the Course detail page state matrix. Read this before working on any course/program/registration/enrollment feature.
- `RIM_Editor_Types.md` — the canonical reference for editor surfaces, blocks, and placements.
- `RIM_Role_Design.md` — roles, hubs, permissions.
- `RIM_Hub_Model.md` — hub model.

---

## The Two Systems

### Member Registry (`/admin/members`)

The Member Registry is the authoritative record of every person in the RIM community. It holds canonical member profiles: contact info, member status, household, tags, admin notes, registration history, course access, and role assignments.

**Who has direct access:** ADMIN and REGISTRAR only. No other roles should be granted access to `/admin/members`. This is not a filtering problem to solve — it is a boundary to maintain.

**What it is:** The system of record. Not a tool for volunteers to do their work. Not a filtered view for different roles.

### Hubs (`/account/hub/[slug]`)

Hubs are team workspaces for RIM's volunteer groups. Each hub serves one team. Members see only the hubs they belong to.

**Current hubs:** 14 operational hubs + 2 governance hubs, all manageable from `/admin/hubs`. The four hubs with linked tools are: Hosting Hub (`host-team`), Course Hub (`courses`), Registration Hub (`registrar`), Support Hub (`support`). Support Hub has no linked tools — its Support Inbox was removed in session 100.

**What they are:** Team-centric workspaces. Each hub provides a Home screen (with app links and coordinator content), Conversations (with pinned threads), Documents, and a Members tab. Dashboard hub cards show unread badges.

### Tools (`/tools/*`)

Tools are full-featured staff applications extracted from hubs. They serve one workflow, with their own navigation chrome and sub-pages.

**Current tools (3):**
- `/tools/programs` — Program Manager (REGISTRAR/ADMIN)
- `/tools/schedule` — Host Schedule (mini-cal + card list; HOST/HOST_MANAGER/ADMIN/hub coordinator). Rotations tab gated to `isManager` = HOST_MANAGER/ADMIN or host-team hub coordinator (session 111).
- `/tools/learning` — Course Manager: Courses + Lessons (TEACHER/ADMIN). As of session 123, the Course editor is a structural peer of the Program editor — same `pe-` chrome, same tab pattern (Content / Lessons / Landing / Categories / Access / Schedule / Dana / Visibility), same four-mode dana model, same category CRUD shape. The hub:tool boundary is intact: team coordination happens in the Course Hub (`/account/hub/courses`); course management happens in this tool.

**Tool access:** Role-based (via `hasToolAccess()`) OR individual `UserToolAccess` grants. Tool registry: `lib/toolRegistry.ts`. Hub awareness: `getToolHubContext()` resolves `?hub=` param to hub + members. Notifications: `getHubNotificationRecipients()` queries hub members (not roles).

**The distinction:** Hubs are about the *team*. Tools are about the *work*. When an application inside a hub grows complex enough to need its own navigation, its own sub-pages, and its own UX flow, it is extracted to `/tools/`. The hub keeps a stakeholder view or an app link — but the application itself lives independently.

---

## The Three-Layer Architecture

| Layer | Purpose | Examples |
|---|---|---|
| **Member Registry** (`/admin/members`) | Canonical record authority | Full profile, roles, households, tags |
| **Hubs** (`/account/hub/[slug]`) | Team workspaces | Home, Conversations, Documents, Members |
| **Tools** (`/tools/*`) | Operational applications | Program Manager, Host Schedule, Course Manager |

Hubs and Tools both provide scoped projections of member data — but they serve different needs. A hub is where a team coordinates. A tool is where they do their specialized work.

---

## The Core Architectural Principle

> **Volunteers access member data through their hub or tool — not through the Member Registry.**

When a hub needs to surface member data, it does so as a **scoped projection**: only the fields relevant to that role, only the people within that role's scope, only the actions that role's work requires.

The Member Registry is never given to volunteers in filtered form. A restricted Member Registry is not the answer — it creates confusion, invites permission creep, and blurs the boundary between administrative authority and volunteer work.

### The right mental model

| System | Purpose |
|---|---|
| Member Registry | Canonical record authority |
| Hub member views | Task-specific projections of that data |

The same person may appear in multiple places — as a participant in a Host Team roster, a follow-up item in a People Team queue, a full profile in the Registry for ADMIN/REGISTRAR. Same person, different shape, different purpose.

---

## The Permission Framework

When designing member data access for any hub, answer four questions:

| Dimension | Question |
|---|---|
| **Fields** | What data does this role actually need to see? |
| **Scope** | Which people does that apply to? |
| **Actions** | What can they do? (view / mark attendance / add note / message / etc.) |
| **Purpose** | Which specific workflow is this access serving? |

This is the framework for every future hub data view. If a proposed feature can't clearly answer all four, it's not scoped tightly enough.

---

## Member Profile Architecture — Section Registry Pattern

The admin member profile page (`/admin/members/[id]`) uses a **section registry pattern** introduced in session 68. This governs how the profile page is structured and how visibility is determined.

### The registry

`lib/memberSectionRegistry.tsx` defines:
- `SerializedMember` — the canonical serialized type for a member record passed to the profile page and all section components
- `ViewerPermissions` — `{ roles: string[], sectionGrants: string[] }` — the viewing user's effective access
- `MemberSection` — `{ id, allowedRoles, condition?, render }` — a section definition
- `MEMBER_SECTIONS` — the ordered array of all sections

Adding a new section means adding one entry to `MEMBER_SECTIONS` and creating a component in `components/member-sections/`. Nothing else changes.

### Visibility logic

A section is shown if:
1. The viewer holds any role in `section.allowedRoles`, **or** the section `id` appears in the viewer's `sectionGrants`
2. AND `section.condition(member)` returns true (if a condition is defined)

```typescript
const visible = (hasRole || hasGrant) && passesCondition;
```

### sectionGrants

`User.sectionGrants String[]` is a field on the **viewer's** record — not the subject member's. It grants that person access to specific sections when viewing any member profile they can otherwise reach. Example: a `sectionGrants` value of `"care-notes"` lets that person see Care Notes on any profile, without holding the PEOPLE_TEAM role.

Assigned by ADMIN via the Neon console for now; a UI for this will be added when the first non-role section grant is needed in practice.

### Current sections (session 68)

| Section ID | Allowed Roles | Condition |
|---|---|---|
| `core-record` | ADMIN, REGISTRAR | — |
| `household` | ADMIN, REGISTRAR | — |
| `admin-notes` | ADMIN | — |
| `roles` | ADMIN | — |
| `teacher` | ADMIN | — |
| `course-access` | ADMIN, REGISTRAR | — |
| `registrations` | ADMIN, REGISTRAR | — |
| `danger-zone` | ADMIN | member has no registrations |

### Save model

The core record (Identity, Contact, Status, Tags) saves together via `PATCH /api/admin/members/[id]`. All other sections save independently via their own endpoints. No global save bar exists on the page.

### isTeacher / TeacherProfile

The `isTeacher` boolean and the `TeacherProfile` upsert are both handled by `PATCH /api/admin/members/[id]/teacher-profile`. The main member PATCH endpoint no longer accepts `isTeacher`.

---

## The Build Model

**One hub role at a time.** Each hub with a member data need gets its own scoped view built specifically for that role's workflow. This approach:

- Keeps each implementation tight and testable
- Forces clear thinking about what each role actually needs
- Prevents permission creep
- Creates a reusable pattern that each subsequent hub can follow

---

## Decision Rule for Future Roles

When a new hub or role needs access to member data, ask one question:

**Does this role need a workflow view of people, or authority over member records?**

- Workflow view → build it inside the hub as a scoped projection
- Authority over records → grant REGISTRAR or ADMIN access to the Member Registry

Most volunteers need workflow views. Almost no one outside ADMIN and REGISTRAR needs the Registry.

---

## Multiple Roles

A person may belong to multiple hubs. Their effective permissions are the union of their hub memberships — but those permissions are still surfaced inside each hub's context, not combined into a single general-purpose people view.

Someone who is both a Host Team coordinator and a Volunteer Coordination member has two workspaces. They do not get a merged view of all member data across both.

---

## Hub Membership as Authority (session 92, Phase 3)

**Principle:** when a HubMember record exists for a user in a hub, that record is authoritative for team state — hosting capability, communications, pause status. The coordinator owns these fields and can restrict them without touching the member's global Role[].

Previously, hosting permission (LiveKit admin grants, sub-request claims, HostAssignment eligibility) was computed only from system roles. That meant the only way to temporarily stop someone from hosting was to strip their HOST role — which also pulled them out of the Host Team hub entirely and sent them back through onboarding when they returned. The new model gives coordinators a dimmer switch: pause a member, disable hosting, or turn off notifications, all without touching roles.

**Field ownership on HubMember:**
- Sync-owned (written by `syncHubMembership` on role changes): `hubId`, `userId`, `position`, `isCoordinator`, `joinedAt`
- Coordinator-owned (written only via `/api/hub/[slug]/members/[userId]` PATCH): `status` (ACTIVE/PAUSED/INACTIVE), `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`
- Member-owned: `firstVisitedAt`, `lastVisitedAt`

**Permission rule:** `lib/hubMemberAuth.ts` provides `getEffectiveHostingCapability(userId, hubSlug, fallbackAllowed)` and `canReceiveHubNotifications(userId, hubSlug, fallbackAllowed)`. If a HubMember record exists, it is authoritative: `status === "ACTIVE" && hostingCapability/communicationsEnabled`. If no record exists, the helpers fall through to the provided `fallbackAllowed` — typically a role check. This preserves the legacy role gate for edge cases (teachers who have no host-team membership, etc.) while making hub-owned state the primary authority.

**Gated surfaces:**
- LiveKit: `/api/livekit/token`, `/api/livekit/step-in`, `/api/livekit/mute-participant`, `/api/livekit/mute-all`
- Sub-requests: `/api/host/sub-requests` (GET, POST), `/api/host/sub-requests/[id]/claim`
- Host assignments: `/api/host/assignments` (GET, POST self-claim, POST manager-assign target check, post-claim team notifications)
- Notifications: `getHubNotificationRecipients` filters by `status === "ACTIVE" && communicationsEnabled === true`

**No-delete policy on role revoke:** `syncHubMembership` never deletes HubMember records. If someone's HOST role is revoked, their HubMember stays — coordinator-owned state (pause notes, capability flags) is preserved. Coordinators use `status = INACTIVE` to restrict access while keeping that state. Hard removal (`DELETE /api/hub/[slug]/members/[userId]`) is ADMIN-only and is reserved for cleanup (wrong member added, archived account, etc.).

**Destructive-action warning flow:** When a coordinator pauses a member or revokes hosting capability in the host-team hub, the PATCH endpoint checks for upcoming HostAssignments. If any exist, the response is 409 with `{ requiresConfirmation: true, upcomingAssignments: [...] }`. The client shows the list and asks the coordinator to confirm. Resubmit with `force: true` (and optionally `releaseAssignments: true` to null out the user's upcoming assignments, returning them to the unclaimed pool).

---

## What's Next

**Tools extraction — complete (session 73, refined session 76):** Three full applications extracted from hub tabs to `/tools/*`: Program Manager → `/tools/programs`, Support Inbox → `/tools/inbox` (subsequently removed session 100), Host Schedule → `/tools/schedule`. Each tool has its own nav chrome, role gate, and back link to its associated hub. Session 76 removed the Registrar Hub stakeholder Programs tab and all course-specific Course Hub tabs — all hubs now have identical core sections: Home, Conversations, Documents, Members. This establishes the three-layer architecture: Member Registry (canonical authority) → Hubs (team workspaces) → Tools (operational applications).

**Hub schema enhancements — session 73:** `HubStatus` enum (ACTIVE/ARCHIVED) with status field on Hub. `HubAppLink` model for hub-to-tool linking. `firstVisitedAt` on HubMember for newcomer welcome tracking.

> **Tasks removed (session 96, 2026-04-27).** `TaskList`, `Task`, `Subtask` models and the `TaskStatus` enum were dropped from the schema; all `/api/hubs/[slug]/tasks/**` routes deleted; the `task-reminders` cron removed from `vercel.json`. Tasks were never adopted in practice and added complexity to every hub template. May be revisited later if a real need emerges.

**Completed since session 73:**

- **Hub admin page (session 74):** `/admin/hubs` — create, edit, archive hubs with app links, coordinator display. Replaces seed-script-only management.
- **Hub home screen (session 74):** Coordinator-editable home content via `RimProseEditor variant="document"`, app links rendered on home, pinned threads surfaced.
- **Hub newcomer welcome (session 74):** One-time interstitial on first visit (uses `firstVisitedAt` + `welcomeBody`).
- ~~**Hub task system (session 74):**~~ **Removed in session 96 (2026-04-27).** The full three-column task UI (rail, task list, detail panel) was deleted along with the schema models. Tasks were never adopted operationally.
- **Hub sidebar navigation (session 74):** Horizontal tab strip replaced with 220px left sidebar. Identity block, core sections, Tools section (app links with ↗), Hub settings link. Mobile: slide-in drawer via hamburger. `HubNavStrip.tsx` and `HubHeader.tsx` deleted.
- **Hub context for tools (session 74):** `?hub=` query param appended to all tool links from sidebar. `ToolsContext` reads param client-side via `useSearchParams()`, exposes `hubSlug` to tool pages. Foundation for scoped data.

**Hub core section conformance — session 76:** All five hub core sections (Home, Conversations, Tasks, Documents, Members) standardized to match the Tasks design standard. CSS prefixes unified: `hub-conv-`, `hub-doc-`, `hub-mem-` (previously `cv-`/`ann-`/`doc-`/`mem-`). Inline `maxWidth` styles replaced with CSS container classes. Conversations gained: emoji reactions (👍❤️🙏💡😊), reply editing (own replies), category filtering (hub `conversationCategories`), and email notifications (new thread → coordinators, new reply → participants). Members gained: coordinator member management (add/remove members, toggle coordinator status) via new API routes. Home app links bug fixed (`?hub=slug` now appended). Dead host-team conversation fork removed: `HubThreadDetailClient.tsx`, `/api/host/threads/*`, `/api/host/replies/*`, `HostThread`/`HostReply` schema models. Features ported to shared system before deletion.

**Course/Lesson tool extraction + tool access grants — session 76:** Course/Lesson management extracted from Course Hub to `/tools/learning` (Course Manager tool). Registrar Hub's Programs stakeholder tab removed. All hubs now have identical nav: Home, Conversations, Tasks, Documents, Members — no exceptions. New `UserToolAccess` model provides individual tool access grants (admin can grant a specific user access to any tool without assigning a role). All 4 tool layouts (`/tools/learning`, `/tools/programs`, `/tools/inbox`, `/tools/schedule`) standardized to use shared `hasToolAccess()` helper from `lib/toolAuth.ts`. Course/Lesson API auth simplified: `canAccessCourseHub()` replaced with `hasToolAccess()`. Editor components (`CourseEditor`, `LessonEditor`, `LessonListClient`) updated: `hubSlug` prop replaced with `basePath` prop for tool-agnostic navigation.

**What remains:**

- **Check-in tools:** Digital check-in per program (phone-first), PDF export, future member self-check-in.
- **Tool home screen cards with live context:** App links on hub home could surface tool-specific counts ("3 new registrations") — needs per-tool API endpoints.
- **Hub-scoped tool data:** Tools read `?hub=` server-side via `getToolHubContext()`. Schedule is hub-aware. Program Manager and Course Manager will add hub-scoping when they serve multiple hubs.
- **Documents page-based unification:** Link documents still use inline forms; native documents use page-based editors. Planned: unify both to page-based creation/editing flow.
- **Tool access admin UI:** `UserToolAccess` grants currently managed via Neon console. A UI for granting/revoking tool access could be added to the member profile admin page.

---

## The Hub and Tools Model

The complete architecture for how hubs and tools relate is documented in **`RIM_Hub_Model.md`**. That document covers:

- The two-layer separation: hubs (team homes) vs. tools (work applications)
- Hub lifecycle — step-by-step database records created when setting up a hub
- Tool creation pattern — checklist and template for building new tools
- Data scoping — how `?hub=` context flows from sidebar → URL → ToolsContext → queries
- Decision tree — when to keep functionality in a hub section vs. extract to a tool
- Core sections architecture — Home, Conversations, Documents, Members as shared infrastructure
- App link and home screen pattern — current implementation and planned live context cards
- Access control matrix — complete role → hub → tool → section mapping
- Mobile navigation — sidebar drawer, tool patterns
- Database schema reference — all hub-related models and their fields

**Claude Code: Read `RIM_Hub_Model.md` before working on any hub, tool, app link, sidebar, or scoped data feature.**

---

## Video Conferencing — LiveKit

Virtual and hybrid programs use **LiveKit Cloud (Build plan, $0/mo + metered usage)** for video conferencing, fully replacing Google Meet. Daily.co was evaluated as an alternative in session 122 and rejected (~$110/mo at RIM scale vs $0–50 on LiveKit, plus the rewrite cost of unwinding the custom-room architecture). The choice is committed; quality concerns are addressed by tuning passes, not platform changes.

**How it works:** Each program with `programFormat = "virtual"` or `"hybrid"` has a `livekitRoom` field (set to the program slug). When a member clicks "Join" on the dashboard, they're taken to `/session/{slug}` — a dedicated full-page video room with a custom layout (RIMConference). The token API (`/api/livekit/token`) calls `lib/livekitAuth.ts::resolveSessionRole` to determine the viewer's permission tier and issues a token whose grants match. See "Permission tiers" below.

**Permission model — identity vs. capability (audit landing 2026-05-26).** The previous overloaded `isHost` (session 121) and the widened single-flag model (session 124) both conflated *identity* (who is the assigned steward) with *capability* (who can do which actions). The 2026-05-26 refactor split them. `resolveSessionRole(userId, programSlug, sessionDate, roles)` now returns `{ isSessionHost, hasEndAllAuthority, isCoHost, isHostTeam, isProgramTeacher }`, and every server route that gates a session-room action consults the same helper.

**Identity — three pills (`isSessionHost`, `ProgramTeacher`, `cohost` metadata):**

- **Host** (singular) — `HostAssignment` for this exact session. **No role bypass.** Drives the "Host" pill on the participant's tile. An ADMIN or GUIDING_TEACHER visiting a session they didn't sign up to host *does not* show this pill — that label is identity, not capability.
- **Teacher** — `ProgramTeacher` row for this program. Layered on top of Host (both pills render side-by-side if the same person holds both). Drives the bell-friendly `teacher` audio profile (NS off, AGC off, 128 kbps).
- **Host Volunteer** (renamed from "Co-host" — same metadata field `cohost`, new label) — any active host-team `HubMember` (`status="ACTIVE"` + `hostingCapability=true`) OR `HOST_MANAGER` OR ADMIN OR GUIDING_TEACHER, when neither Host nor Teacher applies. The sangha-tone name for "the leadership constellation in the room who isn't the assigned host."

A tile renders at most two pills (Host + Teacher); never three. `cohost` is set only when neither of the other two applies.

**Capability — what each button does:**

- **End-for-All** (gated by `hasEndAllAuthority`) — held by the assigned Host **OR** ADMIN **OR** GUIDING_TEACHER **OR** the Teacher when no host is assigned for this session (the teacher-fallback rule, new). Drives the End button label ("End" vs. "Leave"), the EndMenu's "End for all" option, and the server gate at `/api/livekit/end-session`. The teacher-fallback handles the "Maria teaches alone" and peer-led-community-sit cases without forcing a Step-In first.
- **Share Screen / Mute Others / Mute All / Bell mode / manage Participants** (gated by `isCoHost`) — held by anyone with a pill: Host, Teacher, or Host Volunteer. Share Screen was extended from Session-Host-only to all Co-hosts (2026-05-26) — closes a latent bug where Host Volunteers saw the share button but the token didn't grant the source.
- **Step-In visibility** (gated by `isHostTeam && !isSessionHost`) — host-team members and ADMIN/GT who aren't the assigned Host see the Step-In affordance. Tapping it writes a `HostAssignment` for the caller, transferring the Host pill (and full End authority) to them with an audit-trail record.

**Why the split.** The pill is identity; the button is capability. An ADMIN visiting a session retains End authority as a safety override, but doesn't misrepresent themselves as the assigned host. A teacher teaching alone gets End naturally via the fallback, but their tile still shows Teacher (which is what they actually are). Host volunteers helping out have full capability to mute, share, and use Bell mode — but they're labeled Host Volunteer, because the formal Host of *this* session is someone else (or no one yet, if they want to step in and become it).

**Hub authority gate (session 124, preserved).** The host-team `HubMember` record remains the authoritative source for Host Volunteer capability on plain HOST role members. `getEffectiveHostingCapability(userId, "host-team", roleFallback)` returns true when an active member record exists with `hostingCapability=true`; returns the fallback when no record exists; returns false when the record exists but is paused/revoked. A coordinator can pause an individual via the hub admin UI and they correctly lose Host Volunteer capability even if their role is still in place. ADMIN bypasses.

**Three orthogonal participant-metadata flags** drive the visible pills, seeded by both the `/api/livekit/token` and `/api/livekit/step-in` routes at issuance, and broadcast by `RIMConference.tsx` as belt-and-suspenders via `localParticipant.setMetadata` after connect:

- `host: true` ↔ `isSessionHost` (assignment-required — drives Host pill)
- `teacher: true` ↔ ProgramTeacher (drives Teacher pill)
- `cohost: true` ↔ has Co-host capability AND not Host AND not Teacher (drives Host Volunteer pill)

The constraint that `cohost` is set only when neither Host nor Teacher applies is enforced at both the server seed and the client broadcast, so a tile renders at most two pills (Host + Teacher).

This identity/capability split matters operationally. The pre-2026-05-26 model granted End-for-All button visibility based on `isSessionHost`, which was true for both the assigned host AND every joining ADMIN (via the bypass). Two consequences: (a) every ADMIN visit showed the misleading Host pill on every session, defeating the "Session Host (singular)" design; (b) the audit trail of who actually ran a session was murky — ADMIN ending a session left no `HostAssignment` row. The split keeps the safety override (`hasEndAllAuthority` covers ADMIN, GT, and Teacher-when-no-host) while restricting the pill to actual assignment. Anyone who wants to formally take over runs Step-In and gets a clean audit row.

**Step-In propagation (session 121 backlog → session 124 fix).** The session-121 Step-In flow upserted the HostAssignment correctly but the new token issued by `/api/livekit/step-in` did *not* seed `host: true` metadata — so when the stepper-in reconnected, their LiveKit participant metadata was empty and the Host pill never rendered for other participants. Session 124 fixed two layers: (1) the server-side seed now mirrors the pattern from `/api/livekit/token`, and (2) `RIMConference.tsx`'s metadata-seeding effect now broadcasts `host: true` via `setMetadata` whenever `isSessionHost` becomes true and the metadata doesn't already reflect it. The page-level reconnect timing also fixed in the same session: the previous 100ms `setTimeout` between disconnect-and-reconnect could race on slow networks (collision under the same user identity); now uses a Promise that resolves on the actual `Disconnected` event with a 5-second safety fallback.

**ProgramTeacher backfill (session 124).** A pervasive gap surfaced in the session-124 audit: 13 of 16 active programs had no `ProgramTeacher` rows despite the session-79 introduction of the model being the very mechanism that drives the `teacher` audio profile + Teacher pill. Five rows backfilled via `prisma/migrate.mjs` (`backfill_program_teachers_v1`): Jesse on Essential Dharma Study, Meditation and Dharma Talk, Private Teacher Meetings, The Art of Meditation; Maria Sprecher on Qigong at RIM with `isTeacher=true`. The remaining 8 programs are intentionally teacher-less: peer-led silent sits (Good Morning / Good Evening / Recovery Dharma), service events, and three programs whose named teacher doesn't yet have a RIM account.

**Session room features (Zoom-aligned redesign session 117, session 121 refinements, session 122 A/V tuning, identity/capability split 2026-05-26):** Bottom Zoom-style control bar (Mute · Start Video with device-picker chevrons → Participants · Chat → Share · Reactions · Settings · Bell mode → red End with popover); Share Screen visible to all Co-hosts (Host + Teacher + Host Volunteer). Speaker / Gallery view toggle in the page header. Chrome stays visible at all times (auto-hide removed session 121). Participants panel: sticky local Me row with role pill (`isSessionHost`-keyed), raised hands floated to top in raise order with numbered queue ("1 ✋", "2 ✋", …), per-row mute (Co-host), Mute All footer, search at >10. Persistent ✓/✗ voting signals (toggle to clear); timed ❤️/🙏 reactions (~5s auto-clear). Custom persistent chat with history + direct messages (server-persisted via `SessionChatMessage`, live via LiveKit data channel). Custom tiles with Zoom-style nameplate, active-speaker yellow outline, signal badges, initials-circle avatar fallback, hover-revealed Mute button on remote tiles for Co-hosts. Hand-raise reorders tiles to the top-left of the grid in raise order (Zoom-style speaking queue) — no enlargement, the reordering itself is the focus mechanism. Three-way audio profile (teacher / speaker / listener) driving capture defaults + publish bitrate (audio: 128 / 96 / 64 kbps; **video: 2.0 / 1.5 / 1.5 Mbps per profile as of session 124**). H.264 video at 30 fps with 3-layer simulcast `[h180, h360, h720]`. Pure-black background. **Krisp Enhanced Noise Cancellation on by default for every participant on join (session 122)** via `useKrispNoiseFilter()` from `@livekit/components-react/krisp`. **Bell mode** toggle in the control bar (visible to anyone with a pill) flips Krisp NC off so bells, singing bowls, and gongs pass through unfiltered; resets to NC-on at every join. Hidden when Krisp is unsupported in the browser. Greenroom carries a "Headphones recommended" line; Audio playback prompt for Safari with headphone hint. Emergency host step-in via header button (host-team members + ADMIN/GT who aren't already the assigned Host) — stepping in upserts the HostAssignment, transferring Session-Host identity (Host pill) to the stepper.

**Host/teacher 10-minute early-open on the dashboard (session 121).** Session Host + ProgramTeacher + ADMIN see a distinct "Open early as host" row on the dashboard Today card between `start - 22min` and `start - 12min`. Teal accent, "Enter as host" button, "Live opens at X:XX" clarifier. At `start - 12min` the row collapses into the standard "Live Now" state shown to everyone. `DashboardAutoRefresh` handles both epoch transitions automatically. Detection is a batched lookup (HostAssignment + ProgramTeacher) keyed to today's program list. Standing-host assignments (legacy `sessionDate: null` rows) are honored.

**Per-program hosting hub + hub-grants-teacher capability path (session 128).** New `Program.hostingHubSlug String?` declares which hub claims a program's hosting. Null = `host-team` (existing default; preserves every existing program's behavior). New `Hub.assignmentGrantsTeacher Boolean @default(false)` makes the act of being assigned to a session in this hub confer Teacher capability — bell-friendly audio + the hub's `Hub.teacherLabel` pill text — without requiring a `ProgramTeacher` row. Two paths into Teacher capability now coexist: (a) the existing `ProgramTeacher` row (per-user explicit attribution; used for the four programs Jesse teaches) and (b) the hub-assignment path (clean for peer-led offerings where the leader rotates each week). `resolveSessionRole` broadens to honor both paths in `isProgramTeacher`. Co-host and Step-In gates route by `program.hostingHubSlug ?? "host-team"` instead of hardcoded `"host-team"`. Pill label hierarchy: `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`. Capability gates on `/api/host/assignments`, `/api/host/sub-requests` (+ `[id]/claim`), and the new-program notification in `/api/programs-pg` POST route to the program's hub. Sub-request recipient pool routes to the program's hub via `getHubNotificationRecipients`. `/tools/schedule?hub=` filters programs by hub (host-team scope catches null + explicit via Prisma `OR`). Helper file `lib/programHub.ts` carries the lookup + label hierarchy. ProgramEditor gains a new "Hosting & Access" tab between Schedule and Categories — relocates `teacherLabel` (was Content) and `isOpenAccess` + `guestAccessKey` (was Schedule) and adds `hostingHubSlug`. Mid-flight warning when changing a program's hub with future HostAssignments — grandfather policy applied (existing rows stay valid; new claims route to the new hub). Slug validation on POST/PUT (422 on unknown hub). Slice 1 of the two-slice Silent Meditation Hub plan; Slice 2 (admin-only) creates the actual `peer-led-silent-meditation` hub and transfers the silent-sit programs. Deferred to Slice 2 by design: standing-rotation routes and assignments-GET pause map still gate by `"host-team"`.

**Per-program teacherLabel (session 127).** New nullable `Program.teacherLabel String?` lets a coordinator override the "Teacher" pill text per program. Null = default "Teacher" (existing behavior). Preset alternates "Guide" / "Facilitator" / "Instructor" plus a Custom… free-text option (max 20 chars). The mechanism is otherwise unchanged — a `ProgramTeacher` row still drives the bell-friendly audio profile and the Teacher pill; only the display string varies per program. Server-side sanitizer `sanitizeTeacherLabel(input)` in `lib/programUtils.ts` allows Unicode letters and marks (for accented characters and non-Latin scripts), digits, spaces, hyphens, apostrophes. Token routes seed `teacherLabel` into participant metadata when `isProgramTeacher` AND `program.teacherLabel` is non-null. RIMParticipantTile and ParticipantsPanel render `meta.teacherLabel || "Teacher"`. Closes backlog `2026-05-25-002`. Prerequisite for the Silent Meditation Hub.

**Server-side time gate + per-session rooms (session 126).** `/api/livekit/token` and `/api/livekit/guest-token` now refuse to issue tokens outside a session's open window: opens at `Program.startDatetime - 22 min` (matches the dashboard host early-open epoch), closes at `Program.endDatetime + 30 min` (or `startDatetime + 90 min` when endDatetime is null). ADMIN and GUIDING_TEACHER bypass as a safety override; guests have no bypass. Direct-URL access to `/session/[slug]` outside the window is no longer ungated. Closes backlog `2026-05-24-002`. Helper: `lib/sessionWindow.ts::getActiveSessionWindow(program)` returns the active window or the next opening; `describeInactiveWindow(window)` produces the calm plain-English message the page surfaces to the user.

Coupled with the gate: **per-session room names**. `roomNameForProgram(slug, sessionDate)` now produces `slug-YYYY-MM-DD` for every program (drop-ins included — confirmed policy). Recurring programs no longer share one LiveKit room across every occurrence. Chat (`SessionChatMessage` rows filtered by `roomName`) scopes itself per session automatically — today's chat is invisible to tomorrow's session because tomorrow's room has a new name. The schema's `SessionChatMessage.sessionDate` column was already in place but the read query had never been wired; the change is mostly call-site, not schema. The token response now carries `sessionDate`; the session page threads it through `RIMChat`, `SessionRoleContext`, and the action callsites (mute-participant, mute-all, end-session, step-in).

Three layers cover the "forgot to End-for-All" case: explicit End-for-All (the host taps red End → "End for all"), LiveKit's empty-room idle cleanup (~5 min default), and the time gate at the door refusing new tokens after the close window. Tomorrow's room is a fresh name regardless.

**Defense-in-depth on the action routes (session 126).** `lib/sessionWindow.ts::assertSessionDateInWindow(programSlug, sessionDate, roles)` is wired into mute-participant, mute-all, end-session, and step-in. Refuses if the caller-supplied `sessionDate` doesn't match the currently open window (ADMIN/GT bypass). Step-In is the most consequential — it writes a `HostAssignment` row — but the assertion is applied consistently. Closes a gap the reviewer sub-agent caught pre-commit.

**Format alignment.** The session window helper produces `sessionDate` via `scheduleUtils.shiftToDate(...).toISOString()` — the same path the schedule tool uses when it writes `HostAssignment.sessionDate`. `resolveSessionRole`'s exact-match assignment lookup hits existing rows. The DST drift in `shiftToDate` is a pre-existing platform-wide limitation; this helper inherits it deliberately rather than forking.

**Key files:** `lib/livekit.ts` (server SDK + `createRoomToken(permissions)`), `lib/livekitAuth.ts` (tier resolver, session 121), `lib/sessionWindow.ts` (window helper + assertion, session 126), `app/api/livekit/token/route.ts` (time gate, session 126), `app/api/livekit/guest-token/route.ts` (time gate, session 126), `app/api/livekit/chat/route.ts` (history + DM filtering), `app/api/livekit/end-session/route.ts` + `mute-participant` + `mute-all` + `step-in` (defense-in-depth assertion, session 126), `components/VideoRoom.tsx` (per-profile video bitrate ceilings + 3-layer simulcast, session 122; sessionDate prop, session 126), `components/session/RIMConference.tsx` (Krisp NC default-on hook wiring, session 122; sessionDate threading, session 126), `RIMControlBar.tsx` (Bell mode button, session 122), `RIMChat.tsx`, `RIMParticipantTile.tsx` (with hover-mute), `ParticipantsPanel.tsx` (with renamed `isCoHost` prop; sessionDate, session 126), `VideoSettingsPanel.tsx`, `DevicePickerMenu.tsx`, `ReactionsMenu.tsx`, `EndMenu.tsx` (End-for-All gated on `hasEndAllAuthority`; sessionDate, session 126), `ViewToggle.tsx`, `ControlBarIcons.tsx` (with `IconBell`, session 122), `components/session/sessionRole.tsx` (React context for tier distribution, session 121; sessionDate added, session 126), `app/session/[slug]/page.tsx` (sessionDate state + threading, session 126). Detailed inventory in FEATURES.md §38; host/volunteer-facing changelog in `SESSION_ROOM_FOR_VOLUNTEERS.md`.

**No external accounts needed.** Members and hosts join using only their RIM login. No Google accounts, no Zoom accounts, no app downloads. The video room runs in the browser via WebRTC.

**Environment variables:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` (all set in Vercel).

**Critical pattern:** Custom tile components must use `trackRef.participant` to get the participant, NOT `useMaybeParticipantContext()`. GridLayout only provides TrackRefContext — ParticipantContext is null at the tile level.

## Naming

The system of record for member data is called the **Member Registry**. This is the preferred term in code comments, documentation, and conversation. Avoid "CRM," "CMS," "database," or "People Hub" when referring to this system.

### Three-stage delete + Guiding Teacher role (session 113)

Hub documents and conversation threads share a three-stage lifecycle: **Active → Archived → Trash**.

- **Archive** is the only soft action available on an Active item. Reversible. Author or coordinator. Both documents and threads use `archivedAt DateTime?` as the canonical archive marker (session 115 — threads were unified with documents, mirroring `HubDocument`'s shape). Archived items move to an "Archived" filter view (member-visible, read-only).
- **Delete** is only available on Archived items. Soft-deletes the item to the per-hub Trash, vanishes from member views entirely. Author or coordinator. Enforced both in the UI (Delete button hidden when item is not archived) and in the API (DELETE returns 400 if not archived).
- **Restore** and **Permanent Delete** live on the Trash page (`/account/hub/[slug]/trash`). Trash-managers only.

**Trash-management authority** is gated by `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts` — a single source of truth used by the Trash page, the sidebar link, and every restore/permanent-delete endpoint. Returns true if any of:

- `ADMIN ∈ roles`
- `GUIDING_TEACHER ∈ roles` (role added in session 113)
- `HubMember.isCoordinator === true` on the hub in question

**Coordinator-level authority** (separately) is gated by `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts` — added in session 115 to replace the inline `(member?.isCoordinator ?? false) || isAdmin` pattern that silently omitted GT. Returns true for the coordinator flag, ADMIN, or GUIDING_TEACHER. Used in every page and API route that previously inlined the check (~14 sites).

**`GUIDING_TEACHER` role.** Sangha-wide dharma authority, distinct from `ADMIN` (which is technical/operational). As of session 115, GT **acts as an implicit coordinator on every hub** for content + moderation (archive, restore, edit threads, pin/unpin, override doc lock, edit member status). GT does NOT inherit ADMIN-level technical authority (hub config edits, hard-remove member, hub create/delete, system-wide settings). The role exists so a senior teacher can have full content reach across the sangha without also being given the keys to the technical infrastructure. Full role design: `RIM_Role_Design.md`.

Schema additions: `HubDocument.archivedAt/archivedById/deletedAt/deletedById` (session 113), `HubConversationThread.archivedAt/archivedById` (session 115), `HubConversationThread.deletedAt/deletedById` (session 113). Indexes `(hubId, deletedAt)` on both. List queries everywhere filter `deletedAt: null` and `archivedAt: null` by default; single-item GET routes 404 for non-managers when `deletedAt` is set. The canonical hub-thread filter is `activeHubThreadWhere(hubId)` in `lib/hubQueries.ts` — use it for any findMany / count surfacing hub-level threads to members.

### Hub notifications (session 113)

Three coordinated systems share the same Basecamp-style mental model and the same shared UI component (`components/HubDocNotifyPanel.tsx`):

1. **Per-document notifications** — Authors pick recipients explicitly per document. `HubDocumentNotification` is an event log keyed `documentId × userId × eventType` (`"created"` | `"updated"`). Server-side dedup before insert + send. UI shows already-notified members as disabled `✓ Notified [date]` rows. Three routes share the dedup logic: `POST /documents`, `PATCH /documents/[id]`, `POST /documents/[id]/notify`.

2. **Conversation thread subscriptions** — Each thread has a subscriber list; subscribers receive every reply automatically. `HubThreadSubscription { threadId, userId, source }` with `source ∈ {AUTHOR, COORDINATOR_AUTO, ADDED, SELF}`. Subscribers are seeded at thread creation (author + coordinators + author's "Also notify" picks); replier auto-subscribed by virtue of replying; readers can `Follow` / `Unfollow` themselves via the thread-header pill. Subscription is the recipient list — no separate per-event tracking.

3. **Host assignment confirmations** — Two templates (`host-assignment-confirmation`, `host-assignment-removed`) wired into every path where someone becomes or stops being the host of a single session. Sub-claim, self-claim, manager assignment, PATCH claim, and reassign all use the same confirmation template; reassign also fires the removal template for the displaced host. Standing-rotation emails stay hardcoded and batched — they handle a different shape of event.

All three systems use `after()` from `next/server` for reliable serverless background dispatch and filter recipients to active hub members with `communicationsEnabled` before sending. All three systems' email templates are seeded in `prisma/migrate.mjs` per the **Email Template Gate** documented in `CLAUDE.md`.

### Document conversations and the Activity stream (session 114)

**Document conversations.** `HubConversationThread` has an optional `documentId FK` (nullable, ON DELETE CASCADE, indexed). When set, the thread is a document conversation — it lives on the document view page and is excluded from the hub-level Conversations feed. Hub Conversations and `countUnreadConversations` both filter `documentId: null`. Document conversations filter to `documentId: docId`. The thread detail page's back link is context-aware: "← Back to [Document]" if `documentId` is set, "← Conversations" otherwise.

**Unified Activity stream.** The Activity page (`/account/hub/[slug]/activity`) is a computed union — no model, just five parallel queries joined in memory. Types: `document_added`, `document_updated`, `hub_thread`, `hub_reply`, `doc_thread`, `doc_reply`. The stream is the single place to see the full hub picture across both conversation surfaces and document activity. It sits first in the sidebar below Home, above Conversations.

---

## Closing Ritual

This file is part of the closing ritual for any Claude Code session that touches hubs, roles, or member data architecture. Regenerate it alongside FEATURES.md and RIM_Stack_Reference.md after any such session.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · May 2026 (updated 2026-05-22 — Session 128: Silent Meditation Hub Slice 1 — per-program hosting hub (new `Program.hostingHubSlug String?` defaults to `host-team`) plus hub-grants-teacher capability path (new `Hub.assignmentGrantsTeacher Boolean` + `Hub.teacherLabel String?`); `resolveSessionRole` broadens `isProgramTeacher` to layer ProgramTeacher row OR active assignment in a hub that grants teacher capability; Co-host and Step-In gates route by program's hub instead of hardcoded host-team; pill hierarchy `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`; host operation routes (assignments POST, sub-requests POST + claim, programs-pg POST notification) all route to program's hub; schedule page filters by hub; new helper `lib/programHub.ts`; new ProgramEditor "Hosting & Access" tab consolidates hostingHubSlug + teacherLabel + Open Access; mid-flight grandfather warning + slug validation on the hub field; Slice 2 (admin-only configuration) is queued. Session 127: per-program teacherLabel — new nullable Program.teacherLabel column overrides the "Teacher" pill text on a ProgramTeacher's session-room tile (preset alternates Guide / Facilitator / Instructor plus a Custom free-text option capped at 20 chars; null = default "Teacher"); ProgramEditor Content tab dropdown; server-side sanitizer allows Unicode letters/marks, digits, spaces, hyphens, apostrophes; token + step-in routes seed teacherLabel into participant metadata and return it on the response for client-state parity; RIMParticipantTile + ParticipantsPanel render meta.teacherLabel || "Teacher"; ParticipantMetadata gains teacherLabel?: string; mechanism otherwise unchanged — ProgramTeacher row still drives bell-friendly audio profile and Teacher pill, only the display string varies; closes backlog 2026-05-25-002; prerequisite for the Silent Meditation Hub (2026-05-25-003). Session 126: server-side time gate on /api/livekit/token + /api/livekit/guest-token (opens startDatetime - 22min, closes endDatetime + 30min; ADMIN/GT bypass; guests no bypass; closes backlog 2026-05-24-002); per-session LiveKit room names (slug-YYYY-MM-DD) — recurring programs no longer share one room across every occurrence, chat scopes per session automatically without query changes; policy: every program follows the per-session pattern including drop-ins like Good Morning Silent Meditation; new lib/sessionWindow.ts carries getActiveSessionWindow + describeInactiveWindow + assertSessionDateInWindow; defense-in-depth assertion wired into mute-participant / mute-all / end-session / step-in refusing if caller-supplied sessionDate doesn't match the open window; session page captures sessionDate from token response and threads it through RIMChat, SessionRoleContext, and the four action routes; format aligned with the schedule UI via scheduleUtils.shiftToDate so resolveSessionRole's exact-match HostAssignment lookup hits existing rows. Session 125 — Permission model split into identity vs. capability: `isSessionHost` is now assignment-only (no ADMIN bypass), `hasEndAllAuthority` is the new capability flag held by Assigned Host + ADMIN + GUIDING_TEACHER + Teacher-when-no-host (the teacher-fallback rule, new), "Co-host" pill renamed to "Host Volunteer" (sangha-tone label; metadata field name `cohost` and CSS class kept stable), Share Screen extended from Session-Host-only to all Co-hosts (closes a latent bug); raised-hand reorders tiles top-left in raise order with numbered queue in Participants panel; persistent ✓/✗ vote signals; "Clear my signal" affordance in Reactions popover. Session 124 — Permission tiers widened to Zoom-style "trust the team": active host-team `HubMember` (any role) is automatically Co-host; Teacher is now an orthogonal identity, not a tier — `ProgramTeacher` row renders the Teacher pill alongside Host if both apply; three orthogonal participant-metadata flags `host`/`teacher`/`cohost` drive three visible role pills on tiles + participants panel; Step-In server seed + client-side broadcast `host: true` metadata so the badge propagates immediately to other participants; ProgramTeacher backfill for 5 operational programs (Jesse on 4, Maria Sprecher on Qigong) closes the audio-profile gap that left every recurring host on `speaker` profile instead of `teacher`; Step-In's 100ms `setTimeout` replaced with actual `Disconnected`-event-wait (5s safety fallback); Krisp lifecycle instrumentation via `[rim-krisp]` console logs + attach verification + one retry on mic-track race; session 122 — Video Conferencing section: Krisp Enhanced Noise Cancellation enabled by default for every participant on join via `useKrispNoiseFilter` from `@livekit/components-react/krisp`, "Bell mode" Co-host toggle to flip NC off for bells/bowls/gongs, per-profile video bitrate ceilings (teacher 2.0 / speaker 1.5 / listener 1.0 Mbps) replacing flat 2.5 Mbps, "Headphones recommended" line in Greenroom, LiveKit Cloud tier corrected from Ship to Build, Daily.co evaluated and rejected as alternative; session 121 — three-tier permission model (Session Host / Co-host / Participant) via lib/livekitAuth.ts::resolveSessionRole, tile hover-mute, chrome always visible, host/teacher 10-minute early-open on the dashboard; session 115 — hub-system audit, canonical query/coordinator helpers, archive mechanism unified between threads and documents, GUIDING_TEACHER scope expanded to implicit-coordinator on every hub; session 114 — document conversations (HubConversationThread.documentId FK), unified Activity stream; session 113 — three-stage archive/trash lifecycle, GUIDING_TEACHER role, hub notification subscriptions, host confirmation emails; session 110 — Support Inbox tool wiring residue stripped, "Dashboard" → "Home" in member area; session 101 — Tasks removed, Support Inbox removed, hub count corrected)*
