# RIM Next — Feature Reference

> **Before working on any hub, member data, role, or permission-related feature, read `RIM_System_Architecture.md` and the relevant section of `RIM_Role_Design.md`.**

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
11. [Member Management System](#11-member-management-system-adminmembers)
12. [Course Access System](#12-course-access-system-courseslug)
13. [Donation Management System](#13-donation-management-system-phase-2--planned)
14. [Community Onboarding & Membership Philosophy](#14-community-onboarding--membership-philosophy)
15. [Site Administration Tools](#15-site-administration-tools)
16. [Navigation Component](#16-navigation-component)
17. [Planned Features](#17-planned-features)
18. [~~Sanity Studio Access for Staff~~ (removed session 54)](#18-sanity-studio-access-for-staff-removed)
19. [Google Meet Integration](#19-google-meet-integration--high-priority)
20. [Staff Reference Manual](#20-staff-reference-manual)
21. [HOST Role & Host Area](#21-host-role--host-area)
22. [Household / Family Grouping](#22-household--family-grouping)
23. [Host Community Hub](#23-host-community-hub)
24. [Multi-Hub Workspace System](#24-multi-hub-workspace-system)
25. [Virtual Host Hub — Attendance & Session Tracking](#25-virtual-host-hub--attendance--session-tracking)
26. [Email Template Manager](#26-email-template-manager)
27. [Teacher Hub & Content Management](#27-teacher-hub--content-management)
28. [Editor Standard](#28-editor-standard)
29. [Support Inbox (removed)](#29--support-inbox----removed-session-100-2026-05-06)
30. [Learning System — Planned](#30-learning-system--planned)
31. [Contextual Help System (Manual Sections)](#31-contextual-help-system-manual-sections)
32. [Admin Member Profile — Section Registry](#32-admin-member-profile--section-registry)
33. [BlockNote Editor System](#33-blocknote-editor-system)
34. [Hub Documents — Native](#34-hub-documents--native)
35. [Hub Notification Redesign — Pinned Threads + Unread Indicators](#35-hub-notification-redesign)
36. [Site-Wide Banner](#36-site-wide-banner)
37. [Program Registration System — Postgres Migration](#37-program-registration-system--postgres-migration)
38. [LiveKit Video Conferencing](#38-livekit-video-conferencing--phase-1-2--built--session-76-2026-03-25)
39. [Open Access — Guest Join for Virtual Programs](#39-open-access--guest-join-for-virtual-programs)
40. [ProgramTeacher — Linked Teacher Accounts](#40-programteacher--linked-teacher-accounts)
49. [Hub System — Audit Findings + Cleanup (session 115)](#49-hub-system--audit-findings--cleanup--built--session-115-2026-05-14)
50. [Course Offering Model — Orthogonal Flags + Tabbed Editor + Dana Parity (session 123)](#50-course-offering-model--orthogonal-flags--tabbed-editor--dana-parity--built--session-123-2026-05-25)

---

## 1. Authentication

**What it does:** Members sign in by typing a 6-digit code sent to their email — no password, no magic link. Entering the code on the sign-in page logs them in and redirects to their dashboard. Switched from magic link to code in session 119 (2026-05-21).

**Flow:**
1. User visits `/login`, enters email
2. Resend sends an email with a 6-digit code (large, centered, no link)
3. User lands at `/login/check-email?email=ENCODED` with the code-entry form
4. User types the code → form GETs `/api/auth/callback/resend?token=CODE&email=EMAIL&callbackUrl=/account/dashboard`
5. NextAuth verifies the token, sets the session cookie, redirects to `/account/dashboard`

**Why code, not magic link:** magic links route to the OS default browser regardless of where the user wants to be (a Safari user who prefers Chrome ends up authenticated in Safari with no way to "send to Chrome"). PWAs on iOS can't reliably receive magic-link clicks either — the OS routes the click to Safari, not the installed PWA. Codes work in every context because the user types them into the app/browser they're standing in. Industry-standard pattern (Slack, Apple, Mercury, Notion all do this).

**Key files:**
- `auth.ts` — NextAuth v5 config (Resend provider, Prisma adapter, session callbacks). Overrides `generateVerificationToken` to return a 6-digit code via `crypto.randomInt(100000, 1000000)`. `maxAge: 30 * 60` on the Resend provider (30-min code expiry).
- `lib/email.ts::sendSignInCodeEmail` — sends the templated email with the code as a Handlebars variable. Calls `sendTemplatedEmail` with `throwOnFailure: true` so a missing/disabled template surfaces to the user rather than silently swallowing the sign-in.
- `app/login/page.tsx` — server action calls `signIn("resend", { email, redirect: false })`, detects email-send failure via the returned error-URL (signIn with `redirect: false` does NOT throw on failure — it returns an error-page URL string), and redirects to `/login/check-email?email=ENCODED` on success.
- `app/login/check-email/page.tsx` — reads `email` from URL params (redirects to `/login` if missing), shows a 6-digit input form, includes an inline "send a new code" affordance.
- `app/login/error/page.tsx` — sign-in error landing page.
- `prisma/schema.prisma` — `VerificationToken` table (NextAuth standard). No schema change for the code switch; the token value is just a 6-digit string instead of a long random one.

**Email templates (Email Template Gate — see CLAUDE.md):**
- `sign-in-code-new-user` — sent to first-time visitors (no account, or account without `agreedToTerms`)
- `sign-in-code-returning` — sent to existing members
- Both seeded in `prisma/migrate.mjs` (`seed_sign_in_code_email_templates`) via defensive `findUnique → create` so admin edits at `/admin/emails` are preserved on re-run. Both `enabled: true` — required for sign-in to work.
- The old `magic-link-new-user` / `magic-link-returning` templates were deleted by the same migration.

**🔧 Technical notes:**
- NextAuth v5 uses `auth()` (not `getServerSession`) for server components
- Session callback queries the DB for `firstName`, `roles`, `agreedToTerms`, `archivedAt` so they're available on `session.user` without extra fetches on every page
- `EMAIL_FROM` is currently `onboarding@resend.dev` — must be changed to the RIM domain after Resend DNS verification
- Code expiry: **30 minutes** (was 10 in the first ship; bumped after users hitting expiry on the walk-away-and-come-back flow)
- Codes never start with `0` because `crypto.randomInt(100000, 1000000)` is lower-inclusive / upper-exclusive. Keyspace 900K. Acceptable for sangha scale, but rate-limiting the callback endpoint is a backlog candidate before this gets meaningful traffic
- NextAuth's default behavior allows multiple unconsumed codes to coexist (each `signIn` call creates a fresh row in `VerificationToken`); they're independently valid until consumed (single-use) or expired. Kept intentionally — Jesse uses this himself
- Session: `maxAge: 90 * 24 * 60 * 60` (90 days), `updateAge: 24 * 60 * 60` (refresh expiry at most once per day on activity). Sign-in friction is once per device, not every visit
- The callback URL is constructed entirely client-side (form GETs `/api/auth/callback/resend`) so the `NEXTAUTH_URL` trimming concern from `UP_NEXT.md` doesn't apply here
- `signIn` with `redirect: false` returns a URL string rather than throwing on failure — when adapting this pattern elsewhere, always inspect the returned URL for `error=` query params

---

## 2. Roles & Permissions

**What it does:** Users can hold one or more staff roles that unlock protected areas of the site. Regular members have an empty roles array and see nothing different.

**Current roles:**
| Role | Access | Dashboard links |
|---|---|---|
| `ADMIN` | Everything — full site management. Technical authority: hub config, hard-remove member, system-wide settings, all admin surfaces. | Registrations, Members, Staff Manual |
| `GUIDING_TEACHER` | Sangha-wide dharma authority. Acts as **implicit coordinator on every hub** for content + moderation: archive/restore/trash any document or thread, edit any thread, pin/unpin, override document lock, edit member status. Does NOT inherit ADMIN-level technical scope (hub config, hard-remove member, hub create/delete, system-wide). Scope: session 115. Currently held only by Jesse. | Same as ADMIN if also ADMIN |
| `REGISTRAR` | Registration management, member profiles, course access, Program Editor | Registrations, Members, Staff Manual |
| `HOST` | Host Community Hub — schedule, sub board, conversations, session tracking | Host Hub |
| `HOST_MANAGER` | All HOST access + assignment management + unassigned alerts | Host Hub |
| `TEACHER` | Teacher Hub — manages courses and lessons in Postgres | Teacher Hub |

New roles are added only when there is real functionality to attach to them.

**🔧 Coordinator-level authority is computed via `lib/hubAuth.ts::effectiveCoordinator(member, roles)` (session 115).** Returns true for `HubMember.isCoordinator` on the current hub, OR `ADMIN`, OR `GUIDING_TEACHER`. Used in 14+ sites to gate coordinator UI and write paths. `requireCoordinator(isCoordinator, roles)` and `canManageTrash(roles, isCoordinator)` likewise bypass for ADMIN + GT. Don't inline the boolean — use the helper. The pre-session-115 pattern `(member?.isCoordinator ?? false) || isAdmin` silently omitted GT and is no longer correct.

**Where roles are assigned:** Via the admin member detail page (`/admin/members/[id]`). Check or uncheck the role checkbox, then click "Save changes." No direct database access needed.

**Automatic notification:** When the REGISTRAR role is newly added and saved, `sendRoleAssignmentEmail()` fires automatically (fire-and-forget). The email highlights two things: a primary "Go to your dashboard" button and a prominent outline "Read the Staff Manual →" button. Intro copy reads: "Two things to bookmark: your Registrations dashboard … and the Staff Manual — a plain-English guide to every part of the system." Admin role assignment does not trigger a notification. Re-saving with REGISTRAR already set does not re-send.

To grant a role without the UI (e.g., bootstrapping the first ADMIN), run SQL on Neon:
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

**Key file:** `proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`)

**Authorization levels:**
- `/account/*` — any authenticated session; also checks `agreedToTerms` and redirects to `/account/welcome` if false
- `/volunteer/*` — server component checks `session.user.roles` and renders an "unauthorized" message if the user lacks `REGISTRAR` or `ADMIN`; redirect happens at the route level, not in proxy

**🔧 Technical notes:**
- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** — this is a Next.js 16 breaking change. Do not create or restore `middleware.ts`. The exported function name and `config.matcher` export are unchanged.
- The volunteer pages do a second authorization check inside the server component (beyond the proxy) because the proxy only checks for a session, not for specific roles
- `params` in App Router dynamic routes is a `Promise<{slug}>` in Next.js 15+ — always `await params`

---

## 4. Program Registration System

**What it does:** Members (and non-members) can register for programs directly on the program detail page. The form handles capacity limits, waitlisting, custom per-program questions, duplicate prevention, and an inline dana (contribution) step powered by Stripe.

### 4a. Registration Form (`/programs/[slug]`)

**User experience:**
- Standard fields: First Name, Last Name, Email, Phone
- Optional custom fields configured per-program in Sanity (short text, long text, yes/no, dropdown)
- If the program is full: banner notice + button changes to "Join Waitlist"
- If ≤5 spots remain: "Only X spots remaining!" warning
- If already registered: form replaced with confirmation message
- If already registered AND `donationStatus === PENDING` (promoted from waitlist): dana step shown immediately instead of "already registered" message
- If deadline passed: form replaced with "Registration closed" message
- After submitting: success message on screen + confirmation email sent to registrant
- For registered (not waitlisted) participants: inline dana step appears after confirmation (see 4c)

**Non-member handling:** If someone registers without being logged in, the system finds or creates a User record by email automatically. They don't need an account to register.

**Returning member recognition:** When a non-logged-in person types their email and leaves the field, the form calls `GET /api/account/check-email`. If the email matches a known account:
- First name, last name, and phone are pre-filled from the account (account values always win — corrects any typo the person may have typed before entering their email)
- A warm notice appears: "Welcome back, [Name]! Your registration will be linked to your account."
- The name and phone fields are locked (`readOnly`) — they cannot be changed in the registration form; members must use their profile page to update personal details
- If the found account has `agreedToTerms = true`, the community agreements checkbox section is hidden

**Security — one email = one identity:** Personal fields (name, phone) are locked in the form for recognized accounts and also protected in the API. The `POST /api/registrations` route resolves `resolvedFirstName`, `resolvedLastName`, `resolvedPhone` — for existing user records, the account's stored values always win regardless of what was submitted. This prevents any unauthenticated form submission from overwriting a member's stored profile data.

**Key files:**
- `components/RegistrationForm.tsx` — client component, all form logic including the dana step
- `app/programs/[slug]/page.tsx` — server component; fetches capacity, user profile, existing registration, dana config; passes props to form
- `app/api/registrations/route.ts` — POST endpoint
- `app/api/account/check-email/route.ts` — GET: public endpoint, returns `{ exists, firstName, lastName, phone, agreedToTerms }` for a given email; used by the form for pre-fill on blur
- `lib/email.ts` — Resend email utility (`sendRegistrationEmail`)

**🔧 Technical notes:**
- Phone auto-formats as `(XXX) XXX-XXXX` while typing — `formatPhoneInput()` strips all non-digits then reformats, so any input format works
- Email is `readOnly` when the user is logged in (pre-filled from session, can't be changed in the form)
- `sessionUserId` is passed directly through the POST body so the API doesn't have to re-lookup the user by email (prevents account mismatch edge case)
- Custom field answers are stored as a JSON object `{ "Question label": "Answer" }` in the `customFields` column (Postgres `Json` type)
- `alreadyRegistered` is checked server-side for logged-in users only; guest duplicate prevention happens in the API by resolving the email to a userId first
- Form states: `idle | submitting | waitlisted | dana | dana_redirecting | done | error | duplicate` — "registered" was renamed to "done"; "dana" shows the contribution step; "dana_redirecting" disables the button while the Stripe session is being created
- `dateText`, `timeText`, `locationText` are passed in the POST body (already available on the program page from Sanity) so the API can include them in the email without an extra Sanity fetch
- `emailCheckStatus` state: `idle | checking | found | not_found`. The check is fire-and-forget — if it fails or the user submits before blur, the form works normally. Resetting `emailCheckStatus` to `"idle"` when the email field changes unlocks the name/phone fields again.
- API: `resolvedFirstName = user.firstName || form.firstName`; `resolvedLastName = user.lastName || form.lastName`; `resolvedPhone = user.phone || form.phone || null`. For new users (not found by email), form values are used directly. Profile fields are back-filled only when blank — existing values are never overwritten by unauthenticated form input.

### 4b. Capacity & Waitlist Logic

**How capacity works:**
- `registrationCapacity` is set in Sanity per program (null = unlimited)
- "Active" registrations = `REGISTERED` + `APPROVED` status (not `WAITLISTED` or `CANCELLED`)
- If active count < capacity → status = `REGISTERED`, donationStatus = `PENDING`
- If active count >= capacity → status = `WAITLISTED`, donationStatus = `NOT_REQUIRED`, waitlist position assigned
- Waitlist position = count of existing `WAITLISTED` records + 1

**🔧 Technical notes:**
- Capacity check and registration creation are not wrapped in a transaction — there's a theoretical race condition if two people register simultaneously for the last spot. Acceptable for current scale; fix with a DB transaction if needed later

### 4c. Dana & Stripe Payment Integration

**Philosophy:** RIM programs are offered in the spirit of dana — the traditional Buddhist practice of generosity. Dana is not a fee; it is an invitation to practice giving in a way that feels meaningful and sustainable. The system is designed to honor this: registration always confirms first, and the contribution step is a separate invitation, never a payment gate.

At the same time, the center has real financial needs, and some programs (retreats) have hard external costs (venue rental, food, lodging) that must be covered. The dana system accommodates both realities without conflating them.

**Dana modes (set per-program in Sanity, fully flexible):**

| Mode | What it means | Typical use |
|---|---|---|
| `none` | No dana step. Registration is free. | Drop-in events, community gatherings, intro nights |
| `voluntary` | Suggested amount shown, fully editable up or down, including zero. No minimum enforced. | Regular classes, sitting groups, daylong programs |
| `base_plus_dana` | A fixed base cost (e.g. retreat venue/meals) is required, plus a voluntary dana amount on top. | Retreats with external venue/food costs |
| `fixed` | A set price. No dana framing — straightforward payment. | Occasional workshops or events with a fixed fee |

**The dana step UI (inline, post-registration):**
- Appears only for `REGISTERED` participants (not `WAITLISTED` — their `donationStatus` is already `NOT_REQUIRED`)
- Registration confirms first, always — the dana step is a separate invitation
- Shows `danaMessage` from Sanity (program-specific, 1–3 sentences — replaces the long generic philosophy text currently used in Fillout)
- Pre-fills the amount field with `suggestedDana` from Sanity; user can edit freely
- For `base_plus_dana`: base cost displayed separately as a fixed line item; dana input for the additional voluntary amount above it
- **"Offer dana →"** button — creates a Stripe Checkout session and redirects
- **"I'll contribute another time"** link — genuinely optional, not a guilt link. Leaves `donationStatus: PENDING`. The confirmation email and future member area will provide the link again.
- For `none` mode: dana step is completely skipped

**Stripe Checkout flow:**
1. User clicks "Offer dana" → POST `/api/stripe/checkout` with `registrationId` + amount(s)
2. API creates a Stripe Checkout session with all metadata, returns session URL
3. Browser redirects to Stripe-hosted checkout (Stripe handles all card data — PCI compliant)
4. User completes payment on Stripe
5. Stripe fires a `checkout.session.completed` event to `/api/stripe/webhook`
6. Webhook verifies signature, updates `Registration`: `donationStatus: COMPLETED`, `donationAmount` (cents), `stripeSessionId`
7. Stripe redirects user back to `/programs/[slug]?dana=success`
8. Program page detects `?dana=success` query param and shows a brief thank-you notice

**Stripe metadata on every session (for QuickBooks reconciliation):**
```
registrationId   — our DB registration ID
programId        — Sanity _id
programTitle     — e.g. "Spring Retreat at Siena Center"
programSlug      — for URL routing
donorName        — full name
donorEmail       — email address
source           — "registration_dana"
```
This metadata makes every Stripe transaction self-describing. The `amountCents` in the line item is the total charged (base + dana combined). Future: add `danaMode` and `baseAmountCents` as additional metadata fields for more granular QuickBooks breakdown.

**Key files:**
- `components/RegistrationForm.tsx` — dana step UI (state: `dana`)
- `app/api/stripe/checkout/route.ts` — POST: creates Stripe Checkout session
- `app/api/stripe/webhook/route.ts` — POST: receives Stripe events, updates DB
- `lib/stripe.ts` — Stripe client singleton

**Environment variables required:**
```
STRIPE_SECRET_KEY            — Stripe secret key (server-side only)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — Stripe publishable key (client-side)
STRIPE_WEBHOOK_SECRET        — from Stripe dashboard, used to verify webhook signatures
```

**Unconfigured amounts:** If `danaMode` is `"fixed"` but `danaFixedAmount` is blank (null/0), or `"base_plus_dana"` but `danaBaseAmount` is blank, the dana step is skipped entirely and the registration completes as `donationStatus: WAIVED`. This prevents a broken state where the checkout button is shown but disabled (Stripe minimum is $1.00). The form sends `danaMode: "none"` to the API in this case so the DB reflects the correct status. **Admin action required:** always fill in the amount field in Sanity when using Fixed or Base + Dana mode.

**🔧 Technical notes:**
- Stripe Checkout (hosted page) is used — not Stripe Elements. Simpler, PCI handled by Stripe, no card data touches our server
- Webhook endpoint must be registered in the Stripe dashboard pointing to `https://rim-next.vercel.app/api/stripe/webhook` (or the real domain after DNS cutover). Event: `checkout.session.completed`
- Webhook handler must verify the Stripe-Signature header using `stripe.webhooks.constructEvent()` — never process unverified webhooks
- The raw request body is required for signature verification — Next.js must not parse it before the webhook handler. Use `export const config = { api: { bodyParser: false } }` or read raw body via `request.text()`
- `stripeSessionId` is stored on `Registration` — used for reconciliation and to prevent double-processing if the webhook fires twice
- For `base_plus_dana`: total charged = base + dana. Both are stored separately in metadata for QuickBooks but Stripe sees one line item for the total
- Waitlisted registrations never see the dana step — their `donationStatus` is `NOT_REQUIRED` from the moment of registration

### 4d. Email Delivery

**Registration confirmation email** — sent immediately after a successful registration. Two variants:
- **REGISTERED** — subject "You're registered — [Program]", includes date/time/location if set in Sanity
- **WAITLISTED** — subject "You're on the waitlist — [Program]", includes waitlist position if > 0

**Waitlist approval email** — sent by the API when a registrar promotes a registrant from `WAITLISTED` → `APPROVED` or `REGISTERED`. Subject: "Your spot is confirmed — [Program]". When the program has a dana practice (`danaMode !== "none"`), the email includes a warm dana section with a "Complete Dana Offering" button linking to the program page.

**Cancellation notification email** — sent to the registrar (`REGISTRAR_EMAIL` env var) whenever any registration is cancelled (by staff via the volunteer table, or in future by the member themselves). Includes registrant name, email, program, and a link to the registration table. `REGISTRAR_EMAIL` must be added to Vercel env vars; if not set, falls back to `EMAIL_FROM`.

**Per-program confirmation message** — an optional rich-text block in Sanity (`confirmationMessage` field, Registration tab) that appears in the body of the confirmation email for confirmed (non-waitlisted) registrants. Set per program; if blank, email sends as normal. Rendered in a warm tinted box (`background: #f6f3f0`) before the CTA button. Supports bold, italic, links, and bullet lists only (no headings or images — email-safe subset). Converted server-side at registration time; failure is logged but never blocks the registration response.

**Edit request email** — sent to the registrant when a registrar clicks "Send Edit Request." Subject: "Update your responses — [Program]". Body: warm note + "Update My Responses →" button → `${BASE_URL}/update/${token}`. Mentions the link expires in 7 days.

**Responses updated notification** — sent to `REGISTRAR_EMAIL` when a registrant submits the self-service edit form. Subject: "[First] [Last] updated their responses — [Program]". Includes a link to the volunteer registration table.

**Program reminder email** — sent to registrants as a reminder about an upcoming program. Subject: "A reminder — [Program]". Body: warm greeting, program date/time/location details (if set in Sanity), optional custom `reminderMessage` (Portable Text), and a CTA button (Zoom link if set, otherwise program page). Can be sent automatically via the daily cron or manually by the registrar for individual or all-unsent registrants. `reminderSentAt` is stamped on the registration record when sent — prevents double-sending regardless of which path fires first.

**Dana reminder email** — a gentle nudge to registrants whose `donationStatus` is `PENDING` (i.e. they skipped the dana step after registering). Subject: "A gentle reminder — your dana for [Program]". Links directly to the registration page dana step. Triggered manually by the registrar via a "Send Dana Reminder" button in the volunteer table (REGISTERED/APPROVED rows with PENDING dana only). API: `PATCH /api/registrations/[id]` with `{ action: "sendDanaReminder" }`. Returns `400` if `donationStatus` is not `PENDING`.

**Key files:** `lib/email.ts`, `lib/portableTextEmail.ts`

**🔧 Technical notes:**
- Uses Resend SDK (`resend@6.9.2`). **Critical:** Resend v4+ returns `{ data, error }` instead of throwing on failure — always destructure and check `error`. A plain `try/catch` will never fire on a Resend send error.
- `EMAIL_FROM` env var controls the sender address. Currently `onboarding@resend.dev` (Resend's shared sandbox domain). Switch to a verified RIM domain after DNS verification.
- `NEXTAUTH_URL` env var must be set in Vercel so program links in emails resolve correctly (e.g. `https://rim-next.vercel.app`).
- `REGISTRAR_EMAIL` env var — set in Vercel to the registrar's email address (e.g. `registrar@rootedinmindfulness.org`). Used for cancellation notifications and responses-updated notifications.
- Email failures are logged (`console.error`) but never throw — a failed email must never block the registration or status update.
- All email functions are fire-and-forget (`Promise<void>`) — no return value.
- `lib/portableTextEmail.ts` — converts Sanity Portable Text to email-safe HTML and plain text. Uses `@portabletext/to-html` with all inline styles (no `<style>` tags). `portableTextToEmailHtml()` and `portableTextToEmailText()` are the two exports. Component callbacks use `HC = { children?: string; value?: any }` type alias — the library types `children` as `string | undefined`, not `string`.

### 4e. Duplicate Prevention

A registration is considered a duplicate if the same `userId` + `programId` already exists with a status that is not `CANCELLED`. Cancellations are allowed to re-register.

---

## 5. Registrar Hub — Registration Management

**What it does:** A hub-based workspace for staff to view and manage registrations for all programs. Lives inside the multi-hub system at `/account/hub/registrar/programs`. REGISTRAR users are auto-synced to the hub via `syncHubMembership`. The hub also supports **stakeholder visibility** — non-registrar hub members (teachers, coordinators) see headcount and capacity only, no PII, no links to detail pages.

### 5a. Programs Tab (`/account/hub/registrar/programs`)

- Lists all programs (pulled from Sanity, sorted by `sortOrder`)
- Shows counts by status: confirmed, waitlisted, pending dana
- Capacity bar with color states (normal / near / full)
- Status signals: spot-open (green), waitlisted (amber), dana pending (amber)
- Each program card links to its detail page (registrar view only)
- **Stakeholder view** (non-REGISTRAR hub members): same cards but shows only confirmed count + capacity bar + waitlist count. No links, no pending dana, no spot-open/needs-attention signals.

**Key file:** `app/account/hub/[slug]/programs/page.tsx`

### 5b. Registration Table (`/account/hub/registrar/programs/[slug]`)

**What the registrar can do:**
- See all registrants in a table (name, email, phone, status, donation status, registration date)
- Filter by status: All / Registered / Waitlisted / Approved / Cancelled
- Take context-aware actions per row:
  - **WAITLISTED** → **"Promote →"** button: moves to APPROVED, sets `donationStatus` to PENDING (if program has dana) or WAIVED (if no dana), sends approval email (with dana section if applicable), and sends cancellation notification to the registrar email
  - **REGISTERED / APPROVED** → **"Cancel"** button: shows inline confirm ("Cancel this registration?" → "Yes, cancel" / "Never mind"), moves to CANCELLED, fires cancellation notification email to registrar
  - **CANCELLED** → **"Restore"** button: moves back to REGISTERED
  - **"Send Edit Request"** button (non-cancelled rows with custom fields only): shows inline confirm ("Send edit link to [Name]?" → "Yes, send it" / "Never mind") before sending registrant a secure one-time link to update their own answers (see 5c)
  - **"Send Reminder"** button (REGISTERED/APPROVED rows only): shows inline confirm ("Send reminder to [Name]?" → "Yes, send it" / "Never mind") before sending; button stays visible after sending so re-sends are always possible; a "Reminder sent [date]" note appears beneath it (timestamp updates to the most recent send) (see 5d)
- Click any row to expand it and see: custom field answers and internal notes
- **Edit Responses** — click "Edit" next to the RESPONSES column header to edit custom field answers inline. Renders the correct input type per Sanity field definition: `yesNo` → dropdown, `select` → dropdown with program's configured options, `longText` → textarea, `shortText` → text input. Saves via PATCH without page reload; shows "Saved ✓" flash on success.
- Write and save internal notes per registrant (not visible to the member)
- Export all registrations as a CSV file (includes all custom fields as columns)

**Mobile layout:** On small screens the table transforms into cards — each row shows name + email stacked on the left, status badge + action button on the right. Phone number and registration date appear inside the expanded panel on mobile.

**Key files:**
- `app/account/hub/[slug]/programs/[programSlug]/page.tsx` — server component (fetches program + registrations + `registrationFields` from Sanity)
- `components/registrar/VolunteerTable.tsx` — client component (all interactivity)
- `components/registrar/CreateMeetButton.tsx` — Google Meet creation (virtual/hybrid programs only)

**🔧 Technical notes:**
- Status updates use optimistic UI — the UI updates immediately and reverts if the API call fails
- CSV export is a plain `<a href download>` link to the API, not a JS fetch — simplest possible approach and avoids state management
- `colSpan={7}` on the expanded detail row must stay in sync with the number of `<th>` columns in the table header
- Mobile card layout uses `display: grid` on `<tr>` elements after setting `display: block` on `<table>` and `<tbody>`. This breaks the table formatting context, which is required for the grid to work
- **Known specificity gotcha:** `.vol-row td { display: none }` is (0,1,1). Override selectors must be `.vol-row .vol-row__name` (0,2,0) — NOT just `.vol-row__name` (0,1,0) which loses to the hide rule
- `registrationFields` is fetched from Sanity in the server component and passed as a prop — inline edit mode looks up each stored answer by label to determine which input type to render
- Edit button is inline with the RESPONSES column header (`.vol-detail__col-header` flex container) — not below the field list

---

### 5c. Self-Service Edit Link

**What it does:** Registrar clicks "Send Edit Request" on any non-cancelled registration that has custom field answers. The registrant receives an email with a unique link that opens a pre-filled form showing their current answers. They update their responses and submit; the registrar receives a notification email. The link expires in 7 days and is invalidated immediately after use (single-use).

**Flow:**
1. Registrar clicks "Send Edit Request" → PATCH `/api/registrations/[id]` with `{ action: "sendEditRequest" }`
2. API generates a UUID token, stores it on the Registration with a 7-day expiry
3. Registrant receives an email with a "Update My Responses →" button linking to `/update/[token]`
4. Registrant opens link → server component validates token + expiry, fetches program field definitions from Sanity by `programSlug`, renders pre-filled `<UpdateForm>`
5. Registrant edits their answers and submits → POST `/api/update/[token]`
6. API re-validates token (guards against expired links), updates `customFields`, clears `editToken` + `editTokenExpiresAt` (single-use), sends "responses updated" notification to registrar
7. Registrant sees: "Thank you — your responses have been updated."
8. Token is now invalidated — revisiting the link shows a "Link expired or already used" message

**Key files:**
- `app/update/[token]/page.tsx` — server component: validates token, fetches Sanity fields, renders form or expired message
- `components/UpdateForm.tsx` — client component: pre-filled inputs with correct types, submit handler, success state
- `app/api/update/[token]/route.ts` — POST: validates token, updates registration, clears token, notifies registrar
- `lib/email.ts` — `sendEditRequestEmail()` (to registrant) + `sendResponsesUpdatedEmail()` (to registrar)

**🔧 Technical notes:**
- Token is `crypto.randomUUID()` stored as `editToken @unique` + `editTokenExpiresAt DateTime?` on the `Registration` model
- Single-use: token is set to `null` immediately on the first successful POST — a second request returns `410 Gone`
- Field types are matched by label (the stored JSON key). If a field was removed from Sanity since the original registration, its stored answer renders in a plain `<input type="text">` fallback
- Registrar can still inline-edit custom fields after a self-service submission — no conflict; they're both just PATCHing `customFields`
- `sendEditRequest` action in the PATCH handler is separate from status/notes/donationStatus updates — it doesn't touch any of those fields

---

### 5d. Scheduled Reminder Email

**What it does:** A program-specific reminder email sent to registrants a few days before the program starts. The program coordinator sets a `reminderDate` in Sanity; the system automatically sends to all active (REGISTERED/APPROVED) registrants on that date via a daily cron. Because some people register after the scheduled cron fires, registrars can also send manually — either to all unsent registrants at once (bulk) or to a single registrant from the per-row Actions panel.

**Preventing double-sends:** `reminderSentAt` is stamped on the registration record at send time (cron or manual). Both paths skip registrants where this field is already set.

**CMS fields (programs → Registration tab):**
- `reminderDate` — datetime: when the cron should fire the reminder (set by program coordinator)
- `reminderMessage` — restricted Portable Text block: optional custom message shown in the email body (bold, italic, links, bullets only). If blank, a standard reminder is sent.

**Reminder section in VolunteerTable:** When `reminderDate` is set for a program, a banner appears above the table showing:
- Scheduled date
- "Sent to X of Y registrants" count
- "Send to Remaining N" button (if any unsent) — uses bulk endpoint
- "All sent ✓" when all active registrants have received the reminder

**Per-row button:** REGISTERED/APPROVED rows show a "Send Reminder" button in the Actions section. Clicking stamps `reminderSentAt` and replaces the button with "Reminder sent [date]" badge.

**Cron schedule:** `0 14 * * *` (daily at 14:00 UTC = 9:00 AM Central). Configured in `vercel.json`. Vercel passes `CRON_SECRET` as `Authorization: Bearer <secret>` — the route validates this header and returns 401 otherwise.

**Key files:**
- `app/api/cron/send-reminders/route.ts` — daily cron GET handler
- `app/api/programs/[slug]/send-reminder/route.ts` — bulk POST for "Send to Remaining" button
- `app/api/registrations/[id]/route.ts` — `action: "sendReminder"` case (per-row)
- `lib/email.ts` — `sendReminderEmail()`
- `lib/queries.ts` — `programReminderDataQuery` + `programsWithReminderInWindowQuery`
- `vercel.json` — cron schedule declaration

**🔧 Technical notes:**
- `CRON_SECRET` env var must be added to Vercel. Any long random string. Vercel Cron Jobs automatically pass it as the Authorization Bearer header to the registered route.
- Cron uses a 24-hour lookback window (`reminderDate >= now - 24h && reminderDate <= now`) — safe because `reminderSentAt` prevents double-sends if cron runs multiple times or slightly off schedule.
- `reminderDate` in Sanity is a datetime picker. Program coordinators should set it to the specific day they want the reminder sent (time doesn't matter much since the cron fires daily at 14:00 UTC).
- Reminder email includes location link as a hyperlink if `locationLink` is set. CTA button links to `zoomLink` (labeled with `zoomLinkText` or "Join on Zoom") if set, otherwise links to the program page.

---

## 6. Member Dashboard

**What it does:** The member area home page — a visual hub showing nav cards for every member resource, plus today's Zoom session links, pending dana reminders, and staff-only access panels. Redesigned 2026-03-03 from a bare Zoom-link list into a proper discovery hub so members can find all available resources without hunting through the nav.

### 6a. Member Home (`/account/dashboard`)

The member home page. A single `720px` content column (`db2-wrap`), sections in reading order (each conditional — empty bins don't render):

1. **Greeting** — "Good {morning|afternoon|evening}, [firstName]." + a stateful summary line ("You have 2 sessions today and 1 dana offering to complete." or today's date if nothing pending) + a quiet `See this week's community schedule →` link to `/this-week`. Schedule link added session 116 so members who don't pre-register have an in-page path to the community calendar.
2. **Today** — every commitment for today in one place: live virtual rows (Join button), later virtual rows (countdown), and in-person registrations (quiet "In-person" tag, no Join button).
3. **Coming up for you** — future-dated registrations (today is filtered out — those live in Today above), sorted by each program's *next* upcoming occurrence (not by registration creation date). Each row shows: date pill (projected next-occurrence date, not the program's first-ever anchor), title with inline start time ("Essential Dharma Study · 8:15 AM"), and either a "Registered" chip or a dana flame icon if `donationStatus: PENDING`. Limited to 5 rows. Renamed from "Your Programs" in session 116.
4. **Welcome to RIM — here's where to begin** — shown only when onboarding `SeriesEnrollment` records exist (`enrollmentSource: ONBOARDING`, not completed).
5. **Where you're studying** — non-onboarding `SeriesEnrollment` records with progress bars + Continue link. Renamed from "Your Series" in session 116.
6. **Where you're contributing** — hub cards with unread badges; ADMIN sees all hubs; others see only their `HubMember` records. Renamed from "Your Hubs" in session 116.

**Today logic:** `allVirtual` query fetches virtual/hybrid programs with full recurrence fields. JS-side `isOccurrenceToday()` handles weekly (day code + bi-weekly interval + series end), single events, monthly/daily. `shiftToToday()` corrects the live/later window for recurring programs. Sessions split into three states for the assigned host / ProgramTeacher / ADMIN (and two states for everyone else):

- **Open early as host** (host/teacher only, session 121) — teal row, "Enter as host" button, "Live opens at X:XX" clarifier. Window: `start - 22min` through `start - 12min`. Hosted today is determined by a single batched lookup per page render: viewer's `HostAssignment` rows (where `sessionDate` is today *or* null for legacy standing assignments) + viewer's `ProgramTeacher` rows, both keyed to today's program list.
- **Live Now** (everyone) — green pill, "Join now" button. Window: `start - 12min` through session end. Once this opens, the host's row collapses to look identical to everyone else's.
- **Later Today** — no Join button, countdown text. For host/teacher rows more than 12 minutes out, the countdown reads "Setup opens in N min" (when within the next hour); for everyone else, "Join opens in N min" / "Starts at X:XX".

Join link withheld until each state's window to prevent accidental joins. **In-person today:** strictly-in-person registrations (`programFormat === "in-person"`) whose next occurrence falls on today are merged into the same Today card with a quiet "In-person" tag (no Join button — physical attendance). Hybrid programs are already covered via `allVirtual`. **Auto-refresh:** `DashboardAutoRefresh` accepts both `liveStartEpochs` and `earlyOpenEpochs` and fires `router.refresh()` via `setTimeout` at the soonest upcoming epoch from the union, so a host's row appears at `start - 22min` *and* collapses at `start - 12min` without manual reload. No polling.

**Coming up for you logic:** Each `Registration` is projected to its program's next upcoming occurrence via `nextOccurrenceOnOrAfter()` (new in session 116, `lib/scheduleUtils.ts`) — walks forward up to 365 days from today's CT date, short-circuits for non-recurring programs with past anchors. Rows where `nextDateStr === null` (no future occurrence — completed series, past one-time programs) are filtered out. Rows where `nextDateStr === today` are filtered out (they're in Today above). Remaining rows sorted ascending by next date, sliced to 5. Each row's inline time is the start time projected to the next-occurrence date via `shiftToDate()`.

**Key files:** `app/account/dashboard/page.tsx`, `components/DashboardAutoRefresh.tsx`, `lib/scheduleUtils.ts`
**CSS prefix:** `db2-` (and shared `today-*` for the Today card rows)

### 6b. Account Sidebar (`AccountSidebar` / `AccountLayout`)

A persistent sidebar that appears on all account pages, showing navigation links appropriate to the user's roles.

**Sidebar links by role (current as of session 110, 2026-05-13):**
| Link | Destination | Who sees it |
|---|---|---|
| Home | `/account/dashboard` | All members |
| My Registrations | `/account/programs` | All members |
| My Courses | `/account/courses` | All members |
| My Profile | `/account/dashboard-my-profile` | All members |
| *(Your Hubs divider + links)* | `/account/hub/[slug]` | Members with `HubMember` records; ADMIN sees all hubs; REGISTRAR auto-synced to Registrar Hub |
| *(Staff divider)* | — | REGISTRAR / ADMIN |
| Members | `/admin/members` | REGISTRAR / ADMIN |
| Households | `/admin/households` | REGISTRAR / ADMIN |
| Hubs | `/admin/hubs` | ADMIN |
| Emails | `/admin/emails` | ADMIN |
| Manual | `/admin/manual` | ADMIN |

The label "Dashboard" was renamed to "Home" in session 110 — members find "Dashboard" abstract for a community-login surface. The URL `/account/dashboard` is unchanged. Three dead entries (Roadmap, Banner, Editor Lab) were also removed in session 110 — none of those pages exist in active code.

**Architecture:**
- `AccountLayout` — server component; calls `auth()`, extracts `roles`; ADMIN users get all hubs via `db.hub.findMany()`; non-admins get only their `HubMember` records. Renders `ac-layout` wrapper with `AccountSidebar + ac-content`.
- `AccountSidebar` — `"use client"` component; receives `roles: string[]` and `hubLinks: { slug, name }[]` as props; uses `usePathname` for active-link highlighting; renders "Your Hubs" section dynamically from `hubLinks` (never hardcoded).
- Applied explicitly in each account page's `return` — NOT a Next.js `layout.tsx` file. This keeps `/account/welcome` and `/account/reactivate` as standalone flows without the sidebar.

**Mobile:** Below 700px, the sidebar becomes a horizontal scroll strip (tabs pattern), matching GitHub profile tabs and Stripe dashboard. No hamburger drawer — avoids conflict with the main site nav.

**Old URLs now redirect:**
- `/hosts` → `/account/host`
- `/volunteer` → `/account/hub/registrar/programs`
- `/volunteer/programs/[slug]` → `/account/hub/registrar/programs/[slug]`
- `/account/registrar` → `/account/hub/registrar/programs`
- `/account/registrar/[slug]` → `/account/hub/registrar/programs/[slug]`
- `/account/dashboard-my-registrations` → `/account/programs`

**Key files:**
- `components/AccountSidebar.tsx` — client component, role-based nav links, active state via pathname
- `components/AccountLayout.tsx` — server component, auth + roles → sidebar wrapper
- `public/css/custom.css` — `ac-` block (desktop sticky sidebar + mobile scroll strip)

**🔧 Technical notes:**
- `auth()` is called once in `AccountLayout`, not in each page — pages receive roles as a prop via the layout
- Active state: exact match for `/account/dashboard`; `startsWith` for all other links to handle sub-routes
- All account pages are 🟢 design system — no Webflow class names.

### 6c. My Programs (`/account/programs`)

Members can see all their program registrations in one place. This was a missing feature — previously members had no way to view their registration history.

**User flow:**
1. Member navigates to My Programs from dashboard card or nav dropdown
2. Active registrations (REGISTERED, APPROVED, WAITLISTED) shown first
3. Past/cancelled registrations shown below (section hidden if none)
4. Empty state shown with link to community programs if no registrations at all

**Each registration card shows:**
- Program title (links to program page)
- Date/time and location from Sanity (looked up by slug)
- Status badge: Registered (green) / Approved (blue) / Waitlisted (amber) / Cancelled (gray)
- Waitlist position if applicable
- Pending dana prompt with link to complete the offering

**Key files:**
- `app/account/programs/page.tsx` — server component, direct DB + Sanity
- `app/api/account/registrations/route.ts` — GET endpoint (also available for client use)
- `lib/queries.ts` — `programsBySlugArrayQuery` (batch lookup by slug array)

**🔧 Technical notes:**
- `dateText`/`timeText`/`locationText` are NOT stored in the Registration DB record — only in Sanity. The page/API does a batch GROQ query by slug array to enrich DB records with Sanity data.
- GROQ: `*[_type == "programs" && slug.current in $slugs && !(_id in path("drafts.**"))]`
- CSS prefix: `mr-`

### 6d. My Library (`/account/dashboard-my-library`)

Curated list of dharma learning resources. Currently hardcoded (4 items). Clean `ml-` design system; no Webflow classes.

### 6e. My Profile (`/account/dashboard-my-profile`)

Form to update firstName, lastName, phone. Uses server action — data writes directly to Postgres. Email is display-only (it's where the sign-in code goes; contact support to change). Success state via `?saved=true` URL param, styled with `mp-success` class.

### 6f. Community Care Agreements (`/account/dashboard-member-care-agreements`)

Static page with the four RIM community agreements. Clean `mc-` design system; content is hardcoded in the component.

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
| `customFields` | Json? | `{"Question": "Answer"}` |
| `status` | RegistrationStatus | REGISTERED / WAITLISTED / APPROVED / CANCELLED |
| `waitlistPosition` | Int? | Set only when WAITLISTED |
| `notes` | String? | Internal staff notes, never shown to member |
| `donationStatus` | DonationStatus | NOT_REQUIRED / PENDING / COMPLETED / WAIVED |
| `donationAmount` | Int? | Cents — set by Stripe webhook on completion |
| `stripeSessionId` | String? | Stripe Checkout session ID — set by webhook, used for reconciliation |
| `editToken` | String? @unique | One-time UUID token for self-service response editing |
| `editTokenExpiresAt` | DateTime? | Token expiry — set to 7 days from generation; null after use |
| `reminderSentAt` | DateTime? | Stamped when the program reminder email is sent (auto cron or manual); prevents double-sends regardless of which path fires |

#### Donation (schema live — Phase 2 UI planned in Section 11)
Unified record of every contribution to RIM regardless of source. Schema is in Prisma and pushed to DB. Stripe registration dana writes here automatically via webhook from day one. Phase 2 UI (manual entry, reporting) requires no migration.

| Field | Type | Notes |
|---|---|---|
| `id` | cuid | Primary key |
| `source` | DonationSource | STRIPE / GIVEBUTTER / CASH / CHECK / OTHER |
| `amountCents` | Int | Total amount in cents |
| `currency` | String | Default "usd" |
| `donatedAt` | DateTime | Actual date of donation (may differ from createdAt for manual entries) |
| `userId` | String? | Links to User if donor is a known member |
| `donorName` | String? | Denormalized — needed for guests and manual entries |
| `donorEmail` | String? | |
| `programId` | String? | Sanity `_id` if donation was for a specific program |
| `programTitle` | String? | Denormalized snapshot |
| `registrationId` | String? | Links to Registration if from the registration dana flow |
| `stripePaymentIntentId` | String? | Unique — prevents duplicate webhook processing |
| `stripeCheckoutSessionId` | String? | Stripe session ID |
| `givebutterId` | String? | GiveButter transaction ID for import deduplication |
| `notes` | String? | Staff notes (e.g. "cash in envelope 3/2") |
| `quickbooksRef` | String? | QB transaction ID (future reconciliation) |
| `createdAt` | DateTime | When the record was created in our system |

#### Course, Lesson, CourseLesson, ProgramCourse (Phase 1 — Sanity → Postgres migration)
Courses and lessons have been migrated from Sanity to Postgres. These models power the Teacher Hub and the member-facing `/course/[slug]` and `/lessons/[slug]` pages.

- `Course` — `id`, `title`, `slug` (unique), `subheading?`, `description?` (Markdown), `accessLevel` (CourseAccessLevel enum), `hideFromMemberProfile`, `sortOrder?`, `isActive`, `createdAt`, `updatedAt`. Relations: `lessons CourseLesson[]`, `programs ProgramCourse[]`, `access CourseAccess[]`.
- `Lesson` — `id`, `titleInternal`, `titleDisplayed`, `slug` (unique), `isSectionTitle`, `body?` (Markdown), `heroImageUrl?`, `heroImageAlt?`, `audioUrl?`, `videoUrl?`, `headerQuote?`, `quoteSource?`, `teacherNames String[]`, `resources Json?`, `createdAt`, `updatedAt`.
- `CourseLesson` — join table: `courseId`, `lessonId`, `sortOrder`. `@@id([courseId, lessonId])`. `onDelete: Cascade` on both FKs.
- `ProgramCourse` — join table: `programId` (Sanity `_id` during Phase 2; becomes Postgres cuid in Phase 3), `courseId`. `@@id([programId, courseId])`. `onDelete: Cascade` on courseId FK.
- `CourseAccess` — existing model, now has optional FK: `course Course? @relation(fields: [courseSlug], references: [slug], onDelete: Cascade)`.

#### Enums
```
Role:               HOST | HOST_MANAGER | REGISTRAR | ADMIN | TEACHER
CourseAccessLevel:  MEMBERS | REGISTRATION_REQUIRED
RegistrationStatus: REGISTERED | WAITLISTED | APPROVED | CANCELLED
DonationStatus:     NOT_REQUIRED | PENDING | COMPLETED | WAIVED
DonationSource:     STRIPE | GIVEBUTTER | CASH | CHECK | OTHER
```

**🔧 Technical notes:**
- `db push` (not `migrate`) is used for schema changes — no migration history files
- To apply schema changes: `set -a && source .env.local && set +a && npx prisma db push`
- Roles migration from single `role` to array `roles` required raw SQL — Prisma couldn't handle the enum + column type change atomically. See session log 2026-03-01 in MEMORY.md for the exact SQL used
- Active roles: HOST, HOST_MANAGER, REGISTRAR, ADMIN, TEACHER. TREASURER and VOLUNTEER were removed previously. Add new roles only when real functionality is attached.

---

## 8. API Routes

**Registration & Programs**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/registrations` | None required | Create a registration; finds/creates user by email if not logged in; fetches Sanity `confirmationMessage` and includes it in the confirmation email |
| `PATCH` | `/api/registrations/[id]` | REGISTRAR or ADMIN | Update `status`, `notes`, `donationStatus`, or `customFields`; `action: "sendEditRequest"` sends self-service edit link; `action: "sendReminder"` sends program reminder; `action: "sendDanaReminder"` sends gentle dana nudge (PENDING only); on WAITLISTED→APPROVED auto-sets `donationStatus`; fires appropriate email |
| `GET` | `/api/programs/[slug]/registrations` | REGISTRAR or ADMIN | List registrations for a program; add `?format=csv` for CSV download |
| `POST` | `/api/programs/[slug]/send-reminder` | REGISTRAR or ADMIN | Bulk send reminder to all REGISTERED/APPROVED registrants with `reminderSentAt` null; returns `{ sent: N }` |
| `POST` | `/api/update/[token]` | Token (no session) | Self-service response edit: validates `editToken` + expiry, updates `customFields`, clears token, notifies registrar |

**Member Onboarding**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/api/account/check-email?email=X` | None required | Public lookup: returns `{ exists, firstName, lastName, phone, agreedToTerms }` for a given email. Used by the registration form to pre-fill returning members' info on email blur. |
| `POST` | `/api/account/complete-profile` | Session required | Save firstName, lastName, phone, set `agreedToTerms = true` on first login |
| `DELETE` | `/api/account/complete-profile` | Session required | Explicit "I'd rather not join" — deletes User record (cascades to sessions, registrations, course access), signs out |
| `PATCH` | `/api/account/reactivate` | Session required | Self-service reactivation: clears `archivedAt` on the authenticated user's own record |

**Admin — Members**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/api/admin/members` | ADMIN | List all members with roles and registration counts |
| `PATCH` | `/api/admin/members/[id]` | ADMIN | Update profile fields, roles, or member state: `action: "archive"` sets `archivedAt` + kills all sessions; `action: "restore"` clears `archivedAt`; default (no action) updates profile + roles |
| `DELETE` | `/api/admin/members/[id]` | ADMIN | Hard-delete a member with zero registrations; returns `409` if registrations exist (use archive instead) |
| `POST` | `/api/admin/members/import` | ADMIN | CSV upsert: finds or creates Users by email; fills blank fields only; returns `{ created, updated, skipped }` |
| `POST` | `/api/admin/members/[id]/course-access` | ADMIN or REGISTRAR | Grant manual course access (`CourseAccess` upsert) |
| `DELETE` | `/api/admin/members/[id]/course-access?courseSlug=` | ADMIN or REGISTRAR | Revoke manual course access |
| `GET` | `/api/admin/courses` | ADMIN or REGISTRAR | All Postgres courses enriched with `linkedByPrograms` (Sanity program names via hybrid lookup) — powers CourseAccessSection |

**Courses & Lessons (Teacher Hub)**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/api/courses` | TEACHER or ADMIN | List all courses with lesson count, ordered by sortOrder then title |
| `POST` | `/api/courses` | TEACHER or ADMIN | Create a course; validates slug uniqueness |
| `GET` | `/api/courses/[slug]` | TEACHER or ADMIN | Fetch course with ordered lessons and program links |
| `PATCH` | `/api/courses/[slug]` | TEACHER or ADMIN | Update fields + handle `lessonOrder: string[]` (deletes all CourseLesson records, recreates with new order) |
| `DELETE` | `/api/courses/[slug]` | TEACHER or ADMIN | Delete course; returns 409 if ProgramCourse records exist |
| `GET` | `/api/lessons` | TEACHER or ADMIN | List all lessons with course membership |
| `POST` | `/api/lessons` | TEACHER or ADMIN | Create a lesson; validates slug uniqueness |
| `GET` | `/api/lessons/[slug]` | TEACHER or ADMIN | Fetch lesson with full fields |
| `PATCH` | `/api/lessons/[slug]` | TEACHER or ADMIN | Update lesson fields |
| `DELETE` | `/api/lessons/[slug]` | TEACHER or ADMIN | Delete lesson; returns 409 if lesson belongs to any courses |
| `GET` | `/api/lessons/search?q=` | TEACHER or ADMIN | Search lessons by titleInternal (case-insensitive, min 2 chars, limit 20) |
| `POST` | `/api/upload` | TEACHER or ADMIN | Universal file upload via Vercel Blob; returns `{ url }` |

**Payments**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/stripe/checkout` | None required | Create a Stripe Checkout session for registration dana; returns session URL |
| `POST` | `/api/stripe/webhook` | Stripe signature | Receive `checkout.session.completed`; update registration `donationStatus` + `donationAmount`; write `Donation` ledger record |

**Crons**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `GET` | `/api/cron/send-reminders` | CRON_SECRET Bearer | Daily at 14:00 UTC. Sends reminder email to all unsent active registrants for programs whose `reminderDate` falls in the past 24h; returns `{ ok: true, sent: N }` |
| `GET` | `/api/cron/cleanup-incomplete-accounts` | CRON_SECRET Bearer | Daily at 15:00 UTC. Deletes User records where `agreedToTerms = false` and `createdAt < 48h ago` — removes abandoned incomplete accounts |

**Newsletter**

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/subscribe` | None required | Add subscriber to Flodesk and assign to the RIM segment (`6340e5b00170f97cbdfc4b87`). Used by the newsletter form in the site footer. |

**🔧 Technical notes:**
- All PATCH/GET admin routes call `auth()` and check `session.user.roles` — they return `401` if unauthenticated or `403` if unauthorized
- The CSV export builds dynamic column headers by collecting all unique custom field keys across all registrations in the program — so if different registrations have different custom fields, all columns appear
- `PATCH` validates status values against the allowed enum list before writing to DB
- Stripe webhook route must receive the raw (unparsed) request body for signature verification. In Next.js App Router: use `await request.text()` and pass to `stripe.webhooks.constructEvent()`. Do NOT use `request.json()` first.
- Stripe webhook should be idempotent — check if `stripeSessionId` already exists on the registration before updating, to handle duplicate webhook deliveries

---

## 9. Sanity CMS Schema Additions

> **Note (session 54):** Programs have been fully migrated to Postgres. The Sanity `programs` schema remains for reference but is no longer the source of truth. All program fields documented below now live in the `Program` Prisma model and are edited via the Program Editor in the Registrar Hub. Sanity is still used for teams, glossary, magazine articles, volunteer positions, and the shared `richContent` type.

The Sanity schema lives at `/Users/jessefoy/Sites/rim-website/sanity/` and is shared by both the Eleventy and Next.js projects.

### Sanity Studio tab layout

The `programs` schema is organized into six tabs (in order):

| Tab | What's in it |
|---|---|
| **Content** | Tagline, program image, description, pull quote + source, special notes, teacher/facilitators, linked courses |
| **Schedule & Location** | Category, date & time (display text), **programFormat** (In-person / Virtual / Hybrid), **venue** (At RIM / Other location), location + map link, meeting link, calendar datetime fields (`startDatetime` / `endDatetime`), recurrence fields (`recurrenceFreq` / `recurrenceInterval` / `recurrenceDays` / `recurrenceCount`) |
| **Registration** | Enabled toggle → Registration Closed flag → Capacity + Deadline → Custom questions → Confirmation email message → Reminder date + reminder message |
| **Dana** | Dana mode → amounts → dana step message → program-page dana note |
| **Dashboard** | Special announcement, early arrival message, hide from member dashboard, day of week (drives "Today" badge + public listing day grouping) |
| **Visibility** | Sort order, hide from public list |

> **Schema cleanup (session 28, 2026-03-05):** Three fields removed: `timeText` (merged into `dateText`, now titled "Date & Time"), `zoomLinkText` (button label hardcoded), `dayFiltering` (legacy comma-string). Two fields moved: `teacherFacilitators` Schedule → Content, `dayOfWeek` Sorting → Dashboard. Two tab renames: "Dana & Payment" → "Dana", "Sorting & Visibility" → "Visibility". One field title rename: "Remove from Dashboard Program List" → "Hide from Member Dashboard".
>
> **programFormat (session 33, 2026-03-09):** Added `programFormat` radio field (In-person / Virtual / Hybrid) replacing the old `isVirtual` boolean. Drives Sanity Studio field visibility (location fields hide for virtual, Meet fields hide for in-person), the registrar area Google Meet section, the host area query filter, and the Sanity webhook handler. Default: `"in-person"`.
>
> **venue (session 33, 2026-03-09):** Added `venue` radio field (At RIM / Other location) in the Schedule group. Defaults to `"at-rim"` — no manual address entry needed for standard RIM sessions. When set to "at-rim", `lib/locations.ts` injects the canonical RIM name, address, and Google Maps URL automatically in the program detail page, all confirmation/reminder emails, and calendar links. `locationText` and `locationLink` fields only show in Studio when venue is set to "other". Legacy records (no venue field) pass through raw `locationText`/`locationLink` unchanged.

### Fields added to `programs` schema (registration group)

| Field | Type | Purpose |
|---|---|---|
| `registrationEnabled` | boolean | Toggle to enable the new registration system for a program |
| `registrationCapacity` | number | Max registrations before waitlist kicks in (leave blank = unlimited) |
| `registrationDeadline` | datetime | After this date, form shows "Registration closed" |
| `registrationFields` | array of objects | Custom per-program questions (see below) |
| `confirmationMessage` | restricted block array | Rich text included in the confirmation email (bold, italic, links, bullets only — email-safe). Blank = no extra message. |
| `reminderDate` | datetime | When the cron should auto-send the reminder email to all active registrants. Program coordinator sets this in the Registration tab. If blank, no auto-send occurs. |
| `reminderMessage` | restricted block array | Optional custom message in the reminder email body (bold, italic, links, bullets only — email-safe). If blank, a standard reminder with date/time/location details is sent. |

### Fields added to `programs` schema (dana group)

| Field | Type | Purpose |
|---|---|---|
| `danaMode` | string (select) | `none` / `voluntary` / `base_plus_dana` / `fixed` — controls the dana step behavior |
| `suggestedDana` | number | The suggested voluntary contribution in dollars (shown as the default amount in the dana step) |
| `danaBaseAmount` | number | Required base cost in dollars — for `base_plus_dana` (e.g. retreat venue/meals) and `fixed` modes only |
| `danaFixedAmount` | number | Set price in dollars — for `fixed` mode only |
| `danaMessage` | text | Short program-specific message (1–3 sentences) shown on the dana step. Leave blank for no message. |
| `danaText` | text | Short dana/donation note shown on the program detail page (the public-facing program listing, not the dana step itself). |

> **Note:** The old `suggestedDonation` field was replaced by the five dana fields + `danaText` above. It has been removed from the Sanity schema (deployed 2026-03-02).

### Fields added to `programs` schema (content group)

| Field | Type | Purpose |
|---|---|---|
| `linkedCourses` | array of references | One or more courses linked to this program. Members with an active registration for this program automatically get access to all linked courses (checked dynamically at page render — no DB write). |

**danaMode reference:**
- `none` — No dana step shown at all. Registration is free.
- `voluntary` — Show `suggestedDana` as the default amount, fully editable. No minimum enforced. "Offer dana" and "I'll contribute another time" are both options.
- `base_plus_dana` — Show `danaBaseAmount` as a fixed required line item (venue/meals/etc.), plus an editable `suggestedDana` amount for voluntary dana on top. Total = base + dana.
- `fixed` — Show `danaFixedAmount` as a set price. No dana framing. Just a straightforward payment. ⚠️ `danaFixedAmount` must be set in Sanity or the dana step is skipped (see "Unconfigured amounts" note in Section 4c).

### Registration field object schema
Each item in `registrationFields`:
- `label` — the question text (also used as the JSON key in `customFields` storage)
- `fieldType` — `shortText | longText | yesNo | select`
- `required` — boolean
- `options` — array of strings (only for `select` type)

**🔧 Technical notes:**
- Sanity deploy command: `cd /Users/jessefoy/Sites/rim-website/sanity && npx sanity deploy`
- `registrationEnabled` must be `true` for the built-in registration form to appear. If false, the program's registration section is simply not shown.
- `registrationClosed` boolean — manually closes registration even if capacity remains and the deadline hasn't passed. Checked alongside `registrationDeadline` in `app/programs/[slug]/page.tsx`: `registrationClosed = program.registrationClosed || (deadline && new Date(deadline) < new Date())`.
- The `label` string doubles as the storage key — if a label is renamed in Sanity after registrations exist, old data will appear under the old key name in the CSV. Treat labels as permanent once in use.
- `danaMode` defaults to `none` if not set — no dana step shown unless explicitly configured.
- GROQ query for program pages must include all five dana fields: `danaMode, suggestedDana, danaBaseAmount, danaFixedAmount, danaMessage`.
- `programCategory` reference field: `disableNew: true` (prevents creating categories from within a program), `filter: "hideFromProgramsPage != true"` (hides internal-use categories from the dropdown). A program without a `programCategory` will not appear on the public programs listing page.

---

## 10. CSS Architecture

### Design system status

| Layer | Status | Notes |
|---|---|---|
| 🟢 Design System | All new pages | Prefixed classes + CSS custom properties, zero Webflow dependency |
| 🟠 Legacy Shim | ~15 unredesigned pages | Bottom of `custom.css` recreates 25 essential Webflow classes using tokens |

**Webflow CSS files removed (session 84).** `webflow.css` and `rim.webflow.css` are no longer loaded. `normalize.css` was removed in session 83. Quincy CF fonts are now self-hosted via `@font-face` declarations at the top of `custom.css`.

### Custom CSS file
All styles: `public/css/custom.css` — single source of truth.

### Page block system
Shared layout primitives used by all redesigned pages:
- `rim-section` — full-width row with 96px vertical padding. Variants: `--white`, `--grey`, `--teal`.
- `rim-container` — max-width 1260px, centered, 40px side padding. All page sections use this for consistent horizontal alignment.
- `rim-two-col`, `rim-grid-3`, `rim-grid-4` — responsive grid layouts.

### Page prefixes (🟢 design system pages)
| Prefix | Page |
|---|---|
| `hp-` | Homepage |
| `pl-` | Community programs list page |
| `pg-` | Program detail pages |
| `lr-` | ListRow component (shared: programs list, this-week page, dashboard, course lessons) |
| `tw-` | This Week weekly schedule page (hero elements only; cards reuse `lr-` + `pl-`) |
| `lp-` | Lesson pages (also shared reading-column utilities used by other 🟢 pages) |
| `wl-` | Community welcome / onboarding page |
| `vol-` | Volunteer / registrar admin area |
| `adm-` | Admin member management pages |
| `adm-sm-` | Admin site architecture page |
| `ca-` | CourseAccessSection component |
| `db-` | Member dashboard hub |
| `mr-` | My Registrations page |
| `ml-` | My Library page |
| `mp-` | My Profile page |
| `mc-` | Community Agreements page |
| `nav-` | Global nav component |
| `man-` | Staff Reference Manual (`/admin/manual`) |

### Design tokens (CSS custom properties)
```css
--rim-bg: #f5f5f5          /* cool light grey — original RIM site */
--rim-bg-accent: #eee      /* slightly darker grey — callouts, cards */
--rim-blue: #135274        /* primary blue */
--rim-mid: #39607a         /* mid teal-blue — links, accents */
--rim-text: #333333        /* body text */
--rim-text-muted: #666     /* labels, captions */
--rim-rule: #d5d5d5        /* borders, dividers */
--font-serif: quincy-cf    /* heading font (Adobe Typekit) */
--font-sans: Open Sans     /* body/UI font */
```

**Body text:** 18px Open Sans, line-height 1.7. Content width: `--reading-width: 700px`.

**🔧 Technical notes:**
- All Webflow CSS files have been removed. A legacy shim at the bottom of `custom.css` preserves ~25 essential Webflow classes for unredesigned pages. Delete the shim when all pages are migrated.
- Quincy CF fonts self-hosted: `@font-face` declarations at top of `custom.css` point to `public/fonts/QuincyCF-*.woff2`. Token: `--font-serif: 'Quincycf', Georgia, serif`.
- Global `p` margin rules (`.rim-section--grey p { margin: 0 0 18px }`) can override component styles. Use doubled-class selectors (`.lr-row .lr-name`) when components live inside `rim-section` wrappers.
- CSS specificity ladder: element (0,0,1) < class (0,1,0) < `.parent .class` (0,2,0) < `.parent tag.class` (0,2,1)
- Quote card uses box-shadow (Webflow match); otherwise no box-shadows in the design system

---

## 11. Member Management System (`/admin/members`)

**What it does:** An admin area (ADMIN or REGISTRAR) for viewing all members, editing their profiles, assigning/revoking staff roles, managing course access, and importing members from CSV. Includes enhanced profile fields, status-driven access control, tags, admin notes, and household grouping.

### Routes
- `/admin/members` — searchable member list with role filter, status filter, sortable columns, archived toggle, and import tool
- `/admin/members/[id]` — member detail: full profile editing, member status, tags, household, admin notes, roles, course access, registration history, delete (admin only)
- `/admin/households` — household directory with custom-label frequency table
- `/admin/households/[id]` — household detail: edit name/address/notes, manage members, set primary contact
- `/account/reactivate` — self-service reactivation page for Inactive members (sign-in code → reactivate → dashboard)

### Access control
- `/admin/*` routes protected at proxy level (`proxy.ts`)
- Member list, detail, and household pages allow both ADMIN and REGISTRAR
- Destructive actions (delete member, delete household, import, role assignment) require ADMIN
- `/account/reactivate` accessible to any authenticated user (proxy redirects Inactive sessions there)

### Member list (`/admin/members`)
- Search bar filters name, email, and tags client-side — fast, no round-trip
- Role filter: All / Admins / Registrars / Hosts / No roles
- Status filter: All / Active / Visitor / Student / Volunteer / Inactive
- Sortable columns: First name, Last name, Email, Joined date, Registrations count — click header to toggle asc/desc
- **Archived toggle:** "Show Archived (N)" button when `archivedCount > 0` — switches view to Inactive/archived members; muted rows with "Archived" badge
- Table: Name (with preferred name in parentheses), Last name, Email, Status badge + role badges, Regs count, Joined date
- Click any row → navigates to member detail
- API: `GET /api/admin/members` — ADMIN or REGISTRAR; supports `?q=` search and `?limit=` params

### Member detail (`/admin/members/[id]`)
- **Profile:** firstName, lastName, preferredName, email (with inline change-warning + confirmation dialog)
- **Contact:** phone, addressLine1, addressCity, addressState, addressZip; shows "household address will be used" hint when member has no address but belongs to a household
- **Status:** memberStatus dropdown (ACTIVE/VISITOR/STUDENT/VOLUNTEER/INACTIVE) + firstVisitDate; INACTIVE warning: "Saving will sign them out immediately"; status change drives archivedAt
- **Tags:** pill input (Enter or comma to add, × or Backspace to remove); tags are searchable from member list
- **Household:** embedded HouseholdSection — see §22
- **Admin Notes:** private textarea — visible to ADMIN only; member never sees it
- Roles section: checkbox per role (HOST, REGISTRAR, ADMIN) with descriptions — ADMIN only
- **Course Access section:** see §12
- Registration history: all programs registered for with status badges
- **Danger Zone:** Delete only (no archive/restore — status handles access). Delete requires `registrations.length === 0`
- "Save changes" button PATCHes all fields in one call

### Member status and access control
Status drives login access. INACTIVE is the only status that blocks login:
| Status | Login | Meaning |
|---|---|---|
| ACTIVE | ✓ | Full community member |
| VISITOR | ✓ | Exploring, not yet full member |
| STUDENT | ✓ | In a learning track |
| VOLUNTEER | ✓ | Contributing in volunteer capacity |
| INACTIVE | ✗ | Access suspended; records preserved |

Setting status to INACTIVE: sets `archivedAt = new Date()` + `db.session.deleteMany` (immediate logout). Setting any other status: sets `archivedAt = null`. Legacy members with `archivedAt` set but `memberStatus = ACTIVE` auto-correct on profile load via `effectiveStatus` pattern — first save syncs the DB.

### Delete
Available only when `registrations.length === 0`. Hard-deletes User record; cascade removes sessions, accounts, course access. If member has registrations, use Inactive instead. API returns 409 if DELETE attempted on member with registrations.

### Self-service reactivation
Two re-entry paths for Inactive members:
1. **Register for a program** — `POST /api/registrations` includes `archivedAt: null` in user upsert; automatic, no friction
2. **Sign in → `/account/reactivate`** — proxy detects `archivedAt`, redirects to reactivation page; PATCH `/api/account/reactivate` clears `archivedAt` → dashboard

### Dashboard integration
AccountSidebar shows "Members" and "Households" links for REGISTRAR+. ADMIN also sees these plus Manual and Roadmap.

### Key files
- `app/admin/members/page.tsx` — member list server component
- `app/admin/members/[id]/page.tsx` — member detail server component; constructs `serialized` explicitly (never spreads Prisma `include` — see Technical notes)
- `components/MembersTable.tsx` — list client component (search, filters, sort, archived toggle)
- `components/MemberDetail.tsx` — detail client component (all profile sections; imports HouseholdSection + CourseAccessSection)
- `components/CourseAccessSection.tsx` — course access UI
- `components/HouseholdSection.tsx` — household embedded panel in member detail
- `app/account/reactivate/page.tsx` — self-service reactivation (`wl-` prefix)
- `app/api/account/reactivate/route.ts` — PATCH: clears archivedAt
- `app/api/admin/members/route.ts` — GET (list with search + limit params; ADMIN or REGISTRAR)
- `app/api/admin/members/[id]/route.ts` — PATCH (profile/status/roles) + DELETE (zero-registration guard)
- `app/api/admin/members/[id]/household/route.ts` — GET: returns member's household ID+name (used by HouseholdSection join flow)
- `app/api/admin/members/[id]/course-access/route.ts` — POST/DELETE — ADMIN or REGISTRAR

**🔧 Technical notes:**
- `effectiveStatus` pattern: `member.archivedAt && member.memberStatus !== "INACTIVE" ? "INACTIVE" : member.memberStatus` — handles legacy archived members in component state; first save syncs DB
- `archivedAt` is now purely derived from `memberStatus` — setting INACTIVE stamps it, any other status clears it. Don't set it directly except via the INACTIVE status path
- Role validation in PATCH uses `Object.values(Role)` from `@prisma/client`
- ⚠️ **RSC serialization gotcha:** Never spread a Prisma `include` result into Client Component props. All Date fields must be converted to `.toISOString()`; household data must be constructed explicitly with all nested `user` fields explicitly named
- `tags` is a `String[]` on the User model — stored as Postgres array; Prisma reads/writes it natively. No JSON encoding needed
- `adminNotes` is only sent in the PATCH body when `isAdmin` — client guards the field; server validates admin-only via session check in PATCH route
- "Save changes" button PATCHes all changes in one call

### Archive, restore & delete

Three membership states:

| State | Who it applies to | What it means |
|---|---|---|
| **Active** | Everyone (default) | Can log in, visible in member list |
| **Archived** | Members with ≥ 1 registration | Cannot access member area; hidden from default list; all records preserved |
| **Deleted** | Members with 0 registrations only | Hard delete — user + all related records gone permanently |

**Archive:** Sets `archivedAt` on the User record and calls `session.deleteMany` to immediately invalidate all active sessions (member is logged out on next request). A confirmation dialog is shown: "Archive this member? They will be logged out immediately and unable to log in. Their registration history will be preserved."

**Restore (admin):** Clears `archivedAt`. Member can log in again. Confirmation: "Restore this member? They will be able to log in again."

**Delete:** Available only when `registrations.length === 0`. Hard-deletes the User record; cascade removes sessions, accounts, course access, donations. Confirmation: "Permanently delete this member? This cannot be undone." If a DELETE request is made on a member who has registrations, the API returns `409` — use Archive instead.

**Button logic in the UI:**
- `archivedAt` set → show **Restore Member** button only
- `archivedAt` null + registrations ≥ 1 → show **Archive Member** button only
- `archivedAt` null + registrations = 0 → show **Archive Member** + **Delete Member** buttons
- Archive and delete actions → redirect to `/admin/members` after success
- Restore → reload the detail page (clears archived banner)

**Archived banner:** When viewing an archived member, a tinted banner displays "Archived [date] — this member cannot log in." at the top of the detail page.

### Self-service reactivation

Archiving is a "sleeping" state, not a permanent lock. Two re-entry paths exist so members can return without contacting staff:

**1. Register for a program (primary path)**
In `POST /api/registrations`, when a user record is created or upserted, `archivedAt: null` is included in the upsert data. A returning registrant is automatically restored as part of the normal registration flow — no extra step, no friction.

**2. Sign in → `/account/reactivate` (direct login path)**
When an archived member signs in (requests a sign-in code, enters it on `/login/check-email`), `proxy.ts` detects `session.user.archivedAt` is set and redirects them to `/account/reactivate` instead of the usual member area. The page shows a warm welcome-back message ("Your account was archived. Click below to reactivate.") with a single "Reactivate" button that calls `PATCH /api/account/reactivate` → clears `archivedAt` → redirects to `/account/dashboard`. Uses `wl-` CSS prefix (same visual language as `/account/welcome`).

**Proxy loop guard:** `proxy.ts` checks `!pathname.startsWith("/account/reactivate")` before redirecting archived users — prevents an infinite redirect loop.

### Dashboard integration
- `STAFF_LINKS` in `dashboard/page.tsx` maps each role to an array of cards
- Both REGISTRAR and ADMIN produce cards for their hub links + Staff Manual
- Deduplication by `href` — no duplicate cards if a user holds both ADMIN + REGISTRAR

### Key files (complete list)
- `app/admin/members/page.tsx` — member list server component; `showArchived` query param controls DB filter
- `app/admin/members/[id]/page.tsx` — member detail server component; constructs `serialized` object explicitly (never spreads Prisma `include` result — see Technical notes)
- `components/MembersTable.tsx` — list client component (search, filter, archived toggle, muted archived rows)
- `components/MemberDetail.tsx` — detail client component (profile form, role checkboxes, registration history, archived banner, danger zone, renders `<CourseAccessSection>`)
- `components/CourseAccessSection.tsx` — course access client component (fetches all courses, computes statuses, grant/revoke UI with per-course state machine)
- `app/account/reactivate/page.tsx` — self-service reactivation page (`wl-` CSS prefix)
- `app/api/account/reactivate/route.ts` — PATCH: clears `archivedAt` for the authenticated user
- `app/api/admin/members/route.ts` — GET (list)
- `app/api/admin/members/[id]/route.ts` — PATCH (update profile/roles/archive/restore) + DELETE (hard delete, zero-registration guard)
- `app/api/admin/members/[id]/course-access/route.ts` — POST (grant access) / DELETE (revoke access) — ADMIN or REGISTRAR
- `app/api/admin/courses/route.ts` — GET (all courses enriched with linked programs) — used by `CourseAccessSection`

**🔧 Technical notes:**
- Role validation in PATCH uses `Object.values(Role)` from `@prisma/client` — adding a new role to the Prisma enum automatically makes it valid here
- `STAFF_LINKS` format: `Record<string, { label, href, description }[]>` — each role maps to an array of links (allows ADMIN to show multiple cards without duplicates)
- ⚠️ **RSC serialization gotcha:** Never use `...user` (or any Prisma `include` result) as props for a Client Component. Prisma `include` returns ALL scalar fields on the model including Date fields (`updatedAt`, `emailVerified`, `agreedAt`, `legacyLastLogin`, etc.). Raw `Date` objects are not serializable across the Server→Client boundary in Next.js 16 + React 19 — the navigation silently fails with no visible error (no error boundary = page stays frozen). Always construct props explicitly, naming only the fields the Client Component needs, and convert all dates to ISO strings (`.toISOString()`).

---

## 11b. Admin Email Change + Self-Service Email Change (Planned)

### What's built: Admin email change

An admin can update any member's login email address from the member detail page (`/admin/members/[id]`).

**Who uses it:** Staff (ADMIN role) — for correcting typos, updating email addresses on a member's behalf.

**User flow:**
1. Admin opens a member detail page
2. The Email field (labelled "Email (login address)") is editable — type the new address
3. An inline amber warning appears: "Changing this email updates their login. They'll be signed out immediately and must use the new address."
4. Admin clicks "Save changes"
5. A confirmation panel replaces the save button: shows old → new email and explains the sign-out consequence — "Yes, change email" / "Cancel"
6. On confirm: email updates in DB, all of that member's sessions are deleted (they're logged out), page refreshes with the new email

**Key files:**
- `components/MemberDetail.tsx` — `email` state + `originalEmail` const + `emailChanged` derived; two-step confirm flow in `handleSave`
- `app/api/admin/members/[id]/route.ts` — PATCH: validates format, checks uniqueness (409 on conflict with another account), updates `User.email`, `db.session.deleteMany` to force re-auth

**🔧 Technical notes:**
- Email uniqueness check: `db.user.findFirst({ where: { email: newEmail, id: { not: id } } })`
- Sessions are killed with: `db.session.deleteMany({ where: { userId: id } })`
- After the PATCH, `router.refresh()` is called in the client to sync the server component (updates the header and restores `originalEmail` to the new value)
- The admin's own session is unaffected — only the target member's sessions are deleted

**Typo recovery workflow:** If a member mistyped their email at registration (never received the sign-in code), staff can look them up by name in the volunteer area → copy their correct email → fix it in `/admin/members/[id]`

---

### What's planned: Self-service email change

**What it would do:** Allow a member to update their own login email from the My Profile page. Requires email verification — the new address receives a confirmation link before any change is made.

**Why it matters:** Members sometimes change email providers. Admin-only email change (above) covers typo recovery; this covers long-term account maintenance.

**Proposed flow:**
1. Member visits `/account/dashboard-my-profile`
2. Clicks "Update email address"
3. Enters new email and clicks "Send confirmation"
4. `POST /api/account/request-email-change` — validates format, checks it's not already in use, generates a token, writes `pendingEmail + emailChangeToken + emailChangeExpiresAt` to User, sends verification email to the **new** address
5. Member receives email: "Confirm your new email address — click to confirm"
6. Member clicks link → `GET /api/account/confirm-email-change?token=` — validates token + expiry, writes new email to User, deletes token fields, kills all sessions, redirects to `/login` with a success message

**DB changes needed (not yet applied):**
- `pendingEmail String?` on User
- `emailChangeToken String?` on User
- `emailChangeExpiresAt DateTime?` on User

**New files needed:**
- `app/api/account/request-email-change/route.ts` — POST (initiate)
- `app/api/account/confirm-email-change/route.ts` — GET (verify token + update)
- `sendEmailChangeVerificationEmail()` in `lib/email.ts`
- UI component on My Profile page

**Edge cases to handle:**
- Token already exists (another change in flight) — overwrite with new token
- Token expired — show "link expired, request a new one"
- New email already belongs to another account — 409 error
- Member requests change and immediately logs out — confirmation link still works (token is on User record, not tied to session)
- Session kill after confirmation: member must re-authenticate with the new email

---

## 12. Course Access System (`/course/[slug]`)

**What it does:** Member-gated course pages that list their lessons. Courses and lessons now live in **Postgres** (migrated from Sanity in session 50). Two access levels determine who can view a course. Access is enforced at the page level on every request; `/course/*` is also protected by `proxy.ts` (login redirect for unauthenticated users).

### Access levels (set on the Course record in Postgres)
| Level | Who gets in |
|---|---|
| `MEMBERS` | Any logged-in user (default) |
| `REGISTRATION_REQUIRED` | Must have an active registration (REGISTERED or APPROVED) for a program linked to this course via `ProgramCourse`, **OR** an explicit admin grant in the `CourseAccess` DB table |

### Route
- `/course/[slug]` — course page (singular, not `/courses/`); lists all lessons as clickable cards; `isSectionTitle` lessons render as non-linked dividers
- `/lessons/[slug]` — individual lesson page; renders Markdown body with custom block support (see §27)

### Linking programs to a course (multi-program support)
The `ProgramCourse` join table links Sanity programs to Postgres courses. During Phase 2, `programId` stores the Sanity `_id`. A single program can link to multiple courses; multiple programs can link to the same course. Once linked, all members with an active registration for that program automatically have access (checked dynamically at page render — no DB write at registration time). Program-course links are managed from the Teacher Hub course editor.

### The Course Access admin UI
From `/admin/members/[id]` → Course Access section (`<CourseAccessSection>`), an ADMIN sees a **searchable list of every course in the system**. Each course displays one or more status badges showing exactly why this member does or doesn't have access:

| Badge | Color | Meaning |
|---|---|---|
| **All Members** | green | Course `accessLevel` is `MEMBERS` — any logged-in user can view it |
| **Via Registration: [Program]** | blue | Member has an active registration for a program linked to this course |
| **Manual Grant** | yellow/amber | An admin explicitly granted access via a `CourseAccess` DB record |
| **No Access** | grey | None of the above apply |

**Granting access:** A "Grant access" button appears on any course the member doesn't have a manual grant for. If access via another path already exists (all members or via registration), clicking the button shows an inline warning — "All logged-in members already have access" or "This member already has access via their [Program] registration" — with "Grant anyway" / Cancel.

**Revoking a grant:** If a manual grant exists, a "Revoke" button is shown. Clicking shows a confirm step. If the member still has access via another path after revocation, an informational note explains this before confirming ("After revoking, this member will still have access via their [Program] registration").

**Search:** A search bar filters by course name or slug client-side.

### Key files
- `app/course/[slug]/page.tsx` — server component; `force-dynamic`; checks session, fetches course from Postgres (`db.course.findUnique`), runs access check via `ProgramCourse` table, renders lessons via ReactMarkdown; uses existing Webflow CSS classes from the original course page — do not replace with `co-` classes
- `app/lessons/[slug]/page.tsx` — server component; reads from `db.lesson.findUnique`; renders Markdown body with custom block components (verse, practice, callout); `lp-` prefix CSS
- `app/api/admin/courses/route.ts` — GET, ADMIN or REGISTRAR; fetches all Postgres courses enriched with `linkedByPrograms` (hybrid Postgres + Sanity lookup for program names during Phase 2); powers `CourseAccessSection`
- `app/api/admin/members/[id]/course-access/route.ts` — POST (grant, upsert) / DELETE (revoke by `?courseSlug=`) — ADMIN only
- `components/CourseAccessSection.tsx` — client component; fetches all courses on mount via `/api/admin/courses`; uses `useMemo` to derive `activeRegSlugs` (Set) and `grantsMap` (Map); `computeStatuses()` derives per-course badge state; per-course UI state machine: `Record<slug, "idle" | "confirming_grant" | "confirming_revoke" | "busy">`

**🔧 Technical notes:**
- Courses and lessons migrated from Sanity to Postgres in session 50. Course `accessLevel` is now a Prisma enum (`CourseAccessLevel`): `MEMBERS` or `REGISTRATION_REQUIRED`.
- `ProgramCourse` join table replaces Sanity `linkedCourses` references. During Phase 2, `programId` stores the Sanity `_id`; becomes Postgres cuid in Phase 3 when programs migrate.
- Access check for `REGISTRATION_REQUIRED` courses: (1) query `ProgramCourse` for all programIds linked to this course; (2) `db.registration.findFirst` for active registration matching any of those programIds for this userId; (3) fall back to `db.courseAccess.findUnique`. Pure Postgres — no Sanity queries needed.
- `CourseAccess` Prisma model: `@@unique([userId, courseSlug])` — upsert-safe (POST uses `upsert` to avoid duplicate errors); `grantedBy` stores the granting admin's userId for audit trail. Now has optional FK to Course model (`onDelete: Cascade`).
- `computeStatuses()` is a pure function in `CourseAccessSection` — derives badges from: `course.accessLevel`, `activeRegSlugs` (Set of program slugs the member is actively registered for), and `grantsMap` (Map of courseSlug → grant). No extra API calls.
- The course page uses Webflow CSS (`course-header`, `f-container-regular`, etc.). The `ca-` CSS prefix is for `CourseAccessSection` only. Description renders via ReactMarkdown (was PortableText when in Sanity).
- Lesson pages use `lp-` prefix CSS and render Markdown with a custom `blockquote` interceptor for `[verse]`, `[practice]`, and `[callout]` blocks (see §27).

---

## 13. Donation Management System (Phase 2 — Planned)

**Status:** Designed and documented. Not yet built. Stripe registration dana (Section 4c) writes to this system from day one via webhook, so no migration will be needed when Phase 2 UI is built.

### What it does

A unified system for tracking every financial contribution to RIM regardless of source — Stripe, GiveButter, cash, check, or other. Designed for the TREASURER role and to support the QuickBooks workflow.

This is distinct from the registration dana flow (Section 4c). That flow is the moment of giving. This system is the permanent record and management interface for everything received.

### Who uses it

| Role | Access |
|---|---|
| `TREASURER` | Full access — view all donations, enter manual donations, run reports |
| `ADMIN` | Same as TREASURER |
| `REGISTRAR`, others | No access |

### Sources tracked

| Source | How it gets in |
|---|---|
| `stripe` | Automatic — Stripe webhook writes to `Donation` table when any Stripe payment completes |
| `givebutter` | Import — GiveButter webhook or CSV import by a TREASURER |
| `cash` | Manual entry — TREASURER or designated volunteer enters donor info + amount |
| `check` | Manual entry — same as cash, with check number in `sourceId` field |
| `other` | Manual entry — for anything else (in-kind, wire transfer, etc.) |

### The management UI (to be built at `/volunteer/donations` or `/admin/donations`)

- **Donor list** — searchable, shows total giving history per donor, links to their member record if they have one
- **Manual entry form** — find an existing member by name/email or create a guest entry; select source (cash/check); enter amount and date; add notes
- **GiveButter import** — CSV upload or webhook integration to pull in existing GiveButter donor history
- **Donation history** — filterable by date range, source, program, donor
- **QuickBooks export** — CSV formatted with the columns the treasurer needs to enter into QuickBooks (date, donor, amount, program, source, notes)

### Relationship to GiveButter

GiveButter continues as the public-facing donation widget on the website until this system is mature enough to replace it. When the native donation page is ready:
1. Switch the public "Donate" page to use Stripe (via a simple donation form, separate from registration)
2. Import GiveButter historical data as `source: 'givebutter'` records
3. GiveButter account can be wound down — no donor data is lost

GiveButter donors do **not** need to be migrated to member accounts. Their donation history can exist as guest records (no `userId`), searchable by name/email.

### Why this is documented now

The Stripe metadata structure (Section 4c) and `Donation` DB model (Section 7) are both designed with this system in mind. Every registration dana payment that goes through Stripe will automatically appear in the donor's history with full context (program, amount breakdown, date) with no additional work. Building the UI in Phase 2 is primarily additive — not a migration.

**🔧 Technical notes:**
- `Donation.registrationId` links a donation back to the specific registration it came from — this is how we avoid double-counting (a donor's registration dana appears in both their `Donation` history and the program's `Registration` table, but they're the same transaction linked by foreign key)
- `Donation.sourceId` is indexed and unique per source — used to prevent duplicate imports (e.g., if a GiveButter CSV is imported twice, duplicate `sourceId` values are ignored)
- `recordedBy` is null for automatic entries (Stripe webhook) and set to the staff userId for manual entries — provides an audit trail
- `donatedAt` vs `createdAt`: `donatedAt` is when the donation actually happened (important for accurate QuickBooks period reporting); `createdAt` is when it was entered into our system (a manual cash entry from last month should have `donatedAt` = last month)

---

## 14. Community Onboarding & Membership Philosophy

> **Manual note:** This section describes both the technical implementation and the philosophical intent behind it. Both matter equally. Future developers should read the philosophy before touching the code.

### Philosophy

RIM is an intentional community, not a platform. Every technical decision about how people join, log in, and access the member space should reflect that. The digital threshold should feel like walking into a Zen temple — you know you're entering something held, intentional, and cared for — without feeling institutional or bureaucratic.

This shapes everything:
- No long agreements pages. No terms-of-service walls.
- Real names are required. Anonymity is not compatible with community.
- The membership path flows naturally through participation, not through paperwork.
- Every User record in the database represents a real person who has intentionally chosen to be part of this community. No ghosts, no half-formed accounts, no accidental members.

### Membership paths

There are two natural ways someone enters the RIM community:

**Path A — Through a program (the primary path)**
1. Person finds a program (workshop, retreat, drop-in) and registers
2. Registration form collects first name, last name, email, phone (optional), and a brief community agreements checkbox — all on one form
3. A User record is created or updated with their name/phone, `agreedToTerms` set to `true`
4. Confirmation email arrives; subsequent visits to `/login` send a 6-digit sign-in code to the same email
5. They enter the code on `/login/check-email` — they're in. No additional steps. Profile already populated.

**Path B — Directly through the login page (returning members / direct sign-in)**
1. Person visits `/login`, enters their email, receives a 6-digit sign-in code by email, enters the code on `/login/check-email`
2. On first visit (or if `agreedToTerms` is false): intercepted by profile completion page `/account/welcome` before reaching dashboard
3. Warm community-voiced page asks for name (required), phone (optional), and shows brief community agreements with checkbox
4. On submit: profile saved, `agreedToTerms` set to `true`, redirected to dashboard
5. Never shown again

### The community agreements

A brief, warm statement — 3–4 lines — reflecting RIM's values. Not a legal document. Something close to what you'd hear at the opening of a retreat. The exact wording is set by RIM staff and lives on the `/account/welcome` page and registration form. A checkbox confirms: *"I'm entering this community in a spirit of care and respect."*

This is not an uncommon practice for intentional communities. It is minimal, meaningful, and done once.

### Drop-in programs

Weekly drop-in programs (sitting groups, classes) do not require per-session registration. Their Zoom links live on the member dashboard, always accessible once someone has crossed the membership threshold. No friction each week — just show up.

For convenience, if a member is logged in and viewing a program page that has a related drop-in, a link to the Zoom can surface there as well (planned — not yet built).

### Incomplete accounts — cleanup

A User record is considered incomplete if `agreedToTerms` is `false`. This can happen in two ways:

1. **Abandoned mid-welcome-page:** Someone signed in with a code but closed the browser before completing their profile. A daily cleanup cron deletes User records where `agreedToTerms = false` and `createdAt < 48 hours ago`. Silent, automatic.

2. **Explicit decline:** The `/account/welcome` page has a visible "I'd rather not join" link. Clicking it immediately deletes the User record (and any related records), signs them out, and redirects to the public homepage. Clean, no drama.

The result: every User record in the system is an intentional community member. The admin member list reflects reality.

### Login page framing

The `/login` page uses "Join or sign in" as the heading — not "Log in." The copy briefly explains the 6-digit sign-in code (no password needed, works for new and returning members alike). A note below the form says: *"New to RIM? You'll set up your name and a brief community welcome after your first sign-in."*

This eliminates the common confusion where a new person sees "Log in" and assumes they need a pre-existing account.

### Registration → member account connection

When a non-logged-in person submits a registration form:
- The API finds or creates their User record by email
- First name, last name, and phone are written to the User record (blank fields only — never overwrites existing data)
- If the community agreements checkbox was checked: `agreedToTerms = true`, `agreedAt = now()`
- They receive a confirmation email. The next time they visit `/login`, they get a 6-digit sign-in code and entering it takes them directly to the dashboard (no welcome page — they already agreed)

When a logged-in member registers: name/phone already on file, no agreements step, shorter form.

### Key files

- `app/login/page.tsx` — "Join or sign in" framing, 6-digit sign-in code explanation
- `app/login/check-email/page.tsx` — 6-digit code entry form (six numeric boxes, submits to NextAuth Resend callback)
- `app/account/welcome/page.tsx` — profile completion + community agreements (required on first login)
- `app/api/account/complete-profile/route.ts` — POST: saves name/phone/agreements; DELETE: removes account on explicit decline
- `app/api/registrations/route.ts` — POST: writes name/phone back to User, sets agreedToTerms if checkbox checked
- `prisma/schema.prisma` — `agreedToTerms Boolean @default(false)`, `agreedAt DateTime?` on User model
- `auth.ts` — session callback includes `agreedToTerms` so proxy.ts can check it
- `proxy.ts` — redirects to `/account/welcome` if session exists but `agreedToTerms` is false
- `app/api/cron/cleanup-incomplete-accounts/route.ts` — daily cron: deletes User records older than 48h with `agreedToTerms = false`
- `public/css/custom.css` — `wl-` prefix for welcome page styles

### Database fields added to User

| Field | Type | Purpose |
|---|---|---|
| `agreedToTerms` | `Boolean @default(false)` | Whether the member has completed the welcome/agreements step |
| `agreedAt` | `DateTime?` | Timestamp of when they agreed — audit trail |

### 🔧 Technical notes

- `agreedToTerms` is read from the DB in the `auth.ts` session callback and attached to `session.user.agreedToTerms` — this lets proxy.ts check it without a DB query in the edge runtime
- proxy.ts exempts `/account/welcome` from the `agreedToTerms` check — otherwise the redirect would loop
- The welcome page is a server component; the form submit is a client component (`WelcomeForm`) that POSTs to the API
- DELETE on `/api/account/complete-profile` deletes the User record with `onDelete: Cascade` — this automatically removes all related Sessions, Accounts, Registrations, CourseAccess records
- The cleanup cron uses the same `CRON_SECRET` Bearer header pattern as the reminder cron. Schedule: `0 15 * * *` (15:00 UTC daily). Configured in `vercel.json` alongside the reminder cron.
- Agreements text wording is hardcoded in JSX for now — can be moved to Sanity if RIM wants to update it without a deploy
- `wl-` CSS prefix is for the welcome page only — it is a 🟢 design system page

---

## 15. Site Administration Tools

### 15a. Site Architecture Page (`/admin/sitemap`)

**What it does:** A living reference page — ADMIN-only — showing every page on the site organized by function. Replaces the visual site overview that was easy to see in Webflow Designer but harder to keep in mind when working in code.

**Who uses it:** Site administrators and developers who need to understand what exists, what's missing, or what the CSS migration status of any page is.

**How to find it:** Log in as an admin → member nav → "Site Architecture." Direct URL: `/admin/sitemap`.

**What it shows:**

| Section | What's in it |
|---|---|
| Public Marketing | Homepage, programs listing, community agreements page, diversity, donate |
| CMS-Powered Templates | All dynamic routes — programs, lessons, courses, magazine articles, glossary, team, volunteer positions |
| Program Registration | The standalone `/programs/[slug]/register` focused form |
| Authentication & Onboarding | Login, check-email, auth error, community welcome |
| Member Area | Dashboard, My Library (stub), My Profile, Care Agreements |
| Admin | Site Architecture (this page), Member List, Member Detail |
| Volunteer / Registrar Area | Registrar program list, registration management table, volunteer opportunities, volunteer thank-you (orphan) |
| Kalyana Mitta — Community Groups | Groups overview, guidelines, group application |
| Self-Service & Utility | Edit My Registration (token-gated, no login needed) |
| Developer / Internal | Style guide |

Each page entry shows:
- **Access badge** — Public / CMS / Member / Admin / Staff / Utility / Dev
- **CSS layer** — 🟢 Design System (no Webflow dependency) or 🟠 Webflow
- **Status chip** — ⚠️ Stub (exists but incomplete/hardcoded), ⚠️ Orphan (exists but unreachable), ↩ Repurposed (function changed)
- Clickable URL (opens in new tab) or template notation for dynamic routes
- Plain-language description

**⚠️ Not Yet Built section** — Items tracked as planned-but-missing:
- Kalyana Mitta Group Detail Form — allows group leaders to manage their group info after approval
- Access Denied / 401 page — currently no graceful unauthorized error page
- Volunteer Interest Form API — the form on `/volunteerism/volunteer` has no backend; submissions go nowhere
- My Library rebuild — current page is hardcoded and links to the old Webflow site

**Footer note** shows the CSS migration goal and lists all currently 🟢 pages.

**Key file:** `app/admin/sitemap/page.tsx` — fully server-side (no client components). All page data is defined as TypeScript constants in the file; updating the sitemap means editing this file. CSS prefix: `adm-sm-`.

**🔧 Technical notes:**
- Access check: `session.user.roles?.some(r => r === "ADMIN")` — REGISTRAR cannot view this page
- Page and section data lives entirely in the file as typed TypeScript constants (`SECTIONS`, `NOT_YET_BUILT`) — no database or CMS involved
- `--section-color` CSS custom property passed as an inline style on each section card, scoped to that card's color indicator
- The sitemap is intentionally a manually maintained reference, not auto-generated — auto-generation would miss status annotations and descriptions
- When new pages are added to the app, update this file to keep the reference accurate

### 15b. Navigation — Admin Links

Admin users see two additional links in the member navigation:

- **Members** → `/admin/members` (member list)
- **Site Architecture** → `/admin/sitemap`

These links are rendered conditionally — `isAdmin` check in `Nav.tsx` — and are invisible to regular members and non-admin staff.

**Key file:** `components/Nav.tsx`

### 15c. Feature Inventory Page (`/admin/features`) ✅ Built — session 30 (2026-03-06)

**What it does:** A comprehensive, ADMIN-only reference page documenting every feature in the application — organized both as a **system-level overview** and as a **feature-by-feature catalog**. Designed to serve two purposes: (1) get anyone up to speed on how the whole system works, and (2) act as a cold-start reference if project context is lost.

**Who uses it:** Administrators and developers who need to understand the site holistically — how features connect, what depends on what, and what breaks if a service goes down. Also serves as a reference a non-technical manager can use to articulate the system to others.

**How to find it:** Log in as an admin → member nav → Admin → "Feature Inventory." Direct URL: `/admin/features`.

**What it contains:**

The page has two layers separated by a divider:

**Top layer — System View (4 sections):**

| Section | What it shows |
|---|---|
| System Overview | What the app is, four core purposes, user types table (5 types: public visitor → admin), key philosophy (programs as front door, meet links dashboard-only) |
| System Map | 12-row dependency table — each functional area: what it Needs / what it Powers / key Note |
| Data Flows | Two end-to-end scenarios with numbered steps and area labels: "A new visitor registers for a program" (12 steps) and "A member logs in on a Tuesday morning" (7 steps) |
| If X Breaks | 8 external dependency cards — each shows the system name (Sanity, Resend, Postgres, Stripe, LiveKit, Vercel Cron, Flodesk, Google OAuth) and what cascades as bullet points with red ✕ markers |

**Bottom layer — Feature Detail:**

13 functional areas, ~60 feature cards. Each card contains:
- **Where** — URL(s) or key file(s) as monospace tags
- **What** — plain-English description of the feature
- **Related to** — bulleted functional relationships (→ prefix)

Areas: 🔐 Auth, 🛡️ Route Protection, 📋 Registration, ✉️ Email, 💰 Dana/Stripe, 📊 Volunteer Tools, 👤 Member Experience, 📚 Course Access, 🛠️ Member Management, ⏰ Scheduling, 🎥 LiveKit Video, 🗂️ Sanity CMS, 🌐 Public Pages + Admin Tools + Nav.

**Quick-jump nav:** Two rows — "System view" (4 anchors, highlighted in `--rim-blue`) and "Feature areas" (13 area links).

**Key file:** `app/admin/features/page.tsx` — server component, ADMIN-only. All data defined as TypeScript constants (`USER_TYPES`, `SYSTEM_MAP`, `DATA_FLOWS`, `CRITICAL_DEPS`, `FEATURE_AREAS`). CSS prefix: `adm-fi-`.

**🔧 Technical notes:**
- Same data-driven TSX pattern as `/admin/sitemap` — typed constants rendered as JSX, no database or CMS involved
- `SYSTEM_MAP` explicitly typed as `{ area: string; needs: string; powers: string; note: string }[]` to avoid implicit any
- `DATA_FLOWS` uses an inline interface with `id`, `title`, `subtitle`, and `steps[]` (each step: `area` + `what`)
- CSS counter used on `adm-fi-flow__step` (`counter-increment: step-counter`) for auto-numbered flow steps
- `adm-sm-ext-link` added to `/admin/sitemap` header pointing to this page; "Feature Inventory" added to admin nav dropdown (desktop + mobile)
- The page is intentionally manually maintained — auto-generation from the codebase would miss the functional relationships and plain-English descriptions that make it useful

---

## 16. Navigation Component

**What it does:** The global sticky navigation bar rendered on every page of the site. Handles public browsing, authenticated member access, and admin-only links — all in a single responsive component with no Webflow class dependencies.

**Who uses it:** Every visitor and member on every page. Rebuilt from scratch in session 16 (2026-03-04) to eliminate all Webflow structural classes.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  [Logo] Rooted In Mindfulness    Programs  Get Involved▾  Member Area▾  [DONATE] │  ← Desktop
└─────────────────────────────────────────────────────────┘

┌─────────────────────────┐
│  [Logo] Rooted In Mindfulness          [☰] │  ← Mobile
└─────────────────────────┘
  ▼ (hamburger open)
  Login / Programs / Volunteer / Join RIM / Donate Today
```

### Desktop nav

**Public mode:** Programs ▾ · Get Involved ▾ · Member Area/Hi [Name] ▾ · Donate pill

The Programs dropdown has two items: "All Programs" → `/community-programs` and "This Week's Schedule" → `/this-week`. Same dropdown pattern as Get Involved and Member Area.

**Member area mode** (`/account/*`, `/admin/*`, `/tools/*`): My Home · Programs ▾ · Sign Out · Donate pill

Top nav in the member area is intentionally minimal — the sidebar is the authoritative left rail (session 110 cleanup). The Admin dropdown and standalone `Courses` / `Teachers` links were removed because the sidebar already surfaces every staff destination, and the public catalog pages were creating two paths to "courses" / "teachers" inside the member area without a clear distinction.

Dropdowns open on CSS `hover` + `focus-within` — no JavaScript required for desktop. Each dropdown renders a white floating card with `--rim-bg-accent` separator lines between items.

### Mobile nav

Hamburger button (3 bars → X animation via CSS transitions) toggles the mobile menu via React `useState`. Menu is a flat list — no nested sub-menus. Background is `--rim-bg` (warm) to visually distinguish the open menu layer from page content.

### Brand

Logo image + "Rooted In Mindfulness" in Quincycf 500 weight, `--rim-text` color. Always the same regardless of whether the user is logged in or on a member area page.

### Design decisions

- **Sticky:** `position: sticky; top: 0; z-index: 100`
- **No borders** — white nav bar sits above warm `--rim-bg` page content; color contrast separates them without a hard line
- **Quincycf** brand name — matches the font used throughout the original site for headings
- **Open Sans 500** for all nav links — matches body font, slightly heavier than regular for nav weight
- **Hover state:** both `color: var(--rim-blue)` and `background: var(--rim-bg)` are set explicitly so text never blends into background
- **Donate button:** pill shape (`border-radius: 9999px`), `--rim-mid` teal background, always visible on desktop, rendered as a bottom pill in mobile menu

### Key files

- `components/Nav.tsx` — full component (client component; `"use client"`)
- `public/css/custom.css` — `nav-` CSS block near end of file
- `public/nav.js` — **deleted** (was the Webflow JS hamburger/dropdown handler; no longer needed)

### 🔧 Technical notes

- `"use client"` required — uses `useSession`, `usePathname`, `useState`, `useEffect`
- `isMemberArea` is derived from `pathname.startsWith("/account") || pathname.startsWith("/admin")` — controls whether the minimal member-area nav or full public nav renders
- `isAdmin` checks `session.user.roles?.includes("ADMIN")` — controls visibility of Admin dropdown (desktop + mobile)
- Mobile menu closes on route change (`useEffect` on `pathname`) and on Escape key
- Desktop dropdowns use **CSS only** — `.nav__dropdown:hover .nav__dropdown-panel, .nav__dropdown:focus-within .nav__dropdown-panel { display: block }`. No JS hover listeners.
- Hover gap fix: `.nav__dropdown-panel` has `top: 100%; padding-top: 6px` — the panel starts immediately below the toggle (no gap = no lost hover), and the 6px padding creates visual separation. The visible card styles live on `.nav__dropdown-panel-inner`.
- `Sign Out` button uses `signOut({ callbackUrl: "/" })` from NextAuth — renders as a `<button>` styled to match nav links
- Previously `nav.js` was loaded via a `useEffect` script injection in the old Nav.tsx. That injection is completely removed.

---

## 17. Planned Features

Features that have been designed and scoped but not yet built. Listed here so intent and design decisions are preserved between sessions.

---

### 17a. Automated Dana Follow-Up Email

**Status:** Planned — not yet built.

**What it does:** Automatically sends a gentle follow-up email to registrants whose `donationStatus` is `PENDING` — meaning they registered, saw the dana step, and either skipped it or closed the window without completing the offering.

**Why it matters:** Currently, pending donations are only visible to the registrar via the volunteer table. If the registrar doesn't manually send a follow-up, members may simply never complete their offering. An automated nudge removes the manual burden and ensures no one falls through the cracks.

**Proposed flow:**
1. Daily cron (or scheduled check) queries all `Registration` records where:
   - `donationStatus = "PENDING"`
   - `status IN ("REGISTERED", "APPROVED")` — active participants only
   - `createdAt < now - 24h` — registered at least 24 hours ago (avoids emailing people who just registered and may still be completing the flow)
   - `danaNudgeSentAt IS NULL` — not already sent
2. For each match, send a gentle reminder email via Resend
3. Stamp `danaNudgeSentAt = now()` on the Registration to prevent double-sends

**Email:** Subject: "A gentle reminder — your dana for [Program]". Warm, low-pressure. Links directly to the program page's registration/dana URL (`/programs/[slug]/register`). Includes the program's `danaMessage` if set. No guilt — consistent with RIM's dana philosophy.

**DB changes needed:**
- `danaNudgeSentAt DateTime?` on the `Registration` model

**New files needed:**
- `app/api/cron/send-dana-nudges/route.ts` — daily cron handler (same pattern as `send-reminders`)
- `sendDanaNudgeEmail()` in `lib/email.ts`
- Entry in `vercel.json` cron schedule

**Staff UI option (registrar can also trigger manually):**
- Add `action: "sendDanaNudge"` case to `PATCH /api/registrations/[id]` — same pattern as `sendDanaReminder` which already exists for admin-manual use. The automated cron would use the new endpoint; manual use continues via the existing `sendDanaReminder` action.

**🔧 Notes:**
- The existing `action: "sendDanaReminder"` in `PATCH /api/registrations/[id]` is already a manual version of this. The new cron is just the automated version with a `danaNudgeSentAt` guard.
- Send only once automatically; registrar can still manually re-send via the volunteer table button.
- No cron run should overlap — use `danaNudgeSentAt` as the idempotency guard, same pattern as `reminderSentAt`.

---

### 17b. Member Cancellation Self-Service

**Status:** ✅ Built and deployed — 2026-03-05 (session 24).

**What it does:** Members can cancel their own registration from the My Programs page (`/account/programs`). This covers active registrations (REGISTERED, APPROVED, or WAITLISTED status). Once cancelled, the registrar is automatically notified by email and can decide who to promote from the waitlist.

**Member flow:**
1. Visit My Programs (`/account/programs`)
2. Click "Cancel registration" at the bottom of the active registration card
3. Confirm in the inline dialog: "Cancel your spot in [Program]? This cannot be undone."
4. Card shows "✓ Registration cancelled" inline — no page reload
5. Registrar receives the standard cancellation notification email (same as registrar-initiated cancellation)

**Key design decisions:**
- Registrar is notified but NOT automatically prompted to promote — they choose who to promote, consistent with the existing manual workflow
- All three active statuses are cancellable: REGISTERED, APPROVED, WAITLISTED (a member on the waitlist can remove themselves too)
- The cancel button is subdued (small muted text-link) to avoid drawing attention away from the registration details
- 4-state UI machine: idle → confirming → loading → done; never redirects, no page reload

**Key files:**
- `app/api/account/registrations/[id]/cancel/route.ts` (NEW) — POST: auth check → ownership check (403 if not their registration) → status guard (400 if already CANCELLED or not cancellable) → `db.registration.update({ status: "CANCELLED" })` → fire-and-forget registrar email
- `components/CancelRegistrationButton.tsx` (NEW) — `"use client"` component; 4-state machine (idle / confirming / loading / done); `mr-cancel-` CSS prefix
- `app/account/programs/page.tsx` (MODIFIED) — imports and renders `<CancelRegistrationButton>` in `<div className="mr-card__actions">` for REGISTERED, APPROVED, WAITLISTED cards
- `public/css/custom.css` — `mr-card__actions`, `mr-cancel-btn`, `mr-cancel-confirm`, `mr-cancel-confirm__text`, `mr-cancel-confirm__actions`, `mr-cancel-btn--yes`, `mr-cancel-btn--keep`, `mr-cancel-done`

**🔧 Technical notes:**
- Separate endpoint from registrar cancellation: `POST /api/account/registrations/[id]/cancel` (member) vs `PATCH /api/registrations/[id]` (registrar). Keeps auth contexts clean — member endpoint only needs `session.user.id`; registrar endpoint checks for REGISTRAR/ADMIN role.
- Ownership check: `registration.userId !== session.user.id` → 403. Prevents any authenticated member from cancelling someone else's registration.
- Fire-and-forget email: `sendCancellationNotificationEmail(...).catch(() => {})` — email failure does not prevent the cancellation from completing.
- The API returns `{ id, status: "CANCELLED" }` — the client uses this to transition to the "done" state.
- On error: `alert()` + revert to "confirming" (not "idle") so the dialog stays open for retry.

---

### 17c. Self-Service Email Change

**Status:** Designed — not yet built. See Section 11b for full spec.

---

### 17d. Program Capacity Management

**Status:** Partially built across multiple sessions. Core capacity enforcement built in an earlier session; spot-opened alerts and program-page capacity notices built in session 24 (2026-03-05). Auto-promotion on cancellation is not built (registrar manually promotes — by design).

**What's built:**

**Capacity enforcement** (earlier session): `registrationCapacity` number field in Sanity (Registration tab, optional — no cap if blank). Registration API counts active registrations (`REGISTERED + APPROVED`) against capacity before setting status — if at or above capacity, new registrations are automatically `WAITLISTED`. `registrationClosed` boolean continues to work as a manual override.

**Capacity notices on program page** (session 24): The public program page shows context-aware notices near the registration CTA:
- *At capacity:* "This program is fully booked — submitting will add you to the waitlist." (warm amber box, `pg-capacity--full`)
- *≤5 spots remaining:* "X spots remaining." (plain muted text, `pg-capacity--low`)
- *Plenty of spots or no capacity set:* nothing shown — no noise when the situation is fine

**Spot-opened alerts** (session 24): A "spot opened" state means: `registrationCapacity` is set AND `confirmedCount < registrationCapacity` AND `waitlistedCount > 0`. This is distinct from "has a waitlist at full capacity."
- **Volunteer index** (`/account/registrar`): green "↑ Spot open · N waiting" badge on the program card — distinct from the amber "N waitlisted" badge shown when full. Program card also gets `vol-card--attention` highlighting.
- **Per-program VolunteerTable**: amber "A spot has opened. N people are on the waitlist. Use the Promote button next to their name to confirm their spot." banner above the registrations table.

**Staff manual**: Both notices and alerts are documented in `/admin/manual` — spot-open badge, VolunteerTable alert, promoting-from-waitlist workflow all updated.

**What's not built:**
- Auto-promotion on cancellation. Registrar manually decides who to promote. This is intentional — the registrar may want to contact the next person before promoting, or may choose to skip someone.

**`spotOpened` derivation:**
```ts
const spotOpened = !!registrationCapacity
  && confirmedCount < registrationCapacity
  && waitlistedCount > 0;
```

**Key files:**
- `app/account/registrar/page.tsx` — `spotOpened` + updated `needsAttention`, `vol-signal--spot-open` badge, conditional waitlist badge
- `components/VolunteerTable.tsx` — `waitlistedCount` from `counts.WAITLISTED`, `spotOpened` derivation, `vol-spot-opened` alert banner
- `app/programs/[slug]/page.tsx` — `isFull`, `showLowSpots` derivations; `pg-capacity--full` / `pg-capacity--low` notices in CTA section
- `public/css/custom.css` — `vol-signal--spot-open`, `vol-spot-opened`, `pg-capacity`, `pg-capacity--full`, `pg-capacity--low`

---

### 17e. Add to Calendar Links ⚡ HIGH PRIORITY

**Status:** ✅ Built and deployed — 2026-03-04.

**What it does:** Members can add a confirmed program to their Google Calendar or download an `.ics` file for Apple Calendar / Outlook, directly from the confirmation email and the program page. Calendar links only appear when a `startDatetime` is set in Sanity (optional — recurring or open-ended programs may not set it).

**Implementation:**
- **Sanity schema:** Added optional `startDatetime` (datetime) and `endDatetime` (datetime) fields to the Schedule tab on programs. `endDatetime` defaults to 1 hour after start if left blank.
- **`lib/calendarLinks.ts`** (new): `buildGoogleCalendarUrl()`, `buildIcsUrl()`, `buildIcsContent()` utilities.
- **Google Calendar URL:** pre-fills title, dates, location, and a link to the program page.
- **`GET /api/programs/[slug]/ical`:** returns `text/calendar` response for Apple Calendar / Outlook download. 404 if no `startDatetime` set.
- **Confirmation email:** `googleCalendarUrl` + `icsUrl` added to `RegistrationEmailData` and `BuildParams`. A small "Add to calendar" section appears below the date/time/location block (confirmed registrations only, not waitlist).
- **Program page:** Google Calendar + Apple/Outlook links appear below "✓ You're registered." when `startDatetime` is set.

**Staff workflow:** Open the Program Editor → [program] → fill in Start Date & Time (and optionally End Date & Time) → Save. Calendar links will appear automatically in subsequent confirmation emails and on the program page.

**Key files:**
- `lib/calendarLinks.ts` (new)
- `lib/queries.ts` — `programBySlugQuery` + `programConfirmationDataQuery`
- `lib/email.ts` — `RegistrationEmailData`, `BuildParams`, `buildHtml`, `buildText`
- `app/api/programs/[slug]/ical/route.ts` (new)
- `app/api/registrations/route.ts` — builds calendar URLs when `startDatetime` is present
- `app/api/registrations/[id]/route.ts` — `resendConfirmation` action also builds calendar URLs
- `app/programs/[slug]/page.tsx` — calendar links in registered state
- `public/css/custom.css` — `pg-calendar-links`, `pg-calendar-link`

---

### 17f. Welcome Email / Member Nurturing ⚡ HIGH PRIORITY

**Status:** Planned — not yet built.

**What it does:** After a member completes onboarding (`agreedToTerms = true`), they receive a warm welcome email. This is the beginning of a nurturing sequence managed through Flodesk.

**Proposed flow:**
1. `/api/account/complete-profile` (POST) — after setting `agreedToTerms = true`, fire `sendWelcomeEmail()` and add member to Flodesk segment
2. Welcome email (via Resend): warm, personal tone — "You're now part of the community. Here's what's available to you…" Links to dashboard, programs, courses
3. Flodesk sequence: add to a "New Member" segment for a nurturing sequence (separate from the newsletter)

**New files needed:**
- `sendWelcomeEmail()` in `lib/email.ts`
- Flodesk segment subscription call in `/api/account/complete-profile`

**Also consider:** Members who join via registration (not direct login) also set `agreedToTerms = true` — they should also receive the welcome email. Check the registration API path too.

---

### 17g. Resend Confirmation Email ⚡ HIGH PRIORITY

**Status:** ✅ Built and deployed — 2026-03-04.

**What it does:** Registrar can resend a member's registration confirmation email from the volunteer table expanded row. Useful when a member reports not receiving it. The resent email is identical to the original — includes date/time/location, any program-specific confirmation message from Sanity, and calendar links if `startDatetime` is set.

**Implementation:**
- `PATCH /api/registrations/[id]` — new `action: "resendConfirmation"` case. Fetches registration from DB, fetches program data from Sanity (`programConfirmationDataQuery`), builds calendar links, calls `sendRegistrationEmail()`.
- **VolunteerTable:** "Resend Confirmation" button in Actions column for REGISTERED/APPROVED rows, with a two-step inline confirm dialog (matches other destructive-adjacent actions).
- Waitlist registrations also supported — the email will correctly say "you're on the waitlist."

**No DB changes needed** — uses existing email templates and registration data.

**Key files:**
- `app/api/registrations/[id]/route.ts` — `resendConfirmation` action
- `components/VolunteerTable.tsx` — state + handler + button
- `public/css/custom.css` — `vol-action-btn--resend`

---

### 17h. Printable / Exportable Attendee List ⚡ HIGH PRIORITY

**Status:** ✅ Built and deployed (earlier session).

**What it does:** Registrar can export a complete attendee list as a CSV — useful for in-person check-in at retreats and sits. Includes all registrations for the program: Name, Email, Phone, Status, Donation Status, custom question responses, Notes, Waitlist Position, and Registration date.

**Implementation:**
- **"↓ Export CSV" button** in the volunteer table toolbar (`vol-csv-btn`) — a plain `<a href download>` link, no JS state needed.
- **`GET /api/programs/[slug]/registrations?format=csv`** — auth-gated (REGISTRAR/ADMIN), returns `text/csv` with dynamic custom field columns (collects all unique keys across all registrations in the program). Also returns JSON without the `format` param.
- CSV is downloaded directly by the browser as `[slug]-registrations.csv`.

**No DB changes needed.**

**Key files:**
- `app/api/programs/[slug]/registrations/route.ts` — GET with CSV export
- `components/VolunteerTable.tsx` — `vol-csv-btn` in toolbar
- `public/css/custom.css` — `vol-csv-btn`

---

### 17i. Email Notification Preferences 🔵 LOW PRIORITY

**Status:** Planned — not yet built.

**What it does:** Members can opt out of certain transactional emails (e.g. reminder emails) from their profile page.

**Proposed implementation:**
- `emailPreferences Json?` on User model — `{ reminders: true, announcements: true }`
- Check preference before sending in each email function
- UI on My Profile page

---

### 17j. Member Data Deletion Request 🔵 LOW PRIORITY

**Status:** Planned — not yet built.

**What it does:** Member can request deletion of their own account and all associated data from their profile page. GDPR/CCPA consideration.

**Proposed implementation:**
- "Delete my account" button on My Profile (behind a confirmation step)
- `DELETE /api/account/profile` — auth-gated; same zero-registration guard as admin delete (return 409 with instructions if they have registrations); otherwise deletes User + cascade
- Members with registrations: show message directing them to contact the registrar to be manually removed

---

## 35. Hub Notification Redesign ✅ Built — session 72 (2026-03-23)

### What it does

Merges the Announcements tab into Conversations as pinned threads, adds unread indicators to dashboard hub cards, and removes the AlertStrip component.

### Changes

**Announcements → Pinned Conversations:**
- The HubAnnouncement model and Announcements tab are retired
- Coordinators can mark any conversation thread as pinned (‼️ badge, always at top of list)
- Pinned threads render in a "Pinned" section above regular threads
- Any hub member can start threads; coordinators pin/unpin them
- `HubConversationThread` gained `isPinned Boolean` and `pinnedAt DateTime?`
- Migration script: `prisma/migrate-announcements.ts`

**Dashboard Hub Card Unread Indicators:**
- Each hub card shows a teal badge with unread count (threads + replies since `lastVisitedAt`)
- ADMIN bypasses (no HubMember records)

**AlertStrip Removal:**
- `AlertStrip.tsx` deleted; all `alert-strip` CSS removed
- Alert model subsequently removed in session 96 along with Tasks

### Key files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `isPinned`, `pinnedAt` to HubConversationThread |
| `app/api/hub/[slug]/conversations/[id]/route.ts` | PATCH supports `action: "pin"` / `"unpin"` |
| `components/HubConvClient.tsx` | Pinned section, pin/unpin coordinator actions |
| `components/HubConvThreadClient.tsx` | Pin/unpin button in thread header |
| `app/account/hub/[slug]/page.tsx` | Redirects all hubs to `/conversations` |
| `app/account/hub/[slug]/layout.tsx` | Announcements tab removed from HubNavStrip |
| `app/account/dashboard/page.tsx` | Unread counts computed; hub card badges; AlertStrip removed |

---

## 36. Site-Wide Banner ~~✅ Built~~ 🗑 Removed — session 100 (2026-05-06)

> **Removed in Theme E cleanup.** The banner never entered operational use. All code, schema models (`SiteBanner`, `SiteBannerDismissal`), API routes, and CSS removed. The description below is preserved for historical reference.

### What it did

A single-slot ADMIN broadcast banner visible to all logged-in members at the top of their dashboard. Used for community-wide notices (cancellations, closures, etc.).

### How it works

- ADMIN posts a banner from `/admin/banner` — plain text via RimProseEditor (compact variant)
- Only one banner can be active at a time (posting a new one deactivates the previous)
- Members see the banner on their dashboard with a ✕ dismiss button
- Dismissals are per-member (SiteBannerDismissal model)
- ADMIN can deactivate the banner globally

### Schema

| Model | Purpose |
|---|---|
| `SiteBanner` | `body Json`, `isActive`, `createdById` → User |
| `SiteBannerDismissal` | `bannerId` + `userId` @@unique — per-member dismiss |

### Key files

| File | Purpose |
|---|---|
| `app/admin/banner/page.tsx` | Admin management UI |
| `app/api/admin/site-banner/route.ts` | GET/POST/DELETE — banner CRUD (ADMIN only) |
| `app/api/site-banner/dismiss/route.ts` | POST — member dismiss |
| `components/SiteBannerStrip.tsx` | Client component rendered on dashboard |
| `components/AccountSidebar.tsx` | Added "Banner" link for ADMIN |

---

## 37. Tools Route Group ✅ Built — session 73 (2026-03-23)

### What it does

A dedicated `/tools/` route group for full-featured staff applications that outgrew the hub tab system. Tools are independent applications with their own navigation chrome — they are not hub tabs. Each hub links to its associated tool(s) via app links on its home screen.

### The hub vs. application distinction

Hubs are **team workspaces** — conversations, documents, members, tasks. They are about the team. Tools are **applications** — full-featured operational software for a specific workflow. They are about the work.

When an application (like the Program Manager or Support Inbox) grew complex enough to need its own nav, its own sub-pages, and its own UX flow, it was extracted from its hub tab into `/tools/`. The hub keeps a stakeholder view or an app link — but the application itself lives independently.

### Architecture

| Component | Purpose |
|---|---|
| `app/tools/layout.tsx` | Shared shell — auth gate, renders ToolsNav + content wrapper |
| `components/ToolsContext.tsx` | React context for `{ toolName, backHref, backLabel, subNav? }` |
| `components/ToolsNav.tsx` | Sticky nav bar — tool name (left), sub-nav pills (center), back link (right) |
| Per-tool layouts | Each tool directory has its own `layout.tsx` that wraps children in `<ToolsProvider>` with role gate + hub back link resolution |

Site `<Nav>` returns null for `/tools/*` paths. `FooterWrapper` suppresses footer.

### Tools

| Tool | Route | Role Gate | Back Link | Replaced |
|---|---|---|---|---|
| Program Manager | `/tools/programs` | REGISTRAR, ADMIN | Registrar Hub | Hub Programs tab (full management) |
| Host Schedule | `/tools/schedule` | HOST, HOST_MANAGER, ADMIN | Host Team Hub | Event-pill calendar + filterable day list (redesigned session 88) |

### Sub-navigation

Tools can declare sub-navigation items via the `subNav` property in ToolsContext. These render as pill-style links in the ToolsNav center slot with active-state highlighting. Host Schedule no longer uses sub-nav (Live Session and Journal removed in session 76; schedule tool is now a single page with mini-cal + card list).

### Key files

| File | Purpose |
|---|---|
| `app/tools/programs/page.tsx` | Program list (registrar view) |
| `app/tools/programs/new/page.tsx` | Create program |
| `app/tools/programs/[programSlug]/page.tsx` | Program detail + registrations |
| `app/tools/programs/[programSlug]/edit/page.tsx` | Edit program |
| `app/tools/schedule/page.tsx` | Host schedule — event-pill calendar + day-filterable card list (redesigned session 88 from the session-76 mini-cal). Single page, no sub-nav. See §24a for the schedule-tool design contract. |

### Hub stakeholder views

When an application is extracted, the hub may retain a simplified read-only view:
- **Registrar Hub** → Programs tab shows stakeholder dashboard (headcount, capacity, no actions). Registrars see "Open Program Manager →" link.
- **Support Hub** → No stakeholder view. Inbox and Settings tabs removed. App links point to tool.
- **Host Team Hub** → No stakeholder view. Schedule and Session tabs removed. App link points to tool.

### Component updates for extraction

`ProgramEditor` and `ProgramsTableClient` gained a `basePath` prop — all navigation uses it instead of constructing hub URLs. `hubSlug` kept as optional fallback.

`SessionLiveClient` removed (session 76). Live Session and Journal features will be rebuilt around LiveKit video conferencing (Phase 3+).

### CSS prefix

`tools-nav-` for nav chrome, `tools-` for shell layout. Tools reuse their existing CSS prefixes (`vol-`, `si-`, `hub-cal-`, `sv-`, `sh-`, etc.) — the extraction did not change any application-level CSS.

---

## 38. LiveKit Video Conferencing — Phases 1–5 ✅ Built — sessions 76, 86, 117 (Zoom-aligned redesign), session 121 (three-tier permission model + cleanup), session 122 (Krisp NC + per-profile video bitrate + Bell mode), session 124 (full audit, Zoom-style tier widening + three visible pills, Krisp instrumentation, Step-In propagation + timing fix, ProgramTeacher backfill), session 125 (identity vs. capability split, Host Volunteer rename, raised-hand speaking queue, persistent vote signals), session 126 (server-side time gate on the token route + per-session rooms with per-session chat scoping)

### What it does

Embedded video conferencing that replaces Google Meet for virtual and hybrid programs. Members join directly from the dashboard — no separate accounts, no Google login, no meeting links to manage. Host permissions are controlled by RIM's auth system via JWT tokens rather than by which Google account is logged in.

### Status

- **Phase 1 (foundation):** LiveKit Cloud integration, token generation API, VideoRoom component, admin test page. ✅ Complete.
- **Phase 2 (session page):** Dedicated `/session/[slug]` page, dashboard "Join" links to it, host "End for All" button, fullscreen, session-ended screen. ✅ Complete.
- **Phase 2 (dashboard embed):** VideoRoomEmbed replaces MeetJoinButton on the member dashboard, fullscreen toggle. Complete.
- **Phase 3 (host integration):** Emergency host step-in, end-session-for-all, high-fidelity audio for hosts/teachers. ✅ Complete.
- **Phase 4 (session room UI):** Custom RIMConference layout, chat, focus/pin, nonverbal signals, raised-hand banner, presence photos, dark theme, audio prompt. ✅ Complete (session 86).
- **Phase 5 (Zoom-aligned redesign):** ✅ Complete (session 117). The entire session-room UX was reshaped to mirror Zoom's information architecture so Sangha muscle memory transfers cleanly. See "Zoom-aligned redesign" below.
- **Phase 6 (recording):** 🔜 Pressing future feature — see below.

### Time-gated tokens + per-session rooms (session 126)

Two coupled changes completing one design intent: every session is a discrete event with its own LiveKit room and its own chat history. Closes backlog `2026-05-24-002`.

**Server-side time gate.** `/api/livekit/token` and `/api/livekit/guest-token` now refuse to issue tokens outside a session's open window. Window opens 22 min before `Program.startDatetime` (matches the dashboard host early-open epoch from session 121) and closes 30 min after `Program.endDatetime`, with a +90 min fallback when `endDatetime` is null. ADMIN and GUIDING_TEACHER bypass as a safety override (mirrors `hasEndAllAuthority`); guests have no bypass. Outside the window the route returns `403 { error: "session-closed", message, nextOpensAt, nextStartsAt }` — the session page surfaces `message` directly as the user-facing copy ("This session isn't open yet — it begins at 7:00 PM", "This session has ended", "No session right now. The next one is Tuesday at 8:15 AM"). Direct-URL access to `/session/[slug]` is no longer ungated.

**Per-session room names.** Recurring programs used to share one LiveKit room name across every occurrence forever. The schema was already half-set-up for per-session scoping (`SessionChatMessage.sessionDate`, `roomNameForProgram(slug, sessionDate)` already designed to produce `slug-YYYY-MM-DD`) — only the call site never passed the date. Now the server computes today's `sessionDate` via the new `lib/sessionWindow.ts::getActiveSessionWindow` and uses it for the room name. Today's room is `good-morning-sangha-2026-05-26`; tomorrow's is `good-morning-sangha-2026-05-27`. Chat (filtered only by `roomName`) scopes per-session automatically. The token response now carries `sessionDate`; the session page stores it and threads it through `RIMChat` (chat history) and `SessionRoleContext` (so `RIMParticipantTile`'s mute action can include it), and into the request bodies for the four action callsites: mute-participant, mute-all, end-session, step-in.

**Forgot-to-End fallback (three layers).** Explicit End-for-All deletes the LiveKit room and disconnects everyone. If the last participant just leaves without ending, LiveKit Cloud's empty-room idle cleanup destroys the room after ~5 min. And the time gate at the door refuses to issue new tokens after the close window. Tomorrow's room is a fresh name regardless. Yesterday's chat stays in the DB as orphan rows nobody queries.

**Policy: every program follows the per-session pattern.** Confirmed mid-session — drop-ins like Good Morning Silent Meditation included. No exceptions for "continuous community spaces."

**Defense-in-depth assertion on the action routes.** New `lib/sessionWindow.ts::assertSessionDateInWindow` helper wired into mute-participant, mute-all, end-session, and step-in. Refuses if the caller-supplied `sessionDate` doesn't match the currently open window (ADMIN/GT bypass). Step-In is the highest-stakes route (it writes a `HostAssignment` row); the others have low blast radius but the assertion is consistent. Pre-commit reviewer sub-agent flagged this gap.

**Format alignment with the schedule UI.** The session window helper uses `scheduleUtils.shiftToDate(...).toISOString()` so the `sessionDate` it produces matches the format the schedule tool writes to `HostAssignment.sessionDate`. `resolveSessionRole`'s exact-match assignment lookup hits existing rows correctly. The DST drift in `shiftToDate` is a pre-existing platform-wide limitation; this helper inherits it deliberately rather than forking.

**Files touched:** `lib/sessionWindow.ts` (new), `app/api/livekit/token/route.ts`, `app/api/livekit/guest-token/route.ts`, `app/api/livekit/end-session/route.ts`, `app/api/livekit/mute-participant/route.ts`, `app/api/livekit/mute-all/route.ts`, `app/api/livekit/step-in/route.ts`, `app/session/[slug]/page.tsx`, `components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `components/session/sessionRole.tsx`, `components/session/RIMControlBar.tsx`, `components/session/EndMenu.tsx`, `components/session/ParticipantsPanel.tsx`, `components/session/RIMParticipantTile.tsx`. Commit `463f3bb`.

### A/V tuning pass — Krisp NC + per-profile video bitrate + Bell mode (session 122)

Real test feedback on the deployed Zoom-aligned room surfaced three reproducible issues: choppiness/freezing, fluctuating quality, and audio echo (one participant hearing their own voice from another participant's external speaker). The diagnosis: (1) Krisp Enhanced Noise Cancellation was installed in package.json (`@livekit/track-processors`) but never imported or wired up; (2) the publish bitrate ceiling of 2.5 Mbps for everyone overshot what residential WiFi could sustain and produced the layer-switch freezes; (3) participants without headphones cause echo loops that WebRTC's built-in AEC can't fully suppress.

**Krisp Enhanced Noise Cancellation, default-on.** Installed `@livekit/krisp-noise-filter@^0.3.4` to satisfy the peer-optional dep in `@livekit/components-react@2.9.20` (`^0.2.12 || ^0.3.0`). `RIMConference` now uses the React hook `useKrispNoiseFilter()` from `@livekit/components-react/krisp`. A ref-guarded effect calls `setNoiseFilterEnabled(true)` once on mount — the hook lazy-loads the Krisp WASM, creates the processor, and applies it to the local microphone track. State is component-local, so it resets to NC-on whenever the conference component remounts (every session join). `noiseFilterAvailable = krisp.processor !== undefined` is the "Krisp loaded successfully" signal; on unsupported browsers (older Safari, some Firefox configs) the hook logs a warn and the processor stays undefined — we use that to gate the Bell mode UI so it doesn't lie about NC state on a browser where NC isn't actually running.

**Bell mode — Co-host toggle.** A new "Bell mode" button in `RIMControlBar`, between Settings and the red End, visible only when `isCoHost && noiseFilterAvailable`. Default state: NC on, label "Bell mode" (subtle button, available action). Tapped state: NC off, label "Clean voice", amber tint (`--color-alert: #C8821A` at 22% alpha) — visually signals "you're in a mode" without the alarmist red of mic-off. Tapping calls `setNoiseFilterEnabled(!isNoiseFilterEnabled)`; `disabled={noiseFilterPending}` blocks double-taps during the swap. Use case: teacher rings a bell or strikes a singing bowl, and the bell tone needs to pass through with its full character — Krisp NC would treat it as background noise. State resets at every join so Bell mode is always a deliberate per-bell action, never a setting accidentally left on. Latency from tap to "other participants hear the change" is ~20 ms locally plus normal WebRTC publish/network — effectively instantaneous. `IconBell` Lucide-style SVG added to `ControlBarIcons.tsx`.

**Per-profile video bitrate ceilings.** Replaced the flat `maxBitrate: 2_500_000` with profile-driven values in `buildRoomOptions`: teacher 2.0 Mbps (matches Zoom Group HD), speaker 1.5 Mbps (Zoom HD), listener 1.0 Mbps (Zoom standard). All at 720p / 30 fps. Three explicit simulcast layers `[h180, h360, h720]` (was two: `[h180, h360]`) give the SFU a full adaptation ladder. Counter-intuitive but real: the previous flat 2.5 Mbps was *higher* than what residential WiFi could reliably sustain, which is why uplink saturation produced abrupt layer-switch freezes. Lowering the ceiling to per-tier values that the network actually sustains removes the freezes — the video quality is unchanged at the receiver because adaptiveStream + dynacast handle downscaling and uplink savings on top of the new ceiling.

**Greenroom "Headphones recommended" line.** Sangha-tone framing as care for others: "Headphones recommended — they keep your audio from echoing back to others." Placed near the device-permission disclosure, not stacked on top. Addresses the one echo case Krisp can't fully suppress — a participant with external speakers in an acoustically live room. `.gr-card__hint--headphones` modifier gives it slight extra top margin so it reads as its own thought.

**LiveKit Cloud tier correction.** Stack Reference had said "Ship tier ($50/month)" but we're on Build (`$0/mo + metered usage`). Daily.co was evaluated in this session as an alternative and rejected: ~$110/mo at RIM scale vs $0–50 on LiveKit, plus the rewrite cost of unwinding the custom-room architecture (three-tier permissions, magic-code auth, Greenroom/Recovery, host badges, HostAssignment integration). Decision committed; quality concerns are addressed by tuning passes, not platform changes.

**Reviewer sub-agent caught one real issue pre-commit:** on unsupported browsers, the hook silently no-ops and `isNoiseFilterEnabled` stays `false`, which would make the Bell mode button appear stuck in "Clean voice" amber state from the start (confusing because NC is off but not by user choice). Fixed by gating the button on `krisp.processor !== undefined` so it's hidden entirely when Krisp isn't actually loaded.

**Manual chapter `host-session-room` v5** (`prisma/update-manual-host-session-room.mjs`) adds a Bell mode section explaining the toggle in plain language plus a "Headphones are recommended" practical note under Getting into the room. Migration flag `update_manual_host_session_room_v5` in `prisma/migrate.mjs`.

**Files touched:** `package.json` + lockfile (krisp dep), `components/VideoRoom.tsx` (bitrate + simulcast + comment block), `components/session/RIMConference.tsx` (Krisp hook + default-on effect + prop wiring), `components/session/RIMControlBar.tsx` (Bell mode button + props), `components/session/ControlBarIcons.tsx` (IconBell), `components/session/Greenroom.tsx` (headphones line), `public/css/custom.css` (`.rim-cb-btn--bell-active`, `.gr-card__hint--headphones`), `prisma/update-manual-host-session-room.mjs` (v5 chapter content), `prisma/migrate.mjs` (v5 migration flag).

### Audit + Zoom-style tier model + ProgramTeacher backfill (session 124)

Jesse's first real test of the post-122 stack with a co-host (Nancy) surfaced echo (acoustic loopback through speakers on his side), pixelated video for the remote participant, and an apparent host-sync bug ("she claimed host but I didn't see her as Host"). The session began with a narrow read, then escalated into a full systematic audit when Jesse asked whether I'd actually audited the implementation. Five commits landed on `main` plus a backlog addition.

**The Step-In host metadata bug — root cause confirmed and fixed.** `/api/livekit/step-in` was creating its new token with `{ roomAdmin: true, canShareScreen: true }` but no metadata — so when the stepper-in reconnected, their LiveKit participant metadata was empty and the Host badge never rendered for other participants. Now mirrors the seedMeta pattern in `/api/livekit/token` (seeds `host: true` and the caller's avatarUrl), and an extended client-side effect in `RIMConference.tsx` broadcasts `host: true` via `setMetadata` as belt-and-suspenders for any race where the server seed doesn't land. Backlog item `2026-05-24-001` (stale-state propagation) is correspondingly closed in practice.

**Krisp lifecycle instrumentation.** The hook's internal Promise swallows errors silently — missing WASM, unsupported browser, mic-track race all fail invisibly. `RIMConference.tsx` now logs every state transition with the `[rim-krisp]` prefix (initial enable, processor available, mic-publication, attach verification at 500ms after publish, retry-on-miss, enable/disable transitions). The initial enable is wrapped in try/catch so a rejection surfaces in the console. An attach-verification effect subscribes to `RoomEvent.LocalTrackPublished`, waits 500ms, reads `track.getProcessor()` directly, and retries `setNoiseFilterEnabled(true)` once if the processor is loaded but not attached (gated on `!isNoiseFilterEnabled && !isNoiseFilterPending` to avoid spam on mute/unmute republish cycles). Logs are intentionally unconditional — they fire in production via Vercel for verification — to be removed once Krisp's runtime state is confirmed in real sessions.

**Local Krisp install drift surfaced.** `@livekit/krisp-noise-filter` was declared in `package.json` and `package-lock.json` but `npm ls` confirmed it wasn't installed in local `node_modules`. `npm install` pulled 52 packages that were missing despite the lockfile declaring them. Production deploys use `npm ci` against the lockfile so this was a local-only drift — but worth flagging because Krisp's runtime behavior is invisible without instrumentation, so a local-dev developer running this stack wouldn't know it wasn't loading.

**Zoom-style tier widening — Co-host net expands.** Old: Co-host = HOST_MANAGER OR ProgramTeacher OR Session Host. Plain HOST role on the host-team hub was Participant. New (session 124): Co-host = any of the above *or* any active host-team `HubMember` (`status="ACTIVE"` + `hostingCapability=true`). The mechanism is a consolidated single call: `getEffectiveHostingCapability(userId, "host-team", isManager || isProgramTeacher)` where the role-based grant is the fallback when no HubMember record exists. This restores the hub authority gate's ability to revoke Co-host even for roles — a coordinator can pause a HOST_MANAGER or ProgramTeacher via HubMember state and they correctly lose Co-host. The reviewer sub-agent caught my first-pass mistake (which bypassed the gate for managers/teachers) and the consolidated call was the fix.

**Three visible role pills.** `host` / `teacher` / `cohost` orthogonal flags in participant metadata. `host: true` ↔ `isSessionHost` (Host pill, teal — assignment-required as of 2026-05-26, no ADMIN bypass). `teacher: true` ↔ ProgramTeacher (Teacher pill, warm gold — distinct dharma identity). `cohost: true` ↔ Co-host capability AND not Host AND not Teacher (Host Volunteer pill, muted slate — renamed from "Co-host" 2026-05-26; metadata field name and CSS class kept stable). Constraint enforced server-side (token routes) and client-side (RIMConference metadata-seeding effect) so the two sources of truth can't drift. A Session Host who is also a Teacher renders both pills. The Host Volunteer pill only shows when neither of the other two applies, so each tile renders at most two pills.

**Pill rendering surfaces.** `RIMParticipantTile.tsx` renders the pills on each video tile next to the participant nameplate. `ParticipantsPanel.tsx` renders them on the local "Me" row (via a new `LocalRolePills` component using `useParticipantInfo({ participant: localParticipant })` for metadata-change reactivity) and on every remote-participant row. CSS in `public/css/custom.css`: `.rim-tile-nameplate__role-pill` with `--host` / `--teacher` / `--cohost` modifiers (higher opacity for tile readability on dark video); `.rim-pp__role-tag` with the same three modifier variants (lower opacity, brighter text for the participants panel's dark gray background).

**ProgramTeacher backfill.** The audit surfaced a pervasive miss: **13 of 16 active programs had no ProgramTeacher rows**. Every recurring host (Nancy on Awakening The Heart, Jesse on The Art of Meditation) was on the `speaker` audio profile (NS on, AGC on) instead of `teacher` (NS off, AGC off, bell-friendly). For Jesse hosting a meditation session: his bells were being filtered by the browser's native noise suppression *before* Krisp ever saw the audio — meaning Bell mode was wired up but functionally disabled by his audio profile. The audit script (`scripts/audit-program-teachers.mjs`) cross-references upcoming HostAssignments against ProgramTeacher rows and is reusable for future drift checks.

Five rows backfilled via a new `prisma/migrate.mjs` entry (`backfill_program_teachers_v1`): Jesse on Essential Dharma Study, Meditation and Dharma Talk, Private Teacher Meetings, The Art of Meditation; Maria Sprecher on Qigong at RIM. Also sets `Maria.isTeacher = true` so she appears in the public teacher directory at `/teachers/[slug]` (`scripts/lookup-teacher-users.mjs` was used to resolve names against the User table). The migration uses defensive `findFirst → create` so re-runs are no-ops, and aborts cleanly if either email lookup fails. Run against prod DB locally before push; verified by re-running the audit script.

Programs intentionally *not* backfilled (8 total): Good Morning / Good Evening Silent Meditation + Recovery Dharma (peer-led), the two Sangha Community Service entries (service events, not teaching), and Bookmarks & Breath + Nature Meditation KM Group + Our Hearts Were Made for This (named teachers — Gina Dundun, Sam/Kerry/Christine, Sara Neall — don't yet have RIM accounts; Jesse confirmed "those people aren't assigned a teacher role because they are not in the system yet, as we haven't gone live"). These will be addressed individually as the named teachers create accounts.

**Step-In reconnect timing fix.** The pre-existing handler set state to "loading" (which unmounts LiveKitRoom and starts disconnect) and then mounted the new token after exactly 100ms via `setTimeout`. The disconnect has to travel to LiveKit's servers and complete before the new connection can cleanly take its place under the same user identity. 100ms holds on most networks but races on slow ones — the artifact is a collision between the new connection arriving and the tail of the old one still being torn down. Replaced with a Promise that resolves when the LiveKitRoom's actual `Disconnected` event fires (via the existing `onLeave` callback path); `handleLeave` checks for a pending Step-In resolver ref before treating the disconnect as a real "user has left" event. 5-second safety timeout for the rare case where the event never lands.

**Backlog additions (session 124):**

- `2026-05-25-002` — **Per-program `teacherLabel` dropdown.** Add a nullable `Program.teacherLabel` field with a Program editor dropdown (Teacher / Guide / Facilitator / Instructor + custom). Threads through to token metadata and pill renderer. Mechanism stays the same; only the display string varies per program. Per-program chosen over per-hub (forces program→hub lookup; ambiguous when users are in multiple hubs) and per-user (doesn't handle people who play different roles for different programs).
- `2026-05-25-003` — **Silent Meditation Hub.** New Hub for peer-led offerings (Good Morning / Good Evening Silent Meditation, expandable to Recovery Dharma etc.). Self-claim + standing rotations reusing host-team infrastructure. Pairs with `2026-05-25-002` — hub solves "who's allowed to lead", label solves "what we call them when they do." Build order suggestion: teacherLabel ships first.

**Open design question parked.** Should the bell-friendly audio profile be granted to *any* Session Host, regardless of `ProgramTeacher` status? Would help Nancy on Awakening The Heart (currently `speaker` profile despite hosting a meditation) without needing per-program teacher rows for every host. Counter-argument: a non-teaching session host (e.g. a host coordinator running a logistics call) sounds better with NS on. Parked inside the Silent Meditation Hub backlog notes; resolve when one of the two items above is built.

**Files touched (session 124):** `app/api/livekit/step-in/route.ts`, `app/api/livekit/token/route.ts`, `app/session/[slug]/page.tsx`, `components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `components/session/RIMParticipantTile.tsx`, `components/session/ParticipantsPanel.tsx`, `components/session/sessionRole.tsx`, `lib/livekitAuth.ts`, `public/css/custom.css`, `prisma/migrate.mjs` (backfill_program_teachers_v1), `scripts/audit-program-teachers.mjs` + `draft-teacher-assignments.mjs` + `lookup-teacher-users.mjs` (new), `data/backlog.json` (two new items).

### Permission model — identity vs. capability (split 2026-05-26, evolved from session 121 / 124)

The pre-2026-05-26 model used a single `isSessionHost` flag for both identity (who is the assigned steward) and capability (who can do which actions), with an ADMIN bypass that conflated the two. The 2026-05-26 audit and refactor split them. `lib/livekitAuth.ts::resolveSessionRole(userId, programSlug, sessionDate, roles)` now returns `{ isSessionHost, hasEndAllAuthority, isCoHost, isHostTeam, isProgramTeacher }`. Every server route that gates a session-room action uses this helper (no inlined role checks).

**Identity — three pills:**

- **Host** (singular) — `HostAssignment` for this exact session. **No role bypass.** Drives the "Host" pill on the participant's tile (seed metadata `host: true` keyed on `isSessionHost`). An ADMIN or GUIDING_TEACHER visiting a session they didn't sign up to host does *not* show this pill — that label is identity, not capability.
- **Teacher** — `ProgramTeacher` row for this program. Layered on top of Host if the same person holds both (both pills render side-by-side). Drives the bell-friendly `teacher` audio profile.
- **Host Volunteer** (renamed from "Co-host" 2026-05-26 — metadata field name `cohost` and CSS class `--cohost` kept stable for stability) — Co-host capability AND not Host AND not Teacher. Catches host-team `HubMember` records (active + hostingCapability), `HOST_MANAGER`, ADMIN, GUIDING_TEACHER. Pill text is "Host Volunteer" in the UI.

A tile renders at most two pills (Host + Teacher); never three.

**Capability — what each button does:**

- **End-for-All** (gated by `hasEndAllAuthority`) — held by assigned Host OR ADMIN OR GUIDING_TEACHER OR (Teacher when no `HostAssignment` exists for this session — the teacher-fallback rule, new). Drives the End button label ("End" vs. "Leave"), the EndMenu's "End for all" option, and the server gate at `/api/livekit/end-session`. Reactive at token-issue only; the server re-runs `resolveSessionRole` on every `/end-session` call as the authoritative gate. The teacher-fallback handles the "Maria teaches alone" and peer-led-community-sit cases without forcing a Step-In first.
- **`isCoHost`** (drives mute-others / Mute All / Bell mode toggle / per-tile hover mute / Participants management / Share Screen) — held by anyone with a pill: Host, Teacher, or Host Volunteer. ADMIN bypass. **Share Screen was extended from Session-Host-only to all Co-hosts (2026-05-26)** — closes a latent bug where Host Volunteers saw the share button but the token didn't grant the source.
- **`isHostTeam`** (drives Step-In visibility) — host-team `HubMember` (active + hostingCapability) OR HOST_MANAGER OR ADMIN, when not the assigned Host. As of 2026-05-26 ADMIN-without-assignment sees the Step-In button (since they no longer auto-grant Host identity); tapping it writes a real `HostAssignment` and creates an audit trail.
- **Participant** — everyone else, including guests. Token grant: `canPublishSources: [MICROPHONE, CAMERA]` only. No screen share even if they bypass the UI. UI doesn't draw Share / Mute-others / End-for-All buttons. No pill.

`createRoomToken` signature: `(userId, userName, roomName, permissions: { roomAdmin, canShareScreen }, metadata?)`. The previous `(isHost: boolean)` form was removed entirely. `canShareScreen` was widened from `isSessionHost` to `isCoHost` in the 2026-05-26 refactor.

A small `SessionRoleContext` (`components/session/sessionRole.tsx`) provides `{ isSessionHost, isCoHost, programSlug, localIdentity }` to descendants of `RIMConference` so the tile component can read the tier without prop-drilling through LiveKit's GridLayout (which re-mounts children and doesn't accept arbitrary props). `hasEndAllAuthority` is consumed only by `RIMControlBar` and `EndMenu` (not by tiles), so it's passed as a direct prop rather than through the context. `localIdentity` is `string | null` — consumers must check truthiness before comparing (prevents a one-frame race where a Co-host could otherwise self-mute via the server path).

**Why the split.** The pill is identity; the button is capability. An ADMIN visiting a session retains End authority as a safety override, but doesn't misrepresent themselves as the assigned host. A teacher teaching alone gets End naturally via the fallback, but their tile still shows Teacher (which is what they actually are). Host volunteers helping out have full mute/share/Bell-mode capability — but they're labeled Host Volunteer, because the formal Host of this session is someone else. The pre-split single-flag model surfaced as the bug Jesse reported: joining as ADMIN with no assignment showed the Host pill on every session, defeating the "Session Host (singular)" design.

**Files touched in the rewrite:** `lib/livekitAuth.ts` (new), `lib/livekit.ts`, `components/session/sessionRole.tsx` (new), all five `/api/livekit/*` routes (token, step-in, guest-token, mute-participant, mute-all, end-session), `app/session/[slug]/page.tsx`, `components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `RIMControlBar.tsx`, `RIMParticipantTile.tsx`, `EndMenu.tsx`, `ParticipantsPanel.tsx`, `app/admin/livekit-test/page.tsx`.

### Emergency Host Step-In

**What it does:** If the assigned host can't make it and there's no time for a normal sub request, any host-team member (HOST, HOST_MANAGER, or ADMIN) can claim host controls mid-session.

**How it works:**
1. Host-team member joins the session from the dashboard like any other member
2. They see a green "Step in as Host" button in the session header bar
3. They click it — brief reconnect (1-2 seconds) — they now have full Session-Host controls
4. The button disappears once they have host status
5. The system records "Emergency step-in by [name]" in the HostAssignment notes for coordinator visibility

**Who sees the button:** Anyone whose `resolveSessionRole().isHostTeam` is true and who isn't already the Session Host for this session. Regular members never see it.

**Key files:** `app/api/livekit/step-in/route.ts`, `app/session/[slug]/page.tsx`

🔧 **Technical notes:** The step-in API upserts the HostAssignment (@@unique on [programSlug, sessionDate]), generates a new JWT with `roomAdmin: true` + `canShareScreen: true` (Session-Host grant), and returns `{ isSessionHost: true, isCoHost: true }` alongside the token. The client cycles state to force a LiveKit reconnect with the new token. The token API also returns `isHostTeam` so the page knows whether to show the Step-In button. **Stale-state after sequential step-ins** is a known limitation (backlog item `2026-05-24-001`): earlier steppers keep `isSessionHost: true` in stale client state and may see End-for-All; the server is authoritative and rejects them with 403.

### Three-Way Audio Profile (session 117)

The previous host-vs-non-host audio split was replaced with a three-way profile axis derived in the token route:

- **teacher** — used for anyone in `ProgramTeacher` for this program. Preserves bells, singing bowls, music. `echoCancellation: true`, `autoGainControl: false`, `noiseSuppression: false`, `audioPreset.maxBitrate: 128_000`.
- **speaker** — host who isn't teaching (e.g. supporting a session). Clean speech profile, all three processing flags on. `audioPreset.maxBitrate: 96_000`.
- **listener** — everyone else. Clean speech profile. `audioPreset.maxBitrate: 64_000`.

DTX (discontinuous transmission) is OFF for all profiles — the bandwidth savings during silence weren't worth the audible speech-edge artifacts. Default audio bitrate in LiveKit is ~20 kbps; bumping every profile gives a clearly perceptible "this voice sounds full, not phone-call thin" improvement at trivial bandwidth cost.

The token route returns `audioProfile` (the previous `needsHiFiAudio` boolean was dropped — it was being shadowed by the page only reading `isHost`, which meant teachers who weren't the assigned host got the wrong audio profile).

### Video: H.264 + Explicit Bitrate Caps (session 117)

Codec switched from VP8 to H.264 — the same codec Zoom uses. Universal hardware encode/decode (no CPU spike on older laptops or phones); visibly cleaner than VP8 at the same bitrate. Explicit `videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }`. Simulcast layers stay `[h180, h360, h720]` for adaptive downgrade on lossy networks.

### Zoom-aligned redesign (session 117)

The visual / behavioral language of every session-room surface was reshaped to mirror Zoom's information architecture. The goal: Sangha members transitioning from Zoom shouldn't have to wrap their minds around a new model. Where our pattern and Zoom's differed, Zoom won (unless `RIM_Web_Design_Philosophy.md` had a stronger reason).

**Control bar (`RIMControlBar`).** Bottom-center, dark, icon-stacked-over-label compact buttons (~64×52). Order LTR: `Mute` `Start Video` (each as a cluster: main toggle + thin divider + chevron) → `Participants` `Chat` → `Share Screen` `Reactions` `Settings` → spacer → red `End` button. All icons are inline Lucide-style line SVGs at 20×20 with 2px stroke (no emoji — emoji rendered inconsistently across OSes). Off-state mic/camera tint red via `currentColor`.

**Device pickers.** Mic and camera chevrons open upward popovers (`DevicePickerMenu`) listing `MediaDeviceInfo` for the appropriate kind, marking the active one, and live-swapping via `room.switchActiveDevice()`. Preferences persist in `localStorage` under `rim-livekit-prefs`. Settings panel grew matching Audio + Video sections so the deeper home is consistent.

**Reactions popover (`ReactionsMenu`).** Replaces the standalone top-of-room `NonverbalToolbar`. Opens upward from the Reactions button. Five signals (✋ ❤️ 🙏 ✓ ✗); hand persists until toggled, others auto-clear after 5s. "Lower hand" item appears when hand is raised.

**End popover (`EndMenu`).** Red End button opens an upward popover. Anyone with `hasEndAllAuthority` sees `End Meeting for All` (red) + `Leave Meeting`; everyone else sees just `Leave Meeting`. The button label itself reads "End" vs. "Leave" based on the same flag. Server endpoint (`/api/livekit/end-session`) is the security boundary; the popover is the UX boundary. Session 121 tightened both sides; the 2026-05-26 split refined further: identity (Host pill) is separate from capability (End-for-All). End-for-All is held by Assigned Host + ADMIN + GUIDING_TEACHER + Teacher-when-no-host. Both UI and server use the same `resolveSessionRole` helper; no "button visible but click silently fails" failure modes.

**Speaker / Gallery view toggle (`ViewToggle`).** Segmented control top-right of the page header. Gallery default. Speaker view auto-pins active speaker via `useSpeakingParticipants` with a ref-gated effect to avoid per-render thrash. Preference persists in `localStorage` under `rim-livekit-view`.

**Page header trim.** Was: Leave / Step-In / Mute All / End for All / Fullscreen / Help. Now: Step-In (left, host-team only) / program name (center) / View toggle + Fullscreen + Help (right). The removed buttons moved to their Zoom-equivalent locations — Mute All to Participants panel footer, Leave + End for All into the control bar's End popover.

**Participants panel.** Sticky local "Me" row at the top with `(you)` tag and the same three role pills as remote tiles (Host / Teacher / Host Volunteer — keyed on the local participant's reactive metadata so a Step-In or other mid-session role change reflects immediately). Search box at >10 participants. Per-row mute / `Muted` pill for Co-hosts. Footer Mute All for Co-hosts. **Numbered speaking queue** (2026-05-26): hand-raised rows float to the top in raise order (ascending `raisedHandAt` epoch ms) with a "1 ✋", "2 ✋", "3 ✋" prefix so the host can call on people in raise order without parsing timestamps. Same sort the grid uses (single source of truth). Local participant included in the queue. Re-renders driven by `TrackMuted/Unmuted/Published/Unpublished` from `useRemoteParticipants` updateOnlyOn config.

**Custom chat (`RIMChat`).** Replaces LiveKit's stock `<Chat />` (broadcast-only, in-memory). New `SessionChatMessage` Prisma model + `/api/livekit/chat` (GET + POST). On mount, fetches up to 100 prior messages so new joiners and post-refresh users see history. Live via `room.localParticipant.publishData(payload, { destinationIdentities, reliable: true, topic: "rim-chat" })`. Recipient picker above compose: default "Everyone," select a name → private DM. Private messages render with a teal left border and `(private)` tag. Server-side filtering on read so DMs only return to sender + listed recipients. Guests authenticate via `guestKey + guestIdentity` for chat writes.

**Custom tile (`RIMParticipantTile`).** Hides LiveKit's default name bar; renders our own Zoom-style nameplate (white text bottom-left with text-shadow, no pill background; small red mic-off SVG only when muted; up to two role pills following the name in priority Host → Teacher → Host Volunteer). Active-speaker 3px yellow outline via `useIsSpeaking`. 8px rounded corners. **Hover mute (session 121):** when the viewer is `isCoHost`, hovering any remote tile reveals a red "Mute" button top-right; if the participant is already muted, a "Muted" pill appears in the same spot instead. Suppressed on the local tile and until `localParticipant.identity` is bound. Calls the existing `/api/livekit/mute-participant` endpoint. Desktop affordance; mobile / touch hosts use the Participants panel for the same action. **Raised-hand reordering** (2026-05-26): when `signal === "hand"`, the tile's parent (`RIMConference`) sorts it to the top-left of the grid in ascending `raisedHandAt` order. Tile is not enlarged — the reordering itself is the focus mechanism, matching how Zoom solves this. Speaker view filmstrip reorders the same way; the focus pin still tracks active speakers, not hand-raisers.

**Initials avatar fallback.** When a participant has video off and no presence photo, renders an initials circle (first letter of first + last name token) on a deterministic muted color hashed from identity — pattern matches Slack / Google Meet / Zoom. LiveKit's generic gray silhouette is hidden unconditionally. Sized to the shorter tile axis via `min(40cqh, 240px)` so it stays circular at any aspect ratio.

**Chrome always visible (session 121, was: auto-hide).** Earlier sessions had a 3-second idle timer that faded the top header and bottom control bar (`.vs-page--idle` class + a `:has()` override matrix to re-show when any panel was open). Removed entirely after a volunteer test surfaced the disappearing UI as confusing. The bottom bar is shallow enough that always-visible costs no usable real estate. Tile nameplates and the raised-hand banner were always visible and remain so.

**Pure-black background.** Conference root background changed from `#111` to `#000` to match Zoom's depth.

**Host-tag trust note.** `host: true` in participant metadata is a UI cue, not a security boundary. `canUpdateOwnMetadata: true` on the token grant means a client could technically rewrite their own metadata. Real host actions (mute, end-for-all) are gated server-side via `auth() + role + HostAssignment + ProgramTeacher` lookup — not via this flag. Documented in the token route. If a non-spoofable Host indicator is needed later, route avatar/signal updates through a server-side `RoomServiceClient.updateParticipant` endpoint.

### Greenroom + Recovery — Permission-safe join flow (session 119, 2026-05-21; platform-aware instructions session 120, 2026-05-23)

**Problem solved:** the browser's camera/microphone permission prompt fires every time a user joins the session room. On Safari (Mac and iOS) the prompt fires *every session* by default — Apple's per-session permission model means clicking "Allow" doesn't persist unless the user has explicitly set the per-site permission to "Allow" via Safari → Settings for This Website. Worse, panic-clicks of "Never for this Website" (the third option in Safari's prompt) silently and permanently break the user with no in-app recovery path. A real testing incident triggered this work.

**Greenroom (`components/session/Greenroom.tsx`).** Pre-prompt screen that primes the user *before* the browser asks. Single dominant Continue button. Body: "In a moment, your browser will ask to use your camera and microphone. Please click **Allow** when prompted." Includes an inline "Tired of seeing this? Set Safari to remember →" affordance — shown only for browsers that default to per-session permission (Safari on macOS, iOS, iPadOS). The disclosure body matches the user's actual device: menu bar → "Settings for This Website…" on macOS, `AA` icon → "Website Settings" on iOS, `ᴬA` icon → "Website Settings" on iPadOS. Hidden entirely on Chrome / Edge / Firefox where permission persists by default — keeps the priming card calm for the majority case.

**Recovery (`components/session/Recovery.tsx`).** Denial-state screen reached when Permissions API returns `'denied'` on Greenroom mount or the Continue click throws `NotAllowedError` / `NotReadableError` / `NotFoundError`. The primary view is matched to the user's detected browser+OS — no fallback disclosure, no "Using a different browser?" toggle. Cases handled: Safari macOS / iOS / iPadOS (per-device steps), Chrome+Edge desktop (camera/padlock icon at left of address bar), Chrome Android (padlock → Permissions), Firefox (shield/padlock icon), unrecognized (generic prose). The Refresh button is the only action because Safari's Permissions API does not reliably re-query state after a Settings change without a page reload.

**Platform detection (`lib/detectPlatform.ts`, session 120).** Shared client-only helper returning `{ browser, os }` plus a `defaultsToPerSessionPermission(platform)` predicate. UA-based, best-effort. iPadOS-13+-reports-as-Macintosh handled via `"ontouchend" in document`. iOS browser wrappers (Chrome / Firefox / Edge on iOS, identified by `CriOS` / `FxiOS` / `EdgiOS` UA tokens) routed to `ios` before the Macintosh+touch branch so they don't get misclassified as iPadOS. Brave hides itself in modern UAs and is classified as Chrome — identical address-bar permission affordance. Misidentifications are accepted as rare; unrecognized platforms hit the generic-prose fallback. No safety-hatch disclosure on the UI (decided session 120 — adding it for everyone reintroduces the noise the matched-view structure was meant to remove).

**Phase machine in `VideoRoom`.** `<LiveKitRoom audio={false} video={false}>` mounts immediately with the token; connection happens in the background. `phase` state cycles `greenroom → conference` (on Continue + successful publish) OR `greenroom → recovery` (on permission denial). The phase logic lives inside VideoRoom; the page (`/session/[slug]`) state machine is unchanged.

**The iOS Safari user-gesture constraint shapes the architecture.** `setMicrophoneEnabled(true)` and `setCameraEnabled(true)` must be called synchronously from the click handler — iOS Safari requires the user-gesture chain to survive without `await` between the click and the LiveKit call. Continue handler uses `Promise.all([setMicrophoneEnabled(true), setCameraEnabled(true)])` so both calls fire before any await. Greenroom is a child of `<LiveKitRoom>` precisely so the click handler has `useLocalParticipant()` available; the room is already connected by the time the user clicks. The Continue button is disabled with label "Connecting…" while `connectionState !== ConnectionState.Connected`.

**Auto-skip only on confirmed-granted state.** Greenroom checks `navigator.permissions.query({ name: 'camera' })` and `microphone` on mount. If BOTH report `'granted'`, attempts a direct publish from a `useEffect` (allowed because permission is already granted — no prompt fires). For any other state (`'prompt'`, `'unsupported'`, `'denied'`), the manual Greenroom UI shows. The initial implementation included a speculative auto-publish path for users with a localStorage `joined-before` flag; this was removed in `8577348` because on Safari (per-session `'prompt'` default) it caused the browser prompt to fire from a non-gesture context, reproducing the exact bare-prompt experience the Greenroom was built to prevent. Lesson: speculative permission attempts from non-gesture contexts are unsafe on Safari.

**Error mapping (post-publish):**
- `NotAllowedError` → Recovery (user clicked Don't Allow or Never)
- `NotReadableError` → Recovery (camera/mic in use by another app, e.g. Zoom open)
- `NotFoundError` → Recovery (no device; copy mentions hardware in passing)
- Unknown → returns to manual Greenroom UI as a last resort

**Step-in mid-session caveat.** The host emergency step-in flow cycles `loading → ready` on the page state, which remounts VideoRoom. Greenroom mounts fresh, detects `'granted'` (the host just had permissions a moment ago), auto-publishes silently, transitions to conference. User-visible result: a sub-second "Connecting…" silent card during step-in. Accepted for v1.

**Why no listen-only / no in-room recovery toast / no per-browser instruction blocks.** All considered, all deferred. The proportional spec is Greenroom + Safari-focused Recovery. Backlog items if real users hit them.

**CSS:** `gr-` prefix in `public/css/custom.css`. Local CSS custom properties (`--gr-bg`, `--gr-text`, `--gr-text-dim`, `--gr-text-mute`, `--gr-link`, `--gr-link-hover`, `--gr-panel-bg`) scope the dark-surface palette to this block. Tokens (`--font-serif`, `--text-h1`, `--text-body`, `--lh-body`) used everywhere else. Mobile breakpoint at 430px tightens spacing and drops the headline to `--text-h2`. 48px CTA min-height, 44px secondary toggle min-height (touch target rule). `z-index: 10` so it covers the LiveKit room layout reliably.

**🔧 Permission-state caveat for Safari.** Safari's Permissions API was historically unreliable for `camera` and `microphone`. Recent Safari (16.4+) reports `'granted'` correctly when the user has set persistent Allow via Settings for This Website. Older Safari may return `'unsupported'`. In the unsupported case, Greenroom shows the manual UI; user clicks Continue; if Allow is set, the publish succeeds silently (no prompt). One extra screen but no prompt. Acceptable.

### Three-stage host privileges

Host privilege is computed in the token route from any of:

- `ADMIN` role
- `HOST_MANAGER` role
- `HostAssignment` for this program + sessionDate
- `ProgramTeacher` for this program

Then run through `getEffectiveHostingCapability(userId, "host-team", tentativeHost)` for hub-membership authority (a paused HubMember overrides). For host emergency step-in, see "Emergency Host Step-In" above.

### 🔜 Phase 6: Session Recording (Pressing — Not Yet Built)

**Goal:** Automatically record dharma talks for a community library that builds itself from live sessions.

**Two-track audio recording:**
1. **Teacher track** — isolated high-fidelity audio (the dharma talk, bells, music). Already high-fidelity thanks to the audio settings above.
2. **Room composite** — all participants mixed together (captures Q&A context). Private — never published, used only by the teacher/editor for context while editing.

**Workflow:**
- Recording starts automatically when the session begins (or teacher clicks "Record my talk")
- Two audio files saved to Vercel Blob when session ends
- Files appear in teacher's account or teacher hub under "My Recordings"
- Teacher/editor reviews, edits, and optionally publishes the teacher track to a lesson page
- Room composite auto-deleted after a configurable retention period (e.g., 90 days)

**Consent approach:**
- Add one line to community agreements: "Sessions may be recorded for our dharma library."
- Show a quiet banner in the session header: "This talk is being recorded" (informational, no opt-in required)
- Community agreements already accepted by all members at join time

**Estimated cost:** Under $10/month for 4 sessions/week (audio-only egress is cheap). Teacher track ~58MB/session, room composite similar. ~3.7GB/month total storage.

**Technical approach:** LiveKit Track Egress API (individual track recording for teacher, room composite for everyone else). Files upload directly from LiveKit to Vercel Blob (S3-compatible). Webhook notification triggers database update linking recording to program/lesson.

**Prerequisites:** Community agreements update, Recording/Lesson model linking, teacher hub "My Recordings" UI, audio player on lesson pages (already exists).

### Session Room UI — current state (post-session-117 Zoom-aligned redesign)

See "Zoom-aligned redesign" above for the current detailed inventory. Below is the pre-117 Phase 4 record kept for historical context.

#### Pre-117 baseline (session 86 Phase 4 — superseded by Phase 5)

Custom `RIMConference` layout replacing LiveKit's default `VideoConference`. Grid / Focus layout, chat sidebar, top-toolbar with nonverbal signals + Participants + Chat + Settings, raised-hand banner, presence photos, participants panel (host-only), dark header, audio playback prompt for Safari, participant names. **Most of this was reshaped in session 117** — the top toolbar is gone (those buttons live in the bottom control bar now), the nonverbal toolbar was consolidated into a Reactions popover, the participants panel is no longer host-only (non-hosts see roster), and the chat is custom-built with persistence + DMs.

### Who uses it

- **Members** — join virtual sessions from their dashboard via embedded VideoRoom (no external links or accounts needed)
- **Hosts** — receive `roomAdmin` permission in the JWT token, granting moderator controls (mute all, per-participant mute, end session, participants panel)
- **Admins** — test page at `/admin/livekit-test` for verifying room creation and connectivity

### Architecture

Rooms are created on-demand from the program slug (e.g., `thursday-evening-meditation`). LiveKit Cloud (Build plan, free) handles all media infrastructure. The token API generates short-lived JWTs with identity, room name, metadata (avatar), and grants (including `roomAdmin` for hosts). No room pre-provisioning needed — rooms exist when the first participant joins and are cleaned up automatically.

### Key files

| File | Purpose |
|---|---|
| `lib/livekit.ts` | LiveKit server SDK setup, `createRoomToken()` helper (identity, room, grants, metadata) |
| `app/api/livekit/token/route.ts` | POST — generates LiveKit JWT; validates auth, resolves host status, seeds avatar into token metadata |
| `app/api/livekit/mute-all/route.ts` | POST — server-side mute all participants via RoomServiceClient |
| `app/api/livekit/mute-participant/route.ts` | POST — server-side mute individual participant |
| `app/api/account/avatar/route.ts` | PATCH — save/clear avatar URL for current user |
| `components/VideoRoom.tsx` | LiveKitRoom wrapper — audio-profile-based capture config, H.264 video, loads livekit-prefabs.css, renders RIMConference |
| `components/session/RIMConference.tsx` | Custom conference layout: grid (Gallery) / focus (Speaker), raised-hand banner, chat sidebar, view-mode auto-pin, audio prompt |
| `components/session/RIMParticipantTile.tsx` | Custom tile: avatar / initials fallback, Zoom-style nameplate, active-speaker outline, signal badge |
| `components/session/RIMControlBar.tsx` | Bottom Zoom-style control bar: mic/cam clusters with device chevrons, Participants/Chat/Share/Reactions/Settings/End buttons |
| `components/session/ControlBarIcons.tsx` | Lucide-style SVG icon set for the control bar |
| `components/session/DevicePickerMenu.tsx` | Upward popover from mic/cam chevrons — device list, live-swap via `room.switchActiveDevice()`, localStorage prefs |
| `components/session/ReactionsMenu.tsx` | Upward popover from Reactions button — five RIM signals; replaces the deleted `NonverbalToolbar` |
| `components/session/EndMenu.tsx` | Upward popover from red End button — host: End-for-All + Leave; non-host: Leave |
| `components/session/ViewToggle.tsx` | Segmented Speaker | Gallery toggle in page header, localStorage persistence |
| `components/session/ParticipantsPanel.tsx` | Slide-in roster: sticky Me row, Host pills, raised-hands-first sort, per-row mute (host), Mute All footer, search at >10 |
| `components/session/RIMChat.tsx` | Custom chat: history seed via GET, live via data channel, recipient picker for DMs, server-filtered reads |
| `components/session/VideoSettingsPanel.tsx` | Settings: Audio + Video device sections, presence photo |
| `app/api/livekit/chat/route.ts` | GET (history, DM-filtered) + POST (persist + dedup) for `SessionChatMessage` |
| `components/VideoRoomEmbed.tsx` | Dashboard embed wrapper — join button → inline VideoRoom with fullscreen toggle |
| `app/session/[slug]/page.tsx` | Dedicated session page: auth/guest flows, header (Step-In / name / view-toggle + fullscreen + help), auto-hide chrome on idle |
| `app/admin/livekit-test/page.tsx` | Admin-only test page for verifying LiveKit connectivity and room creation |

### Technical notes

- **Token grants:** All participants get `canPublish`, `canSubscribe`, `canPublishData`, `canUpdateOwnMetadata`. Hosts receive `roomAdmin: true`. Guest tokens get participant-level access only.
- **Avatar in JWT metadata:** `createRoomToken()` accepts optional `metadata` param. Token API queries User.avatarUrl and passes `JSON.stringify({ avatarUrl })` into the token. Eliminates the client-side race condition of trying to `setMetadata()` before the participant is fully connected.
- **trackRef.participant pattern:** GridLayout provides TrackRefContext but NOT ParticipantContext. Custom tile components must use `trackRef.participant` to get the participant object, not `useMaybeParticipantContext()` (which returns null in this context).
- **Room naming:** Room name = program slug. Deterministic — same program always maps to same room.
- **LiveKit Cloud Build plan:** Free tier. Sufficient for RIM's current virtual program volume.

### New env vars

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_API_KEY` | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | LiveKit Cloud API secret |
| `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud WebSocket URL (e.g., `wss://rim-xxxx.livekit.cloud`) |

---

## 39. Open Access — Guest Join for Virtual Programs

### What it does

Allows non-members to join virtual sessions without a RIM account. Designed for collaboration programs (e.g., co-offered with the Christine Center) where the teacher opens the session to participants from another community.

### How it works

1. **Admin/Registrar** enables "Open Access" on a virtual or hybrid program in Program Editor → Schedule & Location tab
2. System auto-generates a `guestAccessKey` (12-char hex string) and displays a shareable guest link
3. Teacher shares the link with external participants (email, another center's website, etc.)
4. **Guest** visits `/session/[slug]?key=xxx` → enters their name → joins the LiveKit room as a participant
5. Guest gets full audio/video but no host controls (can't mute others, remove participants, or end the session)
6. **Key reset** invalidates old links immediately — useful when a link leaks or a new session cycle starts

### Key files

| File | Purpose |
|---|---|
| `app/api/livekit/guest-token/route.ts` | POST — validates guestKey, mints participant-level LiveKit JWT (no auth required) |
| `app/api/programs-pg/[slug]/guest-key/route.ts` | POST — resets guestAccessKey (REGISTRAR/ADMIN) |
| `app/session/[slug]/page.tsx` | Detects `?key=` param, shows name entry form for guests |
| `components/registrar/ProgramEditor.tsx` | Open Access toggle, guest link display with Copy/Reset |

### 🔧 Technical notes

- `isOpenAccess Boolean @default(false)` and `guestAccessKey String?` on Program model
- Guest identity format: `guest-{timestamp}-{random}` — distinguishable from member user IDs in LiveKit participant list
- Guest tokens use `createRoomToken()` with `isHost: false` — same function as member tokens, just never elevated
- No attendance tracking for guests (no user record to link to)
- The teacher must have a RIM member account to get host controls

---

## 40. ProgramTeacher — Linked Teacher Accounts

### What it does

Links teachers to programs via actual user accounts instead of plain text names. Teachers assigned to a program automatically receive host controls in LiveKit sessions — no separate HostAssignment needed.

### How it works

1. **Admin** enables teacher attribution on a member's profile (Admin → Members → Teacher Attribution section)
2. **Registrar/Admin** assigns the teacher to a program via the search selector in Program Editor → Content tab
3. Teacher's name displays on the public program page and links to their `/teachers/[slug]` profile (if public)
4. When the teacher joins a virtual session, the LiveKit token route detects their ProgramTeacher record and grants `roomAdmin: true`

### Key files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `ProgramTeacher` model (programId, userId, order) |
| `app/api/livekit/token/route.ts` | Checks ProgramTeacher for host grant |
| `app/api/members/search/route.ts` | Teacher search (now also allows REGISTRAR access) |
| `components/registrar/ProgramEditor.tsx` | Teacher search selector with tags |
| `app/programs/[slug]/page.tsx` | Public program page — teacher names link to profiles |

### 🔧 Technical notes

- `ProgramTeacher` mirrors `LessonTeacher` pattern — join table with `order` field for display ordering
- `teacherFacilitators String[]` (plain text) kept as fallback for existing programs not yet migrated to linked accounts
- Display pages check `programTeachers` first, fall back to `teacherFacilitators` for backward compatibility
- Host control priority in LiveKit token route: ADMIN → HostAssignment → HOST_MANAGER → ProgramTeacher
- Multiple hosts supported simultaneously (teacher + host volunteer) — LiveKit `roomAdmin` is not exclusive

---

## 41. Program Editor — Design Pass + Editor Standardization ✅ Built — session 82 (2026-04-14)

### What it does

A visual and interaction design pass across all seven Program Editor tabs, fixing three categories of issues: inconsistent exclusive-choice UI (radio buttons → option cards), broken/inconsistent rich text editor styling throughout the codebase, and a sloppy guest link display in the Schedule tab.

### Option cards (`pe-option-cards`)

Four fieldsets converted from plain radio buttons to card-based selectors:

| Field | Options |
|---|---|
| `programFormat` | In-person / Virtual / Hybrid |
| `venue` | At RIM / Other location |
| Recurrence | One-time / Daily / Weekly / Monthly |
| `danaMode` | None / Voluntary / Base + Dana / Fixed |

CSS classes: `.pe-option-cards` (flex row), `.pe-option-card` (individual card), `.pe-option-card--selected` (blue ring + bg tint). Selected state driven by React state (JS class toggle), not CSS `:checked` — the radio input is hidden (`position: absolute; opacity: 0`). Mobile: cards stack to column layout at 430px.

### Registration tab — visibility-card toggles

"Registration enabled" and "Registration closed" checkboxes converted to `pe-visibility-option` card pattern (same as Visibility tab toggles). `<hr className="pe-section-divider">` separates status controls from capacity/deadline fields.

### Rich text editor standardization (global)

Fixed three categories of CSS bugs affecting editors throughout the codebase:

1. **Double-box bug** — `.bn-container` (inner BlockNote div) was receiving border/background, creating a visual border inside the outer `rim-prose-editor` border. Fixed: outer wrapper gets `border: 1px solid var(--rim-rule); border-radius: 8px; overflow: hidden`, inner `.bn-container` gets `border: none; background: transparent`.

2. **Broken selector** — `.rim-prose-editor-wrap` doesn't exist; real class is `.rim-prose-editor`. Fixed in `.th-card` (CourseEditor/LessonEditor) and `.vol-detail__notes-wrap` (VolunteerTable).

3. **Global font inheritance** — `rim-prose-editor .bn-editor` now explicitly sets `font-size: 15px; line-height: 1.65`. Without this it inherits 18px body text.

**Borderless embedded contexts** (no outer border needed — they live inside a pre-styled container): `si-composer__editor`, `hub-conv-reply-form`, `hub-conv-post__edit`, `hub-home__edit-panel`, `hub-tasks-detail__body` — all get `border: none; border-radius: 0; background: transparent` on `rim-prose-editor`.

### Guest link redesign (Schedule tab)

Replaced CSS class–based layout with pure inline styles (immune to global `button` style cascade). Design: warm parchment card (`#f5f3f0`) with left blue accent border, full-width `<input readOnly>` for the URL (click to select all; `flex: 1; min-width: 0` for truncation), Copy button that turns green on success, Reset action as inline text link.

**CSS lesson learned:** global `button { background; color }` rules override class-based rules at the same or lower specificity — inline styles are immune to this and are the correct approach for one-off widgets that aren't meant to be a reusable component.

### Help link in editor header

`? Help` button added to ProgramEditor header alongside "View program page →". Links to `/admin/manual#program-editor` in a new tab. Styled as `pe-btn pe-btn--ghost pe-btn--small`, 13px, `var(--rim-mid)` color.

### Key files

| File | Change |
|---|---|
| `components/registrar/ProgramEditor.tsx` | Option cards, Registration toggles, Dashboard section, guest link inline styles, Help link |
| `public/css/custom.css` | Option card CSS, editor standardization rules, global font fix, broken selector fixes |
| `prisma/seed-manual-program-manager.mjs` | Full 7-tab manual rewrite with all current features |
| `prisma/migrate.mjs` | Migration flag bumped to `seed_manual_program_manager_v3` |

### Bug fixes (session 83, 2026-04-15)

**Schedule Label / Time Label not auto-updating:** Effects were guarded with `if (!dateText)` — labels only regenerated when blank. Fixed with `dateTextDirty` / `timeTextDirty` flags. Flags initialize by comparing stored label to what the compute functions would produce (match = auto-managed; differ = manual override). Recurrence controls (freq, days, interval) and date pickers explicitly reset the flag so labels always update when those settings change. Typing in the label field sets dirty = true; clearing resets it.

**`dashboardShowAt` timezone:** PUT and POST routes used `new Date(body.dashboardShowAt)` — Node.js treats bare ISO strings as UTC, causing a 5–6 hour offset. Fixed to `centralToUtc()` consistent with all other datetime fields.

### Schedule Label / Time Label — drift fix (session 109, 2026-05-07)

Followup to the session 83 work: the `dirty` mechanism still drifted for any program saved more than once. The editor wrote the auto-computed value back to the DB on save; on next load, `stored == computed` at save time, but later (after a `startDatetime` change) `stored != computed`, falsely tripping the dirty check and freezing the label at the value it had at first save. Real-world symptom: Essential Dharma Study showed 9:30 AM on the public listing while the editor's start time was 8:15 AM.

Fix: drop the override mechanism entirely. `dateText` and `timeText` are now caches of the source fields, recomputed by the server on every `POST /api/programs-pg` and every `PUT /api/programs-pg/[slug]` from the merged body + existing values. Compute helpers (`computeTimeText`, `computeDateText`) lifted from the editor into `lib/programUtils.ts` so server and client share the same logic. The editor inputs are now `readOnly` previews with the help text "Auto-generated from your start and end times — change those above to update." The PUT handler reads the existing program for any source field not in the request body so partial updates still recompute correctly. A new entry in `prisma/migrate.mjs` (`recache_program_date_time_text`) walks every program on every deploy and refreshes any whose cached label disagrees with the freshly computed one — cheap, idempotent, left in place as drift insurance.

**Lesson worth remembering (and recorded as a feedback memory):** when a stored value is meant to be a cache of source fields, the server should always recompute it on write, never trust client-sent values. The override-with-auto-default pattern is a footgun whenever the auto value is also written to the DB — the "is this overridden?" inference has no way to tell the two states apart on next load.

---

## 42. Hub Membership as Authority ✅ Built — session 92 Phase 3 (2026-04-22)

### What it does

Makes HubMember records the source of truth for team state that used to be derived only from system roles. Coordinators can now pause a member, restrict their hosting capability, turn off their hub notifications, or mark them inactive — all without touching the member's global Role[]. This is the "dimmer switch" that replaces the old on/off role-strip.

### Field ownership on HubMember

- **Sync-owned** (`syncHubMembership` on role changes): `hubId`, `userId`, `position`, `isCoordinator`, `joinedAt`
- **Coordinator-owned** (Members tab, PATCH endpoint only): `status` (ACTIVE/PAUSED/INACTIVE), `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`
- **Member-owned**: `firstVisitedAt`, `lastVisitedAt`

### Permission model

`lib/hubMemberAuth.ts` exposes two helpers:

- `getEffectiveHostingCapability(userId, hubSlug, fallbackAllowed)` — `true` when the HubMember has `status === "ACTIVE" && hostingCapability`. Falls through to `fallbackAllowed` if no HubMember record exists (preserves legacy role-gated paths for teachers, one-off HostAssignments, etc.).
- `canReceiveHubNotifications(userId, hubSlug, fallbackAllowed)` — same shape, gated on `status && communicationsEnabled`.

ADMIN always bypasses (treated as always capable in any hub).

### Gated surfaces

- **LiveKit:** `/api/livekit/token`, `/api/livekit/step-in`, `/api/livekit/mute-participant`, `/api/livekit/mute-all` — all route through `getEffectiveHostingCapability(userId, "host-team", tentative)` where `tentative` is the pre-existing role/assignment check.
- **Sub-requests:** `/api/host/sub-requests` (GET list, POST create), `/api/host/sub-requests/[id]/claim` — paused/inactive hosts cannot see or claim.
- **Host assignments:** `/api/host/assignments` GET list, POST self-claim, POST manager-assign target validation, and the `notifyTeamClaimed` recipient query — all via the hub authority.
- **Notifications:** `getHubNotificationRecipients` in `lib/toolAuth.ts` filters `status === "ACTIVE" && communicationsEnabled === true`.

### No-delete policy on role revoke

`syncHubMembership` no longer deletes HubMember records when a role is revoked. Coordinator-owned state (pause notes, capability flags) would otherwise be silently lost. To restrict access, use `status = INACTIVE`. Hard removal (`DELETE /api/hub/[slug]/members/[userId]`) is ADMIN-only and reserved for cleanup.

### Destructive-action warning flow

Pausing a member or revoking hosting capability on the host-team hub returns 409 `{ requiresConfirmation: true, upcomingAssignments: [...] }` if the member has upcoming HostAssignments. The Members tab shows the list and asks the coordinator to confirm. Resubmit with `force: true` to proceed; optionally `releaseAssignments: true` to null out the user's upcoming assignments (return them to the unclaimed pool).

### Members tab controls

`HubMembersClient` (`components/HubMembersClient.tsx`) renders a per-member editor panel for coordinators. Fields exposed:

- Position (free text)
- Coordinator (checkbox, disabled on self)
- Status (ACTIVE / PAUSED / INACTIVE, disabled on self)
- Can host sessions (host-team only)
- Receives hub notifications
- Pause note (shown under name when paused)
- Coordinator note (private)

Members are grouped into Coordinators / Members / Paused / Inactive. Non-coordinator viewers see a read-only roster.

### Member picker guardrails

`/api/hub/[slug]/members/search` — minimum 3 characters, excludes archived accounts, excludes `memberStatus !== "ACTIVE"`, excludes members already in the hub, max 20 results, sorted by name.

### Permission gating on the hub members API

- **POST** `/api/hub/[slug]/members` — coordinator-or-ADMIN. Accepts `userId`, `position?`, `isCoordinator?`.
- **PATCH** `/api/hub/[slug]/members/[userId]` — coordinator-or-ADMIN. Accepts any subset of editable fields + `force` + `releaseAssignments`.
- **DELETE** `/api/hub/[slug]/members/[userId]` — ADMIN-only. Hard removal for cleanup.

Path renamed from `[memberId]` (HubMember.id cuid) to `[userId]` to match the natural key.

### Key files

- `prisma/schema.prisma` — `HubMemberStatus` enum + 7 new fields on HubMember
- `prisma/migrate.mjs` — `add_hub_member_authority_fields` migration
- `lib/hubMemberAuth.ts` — authority helpers
- `lib/syncHubMembership.ts` — sync preserves records on role revoke
- `lib/toolAuth.ts` — `getHubNotificationRecipients` filters by authority
- `app/api/hub/[slug]/members/route.ts` — POST extended
- `app/api/hub/[slug]/members/[userId]/route.ts` — renamed + PATCH warning flow + ADMIN-only DELETE
- `app/api/hub/[slug]/members/search/route.ts` — guardrails
- `app/api/livekit/{token,step-in,mute-participant,mute-all}/route.ts` — gated
- `app/api/host/{sub-requests/*,assignments}/route.ts` — gated
- `components/HubMembersClient.tsx` — editor panel + warning dialog
- `app/account/hub/[slug]/members/page.tsx` — serializes new fields
- `public/css/custom.css` — `hub-mem-editor-*`, `hub-mem-dialog-*`, status badges

---

## 43. Schedule Tool — Program Diagnostic + Reassign-to-Self ✅ Built — session 93 Phase 4 (2026-04-22)

### What it does

Two Host Manager / Admin–only additions on the session detail panel of the Host Schedule (`/tools/schedule`). Both live inside the existing expanded-card detail; no new page or route surface.

### Program setup diagnostic panel

Renders between the sub-message and the actions row when the viewer is HOST_MANAGER or ADMIN. Four read-only checks against the program powering the session:

| Check | Level | Trigger |
|---|---|---|
| Program format is virtual or hybrid | error | `programFormat` not in `{"virtual","hybrid"}` |
| LiveKit room configured | error | `livekitRoom` null or empty |
| Occurrence scheduled | error | `sessionDate` null |
| Host assigned | warning | `hostUserId` null |

Panel background encodes the state: `--color-success-bg` when all checks pass, `--color-warning-bg` when the only failures are warnings, `--color-error-bg` when any error is present. Failed error-level checks render a hint pointing at the registrar ("Program configuration is managed by the registrar") with inline links to `/tools/programs/[slug]` (Program Manager) and `/programs/[slug]` (public page). "No host assigned" is always a warning because the whole schedule tool is built around resolving that state.

### Reassign-to-self action

Appears in the session detail's secondary actions as **"Reassign this session to me"** when the viewer is HOST_MANAGER or ADMIN and isn't already the assigned host. Clicking opens the standard `hub-detail__warn` confirmation panel explaining the side effects: the previously-assigned host will be removed, any open sub request on the session will be cancelled, and affected parties will be notified.

On confirm, POST `/api/host/assignments/reassign`:

- Cancels any `SubRequest` with `status: OPEN` on the existing `HostAssignment`
- Deletes the existing `HostAssignment` (if one exists)
- Creates a fresh `HostAssignment` owned by the requester
- Notifies the previously-assigned host (if any) with an `UNASSIGNED_SESSION` alert
- Notifies the rest of the Host Team (excluding the new host *and* the previous host, to avoid duplicate alerts) with a `SUB_REQUEST` alert

All team notifications route through `getHubNotificationRecipients("host-team", { excludeUserId: newHostId })` so Phase 3's authority rules apply: paused/inactive/communications-disabled members are correctly excluded.

### Why this action is scoped to "self"

Managerial takeover is a real operation the platform needs to express clearly. Managerial assignment-to-someone-else is a policy question the sub-request system already answers — coverage transfers happen through the sub-request flow. Keeping reassign narrowly scoped to the manager themselves avoids re-opening that design space.

### Payload changes

- `Program.livekitRoom` is now selected by the schedule page and the GET `/api/host/assignments?month=` endpoint, then passed through in each session payload. Client uses it for the diagnostic's LiveKit check. **Session 112:** `livekitRoom` is now auto-set at program creation — the POST handler writes `livekitRoom = slug` for virtual/hybrid programs; the PUT handler backfills it when `programFormat` changes to virtual/hybrid and the field is null. The one-time migration route (`/api/admin/populate-livekit-rooms`) is no longer needed for new programs.

### Key files

- `app/api/host/assignments/reassign/route.ts` — new POST endpoint, HOST_MANAGER/ADMIN only
- `app/api/host/assignments/route.ts` — GET adds `livekitRoom` to session payload
- `app/tools/schedule/page.tsx` — selects `livekitRoom`, passes `isHostManager` prop
- `components/HubScheduleClient.tsx` — `<ProgramDiagnostics>` component + `reassignToSelf` handler + reassign confirmation dialog
- `public/css/custom.css` — `hub-diag-*` styles + `hub-detail__link-btn--manager`

---

## 44. Host Hub — Role-adaptive Hub Home ✅ Built — session 93 Phase 5 (2026-04-22)

### What it does

`/account/hub/host-team` branches at the page level. Coordinators (and admins) see a coordinator shell; everyone else sees a host shell. A session-scoped "Viewing as" toggle lets coordinators preview the host view without leaving the page — not persisted, resets on refresh. Other hubs continue to flow through the generic `HubHomeClient` — this is Host Hub-specific by intent.

### Coordinator view

**Attention items.** Four lists, each hidden when empty, with an "Everything's handled" fallback when all four are empty:

| Section | Source | Rule |
|---|---|---|
| Pending new hosts | `HubMember` | `joinedAt` within 7 days, status ACTIVE |
| Unassigned virtual/hybrid programs | `Program` + `HostAssignment` | Format = virtual or hybrid, `startDatetime` within 30 days, no standing assignment (sessionDate null) |
| Unclaimed sub requests | `SubRequest` | `status = OPEN` |
| New conversations | `HubConversationThread` | `createdAt` greater than coordinator's `lastVisitedAt` watermark |

Each card has a heading, a one-line hint, and a "view all" link pointing at the relevant tool or tab. Empty state: a single soft-green panel, `--color-success-bg`.

**Team directory.** Renders `hub.homeContent` as BlockNote-derived HTML. Per the Phase 1 revert, role descriptions are coordinator-authored prose, not a schema model. Edits continue to flow through `/admin/hubs/[slug]/edit`.

**Quick links.** Four hard-coded links covering the surfaces coordinators touch most: schedule, members tab, conversations tab, team-management manual chapter.

**Coordinator notes.** Placeholder block pointing coordinators at the Documents tool. A real editable hub-level notes area is deferred — adding the field forces editor + audit decisions.

### Host view

**Welcome.** Renders `hub.welcomeBody` (the same field that drives the welcome interstitial for first-time visitors). Seed script populates it with placeholder prose the coordinator can rewrite.

**Pinned threads.** Up to 5 `isPinned: true, status: OPEN` threads.

**Team roster.** Grid of cards — one per other ACTIVE member. Each card: avatar (falls back to initials), name + Coordinator badge if applicable, title line (`HubMember.position` preferred, else `User.title`), and rendered `User.bio` HTML. No filter on `hostingCapability` — paused members still appear; surfacing their state visibly is a future iteration.

**If something goes wrong.** Three-paragraph static troubleshooting block covering stale auth in a session, filing a sub request for coverage, and escalating via Conversations.

**Quick links.** Four host-relevant links: personal schedule, conversations, documents, presence-photo settings.

### Toggle

Session-scoped React state on `HostHubHomeClient`. Coordinators and admins see a compact "Viewing as — Coordinator | Host (preview)" control; toggling switches the rendered view without a round-trip. All host-side data is fetched even for coordinators so the toggle feels instant.

### Placeholder content seed

`prisma/seed-host-hub-home-content.mjs` — write-only-if-null upsert on `hub.welcomeBody` and `hub.homeContent` for the `host-team` hub. Flagged via `seed_host_hub_home_content_v1` in `_migration_flags`. Never overwrites coordinator edits; safe to re-run.

### Why this shape

- **Attention items are Host-Hub-specific for now.** When a second hub asks for an attention view, the card primitives + empty-state pattern get extracted. Designing a generic abstraction on a sample size of one is speculative.
- **Toggle is React state, not URL.** A coordinator should not be able to bookmark a "host preview" URL and return later thinking it's their real view. Component state resets on refresh, which matches the intent.
- **Team directory = `hub.homeContent`.** Reusing the existing field honors the Phase 1 revert: there is no RoleProfile model, role descriptions are content.
- **Roster includes paused members.** Hiding them would make the team look smaller than it is and contradict the Phase 3 semantics ("paused means on-team-but-not-active"). A visible paused indicator is tracked as a follow-on.

### Key files

- `app/account/hub/[slug]/page.tsx` — host-team branch + `loadHostHubAttention()` + `loadHostHubHostView()`
- `components/HostHubHomeClient.tsx` — role-adaptive home component (coordinator + host + toggle)
- `prisma/seed-host-hub-home-content.mjs` — placeholder content seed
- `prisma/migrate.mjs` — new flag `seed_host_hub_home_content_v1`
- `public/css/custom.css` — `hub-home-toggle-*`, `hub-home-coord-*`, `hub-home-host-*`, `hub-home-att-*`

---

## 45. Standing Host Assignments ✅ Built — session 98 (2026-04-29)

### What it does

Coordinators pre-assign hosts to recurring programs by occurrence pattern — "1st Thursday goes to Alex, 3rd Thursday to Sam." Every day at 8 AM UTC a cron walks the current month (and next month on the 1st) and creates `HostAssignment` records for any open session that matches an active standing assignment. Coordinators can also trigger the apply step immediately from the Rotations tab.

### Schema

New `StandingAssignment` model. One record per `programSlug + occurrence` slot (`@@unique`). Optional `endsOn` for time-limited rotations; `startsOn` gates early application.

```prisma
model StandingAssignment {
  id          String             @id @default(cuid())
  programSlug String
  userId      String
  occurrence  StandingOccurrence   -- FIRST | SECOND | THIRD | FOURTH | FIFTH | ALL
  startsOn    DateTime           @default(now())
  endsOn      DateTime?
  createdById String
  ...relations
  @@unique([programSlug, occurrence])
}
```

### Apply logic

`lib/applyStandingAssignments.ts` — shared between the cron and the apply-now route. Walks every day in the target month:

1. Load active standing assignments (not yet past `endsOn`)
2. Load programs matching the slugs
3. Load existing `HostAssignment` records for the month
4. For each day × each standing assignment: `isOccurrenceOnDate()` + `getOccurrenceInMonth()` occurrence match + already-assigned skip
5. `db.hostAssignment.createMany({ skipDuplicates: true })`
6. Return `{ created, byUser: Map }` for email notifications

Idempotent — safe to re-run; sessions with existing assignments are never touched.

### Occurrence numbering

`getOccurrenceInMonth(dateStr, program)` in `lib/scheduleUtils.ts`: walks days 1 to the target, counts `isOccurrenceOnDate` hits, returns 1-based count. Enables "1st Tuesday" and "3rd Saturday" matching.

### Routes

| Method | Route | Purpose | Auth |
|---|---|---|---|
| GET | `/api/host/standing-assignments` | List active standing assignments | coordinator / manager |
| POST | `/api/host/standing-assignments` | Save rotation (upsert filled slots, delete emptied) | coordinator / manager |
| POST | `/api/host/standing-assignments/apply` | Apply to open sessions immediately | coordinator / manager |
| POST | `/api/host/standing-assignments/end-bundle` | End a bundle — `{ releaseFuture }` or `{ endsOn: "YYYY-MM-DD" }` for graceful wind-down | coordinator / manager |
| POST | `/api/host/standing-assignments/release-host` | Release one user's future assignments for a bundle | coordinator / manager |
| POST | `/api/host/programs/[slug]/clear-rotations` | Per-program reset (`mode: "reset"` deletes rules + future assignments) | coordinator / manager |
| GET | `/api/cron/apply-standing-assignments` | Daily cron — fills current + next month on 1st | `CRON_SECRET` |

### UI

**Rotations tab** (`components/RotationsClient.tsx`) inside the Host Schedule tool. Visible to HOST_MANAGER, ADMIN, and hub coordinators (`isManager` prop — added session 111). One card per program; each program shows a day × occurrence (1st–5th) grid. Click "Edit" or "Set up" on a row to open an inline pattern form.

Pattern options: **Same every week** (one ALL record), **Alternate** (1st & 3rd / 2nd & 4th), **Custom** (set each occurrence independently). "Pair weeks" (1st-2nd / 3rd-4th) was removed in session 108 — Custom covers it when needed. Existing pair rotations continue to apply via the DB records; they appear as Custom on edit.

5th-week host is collapsed by default behind a reveal link (same pattern as the end-date field). Only expands when needed. For "Same" pattern, blank = main host covers 5th weeks automatically (via ALL record); for other patterns, blank = skip 5th-week occurrences.

**Pattern preview**: once at least one host is filled, a Preview section appears showing the next 6 sessions for that day with the projected host name. Updates live as selects change. Converts "I think this is right" into "I can see this is right" — particularly useful when setting up rotations for the first time.

**Grid de-emphasis while editing**: when a row's form is open, all other rows dim to 40% opacity. The editing row stays full weight. Removes competition between prior-state data and the form.

Save applies immediately (current + future months through `endsOn` horizon, leave-mode). Conflict modal shows if any sessions had existing assignments. Toast confirms fill count.

**Host-side awareness panel** (`HubScheduleClient.tsx`): hosts see a "Your rotations" panel above the schedule showing their active rotations as stacked horizontal cards (session 109). Each card has the program name + pattern meta on the left ("1st & 3rd of the month · until Dec 2026") and a "NEXT" microlabel + date·time of the next upcoming session on the right. Multiple DB records for the same program (e.g. FIRST + THIRD from an alternate pattern) are grouped into one card. The next-session date is fetched as a separate DB query in `app/tools/schedule/page.tsx` (`nextSessionBySlug`) so it always reflects the real next assignment regardless of which calendar month is open.

**"Enter room →" link on session rows** (session 112): every upcoming virtual/hybrid row in the schedule shows a small `hs-row__join` link below the format label, opening `/session/{programSlug}` in a new tab. Always visible regardless of time — hosts can test their setup before a session or arrive 10–12 minutes early to hold the welcoming space as participants gather. Documented in `host-schedule` manual chapter v5.

**Manage panel** (session 111): clicking End opens a flat inline panel with three options. (1) Release section — if manager + hosts assigned, each host listed with "Release their dates" button. (2) End on a specific date — date picker + "Set end date"; sets `endsOn` on StandingAssignment records, silently trims pre-generated HostAssignments beyond that date, no email. (3) End this rotation — deletes StandingAssignment records, cancels open SubRequests, deletes future HostAssignments, emails each affected host. Global soft-clear removed — "Reset everything" is the only global operation.

**Per-program Reset** (session 111): each program card shows a "Reset rotations" button (manager only, when rotations exist) that deletes all StandingAssignment rules for that program and all future HostAssignments. Scoped to one program; doesn't touch other programs. Two-step confirmation required.

**Tab strip** (`HubScheduleClient.tsx`): `hs-viewtabs` / `hs-viewtab` / `hs-viewtab--active` pill tabs toggle between Schedule and Rotations views (manager-only).

### Email

`sendStandingAssignmentScheduledEmail` — one email per host summarising all newly-scheduled sessions. Sent via `after()` from both the apply route and the cron.

### Cron

`vercel.json`: `0 8 * * *` → `/api/cron/apply-standing-assignments`. On the 1st of each month, also pre-fills next month so hosts see their schedule in advance.

### Key files

- `lib/applyStandingAssignments.ts` — core generate logic
- `components/RotationsClient.tsx` — coordinator UI
- `app/api/host/standing-assignments/route.ts` — list + save
- `app/api/host/standing-assignments/apply/route.ts` — apply now
- `app/api/host/standing-assignments/end-bundle/route.ts` — end a bundle
- `app/api/host/standing-assignments/release-host/route.ts` — per-person release
- `app/api/host/programs/[slug]/clear-rotations/route.ts` — per-program reset
- `app/api/cron/apply-standing-assignments/route.ts` — daily cron
- `lib/scheduleUtils.ts` — `getOccurrenceInMonth()` added
- `lib/email.ts` — `sendStandingAssignmentScheduledEmail()` added
- `components/HubScheduleClient.tsx` — Rotations tab mount (`isManager` prop)
- `app/tools/schedule/page.tsx` — coordinator DB check → `isManager`
- `prisma/schema.prisma` — `StandingAssignment` + `StandingOccurrence`
- `public/css/custom.css` — `hs-viewtabs`, `hs-rot-*` styles

---

## 46. Schedule PDF Export ✅ Built — session 109 (2026-05-07)

### What it does

Hosts can download a PDF of their personal schedule from `/tools/schedule/print`. A small form with date pickers (default: today through end of next month) plus a "Download PDF" button that opens the PDF in a new tab — the browser's PDF viewer shows it inline with its own Save action. A "Print my schedule" link below the filter pills on the main schedule page (`HubScheduleClient.tsx`) is the entry point.

### Implementation

Server-rendered with `@react-pdf/renderer` v4.5.1 — a React-based PDF library (no headless Chromium), so it runs cleanly on Vercel's serverless runtime without any extra setup or large bundles.

`GET /api/host/schedule/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD` (NodeJS runtime, dynamic) fetches the user's `HostAssignment` records in the date range, their active `StandingAssignment` records, and the relevant `Program` rows for joins. Builds a flat session list, marks the first session whose date is ≥ now as "next," and groups standing rotations by program slug (same `formatOccurrences` logic the hub panel uses). Renders via `renderToBuffer(ScheduleDocument(props))` and streams `application/pdf`.

### PDF layout

Letter, Helvetica, 50pt side margins, fixed footer.

- **Header**: title + range + auto-summary line ("7 sessions · Thursdays at 8:15 AM" when day-of-week and time are uniform across all sessions; just count otherwise).
- **Standing Rotations section**: tabular — program name on the left, occurrence pattern + end date on the right.
- **Sessions section**: tabular — Day (Thu) · Date (May 14) · Time (8:15 AM) · Program · Format. Month dividers ("MAY 2026", "JUNE 2026") chunk the rows. The next upcoming session has a teal ▸ marker in a leftmost column and a pale-teal row background. Column header is `fixed` so it repeats automatically when the table wraps to a new page.
- **Footer (fixed)**: "Schedule for [Name] · Generated [date] · rootedinmindfulness.org".

### Type sizes

Tuned for arm's-length printed reading: 17pt title, 10pt body, 9pt format column (slightly muted as secondary), 8pt section eyebrows / column headers, 8pt footer. Content fits two months on one page comfortably; longer ranges paginate cleanly with the fixed header.

### Key files

- `app/api/host/schedule/pdf/route.ts` — route handler (data fetch + PDF stream)
- `app/api/host/schedule/pdf/ScheduleDocument.tsx` — React-PDF document component
- `app/tools/schedule/print/page.tsx` — the date-range form page
- `app/tools/schedule/print/PrintControls.tsx` — client component with date inputs + Download link
- `components/HubScheduleClient.tsx` — "Print my schedule" link below filter pills
- `package.json` — `@react-pdf/renderer ^4.5.1` dep added

---

## 47. Hub Notifications, Subscriptions, and Trash ✅ Built — session 113 (2026-05-13)

A coordinated pass across the hub system: per-document Basecamp-style notifications, conversation thread subscriptions, three-stage archive→trash lifecycle, host assignment confirmation emails, and cleanup of Tasks/Alerts/Support-Inbox residue.

### Per-document notifications (Hub Documents)

When you add or edit a document, you choose which hub members to email about it. Default: nobody. A `Notify` button on each document row opens the same picker after the fact — it pre-selects only members who haven't received a notification yet. Already-notified members appear as disabled `✓ Notified [date]` rows so you can see who's been told without scrolling guesswork. Server enforces the same rule: you cannot accidentally re-notify someone with a second click.

Both event types — `created` and `updated` — count separately. A member who got the "added" email can still legitimately receive the "updated" email later.

**Where:** every hub's Documents tab (`/account/hub/[slug]/documents`).

🔧 **Implementation:** `HubDocumentNotification` model (event log, `documentId × userId × eventType`, no unique constraint). New routes `GET /notify` (returns members + notification history) and `POST /notify` (sends to chosen userIds). Three send paths — `POST /documents`, `PATCH /documents/[id]`, `POST /notify` — all dedup against `(documentId, userId, eventType)` before insert + send. Shared `components/HubDocNotifyPanel.tsx` powers the UI in three surfaces (add form, inline edit, standalone modal, plus the conversation-compose and reply forms). Email templates `hub-document-created` and `hub-document-updated` in `lib/email.ts`. PDF file uploads via `@vercel/blob/client` `upload()`; `PDF` value added to `HubDocumentFileType` enum.

### Thread subscriptions (Hub Conversations)

A thread has a subscriber list. Subscribers get every reply automatically — no per-reply opt-in. The author and all hub coordinators are auto-subscribed at thread creation; the author can also pick additional members via an "Also notify" panel below the compose form. The replier on any reply is auto-subscribed by virtue of replying; a `+ Notify someone new…` link expands the same panel for pulling in others. Any reader can self-subscribe or unsubscribe via the `Follow` / `Following ✓` pill in the thread header.

This replaces the previous implicit behavior (which auto-emailed coordinators on new threads and prior repliers on each reply). The new model is more explicit and lets people opt in or out of threads they care or don't care about.

**Where:** every hub's Conversations tab.

🔧 **Implementation:** `HubThreadSubscription { id, threadId, userId, subscribedAt, source }` with `source ∈ {AUTHOR, COORDINATOR_AUTO, ADDED, SELF}`, unique `(threadId, userId)`. The reply POST queries `db.hubThreadSubscription.findMany({ threadId })` and emails every subscriber except the replier, filtered to `ACTIVE` members with `communicationsEnabled`. New routes `GET/POST/DELETE /api/hub/[slug]/conversations/[id]/subscribe`. Migration `create_hub_thread_subscriptions` backfills (author + all prior repliers + all current coordinators) for every existing thread before the deploy so nobody loses email.

### Three-stage delete: Archive → Trash → Permanent (Hub Documents + Conversations)

Members can no longer hard-delete a document or thread. The flow is deliberate:

1. **Archive** (Active → Archived) — reversible, member-visible under an "Archived" tab. Author or coordinator.
2. **Delete** (Archived → Trash) — vanishes from member view. Only Admin, Guiding Teacher, or hub coordinator can see trashed items.
3. **Restore** or **Delete permanently** (Trash → either back to active or gone forever) — Admin / Guiding Teacher / coordinator.

For documents, archive is a separate state with its own filter view. For conversations, the existing `status: "CLOSED"` continues to serve as archive (relabeled in the UI as "Archived"). The Trash page lives at `/account/hub/[slug]/trash` and is gated on `canManageTrash`. The sidebar shows the Trash link only to managers.

**Where:** every hub. New "Trash" link in the workspace sidebar footer for managers; an "Archived" filter toggle on the Documents page when archived items exist; "Active / Archived" tabs on the Conversations page.

🔧 **Implementation:** new `GUIDING_TEACHER` value in the `Role` enum. `HubDocument` gains `archivedAt`, `archivedById`, `deletedAt`, `deletedById`. `HubConversationThread` gains `deletedAt`, `deletedById`. New helper `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts` is the single source of truth (returns true if `ADMIN ∈ roles || GUIDING_TEACHER ∈ roles || isCoordinator`). New routes: `POST /documents/[id]/archive`, `POST /documents/[id]/restore`, `POST /documents/[id]/permanent-delete`, `POST /conversations/[id]/restore`, `POST /conversations/[id]/permanent-delete`. The existing `DELETE` on both endpoints becomes a soft-delete and refuses to run unless the item is archived (400 "Archive this … first"). Trash page is a server component (`app/account/hub/[slug]/trash/page.tsx`) listing both kinds side by side; `HubTrashClient` handles Restore + Permanently Delete actions with confirmation prompts.

### Host assignment confirmation emails

Every path that makes someone a host now sends them a confirmation email. Previously only standing-rotation auto-assignments did. The new template `host-assignment-confirmation` covers: sub-claim, self-claim, manager-assigns-to-user, claim via PATCH, and manager reassign. When a manager reassigns away from someone, that displaced host now also gets a `host-assignment-removed` email — fulfilling a TODO that had been in the reassign route's comments for several sessions.

The same template carries an optional `requesterNote` variable populated only when the path is a sub-claim (so the claimer sees the original asker's message inline). On every other path the variable is empty and the email is just a clean confirmation with date and a link to the schedule.

Also fixed in the same pass: every host email now resolves `Program.name` from the slug before sending. Previously the `sub-request-claimed` email had been showing slugs like `essential-dharma-study-2024-07-14` instead of human names.

**Where:** all five paths in `app/api/host/sub-requests/[id]/claim`, `app/api/host/assignments`, `app/api/host/assignments/[id]`, `app/api/host/assignments/reassign`.

🔧 **Implementation:** new functions `sendHostAssignmentConfirmationEmail` and `sendHostAssignmentRemovedEmail` in `lib/email.ts`. Two templates seeded via defensive `findUnique → create` so existing `/admin/emails` edits stay untouched. Both wired in `after()` blocks so the response returns immediately and Vercel doesn't tear down before Resend completes. Standing-rotation emails stay hardcoded (batched, content-specific, multiple sessions per email) and continue to use `sendStandingAssignment*` functions.

### Cleanup: Tasks, Alerts, and Support Inbox residue

Three deleted features that had left fragments in the code, migrations, and docs. Audited and removed:

- **Tasks** (deleted session 96): `hub-task` placement from the editor registry; "Tasks" entries in hub-section lists in `RIM_Hub_Model.md`, `RIM_System_Architecture.md`, `FEATURES.md`.
- **Alerts** (deleted session 96): "Alerts" comments in cascade-delete enumerations; the one-time `remove_alerts_module` and `remove_tasks_feature` migrations from `migrate.mjs`; stale "alert-creation/dedup in lib/supportNotify.ts" descriptions on the surviving support-notification template.
- **Support Inbox** (deleted session 100): label drift in three manual-pages; the one-time `seed_support_notification_email_template` + `remove_support_inbox_residue` migrations; the dead `support-notification` template row (new `drop_support_notification_template` cleanup migration); two standalone seed scripts (`prisma/update-manual-system-section.ts`, `prisma/seed-email-templates.js`) deleted; obsolete backlog items removed.

The cleanup also added `GUIDING_TEACHER` to the volunteer-roles seed in `prisma/seed-manual.ts` to match the current `Role` enum.

🔧 **CLAUDE.md gate:** new "Email Template Gate" section. Every `sendTemplatedEmail(slug, …)` call must ship with a corresponding seed entry in `prisma/migrate.mjs` in the same commit. Names the four templates that had been silently no-op'ing in production before the audit (`session-reminder`, `host-role-assigned`, `sub-request-claimed`, `drip-lesson-available`) and the intentional hardcoded exceptions (`sendHostManagerRoleAssignmentEmail`, the three `sendStandingAssignment*` functions).

---

## 48. Document Conversations + Unified Activity Stream ✅ Built — session 114 (2026-05-14)

### Document conversations

Each hub document now has its own conversation section. Threads tied to a document live below the document card on the view page and are contextually scoped — they don't appear in the hub's main Conversations feed, which stays scoped to hub-level discussion only.

The "N conversations ↓" anchor link in the document meta row scrolls directly to `#doc-conversations`. The compose form is a stripped-down version of the hub composer (no categories, no pinning): title + body + optional member notification. Clicking a thread navigates to the shared thread detail page; the back link reads "← Back to [Document]" instead of the usual "← Conversations".

**Where:** `/account/hub/[slug]/documents/[id]` — conversations section below the document card.

🔧 **Implementation:** `HubConversationThread` gained `documentId String?` (optional FK to `HubDocument`, ON DELETE CASCADE, `@@index([documentId])`). Hub Conversations feed and `countUnreadConversations` both filter `documentId: null`. Document conversations filter `documentId: docId`. New API route `GET/POST /api/hub/[slug]/documents/[id]/conversations` handles listing and creation (POST seeds subscriptions + sends notification emails via `after()`). New client component `HubDocConversationsClient.tsx` (CSS prefix `doc-conv-`). DB migration `add_document_id_to_hub_conversation_threads` adds the column and index to Neon.

### Unified Activity stream

A new Activity page shows everything that has happened in a hub in a single chronological river: documents added, documents updated, hub-level conversations started, hub-level replies, document conversations started, document conversation replies. Newest first. Four filter pills narrow the view: All / Documents / Conversations / Mine.

Each item is a single link row: icon + label + relative timestamp. Labels are plain-language descriptions ("**Maria** started a conversation on *Team Norms* — Is our check-in time working?"). Clicking navigates to the relevant document page or thread. Load-more cursor pagination via the activity API.

Activity is the first item in the hub sidebar below Home, above Conversations.

**Where:** `/account/hub/[slug]/activity`. Accessible to all hub members.

🔧 **Implementation:** No new DB model — the stream is a computed union query: five parallel `findMany` calls (hub docs, hub threads, hub replies, doc threads, doc replies), merged, sorted by `ts`, sliced to 30. API route `GET /api/hub/[slug]/activity` handles cursor pagination. New server page `app/account/hub/[slug]/activity/page.tsx` passes initial 30 items to `HubActivityClient`. CSS prefix `hub-act-`. `Activity` icon (lucide-react) added to `HubWorkspaceSidebar`.

---

## 50. Course Offering Model — Orthogonal Flags + Tabbed Editor + Dana Parity ✅ Built — session 123 (2026-05-25)

The Course offering architecture from `RIM_Offering_Model.md` (decided session 118) is now real, end-to-end. Courses are structural peers of Programs: same editor chrome, same dana model, same landing-page shape, same content vocabulary. The previous single `accessLevel` enum is replaced by a small set of orthogonal flags so one Course can carry multiple acquisition paths simultaneously (free-self-enroll + linked to a live cohort, dana-required + bundled, role-locked + standalone, etc.).

### What changed for users

- **`/course/[slug]` is a real public landing page.** Was auth-gated with a one-line "registration required" wall for non-enrolled visitors. Now it's a marketing surface: hero image, pull quote, description, "About this course" block (lesson count, teacher byline, dana ask), state-aware CTA, lesson preview (titles only — Substack/Coursera pattern), facilitators. Mirrors `/programs/[slug]` shape exactly.
- **Six visitor states are handled gracefully.** Anonymous (sign-in-first CTA), enrolled (TOC view), free self-enroll (button), dana self-enroll (mode-aware picker), role-gated-without-role (friendly restriction message), bundled-only (link to the registering live cohort, or friendly fallback when no cohort is open). Never a 404; never a one-line wall.
- **The CourseEditor is a peer of the ProgramEditor.** Tabbed (Content / Lessons / Landing / Categories / Access / Schedule / Dana / Visibility) using the same `pe-` chrome. Same voice, same structure, same field types.
- **Dana works the same way as Programs.** Four modes — None / Voluntary / Base + Dana / Fixed — with conditional amount fields per mode and a rich-text Dana Message editor. The Dana Mode picker uses the same option-card pattern as Program's Dana tab.
- **Course categories are first-class.** Inline CRUD in the editor's Categories tab; the public catalog at `/courses` reads the category records. Previously the model existed but had no management UI.
- **Self-enroll with dana works end-to-end.** Stripe Checkout → webhook → atomic SeriesEnrollment + Donation write → receipt email that doubles as enrollment welcome.

### How a course is set up — the canonical shapes

The flags are independent. Combining them expresses the standard course patterns:

| Shape | Flag pattern | Practical use |
|---|---|---|
| **Free for all members** | `allowSelfEnroll=true`, `danaMode="none"`, `requiredRoles=[]` | A Library entry every member can open. |
| **Dana self-enroll (voluntary)** | `allowSelfEnroll=true`, `danaMode="voluntary"`, `suggestedDana=50` | Pay-what-you-want with a suggested amount. |
| **Dana self-enroll (base + extra)** | `allowSelfEnroll=true`, `danaMode="base_plus_dana"`, `danaBaseAmount=50` | Minimum $50, add more on top if you'd like. |
| **Paid course (fixed price)** | `allowSelfEnroll=true`, `danaMode="fixed"`, `danaFixedAmount=300` | A specific price; no picker, no extra. |
| **Manual grant only** | `allowSelfEnroll=false`, `publishOnPublicCatalog=false` | Private content; admin grants access from `/admin/members/[id]`. |
| **Onboarding** | `isOnboarding=true`, others off | Every new member auto-enrolls at signup. |
| **Bundled with a live Program** | `allowSelfEnroll=false`, linked via `ProgramCourse` | Access comes from registering for the live cohort. |
| **Hybrid (live + standalone)** | `allowSelfEnroll=true`, `danaMode="voluntary"`, linked via `ProgramCourse` | Both paths active — register for the live cohort if you can, or enroll standalone for dana. |
| **Role-locked** | `requiredRoles=["TEACHER_TRAINEE"]`, others as needed | Only members with the role can see or enroll. |

### Schema additions (`prisma/schema.prisma`)

**Course gets 12 new fields** across two slices (1 + 5):

```
// Access model
allowSelfEnroll          Boolean   @default(false)
selfEnrollDanaRequired   Boolean   @default(false)   // derived mirror of danaMode !== "none"
accessRestrictionMessage String?

// Landing-page content (mirrors Program)
heroImage       String?
pullQuote       String?
pullQuoteSource String?
danaText        String?

// Dana model (parallel to Program)
danaMode        String  @default("none")  // "none"|"voluntary"|"base_plus_dana"|"fixed"
suggestedDana   Float?
danaBaseAmount  Float?
danaFixedAmount Float?
danaMessage     Json?
```

**Donation gets `courseId` and `courseTitle`** so course-dana payments ledger cleanly without overloading the program fields.

**The legacy `accessLevel` enum stays in the schema during transition.** Reads migrate to flags first; the enum drops in a later pass after production observation. The API write paths derive a coherent `accessLevel` from the flags on every save so the column stays in sync.

### Single source of truth: `lib/courseAccess.ts`

```ts
getCourseAccessState({ userId, userRoles, course }) → CourseAccessState
```

Returns a discriminated union — exactly one of:

- `{ kind: "anonymous" }`
- `{ kind: "enrolled"; source: "SERIES" | "ACCESS_GRANT" | "PROGRAM" }`
- `{ kind: "can_self_enroll_free" }`
- `{ kind: "can_self_enroll_dana" }`
- `{ kind: "role_gated"; requiredRoles: string[] }`
- `{ kind: "bundled_only"; liveCohort: LiveCohort | null }`

Plus `hasCourseAccess()` (boolean for lesson pages), `defaultRestrictionMessage()` (derived copy when the per-course override is empty), `flagsFromAccessLevel()` and `accessLevelFromFlags()` (transition helpers for the legacy enum).

### CourseEditor — 8 tabs

| Tab | Fields |
|---|---|
| **Content** | title, slug, subheading, description (Tiptap message variant), completion note |
| **Lessons** | the existing lesson list manager — drag-reorder, inline create, search-and-add, section dividers (edit mode only; create mode shows "save first") |
| **Landing** | hero image URL, pull quote, pull quote source, dana page note |
| **Categories** | category picker + inline "Add a new category" form + list of existing categories with course-count badges and disabled-when-non-empty delete buttons |
| **Access** | allowSelfEnroll checkbox, role-gate checkbox + role picker, accessRestrictionMessage textarea |
| **Schedule** | **placeholder tab** — explains drip release was removed in session 100 and is coming as the next slice; lists the design questions the real implementation will answer |
| **Dana** | four-mode option-card picker + conditional amount fields per mode + `RimTiptapEditor` for danaMessage |
| **Visibility** | isActive, publishOnPublicCatalog, isOnboarding, hideFromMemberProfile |

CSS classes used: shared `pe-` chrome from ProgramEditor (`pe-editor`, `pe-tabs`, `pe-card`, `pe-form`, `pe-field`, `pe-checkbox`, `pe-option-cards`, `pe-actions`). Session 123 added `pe-card__help`, `pe-empty`, `pe-checkbox__hint`, `pe-checkbox--sm`, `pe-field__error`, `pe-field__hint`, `pe-roles-select`, `pe-list*`.

### API endpoints

- `GET /api/courses` — public catalog. Visibility filter is requiredRoles-only (empty = visible). Returns `allowSelfEnroll` and `selfEnrollDanaRequired` for badge rendering.
- `POST /api/courses` — create. Accepts new flag + dana + category fields. Falls back to `flagsFromAccessLevel` for older clients that still send `accessLevel`.
- `GET /api/courses/[slug]` — auth-gated, full course shape.
- `PATCH /api/courses/[slug]` — write the new fields directly. `requiredRoles` is independent (no enum coupling). The endpoint derives `accessLevel` from the resulting flags + `selfEnrollDanaRequired` from `danaMode !== "none"` so the legacy columns stay coherent.
- `DELETE /api/courses/[slug]` — refuses when programs are linked.
- `POST /api/courses/[slug]/enroll` — free self-enroll. Validates `allowSelfEnroll && !selfEnrollDanaRequired && (no role gate OR has role OR is admin)`.
- `DELETE /api/courses/[slug]/enroll` — leave (only allowed for `SELF`-sourced enrollments).
- `POST /api/courses/[slug]/checkout` — **new (session 123)**. Creates a Stripe Checkout session for dana self-enroll. Validates `amountCents` per mode: voluntary ≥ $1; base_plus_dana ≥ base; fixed exactly = fixed.
- `GET /api/courses/categories` — public, returns categories with at least one visible course.
- `GET /api/courses/categories?all=true` — **new (session 123)**, admin-gated, returns ALL categories with course counts.
- `POST /api/courses/categories` — **new**, create a category. Slug auto-generated, collision-suffixed.
- `PATCH /api/courses/categories` — **new**, rename or reorder. Slug is preserved (stable external link).
- `DELETE /api/courses/categories?id=…` — **new**, refuses non-empty categories.
- `GET /api/admin/courses` — admin sidebar `CourseAccessSection` data. Returns flags + requiredRoles + linkedByPrograms. (No longer returns `accessLevel`.)

### Stripe Checkout + Webhook — course dana flow

1. Member clicks dana picker on `/course/[slug]` → `EnrollDanaButton` POSTs `amountCents` to `/api/courses/[slug]/checkout`.
2. Server validates flags, role gate, not-already-enrolled, mode-specific amount. Creates Stripe Checkout session with `metadata.source = "course_dana"` and `courseId / courseSlug / courseTitle / userId / donorName / donorEmail`.
3. Member completes payment on Stripe-hosted page.
4. Webhook (`/api/stripe/webhook`) routes by `metadata.source`. `handleCourseDanaCompleted`:
   - Pre-checks whether the Donation row for this `payment_intent` already exists (dedup signal for the email).
   - Wraps `SeriesEnrollment.upsert` + `Donation.upsert/create` in `db.$transaction` for atomicity.
   - Fires `sendCourseDanaReceiptEmail` via `after()` from `next/server` (Next 16's fire-and-forget API), but ONLY when the donation was newly created — duplicate webhook deliveries do not re-send the receipt.
5. Stripe redirects the user back to `/course/[slug]?dana=success&session_id=…`. The landing page now sees them as enrolled and renders the TOC view.

### Email Template — `course-dana-receipt`

Sent automatically by the webhook on payment success. Doubles as receipt + welcome — by the time it arrives, the SeriesEnrollment row already exists. Variables: `firstName`, `courseTitle`, `amountUsd`, `courseUrl`. Group `03-courses` ("Courses") in the Email Template Manager.

Email Template Gate satisfied: matching seed entry shipped in `prisma/migrate.mjs` in the same commit, defensive `findUnique → create` so admin edits at `/admin/emails` are preserved on re-run.

### Lesson access (`/lessons/[slug]`)

Unchanged in shape, simplified in implementation. Calls `hasCourseAccess()` per parent course (OR across parents — any one granting access is sufficient). The legacy lesson-access-level enum is preserved (lessons can still be marked `ALL_MEMBERS` vs `REGISTRATION_REQUIRED`); only the course-side check changed.

### 🔧 Technical notes

- **The dana mirror story.** `selfEnrollDanaRequired` is derived from `danaMode !== "none"`. The editor writes both. The PATCH endpoint derives one from the other if a legacy client sends only the boolean (drift prevention). New code reads `danaMode` for richer mode info.
- **Public surface is opt-in.** Visibility on `/courses` requires `publishOnPublicCatalog=true`. Onboarding, internal training, and role-assigned courses stay off the public catalog even when active.
- **`accessRestrictionMessage` fallback.** When empty for a role-gated or bundled-no-cohort state, the page shows a derived default from `defaultRestrictionMessage(state)`. Authored per-course messages override.
- **`renderCta` switch** in `app/course/[slug]/page.tsx` is exhaustive over `state.kind`. TypeScript catches missing cases; the `enrolled` branch is unreachable here (`renderEnrolledView` handles it) but must return null for the type system.
- **Hero image fallback.** `course.heroImage || "/images/Bodhi-Leaves.jpg"` (the lowercase `.jpg` — pre-commit reviewer caught a `.jpeg` typo).
- **Categories are seeded by usage**, not by migration. No initial categories exist in the DB; the first one is created via the Categories tab in the CourseEditor.
- **Hero image upload** is a plain URL input. Real upload via Vercel Blob is a follow-up pass; the rest of the editor file follows the pattern lesson editor uses.
- **Drip release** was removed in session 100. The Schedule tab is a placeholder explaining the next slice. Schema fields and cron infrastructure will be added when the design decisions land (release model, locked-lesson UX, email cadence, bundled-with-program behavior).

### Connections — what this touches

**Models:** Course (new flags + content + dana fields), Lesson (untouched), ProgramCourse (read for hybrid detection), SeriesEnrollment (creation source `SELF` for self-enroll, `PROGRAM` for live-cohort), CourseAccess (admin-grant path, unchanged), Donation (new courseId / courseTitle columns), Registration (read for "enrolled via linked program" detection), CourseCategory (now has full CRUD).

**Routes:** `/courses`, `/course/[slug]`, `/lessons/[slug]`, `/account/courses`, `/account/courses/[slug]`, `/tools/learning`, `/tools/learning/new`, `/tools/learning/[courseSlug]`.

**API:** all the endpoints listed above, plus the existing Stripe webhook.

**Auth:** Sign-in code flow (session 119) used for the anonymous → enroll path; no special hooks.

**Email:** `course-dana-receipt` new in `lib/email.ts`. Existing `sendDanaReminderEmail` (programs) untouched; courses don't have a pending-dana reminder pattern yet (open question #1 in `RIM_Offering_Model.md`).

**Other features it connects to:** Course Hub (workspace), Program registration (the hybrid path), Member Library (`/account/courses`), Admin Member Registry (`CourseAccessSection`), Email Template Manager.

**Design principles that govern:** Clear seeing (full landing replaces the impoverished gate). Restraint (one button dominates each state; one source of truth for access). Designed for overwhelmed users (no 404s for restricted states; friendly contextual messages everywhere). Two-scale typography (public editorial 18px on `.rim-content`, admin compact 16px on editor). Mobile-first 360px minimum.

---

## 49. Hub System — Audit Findings + Cleanup ✅ Built — session 115 (2026-05-14)

A systematic inventory of every hub element against the Hosting Hub as the canonical reference. Surfaced four bug classes, three drift points, and one model asymmetry; seven commits shipped. Each is a small, surface-invisible improvement to coherence — no new user-facing feature, but the hub system is materially more correct than it was at session start.

### What changed for users

- **Unread counts and feed lists are accurate.** Dashboard hub card, sidebar Conversations badge, hub Home pinned + recent, and the Conversations page no longer include archived threads, doc threads, or trashed threads in surfaces meant for active hub-level work.
- **The sidebar Manual link only appears when the hub has manual chapters.** No more dead-end click for `courses`, `registrar`, `support`.
- **The sidebar Settings link only appears for ADMIN.** No more "you don't have permission" wall for coordinators.
- **Welcome messages on `courses`, `registrar`, `support`.** Each non-host hub now has a starter welcome in the same practice-grounded voice as the host hub.
- **GUIDING_TEACHER can step into any hub.** Archive a thread, restore a document from trash, edit a member's status — anywhere on every hub — without needing ADMIN.

### What changed under the hood

🔧 **`lib/hubQueries.ts::activeHubThreadWhere(hubId)`** is the canonical filter for active hub-level threads. Returns `{ hubId, documentId: null, deletedAt: null, archivedAt: null }`. Use it for any findMany / count surfacing hub-level threads to members. Six call sites use it: dashboard unread badge, sidebar Conversations badge (`lib/hubContext.ts`), hub Home pinned + recent, Conversations page server load, GET `/api/hub/[slug]/conversations` (default OPEN case).

🔧 **`lib/hubAuth.ts::effectiveCoordinator(member, roles)`** is the canonical "is this user a coordinator?" check. Returns true for `HubMember.isCoordinator || roles includes ADMIN || roles includes GUIDING_TEACHER`. Use it everywhere previously inlined as `(member?.isCoordinator ?? false) || isAdmin`. 14 sites swapped. `requireCoordinator(isCoordinator, roles)` also adds GT bypass. Document-lock override extends to GT alongside ADMIN.

🔧 **`HubConversationThread` archive mechanism mirrors `HubDocument`.** `archivedAt DateTime?` + `archivedById String?` columns added; backfilled `archivedAt = updatedAt` for every existing `status = 'CLOSED'` row. `User.hubThreadsArchived` reverse relation added. The DELETE precondition checks `!thread.archivedAt`; the replies-POST endpoint blocks on `thread.archivedAt || thread.deletedAt`; GET `?status=CLOSED` translates to `archivedAt: { not: null }`. The PATCH status-change handler writes both `status` AND `archivedAt` in lockstep — legacy clients that still read `status` continue to work. A future cleanup can drop the column once nothing reads `status` directly. Migration: `add_archived_columns_to_hub_threads`.

🔧 **Three `slug === "host-team"` literals replaced with `hub.hasSchedule` reads.** `app/account/hub/[slug]/page.tsx` (the Host-hub-specific `HostHubHomeClient` branch), `app/api/hub/[slug]/members/[userId]/route.ts` (hosting-revoke confirmation flow), and `components/HubMembersClient.tsx` (the "Can host sessions" affordance + "Hosting restricted" flag). `HubMembersClient`'s internal `isHostTeam` flag renames to `isHostingHub`.

🔧 **Welcome seeds.** New file `prisma/seed-non-host-hub-home-content.mjs` writes `welcomeBody` HTML strings for `courses`, `registrar`, `support`. Idempotent: only fills when current value is null. Wired into `migrate.mjs` behind flag `seed_non_host_hub_home_content_v1`.

### Pre-existing soft issues surfaced

- The sidebar's "Hub settings" link was rendered for `(isCoordinator || isAdmin)` but the target page `/admin/hubs/[slug]/edit` is strictly ADMIN-only. Coordinators (and after the GT expansion, GT holders) hit a "no permission" wall. Gated the link to ADMIN-only (commit `b86ddf6`). Coordinator-side editing of hub content (welcome / home) for non-host hubs is now an explicit backlog item.

### Documentation deliverables

- `RIM_Role_Design.md` — new section "Guiding Teacher" documenting scope, rationale, and what's deferred.
- `lib/hubAuth.ts` — top-of-file access-policy comment block expanded to enumerate the four helpers (`getHubMembership`, `requireCoordinator`, `effectiveCoordinator`, `canManageTrash`) and the ADMIN-vs-GT distinction.
- `UP_NEXT.md` — four new permanent reminders added (canonical filter, canonical coordinator check, `archivedAt` not `status`, GT scope).
- Backlog: two new items added (drop legacy `status` column once UI reads are migrated; coordinator-friendly hub content editing surface for non-host hubs).

---

## Session Log

| Date | Summary |
|---|---|
| 2026-05-14 (session 115) | **Hub-system consistency audit + seven-commit cleanup.** Systematic inventory of every hub element (sidebar, home, conversations, documents, activity, members, manual, trash, dashboard card) against the Hosting Hub as canonical. Seven fixes shipped to `main`: (1) `571e331` — P1 filter bugs in unread/feed queries: introduced `lib/hubQueries.ts::activeHubThreadWhere(hubId)` as the canonical filter and swapped 5 sites + fixed 2 activity-stream reply queries. Fixed `status: { not: "ARCHIVED" }` (an enum value that doesn't exist), missing `documentId: null` (doc threads leaked into hub feed), missing `deletedAt: null` (trashed threads on Home). (2) `24d049a` — Hub sidebar Manual link hides when the hub has no `ManualSection` chapters tagged. Layout + `/api/hubs/[slug]/nav` pass `hasManual` to `HubWorkspaceSidebar`. (3) `93f9995` — Three sites that did `slug === "host-team"` now read `hub.hasSchedule` instead; `HubMembersClient`'s `isHostTeam` flag renames to `isHostingHub`. (4) `b73cbda` — `GUIDING_TEACHER` acts as implicit coordinator on every hub for content + moderation. New helper `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts`; 14-site sweep of the inline `(member?.isCoordinator ?? false) || isAdmin` pattern; `requireCoordinator` adds GT bypass; document-lock override extends to GT alongside ADMIN. Full role section added to `RIM_Role_Design.md`. (5) `b86ddf6` — Sidebar Settings link gated to ADMIN-only to match the `/admin/hubs/[slug]/edit` page authorization. (6) `ac235d5` — Welcome seeds for `courses`, `registrar`, `support` in the practice-grounded voice. Defensive write — only fills `welcomeBody` when null. New `prisma/seed-non-host-hub-home-content.mjs`. (7) `20ba301` — Archive mechanism unified between threads and documents. New `archivedAt`/`archivedById` columns on `hub_conversation_threads`; backfilled `archivedAt = updatedAt` for every existing `status = 'CLOSED'` row. `activeHubThreadWhere` filters `archivedAt: null`; DELETE precondition + replies-block + GET `?status=` translation all use `archivedAt`. PATCH keeps legacy `status` in sync for backward compat. Schema: `User.hubThreadsArchived` reverse relation added. Full section: §49. |
| 2026-05-14 (session 114) | **Document conversations + unified Activity stream.** (1) **Image overflow fix:** `.rim-content img { max-width: 100%; height: auto; display: block; }` — one line, applies universally to all editor output surfaces. (2) **Document conversations:** `HubConversationThread.documentId` FK added; hub Conversations feed filtered to `documentId: null`; new `GET/POST /api/hub/[slug]/documents/[id]/conversations`; new `HubDocConversationsClient` with compose + thread list; document view page shows meta-row anchor "N conversations ↓" and renders the panel below the card; thread detail page back link is "← Back to [Document]" when `documentId` is set. (3) **Unified Activity stream:** new page `/account/hub/[slug]/activity`, new API `GET /api/hub/[slug]/activity` (cursor pagination), new `HubActivityClient` (four filter pills: All/Documents/Conversations/Mine); computed union of docs + hub threads + hub replies + doc threads + doc replies; Activity sidebar entry added to `HubWorkspaceSidebar`. (4) **Three bug fixes:** wrong `initialContent` → `value` prop on `RimTiptapEditor`; invalid `hubSlug`/`helpNote`/`alreadyNotified` props stripped from `HubDocNotifyPanel` usage; missing DB migration `add_document_id_to_hub_conversation_threads` — column was in schema but not in Neon, causing runtime 500s on all hub pages after deploy. |
| 2026-05-13 (session 113) | **Hub notifications + subscriptions + three-stage delete + host confirmation emails + residue cleanup.** Eight commits. (1) **Per-document notifications**: new `HubDocumentNotification` event-log model, Basecamp-style picker UI with already-notified members shown as disabled `✓ Notified [date]` rows, PDF upload via Vercel Blob (`PDF` enum value added), two new templates `hub-document-created` + `hub-document-updated`. (2) **Notification dedup + email-template backfill**: server-side dedup on `(documentId, userId, eventType)` in all three send paths; audit surfaced four templates referenced by code but never seeded — `session-reminder`, `host-role-assigned`, `sub-request-claimed`, `drip-lesson-available` — backfilled defensively (findUnique → create) so manual `/admin/emails` edits stay untouched; new "Email Template Gate" section added to `CLAUDE.md` as a discipline rule for future templates. (3) **Conversation thread subscriptions**: new `HubThreadSubscription` model replaces implicit "notify coordinators on new thread / notify participants on reply"; author + coordinators + picked members auto-subscribed at creation, replier auto-subscribed (subscribe-by-replying), `+ Notify someone new…` adds subscribers on a reply; `Follow` / `Following ✓` toggle in thread header; backfill migration preserves prior behavior for every existing thread; shared `HubDocNotifyPanel` reused. (4) **Three-stage archive → trash lifecycle**: new `GUIDING_TEACHER` role; documents and threads gain `archivedAt`/`deletedAt` columns; new `canManageTrash(roles, isCoordinator)` helper in `lib/hubAuth.ts`; per-hub `/trash` page (sidebar link gated, server page redirects non-managers, items 404 on direct URL); enforce-archive-first: API DELETE refuses with "Archive this … first" unless archived. (5) **Three-stage enforcement**: after initial implementation, Jesse clarified Delete should only appear on archived items; tightened UI (Delete hidden when `!archivedAt`; thread Move-to-trash hidden unless `isClosed`) and API (matching 400s). Conversations Close → Archive rename, with status change now author-or-coordinator (was coordinator-only). (6) **Host confirmation emails — every path**: audit found that only standing rotations emailed the new host; added `host-assignment-confirmation` template and wired into 5 paths (sub-claim, self-claim, manager-assigns-to-user, PATCH claim, reassign); added `host-assignment-removed` for the displaced host on reassign (fulfills a long-standing TODO in `reassign/route.ts`); every host email now resolves `Program.name` from slug instead of leaking the slug. (7) **Tasks + Alerts residue cleanup**: `hub-task` placement dropped from editor registry; one-time migrations removed; stale `lib/supportNotify.ts` references in template descriptions cleaned; hub-section docs trimmed; Trash row added to the per-hub tab table here. (8) **Support Inbox residue cleanup**: 3 hubLabel maps relabeled `Support Inbox → Support Hub`; 4 obsolete migration entries removed; new `drop_support_notification_template` cleanup migration deletes the orphan email-template row; 2 standalone seed scripts deleted (`prisma/update-manual-system-section.ts`, `prisma/seed-email-templates.js`); `seed-manual.ts` updated to drop SUPPORT and add GUIDING_TEACHER; obsolete backlog items removed; doc refs to `/api/tools/inbox/context` and `/tools/inbox` cleaned. |
| 2026-03-01 | Built complete registration system: RegistrationForm, volunteer admin table, API routes, DB schema (roles array, Registration model), Sanity schema fields, route protection, staff dashboard panel, mobile-friendly volunteer pages; added FEATURES.md |
| 2026-03-01 | Registration confirmation emails via Resend (`lib/email.ts`) — HTML + plain-text, REGISTERED and WAITLISTED variants, includes program date/time/location when available |
| 2026-03-01 | Status change confirmation step in volunteer table (select → pending → Confirm/Cancel); WAITLISTED→APPROVED transition auto-sends approval email via `sendApprovalEmail()` |
| 2026-03-02 | Fixed approval email not sending: condition expanded to include WAITLISTED→REGISTERED (not just WAITLISTED→APPROVED); root cause was Resend v4+ `{ data, error }` return pattern — `try/catch` never fires on Resend errors, must check `error` field explicitly |
| 2026-03-02 | Designed full dana + Stripe integration (Section 4c) and Donation Management System (Section 11); documented dana philosophy, four dana modes, Stripe metadata for QuickBooks, Donation DB model, future TREASURER role and management UI |
| 2026-03-02 | Implemented full Stripe dana integration: installed stripe SDK, lib/stripe.ts singleton; Sanity schema dana group (danaMode/suggestedDana/danaBaseAmount/danaFixedAmount/danaMessage replacing suggestedDonation); Prisma TREASURER role + Donation ledger model; /api/stripe/checkout + /api/stripe/webhook routes; RegistrationForm dana step UI (voluntary/base_plus_dana/fixed modes, skip for voluntary); /api/registrations danaMode handling (WAIVED status for none mode); program page ?dana=success/cancelled banners; pg-dana* CSS |
| 2026-03-02 | Waitlist promotion + cancellation flow: PATCH endpoint auto-sets donationStatus on promotion (PENDING if dana, WAIVED if none); approval email updated with dana section (hasDana flag); new sendCancellationNotificationEmail() to registrar on any cancellation (REGISTRAR_EMAIL env var); VolunteerTable dropdown replaced with context-aware Promote/Cancel/Restore buttons; RegistrationForm shows dana step for promoted waitlist members with existingDonationStatus===PENDING; dashboard shows pending dana reminder card linking to program page; vol-action CSS and db-dana-reminder CSS added |
| 2026-03-02 | Registrar inline edit + self-service edit link: PATCH accepts customFields; VolunteerTable inline edit mode with per-field save; editToken + editTokenExpiresAt added to Registration schema (db push); sendEditRequest action in PATCH handler; sendEditRequestEmail + sendResponsesUpdatedEmail in lib/email.ts; new /update/[token] server page + UpdateForm client component + /api/update/[token] POST route |
| 2026-03-03 | Removed hardcoded comments field (prisma db push --accept-data-loss, 9 files); moved Edit button inline with RESPONSES column header (vol-detail__col-header flex); field-type-aware inline edit mode (yesNo→select, select→select with program options, longText→textarea; registrationFields fetched from Sanity in volunteer page + passed as prop); per-program confirmation email CMS message (confirmationMessage Sanity field, restricted block, email-safe; new lib/portableTextEmail.ts with @portabletext/to-html; warm tinted box in HTML email); Sanity programs schema reorganized into 6 logical tabs (Content / Schedule & Location / Registration / Dana & Payment / Dashboard / Sorting & Visibility); fixed TypeScript build error in portableTextEmail.ts (HC type alias — library types children as string\|undefined) |
| 2026-03-03 | VolunteerTable action safety: inline confirm dialogs added to "Send Edit Request" and "Send Reminder" (matching Cancel pattern); all three confirm "Yes" buttons use vol-action-btn--danger (red); "Send Reminder" button always stays visible after sending — "Reminder sent [date]" badge renders below it (allows re-sends; reminderSentAt stores most recent timestamp) |
| 2026-03-03 | Reminder email system: reminderDate (datetime) + reminderMessage (restricted block) added to Sanity programs Registration tab (deployed); reminderSentAt DateTime? added to Registration model (db push); sendReminderEmail() in lib/email.ts; action "sendReminder" added to PATCH /api/registrations/[id]; new bulk POST /api/programs/[slug]/send-reminder; new daily cron GET /api/cron/send-reminders (validates CRON_SECRET Bearer header, 24h lookback window); vercel.json created with cron schedule 0 14 * * *; VolunteerTable program-level reminder banner (scheduled date, sent/total count, "Send to Remaining N" button, "All sent ✓") + per-row "Send Reminder" button / "Reminder sent [date]" badge with optimistic UI (localReminderSentAt); vol-reminder-* CSS; ⚠️ CRON_SECRET env var must be added to Vercel |
| 2026-03-03 | Member management system: /admin/members list page (search by name/email, role filter, member count); /admin/members/[id] detail page (edit profile, assign roles via checkboxes, registration history); proxy.ts adds /admin/:path* auth guard; API GET/PATCH /api/admin/members + /api/admin/members/[id] (ADMIN-only); POST /api/admin/members/import CSV upsert (Memberstack column mapping, fills blank fields only, never overwrites, returns created/updated/skipped counts); MemberImport client component (CSV parse, preview, import flow); dashboard STAFF_LINKS refactored to array-of-links per role — ADMIN now shows both Registrations + Members cards; adm- CSS prefix |
| 2026-03-03 | Course access system: Sanity courses schema — added `accessLevel` field (members/registration_required, default members); Sanity programs schema — added `linkedCourses` **array** reference field (multiple courses per program); Prisma `CourseAccess` model (`@@unique([userId, courseSlug])`, `grantedBy`, db push); proxy.ts adds `/course/:path*` auth guard (singular — existing route); access-gating logic added to existing `app/course/[slug]/page.tsx` (force-dynamic, 2-step check: Sanity linked programs → DB registration → DB CourseAccess grant); new `app/api/admin/courses/route.ts` GET (ADMIN-only, returns all courses enriched with `linkedByPrograms` via reverse GROQ ref `^._id in linkedCourses[]._ref`); new `app/api/admin/members/[id]/course-access/route.ts` POST/DELETE; new `components/CourseAccessSection.tsx` — full searchable course list with per-course status badges (All Members / Via Registration / Manual Grant / No Access), inline grant/revoke with warning dialogs, per-course state machine; MemberDetail updated to render `<CourseAccessSection>` (replaced old slug-input form); `lib/queries.ts` — `courseBySlugQuery` adds `accessLevel`; `programsLinkedToCourseQuery` uses array filter `$courseSlug in linkedCourses[]->slug.current`; new `allCoursesWithLinkedProgramsQuery`; `ca-` CSS prefix for CourseAccessSection; Sanity deployed; `essential-dharma-study-resources` set to `accessLevel: members` in Sanity Studio |

---

| 2026-03-03 | Course access system iteration: discovered and deleted duplicate `/courses/[slug]` page (had created wrong plural route — correct existing route is `/course/[slug]` singular); corrected proxy.ts from `/courses/:path*` to `/course/:path*`; changed `linkedCourse` (single ref) → `linkedCourses` (array of refs) in programs.js Sanity schema before any content was added; updated all GROQ filters to array syntax; replaced bare slug-input grant form with full `CourseAccessSection` component (searchable list, per-course status badges, inline warnings, per-course state machine); added `GET /api/admin/courses` endpoint; `allCoursesWithLinkedProgramsQuery` with reverse GROQ ref; FEATURES.md Section 12 fully rewritten, Section 11 updated with Course Access |

---

| 2026-03-03 | Community onboarding redesign: documented membership philosophy (Section 14); agreedToTerms + agreedAt on User model (db push); auth.ts session callback adds agreedToTerms; proxy.ts redirects to /account/welcome if agreedToTerms false; /account/welcome page (WelcomeForm client component, name required, phone optional, agreements checkbox, warm community voice, explicit decline path); /api/account/complete-profile POST (save profile + set agreedToTerms) + DELETE (delete account on decline); registration API updated (writes firstName/lastName/phone back to User, sets agreedToTerms if checkbox checked); login page reframed as "Join or sign in"; registration form adds agreements checkbox for non-logged-in users; cleanup cron /api/cron/cleanup-incomplete-accounts (48h, CRON_SECRET); wl- CSS prefix |

| 2026-03-03 | Site cleanup + administration tools: repurposed `/community-membership` (removed Memberstack signup form, now shows full 4-point Community Care Agreements + "Join or sign in →" button); added "Read our full community care agreements →" link from WelcomeForm and RegistrationForm agreements blocks; audited and fixed all nav/site links that referenced the old Memberstack signup flow (Nav desktop "Join Us" sub-text, MemberGate.tsx two-button pattern, volunteer page, kalyana-mitta application page, magazine-articles gate); created `/admin/sitemap` Site Architecture page (ADMIN-only; 10 sections, access badges, CSS layer indicators, status chips — stub/orphan/repurposed, "Not Yet Built" section); added admin nav links (Members + Site Architecture) to Nav.tsx; removed class recording CMS template entirely (deleted page, queries, cr- CSS block); removed "Intentionally Decommissioned" section from sitemap (served its purpose — no ongoing value); updated Section 10 (CSS prefixes), added Section 15 (Site Administration Tools) to FEATURES.md; updated pages-inventory.md |

| 2026-03-03 | Member dashboard redesign (session 15): Redesigned `/account/dashboard` as a visual hub with 5 nav cards (`db-` CSS extensions); created `My Programs` page (`/account/programs`, `mr-` prefix) — new feature showing member registration history with status badges, waitlist position, and pending dana prompts; new `GET /api/account/registrations` endpoint; `programsBySlugArrayQuery` GROQ query for batch slug lookup; rebuilt `My Library` (`ml-`), `My Profile` (`mp-`), `Community Agreements` (`mc-`) with 🟢 design system (dropped all Webflow classes); added "My Programs" link to Nav.tsx (desktop dropdown + mobile flat list); updated FEATURES.md Section 6 + pages-inventory.md (14/31 🟢) |
| 2026-03-04 | Nav component rebuild (session 16): Complete rewrite of `components/Nav.tsx` — eliminated all Webflow structural classes (`w-nav`, `w-dropdown`, `w-nav-menu`, `w-nav-button`, etc.); deleted `public/nav.js` (Webflow JS hamburger handler); new `nav-` CSS prefix block in `custom.css`; sticky header (`position: sticky`); desktop dropdowns via CSS `hover + focus-within` (no JS); React `useState` hamburger with 3-bar → X animation; closes on route change + Escape key; `isMemberArea` flag switches between minimal member nav and full public nav; `isAdmin` controls Admin dropdown visibility. Nav polish: Quincycf 500 brand name, `--rim-text` (#333) color; Open Sans 500 links; no borders anywhere (color contrast only); nav height 90px; hover states set both `color` and `background` explicitly; mobile menu overhauled — `--rim-bg` warm background, `--rim-bg-accent` separator lines between items, pill donate button; Added Section 16 to FEATURES.md; updated Section 10 CSS prefix table; updated MEMORY.md + session-log.md |
| 2026-03-04 | Sanity Studio access for staff (session 18): `sanityInvitedAt DateTime?` on User model (db push); new `POST /api/admin/members/[id]/sanity-invite` — ADMIN-only, calls Sanity Management API to invite member as editor, stamps invite date; PATCH route updated to auto-revoke Sanity access when REGISTRAR role is removed — calls `revokeSanityAccess()` async (removes from project members + cancels pending invitations, clears `sanityInvitedAt`), returns `sanityRevoked: true`; MemberDetail: Sanity Studio Access panel below roles (invite button with two-step confirmation showing explanation + Yes/Cancel; ✓ invited date once sent; revocation warning in save bar when REGISTRAR is being removed); dashboard `STAFF_LINKS` updated — Sanity Studio external card for REGISTRAR + ADMIN, `<a target="_blank">` for external vs `<Link>` for internal; Section 2 updated (roles table shows dashboard links, role assignment via UI documented); Section 11 dashboard integration updated; Section 18 added (full feature doc). ⚠️ Requires `SANITY_MANAGEMENT_TOKEN` in Vercel. Commits: deb0b97, 5e97804. |
| 2026-03-04 | Sanity Studio access debugging (session 19): Fixed invite endpoint URL — Sanity uses `/invitations/project/{id}` not `/projects/{id}/invitations` (404 → working); fixed `SANITY_MANAGEMENT_TOKEN` role — must be **Developer** (highest available), not Editor/Administrator (403 "missing required grant sanity.project.members/invite"); improved error surfacing in invite route (raw text fallback instead of silent `{}`); made `revokeSanityAccess()` blocking (was `void`), returns `{ member, invite, memberEmails }` for debugging; fixed invitation revocation response shape (array or `{invitations:[]}`); confirmed pending-invite cancellation works end-to-end; confirmed accepted-member removal endpoint path is still unresolved (all tried paths 404); documented owner limitation (project owner cannot be removed via API) and email-mismatch risk (registrar accepts invite with different Sanity account email). Section 18 prerequisites, technical notes, and last-updated updated. |
| 2026-03-04 | Registration form UX + security hardening (session 17): (1) Sanity program category field UX — added description, `disableNew: true`, `filter: "hideFromProgramsPage != true"` so the dropdown shows immediately; renamed `hideFromProgramPageList` title + added description; Sanity deployed. (2) Fillout legacy removal — removed `registrationRequired`, `filloutRegistrationFormId`, `signedOutInstructions`, `signedInInstructions` from programs page, GROQ queries, and Sanity schema; wired `registrationClosed` boolean into built-in form path (combines with `registrationDeadline` check); commit fa1464e. (3) Email recognition — new `GET /api/account/check-email` (public, returns name/phone/agreedToTerms for known emails); `handleEmailBlur` in RegistrationForm pre-fills from account and shows "Welcome back, [Name]!" notice; pre-fill logic uses account values first (`data.firstName || prev.firstName`); commits 08fe82d → eadb5e7 → 16aca2e. (4) Security — name + phone fields locked `readOnly` in form when recognized account found (`emailCheckStatus === "found"`); API introduces `resolvedFirstName`, `resolvedLastName`, `resolvedPhone` — account stored values always win for existing users regardless of form submission; `pg-form__input[readonly]` + `pg-form__input--locked` CSS; commits ef515d6 + 7b75eba. (5) Dana $0 bug fix — `effectiveDanaMode` sent to API is `"none"` when fixed/base amount not configured (→ `donationStatus: WAIVED`); `hasConfiguredAmount` guard skips dana step in form; commit acbdadd. (6) Documentation — FEATURES.md Sections 4a, 4c, 8, 9 updated; new Section 17 (Planned Features) added with 17a (automated dana follow-up cron), 17b (member cancellation self-service), 17c (self-service email change cross-ref). |
| 2026-03-04 (session 20) | Add-to-calendar links (17e), resend confirmation email (17g), CSV export doc (17h already built): New `lib/calendarLinks.ts` — `buildGoogleCalendarUrl`, `buildIcsUrl`, `buildIcsContent` utilities; Sanity programs schema gains `startDatetime` + `endDatetime` datetime fields in schedule group (calendar links only appear when startDatetime is set — recurring programs leave it blank); Sanity Studio deployed. New `GET /api/programs/[slug]/ical/route.ts` returns RFC 5545 `.ics` file for Apple/Outlook download. `lib/email.ts` adds `googleCalendarUrl` + `icsUrl` to `RegistrationEmailData` — calendar links block rendered in HTML email (Google Calendar + Apple/Outlook links, waitlisted registrations excluded); `lib/queries.ts` adds `startDatetime`/`endDatetime` to `programBySlugQuery` + new `programConfirmationDataQuery`. `app/api/registrations/route.ts` fetches `startDatetime`/`endDatetime` from Sanity and passes calendar links to confirmation email. `app/programs/[slug]/page.tsx` shows "+ Google Calendar" and "+ Apple / Outlook" links below "✓ You're registered." when startDatetime is set. `components/VolunteerTable.tsx` adds "Resend Confirmation" action button for REGISTERED/APPROVED rows — two-step inline confirm dialog ("Resend confirmation to [firstName]?"), calls PATCH `action: "resendConfirmation"`; `app/api/registrations/[id]/route.ts` adds resendConfirmation action (fetches Sanity program data, builds calendar links, calls `sendRegistrationEmail`). CSV export (17h) confirmed already built in earlier session — `GET /api/programs/[slug]/registrations?format=csv` with dynamic custom field columns; VolunteerTable CSV button already present. CSS: `.pg-calendar-links`, `.pg-calendar-link`, `.vol-action-btn--resend`. FEATURES.md sections 17e, 17g, 17h updated to ✅ Built. Commit: 2da2796. |
| 2026-03-05 (session 21) | Calendar recurrence + Google Meet planning: Added `recurrencePattern` string-select field to Sanity (15 options: daily/weekly/monthly variants). `lib/calendarLinks.ts` gains `buildRRule()` + `describeRecurrence()`. Renamed Sanity `zoomLink`/`zoomLinkText` titles to "Meeting Link" / "Meeting Button Text". Added FEATURES.md Section 19 (Google Meet Integration full spec). Sanity deployed. Commits: 544ddb1, ad5e472. *Note: recurrencePattern immediately superseded in session 22 — see below.* |
| 2026-03-09 (session 34) | **Auto-generated date/time labels:** New `lib/dateLabel.ts` — `buildDateLabel(p)` computes a human-readable schedule string from structured Sanity fields (`startDatetime`, `endDatetime`, `recurrenceFreq`, `recurrenceInterval`, `recurrenceDays`) using `Intl.DateTimeFormat` in `America/Chicago`. Recurring patterns use plural day names for clarity ("Thursdays · 7–9pm CT", "Mondays & Wednesdays · 6:30–8pm CT"). Every-other-week = "Every other Thursday", N>2 weeks = "Every 3 weeks on Thursday". Single events show "Saturday, June 14 · 10am–4pm CT"; multi-day retreats show "Fri, Jun 13 – Sun, Jun 15 CT". The `dateText` Sanity field becomes an optional override — blank = auto-generated; filled = override shown everywhere. Sanity field retitled "Date & Time Label (override)" with descriptive helpText. Six GROQ queries updated to fetch the five structured datetime/recurrence fields alongside `dateText` (programsQuery, dashboardProgramsQuery, programReminderDataQuery, programsWithReminderInWindowQuery, programsBySlugArrayQuery, hostProgramsQuery). All consumer pages use `dateText || buildDateLabel(program)` fallback pattern: `app/community-programs/page.tsx`, `app/account/dashboard/page.tsx`, `app/account/programs/page.tsx`, `app/account/host/page.tsx`, `app/programs/[slug]/page.tsx`. All email API routes updated with same fallback: `app/api/registrations/route.ts` (initial confirmation), `app/api/registrations/[id]/route.ts` (sendReminder + resendConfirmation actions), `app/api/cron/send-reminders/route.ts`, `app/api/programs/[slug]/send-reminder/route.ts`. Manual: "Date & Time" field doc rewritten as optional override; creating/updating program steps updated to remove manual label writing. Sanity Studio deployed. Commit: 5bd7fd2. |
| 2026-03-09 (session 33) | **Google Meet + programFormat + venue (three related features):** **(1) Meet orphan fix:** POST `/api/programs/[slug]/google-meet` now deletes old calendar event before creating a new Meet when one already exists — prevents orphaned room bookings. Fetches `calendarEventId` + `meetHostAccount` from Sanity in the pre-create query; calls `deleteCalendarEvent()` (non-fatal if old event already gone). **(2) isVirtual → programFormat refactor:** Replaced `isVirtual` boolean with `programFormat` radio (In-person / Virtual / Hybrid) across Sanity schema, GROQ queries, webhook handler, registrar page, host area query. `programFormat === "in-person"` triggers calendar event deletion in webhook. Meet section in registrar area now shows for `virtual` or `hybrid`. `CreateMeetButton` simplified: dropped Replace + Release states; replaced with single "Remove Meet" (confirm dialog) — 5-state machine (idle/loading/done/remove/removing). **(3) Venue/location system:** New `lib/locations.ts` — `RIM_NAME`, `RIM_ADDRESS`, `RIM_MAPS_URL`, `RIM_EMAIL_LOCATION` constants + `resolveLocation(venue, locationText, locationLink)` helper → `{ text, link, emailText }`. New `venue` radio field in Sanity (At RIM / Other location, default "at-rim") — hides `locationText`/`locationLink` for "at-rim"; only shown when programFormat is not virtual. Program detail page "Where" row driven by `resolveLocation()` — hidden for virtual programs; "at-rim" shows RIM name + Google Maps link automatically. All confirmation emails, reminder emails, resend confirmation, and iCal download updated to use resolved location. Five GROQ queries updated to include `venue`. Commits: dcbeb7d (rim-next), f33c7da (rim-website Sanity). |
| 2026-03-05 (session 22) | Zoom-style recurrence fields: Replaced the fixed 15-option `recurrencePattern` select with four structured fields that give unlimited flexibility — identical to how Zoom and Google Calendar handle recurring events. **Sanity schema** (`programs.js`): `recurrenceFreq` (radio: Daily / Weekly / Monthly; blank = single event), `recurrenceInterval` (number: "every N days/weeks/months"), `recurrenceDays` (array checkboxes: SU MO TU WE TH FR SA — hidden unless Weekly), `recurrenceCount` (number: total sessions including first). Fields show/hide conditionally so the form stays clean — `interval` and `count` hidden when no freq set, `days` hidden unless weekly. **`lib/calendarLinks.ts`**: `CalendarEvent` interface gains the 4 fields; `buildRRule()` rewritten to compose full RFC 5545 RRULE — `FREQ` + optional `INTERVAL` + optional `BYDAY` (weekly only) + `COUNT`; `describeRecurrence()` signature changed from `(pattern)` to `(freq, interval, days, count)` — returns `{ googleLabel, icsLabel }` for UI. **All consumers updated**: `lib/queries.ts` (`programBySlugQuery` + `programConfirmationDataQuery`); `app/api/programs/[slug]/ical/route.ts`; `app/api/registrations/route.ts` (inline GROQ); `app/api/registrations/[id]/route.ts` (resendConfirmation); `app/programs/[slug]/page.tsx` (Program interface + IIFE in JSX). TypeScript clean, Sanity Studio deployed, committed 85666df. **Example RRULEs**: daily/3 → `RRULE:FREQ=DAILY;COUNT=3`; weekly Wed/4 → `RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=4`; bi-weekly Sat/12 → `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;COUNT=12`. Apple/Outlook .ics includes full RRULE (all sessions); Google Calendar URL shows first session only (GCal URL format limitation) — labels differentiate clearly. |
| 2026-05-13 (session 112) | **Host hub: LiveKit room gap fix + Enter room link.** Two connected changes. (1) `POST /api/programs-pg` now auto-sets `livekitRoom = slug` for virtual/hybrid programs at creation; `PUT /api/programs-pg/[slug]` backfills it when `programFormat` changes to virtual/hybrid and the field is null. Closes a silent gap: new virtual programs had `livekitRoom = null`, causing the member program detail page to show "Session link will appear here when available" even though the actual room worked fine (token API uses slug, not `livekitRoom`). (2) Every upcoming virtual/hybrid session row in `HubScheduleClient` now shows a small "Enter room →" link (opens new tab) below the format label. Always visible — no time gate — so hosts can test audio/camera setup beforehand or arrive 10–12 minutes early to hold the welcoming space. (3) `host-schedule` manual chapter v5: new "For virtual and hybrid sessions — entering the room" section (`update-manual-host-schedule-v4.mjs`, flag `update_manual_host_schedule_v5`). CSS: `.hs-row__join` (13px, muted blue, 70% opacity at rest). |
| 2026-05-07 (session 107) | **Training session preparation: `TRAINING_PLAN.md` + hub training document.** `TRAINING_PLAN.md` created in repo root — Jesse's operational reference from coordinator onboarding through Zoom cancellation by June 17. Covers: Maria onboarding sequence, pre-pilot smoke test (7-phase checklist: LiveKit env via `/admin/livekit-test`, hub/manual routes, schedule tool with programFormat/member-picker/Rotations tab visibility check, HubMember communicationsEnabled check, email template verification, two-window session room host controls test, cron manual trigger at `/api/cron/apply-standing-assignments`), pilot session structure, full-team live exercise (6 rounds: audio prompt, Mute All, Step in as Host, per-participant mute, End for All drill, sub-request flow), between-training period, cutover protocol (5-day buffer before June 17 for Zoom cancellation), post-cutover tasks, open questions. Hub training document "Training Session — May 2026" seeded into host-team hub (new "Training" category) via `prisma/seed-host-hub-training-doc.mjs` — sent to hosts in advance as a reference. Content: what's changing (LiveKit vs Zoom rationale), what to read beforehand (4 manual chapter links), training agenda, post-training period, cutover dates table with [TBD] placeholders. `seed_host_hub_training_doc_v1` flag in `migrate.mjs`. `HOSTING_HUB_READINESS.md` closed out. |
| 2026-05-07 (session 106) | **Host manual completion: first-week chapter, role design update, coordinator schedule guide (B2–B4).** Three HOSTING_HUB_READINESS.md "build before training" items closed. **(B2) host-first-week chapter:** New `ManualSection` seeded via `prisma/seed-manual-host-first-week.mjs` (plain HTML, post-Tiptap format). Five sections: right after you join, before your first session, during and after, the first month, when questions come up. Placed first in the host-team manual group (`lib/manualGroups.ts`). Relations: host-hub, host-schedule, host-session-room. `seed_manual_host_first_week_v1` flag in `migrate.mjs`. **(B3) RIM_Role_Design.md Virtual Host section refreshed:** Google Meet replaced with LiveKit/session room throughout. Technical dimension updated to describe the actual session room (join from schedule, host controls, Step in as Host). "What the system needs to support" updated to reflect current state: live view designed and removed session 89 (D1–D2), post-session form never fully built (D3), automated emails never operationalized (D4). D1–D4 entries added to "What's deferred and why." Phase 1 scope subsection removed (pointer was dead-ended). Design decisions and relational/pastoral framing preserved. **(B4) host-schedule coordinator section:** "For coordinators" section appended to existing chapter via `update-manual-host-schedule.mjs` (v3). Three subsections: member picker as situational awareness tool (framed as "the same picker you saw in the host orientation; here's how coordinators use it differently" — not coordinator-exclusive), Rotations tab (coordinator-only, references host-rotations chapter), Reassign to me (coordinator-only on covered sessions, describes side effects: previous host removed and notified, open sub-request closed). `update_manual_host_schedule_v3` flag in `migrate.mjs`. |
| 2026-05-07 (session 105) | **Session room manual chapter v3 + help icon (T2).** `update-manual-host-session-room.mjs` rewritten: adds the twelve-minute pre-session section (relational/pastoral dimension from `RIM_Role_Design.md`, absent in v2), Step in as Host as its own section (distinct audience — host-team members who aren't the assigned host), Fullscreen in what-you-see, clearer navigation path, explicit host-vs-teacher framing. `ManualSection.description` updated. `?` help icon added to session page header (`app/session/[slug]/page.tsx`) — visible to `isHostTeam` members only; links to the chapter; dark-themed `.vs-header__help` CSS. Backlog entry added: architectural question on Step In gate vs. automatic host capability for all host-team members (post-cutover). |
| 2026-05-07 (session 104) | **HOST_MANAGER welcome email + paused host badge.** `sendHostManagerRoleAssignmentEmail()` added to `lib/email.ts` and wired in `/api/admin/members/[id]/route.ts` — fires when `HOST_MANAGER` is newly added to a member's roles. Coordinator-appropriate copy linking to hub, schedule, and manual; inline markdown → HTML pipeline (no template manager). Paused host badge on schedule covered rows: `hostBadge: "paused" | "inactive" | null` computed in schedule page + assignments API (single `hubMember.findMany` per request, no N+1); `HsRow` renders amber pill beside the host name; `--color-warning` + `--color-warning-bg` tokens used (no new CSS variables). Both items were `HOSTING_HUB_READINESS.md` action items T1 and B1. |
| 2026-05-07 (session 102) | **Theme A closure; editor toolbar polish; hub document export bug fixed.** (1) **Webflow bridge removal complete.** Code items (#1–3: rim-connect.js, public-bridge API routes, CDN cache headers) confirmed already removed. Manual items (#5–6: Webflow Site Settings head code, staged pages /rim-next/Programs and /untitled/program-detail) removed by Jesse in Webflow Designer. CLEANUP.md Theme A closed. (2) **Editor toolbar polish.** Bubble menus (message + document) no longer duplicate the top toolbar's structural elements — bubbles are now inline-marks-only: B · I · U · S · Code · Highlight · Link. DocumentBubble retains H2/H3/H4 (heading-level conversion is a selection-driven action; starting a new heading is a toolbar action). Dharma dropdown icons fixed: Pull quote → Quote icon, Practice suggestion → Footprints, Dharma trigger → BookOpen (all four entries now visually distinct). Dead `TDropdown` props removed from interface and all call sites. Mobile: `.rt-bubble__btn` gets 36px touch targets on `@media (max-width: 768px)` (floating context menu; 44px would overflow the viewport with a full button set). (3) **Hub document export bug fixed** (`app/api/hub/[slug]/documents/[id]/export/route.ts`). The export route assumed `doc.body` was always a BlockNote JSON array. After the Tiptap migration, `doc.body` is an HTML string — calling `.map()` on it throws at runtime; anyone exporting a post-migration document got nothing. Route now branches: HTML string → exports as `.html`; BlockNote JSON array → existing Markdown converter, exports as `.md`; null → `(No content)` fallback. CLEANUP.md item #54 resolved and removed. |
| 2026-05-06 (session 101) | **Theme F: documentation sync pass across five root docs.** Full correction of drift from sessions 96–100. `RIM_Hub_Model.md`: hub count corrected (14 + 2 governance), Tasks section removed, UserHubAccess removed, Support Hub tools cleared, core sections updated 5 → 4, RimProseEditor → RimTiptapEditor, BlockNote JSON → HTML. `RIM_Feature_Interconnections.md`: Tasks removed, Support Inbox section deleted, Editor System rewritten (Tiptap primary), Email System consolidated (one pipeline), Inter → Open Sans (CSS). `RIM_System_Architecture.md`: s73-vs-s76 Registrar Hub inconsistency resolved, hub count updated, /tools/inbox removed. `FEATURES.md`: Phase 2 scaffolding models removed from §7, Memberstack import removed from §11, Support Inbox §29 PARKED → REMOVED, Site-Wide Banner §36 marked removed, AlertStrip §35 corrected. `RIM_Stack_Reference.md`: Support Inbox/drip/banner/Gmail API/SUPPORT role all marked removed. |
| 2026-05-06 (session 100) | **Theme D + Theme E: direct code residue and decision-needed items removed.** Theme D: `missing-reports` cron removed from `vercel.json`; four broken redirects updated to `/tools/programs` and `/tools/programs/:slug`; `/admin/manual/editor` removed. Theme E: **Support Inbox** removed entirely (routes, lib files, schema models `SupportThread/SupportMessage/SupportNote/SupportTemplate`, Support Hub app links, SUPPORT role). **Course drip system** removed (schema columns, `lib/drip.ts`, `drip-release` cron, all drip UI in CourseEditor + LessonEditor). **Site-Wide Banner** removed (`/admin/banner/`, `SiteBannerStrip`, schema models, API routes). **UserHubAccess** removed (HubMember is authoritative). **/admin/editor-lab** removed. **Memberstack CSV import** removed (`MemberImport.tsx`, import route, `legacyMemberstackId` field). **Phase 2 scaffolding** removed (`MembershipType`, `UserMembership`, `AttendanceRecord` and enums). Kept: `UserToolAccess` (future use, Neon console), `sectionGrants String[]` (future hook), `Donation` table (active write-only ledger). Mid-session hot-fix: broken anchor tag in `CourseEditor.tsx` (missing `a` after `<`) caused Vercel build failure; fixed and pushed before continuing. |
| 2026-05-06 (session 99) | **Manual reorganization + Hub Documents + chapter rewrites + drift catch-up.** Three concurrent threads. (1) **Six new Hub Documents** seeded into host-team across four new categories (Practice of Hosting · Running a Session · When Things Go Wrong · For Coordinators) — Host Role, Stewardship Practices, Quick Start, Sub Coverage, Disruption Response, Coordinator Playbook. (2) **Manual chapters rewritten** in plain language (8th-grade reading level, no jargon, "the host coordinator" generically) — `host-hub`, `host-hub-team-management`, `host-schedule` rewritten; new chapters added: `host-rotations`, `host-session-room`, `conversations` (system-wide). (3) **Manual surfacing inside hubs:** new `/account/hub/[slug]/manual` route lists hub-tied chapters; "Manual" item added to `HubWorkspaceSidebar`; `?` icon on host hub home + shared HubHomeClient (courses/support/registrar). Manual index reorganized with audience groups (`lib/manualGroups.ts`); chapter pages get hub-aware back-link with `?from=<slug>` query param. **Option-C drift pass** on the four older chapters (support-inbox, course-hub, registration, programs). **Option-B full rewrites** of `programs` and `registration` chapters built from a careful walk of the Program Editor / VolunteerTable UI. **Major drift caught and corrected mid-session:** Tasks documented as existing but removed in session 96 (commit ea9d868); Support Inbox documented as live but parked since session 88; Google Meet documented as the video platform but replaced by LiveKit in session 86. Section 19 (Google Meet) marked as REPLACED, Section 29 (Support Inbox) marked as PARKED in this session. **The pattern surfaced:** closing ritual had not been done thoroughly across recent sessions, producing compounding documentation drift; the fix is the practice, not new tooling. |
| 2026-04-29 (session 98) | **Standing Host Assignments + Host Schedule visual tidy.** New Section 45. `StandingAssignment` schema; `lib/applyStandingAssignments.ts` idempotent core logic; `/api/host/standing-assignments` GET/POST/DELETE + `apply` route; daily cron `0 8 * * *` for forward-fill through end-of-year (default horizon). `RotationsClient.tsx` UI: one card per recurring program, day × occurrence grid (1st–5th), four patterns (Same / Alternate / Pair / Custom), 5th-week host field, end-date, conflict-resolution modal, ADMIN-only "nuclear reset" danger zone. Host Schedule visual tidy: 3-column row grid, `hs-row__right` wrapper, covered-row left border visible at `#ddd`, "needs a host" amber resolved, quiet link → pill button. Notification email via `after()` from `next/server`. |
| 2026-04-28 (session 97) | **Tiptap migration phases 2–4 complete; BlockNote deleted; selection bubble menu.** Phase 2: HTML renderer plumbing (`lib/renderRichContentTiptap.ts` with sanitize-html allowlists per variant), `Hub.welcomeBody` / `Hub.homeContent` / conversation threads + replies migrated. Phase 3: lazy migration on edit for HubDocument, ManualSection, LessonEditor body, ProgramEditor description. Phase 4: 13 remaining `RimProseEditor` surfaces (BioSection, AdminNotesSection, AboutMeSection, LessonNoteEditor, HouseholdDetail, HubScheduleClient, VolunteerTable, CourseEditor, LessonEditor reflection-question, ProgramEditor messages, SupportInboxClient × 3 drafts, SupportSettingsClient, banner page). Editor UX pivot: sticky toolbar → selection bubble menu (Tiptap `BubbleMenu`, what Medium/Substack/Notion all use); top toolbar trimmed to insertion-only actions (image, table, hr, callouts, dharma blocks). Cleanup commit deleted `RimBlockEditor`, `RimProseEditor`, `FormatPill`, `blockNoteCustomBlocks`, `blockNoteTheme`; npm-removed `@blocknote/{core,mantine,react,server-util}`. Net −5,734 lines in working tree. Format detection in renderers (`isHtmlString` / `isBlockNoteJSON` / `isRawHtml`) keeps unmigrated rows displaying correctly. |
| 2026-04-27 (session 96) | **Tasks + Alerts modules both removed entirely; conversation categories editable; Tiptap migration Phase 1; sub-request email fixes.** **(0) Tasks gone (commit ea9d868).** Tasks were never adopted in practice and added complexity to every hub template. Schema dropped (`TaskList`, `Task`, `Subtask`), all `/api/hubs/[slug]/tasks/**` routes deleted, `app/account/hub/[slug]/tasks/page.tsx` deleted, `HubTasksClient.tsx` deleted, `task-reminders` cron removed from `vercel.json`, `TASK_*` values pruned from `AlertType`. **(1) Alerts gone.** `Alert` model + `AlertType` enum deleted; `/api/account/alerts` route + `check-unassigned-hosts` cron deleted; every `db.alert.*` write stripped from sub-request POST/claim, host-assignment claim/unclaim/reassign, programs-pg POST, and `lib/supportNotify.ts` (the 5-minute alert-based dedup in supportNotify went too — its only consumer was the alert write). Migration `remove_alerts_module` drops the table + enum. The bell UI it was built for never shipped, so this was pure removal. **(2) Editable conversation categories.** Any active hub member can add/rename `Hub.conversationCategories`; coordinators can also delete (delete reassigns existing threads to `General` if it exists else the first remaining). New `app/api/hub/[slug]/categories/route.ts` POST/PATCH/DELETE. **(3) "What's new" panel removed from host hub home** (loader + panel + types + CSS all gone). **(4) Sub-request email — both bugs found and fixed.** (a) `NEXTAUTH_URL` on Vercel had a trailing space → every email link rendered as `https://rim-next.vercel.app /tools/schedule?…` and the markdown link truncated at the literal space. Defensive fix: every `BASE_URL` constant in `lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release`, `app/api/stripe/checkout` does `.trim().replace(/\/$/, "")`. (b) `void (async () => {...})()` after `Response.json()` was being killed by Vercel's serverless teardown — emails landed intermittently or not at all. Switched to `after()` from `next/server` (Next 16's official background-work API) in sub-request POST, sub-claim POST, and programs-pg POST. **(5) Tiptap migration Phase 1.** New canonical `RimTiptapEditor` at `components/rim-tiptap/RimTiptapEditor.tsx` — Tiptap 3, one component, three variants (`minimal` / `message` / `document`). Five custom block extensions (Callout note+decision, PullQuote, VerseQuote, PracticeSuggestion, Reflection). Storage paradigm: plain HTML strings, not BlockNote JSON. Editor Lab demos all three variants. Production untouched in Phase 1. |
| 2026-04-24 (session 95) | **Program Detail in Webflow + listing folder-slug fix + doc sync gap caught.** Audited the Webflow Program Detail page Jesse built between sessions — `curl` + grep on the published HTML enumerated 20 bindings across 14 fields. He used `ctaHtml` (single-element drop-in) and `programNotesHtml` even though the latter wasn't in the doc. Four fields available but not placed: `locationLink`, `formatLabel`, `teacherNames`, `specialAnnouncement`. Rewrote `RIM_Webflow_Fields.md` to match reality. Programs listing's "Learn More" link 404'd: link template was `/rim-next/program-detail` but the page was publishing at `/untitled/program-detail` (folder slug never renamed from Webflow's default). Jesse renamed folder slug to `rim-next`; after republish detail page lives at `/rim-next/program-detail` and links work. New memory: `webflow-cache-and-mcp-limits.md` — stale 404s persist through hard-refresh in regular browsers (incognito or DevTools clear-site-data fixes it); Webflow MCP cannot rename Navigator labels. |
| 2026-04-24 (session 94) | **Webflow architecture committed + rim-connect v3 performance tuning.** Tried to port the Webflow Program Detail into `app/programs/[slug]/page.tsx` and hit visual-drift loop again. Pivoted mid-session to commit to the Webflow-primary architecture (was tentative in `RIM_Architecture_Directive.md`, now policy). Almost abandoned the pivot over a visible placeholder flash; measurement showed cached API responses at ~115ms, cold ~180ms — the real issue was a render race, not speed. Fixes: (1) API cache policy — `s-maxage=300, stale-while-revalidate=86400` plus explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers (Vercel sanitizes the browser `Cache-Control` and drops `s-maxage`; the explicit CDN headers bypass that). (2) `rim-connect.js` v3 hide-until-populated — `[data-rim-page]` containers start at `opacity: 0`, fade in when populated (120ms), 1500ms safety timeout. (3) Webflow site-wide head code consolidated into Site Settings → Custom Code → Head Code (preconnect + inline hide-style + script tag). New memory: `feedback-measure-before-agreeing.md`. |
| 2026-04-22 (session 93) | **Schedule Tool Phase 4 + Host Hub Home redesign + ritual cleanup.** Sections 43, 44 added. Schedule tool gained program diagnostic strip (so the registrar can see at a glance which programs are missing assignments) and reassign-to-self when a coordinator is also a host. Host Hub home redesigned to be role-adaptive — same surface, different content cues for hosts vs coordinators. Team-management manual chapter `host-hub-team-management` seeded via `seedManualHostHubTeamManagement` (covers add/pause/communicate/escalate flows). Closing ritual rules tightened in `CLAUDE.md`. |
| 2026-04-22 (session 92) | **Host Hub Rework Phase 3: Hub Membership as Authority.** Section 42 added. `HubMember` becomes authoritative for hub-gated state when the record exists: `status` (ACTIVE/PAUSED/INACTIVE), `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`. New `lib/hubMemberAuth.ts` — `getEffectiveHostingCapability()` and `canReceiveHubNotifications()` consulted by every host-gated surface (LiveKit token grant, sub-request claim, host-assignment claim/unclaim/reassign, notification recipient lists). No-delete policy on role revoke: `syncHubMembership` no longer deletes `HubMember` records when a user's role changes; coordinator-owned state is preserved. Hard removal moves to `DELETE /api/hub/[slug]/members/[userId]` (ADMIN-only). Destructive-action confirmation flow: pausing a member with upcoming `HostAssignment` rows returns 409 with `{ requiresConfirmation: true, upcomingAssignments: [...] }`; client confirms; resubmit with `force: true` and optionally `releaseAssignments: true`. |
| 2026-04-20 (session 90) | **Aside block, editor menu unification, typography alignment.** Aside simplified — title input removed, native color picker. Pill `⋯` menu and slash `/` menu now share `lib/editorRegistry.ts` source. Typography alignment pass on lesson and program editors. |
| 2026-04-20 (session 89) | **Editor system reorganization (four-type model) + Virtual Host Hub Attendance/Session Tracking deleted entirely.** Established the four authoring types in `RIM_Editor_Types.md` (Document / Page Designer / Message / Form Field). `lib/editorRegistry.ts` becomes the single source of truth for insertable blocks. Sweeping audit of editor usage; abandoned-module deletion. The Virtual Host Hub Attendance + Session Tracking features (Sections 25/25b/25c) deleted — the system was built across sessions 43–45 but never reached operational use; design will be revisited when in-person + virtual attendance becomes a clearer product need. The deletion accounts for the `missing-reports` cron entry still in `vercel.json` — it's a leftover from this era and should also be cleaned up. |
| 2026-04-19 (session 88) | **Host Schedule redesign + Neon upgrade + sitewide mobile viewport fix:** (1) **Neon crisis.** Site went offline early in session; all Prisma-backed routes returned 500 with `Can't reach database server`. Cause: Free-tier 100 CU-hrs/mo blown by a `*/5 * * * *` `support-sync` cron keeping the compute endpoint continuously active. Upgraded Neon to Launch via Vercel Marketplace (metered pay-as-you-go); removed the 5-min cron from `vercel.json`. The Support Inbox's manual `↻` sync button (already built at `SupportInboxClient.tsx:858` → `POST /api/support/sync` with 30s rate limit) is now the sole sync path until the feature launches to volunteers. (2) **Host Schedule (`/tools/schedule`) redesign.** Replaced the session-76 mini-cal-plus-card-list with: interactive status sentence (`"3 sessions need a host this month. You're hosting 5."` — both counts are clickable filter pills); event-pill calendar (`hub-cal2`, ~96px cells with up to three abbreviated program name pills per day, `+N more` overflow, today is a filled blue circle around the day number — Google Calendar pattern); day click filters the list below with a "Showing X on Day · Show whole month →" banner; five-state color semantics (orange = no host yet, red = sub needed, green = covered, blue = yours, blue+red = yours + sub requested); card border tinted in state color (3px stripe on saturated accent + washed tint on other three sides, deepens on hover); card titles conform to Messages Hub spec (`var(--text-h4)` 20px serif); legend with five swatches; mine-sub state now visually distinct (cream card bg + amber "Sub requested" chip). New classes: `hub-sched-status__*`, `hub-cal2__*`, `hub-sched-legend__*`, `hub-sched-dayfilter__*`, `hub-lv__chip--sub`, `hub-lv__card--mine-sub`. (3) **Sub-request submit bug fix.** `submitSubRequest` called `message.trim()` on BlockNote JSON (not a string) — threw TypeError, handler had no try/finally, button stuck on "Sending…" and POST never reached server. Rewrote to accept `any`, extract plain text via `extractBlockNoteText`, wrap in try/catch, return `Promise<boolean>`, capture returned `subRequestId` and mirror in `setSelected` so the detail panel reflects state without reload. (4) **Sitewide mobile viewport fix.** `app/layout.tsx` had no viewport meta tag — every mobile browser was rendering every route at ~980px desktop width and pinch-zoom-scaling. Every `@media (max-width: 768px)` rule in `custom.css` had been silently ignored on mobile since the app was built. Added `export const viewport: Viewport = { width: "device-width", initialScale: 1 }`. Also switched `.hub-ws-layout` from `display: flex` to `display: block` at `<=900px` as belt-and-suspenders so the position-fixed sidebar couldn't push the main column regardless of browser quirk. (5) **Mobile-friendliness pass on Host Schedule.** 44px touch-target minimum on every card/detail/nav button; iOS 16px anti-zoom on `.fi`/`.ft`/`.fs` at `<768px`; chrome compression (toolhead padding + title size down, status margin tight); thicker calendar mobile bars (14×4px); card button full-width at `<480px`; detail-panel actions stack vertically. (6) **Two-tap confirmation pattern.** Jesse reported accidental claims while scrolling past cards. First tap on `I'll host` / `I can cover` now arms the button: darkens, label becomes "Tap to confirm," 5px countdown bar runs across the top over 4 seconds, 1.2s brightness pulse on the button, Cancel link below (44px tap area on mobile). Second tap within 4s commits; inactivity or Cancel reverts. Pattern applied identically to card-level and detail-level primary buttons. Card-level button hides when the card expands so only one primary button is ever on screen at a time. (7) **Horizontal overflow lockdown.** `html { overflow-x: hidden }` (older Safari) + `body { overflow-x: clip; max-width: 100% }` (newer, preserves `position: sticky`). Card titles get `overflow-wrap: anywhere; min-width: 0`. Key files: `components/HubScheduleClient.tsx` (major rewrite), `public/css/custom.css` (~400 lines changed), `app/layout.tsx`, `vercel.json`. |

---

## 18. ~~Sanity Studio Access for Staff~~ (removed)

> **Removed in session 54 (2026-03-15).** Programs migrated to Postgres; the Sanity invitation system was deleted. The API route (`sanity-invite/route.ts`), the `revokeSanityAccess()` function, the `sanityInvitedAt` field on User, the Sanity Management Token usage, and all related UI (invite button, revocation warning, dashboard link) were removed. Registrars now access the Program Editor in the Registrar Hub — no Sanity Studio access is needed for program management.

---

## 19. ~~Google Meet Integration~~ — REPLACED by LiveKit (session 86, 2026-04-15)

> **Replaced by LiveKit in session 86 (2026-04-15).** See Section 38 (LiveKit Video Conferencing) for the current video stack. Google Meet integration is no longer in use — the four shared room accounts, the "Create Google Meet" / "Remove Meet" UI, calendar booking, and the room-account assignment to the host team have all been retired. Members and hosts now join virtual programs inside RIM's own session room (LiveKit) directly from the dashboard or schedule — no separate Meet link, no Google account, no app to install. The history below is preserved for context only.

---

**What it did (historical):** Replaced Zoom with Google Meet for all virtual and hybrid programs. A registrar clicked "Create Google Meet" in the Program Editor — the app found a free room account, created a Meet space, added a Google Calendar event, and saved the link + room email + calendar event ID to the program record. The link appeared in confirmation and reminder emails. Time changes synced automatically: saving date/time changes in the Program Editor patched the calendar booking. Switching to in-person deleted the calendar event and cleared all Meet fields. The **Meet Host** team logged into the assigned room account to get host controls.

**Why this matters:**
- Eliminates Zoom costs and 40-minute limits for a nonprofit on Google Workspace
- The shared "RIM Programs" Google Calendar becomes a live view of all upcoming virtual programs for all staff — no scheduling conflicts
- Meet links auto-generate; links never expire
- The rotating host team sees exactly which account to sign into — no fixed assignment needed
- Can be tested before DNS cutover — fully functional on rim-next.vercel.app

**Who uses it:**
- **Registrars/Admins** — click "Create Google Meet" in the Program Editor; app assigns a room and saves the link to the program record
- **Meet Host team (HOST role)** — check the Host Hub to see which room account is assigned to each virtual/hybrid program; log in as that account before the session
- **Members** — receive the Meet link in confirmation + reminder emails

---

### Architecture: Virtual Room + Shared Account Model

**The problem with a single account:** One Google account cannot host two simultaneous meetings. If RIM runs a 7pm drop-in and a 7pm community group on the same night, a single `programs@rootedinmindfulness.org` account cannot own both.

**The solution — Virtual Rooms:** A small pool of dedicated accounts that act as permanent "meeting rooms":
- `meet1@rootedinmindfulness.org`
- `meet2@rootedinmindfulness.org`
- `meet3@rootedinmindfulness.org`
- `meet4@rootedinmindfulness.org`

The app assigns whichever room is free for a given time slot (checking the shared calendar for conflicts). Whoever logs in as that account when the session starts automatically owns the meeting with full host controls.

---

### Staff workflow

**Creating a Meet (manual — the only path):**
1. In the Program Editor, set **Format** to Virtual or Hybrid and set **Start Date & Time**; save
2. Go to the program detail page in the Registrar Hub
3. Click **"Create Google Meet"** in the Google Meet panel
4. App finds a free room account, creates the Meet space + calendar event, saves the link + room email + calendar event ID to the program record
5. "Google Meet" panel shows the link + assigned host account
6. Host team checks the Host Hub; they sign in as the assigned room account before the session

**If the time changes:**
- Update Start Date & Time in the Program Editor and save — the PUT handler patches the existing calendar event automatically. The Meet link stays the same.

**Removing a Meet (rescheduling or cancelling):**
1. Go to the program detail page in the Registrar Hub
2. Click **"Remove Meet"** (muted red)
3. Confirm in the dialog — app calls `DELETE /api/programs-pg/[slug]/google-meet`, which deletes the Google Calendar event and clears `zoomLink`, `meetHostAccount`, `calendarEventId` from the program record
4. To re-create: click "Create Google Meet" again (after updating the date if needed)

**Switching away from virtual:** When the program format is changed from virtual/hybrid to in-person and saved, a confirmation dialog warns that the Meet link will be deleted. On confirm, the PUT handler automatically deletes the calendar event and clears all Meet fields.

**Replacing a Meet (new time slot, same program):**
- Click "Remove Meet" first, then update the Start Date & Time and click "Create Google Meet" again.
- Or: just click "Create Google Meet" again without removing — the POST handler detects an existing `calendarEventId` and deletes the old calendar event before creating the new one (prevents orphaned room bookings).

---

### Technical notes

- **Calendar sync on save (session 54):** The PUT handler in `/api/programs-pg/[slug]/route.ts` detects date/name changes and calls `updateCalendarEvent()` if a `calendarEventId` exists. Detects format switch away from virtual and calls `deleteCalendarEvent()` + clears Meet fields. No webhook needed — sync is inline with the save.
- **programFormat field:** String radio (in-person / virtual / hybrid). `in-person` → hide Meet section + delete calendar event on format change; `virtual`/`hybrid` → show Meet section.
- **Orphan prevention (session 33):** POST route now checks for existing `calendarEventId` + `meetHostAccount` before calling `createMeeting()`. If found, `deleteCalendarEvent()` is called first (non-fatal if old event already gone). Prevents orphaned room bookings when registrar clicks "Create" on a program that already has a Meet.
- **calendarEventId:** Stored in the Program model. Written by the manual API route. Read by the PUT handler (time change / format switch) and the Remove Meet DELETE route. Enables updating or deleting the calendar booking without duplicates.
- **updateCalendarEvent / deleteCalendarEvent:** Two exported functions in `lib/google-meet.ts`. `updateCalendarEvent` patches time/title; does NOT touch the Meet space (Meet links are permanent). `deleteCalendarEvent` removes the calendar event to free the room slot.
- **DWD impersonation:** The service account (`rim-programs-bot@rim-programs.iam.gserviceaccount.com`) impersonates the chosen room account via JWT + Domain-Wide Delegation. Room accounts own the meeting; no human credentials needed.
- **Room selection:** `findAvailableRoom()` queries each room account's own `primary` calendar for events in the time window. Returns first free room; throws `NO_ROOM_AVAILABLE` (handled as 409) if all rooms are booked.
- **Meet REST API scope:** `https://www.googleapis.com/auth/meetings.space.created` + `https://www.googleapis.com/auth/calendar.events` — both granted in DWD config.
- **Meet creation:** `spaces.create` with `{ config: { accessType: "TRUSTED", entryPointAccess: "ALL" } }` — TRUSTED means anyone with a `@rootedinmindfulness.org` account can join without waiting to be admitted.
- **`meetHostAccount` field:** readOnly string on Program model; stores the assigned room email. Written alongside `zoomLink` and `calendarEventId`. Shown in CreateMeetButton done state and in the Host Hub.
- **`GOOGLE_PRIVATE_KEY`** contains newlines — stored as raw value in Vercel (not base64).
- **Sanity write-back** uses `SANITY_API_TOKEN` (Editor role token "RIM Next Website Write") — must be Editor or higher for patch/commit.

### Key files ✅ Built — updated session 33 (commit dcbeb7d)

- `lib/google-meet.ts` — DWD JWT auth, `findAvailableRoom()` (primary calendar conflict check), `createMeeting()` (spaces.create → calendar event → `{ meetLink, calendarEventId, roomEmail }`), `updateCalendarEvent()` (patches time/title), `deleteCalendarEvent()` (frees room slot)
- `app/api/webhooks/sanity-programs/route.ts` — Sanity webhook handler: HMAC-SHA256 sig verify, operation detection (payload or Sanity query), update/delete routing (no auto-create)
- `app/api/programs/[slug]/google-meet/route.ts` — POST: orphan-safe Meet creation (deletes old calendar event if exists), writes `zoomLink`/`meetHostAccount`/`calendarEventId` to Sanity, 409 on no room; DELETE: releases calendar event + clears Sanity fields (REGISTRAR/ADMIN)
- `components/CreateMeetButton.tsx` — "use client" 5-state (idle/loading/done/remove/removing); done state shows link + host account + Remove button; remove shows confirm dialog; `vol-meet-` CSS prefix

> **LiveKit replacement (session 76):** LiveKit Cloud is being integrated as a replacement for Google Meet. Phase 1-2 are complete (foundation + dashboard embed). Google Meet will be gradually phased out as LiveKit features mature. See §38 for details.
- `app/account/registrar/[slug]/page.tsx` — renders CreateMeetButton only when `programFormat === "virtual" || "hybrid"`
- `lib/queries.ts` — `hostProgramsQuery` (programFormat in ["virtual","hybrid"] with Meet link, incl. `meetHostAccount`)
- `app/account/host/page.tsx` — Host Area page (HOST | REGISTRAR | ADMIN access; see §21)
- `public/css/custom.css` — `vol-meet-` styles (incl. `vol-meet__remove-btn`, `vol-meet__remove-confirm-btn`) + `hs-` host area styles

### Environment variables (all set in Vercel)

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `rim-programs-bot@rim-programs.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Full RSA private key from service account JSON |
| `GOOGLE_ROOM_EMAILS` | `meet1@rootedinmindfulness.org,meet2@rootedinmindfulness.org,meet3@rootedinmindfulness.org,meet4@rootedinmindfulness.org` |
| `SANITY_WEBHOOK_SECRET` | HMAC secret for verifying Sanity webhook payloads |

---

## 20. Staff Reference Manual

**What it does:** A plain-English how-to guide for every staff role — written for people who are learning the system, not developers. Accessible at `/admin/manual`. Organized into chapters, each targeting a specific role and task, with field-by-field explanations, common workflows, and plain-language context for every decision.

**Who uses it:**
- **Registrars** — primary audience; all chapters are relevant to their daily workflow
- **Admins** — secondary audience; useful for onboarding new registrars and as a system reference
- No access for regular members, teachers, or volunteers

**Access control:** `session.user.roles?.some(r => ["ADMIN", "REGISTRAR", "HOST"].includes(r))` — redirects all others to `/login`. HOST users are linked to the manual from their dashboard card and notification email, so all three roles have read access.

**URL:** `/admin/manual`

### Current Chapters

#### Chapter 1 — Registration Management
**Subtitle:** This chapter walks you through the registration system — what members see when they sign up, what you see as a registrar, and how to handle every situation that comes up.

| Section | What it explains |
|---|---|
| Overview | What registration is, how it fits the site, the standalone /register URL |
| Member experience | The form flow, email recognition (pre-fill + field locking), community agreements, after-registration UX, self-cancellation |
| Your tools | Program list (/volunteer), the registrar table — every column and action |
| Status guide | REGISTERED, WAITLISTED, APPROVED, CANCELLED — visual cards with plain-English explanations |
| Dana | Dana modes and dana statuses — both as tables; the dana philosophy note |
| Course access | When automatic access applies, when to use manual grants, step-by-step how-to |
| Automatic emails | Full reference of every email the system sends or you can trigger |
| Calendar links | Start Date & Time, recurrence fields, .ics vs Google Calendar difference |
| Common tasks | 8 practical how-to tasks: turning on registration, promoting, cancelling, reminders, editing, notes, CSV export, closing |
| Edge cases | 7 scenarios: wrong email, no confirmation received, locked name, adding someone past capacity, member cancels, registering on behalf, archived member re-registers, can't access account, pending dana |

#### Chapter 2 — Programs
**Subtitle:** How to create and manage programs — every field explained.

Covers all program fields with field-by-field documentation in a visual table format (organized by the same 6 sections as the Program Editor):

| Tab | What it covers |
|---|---|
| Content | Name, Slug, Category, Featured Image, Pull Quote, Description, Teachers |
| Schedule & Location | Date/Time text, Start/End datetime, Recurrence fields, Location, Meeting Link |
| Registration | Registration Deadline, Registration Closed toggle, Custom Questions, Confirmation Message |
| Dana & Payment | Dana Mode (none/voluntary/base_plus_dana/fixed), amounts, dana message |
| Dashboard | Zoom links (today's sessions panel on member dashboard) |
| Sorting & Visibility | Sort Order, Featured toggle, Hide from Listing |

**Also covers:**
- "How a program comes together" — anatomy overview with minimum-to-maximum checklist (5 tiers from page-exists to fully-configured)
- Common tasks: creating a program, editing live content, updating dates, special announcements, setting up recurrence, hiding/retiring a program, linking to a course
- Practical notes: don't change slugs after publishing, meeting link must be set before reminder date, Central Time for all datetimes, linked courses don't grant access to existing registrants

#### Chapter 3 — Staff & Roles
**Subtitle:** This chapter covers staff roles — what each one unlocks, how to grant and remove access, and how to get a new staff member set up from scratch.

| Section | What it explains |
|---|---|
| Overview | What roles are, how they work, immediate effect |
| Volunteer roles | Meet Host, Registrar, Admin — what each can/cannot do, dashboard shortcuts table (4 columns × all links) |
| Assigning a role | Step-by-step via /admin/members, who can do it |
| Notification email | Auto-send when MEET HOST or REGISTRAR is first added; what each email contains; Admin role is silent |
| Removing a role | Uncheck and save; effect is immediate |
| First Admin setup | Bootstrap SQL via Neon console — for when no Admin exists yet |

### Discovery

Staff reach the manual via two paths:
1. **Dashboard shortcut card** — "Volunteer Manual" appears in `STAFF_LINKS` for HOST, REGISTRAR, and ADMIN on the `/account/dashboard` hub
2. **Role assignment email** — newly-granted MEET HOSTs and REGISTRARs both receive a prominent outline button "Read the Volunteer Manual →" alongside the main dashboard button

### Design

**Layout:** Sidebar navigation (section links) + reading column (740px max-width, warm `--rim-bg-accent` background for sidebar). Fixed header shows the manual title and "Reference Manual" label.

**CSS prefix:** `man-` (`public/css/custom.css`)

**Two table styles:**
- `man-table` — general content table for key/description pairs. First column is bold; second column is left-aligned `--rim-text-muted`. Used for dana modes, dana statuses, calendar fields, program tabs overview, etc.
- `man-table man-table--perms` — modifier for permission check tables where non-first columns contain ✓ marks and should be centred (e.g., the dashboard shortcuts access table).

**Other components:**
- `man-field-list` / `man-field` — 2-column grid (210px label + 1fr description) for field-by-field reference tables. Responsive: collapses to stacked on narrow viewports.
- `man-note` — warm tinted callout box for important warnings and tips
- `man-list` — clean list style; padding-left 28px (not browser default ~40px or too-tight 20px)
- `man-steps` — numbered step-by-step list; padding-left 28px
- `man-chapter--break` — blue top border + 80px top margin for visual chapter separation
- `man-section__h3` — uppercase small label for sub-headings within sections
- `man-content code` — monospace inline code style for technical values

**Consistency rule:** Prefer `man-table` over bullet lists wherever content has a key/value structure. Use bullet lists only for truly unstructured content (e.g., a list of independent points with no natural label column).

**Key file:** `app/admin/manual/page.tsx` — server component, full content inline (no CMS backing — manual updates require code edits).

### 🔧 Technical notes

- Server component — auth check at top: `redirect("/login")` if not ADMIN or REGISTRAR
- All content is hardcoded in the TSX file; no database or Sanity dependency
- Each chapter is independently self-contained so chapters can be handed to different people if roles split in the future
- Chapter subtitles speak directly to the reader in second person ("This chapter walks you through…") — no "Who uses this chapter" third-person framing
- The sidebar uses anchor links (`#section-id`) for in-page navigation — no routing, no JavaScript required
- Future chapters (coming soon as sidebar stubs): Member Accounts, Courses & Materials (member-facing side — admin course access is already in Chapter 1), Google Meet Integration

---

## 21. HOST Role + Host Area ✅ Built — session 27 (2026-03-05)

**What it does:** A lightweight volunteer role for the Google Meet host team. Members with the HOST role get access to `/account/host` — a dedicated page showing every virtual program that has a Google Meet link assigned, along with which room account to log into for each session to get host controls. The host team uses this as their starting point before every virtual session.

**Who uses it:** The rotating volunteer host team — people who facilitate RIM's virtual sessions on Google Meet. They are not registrars; they don't manage registrations or member data. Their job is to be present before the session, sign into the right account, and hold the meeting container.

---

### What HOST can access

| Area | HOST | REGISTRAR | ADMIN |
|---|---|---|---|
| Host Area `/account/host` | ✓ | ✓ | ✓ |
| Volunteer Manual `/admin/manual` | ✓ | ✓ | ✓ |
| Volunteer dashboard `/account/registrar` | | ✓ | ✓ |
| Member management `/admin/members` | | ✓ | ✓ |
| Program Editor (Registrar Hub) | | ✓ | ✓ |

---

### User flow — getting a host set up

1. Admin assigns the HOST role via `/admin/members` → member detail page → Roles section → check "Meet Host" → Save changes
2. Host receives an automatic notification email: "You've been added as a Meet host — Rooted In Mindfulness." The email links to `/account/host` and includes an outline button "Read the Volunteer Manual →"
3. Host bookmarks `/account/host` as their starting point for every session

### User flow — before each session

1. Host visits `/account/host` and finds their program
2. The page shows which room account is assigned (e.g. `meet1@rootedinmindfulness.org`)
3. Host signs into that account in their browser as a secondary account — no need to log out of their own
4. Host clicks the **Join on Google Meet** link for the program a few minutes before the session
5. They see the blue host shield — meaning they have full host controls (mute all, remove participant, end meeting for everyone)
6. At session end: click the red button → **End meeting for all** → switch back to personal account

---

### The `/account/host` page

- **Route:** `app/account/host/page.tsx` — server component
- **Auth:** Requires session; redirects unauthenticated users to `/login`
- **Role gate:** HOST, REGISTRAR, or ADMIN (redirects others to `/account/dashboard`)
- **Data source:** `hostProgramsQuery` — all programs in Sanity with a `zoomLink` set, ordered by `sortOrder`
- **What it shows:**
  - "How to host" guidance section at the top — 4-step numbered list (sign in as account, join the link, blue shield explanation, end meeting for all)
  - A note about what to do if the blue shield doesn't appear (another `@rootedinmindfulness.org` volunteer can grant host controls from the People panel)
  - Program cards: name, day/time, "Sign in as [room account]" badge, "Join on Google Meet →" link
  - Empty state if no programs have a Meet link yet
- **CSS prefix:** `hs-`

---

### Notification email

- **Subject:** "You've been added as a Meet host — Rooted In Mindfulness"
- **Fires:** Once, on first HOST role assignment; does not re-send on subsequent saves
- **Content:** What the Meet Host role means, link to `/account/host`, outline button "Read the Volunteer Manual →"
- **Implementation:** `sendHostRoleAssignmentEmail()` in `lib/email.ts` — mirrors `sendRoleAssignmentEmail()` pattern; fire-and-forget in the PATCH route

---

### Key files

- `prisma/schema.prisma` — `HOST` added to `Role` enum (before REGISTRAR)
- `app/account/host/page.tsx` — Host Area server component; `hs-` prefix
- `lib/queries.ts` — `hostProgramsQuery`
- `lib/email.ts` — `sendHostRoleAssignmentEmail()`, `buildHostRoleAssignmentHtml()`, `buildHostRoleAssignmentText()`
- `app/api/admin/members/[id]/route.ts` — `addingHost` detection (mirrors `addingRegistrar`) → fire-and-forget notification
- `components/MemberDetail.tsx` — HOST first in `ALL_ROLES`; role description; role gate hint updated ("volunteer area")
- `app/account/dashboard/page.tsx` — HOST entry in `STAFF_LINKS`: Host Area + Volunteer Manual cards
- `proxy.ts` — `/account/host` and `/hosts/:path*` added to matcher
- `app/admin/manual/page.tsx` — access gate updated to include HOST; overview text updated; sidebar link text updated

### 🔧 Technical notes

- HOST is the lightest role — two pages only (`/account/host` and `/admin/manual`)
- Role checks happen inside the page components, not in `proxy.ts`. Proxy handles login/terms/archived redirects only; role enforcement is per-page (same pattern as REGISTRAR-gated pages)
- REGISTRAR and ADMIN can also view `/account/host` — useful for registrars who also host, and for admins monitoring the system
- No Program Editor access for HOST — the HOST role grants Host Hub access only, not Registrar Hub
- HOST members see "Volunteer Access" (not "Staff Access") in their dashboard section header — the same label used for REGISTRAR and ADMIN

---

| 2026-03-05 (session 23) | Staff reference manual + role cleanup. **(1) Staff manual:** Complete build of `/admin/manual` — two-chapter reference guide with sidebar navigation. Chapter 1 (Registration Management): 9 sections covering the complete registrar workflow (volunteer table, statuses, promoting from waitlist, inline edits, edit request emails, reminders, resend confirmation, CSV export, common scenarios). Chapter 2 (Programs & Sanity Studio): 11 sections covering all 6 Sanity tabs with field-by-field `man-field-list` tables, a "How a program comes together" anatomy section with min-to-max checklist, and common task walkthroughs. CSS: added all missing `man-` classes that were defined in JSX but had no CSS (`man-section__h3`, `man-field-list`, `man-field`, `man-field__name`, `man-field__desc`, `man-content code`, `man-chapter--break`); responsive stacking for `man-field` on narrow viewports. Files: `app/admin/manual/page.tsx` (complete rewrite), `public/css/custom.css` (`man-` block). Commits: e6e9888, 328c1d8, b6003d4. **(2) Role simplification:** Removed TREASURER, TEACHER, VOLUNTEER from the system — they were defined speculatively with no functionality attached. Only ADMIN and REGISTRAR remain. Files: `prisma/schema.prisma` (Role enum), `components/MemberDetail.tsx` (ALL_ROLES + descriptions), `components/MembersTable.tsx` (RoleFilter type, badge map, label map, filter dropdown), `app/admin/roadmap/page.tsx` (TEACHER/VOLUNTEER wiring item removed, TREASURER desc updated), `app/admin/sitemap/page.tsx` (role lists updated). DB was already clean — no existing members had those roles; `prisma db push --accept-data-loss` confirmed no data loss. Commit: 75cad53. **(3) Docs:** FEATURES.md Section 2 (role table trimmed), Section 10 (man- CSS prefix added), Section 11 (stale role refs cleaned), Section 20 (Staff Reference Manual, new); Session Log updated; MEMORY.md updated. |
| 2026-03-05 (session 25) | Registrar role assignment notification email. `sendRoleAssignmentEmail()` added to `lib/email.ts` — fires when REGISTRAR is newly added in the member PATCH route; links to `/account/registrar` + `/admin/manual`; fire-and-forget, no re-send on subsequent saves. Minimal Chapter 3 "Staff & Roles" added to `/admin/manual` with one section ("Notifying new staff") explaining the automatic email and distinguishing it from the separate Sanity Studio invite step. Sidebar updated — "Staff & Roles" now a real link, no longer a "Coming soon" badge. FEATURES.md Section 2 updated. Commit: 4c13318 (code) + [docs commit]. |
| 2026-03-05 (session 24) | Member self-service cancellation (17b) + spot-opened alerts + capacity notices (17d). **(17b)** New `POST /api/account/registrations/[id]/cancel` — auth check → ownership check (403 if not their registration) → status guard (400 if already CANCELLED) → `db.registration.update({ status: "CANCELLED" })` → fire-and-forget `sendCancellationNotificationEmail()`. New `components/CancelRegistrationButton.tsx` ("use client"; 4-state machine: idle/confirming/loading/done; on error → alert + revert to confirming). `app/account/programs/page.tsx` renders cancel button in `mr-card__actions` for REGISTERED/APPROVED/WAITLISTED cards. **(17d — spot-opened alerts)** `app/account/registrar/page.tsx`: added `spotOpened` boolean (`!!cap && confirmedCount < cap && waitlistedCount > 0`) to `programsWithCounts`; `needsAttention` now includes `spotOpened`; green `vol-signal--spot-open` badge ("↑ Spot open · N waiting") renders before the amber waitlist badge (amber waitlist badge only shows when NOT spotOpened). `components/VolunteerTable.tsx`: derived `waitlistedCount` from `counts.WAITLISTED ?? 0`; `spotOpened` derivation (same logic); `vol-spot-opened` amber alert banner above registrations table when spot is open. **(17d — capacity notices on program page)** `app/programs/[slug]/page.tsx`: added `isFull` (`spotsRemaining === 0`) and `showLowSpots` (`spotsRemaining > 0 && spotsRemaining <= 5`) derivations; CTA section: "Join Waitlist" branch gets `pg-capacity--full` amber box notice; "Register" branch conditionally shows `pg-capacity--low` muted notice. **CSS added:** `vol-signal--spot-open` (green badge), `vol-spot-opened` (amber alert banner, left border accent in `--rim-mid`), `pg-capacity` (base notice style), `pg-capacity--full` (warm amber box), `pg-capacity--low` (plain muted text), `mr-card__actions` (border-top footer row), `mr-cancel-btn` (muted text-link), `mr-cancel-confirm` (warm red-tinted inline box), `mr-cancel-confirm__text`, `mr-cancel-confirm__actions`, `mr-cancel-btn--yes` (red danger), `mr-cancel-btn--keep` (neutral outline), `mr-cancel-done` (muted confirmation text). **Staff manual updated** (7fd8442): self-cancellation section added under "After registering"; spot-open badge documented in volunteer index; VolunteerTable spot-opened alert documented; promoting-from-waitlist task references new entry points; "Cancel as registrar" clarified vs member self-cancel. **Build note:** `npm run build` exits 1 locally (Stripe env var not in local .env — pre-existing, builds clean on Vercel); TypeScript compiled successfully. Commits: 08fb3a2 (features), 7fd8442 (manual docs). |

| 2026-03-05 (session 26) | Manual review + accuracy fixes + memory. **(1) Course access to REGISTRAR (f902dfa):** Opened `CourseAccessSection` UI to REGISTRAR role (removed `{isAdmin &&}` gate in `MemberDetail`); `GET /api/admin/courses`, `POST` and `DELETE` `/api/admin/members/[id]/course-access` now accept REGISTRAR in addition to ADMIN. Added "Grant or revoke course access for individual members" to REGISTRAR "can do" list in Chapter 3. Added full "Course access" section to Chapter 1 (sidebar link, intro, when-to-use-manual-grants, step-by-step how-to, note about registration vs manual grants being separate). **(2) Chapter subtitles rewritten (94712dd):** All three chapter openers rewritten from third-person "Who uses this chapter:" framing to direct second-person address ("This chapter walks you through…"). **(3) Manual audit and fixes:** Dashboard shortcuts table in Chapter 3: added missing Staff Manual row. Automatic emails section: added dana reminder email entry. Future editions section: updated Courses & Online Materials to note that admin-side course access is already covered in Chapter 1. **(4) FEATURES.md accuracy fixes:** §2 REGISTRAR dashboard links corrected (Members now included); §6b STAFF_LINKS table updated (both roles get all 4 cards); §7 Role enum corrected (TREASURER/TEACHER/VOLUNTEER removed); §7 technical notes updated; §8 course-access API routes updated to ADMIN or REGISTRAR; §11 access control and dashboard integration stale text corrected; §20 Chapter 1 sections table expanded to reflect current content, Chapter 3 added, technical notes and future chapters updated. |
| 2026-03-05 (session 27) | Google Meet architecture rework + HOST role + Host Area. **(1) Google Meet rework:** Removed volunteer email / COHOST pre-assignment model entirely — RIM's host team is rotating; you can't designate who will host at program setup time. Simplified `lib/google-meet.ts`: no `spaces.members.create`, no `volunteerEmail` param, no moderation step; `createMeeting()` now just creates space + calendar event and returns `{ meetLink, calendarEventId, roomEmail }`. API route writes `meetHostAccount: result.roomEmail` to Sanity alongside `zoomLink`. `CreateMeetButton` removes email input; done state shows assigned room account. **(2) Sanity schema:** Added `meetHostAccount` readOnly string field to `programs` schema (schedule group, after zoomLinkText). Deployed to Sanity Studio. **(3) HOST role:** Added `HOST` to Prisma `Role` enum (before REGISTRAR); DB pushed. `sendHostRoleAssignmentEmail()` added to `lib/email.ts`. PATCH route detects `addingHost`, fires notification fire-and-forget. `MemberDetail` adds HOST to `ALL_ROLES` (first) with description. Dashboard `STAFF_LINKS` adds HOST entry (Host Area + Volunteer Manual). `proxy.ts` matcher updated. **(4) Host Area page:** New `app/account/host/page.tsx` — server component; HOST | REGISTRAR | ADMIN access; fetches `hostProgramsQuery`; "How to host" guidance section + program cards (name, day/time, room account badge, join link); `hs-` CSS prefix. New `hostProgramsQuery` added to `lib/queries.ts`. `hs-` CSS block added to `public/css/custom.css`. **(5) Manual updates:** Access gate updated to include HOST; overview text updated to three roles; sidebar "The two roles" → "Volunteer roles"; "Assigning a role" note updated; "Notification email" section rewritten (HOST and REGISTRAR both trigger notification; HOST email links to /hosts + manual; REGISTRAR email links to /volunteer + manual; Admin silent). Chapter 3 section table updated. Commits: 9cc2959 (manual docs) + this session's feature commits. **(6) FEATURES.md:** §19 completely rewritten (simplified architecture, removed COHOST/co-host docs, updated key files, added room account env table). §20 updated (Chapter 3 section table, Discovery, access control line). §21 new (HOST role + Host Area, full feature doc). |

| 2026-03-05 (session 28) | Sanity programs schema audit + cleanup. **(1) Full field audit:** Read all 45 fields across 6 Sanity groups and traced each field's usage through GROQ queries, email builders, API routes, page components, and email templates. Produced a field-by-field table identifying dead fields, misplaced fields, and redundancies. **(2) Schema cleanup:** Three fields removed: `timeText` (merged date+time into `dateText` single field, titled "Date & Time" in Studio), `zoomLinkText` (button label hardcoded to "Join on Google Meet" in all email/page code), `dayFiltering` (legacy comma-string day filter, superseded by typed `dayOfWeek` references). Two fields moved: `teacherFacilitators` Schedule → Content group (it is content, not scheduling), `dayOfWeek` Sorting → Dashboard group (it drives the dashboard "Today" badge, not just sorting). Two tab renames: "Dana & Payment" → "Dana", "Sorting & Visibility" → "Visibility". One field title rename: "Remove from Dashboard Program List" → "Hide from Member Dashboard". `dateText` description updated to include time examples. Added descriptions to `dayOfWeek`, `sortOrder`, `meetHostAccount`. **(3) Code cleanup across 13 files:** `lib/queries.ts` (7 queries), `app/programs/[slug]/page.tsx`, `lib/email.ts` (RegistrationEmailData, ReminderEmailData, all HTML/text builders; email shows "When:" not "Date:" + "Time:" separately; CTA hardcoded "Join on Google Meet"), `app/api/registrations/route.ts`, `app/api/registrations/[id]/route.ts`, `app/account/dashboard/page.tsx` (removed `dayFiltering` branch from `programIsToday()`), `app/account/programs/page.tsx`, `app/programs/[slug]/register/page.tsx`, `components/RegistrationForm.tsx`, `app/api/cron/send-reminders/route.ts`, `app/api/programs/[slug]/send-reminder/route.ts`, `app/api/programs/[slug]/google-meet/route.ts` (removed stale `zoomLinkText` Sanity write-back), `app/api/account/registrations/route.ts`. **(4) Docs:** Manual Chapter 2 updated — tab renames, field moves, Date & Time merge, Meeting Button Text removed; `FEATURES.md` §9 tab table + schema cleanup note; MEMORY.md session log. Sanity Studio deployed. Both repos pushed to GitHub. |

| 2026-03-06 (session 29) | Google Meet debugging + `listingDayAndTimeText` removal. **(1) Google Meet full debug cycle:** DWD scope wrong (`meetings.space.settings` → `meetings.space.created`) — fixed in `lib/google-meet.ts` and updated in Google Workspace Admin Domain-Wide Delegation console. Calendar write error ("You need to have writer access to this calendar") — room accounts don't have write access to the shared `GOOGLE_CALENDAR_ID` calendar; fixed by switching both `findAvailableRoom` (reads) and `events.insert` (writes) to use each room's own `primary` calendar — no Google Calendar permission setup needed, DWD impersonation always grants access to own primary. Sanity write-back failing silently — `SANITY_API_TOKEN` in Vercel was a Viewer token; created new Editor token "RIM Next Website Write" in Sanity → API → Tokens and updated Vercel. Also fixed `GOOGLE_ROOM_EMAILS` in Vercel (removed `meet-community-group@` left over from initial setup). Full end-to-end confirmed working: Meet link created, correct room assigned (`meet1@`), saved to Sanity automatically. `GOOGLE_CALENDAR_ID` env var no longer used — can be removed from Vercel if desired. **(2) Volunteer page filter fix:** Removed `registrationEnabled == true` filter from `volunteerProgramsQuery` — drop-in programs that don't require registration should still appear in the volunteer area so registrars can create Google Meet links for them. **(3) `listingDayAndTimeText` removed:** Field eliminated from Sanity schema and all consumers. `dateText` now used everywhere — program page, listing cards, host area, member dashboard. Changes: `sanity/schemas/programs.js` (field removed), `lib/queries.ts` (4 queries), `app/community-programs/page.tsx`, `app/account/host/page.tsx`, `app/account/dashboard/page.tsx`. Sanity Studio deployed. **(4) Manual cleanup:** "Listing Day & Time" field entry removed from Schedule & Location tab docs; "Update Listing Day & Time" removed from "Updating dates or times" task; Date & Time description updated (listing cards now mentioned); two "Meeting Button Text" references removed (field was removed in session 28 — button label is hardcoded in code). |

| 2026-03-06 (session 30) | Feature Inventory page (`/admin/features`). Created a comprehensive ADMIN-only reference page with two layers: **(1) System View** — four top-level sections: System Overview (what the app is, 5-row user types table, key philosophy), System Map (12-row dependency table: each functional area's Needs / Powers / Note), Data Flows (two complete end-to-end scenarios with numbered steps and area labels: registration flow 12 steps, login flow 7 steps), and If X Breaks (8 external dependency cards with cascading failure lists). **(2) Feature Detail** — 13 functional areas, ~60 feature cards, each with Where / What / Related to rows. Quick-jump nav updated to two rows: "System view" (4 blue-highlighted anchors) and "Feature areas" (13 area links). Data driven by TypeScript constants: `USER_TYPES`, `SYSTEM_MAP`, `DATA_FLOWS`, `CRITICAL_DEPS`, `FEATURE_AREAS`. CSS block added for all `adm-fi-` classes (counters, dep cards, flow steps, tables, jump nav). Nav.tsx updated: "Feature Inventory" added to admin dropdown (desktop + mobile). `/admin/sitemap` header updated: "Features →" external link added. **FEATURES.md §15c added** (this entry). Commits: c992c17 (Phase 1), 9f0a9dd (Phase 2). |

| 2026-03-08 (session 31) | Google Meet automation via Sanity webhook + Sanity schema overhaul. **(1) Sanity programs schema restructured:** Converted 6 category-based tabs into 6 linear workflow steps — `1 — Basics`, `2 — When & Where`, `3 — Registration`, `4 — Emails`, `5 — Dana`, `6 — Settings`. Added `isVirtual` boolean field (step 2, Schedule) — toggles location field visibility and drives webhook automation. Added `calendarEventId` readOnly string field (step 2, hidden unless isVirtual). Moved `programCategory` to Basics, `linkedCourses` to Registration. Split confirmation/reminder email fields into dedicated "Emails" group. Sanity Studio deployed. **(2) Google Meet full automation:** New `POST /api/webhooks/sanity-programs/route.ts` — Sanity webhook handler. Validates HMAC-SHA256 signature. Handles four cases: (A) `isVirtual` off + calendarEventId → delete calendar event + clear Sanity fields; (B) `isVirtual` + startDatetime + existing Meet → update calendar event time; (C) `isVirtual` + startDatetime + no Meet → create Meet + write back all three fields; (D) DELETE operation → delete calendar event. Operation detection: reads `delta::operation()` from payload if present, else queries Sanity — document exists → update, missing → delete. **(3) lib/google-meet.ts extended:** Added `updateCalendarEvent()` (patches time/title without touching Meet space) and `deleteCalendarEvent()` (frees room slot for conflict detection). **(4) google-meet API route fixed:** Now writes `calendarEventId` back to Sanity alongside `zoomLink` and `meetHostAccount` (was missing before). **(5) CreateMeetButton updated:** New `calendarEventId` prop; shows "✓ Room booking tracked" or "⚠ No calendar event ID" in done state. **(6) Volunteer programs page:** CreateMeetButton only shown when `program.isVirtual`; passes `calendarEventId`. **(7) Webhook registration:** Created via Sanity Management API (Sanity dashboard SPA routing broken for webhooks); filter `_type == "programs"`; secret stored as `SANITY_WEBHOOK_SECRET` in Vercel. **(8) Manual updated:** `isVirtual` field documented in Schedule tab; "Virtual Program" toggle explained with automation notes; "Creating a meeting" section rewritten — automatic path first, manual as fallback; "Before you start" streamlined. FEATURES.md §19 rewritten. Key files: `app/api/webhooks/sanity-programs/route.ts` (new), `lib/google-meet.ts` (+2 functions), `app/api/programs/[slug]/google-meet/route.ts` (calendarEventId write-back fix), `components/CreateMeetButton.tsx`, `app/account/registrar/[slug]/page.tsx`, `sanity/schemas/programs.js` (new tab structure + isVirtual + calendarEventId). Commits: (in session 30 repo) + e737ad1 (webhook operation detection fix). |

| 2026-03-08 (session 32) | Account dashboard sidebar. New `AccountSidebar` (client, `"use client"`, `usePathname`) + `AccountLayout` (server, calls `auth()`) components; `ac-` CSS prefix. Sidebar links: all members get Dashboard/My Programs/My Library/My Profile; HOST adds "My Sessions"; REGISTRAR/ADMIN adds Programs+Members; ADMIN adds second divider+Manual+Roadmap. Mobile: horizontal scroll strip (standard tabs pattern — no hamburger drawer, avoids conflict with main nav). Applied `AccountLayout` to: `/account/dashboard`, library, profile, agreements, and all four new pages. New pages created: `/account/programs` (ported from `dashboard-my-registrations`), `/account/host` (ported from `/hosts`), `/account/registrar` (ported from `/volunteer`), `/account/registrar/[slug]` (ported from `/volunteer/programs/[slug]`). Old URLs now redirect. Dashboard: removed `STAFF_LINKS` constant + "Volunteer Access" panel (sidebar handles staff navigation). Nav admin dropdown: removed Members/Roadmap/Staff Manual; added Sanity Studio. FEATURES.md §6b rewritten (sidebar architecture). Manual: all `/volunteer` → `/account/registrar`, `/hosts` → `/account/host` URLs updated throughout. Key files: `components/AccountSidebar.tsx` (new), `components/AccountLayout.tsx` (new), `app/account/programs/page.tsx` (new), `app/account/host/page.tsx` (new), `app/account/registrar/page.tsx` (new), `app/account/registrar/[slug]/page.tsx` (new). Commit: 1a05b8c. |

---

## 22. Household / Family Grouping ✅ Built — session 35 (2026-03-09)

**What it does:** Lets admins and registrars link members who belong to the same family or household — so RIM can understand that "John Smith" and "Mary Smith" are from the same home, share an address, and have a primary contact for communications. A household can hold any number of members with named relationships (Spouse, Parent, Child, etc.).

**Who uses it:** Admins and registrars, when enrolling families, updating household addresses, or looking up who belongs to which household. Also surfaces on individual member profiles — so when you're viewing Mary's profile you immediately see that she's part of the Smith household.

---

### What it does for members

- Each member can belong to at most one household (enforced at the database level)
- The household has a shared address, an optional display name (e.g. "The Smith Family"), and admin notes
- One member is the **primary contact** — the person RIM communicates with for household-level matters
- Every member has a **relationship label** describing their role in the household: Spouse, Partner, Parent, Child, Sibling, or Other (with free-text description logged for future reference)

---

### User flow — linking a member to a household

**From a member profile (`/admin/members/[id]`):**

1. Open the member's profile — scroll to the **Household** section
2. If they're not in a household yet, two buttons appear:
   - **"Create new household"** — for a new family that doesn't exist in the system yet. Enter an optional household name and the member's role, then click "Create household." They become the primary contact automatically.
   - **"Add to existing household"** — search for another member who is already in a household. Select them, and the system shows which household they belong to. Choose the new member's relationship role and click "Join household."
3. Once in a household, the section shows a card with the household name (links to the household detail page), the shared address (if set), this member's relationship label, a "Primary contact" badge if applicable, and the other members in the household

**From a household detail page (`/admin/households/[id]`):**
1. Edit the household's name, address, and notes — click "Save changes"
2. Add a member using the search box — pick their relationship type — click "Add"
3. Set a different primary contact: click "Set primary" on any member row
4. Remove a member from the household with the "Remove" button on their row

---

### The households list page (`/admin/households`)

- Lists every household with the primary contact's name, member count, and address
- Quick link from each row to the household detail page
- At the bottom: a **Custom relationship labels** frequency table — shows every free-text "Other" label that has been used (e.g. "roommate × 3, guardian × 1"). This helps identify terms to formally add to the enum in the future.

---

### Address fallback

If a member has no individual street address (`addressLine1` is blank), but belongs to a household that does, their member profile Contact section shows:

> No individual address — household address will be used: [City, State]

This prevents confusion — you know their mail goes to the household address, not nowhere.

---

### 🔧 Technical notes

**Database design:**
- `Household` — `id`, `name?`, `addressLine1?`, `addressCity?`, `addressState?`, `addressZip?`, `notes?`, `createdAt`, `updatedAt`
- `HouseholdMember` — joins `Household` ↔ `User`; has `isPrimary`, `relationshipType` (enum), `relationshipCustom?` (free text, only when type = OTHER), `createdAt`
- `userId @unique` on `HouseholdMember` enforces one household per member at the database level — not just app-level validation
- `RelationshipType` enum: `SPOUSE | PARTNER | PARENT | CHILD | SIBLING | OTHER`
- Cascade deletes on both FK sides — deleting a Household removes all HouseholdMember records; deleting a User removes their HouseholdMember record

**API routes:**
| Route | Method | Purpose | Auth |
|---|---|---|---|
| `/api/admin/households` | GET | List all households; `?q=` search by name or member name | ADMIN or REGISTRAR |
| `/api/admin/households` | POST | Create household + first member as primary | ADMIN or REGISTRAR |
| `/api/admin/households/[id]` | GET | Household detail with members | ADMIN or REGISTRAR |
| `/api/admin/households/[id]` | PATCH | Update name / address / notes | ADMIN or REGISTRAR |
| `/api/admin/households/[id]` | DELETE | Delete household (max 1 member guard) | ADMIN only |
| `/api/admin/households/[id]/members` | POST | Add a member to a household | ADMIN or REGISTRAR |
| `/api/admin/households/[id]/members/[userId]` | PATCH | Update relationship or set primary | ADMIN or REGISTRAR |
| `/api/admin/households/[id]/members/[userId]` | DELETE | Remove member from household | ADMIN or REGISTRAR |
| `/api/admin/members/[id]/household` | GET | Returns `{ id, name }` for a member's household — used by the join flow | ADMIN or REGISTRAR |

**409 handling:** Both "create household" (POST) and "add member" (POST) check if the member is already in a household and return a 409 with a human-readable message: "This member is already in another household. Remove them from that household first."

**Set primary logic:** When `isPrimary: true` is PATCHed for a member, the route first clears `isPrimary` on all other members in that household in the same transaction — so only one primary can exist at a time.

**Key files:**
- `prisma/schema.prisma` — `Household`, `HouseholdMember` models; `RelationshipType` enum; `household HouseholdMember?` on User
- `app/api/admin/households/route.ts` — list + create
- `app/api/admin/households/[id]/route.ts` — detail, update, delete
- `app/api/admin/households/[id]/members/route.ts` — add member
- `app/api/admin/households/[id]/members/[userId]/route.ts` — patch / remove member
- `app/api/admin/members/[id]/household/route.ts` — household lookup for join flow
- `app/admin/households/page.tsx` — list page (server component)
- `app/admin/households/[id]/page.tsx` — detail page (server component)
- `components/HouseholdDetail.tsx` — "use client"; full edit UI for household detail page
- `components/HouseholdSection.tsx` — "use client"; embedded in MemberDetail; create/join/view household from a member profile
- `components/MemberDetail.tsx` — imports HouseholdSection; `household` added to Member interface; address fallback hint
- `app/admin/members/[id]/page.tsx` — nested Prisma include for household + otherMembers; explicit serialization
- `components/AccountSidebar.tsx` — "Households" link added below Members (REGISTRAR+)
- `public/css/custom.css` — `hh-` CSS block

**CSS prefix:** `hh-` — household card, member list, search results, create/join forms

**Custom relationship label frequency query (for admins):**
```sql
SELECT relationship_custom, COUNT(*) AS n
FROM household_members
WHERE relationship_type = 'OTHER'
GROUP BY relationship_custom
ORDER BY n DESC;
```

---

## 23. Host Community Hub ✅ Built — sessions 36–38 (2026-03-09/10)

### What it does

A self-contained workspace inside `/account/hub/host-team` that replaces Basecamp for the RIM virtual host volunteer team. Originally built at `/account/host` (sessions 36–38); fully migrated to the multi-hub system (session 42). It handles schedule visibility, sub coverage coordination, and community discussion — all in one place, gated to the host team.

### Who uses it

| Role | What they can do |
|---|---|
| HOST | View schedule (own + all); filter by "Mine" or "Needs Attention"; request subs from session detail; claim open subs; read and create conversations; reply to conversations |
| HOST_MANAGER | All HOST actions + multi-select session claiming; create/delete assignments; close/archive conversations; receive unassigned-session alerts |
| ADMIN | Same as HOST_MANAGER |
| REGISTRAR | No access — program ops are separate from host community |

### User flow

**Schedule tab** (`/account/hub/host-team/schedule`)
- Monthly calendar grid showing all upcoming virtual sessions
- Sessions are color-coded: teal = you're hosting; amber = needs host or sub; gray = covered
- Month navigation (← Prev / Next →); calendar/list view toggle
- Three filter pills: **All** (default), **Mine** (own assignments only), **Needs Attention** (unclaimed or sub-needed sessions)
- Clicking a session opens a detail panel: program info, meeting link, "Request a Sub" button
- HOST_MANAGER/ADMIN: multi-select sessions (⌘/Ctrl + click) for bulk assignment
- Sessions are auto-generated from Sanity program data (startDatetime + recurrence) — no manual session creation needed

**Sub Board** (accessible from Schedule tab session detail panel)
- Sub requests are created from the Schedule tab's session detail panel
- Any hub member clicks "I'll take it" → optional note → confirm
- On claim: status flips to CLAIMED atomically; original requester gets an alert + email

**Conversations** (`/account/hub/host-team/conversations`)
- Three rooms: **Issues & Challenges** (peer support), **Contemplations & Practice** (HOST_MANAGER/ADMIN post only), **General** (open)
- Each conversation has a title + opening post; organized by room
- Any hub member can start a topic in Issues or General; replies open to all
- All posts show the author's real name; own posts annotated with `(you)` in italic
- HOST_MANAGER can close (no new replies) or archive (hidden from main list)

**Dashboard Hub Card Indicators (session 72)**
- Hub cards on `/account/dashboard` show a small teal unread-count badge (top-right corner)
- Unread count = threads created or replied to since `HubMember.lastVisitedAt`, plus unread `Alert` records for host-team
- Badge shows number (1–9) or "9+" for larger counts
- ADMIN users skip unread dots (they check hubs directly)
- The AlertStrip component was removed — host-team alerts fold into the hub card indicator

### New Prisma models

| Model | Purpose |
|---|---|
| `HostAssignment` | Joins a User to a Sanity programSlug; `sessionDate?` null = standing host |
| `SubRequest` | A request for coverage; status: OPEN → CLAIMED or CANCELLED |
| `SubClaim` | Who claimed a SubRequest + optional message |
| `HostThread` | Discussion thread; category: OPERATIONAL, CONTEMPLATION, or GENERAL |
| `HostReply` | A reply to a HostThread |
| `Alert` | Site-wide unread notification (5 types: SUB_REQUEST, SUB_CLAIMED, NEW_THREAD, NEW_REPLY, UNASSIGNED_SESSION) |

### Key files

**API routes:**
| Route | Methods | Purpose |
|---|---|---|
| `/api/host/assignments` | GET, POST | List assignments (own or all); create assignment |
| `/api/host/assignments/[id]` | DELETE | Delete assignment |
| `/api/host/sub-requests` | GET, POST | Open requests list; create request |
| `/api/host/sub-requests/[id]` | PATCH | Cancel request |
| `/api/host/sub-requests/[id]/claim` | POST | Claim request (atomic transaction) |
| `/api/host/threads` | GET, POST | Thread list; create thread |
| `/api/host/threads/[id]` | GET, PATCH | Thread detail; change status |
| `/api/host/threads/[id]/replies` | POST | Add reply (bumps thread updatedAt) |
| `/api/account/alerts` | GET, PATCH | Unread alerts; mark read / mark all read |
| `/api/cron/check-unassigned-hosts` | GET | Daily check — alert HOST_MANAGER if program within 30 days has no host |

**Pages** (all under `/account/hub/host-team/` — see §24 for page files):
- Schedule — `app/account/hub/[slug]/schedule/page.tsx`
- Conversations — `app/account/hub/[slug]/conversations/page.tsx` + `[id]/page.tsx`

**Components:**
- `components/HubScheduleClient.tsx` — calendar grid, month nav, filter pills, list view, session detail panel, multi-select claiming; receives `apiBase="/api/host"`
- `components/SubBoard.tsx` — open requests + claim flow (status board only)
- `components/HubConvClient.tsx` — conversations list (three-room tab UI + new topic form)
- `components/HubConvThreadClient.tsx` — thread detail + replies + reply form + close/archive
- `components/AlertStrip.tsx` — unread count + ✕ per-alert dismiss + mark-all-read; no auto-dismiss on link click

**Other files changed:**
- `lib/queries.ts` — added `allVirtualProgramsQuery` (no zoomLink filter; for assignment dropdown)
- `lib/email.ts` — 4 new functions: `sendSubRequestEmail`, `sendSubClaimedEmail`, `sendNewThreadEmail`, `sendNewReplyEmail`
- `prisma/schema.prisma` — HOST_MANAGER role; 6 models; 5 enums; User relations
- `components/AccountSidebar.tsx` — `hasHost` extended to include HOST_MANAGER
- `components/MemberDetail.tsx` — HOST_MANAGER added to ALL_ROLES with description
- `vercel.json` — cron: `check-unassigned-hosts` at 16:00 UTC daily
- `public/css/custom.css` — `hub-` block + `alert-strip` block; `hub-page--wide` modifier (schedule page removes max-width cap); calendar cell sizing; `hub-schedule__filter-btn` pill styles; `hub-thread-detail__you` italic muted annotation

### Technical notes

**Slug stability:** `HostAssignment.programSlug` is the join key to Sanity. Sanity slugs must be treated as permanent — changing a program's slug after assignments exist will silently orphan those assignments. Document this in the staff manual.

**Atomic claim:** `SubRequest` status flip to CLAIMED and `SubClaim` creation are wrapped in `db.$transaction([...])` — if either fails, neither is written.

**Reply notification targeting:** When a reply is posted, the system notifies the thread author + all users who have previously replied (deduplicated, excluding the current replier). This uses `distinct: ["authorId"]` on prior replies.

**Thread `updatedAt` bump:** Posting a reply calls `db.hostThread.update({ data: { updatedAt: new Date() } })` to float the thread to the top of the list (ordered by `updatedAt desc`).

**Cron dedup:** The `check-unassigned-hosts` cron checks `db.alert.findFirst({ where: { type: "UNASSIGNED_SESSION", linkUrl, createdAt: { gte: since24h } } })` before creating — so running the cron multiple times on the same day for the same program creates at most one alert per manager.

**Author name display:** All posts and replies display the author's real name from DB. For the current user's own content, `(you)` is appended as italic muted text. Optimistic new replies use `currentUserName` passed as a prop from the server — not the static string "You".

**Calendar layout:** The Schedule page uses `hub-page--wide` (removes max-width cap) so the 7-column calendar doesn't feel squeezed inside the account sidebar layout. A `min-width: 560px` floor on the calendar inner elements triggers horizontal scroll below that width rather than collapsing columns. Event labels use `-webkit-line-clamp: 2` to show two lines instead of single-line truncation.

**Alert dismiss:** Clicking an alert's link navigates to the target page but does NOT call `markRead()`. Only the ✕ button and "Mark all read" button dismiss alerts. This is intentional — the user stays in control of their read state.

**CSS prefix:** `hub-` for all hub UI; `alert-strip` for the dashboard alert component.

---

| 2026-03-09 (session 34–35) | Enhanced member profiles + Household / Family Grouping. **(1) Enhanced member profiles (§11 update):** Added `preferredName`, structured address (`addressLine1 / addressCity / addressState / addressZip`), `memberStatus` enum (`ACTIVE / VISITOR / STUDENT / VOLUNTEER / INACTIVE`), `firstVisitDate`, `adminNotes` (admin-only), and `tags` (freeform array, pill input) to the User model; DB pushed. Status-driven access: INACTIVE is the only status that blocks login — stamps `archivedAt = new Date()` and invalidates sessions; any other status clears `archivedAt`. `effectiveStatus` pattern handles legacy archived members (auto-corrects on profile load, syncs to DB on save). Member list: sort by multiple columns (click header); status filter dropdown replacing the old "Archived" toggle. `adm-` CSS updates for status column, sort arrows, filter dropdown, admin notes banner. **(2) Household/Family Grouping (§22 new — full feature):** New `Household` + `HouseholdMember` Prisma models; `RelationshipType` enum (SPOUSE/PARTNER/PARENT/CHILD/SIBLING/OTHER); `userId @unique` enforces one-household-per-member at DB level; migration run (`prisma db push`). 5 new API routes (households CRUD + member management). 2 new admin pages (`/admin/households` list + `/admin/households/[id]` detail). 2 new components: `HouseholdDetail` (full edit UI) + `HouseholdSection` (embedded in MemberDetail). HouseholdSection has two modes: "create new household" (makes this member primary) and "join existing household" (search for another member → GET their household → POST add current member). Address fallback: if member has no `addressLine1` but household does, show "No individual address — household address will be used: [City, State]" hint. Households list page has a custom-label frequency table at the bottom to surface Other labels for future enum promotion. 409 responses with human-readable messages. `AccountSidebar` adds "Households" link for REGISTRAR+. `hh-` CSS block. **(3) Manual:** New Chapter 3 "Member Accounts" inserted before Volunteer Roles chapter (8 sections: overview, member list, member profile, member status table with access column, tags, admin notes, households, common tasks). Written in warm companion voice — plain English, second-person, no jargon. Sidebar updated: "Member Accounts" now a real link with full navigation, "Coming soon" badge removed. |
| 2026-03-09 (session 36) | **Host Community Hub (§23 new):** Full replacement for Basecamp — three-tab tool inside the member area for the RIM host volunteer team. **(1) Schema:** `HOST_MANAGER` role added to Prisma enum. Six new models: `HostAssignment` (programSlug + userId + sessionDate? @@unique — Sanity slug as join key), `SubRequest` (OPEN/CLAIMED/CANCELLED), `SubClaim`, `HostThread` (OPERATIONAL/CONTEMPLATION categories; OPEN/CLOSED/ARCHIVED status), `HostReply`, `Alert` (site-wide; 5 AlertTypes). Five new enums. User relations for all new models. `prisma db push` run. **(2) Emails:** 4 new fire-and-forget functions: `sendSubRequestEmail`, `sendSubClaimedEmail`, `sendNewThreadEmail`, `sendNewReplyEmail`. **(3) Alert API + AlertStrip:** `GET/PATCH /api/account/alerts` (unread list + mark-read + mark-all-read). `AlertStrip` client component on dashboard — shows badge count, dismissible list. **(4) Hub navigation:** `HubTabNav` client component (Schedule / Sub Board / Threads / Manage tabs; Manage tab gated to HOST_MANAGER/ADMIN). `AccountSidebar` extended — `hasHost` check now includes HOST_MANAGER. **(5) API routes (12 new):** assignments GET/POST; assignment DELETE; sub-requests GET/POST; sub-request PATCH cancel; sub-request claim POST (atomic `db.$transaction`); threads GET/POST; thread GET/PATCH; replies POST. Reply notifications target author + all prior repliers (deduplicated, exclude current replier). **(6) Components (7 new):** `SubBoard` (claim flow), `SubRequestForm` (date picker), `ThreadList` (filter by category + new thread form), `ThreadDetail` (reply form + manager close/archive actions), `AssignmentManager` (program + host dropdowns, grouped display, delete). **(7) Hub pages (5):** schedule rewrite, `/account/host/subs`, `/account/host/threads`, `/account/host/threads/[id]`, `/account/host/manage`. **(8) Cron:** `check-unassigned-hosts` — daily at 16:00 UTC; fetches programs with `startDatetime` within 30 days, cross-checks assignments, creates `UNASSIGNED_SESSION` alerts for HOST_MANAGER+ADMIN; dedup prevents repeat alerts within 24h. Added to `vercel.json`. **(9) Other:** `allVirtualProgramsQuery` added to `lib/queries.ts` (no zoomLink filter — for assignment dropdown). `HOST_MANAGER` added to `MemberDetail` `ALL_ROLES` with description. `hub-` CSS block + `alert-strip` CSS. |
| 2026-03-10 (sessions 37–38) | **Hub polish + UX improvements (§23 update).** **(1) Schedule tab cleanup:** Removed `AddSessionForm` component + `+ Add Session` button (sessions are auto-seeded from Sanity; manual creation was vestigial). Removed "planning nudge" banner (confusing dismiss behavior). Fixed calendar event label: unclaimed sessions now show program name instead of "—". **(2) Calendar width + readability:** Added `hub-page--wide` modifier (removes max-width cap) to schedule page so the 7-column calendar isn't squeezed inside the sidebar layout. `min-width: 560px` floor → horizontal scroll on narrow viewports instead of collapsing columns. Cell `min-height` raised to 90px; event font to 10px; event label uses `-webkit-line-clamp: 2` for 2-line wrapping. **(3) Filter pills:** Three filter states (`all` / `mine` / `action`) rendered as pill buttons above the calendar. `filteredSessions` computed array applies to both calendar and list views. Context-sensitive empty-state messages. **(4) Author names in Conversations:** Thread detail and reply rows now always show the real author name; own posts annotated with italic `(you)` in muted text. Optimistic new replies use `currentUserName` prop (passed from server page) rather than the static string "You". `HubConversationsClient` thread list updated similarly. **(5) AlertStrip:** Removed `onClick={() => markRead(alert.id)}` from link clicks — clicking to navigate no longer auto-dismisses alerts. Fixed item alignment: `display: flex; align-items: center; justify-content: space-between` with `border-left: 2px solid #e8d9b8` accent. Individual ✕ button and "Mark all read" remain as the two dismiss paths. Commits: c5bdbfb, 6928bd9, deb8336. |

---

## 24. Multi-Hub Volunteer Workspace ✅ Built — session 39 (2026-03-11)

### What it does

A general-purpose hub system for ALL RIM volunteer teams — not just the host team. Each volunteer group (host team, people team, newsletter, greeter team, etc.) has its own hub workspace with Conversations (default tab), Documents, Members, and (for host-team only) a Schedule tab. The workspace is accessed via "Your Hubs" in the account sidebar. Announcements are now pinned conversation threads (merged in session 72).

### Who uses it

Any authenticated member who has a `HubMember` row for a given hub. Coordinators (`isCoordinator: true`) have extra privileges (post announcements, archive conversations, manage members). ADMIN always has coordinator access to every hub.

### Architecture

**Single hub system:**
- `/account/hub/[slug]/*` — general-purpose multi-hub workspace for all volunteer teams (Prisma models: Hub, HubMember, HubDocument, HubConversationThread, HubConversationReply). HubAnnouncement was retired in session 72 — announcements are now pinned conversation threads.

The host-team hub at `/account/hub/host-team` reuses the `HubScheduleClient` component connected to `HostAssignment` data via `apiBase="/api/host"`. The old `/account/host/*` pages were removed in session 42.

### 13 seeded hubs

| Slug | Name | Type | Schedule |
|---|---|---|---|
| `host-team` | Host Team | OPERATIONAL | ✅ |
| `people-team` | People Team | OPERATIONAL | |
| `newsletter` | Newsletter | OPERATIONAL | |
| `greeter` | Greeter Team | OPERATIONAL | |
| `av-team` | AV Team | OPERATIONAL | |
| `housekeeping` | Housekeeping | OPERATIONAL | |
| `plant-care` | Plant Care | OPERATIONAL | |
| `sangha-care` | Sangha Care | OPERATIONAL | |
| `km-support` | KM Support | OPERATIONAL | |
| `silent-meditation` | Silent Meditation | OPERATIONAL | |
| `volunteer-coordination` | Volunteer Coordination | OPERATIONAL | |
| `board` | Board | GOVERNANCE | |
| `teacher-council` | Teacher Council | GOVERNANCE | |

### Tabs per hub

| Tab | Always | Condition |
|---|---|---|
| Home | ✅ | Hub landing screen (default) |
| Conversations | ✅ | Pinned threads replace former Announcements tab |
| Programs | conditional | `slug === "registrar"` — stakeholder read-only view |
| Series + Lessons | conditional | `slug === "courses"` |
| Documents | ✅ | |
| Members | ✅ | |
| Trash | conditional | Admin, Guiding Teacher, or hub coordinator only |

*Tasks tab removed in session 96 — never adopted, schema and routes deleted.*

**Extracted to /tools/ (session 73):** Schedule, Session, Inbox, Settings tabs removed from hub nav. Full applications now live at `/tools/schedule` and `/tools/programs` (and `/tools/learning`, added later). `/tools/inbox` was extracted at the same time but the Support Inbox was subsequently removed entirely in session 100. See §37.

### New Prisma models

| Model | Purpose |
|---|---|
| `Hub` | A volunteer team hub — slug, name, type (OPERATIONAL/GOVERNANCE), hasSchedule, documentCategories[], conversationCategories[] |
| `HubMember` | User membership in a hub — position, isCoordinator, lastVisitedAt (for unread tracking) |
| `HubAnnouncement` | ~~Retired session 72~~ — announcements migrated to pinned conversation threads |
| `HubDocument` | Link or file attached to a hub — label, url, description, fileType, category |
| `HubConversationThread` | Discussion thread — title, body, category, status (OPEN/CLOSED/ARCHIVED), isPinned, pinnedAt |
| `HubConversationReply` | Reply to a thread — body, author |

### Key files

**Layout + auth:**
- `app/account/hub/[slug]/layout.tsx` — auth check + membership check + HubHeader + HubNavStrip + AccountLayout wrapper
- `lib/hubAuth.ts` — `getHubMembership(slug, userId)` helper; `requireCoordinator()` guard

**Pages:**
- `app/account/hub/[slug]/page.tsx` — Redirect to conversations (hub home)
- `app/account/hub/[slug]/schedule/page.tsx` — Schedule (hasSchedule hubs only)
- `app/account/hub/[slug]/documents/page.tsx` — Documents
- `app/account/hub/[slug]/conversations/page.tsx` — Conversations list
- `app/account/hub/[slug]/conversations/[id]/page.tsx` — Conversation thread detail
- `app/account/hub/[slug]/members/page.tsx` — Members list

**Components:**
- `components/HubHeader.tsx` — hub name, type badge, member count + avatar strip
- `components/HubNavStrip.tsx` — horizontal tab nav (renders only tabs that apply to this hub)
- `components/HubDocumentsClient.tsx` — document list + add form (coordinator only)
- `components/HubConvClient.tsx` — conversation list + new thread form
- `components/HubConvThreadClient.tsx` — thread detail + replies + reply form
- `components/HubMembersClient.tsx` — member list (coordinator can remove members, change position)
- `components/HubManageClient.tsx` — hub settings editor (coordinator only)
- `components/HubScheduleClient.tsx` — shared with `/account/host/schedule`; receives `apiBase` prop (`"/api/host"` for hub schedule, default for host page)

**API routes:**
| Route | Methods | Purpose |
|---|---|---|
| `/api/hub/[slug]` | GET, PATCH | Hub details; update settings (coordinator) |
| `/api/hub/[slug]/conversations` | GET, POST | List threads (pinned first); create thread |
| `/api/hub/[slug]/conversations/[id]` | GET, PATCH | Thread detail; change status; pin/unpin (coordinator) |
| `/api/hub/[slug]/conversations/[id]/replies` | POST | Add reply |
| `/api/hub/[slug]/documents` | GET, POST | List documents; add document |
| `/api/hub/[slug]/documents/[id]` | PATCH, DELETE | Update/remove document |
| `/api/hub/[slug]/members` | GET | List members with roles |

**Seed scripts:**
- `prisma/seed-hubs.ts` — creates all 13 Hub records (safe to re-run)
- `prisma/seed-jesse-hubs.ts` — adds Jesse Foy (all matching accounts) as coordinator of all hubs

**AccountLayout integration:**
- `components/AccountLayout.tsx` — queries `HubMember` for the current user; passes `hubLinks` to `AccountSidebar`
- `components/AccountSidebar.tsx` — renders "Your Hubs" section with links to each hub

### Technical notes

**Hub access check:** The layout queries the hub including all members, then checks if `session.user.id` is in the members array. ADMIN bypasses the member check. If not a member, a friendly "You don't have access" message is shown (not a redirect, to avoid confusion).

**`hasSchedule` flag:** Only `host-team` has `hasSchedule: true`. The Schedule tab is conditionally included in `HubNavStrip`. The schedule page itself calls `notFound()` if `!hub.hasSchedule`.

**Shared `HubScheduleClient`:** Used by both `/account/host/schedule` (the old host-only page) and `/account/hub/host-team/schedule`. The hub page passes `apiBase="/api/host"` to connect to the same HostAssignment API. The host page uses the default `apiBase` which is also `/api/host`.

**`lastVisitedAt` tracking:** Each hub page visit updates `HubMember.lastVisitedAt`. Dashboard hub cards compute an unread count (threads created/replied since `lastVisitedAt` + unread Alerts for host-team) and display a teal badge. ADMIN bypasses this (no HubMember records).

**CSS prefix:** `hub-` for all hub UI. Key CSS classes:
- `.hub-page` — max-width 920px, 36px side padding; constrained by `AccountLayout`'s sidebar + `ac-content`
- `.hub-hdr` / `.hub-hdr__eyebrow` / `.hub-hdr__title` / `.hub-hdr__meta` — hub header component (title 26px serif, eyebrow 11px uppercase)
- `.hub-tabs` / `.hub-tabs__link--active` — horizontal tab nav; active tab uses slate/steel spec colors
- `.hub-cal` — single-card calendar (border + border-radius on outer wrapper, cells use `#eceae5` internal borders, no rounded corners on cells)
- `.hub-cal__day-num--today` — 22px circle with `#2d3f47` background on today's date number only
- `.hub-cal__event--mine/covered/needs` — all-border (1px solid) chips with spec colors; 11px/600 weight
- `.hub-sched-list-outer/wrap/head/row` — 6-column grid table for list view
- `.hub-sched-row-panel` — inline detail panel container (list view); renders directly below the clicked row
- `.hub-detail` — session detail panel (card with 24px/28px padding, 22px serif title)

**Calendar / list UI (HubScheduleClient):**
- Filter pills (All / Mine / Needs Attention) filter both calendar and list views simultaneously
- Calendar: single-card spec layout; today's date shown as dark circle on the number only
- List view: clicking a row opens the `SessionDetail` panel inline, directly below that row — not at the bottom of the page
- Calendar view: `SessionDetail` renders below the calendar grid
- Both views: month nav arrows + calendar/list toggle in the toolbar row

**Schedule data model (updated session 58 — 2026-03-16):**
- Programs drive the schedule — not HostAssignment records. Every virtual/hybrid program with an occurrence in the current month appears on the calendar, whether or not a host has been assigned.
- `isOccurrenceOnDate()` logic (same as dashboard + session tab) determines which programs appear on each calendar day — handling one-time events, weekly recurrence (with interval + day filters + end count), and monthly/daily.
- Sessions without a HostAssignment get a synthetic id (`unassigned::${slug}::YYYY-MM-DD`) and display as "Needs Coverage."
- Claiming a synthetic session POSTs to `POST /api/host/assignments` with `action: "claim"` — creates the HostAssignment and claims it in one shot. Any HOST (not just managers) can self-claim.
- Real assignment ids use the existing `PATCH /api/host/assignments/[id]` flow unchanged.
- Month navigation (`GET /api/host/assignments?month=YYYY-MM`) now returns the full merged view — program occurrences + joined assignments — so unassigned sessions appear when navigating to other months too.

---

## ~~25 / 25b / 25c. Virtual Host Hub Attendance + Session Tracking~~ **DELETED — session 89 (2026-04-20)**

> **The entire attendance + session-reflection + post-session + session-end + session-history module was removed in session 89.** The feature was abandoned mid-build and never reached production. Schemas, routes, and UI deleted: `SessionAttendance`, `SessionReport`, `SessionCoHost`, `SessionCoHostReport` models, `PostSessionAction` enum, `/api/attendance/join`, `/api/attendance/session/[programSlug]/*` routes, session history pages, post-session form, session-live client, attendance emails. The remaining **live** hosting features are `HostAssignment`, `SubRequest`, `SubClaim` (see §21). Attendance tracking, if needed in the future, will be designed and built fresh. The sections below are preserved for historical reference only.

---

## ~~25. Virtual Host Hub — Phase 1: Attendance Tracking + Session View~~ ✅ Built — session 43 (2026-03-12) · **DELETED session 89**

### What it does
Gives hosts a live view of who's in each virtual session — updated in real time — and a structured post-session form for routing flagged attendees to the right staff. Establishes the hub-based member data projection model: volunteers see member data scoped to their workflow, without accessing `/admin/members`.

### Who uses it
Hosts (HOST role), hub managers (HOST_MANAGER), registrars, and admins. The Session tab appears only in the host-team hub.

### User flow

**During the session:**
1. Host joins via dashboard join button or hub schedule → `MeetJoinButton` records their attendance in the background (non-blocking)
2. Host opens `/account/hub/host-team/session` (Session tab) — sees a card for each virtual/hybrid program running today
3. Each attendee appears as a tappable button; tapping once flags them (`flaggedByHost = true`) with a red dot indicator
4. Tapping again un-flags. `New` and `Welcome back` badges show on new/returning attendees
5. Registered participants who haven't joined yet appear in a muted "Not yet joined" list
6. The view auto-refreshes every 60 seconds; no manual reload needed

**After the session:**
1. When a session's end time has passed, a "Post-session →" link appears on the program card
2. Host navigates to the post-session form (`/account/hub/host-team/session/[programSlug]/post`)
3. Three sections:
   - **Section 1 — Flagged people:** For each person tapped during the session, host adds a brief note and chooses routing: No action / Gentle follow-up (Jesse + coordinator) / Jesse only — sensitive / Technical issue (coordinator)
   - **Section 2 — Session reflection:** Open textarea, warm framing, optional
   - **Section 3 — Resource for the group:** Optional URL or text + description; routed to Jesse + coordinator for review before sending
4. Submit → records saved + notification emails fired based on action routing
5. Confirmation screen with back link

### Key files

| File | Role |
|------|------|
| `app/account/hub/[slug]/session/page.tsx` | Server page — fetches programs from Sanity + today's attendance from DB + registrations; passes to SessionLiveClient |
| `components/SessionLiveClient.tsx` | "use client" — polls via router.refresh() every 60s; flag tap handler; New/Returning badges; post-session link |
| `app/account/hub/[slug]/session/[programSlug]/post/page.tsx` | Server page — fetches flagged attendees + existing SessionReport for pre-fill |
| `components/PostSessionClient.tsx` | "use client" — three-section post-session form; POST to API on submit; confirmation state |
| `app/api/attendance/join/route.ts` | POST — records SessionAttendance; computes isNewMember + returningAfterAbsence |
| `app/api/attendance/[id]/flag/route.ts` | PATCH — toggles flaggedByHost (HOST/HOST_MANAGER/REGISTRAR/ADMIN) |
| `app/api/attendance/session/[programSlug]/post/route.ts` | POST — updates flagged attendance records + upserts SessionReport + sends notification emails |
| `components/MeetJoinButton.tsx` | "use client" — opens Meet URL immediately, fire-and-forget attendance POST |
| `lib/email.ts` | `sendPostSessionNotification()` — one email per recipient; `sendFirstTimeAttendeeEmail()` + `sendReturningAfterAbsenceEmail()` — DRAFT, disabled |
| `lib/queries.ts` | `sessionViewProgramsQuery` — extends virtualDashboardProgramsQuery with registrationEnabled |
| `public/css/custom.css` | `sv-` prefix (session live view) + `ps-` prefix (post-session form) |

### Technical notes

- **Hub-based member data projection:** Hosts see attendance scoped to their session workflow. No links to `/admin/members`. First implementation of the architectural pattern described in `RIM_System_Architecture.md`.
- **Recurrence logic:** `isOccurrenceToday()` + `shiftToToday()` identical to `dashboard/page.tsx` — hosts and members see exactly the same programs.
- **CT day boundaries:** `ctDayBounds(dateStr)` tests both CT offsets (-05:00 CDT, -06:00 CST) — attendance queries always span the correct UTC range regardless of DST.
- **Non-blocking attendance:** `MeetJoinButton` opens the Meet URL first, then fires the API. Attendance recording can never interrupt the join flow.
- **sessionDate normalization:** All attendance and report records store `sessionDate` as midnight CT. `new Date(sessionDate)` on the ISO string from the client produces the correct UTC time for Prisma's `@@unique` key.
- **60-second polling:** `SessionLiveClient` calls `router.refresh()` on an interval. This re-runs the server page component, re-queries the DB, and diffs the React tree — no WebSocket, no custom API polling.
- **Post-session idempotent:** The API uses `upsert` on `SessionReport` — submitting twice updates in place without creating duplicates. The form pre-fills from the existing report if one exists.
- **Email routing:** GENTLE_FOLLOWUP → Jesse + coordinator; JESSE_ONLY → Jesse only; TECHNICAL_ISSUE → coordinator only; NONE → no email. Recipients consolidated per person (one email with all relevant flags).
- **Automated emails (built, disabled):** `sendFirstTimeAttendeeEmail()` + `sendReturningAfterAbsenceEmail()` exist in `lib/email.ts` with DRAFT copy. Gated behind `ENABLE_ATTENDANCE_EMAILS=true` env var. Not enabled until copy is approved.

> **Session 76 note:** The Live Session view and Journal features (session history, team journal, post-session forms) were removed (~5,000 lines) as part of the LiveKit migration. These features will be rebuilt with LiveKit's real-time participant tracking instead of the Google Meet attendance model. See §38.

### New env vars

| Variable | Purpose |
|----------|---------|
| `JESSE_EMAIL` | Recipient for GENTLE_FOLLOWUP + JESSE_ONLY flags (falls back to `REGISTRAR_EMAIL`) |
| `HOST_COORDINATOR_EMAIL` | Recipient for GENTLE_FOLLOWUP + TECHNICAL_ISSUE flags (falls back to `REGISTRAR_EMAIL`) |
| `ENABLE_ATTENDANCE_EMAILS` | Set to `true` to enable automated first-time + returning-after-absence emails (default: disabled) |

---

## ~~25b. Virtual Host Hub — Phase 2: Session History + Attendance Hardening~~ ✅ Built — session 44 (2026-03-12) · **DELETED session 89**

### What it does
Phase 2 adds three things: (1) full session history for coordinators and team members; (2) a nightly cron that detects and reports missing post-session forms; (3) hardened attendance recording with session window guarding and upsert semantics. Also adds assigned-host display to the live session view and post-session form.

### Who uses it
- **Coordinator history** — HOST_MANAGERs and any HubMember with `isCoordinator: true`, plus ADMIN. Shows all past sessions with report status, attendance count, flagged people, and routing decisions.
- **Team journal** — any host-team HubMember or ADMIN. Shows reflections and resources from past sessions. No sensitive data.
- **Missing-report cron** — fires automatically; targets host-team coordinators via email.

### User flows

**Coordinator history (`/account/hub/host-team/session/history`):**
1. Coordinator opens Session tab → "Coordinator history →" link at bottom
2. Reverse-chronological list (30/page): program name, date, assigned host, attendance count, report status badge (Submitted / Missing)
3. Click any row → detail panel:
   - Assigned host, attendance count, who filed the report (+ note if it wasn't the assigned host)
   - Reflection text, resource URL+note
   - Flagged people section (coordinator-only): each person's name, routing label, host note
   - Full attendee list with New/Returning badges
4. "← Back to list" returns to paginated list at current page
5. "Team view →" link in header

**Team journal (`/account/hub/host-team/session/history/team`):**
1. Any host opens Session tab → "Session journal →" link at bottom
2. Reverse-chronological list: program + date + host name + attendance count
3. Each entry shows reflection text and resource if filed; "No reflection filed." if not
4. Pagination (30/page)
5. Coordinators/ADMIN see "Coordinator view →" link

**Missing-report cron (nightly 23:00 UTC):**
1. Vercel triggers `GET /api/cron/missing-reports` with Bearer token
2. Groups today's `SessionAttendance` records by (programSlug, CT date)
3. Checks each against `SessionReport` — if no report: fire email
4. Emails all host-team coordinators with: program name, session date, assigned host name, detail URL
5. Idempotent — if report is filed later, next nightly run sends nothing

### Key files

| File | Role |
|------|------|
| `app/account/hub/[slug]/session/history/page.tsx` | Coordinator view — $queryRaw + SessionReport + HostAssignment + Sanity; detail via query params |
| `app/account/hub/[slug]/session/history/team/page.tsx` | Team journal — same data, no sensitive fields, journal tone |
| `app/api/cron/missing-reports/route.ts` | Nightly cron — finds unreported sessions, emails coordinators |
| `lib/email.ts` | `sendMissingReportEmail()` — warm notification to coordinator |
| `app/account/hub/[slug]/session/page.tsx` | Added `sv-history-nav` footer links to both views; HOST_MANAGER+ADMIN see coordinator link |
| `public/css/custom.css` | `sh-` prefix (history pages) + `sv-history-nav` |
| `vercel.json` | Added `missing-reports` cron at `0 23 * * *` |

### Schema changes (session 44, same migration as Phase 2)

Four changes pushed in one `prisma db push`:

| Change | Field/Constraint |
|--------|----------------|
| `SessionAttendance` | `sessionDate DateTime?` — CT midnight, always set by `/api/attendance/join`; nullable for migration safety |
| `SessionAttendance` | `@@unique([userId, programSlug, sessionDate])` — prevents duplicate attendance for same session |
| `SessionReport` | `submittedByAssignedHost Boolean?` — null = no assignment existed; true = submitter matched assigned host; false = someone else submitted |
| `HostAssignment` | `@@unique([programSlug, sessionDate])` — prevents duplicate assignments for same session |

### Technical notes

- **`$queryRaw` for CT date grouping:** Both history pages use `DATE("joinedAt" AT TIME ZONE 'America/Chicago')::text` to group attendance records by CT date — avoids UTC midnight/CDT offset issues entirely. Returns a plain `YYYY-MM-DD` string, not a Date object.
- **JS merge of two sources:** Sessions exist in either `SessionAttendance` (grouped) or `SessionReport` (filed). Both are merged in JS using a `Map` keyed by `${programSlug}||${ctDate}`. Report-only sessions (filed with no attendance tracked) are included.
- **Detail view via query params:** `?detail_slug=X&detail_date=YYYY-MM-DD` — no client state needed. Pagination page preserved in the "Back" link so the user returns to the same page.
- **`fetchSessionDetail` uses `sessionDate` field:** Queries `SessionAttendance.sessionDate` directly (the new CT midnight field), not a `joinedAt` range. Requires that all records have the field populated.
- **Upsert replaced by findUnique + update/create in `/api/attendance/join`:** Lets us distinguish new vs. existing records for email logic. Automated emails (first-time, returning) only fire on new records — re-joining mid-session updates `joinedAt` silently.
- **Session window guard:** On every join attempt, `/api/attendance/join` fetches `{ startDatetime, endDatetime }` from Sanity for the programSlug, shifts the anchor datetime to today's occurrence, and checks whether `now` is within ±1h. Null `startDatetime` → always allow. Outside window → returns `{ ok: true }` silently (no 4xx — fire-and-forget client).
- **`submittedByAssignedHost` computation:** Server reads `assignedHostId` from the POST body, compares to `session.user.id`. Three states stored: `null` (no HostAssignment existed), `true` (submitter was the assigned host), `false` (different person submitted).
- **Assigned host display:** Live session view now shows a "Hosting today" badge above the attendees list (from HostAssignment batch query). Post-session form header shows assigned host name; the API stores `submittedByAssignedHost` silently.
- **Cron auth:** Same pattern as all other crons — `Authorization: Bearer ${CRON_SECRET}`, Vercel injects automatically.
- **Coordinator access gate in history:** Uses `isCoordinator` from `getHubMembership()` (HubMember.isCoordinator flag). Navigation link gated by HOST_MANAGER|ADMIN roles (proxy for coordinator status, avoids extra DB query on session page).

---

## ~~25c. Virtual Host Hub — End Session Button + Membership Sync Fix~~ ✅ Built — session 45 (2026-03-12) · **DELETED session 89**

### What it does
Three additions in one session:

**(1) End Session button** — Hosts can manually close the live session by clicking "Close session & write notes →" in the Session tab. Redirects immediately to the post-session form and sets a `sessionEndedAt` hard cutoff in the DB — no new attendance records accepted after this point, regardless of the program's scheduled end time. A "Session closed [time]" badge is shown to all hosts in the live view so a second host knows the room is done.

**(2) Hub membership sync** — Assigning the HOST or HOST_MANAGER role via the admin interface now auto-creates the `HubMember` record required for hub access. Previously, a role grant didn't touch `HubMember`, so the hub card never appeared on the user's dashboard. Removing both HOST roles deletes the record.

**(3) Email URL fix** — Five stale links in `lib/email.ts` corrected (left from the session 42 migration that deleted the old `/account/host/*` routes).

### Who uses it
- **End Session button:** HOST, HOST_MANAGER, ADMIN only — button visible only to eligible roles. The "Session closed" badge is visible to all hub members viewing the session tab.
- **Membership sync:** Automatic — fires on every role update via admin PATCH route. No user action needed.

### User flow — End Session

1. Host opens Session tab; session is running
2. Clicks "Close session & write notes →" (only visible while `!sessionEnded && !sessionEndedAt`)
3. Button shows "Closing…" (loading state; disabled)
4. `POST /api/attendance/session/[programSlug]/end` — upserts `SessionReport` with `sessionEndedAt = now`
5. On success: immediate redirect to the post-session form
6. All hosts viewing the tab will see "Session closed [time]" badge on next 60s poll refresh

### Key files

| File | Role |
|------|------|
| `prisma/schema.prisma` | `sessionEndedAt DateTime?` on `SessionReport` |
| `app/api/attendance/session/[programSlug]/end/route.ts` | POST — upserts SessionReport with sessionEndedAt; HOST/HOST_MANAGER/ADMIN auth |
| `app/api/attendance/join/route.ts` | Hard cutoff: checks SessionReport.sessionEndedAt before the Sanity time-window fetch |
| `app/account/hub/[slug]/session/page.tsx` | Fetches today's ended reports in parallel; passes sessionEndedAt + canEndSession to client |
| `components/SessionLiveClient.tsx` | New props (sessionEndedAt, canEndSession); button + ended badge + redirect logic |
| `lib/syncHubMembership.ts` | ROLE_HUB_MAPPINGS → upserts/deletes HubMember records on role change |
| `app/api/admin/members/[id]/route.ts` | Calls syncHubMembership after every role update |
| `public/css/custom.css` | sv-end-wrap, sv-end-btn, sv-ended, sv-ended__label, sv-ended__time |

### Technical notes

- **Stub record pattern:** The end-session API uses `upsert` on `@@unique([programSlug, sessionDate])`. Creates a stub with only `sessionEndedAt` if no `SessionReport` exists — the post-session form fills in the rest.
- **Hard cutoff before time window:** Join route checks `SessionReport.sessionEndedAt` first (DB lookup) before the Sanity fetch. Both outside-window and closed-session return `{ ok: true }` silently.
- **Badge visibility:** When `sessionEndedAt` is set, the "Session closed [time]" badge renders regardless of role — so any host on the tab sees it.
- **syncHubMembership design:** `ROLE_HUB_MAPPINGS` constant maps role names to hub slugs/positions/isCoordinator. HOST_MANAGER wins over HOST if both roles are held (isCoordinator: true beats false). Only manages hub slugs in the mapping — seeded HubMember records for other hubs are untouched.
- **Email URL fix:** `/hosts` → `/account/hub/host-team`; `/account/host/subs` → `/account/hub/host-team/schedule` (x2); `/account/host/threads/${threadId}` → `/account/hub/host-team/conversations/${threadId}` (x2).

---

## 26. Email Template Manager ✅ Built — sessions 48–49 (2026-03-13)

### What it does
A database-backed system for managing all transactional email copy without code deploys. Admins can edit subject lines, body copy, and contextual help text; toggle delivery on/off; preview exactly what recipients will receive; and insert template variables via clickable chips — all from `/admin/emails`.

### Who uses it
ADMIN only — the list and edit pages are gated to the ADMIN role.

### Standing rule — PERMANENT
**All transactional emails at RIM are managed via the Email Template Manager at `/admin/emails`.** Adding a new automated email requires:
1. A new `EmailTemplate` seed record in `prisma/seed-email-templates.js` with a unique `slug`
2. A `sendTemplatedEmail(slug, to, variables)` call in the relevant API route or cron

No email copy lives in code for any managed template. The 11 retained hardcoded functions are exceptions for structural reasons only (attachments, conditional logic, auth flows, PortableText rendering).

### User flow — editing a template

1. Admin opens `/admin/emails` → templates grouped by section (Registration & Programs, Host Hub, General)
2. Clicks "Edit →" on a row → `/admin/emails/[slug]`
3. Reads the help text above the subject (grey paragraph + blue Sanity-origin callout if any variables come from Sanity)
4. Edits subject line (plain text input) and/or body (RimEditor — full markdown toolbar; variable `{{tokens}}` render as amber pills in the editor)
5. Clicks a variable chip in the reference panel → inserts `{{token}}` at the cursor
6. Clicks "Preview" → modal opens with the email rendered exactly as it will arrive (variable tokens shown as `[firstName]`, `[programName]`, etc.)
7. Clicks "Save changes" → DB updated, `updatedAt` + `updatedBy` recorded
8. Toggles "Enabled" checkbox → controls whether the trigger sends the email or silently skips

### User flow — toggling delivery

- **Disabled (default):** `sendTemplatedEmail()` fetches the template, checks `enabled: false`, returns without sending. No error, no side effect.
- **Enabled:** Template is fetched, variables substituted, body rendered to HTML, sent via Resend.

### Key files

| File | Role |
|---|---|
| `prisma/schema.prisma` | `EmailTemplate` model |
| `prisma/seed-email-templates.js` | One-time seed for 7 templates (run once, idempotent) |
| `prisma/seed-email-groups.ts` | One-time seed: assigns group/groupLabel to all 7 templates |
| `prisma/seed-email-help-text.js` | One-time seed: writes helpText + sanityNote for all 7 templates |
| `lib/email.ts` | `sendTemplatedEmail()`, `renderTemplateToHtml()`, `wrapInEmailChrome()`, `EMAIL_BASE_CSS` |
| `lib/tiptap-variable-node.ts` | Custom Tiptap inline node — renders `{{token}}` as amber pill; serializes back |
| `lib/portableTextEmail.ts` | `portableTextToEmailHtml`, `portableTextToEmailText`, `portableTextToMarkdown` |
| `app/admin/emails/page.tsx` | Template list page — grouped by section |
| `app/admin/emails/[slug]/page.tsx` | Template edit page (server component, loads `EmailTemplateEditor`) |
| `components/EmailTemplateEditor.tsx` | "use client" editor — helpText, sanityNote callout, subject, chrome bands, RimEditor body, variable chips, toggle, save, preview modal |
| `components/RimEditor.tsx` | Shared Tiptap v3 editor — includes VariableNode, link inline popover |
| `app/api/admin/emails/[slug]/route.ts` | PATCH: save subject/body/enabled, record updatedById |
| `app/api/admin/emails/[slug]/preview/route.ts` | POST: render body with placeholder values, return HTML |
| `components/AccountSidebar.tsx` | "Emails" link (ADMIN only) |
| `public/css/custom.css` | `em-` prefix CSS block; `re-` prefix for RimEditor; `.ri-var-chip` |

### Technical notes

- **Render pipeline:** `sendTemplatedEmail` → `{{token}}` substitution → `marked(body)` → `wrapInEmailChrome(html)` → `juice(html, EMAIL_BASE_CSS)` → Resend. The same `renderTemplateToHtml()` function is called by both the send path and the preview API — ensures pixel-identical output.
- **`wrapInEmailChrome()`:** Wraps markdown-rendered HTML in the standard RIM email table layout (dark blue `#135274` header, white card, 600px max-width, footer with domain).
- **`EMAIL_BASE_CSS`:** CSS string targeting standard markdown-generated tags (`p`, `h2`, `h3`, `ul`, `ol`, `blockquote`, `a`, `hr`, `strong`, `em`) so `juice` can inline them into every element.
- **`juice`:** CSS inlining library — takes `(html, css)` and returns HTML with all styles inlined. Required because most email clients strip `<style>` blocks. `@types/juice` doesn't exist; juice ships its own `.d.ts`.
- **Preview modal:** Variables are replaced with `[variableName]` placeholders before rendering so the admin can see the email structure with labelled slots. The full render pipeline still runs — the preview is not a mock.
- **`variables` array:** Stored on the template record, used only for the admin variables-reference panel. `sendTemplatedEmail` substitutes whatever keys are passed in `variables: Record<string, string>` — no validation against the stored array.
- **Enabled check:** If `enabled: false`, `sendTemplatedEmail` returns immediately after the DB fetch — no Resend call, no error thrown. Triggers during rollout / testing period are silently absorbed.
- **`marked` import:** Dynamic `await import("marked")` avoids top-level ESM issues. `marked.parse(body)` returns a string.
- **Group fields:** `group` (key), `groupLabel` (display), `minRole` (default "ADMIN") — used by the list page to render section headers. All 7 templates seeded with correct groups.
- **VariableNode (tiptap-variable-node.ts):** Custom Tiptap inline atom node. Renders `{{token}}` as a styled amber pill (`.ri-var-chip`) in the editor. Serializes back to `{{token}}` via tiptap-markdown `storage.markdown.serialize`. Parses via `storage.markdown.parse.setup(markdownit)` — registers a custom markdownit inline rule with a duplicate-registration guard (tiptap-markdown v0.9 calls `setup()` on every `parse()` invocation; the guard prevents the rule being registered multiple times on the same markdownit instance). `insertVariable(name)` command available on the editor instance.
- **Link inline popover (RimEditor):** Replaces `window.prompt`. Opens on toolbar link button; pre-fills from existing href if cursor is on a link; pressing the button on an active link removes it without opening the popover. Enter and Escape are handled. Dismisses on outside click via `useEffect` + `pointerdown`.
- **Chrome bands (EmailTemplateEditor):** Two non-interactive `aria-hidden` divs flanking the RimEditor body — dark blue header ("Rooted In Mindfulness") and warm footer (address line). Shows the admin what the email wrapper looks like without being part of the editable body.
- **helpText + sanityNote:** Nullable fields on `EmailTemplate`. `helpText` shows as a muted paragraph above the subject input. `sanityNote` shows as a distinct teal callout block — used for variables that originate from program records (programName, programTitle, dateText, locationText, zoomLink, reminderMessage). Updated in session 54: notes now reference "the program record" instead of "Sanity Studio". Seeded for all 7 templates.
- **`portableTextToMarkdown()`:** Utility in `lib/portableTextEmail.ts`. Converts a Portable Text array to a markdown string (bold → `**text**`, italic → `*text*`, links → `[text](href)`, bullet → `- text`, numbered → `1. text`). Resolves `markDefs` manually to handle link marks. Used for legacy Portable Text `reminderMessage` in `sendReminderEmail`. `portableTextToEmailHtml` and `portableTextToEmailText` were removed in session 54 (no longer needed — programs use Tiptap JSON now).

### Complete email function inventory — permanent reference

This table documents all 18 email functions in `lib/email.ts`. Keep it current if any function is added, migrated to managed, or removed.

**8 managed — `sendTemplatedEmail()` — editable in Email Template Manager**

| Function | Template slug | Group | Variables | Trigger |
|---|---|---|---|---|
| `sendSignInCodeEmail` | `sign-in-code-new-user` / `sign-in-code-returning` | Authentication | code, isNewUser | NextAuth `sendVerificationRequest` — fires when a member enters their email on `/login`. Picks the slug by `isNewUser`. Calls `sendTemplatedEmail` with `throwOnFailure: true` so a missing/disabled template surfaces to the user. Replaced `sendMagicLinkEmail` in session 119 (2026-05-21). |
| `sendFirstTimeAttendeeEmail` | `first-time-attendee` | Registration & Programs | firstName, programName, sessionDate | First recorded session attendance |
| `sendReturningAfterAbsenceEmail` | `returning-after-absence` | Registration & Programs | firstName, programName, sessionDate | Attends after 6+ week gap |
| `sendReminderEmail` | `session-reminder` | Registration & Programs | firstName, programTitle, dateText, locationText, zoomLink, reminderMessage, dashboardUrl | Pre-session reminder (cron or manual). `reminderMessage` → `portableTextToMarkdown()` |
| `sendHostRoleAssignmentEmail` | `host-role-assigned` | Host Hub | firstName, hostAreaUrl, manualUrl | HOST or HOST_MANAGER role granted |
| `sendSubRequestEmail` | `sub-request-posted` | Host Hub | firstName, requesterName, programName, sessionDate, message, hubUrl | Host posts sub request |
| `sendSubClaimedEmail` | `sub-request-claimed` | Host Hub | firstName, claimerName, programName, sessionDate, message, hubUrl | Host claims sub request |
| `sendMissingReportEmail` | `missing-report-alert` | Host Hub | programName, sessionDateDisplay, assignedHostName, detailUrl | Nightly cron: no post-session report |

**9 hardcoded — migration candidates (structural blockers, see comments in code)**

| Function | Proposed slug | Variables | Reason hardcoded |
|---|---|---|---|
| `sendRegistrationEmail` | `registration-confirmation` | firstName, programTitle, programUrl, dateText, locationText, confirmationMessageHtml, googleCalendarUrl, icsUrl, waitlistPosition | .ics attachment; conditional Google/Apple calendar links; inline PT HTML; two divergent layouts (confirmed vs waitlisted). Needs attachment + conditional block support |
| `sendApprovalEmail` | `waitlist-approval` | firstName, programTitle, programUrl, danaUrl (conditional) | Conditional dana section alters the email layout; needs conditional block support |
| `sendCancellationNotificationEmail` | `registration-cancelled` | registrantName, registrantEmail, programTitle, volunteerUrl | Recipient is `REGISTRAR_EMAIL` env var (staff), not the registrant; lower priority |
| `sendEditRequestEmail` | `edit-request` | firstName, programTitle, editUrl | editUrl contains a single-use token generated at send time. Good migration candidate — token as variable |
| `sendResponsesUpdatedEmail` | `responses-updated` | registrantName, programTitle, volunteerUrl | Recipient is `REGISTRAR_EMAIL` env var (staff); lower priority |
| `sendDanaReminderEmail` | `dana-reminder` | firstName, programTitle, registerUrl | Straightforward candidate; held until dana workflow is stable |
| `sendRoleAssignmentEmail` | `registrar-role-assigned` | firstName, dashboardUrl, manualUrl | Predates template system; `sendHostRoleAssignmentEmail` (same data shape) is already managed |
| `sendNewThreadEmail` | `hub-new-thread` | firstName, authorName, threadTitle, categoryLabel, threadUrl | Conditional categoryLabel derived from OPERATIONAL/CONTEMPLATION enum |
| `sendNewReplyEmail` | `hub-new-reply` | firstName, replierName, threadTitle, threadUrl | Built before template system; simplest candidate for next migration |

**1 hardcoded — must stay (cannot be managed)**

| Function | Variables | Reason must stay |
|---|---|---|
| `sendPostSessionNotification` | programSlug, sessionDate, hostName, flags[], reflection, resourceUrl | Per-recipient routing: one call sends up to 2 separate emails to different recipients based on flag type (GENTLE_FOLLOWUP → Jesse + coordinator; JESSE_ONLY → Jesse; TECHNICAL_ISSUE → coordinator). Consolidates multiple flags per recipient. Not templateable |

*(`sendMagicLinkEmail` was in this table until session 119, 2026-05-21. The 6-digit sign-in code that replaced magic links is templated — see `sendSignInCodeEmail` and the two `sign-in-code-*` templates in the row above.)*

### Future migration candidates (priority order)

| Function | Proposed slug | Blocker / Notes |
|---|---|---|
| `sendNewReplyEmail` | `hub-new-reply` | No blocker — simplest email in the codebase |
| `sendDanaReminderEmail` | `dana-reminder` | No blocker — waiting on dana workflow stability |
| `sendRoleAssignmentEmail` | `registrar-role-assigned` | No blocker — mirrors `host-role-assigned` exactly |
| `sendNewThreadEmail` | `hub-new-thread` | Minor: categoryLabel derived from enum — could be passed as a variable |
| `sendEditRequestEmail` | `edit-request` | No blocker — token already a variable in proposed slug |
| `sendCancellationNotificationEmail` | `registration-cancelled` | Recipient is env var, not DB — needs a way to address staff recipients |
| `sendResponsesUpdatedEmail` | `responses-updated` | Same staff-recipient issue as above |
| `sendApprovalEmail` | `waitlist-approval` | Needs conditional block support in template engine |
| `sendRegistrationEmail` | `registration-confirmation` | Needs attachment support + conditional blocks — largest migration effort |

---

## 27. Teacher Hub & Content Management

**What it does:** A full content management system for series (called "courses" in the DB) and lessons, accessible to TEACHER and ADMIN roles via the Teacher Hub at `/account/hub/teacher`. Series and lessons are stored in Postgres (migrated from Sanity). The Teacher Hub provides CRUD interfaces for creating, editing, and organizing series and lessons, including a rich Tiptap editor with custom block support and file uploads via Vercel Blob.

> **Naming note (session 59):** The DB model is `Course` and the Prisma enum is `CourseAccessLevel`, but all UI labels say "Series." This is a deliberate rename — RIM's content is better described as a series of teachings than a "course." DB model name unchanged to avoid a migration.

### Who uses it
| Role | Access |
|---|---|
| `TEACHER` | Full CRUD for series and lessons |
| `ADMIN` | Same as TEACHER (bypasses hub membership check) |

### Teacher Hub layout
The Teacher Hub reuses the multi-hub workspace system (`/account/hub/[slug]`). When `slug === "teacher"`, the hub root redirects to `/account/hub/teacher/courses` and the tab bar shows **Series** and Lessons as the primary tabs (before Announcements, Documents, Conversations, Members).

### Series Editor (`CourseEditor.tsx`)
- Create/edit series with title, auto-generated slug, subheading, description (FormattedEditor/Tiptap JSON), access level (MEMBERS / REGISTRATION_REQUIRED), active toggle
- **No sort order field** — removed in session 59 (was a Webflow artifact; lesson order is managed by drag-and-drop)
- **Lesson manager with section dividers** (edit mode only):
  - Lessons and section dividers share one flat draggable list
  - **`+ Add Section`** button inserts a styled section-divider row (teal dashed border, "SECTION" badge, inline-editable label, ✕ remove)
  - Dragging reorders both lessons and section dividers freely
  - On save, each lesson's `groupLabel` is derived from the section-divider row immediately above it (or null if none precedes it)
  - `+ New Lesson` button: inline title input → POST `/api/lessons` → immediately added to list
  - Search-to-add existing lessons (debounced API call to `/api/lessons/search`)
  - Remove button per lesson; delete protection on series: returns 409 if ProgramCourse records exist
- `listToLessonOrder()` helper serializes the flat items array to `{ id, groupLabel }[]` for the PATCH payload
- `courseLessonsToList()` helper reconstructs the flat items array from `CourseLesson[]` with `groupLabel` on load

### Lesson Editor
- Create/edit lessons with internal title, displayed title, auto-generated slug, section title toggle
- **Rich Markdown editor** (`@uiw/react-md-editor`): live preview, toolbar, `height={500}`, wrapped in `<div data-color-mode="light">`
- **Custom block insertion buttons** — three buttons above the editor insert pre-formatted Markdown blockquotes: `[verse]` (pull quote with attribution), `[practice]` (practice suggestion box), `[callout]` (key insight highlight)
- Media section: image upload (Vercel Blob), audio upload (Vercel Blob), video URL input
- Header quote and quote source fields
- Teachers field (comma-separated names)
- Resources: inline list builder with name, URL, and resource type per row

### Custom block rendering (lesson pages)
The `/lessons/[slug]` page uses `react-markdown` with a custom `blockquote` component that intercepts Markdown blockquotes beginning with `[verse]`, `[practice]`, or `[callout]`:

| Prefix | Renders as | CSS class | Visual |
|---|---|---|---|
| `[verse]` | `lp-verse-quote` | Existing | Centered italic serif, `~` decoration via `::before`/`::after` |
| `[practice]` | `lp-callout` | Existing | Teal "Practice Suggestion" box with title + content |
| `[callout]` | `lp-callout-block` | New | Italic serif, 3px left border accent, warm background |

The `extractText()` helper recursively extracts plain text from React children nodes to detect the prefix tag. Standard blockquotes (without a recognized prefix) render normally.

### File uploads
`POST /api/upload` — universal file upload endpoint using Vercel Blob **client-side upload** pattern. Auth-gated to TEACHER or ADMIN (checked inside `onBeforeGenerateToken`). Max file size: 500 MB. Requires `BLOB_READ_WRITE_TOKEN` env var in Vercel.

**How it works:** The browser calls `upload()` from `@vercel/blob/client`, which makes two requests to `/api/upload`: (1) `blob.generate-client-token` — server validates auth, returns a signed token; (2) browser uploads directly to Vercel Blob (bypasses the 4.5 MB serverless function body limit); (3) `blob.upload-completed` — Vercel calls back to confirm. This replaced the original server-side `put()` approach which failed on audio files larger than 4.5 MB.

**Auto-save:** After a successful upload (or file removal), `autoSaveField()` immediately PATCHes just the changed field to the DB — no need to click Save. This uses the URL directly from the upload response (not React state) to avoid closure issues.

### Editor UX
Both `CourseEditor` and `LessonEditor` show a "View course/lesson page →" link in the editor header (edit mode only) that opens the public page in a new tab.

### Hub membership sync
When the TEACHER role is granted via admin member detail, `syncHubMembership()` auto-creates a `HubMember` record for the teacher hub. Removing the role clears the record.

### Key files
- `app/account/hub/[slug]/courses/page.tsx` — course list (server component)
- `app/account/hub/[slug]/courses/new/page.tsx` — new course page
- `app/account/hub/[slug]/courses/[courseSlug]/page.tsx` — edit course page (loads + serializes for client)
- `app/account/hub/[slug]/lessons/page.tsx` — lesson list (server component)
- `app/account/hub/[slug]/lessons/new/page.tsx` — new lesson page
- `app/account/hub/[slug]/lessons/[lessonSlug]/page.tsx` — edit lesson page (loads + serializes for client)
- `app/account/hub/[slug]/announcements/page.tsx` — dedicated announcements route (moved from hub root for teacher hub)
- `components/CourseEditor.tsx` — client component: course form + lesson manager with search and reorder
- `components/LessonEditor.tsx` — client component: MDEditor, custom block buttons, file uploads, resource builder
- `components/LessonListClient.tsx` — client component: lesson table with search filter
- `app/api/courses/route.ts` — GET (list) / POST (create)
- `app/api/courses/[slug]/route.ts` — GET / PATCH / DELETE
- `app/api/lessons/route.ts` — GET (list) / POST (create)
- `app/api/lessons/[slug]/route.ts` — GET / PATCH / DELETE
- `app/api/lessons/search/route.ts` — GET `?q=` search
- `app/api/upload/route.ts` — POST file upload via Vercel Blob
- `lib/syncHubMembership.ts` — TEACHER → teacher hub mapping
- `prisma/seed-hubs.ts` — teacher hub seed record

**🔧 Technical notes:**
- Content stored as Tiptap JSON (`Json?` Prisma type). Editors use `editor.getJSON()` for output, accept JSON or null as input.
- `ContentEditor` uses `@tiptap/react` with StarterKit, Link, Placeholder, Markdown (tiptap-markdown), plus three custom extensions (VerseQuote, PracticeSuggestion, Callout) from `lib/tiptap-extensions.ts`
- `FormattedEditor` uses the same base extensions minus the three custom blocks
- Rendering: `renderContentBody()` and `renderFormattedText()` in `lib/renderRichContent.ts` use `@tiptap/html` `generateHTML()` server-side
- Custom block class mapping: PracticeSuggestion → `lp-callout` (shared with Sanity PortableText on program pages), Callout → `lp-callout-block`, VerseQuote → `lp-verse-quote`
- `rte-` CSS prefix for all editor styles in `custom.css`. Toolbar is flex-wrap with `rte-divider` separators. Block insert buttons use `rte-btn--block` modifier.
- `th-` CSS prefix for all Teacher Hub styles (~150 lines): tables, badges, buttons, form fields, editor sections, lesson manager, media preview, resource rows
- `useRef` in React 19 requires initial argument: `useRef<T | null>(null)` not `useRef<T>()`
- ProgramCourse during Phase 2: `programId` stores Sanity `_id`. Admin courses API does hybrid Postgres + Sanity lookup for program names. Phase 3 will convert to Postgres cuid when programs migrate.
- Header quote on lesson page: shown only when `hasQuote && !hasAudio` (audio player takes precedence)
- File upload uses `upload()` from `@vercel/blob/client` (client-side upload) — NOT `put()` (server-side). The `/api/upload` route only handles token generation and completion callback via `handleUpload`. Auth check MUST be inside `onBeforeGenerateToken`, not at the route level, because the completion callback comes from Vercel's servers (no user session).
- `autoSaveField()` uses the URL from the upload response directly (not React state) to avoid stale closure issues in async handlers

---

## 28. Editor Standard

> **Superseded by section 33's current state.** As of session 97 (2026-04-28), the editor standard is `RimTiptapEditor` (Tiptap, three variants, HTML storage). `RimBlockEditor` and `RimProseEditor` are deleted. The text below documents the BlockNote-era standard (sessions 69–95) for historical context.

**Historical (session 69):** BlockNote replaced Tiptap entirely as the editor foundation. Two components:

| Component | Purpose | Replaces |
|---|---|---|
| `RimBlockEditor` | Full editor — headings, tables, lists, custom Dharma blocks, slash commands | `ContentEditor` |
| `RimProseEditor` | Prose only — paragraphs, lists, quotes, formatting toolbar | `FormattedEditor` |

Both store content as **BlockNote JSON** (array of block objects). Both are uncontrolled after mount — `initialContent` is set once, changes fire `onChange`.

**Exception — email templates:** The `MarkdownEditor` component (`components/MarkdownEditor.tsx`, previously `RimEditor.tsx`) uses Tiptap + `tiptap-markdown` to store and edit **markdown strings** — not BlockNote JSON. This is intentional: the email template pipeline is `markdown → marked() → juice() → Resend`. This component is exclusively for `EmailTemplateEditor` and should not be used for any other surface. It has a `VariableNode` extension for `{{variable}}` template tags. See `RIM_Editor_Types.md` §email-template for full context.

**Custom Dharma blocks** (available in `RimBlockEditor` via slash command):
- `VerseQuote` — italic serif block with optional attribution line. Renders as `.lp-verse-quote`
- `PracticeSuggestion` — teal-tinted block with "Practice" label. Renders as `.lp-callout`
- `Callout` — info/note/warning variant. Renders as `.lp-callout-block`

Defined in `lib/blockNoteCustomBlocks.tsx`. Exports `rimBlockSchema` (full) and `rimProseSchema` (prose-only).

**Theme:** `lib/blockNoteTheme.ts` — RIM design tokens applied to BlockNote's Mantine theme system.

**`minimal` prop on `RimProseEditor`:** strips toolbar to Bold + Italic + Link only. Not used by default — removed from `AdminNotesSection` in session 69.

**`legacyHtml` prop on both editors:** accepts pre-rendered HTML from server for Tiptap → BlockNote import on mount. Used when editing records that were created before the BlockNote migration.

**Key files:**
- `components/RimBlockEditor.tsx`
- `components/RimProseEditor.tsx`
- `lib/blockNoteCustomBlocks.tsx`
- `lib/blockNoteTheme.ts`
- `lib/renderRichContent.ts` — client-safe: `renderBlockNoteHtml()`, `extractBlockNoteText()`, `isBlockNoteJSON()`, `isRawHtml()`
- `lib/renderRichContentServer.ts` — server-only (`import "server-only"`): `renderContentBodyAsync()`, `renderFormattedTextAsync()`, `extractTextAsync()`

**Render pipeline:**
- Server components: import from `lib/renderRichContentServer.ts` — handles BlockNote JSON via `@blocknote/server-util` (dynamically imported, JSDOM kept out of client bundles)
- Client components that display stored content: receive pre-rendered `bodyHtml` string from server parent — never call async render functions directly
- `@blocknote/server-util` is always dynamically imported (`await import(...)`) to prevent Turbopack build-time evaluation

**🔧 Technical notes:**
- BlockNote is **free/open source** (MIT). Monthly pricing on blocknotejs.org is for their cloud hosting service — not used here. Content stays in Neon.
- `rimBlockSchema` and `rimProseSchema` are passed to `useCreateBlockNote({ schema })` — required for custom blocks to work correctly
- The `legacyHtml` prop uses `editor.tryParseHTMLToBlocks(html)` on mount — verify this method name against the installed v0.47.1 API
- `BlockNoteView` is imported from `@blocknote/mantine` (not `@blocknote/react`)
- No `@blocknote/core/fonts/inter.css` path exists in v0.47.1 — Open Sans from Google Fonts covers it

*Updated: 2026-03-20 (session 70)*

---

## §29 — Support Inbox — 🗑 REMOVED (session 100, 2026-05-06)

> **Fully removed in Theme E cleanup.** All code, schema models (GmailCredential, SupportThread, SupportMessage, SupportAttachment, SupportNote, SupportSignature, SupportTemplate), API routes (`/api/support/*`), and lib files (`lib/gmail.ts`, `lib/supportSync.ts`, `lib/supportNotify.ts`) deleted. `support@rootedinmindfulness.org` is read directly via Gmail.
>
> **Residual tool wiring stripped in session 110 (2026-05-13).** The Support Inbox tool's removal in session 100 missed several upstream references that kept surfacing dead UI inside the Support Hub workspace: `lib/toolRegistry.ts` still had an `inbox` entry; `lib/hubContext.ts` had a `case "support"` branch that rendered a "X open requests · Open tool →" primary-work card pointing at the deleted route; `lib/manualGroups.ts` had a "For the support team" group; `HubHomeClient` had `support: "support-inbox"` in its orientation map; `components/SupportInboxClient.tsx` (1,736 lines) was orphaned dead code; `RolesSection` and `CourseEditor` still listed `SUPPORT` as a role pickable option; `api/upload/route.ts` had a `SUPPORT`-in-roles branch. All cleaned. Two `HubAppLink` rows + the `support-inbox` `ManualSection` row are deleted from the DB by a new `migrate.mjs` entry `remove_support_inbox_residue` on next deploy. The `SUPPORT` enum value remains in `prisma/schema.prisma:135` pending a user-records audit before removal (deferred — removing a Prisma enum value while any user row references it crashes the build).
>
> **The Support Hub itself stays as a core-only team workspace** — Home, Conversations, Documents, Members — same shape as any other tool-less hub.
>
> The section below describes the removed feature for historical context.

---

The Support Inbox is a full shared email client for `support@rootedinmindfulness.org`, built natively into the system at `/tools/inbox` (extracted from the Support Hub in session 73). It syncs Gmail threads via the Gmail API, matches senders to community members, and provides a three-column email client for the support team to manage correspondence.

### Who uses it
- **SUPPORT role** — full inbox access: read threads, reply, add internal notes, assign threads, use templates
- **ADMIN role** — all SUPPORT access + Gmail connection management, default assignee, template CRUD, re-match, hard delete

### What it does

**Gmail integration:**
- OAuth2 connection flow (Settings tab, ADMIN only) — connects `support@rootedinmindfulness.org` via Google OAuth
- Incremental sync engine (`lib/supportSync.ts`) — fetches threads from Gmail API; 90-day initial sync, then incremental via `historyId`
- Cron job (`/api/cron/support-sync`) runs every 5 minutes (Vercel Pro plan) to auto-sync new messages
- Manual sync button in the inbox toolbar for immediate refresh
- Attachment proxy (`/api/support/attachment/[messageId]/[attachmentId]`) streams files from Gmail API

**Thread management:**
- Four statuses: OPEN → CLAIMED → WAITING → RESOLVED
- Thread assignment to support team members (dropdown in sidebar)
- Default assignee setting (ADMIN configurable) auto-assigns new threads
- Member matching: sender email matched to User records; sidebar shows member context (name, email, roles, registration history)
- Contact history: other threads from the same sender/member shown in sidebar
- Soft delete (trash): `deletedAt` timestamp; Trash filter to view/restore/permanently delete
- Hard delete (ADMIN only): permanently removes thread + all messages, notes, attachments

**Composing & replying:**
- Reply composer (bottom of main panel) with FormattedEditor (Tiptap rich text)
- Compose new email modal with To/Subject fields + FormattedEditor body
- File attachments on replies and composed emails (Vercel Blob upload, 25 MB total limit)
- Email signatures: per-user name + role + tagline, appended to all outbound messages
- Email templates: reusable response templates with Tiptap JSON body; template picker dropdown in both reply and compose composers; ADMIN manages templates in Settings

**Notifications:**
- In-app alerts (Alert model) for: thread assigned, new reply on assigned thread, new internal note
- Optional email notifications (per-user toggle in Settings)
- Deduplication: same alert type + thread won't fire within 5-minute window
- Fire-and-forget pattern (never blocks the main action)

**Internal notes:**
- Private notes visible only to support team (never sent to customer)
- Tiptap JSON body, rendered in amber-themed cards in the timeline
- Note authors tracked; timestamps shown

### User flow
1. ADMIN connects Gmail in Settings tab (one-time OAuth2 flow)
2. Cron syncs threads every 5 minutes; manual sync available
3. Support team member opens Inbox tab → sees thread list (Active filter by default)
4. Click thread → center panel shows message timeline + sidebar shows sender context
5. Claim thread (or auto-assigned) → status moves to CLAIMED
6. Reply via composer (with optional template + attachments) → email sent via Gmail API
7. Add internal notes for team coordination
8. When resolved, change status to RESOLVED → thread moves to Closed filter
9. Unwanted threads can be soft-deleted to Trash; restored or permanently deleted later

### Layout
Three-column split-pane email client:
- **Left:** Thread list — `clamp(320px, 25vw, 400px)` fluid width. New Email button (full-width, above search). Filter pills (Active, Mine, Closed, All, Trash) with horizontal scroll. Search field.
- **Center:** Message timeline (scrolls independently) + bottom-anchored reply composer. Subject bar with status badge and sidebar toggle.
- **Right:** Sidebar (280px fixed, auto-collapses below 1100px). Sections: Status & assignment, member context (with registration history), contact history, actions (Add Note, Delete Thread).

**Responsive behavior:**
- Below 1100px: sidebar auto-collapses (toggle to show)
- Below 768px (tablet): single-column list↔detail toggle with "← Back to threads" button
- Below 430px (phone): 44px touch targets, 16px input fonts to prevent iOS zoom

### Key files
- `app/account/hub/[slug]/inbox/page.tsx` — server component; auth + Gmail check + initial data fetch
- `app/account/hub/[slug]/settings/page.tsx` — server component; fetches settings, signatures, templates, team members
- `components/SupportInboxClient.tsx` — "use client"; full inbox UI (~1400 lines); si- CSS prefix
- `components/SupportSettingsClient.tsx` — "use client"; settings UI; si-settings- CSS prefix
- `lib/gmail.ts` — OAuth2 client factory, token refresh, authenticated Gmail client
- `lib/supportSync.ts` — sync engine: Gmail API → parse → upsert threads/messages → match members → notify
- `lib/supportNotify.ts` — in-app alerts + email notifications for support events
- `app/api/support/threads/route.ts` — GET thread list with filtering (status, assigned, search, trash)
- `app/api/support/threads/[id]/route.ts` — GET detail (messages + notes + contact history), PATCH (status/assign/delete), DELETE (hard delete)
- `app/api/support/threads/[id]/reply/route.ts` — POST reply via Gmail API (with signature + attachments)
- `app/api/support/threads/[id]/note/route.ts` — POST internal note
- `app/api/support/compose/route.ts` — POST new outbound email
- `app/api/support/signature/route.ts` — GET/PUT per-user signature
- `app/api/support/templates/route.ts` — GET list / POST create (ADMIN)
- `app/api/support/templates/[id]/route.ts` — PUT update / DELETE (ADMIN)
- `app/api/support/contacts/route.ts` — GET member search for compose
- `app/api/support/rematch/route.ts` — POST re-match unlinked threads to members (ADMIN)
- `app/api/support/settings/route.ts` — GET/PUT app settings (support.* prefix)
- `app/api/support/settings/notifications/route.ts` — PUT email notification toggle
- `app/api/support/sync/route.ts` — POST manual sync trigger
- `app/api/support/attachment/[messageId]/[attachmentId]/route.ts` — GET proxy Gmail attachment
- `app/api/support/auth/route.ts` — GET OAuth2 authorization URL
- `app/api/support/auth/callback/route.ts` — GET OAuth2 callback, stores tokens
- `app/api/cron/support-sync/route.ts` — cron: sync Gmail every 5 minutes

### Database models
- `GmailCredential` — OAuth2 tokens for the connected Gmail account (email, accessToken, refreshToken, expiresAt)
- `SupportThread` — synced Gmail threads (gmailThreadId unique, subject, status enum, assignedToId, memberId, senderEmail/Name, deletedAt for soft delete)
- `SupportMessage` — individual emails in a thread (gmailMessageId unique, from/to, bodyHtml/bodyText, isOutbound, sentById, attachments Json)
- `SupportAttachment` — file attachments on messages (gmailAttachmentId, filename, mimeType, size)
- `SupportNote` — internal notes (body Json/Tiptap, authorId, threadId)
- `SupportSignature` — per-user signature (name, role, tagline; userId unique)
- `SupportTemplate` — reusable response templates (name, subject, body Json/Tiptap, createdById)
- `AppSetting` — key-value store for app settings (support.defaultAssignee, etc.)

### 🔧 Technical notes
- Gmail sync uses `historyId` for incremental sync after initial 90-day fetch. History ID stored in AppSetting (`support.historyId`).
- Token refresh is automatic: `refreshAccessTokenIfNeeded()` checks if token expires within 5 minutes and refreshes proactively.
- Member matching: `syncGmailInbox()` looks up sender email in User table; sets `memberId` FK on thread. `rematchUnlinkedThreads()` retries matching for threads where memberId is null.
- Soft delete: `deletedAt DateTime?` on SupportThread. All list queries filter `deletedAt: null` except trash view. **Sync engine skips deleted threads entirely** (session 57 fix) — new Gmail messages on a soft-deleted thread are ignored, preventing resurrection of intentionally deleted conversations.
- Notifications use fire-and-forget pattern with 5-minute deduplication window per alert type + thread.
- FormattedEditor `editorRef` pattern: expose Tiptap Editor instance via `React.MutableRefObject<Editor | null>` so parent component can imperatively set content (e.g., when applying a template).
- Outbound replies include the user's SupportSignature (if configured) appended as plain text below the message body.
- Vercel Pro plan required for 5-minute cron interval (free plan minimum is 1 hour).
- `User.title` field (added this session) is displayed in the assign dropdown as "Name — Title" and pre-fills signature role field.

---

## §30 — Support Inbox Security Hardening

**Session 57 (2026-03-16).** An independent security audit of the Support Inbox identified 12 issues across four severity tiers. All fixed in a single commit (`43676d3`).

### What was fixed

**Critical (data integrity / SSRF):**
- **Soft-delete bypass in sync** — `lib/supportSync.ts` now checks `deletedAt` before processing; deleted threads are skipped entirely (no resurrection, no new messages added)
- **Reply/note on deleted threads** — `reply/route.ts` and `note/route.ts` return 404 if `thread.deletedAt` is set
- **SSRF on attachment fetch** — Added `isSafeBlobUrl()` validator in reply and compose routes; any attachment URL that doesn't match `*.public.blob.vercel-storage.com` is silently skipped
- **Attachment proxy ownership check** — `attachment/[messageId]/[attachmentId]/route.ts` now verifies `messageId` exists in `SupportMessage` before proxying; unknown IDs return 404

**Moderate (resource / input validation):**
- **20 MB cap on attachment buffering** — both reply and compose check `Content-Length` before calling `.arrayBuffer()`; files over 20 MB skipped
- **30s rate limit on manual sync** — `sync/route.ts` stores last-sync timestamp per user in AppSetting; returns 429 with seconds-remaining if called within 30 seconds
- **Status PATCH enum validation** — explicit check against `["OPEN","CLAIMED","WAITING","RESOLVED"]` before Prisma write; returns 400 for unknown values
- **Signature HTML escaping** — `escapeHtml()` helper added; name/role/tagline escaped before interpolation into outbound email HTML

**Minor (hygiene / auditability):**
- **Notification domain** — `lib/supportNotify.ts` uses `process.env.NEXTAUTH_URL` instead of hardcoded `https://rim-next.vercel.app`
- **Audit trail on hard delete** — `console.log` with admin ID, thread ID, subject, and ISO timestamp (appears in Vercel logs)
- **100-char max on signature fields** — `signature/route.ts` validates name, role, tagline; returns 400 if exceeded
- **Dedup comment** — added comment in `supportNotify.ts` explaining the 5-minute window as intentional spam-prevention trade-off

### Key files changed
- `lib/supportSync.ts` — soft-delete bypass fix
- `lib/supportNotify.ts` — NEXTAUTH_URL, dedup comment
- `app/api/support/threads/[id]/reply/route.ts` — deleted-thread 404, SSRF guard, size cap, HTML escaping
- `app/api/support/threads/[id]/note/route.ts` — deleted-thread 404
- `app/api/support/threads/[id]/route.ts` — status enum validation, hard-delete audit log
- `app/api/support/compose/route.ts` — SSRF guard, size cap, HTML escaping
- `app/api/support/sync/route.ts` — 30s rate limit
- `app/api/support/signature/route.ts` — 100-char max
- `app/api/support/attachment/[messageId]/[attachmentId]/route.ts` — ownership check

### Items intentionally not fixed
- Auto-assignment race in reply handler — fire-and-forget is intentional (last writer wins, acceptable trade-off)
- Weak email regex in compose — low risk; `@` and `/` blocking is sufficient for this internal tool

---

| 2026-03-11 (session 39) | **Spec compliance audit + cleanup.** Audited all §23 files against actual codebase — everything conformant. Deleted temporary `/api/debug` route (exposed session/membership data; was created to diagnose login issue in session 38). Added §24 to FEATURES.md documenting the multi-hub workspace system (`/account/hub/[slug]/*`) built in the previous context-exhausted session. Fixed `TypeScript build error in app/account/host/schedule/page.tsx — missing `programFormat` field. Updated MEMORY.md session log. |
| 2026-03-12 (session 41) | **Dashboard Today's Sessions: recurrence-aware logic + join link timing.** **(1) Infinite/ongoing recurrence fix:** `lib/calendarLinks.ts` — `buildRRule()` was guarded by `!count || count < 2`, which blocked RRULE generation for programs with no fixed end date (null `recurrenceCount`). Fixed: guard is now `if (!freq) return null`; COUNT is only appended when `count && count >= 2` — omitting it is valid RFC 5545 for infinite recurrence. `describeRecurrence()` updated with same fix; `icsLabel` now returns `"ongoing"` when count is null. Sanity `recurrenceCount` field title changed to "Number of Sessions (leave blank for ongoing)" with updated description. Sanity Studio deployed. **(2) Dashboard Today's Sessions — recurrence-aware query:** Root cause: old `todayVirtualSessionsQuery` required `programFormat in ["virtual","hybrid"] && defined(startDatetime)` — both null on all real production programs (which use `dayOfWeek[]->` refs). Fixed: replaced with `virtualDashboardProgramsQuery` — no `startDatetime` filter; fetches full recurrence fields. JS-side `isOccurrenceToday()` in `dashboard/page.tsx` handles single events, weekly (with day code + bi-weekly interval + series end), and monthly/daily fallback. `shiftToToday()` corrects the live/later window for recurring programs. `VirtualSession` interface renamed `VirtualProgram` with nullable `startDatetime` and all recurrence fields. **(3) Join link timing:** Changed from a 75-minute "joinable" window to a strict 12-minute live window. Join button now appears **only** in the Live Now section (12 min before start through session end) — completely removed from Later Today. Updated Later Today helper note: "Join link appears when the session opens, about 12 minutes before start." This prevents members from accidentally joining an open room when multiple programs are listed simultaneously. `liveStart` changed from 15 → 12 min; `joinableStart` / `isJoinable` removed entirely. Commits: session 41. **(4) DashboardAutoRefresh:** New `components/DashboardAutoRefresh.tsx` — `"use client"` component that auto-refreshes the dashboard when a Later Today session enters its Live Now window. Receives `liveStartEpochs: number[]` (epoch ms, timezone-agnostic) from the server; uses `setTimeout` to call `router.refresh()` at the exact moment the earliest session's window opens (+2s buffer). No polling, no visible page reload — `router.refresh()` re-fetches server data in the background, join button appears in place. |
| 2026-03-11 (session 40) | **Hub schedule spec compliance + layout polish (§24 update).** **(1) Calendar visual redesign:** Rewrote `hub-cal` CSS block — switched from individual rounded cells with gaps to a single-card layout (`border:1px solid #e0ddd7; border-radius:10px; overflow:hidden`) with internal `#eceae5` dividers between cells. Today's date number gets a dark circle (`background:#2d3f47; border-radius:50%`) instead of a cell-level border. Event chips now use all-around `border:1px solid` (not `border-left` accent) and correct spec colors: mine (steel-lt), covered (sage-lt), needs (terra-lt). Checkboxes hidden by default, revealed on hover. Removed stale duplicate `hub-cal__event--mine` rule at end of file. **(2) List view inline panel:** Changed `SessionDetail` in list view to render directly below the clicked row (inside a `hub-sched-row-panel` wrapper div) rather than at the bottom of the page. Calendar view still renders `SessionDetail` below the calendar grid. **(3) Layout polish:** `hub-page` widened from 860→920px; side padding increased from 24→36px. Added missing `hub-hdr` CSS block (eyebrow/title/meta; was completely unstyled). `hub-tabs` vertical padding 10→13px; active tab color changed from `--rim-blue` to slate/steel to match spec. `hub-home__greeting` increased from 22→28px. `hub-detail__name` color changed from `--rim-blue` to `#2d3f47` (slate). Fixed double margin-top: `hub-content--wide` was 32px nested inside `hub-content` (also 32px), causing 64px gap on schedule page — set `hub-content--wide { margin-top: 0 }`. Commits: 51607af + earlier session commits. |

| 2026-03-12 (session 42) | **Old host hub removed; fully migrated to `/account/hub/host-team`.** Deleted all `/account/host/*` pages (9 files), `/app/hosts/` redirect shim, and 5 orphaned components (`HubTabNav`, `HubHomeClient`, `HubConversationsClient`, `ThreadList`, `ThreadDetail`). Updated `AccountSidebar` "Host Hub" link to `/account/hub/host-team`. Updated all `/api/host/*` alert `linkUrl`s and 2 cron job links to new paths. Added `RIM_System_Architecture.md` to project root. Added architecture reminder note to `FEATURES.md`. §23 and §24 docs updated to reflect single hub system. |
| 2026-03-12 (session 43) | **Virtual Host Hub Phase 1 — attendance tracking + session view + post-session form.** First implementation of the hub-based member data projection model (per `RIM_System_Architecture.md`). **(1) Prisma schema:** New `SessionAttendance` model (cuid, userId FK, programId Sanity _id, programSlug, joinedAt, leftEarly, isNewMember, returningAfterAbsence, flaggedByHost, postSessionNote, postSessionAction enum, actionRouted) with indexes on `[programSlug]`, `[userId]`, `[programSlug, joinedAt]`. New `SessionReport` model (programSlug, sessionDate midnight CT, hostId FK, reflection, resourceUrl, resourceNote, resourceRouted, @@unique programSlug+sessionDate). New `PostSessionAction` enum. DB pushed to Neon. **(2) API routes:** `POST /api/attendance/join` — records SessionAttendance on Meet link click; computes isNewMember + returningAfterAbsence; fires draft automated emails if ENABLE_ATTENDANCE_EMAILS=true. `PATCH /api/attendance/[id]/flag` — toggles flaggedByHost (HOST/REGISTRAR/ADMIN only). `POST /api/attendance/session/[programSlug]/post` — saves post-session form (updates flagged attendance records + upserts SessionReport + sends notification email). **(3) MeetJoinButton:** New `"use client"` component — opens Meet URL in new tab immediately (non-blocking), then fire-and-forget POST to /api/attendance/join. Wired into dashboard live sessions (replacing `<a>` tag) and hub schedule's SessionDetail panel (replacing `<a>` tag + added programId to Session/Program interfaces). **(4) Session tab:** Added to Host Team hub layout only (slug==="host-team"), visible to HOST/HOST_MANAGER/REGISTRAR/ADMIN. Tab ordering: Announcements → Schedule → Session → Documents → Conversations → Members. **(5) Live session view** (`/account/hub/host-team/session`): Server page fetches today's virtual/hybrid programs (same recurrence logic as dashboard) + today's SessionAttendance records from DB + active registrations for registered programs. Passes to `SessionLiveClient` — polls via `router.refresh()` every 60s; each person is a tappable button that calls flag API; New/Returning badges; muted "not yet joined" section for registered programs; post-session form link appears when session time has passed. **(6) Post-session form** (`/account/hub/host-team/session/[programSlug]/post`): Three sections: (1) Flagged people with note field + routing dropdown (No action / Gentle follow-up / Jesse only / Technical issue); (2) Session reflection textarea; (3) Resource for the group. One Submit button saves all records + sends notification emails routed by action type. Pre-fills from existing SessionReport if already submitted. `PostSessionClient` manages all state. **(7) Notification email:** `sendPostSessionNotification()` in `lib/email.ts` — one email per recipient (JESSE_EMAIL, HOST_COORDINATOR_EMAIL env vars), consolidates all flags for that recipient; includes reflection + resource if provided. **(8) Automated emails (built but disabled):** `sendFirstTimeAttendeeEmail()` + `sendReturningAfterAbsenceEmail()` — draft copy, clearly marked DRAFT, gated behind `ENABLE_ATTENDANCE_EMAILS=true` env var. **(9) Sanity query:** `sessionViewProgramsQuery` — extends virtualDashboardProgramsQuery with `registrationEnabled`. **(10) CSS:** `sv-` prefix (session live view) + `ps-` prefix (post-session form) added to `public/css/custom.css`. New env vars: `JESSE_EMAIL`, `HOST_COORDINATOR_EMAIL`, `ENABLE_ATTENDANCE_EMAILS`. |
| 2026-03-12 (session 44) | **Virtual Host Hub Phase 2 — session history views + attendance hardening + missing-report cron.** **(1) Schema migration (one `prisma db push`):** `SessionAttendance` — added `sessionDate DateTime?` (CT midnight, always written by `/api/attendance/join`) + `@@unique([userId, programSlug, sessionDate])` (checked for duplicates first: 1 found and deleted). `SessionReport` — added `submittedByAssignedHost Boolean?` (null = no assignment existed; true = submitter matched; false = different person). `HostAssignment` — added `@@unique([programSlug, sessionDate])`. **(2) `/api/attendance/join` rewrite:** Session window guard — fetches `startDatetime`/`endDatetime` from Sanity, shifts anchor to today's occurrence, checks ±1h window; outside window returns `{ ok: true }` silently. Upsert semantics — `findUnique` first; if record exists, updates `joinedAt` only (no email); if new, creates record + fires emails. Sets `sessionDate` (CT midnight) on all new records. **(3) Three small additions to Session tab:** (a) Assigned host display — batch-fetches today's HostAssignments in `session/page.tsx`; renders `sv-host-badge` above attendees in `SessionLiveClient`. (b) `submittedByAssignedHost` on post-session form — post API reads `assignedHostId` from body, computes three-state nullable boolean, stores on SessionReport. `PostSessionClient` shows assigned host name in form header; sends `assignedHostId` in POST body. (c) HostAssignment unique constraint — already handled in schema. **(4) Coordinator history** (`/account/hub/host-team/session/history`): `$queryRaw` groups SessionAttendance by CT date; JS merge with SessionReport; batch-fetch HostAssignments + Sanity names; 30/page pagination; detail via `?detail_slug=X&detail_date=YYYY-MM-DD`; shows flagged people + routing + `submittedByAssignedHost` note; "Team view →" link. **(5) Team journal** (`/account/hub/host-team/session/history/team`): Same data fetching, no sensitive fields; journal tone; shows reflection + resource per entry; "No reflection filed." when empty; "Coordinator view →" for coordinators/ADMIN. **(6) Missing-report cron** (`/api/cron/missing-reports`, `0 23 * * *`): Finds all today's sessions from SessionAttendance; checks each against SessionReport; emails all host-team coordinators for missing ones; idempotent. `sendMissingReportEmail()` added to `lib/email.ts`. **(7) Navigation wiring:** `sv-history-nav` footer added to Session tab page — all host members see "Session journal →"; HOST_MANAGER|ADMIN also see "Coordinator history →". **(8) CSS:** `sh-` prefix (history pages) + `sv-history-nav` added to `public/css/custom.css`. Build: TypeScript clean, 13 files changed. |

| 2026-03-12 (session 45) | **End Session button + hub membership sync + email URL fix.** **(1) End Session button:** `sessionEndedAt DateTime?` added to `SessionReport` (+ `prisma db push`). New `POST /api/attendance/session/[programSlug]/end` route — HOST/HOST_MANAGER/ADMIN auth; upserts `SessionReport` with `sessionEndedAt = now` using `@@unique([programSlug, sessionDate])`. `/api/attendance/join` updated: checks `SessionReport.sessionEndedAt` before Sanity time-window fetch as hard cutoff — session-closed and out-of-window both return `{ ok: true }` silently. `session/page.tsx` fetches today's ended reports in parallel with attendance; passes `sessionEndedAt` per-program + `canEndSession` flag to `SessionLiveClient`. `SessionLiveClient` updated: new `canEndSession` prop + `sessionEndedAt` field on `SessionProgram` interface; "Close session & write notes →" button with loading state (HOST/HOST_MANAGER/ADMIN, only while active); "Session closed [time]" pill badge visible to all hosts when `sessionEndedAt` is set; post-session form link shows for both time-based and manual end. CSS: `sv-end-wrap`, `sv-end-btn`, `sv-ended`, `sv-ended__label`, `sv-ended__time`. Commits: `3568aed`. **(2) syncHubMembership bug fix:** Hub card wasn't appearing on dashboard after HOST role was assigned via admin interface — no `HubMember.create` existed anywhere in the codebase. Fix: new `lib/syncHubMembership.ts` with `ROLE_HUB_MAPPINGS` constant (HOST → host-team position "Host"; HOST_MANAGER → host-team position "Host Coordinator" + isCoordinator); upserts using existing `@@unique([hubId, userId])` key; deletes managed-hub memberships for roles no longer held. Called from `app/api/admin/members/[id]/route.ts` after every role update. Commit: `eafaac9`. **(3) Email URL fix:** 5 stale links in `lib/email.ts` corrected (left from session 42 migration): `sendHostRoleAssignmentEmail` (`/hosts` → `/account/hub/host-team`), `sendSubRequestEmail` + `sendSubClaimedEmail` (`/account/host/subs` → `/account/hub/host-team/schedule`), `sendNewThreadEmail` + `sendNewReplyEmail` (`/account/host/threads/${threadId}` → `/account/hub/host-team/conversations/${threadId}`). Commit: `b48ce5d`. |

| 2026-03-13 (session 46) | **System integrity audit + fixes.** Full codebase audit identified 15 issues across Prisma schema, API routes, auth, emails, dead code. **(1) onDelete policies:** Added `onDelete: Cascade` or `SetNull` to 12+ User relations across the entire Prisma schema. Registration and HostAssignment use `SetNull` (preserves records); all owned content (threads, replies, alerts, hub members, etc.) uses `Cascade`. Previously, the daily cleanup cron (`cleanup-incomplete-accounts`) and admin member deletion would FK-fail on any user with related records. **(2) Registration capacity bypass fix:** `registrationCapacity` was trusted from the client request body — users could set it to 999 in dev tools. Now fetched server-side from Sanity in the registration API route. **(3) Stripe webhook idempotency:** `db.donation.create()` changed to `upsert` on `stripePaymentIntentId`. Duplicate webhook deliveries (which Stripe warns about) now produce a no-op instead of a unique constraint error → 500 → retry loop. **(4) Stale email URLs:** 2 remaining `/volunteer/programs/` URLs in `sendCancellationNotificationEmail` and `sendResponsesUpdatedEmail` updated to `/account/registrar/`. **(5) Stripe checkout auth:** Added email verification — registration email must match `donorEmail` to prevent registrationId abuse. **(6) Registration indexes:** Added 3 indexes on Registration model (`[programSlug, status]`, `[userId]`, `[programId]`). **(7) Stripe env var guard:** Replaced `process.env.STRIPE_SECRET_KEY!` non-null assertion with explicit guard that throws a clear error message. **(8) Dead code cleanup:** Deleted 4 orphaned components (HostProgramActions, SubBoard, SubRequestForm, AssignmentManager — 1,075 lines) left from old host hub migration. **(9) Hide-from-list field clarity:** Improved Sanity schema descriptions for `removeFromProgramList` and `hideFromProgramPageList` — each now cross-references the other so staff knows they control different audiences. Grouped the two toggles together (sortOrder was between them). Sanity Studio deployed. **(10) Redirect shims to edge redirects:** Moved 3 redirect-only pages (`/volunteer`, `/volunteer/programs/:slug`, `/account/dashboard-my-registrations`) from server-rendered `redirect()` pages to `vercel.json` 301 redirects. Edge-level = faster, no function invocation. Deleted the page files and empty directories. **(11) Manual + features page updated:** Settings tab field docs updated with cross-reference notes. |

| 2026-03-13 (session 48) | **RimEditor rich-text component + Email Template Manager.** **(1) RimEditor:** New `components/RimEditor.tsx` — shared Tiptap v3 editor with markdown I/O (`tiptap-markdown` package). Toolbar with Lucide icons: Bold, Italic, Underline, H2, H3, Bullet list, Numbered list, Blockquote, Horizontal rule, Link, Clear formatting. Five groups separated by `Sep` dividers. `value`/`onChange` controlled interface (markdown strings). `rows` prop → `minHeight` formula: `Math.max(rows * 32 + 52, 120)px`. User-resizable via `resize: vertical`. Double cast `(editor.storage as unknown as any).markdown` required due to TypeScript `Storage` type conflict. `setContent(value, { emitUpdate: false })` for external sync. Applied to 8 components: `PostSessionClient`, `HubConvThreadClient`, `HubConvClient`, `HubThreadDetailClient`, `HubScheduleClient`, `HubAnnouncementsClient`, `HouseholdDetail`, `MemberDetail`. CSS: `re-` prefix block in `custom.css`. **(2) Email Template Manager:** Architectural change — all 7 managed transactional emails now live in the DB, editable without a deploy. `EmailTemplate` model added to Prisma (`slug`, `name`, `description`, `subject`, `body` @db.Text, `enabled`, `variables String[]`, `updatedAt`, `updatedById`). Seed: `prisma/seed-email-templates.js` (7 records, all `enabled: false`, idempotent). `lib/email.ts` additions: `EMAIL_BASE_CSS`, `wrapInEmailChrome()`, `renderTemplateToHtml()` (marked → wrapInEmailChrome → juice), `sendTemplatedEmail(slug, to, variables)` (DB lookup → enabled check → `{{token}}` substitution → renderTemplateToHtml → Resend send). 7 hardcoded send functions replaced: `sendFirstTimeAttendeeEmail`, `sendReturningAfterAbsenceEmail`, `sendMissingReportEmail`, `sendHostRoleAssignmentEmail`, `sendSubRequestEmail`, `sendSubClaimedEmail`, `sendReminderEmail`. 11 functions retained as hardcoded (structural reasons: attachments, conditional logic, auth flows, PortableText rendering). Dead builder functions removed. Admin UI: `/admin/emails` list page (ADMIN only) — table of all templates with enabled badge + last-saved date + Edit link. `/admin/emails/[slug]` edit page — subject input, RimEditor body, variables reference panel, enabled toggle, Save button (records `updatedById`/`updatedAt`), Preview button. Preview modal POSTs to `/api/admin/emails/[slug]/preview` — fills variables with `[placeholder]` labels → same `renderTemplateToHtml()` path → pixel-identical to actual sends → rendered in iframe. "Emails" sidebar link added to `AccountSidebar` (ADMIN only, between Members and Manual). CSS: `em-` prefix block. |
| 2026-03-13 (session 47) | **Dashboard visual polish: ADMIN hub access fix + AlertStrip redesign.** **(1) Manual accuracy audit:** Read full staff manual (`app/admin/manual/page.tsx`), cross-referenced against codebase. Fixed 6 inaccuracies: (a) Removed "Member Accounts" from "Future editions" (chapter 3 already exists). (b) Hub tab count: "five tabs" → "six tabs" (Session tab was missing). (c) Hub access role description corrected (HOST/HOST_MANAGER, not just registrar roles). (d) HOST_MANAGER description: "Manage tab" → "Schedule tab" (Manage tab was deleted in session 37–38). (e) Hub permissions table: "Manage assignments (add / remove)" → "Manage assignments from Schedule". (f) Replaced hardcoded sidebar links table with accurate description of dynamic "Your Hubs" system. **(2) ADMIN hub access fix:** ADMIN users with no `HubMember` records were getting empty hub lists in both the sidebar and dashboard hub cards. Root cause: both `AccountLayout` and `dashboard/page.tsx` were querying hub links exclusively via `HubMember` records, with no ADMIN bypass. Fix: `AccountLayout` now checks `isAdmin` first; if true, fetches all hubs via `db.hub.findMany()`. Dashboard page now builds `dashboardHubs` via the same branch (`db.hub.findMany()` for ADMIN, `hubMemberships.map(m => m.hub)` for others). The ADMIN bypass in `lib/hubAuth.ts` already existed for page-level access checks — this fix extends it consistently to the sidebar and dashboard data layer. **(3) AlertStrip redesign:** Moved from outside `db2-wrap` (full-bleed above content) to inside it (after greeting). New amber color tokens added to `:root`: `--color-alert: #C8821A`, `--color-alert-bg: #FDF6EC`, `--color-alert-border: #F0C98A`. Container: amber card with border + `border-radius: 10px`. Items: 4px amber `border-left`, 20px padding-left (clearance from accent), hairline `border-bottom` dividers between items, no gap. Count badge uses `--color-alert` (was `--rim-blue`). Label: "alerts" (was "new updates"). Scrollable: `max-height: 220px; overflow-y: auto` on `ul`. Scroll indicator: CSS-only pulsing downward chevron (`::after` on `.alert-strip__scroll-wrap`; 10×10px rotated border trick; `opacity: 0.3→1→0.3` 2s loop); hidden via `is-scrolled-to-bottom` class set by `checkScroll` callback on mount + scroll + data change. `"use client"` component: added `useRef`, `isAtBottom` state, `checkScroll` callback. **(4) Dashboard width:** `db2-wrap` max-width 680px → 720px. Commits: `c0f48c9`, `13a69ad`, `68f2aba`, `0cd1017`. |

| 2026-03-13 (session 49) | **Email Template Manager improvements — Steps 1–10.** **(1) Complete email inventory audit:** Read all 1,678 lines of `lib/email.ts`; produced definitive table of all 18 functions — 7 managed, 9 hardcoded-could-migrate, 2 hardcoded-must-stay. **(2) Group fields + group-based list view:** Added `group`, `groupLabel`, `minRole` fields to `EmailTemplate` Prisma model. Seeded group assignments: `first-time-attendee`, `returning-after-absence`, `session-reminder` → "Registration & Programs"; `host-role-assigned`, `sub-request-posted`, `sub-request-claimed`, `missing-report-alert` → "Host Hub". List page (`app/admin/emails/page.tsx`) rewritten to render templates in grouped sections with `em-list__group-label` headers. **(3) Clickable variable chips:** Variable reference panel chips changed from `<code>` tags to `<button>` elements. Click inserts `{{token}}` at cursor via `editorRef.current?.commands.insertVariable(name)`. Hint text "click to insert at cursor" added. **(4) VariableNode Tiptap extension:** New `lib/tiptap-variable-node.ts` — custom Tiptap v3 inline atom node. Parses `{{token}}` in markdown via markdownit inline rule (with duplicate-registration guard for tiptap-markdown v0.9 reuse pattern). Renders as amber `.ri-var-chip` pill in editor. Serializes back to `{{token}}`. `insertVariable(name)` command. `editorRef` prop on RimEditor populated via `useEffect`, used by `EmailTemplateEditor` to call commands from variable chip buttons. Commits: `b79eb56`. **(5) Link inline popover:** `RimEditor` — replaced `window.prompt` link dialog with inline popover. Pre-fills existing href; removes link without opening popover if cursor is already on a link; Enter/Escape handling; outside-click dismiss via `pointerdown`. CSS: `re-link-wrap`, `re-link-popover`, `re-link-popover__input`, `re-link-popover__apply`. **(6) Chrome bands:** Non-interactive header/footer bands (`aria-hidden`) flanking the RimEditor body in `EmailTemplateEditor` — dark blue header ("Rooted In Mindfulness") and warm footer (address line) show the email wrapper context. CSS: `em-chrome-band`, `em-chrome-band--header`, `em-chrome-band--footer`. Commits: `6e247c2`. **(7) helpText + sanityNote:** Added `helpText String?` and `sanityNote String?` nullable fields to `EmailTemplate` Prisma model; `prisma db push` + `prisma generate`. Seeded for all 7 templates (`prisma/seed-email-help-text.js`). `helpText` shown above subject as muted paragraph. `sanityNote` shown as distinct teal callout with "Sanity Studio" badge — documents which variables originate in program records (programName, programTitle, dateText, locationText, zoomLink, reminderMessage). CSS: `em-editor__help`, `em-editor__help-text`, `em-editor__sanity-callout`, `em-editor__sanity-callout-label`. Commit: `83269da`. **(8) portableTextToMarkdown + PT audit:** New `portableTextToMarkdown()` in `lib/portableTextEmail.ts` — converts PT to markdown syntax (bold/italic/links/lists), resolves `markDefs` manually for link marks. Applied to `reminderMessage` in `sendReminderEmail` (replaces `portableTextToEmailText`; formatting now survives `marked` processing). Audit of `confirmationMessage` call sites: both API routes already use `portableTextToEmailHtml/Text` correctly — no change needed. Commit: `0698911`. **(9) Comment blocks on hardcoded functions:** All 11 hardcoded email functions annotated with: HARDCODED/MUST STAY status, why it isn't managed, proposed migration slug, variable list. Commit: `bf2dc33`. **(10) FEATURES.md §26 final update:** Complete 18-function inventory table added as permanent reference. Section expanded with new subsections for VariableNode, link popover, chrome bands, helpText/sanityNote, portableTextToMarkdown. "Future migration candidates" expanded to priority-ordered table with blockers. |

| 2026-03-13 (session 50) | **Sanity → Postgres migration: Courses & Lessons + Teacher Hub + Markdown Editor.** **(1) Prisma schema:** Added TEACHER to Role enum; 4 new models (Course, Lesson, CourseLesson, ProgramCourse); CourseAccessLevel enum (MEMBERS, REGISTRATION_REQUIRED); CourseAccess→Course optional FK. `prisma db push`. **(2) Teacher Hub:** Seeded "teacher" hub in `prisma/seed-hubs.ts`; TEACHER mapping added to `lib/syncHubMembership.ts`. Hub layout modified: teacher hub gets Courses+Lessons as primary tabs; root redirects to `/account/hub/teacher/courses`; Announcements moved to `/announcements` sub-route. **(3) Course CRUD:** 6 new pages (list, new, edit for courses and lessons) + 6 new API routes (`/api/courses`, `/api/courses/[slug]`, `/api/lessons`, `/api/lessons/[slug]`, `/api/lessons/search`, `/api/upload`). `CourseEditor` component: form fields + lesson manager with search-to-add and reordering. `LessonListClient` component: table with search filter. **(4) Lesson Editor + Markdown:** `LessonEditor` with `@uiw/react-md-editor` (dynamic import, SSR false, `data-color-mode="light"`); custom block insertion buttons for [verse], [practice], [callout]; media uploads via Vercel Blob (`@vercel/blob`); resource inline list builder. **(5) Postgres cutover — course page:** `app/course/[slug]/page.tsx` rewritten to read from `db.course.findUnique`; access check uses ProgramCourse table instead of Sanity reverse ref; description renders via ReactMarkdown; Webflow CSS classes preserved. **(6) Postgres cutover — lesson page:** `app/lessons/[slug]/page.tsx` rewritten to read from `db.lesson.findUnique`; custom blockquote interceptor: `extractText()` detects `[verse]`→`lp-verse-quote`, `[practice]`→`lp-callout`, `[callout]`→`lp-callout-block` (new CSS class); header quote shown only when `hasQuote && !hasAudio`. **(7) Admin courses API:** `app/api/admin/courses/route.ts` updated from Sanity to Postgres with hybrid Sanity lookup for program names. TEACHER added to `MemberDetail` ALL_ROLES. **(8) CSS:** `th-` prefix block (~150 lines); `.th-block-btns` for block buttons; `.w-md-editor` override; `.lp-callout-block` + `.lp-body .lp-callout-block p`. **(9) New §27 added to FEATURES.md. **(10) Auto-save for file uploads:** `autoSaveField()` in LessonEditor immediately PATCHes DB after upload/remove — uses upload response URL directly (not React state) to avoid closure issues. **(11) View page links:** "View lesson page →" and "View course page →" links added to editor headers (edit mode only, opens in new tab). **(12) Client-side Vercel Blob upload migration:** Rewrote `/api/upload` from server-side `put()` to `handleUpload` from `@vercel/blob/client`; `LessonEditor.uploadFile()` now uses `upload()` from `@vercel/blob/client` — browser uploads directly to Blob storage, bypassing the 4.5 MB serverless function body limit. Max file size 500 MB. Auth check moved inside `onBeforeGenerateToken` (completion callback from Vercel's servers doesn't carry user session). |

| 2026-03-14 (session 51) | **Editor standard: ContentEditor + FormattedEditor (Tiptap).** Replaced `@uiw/react-md-editor` and `react-markdown` with two shared Tiptap editor components as the system-wide rich text standard. **(1) New components:** `ContentEditor` (prose + 3 custom blocks: VerseQuote, PracticeSuggestion, Callout) and `FormattedEditor` (prose formatting only). Both built on Tiptap v3 with StarterKit, Link, Placeholder, and tiptap-markdown extensions. **(2) Custom Tiptap extensions:** `lib/tiptap-extensions.ts` — three block-level Node extensions with `parseHTML`/`renderHTML`, mapped to existing CSS classes (`lp-verse-quote`, `lp-callout`, `lp-callout-block`). **(3) Server-side rendering:** `lib/renderRichContent.ts` — `renderContentBody()` and `renderFormattedText()` using `@tiptap/html` `generateHTML()`. **(4) Schema changes:** `Course.description`, `Lesson.body`, `User.adminNotes` changed from `String?` to `Json?` (Tiptap JSON). Existing string data cleared before type conversion. `prisma db push`. **(5) Component updates:** `LessonEditor` — replaced MDEditor with ContentEditor; `CourseEditor` — replaced textarea with FormattedEditor; `MemberDetail` — replaced RimEditor with FormattedEditor for adminNotes. **(6) Page updates:** `app/lessons/[slug]/page.tsx` — replaced ReactMarkdown + blockquote interceptor with `renderContentBody()` + `dangerouslySetInnerHTML`; `app/course/[slug]/page.tsx` — replaced ReactMarkdown with `renderFormattedText()`. **(7) CSS:** `rte-` prefix block (~100 lines) for editor shell, toolbar, buttons, dividers, placeholder, custom block previews inside editor. Removed old `.th-block-btns` and `.w-md-editor` override. **(8) Removed:** `@uiw/react-md-editor`, `react-markdown` packages uninstalled. **(9) §28 added to FEATURES.md (Editor Standard). |

| 2026-03-14 (session 52) | **Editor extensions + hub conversations migration.** **(1) Auth fix:** Diagnosed `"cached plan must not change result type"` Postgres error in Vercel logs — caused by Neon PgBouncer caching stale prepared statements after session 51's `prisma db push` (adminNotes String→Json). Added `pgbouncer=true` to `POSTGRES_PRISMA_URL` in Vercel env vars; redeployed. Prevents future recurrence on schema changes. **(2) Editor extensions — both editors:** Underline (`@tiptap/extension-underline`, toolbar button + Cmd+U), TextAlign (`@tiptap/extension-text-align`, L/C/R toolbar buttons), Typography (`@tiptap/extension-typography`, auto smart quotes/em dashes/ellipsis), CharacterCount (`@tiptap/extension-character-count`, word count footer + optional `maxChars` prop). **(3) Table extension — ContentEditor only:** `@tiptap/extension-table` + TableRow/TableHeader/TableCell. "Insert table" toolbar button (3×3 with header row). Context toolbar when cursor in table: +Row, +Col, −Row, −Col, Delete Table. **(4) renderRichContent.ts:** Added Underline, TextAlign, Table, TableRow, TableHeader, TableCell to both extension sets for server-side HTML rendering. **(5) Hub conversations → FormattedEditor:** Replaced `RimEditor` (markdown output) with `FormattedEditor` (Tiptap JSON output) in all 3 conversation components: `HubConvClient`, `HubConvThreadClient`, `HubThreadDetailClient`. Thread/reply body rendering changed from `body.split("\\n\\n")` to `dangerouslySetInnerHTML={{ __html: renderFormattedText(body) }}`. Excerpt extraction via `extractText()` helper (recursive Tiptap JSON → plain text). **(6) Prisma schema:** 4 body fields changed from `String` to `Json?`: `HostThread.body`, `HostReply.body`, `HubConversationThread.body`, `HubConversationReply.body`. Existing test data deleted (2 hub threads, 1 host thread + replies). `prisma db push`. **(7) API routes:** 6 conversation routes updated — removed `.trim()` on body, changed validation from `!body?.trim()` to `!body`, store JSON directly. **(8) CSS:** `rte-editor__footer` (char/word count), `rte-char-count`/`--warning`, `rte-btn--table`/`--danger`, editor table preview styles (`.rte-editor__content table`), `.selectedCell` highlight, lesson page table styles (`.lp-body table` with alternating rows). **(9) All 5 docs updated.** |

| 2026-03-14 (session 53) | **Registrar Hub — Phase 1 migration into hub system.** Migrated the standalone registrar area at `/account/registrar` into the multi-hub workspace system at `/account/hub/registrar/`. **(1) Hub registration:** Added registrar hub to `prisma/seed-hubs.ts` (slug: `registrar`, OPERATIONAL). Added `REGISTRAR` → registrar hub mapping in `lib/syncHubMembership.ts` (isCoordinator: true). Seeded hub + synced existing REGISTRAR user (LoriLee). **(2) Hub layout integration:** `app/account/hub/[slug]/layout.tsx` — added "Programs" tab when `slug === "registrar"`; Announcements uses explicit `/announcements` path (same pattern as teacher hub). Root page redirects to `/programs`. **(3) Programs list page** (`app/account/hub/[slug]/programs/page.tsx`): Migrated from `app/account/registrar/page.tsx`. Same Sanity query + registration groupBy logic. Added **stakeholder visibility**: non-REGISTRAR hub members see simplified cards (confirmed count + capacity bar + waitlist count only; no links to detail, no pending dana, no spot-open/needs-attention signals). Role check: `isRegistrar = roles.includes("REGISTRAR") \|\| roles.includes("ADMIN")`. **(4) Program detail page** (`app/account/hub/[slug]/programs/[programSlug]/page.tsx`): Migrated from `app/account/registrar/[slug]/page.tsx`. Param renamed from `slug` to `programSlug` (hub slug occupies `[slug]`). Stakeholders redirected to list page. VolunteerTable and CreateMeetButton render identically. **(5) Component moves:** `VolunteerTable.tsx` and `CreateMeetButton.tsx` moved to `components/registrar/` directory. No internal changes. **(6) Sidebar update:** Removed standalone "Programs" link from `AccountSidebar` — registrar hub appears in "Your Hubs" section automatically via hub membership. **(7) Redirects:** `vercel.json` updated — `/volunteer` and `/volunteer/programs/:slug` now redirect to hub paths; new redirects added for `/account/registrar` and `/account/registrar/:slug`. **(8) Internal link updates:** `lib/email.ts` (2 volunteer URLs), `components/MemberDetail.tsx` (1 registration link) updated to new hub paths. **(9) Cleanup:** Deleted `app/account/registrar/` directory and original component files. **(10) Standard hub tabs:** Announcements, Documents, Conversations, Members all available via the shared `[slug]` layout — no registrar-specific implementation needed. |

| 2026-03-15 (session 54) | **Phase 3c/3d complete — Programs fully migrated from Sanity to Postgres.** **(1) Phase 3c cutover:** Last file `app/account/hub/[slug]/programs/[programSlug]/page.tsx` cut over from `sanityClient.fetch` to `db.program.findUnique`. `community-programs/page.tsx` fixed for Prisma Date→string conversion. **(2) Timezone fix:** Created `lib/timezone.ts` with `toCentralDatetime()` (UTC Date → CT datetime-local) and `centralToUtc()` (CT string → UTC Date) using `Intl.DateTimeFormat`. All 4 datetime fields in PUT/POST routes and edit page converted. Root cause: `toLocalDatetime()` used `getHours()` which returns UTC on Vercel. **(3) Google Meet sync on save:** PUT handler now calls `updateCalendarEvent()` when dates/name change, and `deleteCalendarEvent()` + clears Meet fields when switching away from virtual. **(4) Meet warning dialog:** `ProgramEditor.tsx` — confirmation dialog before saving when switching from virtual/hybrid to in-person with active Meet link. **(5) Phase 3d cleanup:** Removed 15 deprecated program GROQ queries from `lib/queries.ts`. Deleted `portableTextToEmailHtml/Text` from `lib/portableTextEmail.ts` (kept `portableTextToMarkdown` for legacy PT). Deleted `app/api/webhooks/sanity-programs/route.ts` (215 lines — calendar sync now in PUT handler). Deleted `app/api/programs/[slug]/google-meet/route.ts` (replaced by `/api/programs-pg/[slug]/google-meet`). **(6) Sanity invitation system removed:** Deleted `app/api/admin/members/[id]/sanity-invite/route.ts`. Removed `revokeSanityAccess()` (~80 lines) + Sanity revocation logic from member PATCH route. Removed all Sanity invite UI from `MemberDetail.tsx` (state vars, handler, JSX section, save bar warning). Removed `sanityInvitedAt` from member detail page serialization. Dropped `sanityInvitedAt DateTime?` from User model (`prisma db push --accept-data-loss`). **(7) Email template sanityNote updates:** Updated `sanityNote` field on email templates — notes now reference "the program record" instead of "Sanity Studio". **(8) §18 deprecated, §19 updated, §28 Phase 3 note updated, §2/§11 Sanity refs cleaned. All 6 closing ritual docs updated. |

| 2026-03-15 (session 55) | **Mobile responsiveness audit — full pass across member account pages, Registrar Hub, shared hub tabs, and Host Hub session pages.** **(1) Member account pages:** Dashboard (`db2-`): wrap padding reduced, Join/quicklink/hub touch targets enlarged to 44px+, today-card layout tightened. My Registrations (`mr-`): cancel buttons enlarged from padding:0 to 44px min-height. My Profile (`mp-`): inputs 15→16px (iOS zoom). My Library (`ml-`): list items 44px min. **(2) ProgramsTableClient flagged row highlight removed** — amber row background for dana pending/needs attention removed; flag badges in Flags column are sufficient. **(3) Registrar Hub:** ProgramsTableClient collapses to card layout at 430px (thead hidden, stacked flex columns); filter pills horizontal scroll; search/add full-width; actions 44px. VolunteerTable: action buttons 44px; inputs 16px; stat bar flex-wrap; reminder section stacks. ProgramEditor: tabs non-wrapping; inputs/selects/textareas 16px; save/cancel stack full-width 48px; day toggles 44px; Tiptap toolbar overflow-x:auto. **(4) Host Hub session tab:** Person rows 52px min-height. End Session and Submit buttons full-width 48px. Post-session form single-column, inputs/textareas 16px. **(5) Shared hub tabs:** Announcements, Conversations, Documents, Members — inputs 16px, touch targets 44px+, forms stack on mobile. **(6) CLAUDE.md updated:** Mobile-responsive design standard added to project instructions — 360px min viewport, 430px/768px breakpoints, 44px touch targets, 16px input fonts. |

| 2026-03-15 (session 56) | **Support Inbox — full shared email client for support@rootedinmindfulness.org.** Built across chunks 1–6 in a single extended session. **(1) Gmail OAuth + sync engine:** `lib/gmail.ts` (OAuth2 client factory + token refresh), `lib/supportSync.ts` (incremental sync via historyId, message parsing, member matching, notification dispatch). 8 Prisma models: GmailCredential, SupportThread, SupportMessage, SupportAttachment, SupportNote, SupportSignature, SupportTemplate, AppSetting. **(2) Inbox UI:** Three-column email client (`SupportInboxClient.tsx`, ~1400 lines, si- prefix). Thread list with 5 filter pills + search + manual sync. Message timeline with reply composer (FormattedEditor + file attachments). Collapsible sidebar with status/assignment controls, member context, registration history, contact history. **(3) Reply + compose:** Gmail API send via threads.messages.send; per-user email signatures (name/role/tagline); file attachments via Vercel Blob (25 MB limit); compose new email modal with contact search. **(4) Email templates:** SupportTemplate model (Tiptap JSON body); CRUD API (ADMIN); template picker dropdown in both reply and compose composers; FormattedEditor editorRef pattern for imperative content insertion. **(5) Soft delete + contact history:** deletedAt on SupportThread; Trash filter with restore + permanent delete (ADMIN); contact history sidebar section (other threads from same sender/member). **(6) User title field:** `title String?` on User model; editable in My Profile and Admin member detail; displayed in inbox assign dropdown and signature pre-fill. **(7) Notifications:** `lib/supportNotify.ts` — in-app Alert records + optional email via Resend; 3 alert types (SUPPORT_ASSIGNED, SUPPORT_NEW_REPLY, SUPPORT_NEW_NOTE); per-user email toggle; 5-minute deduplication. **(8) Cron sync:** `/api/cron/support-sync` every 5 minutes (Vercel Pro). **(9) Settings page:** Gmail connection, default assignee, re-match unlinked threads, signature editor, email notifications toggle, template management. **(10) SUPPORT role:** Added to MemberDetail.tsx assignable roles; syncHubMembership maps SUPPORT→support hub; RIM_Stack_Reference.md updated. **(11) Responsive layout:** Thread list clamp(320px, 25vw, 400px); sidebar auto-collapses below 1100px; mobile single-column list↔detail with back button (768px); 44px touch targets (430px). **(12) Closing ritual:** All docs updated — §29 in FEATURES.md, RIM_Stack_Reference.md (Gmail env vars, models, directories, Vercel Pro), admin/manual (Support Inbox chapter), admin/features (Support Inbox functional area). |

| 2026-03-16 (session 57) | **Support Inbox — security hardening (12 fixes).** Full audit by Claude (independent review) identified 4 critical, 4 moderate, and 4 minor issues. All fixed in a single commit (`43676d3`). **(1) Soft-delete bypass in sync:** `lib/supportSync.ts` — `findUnique` now includes `deletedAt` in select; if a thread is soft-deleted, sync skips it entirely (no resurrection, no new messages processed). **(2) Replies/notes on deleted threads:** `reply/route.ts` and `note/route.ts` both return 404 if `thread.deletedAt` is set — prevents writing to a thread the user already deleted. **(3) SSRF on attachment fetch:** `reply/route.ts` and `compose/route.ts` — added `isSafeBlobUrl()` validator; any attachment URL that doesn't match `*.public.blob.vercel-storage.com` is silently skipped before fetch. **(4) Attachment proxy ownership check:** `attachment/[messageId]/[attachmentId]/route.ts` — imports `db`, looks up `SupportMessage.gmailMessageId` before proxying; unknown messageIds return 404. **(5) Size limit on attachment buffering:** Both reply and compose routes — check `Content-Length` header before calling `.arrayBuffer()`; files over 20 MB skipped. **(6) Rate limit on manual sync:** `sync/route.ts` — 30-second cooldown per user stored in AppSetting (`support.sync.lastAt.{userId}`); returns 429 with seconds-remaining message. **(7) Status PATCH enum validation:** `threads/[id]/route.ts` — explicit check against `["OPEN","CLAIMED","WAITING","RESOLVED"]` before hitting Prisma; returns 400 for unknown values. **(8) Signature field escaping:** `reply/route.ts` and `compose/route.ts` — added `escapeHtml()` helper; name/role/tagline escaped before interpolation into outbound email HTML. **(9) Notification domain:** `lib/supportNotify.ts` — replaced hardcoded `https://rim-next.vercel.app` with `process.env.NEXTAUTH_URL`. **(10) Audit trail for permanent delete:** `threads/[id]/route.ts` DELETE — `console.log` with admin ID, thread ID, subject, and ISO timestamp; appears in Vercel logs. **(11) Max-length validation on signature fields:** `signature/route.ts` — name, role, and tagline each capped at 100 characters; returns 400 if exceeded. **(12) Notification dedup comment:** Added comment in `supportNotify.ts` noting the 5-minute window is an intentional spam-prevention trade-off. Items NOT in the audit fix list (by design): auto-assignment race in reply handler (fire-and-forget is intentional); weak email regex in compose (low risk, `@/` blocks obvious junk). |

| 2026-03-18 (session 66) | **SlugField shared component + hint font fix.** **(1) SlugField component:** `components/SlugField.tsx` — locked-by-default URL slug input with Unlock/Lock toggle and amber warning when unlocked. Props: `value`, `onChange`, `isEditing` (true = starts locked), `warnText`, `hintText`. Applied to `CourseEditor`, `LessonEditor`, `TeacherEditor` (all replaced inline implementations). ProgramEditor already had the pattern on `pe-` classes. **(2) Disabled style:** `.th-input:disabled` added to CSS matching the Program Editor's `pe-input:disabled` — `var(--rim-bg-accent)` background, muted text. **(3) th-field__hint font size:** Bumped from 12px → 14px with `line-height: 1.5` across all Teacher Hub form fields. |

| 2026-03-18 (session 65) | **Series page: holding message when all lessons locked.** Edge case for `hideLockedLessons = true`: when zero lessons are currently available (e.g. member enrolls before any fixed-date lesson releases), the empty lesson area shows a calm holding message instead of a blank space. Message: "Your first lesson will be available on [weekday, month day]." — date resolved from `Lesson.releaseDate` (fixed mode) or `computeAvailableDate()` with enrollment date (interval mode). Year appended only when the release falls in a different calendar year. Falls back to "Lessons will become available soon." if no date can be computed. CSS: `.crs-pending` — centered italic serif, `var(--rim-text-muted)`, generous vertical padding. Key files: `app/course/[slug]/page.tsx`, `public/css/custom.css`. |

| 2026-03-19 (session 67, patch) | **Teacher profile slug auto-generation.** When the Teacher Profile section first appears (i.e. `isTeacher` is checked and no slug exists), the slug field is now auto-populated from `firstName + lastName` (lowercased, spaces → hyphens, non-alphanumeric stripped — e.g. "Jesse Foy" → `jesse-foy`). Uses the `SlugField` component (locked by default; Unlock button to edit manually), same as CourseEditor and LessonEditor. A `useEffect` in `MemberDetail.tsx` triggers on `isTeacher` change; only runs if slug is currently empty. Commit: `ee36eb4`. |

| 2026-03-19 (session 67) | **Replace Teacher model with isTeacher flag + TeacherProfile on User.** **(1) Schema:** Dropped standalone `Teacher` model and all related admin files (`app/admin/teachers/`, `app/api/admin/teachers/`, `app/api/teachers/`, `components/TeacherEditor.tsx`, `components/TeacherAdmin.tsx`). Added `isTeacher Boolean @default(false)` to User. Added `TeacherProfile` model (one-to-one via `userId @unique`): `bio String?`, `photoUrl String?`, `slug String? @unique`, `isPublic Boolean @default(false)`. `LessonTeacher` reverted to direct `userId → User` join. `prisma db push --accept-data-loss`. **(2) Member admin:** `MemberDetail` gains "Teacher Attribution" section with isTeacher checkbox (saves via existing PATCH route). When `isTeacher: true`, "Public Teacher Profile" section appears with bio textarea, photo URL input, slug input, and isPublic checkbox. Saves via new `PATCH /api/admin/members/[id]/teacher-profile` (upserts TeacherProfile). **(3) Lesson picker:** `/api/members/search` now filters `isTeacher: true`. `LessonEditor` searches this route; maps `{ firstName, lastName }` → `{ id, name }` for TeacherItem. **(4) Public pages:** `/teachers` rebuilt to query `TeacherProfile where isPublic: true`, ordered by user.firstName. `/teachers/[slug]` rebuilt from TeacherProfile.slug with 404 if not found or not public. Both show user name (from User model) + bio + photo. **(5) Lesson/series/courses pages:** Teacher data now flows through `LessonTeacher → User`; lesson page links to `/teachers/[slug]` only if `teacherProfile.isPublic`. Commit: `39139b2`. |

| 2026-03-19 (session 69) | **BlockNote editor migration + slash menu + hub documents + footer suppression.** Complete migration from Tiptap to BlockNote as the editor foundation. **(1) Migration:** All 18 `Json?` rich-text fields across 14 database tables converted from Tiptap JSON to BlockNote JSON via `prisma/migrate-to-blocknote.ts` (54 records, 33 converted, 21 already BlockNote). Migration script is idempotent — safe to re-run. **(2) New editors:** `RimBlockEditor` (full: headings, tables, lists, custom Dharma blocks via slash commands) replaces `ContentEditor`. `RimProseEditor` (prose: paragraphs, lists, quotes, formatting toolbar) replaces `FormattedEditor`. Both store BlockNote JSON. **(3) Custom Dharma blocks in slash menu:** `verseQuote`, `practiceSuggestion`, `callout` registered in `SuggestionMenuController` with icons (RiQuoteText, RiPlantLine, RiInformationLine) and aliases. Grouped under "Dharma" in the slash menu. **(4) Render pipeline:** Split into server-only (`lib/renderRichContentServer.ts` — async, `@blocknote/server-util` via dynamic import) and client-safe (`lib/renderRichContent.ts` — sync walker, no JSDOM). Server retains Tiptap fallback for un-migrated records. Client components receive pre-rendered `bodyHtml` strings from server parents. **(5) Native hub documents:** `HubDocument` model gained `body Json?`, `isNative Boolean`, `url String?` (nullable), `updatedAt`. New routes: `/documents/new`, `/documents/[id]` (view), `/documents/[id]/edit`, `/api/.../[id]/export` (Markdown). `HubDocumentEditor` component. **(6) Footer suppression:** `FooterWrapper.tsx` hides newsletter footer on `/admin/*`, `/account/*`, `/lessons/[slug]`, `/course/[slug]`. Trailing-slash precision preserves footer on `/courses` and `/lessons` browse pages. **(7) Fixes:** Reflection question body render (`renderBlockNoteHtml` fallback instead of `String(q.body)` producing `[object Object]`). Admin notes toolbar restored (removed `minimal` prop from `RimProseEditor`). `renderBlockNoteHtml` handles legacy Tiptap JSON client-side via lightweight text extractor. Tiptap fallback restored in server render functions. **(8) Deleted:** `components/ContentEditor.tsx`, `components/FormattedEditor.tsx`, `lib/tiptap-extensions.ts`. **(9) §28 rewritten, §33 + §34 added to FEATURES.md. |

| 2026-03-18 (session 66) | **Teacher model: User link + Teacher-based lesson picker; question body display fix; submit button width.** **(1) Teacher.userId:** Added `userId String? @unique` to Teacher model + `user User? @relation(onDelete: SetNull)`. TeacherEditor gains a "Linked member account" section with member typeahead search (calls `/api/members/search`); optional — not all teachers need a linked account. PATCH `/api/admin/teachers/[slug]` accepts `userId`; GET returns `linkedMemberName`. Admin teacher page passes both to TeacherEditor. **(2) LessonTeacher → Teacher-based (corrects session 65):** `userId String` → `teacherId String` referencing Teacher (not User). All lesson/series/courses pages and the lesson PATCH route updated. `/api/teachers/search` already existed and returns `{id, name}`. LessonEditor `TeacherItem` updated to `{id, name}`; search URL changed to `/api/teachers/search`; display uses `t.name`. `prisma db push --accept-data-loss`. **(3) Question body display fallback:** `ReflectionQuestionsClient` now handles both plain-string bodies (typeof === "string" → render as `<span>{q.body}</span>`) and Tiptap JSON (`renderFormattedText`). One-time migration script `prisma/migrate-question-bodies.ts` converts any plain-string records to Tiptap JSON (all 2 existing records already JSON). **(4) Submit button width:** `.ls-btn--submit-all` now `width: fit-content; min-width: 180px`; full-width below 430px. Key files: `prisma/schema.prisma`, `components/TeacherEditor.tsx`, `app/admin/teachers/[slug]/page.tsx`, `app/api/admin/teachers/[slug]/route.ts`, `components/LessonEditor.tsx`, `app/api/lessons/[slug]/route.ts`, `app/lessons/[slug]/page.tsx`, `app/course/[slug]/page.tsx`, `app/courses/page.tsx`, `app/account/hub/[slug]/lessons/[lessonSlug]/page.tsx`, `components/ReflectionQuestionsClient.tsx`, `prisma/migrate-question-bodies.ts`, `public/css/custom.css`. |

| 2026-03-18 (session 65) | **Learning System polish + teacher attribution.** **(1) Group submit model for Reflection Questions:** Replaced per-question Submit/Retake with a single "Submit answers." button (disabled until all questions selected); `Promise.all` parallel submit; single "Retake reflection questions." link calls `DELETE /api/lessons/[slug]/questions/responses` (clears all server-side responses); `onRetake` callback re-locks Complete button. **(2) ReflectionQuestion.text → body:** `text String` replaced with `body Json?` (Tiptap JSON via `FormattedEditor`). `prisma db push --accept-data-loss`. APIs updated (GET/PUT `/api/lessons/[slug]/questions`). `ReflectionQuestionsClient` renders via `renderFormattedText()`. **(3) LessonTeacher — User-based migration:** Schema migrated from `Teacher` model (`teacherId`) to `User` model (`userId + order`). All admin teacher routes/pages updated (removed `lessons` relation from `Teacher` queries). New `GET /api/members/search?q=` route (TEACHER/ADMIN only, name search, take 20). LessonEditor teacher picker now searches members. Lesson page + series page display teacher bylines from `User.firstName/lastName`. **(4) Lesson UX fixes:** Removed `DanaSection` from lesson page entirely. Nav cards restyled (white bg, 1px border, 10px radius, direction labels). Radio buttons always start unselected. Duration field removed from LessonEditor UI (kept in schema). **(5) Build fixes:** Fixed 7 teacher-related files that referenced the removed `Teacher.lessons` relation (`app/courses/page.tsx`, `app/teachers/[slug]/page.tsx`, `app/admin/teachers/page.tsx`, `app/admin/teachers/[slug]/page.tsx`, `app/api/admin/teachers/route.ts`, `app/api/admin/teachers/[slug]/route.ts`, `app/api/teachers/[slug]/route.ts`, `app/api/teachers/route.ts`). Key files: `prisma/schema.prisma`, `components/ReflectionQuestionsClient.tsx`, `components/LessonFooterClient.tsx`, `components/LessonEditor.tsx`, `app/lessons/[slug]/page.tsx`, `app/course/[slug]/page.tsx`, `app/api/members/search/route.ts`, `app/api/lessons/[slug]/questions/responses/route.ts`. |

| 2026-03-18 (session 64) | **Course Hub: hide locked lessons toggle + per-lesson drip fixes.** **(1) hideLockedLessons field:** `Course.hideLockedLessons Boolean @default(false)`. `prisma db push`. When true, locked (drip-gated) lessons are omitted from the series page entirely for non-admin members; when false (default), locked lessons are visible with a lock icon and release date. **(2) Series page — hidden lessons rendering:** Display list built with a two-pass algorithm: walk `allLessonItems` in order, re-attach section divider labels to the first *available* lesson per section (so no orphaned headers when a section's first lesson is locked). Admins always see all lessons. Lesson numbers use the global index for consistency. Progress bar shows quiet italic "More lessons unlock as you progress." note when lessons are hidden. **(3) CourseEditor checkbox:** In the Release Schedule fieldset, only visible when `dripEnabled = true`. Plain-language help text. Resets to `false` if drip is disabled on save. **(4) Per-lesson drip UI/bug fixes (session 63):** Fixed `dripMode` initialization (was always "interval" on reload; now inferred from `dripIntervalDays === null`). Fixed `lessonReleaseDates` init (was reading `cl.releaseDate` — undefined — instead of `cl.lesson.releaseDate`). Added per-lesson "Unlock after X days" input in interval mode (stored in `Lesson.releaseDelayDays`). Drip preview shows resolved days with "(custom)" marker. **(5) Slug locked in editor:** Slug field is now `readOnly` when editing a series. **(6) API:** PATCH `/api/courses/[slug]` accepts `hideLockedLessons`, `lessonDelayDays` map. Key files: `prisma/schema.prisma`, `components/CourseEditor.tsx`, `app/course/[slug]/page.tsx`, `app/api/courses/[slug]/route.ts`, `app/account/hub/[slug]/courses/[courseSlug]/page.tsx`. |

| 2026-03-18 (session 63) | **Manual section editor fix (rawHtml → Tiptap JSON).** Sections migrated from `ManualContent.tsx` were stored as `{ type: "rawHtml", html: "..." }` — `ManualSectionEditor` was passing this directly to `ContentEditor` (Tiptap), which doesn't recognize the custom wrapper type and rendered the editor empty. Fix: added `useMemo` in `ManualSectionEditor.tsx` that detects `rawHtml` bodies and converts them to Tiptap JSON using `generateJSON()` from `@tiptap/core`, with the same extension set as `ContentEditor`, before the editor mounts. After the first save, the body is stored as proper Tiptap JSON. Key file: `components/ManualSectionEditor.tsx`. |

| 2026-03-18 (session 62) | **Modular Manual System.** **(1) Content migration:** All 8 chapters from the 3115-line `ManualContent.tsx` migrated into `ManualSection` DB records via `prisma/seed-manual-chapters.ts`. Each chapter stored as `{ type: "rawHtml", html: "..." }` (renderContentBody handles this format). 9 sections total including `manual-system` meta-section. `description String?` field added to ManualSection schema. **(2) renderContentBody rawHtml support:** `lib/renderRichContent.ts` updated — if `json.type === "rawHtml"`, returns `json.html` directly (bypasses Tiptap). **(3) Section pages:** `/admin/manual/[slug]` rebuilt — any logged-in user can read (not ADMIN-only); ADMIN sees Edit link; shows section title, hub badge, last updated date, body content, related section pills, back/full manual links. **(4) Manual index:** `/admin/manual` rebuilt as clean server-component index listing all ManualSection records with title, description, and hub badge. ADMIN sees "Manage sections →" link to editor. `/manual` public route updated to same index, no edit controls. **(5) ManualHelpIcon wired:** 10 locations confirmed/corrected — Course Hub landing, CourseEditor (series editor), LessonEditor (lesson editor), /account/courses/, /courses/, host-hub landing, registrar programs, support inbox, admin member detail, admin teachers. Several had wrong slugs fixed (member-courses→course-hub, member-registry→member-accounts, registrar-hub→registration). **(6) ManualContent.tsx hollowed out:** Replaced 3115 lines of JSX with a 14-line comment stub. **(7) Closing ritual updated:** 4-step closing ritual documented in FEATURES.md and RIM_Stack_Reference.md; ManualSection upsert replaces the old 6-doc ritual. **(8) CSS:** `man-idx` (index page) and `man-sec-page` (section page) CSS classes added to `custom.css`. Key files: `prisma/seed-manual-chapters.ts`, `lib/renderRichContent.ts`, `app/admin/manual/page.tsx`, `app/admin/manual/[slug]/page.tsx`, `app/manual/page.tsx`, `components/ManualContent.tsx`, `components/CourseEditor.tsx`, `components/LessonEditor.tsx`, `app/admin/teachers/page.tsx`, `public/css/custom.css`. |

| 2026-03-18 (session 61) | **Contextual Help System + Manual Migration.** **(1) ManualSection model:** Added to Prisma schema (`manual_sections` table); `slug` @unique, `body` Json?, `relations` String[], `hubSlug` String?, `order` Int. `prisma db push`. **(2) API routes:** `app/api/admin/manual/route.ts` (GET list / POST create) and `app/api/admin/manual/[slug]/route.ts` (GET one / PATCH update); both ADMIN-only; no DELETE. **(3) Admin manual pages:** `app/admin/manual/page.tsx` replaced (was ~1200 lines hardcoded JSX) with client component fetching from API; accordion list with expand/collapse. `app/admin/manual/[slug]/page.tsx` — section detail with body rendered via `renderContentBody()` and related section pill links. `app/admin/manual/[slug]/edit/page.tsx` + `components/ManualSectionEditor.tsx` — editor with ContentEditor for body, relations input, order field. **(4) ManualHelpIcon component:** `components/ManualHelpIcon.tsx` — small `?` circle, `position: absolute; top: 12px; right: 12px`, links to `/admin/manual/[slug]` in new tab; `mh-` CSS prefix. Wired into 9 locations: Series list, Series editor, Lesson editor, /account/courses, /courses, host-team hub, registrar programs, support inbox, member detail page. **(5) Manual migration:** `prisma/seed-manual.ts` seeds 4 sections (registration-management, programs-editor, member-registry, volunteer-roles) from the old hardcoded content. `prisma/seed-courses-manual.ts` seeds 5 courses sections (course-hub, course-hub-series, course-hub-lessons, member-courses, teacher-profiles) with full plain-language content. **(6) Closing ritual standard:** Updated FEATURES.md (§31 + session log), RIM_Stack_Reference.md with ManualSection model and closing ritual note. |

| 2026-03-18 (session 60) | **Learning System — features 1–6 built.** New `LessonNote` Prisma model (`lesson_notes` table, `userId + lessonId @@unique`, `body Json?`). `durationMinutes Int?` and `reflectionPrompt String?` added to `Lesson`. New API: `GET + PATCH /api/lessons/[slug]/note` (enrollment-gated — 403 if not enrolled). `POST /api/lessons/[slug]/complete` fixed: (a) enrollment gate (403 if `courseSlug` provided but no `SeriesEnrollment`), (b) when toggling to incomplete: clears `SeriesEnrollment.completedAt` if set, (c) returns `{ completed, seriesCompleted }` consistently. Lesson PATCH + POST routes + course PATCH route accept new fields. New `components/LessonNoteEditor.tsx` — `FormattedEditor` with 1.5s debounced autosave + Saving/Saved status indicator (`ls-note-status`). `app/lessons/[slug]/page.tsx`: fetches `SeriesEnrollment` + `LessonNote` server-side; shows `ls-lesson-footer` only when enrolled — contains reflection prompt (italic serif below rule), notes editor, mark complete button. `app/account/dashboard/page.tsx`: replaced simple series count line with `ls-dash-card` cards showing title link, inline progress bar (X of Y lessons), and Continue → link to first incomplete lesson; non-onboarding enrollments only. `CourseEditor.tsx` gains `completionNote` textarea; `LessonEditor.tsx` gains `durationMinutes` number input and `reflectionPrompt` textarea. Full `ls-` CSS prefix block added. §30 in FEATURES.md updated from Planned → ✅ Built. Key files: `prisma/schema.prisma`, `app/api/lessons/[slug]/complete/route.ts`, `app/api/lessons/[slug]/note/route.ts`, `components/LessonNoteEditor.tsx`, `components/CourseEditor.tsx`, `components/LessonEditor.tsx`, `app/lessons/[slug]/page.tsx`, `app/account/dashboard/page.tsx`, `public/css/custom.css`. |

| 2026-03-17 (session 59) | **Course→Series rename + series page redesign + section labels UX + build fixes + learning system planned.** **(1) Build fixes:** `Prisma.JsonNull` required for `Json?` nullable fields — fixed in `app/api/host/sub-requests/[id]/claim/route.ts` (message field), `app/api/host/sub-requests/route.ts` (message field), and `app/api/programs/[slug]/registrations/route.ts` (notes field in CSV export — used `extractText()` to convert Tiptap JSON to plain string). **(2) Course→Series rename:** All UI labels throughout the Teacher Hub now say "Series." DB model name `Course` unchanged. Hub tab, CourseEditor headings, LessonListClient, all hub pages updated. **(3) Section labels UX redesign:** Replaced floating text inputs above each lesson row with explicit draggable section-divider rows in `CourseEditor.tsx`. `+ Add Section` button appends a teal dashed-border row (inline-editable label, ✕ remove). `listToLessonOrder()` serializes to `{ id, groupLabel }[]`; `courseLessonsToList()` reconstructs on load. **(4) Sort order removed:** Removed from Series editor UI — was a Webflow artifact; DB column remains. **(5) Series page redesign (`/course/[slug]`):** Full redesign from dark teal hero bar to `lp-` lesson-page aesthetic. `var(--rim-bg)` warm background, centered weight-400 serif title (42px), muted small-caps label, thin `<hr>` rule, 640px reading column. **(6) Lesson cards + SVG icons:** Lesson rows are now white cards (border-radius 10px, border-color hover transition). Replaced text badges with tinted icon squares: headphones/sage for audio, play-circle/slate for video, text-lines/warm-gray for reading. Inline SVG icon components (`AudioIcon`, `VideoIcon`, `TextIcon`). CSS classes: `crs-toc__icon-wrap`, `crs-toc__icon-wrap--audio/video/text`, `th-section-row`, `th-btn--ghost`. **(7) Learning system planned:** Full feature set designed and documented in §30 (progress tracking, enrollment, duration estimates, reflection prompts, personal notes, completion, teacher profiles, per-series discussion). New "Learning System" section added to roadmap (`app/admin/roadmap/page.tsx`) as high priority with 8 detailed items. Key files: `components/CourseEditor.tsx`, `app/course/[slug]/page.tsx`, `app/api/host/sub-requests/route.ts`, `app/api/host/sub-requests/[id]/claim/route.ts`, `app/api/programs/[slug]/registrations/route.ts`, `public/css/custom.css`, `app/admin/roadmap/page.tsx`. |

| 2026-03-20 (session 70) | **Editor design document + CSS output audit + household notes BlockNote migration + RimEditor → MarkdownEditor rename.** **(1) RIM_Editor_Types.md created:** Comprehensive editor design reference at project root. Includes a complete context registry (every editor surface in the app with its editor type, custom blocks, output CSS class, and design intent), output CSS guidelines, custom block system reference, render pipeline diagram, and naming conventions. 16 contexts registered. **(2) CSS output class audit:** Independent audit of all registered contexts against `custom.css` found 6 missing output CSS blocks. Added: `.man-body` (18 rules — manual section pages), `.hdoc-body` (16 rules — hub document view pages), `.prog-description` (14 rules — program description + notes), `.ann-item__body` (7 rules — hub announcement bodies), `.cv-post__body` (7 rules — hub conversation post bodies), `.ls-notes-body` (8 rules — lesson personal notes). Removed ~170 lines of dead `.rte-editor` CSS (old FormattedEditor/ContentEditor from before session 69 BlockNote migration). JSX class names updated on 4 pages to match the new canonical names. **(3) Server render pipeline fixes:** Found 2 server components (`session/history/page.tsx` and `session/history/team/page.tsx`) calling the client-safe `renderBlockNoteHtml` instead of the server-only `renderFormattedTextAsync`. Fixed by pre-rendering HTML before the JSX return in both files. **(4) Household notes → BlockNote:** `Household.notes String?` → `Json?` in Prisma schema. `HouseholdDetail.tsx` migrated from `RimEditor` to `RimProseEditor`. Migration script `prisma/migrate-household-notes.ts` (ran with 0 records to convert — all existing households had null notes). API route handles `Json?` correctly (`notes || null` check). **(5) RimEditor → MarkdownEditor rename:** `components/RimEditor.tsx` renamed to `components/MarkdownEditor.tsx`. Export function renamed from `RimEditor` to `MarkdownEditor`. Docblock completely rewritten to clarify: this is NOT the platform editor standard; it exists exclusively for email templates where the markdown → marked() → juice() → Resend pipeline is correct. `EmailTemplateEditor.tsx` import updated. `RIM_Editor_Types.md` updated with `household-notes` and `email-template` context entries. Key files: `components/MarkdownEditor.tsx` (renamed), `components/EmailTemplateEditor.tsx`, `components/HouseholdDetail.tsx`, `prisma/schema.prisma`, `prisma/migrate-household-notes.ts`, `public/css/custom.css`, `RIM_Editor_Types.md`, `app/account/hub/[slug]/session/history/page.tsx`, `app/account/hub/[slug]/session/history/team/page.tsx`. Commit: `7f590dc`. |

| 2026-03-16 (session 58) | **Session tab visual redesign + post-session form overhaul + FormattedEditor standard.** Full redesign of the Host Hub Session tab and post-session form across `SessionLiveClient.tsx`, `PostSessionClient.tsx`, schema, and CSS. **(1) State machine fixes:** `computeState` was called once on mount and never re-ran. Added tick counter (`useState` incremented inside the 60-second poll interval) so all 6 states (later-today → getting-ready → live → post-session → done) transition correctly without a page reload. Removed server-side `prog.sessionEnded` from `isEnded` — was frozen at render time, could force State 5 while session was live. Now only `manuallyEnded` (explicit Close Session click) and `timeEnded` (`Date.now()` > endMs) control the ended state. **(2) Visual redesign — person rows:** Replaced chip grid with `AttendeeRow` full-width button component (52px tall). Left-edge 4px color strip: amber = new member, teal = returning, grey = absent. Inline "New" / "Back" label, name centered, flag circle at right edge. Tap toggles flag; flagged rows get amber background. **(3) Live block prominence:** Sage green background (`rgba(100, 140, 100, 0.12)`) with 4px left border on live session card. Non-live sessions without forms collapse to footnote links when `hasActiveForm = true`. `hasLive` computed once; sessions without a form to file always show. **(4) Scoreboard:** `sv-scoreboard` — 48px number + "in the room" label, displayed inside the live block. **(5) Co-host flow:** "I'm also hosting this" button restored as quiet inline text link in live state. Confirmation: `sv-cohost-confirmed--live` pill after click (no page reload needed). **(6) Post-session form — flagged people section:** All hosts now see the full post-session form (no more isCoHost distinction). Section 1 shows flagged attendees (everyone tapped during the session) with a FormattedEditor note field per person + 4 routing radio buttons with descriptions: No action needed / Gentle follow-up / Jesse only — sensitive / Technical issue. Descriptions render as `ps-radio__desc` beneath each label. **(7) FormattedEditor standard enforced:** Replaced plain textarea in reflection and all flag note fields with `FormattedEditor` (Tiptap JSON). Autosave to localStorage includes Tiptap JSON objects. `DraftState` uses `object | null` for `reflection` and `flagNotes`. **(8) Schema migration:** 3 fields changed from `String?` to `Json?` via `prisma db push`: `SessionAttendance.postSessionNote`, `SessionReport.reflection`, `SessionCoHostReport.reflection`. All stored as Tiptap JSON. Uses `Prisma.JsonNull` for nullable writes. **(9) `extractText()` utility:** Added to `lib/renderRichContent.ts` — runs `generateHTML()` then strips tags, used for email notification plain text from Tiptap JSON. **(10) API route updates:** `/api/attendance/session/[programSlug]/post/route.ts` — `flags.note` typed as `object | null`; stores `Prisma.JsonNull`; email notification uses `extractText()`. `/api/attendance/session/[programSlug]/cohost-report/route.ts` — same `Prisma.JsonNull` pattern. **(11) History page updates:** `session/history/page.tsx` and `session/history/team/page.tsx` — `postSessionNote`/`reflection` cast to `object | null`, rendered with `renderFormattedText()` + `dangerouslySetInnerHTML`. **(12) Memory saved:** `memory/feedback_editor_standard.md` — documents the FormattedEditor standard (all multi-line communication fields, `Json?` DB type, `renderFormattedText()` for display, `extractText()` for email) so it's applied automatically in future sessions. Key files: `components/SessionLiveClient.tsx`, `components/PostSessionClient.tsx`, `app/api/attendance/session/[programSlug]/post/route.ts`, `app/api/attendance/session/[programSlug]/cohost-report/route.ts`, `app/account/hub/[slug]/session/history/page.tsx`, `app/account/hub/[slug]/session/history/team/page.tsx`, `app/account/hub/[slug]/session/[programSlug]/post/page.tsx`, `lib/renderRichContent.ts`, `prisma/schema.prisma`, `public/css/custom.css`. |

---

## 30. Learning System ✅ Features 1–6 + Reflection Questions Built (sessions 60–61, 2026-03-18)

**What it is:** A set of features that upgrades the Series/Lesson library from a static content archive into an active learning companion — designed specifically for a contemplative community. No gamification, streaks, points, or credentials. The goal is to give members the tools to engage deeply with teachings over time: knowing where they are, reflecting on what they've read, and marking moments of completion.

**Design principle:** Every feature in this system should feel like a journal or a practice companion — not a platform. The contemplative context is load-bearing: choices that work for a MOOC platform may not fit here.

### Feature status

| # | Feature | Status | What it does |
|---|---|---|---|
| 1 | **Lesson progress tracking + Continue button** | ✅ Built | Mark lessons complete; series page shows progress bar + "Continue →" link; dashboard shows active series cards |
| 2 | **Series enrollment** | ✅ Built | Members consciously enroll in a series (separate from access); drives dashboard; `SeriesEnrollment` model |
| 3 | **Duration estimates** | ✅ Built | `durationMinutes Int?` on Lesson; teacher-entered in LessonEditor |
| 4 | **Reflection prompts** | ✅ Built | `reflectionPrompt String?` on Lesson; shown at bottom of lesson (italic serif, preceded by rule) when enrolled |
| 5 | **Personal lesson notes** | ✅ Built | Private per-lesson note (FormattedEditor, Tiptap JSON); 1.5s debounced autosave; only shown when enrolled |
| 6 | **Completion moment** | ✅ Built | All lessons marked complete → sets `SeriesEnrollment.completedAt`; quiet acknowledgment with teacher's completion note |
| 7 | **Reflection Questions** | ✅ Built (session 61) | Multiple-choice questions per lesson; teacher sets correct answer; required vs. gentle mode; Complete button gate in required mode |
| 8 | **Teacher profiles** | ✅ Built (session 67) | Optional TeacherProfile one-to-one extension on User; bio, photo, slug, isPublic; managed from member admin page; public /teachers page shows profiles where isPublic: true. |
| 9 | **Shared reflection / per-series discussion** | Deferred | Optional per-series contemplative sharing thread; off by default |

### Key data models

| Model | Fields | Status |
|---|---|---|
| `LessonProgress` | `userId`, `lessonId`, `completedAt`, `@@unique([userId, lessonId])`, `@@map("lesson_progress")` | ✅ Built |
| `SeriesEnrollment` | `userId`, `courseId`, `enrolledAt`, `completedAt?`, `enrollmentSource`, `@@unique([userId, courseId])`, `@@map("series_enrollments")` | ✅ Built |
| `LessonNote` | `userId`, `lessonId`, `body Json?`, `updatedAt`, `@@unique([userId, lessonId])`, `@@map("lesson_notes")` | ✅ Built (session 60) |
| `ReflectionQuestion` | `lessonId`, `body Json?` (Tiptap JSON), `sortOrder`, `@@map("reflection_questions")` | ✅ Built (session 61); `text→body` session 65 |
| `ReflectionOption` | `questionId`, `text`, `isCorrect Boolean`, `sortOrder`, `@@map("reflection_options")` | ✅ Built (session 61) |
| `ReflectionResponse` | `userId`, `questionId`, `optionId`, `answeredAt`, `@@unique([userId, questionId])`, `@@map("reflection_responses")` | ✅ Built (session 61) |
| `TeacherProfile` | `userId @unique`, `bio String?`, `photoUrl String?`, `slug String? @unique`, `isPublic Boolean`, `@@map("teacher_profiles")` | ✅ Built session 67 (replaces old Teacher model) |
| `LessonTeacher` | `id`, `lessonId`, `userId` (→ User), `order Int`, `@@unique([lessonId, userId])`, `@@map("lesson_teachers")` | ✅ Final form: session 67 (direct User join, no Teacher intermediary) |

### Fields added to existing models

| Model | Field | Status |
|---|---|---|
| `User` | `isTeacher Boolean @default(false)` | ✅ Built session 67 — enables lesson attribution + teacher profile |
| `Lesson` | `durationMinutes Int?` | ✅ Built (session 60) |
| `Lesson` | `reflectionPrompt String?` | ✅ Built (session 60) |
| `Lesson` | `questionsRequired Boolean @default(false)` | ✅ Built (session 61) |
| `Course` | `completionNote String?` | ✅ Built (already existed) |
| `Course` | `discussionEnabled Boolean @default(false)` | ✅ Schema only (UI deferred with Feature 9) |

### Who uses it
- **Members** — enroll in series; track progress; write private lesson notes; answer reflection questions; mark lessons complete
- **Teachers** — enter duration, reflection prompt, questions, and correct answers via LessonEditor; set completion note via CourseEditor; toggle `questionsRequired` to gate the Complete button

### Member user flow — base features
1. Member visits `/course/[slug]` — sees Enroll button if not enrolled
2. Member clicks Enroll → `SeriesEnrollment` record created → progress bar + Continue button appear
3. Member clicks Continue → goes to first incomplete lesson
4. At bottom of lesson (enrolled only): reflection prompt (if set), reflection questions (if set), personal notes editor, Mark Complete button
5. Notes autosave as member types (1.5s debounce)
6. Member marks lesson complete → progress updates on next visit to series page
7. Last lesson marked complete → `SeriesEnrollment.completedAt` set → completion note shown on lesson page + series page
8. Dashboard shows `ls-dash-card` cards for all non-onboarding enrolled series with progress bars and Continue links

### Member user flow — reflection questions
1. Teacher writes questions in LessonEditor; marks one option per question as correct; optionally checks "Required mode"
2. Member visits the lesson (must be enrolled) — sees questions below the reflection prompt
3. Member selects an answer per question and clicks Submit — immediately sees ✓ Correct or ✗ Not quite feedback
4. If incorrect, the correct answer is revealed inline; member can click "Try again" to retake
5. Retakes always allowed — re-submission overwrites the previous answer
6. **Required mode:** Complete button is disabled until all questions answered correctly. Once unlocked it stays unlocked for the session and on all future visits (`initialAllCorrect` computed server-side)
7. **Gentle mode:** questions are shown but Complete button is always active; footer note says "these don't affect completion"
8. Series page shows `ls-q-indicator` badge ("3Q") on lessons with required questions

### Key files
- `app/api/lessons/[slug]/questions/route.ts` — GET (member, enrollment-gated, no isCorrect in options) + PUT (teacher replace-all)
- `app/api/lessons/[slug]/questions/[questionId]/respond/route.ts` — POST upsert response; returns `isCorrect + correctOptionId`
- `app/api/lessons/[slug]/complete/route.ts` — POST: toggle complete; 403 if not enrolled; clears `completedAt` on un-complete
- `app/api/courses/[slug]/enroll/route.ts` — POST/DELETE: enroll / unenroll
- `app/api/lessons/[slug]/note/route.ts` — GET/PATCH: personal note upsert (enrollment-gated)
- `app/course/[slug]/page.tsx` — progress bar, Continue link, enrollment button, completion state; `ls-q-indicator` on required-question lessons
- `app/lessons/[slug]/page.tsx` — fetches questions + responses + correctOptionIds server-side; computes `initialAllCorrect`; renders `LessonFooterClient`
- `app/account/dashboard/page.tsx` — `ls-dash-card` series cards with progress
- `components/LessonFooterClient.tsx` — "use client" wrapper; holds `allCorrect` state; feeds `locked` prop to `MarkCompleteButton`
- `components/ReflectionQuestionsClient.tsx` — per-question radio + submit + correct/incorrect feedback + retake; calls `onAllCorrect` callback
- `components/LessonNoteEditor.tsx` — FormattedEditor with 1.5s debounced autosave + save status indicator
- `components/MarkCompleteButton.tsx` — toggle complete; `locked` prop for questions gate; handles series completion acknowledgment
- `components/EnrollButton.tsx` — enroll/unenroll with confirmation
- `components/LessonEditor.tsx` — `reflectionPrompt` + `questionsRequired` + full questions section (FormattedEditor for question body, add/reorder/remove questions + options, correct-answer radio); User-based teacher picker (searches /api/members/search)
- `components/CourseEditor.tsx` — `completionNote` field

**🔧 Technical notes:**
- Enrollment is required to access the lesson footer (reflection, notes, complete). Access (viewing content) is controlled separately by `accessLevel` and `CourseAccess`.
- `reflectionPrompt` is plain `String?` (not Tiptap) — single sentence or short paragraph, no formatting needed.
- Personal notes (`LessonNote.body`) are Tiptap JSON via `FormattedEditor`. `Prisma.JsonNull` required when body is null.
- `completedAt` on `SeriesEnrollment` is set automatically when all lessons in the course have `LessonProgress` records — not manually by the member.
- **isCorrect is never sent to the client in the member questions GET** — only `optionId`, `text`, `sortOrder`. The correct option ID is only revealed after the member submits an answer (via the respond route).
- **Group submit model (session 65):** All questions submitted simultaneously via `Promise.all`. A single "Submit answers." button replaces per-question submit; disabled until every question is selected. A single "Retake reflection questions." link calls `DELETE /api/lessons/[slug]/questions/responses` (clears all responses for this member) and resets all local state. `onRetake` callback re-locks the Complete button in `LessonFooterClient`.
- **ReflectionQuestion.body (session 65):** Question text changed from `text String` (plain) to `body Json?` (Tiptap JSON, `FormattedEditor`). Rendered in the client via `renderFormattedText()`. Schema migration required `prisma db push --accept-data-loss` (2 rows existed).
- **Teacher model removed (session 67):** The standalone `Teacher` model (name/bio/photo/slug/isActive) has been fully replaced. Teacher identity now lives on `User`: `isTeacher Boolean` flag enables attribution; `TeacherProfile` (one-to-one extension) holds bio/photoUrl/slug/isPublic for public display. `LessonTeacher` is now a direct `User` join (`userId → User`). The lesson picker searches `/api/members/search` (filtered to `isTeacher: true`). Teacher profile managed via MemberDetail admin page → Teacher Attribution + Teacher Profile sections. Public pages (`/teachers`, `/teachers/[slug]`) query `TeacherProfile where isPublic: true`.
- `initialAllCorrect` is computed server-side (comparing `ReflectionResponse.optionId` against `ReflectionOption.isCorrect`) so the Complete button is correctly unlocked on page load for members who already answered correctly in a previous session.
- The `LessonFooterClient` wrapper holds `allCorrect` state locally; `ReflectionQuestionsClient` fires `onAllCorrect()` when all questions are answered correctly in this session, updating the parent state.
- Teacher question saves: LessonEditor calls PUT `/api/lessons/[slug]/questions` after PATCH lesson. The PUT is a full replace (deleteMany + re-create), keeping the implementation simple since question sets are small.
- `ls-q-indicator` on the series page only appears when `questionsRequired = true` AND the lesson has at least one question (uses `_count.questions`).

*Updated: 2026-03-19 (session 67)*

## 31. Contextual Help System (Manual Sections)

**What it is:** A database-backed staff manual system where each section of the manual is a `ManualSection` record with a slug, title, body (Tiptap JSON), and a list of related section slugs. Any page in the staff area can show a small `?` icon that links to the relevant manual section in a new tab.

**Who uses it:**
- **Teachers** — the Course Hub pages now have `?` icons linking to the relevant manual sections
- **Registrars** — the Programs hub page links to the Registration Management manual section
- **Support** — the Support Inbox links to the support-inbox manual section
- **Admins** — can create, edit, and view all manual sections via the new admin manual pages

**User flow:**
1. A Teacher visits the Series editor at `/account/hub/courses/courses/[slug]`
2. A small `?` circle in the top-right of the page links to `/admin/manual/course-hub-series`
3. The manual section opens in a new tab with plain-language guidance
4. Admins can update the manual section content at any time — no redeploy needed

**Admin pages:**
- `/admin/manual` — lists all sections with expand/collapse and edit links; create new sections inline
- `/admin/manual/[slug]` — view a single section with body rendered from Tiptap JSON
- `/admin/manual/[slug]/edit` — edit title, hub slug, body (ContentEditor), related sections, sort order

**Help icon locations (9 total):**

| Page | manualSlug |
|---|---|
| `/account/hub/courses/courses` — Series list | `course-hub` |
| `/account/hub/courses/courses/[slug]` — Series editor | `course-hub-series` |
| `/account/hub/courses/lessons/[slug]` — Lesson editor | `course-hub-lessons` |
| `/account/courses` — My Courses | `member-courses` |
| `/courses` — Browse courses | `member-courses` |
| `/account/hub/host-team` — Host hub announcements | `host-hub` |
| `/account/hub/registrar/programs` — Programs list | `registrar-hub` |
| `/account/hub/support/inbox` — Support inbox | `support-inbox` |
| `/admin/members/[id]` — Member detail | `member-registry` |

**Seeded sections:**
- `registration-management` — Registration Management (order 20)
- `programs-editor` — Programs — Creating and Managing (order 21)
- `member-registry` — Member Accounts (order 30)
- `volunteer-roles` — Volunteer Roles (order 40)
- `course-hub` — Course Hub (order 10)
- `course-hub-series` — Managing Series (order 11)
- `course-hub-lessons` — Creating and Editing Lessons (order 12)
- `member-courses` — Courses — Member Experience (order 13)
- `teacher-profiles` — Teacher Profiles (order 14)

**Key files:**
- `prisma/schema.prisma` — `ManualSection` model (`manual_sections` table)
- `app/api/admin/manual/route.ts` — GET (list) / POST (create); ADMIN only
- `app/api/admin/manual/[slug]/route.ts` — GET (one) / PATCH (update); ADMIN only; no DELETE
- `app/admin/manual/page.tsx` — admin list page (replaces old hardcoded manual)
- `app/admin/manual/[slug]/page.tsx` — section detail view
- `app/admin/manual/[slug]/edit/page.tsx` — section editor (server page wrapping ManualSectionEditor)
- `components/ManualSectionEditor.tsx` — client component; ContentEditor for body
- `components/ManualHelpIcon.tsx` — client component; `?` link with `mh-` CSS prefix
- `prisma/seed-manual.ts` — seeds 4 core manual sections from old hardcoded content
- `prisma/seed-courses-manual.ts` — seeds 5 courses-system sections

**🔧 Technical notes:**
- `ManualSection.body` is `Json?` (Tiptap JSON); rendered with `renderContentBody()` from `lib/renderRichContent`
- **rawHtml legacy format:** Sections migrated from `ManualContent.tsx` via `prisma/seed-manual-chapters.ts` are stored as `{ type: "rawHtml", html: "..." }`. `renderContentBody()` handles this for display. `ManualSectionEditor` converts rawHtml → Tiptap JSON via `generateJSON()` (`@tiptap/core`) on mount, so the first save converts the body to proper Tiptap JSON.
- `ManualSection.relations` is `String[]` — slugs of related sections; rendered as pill links at the bottom of detail pages
- `ManualHelpIcon` is `"use client"` — it's just an anchor link, no server data needed
- The old `/admin/manual/page.tsx` was a huge hardcoded JSX file (~1200 lines); the new page is a client component that fetching from `/api/admin/manual`
- Seed scripts use `POSTGRES_URL_NON_POOLING` (direct connection) since `POSTGRES_PRISMA_URL` has PgBouncer and isn't in `.env.local`

**Closing ritual note — required after every session that changes features:**
1. Update `FEATURES.md` — add session entry, update relevant feature sections
2. Update `RIM_Stack_Reference.md` — update stack, routes, or env vars if changed
3. Update `RIM_System_Architecture.md` — if hubs, roles, or member data architecture changed
4. **Upsert ManualSection DB records** — for anything built, changed, or removed. Touch only affected section(s). Use upsert on slug. Write for the person doing the work, not the developer. `prisma/seed-manual-chapters.ts` can be re-run for large rewrites; individual sections can be edited at `/admin/manual/[slug]/edit`.

*Updated: 2026-03-18 (session 63)*

---

---

## 33. Editor System — RimTiptapEditor (current) · BlockNote era (legacy)

> **Current state (session 97, 2026-04-28):** Every editor surface in the platform runs on `RimTiptapEditor` (Tiptap-based, three variants: `minimal` / `message` / `document`). Storage is plain HTML strings produced by `editor.getHTML()`. Selection bubble menu is the primary formatting surface; top toolbar (where present) is for insertion-only actions. The four authoring types defined in `RIM_Editor_Types.md` are unchanged — they describe what content IS, not what library produces it.
>
> **Legacy editors (deleted session 97):** `RimBlockEditor` (BlockNote, document) and `RimProseEditor` (BlockNote, message). The migration ran across sessions 96 (Phase 1: build the new editor in Editor Lab) and 97 (Phase 2: renderer plumbing + Hub message surfaces; Phase 3: document-variant surfaces; Phase 4: every remaining prose surface; cleanup commit deletes the old editors and removes `@blocknote/*` deps from `package.json`).
>
> **Format detection at the renderer boundary** keeps unmigrated rows displaying correctly: `lib/renderRichContent.ts` and `lib/renderRichContentServer.ts` route content by shape — HTML strings (new), BlockNote JSON arrays (legacy), `{type: "rawHtml"}` objects (very old), `{type: "doc"}` Tiptap doc JSON (very old). The BlockNote-JSON walker stays as a safety net.
>
> **Lazy migration on edit:** Phase 2 ran upfront row migrations (`prisma/migrate.mjs`: `convert_hub_content_to_html`, `convert_conversation_body_to_html`). Phases 3 and 4 use lazy migration — when the user opens an editor, the legacy JSON is converted to HTML via `renderBlockNoteHtml()`; the row is rewritten as HTML on save. Never-edited rows stay BlockNote forever.
>
> The remainder of this section is historical context from the BlockNote era. Useful for understanding legacy content shape, but **do not use it as guidance for new work.** New editor work goes through `RimTiptapEditor` and the patterns in `RIM_Editor_Types.md`.

---

### Historical: BlockNote Editor System (sessions 69–95)

**What it was:** Complete migration from Tiptap to BlockNote as the editor foundation, completed in session 69. All `Json?` rich-text fields in the database stored BlockNote JSON. Tiptap had been fully removed from the codebase.

**Migration scope:** 18 fields across 14 database tables converted. Migration script: `prisma/migrate-to-blocknote.ts`. All 54 existing records were converted successfully (confirmed dry-run post-migration).

**Deleted in session 69:**
- `components/ContentEditor.tsx`
- `components/FormattedEditor.tsx`
- `lib/tiptap-extensions.ts`

**Renamed in session 70:**
- `components/RimEditor.tsx` → `components/MarkdownEditor.tsx` (email templates only; Tiptap/markdown; docblock updated to clarify purpose)

**Render architecture:**
- `lib/renderRichContent.ts` — client-safe, synchronous. `renderBlockNoteHtml()` walks BlockNote JSON to HTML without JSDOM. Also handles legacy rawHtml format.
- `lib/renderRichContentServer.ts` — server-only (`import "server-only"`). Async functions using `@blocknote/server-util` for accurate HTML including custom blocks. Dynamically imports server-util to prevent JSDOM from entering client bundles.
- Client components that display rich text receive pre-rendered `bodyHtml` strings from their server component parents — they do not call render functions directly.

**Hub Documents upgrade (also session 69):** `HubDocument` model gained `body Json?`, `isNative Boolean`, and `url String?` (nullable). Native documents are created/edited within the platform using `RimBlockEditor` and exported as Markdown. See §34.

**RimBlockEditor enhancements (sessions 71):**
- **Bear-inspired toolbar:** Selection toolbar (`FormattingToolbarController`) with B/I/U/Link/Align + ⋯ more menu. Empty-line pill with heading/list dropdowns, formatting, table/image insert.
- **Image support:** Upload via pill button and drag-and-drop. `uploadFile` callback on `useCreateBlockNote`. Image alignment overlay (L/C/R) via DOM injection into `.bn-visual-media-wrapper`. Any authenticated user can upload (not just ADMIN/TEACHER).
- **Advanced tables:** `tables: { splitCells, cellBackgroundColor, cellTextColor, headers }`. Table delete button (× at top-left on hover via `TableDeleteOverlay`). Explicit 3×3 `tableContent` structure for reliable insertion.
- **Heading hierarchy:** Matches design-system tokens — H1: `var(--text-h1)` = 38px, H2: `var(--text-h2)` = 28px, H3: `var(--text-h3)` = 24px, H4: `var(--text-h4)` = 20px. (Previously hardcoded at 32/24/20/17 from session 71; realigned to tokens in session 90.) Injected via `<style>` tag on mount (BlockNote's component CSS loads after static CSS; `data-level` attribute only set by disabled SideMenu — must target actual `<h1>`/`<h2>`/`<h3>`/`<h4>` tags plus `.bn-inline-content` descendants to beat BlockNote's em-based sizing). Style tag uses find-or-create-and-overwrite on mount so rules refresh across SPA navigations.
- **Block type selector:** `ToolbarBlockTypeSelect` dropdown (¶/H1/H2/H3/bullet/numbered/quote) in selection toolbar. `ToolbarMoreMenu` for extended block types and insert actions.
- **Document locking:** Author can lock doc (`HubDocument.isLocked`), ADMIN override. Author attribution banner. Concurrent editing presence (heartbeat POST every 30s, stale after 60s).
- **Blob cleanup:** `lib/blobCleanup.ts` — `extractBlobUrls()`, `cleanupRemovedBlobs()`, `cleanupAllBlobs()`. Fire-and-forget on document PATCH/DELETE.
- **Editor-to-view parity:** Injected styles match editor appearance to published `doc-body` view for all elements (headings, lists, blockquotes, links, tables, bold).

**Render improvements (session 71):**
- `renderBlockNodes()` groups consecutive list items into `<ul>`/`<ol>` wrappers (was outputting bare `<li>` elements).
- Image rendering: `<figure>` with alignment, previewWidth, caption support.
- Table rendering: `<thead>`/`<tbody>`, headerRows, colspan/rowspan, cell background/text colors.
- BlockNote color token resolution: named tokens ("red", "blue") mapped to actual CSS values via `BN_TEXT_COLORS`/`BN_BG_COLORS` lookup maps matching BlockNote's default palette. Without this, `"red"` background renders as CSS red (#FF0000) instead of BlockNote's soft pink (#fbe4e4).

**🔧 Technical notes:**
- `@blocknote/server-util` must always be dynamically imported. Static import causes JSDOM to be evaluated at Turbopack build time, crashing `createContext`.
- `renderRichContentServer.ts` retains a Tiptap fallback (`generateHTML` from `@tiptap/html`) for any records that might not have been migrated. This can be removed once the production database is confirmed fully converted.
- The migration script is idempotent — safe to re-run. It skips records that are already BlockNote JSON or null.
- `data-level` attribute is only set by BlockNote's `SideMenu` component (`sideMenu={false}` disables it). All heading CSS must target actual `<h1>`/`<h2>`/`<h3>` tags, not `[data-level]`.
- `@blocknote/core/style.css` is NOT imported — only `@blocknote/mantine/style.css`. Core heading rules (`font-size: var(--level)`) are unused; our injected `<style>` tag handles all heading sizing.
- Leading empty paragraphs in saved content are stripped on load via `cleanedContent` memo.

*Added: 2026-03-19 (session 69). Updated: 2026-03-21 (session 71), 2026-04-17 (session 87)*

**Session 87 additions — FormatPill, Element Registry, scope modifiers, five dharma elements:**
- **FormatPill + Element Registry:** `lib/editorRegistry.ts` is the single source of truth for every insertable or convertible block. One floating pill replaces per-surface chrome; the pill's `+` menu, the slash menu, and the block-handle "Turn into" all read the registry. Adding a new element is one entry that lists every context it belongs to.
- **Scope modifier system:** every rendered-output wrapper now carries three classes — `rim-content`, `rim-content--{scope}`, and its context class. The scope modifier (`--document`, `--lesson`, `--program`) lets shared `.rim-el-*` element styles produce different treatments per tier without duplicating class trees. See `RIM_Editor_Types.md` → "WYSIWYG Parity Contract" for the three-class wrapper.
- **Callouts reduced to Note + Decision:** picker exposes only the two kept variants. Legacy variants (`info`, `warning`, `practice`, `reflection`-as-variant) still deserialize for archived content.
- **Five distinct editorial elements (dharma group):** `pullQuote`, `verseQuote`, `practiceSuggestion` (container), `reflection` (container), `callout` (container). All scoped to `[lesson, program-description]`. The three container blocks use `content: "none"` + `children` for block-level body.
- **Defensive container-body seeding:** `RimBlockEditor` runs `migrateLegacyContainers` on load — strips stray `content` fields from `"none"` blocks, migrates legacy inline content into a paragraph child, and seeds an empty `{ type: "paragraph" }` child onto any container with no children. Without this, BlockNote emits no `blockGroup` sibling and the container renders as uneditable chrome.
- Key files: `lib/editorRegistry.ts`, `lib/blockNoteCustomBlocks.tsx`, `components/editor/FormatPill.tsx`, `components/RimBlockEditor.tsx`, `lib/renderRichContent.ts`, `public/css/custom.css` (lines ~20800–21500 cover `bn-*` editor view and `rim-el-*` rendered output).

**Session 90 additions — Aside block, menu unification, typography alignment, trailing-line collapse:**
- **Aside block:** callout variant `aside`. Pure-structural shaded container — no chrome in `render()`, no per-instance props. Authors put a heading child (H2/H3/H4) for an optional title; body is normal children. Shading applied via CSS `:has(> .bn-block-content > .bn-callout--aside)` on the ancestor `.bn-block`, same specificity as the generic callout rule. Color is determined by render context (`rim-content--document` → gray; future `--lesson` / `--program` overrides in their own scope CSS). No backward-compat migration needed — block is freshly introduced in session 90. Entry in `lib/editorRegistry.ts` marks it `availableIn: DOCUMENT_LIKE`.
- **Menu unification:** both pill ⋯ menu (in `ToolbarMoreMenu` and `PillContextMenu`) and slash `/` menu now read from `insertElementsForContext(registryContext)` — single source of truth is finally wired. New shared helper `insertElementAtCursor(editor, element)` in `RimBlockEditor.tsx` drives all inserts with smart behavior: replaces empty lines (so no stranded empty paragraph above the new block); seeds container blocks with a starter paragraph child; moves cursor into the container's first child on insert. Slash menu uses BlockNote's `SuggestionMenuController` with `filterSuggestionItems` from `@blocknote/core/extensions`. Custom items grouped by `GROUP_LABELS` — Text / Lists / Structure / Media / Callouts / Dharma. Uppercase eyebrow section labels (`var(--text-xxs)` / `font-weight: 600` / `var(--rim-text-muted)`) with `border-top` dividers between sections — identical styling across slash and pill.
- **Typography alignment:** `--font-doc` redefined from `'Inter'` to `'Open Sans'` — the editor now matches the rest of the site's sans-serif face. Editor heading sizes realigned to design-system tokens (`var(--text-h1)` = 38, etc.) instead of previous hardcoded 32/24/20/17. Editor body aligned to `var(--text-body)` = 18px. First-heading top margin zeroed so document's first line sits flush and container's first block has no gap. Aside children explicitly forced to `var(--text-body)` to beat BlockNote's default nested-block shrinking.
- **Smart trailing-empty-line collapse:** BlockNote always appends a trailing empty paragraph so users can type after the last block. Visually breaks the "finished" look when the last real block is a design element. CSS `:has()` rule collapses that paragraph to zero height when the previous block is a container (callout / image / table / practiceSuggestion / reflection). Paragraph still exists in DOM (cursor can still land there); editor gained 32px `padding-bottom` for click zone. Rendered output unaffected — `renderBlockNoteHtml` already filters empty paragraphs.

---

## 34. Hub Documents — Native

**What it is:** Native document creation within hub workspaces. Coordinators can create, edit, view, and export full-featured documents inside any hub — no Google Drive link required.

**Where it lives:** `/account/hub/[slug]/documents/` — existing documents tab, extended.

**New routes:**
- `/account/hub/[slug]/documents/new` — create a new native document
- `/account/hub/[slug]/documents/[id]` — view a document (rendered, styled like the manual)
- `/account/hub/[slug]/documents/[id]/edit` — edit a document in `RimBlockEditor`
- `/api/hub/[slug]/documents/[id]/export` — download as Markdown (server-side `blocksToMarkdownLossy`)

**New components:**
- `components/HubDocumentEditor.tsx` — title input + category selector + `RimBlockEditor` + save/delete + lock toggle + presence warning + author attribution banner

**Schema changes (sessions 69, 71):**
```prisma
model HubDocument {
  url         String?   // nullable — native docs have no URL
  body        Json?     // BlockNote JSON
  isNative    Boolean   @default(false)
  isLocked    Boolean   @default(false)
  editingById String?   // presence tracking
  editingAt   DateTime? // presence timestamp
  addedById   String    // author attribution
  updatedAt   DateTime  @updatedAt
}
```

**Documents tab UI:** Split toolbar — "New Document" (creates native doc) and "Add Link" (existing external URL flow). Native docs link to the view page; link docs open external URL. 🔒 icon on locked docs. Edit button shows "View" for locked docs when not author.

**Document view page:** Renders body via `renderContentBodyAsync` inside `man-layout-single` CSS — same reading experience as the staff manual. Includes a "Download as Markdown" link.

**Document locking (session 71):** Author can lock a document to prevent edits from other hub members. ADMIN can always override. Lock toggle via `POST /api/hub/[slug]/documents/[id]/lock`. PATCH route returns 403 for non-author on locked docs (unless ADMIN).

**Presence tracking (session 71):** Heartbeat every 30s via `POST /api/hub/[slug]/documents/[id]/presence`. Stale after 60s. `GET` checks who's editing. `DELETE` clears on unmount. If someone is actively editing, a warning banner appears with "Continue anyway" dismiss.

**Author attribution:** Non-authors see a muted info banner: "This document was created by [name]." CSS: `doc-banner--info`, `doc-banner--warning`.

**Blob cleanup (session 71):** When images are removed from a document, their Vercel Blob files are auto-deleted. `lib/blobCleanup.ts` — `cleanupRemovedBlobs(oldBody, newBody)` on PATCH, `cleanupAllBlobs(body)` on DELETE. Fire-and-forget, best-effort.

**Permissions:** Coordinator-only for create/edit/delete. All hub members can view. Author or ADMIN can lock/unlock.

**CSS prefix:** `hdoc-` — `hdoc-editor` and `hdoc-view` blocks in `custom.css`.

**API routes (session 71):**
- `POST /api/hub/[slug]/documents/[id]/lock` — toggle lock (author or ADMIN)
- `POST|GET|DELETE /api/hub/[slug]/documents/[id]/presence` — editing presence heartbeat

**🔧 Technical notes:**
- Markdown export uses `ServerBlockNoteEditor.blocksToMarkdownLossy()` — server-side only, dynamically imported
- The `HubDocumentFileType` enum still uses `DOC`, `SHEET`, `SLIDE`, `FORM`, `LINK` — native documents use `DOC` with `isNative: true`
- `updatedAt` was added to `HubDocument` in this migration alongside the other fields
- Upload permissions opened to all authenticated users (not just ADMIN/TEACHER/SUPPORT) — non-privileged users limited to `image/*, audio/*, application/pdf`

*Added: 2026-03-19 (session 69). Updated: 2026-03-21 (session 71)*

---

*Last updated: 2026-04-15 (session 84–85)*

---

## 41. "This Week at RIM" — Weekly Schedule Page

**What it does:** A public page at `/this-week` that shows all programs happening each week, grouped Monday through Sunday, dynamically generated from the program database. Includes a "Next Week" toggle and a "subject to change" footer. Serves as the digital equivalent of the weekly email newsletter schedule.

**Audience:** Public (no auth required). Linked from the Programs dropdown in the site nav.

### Routes
- `/this-week` — current week's schedule
- `/this-week?week=next` — next week's schedule

### Data and logic
- Queries all active (`archivedAt = null`), visible (`hideFromProgramPageList = false`) programs from Postgres
- Determines which programs run on each day using `isOccurrenceOnDate()` from `lib/scheduleUtils.ts` — handles weekly/daily/bi-weekly/monthly/one-time recurrence
- Groups programs Monday–Sunday; skips days with no programs
- Within each day, sorts by `startDatetime`
- Week anchor: Monday of current CT week. `?week=next` offsets +7 days.

### Schedule line format
Each card shows: `timeText` (if set) OR `formatTimeRange(startDatetime, endDatetime)` + " | " + format label ("Zoom Only" / "In-Person & Zoom" / "In-Person") + " · category name"

No day label on each row — programs are already grouped by day.

### Visual design
- Hero: `tw-hero rim-section` — teal (`--rim-blue`) with bodhi-leaves background + semi-transparent overlay. 52px Quincy CF title (same as programs list page). Date range in Quincy CF `--text-h3`. "This Week / Next Week" toggle pill buttons.
- Schedule: `rim-section--grey` with `rim-container`. Day headings: `pl-cat__heading` (Quincy CF `--text-h2` 28px). Program cards: `lr-row` with `lr-info`, `lr-name`, `lr-schedule`, and `lr-btn` "Learn More" pill — identical to `/community-programs` cards.

**CSS prefixes:** `tw-` for hero elements only. Cards reuse `lr-` and `pl-` from programs list.

**Key files:**
- `app/this-week/page.tsx` — server component
- `lib/scheduleUtils.ts` — shared `isOccurrenceOnDate()` (also used by `/tools/schedule`)
- `lib/dateLabel.ts` — `formatTimeRange()` exported here
- `public/css/custom.css` — `tw-hero`, `tw-hero__title`, `tw-hero__subtitle`, `tw-hero__range`, `tw-hero__nav`, `tw-nav-btn`, `tw-footer`, `tw-empty`, `tw-cat-tag`

**Connects to:**
- `/community-programs` — shares `lr-row` card styles; any ListRow CSS change affects both
- `/tools/schedule` — shares `lib/scheduleUtils.ts`; any `isOccurrenceOnDate()` change affects both
- Programs database — quality of schedule display depends on `dateText`/`timeText` being populated (backlog: `2026-04-15-001`)
- Nav Programs dropdown — "This Week's Schedule" entry links here

*Added: 2026-04-15 (session 84–85)*

---

## 32. Admin Member Profile — Section Registry

**What it does:** The admin member profile page (`/admin/members/[id]`) uses a declarative section registry to control which sections are visible, to whom, and under what conditions. The pattern replaced the previous monolithic `MemberDetail.tsx` in session 68.

**Where it lives:** `lib/memberSectionRegistry.tsx`

**Section components:** `components/member-sections/`
- `CoreRecordSection` — Identity, Contact, Status, Tags; one save bar
- `AdminNotesSection` — Tiptap rich-text notes; independent save
- `RolesSection` — Role checkboxes; independent save; role assignment email side effect lives in the API route
- `TeacherSection` — `isTeacher` toggle + TeacherProfile fields; saves to `/teacher-profile` endpoint
- `RegistrationHistorySection` — read-only
- `DangerZoneSection` — delete flow; only rendered when member has no registrations

**Existing components used as-is via registry:**
- `HouseholdSection`
- `HubAccessSection`
- `CourseAccessSection` (registry render function provides the `<section>` wrapper)

**Key types (all exported from `lib/memberSectionRegistry.tsx`):**
- `SerializedMember` — canonical type for member data on the profile page
- `ViewerPermissions` — `{ roles, sectionGrants }` computed server-side in `page.tsx`
- `MemberSection` — `{ id, allowedRoles, condition?, render }`

**sectionGrants:** A `String[]` field on `User`. Grants the viewing user access to specific section IDs when viewing other member profiles, independent of team roles. Managed via Neon console until an admin UI is built.

**🔧 Technical notes:**
- `page.tsx` fetches `viewer.sectionGrants` from the DB using the session user's ID; builds `ViewerPermissions` and passes it to `MemberDetail`
- `MemberDetail.tsx` is now ~60 lines: header, archived banner, and a `MEMBER_SECTIONS.map()` with `canViewSection()` check
- The `isAdmin` prop was removed; all permission checks derive from `ViewerPermissions`
- `isTeacher` was moved out of the main PATCH endpoint — it now lives exclusively in `PATCH /api/admin/members/[id]/teacher-profile`
- To add a new section: (1) create a component in `components/member-sections/`, (2) add one entry to `MEMBER_SECTIONS` in the registry. Nothing else changes.

*Updated: 2026-03-19 (session 69)*

**2026-03-21 (session 71)** — RimBlockEditor full feature build + rendering fixes. **(1) Bear-inspired toolbar:** Selection toolbar with B/I/U/Link/Align/⋯ more menu; empty-line pill with heading/list dropdowns, table/image insert. **(2) Image support:** Upload via pill + drag-and-drop; alignment overlay (L/C/R) via DOM injection; upload opened to all authenticated users (not just ADMIN/TEACHER). **(3) Advanced tables:** splitCells, cellBackgroundColor, cellTextColor, headers; table delete × at top-left on hover; explicit 3×3 tableContent for reliable insertion. **(4) Heading hierarchy:** H1: 32px, H2: 24px, H3: 20px via injected `<style>` tag (discovered `data-level` only set by disabled SideMenu — must target `<h1>`/`<h2>`/`<h3>` tags directly). **(5) Block type selector:** ToolbarBlockTypeSelect dropdown in selection toolbar. **(6) Document locking:** Author lock + ADMIN override + presence heartbeat (30s POST, stale 60s) + author attribution banner. **(7) Blob cleanup:** `lib/blobCleanup.ts` auto-deletes orphaned Vercel Blob files. **(8) Render fixes:** List grouping (`<ul>`/`<ol>` wrappers), image rendering (`<figure>`), table `<thead>`/`<tbody>`, BlockNote color token resolution (named tokens mapped to actual hex values). **(9) Editor-view parity:** Injected styles match editor to published doc-body for all elements. Schema: HubDocument gained `isLocked`, `editingById`, `editingAt`, `addedById`. New API routes: `/lock`, `/presence`. Key files: `components/RimBlockEditor.tsx`, `components/HubDocumentEditor.tsx`, `lib/renderRichContent.ts`, `lib/blobCleanup.ts`.

**2026-03-23 (session 73)** — Tools route group + application extraction. **(1) Hub schema additions:** `HubStatus` enum (ACTIVE/ARCHIVED), `status`, `welcomeHeadline`, `welcomeBody`, `homeContent` fields on Hub. `HubAppLink` model (label, href, order, isEnabled). `firstVisitedAt` on HubMember. `TaskList`, `Task`, `Subtask` models with `TaskStatus` enum. **(2) Tools layout:** New `/tools/` route group with shared `ToolsNav` + `ToolsContext` (React context for tool name, back link, sub-nav). Site Nav returns null for `/tools/*`; FooterWrapper suppresses footer. Three per-tool layouts with role gates: programs (REGISTRAR/ADMIN), inbox (SUPPORT/ADMIN), schedule (HOST/HOST_MANAGER/ADMIN). Each resolves hub membership for back link. **(3) Program Manager extracted:** Full registrar program management moved from `/account/hub/[slug]/programs/*` to `/tools/programs/*` (list, new, detail, edit). `ProgramEditor` + `ProgramsTableClient` updated with `basePath` prop. Hub programs page converted to stakeholder-only read-only view (Option A) with "Open Program Manager →" link. **(4) Support Inbox extracted:** Inbox + Settings moved from `/account/hub/[slug]/inbox` and `/settings` to `/tools/inbox` and `/tools/inbox/settings`. Internal links updated: `supportNotify.ts` → `/tools/inbox`, Gmail OAuth callback → `/tools/inbox/settings`, inbox "not connected" → `/tools/inbox/settings`. Inbox and Settings tabs removed from hub nav. **(5) Host Schedule extracted:** Five pages moved from hub schedule/session to `/tools/schedule/*`. `SessionLiveClient` updated with `basePath` prop. 13 external references updated across 8 files (API alert linkUrls, cron notification links, email template links). Schedule and Session tabs removed from hub nav. ToolsNav sub-navigation added (Schedule, Live Session, Journal) with pill-style active state. **(6) Hub nav cleanup:** Hub layout tabs simplified — removed Inbox, Settings, Schedule, Session conditionals. `isSupportHub` and `canSeeSessionTab` variables cleaned up. **(7) Seed updates:** App links seeded for all three hubs (Host Schedule, Program Manager, Support Inbox + Settings). Key files: `app/tools/layout.tsx`, `components/ToolsNav.tsx`, `components/ToolsContext.tsx`, all files under `app/tools/programs/`, `app/tools/inbox/`, `app/tools/schedule/`.

**2026-03-23 (session 72)** — Hub notification redesign: merge announcements into pinned conversations, unread indicators, site banner. **(1) Announcements → Pinned Threads:** `isPinned Boolean` + `pinnedAt DateTime?` added to `HubConversationThread`. Announcements tab removed from all hubs; hub root redirects to `/conversations`. `HubConvClient` renders pinned section with ‼️ badge; coordinators can pin/unpin from thread list and detail. `HubAnnouncementsClient.tsx` deleted. Announcement API routes deleted (3 files). Migration script: `prisma/migrate-announcements.ts`. **(2) Dashboard Hub Card Unread Indicators:** Dashboard computes `unreadCount` per hub (threads created/replied since `lastVisitedAt` + unread Alerts for host-team). Teal badge on hub cards (1–9 or "9+"). ADMIN skips badges. **(3) AlertStrip Removed:** `AlertStrip.tsx` deleted, ~110 lines of `alert-strip` CSS removed. Alert model stays for host-team unread count. **(4) Site-Wide Banner:** `SiteBanner` + `SiteBannerDismissal` models. ADMIN posts via `/admin/banner` (RimProseEditor compact). Members see banner on dashboard with ✕ dismiss. One banner at a time. APIs: `/api/admin/site-banner` (CRUD), `/api/site-banner/dismiss`. `SiteBannerStrip.tsx` client component. Banner link added to admin sidebar. **(5) SiteBanner.body:** Changed from `String` to `Json?` (BlockNote JSON) — editor standard enforced, no plain textarea. Key files: `prisma/schema.prisma`, `components/HubConvClient.tsx`, `components/HubConvThreadClient.tsx`, `components/SiteBannerStrip.tsx`, `app/account/dashboard/page.tsx`, `app/admin/banner/page.tsx`, `app/api/admin/site-banner/route.ts`, `app/api/site-banner/dismiss/route.ts`. Commits: `ffeef25` + follow-up editor migration. **(6) Cleanup (session 72 cont.):** Purged test data from conversation/announcement tables. Removed `HubAnnouncement` model, `AnnouncementPriority`/`AnnouncementStatus` enums, `sourceAnnouncementId` from schema. Deleted `prisma/migrate-announcements.ts`. Cleaned announcement references from conversations POST route. Fixed compact `RimProseEditor` crash: custom `BlockTypeToggle` components inside `FormattingToolbar` caused client-side exceptions (same pattern as commit `59a02ae`); replaced with BlockNote built-in `BlockTypeSelect`. **(7) Editor architecture discussion:** Mapped all 24 editor usage sites (4 RimBlockEditor + 20 RimProseEditor). Confirmed inheritance model: one schema (`rimBlockSchema`), two toolbar configs, one renderer. `RimBlockEditor` = writing tool (Bear pill, images, tables, Dharma blocks); `RimProseEditor` = compose field (selection toolbar, compact variant). `variant="compact"` now on 12 usage sites. Checklist block type (`checkListItem`) already in schema+renderer, confirmed available in both editors. Commit: `1404fe8`.

**2026-03-16 (session 58, continued)** — Session tab: finished remaining gaps from the UX redesign brief. (1) meetHostAccount display: Added to States 2 and 3 — shows the Google Meet room account labeled "Room account" in State 2, quiet text below the join button in State 3. (2) State 5 inline form: PostSessionClient now renders inline in State 5 instead of linking to a separate page. Co-host vs primary host routing handled via isCoHost prop derived from SessionProgram flags. (3) End Session stays on page: endSession callback now calls router.refresh() instead of router.push — user stays on the session tab and State 5 appears with the inline form. (4) Coordinator section: Coordinator/Admin users see a muted section below the host cards with missing report indicators and team journal link. Key files: components/SessionLiveClient.tsx, components/PostSessionClient.tsx, app/account/hub/[slug]/session/page.tsx.

**2026-03-24 (session 75)** — Hub/tools integrity pass: hub awareness, notification fix, ToolsNav fix, UI cleanup, system cleanup. **(1) Hub awareness wiring:** Created `getToolHubContext()` in `lib/toolAuth.ts` — tools read `?hub=` from server-side `searchParams` and resolve the full hub record with members. Host Schedule (3 pages) and Support Inbox (2 pages) updated to use dynamic hub context instead of hardcoded slug queries. Falls back to primary hub when no param. **(2) ToolsNav context fix:** Discovered ToolsNav was rendered OUTSIDE ToolsProvider in the outer tools layout — `useToolsContext()` always returned defaults (backLabel: "Dashboard", no subNav). Moved ToolsNav into each tool's per-layout ToolsProvider wrapper. All four tools now show correct back link, sub-nav pills, and tool name. **(3) Notification system fix:** All host-team alerts and emails now use `getHubNotificationRecipients()` (queries hub members) instead of hardcoded role checks. Sub requests, claims, unclaims, and unassigned session cron all updated. `UserToolAccess` grant holders can use the tool but don't receive team notifications unless they're hub members. **(4) ToolsNav layout swap:** Back link moved to left (where users expect navigation), tool name moved to right (muted, secondary). **(5) ManualHelpIcon fix:** Changed from `position: absolute` (colliding with action buttons) to `display: inline-flex` next to page titles. Fixed duplicate `display` property. Removed from sub-pages (editor views). **(6) Hub naming standardization:** Hubs renamed: Course Hub, Hosting Hub, Registration Hub, Support Hub (consistent "X Hub" pattern). Updated DB, seed script, `HubAccessSection`. **(7) System cleanup:** Removed 12 unused hubs (people-team, greeter, av-team, etc.), 11 unused roles (GREETER, AV_TECH, etc.), 4 admin dev pages (roadmap, sitemap, features, ideas), orphaned CSS for deleted AlertStrip. **(8) Course Manager extraction:** `/tools/learning` with Course Manager tool — Series + Lessons sub-nav tabs. `UserToolAccess` model + `hasToolAccess()` shared helper. All tool layouts standardized. **(9) Tool registry:** `lib/toolRegistry.ts` — centralized tool definitions. Hub admin form uses tool picker dropdown instead of free-text URL entry. `toolSlug` column on `HubAppLink`. **(10) Prisma migration fix:** Replaced `prisma migrate deploy` (fails on existing DBs without baseline) with `prisma/migrate.mjs` — idempotent migration runner via `$executeRawUnsafe`. Key files: `lib/toolAuth.ts`, `components/ToolsNav.tsx`, all `app/tools/*/layout.tsx`, `app/api/host/*/route.ts`, `app/api/cron/check-unassigned-hosts/route.ts`, `lib/toolRegistry.ts`, `prisma/migrate.mjs`.

**2026-03-25 (session 76)** — Hub design unification, Host Schedule redesign, LiveKit Phase 1-4 (complete), session feature removal, emergency host step-in, high-fidelity audio. **(1) Hub design unification:** Shared hub headers with consistent spacing, dead CSS cleanup across all hub pages. **(2) Host Schedule redesign:** Replaced full grid calendar with mini-cal + card list as primary view. Cards expand inline for detail (no separate page navigation). Compact chips for assignment status. Unified color system across schedule states. Multi-select removed. Mini-cal status dots enlarged for visibility. **(3) List view rebuild:** Replaced 6-column grid table layout with card rows — better information density and mobile responsiveness. **(4) LiveKit Phase 1 (foundation):** LiveKit Cloud integration — `lib/livekit.ts` (server SDK, `createToken()` with roomAdmin grants for hosts), `app/api/livekit/token/route.ts` (JWT generation API), `components/VideoRoom.tsx` (full room component with `@livekit/components-react`), `app/admin/livekit-test/page.tsx` (admin test page). Ship tier ($50/month). Rooms created on-demand from program slug. **(5) LiveKit Phase 2 (dashboard embed):** `VideoRoomEmbed` replaces `MeetJoinButton` on member dashboard — embedded video with fullscreen toggle. No external links or separate accounts needed. **(6) Removed Live Session + Journal features:** ~5,000 lines removed (SessionLiveClient 6-state machine, PostSessionClient, coordinator history, team journal, attendance flag/join APIs, post-session API). Will rebuild attendance tracking using LiveKit's real-time participant data instead of the Google Meet attendance model. **(7) Google Meet authuser:** Added `authuser=` parameter to Google Meet URLs based on assigned room account email — auto-selects correct Google account for hosts. Transitional improvement before full LiveKit replacement. **(8) Dedicated session page:** `app/session/[slug]/page.tsx` — full-page video room (no nav, no footer, just the session). Header with program name, "← Leave" link, "End for All" button (host-only, red, with confirmation), and "Fullscreen" toggle. On disconnect (user or host-ended), shows "Session ended" screen with "Return to Dashboard" button. Replaced the inline `VideoRoomEmbed` on the dashboard — dashboard "Join" button now links to `/session/{slug}`. **(9) End-session API:** `POST /api/livekit/end-session` — uses `RoomServiceClient.deleteRoom()` to instantly disconnect all participants. Auth-gated: only assigned host (via HostAssignment), HOST_MANAGER, or ADMIN. Token API now returns `isHost` flag so session page knows whether to show host controls. **(10) LiveKit room migration:** `POST /api/admin/populate-livekit-rooms` — one-time migration route that sets `livekitRoom = slug` for all virtual/hybrid programs. Also accepts GET for easy browser access. 6 programs populated. **(11) Google Meet full removal:** `CreateMeetButton`, `MeetJoinButton`, `zoomLink`/`meetHostAccount` fields, Google Calendar/Meet API imports all removed. ~200 lines of dead Meet code cleaned up from ProgramEditor, dashboard, email templates. **(12) Attendance email cleanup:** Removed `sendFirstTimeAttendeeEmail`, `sendReturningAttendeeEmail`, and `ENABLE_ATTENDANCE_EMAILS` flag — attendance emails will be rebuilt around LiveKit's real-time participant data in a future session. **(13) Hub member notifications:** Added `sendHubMemberAddedEmail` — transactional email when a member is added to a hub (via coordinator or role sync). New email template `hub-member-added` seeded. Key files: `lib/livekit.ts`, `app/api/livekit/token/route.ts`, `app/api/livekit/end-session/route.ts`, `components/VideoRoom.tsx`, `app/session/[slug]/page.tsx`, `app/tools/schedule/page.tsx`, `public/css/custom.css`.

**2026-04-24 (session 95)** — Program Detail live in Webflow + doc sync + listing folder-slug fix. Jesse rebuilt the public Program Detail page directly in Webflow between sessions (page ID `69e985cd8cdb73f2540a9b47`); this session reconciled the docs and cleaned up naming on the related pages. **(1) Audit:** `curl`-and-grep on the published HTML produced the authoritative list of wired `data-rim-*` bindings — 20 attributes across 14 fields. Wired: `programImage` (bg), `category.name`, `name`, `tagline` (+ show), `pullQuote` (+ show) / `pullQuoteSource`, `descriptionHtml`, `programNotesHtml` (+ show), `scheduleLabel`, `timeLabel`, `locationLabel` (+ show), `danaText` (+ show), `ctaHtml` (+ show). **(2) Available but not yet placed:** `locationLink`, `formatLabel`, `teacherNames`, `specialAnnouncement` — data ships, Webflow page doesn't render them yet. **(3) Doc updates:** `RIM_Webflow_Fields.md` rewritten with accurate wired state, "available" section, full field inventory including `programNotesHtml`/`ctaHtml`/`registrationUrl`, and `data-rim-bg` added to vocabulary. UP_NEXT and session log updated. **(4) Ritual doc cleanup:** archived `RIM_Editor_Design.md` and `RIM_Architecture_Pivot.md` with banners, fixed read-order duplication between the Directive and CLAUDE.md. **(5) Folder-slug fix on the listing:** the Programs listing's Learn More links pointed to `/rim-next/program-detail` but Webflow was publishing the detail page at `/untitled/program-detail` because the containing folder slug was still Webflow's default. Jesse renamed the folder slug to `rim-next`; after republish the detail page publishes at `/rim-next/program-detail` and links resolve. Program Detail is now reachable at `https://www.rootedinmindfulness.org/rim-next/program-detail?slug=<slug>`. **(6) Cache lesson:** Browser + Cloudflare cache stale 404 responses stubbornly — hard refresh doesn't evict them because it only re-requests the current URL's resources. Fix is incognito or DevTools → Application → Clear site data. Unrelated to the session-94 `rim-connect.js` perf work (that caches API JSON, not HTML). **(7) MCP limit noted:** Webflow Navigator label renames (e.g. "Section" → "Programs Hero") are not exposed by any MCP tool — manual double-click in Designer only. Key files: `RIM_Webflow_Fields.md`, `UP_NEXT.md`, `session-log.md`, `RIM_Architecture_Directive.md`.

**2026-04-24 (session 94)** — Webflow architecture committed + rim-connect v3 performance tuning. **(1) Architecture:** The Webflow-primary pivot is now policy, not experiment. Public/member-facing pages are designed in Webflow; RIM Next is the backend + bridge. See `RIM_Architecture_Directive.md`. The Next.js `/programs/[slug]` page is no longer a visual target — it remains as a data preview until the Webflow version ships. **(2) API caching:** `/api/public/programs` and `/api/public/programs/[slug]` bumped to `s-maxage=300, stale-while-revalidate=86400`. Added explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` headers (Vercel's sanitization of browser `Cache-Control` was dropping the `s-maxage` directive; explicit CDN headers bypass that). Cached response times: ~115ms (was ~155ms). Cold misses: ~180ms (was ~415ms). **(3) `rim-connect.js` v3 hide-until-populated:** `[data-rim-page]` containers now start at `opacity: 0` with a 120ms fade-in. Script adds a `.rim-ready` class when `populateFields` completes, errors, or hits a 1500ms safety timeout. Eliminates the "flash of Webflow template placeholders" on detail pages. **(4) Webflow site-wide head code:** consolidated `<link rel="preconnect">` to `rim-next.vercel.app`, inline `<style>` for `[data-rim-page]` hide/reveal (applied at parse time so it doesn't race with script loading), and `rim-connect.js` script tag into Site Settings → Custom Code → Head Code. Page-level custom code for `data-rim-*` bindings is no longer required. Key files: `app/api/public/programs/route.ts`, `app/api/public/programs/[slug]/route.ts`, `public/rim-connect.js`.

**2026-04-12 (session 79)** — Open Access guest join + ProgramTeacher linked accounts. **(1) Open Access:** Virtual programs can be flagged as open access — generates a shareable guest link with a key. Non-members visit `/session/[slug]?key=xxx`, enter their name, and join the LiveKit room as a participant (no account required). Key can be reset to invalidate old links. `isOpenAccess Boolean` + `guestAccessKey String?` on Program model. Guest token API (`/api/livekit/guest-token`) validates key, mints participant-level JWT. Program Editor Schedule tab: Open Access fieldset with checkbox, dark code-style link display, Copy Link + Reset Link buttons. CSS: `pe-open-access-link`, `vs-guest-entry` (guest name form). **(2) ProgramTeacher linked accounts:** `ProgramTeacher` join table (programId, userId, order) replaces plain text `teacherFacilitators` for teacher-program linking. Teacher search selector in Program Editor Content tab (mirrors LessonEditor pattern). Teachers assigned via ProgramTeacher automatically get `roomAdmin: true` in LiveKit sessions — no separate HostAssignment needed. Public program page links teacher names to `/teachers/[slug]` profiles. Display falls back to plain text `teacherFacilitators` for unmigrated programs. REGISTRAR role added to `/api/members/search` access. **(3) Host controls cascade:** LiveKit token route now checks: ADMIN → HostAssignment → HOST_MANAGER → ProgramTeacher. Teacher and host volunteer can both be hosts simultaneously (roomAdmin is not exclusive). Teacher can host independently if host volunteer doesn't show. Key files: `app/api/livekit/guest-token/route.ts`, `app/api/livekit/token/route.ts`, `app/api/programs-pg/[slug]/guest-key/route.ts`, `app/session/[slug]/page.tsx`, `components/registrar/ProgramEditor.tsx`, `app/programs/[slug]/page.tsx`, `app/account/programs/[slug]/page.tsx`, `prisma/migrate.mjs`.

**2026-04-12 (session 78)** — Member Program Detail page, program content seed, category ordering, donate button. **(1) Member Program Detail page** (`/account/programs/[slug]`): Authenticated "inside the building" view for members. Shows: program name + status badge, quick info card (schedule, time, location, dana), Join Session button (LiveKit), pending dana callout, calendar links (Google + iCal), special announcement, early arrival message, facilitators, registration details with custom fields + cancel button. Access control: registration programs require active registration (redirects to public page if none), open programs allow any member. Dashboard and My Programs links updated to point here. CSS: `mpd-` prefix. **(2) Public program page CTA:** Registered members see "✓ You're registered. View your program details →" linking to member detail page. **(3) Program content seed:** 13 programs seeded with full BlockNote JSON descriptions written to RIM Writing Guide. 5 categories with sortOrder. Old programs hard-deleted via raw SQL (FK-safe: SubClaim→SubRequest→HostAssignment chain, session records, registrations, attendance). Preserves Sacred Clarity, Teacher Meeting, Private Teacher. **(4) Category sortOrder:** Added `sortOrder Int` to ProgramCategory schema. Community programs page sorts by sortOrder. Categories tab in ProgramEditor with ↑↓ reorder arrows + add new + delete (blocked if programs assigned). API: `PATCH /api/programs-pg/categories/reorder`, `POST/DELETE /api/programs-pg/categories`. **(5) Donate button:** Muted crimson (#c23b3b) for non-profit visibility. **(6) Hero category label:** Changed from filled pill to subtle semi-transparent text — doesn't compete with title. **(7) Quote box centering:** -65px overlap ≈ half of one-line quote height. Centered at hero/body boundary, expands downward for longer quotes. Even spacing: 72px above category = 80px below tagline. Key files: `app/account/programs/[slug]/page.tsx`, `app/programs/[slug]/page.tsx`, `prisma/seed-programs.mjs`, `prisma/migrate.mjs`, `components/registrar/ProgramEditor.tsx`, `app/api/programs-pg/categories/route.ts`, `app/api/programs-pg/categories/reorder/route.ts`, `public/css/custom.css`.

**2026-04-11 (session 77)** — Program detail page redesign + site-wide color scheme return. **(1) Program detail page rebuilt to match Webflow template:** Hero with dynamic `programImage` background (falls back to Bodhi Leaves) + semi-transparent teal overlay `rgba(18,82,116,0.8)`. Quote card floats into hero with box-shadow. Sections reordered: hero → quote → description → special notes → details (with icon rows) → facilitators. **(2) Details section with icon rows:** Calendar, clock, location pin, heart SVG icons. Schedule and time are separate rows. `timeText` field added to Program model for manual time override. Virtual programs show "Online (Zoom) only". **(3) Context-aware CTA in details:** Last detail row adapts to session state and program type — registration programs show Register/Registered/Waitlisted/Closed; open programs show "Simply arrive" / "Access Zoom" / "Become a member" based on logged-in state and format. Bottom CTA card removed entirely. **(4) Site-wide color scheme return to original RIM:** Warm parchment (#f6f3f0) replaced with cool grey (#f5f5f5) across entire codebase — CSS variables, 54 email template instances, BlockNote editor theme, rich content renderer, all components with inline styles. **(5) Typography matched to Webflow:** `--font-serif` changed to quincy-cf. Hero title: 52px/500/-0.5px letter-spacing. Quote: quincy-cf 21px/500. Body: 18px/1.7. Content width: 700px. **(6) Nav updated:** Links 16px, brand name 20px/400, logo 45px, nav height 100px. **(7) Footer restored:** Background #135274 (original RIM teal), padding 100px/40px. **(8) Category pill restyled:** #fafafa filled background, #333 text, 11px/600 uppercase. **(9) Backlog created:** `data/backlog.json` with Member Program Detail Page (high) and Facilitator Profile Links (medium). Key files: `app/programs/[slug]/page.tsx`, `public/css/custom.css`, `lib/email.ts`, `lib/blockNoteTheme.ts`, `components/Nav.tsx`, `prisma/schema.prisma`, `prisma/migrate.mjs`, `data/backlog.json`.

**2026-03-24 (session 74)** — Hub sidebar redesign, task UI rebuild, hub context, and architecture documentation. **(1) Hub sidebar navigation:** Replaced horizontal `HubNavStrip` tab strip with 220px left sidebar (`HubSidebar.tsx`). Four sections: Identity (type, name, member count, coordinator), Core nav (Home, Conversations, Tasks, Documents, Members — teal active state), Tools (app links with ↗ arrow), Hub settings (coordinator/admin only). Sticky at `top: 90px; height: calc(100vh - 90px)` below site nav. Mobile: slide-in drawer via hamburger in sticky top bar. Deleted `HubHeader.tsx` and `HubNavStrip.tsx`. Hub layout simplified — `hub-shell` flex row replaces `hub-page` + tab strip. CSS prefix: `hub-sb-`, `hub-shell`, `hub-main`. **(2) Account sidebar suppression for hubs:** `AccountLayout` hides `AccountSidebar` when pathname starts with `/account/hub/` — hubs use their own sidebar. `ac-layout--no-sidebar` class applied. **(3) Task UI redesign:** Full rewrite of `HubTasksClient` — three-column desktop layout (rail 220px, task list 380px, detail panel flex). Rail: Views section (My Tasks, Due Soon with counts), Lists section (colored dots, counts, three-dot menus), Templates disclosure, "+ New list". Task list: section dividers (Open/Done), task rows with status pips, checkboxes, metadata (due date chips, subtask pills, assignee avatars). Detail panel: serif title, three-segment status control, four-column fields row, RimProseEditor body, subtasks with progress bar, activity log placeholder. Task cards on white backgrounds with 12px gaps and border-radius on warm hub background. Mobile: three-screen flow (lists → task list → detail) with floating FAB. CSS prefix: `hub-tasks-`. **(4) Hub context for tools:** `HubSidebar` appends `?hub={slug}` to all tool app links. `ToolsContext` reads param client-side via `useSearchParams()` (Suspense-wrapped), exposes `hubSlug` to tool pages via `useToolsContext().hubSlug`. Foundation for scoped data — tools can filter by launching hub. **(5) Hub Model documentation:** Created `RIM_Hub_Model.md` — the conceptual architecture document describing the two-layer model (hubs as team homes, tools as work applications), sidebar structure, tool navigation flow, access control separation (role vs membership), and scoped data pattern. Referenced from `RIM_System_Architecture.md`. Key files: `components/HubSidebar.tsx`, `components/HubTasksClient.tsx`, `components/ToolsContext.tsx`, `app/account/hub/[slug]/layout.tsx`, `RIM_Hub_Model.md`, `public/css/custom.css`.

**2026-04-27 (session 96)** — Alerts module removed, conversation categories editable, sub-request email fixes, Tiptap editor migration Phase 1. **(1) Alerts removed:** The `Alert` model and `AlertType` enum were deleted; the `/api/account/alerts` route and the `check-unassigned-hosts` cron deleted; every `db.alert.create / createMany / count` call stripped from sub-request POST, sub-request claim, host-assignment claim/unclaim/reassign, programs-pg POST, and `lib/supportNotify.ts`. Migration `remove_alerts_module` drops the `alerts` table + `AlertType` enum. The host-team unread badge on the dashboard is now `unreadThreads` only (was `unreadThreads + unreadAlerts`). The bell UI the model was built for never shipped, so this was pure cleanup with no user-facing loss. ~470 lines deleted. **(2) Editable conversation categories:** Any active hub member can add or rename a `Hub.conversationCategories` entry from the Conversations page; coordinators can also delete (deleting reassigns existing threads to `General` if it exists, otherwise the first remaining category). New route `app/api/hub/[slug]/categories/route.ts` (POST/PATCH/DELETE) with single-transaction cascade on rename/delete. Compose select gets `+ Add new category…`. A pencil chip in the filter row opens an inline manage panel. **(3) "What's new" panel removed from host hub home:** `HostHubHomeClient` is now welcome + "Our offerings this month" only — the recent-activity panel duplicated signal already on the Conversations and Documents pages. Loader, panel, type, and CSS all removed. **(4) Sub-request email fixes:** Two unrelated bugs converged in the sub-request notification flow. (a) `NEXTAUTH_URL` on Vercel had a trailing space, so `${BASE_URL}/tools/schedule` became `https://rim-next.vercel.app /tools/schedule` — the literal space truncated every markdown link in every email. Every `BASE_URL` constant in `lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release`, and `app/api/stripe/checkout` now does `.trim().replace(/\/$/, "")` so a future env-var typo can't break links again. (b) The fire-and-forget pattern `void (async () => {...})()` after `Response.json()` was being killed by Vercel's serverless function teardown — emails landed intermittently or not at all. Switched to `after()` from `next/server` (Next.js 16's official background-work API) in sub-request POST, sub-claim POST, and programs-pg POST. **(5) RimTiptapEditor — Phase 1 of editor migration:** New canonical editor at `components/rim-tiptap/RimTiptapEditor.tsx` based on Tiptap 3 (replaces the BlockNote-based `RimBlockEditor` + `RimProseEditor` in subsequent phases). One component, three variants — `minimal` (bold/italic/underline/link, selection bubble only), `message` (lists/quote, no headings/images/tables), `document` (full toolbar with three dropdowns: Heading levels, Callouts, Dharma blocks; plus image upload, table, divider). Five custom block extensions in `components/rim-tiptap/extensions/` — Callout (note + decision), PullQuote, VerseQuote, PracticeSuggestion, Reflection — all using Tiptap node extensions with shared `.rim-el-*` classes between editor and rendered HTML. **Storage paradigm: plain HTML strings**, not BlockNote JSON. Editor Lab (`/admin/editor-lab`) rewritten to demo all three variants with sample content, live render pane, and raw HTML pane. **Production untouched in Phase 1** — old `RimBlockEditor` and `RimProseEditor` still run on every existing surface; Phase 2 starts the migration of real surfaces and the one-time JSON→HTML conversion of existing rows. Key files: `components/rim-tiptap/RimTiptapEditor.tsx`, `components/rim-tiptap/extensions/*.ts`, `app/admin/editor-lab/page.tsx`, `public/css/custom.css` (`.rt-*` editor chrome, `.rim-el-*` block output). New deps: `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-highlight`, `@tiptap/extension-color`, `@tiptap/extension-text-style`, `@tiptap/extension-bubble-menu`, `@tiptap/extension-floating-menu`. Migration roadmap is in `UP_NEXT.md`.
