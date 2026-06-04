# RIM Registration — engineering reference for the program registration → dana → payment flow

**Read this before touching `/api/registrations`, the dana/checkout flow, the Stripe webhook, or any surface that lists or counts program registrations.**

Companion to `RIM_Offering_Model.md` (what the offering/dana shapes *mean*) and `RIM_Email_Engineering.md` (outbound email rules). Established session 136 (2026-06-03).

---

## The governing principle

> **A registration completes around the dana decision, not before it.**

Before session 136, the POST did everything at submit — DB row, confirmation email, dashboard listing, course enrollment — so a paid program could be "registered + emailed" without payment, and the "You're registered!" moment landed before the dana contemplation. The fix decouples the row's creation from its *completion side-effects* and moves those to where the dana resolves.

## The two stories (do not conflate them)

- **Required dana** (`fixed` w/ amount, or `base_plus_dana` w/ base) — **payment is the gate.** Registering and paying are one act. No payment → not registered. An abandoned checkout is discarded.
- **Optional dana** (`voluntary`) — **an invitation beside an already-complete registration.** The registration is real at submit; the dana is not a barrier. Abandoning an *optional* choice never throws away the registration.
- **No dana** (`none`) — completes immediately at submit (no choice to wait for).

`requiresPayment` is derived **server-side from the program record** in `POST /api/registrations` — never from the client body. A crafted request cannot register free for a paid program.

## The `PENDING_PAYMENT` held state

A new `RegistrationStatus` value. Only required-payment registrations use it. Semantics:

- Created in `POST /api/registrations` as the **Stripe anchor only** — for a brand-new guest, **no `User` account is created** (deferred to the webhook); no email; no enrollment.
- **Holds a capacity seat** — counted in `["REGISTERED","APPROVED","PENDING_PAYMENT"]` everywhere capacity is computed.
- **Invisible** to every member/registrar-facing query (see the visibility table).
- **Auto-expires** — `expires_at` (60 min) on the Checkout Session → Stripe fires `checkout.session.expired` → the webhook `deleteMany`s the held row (guarded on `status: "PENDING_PAYMENT"`, so a `REGISTERED`/paid row is never deleted). Daily backstop: `cleanup-pending-registrations` cron.

> The held state applies to **required-payment only**. We discussed renaming it `PENDING_DANA` if voluntary ever joined the held model — it didn't, so `PENDING_PAYMENT` is the accurate name.

## The completion choke point

`lib/registrationConfirmation.ts::sendRegistrationConfirmation(registrationId)` is **the single place a registration "becomes official."** It loads the registration + program, builds the confirmation email (calendar links, resolved date/location via the `dateText`/`timeText` caches), sends it to the registrant, **and** fires the support@ notification. Every completion path calls it with just an id:

| Path | Caller |
|---|---|
| Free (`none`), waitlist | `POST /api/registrations` (awaited at submit) |
| Voluntary — decline | `POST /api/registrations/[id]/decline-dana` (marks `WAIVED`, then calls it) |
| Voluntary — give / required — pay | Stripe webhook `handleRegistrationDanaCompleted` (in `after()`) |
| Voluntary — abandoned (24h) | `cleanup-pending-registrations` cron (marks `WAIVED`, then calls it) |

**Anything that should happen "when a registration becomes real" belongs in `sendRegistrationConfirmation` or alongside these four callers — not bolted onto one path.** That's why the support@ notification rides inside it: it can't drift.

## Idempotency

- **Webhook**: gated on whether the `Donation` row (keyed by `payment_intent`) existed *before* this delivery → the confirmation isn't double-sent on redelivery. Status flip / account find-or-create are idempotent (same values / find-existing).
- **Decline + cron**: a guarded `updateMany({ where: { status:"REGISTERED", donationStatus:"PENDING" }, data:{ WAIVED } })` — the `PENDING → WAIVED` flip is a one-shot latch; the confirmation sends only when `count > 0`. A second call no-ops.

## Visibility rules — which registration-status filter goes where

When you add or touch a `db.registration.{findMany,findFirst,count,groupBy}`, decide which side of the line it's on:

