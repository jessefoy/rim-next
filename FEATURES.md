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
12. [Course Access System](#12-course-access-system-coursesslug)
13. [Donation Management System](#13-donation-management-system-phase-2--planned)

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
| `TREASURER` | Donation management area — view all donations, enter manual donations (planned, not yet active) |
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

**Key files:**
- `components/RegistrationForm.tsx` — client component, all form logic including the dana step
- `app/programs/[slug]/page.tsx` — server component; fetches capacity, user profile, existing registration, dana config; passes props to form
- `app/api/registrations/route.ts` — POST endpoint
- `lib/email.ts` — Resend email utility (`sendRegistrationEmail`)

**🔧 Technical notes:**
- Phone auto-formats as `(XXX) XXX-XXXX` while typing — `formatPhoneInput()` strips all non-digits then reformats, so any input format works
- Email is `readOnly` when the user is logged in (pre-filled from session, can't be changed in the form)
- `sessionUserId` is passed directly through the POST body so the API doesn't have to re-lookup the user by email (prevents account mismatch edge case)
- Custom field answers are stored as a JSON object `{ "Question label": "Answer" }` in the `customFields` column (Postgres `Json` type)
- `alreadyRegistered` is checked server-side for logged-in users only; guest duplicate prevention happens in the API by resolving the email to a userId first
- Form states: `idle | submitting | waitlisted | dana | dana_redirecting | done | error | duplicate` — "registered" was renamed to "done"; "dana" shows the contribution step; "dana_redirecting" disables the button while the Stripe session is being created
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

#### Enums
```
Role:               REGISTRAR | TREASURER | TEACHER | VOLUNTEER | ADMIN
RegistrationStatus: REGISTERED | WAITLISTED | APPROVED | CANCELLED
DonationStatus:     NOT_REQUIRED | PENDING | COMPLETED | WAIVED
DonationSource:     STRIPE | GIVEBUTTER | CASH | CHECK | OTHER
```

**🔧 Technical notes:**
- `db push` (not `migrate`) is used for schema changes — no migration history files
- To apply schema changes: `set -a && source .env.local && set +a && npx prisma db push`
- Roles migration from single `role` to array `roles` required raw SQL — Prisma couldn't handle the enum + column type change atomically. See session log 2026-03-01 in MEMORY.md for the exact SQL used
- `TREASURER` is already in the `Role` enum and live in the DB — added 2026-03-02

---

## 8. API Routes

| Method | Path | Auth | What it does |
|---|---|---|---|
| `POST` | `/api/registrations` | None required | Create a registration; finds/creates user by email if not logged in; fetches Sanity `confirmationMessage` for the program and includes it in the confirmation email |
| `PATCH` | `/api/registrations/[id]` | REGISTRAR or ADMIN | Update `status`, `notes`, `donationStatus`, or `customFields` (inline edit); `action: "sendEditRequest"` generates a token and sends the self-service edit email; `action: "sendReminder"` sends the program reminder email to the registrant and stamps `reminderSentAt`; on WAITLISTED→APPROVED promotion auto-sets `donationStatus` from `danaMode`; fires approval or cancellation email |
| `GET` | `/api/programs/[slug]/registrations` | REGISTRAR or ADMIN | List registrations for a program; add `?format=csv` for CSV download |
| `POST` | `/api/programs/[slug]/send-reminder` | REGISTRAR or ADMIN | Bulk send the program reminder email to all REGISTERED/APPROVED registrants where `reminderSentAt` is null; returns `{ sent: N }` |
| `GET` | `/api/cron/send-reminders` | CRON_SECRET header | Daily Vercel Cron handler (14:00 UTC). Finds all programs whose `reminderDate` falls in the past 24h window, then sends the reminder email to all unsent active registrants; returns `{ ok: true, sent: N }` |
| `POST` | `/api/stripe/checkout` | None required | Create a Stripe Checkout session for registration dana; returns session URL |
| `POST` | `/api/stripe/webhook` | Stripe signature | Receive `checkout.session.completed`; update registration donationStatus/amount |
| `POST` | `/api/update/[token]` | Token (no session) | Self-service response edit: validates `editToken` + expiry, updates `customFields`, clears token, sends registrar notification |

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
| **Registration** | Enabled toggle → Required/Closed flags → Capacity + Deadline → Signed-out/in instructions → Custom questions → Confirmation email message → Reminder date + reminder message → Legacy Fillout ID |
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

> **Note:** The old `suggestedDonation` field was replaced by the five new dana fields above. It has been removed from the Sanity schema (deployed 2026-03-02).

**danaMode reference:**
- `none` — No dana step shown at all. Registration is free.
- `voluntary` — Show `suggestedDana` as the default amount, fully editable. No minimum enforced. "Offer dana" and "I'll contribute another time" are both options.
- `base_plus_dana` — Show `danaBaseAmount` as a fixed required line item (venue/meals/etc.), plus an editable `suggestedDana` amount for voluntary dana on top. Total = base + dana.
- `fixed` — Show `danaBaseAmount` as a set price. No dana framing. Just a straightforward payment.

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
- `danaMode` defaults to `none` if not set — no dana step shown unless explicitly configured
- GROQ query for program pages must include all five dana fields: `danaMode, suggestedDana, danaBaseAmount, danaFixedAmount, danaMessage`

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
| `adm-` | Admin member management |
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

## 11. Member Management System (`/admin/members`)

**What it does:** An ADMIN-only area for viewing all members, editing their profiles, assigning/revoking staff roles, and importing members from Memberstack CSV export.

### Routes
- `/admin/members` — searchable member list with role filter and import tool
- `/admin/members/[id]` — member detail: edit name/phone, assign roles, view registration history

### Access control
- Protected at proxy level (`/admin/:path*` in `proxy.ts`)
- Server components check `session.user.roles?.some(r => r === "ADMIN")` — ADMIN-only, no REGISTRAR access

### Member list (`/admin/members`)
- Search bar (filters name + email client-side — fast, no round-trip)
- Role filter: All / Admins / Registrars / Treasurers / No roles
- Table: Name, Email, Roles (colored badges), Registrations count, Joined date
- Click any row → navigates to member detail page
- "Import from Memberstack" button → opens import panel inline

### Member detail (`/admin/members/[id]`)
- Profile section: edit firstName, lastName, phone (email is read-only — set by auth)
- Roles section: checkbox per role (ADMIN, REGISTRAR, TREASURER, TEACHER, VOLUNTEER) with descriptions
- Assigned roles appear as staff links on the member's dashboard automatically
- Registration history: list of all programs registered for, with status badges + link to volunteer table
- "Save changes" button PATCHes all changes in one call

### Dashboard integration
- `STAFF_LINKS` in `dashboard/page.tsx` refactored to `Record<string, {...}[]>` (array of links per role)
- ADMIN role now produces two cards: Registrations (`/volunteer`) + Members (`/admin/members`)
- Deduplication by `href` still works — no duplicate cards if a user holds both ADMIN + REGISTRAR

### Memberstack CSV import
- Client-side CSV parse — no library, handles quoted fields
- Column mapping (case-insensitive): Email, First Name / firstName, Last Name / lastName, Phone
- Preview: first 5 rows + total count before committing
- Upsert by email (lowercase normalized): found → fill blank fields only (never overwrite); not found → create
- Results: "X new · Y updated · Z skipped"
- One-time migration path: export from Memberstack dashboard → Members → Export → upload here

### Key files
- `app/admin/members/page.tsx` — member list server component
- `app/admin/members/[id]/page.tsx` — member detail server component
- `components/MembersTable.tsx` — list client component (search, filter)
- `components/MemberDetail.tsx` — detail client component (profile form, role checkboxes, registration history)
- `components/MemberImport.tsx` — CSV import client component
- `app/api/admin/members/route.ts` — GET (list)
- `app/api/admin/members/[id]/route.ts` — PATCH (update profile + roles)
- `app/api/admin/members/import/route.ts` — POST (CSV upsert)

**🔧 Technical notes:**
- Import runs rows sequentially (N+1 queries) — acceptable for one-time migration; optimize with batch upsert if needed
- `legacyMemberstackId` field exists on the User model — can be populated during import in the future for reconciliation
- Role validation in PATCH uses `Object.values(Role)` from `@prisma/client` — adding a new role to the Prisma enum automatically makes it valid here
- `STAFF_LINKS` format: `Record<string, { label, href, description }[]>` — each role maps to an array of links (allows ADMIN to show multiple cards without duplicates)

---

## 12. Course Access System (`/courses/[slug]`)

**What it does:** Member-gated course pages that list their lessons. Two access levels determine who can view a course. Access is enforced at the page level; `/courses/*` is also protected by `proxy.ts` (login redirect).

### Access levels (set on the Sanity course document)
| Level | Who gets in |
|---|---|
| `members` | Any logged-in user (default) |
| `registration_required` | Must have an active registration (REGISTERED or APPROVED) for a program linked to this course, OR an explicit admin grant in the `CourseAccess` DB table |

### Route
- `/courses/[slug]` — course page, lists all lessons as clickable cards; section-title lessons render as dividers

### Linking a program to a course
In Sanity Studio → Programs → [program] → Content tab → **Linked Course**. Once set, all members who register for that program automatically get access to the linked course (checked dynamically — no DB write at registration time).

### Manual admin grants
From `/admin/members/[id]` → Course Access section, an ADMIN can type a course slug and grant access. This creates a `CourseAccess` record in the DB.

### Key files
- `app/courses/[slug]/page.tsx` — server component; handles auth, access check, renders lessons list
- `app/api/admin/members/[id]/course-access/route.ts` — POST (grant) / DELETE (revoke) — ADMIN only
- `components/MemberDetail.tsx` — Course Access section (grant list, grant form, revoke buttons)
- `lib/queries.ts` — `courseBySlugQuery` (now includes `accessLevel`); `programsLinkedToCourseQuery`

**🔧 Technical notes:**
- `accessLevel` is a new field added to the Sanity `courses` schema; it defaults to `"members"`. All existing courses without this field set are treated as `members`-level (the `?? "members"` fallback in the page).
- Access check for `registration_required`: (1) query Sanity for program slugs with `linkedCourse->slug.current == courseSlug`, (2) query DB for a non-CANCELLED registration matching any of those slugs for this userId. This is 2 extra queries but only on `registration_required` courses.
- `CourseAccess` model: `@@unique([userId, courseSlug])` — upsert-safe; `grantedBy` stores the admin's userId for audit trail.
- `essential-dharma-study-resources` is set to `accessLevel: "members"` in Sanity — all logged-in members can view it. No import or per-member records needed.
- `co-` CSS prefix for course page styles.

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
| 2026-03-03 | Course access system: Sanity courses schema — added accessLevel field (members/registration_required, default members); Sanity programs schema — added linkedCourse reference field; Prisma CourseAccess model (userId + courseSlug unique, grantedBy, db push); proxy.ts adds /courses/:path* auth guard; new app/courses/[slug]/page.tsx (member-gated, dynamic-access-check for registration_required — queries Sanity for linked program slugs then checks DB for active registration, falls back to CourseAccess grant; co- CSS prefix); ADMIN course-access API POST/DELETE at /api/admin/members/[id]/course-access; MemberDetail Course Access section (list grants, grant-by-slug form, revoke button); lib/queries.ts — courseBySlugQuery now fetches accessLevel, new programsLinkedToCourseQuery; Sanity deployed; essential-dharma-study-resources set to accessLevel members in Sanity Studio (all logged-in members can access) |

---

*Last updated: 2026-03-03 (session 11)*
