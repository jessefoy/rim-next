# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### Session 170 (2026-08-07) — ✅ The two public listing pages made one system: one hero, one card, one spine — all on `main`, deployed

**Shipped + live.** `/community-programs` and `/this-week` were one job done two ways; they are now built from one grammar. **10 commits on `main`, deployed, `tsc`-green.** No schema, migration, dependency, env var, cron, or email-template change — two page files and `custom.css`. Authority: **`RIM_Public_Pages.md`** (now carries the listing-page system, the two CSS traps, and the new tombstone); full narrative in `session-log.md` (session 170).

**What was wrong, measured rather than read:**
- **A live P0 on every phone** — `.lr-btn` overhung its card by exactly 44px at ≤430px (`width:100%` + 44px padding on a `content-box` control; no global border-box since `webflow.css` stopped loading). The primary action on 17 rows was clipped. Fixed at the control, so `ListRow` + `HubScheduleClient` inherit it.
- **Three WCAG AA failures** — `/this-week` subtitle 2.80:1 and week nav 2.96:1 over its own photograph (copy column p99 **0.992**); `/community-programs` body 4.29:1. All cleared by folding both heroes onto `pp-hero`, which already carried the session-169 tiers.
- **`/this-week` was borrowing from the member area** — built on `.lr-row`/`.lr-btn` (shared with `HubScheduleClient`) and referencing `.pl-list`, a class with **zero rules** since the session-148 rename. That is why the two pages read as different sites.
- **Four different left edges on one page** — hero copy at 110, blocks centred at 190, interior text at 214 / 222 / 238.
- **17 links called "Learn More."**
- **Today ~2,360px down** on a page whose whole job is "what can I attend now."

