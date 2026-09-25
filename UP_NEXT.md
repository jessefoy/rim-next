# Up Next — In-Progress Work

Read first when opening RIM. Updated at closing, 2026-09-24. Full history belongs in `session-log.md`.

## Active — the center, stated (2026-09-25, live; awaiting Jesse's read-aloud)

**Shipped** (`8d3a1bf`, `86e277a`, and the agreements-column commit): the public site reorganized around RIM's stated center. Home re-sequenced (hero paragraph rewritten, headline kept); new `/why-we-practice`, `/foundations`, `/outreach`; the CARE circle on `/care`; vision and mission on `/about`; care agreements under an Our Shared Vision frame with three agreements (all five surfaces); lineage corrected sitewide (Chan silent illumination, not insight/vipassana); accurate dana statement; nav follows the pathway. **Copy source of truth is the vault:** `CARE/4 Promotion/04-community-website-copy-2026-09-25.md` (flags first, then pages in visitor order). Verified on deploy: 10 changed pages at 375px with zero overflow and zero sub-24px targets; 1280 spine at 110.

**Waiting on Jesse:** the read-aloud of that document; the eight one-line word descriptions (the eight vault compressions are placeholders); Foundations format and dates (holding text on `/foundations`); whether "RIM's outreach fund" exists yet (Outreach page); the dana ask "give something, in whatever form is possible"; whether the circle belongs anywhere besides `/care`. Site goes live on the real domain **October 5**: the Webflow cutover items below (redirects, forms) are still open.

## Active — the September 24 integrity pass (live; a few checks and decisions open)

**Shipped and live** (`4187997`…`311d6c0`): Visibility-tab readout (Programs & Events, This Week, Member home); Dummy Test Program no longer excluded by slug; "Sign me in from this device" button in both code emails; code-verify rate limit now actually runs (GET); server-decided Stripe charges, split Registration/Dana lines, safe expiry/retry, lost-hold restore; new **dana receipt** email (legal name + EIN); **thank-you page** `/programs/[slug]/thank-you`; Zoom seat pick buffer-aware + lock-serialized, plain pages at every `/enter` stop, registration gate (no waitlist), true-peak overlap warning on first save, Record reaches existing meetings. References: `RIM_Registration.md`, `RIM_Auth.md`, `RIM_Zoom.md`, `RIM_ProgramEditor.md`.

**Verified:** full sandbox payment ($20, Dummy Test Program): server-set line + Donate button, webhook 200, confirmation and receipt both received by Jesse; thank-you page and prefilled code page at 375px; footer Flodesk subscribe 200; GiveButter widgets render. **Not verified signed-in:** the Visibility readout, the create-time conflict banner, and the `/enter` notices / registration gate.

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
- **Claude/Codex rituals:** Jesse requested consistent project-folder opening/closing behavior. RIM’s canonical instructions are `CLAUDE.md` and `.claude/skills/closing-ritual/SKILL.md`; a Codex `AGENTS.md` bridge is still unbuilt. Backlog `2026-09-22-001`. Use RIM’s workflow here, not Steward’s global ritual skill.
- **Email provider decided (2026-09-24):** Jesse is staying with Flodesk (already paid, ~4,500 subscribers, $418/year). Integration design is backlog `2026-09-24-002`.

## Standing reminder — public copy still awaits Jesse

Remind Jesse each session until resolved: `/your-first-visit` parking/entrance and practical details remain provisional (`2026-08-10-002`); the s174/s176 public copy requires his explicit read-aloud approval. Shipping is not ratification. Community Care now shares canonical text across **five** surfaces: join, welcome, registration, public agreements and member care. The live `/diversity` image `color-powder-diversity.webp` still lacks recorded provenance.

Other pending decisions: public Test Course/teacher profile data (`2026-09-02-001`); whether to commit the community introduction/Copy and Voice Brief; source cleanup of `NEXTAUTH_URL`, retired service variables/Sanity project and the retired Community Drive (`2026-08-09-001`). `TEAM_EMAIL` was previously unset. These are recorded findings, not rechecked at this closing.

## Queued work / earlier verification

- Webflow cutover: redirects (`2026-08-07-003`), asset rescue (`2026-08-09-006`), forms/Zapier audit (`2026-08-10-003`). Wiring requires dashboard evidence; do not infer it from markup.
- Tool hub-context links (`2026-08-09-002`), Program Manager index title (`-003`), tool hex sweep (`-004`), dead CSS (`-005`); coordinator ACTIVE policy (`2026-08-08-005`).
- Teacher course listing (`2026-09-02-002`), authored rich-text cleanup (`-003`), retired login CSS (`-004`). Prior public targets (`2026-08-07-009`) and volunteer/KM measurement (`-002`) may already be satisfied; recheck before changing. Consolidate visually-hidden utilities (`-010`); course landing (`2026-06-13-003`).
- Earlier Files checks: drafts → Share, attribution, governed removal, notification templates visible in `/admin/emails`, old documents URL redirects. Notification sends require explicit user authorization.
- Editor toolbar polish, optional Stage 2d blocks, eventual legacy BlockNote walker removal, coordinator notes and duplicate-Aside behavior remain parked. Document export was fixed in s102; that historical native-document system is now retired.

## Recently completed / reference

- September 24 integrity pass: `session-log.md` 2026-09-24; `RIM_Registration.md` (receipt, thank-you, voluntary dana), `RIM_Zoom.md` (seat pick, door permissions).
- September member redesign: `RIM_Member_Area.md`; closing entry 2026-09-22 in `session-log.md`.
- s176 public consistency / Sanity image rescue: `RIM_Public_Pages.md`; full session narrative already archived.
- s175 member self-cancellation removed: `ab686b1`; retain staff registration management.
- s174 public voice; s171–173 context diet, access and box-model rules: design/role references and session log.
- s165–168 Google Files and universal Home/Updates: `RIM_GoogleWorkspace.md`, `RIM_Hub_Engineering.md`.
- s159 Zoom cutover; s153 HOST retirement; s119 sign-in codes: corresponding engineering references.

## Jesse’s standing calls

Push to `main`; no local dev server. Do not run a local build that invokes the production migration. Preserve the no-member-cancellation decision. Use RIM’s design and voice rules; copy remains provisional until read aloud. `/teachers` stays unlinked unless Jesse changes that decision. Public design tombstones live in `RIM_Public_Pages.md`; do not silently recreate them.

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
