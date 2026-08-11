# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### ⏰ STANDING REMINDER — say this to Jesse every session until he closes it

**Two things on the public copy are waiting on Jesse, and he asked to be reminded each session:**

1. **`/your-first-visit` carries two placeholder paragraphs Claude wrote** (backlog `2026-08-10-002`, marked `PROVISIONAL` in the source). They need his real logistics: **parking + which entrance** at 4040 N. Calhoun Rd, and the **practical details** (shoes off? tea? restrooms?). The placeholders deliberately assert nothing unverifiable about the building — they point a visitor at a person to ask — but this page is linked from the home hero's primary button, so it sits on RIM's main path to a first visit.
2. **The whole session-174 copy set is provisional until his read-aloud.** Ratification is his explicit yes, never inferred from silence or a positive reaction. The read-aloud document was produced session 174; regenerate it if he wants it again.

### Session 174 (2026-08-10) — ✅ The Copy and Voice Brief implemented across the public pages — on `main`, deployed, verified

**Shipped + live.** Commit `bf952fc` + a backlog commit. Jesse brought a ratified **Copy and Voice Brief** from a chat session and asked for it implemented on rim-next. No schema/migrations/crons/email templates; `npx tsc --noEmit` and `npx next build` both clean; both new routes prerender static; measured at 375px (zero overflow, all touch targets ≥44px) and at 1024px (nav has 156px slack, no crowding).

**What changed.** Home: hero names the community and the place; "Learn, Practice, and Grow Together" meets the reader's life by naming **particulars, never the epoch**; "Timeless Wisdom" drops the lineage vocabulary (Insight/Vipassana/Pāli Canon moved to **metadata**, where a seeker still finds it) and names A Handful of Leaves; the Community section speaks friendship; the programs chapter replaces the pandemic-era "Tuesday and Saturday"; the Dana section describes the giving before naming it. **Two new pages:** `/what-we-practice` (nav label "Our Practice") and `/your-first-visit` — both pure prose on the ground per the sparse-≠-minimal tombstone. `/join` gained **"What membership means"** ahead of the agreements. `/diversity` replaced at half length. Two donate line edits. One orientation line on `/this-week`. Newsletter copy + errors in the house voice, and `/api/subscribe` no longer surfaces Flodesk's API-consumer messages to visitors.

**Rulings made this session (Jesse's):** nav label is **"Our Practice"** (route `/what-we-practice`, page title "A Handful of Leaves"); ship first-visit with Claude-written temporary text rather than hold it; leave `/community-programs` alone; **don't link `/teachers` yet**; hero primary is "Plan your first visit" with this-week as the secondary link; **dana framing consistent but not over the top** — which is why the brief's third "freely offered and community-supported" was cut from the Dana section (the hero already says it).

**The page rewritten mid-session, and why it matters (commit `090072a`).** Jesse's correction: **RIM is not picking and choosing from all traditions.** The handful is an **ordered structure**, organized **by function** into seven gatherings, and it exists **as a response to** having every tradition available at once — *exposure everywhere, orientation nowhere*. The first version said "gathered from across the traditions" and stopped, which reads as a spiritual supermarket. Authority is the **community introduction** (`A Handful of Leaves: An Introduction`), the document **given to every new participant** — Jesse pasted it in full session 174; if it isn't in the repo yet, ask him for it before touching this page again. The page now runs five sections: the story of the name · why a handful (the traditions did nothing wrong; breadth without roots scatters) · how it is ordered · one practice, many doors (the hall-and-orchestra answer to "many practices competing for one cushion") · for anyone. Title hierarchy mirrors the introduction (eyebrow "What and how we practice" / title "A Handful of Leaves"); nav stays "Our Practice". **Image discipline: one image per web page** — the introduction's pond, sun/frost, house/guests, gardener/rose, and medicine cabinet stay in the introduction. **This page does no shame-disarming by design** (the intro's reader has walked in and is examining their own mind; this reader has not).

**New CSS: `.pp-prose--spine`** — left-aligns a reading column to the container text edge so a long-form page has **one left edge** (was hero 110 / prose 290 / actions 110). Deliberately **opt-in**: `/donate` (statement centred at 348, measured against the live site) and `/diversity` (290) must not move, and were verified unmoved after the change.

**Judgment calls to overrule if he disagrees:** the cut Dana opening (above); `/diversity` re-homed as the quiet secondary link in the home Community section, because dropping the brief's old button would have **orphaned the page** — nothing else on the site links it; the volunteer notice now reads "freely offered" (it said "Membership is free," a direct violation of the price-word ruling, and wasn't in the brief).

**Not done, flagged:** the brief's *"Dana is how a community takes care of what it loves"* has **no target** — the line it replaces lived only on home and went with the rewritten Dana section. Unplaced; his call whether it opens the Donate statement or is dropped. `/donate`'s "fosters" (challenged word) was left alone deliberately — the brief's Do Not Touch list limits Donate to its named line edits.

