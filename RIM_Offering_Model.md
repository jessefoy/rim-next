# RIM Offering Model

**Status:** Active architectural reference. Established 2026-05-20 (session 118).

The canonical reference for how RIM expresses its offerings — what's a Program, what's a Course, how the two relate, and how members acquire access. Read alongside `RIM_System_Architecture.md` (structure) and `RIM_Web_Design_Philosophy.md` (intent).

---

## The taxonomy

RIM has two kinds of offering:

### Sessions
A live, time-bound gathering with a teacher. Sessions are organized into **Programs**, which carry the schedule (one-off, weekly, alternating-weeks, etc.), hosts, registration, dana, and the session room.

- **Community sessions** — open to community participation.
  - **Open** — drop-in, no registration required.
  - **Registration-required** — name on a list, optional or required dana.
- **Private sessions** — one-on-one. (Named for completeness; not implemented at this writing.)

### Courses
A persistent body of on-demand content — lessons, ordered, often with reflection questions or supplemental material. Self-paced. Lives in the member's Library at `/account/courses`.

A Course exists independently of any Program. It can be **stand-alone** (no live cohort attached) or **bundled** with a Program for a live cohort. When a Program's cohort ends, the Course continues to exist; the bundling simply stops being active.

### Hybrids
A live Program with a linked Course. Two surfaces, one offering — the live cohort runs through the Program (sessions, schedule, dana, registration); the on-demand material lives in the Course (lessons, Library). Registering for the Program auto-enrolls the member in the Course. After the cohort ends, the Course can continue as a standalone on-demand offering with its own self-enroll path.

The same Course can be **bundled with multiple Programs over time** (e.g. a 6-week series taught every fall). The Course is the long-lived content; the Programs are the cohorts.

---

## Course access — the orthogonal-flags model

**Decided 2026-05-20 (session 118), replacing the older single-enum `accessLevel`.**

The previous model used a single enum (`ALL_MEMBERS / REGISTRATION_REQUIRED / ROLE_REQUIRED`). It could not express the natural case of a Course that's *both* bundled with a Program for the live cohort *and* available for self-enroll with dana — only one mode at a time. The new model uses **orthogonal flags** so a single Course can carry more than one acquisition path simultaneously.

### Access flags on `Course`

| Flag | Status | Meaning |
|---|---|---|
| `allowSelfEnroll: Boolean` | **New** | A logged-in member sees a self-enroll CTA on `/course/[slug]`. |
| `selfEnrollDanaRequired: Boolean` | **New** | When self-enrolling, route through the dana flow before granting `SeriesEnrollment`. |
| `requiredRoles: String[]` | Exists | If non-empty, only members holding at least one listed role (plus admins) can see the course or self-enroll. |
| `isOnboarding: Boolean` | Exists | Every new member is auto-enrolled at signup. |
| `publishOnPublicCatalog: Boolean` | Exists (session 117) | Course appears on `/courses` when true. |

### Course content fields (parallel to Program)

For the Course detail page to function as a real landing page (not a one-line gate), the Course model carries these content fields. Most mirror `Program` so the visual vocabulary stays consistent across offering types.

| Field | Status | Purpose |
|---|---|---|
| `Course.heroImage: String?` | **New** | Background image for the landing hero. Mirrors `Program.programImage`. |
| `Course.pullQuote: String?` + `pullQuoteSource: String?` | **New** | Floating quote card on the landing. Mirrors `Program.pullQuote` / `pullQuoteSource`. |
| `Course.danaText: String?` | **New (verify)** | Free-form dana ask copy shown on the landing and read by the self-enroll dana flow. Mirrors `Program.danaText`. Confirm at build whether this exists; add if not. |
| `Course.accessRestrictionMessage: String?` | **New** | Authored "friendly message" shown in place of the Enroll button when the visitor can't self-enroll (role-gated without the role, manual-grant-only, or bundled-only-while-program-closed). Different copy per course — a teacher-training course's message differs from a private-grant course's. |

### Access paths (not flags — separate mechanisms)

