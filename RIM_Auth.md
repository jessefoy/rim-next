# RIM Auth — Engineering Reference

**Per-area reference for the sign-in flow, session model, and rate limiting.**

Read this before working on anything in `/api/auth/*`, `auth.ts`, `lib/rateLimit.ts`, `lib/authRateLimits.ts`, `app/login/*`, `app/join/*`, `app/api/account/join/*`, or anything that touches sign-in, sign-up, or NextAuth callbacks.

Companion docs:
- `RIM_Stack_Reference.md` — the NextAuth row + the rate-limit row at a glance.
- `FEATURES.md` → **Foundations / Authentication & sign-in** — feature-level overview of the sign-in flow.
- `FEATURES.md` → **Foundations / Member area** — membership & onboarding (the three membership paths).
- `auth.ts` — the live NextAuth config.

---

## Two doors, one code flow

Sign-in and sign-up are two distinct surfaces over the same passwordless 6-digit code mechanism. Both doors share the same rate-limit windows via `lib/authRateLimits.ts` so alternating between them does NOT double an attacker's budget.

### Door A — `/login` (existing members)

1. User visits `/login`, enters their email
2. Server action calls `signIn("resend", { email, redirect: false })`, triggering `POST /api/auth/signin/resend`
3. NextAuth's Resend provider calls `generateVerificationToken` (we override it to a 6-digit code via `crypto.randomInt(100000, 1000000)`)
4. Our `sendVerificationRequest` callback sends an email via Resend containing the code (no magic link). Template branches on `emailVerified`: `sign-in-code-new-user` (warm welcome variant) if the user doesn't yet have an account OR has never completed a code verification; `sign-in-code-returning` (utility variant) otherwise.
5. User lands at `/login/check-email?email=<encoded>`, types the code
6. Form submits a GET to `/api/auth/callback/resend?token=CODE&email=EMAIL&callbackUrl=...`
7. NextAuth verifies the token against the `VerificationToken` table, sets the session cookie, redirects to `/account/dashboard`. The `app/account/(authenticated)/layout.tsx` route-group layout then enforces the agreement and archive gates: if `agreedToTerms` is `false` the user is redirected to `/account/welcome` for the threshold ritual; if `archivedAt` is set they're redirected to `/account/reactivate`.

### Door B — `/join` (new members, added session 132)

1. User visits `/join` (linked from Nav as "Become a Member"), reads the four Community Care Agreements in the integrated panel, fills first name + last name + email + optional phone, ticks the agreement checkbox, submits
2. Client POSTs to `/api/account/join`. Handler validates fields, applies rate-limits (same keys as Door A — see below), upserts the User with `agreedToTerms: true` + `agreedAt: now`
3. Handler calls `signIn("resend", { email, redirect: false })` — same code-issuance path as Door A. Since `emailVerified` is still `null` at this point (the User was just upserted; no verification has completed yet), the warm `sign-in-code-new-user` template fires. The user's first code email reads "Welcome to Rooted In Mindfulness," matching the threshold tone of the page they just left. Subsequent sign-ins flip to `sign-in-code-returning` because `emailVerified` is set on first successful verification.
4. In `after()` callbacks: a separate warm welcome letter is sent via the `join-welcome` template, and the user is enrolled in the onboarding course series via `enrollMemberInOnboardingSeries`
5. Client navigates to `/login/check-email?email=<encoded>` to type the code — same code-entry surface as Door A
6. NextAuth verifies, redirects to `/account/dashboard`. The `(authenticated)/` layout's agreement gate passes immediately (`agreedToTerms` is already `true` from the `/join` POST), the archive gate passes (`archivedAt` is null on a brand-new account), and the dashboard renders.

### Already-member soft-redirect

