# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### Session 171 (2026-08-08–09) — ✅ The optimization session: doctor pass, context diet, staleness purge, ACTIVE coordinator authority — all on `main`, deployed

**Shipped + live.** A whole-system hygiene pass — 9 commits + 3 closing-doc commits on `main`, every round reviewer-gated, `tsc`-green. Full narrative: `session-log.md` (session 171).

- **Context diet:** CLAUDE.md 278 → 212 lines (Closing Ritual + Feature Backlog became the `closing-ritual` + `backlog` skills; Sanity content gone); UP_NEXT itself 1,856 → 177 lines. Next session's opening loads ~67k fewer est. tokens.
- **Auth fix:** `isHubCoordinator` is now **ACTIVE-only** — a paused/inactive coordinator keeps board visibility but loses all 17 mutation/authority gates (coverage, rotations, sub-requests, Google-file lead approval). Rule recorded in `RIM_Scheduler.md`, `RIM_Hub_Engineering.md`, `RIM_System_Architecture.md`, `FEATURES.md`.
- **Staleness purge:** `RIM_Stack_Reference.md` truth pass (session-room block, LiveKit env/rows, Sanity ×4, rim-connect rows → tombstones); 330 dead session-room CSS rules + `livekit-prefabs.css` pruned; 7 spent docs + `AGENTS.md` removed; `.claude-memory/` mirror refreshed + wired into closing as step 7c; all merged branches deleted (only `main` remains, local and remote); dead WASM config out of `next.config.ts`.
- **Email templates:** the "Sanity Studio" callout repointed to Program Manager — label, seeds, and the idempotent `repoint_email_template_sanity_note_to_program_manager` migration (runs on this deploy).

**OPEN — Jesse's dashboard chores (none blocking):**
1. **Vercel build log** — confirm the deploy is green and shows the sanityNote migration's per-template `repointed` lines.
2. **`/plugin` in the Claude app** — confirm the 5 disabled plugins (productivity, marketing, small-business, cowork-plugin-management, the custom `plugin_01Eeb…`) actually show disabled.
3. **Vercel env** — remove any lingering `LIVEKIT_*` / `SANITY_*` vars (nothing reads them).
4. **Sanity** — project `xxgvfpjf` + the Studio can be deleted when ready (export the dataset first if any legacy content matters).

**NEXT concrete step:** unchanged from session 170 — **dated events** (backlog `2026-08-07-008`): a retreat renders identically to a weekly drop-in with no date; for one-time events the date is the decision criterion and should lead the card. (The chapter-eyebrow alternative is tombstoned, s148.)

**Queued decisions for Jesse (from this session):** `2026-08-08-005` — should `effectiveCoordinator` (content-layer: trash, moderation, member management) also require ACTIVE status? Policy call, not a missing filter.

## Prior handoff reference

### Session 170 (2026-08-07) — ✅ The two public listing pages made one system — deployed

`/community-programs` + `/this-week` now share one grammar: one `pp-hero`, one card (`.pl-card` / `.pl-card--time`), one left edge, cadence 96/36/24, today marked and jumpable. Fixed in passing: the 44px `.lr-btn` phone overflow (P0), three WCAG AA hero failures, 17 "Learn More" links. Authority: `RIM_Public_Pages.md`; full narrative in `session-log.md` (s170).

**Still open from s170:**
- **⚠️ Data fix only Jesse can make (`2026-08-07-011`):** Awakening The Heart + The Art of Meditation show "9:30 AM–10:30 PM CT" — end time stored as 22:30 instead of 10:30. Fix in Program Manager.
- Jesse's standing calls: **always push to `main`** (supersedes the s148 preview-branch rule); the orientation notice + "Good first visit" are tombstoned; membership block speaks dana.
- Queued: nav/footer touch targets (`2026-08-07-009`); consolidate visually-hidden utilities (`-010`); `.pl-cat` id anchors for home-page category doors (`-001`); volunteer + Kalyana Mitta pages unmeasured (`-002`); the Webflow redirect map (`-003`) is the last thing between Jesse and cancelling Webflow.

