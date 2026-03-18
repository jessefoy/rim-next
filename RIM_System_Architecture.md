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

**Current hubs:** Host Team, Teacher Hub, Registrar Hub, People Team, Greeter Team, AV Team, Housekeeping, Plant Care, Newsletter, Sangha Care, KM Support, Silent Meditation, Volunteer Coordination (all OPERATIONAL) + Board and Teacher Council (GOVERNANCE).

**What they are:** Task-specific workspaces. Each hub currently provides Announcements, Documents, Conversations, and a Members tab. The Host Team hub also has a Schedule tab.

---

## The Core Architectural Principle

> **Volunteers access member data through their hub — not through the Member Registry.**

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

## What's Next

The **Virtual Host Hub** was the first hub to receive a scoped member data view — built in sessions 41–45. It established the pattern for all subsequent hub data views.

The **Registrar Hub** (Phase 1) was migrated into the hub system in session 53. The standalone `/account/registrar` area was retired and all registrar functionality now lives at `/account/hub/registrar/programs`. Phase 1 also introduced **stakeholder visibility** — non-registrar hub members see headcount and capacity only, no PII, no detail page access. The role design document is in `RIM_Role_Design.md`.

**Phase 3 complete (session 54):** Programs are now fully managed in Postgres via the Program Editor in the Registrar Hub. All Sanity program dependencies removed. Google Meet sync happens on save (no webhook needed). The Sanity invitation system was removed entirely.

**Support Inbox — complete (sessions 56–57):** A standalone hub (`/account/hub/support/`) was built for the SUPPORT role. It provides a full Gmail-integrated shared email client for `support@rootedinmindfulness.org`: OAuth2 sync engine, three-column inbox UI, thread management (OPEN/CLAIMED/WAITING/RESOLVED), reply and compose via Gmail API, internal notes, email templates, per-user signatures, member matching, soft delete, notifications, and cron-based auto-sync (5 min, Vercel Pro). Security hardening completed in session 57 (SSRF guard, attachment ownership check, soft-delete bypass fix in sync, 404 on deleted threads, rate limiting on manual sync, enum validation, signature HTML escaping, audit trail on hard delete).

**Host Hub Session tab — complete (session 58):** Full visual redesign and post-session form overhaul. Six-state machine (`later-today → getting-ready → live → post-session → done`) transitions correctly via tick counter without page reload. Person rows are full-width tap targets with color-coded left strip (amber=new member, teal=returning) and flag circle. Live session card has sage green background; ended sessions collapse to footnotes when a form is pending. Post-session form: all hosts see the full form (flagged people with note + routing descriptions, session reflection, resource to share). FormattedEditor (Tiptap JSON) used for all multi-line communication fields. Three schema fields migrated from `String?` to `Json?`: `SessionAttendance.postSessionNote`, `SessionReport.reflection`, `SessionCoHostReport.reflection`.

**Series page redesign — complete (session 59):** The course/series page (`/course/[slug]`) was redesigned to match the `lp-` design language — warm `var(--rim-bg)` background, centered weight-400 serif header, `crs-rule` hr divider, white lesson cards with 10px border radius. SVG media-type icons (teal=audio, amber=video, slate=text) replace the old text badge pills. The Course Editor received a UX overhaul for section labels: a flat `ListItem[]` union type now drives a unified drag list where section-divider rows are first-class draggable items with inline-editable labels and a ✕ remove button. The `+ Add Section` button uses the new `th-btn--ghost` style. Sort order was removed from the course form entirely. Three routes were fixed for `Prisma.JsonNull` (TypeScript enforces `JsonValue` not `string | null` for `Json?` fields). The planned learning system (§30 FEATURES.md) was documented as the next major teacher-facing feature area.

**Learning System features 1–6 — complete (session 60):** The series/lesson library is now an active learning companion. Members enroll in a series (`SeriesEnrollment` — `enrolledAt`, `completedAt?`, `enrollmentSource`), track per-lesson completion (`LessonProgress`), and write private per-lesson notes (`LessonNote` — new in session 60, `body Json?` via FormattedEditor). The lesson page shows an enrollment-gated `ls-lesson-footer` below the content: the teacher's reflection prompt (italic serif, preceded by rule), the personal notes editor (autosaved via 1.5s debounce), and the Mark Complete button. The member dashboard shows enrolled series as `ls-dash-card` cards with live inline progress bars and "Continue →" links. The complete API (`POST /api/lessons/[slug]/complete`) now gates on enrollment (403 if not enrolled) and clears `SeriesEnrollment.completedAt` when a lesson is un-completed. Two new `Lesson` fields: `durationMinutes Int?` and `reflectionPrompt String?`, editable in the Teacher Hub's LessonEditor. `CourseEditor` gains a `completionNote` field. Features 7 (Teacher Profiles) and 8 (Shared Discussion) remain deferred.

**What remains for the Registrar Hub:**

- **Check-in tools:** Digital check-in per program (phone-first), PDF export, future member self-check-in.
- **Stakeholder names visibility:** Whether certain stakeholders should see participant names (not just headcount) is a privacy question deferred until a real use case requires it.

---

## Naming

The system of record for member data is called the **Member Registry**. This is the preferred term in code comments, documentation, and conversation. Avoid "CRM," "CMS," "database," or "People Hub" when referring to this system.

## Closing Ritual

This file is part of the closing ritual for any Claude Code session that touches hubs, roles, or member data architecture. Regenerate it alongside FEATURES.md and RIM_Stack_Reference.md after any such session.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026 (updated session 60)*
