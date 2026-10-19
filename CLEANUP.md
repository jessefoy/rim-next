# RIM Cleanup Queue

**What this file is.** A static reference of items in the RIM Next system — code, schema, config, integrations, documentation — that exist as residue and are candidates for removal. Every item is decision-ready: confirm or override, then execute.

**What this file is not.** Not a backlog of new work. Not a list of features to build. Items that were *planned but never built* are tracked at the bottom of this file under **"Not on this list"** and should not be treated as residue.

**When to read this.** At the start of any session whose purpose is cleanup, refactor, or schema/config maintenance. Skip when the session is feature work — cleanup belongs in its own dedicated session, not interleaved with feature development.

**How to use it.**

- Items are stable-numbered. Sessions can be scoped by item number (*"this session is items 1–4 and 7"*) or by theme (*"Theme A this session"*).
- When an item is fully resolved, remove it from this file in the same commit that resolves it. Don't leave struck-through residue in the residue file.
- If a "decision-needed" item resolves to *keep*, remove it from the file. If it resolves to *remove*, do the work and then remove it from the file.
- If new residue is identified during ongoing work, add it here as a new item (continue numbering — don't reuse retired numbers).

**Origin.** This list was generated in a single inventory pass on May 6, 2026, after the architectural reversal of the April Webflow + RIM Next hybrid. It is intended to be a working tool for the cleanup that pivot left behind, plus drift accumulated during the months the directive was in effect.

---

## Theme A — Webflow-bridge removal

All items resolved in session 102. Notes:

- **#1** `rim-connect.js` — already removed before session 102 (part of the pivot reversal)
- **#2** Public-bridge API endpoints — already removed before session 102
- **#3** Public-API cache header pattern — removed with the routes
- **#5** Webflow Site Settings head code — removed manually in Webflow Designer (session 102)
- **#6** Webflow staged pages `/rim-next/Programs` and `/untitled/program-detail` — removed manually in Webflow (session 102)

---

## Theme B — Google Meet removal

LiveKit replaced Google Meet in session 86. Code-level removal is complete (items #13, #14, #18 were already gone; #19 doc update done session 100). Manual items remain.

**Do not touch the live Google identity (corrected 2026-10-19).** `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` and the `rim-files@…` service account (a Manager on each Shared Drive, no domain-wide delegation) are the live credentials for all of Google Files, read by `lib/google/auth.ts`. Removing them breaks every team's Files. Items #15 and #16 are only the Meet-era leftovers below.

| # | Item | Where | Action |
|---|---|---|---|
| 15 | Google Meet env vars | Vercel env: `GOOGLE_PRIVATE_KEY`, `GOOGLE_ROOM_EMAILS`, `GOOGLE_CALENDAR_ID` (no code reads them; checked 2026-10-19). **Not** `GOOGLE_SERVICE_ACCOUNT_*` | Remove from Vercel |
| 16 | The Meet-era service account | Google Cloud Console: the domain-wide-delegation (DWD) account used for Meet room booking, if it still exists. **Not** `rim-files@…` | Manual: confirm in Google Cloud it is not `rim-files@…`, then revoke its delegation and delete it |
| 17 | Four shared room accounts | `meet1@`–`meet4@` Google Workspace accounts | Manual: archive or delete in Google Workspace |

---

## Theme D — Direct code residue

All items resolved in session 100. Notes:

- **#31** Four broken redirects — updated to `/tools/programs` and `/tools/programs/:slug`
- **#32** `/api/programs/` audit — all three routes active (iCal, registrations CSV, manual reminder trigger); kept
- **#33** Host Schedule residue — already clean; no orphaned components
- **#34** `legacyMemberstackId` — blocked on #43 (Memberstack CSV import); field is referenced in the import route; resolve together with #43
- **#35** `/admin/manual/editor` — removed; per-section edit (`/admin/manual/[slug]/edit`) is the current approach; new sections created via seed script

---

## Theme E — Decision-needed items (built, unclear if used)

All items resolved in session 100. Notes:

- **#36** Support Inbox — removed entirely. Routes, lib files, schema models, and Support Hub app links all deleted. Gmail OAuth env vars (`GMAIL_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI`) remain in Vercel and need manual removal.
- **#37** Course drip system — removed. No courses were using it. Schema columns, `lib/drip.ts`, `drip-release` cron, and all UI in CourseEditor/LessonEditor deleted.
- **#38** Site Banner — removed. `/admin/banner/`, `SiteBannerStrip`, schema models, and API routes all deleted.
- **#39** `UserToolAccess` — kept. Intended for future use; managed via Neon console.
- **#40** `UserHubAccess` — removed. HubMember is the authoritative model; UserHubAccess was unenforced and unused.
- **#41** `sectionGrants String[]` — kept. Has no UI yet but is a deliberate future hook; field is cheap to keep.
- **#42** `/admin/editor-lab` — removed.
- **#43** Memberstack CSV import — removed. `MemberImport.tsx` and import route deleted. `legacyMemberstackId` field also removed from schema.
- **#44** Phase 2 scaffolding — removed. `MembershipType`, `UserMembership`, `AttendanceRecord` and their enums all dropped.
- **#45** `Donation` table — kept as write-only ledger. Receives Stripe writes from registration dana flow. A read UI is "Not on this list" for now.

---

## Theme F — Documentation cleanup

All items resolved in session 101. Notes:

- **#46** `RIM_Hub_Model.md` — rewritten: hub count corrected (14 operational + 2 governance), Tasks removed from all sections, Support Inbox removed, core sections updated to 4 (not 5), RimProseEditor → RimTiptapEditor, BlockNote JSON → HTML, UserHubAccess removed, §13 Support Hub tools cleared, §15 schema rows for UserHubAccess/TaskList/Task/Subtask removed
- **#47** `RIM_Feature_Interconnections.md` — Tasks removed from Hubs, Support Inbox section deleted, Editor System rewritten (Tiptap primary), Email System Gmail reference removed, Learning System BlockNote → Tiptap, CSS Architecture Inter → Open Sans, Webflow migration reference replaced with legacy shim note
- **#48** `RIM_System_Architecture.md` — s73-vs-s76 inconsistency resolved in "What's Next"; hub count updated; /tools/inbox removed from tools list; hub-access removed from member profile section registry; Tasks removed from Hub Model section list
- **#49** `FEATURES.md` — Phase 2 scaffolding models (MembershipType, UserMembership, AttendanceRecord) removed from §7; Memberstack import removed from §11; MemberImport.tsx references removed; legacyMemberstackId removed; Support Inbox §29 updated from PARKED → REMOVED; Site-Wide Banner §36 marked as removed; Tools table updated (Support Inbox row removed); AlertStrip §35 Alert-model note corrected
- **#50** `/admin/sitemap` — already removed (page does not exist in codebase)
- **#51** `/admin/features` — already removed (page does not exist in codebase)
- **#52** Inter vs. Open Sans — fixed in `RIM_Feature_Interconnections.md` (was Inter, now correctly Open Sans)

---

## Theme G — Future-removable (tracked, not for now)

Items that will be removable later, after a precondition is met. Tracked here so they don't get forgotten.

| # | Item | Where | Precondition |
|---|---|---|---|
| 53 | Multi-format editor renderer | `lib/renderRichContent.ts`, `lib/renderRichContentServer.ts` | All content rows are HTML (no remaining BlockNote JSON) |
| 55 | Legacy CSS shim | Bottom of `public/css/custom.css` (~25 Webflow classes for ~15 unredesigned pages) | All ~15 pages have had their design pass |
| 56 | Sanity programs/courses/lessons schemas | Sanity studio | After old documents in the dataset are confirmed unused; programs/courses/lessons all migrated to Postgres, but Sanity schemas remain |
| 57 | `BASE_URL` whitespace-trim defensive code | 5 places in `lib/` and `app/api/` | After `NEXTAUTH_URL` env var itself is cleaned at the source in Vercel project settings (UP_NEXT loose-end) |

---

## Theme H — Session-139 dead-code usage-tracing audit (2026-06-07)

A full usage trace — every component, lib helper, model, enum value, page route, API route, and dependency cross-referenced to its callers — confirmed the codebase is largely clean; the big removals already happened (Themes A–F). What it surfaced, verified and decision-ready below. **These are a post-launch task: dependency removal needs an `npm` change + clean build, so don't destabilize before the go-live cutover.**

| # | Item | Where | Action |
|---|---|---|---|

**Keep despite 0 direct refs (verified NOT dead — do not remove):** `react-dom` (framework), `@types/sanitize-html` (type support for the live `sanitize-html`). (#58 to #63 and #65 resolved: the components and the Mantine, Sanity, Portable Text, `googleapis`, `google-auth-library` and LiveKit packages are gone, checked against `package.json` and the tree 2026-10-19.)

**Verified clean:** all 39 lib helpers imported; all 58 Prisma models used (the zero-query ones — `Account` / `Session` / `VerificationToken` / `MigrationFlag` — are NextAuth-adapter and migration internals, correctly accessed outside `db.X`); no confirmed dead page routes (Next routes are URL-reachable; scan "orphans" were compositional-link false positives).

**`SUPPORT` role (updated 2026-10-19).** Per Jesse (session 139), the **Support Hub stays as a normal team hub** even though its Inbox tool was removed (s100). Since session 153 the role no longer maps to a team (`lib/syncHubMembership.ts` keeps only TEACHER and REGISTRAR) and `lib/roleLabels.ts` leaves it unlabelled; the `Role.SUPPORT` enum value remains, read by nothing. Dropping an enum value is DDL; leave it unless a schema pass takes it on.

**Latent bug found + fixed (session 139):** `HostHubHomeClient` PATCHed `/api/hub/[slug]/home` (singular — 404); corrected to `/api/hubs/[slug]/home` (plural). The inline home-content editor it lives in is now redundant with `/admin/hubs/[slug]/edit` — candidate to consolidate later.

---

## Theme I — Session-139 feature removals (dormant residue + dep prune)

Three unused features removed this session (staff manual, Schedule PDF export, Reflection Questions). The code is gone and build-verified (`tsc` + `next build`); these are the dormant tails to clean **post-launch**.

| # | Item | Where | Action |
|---|---|---|---|
| 67 | Dead `man-` CSS prefix | `public/css/custom.css` — manual feature removed | `scripts/css-prune.mjs` |
| 68 | `manualUrl` in 2 role-assignment email templates | `prisma/migrate.mjs` seeds for `registrar-role-assigned` + `host-role-assigned` still list a `manualUrl` var + a "Read the Staff Manual" link; the live DB templates do too. Renders an empty link now. | Edit the 2 seed bodies + update the live templates via `/admin/emails` |
| 69 | Dormant DB tables/columns (no DDL ran) | `manual_sections`; `reflection_questions` / `_options` / `_responses`; `Lesson.questionsRequired` column — left in Neon, unread | Drop post-launch (one idempotent migration) |
| 70 | Empty manual migration blocks | `prisma/migrate.mjs` — flag-guarded blocks whose manual seed calls were stripped are now harmless no-ops | Prune post-launch (cosmetic) |

**Decision recorded — public content pages KEPT.** `/donate` (live GiveButter widgets + Dana content), `/diversity`, `/kalyana-mitta/*`, and `/volunteerism/*` were considered for removal and **kept** (session 139): they're finished content, not rough stubs. A future *presentation* redesign (native CSS over the Webflow shim) is a redesign, not a delete. Do not re-propose deleting them as "static stubs."

---

## Theme J: 2026-10-19 integrity audit residue

Found while checking the audit's fixes against the code (2026-10-19). #72 and #73 can drop together in one migration.

| # | Item | Where | Action |
|---|---|---|---|
| 72 | `SessionBan` has no writer | Bans were written only by the retired LiveKit room (s159). The Zoom door's check was removed 2026-10-19; the model and `session_bans` remain | Drop the model and the table (the merge already skips a missing table) |
| 73 | `Program.livekitRoom` is read nowhere | The writes in both `programs-pg` routes and the select in `lib/scheduleSessions.ts` were removed 2026-10-19; the column remains | Drop the column (the schema comment's "rename pending" is moot) |
| 74 | `Program.hideFromDashboard` and `Program.dayOfWeek` are written, never read | The Program editor and both `programs-pg` save routes write them (`dayOfWeek` is derived on save); nothing reads either (My Home and This Week decide from `lib/scheduleUtils.ts` occurrence rules). Note `StandingAssignment.dayOfWeek` is a different, live column | Decide whether "hide from My Home" is still wanted (then make My Home read it) or remove both fields from the editor, routes and schema |
| 75 | The occurrence lint guard never runs | `eslint.config.mjs` fails any re-defined `isOccurrence*` helper outside `lib/scheduleUtils.ts`, but there is no CI, `npm run build` doesn't lint, and `npx eslint .` reports about 77 errors in `app`, `components`, `lib` and `prisma` (118 counting `.claude` and `scripts`; 2026-10-19), so nobody runs it | Run the guard alone as a gate (`npx eslint --rule … app lib components` or a small script in `scripts/`), or clear the errors and add lint to the pre-push gate |
| 76 | `migrate.mjs` can't build a fresh database | Flag-guarded blocks run raw SQL against the dropped `hub_documents` table (e.g. `create_hub_document_notifications`, the session-113 archive columns, the session-165 `docKind` block). On production their flags are set, so they skip; on an empty database they would run and fail | Before any fresh-database restore, prune the retired blocks (with #70) or document that a restore starts from a Neon branch, not from `migrate.mjs` |
| 77 | Browser dialogs left | `components/HubTrashClient.tsx` (permanent delete), `components/admin/GoogleFileAdminClient.tsx`, and `components/rim-tiptap/RimTiptapEditor.tsx` (link `window.prompt`, upload and link `window.alert`). The conversation pop-ups were replaced 2026-10-19 | Move each to the in-page confirm and answer pattern fb5d7e5 used elsewhere (`FormDone`, `SaveNote`) |

---

## Not on this list

For reference: items flagged during inventory that are *absences* (planned or discussed, never built) rather than residue. Each is a "still wanted?" question for a strategy conversation, not a cleanup session.

- Self-service email change (`FEATURES.md` 11b)
- Donation Management UI (`FEATURES.md` 13)
- Volunteer Interest Form backend (`FEATURES.md` 15a — form exists, has no API)
- Kalyana Mitta Group Detail Form (`FEATURES.md` 15a)
- Access Denied / 401 page (`FEATURES.md` 15a)
- My Library rebuild (`FEATURES.md` 15a — `/account/dashboard-my-library` is currently a hardcoded stub)
- Tool home context cards (`RIM_Hub_Model.md` §11 — proposed `/api/tools/<tool>/context` endpoints)
- `UserToolAccess` admin grant UI (related to item #39 above — if #39 resolves to "remove the model," this absence resolves automatically)
- Hub `coordinatorNotes` field + editor (`UP_NEXT.md` smaller items)
- Schedule display marking paused hosts (`UP_NEXT.md` smaller items)
- Auth-aware Program Detail CTA `data-rim-member-cta` (`UP_NEXT.md` — was for Webflow; if a member CTA is still wanted on `/programs/[slug]`, that's a fresh design)
- Stage 2d editor blocks: Announcement, EarlyArrival, DanaInvitation (`UP_NEXT.md`)
- Editor toolbar polish (`UP_NEXT.md`)

---

*Working document · Started May 6, 2026.*
*Companion to: `UP_NEXT.md`, `FEATURES.md`, `session-log.md`.*
