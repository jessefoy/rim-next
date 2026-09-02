# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### Session 176 (2026-09-02) — ✅ Public-page consistency pass — on `main`, deployed, verified

**What Jesse asked.** *"Look at our public facing pages to ensure the design is aesthetically pleasing and consistent."* A dual-agent audit (design review + browser measurement, 16 pages at 375 and 1280) answered it in one sentence: **the site was authored at the centre and generic at the edges.** `pp-hero` measured identical across ten pages, but the five pages a visitor reaches at the moment of commitment each wore a private vocabulary with no hero, so the site changed identity exactly where trust is decided. Consistency scored 1/4; the surface 18/32.

**Shipped + live** (7 commits, `2ac4990`). `/join`, `/login` ×3, `/teachers`, `/teachers/[slug]` and `/courses` rebuilt onto the `pp-` grammar — this removed the **last Webflow-era markup on the public site**. The spine decided at page level (`.pp-page--spine`, closes `2026-08-10-006`), `/donate` excepted. The public nav and footer got the member area's 44px / 16px interaction floor. **All six `cdn.sanity.io` program hero images re-hosted to Vercel Blob** by a new migration, which ran clean on deploy.

**Verified.** `tsc` + `next build` clean on every commit; 19 public pages measured at 375px with **zero overflow, zero targets under 24×24, zero inputs under 16px**; one left edge at 110 on all five spine pages; non-spine pages confirmed unmoved. Full narrative, including the two corrected audit findings and the three regressions measurement caught, in `session-log.md` (s176).

**Jesse's preserved draft shipped inside this work**, at his instruction ("build on top of the draft"), with its two known defects repaired. **Its copy is live but NOT ratified** — see the standing reminder.

### ⏰ STANDING REMINDER — say this to Jesse every session until he closes it

**Public copy waiting on Jesse. He asked to be reminded each session.**

1. **`/your-first-visit` carries two placeholder paragraphs Claude wrote** (backlog `2026-08-10-002`, marked `PROVISIONAL` in the source): the **parking + which entrance** at 4040 N. Calhoun Rd, and the **practical details** (shoes off? tea? restrooms?). The placeholders deliberately assert nothing unverifiable about the building, but this page is linked from the home hero's **primary** button.
2. **The session-174 copy set AND the session-176 draft copy are both provisional until his read-aloud.** Ratification is his explicit yes, never inferred from silence, from a positive reaction, or **from the fact that it shipped**. The s176 draft rewrote all four Community Care Agreements, which now render on **four** surfaces (`/join`, `/account/welcome`, `RegistrationForm`, and the new public `/community-care-agreements`).
3. **`public/images/color-powder-diversity.webp` has no recorded provenance.** It is live on `/diversity`. Every other public image has a credited source.

### OPEN — Jesse's, none blocking

1. **The read-aloud** and the first-visit logistics (above).
2. **`2026-09-02-001` (high) — two pieces of placeholder DATA are public.** `/courses` shows one course, *"Test Course / This is a subheading"*, opted into the public catalogue via `Course.publishOnPublicCatalog`; and the one public teacher profile has no `photoUrl` and no `bio`, so it renders as an initial-letter circle. **Both are data, not code** — Course Manager (`/tools/learning`) and the Member Registry (`/admin/members/[id]` → Teacher). Session 176 gave both pages real heroes, which made the emptiness *more* visible. Claude deliberately did not change either: what is public about RIM's own teacher and catalogue is Jesse's call.
3. **The Sanity project is now safe to delete** — that was the blocker. `2026-08-09-001` also drops the `LIVEKIT_*`, `NEXT_PUBLIC_SANITY_*`, `SANITY_API_TOKEN` and `GMAIL_*` vars, **fixes the `NEXTAUTH_URL` trailing space** at source (that one *is* read), and deletes the "RIM — Community" Drive folder. Worth adding `TEAM_EMAIL` while he is in there — it is unset, so the two public forms fall back to `hello@`.
4. **Whether the community introduction + the Copy and Voice Brief should live in the repo.** Both were pasted into sessions; the introduction is the authority for `/what-we-practice` and is given to every new participant. Deliberately not committed unilaterally.
5. **The authenticated shell walkthrough** (behind login, unverifiable by Claude): the account drawer + rail collapse on phone and desktop, the hub drawer, and the half-screen-width pass across a Space, the Scheduler, Program Manager and the Member Registry.

**NEXT concrete step:** Jesse's call. Nothing is half-built and nothing is blocked on Claude. The two candidates: (a) the **read-aloud** on the now-live public copy, which is the only thing standing between the copy and being finished; or (b) the **Webflow pre-cancellation errand** — the redirect map (`2026-08-07-003`), asset rescue (`2026-08-09-006`), and the parked forms audit (`2026-08-10-003`), whose blocking unknown is his alone (Webflow → Forms and Zapier → Zaps cannot be read from markup).