**Observed, not changed:** the `pp-prose` pages carry **three left edges** (hero 110 / prose 290 / actions 110 at 1280). This is the *shipped, approved* convention — `/diversity` measures identically and `/donate`, the page matched to the live site by measurement, centres its statement at 348 against a hero at 110. The s170 one-left-edge rule is scoped to the two **listing** pages. A real design question for a later pass, not a defect introduced here.

### Session 173 (2026-08-10) — ✅ Five measured box-model overflows fixed — on `main`, deployed, verified

**Shipped + live.** CSS-only (`public/css/custom.css`), no TS/schema/migrations/crons/emails. Commits `08da32f` (public) + `7a8da4a` (authenticated) + two backlog commits. Full narrative: `session-log.md` (session 173).

Jesse reported the code-entry page "extends into the right border." Root cause was the s170/s172 box-sizing trap in two public places the s172 sweep had missed (it was scoped to backend classes): `.container-7-copy` (all three `/login` pages, 48px over, sign-in card 24px off centre, at any width under ~1148px) and `.nav__mobile-link` (every public phone-menu row 423px in a 375px viewport — invisible to a page sweep because the menu is closed). Then Jesse said "address the things that you found," so the 18 deferred authenticated-area candidates got measured by rebuilding each one's real ancestor chain in a 375px iframe on the production origin: **15 were false positives** (flex children are shrunk to fit; only grid items and plain blocks overflow), and 3 were real — `.zoom-launch__panel` (grid item, the page every virtual session's Join lands on) plus two **long-email** bugs that `box-sizing` does *not* fix (`overflow-wrap: anywhere` on `.login-box strong` and `.adm2-email-confirm__text`). Authority: `RIM_Public_Pages.md` → "No global border-box" (now carries the flex-vs-grid rule, the long-token failure mode, and the measurement method).

**Closed this session:** `2026-08-07-011` (Jesse fixed the two 10:30 PM end times — re-measured live), `2026-08-10-001` (the box-sizing audit, with the false-positive analysis recorded). The s172 archive cron's first run is **verified working** in production.

**OPEN — Jesse's, none blocking:**
1. **The authenticated shell walkthrough** (behind login, unverifiable by Claude): the account drawer + rail collapse toggle on phone and desktop, the hub drawer, and the half-screen-width pass (drag a desktop window to ~half screen and walk a Space, the Scheduler, Program Manager, the Member Registry — nothing should clip, wide tables should scroll in their own box). *The earlier "check dialogs on your phone" ask is withdrawn — those were measured instead.*
2. **Vercel env cleanup + Sanity project deletion** (`2026-08-09-001`): drop the `LIVEKIT_*`, `NEXT_PUBLIC_SANITY_*`, `SANITY_API_TOKEN`, and `GMAIL_*` vars; **also fix the `NEXTAUTH_URL` trailing space** at source and redeploy (that one *is* read). Then delete the old Sanity project and the "RIM — Community" Drive folder.

**NEXT concrete step:** the **Webflow pre-cancellation errand** — the redirect map (`2026-08-07-003`, Claude can build this alone) + the asset rescue (`2026-08-09-006`: original Bodhi Leaves video from Webflow's Assets panel + higher-res pine-trees/community-hands sources; Claude encodes and swaps once files land). These two are the last things between Jesse and cancelling Webflow.

**Still queued (backlog):** `2026-08-09-002` (in-tool links drop `?hub=` — needs the four-layer hub-routing treatment), `-003` (Programs tool index has no page title), `-004` (tools-chrome hex sweep), `-005` (css-prune the ~14 dead backend CSS families), `2026-08-07-009` (public **desktop** nav/footer touch targets — the phone rows measure 53–54px, so height was never the issue there), `-010` (consolidate the three visually-hidden utilities), `-002` (volunteer + Kalyana Mitta pages unmeasured), `2026-06-13-003` (course landing onto the design system), `2026-08-08-005` (queued decision: should `effectiveCoordinator` also require ACTIVE?).

## Prior handoff reference

### Session 172 (2026-08-09) — ✅ Dated events retire themselves; member-area interaction floor; home page composed — deployed

Three arcs, 11 commits. **Dated events** (closed `2026-08-07-008`): date-led `.pl-card--date`; `Program.hideWhenPast` hides concluded one-time programs at read time and the new daily `archive-concluded-programs` cron (8th cron) archives them next morning — **first run verified working in s173**. **Member-area quality campaign:** "Main site" in the member-bar, the account rail as a phone drawer, the interaction floor (~65-selector focus-visible, 44px targets, 14/16px text), wide tables scroll, and the border-box sweep of 16 backend classes. **Home page** (closed `2026-08-07-001`): alternating splits, dynamic category doors from the live taxonomy, Dana as the third split, hero video MP4-first. Full narrative: `session-log.md` (s172). Its open items are folded into Active above.

**Jesse's standing calls (still in force):** always push to `main` (supersedes the s148 preview-branch rule); the orientation notice, "Good first visit," the floating nav pill, the chapter band, and the hero paper panel are tombstoned in `RIM_Public_Pages.md`; the membership block speaks dana, not "free."

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
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