- **INCLUDE `PENDING_PAYMENT`** (it holds a seat) — capacity counts only: `programs/[slug]` + `programs/[slug]/register` spots-remaining.
- **EXCLUDE `PENDING_PAYMENT`** (not a real registration) — everything member/registrar-facing: dashboard "coming up" + greeting + per-session "is registered" check; `account/programs` (My Registrations) page + API; admin member registry (page + API); Program Manager list (pending-dana groupBy), per-program roster, CSV export; `lib/hubContext.ts` registrar badge; the "already registered?" checks on the public/register pages; `lib/courseAccess.ts` program-registration access (already excludes via its `["REGISTERED","APPROVED"]` allow-list).
- **Reminders** (`send-reminders`, `send-reminder`) already exclude it (explicit `["REGISTERED","APPROVED"]`).

Drift here is the classic failure: session 136's reviewer pass found three sites missed on the first sweep, two of them *second* queries in a file where only the first was fixed — **one granted gated course access to an unpaid held registration.** When you touch one registration query in a file, grep the whole file for others.

## Key files

- `app/api/registrations/route.ts` — POST; forks by `danaMode` (server-derived); creates `REGISTERED` / `PENDING_PAYMENT` / `WAITLISTED`; reuses an abandoned held row on retry.
- `app/api/registrations/[id]/decline-dana/route.ts` — voluntary "I'm not donating at this time"; ownership = logged-in owner OR matching guest email (mirrors the checkout route).
- `app/api/stripe/checkout/route.ts` — Checkout Session + `expires_at`.
- `app/api/stripe/webhook/route.ts` — `handleRegistrationDanaCompleted` (completion) + `handleRegistrationDanaExpired` (release the hold).
- `app/api/cron/cleanup-pending-registrations/route.ts` — delete stale holds; finalize abandoned voluntary rows. In `vercel.json` (daily 5:30 UTC).
- `lib/registrationConfirmation.ts` — the choke point.
- `lib/email.ts` — `sendRegistrationEmail` (`registration-confirmation`), `sendRegistrationSupportNotification` (`registration-support-notification`, to `SUPPORT_EMAIL`).
- `components/RegistrationForm.tsx` — client; the dana step + decline wiring + mode-aware copy.

## Support@ notification

`SUPPORT_EMAIL` (env-overridable, defaults `support@rootedinmindfulness.org`) is notified of every **real** registration via `sendRegistrationSupportNotification`, fired from the choke point. Template `registration-support-notification` (Email Template Gate — seeded in `migrate.mjs`, editable at `/admin/emails`), with a direct link to the program's registrations. It does NOT fire for abandoned holds (they never reach the choke point). A "started-but-didn't-finish-paying" heads-up was offered to LoriLee and deliberately not built — an unfinished checkout isn't a registration.

## Pitfalls

- **Don't send the confirmation (or any "you're registered" side-effect) at submit for voluntary** — it must follow the give/decline choice.
- **Don't create a `User` for a new guest on a required-payment program at submit** — the webhook does it on payment, so an abandoner never becomes a member.
- **Don't read `danaMode` from the client body** to decide required-vs-not — derive it from the program.
- **Don't add a member/registrar-facing registration query without excluding `PENDING_PAYMENT`**, and don't add a capacity count without including it.
- **The Stripe webhook endpoint must subscribe to `checkout.session.expired`** — otherwise abandoned holds clear only via the daily cron, not in real time.
- **The My Registrations pending-dana banner is a *voluntary invitation*, not a waitlist alert.** `app/account/(authenticated)/programs/page.tsx` shows it for any `donationStatus === "PENDING"` — which on this page means a voluntary registration awaiting the give/decline choice (required-payment rows are `PENDING_PAYMENT` and excluded entirely). Keep the copy calm and accurate ("You're registered. You're also warmly invited to offer dana — a voluntary gift, received with gratitude."). The old "A spot opened up — please complete your dana offering" was waitlist-promotion language firing on the common voluntary case — confusing, since the member never waitlisted (session 137, from LoriLee).

---

*Rooted in Mindfulness · Written session 136 (2026-06-03) as the per-tool reference for the registration-completes-after-dana rework.*
