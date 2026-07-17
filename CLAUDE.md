# RIM Next — Claude Instructions

## Design Orientation (not optional)

RIM's design is rooted in a Dharma principle: **clear seeing is the prerequisite for wise and compassionate response.** This governs every screen — public, member, volunteer, admin. The design documents in the project root are not reference material. They are the orientation.

**Before any implementation work**, read the relevant documents for the task type:

| Task | Required reading |
|------|-----------------|
| Any UI, CSS, or page work | `RIM_Web_Design_Philosophy.md` + existing patterns in `custom.css` for that area |
| Hub, tool, sidebar, or anything that touches hub-scoped data | `RIM_System_Architecture.md` + `RIM_Hub_Model.md` + **`RIM_Hub_Engineering.md`** (the engineering checklist — rules every callsite must follow) |
| Any code that sends an email or modifies an email template | **`RIM_Email_Engineering.md`** — URL helpers, fire-and-forget pattern, template gate, CTA button convention |
| Scheduler tool (`/tools/schedule` and its routes) | **`RIM_Scheduler.md`** — the per-tool reference |
| Program Manager (`/tools/programs`, `components/registrar/ProgramEditor.tsx`) | **`RIM_ProgramEditor.md`** — routes, access, program-ecosystem connections, editor structure, hub context, and authenticated design rules |
| Course Manager (`/tools/learning`, `components/CourseEditor.tsx`, lesson-management routes) | **`RIM_CourseEditor.md`** — routes, access, course/lesson model, editor structure, hub context, and authenticated design rules |
| Session room — **retired session 159** (the in-browser LiveKit room — `components/session/*`, `components/VideoRoom.tsx`, `app/api/livekit/*` — was removed; sessions run on Zoom, see the Zoom row) | **`RIM_SessionRoom.md`** — kept as historical reference |
| Zoom sessions — "RIM orchestrates, Zoom is the room" (the live room for every virtual/hybrid program): `app/session/[slug]/enter/*`, `app/session/[slug]/page.tsx` (redirect), `lib/zoom.ts`, `lib/sessionMeeting.ts`, `lib/sessionAuth.ts`, `lib/sessionIdentity.ts`, the `recordByDefault` flag, `/admin/zoom-test` | **`RIM_Zoom.md`** — the per-tool reference (decision + account model, S2S provisioning, per-occurrence meeting + self-heal, own-name Claim-Host, guest open-access entry, the no-registration/rate-limit pitfall; **cutover complete session 159**) |
| Public-facing page — program/course detail, this-week, teachers, content pages, nav, footer (any UI/CSS) | **`RIM_Public_Pages.md`** — the public-page design system (warm three-shade palette, card-lift / recede-panel surface language, the flush-nav + chapters/band tombstones) + `RIM_Web_Design_Philosophy.md` |
| Role, permission, or member data | `RIM_Role_Design.md` + `RIM_System_Architecture.md` |
| Member Registry / member profile (`/admin/members`, the Teams + Roles & access sections, pre-staging, roles-vs-hub-membership) | **`RIM_MemberRegistry.md`** — the per-tool reference (section registry, system-powers vs team-membership split, role-derived locking, HOST retired, legacy pool excluded from pickers) |
| Auth, sign-in, NextAuth callbacks, rate-limit | **`RIM_Auth.md`** — sign-in flow, code generation, error states, rate-limit thresholds, key namespacing, common pitfalls |
| Program registration, dana, Stripe checkout/webhook, or anything that lists/counts registrations | **`RIM_Registration.md`** — completion-follows-the-choice model, the `PENDING_PAYMENT` held state, the `sendRegistrationConfirmation` choke point, visibility rules, pitfalls. Read with `RIM_Offering_Model.md`. |
| Editor, text field, block, or rich content work | `RIM_Editor_Types.md` — canonical reference. Supersedes the older `RIM_Editor_Design.md`. |
| Google Workspace Files — the Finder, in-app Doc reader, Drive mapping, service-account layer (`components/FilesBrowser.tsx`, `lib/google/*`, `lib/googleFiles.ts`, `/api/files/*`, `/admin/google-test`, `Hub.google*` fields) | **`RIM_GoogleWorkspace.md`** — "RIM orchestrates, Google is the file cabinet": service-account model, link-as-key, places/authorization, the manual Google setup, and the slice plan. Read before any Files work. |
| New feature of any kind | `FEATURES.md` — check what already exists and what it connects to |
| Program-related changes | Trace the full program ecosystem (registration, hosts, teachers, Zoom sessions, dana, pages, dashboard) |

