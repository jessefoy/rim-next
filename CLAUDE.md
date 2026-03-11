# RIM Next — Claude Instructions

## Workflow
- **Never run a local dev server.** Push to GitHub; Vercel auto-deploys in ~1–2 min.
- `npm run build` = `prisma generate && next build` — run locally to catch TypeScript errors before pushing.
- Keep changes minimal and focused. No over-engineering or speculative improvements.
- Prefer editing existing files over creating new ones.
- Full stack reference: `RIM_Stack_Reference.md` in project root.

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

When the user says **"let's document everything"** (or similar), update ALL FOUR before ending:

1. **`FEATURES.md`** — add/update relevant feature section(s) + append session log entry at bottom
2. **`memory/MEMORY.md`** (project memory file) — prepend session log entry
3. **`RIM_Stack_Reference.md`** — update if anything changed: new service, new env var, stack version bump, role change, phase change
4. **`app/admin/manual/page.tsx`** — update any affected chapters (Registration, Programs, Member Accounts, Host Hub, Volunteer Roles)
5. **`app/admin/features/page.tsx`** — update feature cards, system map, data flows, dependency cards

Then commit and push all documentation changes together.

## Do Not
- Run a local dev server
- Edit `normalize.css`, `webflow.css`, or `rim.webflow.css`
- Spread Prisma `include` results into Client Component props (Date serialization failure)
- Change a program slug after host assignments exist
- Add Stripe live keys — keep test mode until go-live
- Commit or expose API keys or secrets
- Create new files when editing an existing one would do