If `/api/account/join` finds an existing User with `agreedToTerms: true` at the submitted email, it returns `{ alreadyMember: true }` instead of duplicating the threshold ritual. The client navigates to `/login?email=...`; `/login` reads the `?email=` query param, pre-fills the input via `defaultValue`, and renders a calm one-liner ("It looks like you already have an account with us. Sign in to continue.") above the form.

**Why 6-digit codes instead of magic links.** Magic links route to the OS default browser regardless of where the user wants to be (a Safari user who prefers Chrome ends up authenticated in Safari with no way to "send to Chrome"). PWAs on iOS can't reliably receive magic-link clicks either. Codes work in every context because the user types them into the browser they're standing in. Industry-standard pattern (Slack, Apple, Mercury, Notion). Switched in session 119 (2026-05-21).

**Code expiry: 30 minutes.** Was 10 minutes in the first ship; bumped after users hit expiry on the walk-away-and-come-back pattern. 30 minutes is humane without expanding brute-force surface much (combined with rate-limiting, the math is fine — see below).

**Multiple unconsumed codes can coexist** per user. Each `signIn` call creates a fresh `VerificationToken` row; all are independently valid until consumed (single-use) or expired. Kept intentionally — Jesse uses this himself when he requests a new code after losing track of an earlier one.

**Session expiry: 90 days.** `updateAge: 24h` so the session cookie refreshes at most once per day on activity. Sign-in friction is once per device, not every visit.

---

## The 5 sign-in error states

When sign-in fails, NextAuth redirects to `/login/error?error=<code>`. The error codes the app renders calm copy for:

