# RIM Email Engineering — rules for code that sends outbound email

**Read this before writing or modifying any email-sending code in RIM.**

This is the engineering checklist for emails. It is distinct from `RIM_Hub_Engineering.md` (hub-routing rules in general) and from the per-tool docs. Every send-an-email codepath in RIM must follow the patterns below.

---

## The mental model

> **Templates are the source of truth for content. Code is the source of truth for delivery.**

RIM has two parallel concerns:

1. **Template content** — subject line, body, button labels. Lives in the `email_templates` Postgres table. Coordinators edit at `/admin/emails/[slug]`. Renders via marked → juice (CSS inlining) → Resend.
2. **Delivery code** — the `send*` functions in `lib/email.ts` that call `sendTemplatedEmail(slug, recipient, variables)`. Lives in code. Reviewed via git.

When you write an email feature you write code that supplies variables to a template. The template body is editable separately. The slug is the contract between them.

---

## The Email Template Gate (from CLAUDE.md, repeated here)

> Every `sendTemplatedEmail("slug", …)` call site MUST have a corresponding seed entry in `prisma/migrate.mjs` in the same commit. The template manager at `/admin/emails` is the source of truth — if the row doesn't exist in DB, `sendTemplatedEmail` silently no-ops and the recipient gets nothing. The compiler can't catch this; only discipline can.

When adding a notification:

1. Add the template body, subject, variables, and group/groupLabel to `prisma/migrate.mjs` (new migration entry).
2. Use `enabled: true` so the email actually sends on first deploy.
3. Use the defensive `findUnique → create` pattern, NOT `upsert`, so re-running doesn't overwrite manual edits Jesse has made via the admin UI.
4. The `groupLabel` and numeric prefix (e.g. `04-hosts`, `05-hubs`) determines where it shows up in `/admin/emails`.

**Overwrite an existing template body only with explicit consent.** The Email Template Gate's "never `upsert`" rule exists to prevent *silent* overwrites — a developer ships a migration without thinking about the fact that Jesse may have customized the template, his edit disappears, nobody notices. The protection is against accidents, not against intentional template work.

**The actual rule, in two halves:**

- **Default (no explicit consent):** seed-only. `findUnique → create` for brand-new templates; for existing ones, update only the metadata fields (variables array, group label, etc.), never the body. Coordinator's edits are authoritative.
- **With explicit consent from Jesse for a specific change:** direct `update` is fine. "Swap the canonical CTA link for `{{coverButton}}` in the six email templates" — Jesse explicitly asked for this in Slice 2.5. The migration ran an `update` directly, with per-template log output so the deploy log shows what changed.

When you do an intentional update:

- Print a per-template log line at apply time (`Updated body of sub-request-posted`). The deploy output is the audit trail.
- For each template, check whether the canonical body pattern is still present. If yes, swap. If no (coordinator customized), leave the body alone and only update the variables/metadata. Print a notice telling the coordinator what to swap in manually.
- Guard the migration with a `_migration_flags` entry so it runs exactly once.
- Document the change in `session-log.md` so future sessions know the templates were touched.

**Adding a new variable to an existing template** is a related case. The pattern: add the variable to the `variables` array via metadata-only update (so the variable appears in the admin UI list), keep the body untouched. The coordinator decides whether and where to use the new variable in the body. Slice 2.5's `swap_email_cta_to_buttons_v1` migration did this for the customized-body case — body left alone, variables array updated, log notice telling Jesse what to paste.

When in doubt about whether you have consent, ask before shipping. The cost of asking is one round-trip; the cost of an unexpected overwrite is a lost edit.