**Still queued (backlog):** `2026-09-02-002` (restore the teacher course listing — it was dead code), `-003` (em-dashes + a stray `h3` surviving in **authored** program rich text, which no code change reaches), `-004` (prune the `jn-` page shell + legacy login CSS now that nothing references them), `2026-08-09-002` (in-tool links drop `?hub=` — needs the four-layer hub-routing treatment), `-003` (Programs tool index has no page title), `-004` (tools-chrome hex sweep), `-005` (css-prune the ~14 dead backend CSS families), `2026-08-07-009` (public **desktop** nav/footer touch targets — note s176 raised the *public* nav and footer to 44px, so re-measure before working this), `-010` (consolidate the three visually-hidden utilities), `-002` (volunteer + Kalyana Mitta pages unmeasured — **s176 measured them; likely closeable**), `2026-06-13-003` (course landing onto the design system), `2026-08-08-005` (queued decision: should `effectiveCoordinator` also require ACTIVE?).

## Prior handoff reference

### Session 175 (2026-09-01) — ✅ Member self-service registration management removed — deployed

Jesse's product call: **members do not cancel their own registrations.** Commit `ab686b1` removed `/account/programs`, its detail page, the two member registration APIs, `CancelRegistrationButton`, the member-nav entry, and the feature's CSS/doc residue; legacy URLs permanently redirect to the dashboard. Public registration, waitlists, registration records, and registrar/staff cancellation all remain. No schema, migration, cron, or public confirmation email was removed. Full narrative: `session-log.md` (s175). **Do not restore member self-cancellation** unless Jesse explicitly reverses this.

**Jesse's standing calls (still in force):** always push to `main` (supersedes the s148 preview-branch rule); the orientation notice, "Good first visit," the floating nav pill, the chapter band, and the hero paper panel are tombstoned in `RIM_Public_Pages.md`; the membership block speaks dana, not "free." **From s174:** never **"free"** as a price word anywhere on the site (it is *freely offered* / *community-supported*); dana framing **consistent but not over the top**; the handful is an **ordered structure**, never "picking and choosing"; copy is **provisional until his read-aloud**; `/teachers` stays unlinked for now.

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
- **s176 — the public pages measured for consistency, and the threshold pages
  joined the system.** The verdict worth remembering: the site was **authored
  at the centre and generic at the edges**, changing identity at the moment a
  visitor commits. `/join`, `/login` ×3, `/teachers` and `/courses` moved onto
  `pp-`, removing the **last Webflow-era markup** on the public site. The spine
  is **decided** at page level (`.pp-page--spine`; `/donate` excepted), the
  public nav/footer got the member area's 44px/16px floor, and the six
  `cdn.sanity.io` program heroes were re-hosted so the **Sanity project is now
  safe to delete**. Two audit findings were **corrected, not implemented** (the
  38/28 heading tiers are a system, not drift) and three of Claude's own
  regressions were caught by **measuring the deploy, not by `tsc`**. Rules in
  `RIM_Public_Pages.md`.
- **s174 — the public pages got a ratified voice, and RIM's self-description
  got corrected.** The handful is an **ordered structure** (organized by
  function into seven gatherings, a response to having every tradition at once),
  not eclectic gathering — authority is the community introduction given to
  every new participant. Copy standards now live in `RIM_Public_Pages.md` →
  "Copy and voice" + the `/how-jesse-writes` skill; **ratification is Jesse's
  read-aloud, never inferred from silence.** Two new pages
  (`/what-we-practice`, `/your-first-visit`).
- **s173 — the box-model audit closed.** `width: 100%` + padding only
  overflows what nothing shrinks: flex children are safe, grid items and plain
  blocks are not, and a long unbreakable token (an email address) looks
  identical but needs `overflow-wrap`, not `border-box`. Measured, not
  pattern-matched — 15 of 18 static candidates were false positives. Method +
  rules in `RIM_Public_Pages.md` → "No global border-box."
- **s171–172 — context diet + ACTIVE-only coordinator authority.** CLAUDE.md
  278→212, UP_NEXT 1,856→177, Sanity gone from all docs, `isHubCoordinator`
  ACTIVE-only across 17 gates. Queued decision `2026-08-08-005`: should
  `effectiveCoordinator` (content layer) require ACTIVE too?
- **s172 — program lifecycle completes + the member-area interaction floor.**
  One-time programs retire themselves (`hideWhenPast` + the archive cron); the
  home page composes (dynamic doors, alternating splits); the whole
  authenticated area got focus/target/text floors and stopped clipping at
  half-screen widths (the border-box sweep).
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
- **`min-height` on a content-box element ADDS to its padding.** Raising a touch target with `min-height: 44px` on an element that keeps `padding: 8px 12px` produces a 60px box, not a 44px one — and this repo has no global `* { box-sizing: border-box }`. Session 176 grew the whole public nav bar this way, leaving `.nav__link` at 60px beside a `<button>` sibling at 44px (buttons are border-box by UA default). **Always pair a target-size `min-height` with `box-sizing: border-box`.**
- **An appended single-class `display` overrides an earlier media query.** `custom.css` is appended to, so a rule added at the end beats a media-query rule of equal specificity declared earlier. Session 176 appended `.nav__donate { display: inline-flex }` and silently **un-hid** the desktop DONATE button on phones (it carries `display: none` under 768px), which pushed the hamburger 9px off-screen on every public page. **Any appended `display` on a responsively-hidden class must live inside the breakpoint it belongs to.**
- **`tsc` and `next build` prove a page compiles, not that it composes.** All three of session 176's regressions passed both, and all three were found by measuring the deployed page. For any visual change, measure the rendered result (`getBoundingClientRect` after `document.fonts.ready`, at 375 and 1280) before calling it done.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