| Error code | When | Message rendered |
|---|---|---|
| `Verification` | Token mismatch / expired / already consumed | "That code is invalid or has expired. Please request a new one." |
| `Configuration` | Empty `?token=` at the callback (form bug) | "An error occurred during sign in. Please try again." (generic — this should not happen in practice; if it does, it's a form regression) |
| `RateLimit` | Rate-limit window exceeded (see below) | "You've made several sign-in attempts in a short time. Please wait a few minutes, then try again." |
| _everything else_ | Falls through to generic | "An error occurred during sign in. Please try again." |

Edit messages in `app/login/error/page.tsx`. Add new branches there when a new failure mode warrants distinct copy.

---

## Membership existence check on `/login` (session 132 follow-up)

`/login` is the door for existing members; `/join` is the door for new ones. To prevent a visitor from accidentally creating an account by typing an unknown email at `/login`, the sign-in flow checks for a `User` row BEFORE issuing a code. Two places enforce this, in defense-in-depth:

1. **`/login` page server action** (`app/login/page.tsx::handleSignIn`) — the primary UX gate. After validating the email format, runs `db.user.findUnique({ where: { email } })` and if no row exists, redirects to `/login?notMember=1&email=ENCODED` with a warm not-found panel and a "become a member →" link to `/join` (carrying the email forward).

2. **NextAuth catch-all wrapper** (`app/api/auth/[...nextauth]/route.ts`) — the API-level gate. For direct `POST /api/auth/signin/resend` requests that bypass the `/login` form (scripted callers, external POSTs), the same existence check runs after the rate-limit check. Unknown emails get a 303 redirect to the same `/login?notMember=1&email=…` page.

**Why both.** When the `/login` form is submitted, NextAuth's server-side `signIn()` runs in-process — no HTTP roundtrip to `/api/auth/signin/resend`, so the catch-all wrapper doesn't fire. The server-action check is therefore the FIRST line of defense for the form flow. The catch-all check covers everything else.

**Fail-safe behavior.** Both checks fail-safe on DB error: if the `findUnique` throws (Postgres hiccup, connection limit), the flow falls through to the standard handler. A real member during a transient DB blip is better served by getting their code than by being falsely told they don't have an account. The `(authenticated)/` layout still gates dashboard access on `agreedToTerms`, so the worst case is one extra User row that the 48h cleanup cron will sweep.

**Privacy disclosure.** This reveals whether a given email has a `User` row (different page content per email). The leak already exists via the public `/api/account/check-email` endpoint used by the program registration form's pre-fill, and for a community-membership site the UX win of "you typed an email we don't recognize → here's the door to membership" is worth the modest disclosure. For a banking-grade auth surface the calculus would be different.

**Rate-limit ordering.** The existence check happens AFTER the rate-limit check in both places. So a probe-the-DB-for-emails attack costs rate-limit budget per probe — bounded by 20 probes per IP per 10min via `signin-ip:<ip>`.

---

## Rate limiting (session 131; extended to `/join` session 132)

**Closes backlog `2026-05-21-002`.** Defense-in-depth for the public-launch surface.

**Door-sharing.** Both `/api/auth/signin/resend` (Door A) and `/api/account/join` (Door B) call `checkRateLimit` with keys produced by `lib/authRateLimits.ts`. Same key namespace, same thresholds. An attacker can't alternate between the two doors to double their per-window budget for a given email or IP.

### Two attack vectors

1. **Email bombing** — POST `/api/auth/signin/resend` repeatedly with a victim's email to spam their inbox with sign-in codes
2. **Brute-force code guessing** — POST `/api/auth/callback/resend` with code candidates against a known email (900K keyspace; without limiting, exhaustible in minutes at high request rate)

### Thresholds

| Surface | Per-email | Per-IP | Window |
|---|---|---|---|
| `signin/resend` (Door A — email send) | 5 | 20 | 10 min |
| `account/join` (Door B — email send) | 5 (shared key) | 20 (shared key) | 10 min |
| `callback/resend` (code verify) | n/a | 20 | 10 min |

**Why these numbers.** A real user retrying after a typo'd email triggers 2–3 sends in a session — well below 5. A botnet hammering one IP across many addresses hits the per-IP gate. For the code-verify path, 20 attempts per 10 minutes against a 900K keyspace means exhausting the space takes ~350 days at the limited rate (versus instant without limiting). Combined with the 30-minute code expiry per individual code, brute-forcing a *specific* code is also economically dead.

### Architecture

**Storage: Postgres-backed (Neon), not Upstash or in-memory.** RIM's sign-in volume is very low (<100/day expected). The ~5–10ms DB round-trip is negligible at that scale. Cross-instance enforcement without adding a new external service. In-memory would be too weak (each Vercel instance has its own memory; an attacker triggering cold-starts dilutes the limit). Upstash would be textbook production-grade but adds setup overhead for what amounts to a low-traffic defense-in-depth surface.

**Table: `rate_limit_windows`** (migration `rate_limit_windows_v1`):

```sql
CREATE TABLE rate_limit_windows (
  id          TEXT PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  count       INTEGER NOT NULL DEFAULT 0,
  windowStart TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiresAt   TIMESTAMPTZ NOT NULL
);
CREATE INDEX rate_limit_windows_expiresAt_idx ON rate_limit_windows(expiresAt);
```

**Helper: `lib/rateLimit.ts::checkRateLimit(key, max, windowSeconds)`.** Single atomic `INSERT … ON CONFLICT (key) DO UPDATE … RETURNING count, expiresAt`. Three parallel `CASE WHEN expiresAt <= NOW()` branches handle:

1. **New row** (INSERT path) → `count = 1`
2. **Expired window** (UPDATE path, `expiresAt <= NOW()`) → reset: `count = 1`, fresh `windowStart` + `expiresAt`
3. **Active window** (UPDATE path, `expiresAt > NOW()`) → `count = existing + 1`, keep existing window timestamps

No read-modify-write race: the read and write happen in one statement under row lock. Returns `{ allowed, resetAt, remaining }`. **Fail-open** if the DB query throws (DB-down already means nothing else works — the User table is in the same DB).

**Wrapper: `app/api/auth/[...nextauth]/route.ts`.** Previously `export const { GET, POST } = handlers`. Now `GET` is still untouched (auth GET endpoints — CSRF cookie, session — have no abuse vector worth limiting) but `POST` is a wrapper that inspects `url.pathname`:

- `signin/resend` → read email via `req.clone().formData()`, extract IP via `x-forwarded-for`, check per-email AND per-IP. Limits are independent — either trips the rate-limit response.
- `callback/resend` → extract IP only, check per-IP.

Limit-tripped requests return a 303 redirect to `/login/error?error=RateLimit`. 303 forces GET on the redirect target (correct, since the error page is GET-only). Other auth paths (signout, providers, csrf, session) pass through untouched.

**`/api/account/join` (Door B)** calls the same `checkRateLimit` helper directly, using the same keys via `signinEmailKey(email)` + `signinIpKey(ip)` from `lib/authRateLimits.ts`. Limit-tripped requests return JSON `{ rateLimited: true, error: "..." }` with HTTP 429; the client's `JoinForm` navigates to `/login/error?error=RateLimit` for UX parity with Door A.

**Cleanup: daily cron `/api/cron/cleanup-rate-limits`** at 10:15 UTC (5:15 AM CT, after the existing 5 AM CT cleanup-incomplete-accounts). Deletes rows where `expiresAt < NOW()`. Lazy reset on read means stale rows are functionally harmless, but the cron keeps the table small and the unique-key lookup fast.

### Key naming convention

All keys in `rate_limit_windows.key` follow `<surface>:<dimension>:<value>`:

| Surface | Key pattern | Example |
|---|---|---|
| Sign-in email send | `signin-email:<email>` | `signin-email:foo@bar.com` |
| Sign-in IP send | `signin-ip:<ip>` | `signin-ip:192.0.2.1` |
| Code verify IP | `verify-ip:<ip>` | `verify-ip:192.0.2.1` |

**Email keys MUST be lowercased + trimmed** before calling `checkRateLimit` — the wrapper does this at the call site (`raw.toLowerCase().trim()`). Don't trust raw form input to already be normalized; a bot can send `Foo@Bar.com` and `foo@bar.com` and bypass per-email limiting without this normalization.

### Operational notes

- **Clearing a stuck user.** If a real user reports being locked out, delete their row(s) by key in the Neon console: `DELETE FROM rate_limit_windows WHERE key LIKE 'signin-email:<their-email>' OR key LIKE 'signin-ip:<their-ip>';`
- **Adjusting thresholds.** Constants live in `lib/authRateLimits.ts` (`EMAIL_MAX`, `IP_SEND_MAX`, `IP_VERIFY_MAX`, `WINDOW_SECONDS`). Both Door A and Door B import from there. No env vars — the numbers are deliberately code-visible so changes show up in commit history. Same module also exports `signinEmailKey`, `signinIpKey`, `verifyIpKey` so callers don't reinvent the key namespace.
- **Adding a new rate-limited surface.** Use the same `checkRateLimit(key, max, windowSeconds)` helper; namespace the key (`<surface>:<dimension>:<value>`); decide on fail-open vs. fail-closed behavior at the call site. The helper itself returns `{ allowed, resetAt, remaining }` — caller decides what to do with `!allowed`.

### What NOT to do

- **Don't add rate-limiting via Vercel edge middleware** (`middleware.ts` / `proxy.ts`). The path inspection + body parsing pattern needs the full Node runtime, not the edge. The wrapper at `app/api/auth/[...nextauth]/route.ts` is the right place.
- **Don't fail-closed on DB errors.** The User table is in the same DB; if it's down, sign-in is already broken. Failing closed on the rate-limit check would add a second failure mode (every error becomes "you're rate-limited"). The current fail-open behavior is correct.
- **Don't use the helper for high-traffic surfaces** without first measuring DB load. At RIM's <100 sign-ins/day, a few extra UPSERTs is invisible. At meaningful traffic, consider moving to Upstash or in-memory + sticky sessions.

---

## Member migration & the legacy quiet pool (session 145)

~1,500 existing members were migrated from the old Webflow/Memberstack site. The model reuses the auth flow rather than adding a parallel one:
- **Quiet pool.** Each import is an inert account marked `User.isLegacyUnclaimed = true` (`agreedToTerms:false`, `emailVerified:null`) — structurally the session-142 staged account at scale. It's silent (the pre-threshold email gate), exempt from the `cleanup-incomplete-accounts` cron (a guard `isLegacyUnclaimed:false` was added to the sweep), and hidden from the default `/admin/members` (server-side `where` = OR of `isLegacyUnclaimed:false` / has-role / has-hub; `?pool=legacy` reveals it with a muted "Unclaimed" status).
- **Promotion = the existing agreement gate.** A returning member signs in at `/login` like anyone; the `(authenticated)` layout sends a not-yet-agreed user to `/account/welcome` → `complete-profile`, which sets `agreedToTerms:true` **and flips `isLegacyUnclaimed:false`**. The `/join` upsert flips it too. So a legacy member promotes into the active list by crossing the same Community Care Agreement everyone does — fresh consent, no separate flow — preserving any pre-staged role/hub/schedule.
- **Welcome-back.** `/account/welcome` shows "Welcome back" copy when `isLegacyUnclaimed`; the `welcome-back` email fires on promotion (the returning counterpart of `join-welcome`).
- **The import ran on Vercel, not locally.** Neon is unreachable from the dev sandbox even sandbox-off, so the one-time import used a temporary ADMIN browser tool (`/admin/import-legacy`) that executed server-side; removed after. Pattern for any one-time prod DB op: a `migrate.mjs` flag-guarded block, or a temporary ADMIN browser tool — the offline script's `--dry-run` validates logic with no DB.

## "Send sign-in code" — the admin way-in helper (session 145)

`POST /api/admin/members/[id]/send-signin` (ADMIN/REGISTRAR) triggers a fresh 6-digit code to a member's email, reusing `signIn("resend")`. It's the pastoral "I've got you" for a stuck member — and the reason **passwords stayed off the table**: a *recoverable* password is a security no-go, the 90-day session means re-login is rare, and the code has nothing to forget. The helper shares the `lib/authRateLimits` budget (keyed on the target's email + the admin's IP, so it can't widen a member's per-window code budget) and refuses an archived member.

## Name normalization on entry (session 145)

`lib/nameCase.ts::toProperName` proper-cases a name at the casual entry points — `/join`, `/api/registrations`, `complete-profile`, admin "+ Add member" — and a one-time migration (`normalize_user_names_v1`) cleaned existing rows. Conservative by design (a name is identity): it only re-cases names that are entirely UPPER or entirely lower; intentional mixed-case (McDonald, DeShawn, van der Berg) is returned untouched; hyphens/apostrophes title-cased. **Not** applied to the admin member-EDIT PATCH or a member's own profile edit — those stay type-exactly, the hand-fix path for the few the rule under-corrects (all-caps Mc/Mac, 2-letter initials).

---

## Key files

| File | Role |
|---|---|
| `auth.ts` | NextAuth v5 config: Resend provider, generateVerificationToken override, sendVerificationRequest, session callback |
| `app/api/auth/[...nextauth]/route.ts` | NextAuth catch-all + the rate-limit POST wrapper (Door A) |
| `app/api/account/join/route.ts` | `/join` POST handler (Door B): upsert User, signIn, fire welcome letter + onboarding enrollment in `after()` |
| `lib/rateLimit.ts` | `checkRateLimit()` + `getRequestIp()` |
| `lib/authRateLimits.ts` | Shared rate-limit thresholds + key namespace helpers (used by both doors) |
| `lib/communityAgreements.ts` | Canonical agreement text used by both doors + `/account/welcome` + program registration |
| `lib/email.ts::sendSignInCodeEmail` | Sends the templated sign-in code email |
| `lib/email.ts::sendJoinWelcomeEmail` | Sends the warm welcome letter (Door B only) |
| `app/api/cron/cleanup-rate-limits/route.ts` | Daily expired-row sweep |
| `app/api/cron/cleanup-incomplete-accounts/route.ts` | Daily sweep of abandoned User records: two paths since session 132 (false-agreedToTerms OR true-agreedToTerms-but-unverified). **Session 142 staged-account guard:** only deletes accounts with NO role AND NO hub membership (`roles: isEmpty` + `hubMemberships: none`), so an admin can pre-stage a host ("+ Add member", `emailVerified:null`/`agreedToTerms:false`) and they survive until they onboard. Uses findMany→deleteMany-by-id because relation filters aren't allowed in deleteMany. |
| `app/login/page.tsx` | Sign-in form (Door A); accepts `?email=` for soft-redirect from Door B's already-member case |
| `app/join/page.tsx` | Threshold page (Door B): hero + integrated panel with agreements + form |
| `components/JoinForm.tsx` | Door B client form |
| `app/login/check-email/page.tsx` | Code-entry form (shared by both doors) |
| `app/login/error/page.tsx` | Error landing page with per-code copy |
| `prisma/schema.prisma` | `User`, `VerificationToken`, `RateLimitWindow` models |
| `vercel.json` | The `cleanup-rate-limits` cron schedule |

---

## Common pitfalls

1. **The callback URL is constructed client-side** (the code-entry form GETs `/api/auth/callback/resend`) — so `NEXTAUTH_URL` trimming concerns from session 96 don't apply here. Don't add server-side URL building to this flow.
2. **`signIn` with `redirect: false` returns a URL string on failure, doesn't throw.** Always inspect the returned URL for `error=` query params when adapting this pattern. The signin/login server action does this; mirror it.
3. **`generateVerificationToken` is lower-inclusive / upper-exclusive** — `crypto.randomInt(100000, 1000000)` produces codes 100000–999999. Codes never start with `0`. Keyspace 900K, not 1M. The "900K codes / 30 min" math in this doc reflects that.
4. **Don't lock the rate-limit wrapper to specific NextAuth paths by full URL.** Use `endsWith("/signin/resend")` / `endsWith("/callback/resend")` so the check still works under base-path changes. The provider id is `"resend"` (lowercased from the `Resend` import); production paths are `/api/auth/signin/resend` and `/api/auth/callback/resend`.
5. **The 30-minute code expiry is set on the Resend provider's `maxAge`** (in `auth.ts`), not on the rate-limit window. Don't conflate them — the rate-limit window is independent and protects against attack rate; the code expiry protects against attacks that already have a code in hand.
6. **The three `/login` pages still wear legacy Webflow class names** (`.container-7-copy`, `.login-box`, `.form-header`, `.w-form`) re-implemented in `custom.css`, because `rim.webflow.css` no longer loads. Two layout bugs came out of that in session 173, both now fixed, both worth knowing before touching these pages: `.container-7-copy` was `width: 100%` + 24px side padding with no `border-box`, so all three pages ran 48px past the viewport and the sign-in card sat 24px right of centre at any width under ~1148px; and the code-entry page prints the member's own address back to them inside a `<strong>`, which is a single unbreakable token — past ~34 characters it ran off the right edge (`.login-box strong` now carries `overflow-wrap: anywhere`). **The email comes from a query param, so it has no safe upper bound** — any copy that echoes user-supplied text on this page needs the same treatment. Detail + the measurement method: `RIM_Public_Pages.md` → "No global border-box."

---

*Working document. Updated 2026-08-10 (Session 173 — pitfall 6: the legacy-class layout bugs on the three `/login` pages). Previously 2026-05-27 (Session 132 — `/join` slice: two-door model, shared rate-limit module).*
