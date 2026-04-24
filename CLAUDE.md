# RIM Next — Claude Instructions

## Design Orientation (not optional)

RIM's design is rooted in a Dharma principle: **clear seeing is the prerequisite for wise and compassionate response.** This governs every screen — public, member, volunteer, admin. The design documents in the project root are not reference material. They are the orientation.

**Before any implementation work**, read the relevant documents for the task type:

| Task | Required reading |
|------|-----------------|
| Any UI, CSS, or page work | `RIM_Web_Design_Philosophy.md` + existing patterns in `custom.css` for that area |
| Hub, tool, or sidebar work | `RIM_System_Architecture.md` + `RIM_Hub_Model.md` |
| Role, permission, or member data | `RIM_Role_Design.md` + `RIM_System_Architecture.md` |
| Editor, text field, block, or rich content work | `RIM_Editor_Types.md` — canonical reference. Supersedes the older `RIM_Editor_Design.md`. |
| New feature of any kind | `FEATURES.md` — check what already exists and what it connects to |
| Program-related changes | Trace the full program ecosystem (registration, hosts, teachers, LiveKit, dana, pages, dashboard) |

**Before writing code**, read at least one existing similar page or component in the codebase. Never build in isolation from what already exists.

**When Jesse asks for something or asks your opinion**, think about how it fits the whole — design philosophy, interconnected features, existing patterns. Offer that thinking. Engage as a co-creator, not a task executor.

## Session Opening — Required

When Jesse says **"opening prompt"** (or similar), execute the full opening ritual below.

At the start of every session, before any implementation work:

1. **Read `RIM_Architecture_Directive.md` first.** This file is authoritative and supersedes any earlier instructions, memory, or conventions that conflict with it. It defines the Webflow + RIM Next split, which surfaces move to Webflow vs. stay in Next.js, the `rim-connect.js` pattern, the `/api/public/*` and `/api/member/*` API conventions, and the task classification that must happen before any code is written. If a later file contradicts this directive, the directive wins — flag the contradiction and ask Jesse.

2. **Read the remaining reference files in order:**
   - `UP_NEXT.md` — in-progress context from the last session (what's half-built, what's being tested, what's the next concrete step). If `UP_NEXT.md` has active work and Jesse's first message sounds related, resume that thread.
   - `FEATURES.md` — what exists, what's built, what's new
   - `RIM_Stack_Reference.md` — technology, services, environment
   - `RIM_System_Architecture.md` — structural relationships
   - `RIM_Role_Design.md` — roles, hubs, permissions
   - `RIM_Web_Design_Philosophy.md` — design intent
   - Plus any task-specific files per the Design Orientation table above

3. **Confirm you've read them before starting work.** State explicitly that the directive and reference files have been read, and reference anything from `UP_NEXT.md` that bears on Jesse's first message. This is not ceremonial — it's the verification that the pivot context and current state are loaded before any proposal.

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

5. **Classify the task before proposing anything** per the Directive's "Before writing code, classify the task" rules. In particular: if the target page is in the Directive's "moves to Webflow" list, do not build or modify the Next.js version — the work is an API endpoint, a `rim-connect.js` extension, or a `data-rim-*` attribute pattern for Jesse to apply in Webflow. When ambiguous, ask.

6. **Wait for Jesse to confirm the map before building.** Jesse may see connections you missed. The map is a conversation, not a checklist. Only proceed to implementation after Jesse says the map looks right.

This is the difference between executing tasks and co-creating a system. Jesse should never have to remind you of something that is documented.

---

## Workflow
- **Never run a local dev server.** Push to GitHub; Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && next build` — run locally to catch TypeScript errors before pushing.
- Keep changes minimal and focused. No over-engineering or speculative improvements.
- Prefer editing existing files over creating new ones.
- Full stack reference: `RIM_Stack_Reference.md` in project root.
- Editor system reference: `RIM_Editor_Types.md` in project root — **read before working on any editor component, content renderer, display page, or CSS for rich text output.** (Supersedes the older `RIM_Editor_Design.md`, which is archived.)

## Stack
- Next.js **16** (App Router) + TypeScript
- Sanity v3 (project `xxgvfpjf`, dataset `production`) — content CMS at `rooted-in-mindfulness.sanity.studio`
- NextAuth v5 — magic-link auth via Resend, no passwords. `auth()` for server components.
- Prisma 5 + Neon Postgres — member data, registrations, roles, hub models
- Stripe (test mode) — dana/payment collection via Checkout
- Google Meet — virtual program hosting via service account DWD + 4 shared room accounts
- Route protection: `proxy.ts` (not `middleware.ts` — Next.js 16)
- `params` is `Promise<{slug}>` — must `await params` before destructuring

## CSS Rules
- **Never edit** `normalize.css`, `webflow.css`, or `rim.webflow.css` in `public/css/`.
- All custom styles go in `public/css/custom.css` only.
- Per-page prefix system: `lp-` lessons, `pg-` programs, `wl-` welcome, `vol-` registrar, `adm-` admin, `db-` dashboard, `mr-` my registrations, `mp-` my profile, `nav-` nav, `man-` manual, `hs-` host area, `hub-` hub components, `hh-` households, `ac-` account layout/sidebar, `ca-` course access.
- Design tokens in `:root`: Colors: `--rim-bg`, `--rim-text`, `--rim-mid`, `--rim-blue`, `--color-error`, `--color-success`, `--color-warning` (each with `-bg` variant). Fonts: `--font-serif`, `--font-sans`, `--font-mono`. Type scale: `--text-hero` (clamp), `--text-h1` (38px), `--text-h2` (28px), `--text-h3` (24px), `--text-h4` (20px), `--text-body` (18px), `--text-small` (15px), `--text-ui` (14px), `--text-xs` (13px), `--text-label` (12px), `--text-xxs` (11px). Line heights: `--lh-heading` (1.3), `--lh-body` (1.7). Layout: `--reading-width` (700px). **Use tokens — never invent raw px values or raw hex colors per component.**
- No box-shadows. No borders unless functionally required.
- **Mobile-first responsive:** All new UI must work at 360px minimum (primary target 390px). Breakpoints: `@media (max-width: 430px)` for phones, `@media (max-width: 768px)` for tablets. Minimum 44px touch targets on all interactive elements. Minimum 16px font on all inputs/selects (prevents iOS auto-zoom).

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
- `proxy.ts` — route protection for `/account/*`, `/admin/*`, `/course/*`
- `auth.ts` — NextAuth config; session callback enriches `session.user` with firstName, roles, archivedAt, agreedToTerms
- `prisma/schema.prisma` — full schema (User, Registration, CourseAccess, Donation, Household, HouseholdMember, HostAssignment, SubRequest, SubClaim, HostThread, HostReply, Alert)
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
6. Confirm — the page at `/admin/ideas` will show it after Vercel deploys (~1 min)

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

5. **Staff Manual** (`app/admin/manual/page.tsx`) — Update any affected chapters. The manual is not optional. Writing documentation forces understanding.

6. **Backlog** (`data/backlog.json`) — If any new items were identified during the session, add them.

7. **UP_NEXT.md** — Rewrite the "Active" section to reflect where this session ended. Capture: what was built and is now live, what is open (being tested, half-built, or waiting on Jesse), the next concrete step, and any queued follow-ons. This file is read at the top of the next session's opening ritual — it is how Jesse picks up where we left off without starting cold.

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
