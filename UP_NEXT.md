# Up Next — In-Progress Work

Read first when opening RIM. Updated at closing, 2026-10-01. Full history belongs in `session-log.md`.

## Active — the public pages as one system; copy provisional until the read-aloud (2026-10-01)

**Live** (`25168f1` … `a70a8b4`; the narrative is in `session-log.md`, 2026-09-30 and 2026-10-01): Why We Practice (why-first, with "On this page" and the direction as a pull statement); Taking CARE retitled with its own list; About (seven sections) and Our Roots (six); the menu (New to RIM · Practice · Programs · About · Get Involved · Members · Donate, phone layout at 1120px); Diversity back as a front-door value; the agreements restated as intentions held as a practice; one account of where each kind of gift goes (Donate, Outreach, home, program pages, the registration step, the program editor's templates); the approved mission; the MBSR line and Jesse's bios; the footer's contrast and focus. Design record: `RIM_Public_Pages.md` (Revisions 11, 12, 12a, the menu, the footer and teacher page, the reading aids, About and Our Roots).

**Production state changed this session, each with Jesse's approval by record:** `Program.danaMessage` for `awakening-the-heart`, `good-morning-silent-meditation`, `good-evening-silent-meditation`; `teacher_profiles.bio` for `jesse-foy`; `users.bio` on his teacher account. Everything else read-only. Snapshots are outside the repo (session scratchpads). Production **is reachable from this machine** (`.env.production.local`); `CLAUDE.md` says how to treat it. Never run `npm run build` locally.

**Copy sources:** home = the vault's `CARE/4 Promotion/04-community-homepage-revision-2026-09-28.md` (it wins any difference with a brief), **except where Jesse has ruled the page current**: no landlord line (B1), item and card titles without periods (2026-09-28 night). Everything else and the agreements = `04-community-website-copy-2026-09-25.md`. Briefs arrive as `08-promotion-site-brief-*.md` with addenda; implement verbatim and report as they ask.

**Next concrete step:** Jesse's read-aloud of the copy above, and the rulings below. Then, the home page on a real tablet: the 769–1023 band keeps two edges on his call; it measures ~37 characters per line at 800, and stacking below 1024 (text capped at the reading width) is the ready one-block change.

**For Jesse's ear, or his rulings (open):**
- **Why We Practice:** section 5 as a whole; one paragraph ("We care about our lives…") runs 7 lines at 1280 (the brief asked for about five), and a split after "instead of listening." is the natural one but changes the approved structure; two buttons to the page sit in consecutive home sections.
- **Donate:** the Teaching Fund's salary sentences (a shorter form is in the copy doc); the last sentence on a hoped-for retreat-cost fund; "freely" appears three times.
- **Bios:** the About and bio wording is my composition from his phrases ("over 25 years of studying and practicing", "since 2006", "through the Center for Mindfulness at UMass"); a one-line edit if he wants it otherwise. The member-profile bio now carries the same text.
- **Menu descriptions** (tracker 7d); **Our Roots:** keep the Order of Interbeing quotation, the Mahayana line; **teachers:** a photo, then "Our Teachers" in the menu (`2026-10-01-002`).
- **Parking and which door** (`2026-08-10-002`); **Foundations dates** (`2026-09-25-001`).
- **The vault is behind the code:** its copy doc, the home draft and the agreements section still carry some pre-Revision-12 words (the vault is the copy authority); Jesse or a vault session updates them.

**Before and at launch (October 5):** whole-site metadata and sitemap (`2026-10-01-001`); the Webflow redirect map (`2026-08-07-003`, 17 redirects against 317 pages) and forms audit (`2026-08-10-003`); the Stripe go-live checklist (`2026-09-24-001`); unpublish the public Test Course (`2026-09-02-001`). **Dated facts to sweep on November 1:** "Until Foundations begins in November" and "first offered in November" (home, New to RIM, Taking CARE), and the Saturday Meditation and Dharma Talk line (home, New to RIM).

**Still to verify:**
- **Signed in (needs Jesse):** Members reads "Hi, [name]" and its panel (My Home, Sign out; the agreements moved to the About menu); the phone sheet's signed-in foot (My Home / Sign out); the account and hub phone drawers no longer scroll the page behind (the `<html>` lock fix, `c0b0791`).
- **The phone sheet's wheel re-test** after the lock fix (it passed by state and synthetic events; the browser pane was hidden).
- **Safari:** a keyboard-opened nav panel's link takes a mouse click (untestable in Chromium).

**Queued:** the other public pages onto the revised grid (`2026-09-28-001`); the button pass on untouched pages' text links (`2026-09-25-002`); First Steps (`2026-09-25-003`); the recording (`2026-09-25-004`). **October 5** is the real-domain launch: Webflow redirects (`2026-08-07-003`) and forms audit (`2026-08-10-003`) still open. Two primary buttons still go to `/this-week` by Jesse's choice (teacher profiles' "See this week").

**Method (no dev server):** transpile a copy of the page with the repo's `tsc` (stand-ins for the DB and helpers, a loader alias for `@/`), render with `react-dom/server`, place it in the live shell (the live page, then replace `main`'s HTML and inject the local `custom.css`), and drive headless Chrome over CDP from a scratch Node script; `Emulation.setDeviceMetricsOverride` lays out at 375 directly. The menu's `PublicDesktopNav` and `PublicNavSheet`, and `RegistrationForm`'s dana step (`alreadyRegistered` plus a PENDING donation), render server-side with stubs; `CSS.forcePseudoState` shows focus rings. Production reads and writes use `.env.production.local`: probe, snapshot, drift check, one transaction by unique key, whole-table diff. Delete the scratch scripts after.

## Still open from September 24 (integrity pass)

**Stripe state:** sandbox only. `STRIPE_SECRET_KEY` = sandbox `sk_test_`; webhook destination `rim-site-dana-2026` (both checkout events). Live has no destination; go-live checklist is backlog `2026-09-24-001`. The Dummy Test Program still has the test registration and registration enabled.

**Waiting on Jesse:**
- **Read-aloud** of the new copy: sign-in button/code page, dana step, receipt, approval line, Stripe lines, Zoom notices, readout, overlap banner, thank-you page, and `ZOOM_COORDINATOR_GUIDE.md` (sent as Markdown/HTML for the Zoom Coordinator Google Doc).
- **Accountant** review of the receipt's "For your records" statement (RIM is IRS-classified as a church, 170(b)(1)(A)(i)).
- Switch **"Awakening to the Beauty of This Moment"** to Voluntary dana, $175 suggested (it's `fixed` $175 now).
- **Flodesk design** (`2026-09-24-002`): does he send to segments or the whole list?
- Check Flodesk for his test signup's segment and any welcome email.

**Next concrete step:** with Jesse signed in, check the Visibility readout on a few programs and one `/enter` notice; then take the read-aloud flags.

**Earlier handoff still open:** the September member redesign's signed-in review (My Home, Profile, Community Care, My Teams, team Home/Files, Registry, Scheduler, Program/Course Manager; file preference persistence and shared pins). Files search covers the loaded folder only (`2026-09-22-002`).

## Pending questions / follow-ons

- **Memory confirmation pending:** proposed preference: distinguish previewed, implemented, deployed and verified work, naming remaining checks. No personal memory or backup mirror changed without Jesse’s confirmation. Product/design decisions are already in project docs.
- **Codex:** Jesse is working with Claude only for now (2026-09-27, after the withdrawn Codex review). The `AGENTS.md` bridge is deferred; if Codex returns it needs guardrails as well as orientation (backlog `2026-09-22-001`). Commits authored `jessefoy` may come from another agent: read the message and scope before assuming they are Jesse's hand edits.
- **Email provider decided (2026-09-24):** Jesse is staying with Flodesk (already paid, ~4,500 subscribers, $418/year). Integration design is backlog `2026-09-24-002`.

## Standing reminder — public copy still awaits Jesse

Remind Jesse each session until resolved: parking and which entrance to use are still unwritten on `/new-to-rim` (which replaced `/your-first-visit`; Jesse supplied the other practical details 2026-09-25) (`2026-08-10-002`); the s174/s176 public copy requires his explicit read-aloud approval. Shipping is not ratification. Community Care now shares canonical text across **five** surfaces: join, welcome, registration, public agreements and member care. The live `/diversity` image `color-powder-diversity.webp` still lacks recorded provenance.

Other pending decisions: public Test Course/teacher profile data (`2026-09-02-001`); whether to commit the community introduction/Copy and Voice Brief; source cleanup of `NEXTAUTH_URL`, retired service variables/Sanity project and the retired Community Drive (`2026-08-09-001`). `TEAM_EMAIL` was previously unset. These are recorded findings, not rechecked at this closing.

## Queued work / earlier verification

- Webflow cutover: redirects (`2026-08-07-003`), asset rescue (`2026-08-09-006`), forms/Zapier audit (`2026-08-10-003`). Wiring requires dashboard evidence; do not infer it from markup.
- Tool hub-context links (`2026-08-09-002`), Program Manager index title (`-003`), tool hex sweep (`-004`), dead CSS (`-005`); coordinator ACTIVE policy (`2026-08-08-005`).
- Teacher course listing (`2026-09-02-002`), authored rich-text cleanup (`-003`), retired login CSS (`-004`). Prior public targets (`2026-08-07-009`) and volunteer/KM measurement (`-002`) may already be satisfied; recheck before changing. Consolidate visually-hidden utilities (`-010`); course landing (`2026-06-13-003`).
- Earlier Files checks: drafts → Share, attribution, governed removal, notification templates visible in `/admin/emails`, old documents URL redirects. Notification sends require explicit user authorization.
- Editor toolbar polish, optional Stage 2d blocks, eventual legacy BlockNote walker removal, coordinator notes and duplicate-Aside behavior remain parked. Document export was fixed in s102; that historical native-document system is now retired.

## Recently completed / reference

- Revisions 8 to 12a, the menu, Diversity, the dana account, the MBSR line and bios, the footer (2026-09-30 to 2026-10-01): `session-log.md` 2026-09-30 and 2026-10-01; `RIM_Public_Pages.md` (Revisions 11, 12, 12a, the menu, the footer and teacher page); `RIM_Registration.md` (receipts to RIM); `RIM_ProgramEditor.md` (dana templates); `CLAUDE.md` (production reachable).
- Brief, handout, vision, balance (2026-09-26): `session-log.md` 2026-09-26; `RIM_Public_Pages.md` → "The reading column" and Copy and voice (2026-09-26).
- The center, stated (2026-09-25): `session-log.md` 2026-09-25; `RIM_Public_Pages.md` → "The center, stated"; copy in the vault's `04-community-website-copy-2026-09-25.md`.
- September 24 integrity pass: `session-log.md` 2026-09-24; `RIM_Registration.md` (receipt, thank-you, voluntary dana), `RIM_Zoom.md` (seat pick, door permissions).
- September member redesign: `RIM_Member_Area.md`; closing entry 2026-09-22 in `session-log.md`.
- s176 public consistency / Sanity image rescue: `RIM_Public_Pages.md`; full session narrative already archived.
- s175 member self-cancellation removed: `ab686b1`; retain staff registration management.
- s174 public voice; s171–173 context diet, access and box-model rules: design/role references and session log.
- s165–168 Google Files and universal Home/Updates: `RIM_GoogleWorkspace.md`, `RIM_Hub_Engineering.md`.
- s159 Zoom cutover; s153 HOST retirement; s119 sign-in codes: corresponding engineering references.

## Jesse’s standing calls

Push to `main`; no local dev server. Do not run a local build that invokes the production migration. Preserve the no-member-cancellation decision. Use RIM’s design and voice rules; copy remains provisional until read aloud. `/teachers` is out of the menu until the profiles carry photos (About's "Our teachers" button does link to it, per the Revision 10 brief). Public design tombstones live in `RIM_Public_Pages.md`; do not silently recreate them. Production data: read only when he asks; write only with his approval of specific records, with a snapshot, drift check, one transaction and a whole-table diff (`CLAUDE.md`). Pages push to `main` and go live; the real-domain launch is October 5; until then the site is at rim-next.vercel.app (reachable, not announced).

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
- **Scroll locks go on `<html>`, not `<body>`.** Because `html` carries `overflow-x: clip`, a `body { overflow: hidden }` never propagates to the viewport and the page keeps scrolling behind a modal (measured on the nav sheet, 2026-09-28). The nav sheet and `useNavigationDrawer` both lock `document.documentElement`.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
