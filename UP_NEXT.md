# Up Next — In-Progress Work

Read first when opening RIM. Updated 2026-10-08 (mid-session). Full history belongs in `session-log.md`.

## Active — the home page in Jesse's words (2026-10-08)

Jesse read the live home page aloud and reworded it; the polished reading is live on `main` with his rulings on twelve flags (the record: `RIM_Public_Pages.md`, "The home page in Jesse's words"; the words: the vault's `04-community-homepage-revision-2026-09-28.md`, Part One; his verbatim lines: the master reference's Appendix A, 2026-10-08). The programs section was rebuilt twice: first with each way's live program names (rows on the two text edges), then, after Jesse's "blends into the rest of the site... a little busy" and a measured critique (19/32), as **three static cards in thirds naming what each way contains** (types, not a schedule; buttons Programs & events · This week's schedule; home static again). Practice for real life was re-tested against his four frames and widened (life and work; the habits we reach for; belonging); Why We Practice §5 gained the well-being paragraph; New to RIM says the stairs and no longer names a drop-in. Rulings that reached other surfaces: `RIM_WHAT_BINDS` is "unhealthy patterns of heart, mind, and action" (five agreement surfaces, About, the vision); courses are Immersion (catalog intros, the Ongoing subheading "Classes", the Foundations page, the editor's Category help); the Foundations program is named from one constant (home card, catalog standing card, `/foundations`).

**Next concrete step:** Jesse reads the published home page, Why We Practice §5 and New to RIM; all provisional until then. Parking and which door are still unwritten (`2026-08-10-002`). **If he renames drop-ins**, the Foundations page still names Meditation and Dharma Talk (home and New to RIM no longer do). The Impeccable skill update he approved failed to download twice ("invalid zip data"); retry with `npx impeccable update`.

## Still open from October 2 — categories, Open entry, and history and roots are live; the pages await Jesse's read-aloud

**Live on `main`** (`a481eb4` the categories merge, `3b2ed9e` the history-and-roots merge; the narrative is in `session-log.md`, 2026-10-02 (later); the design record is `RIM_Public_Pages.md`, "The three ways, Category and Format, and Open entry" and "Our way of practice, and our roots"):
- **Category and Format on every program**, with Silent meditation and Hosted by volunteers: the Program Manager's two required dropdowns and the admin list filters, and Programs & Events, the shared block, breadcrumbs, This Week and the Kalyana Mitta page reading them. **The migration was applied to production** (20 programs, Jesse's approved mapping with his changes; snapshot, drift guard, one transaction, whole-table diff: only the five new columns changed; `updatedAt` untouched). `lib/programChapters.ts` is gone.
- **Open entry** (`Program.openEntry`): access is its own per-program setting, beside registration in the Program Manager. Category and Format are labels and never decide access. Backfilled so all 20 programs keep exactly the access they had (proved before and after, and across all 49 Category x Format combinations).
- **History and roots** (drafts file §8) and the Handful as a members' reference (§9): About "How we began" (nonprofit dharma center in 2016), Our Roots rewritten whole, "our way of practice," silent illumination at the heart, "Buddhist teachings." The member introduction is re-derived ("which is how we practice").
- **`join-welcome`** no longer promises a series of welcome notes (production row, with consent; seed matched). Backlog `2026-10-02-003` is closed.

**Production state changed on 2026-10-02 (each write authorized by name):** `dummy-test-program` archived; the Meditation and Dharma Talk text; the program-categories migration (five columns on all 20 programs); the `join-welcome` body (two edits: "courses", then the welcome-notes paragraph removed). Snapshots are in the temp directory. Production **is reachable from this machine** (`.env.production.local`); `CLAUDE.md` says how to treat it. Never run `npm run build` locally, and do not run the `vercel` CLI (it logs in by itself).

**Next concrete step:** Jesse's read-aloud on the published pages (corrections come back through `08-promotion-site-drafts-integration-2026-10-01.md`), and, **signed in**, three looks I could not do: (1) the real Program Manager (Categories tab, the Registration tab's Open entry checkbox and readout) and **saving a program from it**: the editor was verified hydrated in headless Chrome and the API by review, but a real save (POST/PUT with the new fields) has not been run against production; (2) the two Handful member pages and the My Home card; (3) Today on My Home. Then launch (Monday, October 5).