**Still open from earlier sessions (verification, none blocking):**
- **s166 (Google Files fine-tuning):** prod walk-through — drafts→Share flow, creator attribution, governed deletion (Remove → lead Approves/Keeps), "Notify the Space" emails, `file-shared`/`file-comment` templates visible in `/admin/emails`. The "RIM — Community" Drive folder is Jesse's to delete in Google.
- **s165 (cutover):** old `…/documents` URLs redirect to Files; Community's Conversations toggle works.
- **s162 (authenticated design unification):** signed-in visual QA of one representative desktop + phone page per family (personal, hub, admin, Program Manager, Course Manager, Scheduler).

## Recently completed / reference

**The archive lives in `session-log.md`** — every completed session's full
narrative, decisions, and connections. This section holds only landmarks a
cold session needs for orientation; at closing, move anything older than the
last couple of sessions into the log instead of letting it accrete here.

**Landmarks (newest first):**
- **s169–170 — public pages rebuilt natively.** The static front-facing pages
  live in RIM's own design system (`RIM_Public_Pages.md`); the two listing
  pages share one hero/card/spine grammar. Design still being refined.
- **s165–166 — Google Workspace Files complete.** "RIM orchestrates, Google is
  the file cabinet." Native Documents + Mind Maps retired; Community Space
  retired (every Space is stewarded). Authority: `RIM_GoogleWorkspace.md`.
- **s159 — Zoom cutover.** The in-browser LiveKit room was retired; sessions
  run on Zoom ("RIM orchestrates, Zoom is the room"). Per-occurrence meetings,
  own-name Claim-Host, no per-person registration. Authority: `RIM_Zoom.md`.
- **s153 — HOST role retired**; the coordinator/team model carries hosting.
  Authority: `RIM_MemberRegistry.md`.
- **s119 — sign-in codes replaced magic links** (6-digit via Resend).
  Authority: `RIM_Auth.md`.

---

## Next deliverable candidates

### Editor toolbar polish

Jesse said "I'll address the menu items later" early in session 97. The current toolbar dropdowns (Heading, Callouts, Dharma blocks) and bubble menu contents are reasonable defaults but he may want refinements:

- Specific button choices and order
- Iconography
- Mobile-specific layout changes
- Whether the floating "+" on empty lines should be wired up (Tiptap extension is installed but not used; Notion-style block insertion menu)

Lighter than Webflow weekly schedule but worth a focused pass before the toolbar set in stone.

### Stage 2d editor blocks (Page Designer expansion)

Three blocks in the original Page Designer plan that were never built: Announcement, EarlyArrival, DanaInvitation. They'd replace top-level Program fields (`specialAnnouncement`, `earlyArrivalMessage`, the page-rendering of `danaMessage`) with inline blocks the author places where they want.

Now that the Tiptap migration is complete, these blocks can be added as Tiptap extensions (mirror existing `Callout`, `PullQuote`, etc. in `components/rim-tiptap/extensions/`). Plus a data migration that reads the legacy fields and inserts matching blocks at the end of the description.

Not blocked by anything. Each block is a small, contained piece of work.

### BlockNote walker eventual removal

Once every row in the database has been edited and saved as HTML, the BlockNote-JSON walker in `lib/renderRichContent.ts` and `lib/renderRichContentServer.ts` can be removed. Until then it's the safety net for unmigrated content. No deadline; depends on user activity. Worth checking the database periodically (`SELECT COUNT(*) FROM ... WHERE jsonb_typeof(field) = 'array'`) to know when it's safe.

---

## Smaller items still parked

- **Vercel `NEXTAUTH_URL` trailing space** — code is defensively trimmed in five places (`lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release`, `app/api/stripe/checkout`); the env var itself should still be cleaned at the source so future surfaces don't pick up the same bug. One-time edit in Vercel project settings.
- **Coordinator notes area** — `Hub.coordinatorNotes Json?` (or HTML, post-migration) + coordinator-only editor surface. Was discussed during the team-management work; never built.
- **Duplicate-Aside backlog item** — Editor allows inserting an Aside immediately after another Aside. Was true with BlockNote's structure; may not apply post-Tiptap-migration. Revisit if it's still observable.
- **Hub document export** — fixed session 102. HTML documents export as `.html`; legacy BlockNote JSON documents still export as `.md`. Both paths tested via TypeScript.