| Path | Mechanism | Effect |
|---|---|---|
| Self-enrollment | Member clicks Enroll on `/course/[slug]` | Creates `SeriesEnrollment` (source = `SELF`), preceded by dana flow if `selfEnrollDanaRequired`. |
| Onboarding auto-enroll | Triggered by `isOnboarding=true` on signup | Creates `SeriesEnrollment` (source = `ONBOARDING`). |
| Program registration | Triggered by registering for a Program with a `ProgramCourse` link | Creates `SeriesEnrollment` (source = `PROGRAM`). |
| Manual admin grant | Admin creates `CourseAccess` record from the member's profile | Grants access without a registration flow. |

A member **has access** to a Course if ANY of these is true:
- They have a `SeriesEnrollment` for it.
- They have a `CourseAccess` grant for it.
- They are registered for a Program linked to it via `ProgramCourse`.

### Role-gate semantics

`requiredRoles` gates **visibility** (catalog + detail page) and **self-enroll**, not access already granted. A member who self-enrolled while holding a role keeps access even if the role is later removed. ADMIN always bypasses the role gate.

### The canonical course shapes

These shapes aren't enforced as enum values — they are patterns expressed by flag combinations. The Course editor surfaces them as presets but allows any combination.

| Shape | Flag pattern |
|---|---|
| **Free for all members** | `allowSelfEnroll=true`, `selfEnrollDanaRequired=false`, `requiredRoles=[]`, `publishOnPublicCatalog=true` |
| **Dana-required self-enroll (standalone paid)** | `allowSelfEnroll=true`, `selfEnrollDanaRequired=true`, `publishOnPublicCatalog=true` |
| **Manual grant only (private)** | `allowSelfEnroll=false`, `publishOnPublicCatalog=false` |
| **Onboarding (auto-enroll, free)** | `isOnboarding=true`, `allowSelfEnroll=false`, `publishOnPublicCatalog=false` |
| **Program-bundled only (live cohort companion)** | `allowSelfEnroll=false`, linked via `ProgramCourse`, `publishOnPublicCatalog=false` |
| **Hybrid: live cohort + standalone dana** | `allowSelfEnroll=true`, `selfEnrollDanaRequired=true`, linked via `ProgramCourse`, `publishOnPublicCatalog=true` |
| **Role-locked self-enroll** (e.g. teacher training) | `allowSelfEnroll=true`, `requiredRoles=["TEACHER_TRAINEE"]`, `publishOnPublicCatalog=false` |

### Migration from `accessLevel` enum

Existing courses migrate as follows (idempotent backfill in `prisma/migrate.mjs`):

| Current `accessLevel` | New flags |
|---|---|
| `ALL_MEMBERS` | `allowSelfEnroll=true`, `selfEnrollDanaRequired=false` |
| `REGISTRATION_REQUIRED` | `allowSelfEnroll=false` (rely on `ProgramCourse` linkage) |
| `ROLE_REQUIRED` | `allowSelfEnroll=true` (existing `requiredRoles` carries over) |

The enum stays in the schema during transition; reads are migrated to the flags first, then the enum drops in a later pass. No silent behavior changes — every current course preserves its current access semantics under the new flags.

---

## Pricing / dana

Course dana uses the **same Stripe Checkout mechanism** as Program dana. Differences:

- **Lifetime access** once paid (no session-time-based gating).
- **Pending dana behavior** — TBD. Does an unpaid pledge block lesson access, block enrollment, or grant probationary access? Needs Jesse's call before build.
- **Refund / transfer policy** — TBD.

A bundled-Program Course's dana for the live-cohort path is the Program's registration dana. The standalone self-enroll path can have its own dana ask (typically different, since the live-cohort version includes facilitation).

---

## Admin surfaces

- Programs are managed in the **Program Manager** (`/tools/programs`).
- Courses are managed in the **Course Manager** (`/tools/learning/[courseSlug]`).
- The two remain **parallel tools.** Programs carry schedules / sessions / hosts / recurrence; Courses carry lessons / drip / completion. Unifying them into one tabbed form imposes a single mental frame on two genuinely different concepts. The hybrid case is handled at *link-time* (`ProgramCourse` join), not creation-time.
- For hybrids: the Program editor should surface a "Linked Course" picker so wiring a bundled Program-Course pair is a single step. (Confirm or add during build.)

