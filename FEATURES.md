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
11. [Member Management System](#11-member-management-system-adminmembers)
12. [Course Access System](#12-course-access-system-courseslug)
13. [Donation Management System](#13-donation-management-system-phase-2--planned)
14. [Community Onboarding & Membership Philosophy](#14-community-onboarding--membership-philosophy)
15. [Site Administration Tools](#15-site-administration-tools)
16. [Navigation Component](#16-navigation-component)
17. [Planned Features](#17-planned-features)
18. [Sanity Studio Access for Staff](#18-sanity-studio-access-for-staff)
19. [Google Meet Integration](#19-google-meet-integration--high-priority)
20. [Staff Reference Manual](#20-staff-reference-manual)

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
| `ADMIN` | Everything — full site management | Registrations, Members, Sanity Studio, Staff Manual |
| `REGISTRAR` | Registration management, member profiles, course access, Sanity Studio access | Registrations, Members, Sanity Studio, Staff Manual |

New roles will be added when there is real functionality to attach to them. Avoid defining roles speculatively — it adds noise to the member detail UI and member list filter without providing value.

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
- `app/volunteer/programs/[slug]/page.tsx` — server component (fetches program + registrations + `registrationFields` from Sanity)
- `components/VolunteerTable.tsx` — client component (all interactivity)

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

Displays five nav cards in a 2-column grid (1-column on mobile):

| Card | Destination | Notes |
|---|---|---|
| Today's Sessions | `#today` (anchor) | Shows count badge ("2 today" or "Nothing today") |
| My Programs | `/account/dashboard-my-registrations` | Registration history |
| My Library | `/account/dashboard-my-library` | Courses, lessons, resources |
| Our Agreements | `/account/dashboard-member-care-agreements` | Community care agreements |
| My Profile | `/account/dashboard-my-profile` | Name, phone, email |

Below the card grid:
- **Today's Sessions** — Sanity query filtered to today's day of week (Milwaukee/CT timezone); program cards link directly to Zoom; no-link programs shown disabled
- **Pending Dana** — appears when any registration has `donationStatus: PENDING` (promoted from waitlist); links to `/programs/[slug]/register`
- **Staff Access** — appears only for `REGISTRAR` and `ADMIN` roles; regular members see nothing

**Key file:** `app/account/dashboard/page.tsx`
**CSS prefix:** `db-` (in `public/css/custom.css`)

### 6b. Staff Access Panel

- Appears only for users with at least one role in `STAFF_LINKS` (currently `ADMIN` and `REGISTRAR`)
- Shows a card for each distinct area they have access to
- Regular members see nothing — the panel is not rendered at all (no hidden DOM elements)
- To add a new staff area: add an entry to the `STAFF_LINKS` map in `dashboard/page.tsx`

**Current staff links:**
| Role(s) | Card Label | Destination |
|---|---|---|
| `ADMIN`, `REGISTRAR` | Registrations | `/volunteer` |
| `ADMIN`, `REGISTRAR` | Members | `/admin/members` |
| `ADMIN`, `REGISTRAR` | Sanity Studio | `rooted-in-mindfulness.sanity.studio` (external) |
| `ADMIN`, `REGISTRAR` | Staff Manual | `/admin/manual` |

**🔧 Technical notes:**
- `STAFF_LINKS` is `Record<string, { label, href, description }[]>` — each role key maps to an array of cards. ADMIN has two entries; REGISTRAR has one.
- Deduplication by `href`: if a user holds multiple roles whose links overlap, duplicates are collapsed.
- All dashboard pages are now 🟢 design system — no Webflow class names.

### 6c. My Programs (`/account/dashboard-my-registrations`)

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
- `app/account/dashboard-my-registrations/page.tsx` — server component, direct DB + Sanity
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

#### Enums
```
Role:               REGISTRAR | ADMIN
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
- `TREASURER`, `TEACHER`, `VOLUNTEER` were removed from the enum and Prisma schema in session 23 (2026-03-05) — only `REGISTRAR` and `ADMIN` remain active. Add new roles only when real functionality is attached.

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
| `GET` | `/api/admin/courses` | ADMIN or REGISTRAR | All Sanity courses enriched with `linkedByPrograms` (reverse ref) — powers CourseAccessSection |

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

The Sanity schema lives at `/Users/jessefoy/Sites/rim-website/sanity/` and is shared by both the Eleventy and Next.js projects.

### Sanity Studio tab layout

The `programs` schema is organized into six tabs (in order):

| Tab | What's in it |
|---|---|
| **Content** | Tagline, program image, description, pull quote + source, special notes |
| **Schedule & Location** | Category, teacher/facilitators, date, time, listing day+time, location + map link, Zoom link + button text |
| **Registration** | Enabled toggle → Registration Closed flag → Capacity + Deadline → Custom questions → Confirmation email message → Reminder date + reminder message |
| **Dana & Payment** | Dana mode → amounts → dana step message → program-page dana note |
| **Dashboard** | Special announcement, early arrival message, remove from list, day filtering |
| **Sorting & Visibility** | Day of week, sort order, hide from public list |

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

**What it does:** An ADMIN-only area for viewing all members, editing their profiles, assigning/revoking staff roles, importing members from CSV, and archiving or deleting members. Archived members can reactivate themselves through registration or a direct magic-link flow.

### Routes
- `/admin/members` — searchable member list with role filter, archived toggle, and import tool
- `/admin/members/[id]` — member detail: edit name/phone, assign roles, manage course access, archive/restore/delete
- `/account/reactivate` — self-service reactivation page for archived members (magic link → reactivate → dashboard)

### Access control
- `/admin/*` routes protected at proxy level (`proxy.ts`)
- Member list and detail pages allow both ADMIN and REGISTRAR — `hasAccess = isAdmin || roles.includes("REGISTRAR")`
- Destructive actions (archive, restore, delete, import, role assignment, Sanity invite) require ADMIN; REGISTRAR can view, edit profiles, and manage course access
- `/account/reactivate` is accessible to any authenticated user (archived members can reach it because `proxy.ts` redirects archived sessions there instead of the usual member area)

### Member list (`/admin/members`)
- Search bar (filters name + email client-side — fast, no round-trip)
- Role filter: All / Admins / Registrars / No roles
- **Archived toggle:** "Show Archived (N)" button appears only when `archivedCount > 0`. Clicking it filters the table to show only archived members. Archived rows are visually muted with an "Archived" badge in the name cell.
- Table: Name, Email, Roles (colored badges), Registrations count, Joined date
- Click any row → navigates to member detail page
- "Import from Memberstack" button → opens import panel inline

### Member detail (`/admin/members/[id]`)
- Profile section: edit firstName, lastName, phone (email is read-only — set by auth)
- Roles section: checkbox per role (ADMIN, REGISTRAR) with descriptions
- Assigned roles appear as staff links on the member's dashboard automatically
- **Course Access section:** searchable list of all courses in the system; each course shows status badge(s) — "All Members" (open to any logged-in user), "Via Registration: [Program Name]" (member has active registration for a linked program), "Manual Grant" (admin-granted), or "No Access". Grant/revoke controls appear inline per course with warning dialogs when a grant is redundant or when revoking still leaves other access.
- Registration history: list of all programs registered for, with status badges + link to volunteer table
- **Danger Zone:** archive/restore/delete actions (see below)
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
- Both REGISTRAR and ADMIN produce the same 4 cards: Registrations + Members + Sanity Studio (external) + Staff Manual
- Deduplication by `href` — no duplicate cards if a user holds both ADMIN + REGISTRAR
- External links (Sanity Studio) render as `<a target="_blank">` instead of Next.js `<Link>`

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

**What it does:** Member-gated course pages that list their lessons. Two access levels determine who can view a course. Access is enforced at the page level on every request; `/course/*` is also protected by `proxy.ts` (login redirect for unauthenticated users).

### Access levels (set on the Sanity course document)
| Level | Who gets in |
|---|---|
| `members` | Any logged-in user (default) |
| `registration_required` | Must have an active registration (REGISTERED or APPROVED) for a program linked to this course, **OR** an explicit admin grant in the `CourseAccess` DB table |

### Route
- `/course/[slug]` — course page (singular, not `/courses/`); lists all lessons as clickable cards; `isSectionTitle` lessons render as non-linked dividers

### Linking programs to a course (multi-program support)
In Sanity Studio → Programs → [program] → Content tab → **Linked Courses** (array). A single program can link to multiple courses; multiple programs can link to the same course. Once linked, all members with an active registration for that program automatically have access (checked dynamically at page render — no DB write at registration time).

### The Course Access admin UI
From `/admin/members/[id]` → Course Access section (`<CourseAccessSection>`), an ADMIN sees a **searchable list of every course in the system**. Each course displays one or more status badges showing exactly why this member does or doesn't have access:

| Badge | Color | Meaning |
|---|---|---|
| **All Members** | green | Course `accessLevel` is `members` — any logged-in user can view it |
| **Via Registration: [Program]** | blue | Member has an active registration for a program linked to this course |
| **Manual Grant** | yellow/amber | An admin explicitly granted access via a `CourseAccess` DB record |
| **No Access** | grey | None of the above apply |

**Granting access:** A "Grant access" button appears on any course the member doesn't have a manual grant for. If access via another path already exists (all members or via registration), clicking the button shows an inline warning — "All logged-in members already have access" or "This member already has access via their [Program] registration" — with "Grant anyway" / Cancel.

**Revoking a grant:** If a manual grant exists, a "Revoke" button is shown. Clicking shows a confirm step. If the member still has access via another path after revocation, an informational note explains this before confirming ("After revoking, this member will still have access via their [Program] registration").

**Search:** A search bar filters by course name or slug client-side.

### Key files
- `app/course/[slug]/page.tsx` — server component; `force-dynamic`; checks session, fetches `accessLevel` from Sanity, runs access check, renders lessons; uses existing Webflow CSS classes from the original course page — do not replace with `co-` classes
- `app/api/admin/courses/route.ts` — GET, ADMIN-only; fetches all courses from Sanity enriched with `linkedByPrograms` (reverse ref); powers `CourseAccessSection`
- `app/api/admin/members/[id]/course-access/route.ts` — POST (grant, upsert) / DELETE (revoke by `?courseSlug=`) — ADMIN only
- `components/CourseAccessSection.tsx` — client component; fetches all courses on mount via `/api/admin/courses`; uses `useMemo` to derive `activeRegSlugs` (Set) and `grantsMap` (Map); `computeStatuses()` derives per-course badge state; per-course UI state machine: `Record<slug, "idle" | "confirming_grant" | "confirming_revoke" | "busy">`
- `lib/queries.ts` — `courseBySlugQuery` (includes `accessLevel`, `lessons`); `programsLinkedToCourseQuery` (array filter); `allCoursesWithLinkedProgramsQuery` (reverse ref enrichment)

**🔧 Technical notes:**
- `accessLevel` is a new field on the Sanity `courses` schema; defaults to `"members"`. All existing courses without this field treat it as `members`-level via `?? "members"` fallback in the page.
- `linkedCourses` on programs is an **array of references** (not a single ref). The GROQ filter is `$courseSlug in linkedCourses[]->slug.current`. Early sessions used `linkedCourse` (singular) — this was corrected before any content was added, so no data migration was needed.
- Access check for `registration_required` courses: (1) query Sanity — `*[_type == "programs" && $courseSlug in linkedCourses[]->slug.current]` to get program slugs; (2) `db.registration.findFirst` for active registration matching any of those slugs for this userId; (3) fall back to `db.courseAccess.findUnique`. 2–3 DB/Sanity queries only on `registration_required` courses; `members` courses skip all this.
- Reverse GROQ reference in `allCoursesWithLinkedProgramsQuery`: `*[_type == "programs" && ^._id in linkedCourses[]._ref]` — `^._id` refers to the outer course document's `_id`. This finds all programs that have a reference to the current course in their `linkedCourses` array.
- `CourseAccess` Prisma model: `@@unique([userId, courseSlug])` — upsert-safe (POST uses `upsert` to avoid duplicate errors); `grantedBy` stores the granting admin's userId for audit trail.
- `computeStatuses()` is a pure function in `CourseAccessSection` — derives badges from: `course.accessLevel`, `activeRegSlugs` (Set of program slugs the member is actively registered for), and `grantsMap` (Map of courseSlug → grant). No extra API calls.
- `courseUIState` uses per-slug keys so multiple courses can be in different states simultaneously (one course showing "confirming_revoke" while another is "busy").
- The course page existed before this system — it uses Webflow CSS (`course-header`, `f-container-regular`, etc.). The `ca-` CSS prefix is for `CourseAccessSection` only. The course page itself has no custom prefix block.
- `essential-dharma-study-resources` — `accessLevel` set to `members` in Sanity Studio; all logged-in members can view it with no grants or registrations required.

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

**What it does:** Members can cancel their own registration from the My Programs page (`/account/dashboard-my-registrations`). This covers active registrations (REGISTERED, APPROVED, or WAITLISTED status). Once cancelled, the registrar is automatically notified by email and can decide who to promote from the waitlist.

**Member flow:**
1. Visit My Programs (`/account/dashboard-my-registrations`)
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
- `app/account/dashboard-my-registrations/page.tsx` (MODIFIED) — imports and renders `<CancelRegistrationButton>` in `<div className="mr-card__actions">` for REGISTERED, APPROVED, WAITLISTED cards
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
- **Volunteer index** (`/volunteer`): green "↑ Spot open · N waiting" badge on the program card — distinct from the amber "N waitlisted" badge shown when full. Program card also gets `vol-card--attention` highlighting.
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
- `app/volunteer/page.tsx` — `spotOpened` + updated `needsAttention`, `vol-signal--spot-open` badge, conditional waitlist badge
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

**Staff workflow:** Open Sanity Studio → Programs → [program] → Schedule tab → fill in Start Date & Time (and optionally End Date & Time). Save and publish. Links will appear automatically in subsequent confirmation emails and on the program page.

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

| 2026-03-03 | Member dashboard redesign (session 15): Redesigned `/account/dashboard` as a visual hub with 5 nav cards (`db-` CSS extensions); created `My Programs` page (`/account/dashboard-my-registrations`, `mr-` prefix) — new feature showing member registration history with status badges, waitlist position, and pending dana prompts; new `GET /api/account/registrations` endpoint; `programsBySlugArrayQuery` GROQ query for batch slug lookup; rebuilt `My Library` (`ml-`), `My Profile` (`mp-`), `Community Agreements` (`mc-`) with 🟢 design system (dropped all Webflow classes); added "My Programs" link to Nav.tsx (desktop dropdown + mobile flat list); updated FEATURES.md Section 6 + pages-inventory.md (14/31 🟢) |
| 2026-03-04 | Nav component rebuild (session 16): Complete rewrite of `components/Nav.tsx` — eliminated all Webflow structural classes (`w-nav`, `w-dropdown`, `w-nav-menu`, `w-nav-button`, etc.); deleted `public/nav.js` (Webflow JS hamburger handler); new `nav-` CSS prefix block in `custom.css`; sticky header (`position: sticky`); desktop dropdowns via CSS `hover + focus-within` (no JS); React `useState` hamburger with 3-bar → X animation; closes on route change + Escape key; `isMemberArea` flag switches between minimal member nav and full public nav; `isAdmin` controls Admin dropdown visibility. Nav polish: Quincycf 500 brand name, `--rim-text` (#333) color; Open Sans 500 links; no borders anywhere (color contrast only); nav height 90px; hover states set both `color` and `background` explicitly; mobile menu overhauled — `--rim-bg` warm background, `--rim-bg-accent` separator lines between items, pill donate button; Added Section 16 to FEATURES.md; updated Section 10 CSS prefix table; updated MEMORY.md + session-log.md |
| 2026-03-04 | Sanity Studio access for staff (session 18): `sanityInvitedAt DateTime?` on User model (db push); new `POST /api/admin/members/[id]/sanity-invite` — ADMIN-only, calls Sanity Management API to invite member as editor, stamps invite date; PATCH route updated to auto-revoke Sanity access when REGISTRAR role is removed — calls `revokeSanityAccess()` async (removes from project members + cancels pending invitations, clears `sanityInvitedAt`), returns `sanityRevoked: true`; MemberDetail: Sanity Studio Access panel below roles (invite button with two-step confirmation showing explanation + Yes/Cancel; ✓ invited date once sent; revocation warning in save bar when REGISTRAR is being removed); dashboard `STAFF_LINKS` updated — Sanity Studio external card for REGISTRAR + ADMIN, `<a target="_blank">` for external vs `<Link>` for internal; Section 2 updated (roles table shows dashboard links, role assignment via UI documented); Section 11 dashboard integration updated; Section 18 added (full feature doc). ⚠️ Requires `SANITY_MANAGEMENT_TOKEN` in Vercel. Commits: deb0b97, 5e97804. |
| 2026-03-04 | Sanity Studio access debugging (session 19): Fixed invite endpoint URL — Sanity uses `/invitations/project/{id}` not `/projects/{id}/invitations` (404 → working); fixed `SANITY_MANAGEMENT_TOKEN` role — must be **Developer** (highest available), not Editor/Administrator (403 "missing required grant sanity.project.members/invite"); improved error surfacing in invite route (raw text fallback instead of silent `{}`); made `revokeSanityAccess()` blocking (was `void`), returns `{ member, invite, memberEmails }` for debugging; fixed invitation revocation response shape (array or `{invitations:[]}`); confirmed pending-invite cancellation works end-to-end; confirmed accepted-member removal endpoint path is still unresolved (all tried paths 404); documented owner limitation (project owner cannot be removed via API) and email-mismatch risk (registrar accepts invite with different Sanity account email). Section 18 prerequisites, technical notes, and last-updated updated. |
| 2026-03-04 | Registration form UX + security hardening (session 17): (1) Sanity program category field UX — added description, `disableNew: true`, `filter: "hideFromProgramsPage != true"` so the dropdown shows immediately; renamed `hideFromProgramPageList` title + added description; Sanity deployed. (2) Fillout legacy removal — removed `registrationRequired`, `filloutRegistrationFormId`, `signedOutInstructions`, `signedInInstructions` from programs page, GROQ queries, and Sanity schema; wired `registrationClosed` boolean into built-in form path (combines with `registrationDeadline` check); commit fa1464e. (3) Email recognition — new `GET /api/account/check-email` (public, returns name/phone/agreedToTerms for known emails); `handleEmailBlur` in RegistrationForm pre-fills from account and shows "Welcome back, [Name]!" notice; pre-fill logic uses account values first (`data.firstName || prev.firstName`); commits 08fe82d → eadb5e7 → 16aca2e. (4) Security — name + phone fields locked `readOnly` in form when recognized account found (`emailCheckStatus === "found"`); API introduces `resolvedFirstName`, `resolvedLastName`, `resolvedPhone` — account stored values always win for existing users regardless of form submission; `pg-form__input[readonly]` + `pg-form__input--locked` CSS; commits ef515d6 + 7b75eba. (5) Dana $0 bug fix — `effectiveDanaMode` sent to API is `"none"` when fixed/base amount not configured (→ `donationStatus: WAIVED`); `hasConfiguredAmount` guard skips dana step in form; commit acbdadd. (6) Documentation — FEATURES.md Sections 4a, 4c, 8, 9 updated; new Section 17 (Planned Features) added with 17a (automated dana follow-up cron), 17b (member cancellation self-service), 17c (self-service email change cross-ref). |
| 2026-03-04 (session 20) | Add-to-calendar links (17e), resend confirmation email (17g), CSV export doc (17h already built): New `lib/calendarLinks.ts` — `buildGoogleCalendarUrl`, `buildIcsUrl`, `buildIcsContent` utilities; Sanity programs schema gains `startDatetime` + `endDatetime` datetime fields in schedule group (calendar links only appear when startDatetime is set — recurring programs leave it blank); Sanity Studio deployed. New `GET /api/programs/[slug]/ical/route.ts` returns RFC 5545 `.ics` file for Apple/Outlook download. `lib/email.ts` adds `googleCalendarUrl` + `icsUrl` to `RegistrationEmailData` — calendar links block rendered in HTML email (Google Calendar + Apple/Outlook links, waitlisted registrations excluded); `lib/queries.ts` adds `startDatetime`/`endDatetime` to `programBySlugQuery` + new `programConfirmationDataQuery`. `app/api/registrations/route.ts` fetches `startDatetime`/`endDatetime` from Sanity and passes calendar links to confirmation email. `app/programs/[slug]/page.tsx` shows "+ Google Calendar" and "+ Apple / Outlook" links below "✓ You're registered." when startDatetime is set. `components/VolunteerTable.tsx` adds "Resend Confirmation" action button for REGISTERED/APPROVED rows — two-step inline confirm dialog ("Resend confirmation to [firstName]?"), calls PATCH `action: "resendConfirmation"`; `app/api/registrations/[id]/route.ts` adds resendConfirmation action (fetches Sanity program data, builds calendar links, calls `sendRegistrationEmail`). CSV export (17h) confirmed already built in earlier session — `GET /api/programs/[slug]/registrations?format=csv` with dynamic custom field columns; VolunteerTable CSV button already present. CSS: `.pg-calendar-links`, `.pg-calendar-link`, `.vol-action-btn--resend`. FEATURES.md sections 17e, 17g, 17h updated to ✅ Built. Commit: 2da2796. |
| 2026-03-05 (session 21) | Calendar recurrence + Google Meet planning: Added `recurrencePattern` string-select field to Sanity (15 options: daily/weekly/monthly variants). `lib/calendarLinks.ts` gains `buildRRule()` + `describeRecurrence()`. Renamed Sanity `zoomLink`/`zoomLinkText` titles to "Meeting Link" / "Meeting Button Text". Added FEATURES.md Section 19 (Google Meet Integration full spec). Sanity deployed. Commits: 544ddb1, ad5e472. *Note: recurrencePattern immediately superseded in session 22 — see below.* |
| 2026-03-05 (session 22) | Zoom-style recurrence fields: Replaced the fixed 15-option `recurrencePattern` select with four structured fields that give unlimited flexibility — identical to how Zoom and Google Calendar handle recurring events. **Sanity schema** (`programs.js`): `recurrenceFreq` (radio: Daily / Weekly / Monthly; blank = single event), `recurrenceInterval` (number: "every N days/weeks/months"), `recurrenceDays` (array checkboxes: SU MO TU WE TH FR SA — hidden unless Weekly), `recurrenceCount` (number: total sessions including first). Fields show/hide conditionally so the form stays clean — `interval` and `count` hidden when no freq set, `days` hidden unless weekly. **`lib/calendarLinks.ts`**: `CalendarEvent` interface gains the 4 fields; `buildRRule()` rewritten to compose full RFC 5545 RRULE — `FREQ` + optional `INTERVAL` + optional `BYDAY` (weekly only) + `COUNT`; `describeRecurrence()` signature changed from `(pattern)` to `(freq, interval, days, count)` — returns `{ googleLabel, icsLabel }` for UI. **All consumers updated**: `lib/queries.ts` (`programBySlugQuery` + `programConfirmationDataQuery`); `app/api/programs/[slug]/ical/route.ts`; `app/api/registrations/route.ts` (inline GROQ); `app/api/registrations/[id]/route.ts` (resendConfirmation); `app/programs/[slug]/page.tsx` (Program interface + IIFE in JSX). TypeScript clean, Sanity Studio deployed, committed 85666df. **Example RRULEs**: daily/3 → `RRULE:FREQ=DAILY;COUNT=3`; weekly Wed/4 → `RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=4`; bi-weekly Sat/12 → `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=SA;COUNT=12`. Apple/Outlook .ics includes full RRULE (all sessions); Google Calendar URL shows first session only (GCal URL format limitation) — labels differentiate clearly. |

---

## 18. Sanity Studio Access for Staff

**What it does:** When a member is granted the REGISTRAR (or ADMIN) role, an admin can send them an invitation to Sanity Studio — the CMS where site content, programs, and courses are managed. The invitation is sent via the Sanity Management API and gives them Editor-level access. Their member dashboard automatically shows a "Sanity Studio" link in the Staff Access panel as soon as the role is saved. Removing the REGISTRAR role automatically revokes their Sanity access.

**Who uses it:**
- **Admins** — send invitations and revoke access from the member detail page
- **Registrars** — receive the invitation, accept it in Sanity, then find the studio link on their dashboard whenever they need it

### Admin flow (granting access)

1. Go to `/admin/members/[id]` for the member
2. Check the **REGISTRAR** checkbox in the Roles section
3. Click **Save changes** — a "Sanity Studio Access" panel appears below the roles list
4. Click **Invite to Sanity Studio**
5. A confirmation dialog appears: "This will send an email invitation from Sanity to [email]. They will receive Editor access and can edit site content in Sanity Studio."
6. Click **Yes, send invite** — Sanity sends an invitation email to the member
7. The panel updates: "✓ Invited on [date]"

The invite section only appears after the REGISTRAR role has been saved — not just checked. This prevents accidentally sending an invite before confirming the role assignment.

### Member flow (accepting access)

1. Member receives an email from Sanity (sender: `no-reply@sanity.io`) with an invitation link
2. They click the link and create or log in to their Sanity account
3. They now have Editor access to the `rooted-in-mindfulness` Sanity project
4. Their RIM dashboard shows a "Sanity Studio" card in the Staff Access panel → links to `https://rooted-in-mindfulness.sanity.studio/`

### Revoking access

When the REGISTRAR role is unchecked and saved for a member who was previously invited:

1. The save bar shows a warning: "⚠ Saving will also revoke this member's Sanity Studio access."
2. Admin clicks Save — the PATCH API automatically:
   - Clears `sanityInvitedAt` from the DB (removes the invite date display)
   - Calls Sanity Management API to remove them from project members (if they accepted)
   - Cancels any pending invitations (if they never accepted)
3. The Sanity Studio card disappears from their dashboard
4. They can no longer access Sanity Studio

Revocation is non-blocking: the DB is updated first, then the Sanity API call fires asynchronously. A Sanity API failure does not prevent the role change from saving.

### Dashboard link

The "Sanity Studio" card appears in the Staff Access panel for any user with REGISTRAR or ADMIN role. It opens `https://rooted-in-mindfulness.sanity.studio/` in a new tab. The card is always visible once the role is set — the invite step is separate from the link appearing.

### Prerequisites

**A Sanity Management Token is required** — different from the content API token. The content token (`SANITY_API_TOKEN`) can read/write Sanity data but cannot manage project members. Steps to create:

1. Go to `https://manage.sanity.io/` → Project `xxgvfpjf` → **API** → **Tokens** → **Add API token**
2. Name: "RIM Next Management" · Role: **Developer** (highest available; required for the `sanity.project.members/invite` grant)
3. Add to Vercel: `SANITY_MANAGEMENT_TOKEN=<token>` ✅ Done 2026-03-04

Without this token, the invite button returns a 500 error with "Sanity management token not configured." The rest of the site functions normally.

Note: The Developer token is a **server-side secret** stored only in Vercel env vars — it is never exposed to the client. Invited users receive **Editor** role in Sanity (can edit and publish content; cannot manage project settings or invite others). The Developer token is only used by our API route to send invitations.

### Key files

- `app/api/admin/members/[id]/sanity-invite/route.ts` — POST: sends Sanity invitation, stamps `sanityInvitedAt`
- `app/api/admin/members/[id]/route.ts` — PATCH: detects REGISTRAR removal, calls `revokeSanityAccess()`, clears `sanityInvitedAt`, returns `sanityRevoked + sanityRevokeResult`
- `components/MemberDetail.tsx` — Sanity Studio Access panel (invite button + confirmation dialog + revocation warning in save bar)
- `app/account/dashboard/page.tsx` — `STAFF_LINKS` includes Sanity Studio for REGISTRAR + ADMIN
- `prisma/schema.prisma` — `sanityInvitedAt DateTime?` on User model

### 🔧 Technical notes

- **Invite API endpoint:** `POST https://api.sanity.io/v2021-10-04/invitations/project/{projectId}` with body `{ email, role: "editor" }`. Note: invitations use `/invitations/project/{id}` not `/projects/{id}/invitations`.
- **Invite vs. member:** The invite API creates a pending invitation (email sent). Revocation handles both states: cancel pending invitation via `DELETE /invitations/project/{projectId}/{inviteId}`, or remove accepted member (see note below).
- **⚠️ Members API path unresolved:** The Sanity Management API endpoint for listing/removing accepted project members has not been confirmed. Paths tried and returning 404: `/v2021-10-04/projects/{id}/members`, `/v2021-06-07/projects/{id}/members`, `/v2021-10-04/access/projects/{id}/members`, `/v2021-06-07/access/projects/{id}/memberships`, `/v1/access/projects/{id}/memberships`. Pending-invite cancellation (confirmed working) covers the most common revocation scenario. Member removal revocation should be tested with a non-owner account when a real registrar is onboarded.
- **Project owner limitation:** The project owner's Sanity account cannot be removed via the Management API regardless. Testing revocation against the project owner's account will always fail.
- **Email mismatch risk:** The invite is sent to the registrar's RIM email. If they accept using a pre-existing Sanity account with a different email (e.g. a personal iCloud address), the member lookup by email will fail to find them. This is an edge case for registrars who already have Sanity accounts.
- **`sanityInvitedAt`:** Tracks when the invite was sent, not when it was accepted. We don't have a webhook from Sanity for acceptance. The invite date is shown as a confirmation that the invite was dispatched.
- **Confirmation dialog:** The invite button does not fire immediately. It toggles `confirmingInvite` state to show an explanation ("This will send an email invitation from Sanity to [email]...") with Yes/Cancel before any API call is made.
- **`savedRoles` vs. `roles`:** The Sanity section is conditionally rendered based on `savedRoles` (what's in the DB), not the local `roles` checkbox state. This prevents the invite section from appearing before the user has saved the REGISTRAR role. After a successful save, `setSavedRoles(roles)` syncs them.
- **Revocation warning in save bar:** Computed as `savedRoles.includes("REGISTRAR") && !roles.includes("REGISTRAR") && !!sanityInvitedAt`. If all three conditions are true, a yellow warning appears above the Save button before anything is committed.
- **Blocking revocation:** `revokeSanityAccess()` is awaited before the response is returned. The result is included in the response as `sanityRevokeResult: { member, invite, memberEmails }` for debugging. The DB role change succeeds regardless of Sanity API outcome.

---

## 19. Google Meet Integration ✅ Built — commit ca0068e (2026-03-05)

**What it does:** Replaces Zoom with Google Meet for all virtual programs. Registrars/Admins click "Create Google Meet" on the volunteer programs page. The app automatically detects an available room account (checking the shared RIM Programs calendar for conflicts), creates a Meet space owned by that account, adds a calendar event, and writes the Meet link and assigned room account back to Sanity. The link appears on the program page, in confirmation emails, and in reminder emails without any copy-pasting. The **Meet Host** team logs into the assigned room account to get host controls.

**Why this matters:**
- Eliminates Zoom costs and 40-minute limits for a nonprofit on Google Workspace
- The shared "RIM Programs" Google Calendar becomes a live view of all upcoming virtual programs for all staff — no scheduling conflicts
- Meet links auto-generate; links never expire
- The rotating host team sees exactly which account to sign into — no fixed assignment needed
- Can be tested before DNS cutover — fully functional on rim-next.vercel.app

**Who uses it:**
- **Registrars/Admins** — click "Create Google Meet" on the volunteer programs page; app assigns a room and writes the link to Sanity
- **Meet Host team (HOST role)** — check `/hosts` to see which room account is assigned to each virtual program; log in as that account before the session to get host controls
- **Members** — receive the Meet link in confirmation + reminder emails; see it on the program page

---

### Architecture: Virtual Room + Shared Account Model

**The problem with a single account:** One Google account cannot host two simultaneous meetings. If RIM runs a 7pm drop-in and a 7pm community group on the same night, a single `programs@rootedinmindfulness.org` account cannot own both.

**The solution — Virtual Rooms:** A small pool of dedicated accounts that act as permanent "meeting rooms":
- `meet-community-group@rootedinmindfulness.org`
- `meet-core-programs@rootedinmindfulness.org`
- `meet-community-silent-meditation@rootedinmindfulness.org`

The app assigns whichever room is free for a given time slot (checking the shared calendar for conflicts). Whoever logs in as that account when the session starts automatically owns the meeting with full host controls.

**Why not pre-assign a volunteer as co-host?** The original design used `spaces.members.create` to pre-assign a specific volunteer's email as COHOST at meeting creation time. This was removed — RIM's host team is rotating and the host for a particular session isn't decided at program setup time. The room account model is simpler: the host team sees which account to use on the `/hosts` page, logs in as that account, and has full host controls automatically. No fixed assignment needed.

---

### Staff workflow

1. Create/publish program in Sanity Studio — fill in Start Date & Time, End Date & Time
2. In `/volunteer/programs/[slug]`, click **"Create Google Meet"**
3. App finds an available room account, creates the Meet space, creates a calendar event on the shared RIM Programs calendar, and writes the Meet link + assigned room account back to Sanity
4. Meet link appears in the program details card and goes out in all emails
5. Host team checks `/hosts` to see which room account is assigned; they sign in as that account before the session starts
6. Host controls (blue shield) appear automatically because they're logged in as the room account that owns the meeting

---

### Technical notes

- **DWD impersonation:** The service account (`rim-programs-bot@rim-programs.iam.gserviceaccount.com`) impersonates the chosen room account via JWT + Domain-Wide Delegation. This makes the room account the meeting owner without any human logging into it.
- **Room selection:** `findAvailableRoom()` queries the shared Google Calendar for each room account's events in a ±15-minute window. Returns the first room with no conflicts; throws a 409 if all rooms are occupied.
- **Meet REST API scope:** `https://www.googleapis.com/auth/meetings.space.settings` + `https://www.googleapis.com/auth/calendar.events` — both granted in DWD config.
- **Meet creation:** `spaces.create` with `{ config: { accessType: "TRUSTED", entryPointAccess: "ALL" } }` — TRUSTED means anyone with a `@rootedinmindfulness.org` account can join without waiting to be admitted.
- **Co-host pre-assignment removed:** `spaces.members.create` was removed entirely from `lib/google-meet.ts`. The room account IS the host — no volunteer email needed at meeting creation.
- **`meetHostAccount` Sanity field:** A `readOnly` string field on the `programs` schema stores the assigned room email. Written by the API route alongside `zoomLink`. Displayed in the CreateMeetButton done state (volunteer programs page) and on the `/hosts` page (host team reference).
- **Free tier fallback:** If `spaces.create` with moderation config returns a 403, the code falls back to a plain space. Trusted access type handles entry without friction. A notice is shown in the CreateMeetButton if the fallback triggered.
- **`GOOGLE_PRIVATE_KEY`** contains newlines — stored as raw value in Vercel (not base64); Next.js handles multiline env vars correctly.
- **Sanity write-back** uses `SANITY_API_TOKEN` which already has write access — no new token needed.

### Key files ✅ Built — commit ca0068e, updated session 27 (2026-03-05)

- `lib/google-meet.ts` — DWD JWT auth, `findAvailableRoom()` via calendar conflict check, `createMeeting()`: spaces.create → calendar event; returns `{ meetLink, calendarEventId, roomEmail }`
- `app/api/programs/[slug]/google-meet/route.ts` — POST (REGISTRAR/ADMIN); 409 on no room; Sanity write-back of `zoomLink`, `zoomLinkText`, `meetHostAccount`; returns `{ meetLink, roomEmail }`
- `components/CreateMeetButton.tsx` — "use client" 4-state (idle/loading/done/replace); shows assigned room account in done state; `vol-meet-` CSS prefix
- `app/volunteer/programs/[slug]/page.tsx` — GROQ extended with `startDatetime`, `endDatetime`, `zoomLink`, `meetHostAccount`; CreateMeetButton above VolunteerTable
- `lib/queries.ts` — `hostProgramsQuery` (all programs with a Meet link, incl. `meetHostAccount`)
- `app/hosts/page.tsx` — Host Area page (HOST | REGISTRAR | ADMIN access; see §21)
- `public/css/custom.css` — `vol-meet-` styles + `hs-` host area styles

### Environment variables (all set in Vercel)

| Variable | Value |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `rim-programs-bot@rim-programs.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Full RSA private key from service account JSON |
| `GOOGLE_CALENDAR_ID` | Shared "RIM Programs" calendar ID |
| `GOOGLE_ROOM_EMAILS` | Comma-separated room account emails |

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

#### Chapter 2 — Setting Up Programs in Sanity Studio
**Subtitle:** How to create and manage programs — every tab and field explained.

Covers all 6 Sanity Studio program tabs with field-by-field documentation in a visual table format:

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
| Sanity Studio access | Why it's separate, who needs it, how to invite, Editor access, if invite doesn't arrive |
| Removing a role | Uncheck and save; warning when Sanity access is involved; effect on pending vs accepted invites |
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

**What it does:** A lightweight volunteer role for the Google Meet host team. Members with the HOST role get access to `/hosts` — a dedicated page showing every virtual program that has a Google Meet link assigned, along with which room account to log into for each session to get host controls. The host team uses this as their starting point before every virtual session.

**Who uses it:** The rotating volunteer host team — people who facilitate RIM's virtual sessions on Google Meet. They are not registrars; they don't manage registrations or member data. Their job is to be present before the session, sign into the right account, and hold the meeting container.

---

### What HOST can access

| Area | HOST | REGISTRAR | ADMIN |
|---|---|---|---|
| Host Area `/hosts` | ✓ | ✓ | ✓ |
| Volunteer Manual `/admin/manual` | ✓ | ✓ | ✓ |
| Volunteer dashboard `/volunteer` | | ✓ | ✓ |
| Member management `/admin/members` | | ✓ | ✓ |
| Sanity Studio (external) | | ✓ | ✓ |

---

### User flow — getting a host set up

1. Admin assigns the HOST role via `/admin/members` → member detail page → Roles section → check "Meet Host" → Save changes
2. Host receives an automatic notification email: "You've been added as a Meet host — Rooted In Mindfulness." The email links to `/hosts` and includes an outline button "Read the Volunteer Manual →"
3. Host bookmarks `/hosts` as their starting point for every session

### User flow — before each session

1. Host visits `/hosts` and finds their program
2. The page shows which room account is assigned (e.g. `meet-community-group@rootedinmindfulness.org`)
3. Host signs into that account in their browser as a secondary account — no need to log out of their own
4. Host clicks the **Join on Google Meet** link for the program a few minutes before the session
5. They see the blue host shield — meaning they have full host controls (mute all, remove participant, end meeting for everyone)
6. At session end: click the red button → **End meeting for all** → switch back to personal account

---

### The `/hosts` page

- **Route:** `app/hosts/page.tsx` — server component
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
- **Content:** What the Meet Host role means, link to `/hosts`, outline button "Read the Volunteer Manual →"
- **Implementation:** `sendHostRoleAssignmentEmail()` in `lib/email.ts` — mirrors `sendRoleAssignmentEmail()` pattern; fire-and-forget in the PATCH route

---

### Key files

- `prisma/schema.prisma` — `HOST` added to `Role` enum (before REGISTRAR)
- `app/hosts/page.tsx` — Host Area server component; `hs-` prefix
- `lib/queries.ts` — `hostProgramsQuery`
- `lib/email.ts` — `sendHostRoleAssignmentEmail()`, `buildHostRoleAssignmentHtml()`, `buildHostRoleAssignmentText()`
- `app/api/admin/members/[id]/route.ts` — `addingHost` detection (mirrors `addingRegistrar`) → fire-and-forget notification
- `components/MemberDetail.tsx` — HOST first in `ALL_ROLES`; role description; role gate hint updated ("volunteer area")
- `app/account/dashboard/page.tsx` — HOST entry in `STAFF_LINKS`: Host Area + Volunteer Manual cards
- `proxy.ts` — `/hosts` and `/hosts/:path*` added to matcher
- `app/admin/manual/page.tsx` — access gate updated to include HOST; overview text updated; sidebar link text updated

### 🔧 Technical notes

- HOST is the lightest role — two pages only (`/hosts` and `/admin/manual`)
- Role checks happen inside the page components, not in `proxy.ts`. Proxy handles login/terms/archived redirects only; role enforcement is per-page (same pattern as REGISTRAR-gated pages)
- REGISTRAR and ADMIN can also view `/hosts` — useful for registrars who also host, and for admins monitoring the system
- No Sanity Studio access for HOST — unlike REGISTRAR, there is no Sanity invite panel on HOST member detail pages
- The HOST email does NOT mention Sanity Studio (unlike REGISTRAR email which documents the separate invite step)
- HOST members see "Volunteer Access" (not "Staff Access") in their dashboard section header — the same label used for REGISTRAR and ADMIN

---

| 2026-03-05 (session 23) | Staff reference manual + role cleanup. **(1) Staff manual:** Complete build of `/admin/manual` — two-chapter reference guide with sidebar navigation. Chapter 1 (Registration Management): 9 sections covering the complete registrar workflow (volunteer table, statuses, promoting from waitlist, inline edits, edit request emails, reminders, resend confirmation, CSV export, common scenarios). Chapter 2 (Programs & Sanity Studio): 11 sections covering all 6 Sanity tabs with field-by-field `man-field-list` tables, a "How a program comes together" anatomy section with min-to-max checklist, and common task walkthroughs. CSS: added all missing `man-` classes that were defined in JSX but had no CSS (`man-section__h3`, `man-field-list`, `man-field`, `man-field__name`, `man-field__desc`, `man-content code`, `man-chapter--break`); responsive stacking for `man-field` on narrow viewports. Files: `app/admin/manual/page.tsx` (complete rewrite), `public/css/custom.css` (`man-` block). Commits: e6e9888, 328c1d8, b6003d4. **(2) Role simplification:** Removed TREASURER, TEACHER, VOLUNTEER from the system — they were defined speculatively with no functionality attached. Only ADMIN and REGISTRAR remain. Files: `prisma/schema.prisma` (Role enum), `components/MemberDetail.tsx` (ALL_ROLES + descriptions), `components/MembersTable.tsx` (RoleFilter type, badge map, label map, filter dropdown), `app/admin/roadmap/page.tsx` (TEACHER/VOLUNTEER wiring item removed, TREASURER desc updated), `app/admin/sitemap/page.tsx` (role lists updated). DB was already clean — no existing members had those roles; `prisma db push --accept-data-loss` confirmed no data loss. Commit: 75cad53. **(3) Docs:** FEATURES.md Section 2 (role table trimmed), Section 10 (man- CSS prefix added), Section 11 (stale role refs cleaned), Section 20 (Staff Reference Manual, new); Session Log updated; MEMORY.md updated. |
| 2026-03-05 (session 25) | Registrar role assignment notification email. `sendRoleAssignmentEmail()` added to `lib/email.ts` — fires when REGISTRAR is newly added in the member PATCH route; links to `/volunteer` + `/admin/manual`; fire-and-forget, no re-send on subsequent saves. Minimal Chapter 3 "Staff & Roles" added to `/admin/manual` with one section ("Notifying new staff") explaining the automatic email and distinguishing it from the separate Sanity Studio invite step. Sidebar updated — "Staff & Roles" now a real link, no longer a "Coming soon" badge. FEATURES.md Section 2 updated. Commit: 4c13318 (code) + [docs commit]. |
| 2026-03-05 (session 24) | Member self-service cancellation (17b) + spot-opened alerts + capacity notices (17d). **(17b)** New `POST /api/account/registrations/[id]/cancel` — auth check → ownership check (403 if not their registration) → status guard (400 if already CANCELLED) → `db.registration.update({ status: "CANCELLED" })` → fire-and-forget `sendCancellationNotificationEmail()`. New `components/CancelRegistrationButton.tsx` ("use client"; 4-state machine: idle/confirming/loading/done; on error → alert + revert to confirming). `app/account/dashboard-my-registrations/page.tsx` renders cancel button in `mr-card__actions` for REGISTERED/APPROVED/WAITLISTED cards. **(17d — spot-opened alerts)** `app/volunteer/page.tsx`: added `spotOpened` boolean (`!!cap && confirmedCount < cap && waitlistedCount > 0`) to `programsWithCounts`; `needsAttention` now includes `spotOpened`; green `vol-signal--spot-open` badge ("↑ Spot open · N waiting") renders before the amber waitlist badge (amber waitlist badge only shows when NOT spotOpened). `components/VolunteerTable.tsx`: derived `waitlistedCount` from `counts.WAITLISTED ?? 0`; `spotOpened` derivation (same logic); `vol-spot-opened` amber alert banner above registrations table when spot is open. **(17d — capacity notices on program page)** `app/programs/[slug]/page.tsx`: added `isFull` (`spotsRemaining === 0`) and `showLowSpots` (`spotsRemaining > 0 && spotsRemaining <= 5`) derivations; CTA section: "Join Waitlist" branch gets `pg-capacity--full` amber box notice; "Register" branch conditionally shows `pg-capacity--low` muted notice. **CSS added:** `vol-signal--spot-open` (green badge), `vol-spot-opened` (amber alert banner, left border accent in `--rim-mid`), `pg-capacity` (base notice style), `pg-capacity--full` (warm amber box), `pg-capacity--low` (plain muted text), `mr-card__actions` (border-top footer row), `mr-cancel-btn` (muted text-link), `mr-cancel-confirm` (warm red-tinted inline box), `mr-cancel-confirm__text`, `mr-cancel-confirm__actions`, `mr-cancel-btn--yes` (red danger), `mr-cancel-btn--keep` (neutral outline), `mr-cancel-done` (muted confirmation text). **Staff manual updated** (7fd8442): self-cancellation section added under "After registering"; spot-open badge documented in volunteer index; VolunteerTable spot-opened alert documented; promoting-from-waitlist task references new entry points; "Cancel as registrar" clarified vs member self-cancel. **Build note:** `npm run build` exits 1 locally (Stripe env var not in local .env — pre-existing, builds clean on Vercel); TypeScript compiled successfully. Commits: 08fb3a2 (features), 7fd8442 (manual docs). |

| 2026-03-05 (session 26) | Manual review + accuracy fixes + memory. **(1) Course access to REGISTRAR (f902dfa):** Opened `CourseAccessSection` UI to REGISTRAR role (removed `{isAdmin &&}` gate in `MemberDetail`); `GET /api/admin/courses`, `POST` and `DELETE` `/api/admin/members/[id]/course-access` now accept REGISTRAR in addition to ADMIN. Added "Grant or revoke course access for individual members" to REGISTRAR "can do" list in Chapter 3. Added full "Course access" section to Chapter 1 (sidebar link, intro, when-to-use-manual-grants, step-by-step how-to, note about registration vs manual grants being separate). **(2) Chapter subtitles rewritten (94712dd):** All three chapter openers rewritten from third-person "Who uses this chapter:" framing to direct second-person address ("This chapter walks you through…"). **(3) Manual audit and fixes:** Dashboard shortcuts table in Chapter 3: added missing Staff Manual row. Automatic emails section: added dana reminder email entry. Future editions section: updated Courses & Online Materials to note that admin-side course access is already covered in Chapter 1. **(4) FEATURES.md accuracy fixes:** §2 REGISTRAR dashboard links corrected (Members now included); §6b STAFF_LINKS table updated (both roles get all 4 cards); §7 Role enum corrected (TREASURER/TEACHER/VOLUNTEER removed); §7 technical notes updated; §8 course-access API routes updated to ADMIN or REGISTRAR; §11 access control and dashboard integration stale text corrected; §20 Chapter 1 sections table expanded to reflect current content, Chapter 3 added, technical notes and future chapters updated. |
| 2026-03-05 (session 27) | Google Meet architecture rework + HOST role + Host Area. **(1) Google Meet rework:** Removed volunteer email / COHOST pre-assignment model entirely — RIM's host team is rotating; you can't designate who will host at program setup time. Simplified `lib/google-meet.ts`: no `spaces.members.create`, no `volunteerEmail` param, no moderation step; `createMeeting()` now just creates space + calendar event and returns `{ meetLink, calendarEventId, roomEmail }`. API route writes `meetHostAccount: result.roomEmail` to Sanity alongside `zoomLink`. `CreateMeetButton` removes email input; done state shows assigned room account. **(2) Sanity schema:** Added `meetHostAccount` readOnly string field to `programs` schema (schedule group, after zoomLinkText). Deployed to Sanity Studio. **(3) HOST role:** Added `HOST` to Prisma `Role` enum (before REGISTRAR); DB pushed. `sendHostRoleAssignmentEmail()` added to `lib/email.ts`. PATCH route detects `addingHost`, fires notification fire-and-forget. `MemberDetail` adds HOST to `ALL_ROLES` (first) with description. Dashboard `STAFF_LINKS` adds HOST entry (Host Area + Volunteer Manual). `proxy.ts` matcher updated. **(4) Host Area page:** New `app/hosts/page.tsx` — server component; HOST | REGISTRAR | ADMIN access; fetches `hostProgramsQuery`; "How to host" guidance section + program cards (name, day/time, room account badge, join link); `hs-` CSS prefix. New `hostProgramsQuery` added to `lib/queries.ts`. `hs-` CSS block added to `public/css/custom.css`. **(5) Manual updates:** Access gate updated to include HOST; overview text updated to three roles; sidebar "The two roles" → "Volunteer roles"; "Assigning a role" note updated; "Notification email" section rewritten (HOST and REGISTRAR both trigger notification; HOST email links to /hosts + manual; REGISTRAR email links to /volunteer + manual; Admin silent). Chapter 3 section table updated. Commits: 9cc2959 (manual docs) + this session's feature commits. **(6) FEATURES.md:** §19 completely rewritten (simplified architecture, removed COHOST/co-host docs, updated key files, added room account env table). §20 updated (Chapter 3 section table, Discovery, access control line). §21 new (HOST role + Host Area, full feature doc). |

*Last updated: 2026-03-05 (session 27)*
