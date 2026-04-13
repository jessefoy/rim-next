# RIM Next — Claude Instructions

## Design Orientation (not optional)

RIM's design is rooted in a Dharma principle: **clear seeing is the prerequisite for wise and compassionate response.** This governs every screen — public, member, volunteer, admin. The design documents in the project root are not reference material. They are the orientation.

**Before any implementation work**, read the relevant documents for the task type:

| Task | Required reading |
|------|-----------------|
| Any UI, CSS, or page work | `RIM_Web_Design_Philosophy.md` + existing patterns in `custom.css` for that area |
| Hub, tool, or sidebar work | `RIM_System_Architecture.md` + `RIM_Hub_Model.md` |
| Role, permission, or member data | `RIM_Role_Design.md` + `RIM_System_Architecture.md` |
| Editor, content, or rich text | `RIM_Editor_Design.md` |
| New feature of any kind | `FEATURES.md` — check what already exists and what it connects to |
| Program-related changes | Trace the full program ecosystem (registration, hosts, teachers, LiveKit, dana, pages, dashboard) |

**Before writing code**, read at least one existing similar page or component in the codebase. Never build in isolation from what already exists.

**When Jesse asks for something or asks your opinion**, think about how it fits the whole — design philosophy, interconnected features, existing patterns. Offer that thinking. Engage as a co-creator, not a task executor.

## Workflow
- **Never run a local dev server.** Push to GitHub; Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && next build` — run locally to catch TypeScript errors before pushing.
- Keep changes minimal and focused. No over-engineering or speculative improvements.
- Prefer editing existing files over creating new ones.
- Full stack reference: `RIM_Stack_Reference.md` in project root.
- Editor system reference: `RIM_Editor_Design.md` in project root — **read before working on any editor component, content renderer, display page, or CSS for rich text output.**

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
- Design tokens in `:root`: `--rim-bg`, `--rim-text`, `--rim-mid`, `--rim-blue`, `--font-serif`, `--font-sans`, `--reading-width`.
- No box-shadows. No borders unless functionally required.
- **Mobile-first responsive:** All new UI must work at 360px minimum (primary target 390px). Breakpoints: `@media (max-width: 430px)` for phones, `@media (max-width: 768px)` for tablets. Minimum 44px touch targets on all interactive elements. Minimum 16px font on all inputs/selects (prevents iOS auto-zoom).

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

When the user says **"let's document everything"** (or similar), update ALL of these before ending:

1. **`FEATURES.md`** — add/update relevant feature section(s) + append session log entry at bottom
2. **`memory/MEMORY.md`** (project memory file) — prepend session log entry
3. **`RIM_Stack_Reference.md`** — update if anything changed: new service, new env var, stack version bump, role change, phase change
4. **`app/admin/manual/page.tsx`** — update any affected chapters (Registration, Programs, Member Accounts, Host Hub, Volunteer Roles). **The manual is not optional.** Writing documentation forces understanding and keeps sessions accountable.
5. **`app/admin/features/page.tsx`** — update feature cards, system map, data flows, dependency cards
6. **Memory files** — update `feature-interconnections.md` if new connections were established between features

Then commit and push all documentation changes together.

## Do Not
- Run a local dev server
- Edit `normalize.css`, `webflow.css`, or `rim.webflow.css`
- Spread Prisma `include` results into Client Component props (Date serialization failure)
- Change a program slug after host assignments exist
- Add Stripe live keys — keep test mode until go-live
- Commit or expose API keys or secrets
- Create new files when editing an existing one would do