---

## Member-facing surfaces

| Surface | Frame |
|---|---|
| `/programs` — public catalog of live offerings | Schedule-first: dates, times, "Register" |
| `/courses` — public catalog of on-demand offerings | Library-first: lesson count, self-paced, "Enroll" |
| `/programs/[slug]` — program detail | Live cohort framing, schedule, register CTA |
| `/course/[slug]` — course detail | **Needs to grow up** — currently a one-line gate for non-enrolled. Must become a real landing page with description, teacher, lesson count, dana ask, enroll CTA. This is the entry point for the dana flow. |
| `/account/programs` — My Registrations | Live commitments |
| `/account/courses` — Library | On-demand enrollments (onboarding welcome at top when relevant) |

### The "online blurring" concern

When offerings are delivered online (vs in-person), the visual distinction between a *live cohort* and an *on-demand course* can flatten — both happen through a screen. The fix is **copy and visual structure**, not the model: Program surfaces lean into *schedule*; Course surfaces lean into *library*. For hybrids that appear in both places, each surface makes its frame explicit ("live cohort version" vs "on-demand version").

---

## Course detail page — pre-enrollment design

**Decided 2026-05-20 (session 118).**

The Course detail page at `/course/[slug]` today has two modes: a one-line gate for visitors without access, and a full lesson list for enrolled members. The gate is impoverished — no description, no teacher, no lesson preview, no enroll CTA. The build adds a real pre-enrollment landing state.

### The six states the page must handle

| State | Visible to | Page content |
|---|---|---|
| **Not signed in** | Anyone | Same landing as a non-enrolled member. Enroll CTA routes through the 6-digit sign-in code flow first, then into the enrollment flow. |
| **Signed in, can self-enroll for free** | Members of a free-for-all course | Full landing + visible **Enroll** button. Click → immediate `SeriesEnrollment`, page reloads in enrolled state. |
| **Signed in, can self-enroll with dana** | Members of a dana-required course | Full landing + visible **Enroll** button. Click → Stripe Checkout flow, success returns to the page in enrolled state. |
| **Signed in, role-gated without the role** | Members lacking `requiredRoles` | Full landing minus self-enroll. `Course.accessRestrictionMessage` displayed in the CTA slot. |
| **Signed in, bundled-with-program only** | Members of a course with no `allowSelfEnroll`, but with a live cohort available via `ProgramCourse` | Full landing + "Register for the live cohort →" CTA linking to the resolved Program. |
| **Enrolled (any source)** | Members with `SeriesEnrollment` / `CourseAccess` / linked Program registration | Existing behavior — meta bar + progress + lesson TOC. |

### Layout (shape only — pixels at build time)

Pre-enrollment landing mirrors the shape of `/programs/[slug]` so the two offering types feel like peers, not first-class vs. second-class. `crs-` namespace.

- **Hero** — background image (`Course.heroImage`), category eyebrow linking back to `/courses`, title, subheading.
- **Optional dana result banner** — after Stripe redirect (parallel to Program).
- **Optional pull quote** — float-up card pattern (`Course.pullQuote` / `pullQuoteSource`).
- **Description** — rich content, full body.
- **"About this course" block** — lesson count + self-paced framing, teacher byline (links to teacher profiles when available), dana ask. This replaces the schedule/time/location block of Programs.
- **Enroll CTA** — context-aware per the state table above.
- **"In this course" lesson preview** — *titles shown, content not accessible.* See decision below.
- **Facilitators section** — same pattern as Programs.

### Lesson preview — show titles

The lesson TOC is visible to non-enrolled visitors. Titles only, not clickable. Substack/Coursera pattern — the TOC is part of the offering, not a hidden gate. Aligns with the dharma framing (clarity, not secrecy).

### Hybrid dual-path display