**Before writing code**, read at least one existing similar page or component in the codebase. Never build in isolation from what already exists.

**When Jesse asks for something or asks your opinion**, think about how it fits the whole — design philosophy, interconnected features, existing patterns. Offer that thinking. Engage as a co-creator, not a task executor.

## Hub App Integration Gate (not optional)

A Space is the stable team home; an app is an optional focused capability installed into it. An app may extend the universal Home, Updates, and attention systems, but it must never replace Home or create a hub-specific fork.

Before registering or changing any app that can be installed through `HubAppLink`, verify all of the following in code and in `RIM_Hub_Engineering.md`:

1. Declare `multi-space` or `primary-space` compatibility, whether the app may be primary, and one distinct semantic `iconKey`.
2. Scope every read, write, permission gate, notification recipient, and URL by the resource Space.
3. Provide no more than one Home contribution (`summary`, `module`, or `none`); a module replaces its launcher card.
4. Emit only meaningful, visible Updates with explicit `sourceKey`, `sourceLabel`, and durable `kind`.
5. Define personal attention separately from shared Updates; passive history is not a notification.
6. Let the app own event meaning and detailed counts; let the Space own consistent rendering and read state.
7. Keep install/remove safe: the base Home, Conversations, Files, Members, and Updates must still work without the app.
8. When enabled registered apps exist, use `HubAppLink.isPrimary` for the one primary app; other apps are supporting and custom links can never be primary.
9. Add the app to the exhaustive server provider registry in `lib/hubApps.ts`; do not add hub-slug branches to Home or Updates.
10. Complete all four hub-routing audit layers before release.

Installing an existing compatible app into a new Space must be an admin configuration action, not a new coding task. Building genuinely new app behavior still requires engineering once, through this contract.

## Session Opening — Required

When Jesse says **"opening prompt"** (or similar), execute the full opening ritual below.

At the start of every session, before any implementation work:

