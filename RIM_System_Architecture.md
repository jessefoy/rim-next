# RIM System Architecture
**Structural decisions and the reasoning behind them**

This document records the foundational architectural decisions for how RIM's member data system and volunteer hub system work together. It is not a features doc — that's FEATURES.md. It is not a design philosophy doc — that's RIM_Web_Design_Philosophy.md. It is the structural model that governs how those features are built.

**Claude Code: Read this before working on any hub, member data, role, or permission-related feature.**

---

## The Two Systems

### Member Registry (`/admin/members`)

The Member Registry is the authoritative record of every person in the RIM community. It holds canonical member profiles: contact info, member status, household, tags, admin notes, registration history, course access, and role assignments.

**Who has direct access:** ADMIN and REGISTRAR only. No other roles should be granted access to `/admin/members`. This is not a filtering problem to solve — it is a boundary to maintain.

**What it is:** The system of record. Not a tool for volunteers to do their work. Not a filtered view for different roles.

### Hubs (`/account/hub/[slug]`)

Hubs are team workspaces for RIM's volunteer groups. Each hub serves one team. Members see only the hubs they belong to.

**Current hubs:** 14 operational hubs + 2 governance hubs, all manageable from `/admin/hubs`. The four hubs with linked tools are: Hosting Hub (`host-team`), Course Hub (`courses`), Registration Hub (`registrar`), Support Hub (`support`). Support Hub has no linked tools — its Support Inbox was removed in session 100.

**What they are:** Team-centric workspaces. Each hub provides a Home screen (with app links and coordinator content), Conversations (with pinned threads), Tasks, Documents, and a Members tab. Dashboard hub cards show unread badges.

### Tools (`/tools/*`)

Tools are full-featured staff applications extracted from hubs. They serve one workflow, with their own navigation chrome and sub-pages.

**Current tools (3):**
- `/tools/programs` — Program Manager (REGISTRAR/ADMIN)
- `/tools/schedule` — Host Schedule (mini-cal + card list; HOST/HOST_MANAGER/ADMIN)
- `/tools/learning` — Course Manager: Series + Lessons (TEACHER/ADMIN)

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

Virtual and hybrid programs use **LiveKit Cloud** (Build plan, free) for video conferencing, fully replacing Google Meet.

**How it works:** Each program with `programFormat = "virtual"` or `"hybrid"` has a `livekitRoom` field (set to the program slug). When a member clicks "Join" on the dashboard, they're taken to `/session/{slug}` — a dedicated full-page video room with a custom layout (RIMConference). The token API (`/api/livekit/token`) generates a JWT with the member's name, identity, and avatar metadata. If the member is the assigned host (via `HostAssignment`, `ProgramTeacher`, `HOST_MANAGER`, or `ADMIN`), the token includes `roomAdmin: true` — granting mute, remove, and end-session controls automatically.

**Session room features:** Grid/focus layout with pin, chat sidebar, nonverbal signals (✋❤️🙏✓✗), raised-hand banner, presence photos (avatar), host participants panel with per-participant mute, Mute All, End for All, emergency step-in, dark theme, audio playback prompt for Safari.

**Key files:** `lib/livekit.ts` (server SDK), `app/api/livekit/token/route.ts`, `components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `components/session/RIMParticipantTile.tsx`, `app/session/[slug]/page.tsx`.

**No external accounts needed.** Members and hosts join using only their RIM login. No Google accounts, no Zoom accounts, no app downloads. The video room runs in the browser via WebRTC.

**Environment variables:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` (all set in Vercel).

**Critical pattern:** Custom tile components must use `trackRef.participant` to get the participant, NOT `useMaybeParticipantContext()`. GridLayout only provides TrackRefContext — ParticipantContext is null at the tile level.

## Naming

The system of record for member data is called the **Member Registry**. This is the preferred term in code comments, documentation, and conversation. Avoid "CRM," "CMS," "database," or "People Hub" when referring to this system.

## Closing Ritual

This file is part of the closing ritual for any Claude Code session that touches hubs, roles, or member data architecture. Regenerate it alongside FEATURES.md and RIM_Stack_Reference.md after any such session.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · May 2026 (updated session 110 — Support Inbox tool wiring residue stripped, "Dashboard" → "Home" in member area; session 101 — Tasks removed, Support Inbox removed, hub count corrected)*
