# RIM Next — Feature Reference

This document is the authoritative record of every significant feature built into the app.
**It must be updated at the end of every working session.**

Two audiences:
- **Everyone** — plain-language descriptions of what each feature does and where to find it
- **Claude (technical notes)** — implementation details, gotchas, and patterns that matter for future work. Clearly marked with 🔧.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Roles & Permissions](#2-roles--permissions)
3. [Route Protection](#3-route-protection)
4. [Program Registration System](#4-program-registration-system)
5. [Volunteer / Registrar Admin Area](#5-volunteer--registrar-admin-area)
6. [Member Dashboard](#6-member-dashboard)
7. [Database Schema](#7-database-schema)
8. [API Routes](#8-api-routes)
9. [Sanity CMS Schema Additions](#9-sanity-cms-schema-additions)
10. [CSS Architecture](#10-css-architecture)

---

## 1. Authentication

**What it does:** Members sign in via a magic link sent to their email — no password needed. Clicking the link in the email logs them in and redirects to their dashboard.

**Flow:**
1. User visits `/login`, enters email
2. Resend sends a magic-link email
3. User clicks link → lands at `/account/dashboard`
4. Session persists via a database-backed cookie

**Key files:**
- `auth.ts` — NextAuth v5 config (Resend provider, Prisma adapter, session callbacks)
- `app/login/page.tsx` — login page
- `app/login/check-email/page.tsx` — "check your inbox" confirmation page
- `prisma/schema.prisma` — stores sessions, verification tokens

**🔧 Technical notes:**
- NextAuth v5 uses `auth()` (not `getServerSession`) for server components
- Session callback queries the DB for `firstName` and `roles` so they're available on `session.user` without extra fetches on every page
- `EMAIL_FROM` is currently `onboarding@resend.dev` — must be changed to the RIM domain after Resend DNS verification
- Magic links expire per Resend's default TTL

---

## 2. Roles & Permissions

**What it does:** Users can hold one or more staff roles that unlock protected areas of the site. Regular members have an empty roles array and see nothing different.

**Current roles:**
| Role | Access |
|---|---|
| `ADMIN` | Everything — full site management |
| `REGISTRAR` | Volunteer admin area — view and manage registrations |
| `TEACHER` | (defined, not yet used) |
| `VOLUNTEER` | (defined, not yet used) |

**Where roles are assigned:** Directly in the database. To grant a role, run SQL on Neon:
```sql
UPDATE users SET roles = '{ADMIN}' WHERE email = 'person@example.com';
-- Multiple roles:
UPDATE users SET roles = '{REGISTRAR,ADMIN}' WHERE email = 'person@example.com';
```

**Key files:**
- `prisma/schema.prisma` — `roles Role[] @default([])` on the `User` model; `enum Role`
- `auth.ts` — session callback reads `roles` from DB and attaches to `session.user.roles`
- `types/next-auth.d.ts` — TypeScript declaration that adds `id` and `roles` to the session type

**🔧 Technical notes:**
- Roles is a Postgres array (not a join table) — simpler to query but requires raw SQL for initial migration if the column type changes
- The original schema had a single `role Role @default(MEMBER)`. Migration to the array required raw SQL because Prisma couldn't handle the enum mutation + column type change atomically. If roles need to change again, plan for a raw SQL migration
- Authorization checks look like: `session.user.roles?.some(r => ['REGISTRAR','ADMIN'].includes(r))`
- `MEMBER` was removed from the enum when switching to the array model; regular membership is now implicit (empty roles array)

---

## 3. Route Protection

**What it does:** Certain URL paths require authentication. Unauthenticated users are redirected to `/login`.

**Protected paths:**
- `/account/*` — member-only area (dashboard, profile, etc.)
- `/volunteer/*` — staff-only area

**Key file:** `proxy.ts` (Next.js 15 uses `proxy.ts`, not `middleware.ts`)

**Authorization levels:**
- `/account/*` — any authenticated session
- `/volunteer/*` — server component checks `session.user.roles` and renders an "unauthorized" message if the user lacks `REGISTRAR` or `ADMIN`; redirect happens at the route level, not in proxy

**🔧 Technical notes:**
- Next.js 16 moved from `middleware.ts` to `proxy.ts` — do not create or restore `middleware.ts`
- The volunteer pages do a second authorization check inside the server component (beyond the proxy) because the proxy only checks for a session, not for specific roles
- `params` in App Router dynamic routes is a `Promise<{slug}>` in Next.js 15+ — always `await params`

---

## 4. Program Registration System

**What it does:** Members (and non-members) can register for programs directly on the program detail page. The form handles capacity limits, waitlisting, custom per-program questions, and duplicate prevention.

### 4a. Registration Form (`/programs/[slug]`)

**User experience:**
- Standard fields: First Name, Last Name, Email, Phone, Comments
- Optional custom fields configured per-program in Sanity (short text, long text, yes/no, dropdown)
- If the program is full: banner notice + button changes to "Join Waitlist"
- If ≤5 spots remain: "Only X spots remaining!" warning
- If already registered: form replaced with confirmation message
- If deadline passed: form replaced with "Registration closed" message
- After submitting: success message on screen + confirmation email sent to registrant

**Non-member handling:** If someone registers without being logged in, the system finds or creates a User record by email automatically. They don't need an account to register.

**Key files:**
- `components/RegistrationForm.tsx` — client component, all form logic
- `app/programs/[slug]/page.tsx` — server component; fetches capacity, user profile, existing registration; passes props to form
- `app/api/registrations/route.ts` — POST endpoint
- `lib/email.ts` — Resend email utility (`sendRegistrationEmail`)

**🔧 Technical notes:**
- Phone auto-formats as `(XXX) XXX-XXXX` while typing — `formatPhoneInput()` strips all non-digits then reformats, so any input format works
- Email is `readOnly` when the user is logged in (pre-filled from session, can't be changed in the form)
- `sessionUserId` is passed directly through the POST body so the API doesn't have to re-lookup the user by email (prevents account mismatch edge case)
- Custom field answers are stored as a JSON object `{ "Question label": "Answer" }` in the `customFields` column (Postgres `Json` type)
- `alreadyRegistered` is checked server-side for logged-in users only; guest duplicate prevention happens in the API by resolving the email to a userId first
- Form states: `idle | submitting | registered | waitlisted | error | duplicate`
- `dateText`, `timeText`, `locationText` are passed in the POST body (already available on the program page from Sanity) so the API can include them in the email without an extra Sanity fetch

### 4b. Capacity & Waitlist Logic

**How capacity works:**
- `registrationCapacity` is set in Sanity per program (null = unlimited)
- "Active" registrations = `REGISTERED` + `APPROVED` status (not `WAITLISTED` or `CANCELLED`)
- If active count < capacity → status = `REGISTERED`, donationStatus = `PENDING`
- If active count >= capacity → status = `WAITLISTED`, donationStatus = `NOT_REQUIRED`, waitlist position assigned
- Waitlist position = count of existing `WAITLISTED` records + 1

**🔧 Technical notes:**
- Capacity check and registration creation are not wrapped in a transaction — there's a theoretical race condition if two people register simultaneously for the last spot. Acceptable for current scale; fix with a DB transaction if needed later

### 4c. Duplicate Prevention

A registration is considered a duplicate if the same `userId` + `programId` already exists with status not equal to `CANCELLED`. Cancellations are allowed to re-register.

---

## 5. Volunteer / Registrar Admin Area

**What it does:** A private area for staff to view and manage registrations for all programs. Accessible at `/volunteer`.

### 5a. Programs Landing Page (`/volunteer`)

- Lists all programs with `registrationEnabled = true` (pulled from Sanity)
- Shows counts by status: total, registered, waitlisted, approved
- Each program links to its detail table

**Key file:** `app/volunteer/page.tsx`

### 5b. Registration Table (`/volunteer/programs/[slug]`)

**What the registrar can do:**
- See all registrants in a table (name, email, phone, status, donation status, registration date)
- Filter by status: All / Registered / Waitlisted / Approved / Cancelled
- Change a registrant's status inline (dropdown, saves immediately)
- Click any row to expand it and see: custom field answers, comments, and internal notes
- Write and save internal notes per registrant (not visible to the member)
- Export all registrations as a CSV file (includes all custom fields as columns)

**Mobile layout:** On small screens the table transforms into cards — each row shows name + email stacked on the left, status dropdown on the right. Phone number and registration date appear inside the expanded panel on mobile.

**Key files:**
- `app/volunteer/programs/[slug]/page.tsx` — server component (fetches program + registrations)
- `components/VolunteerTable.tsx` — client component (all interactivity)

**🔧 Technical notes:**
- Status updates use optimistic UI — the UI updates immediately and reverts if the API call fails
- CSV export is a plain `<a href download>` link to the API, not a JS fetch — simplest possible approach and avoids state management
- `colSpan={7}` on the expanded detail row must stay in sync with the number of `<th>` columns in the table header
- Mobile card layout uses `display: grid` on `<tr>` elements after setting `display: block` on `<table>` and `<tbody>`. This breaks the table formatting context, which is required for the grid to work
- **Known specificity gotcha:** `.vol-row td { display: none }` is (0,1,1). Override selectors must be `.vol-row .vol-row__name` (0,2,0) — NOT just `.vol-row__name` (0,1,0) which loses to the hide rule

---

## 6. Member Dashboard

**What it does:** The first page members see after login. Shows Zoom links for today's programs and, for staff, links to their admin areas.

### 6a. Today's Zoom Links

- Queries Sanity for programs with a Zoom link, filtered to today's day of week (in Milwaukee/CT timezone)
- Shows program name, time, and a "Join Zoom" button
- Handles special announcements and early arrival messages per program

**Key file:** `app/account/dashboard/page.tsx`

### 6b. Staff Access Panel

- Appears only for users with at least one role in `STAFF_LINKS` (currently `ADMIN` and `REGISTRAR`)
- Shows a card for each distinct area they have access to
- Regular members see nothing — the panel is not rendered at all (no hidden DOM elements)
- To add a new staff area: add an entry to the `STAFF_LINKS` map in `dashboard/page.tsx`

**Current staff links:**
| Role(s) | Card Label | Destination |
|---|---|---|
| `ADMIN`, `REGISTRAR` | Registrations | `/volunteer` |

**🔧 Technical notes:**
- Deduplication: if a user holds both `ADMIN` and `REGISTRAR` (which currently point to the same href), only one card renders. Uses `Object.fromEntries` keyed by `href` to collapse duplicates
- Dashboard page is still in the 🟠 Webflow CSS layer — staff panel uses `db-` prefixed classes in `custom.css` to avoid conflicts

---

## 7. Database Schema

**Database:** Neon Postgres (serverless). Managed via Prisma.

### Models

#### User
Standard NextAuth user extended with:
- `firstName`, `lastName`, `phone` — profile fields
- `roles Role[]` — array of staff roles (empty = regular member)
- `registrations Registration[]` — relation to registration records

#### Registration
Stores one record per person per program.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `programId` | String | Sanity `_id` |
| `programSlug` | String | For URL lookups |
| `programTitle` | String | Denormalized for display |
| `userId` | String? | Nullable — links to User |
| `email` | String | Always stored normalized (lowercase) |
| `firstName`, `lastName` | String | |
| `phone` | String? | Stored as entered after digit normalization |
| `comments` | String? | Registrant's message |
| `customFields` | Json? | `{"Question": "Answer"}` |
| `status` | RegistrationStatus | REGISTERED / WAITLISTED / APPROVED / CANCELLED |
| `waitlistPosition` | Int? | Set only when WAITLISTED |
| `notes` | String? | Internal staff notes, never shown to member |
| `donationStatus` | DonationStatus | NOT_REQUIRED / PENDING / COMPLETED / WAIVED |
| `donationAmount` | Int? | Cents (reserved for Stripe, not yet used) |
| `stripeSessionId` | String? | Reserved for Stripe, not yet used |

#### Enums
```
Role:               REGISTRAR | TEACHER | VOLUNTEER | ADMIN
RegistrationStatus: REGISTERED | WAITLISTED | APPROVED | CANCELLED
DonationStatus:     NOT_REQUIRED | PENDING | COMPLETED | WAIVED
```

**🔧 Technical notes:**
- `db push` (not `migrate`) is used for schema changes — no migration history files
- To apply schema changes: `set -a && source .env.local && set +a && npx prisma db push`
- Roles migration from single `role` to array `roles` required raw SQL — Prisma couldn't handle the enum + column type change atomically. See session log 2026-03-01 in MEMORY.md for the exact SQL used

---

## 8. API Routes

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/registrations` | None required | Create a registration; finds/creates user by email if not logged in |
| `PATCH` | `/api/registrations/[id]` | REGISTRAR or ADMIN | Update `status`, `notes`, or `donationStatus` on a registration |
| `GET` | `/api/programs/[slug]/registrations` | REGISTRAR or ADMIN | List registrations for a program; add `?format=csv` for CSV download |

**🔧 Technical notes:**
- All PATCH/GET admin routes call `auth()` and check `session.user.roles` — they return `401` if unauthenticated or `403` if unauthorized
- The CSV export builds dynamic column headers by collecting all unique custom field keys across all registrations in the program — so if different registrations have different custom fields, all columns appear
- `PATCH` validates status values against the allowed enum list before writing to DB

---

## 9. Sanity CMS Schema Additions

The Sanity schema lives at `/Users/jessefoy/Sites/rim-website/sanity/` and is shared by both the Eleventy and Next.js projects.

### Fields added to `programs` schema (registration group)

| Field | Type | Purpose |
|---|---|---|
| `registrationEnabled` | boolean | Toggle to enable the new registration system for a program |
| `registrationCapacity` | number | Max registrations before waitlist kicks in (leave blank = unlimited) |
| `registrationDeadline` | datetime | After this date, form shows "Registration closed" |
| `suggestedDonation` | number | Dollar amount shown in the form (Stripe flow not yet built) |
| `registrationFields` | array of objects | Custom per-program questions (see below) |

### Registration field object schema
Each item in `registrationFields`:
- `label` — the question text (also used as the JSON key in `customFields` storage)
- `fieldType` — `shortText | longText | yesNo | select`
- `required` — boolean
- `options` — array of strings (only for `select` type)

**🔧 Technical notes:**
- Sanity deploy command: `cd /Users/jessefoy/Sites/rim-website/sanity && npx sanity deploy`
- `registrationEnabled` being `false` (or absent) falls back to the old Fillout.com form path on the program page
- The `label` string doubles as the storage key — if a label is renamed in Sanity after registrations exist, old data will appear under the old key name in the CSV. Treat labels as permanent once in use

---

## 10. CSS Architecture

### Design system status

| Layer | Status | Notes |
|---|---|---|
| 🟠 Webflow | Legacy — being phased out | Uses raw Webflow class names from `rim.webflow.css` |
| 🟢 Design System | New pages | Prefixed classes + CSS custom properties, zero Webflow dependency |

### Custom CSS file
All custom styles: `public/css/custom.css`

### Page prefixes (🟢 design system pages)
| Prefix | Page |
|---|---|
| `lp-` | Lesson pages |
| `cr-` | Class recording pages |
| `pg-` | Program detail pages |
| `vol-` | Volunteer admin area |
| `db-` | Member dashboard additions |

### Design tokens (CSS custom properties)
```css
--rim-bg: #f6f3f0          /* warm parchment */
--rim-bg-accent: #ede9e5   /* slightly darker warm */
--rim-blue: #135274        /* primary blue */
--rim-mid: #39607a         /* mid teal-blue — links, accents */
--rim-text: #333333        /* body text */
--rim-text-muted: #6b6059  /* labels, captions */
--rim-rule: #c8bcb2        /* borders, dividers */
--font-serif: Libre Baskerville
--font-sans: Open Sans
```

**🔧 Technical notes:**
- Never edit `normalize.css`, `webflow.css`, or `rim.webflow.css`
- Webflow's `p { font-size: 17px }` is declared (not inherited) — any font-size override on a parent element will not cascade to `<p>`. Set explicitly on the element
- Never use `<blockquote>` in JSX — Webflow CSS targets it aggressively with styles that break the design system. Use `<div>` or `<figure>` instead
- CSS specificity ladder for `custom.css` overrides: element (0,0,1) < class (0,1,0) < `.parent .class` (0,2,0) < `.parent tag.class` (0,2,1)
- No box-shadows in the design system — separation is achieved through color contrast

---

## Session Log

| Date | Summary |
|---|---|
| 2026-03-01 | Built complete registration system: RegistrationForm, volunteer admin table, API routes, DB schema (roles array, Registration model), Sanity schema fields, route protection, staff dashboard panel, mobile-friendly volunteer pages; added FEATURES.md |
| 2026-03-01 | Registration confirmation emails via Resend (`lib/email.ts`) — HTML + plain-text, REGISTERED and WAITLISTED variants, includes program date/time/location when available |

---

*Last updated: 2026-03-01 (session 2)*