When a Course has both `allowSelfEnroll=true` AND a live cohort available via `ProgramCourse`, the landing shows the live cohort as the primary CTA and the standalone path as a quiet secondary line:

```
[ Register for the live cohort → ]    ← primary, full button

Can't join us live? You can also enroll on-demand for self-paced study →
```

Rationale: the live cohort is the first-class experience while it's running (presence, community, real-time questions). The standalone path is the "I want this teaching but can't be there live" fallback. This honors restraint (one button dominates), clear seeing (both paths visible), and designing for overwhelmed users (the primary action is obvious).

**Resolved live cohort** = the next linked Program (via `ProgramCourse`) where registration is open and the start date is in the future. If multiple, the soonest. If none, the standalone path becomes the only primary CTA — the live messaging disappears automatically.

### Restricted-state friendly messages — always

For every state where the visitor can't self-enroll (role-gated without the role, manual-grant-only, bundled-only with no open cohort), the page shows the **full landing** with a friendly contextual message in the CTA slot. Never a 404. Never a one-line wall. The message is authored per-course via `Course.accessRestrictionMessage` so the language fits the offering (a teacher-training course's "how do I get in" is different from a private dharma study group's).

For the bundled-only case when no Program is currently open, the message can be derived: "Currently offered through live cohorts — check back when registration opens." (Or admin-overridable.)

### Authentication

All program participation and all course enrollment require a member account. An unauthenticated visitor clicking "Enroll" on `/course/[slug]` goes through the 6-digit sign-in code flow first (sessions 119/120 architecture), then lands in the dana flow (or direct enrollment if `selfEnrollDanaRequired=false`). No guest checkout, no anonymous-purchase edge cases.

---

## Open questions to resolve before build

1. **Pending dana on courses.** Does an unpaid pledge block lesson access? Block enrollment entirely? Grant probationary access? Programs already have a behavior here — does the same apply, or do courses differ?
2. **`CourseAccess` vs `SeriesEnrollment` boundary.** Is `CourseAccess` an independent access path (member has access without an enrollment record), or does creating one always trigger creation of a `SeriesEnrollment`? Today both tables exist. The relationship needs codifying — likely `CourseAccess` is the *admin grant record*, and the access check is an OR across both tables. Confirm at build.
3. **Course refund / cancellation policy.** What happens if a member wants out of a paid course? Lifetime-access courses don't have a natural expiry; the answer differs from Programs.
4. **Editor presets.** Should the Course Manager surface the canonical shapes (above) as one-click presets, or expose the flags raw? Presets reduce error but hide expressiveness; raw flags are accurate but invite invalid combinations.
5. **Default `accessRestrictionMessage` fallback.** If the field is empty on a course that's role-gated or bundled-only, what does the page show? Probably a sensible derived default ("This course is offered to [role] members" / "Currently offered through live cohorts"), but worth deciding the exact wording before build.

**Resolved this session (was open):**
- ~~Hybrid transition trigger~~ — Resolved by the resolved-live-cohort rule: the live path is "active" whenever a linked Program has open registration with a future start. No admin flip, no date field. Standalone always-available when `allowSelfEnroll=true`; live just disappears when no Program qualifies.

---

## Connections — what this touches

**Schema** — `Course`, `Program`, `ProgramCourse`, `SeriesEnrollment`, `CourseAccess`, `Registration`.

**Routes** — `/courses`, `/course/[slug]`, `/programs`, `/programs/[slug]`, `/account/programs`, `/account/courses`, `/tools/programs`, `/tools/learning/*`.

**APIs** — `/api/courses` (read), `/api/courses/[slug]/enroll` (POST for self-enroll, DELETE for leave), course CRUD under `/tools/learning`, plus a new dana/checkout path for self-enroll-with-dana.

**Auth** — Sign-in code enrollment flow inherits the existing pattern (`/login` → 6-digit code → callback → enroll). Account creation precedes dana checkout.

**Email** — New templates likely: course-enrollment-confirmation, course-dana-receipt, course-access-granted (manual). Each must ship with a seed entry in `prisma/migrate.mjs` per the Email Template Gate.