**For Jesse's ear, or his rulings (open):**
- **Database-held "the Buddha's teachings"** (reported, not written, per the brief): Meditation and Dharma Talk's description ("The talk draws on the Buddha's teachings") and Essential Dharma Study's ("The Buddha's core teachings"). The first glosses the Dharma and would become "Buddhist teachings"; the second may mean the Buddha's own. Jesse's call per record.
- **Our Hearts Were Made for This is now a Community Group** (his ruling): it moved to Community Groups on Programs & Events, now appears on the Kalyana Mitta groups page, and no longer carries the shared Taking CARE block. Open entry stays on, so its access is unchanged. Is that the page he wants it on?
- **Essential Dharma Study** has registration and open entry together, so This Week marks it Drop-in while its program page offers only "Register →" (the "Simply arrive" line shows only where registration is off, as before). A small wording question for him, if it reads oddly.
- **Words owed:** Essential Dharma Study named on the Handful page, if that is where it is taught; whether Foundations can promise "no one will be turned away"; Meditation and Dharma Talk's one sentence on the shape of a morning; New to RIM's "What a gathering is like" with parking and the stairs question; whether the Handful introduction's "companion guide to the sitting itself" exists.
- **For the vault, not the repo:** the vault's MBSR brief still carries the old long About wording (the live About carries his short form).
- **Smaller:** the lesson reader's own "Learning & Practice" label (`2026-10-02-004`); a way between the two Handful pages and a print button (`2026-10-02-005`).
- **Cleanup that is ready, not done:** the old `ProgramCategory` and its `kind` (`lib/programKind.ts`, the `openEntry == null` and legacy-category fallbacks in `lib/programOffering.ts`) can be removed now that every row is filled (backlog `2026-10-02-006`).

**Before and at launch (October 5):** the Webflow redirect map (`2026-08-07-003`, 17 redirects against 317 pages) and forms audit (`2026-08-10-003`); the Stripe go-live checklist (`2026-09-24-001`); unpublish the public Test Course (`2026-09-02-001`; it is also why the sitemap omits `/courses`); the domain move (then confirm `robots.txt`, the sitemap and each page's canonical on rootedinmindfulness.org; the `rim-next.vercel.app` host keeps its `noindex` header); share cards and the remaining descriptions (`2026-10-01-001`). **November 1 sweep:** "begins in November" / "First offered in November" on Home, New to RIM, Foundations (page and metadata description) and the Programs & Events Foundations introduction; the Saturday Meditation and Dharma Talk line (Home, New to RIM, Foundations).

**Still to verify (needs Jesse signed in):** the two Handful pages and the My Home card in a real session (here they were checked signed-out, where they redirect to sign-in, and by a stand-in render with the account shell); Members reads "Hi, [name]"; the phone sheet's signed-in foot; the account and hub phone drawers no longer scroll the page behind. **Safari:** a keyboard-opened nav panel's link takes a mouse click (untestable in Chromium).

**Queued:** the other weekly program texts (launch week: Awakening the Heart, The Art of Meditation, Essential Dharma Study, Our Hearts Were Made for This, the two silent sits; the Art of Meditation's epigraph is a loose Dhammapada paraphrase); Diverse Together, Volunteer and Community Groups copy; the other public pages onto the revised grid (`2026-09-28-001`); the button pass on untouched pages' text links (`2026-09-25-002`); First Steps (`2026-09-25-003`); the recording (`2026-09-25-004`). Two primary buttons still go to `/this-week` by Jesse's choice (teacher profiles' "See this week").

**Method (no dev server):** the documented render method now has a harness: transpile the pages with the repo's `tsc` into a scratch folder, stub `@/lib/db`, `@/auth`, `next/navigation` and `server-only`, render with `react-dom/server` using a read-only fixture exported from production, place the markup in the live shell (a built page's head and footer, local `custom.css`), and drive headless Chrome over CDP for screenshots at 1280 and 375 (and `Emulation.setEmulatedMedia` for print). Production reads and writes use `.env.production.local`: probe, snapshot, drift check, one transaction by unique key, whole-table diff. Delete the scratch scripts after.

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

- Category and Format, Open entry, history and roots (2026-10-02, later): `session-log.md` 2026-10-02 (later); `RIM_Public_Pages.md` ("The three ways, Category and Format, and Open entry"; "Our way of practice, and our roots"); `RIM_Offering_Model.md`; `RIM_ProgramEditor.md`.
- The integration pass and its follow-up (2026-10-01 to 10-02): `session-log.md` 2026-10-02 (includes the F11 categorization survey); `RIM_Public_Pages.md` ("The integration pass"); `RIM_ProgramEditor.md` (optional pull quote); `RIM_Member_Area.md` (the Handful pages, My Home card).
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
