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
29. [Support Inbox](#29--support-inbox)
30. [Learning System — Planned](#30-learning-system--planned)

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
| Role | Access | Dashboard links |
|---|---|---|
| `ADMIN` | Everything — full site management | Registrations, Members, Staff Manual |
| `REGISTRAR` | Registration management, member profiles, course access, Program Editor | Registrations, Members, Staff Manual |
| `HOST` | Host Community Hub — schedule, sub board, conversations, session tracking | Host Hub |
| `HOST_MANAGER` | All HOST access + assignment management + unassigned alerts | Host Hub |
| `TEACHER` | Teacher Hub — manages courses and lessons in Postgres | Teacher Hub |

New roles are added only when there is real functionality to attach to them.

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

### 6a. Dashboard Hub (`/account/dashboard`)

The member home page. A single `720px` content column (`db2-wrap`), vertical sections in reading order:

1. **Greeting** — "Welcome back, [firstName]." + today's date in CT
2. **Alerts** — amber notification card (`AlertStrip`); only shown when unread alerts exist
3. **Today's Virtual Sessions** — live/later sessions with join button and auto-refresh
4. **Your Upcoming Programs** — next 5 active registrations with Sanity start dates
5. **My Account** — quick links to My Profile, My Registrations, Course Library
6. **Pending Dana** — shown only when `donationStatus: PENDING` registrations exist
7. **Your Hubs** — hub cards; ADMIN sees all hubs; others see only their `HubMember` records

**Today's Virtual Sessions:** `virtualDashboardProgramsQuery` fetches all virtual/hybrid programs with full recurrence fields. JS-side `isOccurrenceToday()` handles weekly (day code + bi-weekly interval + series end), single events, and monthly/daily fallback. `shiftToToday()` corrects the live/later window for recurring programs. Sessions split into **Live Now** (join button; window opens 12 min before start, through session end) and **Later Today** (no join button; note tells member the link appears about 12 min before start). Join link withheld until Live Now — prevents members accidentally joining an open room when multiple programs are visible. **Auto-refresh:** `DashboardAutoRefresh` fires `router.refresh()` via `setTimeout` exactly when a Later Today session enters its Live Now window (epoch ms, timezone-agnostic; +2s buffer). No polling, no scroll reset — join button appears in place.

**AlertStrip (`components/AlertStrip.tsx`):**
- Amber notification card, inline within the dashboard content column (after the greeting)
- Color tokens: `--color-alert: #C8821A`, `--color-alert-bg: #FDF6EC`, `--color-alert-border: #F0C98A`
- Container: amber background + border + `border-radius: 10px`, `padding: 12px 16px`
- Items: `border-left: 4px solid var(--color-alert)`, `padding-left: 20px`; hairline `border-bottom` dividers; no gap between items
- Count badge uses `--color-alert` (not brand navy); label text "alerts" / "alert"
- Scrollable list: `max-height: 220px; overflow-y: auto` on the `ul`
- Scroll indicator: CSS-only pulsing downward chevron on `.alert-strip__scroll-wrap::after`; `opacity: 0.3→1→0.3` over 2s; hidden via `is-scrolled-to-bottom` class applied by `checkScroll` on mount + scroll + data change
- Dismiss: per-item ✕ button (`PATCH /api/account/alerts { id }`); "Mark all read" clears all and sets `dismissed` state

**Key files:** `app/account/dashboard/page.tsx`, `components/AlertStrip.tsx`, `components/DashboardAutoRefresh.tsx`
**CSS prefix:** `db2-` (dashboard), `alert-strip` (AlertStrip)

### 6b. Account Sidebar (`AccountSidebar` / `AccountLayout`)

A persistent sidebar that appears on all account pages, showing navigation links appropriate to the user's roles.

**Sidebar links by role:**
| Link | Destination | Who sees it |
|---|---|---|
| Dashboard | `/account/dashboard` | All members |
| My Programs | `/account/programs` | All members |
| My Library | `/account/dashboard-my-library` | All members |
| My Profile | `/account/dashboard-my-profile` | All members |
| *(Your Hubs divider + links)* | `/account/hub/[slug]` | Members with `HubMember` records; ADMIN sees all hubs; REGISTRAR auto-synced to Registrar Hub |
| *(divider)* | — | REGISTRAR / ADMIN |
| Members | `/admin/members` | REGISTRAR / ADMIN |
| Households | `/admin/households` | REGISTRAR / ADMIN |
| *(divider)* | — | ADMIN only |
| Manual | `/admin/manual` | ADMIN |
| Roadmap | `/admin/roadmap` | ADMIN |

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

Form to update firstName, lastName, phone. Uses server action — data writes directly to Postgres. Email is display-only (magic link auth; contact support to change). Success state via `?saved=true` URL param, styled with `mp-success` class.

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

#### MembershipType, UserMembership (Phase 2 scaffolding — table exists, no UI yet)
Schema is live in the DB but no application code reads or writes these models yet.
- `MembershipType` — defines categories of community involvement (e.g. "General Member", "Dharma Study Group"). Fields: `id`, `name` (unique), `slug` (unique), `description?`, `isActive`, `createdAt`.
- `UserMembership` — join table linking a User to a MembershipType. Fields: `userId`, `membershipTypeId`, `joinedAt`, `isActive`. `@@unique([userId, membershipTypeId])`.

#### AttendanceRecord (Phase 2 scaffolding — table exists, no UI yet)
Schema is live in the DB but no application code reads or writes this model yet. Intended for tracking which sessions/retreats/classes a member has attended.
Fields: `userId`, `recordedAt`, `eventDate`, `eventName`, `eventType` (CLASS / RETREAT / STUDY_GROUP / VOLUNTEER / EVENT), `format` (IN_PERSON / ONLINE), `notes?`.

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
AttendanceType:     CLASS | RETREAT | STUDY_GROUP | VOLUNTEER | EVENT  (Phase 2)
AttendanceFormat:   IN_PERSON | ONLINE  (Phase 2)
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
| 🟠 Webflow | Legacy — being phased out | Uses raw Webflow class names from `rim.webflow.css` |
| 🟢 Design System | New pages | Prefixed classes + CSS custom properties, zero Webflow dependency |

### Custom CSS file
All custom styles: `public/css/custom.css`

### Page prefixes (🟢 design system pages)
| Prefix | Page |
|---|---|
| `lp-` | Lesson pages (also shared reading-column utilities used by other 🟢 pages) |
| `pg-` | Program detail pages |
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
| `nav-` | Global nav component (🟢 — no Webflow dependency) |
| `man-` | Staff Reference Manual (`/admin/manual`) |

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

## 11. Member Management System (`/admin/members`)

**What it does:** An admin area (ADMIN or REGISTRAR) for viewing all members, editing their profiles, assigning/revoking staff roles, managing course access, and importing members from CSV. Includes enhanced profile fields, status-driven access control, tags, admin notes, and household grouping.

### Routes
- `/admin/members` — searchable member list with role filter, status filter, sortable columns, archived toggle, and import tool
- `/admin/members/[id]` — member detail: full profile editing, member status, tags, household, admin notes, roles, course access, registration history, delete (admin only)
- `/admin/households` — household directory with custom-label frequency table
- `/admin/households/[id]` — household detail: edit name/address/notes, manage members, set primary contact
- `/account/reactivate` — self-service reactivation page for Inactive members (magic link → reactivate → dashboard)

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
- "Import from Memberstack" button — admin only, opens import panel inline
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
2. **Magic link → `/account/reactivate`** — proxy detects `archivedAt`, redirects to reactivation page; PATCH `/api/account/reactivate` clears `archivedAt` → dashboard

### Dashboard integration
AccountSidebar shows "Members" and "Households" links for REGISTRAR+. ADMIN also sees these plus Manual and Roadmap.

### Memberstack CSV import
- Client-side CSV parse — handles quoted fields; no library
- Column mapping: Email, First Name / firstName, Last Name / lastName, Phone
- Preview: first 5 rows + total count
- Upsert by email (lowercase): fills blank fields only (never overwrites); not found → create
- Results: "X new · Y updated · Z skipped"

### Key files
- `app/admin/members/page.tsx` — member list server component
- `app/admin/members/[id]/page.tsx` — member detail server component; constructs `serialized` explicitly (never spreads Prisma `include` — see Technical notes)
- `components/MembersTable.tsx` — list client component (search, filters, sort, archived toggle)
- `components/MemberDetail.tsx` — detail client component (all profile sections; imports HouseholdSection + CourseAccessSection)
- `components/MemberImport.tsx` — CSV import client component
- `components/CourseAccessSection.tsx` — course access UI
- `components/HouseholdSection.tsx` — household embedded panel in member detail
- `app/account/reactivate/page.tsx` — self-service reactivation (`wl-` prefix)
- `app/api/account/reactivate/route.ts` — PATCH: clears archivedAt
- `app/api/admin/members/route.ts` — GET (list with search + limit params; ADMIN or REGISTRAR)
- `app/api/admin/members/[id]/route.ts` — PATCH (profile/status/roles) + DELETE (zero-registration guard)
- `app/api/admin/members/[id]/household/route.ts` — GET: returns member's household ID+name (used by HouseholdSection join flow)
- `app/api/admin/members/[id]/course-access/route.ts` — POST/DELETE — ADMIN or REGISTRAR
- `app/api/admin/members/import/route.ts` — POST (CSV upsert)

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

**2. Magic link → `/account/reactivate` (direct login path)**
When an archived member requests a magic link and clicks it, `proxy.ts` detects `session.user.archivedAt` is set and redirects them to `/account/reactivate` instead of the usual member area. The page shows a warm welcome-back message ("Your account was archived. Click below to reactivate.") with a single "Reactivate" button that calls `PATCH /api/account/reactivate` → clears `archivedAt` → redirects to `/account/dashboard`. Uses `wl-` CSS prefix (same visual language as `/account/welcome`).

**Proxy loop guard:** `proxy.ts` checks `!pathname.startsWith("/account/reactivate")` before redirecting archived users — prevents an infinite redirect loop.

### Dashboard integration
- `STAFF_LINKS` in `dashboard/page.tsx` maps each role to an array of cards
- Both REGISTRAR and ADMIN produce cards for their hub links + Staff Manual
- Deduplication by `href` — no duplicate cards if a user holds both ADMIN + REGISTRAR

### Memberstack CSV import
- Client-side CSV parse — no library, handles quoted fields
- Column mapping (case-insensitive): Email, First Name / firstName, Last Name / lastName, Phone
- Preview: first 5 rows + total count before committing
- Upsert by email (lowercase normalized): found → fill blank fields only (never overwrite); not found → create
- Results: "X new · Y updated · Z skipped"
- One-time migration path: export from Memberstack dashboard → Members → Export → upload here

### Key files
- `app/admin/members/page.tsx` — member list server component; `showArchived` query param controls DB filter
- `app/admin/members/[id]/page.tsx` — member detail server component; constructs `serialized` object explicitly (never spreads Prisma `include` result — see Technical notes)
- `components/MembersTable.tsx` — list client component (search, filter, archived toggle, muted archived rows)
- `components/MemberDetail.tsx` — detail client component (profile form, role checkboxes, registration history, archived banner, danger zone, renders `<CourseAccessSection>`)
- `components/MemberImport.tsx` — CSV import client component
- `components/CourseAccessSection.tsx` — course access client component (fetches all courses, computes statuses, grant/revoke UI with per-course state machine)
- `app/account/reactivate/page.tsx` — self-service reactivation page (`wl-` CSS prefix)
- `app/api/account/reactivate/route.ts` — PATCH: clears `archivedAt` for the authenticated user
- `app/api/admin/members/route.ts` — GET (list)
- `app/api/admin/members/[id]/route.ts` — PATCH (update profile/roles/archive/restore) + DELETE (hard delete, zero-registration guard)
- `app/api/admin/members/[id]/course-access/route.ts` — POST (grant access) / DELETE (revoke access) — ADMIN or REGISTRAR
- `app/api/admin/members/import/route.ts` — POST (CSV upsert)
- `app/api/admin/courses/route.ts` — GET (all courses enriched with linked programs) — used by `CourseAccessSection`

**🔧 Technical notes:**
- Import runs rows sequentially (N+1 queries) — acceptable for one-time migration; optimize with batch upsert if needed
- `legacyMemberstackId` field exists on the User model — can be populated during import in the future for reconciliation
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

**Typo recovery workflow:** If a member mistyped their email at registration (never received the magic link), staff can look them up by name in the volunteer area → copy their correct email → fix it in `/admin/members/[id]`

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
4. Confirmation email includes a magic link to their dashboard
5. They click it — they're in. No additional steps. Profile already populated.

**Path B — Directly through the login page (returning members / direct sign-in)**
1. Person visits `/login`, enters their email, receives magic link
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

1. **Abandoned mid-welcome-page:** Someone clicked a magic link but closed the browser before completing their profile. A daily cleanup cron deletes User records where `agreedToTerms = false` and `createdAt < 48 hours ago`. Silent, automatic.

2. **Explicit decline:** The `/account/welcome` page has a visible "I'd rather not join" link. Clicking it immediately deletes the User record (and any related records), signs them out, and redirects to the public homepage. Clean, no drama.

The result: every User record in the system is an intentional community member. The admin member list reflects reality.

### Login page framing

The `/login` page uses "Join or sign in" as the heading — not "Log in." The copy briefly explains the magic link (no password needed, works for new and returning members alike). A note below the form says: *"New to RIM? You'll set up your name and a brief community welcome after your first sign-in."*

This eliminates the common confusion where a new person sees "Log in" and assumes they need a pre-existing account.

### Registration → member account connection

When a non-logged-in person submits a registration form:
- The API finds or creates their User record by email
- First name, last name, and phone are written to the User record (blank fields only — never overwrites existing data)
- If the community agreements checkbox was checked: `agreedToTerms = true`, `agreedAt = now()`
- They receive a confirmation email with a magic link. Clicking it takes them directly to the dashboard (no welcome page — they already agreed)

When a logged-in member registers: name/phone already on file, no agreements step, shorter form.

### Memberstack migration strategy

The old Memberstack list of ~1,462 members is **not bulk-imported**. Instead:
- Real members will naturally appear when they register for a program or log in via magic link
- This organically filters out people who signed up once and never engaged
- The new system's member list reflects actual community participants
- If a targeted import is ever desired, the Memberstack CSV export includes `activity count`, `last login`, and `last attendance date` — these can be used to import only genuinely active members selectively

### Key files

- `app/login/page.tsx` — "Join or sign in" framing, magic link explanation
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
| If X Breaks | 8 external dependency cards — each shows the system name (Sanity, Resend, Postgres, Stripe, Google Meet, Vercel Cron, Flodesk, Google OAuth) and what cascades as bullet points with red ✕ markers |

**Bottom layer — Feature Detail:**

13 functional areas, ~60 feature cards. Each card contains:
- **Where** — URL(s) or key file(s) as monospace tags
- **What** — plain-English description of the feature
- **Related to** — bulleted functional relationships (→ prefix)

Areas: 🔐 Auth, 🛡️ Route Protection, 📋 Registration, ✉️ Email, 💰 Dana/Stripe, 📊 Volunteer Tools, 👤 Member Experience, 📚 Course Access, 🛠️ Member Management, ⏰ Scheduling, 🎥 Google Meet, 🗂️ Sanity CMS, 🌐 Public Pages + Admin Tools + Nav.

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

**Public mode:** Programs · Get Involved ▾ · Member Area/Hi [Name] ▾ · Donate pill

**Member area mode** (`/account/*`, `/admin/*`): My Dashboard · Programs · Admin ▾ (admin-only) · Sign Out · Donate pill

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

## Session Log

| Date | Summary |
|---|---|
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

---

## 18. ~~Sanity Studio Access for Staff~~ (removed)

> **Removed in session 54 (2026-03-15).** Programs migrated to Postgres; the Sanity invitation system was deleted. The API route (`sanity-invite/route.ts`), the `revokeSanityAccess()` function, the `sanityInvitedAt` field on User, the Sanity Management Token usage, and all related UI (invite button, revocation warning, dashboard link) were removed. Registrars now access the Program Editor in the Registrar Hub — no Sanity Studio access is needed for program management.

---

## 19. Google Meet Integration ✅ Built — updated session 33 (2026-03-09)

**What it does:** Replaces Zoom with Google Meet for all virtual and hybrid programs. A registrar clicks "Create Google Meet" in the Program Editor — the app finds a free room account, creates a Meet space, adds a Google Calendar event, and saves the link + room email + calendar event ID to the program record. The link appears in confirmation and reminder emails. **Time changes sync automatically:** saving date/time changes in the Program Editor patches the calendar booking. **Switching to in-person:** changing programFormat to "in-person" and saving deletes the calendar event and clears all Meet fields. A confirmation dialog warns before this destructive action. The **Meet Host** team logs into the assigned room account to get host controls.

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

**Dashboard AlertStrip**
- Unread alerts shown above the nav cards on `/account/dashboard`
- Covers: sub requests, sub claims, new conversations, new replies, unassigned sessions (HOST_MANAGER only)
- Each alert has a ✕ dismiss button; "Mark all read" clears all at once
- Navigating to an alert's linked page does NOT auto-dismiss the alert

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

A general-purpose hub system for ALL RIM volunteer teams — not just the host team. Each volunteer group (host team, people team, newsletter, greeter team, etc.) has its own hub workspace with Announcements, Documents, Conversations, Members, and (for host-team only) a Schedule tab. The workspace is accessed via "Your Hubs" in the account sidebar.

### Who uses it

Any authenticated member who has a `HubMember` row for a given hub. Coordinators (`isCoordinator: true`) have extra privileges (post announcements, archive conversations, manage members). ADMIN always has coordinator access to every hub.

### Architecture

**Single hub system:**
- `/account/hub/[slug]/*` — general-purpose multi-hub workspace for all volunteer teams (Prisma models: Hub, HubMember, HubAnnouncement, HubDocument, HubConversationThread, HubConversationReply).

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
| Announcements | ✅ | Hub home (default) |
| Schedule | conditional | `hub.hasSchedule = true` (host-team only) |
| Documents | ✅ | |
| Conversations | ✅ | |
| Members | ✅ | |

### New Prisma models

| Model | Purpose |
|---|---|
| `Hub` | A volunteer team hub — slug, name, type (OPERATIONAL/GOVERNANCE), hasSchedule, documentCategories[], conversationCategories[] |
| `HubMember` | User membership in a hub — position, isCoordinator, lastVisitedAt (for unread tracking) |
| `HubAnnouncement` | Coordinator-posted announcement with priority (NORMAL/IMPORTANT/URGENT); can link to a conversation thread |
| `HubDocument` | Link or file attached to a hub — label, url, description, fileType, category |
| `HubConversationThread` | Discussion thread — title, body, category (string from hub.conversationCategories), status (OPEN/CLOSED/ARCHIVED) |
| `HubConversationReply` | Reply to a thread — body, author |

### Key files

**Layout + auth:**
- `app/account/hub/[slug]/layout.tsx` — auth check + membership check + HubHeader + HubNavStrip + AccountLayout wrapper
- `lib/hubAuth.ts` — `getHubMembership(slug, userId)` helper; `requireCoordinator()` guard

**Pages:**
- `app/account/hub/[slug]/page.tsx` — Announcements (hub home)
- `app/account/hub/[slug]/schedule/page.tsx` — Schedule (hasSchedule hubs only)
- `app/account/hub/[slug]/documents/page.tsx` — Documents
- `app/account/hub/[slug]/conversations/page.tsx` — Conversations list
- `app/account/hub/[slug]/conversations/[id]/page.tsx` — Conversation thread detail
- `app/account/hub/[slug]/members/page.tsx` — Members list

**Components:**
- `components/HubHeader.tsx` — hub name, type badge, member count + avatar strip
- `components/HubNavStrip.tsx` — horizontal tab nav (renders only tabs that apply to this hub)
- `components/HubAnnouncementsClient.tsx` — announcement list + post form (coordinator only)
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
| `/api/hub/[slug]/announcements` | GET, POST | List announcements; post new |
| `/api/hub/[slug]/announcements/[id]` | PATCH, DELETE | Update/archive announcement |
| `/api/hub/[slug]/announcements/[id]/thread` | POST | Create linked conversation thread from announcement |
| `/api/hub/[slug]/conversations` | GET, POST | List threads; create thread |
| `/api/hub/[slug]/conversations/[id]` | GET, PATCH | Thread detail; change status |
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

**`lastVisitedAt` tracking:** Each hub page visit updates `HubMember.lastVisitedAt`. This is used by the dashboard hub cards to show unread dots (not yet implemented — reserved for future use).

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

## 25. Virtual Host Hub — Phase 1: Attendance Tracking + Session View ✅ Built — session 43 (2026-03-12)

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

### New env vars

| Variable | Purpose |
|----------|---------|
| `JESSE_EMAIL` | Recipient for GENTLE_FOLLOWUP + JESSE_ONLY flags (falls back to `REGISTRAR_EMAIL`) |
| `HOST_COORDINATOR_EMAIL` | Recipient for GENTLE_FOLLOWUP + TECHNICAL_ISSUE flags (falls back to `REGISTRAR_EMAIL`) |
| `ENABLE_ATTENDANCE_EMAILS` | Set to `true` to enable automated first-time + returning-after-absence emails (default: disabled) |

---

## 25b. Virtual Host Hub — Phase 2: Session History + Attendance Hardening ✅ Built — session 44 (2026-03-12)

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

## 25c. Virtual Host Hub — End Session Button + Membership Sync Fix ✅ Built — session 45 (2026-03-12)

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

**7 managed — `sendTemplatedEmail()` — editable in Email Template Manager**

| Function | Template slug | Group | Variables | Trigger |
|---|---|---|---|---|
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

**2 hardcoded — must stay (cannot be managed)**

| Function | Variables | Reason must stay |
|---|---|---|
| `sendMagicLinkEmail` | url (NextAuth token), isNewUser | NextAuth auth contract (`sendVerificationRequest`). Token is signed + time-limited, generated by NextAuth at call time — cannot go through async template pipeline. Also rethrows on failure (unlike all other functions) so NextAuth can surface errors |
| `sendPostSessionNotification` | programSlug, sessionDate, hostName, flags[], reflection, resourceUrl | Per-recipient routing: one call sends up to 2 separate emails to different recipients based on flag type (GENTLE_FOLLOWUP → Jesse + coordinator; JESSE_ONLY → Jesse; TECHNICAL_ISSUE → coordinator). Consolidates multiple flags per recipient. Not templateable |

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

**What it does:** Establishes a system-wide rich text editing standard. Every formatted text field in the application uses one of two shared Tiptap editor components. No plain textareas for multi-line formatted content.

### Two editors
| Component | Purpose | Custom blocks | Used for |
|---|---|---|---|
| `ContentEditor` | Full editorial editor | ✓ Verse Quote, Practice Suggestion, Callout | Dharma content written by Jesse or a teacher for members to read |
| `FormattedEditor` | Standard formatted editor | — | Functional formatted text: communications, descriptions, admin-facing content |

Both are built on Tiptap v3. ContentEditor extends FormattedEditor's base extensions with three custom Tiptap nodes defined in `lib/tiptap-extensions.ts`. They share the same visual design (`rte-` CSS prefix) — only the toolbar differs (ContentEditor adds + Verse, + Practice, + Callout buttons).

### The rule for future development
- **Multi-line formatted text** → `FormattedEditor` (bold, italic, headings, lists, links)
- **Dharma content for members** → `ContentEditor` (prose + custom blocks)
- **Plain `<textarea>`** → only for single-purpose short text: slugs, names, phone numbers, URLs, numeric values, labels, pull quotes, dana messages
- When in doubt: use `FormattedEditor`. Never use a plain textarea for multi-line content.

### Where each editor is used
| Location | Field | Component |
|---|---|---|
| LessonEditor | body | ContentEditor |
| CourseEditor | description | FormattedEditor |
| MemberDetail (admin) | adminNotes | FormattedEditor |

**Program fields (Phase 3 complete — session 54):** Programs now live in Postgres. Program description, confirmationMessage, reminderMessage, and specialNotes are stored as Tiptap JSON in the Program model. The Program Editor uses FormattedEditor for these fields.

### Data format
All editor fields store **Tiptap JSON** (Prisma `Json?` type). No serialization or parsing needed — Prisma handles JSON natively. Editors accept JSON or null as their `value` prop and emit JSON via `onChange`.

### Rendering
`lib/renderRichContent.ts` provides two server-side functions:
- `renderContentBody(json)` → HTML string (includes custom blocks)
- `renderFormattedText(json)` → HTML string (prose only)

Both use `@tiptap/html` `generateHTML()`. Output is used with `dangerouslySetInnerHTML` on rendered pages.

### Key files
- `components/ContentEditor.tsx` — full editorial editor with custom blocks
- `components/FormattedEditor.tsx` — standard formatted editor
- `lib/tiptap-extensions.ts` — VerseQuote, PracticeSuggestion, Callout Tiptap nodes
- `lib/renderRichContent.ts` — server-side JSON → HTML rendering
- `components/RimEditor.tsx` — legacy markdown-based Tiptap editor (still used by 8 hub components and EmailTemplateEditor; outputs/accepts markdown strings, not JSON)

**🔧 Technical notes:**
- Custom block CSS classes: PracticeSuggestion → `lp-callout` (shared with Sanity PortableText `practiceCallout` on program pages), Callout → `lp-callout-block`, VerseQuote → `lp-verse-quote`
- Markdown extension (`tiptap-markdown`) configured with `transformPastedText: true` — pasting Markdown from other editors (Bear, etc.) auto-converts to formatted content
- `rte-` prefix for all editor CSS. Custom block previews inside the editor use `[data-type]` attribute selectors.
- RimEditor remains for hub conversations, announcements, schedule notes, email templates — these fields use markdown strings (`String?`) and don't need Tiptap JSON. RimEditor and FormattedEditor coexist but serve different storage patterns.

---

## §29 — Support Inbox

The Support Inbox is a full shared email client for `support@rootedinmindfulness.org`, built natively into the hub system at `/account/hub/support/inbox`. It syncs Gmail threads via the Gmail API, matches senders to community members, and provides a three-column email client for the support team to manage correspondence.

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

| 2026-03-18 (session 62) | **Modular Manual System.** **(1) Content migration:** All 8 chapters from the 3115-line `ManualContent.tsx` migrated into `ManualSection` DB records via `prisma/seed-manual-chapters.ts`. Each chapter stored as `{ type: "rawHtml", html: "..." }` (renderContentBody handles this format). 9 sections total including `manual-system` meta-section. `description String?` field added to ManualSection schema. **(2) renderContentBody rawHtml support:** `lib/renderRichContent.ts` updated — if `json.type === "rawHtml"`, returns `json.html` directly (bypasses Tiptap). **(3) Section pages:** `/admin/manual/[slug]` rebuilt — any logged-in user can read (not ADMIN-only); ADMIN sees Edit link; shows section title, hub badge, last updated date, body content, related section pills, back/full manual links. **(4) Manual index:** `/admin/manual` rebuilt as clean server-component index listing all ManualSection records with title, description, and hub badge. ADMIN sees "Manage sections →" link to editor. `/manual` public route updated to same index, no edit controls. **(5) ManualHelpIcon wired:** 10 locations confirmed/corrected — Course Hub landing, CourseEditor (series editor), LessonEditor (lesson editor), /account/courses/, /courses/, host-hub landing, registrar programs, support inbox, admin member detail, admin teachers. Several had wrong slugs fixed (member-courses→course-hub, member-registry→member-accounts, registrar-hub→registration). **(6) ManualContent.tsx hollowed out:** Replaced 3115 lines of JSX with a 14-line comment stub. **(7) Closing ritual updated:** 4-step closing ritual documented in FEATURES.md and RIM_Stack_Reference.md; ManualSection upsert replaces the old 6-doc ritual. **(8) CSS:** `man-idx` (index page) and `man-sec-page` (section page) CSS classes added to `custom.css`. Key files: `prisma/seed-manual-chapters.ts`, `lib/renderRichContent.ts`, `app/admin/manual/page.tsx`, `app/admin/manual/[slug]/page.tsx`, `app/manual/page.tsx`, `components/ManualContent.tsx`, `components/CourseEditor.tsx`, `components/LessonEditor.tsx`, `app/admin/teachers/page.tsx`, `public/css/custom.css`. |

| 2026-03-18 (session 61) | **Contextual Help System + Manual Migration.** **(1) ManualSection model:** Added to Prisma schema (`manual_sections` table); `slug` @unique, `body` Json?, `relations` String[], `hubSlug` String?, `order` Int. `prisma db push`. **(2) API routes:** `app/api/admin/manual/route.ts` (GET list / POST create) and `app/api/admin/manual/[slug]/route.ts` (GET one / PATCH update); both ADMIN-only; no DELETE. **(3) Admin manual pages:** `app/admin/manual/page.tsx` replaced (was ~1200 lines hardcoded JSX) with client component fetching from API; accordion list with expand/collapse. `app/admin/manual/[slug]/page.tsx` — section detail with body rendered via `renderContentBody()` and related section pill links. `app/admin/manual/[slug]/edit/page.tsx` + `components/ManualSectionEditor.tsx` — editor with ContentEditor for body, relations input, order field. **(4) ManualHelpIcon component:** `components/ManualHelpIcon.tsx` — small `?` circle, `position: absolute; top: 12px; right: 12px`, links to `/admin/manual/[slug]` in new tab; `mh-` CSS prefix. Wired into 9 locations: Series list, Series editor, Lesson editor, /account/courses, /courses, host-team hub, registrar programs, support inbox, member detail page. **(5) Manual migration:** `prisma/seed-manual.ts` seeds 4 sections (registration-management, programs-editor, member-registry, volunteer-roles) from the old hardcoded content. `prisma/seed-courses-manual.ts` seeds 5 courses sections (course-hub, course-hub-series, course-hub-lessons, member-courses, teacher-profiles) with full plain-language content. **(6) Closing ritual standard:** Updated FEATURES.md (§31 + session log), RIM_Stack_Reference.md with ManualSection model and closing ritual note. |

| 2026-03-17 (session 59) | **Course→Series rename + series page redesign + section labels UX + build fixes + learning system planned.** **(1) Build fixes:** `Prisma.JsonNull` required for `Json?` nullable fields — fixed in `app/api/host/sub-requests/[id]/claim/route.ts` (message field), `app/api/host/sub-requests/route.ts` (message field), and `app/api/programs/[slug]/registrations/route.ts` (notes field in CSV export — used `extractText()` to convert Tiptap JSON to plain string). **(2) Course→Series rename:** All UI labels throughout the Teacher Hub now say "Series." DB model name `Course` unchanged. Hub tab, CourseEditor headings, LessonListClient, all hub pages updated. **(3) Section labels UX redesign:** Replaced floating text inputs above each lesson row with explicit draggable section-divider rows in `CourseEditor.tsx`. `+ Add Section` button appends a teal dashed-border row (inline-editable label, ✕ remove). `listToLessonOrder()` serializes to `{ id, groupLabel }[]`; `courseLessonsToList()` reconstructs on load. **(4) Sort order removed:** Removed from Series editor UI — was a Webflow artifact; DB column remains. **(5) Series page redesign (`/course/[slug]`):** Full redesign from dark teal hero bar to `lp-` lesson-page aesthetic. `var(--rim-bg)` warm background, centered weight-400 serif title (42px), muted small-caps label, thin `<hr>` rule, 640px reading column. **(6) Lesson cards + SVG icons:** Lesson rows are now white cards (border-radius 10px, border-color hover transition). Replaced text badges with tinted icon squares: headphones/sage for audio, play-circle/slate for video, text-lines/warm-gray for reading. Inline SVG icon components (`AudioIcon`, `VideoIcon`, `TextIcon`). CSS classes: `crs-toc__icon-wrap`, `crs-toc__icon-wrap--audio/video/text`, `th-section-row`, `th-btn--ghost`. **(7) Learning system planned:** Full feature set designed and documented in §30 (progress tracking, enrollment, duration estimates, reflection prompts, personal notes, completion, teacher profiles, per-series discussion). New "Learning System" section added to roadmap (`app/admin/roadmap/page.tsx`) as high priority with 8 detailed items. Key files: `components/CourseEditor.tsx`, `app/course/[slug]/page.tsx`, `app/api/host/sub-requests/route.ts`, `app/api/host/sub-requests/[id]/claim/route.ts`, `app/api/programs/[slug]/registrations/route.ts`, `public/css/custom.css`, `app/admin/roadmap/page.tsx`. |

| 2026-03-16 (session 58) | **Session tab visual redesign + post-session form overhaul + FormattedEditor standard.** Full redesign of the Host Hub Session tab and post-session form across `SessionLiveClient.tsx`, `PostSessionClient.tsx`, schema, and CSS. **(1) State machine fixes:** `computeState` was called once on mount and never re-ran. Added tick counter (`useState` incremented inside the 60-second poll interval) so all 6 states (later-today → getting-ready → live → post-session → done) transition correctly without a page reload. Removed server-side `prog.sessionEnded` from `isEnded` — was frozen at render time, could force State 5 while session was live. Now only `manuallyEnded` (explicit Close Session click) and `timeEnded` (`Date.now()` > endMs) control the ended state. **(2) Visual redesign — person rows:** Replaced chip grid with `AttendeeRow` full-width button component (52px tall). Left-edge 4px color strip: amber = new member, teal = returning, grey = absent. Inline "New" / "Back" label, name centered, flag circle at right edge. Tap toggles flag; flagged rows get amber background. **(3) Live block prominence:** Sage green background (`rgba(100, 140, 100, 0.12)`) with 4px left border on live session card. Non-live sessions without forms collapse to footnote links when `hasActiveForm = true`. `hasLive` computed once; sessions without a form to file always show. **(4) Scoreboard:** `sv-scoreboard` — 48px number + "in the room" label, displayed inside the live block. **(5) Co-host flow:** "I'm also hosting this" button restored as quiet inline text link in live state. Confirmation: `sv-cohost-confirmed--live` pill after click (no page reload needed). **(6) Post-session form — flagged people section:** All hosts now see the full post-session form (no more isCoHost distinction). Section 1 shows flagged attendees (everyone tapped during the session) with a FormattedEditor note field per person + 4 routing radio buttons with descriptions: No action needed / Gentle follow-up / Jesse only — sensitive / Technical issue. Descriptions render as `ps-radio__desc` beneath each label. **(7) FormattedEditor standard enforced:** Replaced plain textarea in reflection and all flag note fields with `FormattedEditor` (Tiptap JSON). Autosave to localStorage includes Tiptap JSON objects. `DraftState` uses `object | null` for `reflection` and `flagNotes`. **(8) Schema migration:** 3 fields changed from `String?` to `Json?` via `prisma db push`: `SessionAttendance.postSessionNote`, `SessionReport.reflection`, `SessionCoHostReport.reflection`. All stored as Tiptap JSON. Uses `Prisma.JsonNull` for nullable writes. **(9) `extractText()` utility:** Added to `lib/renderRichContent.ts` — runs `generateHTML()` then strips tags, used for email notification plain text from Tiptap JSON. **(10) API route updates:** `/api/attendance/session/[programSlug]/post/route.ts` — `flags.note` typed as `object | null`; stores `Prisma.JsonNull`; email notification uses `extractText()`. `/api/attendance/session/[programSlug]/cohost-report/route.ts` — same `Prisma.JsonNull` pattern. **(11) History page updates:** `session/history/page.tsx` and `session/history/team/page.tsx` — `postSessionNote`/`reflection` cast to `object | null`, rendered with `renderFormattedText()` + `dangerouslySetInnerHTML`. **(12) Memory saved:** `memory/feedback_editor_standard.md` — documents the FormattedEditor standard (all multi-line communication fields, `Json?` DB type, `renderFormattedText()` for display, `extractText()` for email) so it's applied automatically in future sessions. Key files: `components/SessionLiveClient.tsx`, `components/PostSessionClient.tsx`, `app/api/attendance/session/[programSlug]/post/route.ts`, `app/api/attendance/session/[programSlug]/cohost-report/route.ts`, `app/account/hub/[slug]/session/history/page.tsx`, `app/account/hub/[slug]/session/history/team/page.tsx`, `app/account/hub/[slug]/session/[programSlug]/post/page.tsx`, `lib/renderRichContent.ts`, `prisma/schema.prisma`, `public/css/custom.css`. |

---

## 30. Learning System — Planned

**What it is:** A set of features that upgrades the Series/Lesson library from a static content archive into an active learning companion — designed specifically for a contemplative community. No gamification, streaks, points, or credentials. The goal is to give members the tools to engage deeply with teachings over time: knowing where they are, reflecting on what they've read, and marking moments of completion.

**Design principle:** Every feature in this system should feel like a journal or a practice companion — not a platform. The contemplative context is load-bearing: choices that work for a MOOC platform may not fit here.

### Planned features (prioritized)

| # | Feature | Effort | What it does |
|---|---|---|---|
| 1 | **Lesson progress tracking + Continue button** | Medium | Mark lessons complete; series page shows progress bar + "Continue →" link; dashboard shows active series |
| 2 | **Series enrollment** | Medium | Members consciously enroll in a series (separate from access); connects progress to identity + intention; drives dashboard |
| 3 | **Duration estimates** | Small | `durationMinutes Int?` on Lesson; shown on series page cards as "~25 min"; helps practitioners plan |
| 4 | **Reflection prompts** | Small | `reflectionPrompt String?` on Lesson; a teacher-written invitation shown at the bottom of each lesson; no member interaction required |
| 5 | **Personal lesson notes** | Medium | Private per-lesson note (FormattedEditor, Tiptap JSON); auto-saves; only visible to the member |
| 6 | **Completion moment** | Small | When last lesson is marked complete: a quiet acknowledgment with teacher's completion note; sets `SeriesEnrollment.completedAt` |
| 7 | **Teacher profiles** | Large | Full `Teacher` Postgres records with bio + photo; replaces the `teacherNames String[]` field; enables "also from this teacher" links |
| 8 | **Shared reflection / per-series discussion** | Medium | Optional per-series contemplative sharing thread; off by default; coordinator enables per series |

### Key data models (new)

| Model | Fields | Purpose |
|---|---|---|
| `LessonProgress` | `userId`, `lessonId`, `completedAt`, `@@unique([userId, lessonId])` | Tracks per-lesson completion per member |
| `SeriesEnrollment` | `userId`, `courseId`, `enrolledAt`, `completedAt?`, `@@unique([userId, courseId])` | Tracks explicit enrollment + completion |
| `LessonNote` | `userId`, `lessonId`, `body Json?`, `updatedAt`, `@@unique([userId, lessonId])` | Private member notes per lesson |
| `Teacher` | `name`, `slug`, `bio String?`, `photoUrl String?`, `isActive` | Teacher profiles (future) |

### Fields to add to existing models

| Model | Field | Purpose |
|---|---|---|
| `Lesson` | `durationMinutes Int?` | Shown as "~N min" on series page |
| `Lesson` | `reflectionPrompt String?` | Teacher-written closing invitation |
| `Course` | `completionNote String?` | Shown on completion acknowledgment |
| `Course` | `discussionEnabled Boolean @default(false)` | Whether per-series discussion is enabled |

### Key files (when built)
- `app/api/lessons/[slug]/complete/route.ts` — POST: toggle complete; check if all lessons done → set `SeriesEnrollment.completedAt`
- `app/api/courses/[slug]/enroll/route.ts` — POST/DELETE: enroll / unenroll
- `app/api/lessons/[slug]/note/route.ts` — GET/PATCH: personal note upsert
- `app/course/[slug]/page.tsx` — progress bar, Continue link, enrollment button, completion state
- `app/lessons/[slug]/page.tsx` — Complete button, reflection prompt, personal note editor
- `app/account/dashboard/page.tsx` — enrolled series with progress
- `components/LessonNoteEditor.tsx` — FormattedEditor with auto-save

**🔧 Design decisions:**
- Progress and enrollment are separate concepts: you can have access without being "enrolled," and you can make progress without formally enrolling. Enrollment is the intentional act.
- `reflectionPrompt` is plain text (not Tiptap) — it's a single sentence or short paragraph the teacher writes. No need for rich formatting.
- Personal notes use Tiptap JSON (FormattedEditor) — members may want to write in paragraphs, lists, or with some structure.
- `completedAt` on `SeriesEnrollment` is set automatically when all lessons are marked complete — not manually by the member.
- Teacher profiles are a large effort and should wait until the simpler features are proven valuable.
- Shared discussion requires community norm-setting before being turned on — build the infrastructure, leave it disabled.

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
- `ManualSection.relations` is `String[]` — slugs of related sections; rendered as pill links at the bottom of detail pages
- `ManualHelpIcon` is `"use client"` — it's just an anchor link, no server data needed
- The old `/admin/manual/page.tsx` was a huge hardcoded JSX file (~1200 lines); the new page is a client component that fetches from `/api/admin/manual`
- Seed scripts use `POSTGRES_URL_NON_POOLING` (direct connection) since `POSTGRES_PRISMA_URL` has PgBouncer and isn't in `.env.local`

**Closing ritual note — required after every session that changes features:**
1. Update `FEATURES.md` — add session entry, update relevant feature sections
2. Update `RIM_Stack_Reference.md` — update stack, routes, or env vars if changed
3. Update `RIM_System_Architecture.md` — if hubs, roles, or member data architecture changed
4. **Upsert ManualSection DB records** — for anything built, changed, or removed. Touch only affected section(s). Use upsert on slug. Write for the person doing the work, not the developer. `prisma/seed-manual-chapters.ts` can be re-run for large rewrites; individual sections can be edited at `/admin/manual/[slug]/edit`.

*Updated: 2026-03-18 (session 62)*

---

*Last updated: 2026-03-18 (session 61)*

**2026-03-16 (session 58, continued)** — Session tab: finished remaining gaps from the UX redesign brief. (1) meetHostAccount display: Added to States 2 and 3 — shows the Google Meet room account labeled "Room account" in State 2, quiet text below the join button in State 3. (2) State 5 inline form: PostSessionClient now renders inline in State 5 instead of linking to a separate page. Co-host vs primary host routing handled via isCoHost prop derived from SessionProgram flags. (3) End Session stays on page: endSession callback now calls router.refresh() instead of router.push — user stays on the session tab and State 5 appears with the inline form. (4) Coordinator section: Coordinator/Admin users see a muted section below the host cards with missing report indicators and team journal link. Key files: components/SessionLiveClient.tsx, components/PostSessionClient.tsx, app/account/hub/[slug]/session/page.tsx.