---

## Permanent reminders (still true)

- **Hub membership is authoritative when it exists.**
- **No-delete policy for HubMember.** Never call `db.hubMember.delete()` outside the ADMIN-only route.
- **Use `after()` from `next/server` for fire-and-forget email sends in route handlers.** `void (async () => {})()` is silently killed by Vercel's serverless teardown.
- **Trim `NEXTAUTH_URL`-derived constants.** Every `BASE_URL` does `.trim().replace(/\/$/, "")` because env vars can carry whitespace.
- **Every `sendTemplatedEmail(slug, …)` must ship with a matching seed entry in `prisma/migrate.mjs` in the same commit** (Email Template Gate, CLAUDE.md). Missing templates silently no-op — recipients get nothing. Use defensive `findUnique → create` so any manual `/admin/emails` edits are preserved.
- **Trash-management authority lives in one place:** `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts`. ADMIN, GUIDING_TEACHER, or hub coordinator. Use this helper anywhere trash visibility or restore/permanent-delete gating is needed — don't reimplement the role check inline.
- **Coordinator-level authority lives in one place:** `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts`. Returns true for hub-coordinator flag, ADMIN, or GUIDING_TEACHER (GT acts as soft admin at the content layer on every hub). Use this helper anywhere you'd previously written `(member?.isCoordinator ?? false) || isAdmin`. Don't inline the boolean.
- **Hub-thread filter shape lives in one place:** `activeHubThreadWhere(hubId)` in `lib/hubQueries.ts`. Returns `{ hubId, documentId: null, deletedAt: null, archivedAt: null }`. Use it for any findMany / count surfacing hub-level threads to members. Don't inline the filter; the three previous drift bugs (`status: { not: "ARCHIVED" }`, missing `documentId: null`, missing `deletedAt: null`) all happened by inlining.
- **`archivedAt`, not `status`, is the canonical archive marker for hub threads.** `HubConversationThread` now mirrors `HubDocument` (session 115). The `status` column is kept in sync by the PATCH route for backward compat but will be dropped in a future cleanup. Don't write new code that reads `status` to determine archive state.
- **Three-stage hub delete is enforced at both UI and API layers.** The UI hides the Delete button on non-archived items; the API returns 400 with "Archive this … first" unless the item is archived. Both rules matter — the UI is the friendly path, the API is the hard guard against direct calls.
- **Resolve `Program.name` from the slug before sending any host email.** Slugs are URL-safe but ugly — `essential-dharma-study-2024-07-14` in an email body is a reliability issue, not a cosmetic one. Pattern: `await db.program.findUnique({ where: { slug }, select: { name: true } })` near the top of the email-sending block.
- **Storage paradigm for editor content is plain HTML strings.** `RimTiptapEditor` produces HTML directly via `editor.getHTML()`. Renderers accept both HTML and legacy BlockNote JSON via format detection — unmigrated rows still display correctly.
- **The selection bubble menu is the primary formatting surface in editors.** Top toolbar is for insertion-only actions (image, table, hr, callouts, dharma blocks). Don't put inline marks in both — duplicates discovery paths.
- **`useEditor` returns null on first render with `immediatelyRender: false`.** Any `useEffect` that touches refs INSIDE the rendered tree must include `editor` in deps so it re-runs after editor initialization (the early `if (!editor) return null` means refs are null on the first run).
- **`Array.isArray(body)` filters at page level will silently drop HTML.** Pre-Phase-2 code had patterns like `initialBody={Array.isArray(doc.body) ? doc.body : null}` — these reject HTML strings and pass null, causing content-appearing-missing bugs. Trust the editor component's own `isHtmlString` / `renderBlockNoteHtml` normalization; don't filter at the page.
- **Tiptap's empty-document HTML is `"<p></p>"`, not `""`.** `!draft` truthiness checks fall through. Use `html.replace(/<[^>]+>/g, "").trim().length > 0` to detect meaningful content.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
