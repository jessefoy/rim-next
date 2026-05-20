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

### Authentication

All program participation and all course enrollment require a member account. An unauthenticated visitor clicking "Enroll" on `/course/[slug]` goes through magic-link auth first, then lands in the dana flow (or direct enrollment if `selfEnrollDanaRequired=false`). No guest checkout, no anonymous-purchase edge cases.

---

## Open questions to resolve before build

1. **Pending dana on courses.** Does an unpaid pledge block lesson access? Block enrollment entirely? Grant probationary access? Programs already have a behavior here — does the same apply, or do courses differ?
2. **`CourseAccess` vs `SeriesEnrollment` boundary.** Is `CourseAccess` an independent access path (member has access without an enrollment record), or does creating one always trigger creation of a `SeriesEnrollment`? Today both tables exist. The relationship needs codifying — likely `CourseAccess` is the *admin grant record*, and the access check is an OR across both tables. Confirm at build.
3. **Hybrid transition.** When a Program's live cohort ends, what makes the Course's standalone-dana path "active"? Automatic (date-driven)? Admin-triggered? Or always-active and the Program path simply expires alongside the Program?
4. **Course refund / cancellation policy.** What happens if a member wants out of a paid course? Lifetime-access courses don't have a natural expiry; the answer differs from Programs.
5. **Editor presets.** Should the Course Manager surface the canonical shapes (above) as one-click presets, or expose the flags raw? Presets reduce error but hide expressiveness; raw flags are accurate but invite invalid combinations.

---

## Connections — what this touches

**Schema** — `Course`, `Program`, `ProgramCourse`, `SeriesEnrollment`, `CourseAccess`, `Registration`.

**Routes** — `/courses`, `/course/[slug]`, `/programs`, `/programs/[slug]`, `/account/programs`, `/account/courses`, `/tools/programs`, `/tools/learning/*`.

**APIs** — `/api/courses` (read), `/api/courses/[slug]/enroll` (POST for self-enroll, DELETE for leave), course CRUD under `/tools/learning`, plus a new dana/checkout path for self-enroll-with-dana.

**Auth** — Magic-link enrollment flow inherits the existing pattern. Account creation precedes dana checkout.

**Email** — New templates likely: course-enrollment-confirmation, course-dana-receipt, course-access-granted (manual). Each must ship with a seed entry in `prisma/migrate.mjs` per the Email Template Gate.