Hardcoded sends (don't use the template manager, intentionally): `sendHostManagerRoleAssignmentEmail`, `sendStandingAssignmentScheduledEmail`, `sendStandingAssignmentReplacedEmail`. These render markdown inline — long-form, set-and-forget content that doesn't need coordinator editing. If you add a new hardcoded send, write a one-line justification in the function's JSDoc explaining why it bypasses the manager.

**Registration emails — fire from the choke point.** The registrant confirmation (`registration-confirmation`) and the support@ notification (`registration-support-notification`, session 136) both fire from `lib/registrationConfirmation.ts::sendRegistrationConfirmation(id)` — the single "a registration just became real" point. Don't bolt a registration-completion email onto one path (the POST, the decline endpoint, the webhook, the cron); add it to the choke point so it covers every completion and can't drift. Full model: `RIM_Registration.md`.

---

## URL construction rules

**`BASE_URL` is trimmed and slash-stripped once at module load.** Don't trim it again at the call site. Don't bypass it by hardcoding `https://rim-next.vercel.app` — env-var-driven base URL is how we'll cut over to `rootedinmindfulness.org` without touching code.

**Every URL must compose with `BASE_URL`.** Never write a fully-qualified URL inline.

**Hub-scoped URLs use helpers.** Two helpers in `lib/email.ts`:

```ts
hubScopedUrl(path, hubSlug)   // /tools/* paths — appends ?hub=<slug>
hubHomeUrl(hubSlug)           // /account/hub/<slug>/* paths
```

`hubScopedUrl` skips the `?hub=` when the slug is the host-team default (kept clean for the common case). It also handles paths that already have a query string (uses `&` instead of `?`). Don't bypass these helpers — they're the choke point for hub isolation in email links.

**Get the hub from the resource, not the actor.** When a sub-request email is about a Good Morning Silent Meditation session, the URL must point to the peer-led-silent-meditation hub view, regardless of which hub the recipient is currently looking at. The hub the email lands you in is the hub the resource belongs to.

---

## Background-send reliability

**Vercel's serverless lifecycle kills in-flight Promises when the response returns.** The classic broken pattern:

```ts
sendHubWelcomeEmail({...}).catch(() => {});  // ❌ silently killed
return Response.json({ ok: true });
```

The function tears down once the response goes out; the Resend call gets killed mid-flight. Email arrives intermittently or not at all. The `.catch(() => {})` also swallows errors so we never know.

**Canonical fire-and-forget for route handlers:** `after()` from `next/server`.

```ts
import { after } from "next/server";

// ... inside POST handler:
const recipientEmail = newMember.user.email;     // capture in local const
const recipientName  = newMember.user.firstName; // (closures are otherwise unstable)
after(async () => {
  try {
    await sendHubWelcomeEmail({
      to: recipientEmail,
      firstName: recipientName,
      hubName: hub.name,
      hubUrl: hubHomeUrl(hub.slug),
    });
  } catch (e) {
    console.error("[hub-members] welcome email error:", e);
  }
});
return NextResponse.json({ ok: true });
```

`after()` runs the function after the response is committed but before Vercel tears the function down. The Promise resolves; the email actually sends.

**For non-route functions** (helpers called by routes): either `await` the sends so the caller's `await` covers them, OR accept an `after` callback the route can pass in. Bare fire-and-forget Promises in non-route code have the same teardown risk because the caller is a route.

`syncHubMembership` was converted to await its sends in Slice 2.5 because its only caller (the admin role-grant route) already awaits the whole function. Adding ~200ms per hub to the admin response is acceptable; lost welcome emails are not.

**Always log errors via `console.error`.** Never `.catch(() => {})` silently. Lost observability is how Slice 1 didn't catch the welcome-email bug — there was no signal because the catch swallowed everything. If you wrap in `after()`, the try/catch should `console.error` on failure.

---

## The CTA button pattern

For any email link that's a "do the thing" call to action — claim a session, view your schedule, open a hub, enroll — use the canonical button helper:

```ts
import { emailButtonHtml } from "@/lib/email";

const coverUrl = hubScopedUrl(`/tools/schedule?action=cover&id=${id}`, hubSlug);
await sendTemplatedEmail("sub-request-posted", to, {
  // ... other variables
  coverUrl,
  coverButton: emailButtonHtml("Cover this session", coverUrl),
});
```

The helper produces Outlook-safe, table-centered, inline-styled HTML with the RIM blue background, white bold text, and consistent padding. Templates paste `{{coverButton}}` (or whatever variable name) where they want a prominent CTA.

**Don't build button markup in template bodies.** Visual consistency across all emails depends on every CTA coming from this one helper. When we tune the button (color, padding, hover, dark-mode), one change in `lib/email.ts` propagates everywhere.

**Keep the plain URL variable alongside the button.** Templates that include `{{coverButton}}` should also have the plain `coverUrl` somewhere in the body — typically as a fallback "Or copy this link: {{coverUrl}}". Some recipients use clients that strip HTML; the raw URL keeps them functional.

---

## Trimming env-derived values

> `NEXTAUTH_URL` (and any env var derived from a URL) is whitespace-trimmed at module load.

`BASE_URL` in `lib/email.ts`:
```ts
const BASE_URL =
  (process.env.NEXTAUTH_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");
```

The trim and slash-strip happens **once**, at module load. Every call inherits the clean value. Don't trim again at call sites.

This pattern exists because a stray space in a Vercel env var historically broke email links by landing the space mid-URL (session 96). The defense is centralized so future surfaces don't have to remember to trim.

If you add a new env-var-derived URL, follow the same `.trim().replace(/\/$/, "")` pattern at module load.

---

## Template variable conventions

Names are camelCase and descriptive: `coverUrl`, `coverButton`, `hubUrl`, `dateText`, `programName`. Avoid abbreviations.

Every URL variable should also have a `*Button` companion when the URL is a CTA. Coordinators choose between the plain link and the button based on the email's tone.

Pass empty strings (not nulls) for optional text — the template renderer treats null as the literal word "null" in some markdown contexts. Use `?? ""`.

Pre-format dates at the call site, not in the template. `dateText: "Thu, May 22 · 8:15 AM"` rather than a raw ISO timestamp.

---

## Engineering rules in one paragraph

When you send an email: write the slug into both the code and a `prisma/migrate.mjs` seed entry; use `findUnique → create` (never `upsert`); never overwrite an existing template body; build URLs via `hubScopedUrl` / `hubHomeUrl` / `BASE_URL` (never inline `https://`); derive `hubSlug` from the resource (program), not the actor; pass a `{{*Button}}` variable for every CTA URL using `emailButtonHtml(label, url)`; wrap fire-and-forget sends in `after()` from `next/server` (or await them if the caller is a route handler that already awaits); `console.error` on failure (never silent `.catch`); add a one-line JSDoc justification on any hardcoded-HTML email that bypasses the template manager.

---

*RIM Email Engineering · September 2026 · Written during session 128 Slice 2.5 as the institutional response to the welcome-email-not-delivered and email-URL-leak failures.*