1. **Read the reference files in order:**
   - `UP_NEXT.md` — in-progress context from the last session (what's half-built, what's being tested, what's the next concrete step). If `UP_NEXT.md` has active work and Jesse's first message sounds related, resume that thread.
   - `FEATURES.md` — what exists, what's built, what's new
   - `RIM_Stack_Reference.md` — technology, services, environment
   - `RIM_System_Architecture.md` — structural relationships
   - `RIM_Role_Design.md` — roles, hubs, permissions
   - `RIM_Web_Design_Philosophy.md` — design intent
   - Plus any task-specific files per the Design Orientation table above

3. **Confirm you've read them before starting work.** State explicitly that the reference files have been read, and reference anything from `UP_NEXT.md` that bears on Jesse's first message. This is not ceremonial — it's the verification that current state is loaded before any proposal.

4. **Produce a Connections Map before writing any code.** When Jesse describes what we're working on, your first response must include a map in this format:

```
## Connections Map: [feature/task name]

Database models touched:
- [model] — [why]

Routes affected:
- [route] — [how]

Components involved:
- [component] — [role in this work]

CSS prefixes/areas:
- [prefix] — [what changes]

API routes:
- [route] — [new/modified/read]

Email templates:
- [template] — [if any]

Other features this connects to:
- [feature] — [nature of the connection]

Design principles that apply:
- [principle from RIM_Web_Design_Philosophy.md] — [how it governs this work]
```

This is not a formality. It is how Jesse verifies that you understand the system before you touch it. If a section has no entries, write "None" — do not omit it. If you're unsure about a connection, say so and ask.

5. **Classify the task before proposing anything.** When a task touches an existing page or feature, read how it currently works before proposing changes. When ambiguous, ask Jesse.

6. **Wait for Jesse to confirm the map before building.** Jesse may see connections you missed. The map is a conversation, not a checklist. Only proceed to implementation after Jesse says the map looks right.

This is the difference between executing tasks and co-creating a system. Jesse should never have to remind you of something that is documented.

---

## Workflow
- **Never run a local dev server.** Push to GitHub; Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && node prisma/migrate.mjs && next build`. This does **not** complete locally — the `migrate.mjs` step runs migrations against the prod DB, which is unreachable from local machines (it fails fast before `next build`, by design, so you can't migrate prod from your laptop). **To catch TypeScript errors before pushing, run `npx tsc --noEmit`** — that's the real local pre-push gate. The full build completes only on Vercel, where the DB is reachable.
- Keep changes minimal and focused. No over-engineering or speculative improvements.
- Prefer editing existing files over creating new ones.
- Full stack reference: `RIM_Stack_Reference.md` in project root.
- Editor system reference: `RIM_Editor_Types.md` in project root — **read before working on any editor component, content renderer, display page, or CSS for rich text output.** (Supersedes the older `RIM_Editor_Design.md`, which is archived.)

## Email Template Gate (always)

Every `sendTemplatedEmail("slug", …)` call site MUST have a corresponding seed entry in `prisma/migrate.mjs` in the same commit. The template manager at `/admin/emails` is the source of truth — if the row doesn't exist in DB, `sendTemplatedEmail` silently no-ops and the recipient gets nothing. The compiler can't catch this; only discipline can.

When adding a notification:
1. Add the template body, subject, variables, and group/groupLabel to `prisma/migrate.mjs` (new migration entry).
2. Use `enabled: true` so the email actually sends on first deploy.
3. Use `findUnique` → `create` when *seeding* a brand-new template (don't overwrite if it already exists). When *intentionally updating* an existing template — adding a new variable, swapping a link for a button, fixing a typo — explicit `update` is fine *with Jesse's consent for that specific change*. The protection the gate provides is against accidental silent overwrites of Jesse's customizations, not against intentional template work. Print per-template log lines at apply time so the change is visible in the deploy output. See `RIM_Email_Engineering.md` for the full nuance.
4. The `groupLabel` and numeric prefix (e.g. `04-hosts`, `05-hubs`) determines where it shows up in `/admin/emails`.

Hardcoded sends (don't use the template manager, intentionally): `sendHostManagerRoleAssignmentEmail`, the three `sendStandingAssignment*` functions. These render markdown inline — long-form, set-and-forget content that doesn't need coordinator editing. If you add a new hardcoded send, write a one-line justification in the function's JSDoc explaining why it bypasses the manager.

## Stack
- Next.js **16** (App Router) + TypeScript
- Sanity v3 (project `xxgvfpjf`, dataset `production`) — content CMS at `rooted-in-mindfulness.sanity.studio`
- NextAuth v5 — 6-digit sign-in code auth via Resend, no passwords. `auth()` for server components. (Switched from magic links session 119, 2026-05-21.)
- Prisma 5 + Neon Postgres — member data, registrations, roles, hub models
- Stripe (test mode) — dana/payment collection via Checkout
- Zoom — video conferencing for live sessions ("RIM orchestrates, Zoom is the room"; the self-hosted LiveKit room was retired session 159).
- Route protection: per-page via `auth()` from `auth.ts`, plus shared layouts at the route-group level (e.g. `app/account/(authenticated)/layout.tsx` gates the agreement + archive checks for the entire authenticated member area). `proxy.ts` is intentionally a no-op — NextAuth v5 with the Prisma adapter cannot verify sessions in Edge runtime, so route-protection cannot run in `proxy.ts` without causing login loops. (The Next.js 16 filename is `proxy.ts`, not `middleware.ts`.)
- `params` is `Promise<{slug}>` — must `await params` before destructuring

## CSS Rules
- **Never edit** `normalize.css`, `webflow.css`, or `rim.webflow.css` in `public/css/`.
- All custom styles go in `public/css/custom.css` only.
- Per-page prefix system: `lp-` lessons, `pg-` programs, `wl-` welcome, `vol-` registrar, `adm-` admin, `db-` dashboard, `mr-` my registrations, `mp-` my profile, `nav-` nav, `hs-` host area, `hub-` hub components, `hh-` households, `ac-` account layout/sidebar, `ca-` course access.
- Design tokens in `:root`: Colors — **neutral Pampas foundation** (see `RIM_Public_Pages.md`): `--rim-surface` (White `#ffffff` — cards/forms/writing surfaces), `--rim-bg-bright` (Light Pampas `#faf9f7` — inset/hover), `--rim-bg` (Pampas `#f5f3f0` — page ground), `--rim-bg-accent` (Deeper Pampas `#e9e6e2` — separation); `--rim-blue` (`#31576d`, the main blue — hero/footer/buttons/links), `--rim-text` (`#333333`), `--rim-mid`, `--color-error`, `--color-success`, `--color-warning` (each with `-bg` variant). Surface: `--card-shadow` (the one reusable white-card lift). Fonts: `--font-serif`, `--font-sans`, `--font-mono`. Type scale: `--text-hero` (clamp), `--text-h1` (38px), `--text-h2` (28px), `--text-h3` (24px), `--text-h4` (20px), `--text-body` (18px), `--text-small` (15px), `--text-ui` (14px), `--text-xs` (13px), `--text-label` (12px), `--text-xxs` (11px). Line heights: `--lh-heading` (1.3), `--lh-body` (1.7). Layout: `--reading-width` (700px). **Use tokens — never invent raw px values or raw hex colors per component.**
- No box-shadows. No borders unless functionally required. (One scoped exception: white **cards** on the warm public-page ground use `--card-shadow`, a deliberately faint lift — session 148, see `RIM_Public_Pages.md`. Recede *panels* and everything else stay shadowless. The old LiveKit control-bar popover shadow exception went away with the session-159 room retirement.)
- **Mobile-first responsive:** All new UI must work at 360px minimum (primary target 390px). Breakpoints: `@media (max-width: 430px)` for phones, `@media (max-width: 768px)` for tablets. Minimum 44px touch targets on all interactive elements. Minimum 16px font on all inputs/selects (prevents iOS auto-zoom).
- **CSS hygiene tools** (session 134): `scripts/css-prune.mjs` removes fully-dead CSS rules by prefix via postcss (dry-run by default, `--apply` to write; edit the `DEAD_PREFIXES` list; it preserves any rule that shares a selector with a live class). `scripts/css-cut.mjs "<START banner text>" "<END banner text>"` removes a contiguous banner-delimited block. Both verify brace balance before writing. Use these when a removed feature leaves an orphaned CSS prefix — `custom.css` is large and accretes dead prefixes over time.

## Typography — Two Scales (critical, do not drift from this)

**Public/editorial pages** (programs, lessons, articles, dharma content): generous and spacious.
- Body: `var(--text-body)` = 18px / `var(--lh-body)` = 1.7
- Set on `body` globally and on `.rim-content` for all editor output

**Admin/CMS/account/tool interfaces** (`/admin/*`, `/account/*`, `/tools/*`): calm but compact.
- Body: 16px / 1.55 — set on `.admin-ui` and `.ac-layout` wrappers
- Reading content inside admin (`.rim-content`) stays 18px — it overrides back up

**Typography rules that never change regardless of context:**
- `p` and `li` are identical in font-family, font-size, font-weight, line-height, and color
- `li` uses `font-family: inherit; font-size: inherit; line-height: inherit` — never set a different size on li
- All font sizes come from tokens — never invent a raw px value per component
- Headings use the global token scale (h1=38px, h2=28px, h3=24px, h4=20px) — context classes may adjust spacing but not size, except named exceptions (hero: clamp fluid, lp-body h2: 32px editorial)
- Admin body text, form inputs, buttons, table cells: `var(--text-ui)` = 14px
- Field labels, small links, section help: `var(--text-xs)` = 13px
- Form help text, slug labels, meta captions: `var(--text-label)` = 12px
- Badges, table headers, uppercase eyebrows: `var(--text-xxs)` = 11px
- Captions, timestamps, helper text: `var(--text-small)` = 15px
- Error/success/warning: use `var(--color-error)`, `var(--color-success)`, `var(--color-warning)` — never raw hex
- Monospace: use `var(--font-mono)` — never raw font stacks

## Key Files
- `app/layout.tsx` — root layout (CSS, Nav, Footer, SessionProvider)
- `proxy.ts` — intentional no-op (see Route protection above); auth-gating lives per-page via `auth()` and at the route-group layout level
- `app/account/(authenticated)/layout.tsx` — structural gate for the authenticated member area (session + agreedToTerms + archivedAt)
- `auth.ts` — NextAuth config; session callback enriches `session.user` with firstName, roles, archivedAt, agreedToTerms
- `prisma/schema.prisma` — full schema (User, Registration, CourseAccess, Donation, Household, HouseholdMember, HostAssignment, SubRequest, SubClaim)
- `lib/queries.ts` — all Sanity GROQ queries
- `lib/email.ts` — all Resend transactional email builders
- `lib/dateLabel.ts` — `buildDateLabel(p)` auto-generates schedule label from Sanity datetime/recurrence fields (CT timezone)
- `lib/locations.ts` — `resolveLocation()` helper + RIM address constants
- `public/css/custom.css` — all custom CSS

## Sanity / GROQ Rules
- Always exclude drafts: `!(_id in path("drafts.**"))`
- `_type` values are **plural** (`"programs"` not `"program"`)
- `dayOfWeek` is array ref: `dayOfWeek[]->` not `dayOfWeek->`
- Array contains filter: `$slug in field[]->slug.current`
- ⚠️ Slugs are join keys for `HostAssignment` records — treat as permanent once assignments exist

## RSC Serialization (critical)
Never spread a Prisma `include` result into Client Component props. Raw Date objects cause silent navigation failure in Next.js 16 + React 19. Always construct props explicitly; convert all dates to `.toISOString()`.

## Feature Backlog

When the user says **"remember that we need [X]"**, **"add this to the backlog"**, or similar:

1. Read `data/backlog.json`
2. If vague, ask 1–2 clarifying questions — capture intent accurately
3. Add a new item with all required fields (see below)
4. Write the file back
5. `git add data/backlog.json && git commit -m "Backlog: add [title]" && git push`
6. Confirm — `data/backlog.json` is the git-tracked source of truth. There is no in-app viewer (the old `/admin/ideas` page was intentionally removed); read the backlog directly from the file or on GitHub.

**Item structure:**
```json
{
  "id": "YYYY-MM-DD-NNN",
  "title": "Short title",
  "description": "Clear description of what needs to be built and why.",
  "category": "One of the categories below",
  "priority": "high | medium | low",
  "status": "open",
  "addedAt": "YYYY-MM-DD",
  "notes": ""
}
```

**Valid categories:** `Registration` | `Member Accounts` | `Admin Tools` | `Programs & Sanity` | `Courses & Library` | `Email & Notifications` | `Dashboard` | `Nav & Layout` | `CSS & Design` | `Infrastructure`

## Closing Ritual — "let's document everything"

When Jesse says **"closing prompt"**, **"let's document everything"**, or similar, complete ALL of the following before ending the session. No exceptions.

1. **Session log** (`session-log.md`) — Add an entry at the top. Include:
   - What was built or changed
   - What design decisions were made and why
   - **What this work connects to** — which existing features, routes, or systems are affected by or related to what was built. This is not optional. The interconnection record is how future sessions stay oriented.
   - What comes next

2. **FEATURES.md** — Add or update the relevant feature section(s). If a new feature was built, it gets its own section. If an existing feature was modified, update that section.

3. **RIM_Stack_Reference.md** — Update if anything changed: new dependency, new env var, new tool, version bump, role change, architectural shift.

4. **RIM_System_Architecture.md** — Update if any hub, tool, role, or permission logic changed.

4a. **RIM_Editor_Types.md** — Update if any editor surface, block, or placement changed. New blocks go into the Block Library section; new placements go into the Placement Registry. If an editor surface changed type or wrapper class, update the registry entry. The doc must match the code at session end — no drift.

4b. **Hub / Email / per-tool engineering docs** — Update the relevant engineering doc(s) if any rule, pattern, helper, or pitfall was added, changed, or invalidated during this session. The docs (`RIM_Hub_Engineering.md`, `RIM_Email_Engineering.md`, `RIM_Scheduler.md`, etc.) are the institutional memory — when a slice produces a new rule or surfaces a new pitfall, that rule lives in the doc, not just in the commit message or session log. The doc must match the code at session end.

4c. **Hub audit (when this slice touched hubs).** If this slice modified anything in `lib/hubAuth.ts`, `lib/hubMemberAuth.ts`, `lib/programHub.ts`, `lib/email.ts`, `/app/api/hub/*`, `/app/api/host/*`, `/app/account/hub/*`, `/admin/hubs`, or any tool that has a HubAppLink, audit all four routing layers per `RIM_Hub_Engineering.md`: (1) capability gates route by program/resource hub, (2) notification recipient pools use `getHubNotificationRecipients(programHubSlug, …)`, (3) UI / list queries filter by hub, (4) every email-template URL variable passes through `hubScopedUrl()` or `hubHomeUrl()`. Slice 1 (session 128) addressed layers 1–3; Slice 2.5 (session 128 follow-up) found and fixed layer 4. Don't skip the audit just because the change felt small — layer 4 was the leak nobody noticed for a full slice.

4d. **Per-tool engineering doc creation.** If this slice touched a tool or component without its own engineering doc (e.g. ProgramEditor, SessionRoom, HubAdmin, CourseEditor), create one as part of closing. The doc is the per-tool reference — its routes, hub-scoping story, common pitfalls, what's deferred. Name pattern: `RIM_<ToolName>.md`. Update the Design Orientation table to reference it. Self-perpetuating: every slice that touches a new surface produces its reference doc.

4e. **Email template audit (when this slice sent or changed any email).** For every `sendTemplatedEmail("slug", …)` call site added or changed this session, confirm the slug has a matching seed in `prisma/migrate.mjs` — so the row exists in the DB and appears in the editor at `/admin/emails`. Without the seed the send silently no-ops and the recipient gets nothing; the compiler can't catch it. Rules: reusing an existing template (no new slug) needs no seed; a brand-new slug MUST ship its seed in the same commit (`findUnique → create`, `enabled: true`); an intentional re-seed of an existing template needs Jesse's consent + a per-template apply log. This is the closing-time backstop for the always-on **Email Template Gate** above — verified every session, not just trusted. State explicitly which templates were added/changed, or "no email templates touched."

5. **Backlog** (`data/backlog.json`) — If any new items were identified during the session, add them.

6. **UP_NEXT.md** — Rewrite the "Active" section to reflect where this session ended. Capture: what was built and is now live, what is open (being tested, half-built, or waiting on Jesse), the next concrete step, and any queued follow-ons. This file is read at the top of the next session's opening ritual — it is how Jesse picks up where we left off without starting cold.

7. **Architectural decisions.** If a significant architectural or strategic decision was made or reversed during this session, identify the authoritative document for that decision and update or supersede it before closing. This is the step the closing ritual was missing when the Webflow directive went stale — a directive going out of date is nobody's job unless it's explicitly someone's job. Don't let the docs lie.

7b. **Behavior audit — scan the session for memory candidates.** Re-read the session transcript with a single question: *did Jesse correct, validate, or surface anything that future-me should not have to learn again?* Look for three signals: (1) corrections ("don't," "stop doing that," "no, the other way") — these go in `feedback-*` memory files; (2) validated approaches that surprised me or weren't obvious ("yes, exactly," accepting an unusual choice without pushback) — these also go in `feedback-*` files, with a *Why* line capturing what made it the right call; (3) surprises about project state, external systems, or user role — these go in `project-*`, `reference-*`, or `user-*` files. Don't write the memory files silently. List each proposed entry with a one-line summary and ask Jesse to confirm or discard. The five-minute audit is what keeps the memory system from drifting into "only what Claude noticed mid-flight." Most sessions will produce zero memory updates; that's fine — the value is in the scan, not in always finding something.

8. **Commit and push all documentation changes together.**

If any of these files do not need updating for this session, say so explicitly. Do not silently skip them.

## Do Not
- Run a local dev server
- Edit `normalize.css`, `webflow.css`, or `rim.webflow.css`
- Spread Prisma `include` results into Client Component props (Date serialization failure)
- Change a program slug after host assignments exist
- Add Stripe live keys — keep test mode until go-live
- Commit or expose API keys or secrets
- Create new files when editing an existing one would do