**Now:** one `pp-hero` (`.pl-hero` deleted), one card (`.pl-card` + a leading-time `.pl-card--time` matching the Scheduler's occurrence-first grammar), **one left edge at every width**, rows running the full container, cadence **96 / 36 / 24** (72 / 28 / 20 on phones), today marked and jumpable, descriptive per-row link names, and program names as real headings.

**Jesse's calls this session, recorded so they are not re-litigated:**
- **"Always push to `main`."** This **supersedes** the session-148 preview-branch rule for new compositional elements. `RIM_Public_Pages.md` → "Process" and the `feedback-preview-before-production` memory were both rewritten. Work a `claude/*` branch for the gates if useful, then fast-forward and delete it **in the same turn**.
- **The orientation notice is tombstoned.** A `.pp-notice` panel above the listings was built and removed the same session. Its `h2` de-duplication was kept.
- **"Good first visit" is gone** — it was a hardcoded `Set` of two slugs in the page file, never a `Program` field. Any future badge comes from data editable in Program Manager or it does not ship.
- **The membership block speaks dana, not "free."** Rewritten via `/how-jesse-writes` from the home + donate language, "dana" named after the giving is described, linked to `/donate#dana-at-rim`.
- **Rows run the full container width** — the 900px cap and its `--pp-column` token were removed.

**⚠️ ONE THING FOR JESSE — a data fix only he can make (backlog `2026-08-07-011`).** Awakening The Heart and The Art of Meditation both render **"9:30 AM–10:30 PM CT"** on the live site. The end time is stored at 22:30 instead of 10:30. Program Manager; production Neon is unreachable from a dev machine.

**NEXT — the strongest remaining move (backlog `2026-08-07-008`): dated events.** A retreat currently renders identically to a weekly drop-in, with no date. For a one-time event the date *is* the decision criterion, and it should lead the card the way time leads a `/this-week` row. This is real information hierarchy rather than decoration, which matters because the obvious alternative — chapter eyebrows to differentiate the four category groups — is **tombstoned** (session 148: a sparse version of a rich pattern reads as cheap), and the four categories are genuinely peer content anyway.

**Also queued:** nav/footer touch targets under 44px (`2026-08-07-009`); consolidate the three visually-hidden utilities (`2026-08-07-010`); `.pl-cat` still has no `id` anchors, which still blocks the home-page category doors (`2026-08-07-001`); volunteer + the three Kalyana Mitta pages still unmeasured against the live rendering (`2026-08-07-002`); the Webflow redirect map (`2026-08-07-003`) remains the last thing standing between Jesse and cancelling Webflow.

**Two reflexes worth carrying (both cost time this session):**
1. **Measure glyph extents, not element boxes.** Sampling boxes reported the hero eyebrow at 3.76:1 and nearly triggered a gradient change that would have over-darkened the photograph for nothing; on real glyph extents it is 8.08:1.
2. **`pp-` is declared ~26,000 lines after `pl-`**, so an equal-specificity `pl-` override loses on source order — it silently swallowed a `max-width` and a `margin` before a doubled selector fixed it.

**Ops:** one deploy sat ~15 minutes without reaching production (norm ~40s). `npx next build`, a postcss parse, and a cache-busted `x-vercel-cache: MISS` proved the code was fine; an empty retrigger commit shipped in 40s. A deploy that does not land gets diagnosed before it is explained, and is never reported as shipped.

## Prior handoff reference

### Session 166 (2026-07-16) — ✅ Google Files fine-tuning: file detail page + Community retired + governed deletion + Basecamp notifications — all on `main`, deployed

A co-created refinement pass on the Google file system. **11 feature commits on `main`, deployed, `tsc`-green + reviewer-gated each.** Authority: `RIM_GoogleWorkspace.md`.

**Shipped + live:**
- **File detail page (3 slices).** `GoogleFileMeta` (sparse, loose-keyed) → **creator attribution** (backfilled from the audit log) + **draft/"held" state** (opt-out; RIM-created docs born held; "Your drafts" + Share). A **universal detail page** `/account/files/[fileId]` every file opens into, with **fidelity-aware rendering** (Google `/preview` iframe for shared docs — mints a reader link; RIM export for drafts; native embed for PDF/image/audio). A **conversation per file** (`FileComment`, plain-text + 5-emoji reactions, leads moderate).
- **Community Space retired — Phase 1.** The open, ownerless commons removed (it fit nothing in the governance model). Dropped the `openToAllMembers` primitive from code + the `canAccessHub` param + all call-sites; removed the Google-files Community place; deleted the seeded hub (`retire_community_space_v1`). **Phase 2 = drop the `openToAllMembers` column** (backlog `2026-07-16-001`, two-phase).
- **Governed deletion.** Remove → **Pending removal** (a member proposes) → a **Space lead** (coordinator/GT/ADMIN, via `isSpaceLead`) approves (→ Google's 30-day trash) or keeps; the requester can cancel. `GoogleFileMeta.pendingDeleteAt/ById` (`google_file_pending_delete_v1`); `GET /api/files/pending` + review sections.
- **Basecamp notifications.** Default **No one**, per-post, email-first. Two new gated templates `file-shared` + `file-comment` (seeded create-if-absent, "Files & Documents" group in `/admin/emails`). `NotifyPicker` (No one / Everyone / Choose people) in the comment compose + a "Notify the Space" detail action.
- **Cleanups.** Restored the `box-sizing: border-box` reset for form controls (webflow.css no longer loaded → the recurring "field overhangs its card" bug); honest "no longer available" 404 for files deleted directly in Drive; a daily `sweep-orphan-file-data` cron (7th) clearing RIM rows for permanently-gone files (trashed/transient left alone; audit log never swept).

**OPEN — prod verification (Jesse; none blocking):**
1. Deploy log shows `google_file_meta_v1` (+ "backfilled N"), `google_file_pending_delete_v1`, `retire_community_space_v1`, and the two `file-*` template seed lines.
2. **`/admin/emails`** — `file-shared` + `file-comment` appear under **Files & Documents**, editable.
3. Create a doc → lands in **Your drafts** (only you) → **Share with the Space** → teammate sees it. Open a shared Google Doc → renders with formatting; a PDF/image opens inline.
4. A file shows **Created by** (real names via backfill); **Change** re-attributes; a directly-dropped file reads "Added directly in Google Drive."
5. **Remove** a file → it moves to **Pending removal**; a lead **Approves** (gone) or **Keeps** it; the requester can **Cancel**.
6. Comment + **"Notify the Space"** → only the picked people get an email.
7. **Community** gone from the members' rail; other Spaces' **Files** open normally.

**NEXT (deferred, non-blocking):** Phase 2 column drop (`2026-07-16-001`); in-app notification inbox (deferred by design); cross-Space sharing (`2026-07-15-001`); two low review notes (notify picker over-offers paused members; /notify write-gate asymmetry). The "RIM — Community" Google Drive still exists in Google — Jesse's to delete/repurpose there.

### Session 165 (2026-07-16) — ✅ Google Files reshape finished + cutover complete; Mind Maps removed; native Documents retired — all on `main`

**The Google Workspace Files arc is DONE.** RIM's document & file system is now Google, per-Space. 13 commits on `main`, deployed, `tsc`-green; the big removals were inventoried (Explore) + two-phase. Authority: `RIM_GoogleWorkspace.md` (now as-built through cutover).

**Shipped + live:**
- **Mind Maps removed entirely** (`afdf5a6` + `56eaf35`, two-phase) — code, schema, `@xyflow/react`, ~140 `.mm-` CSS rules, nav, the `mindmap-topic-comment` email; orphaned topic threads cleaned up. **css-prune hazard fixed** (`sic-`/`sg-` removed from `DEAD_PREFIXES` — they'd become live again).
- **Community Space** (`2a0cbc5` + `46a225d`) — `Hub.openToAllMembers` primitive + `Hub.conversationsEnabled` toggle; Community seeded **Files-only**, Conversations turn-on-able in `/admin/hubs`; `canAccessHub(…, openToAll)` threaded only at participation gates (roster/admin fail-closed).
- **Files universal** (`ea93749`) — "Set up files for all teams" on `/admin/hubs` (`provision-all`); Jesse ran it, all hubs Files-ready. New hubs auto-provision on create (s164).
- **Upload poll fix** (`cd044ab`) — FilesBrowser polls until the Blob→Drive transfer lands (no manual refresh).
- **Global finder retired** (`6ea16cb`) — `/account/files` → redirect; rail "Files" link gone; files live only per-Space. Doc reader `/account/files/doc/[id]` kept.
- **Native docs migrated** (`0818a02` dry-run + `a0f7292` write) — 38 active native docs → Google Docs (`importHtmlAsDoc`), idempotent via `migratedGoogleFileId`; Jesse migrated all + verified fidelity.
- **Native Documents retired** (`a2a6e56` P1 + `519e7ed` P2, two-phase) — 30 files / ~5,760 lines removed; Activity/hub-home/Trash/Conversations stripped of their doc half; schema models/enums/`documentId`/`documentCategories` dropped; redirects added. **Kept:** RimTiptapEditor, renderers, `relativeDate`, `HubConversationThread`, `HubDocNotifyPanel`.

**OPEN — verify on prod (Jesse; none blocking):** confirm the final deploy is green and (a) hub Conversations still open + post; (b) a hub's old `…/documents` URL redirects to its Files tab; (c) Community shows Files, and flipping **Conversations enabled** in its hub settings surfaces the board.

**NEXT (housekeeping, non-blocking):**
1. **Prune orphaned `doc-`/`hub-doc-` CSS** — careful pass (`hub-doc-notify` is shared with Conversations; use `css-prune` scoped, verify no live class).
2. Deferred: cross-Space file sharing (backlog `2026-07-15-001`); the literal `Hub`→`Space` code rename; the GT self-serve "create a Space" entry point.

### Session 162 (2026-07-13) — ✅ Public Program refinement + authenticated design unification live on `main`

**Built and live:** Pampas/Mine Shaft/white foundation + `/style-guide`; refined public Program template and required-quote contract; linked teacher portraits with Member Registry upload; clearer Zoom-entry language; rebuilt Today hierarchy; unified personal, hub, admin, and tool shells/styles; dedicated `RIM_ProgramEditor.md` and `RIM_CourseEditor.md` references. Fifteen implementation commits through `9eae63a`; no schema/dependency/env/permission/email-template change.

**Open / being tested:** authenticated visual QA depends on Jesse's signed-in production review. The code/type/CSS gates passed, but the automated browser could not inspect private routes. Review one representative desktop + phone page from each family: personal destination, hub, admin, Program Manager, Course Manager, Scheduler.

**Next concrete step:** collect any page-specific screenshot issues from that representative review and make a small focused correction pass. Do not begin another global styling layer unless the issue is truly shared.

**Queued follow-ons:** hardcoded old-teal sweep (`2026-06-13-001`); public home-page section rhythm (`2026-06-13-002`); public course-landing parity (`2026-06-13-003`); native Documents and Mind Maps production edge-case verification from sessions 160–161.

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
