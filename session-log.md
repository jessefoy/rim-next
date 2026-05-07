---

## 2026-05-07 (session 102) — Theme A closure, editor toolbar polish

### What was done

**1. Theme A: Webflow-bridge removal complete.** Items #1–3 (rim-connect.js, public-bridge API routes, CDN cache headers) were confirmed already removed as part of the pivot reversal. Items #5 and #6 (Webflow Site Settings head code and staged pages /rim-next/Programs + /untitled/program-detail) removed manually by Jesse in Webflow Designer. CLEANUP.md updated; Theme A closed.

**2. Editor toolbar polish.** Three interrelated cleanup passes on `components/rim-tiptap/RimTiptapEditor.tsx` and CSS:

- **Duplicates removed from bubble menus.** The message and document bubble menus had structural elements (bullet list, numbered list, blockquote — and in document: checklist) that were already in the top toolbar. Removed from both bubbles. Bubbles are now inline-marks-only: B · I · U · S · Code · Highlight | Link. DocumentBubble keeps H2/H3/H4 (applying a heading level to selected text is a selection-driven action that belongs in the bubble; using the heading dropdown to start a new heading is a toolbar-driven action).
- **Duplicate icons fixed.** Pull quote and Practice suggestion both used the `Sparkles` icon — they were visually identical in the Dharma dropdown. Pull quote → `Quote` icon (already imported). Practice suggestion → `Footprints`. Dharma dropdown trigger → `BookOpen`. `Sparkles` import removed.
- **Dead TDropdown props cleaned up.** The TDropdown component interface declared 6 props (`label`, `title`, `wide`, `isOpen`, `onToggle`, `buttonContent`) that were never read inside the component and were passed with dummy/empty values at call sites. All removed from the interface and from all three call sites.
- **Mobile bubble touch targets.** Added `@media (max-width: 768px)` rule: `.rt-bubble__btn { width: 36px; height: 36px; }`. Top toolbar already had 44px mobile targets. Bubble uses 36px (floating context menu; 44px would overflow the viewport width with a full button set).

### What this connects to

- **All editor surfaces.** The bubble menu cleanup affects every `RimTiptapEditor` placement — hub documents, manual sections, program descriptions, lesson bodies, conversations, course descriptions, volunteer notes, admin notes, household notes, sub-request messages. The rule is now consistent: structure lives in the top toolbar, character formatting lives in the bubble.
- **Dharma dropdown.** Pull quote, Verse quote, Practice suggestion, Reflection — four distinct icons now. The icons matter for muscle memory and discoverability in a dropdown where text labels are present but icons are the first visual signal.

**3. Hub document export bug fixed (CLEANUP.md item #54).** The export route (`app/api/hub/[slug]/documents/[id]/export/route.ts`) assumed `doc.body` was always a BlockNote JSON array and called `.map()` on it. After the Tiptap migration, `doc.body` is an HTML string — this throws at runtime, silently producing a broken export. The route now detects content type and branches: HTML string → exports as `.html` (full fidelity, no new dependencies); BlockNote JSON array → existing Markdown converter, exports as `.md`; null → `(No content)` fallback. Added `escapeHtml()` for the document title in the HTML wrapper. CLEANUP.md item #54 removed.

This was reclassified mid-session from "future cleanup" to "current data loss bug" — anyone trying to export a document saved post-migration was getting nothing. The right call.

**4. CLEANUP.md discipline recovered in real time.** When closing item #54, the first edit used strikethrough on the resolved row instead of removing it. The CLEANUP.md preamble is explicit: "Don't leave struck-through residue in the residue file." The strikethrough was caught, the preamble was re-read, and the row was removed cleanly. Worth naming: the rule held in practice, not just on paper. That's the kind of small recovery that's easy to skip when tired and that matters a lot for the file staying useful over long sessions.

### What this connects to

- **All hub document placements** — the export fix affects every native hub document across all hubs. Anyone who tried to export a post-migration document was silently failing.
- **CLEANUP.md Theme G** — item #54 was in the "future-removable" table. It's now gone. The table is shorter and more accurate.
- **The closing ritual itself** — the discipline recovery in item 4 is why the closing ritual and CLEANUP.md preamble exist: they are the mechanism by which small drift is caught and corrected before it compounds. The ritual is only as good as the habit of re-reading the rules before editing the files.

### Design decisions that hold

- **Top toolbar = structure. Bubble = inline marks.** This is the modern editor pattern (Medium, Notion, Craft, Bear) and now enforced. The bubble that appears on text selection is for character formatting, not for starting new structural elements. Lists and blockquotes are started on empty lines via the toolbar.
- **H2/H3/H4 in the document bubble.** The one exception to the above: heading-level conversion is also a selection action (select a paragraph, change its heading level). Keeping H2/H3/H4 in the DocumentBubble is correct — it's a different gesture than "start a new heading."
- **HTML documents export as HTML.** The export format follows the storage format. Markdown was the right export for BlockNote JSON; HTML is the right export for Tiptap HTML. No lossy conversion, no new dependencies.
- **Read the preamble before editing a working file.** CLEANUP.md, UP_NEXT.md, and FEATURES.md each have preambles that describe how the file should be maintained. They are the rules for that file. Re-reading before editing is the discipline; catching drift in real time is the practice.

---

## 2026-05-06 (session 101) — Theme F: documentation sync pass

### What was done

Full documentation sync across five root docs, correcting all drift from sessions 96–100 (Tasks removal, Support Inbox removal, Tiptap migration, UserHubAccess removal, MemberImport removal, Phase 2 scaffolding removal, Site Banner removal, Course drip removal).

- **RIM_Hub_Model.md** — hub count corrected (14 operational + 2 governance), Tasks section removed entirely, Support Hub tools cleared, core sections updated from 5 to 4, RimProseEditor → RimTiptapEditor, BlockNote JSON → HTML throughout, UserHubAccess removed from access matrix and schema rows, schema rows for UserHubAccess/TaskList/Task/Subtask removed.
- **RIM_Feature_Interconnections.md** — Tasks removed from Hubs section, Support Inbox section deleted entirely, Editor System section rewritten (Tiptap-primary, BlockNote references removed), Email System consolidated (one pipeline, Gmail removed), Learning System BlockNote → Tiptap, CSS Architecture Inter → Open Sans (fix from session 84), Webflow migration reference replaced with legacy shim note.
- **RIM_System_Architecture.md** — s73-vs-s76 Registrar Hub inconsistency resolved ("What's Next" paragraph rewritten to accurately describe both sessions), hub count updated, /tools/inbox removed from tools list, hub-access removed from member profile section registry, Tasks removed from Hub Model section list.
- **FEATURES.md** — Phase 2 scaffolding models removed from §7; Memberstack import removed from §11; Support Inbox §29 updated (PARKED → REMOVED, session 100); Site-Wide Banner §36 marked removed; AlertStrip §35 Alert-model note corrected; Tools table updated (Support Inbox row removed).
- **RIM_Stack_Reference.md** — Support Inbox/drip/banner marked removed; Gmail API integration marked removed; SUPPORT role marked removed; BASE_URL note updated (removed references to deleted files).
- **CLEANUP.md** — Theme F section converted from decision table to resolution notes for all 7 items.

---

## 2026-05-06 (session 100) — Theme D + Theme E: direct code residue and decision-needed items removed

### What was done

Major removal pass across code, schema, and config — resolving all Theme D and Theme E items from CLEANUP.md. This was the biggest code-deletion session since the Tiptap migration.

**Theme D (direct residue):**
- `missing-reports` cron removed from `vercel.json` (route never existed)
- Four broken redirects (`/volunteer*`, `/account/registrar*`) updated to `/tools/programs` and `/tools/programs/:slug`
- `/api/programs/` audit: all three routes kept (iCal, registrations CSV, manual reminder trigger — all active)
- Host Schedule residue: already clean
- `/admin/manual/editor` removed; per-section edit via `/admin/manual/[slug]/edit` is the current approach

**Theme E (decision-needed):**
- **Support Inbox** — removed entirely: routes (`/tools/inbox`, `/admin/inbox`, `/api/inbox/*`), lib files (`lib/supportNotify.ts`, `lib/supportService.ts`), schema models (`SupportThread`, `SupportMessage`, `SupportNote`, `SupportTemplate`), Support Hub app links, and the SUPPORT role. Gmail OAuth env vars (`GMAIL_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI`) remain in Vercel and require manual removal.
- **Course drip system** — removed: schema columns (`Course.dripEnabled`, `dripType`, etc.), `lib/drip.ts`, `drip-release` cron in `vercel.json`, and all drip UI in `CourseEditor.tsx` and `LessonEditor.tsx`. No courses were using it.
- **Site-Wide Banner** — removed: `/admin/banner/`, `SiteBannerStrip` component, schema models (`SiteBanner`), and API routes. Never went operational.
- **UserToolAccess** — kept. Intended for future use; managed via Neon console.
- **UserHubAccess** — removed. `HubMember` is the authoritative model; `UserHubAccess` was unenforced and unused.
- **sectionGrants String[]** — kept. Deliberate future hook; cheap to retain.
- **/admin/editor-lab** — removed.
- **Memberstack CSV import** — removed: `MemberImport.tsx`, import route, `legacyMemberstackId` field from schema.
- **Phase 2 scaffolding** — removed: `MembershipType`, `UserMembership`, `AttendanceRecord` models and their enums all dropped.
- **Donation table** — kept as write-only ledger (receives Stripe writes from registration dana flow).

**Mid-session hot-fix:** Vercel build failure discovered — `CourseEditor.tsx` had a broken anchor tag (`<` with missing `a` element name), introduced during Theme E cleanup. Fixed and pushed as a separate commit before continuing.

### What this connects to

- **Schema** — five models and several enum types dropped; schema is significantly cleaner.
- **API routes** — inbox routes, banner routes, import route all gone.
- **Vercel config** — drip-release cron removed.
- **Auth** — SUPPORT role removed from the role enum and from all role checks.

---

## 2026-05-06 (session 99) — Manual reorganization, Hub Documents, drift catch-up, reference docs synced

### What prompted this session

Opening prompt; Jesse asked for help thinking through documentation for the host coordinator and host team — initially around how to handle ChatGPT's 33-document Zoom support pack. The work expanded into an overhaul of the staff manual and hub documentation, then into a major drift audit and catch-up of the canonical reference docs.

### What was built

**1. Six new Hub Documents seeded into host-team.** Across four new categories (Practice of Hosting · Running a Session · When Things Go Wrong · For Coordinators): Host Role, Stewardship Practices, Quick Start, Sub Coverage, Disruption Response, Coordinator Playbook. Storage: plain HTML strings (post-Tiptap canonical). Voice: 8th-grade plain language, generic role names ("the host coordinator"), no model-name jargon.

**2. Manual chapters rewritten or added.** Wholesale rewrites: `host-hub`, `host-hub-team-management`, `host-schedule`. New chapters: `host-rotations` (the Rotations tab walked from `RotationsClient.tsx`), `host-session-room` (what hosts see in the LiveKit room and what controls actually exist), `conversations` (system-wide; threads/replies/reactions/categories). Option-B full rewrites built from careful UI walkthroughs: `programs` (~2,000 words against the seven actual Program Editor tabs) and `registration` (~2,200 words against the VolunteerTable expanded-row layout). Option-C surgical patches on `support-inbox` and `course-hub` for path/wording drift.

**3. Manual surfacing inside hubs.** New route `/account/hub/[slug]/manual` lists chapters where `hubSlug = current hub slug`. New "Manual" item in `HubWorkspaceSidebar` between Documents and Members. `?` icon on host hub home and the shared HubHomeClient (courses/support/registrar) — opens the hub's orientation chapter in a new tab with `?from=<hub-slug>`. Chapter pages now have a hub-aware back-link (priority: `?from` param → chapter's own `hubSlug` → system-wide `/admin/manual`). Manual index reorganized into audience groups (`lib/manualGroups.ts`): Welcome · For all volunteers · For each team · For members · About this manual.

**4. Major drift caught and corrected mid-session.** Several manual chapters and Hub Documents described features that were removed or replaced:
- Tasks tab in host hub described as live — Tasks were removed entirely in session 96 (commit ea9d868).
- Support Inbox described as a daily-use tool — parked since session 88, no Gmail sync cron, not staffed.
- Google Meet described as the video platform — replaced by LiveKit in session 86.
- "Remove a participant" and "Disable a participant's video" listed as host controls — neither exists in the actual session room (no API endpoint, no UI button). The Disruption Response gradient was rebuilt with Mute All replacing the false Remove step.

Section 19 (Google Meet) marked REPLACED. Section 29 (Support Inbox) marked PARKED. Tasks references scrubbed.

**5. Reference docs catch-up sync.** `FEATURES.md` got 11 catch-up session log entries for sessions 89–99 (each summarising what shipped or was removed). `RIM_System_Architecture.md` updated: Tasks removed from hub feature list, Manual added, "three-screen task flow" reference scrubbed. `RIM_Stack_Reference.md` intro rewritten to explicitly distinguish currently-active features from parked/removed ones (Google Meet, Support Inbox, Tasks, Alerts, Sanity Studio access, Virtual Host Hub Attendance).

### What this connects to

- **Closing ritual discipline.** The biggest lesson: the mechanism for keeping docs in sync (CLAUDE.md closing ritual) already exists; it just hasn't been done thoroughly across recent sessions. The fix is the practice, not new tooling. Going forward, the ritual needs to land at every meaningful change.
- **Hub-vs-tool model now documented uniformly.** Every hub has Home · Conversations · Documents · Manual · Members + a hub-specific tool. Course Hub's tool is the Course Manager (`/tools/learning`). Registrar Hub's tool is the Program Manager (`/tools/programs`). Host Hub's tool is the Host Schedule (`/tools/schedule`). Support Hub's tool is the (parked) Support Inbox (`/tools/inbox`). This was implicit; now it is explicit in `RIM_System_Architecture.md` and `RIM_Stack_Reference.md`.
- **Manual layered over Hub Documents.** Manual = canonical system reference, edited centrally, hub-scoped projection. Hub Documents = team-authored operational material, edited by coordinator/team in the hub. Both visible inside each hub now (sidebar Manual item; Documents tab as before). Both surfaced via `?` icons.

### Design decisions that hold

- **The hub shape is uniform.** Every hub has the same general elements; only the tool varies. Don't conflate "the Course Hub" with "the Course Manager" — they're hub and tool, not competing things.
- **Names are scrubbed from the manual; named freely in Hub Documents.** Manual chapters say "the host coordinator" — portable across role changes. Hub Documents (more conversational, team-authored) name people directly when it adds warmth.
- **"Remove what's wrong" before "add what's missing."** The option-C pass closed the most dangerous drift (false claims about features that don't exist) without rewriting whole chapters. Full rewrites came after, only where structural drift made surgical patching impossible.
- **Operational state ≠ code state.** Documentation should reflect what's in operational use, not what code happens to exist. The Support Inbox code is preserved but parked; the manual now says so explicitly.

### Open

- **Broken redirects in `vercel.json`.** Four redirects (`/volunteer/programs/:slug`, `/volunteer`, `/account/registrar/:slug`, `/account/registrar`) point to `/account/hub/registrar/programs` which no longer exists — they 404. Should redirect to `/tools/programs` or be removed.
- **`missing-reports` cron** in `vercel.json` — leftover from the deleted Virtual Host Hub Attendance system (session 89). Should be cleaned up if no longer used.
- **Option-B rewrites for remaining older chapters.** `course-hub` and `support-inbox` are now short and accurate but could be expanded with field-by-field detail in future focused sessions. Not urgent.
- **Open Access** — confirmed by Jesse as the guest-link feature for virtual programs; available but unverified whether it's actively used in any program.
- **Lessons system** — confirmed by Jesse as essential and still in development; not currently being actively iterated on.
- **Attendance tracking** — confirmed by Jesse as being removed entirely; planned to rebuild as a future system.

### Key files

- `prisma/seed-host-hub-team-docs.mjs` — six Hub Documents
- `prisma/update-manual-{host-hub,host-hub-team-management,host-schedule,host-rotations,host-session-room,conversations,support-inbox,course-hub,registration,programs,programs-rewrite,registration-rewrite}.mjs` — chapter writers
- `lib/manualGroups.ts` — audience-grouped manual index (new)
- `app/account/hub/[slug]/manual/page.tsx` — hub-scoped manual route (new)
- `app/admin/manual/[slug]/page.tsx` — hub-aware back-link
- `components/HubWorkspaceSidebar.tsx` — Manual sidebar item
- `components/HostHubHomeClient.tsx`, `HubHomeClient.tsx` — `?` icon
- `components/HubScheduleClient.tsx` — `?` link passes `?from=host-team`
- `components/ManualHelpIcon.tsx` — optional `from` prop
- `FEATURES.md`, `RIM_System_Architecture.md`, `RIM_Stack_Reference.md` — reference docs sync pass
- `prisma/migrate.mjs` — wired all the update-manual flags

---

## 2026-04-29 (session 98) — Host Schedule visual tidy-up + Standing Host Assignments

### What prompted this session

Volunteers reported that the Host Schedule lacked recurring host rotation — everything required manual claiming or one-off coordinator assignment each month. Jesse also noticed a visual inconsistency: Thursday rows on April 30 were missing their left-border color accent, and the overall row design had too many competing amber signals on "needs a host" rows.

### What was built

**1. Host Schedule visual tidy-up.** Grid reduced from 4 columns (`130px 1fr 200px auto`) to 3 (`130px 1fr auto`) by merging the status text and action button into a single `hs-row__right` flex container. This matches how the data is actually read — status and action always belong together semantically. Key design fixes:
- `.hs-row--covered { border-left-color: #ddd }` — every row now has a visible left anchor, not just the colored-state rows. Thursday's missing border was a `transparent` border on covered rows that looked incomplete when flanked by amber/blue neighbors.
- "Needs a host" amber reduced to one signal: amber left border + action button carry the urgency. Status text downgraded to `var(--rim-mid)` weight 500 — the "triple amber" (border + text + button all amber) was too loud.
- `.hs-row__quiet` changed from underlined text link to outlined pill button — consistent with the primary action button shape.
- Filter group margin fix: `margin-right: -1px` on `.hs-filter--member` to close the 1px seam between adjacent pills.

**2. Schedule | Rotations tab strip.** `HubScheduleClient` gained a `view: "schedule" | "rotations"` state with a `.hs-viewtabs` / `.hs-viewtab` / `.hs-viewtab--active` pill strip — visible to HOST_MANAGER and ADMIN only. The schedule content wraps in `{view === "schedule"}` and the rotations view renders `<RotationsClient />` dynamically.

**3. Standing Host Assignments feature.** Full coordinator rotation system — one record per `programSlug + occurrence` slot, applied idempotently to open sessions each day.

**Schema:** New `StandingAssignment` model and `StandingOccurrence` enum (FIRST–FIFTH, ALL). `@@unique([programSlug, occurrence])` enforces one host per slot. Optional `endsOn` for time-limited rotations (sabbatical cover, seasonal changes). `startsOn` gates early — doesn't apply before a given date.

**Core logic (`lib/applyStandingAssignments.ts`):** Walks every day in the target month. For each day × each standing assignment: checks the program runs that day (`isOccurrenceOnDate`), checks the occurrence number matches the pattern (`getOccurrenceInMonth`), skips already-assigned sessions (loaded upfront + tracked in `existingKeys` within the run to prevent double-creates), batch-creates `HostAssignment` records. Returns `{ created, byUser: Map }` so callers can send notification emails.

**New helper (`lib/scheduleUtils.ts`):** `getOccurrenceInMonth(dateStr, program)` — walks days 1 to the target date, counts `isOccurrenceOnDate` hits, returns 1-based occurrence number. Enables "1st Tuesday" and "3rd Saturday" pattern matching.

**API routes:**
- `GET /api/host/standing-assignments` — list assignments, optional `?programSlug=` filter
- `POST /api/host/standing-assignments` — save full rotation for a program (upserts filled slots, deletes emptied ones); coordinator/manager only
- `POST /api/host/standing-assignments/apply` — applies to open sessions immediately, sends emails via `after()`; coordinator/manager only
- `GET /api/cron/apply-standing-assignments` — daily cron (8 AM UTC); fills current month, pre-fills next month on the 1st; secured by `CRON_SECRET`

**Email:** `sendStandingAssignmentScheduledEmail` in `lib/email.ts` — one email per host summarising all newly-created sessions. Sent via `after()` to avoid Vercel teardown killing in-flight sends.

**UI (`RotationsClient.tsx`):** Fetches existing assignments on mount. Per-program accordion: FIRST through FIFTH occurrence slots each with a team-member dropdown. FIFTH slot is visually de-emphasised (`opacity: 0.65`) since most programs don't have 5 occurrences in a month. Optional `endsOn` date input appears when a slot is filled (hide it when empty to avoid noise). Save button: calls POST to save rotation, then POST to apply immediately, shows "✓ Saved · N sessions filled this month" confirmation inline.

**Cron registered in `vercel.json`:** Replaced the placeholder `apply-standing-assignments` entry (which pointed at a non-existent route) with the correct `0 8 * * *` schedule and route.

**Build fix:** Turbopack does not allow importing across Next.js route handler files. The cron initially tried to import `applyStandingAssignments` from the apply-route — which fails at module resolution. Extracted to `lib/applyStandingAssignments.ts` (safe to import from anywhere).

### What this connects to

- **`HostAssignment` table** — standing assignments auto-populate this table exactly as if a coordinator had assigned manually. Sessions already in the table are skipped (idempotent).
- **Host Schedule (`/tools/schedule`)** — the new Rotations tab lives inside `HubScheduleClient`. Schedule rows created by standing assignments look and behave identically to manual assignments — no visual distinction needed.
- **Sub requests** — if a host with a standing assignment needs coverage, the sub-request flow (already built) handles it the same way.
- **Hub Membership as Authority (§42)** — the apply route reuses `getEffectiveHostingCapability()` for the access check, consistent with all other host-area routes.
- **Cron infrastructure** — joins the daily cron pattern established by the drip-release cron; both live in `vercel.json` at `0 8 * * *`.
- **Email system (`lib/email.ts`)** — new function `sendStandingAssignmentScheduledEmail` joins the four existing host-area email functions.

### Design decisions that hold

- **Coordinator-only write access.** Team members can see their rotation (it shows up on their schedule), but only coordinators and managers can set rotation patterns. This matches the broader Host Hub authority model.
- **One record per slot.** `@@unique([programSlug, occurrence])` means you can't have two people in the same slot — one host per session. This mirrors the `HostAssignment` model and keeps the mental model clean.
- **Idempotent apply.** The daily cron can re-run safely if a previous run partially failed. Sessions with existing assignments are never touched — manual assignments are never overwritten.
- **Fifth occurrence de-emphasised, not hidden.** Some months have a 5th occurrence. Rather than conditionally showing the slot, it's always shown at reduced opacity. Coordinators who need it can still fill it; those who don't can ignore it without wondering if there's a slot they're missing.
- **`after()` for emails.** Consistent with the sub-request and sub-claim routes established in session 96. `void (async () => {})()` is silently killed by Vercel's serverless teardown.

### Key files

- `lib/applyStandingAssignments.ts` — core idempotent generation logic (new)
- `components/RotationsClient.tsx` — coordinator rotation UI (new)
- `app/api/host/standing-assignments/route.ts` — list + save (new)
- `app/api/host/standing-assignments/apply/route.ts` — apply to sessions (new)
- `app/api/cron/apply-standing-assignments/route.ts` — daily cron (new)
- `lib/scheduleUtils.ts` — `getOccurrenceInMonth()` added
- `lib/email.ts` — `sendStandingAssignmentScheduledEmail()` added
- `components/HubScheduleClient.tsx` — Rotations tab strip + RotationsClient mount
- `prisma/schema.prisma` — `StandingAssignment` model + `StandingOccurrence` enum
- `public/css/custom.css` — row grid fix, hs-viewtabs, hs-rot-* styles
- `vercel.json` — cron corrected to `apply-standing-assignments`

---

## 2026-04-28 (session 97) — Tiptap migration phases 2 + 3 + 4 (complete), editor UX rethink, BlockNote deletion

### What prompted this session

Phase 1 closed at session 96 with `RimTiptapEditor` built and validated in the Editor Lab. Production was untouched; every editor surface still ran on `RimBlockEditor` (BlockNote, document) or `RimProseEditor` (BlockNote, message). Jesse's opening prompt: do Phase 2 — build the renderer plumbing and migrate `Hub.welcomeBody` / `Hub.homeContent` / conversation threads + replies. The session expanded mid-flight to Phase 3 (document-variant surfaces) and Phase 4 (every remaining `RimProseEditor` usage), with a major UX pivot in the middle (sticky toolbar abandoned for selection bubble menu) and cleanup deletion of the legacy editors.

### What was built

**1. Phase 2 — renderer plumbing + Hub message surfaces.** New `lib/renderRichContentTiptap.ts` does HTML pass-through with `sanitize-html` — two allowlists (`message`, `document`) matching exactly what each variant produces. `isHtmlString()` detection added to `lib/renderRichContent.ts`. HTML branches added to all three async functions in `lib/renderRichContentServer.ts` (`renderFormattedTextAsync`, `renderContentBodyAsync`, `extractTextAsync`). Format detection is value-based, not surface-based — `typeof === "string"` (HTML) vs `Array.isArray` (BlockNote JSON) vs `{type:"rawHtml"}` vs `{type:"doc"}` (legacy Tiptap JSON) are mutually exclusive shapes. Surfaces migrated: `HostHubHomeClient` inline edit, `HubAdminForm` welcome + home content, `HubConvClient` new-thread compose, `HubConvThreadClient` thread body edit + reply edit + reply composer. Two row-conversion migrations in `prisma/migrate.mjs` (`convert_hub_content_to_html`, `convert_conversation_body_to_html`) walked existing rows and converted BlockNote JSON to HTML on deploy. Idempotent — `isBlockNoteArray()` check skips already-converted rows. New dep: `sanitize-html` + `@types/sanitize-html`.

**2. Phase 3 — document-variant surfaces with lazy migration.** Four surfaces swapped from `RimBlockEditor` to `RimTiptapEditor variant="document"`: `HubDocumentEditor`, `ManualSectionEditor`, `LessonEditor` body, `ProgramEditor` description. Decision point: skip the upfront row migration this time — document content has too many block types (tables, images, dharma blocks) to inline a faithful walker into `migrate.mjs`. Instead, **lazy migration at editor load**: `isHtmlString(value) ? value : (renderBlockNoteHtml(value) || "")`. After save, the row holds HTML; never-edited rows stay BlockNote JSON forever and render correctly via the format-detection path. `.rt-wrap--document .ProseMirror` got `min-height: 500px` so the variant carries appropriate sizing without per-surface props.

**3. Editor UX — sticky-toolbar saga ending in bubble menu pivot.** Jesse asked for the toolbar to follow scrolling on long documents. First attempt: CSS `position: sticky` + horizontal overflow + 44px mobile touch targets + dropdown clip-detection. Two compounding bugs: `overflow-x: auto` forces `overflow-y: auto` (CSS spec) which clipped the dropdowns vertically, and CSS sticky failed in the actual page layout despite removing the wrapper's `overflow: hidden` and switching `html` from `overflow-x: hidden` to `clip`. Pivoted to JS-based sticky (window scroll listener + `position: fixed` inline style toggle) — and that had its own bug (effect ran before the wrapper mounted because `useEditor` returns null on first render). After multiple round-trips with Jesse running console diagnostics that revealed the toolbar was at viewport y=122 (still in view, sticky correctly NOT engaging), Jesse pushed back: "this is inconvenient. Should we be considering something else?" That was the prompt to step back. **Architectural pivot:** replaced sticky with a selection-based bubble menu (Tiptap `BubbleMenu`, what Medium / Substack / Notion all use). Modern editors solved the long-document scroll problem years ago by bringing formatting tools to the cursor instead of pinning them to viewport top. Net change: -99 lines / +58 lines. Less code, more reliable. All sticky logic deleted.

**4. Top toolbar trim + bubble menu expansion.** With bubble menu owning inline marks, the top toolbar's purpose became clearly insertion-focused. Removed B/I/U/S/Code/Link from top toolbar (still in bubble menus). Top toolbar now: Heading dropdown, Lists, Quote, Image, Table, HR, Callout dropdown, Dharma block dropdown. Then Jesse noticed bubble was missing valuable selection-level actions, so expanded: `MessageBubble` got Highlight + Bullet/Numbered list + Quote; `DocumentBubble` got Highlight + H4 + Bullet/Numbered/Task list. Bubble menu now has parity with the top toolbar minus insertion-only actions (image, table, hr, callouts, dharma blocks). The Highlight extension was already installed and registered; only the button needed wiring.

**5. Phase 4 — all remaining `RimProseEditor` surfaces.** Thirteen components migrated in one commit, all identical pattern: dynamic import, state type `any` → `string`, lazy migration at init. Surfaces: `BioSection`, `AdminNotesSection`, `AboutMeSection`, `LessonNoteEditor` (with autosave preserved), `HouseholdDetail`, `HubScheduleClient` (sub-cover note), `VolunteerTable` (per-row notes), `CourseEditor`, `LessonEditor` reflection-question body (`variant="minimal"`), `ProgramEditor` programNotes/danaMessage/confirmationMessage/reminderMessage, `SupportInboxClient` reply/note/compose drafts (with `hasDraftContent()` helper for Tiptap's empty `<p></p>` state), `SupportSettingsClient` template body, `app/admin/banner/page.tsx`. The DanaTemplateSelector required care — its localStorage templates were BlockNote JSON; `loadDanaTemplates()` now converts to HTML on read; `textToHtml()` replaces `textToBlockNote()` for built-in templates.

**6. Critical bug fix during Phase 3 verification.** Jesse downloaded a hub document as markdown, then clicked Edit and the content appeared gone. Root cause: edit page filter `initialBody={Array.isArray(doc.body) ? doc.body : null}` — after Phase 3's lazy migration writes HTML, the filter rejected the string and passed `null`. Editor opened empty. The data was never gone — display page rendered fine. Fix: removed the filter, the editor's own lazy-migration handles all formats. Same filter pattern existed in `BioSection`, `AdminNotesSection` — caught and fixed in Phase 4.

**7. Cleanup commit — BlockNote deletion.** With every surface on `RimTiptapEditor`, the old editors became unreferenced. Deleted: `components/RimBlockEditor.tsx`, `components/RimProseEditor.tsx`, `components/editor/FormatPill.tsx` (orphan), `lib/blockNoteCustomBlocks.tsx`, `lib/blockNoteTheme.ts`. npm-removed: `@blocknote/core`, `@blocknote/mantine`, `@blocknote/react`, `@blocknote/server-util`. Net: 5,734 fewer lines in working tree. The format-detection renderers keep the BlockNote-JSON walker as a safety net for unmigrated rows still in production — only the editor components and direct dependencies went. Once every row in the wild has been edited and converted to HTML, that walker can be removed too. Comments in `MarkdownEditor.tsx` and the hub-documents manual seed text updated to reference `RimTiptapEditor` instead of the deleted names.

### What this connects to

- **Hub schema** — `Hub.welcomeBody`, `Hub.homeContent`, `HubDocument.body`, `HubConversationThread.body`, `HubConversationReply.body` all hold HTML strings going forward (with legacy BlockNote JSON in unmigrated rows). All `Json?` Prisma columns; no schema change needed since `Json?` accepts strings as valid JSON values.
- **Lesson + Manual** — `Lesson.body`, `ManualSection.body` same. The reflection-question editor (`Lesson` schema with `ReflectionQuestion.body`) also migrated.
- **Program + Course** — `Program.description`, `Program.programNotes`, `Program.danaMessage`, `Program.confirmationMessage`, `Program.reminderMessage`, `User.bio`, `User.adminNotes`, `Household.notes`, `SubRequest.message`, `SupportTemplate.body`, `SiteBanner.body` — all storing HTML now or converting on next edit.
- **Renderer system** — `lib/renderRichContent.ts` (client-safe walker, format detection) and `lib/renderRichContentServer.ts` (server-side async renderers) handle four formats: HTML strings (new), BlockNote JSON (legacy), `{type:"rawHtml"}` (very old), `{type:"doc"}` (very old Tiptap JSON). Until every row in the wild is converted, all four paths stay live.
- **API routes** — every editor save endpoint accepts the body as opaque `Json?` and writes through Prisma. No API changes were needed for any phase. Endpoints touched only on the read side: `app/api/hub/[slug]/documents/[id]/export/route.ts` still uses the BlockNote markdown converter for legacy rows but should grow an HTML-string path eventually.
- **Webflow architecture pivot** (committed earlier in April 2026) — orthogonal to this session. The editor surfaces that stay in RIM Next per the directive (lesson editing, hub documents, manual sections, message composers) all benefit from this consolidation; the public-facing pages that move to Webflow (programs, lessons display, dashboards) only consume the rendered HTML.
- **Editor Lab** (`/admin/editor-lab`) — still the review surface for editor-side feedback. Validates all three variants without touching production.

### Design decisions that hold

- **Bubble menu over sticky toolbar.** When pursuing a fragile pattern requires repeated debugging, propose an architectural alternative rather than continuing to debug. Modern editors (Medium, Substack, Notion, Bear) abandoned sticky for selection-bubble years ago because it solves the actual UX problem: formatting tools should follow the cursor, not pin to the top of the viewport. The pivot saved both code complexity and the long-document scroll experience.
- **Lazy migration over batch migration for Phase 3.** Document content has too many block types (tables, images, callouts, dharma blocks, custom extensions) to faithfully render via an inline `migrate.mjs` walker. Instead the client-safe `renderBlockNoteHtml()` (full fidelity) runs at editor load, and the row converts only when saved. Never-edited rows stay BlockNote forever and render correctly via the format-detection path. Trade-off: rows migrate over time rather than atomically, but the migration logic is the same renderer that's been in production for months.
- **Format detection is value-based, not surface-based.** The four formats (HTML string, BlockNote JSON, rawHtml, legacy Tiptap JSON) are completely shape-distinct. The renderer doesn't need to know which field it's reading from — `typeof === "string"` vs `Array.isArray` vs `{type:"..."}` are mutually exclusive. This is why the migration could be incremental and lazy.
- **Top toolbar = insertion, bubble = transformation.** Clean split of responsibility: the top toolbar is the discovery surface for things you can ADD (image, table, hr, callouts, dharma blocks); the bubble menu is the working tool for things you can APPLY to selection (marks, headings, lists, quote, link, highlight). No more duplicate buttons.
- **Storage paradigm: HTML strings, not JSON.** BlockNote stored a JSON tree that every renderer (server-side, email, plain-text excerpt) had to walk. Tiptap can do the same via `@tiptap/html`, but storing `editor.getHTML()` directly removes the walker step entirely — both editor and rendered page use the same string with the same classes. Trade-off: harder to re-shape content programmatically (e.g., swap a callout variant across all rows). For RIM's content patterns, that's a non-need.

### Patterns to keep in mind

- **`useEditor` returns null on first render with `immediatelyRender: false`.** If your component does `if (!editor) return null` early, any `useEffect` that touches refs INSIDE the render tree must include `editor` in its deps so it re-runs when the editor finishes initializing. The first run sees null refs because no DOM has been committed yet. This bug cost me three commits trying to debug "sticky doesn't work" before the pivot.
- **`overflow-x: auto` forces `overflow-y: auto`.** CSS spec — when one axis is non-visible, the other becomes auto. Means toolbar dropdowns get clipped when the toolbar has horizontal scroll. Use `flex-wrap: wrap` instead of horizontal scroll for narrow-viewport toolbar layouts. Or render dropdowns via React Portal to escape the clipping ancestor entirely.
- **Tiptap's empty document is `"<p></p>"`, not `""`.** Truthy. Any "do they have content?" check that uses `!draft` falls through. Use `html.replace(/<[^>]+>/g, "").trim().length > 0` to detect meaningful content. The `hasDraftContent()` helper in `SupportInboxClient` is the canonical pattern.
- **`Array.isArray` filters on body fields will silently drop HTML.** Pre-Phase-2 code had patterns like `initialBody={Array.isArray(doc.body) ? doc.body : null}` to guard against legacy formats. After Phase 3's lazy migration writes HTML strings, these filters reject valid data and pass null. Found the bug in `HubDocument` edit page (caused content-appearing-missing for Jesse), `BioSection`, `AdminNotesSection`. Pattern: trust the editor component's own normalization, don't filter at the page level.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `overflow-x: clip` clips overflow without making the element scrollable. Browser support: Chrome 90+, Safari 16+, Firefox 81+.

### What's open

- **Webflow weekly schedule** — still parked from session 95. New `/api/public/programs/weekly` endpoint, then Jesse designs the page. Self-contained.
- **Vercel `NEXTAUTH_URL` trailing space** — code is defensively trimmed in five places; the env var itself should still be cleaned at the source.
- **Floating "+" on empty lines** — optional polish for block insertion. Tiptap extension is installed but not wired up.
- **Toolbar dropdown contents** — Jesse said "I'll address the menu items later" early in the session. The current dropdowns (Heading, Callouts, Dharma blocks) are reasonable defaults; refinements are open.
- **BlockNote walker eventual removal** — once every row in the wild has been edited and saved as HTML, the BlockNote JSON path in the renderers can be removed too. No deadline; depends on user activity.

### What comes next

The Webflow weekly schedule is the natural next concrete deliverable — it's been parked since session 95 and unblocks the next batch of public-facing Webflow page work. The toolbar polish is a smaller, contained task that could happen in parallel.



### What prompted this session

Three threads converged. (1) Jesse wanted the alerts module gone — it was wired into half the host-flow code paths but the bell UI it was built for never shipped, so every notification path was paying a write that nobody was reading. (2) Conversations needed to let team members create and rename categories without going through admin. (3) A tester reported that the sub-request email either didn't arrive at all or arrived with a broken link. Those three landed first; then the bigger thread opened: Jesse said the Hub editors still felt clunky and asked to use the simpler Tiptap-based editor (the one currently sitting in the Editor Lab) everywhere formatting is needed.

### What shipped

**1. Alerts module removed entirely.** The `Alert` model + `AlertType` enum, the `/api/account/alerts` route, and the `check-unassigned-hosts` cron are gone. Every `db.alert.create / createMany / count` call was stripped out of: sub-request POST, sub-request claim, host-assignment claim/unclaim/reassign, programs-pg POST, and `lib/supportNotify.ts`. Email sends in those flows were preserved. The 5-minute alert-based dedup in `supportNotify` was dropped along with the alert write — it was the only consumer. Migration `remove_alerts_module` drops the `alerts` table and `AlertType` enum. The dashboard hub-unread badge for the host hub used to be `unreadThreads + unreadAlerts`; now it's just `unreadThreads`. Ritual closing for the module is real — the bell never shipped, the column is gone, the cron is gone, and the docs that referenced any of it have been updated below. Commit `14242e0`.

**2. Editable conversation categories.** Any active hub member can add or rename a conversation category from the Conversations page. Coordinators can also delete (deleting reassigns existing threads to a fallback category — `General` if it exists, otherwise the first remaining one). New route `app/api/hub/[slug]/categories/route.ts` (POST/PATCH/DELETE) does the work; rename cascades through `HubConversationThread.category` in a single transaction so existing threads stay reachable under their new label. Client UI: the compose select gets a `+ Add new category…` option; a discreet pencil chip in the filter row opens a manage panel with inline rename and delete-for-coordinators. Closes-on-outside-click. Commit `b90a104`.

**3. "What's new" panel removed from host hub home.** Per Jesse's read on a deployed copy. The host hub home is now welcome + "Our offerings this month" only — the recent-activity panel was duplicating signal already on the Conversations and Documents pages. Loader `loadHostHubRecent`, `RecentActivityPanel` + its types, and the `.hh-recent` CSS block are all gone. Commit `dd35154`.

**4. Phase 1 of the Tiptap editor migration — canonical `RimTiptapEditor`.** This is the biggest piece of the session. New folder `components/rim-tiptap/` with the editor and the five custom block extensions (Callout note + decision, PullQuote, VerseQuote, PracticeSuggestion, Reflection). One component, three variants:

- `minimal` — bold, italic, underline, link. No top toolbar; a small Bear-style selection bubble is the entire chrome. For inline form fields.
- `message` — same pinned top toolbar as document, minus headings + image/table/divider + custom blocks. For conversations, welcome/home, support replies, banners.
- `document` — full toolbar with three dropdowns: a heading dropdown (Paragraph / H2 / H3 / H4, label reflects current state), a Callouts dropdown (Note / Decision), and a Dharma block dropdown (Pull quote / Verse quote / Practice suggestion / Reflection). Plus the inline-format buttons, link, lists/quote, image upload (Vercel Blob client via `/api/upload`), table insert, divider.

Storage paradigm is **plain HTML strings** — not BlockNote JSON. Output classes (`.rim-el-pull-quote`, `.rim-el-note`, `.rim-el-practice`, etc.) are shared between the editor surface (`.rt-wrap .ProseMirror`) and the rendered HTML (`.rim-content`), so what you see in the editor is what you get on the page. The Editor Lab page (`/admin/editor-lab`) is the review surface — three tabs, sample content, live render pane, raw HTML pane.

**Production was not touched in Phase 1.** Old `RimBlockEditor` and `RimProseEditor` keep running on every existing surface. The migration of those surfaces — and the one-time JSON-to-HTML conversion of existing rows — happens in subsequent phases. Commits `b414ff1`, `4167fd6`, `b3a0655`, `ee01e00`.

**5. Sub-request email fixes — both bugs identified, both fixed.** Jesse forwarded the broken email and the cause was visible in the rendered HTML: the link was `https://rim-next.vercel.app /tools/schedule?…` with a literal space between the host and the path. The space is in his Vercel `NEXTAUTH_URL` env var. `BASE_URL` is built from that env var in `lib/email.ts`, `lib/calendarLinks.ts`, `lib/supportNotify.ts`, `app/api/cron/drip-release/route.ts`, and `app/api/stripe/checkout/route.ts` — every site got `.trim().replace(/\/$/, "")` applied so a typo in env vars can't poison email links again.

Second bug — same flow, separate cause. Sub-request POST and a few other fire-and-forget email paths used `void (async () => { … })()` after `Response.json()`. Vercel tears the function down once the response goes out, killing in-flight Resend calls. That matched the symptom (one email arrived intermittently, the rest were dropped). Switched to `after()` from `next/server` (Next.js 16's official background-work API) in sub-request POST, sub-claim POST, and programs-pg POST. The `after()` callback runs after the response is committed but before the function is torn down, so emails actually finish sending. Commit `35850f8`.

### Design decisions worth keeping

- **The bell that never rang was real cost.** `Alert` was being written from six call sites, indexed, paginated. Removing it deleted ~470 lines, simplified four hot routes, and dropped a daily cron. No user-facing loss because no UI was reading it. The lesson is the easy one — when a feature stops being a feature, removing the column is its own deliverable. Worth saving for the next "it's still in there because we built it" question.

- **Editor consistency is upstream of polish.** Jesse's framing — "the work we were doing before was too complicated" — was the real signal. The previous editor had two BlockNote-based components (`RimBlockEditor` and `RimProseEditor`) that drifted in capability and chrome. Rather than tune them further, swapping the engine to Tiptap with one component and three variants brings the surface back to one paradigm. The dropdown-toolbar conversation across this session (added → simplified → restored) was Jesse calibrating the chrome, not the architecture; the architecture held.

- **Measure-before-fixing applied to the email bug.** I was about to rewrite the markdown template to "defensively" remove the bold-around-link pattern when Jesse forwarded the actual broken email. The literal space made the cause obvious. Without the email, I'd have shipped a guess. Pattern reaffirmed: when the user reports a behavior bug, ask for the artifact (broken email, screenshot, log line) before theorizing.

- **`after()` is the right primitive for fire-and-forget on Vercel.** The `void (async ()=>{})()` pattern feels like it should work — modern JS, no syntax error, no runtime warning — but Vercel's serverless lifecycle silently kills it. Worth knowing project-wide. The grep that found three current call sites is `grep -rn "void (async" app/api lib`. None remain after this session. New email-side-effect code should use `after()` from the start.

- **Plain HTML over JSON for the new editor.** BlockNote stores its document as a JSON tree that has to be walked by every renderer (server-side, email, plain-text excerpt). Tiptap can do that too via `@tiptap/html`, but storing the editor's `.getHTML()` output directly removes the walker step entirely — both editor and rendered page use the same string with the same classes. Trade-off: harder to re-shape content programmatically (e.g., swap a callout variant across all rows). For RIM's content patterns, that's a non-need.

- **Editor Lab as the review-before-migrate surface.** Phase 1 is intentionally a no-op for production. The whole point is to give Jesse a place to use the editor, find what feels off, and fix it before the migration touches data. The dropdown back-and-forth in this session is exactly the kind of feedback that needs to happen against the editor, not against migrated data.

### What this work connects to

- **Hub schema** — `Hub.conversationCategories` is now a write target for hub members (not just admins). `Hub.welcomeBody` and `Hub.homeContent` will become Tiptap HTML strings in Phase 2 (currently still BlockNote JSON, edited via the old `RimProseEditor` in `HubAdminForm`).
- **Schema removed** — `Alert` model, `AlertType` enum, `User.alerts` relation, `alerts` table.
- **Routes removed** — `/api/account/alerts`, `/api/cron/check-unassigned-hosts`. Cron entry stripped from `vercel.json`.
- **Email infrastructure** — `BASE_URL` is now defensively trimmed in five places. Three POST routes (sub-request, sub-claim, programs-pg) wrap their email sends in `after()`.
- **Editor architecture** — three editors now coexist: `RimBlockEditor` (BlockNote, document/page-designer surfaces), `RimProseEditor` (BlockNote, message surfaces), `RimTiptapEditor` (Tiptap, target replacement for both). Phases 2–5 migrate every surface to the new one and delete the old two. Renderers (`lib/renderRichContent.ts`, `lib/renderRichContentServer.ts`) need to detect HTML-string vs JSON-tree at the boundary in Phase 2 — only Phase 1 touched the editor itself.
- **Manual** — no chapter changes this session. Manual sections about the host-team workflow continue to describe the existing flow accurately; the alerts removal and category editing are not user-visible enough to need new copy yet (Jesse can address as needed).

### What comes next

**Phase 2 of the Tiptap migration** is the next concrete deliverable. Outline:

1. Build `lib/renderRichContentTiptap.ts` (HTML pass-through with sanitization safety net).
2. Add format detection in `lib/renderRichContentServer.ts` so the existing rich-content renderers route HTML strings through the new path and BlockNote JSON through the old one. This lets surfaces migrate one at a time.
3. Migrate Hub Message surfaces in this order: Hub welcome (`HostHubHomeClient` inline edit + `HubAdminForm`), Hub home content (`HubAdminForm`), then Hub conversations + replies (`HubConvClient`, `HubConvThreadClient`).
4. Walk existing rows for those four fields (`Hub.welcomeBody`, `Hub.homeContent`, `HubConversationThread.body`, `HubConversationReply.body`), render the BlockNote JSON to HTML using the existing server renderer, write the HTML string back. Idempotent migration with a `_migration_flags` entry.
5. Confirm production looks right, then proceed to Phase 3 (hub documents + manual sections — Document variant, tables and images come into play).

The deferred Webflow weekly schedule work from session 95 also still stands — see UP_NEXT for which thread Jesse picks up first.

---

## 2026-04-24 (session 95) — Program Detail Webflow audit + doc sync

### What prompted this session

A gap was discovered between sessions: Jesse rebuilt the Program Detail page in Webflow after session 94 closed, but the docs (UP_NEXT, field reference, memory) still framed that work as "next session's first task." A new Claude session picked up cold and didn't know Program Detail was already live.

### What I did

1. **Ritual docs audit + cleanup** — reviewed the five ritual documents for efficiency and clarity. Archived `RIM_Editor_Design.md` (superseded by `RIM_Editor_Types.md`) and `RIM_Architecture_Pivot.md` (superseded by `RIM_Architecture_Directive.md`) with banners on both. Fixed a read-order conflict where the Directive duplicated the opening-ritual sequence from CLAUDE.md (Directive now defers to CLAUDE.md).

2. **Audited what Jesse actually wired in Webflow.** Used the Webflow Data API to find the Program Detail page (ID `69e985cd8cdb73f2540a9b47`, published at `/untitled/program-detail`), then `curl` + grep on the published HTML to enumerate every `data-rim-*` attribute. Result: 20 bindings across 14 fields. Two of them (`programNotesHtml`, `ctaHtml`) were not in the field-reference doc at all — Jesse wired them anyway. Four fields the reference lists (`locationLink`, `formatLabel`, `teacherNames`, `specialAnnouncement`) aren't placed on the page.

3. **Updated the docs to match reality.** `RIM_Webflow_Fields.md` rewritten to (a) mark Program Detail as live, (b) document the audited attribute set, (c) move the four unused-but-available fields into a separate "available" section, (d) add `programNotesHtml`, `ctaHtml`, `registrationUrl` to the field inventory, (e) add a `data-rim-bg` attribute row to the vocabulary table (was being used but undocumented), (f) add a `curl | grep` recipe for re-auditing. UP_NEXT rewritten to reflect "live — CTA and cleanup pending" instead of "pending."

### Design decisions that matter

- **Audit by reading shipped HTML, not by asking.** Jesse couldn't remember which attributes he wired where, and fairly — the field reference doc was how he did it, but he didn't cross-check it against the final page. The authoritative source is the HTML that ships to visitors. `curl | grep -oE 'data-rim-[a-z]+="[^"]*"' | sort -u` is the one-liner that keeps the doc honest.
- **Accept that Jesse improved on the doc.** He wired `ctaHtml` (the single-element drop-in) instead of the register-button + closed-notice + membership-note trio the reference described, and wired `programNotesHtml` even though it wasn't in the doc. The doc now matches what's on the page, not what was planned.
- **"Available but not yet placed" is a useful category.** Four fields are ready in the API but aren't on the Webflow page. Worth distinguishing from fields that don't exist — if Jesse decides he wants a map link or facilitator row later, the data is already shipping.

### What this work connects to

- **`/api/public/programs/[slug]`** — the endpoint the page consumes. No schema change today, but the inventory in `RIM_Webflow_Fields.md` is now the canonical list of what it returns.
- **`rim-connect.js` v3** — used as-is. `data-rim-bg` was being used on the page, confirming that attribute works end-to-end even though the doc hadn't listed it.
- **Webflow site-wide head code** — unchanged. The Program Detail page relies on the site-level script, preconnect, and hide-style from session 94.
- **Auth-aware CTA (still deferred)** — `ctaHtml` covers guest states only. A member-specific variant ("You're registered →", "Pending dana →", "Join session →") is still the open architectural question; tracked in UP_NEXT with the two options (member endpoint vs Next.js embed).

### What comes next

- Jesse decides whether to add `teacherNames` / `specialAnnouncement` / `locationLink` / `formatLabel` to the page, or leave them off.
- Pick the auth-aware CTA approach before the next Program Detail session.
- Once the CTA works across auth states, delete `app/programs/[slug]/page.tsx` — the formal cutover for that surface.

### Part two — Programs listing audit + folder-slug fix + cache debugging

After the Program Detail audit wrapped, Jesse moved on to the Webflow Programs listing page and a few details emerged that are worth capturing:

- **Navigator renames are manual.** Jesse asked whether the Webflow MCP could rename Navigator labels (e.g. "Section" → "Programs Hero") as we'd done in a prior session. It cannot. None of `element_tool`, `style_tool`, or `element_builder` expose Navigator-label renaming — that's an internal Designer property you set by double-clicking. I proposed a rename list for him to apply manually. Add to the permanent reminders so we don't promise it again.
- **"Learn More" 404 root cause: folder slug.** The listing's Learn More link pointed to `/rim-next/program-detail?slug=...` but the live page was publishing at `/untitled/program-detail` — the folder slug was still "untitled" from Webflow's default. Jesse renamed the folder slug to `rim-next`. After a republish the detail page publishes at `/rim-next/program-detail` and the links resolve.
- **Browser cache on 404 responses is aggressively sticky.** After the republish, `curl` confirmed `HTTP 200` server-side, but Jesse's regular browser kept showing "Page not found" even after multiple hard refreshes. Incognito loaded immediately. Cause: Cloudflare + disk cache of the stale 404 response, keyed to the URL. Hard refresh only re-requests the current page's resources — it doesn't evict the cached 404 for a sibling URL. The fix is DevTools → Application → Clear site data, or working with DevTools open and "Disable cache" checked. Important: this is **not** related to the session-94 perf work. `rim-connect.js` caches API JSON at Vercel's edge and fades in the page body — it doesn't cache HTML or register a service worker.
- **Naming lint on the listing page.** The Programs listing page slug is `Programs` with a capital P → it publishes to `/rim-next/Programs`. Most URL setups are case-sensitive. Not broken today, but worth lowercasing before it bites.

### What comes next for the weekly view (next session)

Jesse will design the weekly schedule page in Webflow. Prep work on the Next.js side:

1. Build `/api/public/programs/weekly` — returns next-7-days (or `?week=next`) grouped by weekday. Reuse `lib/scheduleUtils.ts::isOccurrenceOnDate()`. Copy cache headers from the existing programs endpoints.
2. Decide whether to ship via the existing `data-rim-group-list` primitive (already in `rim-connect.js` v3) or a new `data-rim-weekly-list` primitive. Default to grouped-list.
3. Jesse duplicates the Programs listing page in Webflow as `weekly-schedule`, points the grouped-list at the new endpoint, restyles.

---

## 2026-04-24 (session 94) — Webflow architecture committed + rim-connect v3 performance work

### The pivot is no longer tentative — it's committed

We started this session by trying (again) to port the Webflow Program Detail design into the Next.js `/programs/[slug]` route using Webflow as a visual spec. The usual loop happened: port, eyeball-tune, spot drift, iterate. By mid-session it was clear the spec-to-code pipeline isn't going to get better for visual surfaces no matter how much we tighten it.

We considered three options and picked one: **Webflow is the primary surface for every public/member-facing page. RIM Next is the backend + bridge.** Jesse designs directly in Webflow; we extend the API + `rim-connect.js` to cover whatever the design needs. The `RIM_Architecture_Directive.md` already described this shape as the target; today it became policy rather than experiment.

The decision point was a real blocker: the page felt unprofessional on first load — a visible flash of Webflow template placeholders before `rim-connect.js` populated them. Jesse was ready to abandon the whole pivot over it. Before throwing out the architecture, we measured and fixed.

### What shipped

**API caching on `/api/public/programs` and `/api/public/programs/[slug]`.** Bumped `s-maxage` from 60 → 300 and `stale-while-revalidate` from 300 → 86400. Added explicit `CDN-Cache-Control` and `Vercel-CDN-Cache-Control` headers to ensure Vercel's edge respects them independent of the sanitized browser-facing `Cache-Control`. Before: cold miss ~415ms, cached hit ~155ms. After: cold miss ~180ms, cached hit ~115ms. Most visitors now hit the CDN edge in that range. First-visitor-per-URL cold misses still pay the database round-trip, but the 5-minute window + 1-day stale-while-revalidate means the miss is rare in practice.

**`rim-connect.js` v3 — hide-until-populated for detail pages.** New behavior: `[data-rim-page]` containers start at `opacity: 0` with a 120ms transition, and the script adds a `.rim-ready` class once `populateFields` completes (or errors, or hits a 1500ms safety timeout). Turns "flash of Webflow placeholder text" into "brief fade-in." The hide rule is also available inline in Webflow's site-wide `<head>` so it applies before the script itself loads — eliminates the race where the script is still fetching while the body has already painted placeholders.

**Webflow site-wide head code (Jesse applied, not code-committed here).** Consolidated every page's custom code into Site Settings → Custom Code → Head Code:
- `<link rel="preconnect">` + `<link rel="dns-prefetch">` to `rim-next.vercel.app` (DNS + TLS warmup).
- Inline `<style>` block for `[data-rim-page]` hide/reveal — placed above the rim-connect script tag so the rule applies regardless of script-load timing.
- Memberstack scripts in existing order.
- `rim-connect.js` script tag last.

Page-level custom code for `data-rim-*` handling is now removed. One place to update going forward.

### Design decisions that matter

1. **Measure before pivoting an architecture.** When Jesse said "a few seconds" of delay and asked if we should abandon the pivot, the honest answer was "I don't know — let me measure." The real numbers (~115ms cached, ~180ms cold) told a different story than the frustrated perception. That turned a potential architecture reversal into a 30-minute performance tuning session. Rule for future: when a user reports a performance feeling, measure before validating the feeling.

2. **The flash was a race, not a speed problem.** Even at 115ms response times, the user was seeing placeholder content before the data arrived because the browser had already painted the body. The fix wasn't to make the fetch faster — it was to hide the container until the fetch completed. Different problem than I initially framed.

3. **Inline the hide CSS in Webflow's `<head>`, don't inject from JS.** Script-injected CSS fails in the race where the script itself is still loading. Inline CSS in site-wide head applies at HTML parse time, before any body element renders. This is belt-and-suspenders with the script-side injection — both are now in place, but the inline rule is what guarantees zero flash.

4. **Site-wide head is the right home for `rim-connect.js` and its support code.** The script is idempotent across pages (exits silently when no `data-rim-*` attributes are present), so there's no cost to it running everywhere. Single place to update; no chance of forgetting a page.

5. **The commit is about the pipeline, not about any one page.** We did not finish the Program Detail Webflow build in this session. We stopped trying to finish it in RIM Next. The next session starts with Jesse designing Program Detail from scratch in Webflow, with `data-rim-*` bindings to the existing API. Any drift from "what it should look like" is now a Webflow adjustment, not a CSS tuning pass in `custom.css`.

### What this work connects to

- **`RIM_Architecture_Directive.md`** — today's decision confirms what the directive already described. The "tentative" language in the memory file is now stale; the pivot is policy.
- **Next.js `/programs/[slug]`, `/programs/[slug]/register`, `/account/programs/[slug]`** — public program page is now slated for Webflow. The Next.js version continues to render (it was used as Jesse's visual reference during this session), but should not receive further visual tuning. Registration flow and member-side program detail stay in RIM Next.
- **API conventions (`/api/public/*`)** — the caching pattern used here is the template for every future Webflow-read endpoint. Explicit `CDN-Cache-Control` + `Vercel-CDN-Cache-Control` alongside the browser Cache-Control, with `s-maxage=300, stale-while-revalidate=86400` as the default. New endpoints should follow this shape unless there's a reason not to.
- **`rim-connect.js`** — v3's detail-page hide-until-populated sets a precedent. Future bindings (list states, grouped lists, auth-aware CTAs) should follow the same principle: the wrapper element stays invisible until data arrives, rather than rendering placeholders that swap.
- **Auth-aware CTAs on Webflow pages** — the one genuinely hard piece still ahead. Current `rim-connect.js` v3 handles public data only. Registration state ("Register" vs "You're registered" vs "Pending dana" vs "Join session") depends on the viewer's session. Options: (a) a second endpoint `/api/member/programs/[slug]` that reads the NextAuth cookie and returns member-specific CTA HTML, merged client-side; (b) small Next.js-hosted iframe/embed for the CTA block alone. Decision deferred to the next Program Detail session.

### What comes next

Next session: Jesse designs Program Detail in Webflow (from scratch — not as a port of the Next.js version). We cover each field and interaction with `data-rim-*` bindings, extending `rim-connect.js` or adding API endpoints as needed. The hard piece is the auth-aware CTA — we decide the approach before building.

Everything else on the Host Hub / Phase 5-adjacent backlog from session 93 carries forward unchanged.

---

## 2026-04-22 (session 93) — Host Hub Phase 4, team-management manual chapter, ritual cleanup

### The scope

A small, load-light batch sitting between two bigger phases. Three concrete pieces:

1. A new staff manual chapter for the Host Hub's coordinator — the first piece of documentation authored specifically for the Virtual Host Coordinator role. Covers the authority model, the three statuses, pause semantics, and the hub-membership-is-authority rule in plain English.
2. Phase 4 of the Host Hub Rework — two small additions on the Schedule tool session detail panel for Host Managers and Admins: a program setup diagnostic and a reassign-to-self action. No schema changes, no permission model changes.
3. Closing-ritual cleanup — the feature-cards step in CLAUDE.md referenced `app/admin/features/page.tsx`, which has never been built. Removed the step so the ritual stays true to the code.

### What shipped

**Manual chapter — `host-hub-team-management`.** A new `ManualSection` seeded idempotently through `prisma/migrate.mjs` via the flag `seed_manual_host_hub_team_management_v1`. Body built in `prisma/seed-manual-host-hub-team-management.mjs` as BlockNote JSON using the same `h/p/li/ni/sp` helpers as the Program Manager seed. Chapter covers: the coordinator's authority (add, pause, remove — with the ADMIN-only carve-out for hard deletion), the three statuses (Active / Paused / Inactive) and what each means operationally, the three pause settings (hosting capability, communications, pause note) with recommended defaults, the hub-membership-is-authority rule explained in non-technical terms, what syncs automatically vs. what the coordinator owns, and which things belong to the registrar or ADMIN instead. Renders at `/admin/manual/host-hub-team-management` once the next deploy runs the migration.

**Program setup diagnostic panel — `components/HubScheduleClient.tsx`.** When the viewer is a Host Manager or Admin, the expanded session detail now renders a `<ProgramDiagnostics>` block between the sub-message and the actions row. Four read-only checks: program format is virtual or hybrid (error), `livekitRoom` is configured (error), an occurrence is scheduled for the session date (error), a host is assigned (warning, not error — that's the normal state the rest of the tool is designed around). When everything passes, the panel stays visible but collapses to "All checks pass." Failed checks render with a hint that program configuration belongs to the registrar and two inline links: the Program Manager (`/tools/programs/[slug]`) and the public page. Styling uses `--color-error-bg` / `--color-warning-bg` / `--color-success-bg` so the panel's background communicates the overall state at a glance. The Schedule page (`app/tools/schedule/page.tsx`) now reads `livekitRoom` from each program and passes it through in the session payload; the GET `/api/host/assignments?month=` endpoint does the same so client-side month navigation stays consistent.

**Reassign-to-self action — `app/api/host/assignments/reassign/route.ts`.** New `POST` endpoint, HOST_MANAGER/ADMIN only. Body: `{ programSlug, sessionDate, currentAssignmentId? }`. Flow: cancel any open sub-requests on the existing assignment, delete it, create a fresh assignment owned by the requester. Notifies the previously-assigned host (if any) with an `UNASSIGNED_SESSION`-typed alert and the rest of the Host Team (routed through `getHubNotificationRecipients("host-team", { excludeUserId: newHostId })` so paused members and those with communications disabled are correctly excluded). On the client, the action appears in the session detail's secondary actions as "Reassign this session to me" whenever the viewer is a manager and isn't already the assigned host. Confirmation dialog explains what will happen — previous host gets removed, open sub-request gets cancelled. Uses the existing `hub-detail__warn` pattern.

**Ritual cleanup — `CLAUDE.md`.** Step 6 (feature cards) removed from the closing ritual. Steps renumbered 6–8. Rationale: the referenced file doesn't exist, so the step was inert at best and misleading at worst. If we decide to build a feature inventory page later, we add the step back — the ritual should reflect the code as it actually is, not as it might someday be.

### Design decisions that matter

1. **Diagnostic as a second lens on the session, not a separate surface.** Rendering the panel inline in the existing detail view (instead of on a new admin tool) keeps a Host Manager in the same motion: they open a session to understand it; the diagnostic is part of that understanding. Matches the Dharma-rooted design principle of clear seeing without context-switching.

2. **Warnings vs. errors.** "No host yet" is a warning, not an error, because it's the normal state the whole schedule tool is built to help fix. The diagnostic distinguishes configuration problems (which the coordinator can't resolve and should route to the registrar) from coverage gaps (which they're actively working on).

3. **Reassign-to-self is delete-then-create, not userId mutation.** Swapping `userId` in place would carry an inflight sub-request forward onto the new host, which doesn't make sense semantically. Fresh assignment + explicit cancel of the old sub-request models the managerial override cleanly. Previously-assigned host gets one clear notification rather than two ambiguous ones.

4. **Reassign-to-self, not reassign-to-anyone.** Managerial takeover of a session is a real operation; managerial assignment-to-someone-else is a policy question this codebase has deliberately not answered (the sub-request system is how coverage transfers happen). Keeping this phase's action narrowly scoped avoids pretending that scope is settled.

5. **Feature-cards step removal instead of preservation-as-comment.** Leaving a breadcrumb ("feature inventory page not currently built") would have kept the ritual pointing at a non-thing. Cleaner to remove and rebuild if needed — the code-as-written is what we're really ritualizing around.

### What this work connects to

- **Staff manual infrastructure** — first chapter authored for a hub coordinator role rather than a platform tool. Sits alongside the Program Manager chapter (`slug: "program-manager"`) and follows the same seed + flag pattern, confirming that pattern is now the standard way to add manual content.
- **Host Hub Rework Phase 3** — the manual chapter and the diagnostic panel both depend on the Phase 3 authority model. The chapter explains it in user terms; the diagnostic and reassign flow assume it (effective-hosting gates still run on the underlying routes).
- **Program Manager** — the diagnostic panel routes coordinators to `/tools/programs/[slug]` for configuration issues. The Program Manager chapter remains the written reference for what they'll see there.
- **LiveKit session flow** — the diagnostic's `livekitRoom` check is a pre-flight read on the same field LiveKit token generation relies on. A session where the diagnostic reports missing LiveKit config will also fail to connect; the diagnostic surfaces it before the participant sees the failure.
- **Hub notification authority** — the reassign endpoint's post-action alerts route through `getHubNotificationRecipients`, so the Phase 3 policy ("paused/inactive/communications-disabled members don't receive hub notifications") is enforced here too without the endpoint having to know the rules.

### What comes next

Phase 5 — role-adaptive Hub Home. Shipped in this same session after the summarization (below).

### Phase 5 — role-adaptive Hub Home (shipped same day)

**What shipped.** The `/account/hub/host-team` route now branches at the page level: coordinators (and admins) land on a coordinator shell; everyone else on a host shell. A session-scoped toggle lets coordinators preview the host view without leaving the page — not persisted, resets on refresh. Other hubs continue to use the generic `HubHomeClient`; the new `HostHubHomeClient` is Host Hub-specific as the spec intends.

**Coordinator view.** Four attention-list sections, each hidden when empty, with an "Everything's handled" fallback when all four are empty: pending new hosts (HubMember `joinedAt` within 7 days), unassigned virtual/hybrid programs in the next 30 days (reuses the cron query shape in `check-unassigned-hosts`), unclaimed sub requests (SubRequest `status = OPEN`), and new conversation threads created since the coordinator's `lastVisitedAt` watermark. Each card has a heading, a hint line, and a "view all" link pointing to the relevant tool or tab. Below the attention block: the team directory renders `hub.homeContent` (coordinator-authored prose, per the Phase 1 revert — role descriptions are content, not schema); a quick-links block with the four surfaces coordinators touch most (schedule, members, conversations, team-management manual chapter); a coordinator notes placeholder that points at Documents for now.

**Host view.** Welcome block renders `hub.welcomeBody` (reusing the field that already drove the welcome interstitial). Pinned threads list. Team roster grid — one card per other ACTIVE member, with avatar (falls back to initials), name + coordinator badge when applicable, title line (prefers `HubMember.position` over `User.title`), and rendered `User.bio` HTML. Troubleshooting block: three static paragraphs covering the common wrinkles — stale auth state, needing coverage, and escalating something. Host-side quick links to schedule, conversations, documents, and the presence-photo settings page.

**Placeholder content seed.** New `prisma/seed-host-hub-home-content.mjs` seeds `welcomeBody` (host-view welcome) and `homeContent` (coordinator-view team directory) on the `host-team` Hub, behind flag `seed_host_hub_home_content_v1`. Write-only-if-null — never overwrites coordinator edits. Both blocks are BlockNote JSON built with the same `h/p/sp/b` helpers used for the manual chapter seed.

**Design decisions that matter.**

1. *Attention items are Host-Hub-specific for now.* No shared attention-items abstraction. When a second hub (Course or Registration) asks for its own attention view, refactor the cross-cutting pieces (watermark, empty-state rendering, card primitives). Generalizing preemptively on one data point is speculative.
2. *Toggle state is React state, not URL.* Preview-as-host is ephemeral by design — a coordinator should not be able to accidentally bookmark a "host preview" URL and return later thinking it's their real view. Session-scoped component state resets on refresh, which is exactly the wanted semantics.
3. *Host view always fetches even for coordinators.* So the toggle works without a round-trip. The cost is one extra query pass on the coordinator side; the benefit is the toggle feels instant and never diverges from what a host actually sees.
4. *Team directory is `hub.homeContent`, not a new field.* Per the Phase 1 revert, there is no RoleProfile model. Reusing `homeContent` for team-directory prose keeps the content model honest: coordinators edit Hub Home content via the existing editor at `/admin/hubs/[slug]/edit` and that content renders here.
5. *Host roster does not filter on hostingCapability.* Paused members still appear — with an intent future-iteration to badge them visibly. Hiding them would make the team look smaller than it is and conflict with the Phase 3 rule that "paused means on-team-but-not-active," which matters for social continuity.
6. *Coordinator notes area is a placeholder pointing at Documents.* Adding a new `Hub.coordinatorNotes` field is its own decision — it forces questions about editor surface, audit, and versioning. Punted honestly rather than half-built.

### Phase 5 connections

- **Host Hub Phase 3 (authority model)** — `isCoordinator` + `HubMember.isCoordinator` drive the view split. Attention items filter on `HubMember.status = ACTIVE` (pending new hosts) and implicitly inherit the Phase 3 rules for who-counts-as-team.
- **`HubMember.lastVisitedAt`** — drives the "new conversations since last visit" attention section. Already updated-before-render by the existing Hub Home logic; we snapshot `priorLastVisitedAt` before the update so the watermark is stable across the page's queries.
- **`Hub.welcomeBody` + `Hub.homeContent`** — two existing fields repurposed as the host-view welcome and the coordinator-view team directory respectively. No schema changes. Coordinator edits continue to flow through `/admin/hubs/[slug]/edit`.
- **Phase 4 (schedule)** — unrelated directly, but the new coordinator "Unassigned virtual/hybrid programs" attention card deep-links into `/tools/programs/[slug]` (for configuration) and `/tools/schedule` (for assignment) in the exact same way the Phase 4 diagnostic panel does.
- **Manual chapter (`host-hub-team-management`)** — the coordinator quick-links block links directly to `/admin/manual/host-hub-team-management`, making the playbook one click away from the place a coordinator actually works.

### What comes next (post-Phase 5)

The Host Hub Rework spec is now substantively delivered across Phases 1 → 5. Remaining open threads are small and specific:

- Visual cue on the schedule for paused or hosting-revoked assignees (deferred from Phase 4).
- Dedicated inline editor for a Hub-level coordinator notes area (deferred from Phase 5 sub-step 2 — the placeholder currently points at Documents).
- Editor/block work from session 90's queue (Stage 2d blocks, `TeacherProfile.bio` + `Course.completionNote` schema promotions, terminal `<EditorField>` code-level gate).

---

## 2026-04-22 (session 92) — Host Hub Rework Phase 3: Hub membership as authority

### The scope

Phase 3 is the load-bearing phase of the Host Hub Rework spec: change how hosting permissions and hub notifications are computed platform-wide, so that hub membership — not the global Role[] — is the authority for team state. Coordinators get a dimmer switch: pause a member, restrict hosting, disable notifications, mark inactive. Role revocation no longer strips anyone from a hub.

This replaces the old binary on/off pattern where removing HOST_TEAM_MEMBER deleted the HubMember record and any coordinator-authored context with it. Field ownership is now layered:

- **Sync-owned** (written by `syncHubMembership`): `hubId`, `userId`, `position`, `isCoordinator`
- **Coordinator-owned** (written only through the hub members API): `status`, `hostingCapability`, `communicationsEnabled`, `pausedAt`, `pausedById`, `pauseNote`, `coordinatorNote`
- **Member-owned** (written by the user's own hub interactions): `firstVisitedAt`, `lastVisitedAt`

### What shipped

**Schema + migration.** `HubMemberStatus` enum (ACTIVE/PAUSED/INACTIVE) and 6 new coordinator-owned columns on HubMember. Idempotent migration `add_hub_member_authority_fields` with `information_schema` guard and `DO $$ ... EXCEPTION WHEN duplicate_object` for the enum.

**Two helpers — `lib/hubMemberAuth.ts`.** `getEffectiveHostingCapability(userId, hubSlug, fallback)` and `canReceiveHubNotifications(userId, hubSlug, fallback)`. When a HubMember record exists it is authoritative; when absent, the tentative role/assignment decision is used as fallback. This preserves legacy paths (teachers with no host-team membership; one-off HostAssignments; pre-migration users) while making hub authority primary.

**Sync policy rewrite — `lib/syncHubMembership.ts`.** Create path sets only sync-owned fields. Update path sets only sync-owned fields. The delete-loop that used to run on role revocation was removed entirely. Explicit comment: hard removal now requires the ADMIN-only DELETE.

**Notification gate — `lib/toolAuth.ts`.** `getHubNotificationRecipients` filters by `status === "ACTIVE" && communicationsEnabled`. Role-based `db.user.findMany` recipient queries elsewhere in the codebase were replaced with this helper so all hub notifications go through the same gate.

**LiveKit gates.** `token`, `step-in`, `mute-participant`, `mute-all` — all four routes now run the tentative role/assignment decision through `getEffectiveHostingCapability(userId, "host-team", tentative)`. ADMIN always bypasses.

**Host-team gates.** Sub-requests (GET+POST), sub-request claim, host assignments (GET+POST self-claim + manager-assign target validation), and post-claim team notifications. A local `hasEffectiveHostAccess(userId, roles)` helper sits in the two routes that mix admin/registrar/host-team checks with hub authority.

**Hub members API.** Path renamed `[memberId]` → `[userId]`. POST accepts initial `position` + `isCoordinator` and checks `archivedAt: null` on the target. PATCH accepts all coordinator-owned fields with a destructive-action confirmation flow: if a change would revoke hosting (status transitioning away from ACTIVE, or hostingCapability flipping to false on host-team) and the member has upcoming HostAssignments, the endpoint returns 409 `{ requiresConfirmation, reason, upcomingAssignments }`. The client then resubmits with `force: true, releaseAssignments?: true`. On release, upcoming HostAssignment.userId is nulled (the slot reopens). DELETE is now ADMIN-only — coordinators set status INACTIVE instead.

**Coordinator UI — `components/HubMembersClient.tsx`.** Full rewrite. Per-member editor panel with status select, coordinator checkbox, hosting-capability toggle (host-team only), communications toggle, pause note, coordinator note. Status badges (Paused / Inactive), flags ("Hosting restricted" / "Notifications off"), pause-note display. Non-coordinator viewers see a read-only roster. Sections group by Coordinators / Members / Paused / Inactive. Confirmation dialog lists up to 10 upcoming assignments with "Proceed (keep assignments)" and "Proceed and release assignments" buttons.

**Member picker guardrails.** `search/route.ts` — min 3 chars, `archivedAt: null`, `memberStatus: "ACTIVE"`, existing hub members excluded, `preferredName` included in search, results capped at 20 and sorted by name.

**CSS.** `hub-mem-editor-*`, `hub-mem-dialog-*`, status-badge variants, paused/inactive dimming — all added to `custom.css` using design tokens (`var(--color-warning-bg)`, etc.).

### Design decisions that matter

1. **Hub membership is authoritative when it exists.** This is the new permission rule for all hub-gated surfaces. `getEffectiveHostingCapability(userId, hubSlug, fallback)` is the one helper to call; do not re-implement the pattern. ADMIN always bypasses before the helper runs.

2. **No-delete on role revoke.** The sync function never calls `db.hubMember.delete()`. Coordinator-authored context (notes, pause history, hosting restrictions) survives role changes. Hard removal is ADMIN-only and explicit.

3. **Destructive actions get a confirmation flow, not a silent permission strip.** Any coordinator action that would revoke hosting from a member with upcoming HostAssignments returns 409 and requires `force: true` to proceed. The client surfaces what's at stake (upcoming sessions) and offers "release assignments" as a deliberate side effect.

4. **Empty scaffolding was the mistake of Phase 1.** Phase 2 was an empty hub settings shell — skipped for the same reason. Will build when a real setting needs a home.

5. **`User.bio` stays; role descriptions don't.** Phase 1's `RoleProfile` layer was reverted in the prior session; this session built on the surviving pieces (User.bio, BlockNote avatar, BioSection, `user-bio` editor placement). Role descriptions belong in coordinator-authored Hub Home content, not a separate model.

### What this work connects to

- **LiveKit video sessions** — host/host-team grants now gate through hub authority. A teacher/assignment host with no HubMember record still works via fallback; a paused host-team member loses hosting cleanly.
- **Sub-request flow** — creation, claim, and post-claim team notifications all route through the hub authority helpers. If you're paused you won't receive the notification or be allowed to claim.
- **Host assignments** — self-claim and manager-assign target validation check effective hosting. Manager-assign surfaces a friendlier error ("X is paused or has hosting restricted") when validation fails.
- **Program Schedule / Host Team surfaces** — still render assignments without a visual cue for paused hosts. This is a known gap, queued in UP_NEXT.
- **HostAssignment.userId nullable release** — reuses existing nullable-userId semantics. An upcoming assignment with no userId is the existing "open" state that the sub-request flow already understands.

### What comes next

Nothing is committed for the next phase. Possibilities captured in UP_NEXT: a deferred Phase 4 (hub-scoped preferences, only when a real setting exists); hub-home surfaces for paused members and their notes; a "hosting revoked" flag on schedule cards; the still-open Stage 2d editor blocks from session 90's queue. Also pending: the staff manual chapter on coordinators managing hub members needs a real pass covering the status/hosting/communications distinctions and the destructive-action flow — ManualSection content is DB-backed, so that happens in `/admin/manual/editor`, not in source.

---

## 2026-04-20 (session 90) — Aside block, editor menu unification, typography alignment

### The scope

Stage 2d first concrete block. Session began with a four-phase design conversation for an Aside block — the "universal shaded container" element — and ended with a fully unified editor chrome system. The Aside was the vehicle; the real work was realizing that the editor's menu/typography/interaction surfaces had drifted apart and needed to be reassembled around `lib/editorRegistry.ts` as the single source of truth.

### The Aside block journey

The four-phase procedure ran through it properly: brief → design → implement → review. Initial implementation gave the Aside custom controls — color swatches, title input, heading-level selector, native color picker — and each one became a surface for ProseMirror to fight with. onClick events got swallowed by contentEditable=false blocks. Text inputs lost focus after one keystroke because ProseMirror's native keyboard listeners reclaimed selection. A native color picker produced saturated palette colors instead of design-system tints. CSS specificity battles between the generic callout rule and the aside-specific rule.

Nine distinct bugs chased over several hours. Classic "multiple drift points" signal — fighting the tool rather than working with it. After stepping back with Jesse, agreed to strip the block to its essence: a pure structural wrapper. The final Aside is:

- **`content: "none"` container block** with children rendered as BlockNote's normal block-group sibling
- **No controls, no chrome, no per-instance props** — the render function returns a zero-height marker div, that's all
- **Shading applied via CSS `:has()`** — `.bn-block:has(> .bn-block-content > .bn-callout--aside)` with the same specificity as the generic callout rule it needs to override
- **Color determined by context**, not per-block — future CSS rules scoped by `rim-content--program`, `rim-content--lesson`, etc. can override the gray default. "We will render the element according to the design that it is associated with" (Jesse's words).
- **Title is just an H-tag inside** as the first child. No separate title field. Same block vocabulary for authors throughout.

Trade-off accepted: backspace at position 0 of the first child unwraps the aside. This is standard container behavior across every rich text editor (Notion, Craft, Bear, Obsidian). Documented, not fixed.

### Menu unification — single source of truth

With the aside simplified, the session turned to a drift Jesse noticed: the pill ⋯ menu and the slash `/` menu showed different block lists in the same context. Classic divergence — two hardcoded arrays maintained separately. Root cause: `lib/editorRegistry.ts` was set up as a single source of truth during session 89 but wasn't actually wired into the UI.

Rewired in this session:

- **New shared helper** `insertElementAtCursor(editor, element)` in `components/RimBlockEditor.tsx` — drives all inserts with smart behavior (replace empty line → don't leave stranded empty paragraphs; seed container blocks with a starter paragraph; place cursor inside).
- **Pill menu's `insertItems`** replaced with `insertElementsForContext(registryContext)`. Both `ToolbarMoreMenu` and `PillContextMenu` read from the registry. Items grouped by category (Text / Lists / Structure / Media / Callouts / Dharma) with dividers.
- **Slash menu implemented** via BlockNote's `SuggestionMenuController`. Custom `<RimSlashMenu>` component feeds it `insertElementsForContext(...)` through `getItems`. Fuzzy filtering works out of the box via `filterSuggestionItems` from `@blocknote/core/extensions`. Group labels come from `GROUP_LABELS`.
- **Visual styling unified** across slash and pill: uppercase "eyebrow" section labels at `var(--text-xxs)` / `font-weight: 600` / `var(--rim-text-muted)` with thin `border-top` dividers between sections. Identical treatment on both menus.

Result: adding a new block to RIM going forward is one registry entry. Both menus pick it up per its `availableIn` list. No more divergent lists to maintain.

### Typography alignment between editor and rendered output

Multiple typography drift points addressed:

- **`--font-doc` redefined** from `'Inter'` to `'Open Sans'`. The editor's separate font token was the reason the editor read visibly different from the rest of the site. One change flipped 15+ editor-chrome selectors.
- **Editor heading sizes** aligned to design-system tokens (`var(--text-h1)` = 38, `--text-h2` = 28, `--text-h3` = 24, `--text-h4` = 20). Previous hardcoded values (H1=32, H2=24, H3=20) from session 71 had drifted below the token scale. The injected `<style>` tag's guard (`if (document.getElementById(id)) return`) was also the cause of one pass of visible bugs — a stale tag persisted across SPA navigations. Changed to find-or-create-and-overwrite so heading rules always refresh.
- **Editor body size** aligned to `var(--text-body)` = 18px (was 16px), matching rendered output.
- **First-heading top margin** zeroed out so the document's first line sits flush and nested container's first block doesn't gain a gap.
- **Aside child font size** explicitly forced to `var(--text-body)` — BlockNote's default nested-block CSS was shrinking text inside `.bn-block-group`.

### Smart trailing-empty-line collapse

BlockNote always appends an empty paragraph at the end of the document so users can type after the last block. That's good UX for prose flow but visually broke the "finished" look when the last real block was a design element (aside / callout / image / table). Jesse flagged this as breaking the even-box aesthetic.

CSS `:has()` rule added that collapses the trailing empty paragraph to zero height when it follows a container block. The paragraph still exists in the DOM (cursor can still land there), and a new 32px `padding-bottom` on the editor preserves a clickable zone. Rendered output was already clean (`renderBlockNoteHtml` filters empty paragraphs); the fix is purely editor-surface.

### Design decisions that matter

1. **Pure-structure aside.** No custom chrome in the block's render function. BlockNote's native container pattern handles editing; CSS handles the visual. "Fewer but flexible blocks" in practice.
2. **Color by context, not by instance.** The aside's color is determined by where it appears (document vs lesson vs program), via scope class CSS, not by a per-block prop. Authors don't choose colors; designers do, once.
3. **Single source of truth for insertable blocks.** `editorRegistry.ts` drives both menus. Any future menu surface (keyboard shortcuts, drag handles, command palette) plugs into the same source.
4. **Accept standard rich-text conventions.** Backspace unwraps containers at position 0. That's how every editor works. Documented, not fought.
5. **Invisible functional elements.** Trailing empty paragraph stays for usability but goes visually dark when it would break layout. The editor can look different from the render; what ships is clean.

### What this work connects to

- **`lib/editorRegistry.ts`** — now genuinely the single source of truth for insertable blocks. Four-type model from session 89 is finally being used.
- **`components/RimBlockEditor.tsx`** — got `insertElementAtCursor`, `RimSlashMenu`, `useInsertElements`, and registry-driven menu logic. Removed hardcoded icon imports, dead `insertBlockAfter` bodies replaced by the shared helper.
- **`lib/blockNoteCustomBlocks.tsx`** — aside variant added as a pure-structure block; `ASIDE_BG_COLORS` and `resolveAsideBg` added then removed as the design simplified. Other callout variants unchanged.
- **`lib/renderRichContent.ts`** — aside case added to client-side renderer; output is `<div class="rim-el-note rim-el-note--aside">${body}</div>`.
- **`public/css/custom.css`** — new rules for `.rim-el-note--aside`, `.bn-callout--aside` via `:has()`, `.bear-more-label`, `.bn-suggestion-menu-label`, smart trailing-line collapse.
- **`app/admin/editor-lab/page.tsx`** — sample document updated: aside now contains an H4 + paragraph as children, no separate title prop.

### What comes next

The Aside is the template for the rest of Stage 2d's blocks. The next ones in line — per `UP_NEXT.md` — are Announcement (replaces `Program.specialAnnouncement`), EarlyArrival / PracticalInfo (replaces `Program.earlyArrivalMessage`), and DanaInvitation (replaces on-page `Program.danaMessage`). Each goes through the same four-phase design conversation. The pure-structure aside is the model: custom props only when genuinely needed; CSS handles visuals scoped by context; BlockNote's native container pattern unmodified.

Next session's opening ritual should read this session's log entry, check `/admin/editor-lab` for the aside in action, and pick up Stage 2d block design from the next field sunset.

### Addendum — specialNotes sunset (same day, after closing ritual)

After the main session closed, Jesse said we could remove the Special Notes box from the program page and editor since the Aside now covers that use case. This kicked off the first concrete application of the sunset pattern the four-type model was designed to enable.

**What shipped:**
- `prisma/migrate.mjs` — new migration `fold_special_notes_into_description_as_aside` reads every program with non-empty `specialNotes`, wraps those blocks as the children of a new Aside, prepends the Aside to `description`, and nulls `specialNotes`. Flag-gated, idempotent.
- `app/programs/[slug]/page.tsx` — removed the `.pg-notes` render slot, `hasSpecialNotes` check, and the now-unused `renderFormattedTextAsync` import.
- `components/registrar/ProgramEditor.tsx` — removed `specialNotes` from the `ProgramData` interface, the `useState`, the save payload, and the entire Special Notes `RimProseEditor` field.
- `app/api/programs-pg/route.ts` + `[slug]/route.ts` — stopped accepting `body.specialNotes` on create/update.
- `app/tools/programs/[programSlug]/edit/page.tsx` — removed `specialNotes` from the initialData mapping.
- `public/css/custom.css` — removed `.pg-notes` rules (regular and mobile breakpoint).
- `prisma/schema.prisma` — added a DEPRECATED comment on the `specialNotes` field. Kept for one release as a safety net; removal comes in a later migration.

**Pattern established:** each remaining field sunset (`specialAnnouncement`, `earlyArrivalMessage`, `danaMessage`, lesson quote/prompt fields, etc.) follows the same mechanical steps — data migration that wraps existing content as the appropriate block and prepends/appends into the destination field; render slot removed from the public page; editor field removed; API routes updated; schema comment marks the field deprecated; keep for one release. Roughly 30 minutes per field, verifiable deploy-to-deploy.

**Known issue discovered post-deploy:** the Awakening The Heart program showed two identical Asides on the public page — one from the migration prepend, one from an earlier manual edit (presumably session-90 testing of the Aside block on this program). The duplicate-Aside cleanup is deferred as a backlog item so the fix is captured but not rushed. Proposed fix: a one-time dedup migration that walks each description and removes consecutive-or-identical Aside blocks. Also proposed as future-guard: subsequent field-sunset migrations should scan for an existing matching block before prepending, to prevent this pattern from recurring.

---

## 2026-04-20 (session 89) — Editor system full reorg: four-type model, canonical reference, audit sweeps, registry rewrite, abandoned-module deletion

### The scope shift

Session opened with Jesse asking for a markdown document listing and categorizing every text-editor form on the platform. Three minutes into the first sweep, I flagged drift between `RIM_Editor_Design.md` and the code: `Hub.welcomeBody` used the wrong engine; `hub-announcement` was registered but unbuilt; `Program.specialNotes` was written by an unregistered `RimProseEditor` instance; three surfaces shared the `program-message` context but rendered in different wrappers. Three drift points in one subsystem.

Jesse named the deeper issue: "We went about this project wrong. We should have established all our components and elements, including design elements, first. We've gotten to a point where we've lost track of how everything works together." The conversation pivoted from "list editor forms" to a structural reorg of how authored content is modeled across the platform.

### The four-type model

The old design doc had tiers (1 Message / 2 Document / 3 Feature). Jesse proposed a cleaner taxonomy: **four editor types chosen by purpose, not by tier number**:

1. **Document** — standalone sophisticated document (headings, tables, images, callouts)
2. **Page Designer** — authored content composed from design blocks inside a page template (e.g., program description, lesson body, eventually glossary)
3. **Message** — general communication (prose + lists, no headings or images) — the most common editor
4. **Form Field** — inline-only rich input (bold/italic/link)

Plus one acknowledged outlier: `MarkdownEditor` for email templates, kept until a BlockNote-to-email-safe renderer is built.

Alongside the types, a core distinction: **template data** (structured fields that drive features — dates, category, capacity) stays as DB fields, while **authored content** (prose, voice, teaching) lives in an editor. The Page Designer's design-element blocks (Pull Quote, Practice Suggestion, Note, and future SpecialNote / Announcement / EarlyArrival / DanaInvitation) absorb several fields that currently exist as top-level hard-coded template slots.

### The persistence architecture

Jesse asked how we keep this from drifting again six months from now. Named three layers of persistence, each with a different job:

- **Project documents** (`RIM_*.md` in the repo) = shared memory. Where design decisions live.
- **Claude memory files** (`~/.claude/.../memory/`) = Claude's working standards for collaboration with Jesse. Not where design decisions go.
- **`CLAUDE.md`** = the gate. Forces Claude to consult the right project document before editor work (via the Design Orientation table) and requires updating the doc when editor code changes (via the Closing Ritual).

The terminal layer, deferred to Stage 2d, is a **code-level gate**: an `<EditorField type=... placement=.../>` wrapper that refuses to mount without a registered placement. Discipline is fragile; a compiler error is durable.

### What was built

**Canonical reference + gates:**
- Created `RIM_Editor_Types.md` (project root) as the new canonical reference. Defines the four types, template-vs-content distinction, output destinations (web template / interactive web / transactional email), block library concept, four-phase block creation procedure, lock-in rules, placement registry.
- Updated `CLAUDE.md` Design Orientation table: editor work now reads `RIM_Editor_Types.md` (replacing the old `RIM_Editor_Design.md` reference).
- Updated `CLAUDE.md` Closing Ritual: any editor / block / placement change requires updating `RIM_Editor_Types.md` before commit.

**Stage 1 — inventory (five sweeps):**
All live in `editor-audit/`:
- `01-prisma-fields.md` — 42 text-bearing Prisma fields classified
- `02-sanity-schemas.md` — remaining Sanity types classified (`teams`, `magazineArticles`, `glossary`, `volunteerPositions`, plus dead queries)
- `03-hub-surfaces.md` — every hub editor placement (conversations, tasks, documents, schedule, admin)
- `04-admin-tools.md` — program/lesson/course/member/support/manual/banner/email-template editors
- `05-public-content.md` — every public and member-facing render site

**Stage 2a — registry rewrite (non-user-visible):**
- `lib/editorRegistry.ts` rewritten around the four-type model. Added `EditorType` union and `PLACEMENT_TYPE` map. Reorganized helper arrays (`DOCUMENT_PLACEMENTS`, `PAGE_DESIGNER_PLACEMENTS`, `MESSAGE_PLACEMENTS`, `FORM_FIELD_PLACEMENTS`).
- Renamed `variant="document"` → `variant="dense"` in `RimProseEditor` (the old name conflicted with the new Document *type*; "dense" describes toolbar density). Three callers updated: `HubAdminForm` (×2), `HubTasksClient`.
- Removed `hub-announcement` from the registry. Feature was retired in session 72 (announcements became pinned conversation threads); the registry entry was stale.
- Populated the Placement Registry section in `RIM_Editor_Types.md` — every current placement listed with its component, schema field, output destination, output wrapper, and route.

**Stage 2b — registry additions (declarations of intent):**
Five new placements added to the registry; schema wiring pending Stage 2d:
- `support-note` — internal support note (distinct from outgoing reply so future features can diverge safely)
- `support-template` — reusable reply body
- `sub-claim-message` — claimer's message back to the original host (field exists; UI pending)
- `teacher-bio` — public teacher profile bio (schema promotion from `String?` pending)
- `course-completion-note` — series completion message (schema promotion pending)

**Stage 2c — deletions:**

Abandoned session-reflection module (confirmed pre-launch with no real data to preserve):
- `SessionAttendance`, `SessionReport`, `SessionCoHost`, `SessionCoHostReport` models removed from `prisma/schema.prisma`
- `PostSessionAction` enum removed
- All related User and Program relations removed
- Migration `drop_session_reflection_module` added to `prisma/migrate.mjs` — runs on next Vercel deploy, drops all four tables and the enum via `DROP ... CASCADE`
- `/api/attendance/join/route.ts` route deleted entirely
- Attendance fetch calls removed from `app/session/[slug]/page.tsx` and `components/VideoRoomEmbed.tsx`
- Stale comments cleaned up in `lib/email.ts` and `app/api/admin/members/[id]/route.ts`

Sanity cleanup (`teams` deprecated by Postgres `TeacherProfile`, `magazineArticles` to be designed fresh when needed):
- `app/team/[slug]/page.tsx` deleted
- `app/magazine-articles/[slug]/page.tsx` deleted
- `components/TeacherList.tsx` deleted (only used in style guide; replaceable with Postgres-backed version when needed)
- `app/style-guide/page.tsx` cleaned — TeacherList import + demo sections removed
- `app/volunteer-positions/[slug]/page.tsx` — "Current Volunteers" section removed (linked to deleted `/team/[slug]`). Section will return post-migration in Stage 2d, linking to Postgres `/teachers/[slug]` via User relation.
- `lib/queries.ts` trimmed from 10 Sanity queries to 4 — removed `teams*`, `lesson*`, `course*`, `magazineArticle*`, `programsLinkedToCourseQuery`, `allCoursesWithLinkedProgramsQuery`. Kept `glossary*` and `volunteerPosition*` (both still active; both Stage 2d migration targets).
- Historical one-time migration scripts deleted: `prisma/migrate-programs-from-sanity.ts` and `prisma/migrate-to-blocknote.ts`. Both referenced deleted models; git history preserves logic if needed.

### Live behavior change Jesse should know

The site builds and all editors function identically. One consequential behavior change on deploy: **attendance records stop being saved when members join LiveKit sessions.** The `/api/attendance/join` call was the only writer of `SessionAttendance`, and it's gone. No other feature depended on these records being written. Hosting / sub-request / sub-claim flow unaffected — those are separate schema (`HostAssignment`, `SubRequest`, `SubClaim`).

### What this connects to

- **Editor architecture** — every authored-content surface in RIM now has a canonical classification (four types) and a registered placement. The Page Designer pattern (design-block composition inside a page body) is the design-system backbone going forward.
- **Program + Lesson data models** — several top-level fields on these models are marked for sunset into Page Designer blocks (Stage 2d). When that lands, the schema shrinks and authoring becomes author-driven rather than template-slot-driven.
- **Hub system** — confirmed unchanged. `hub-announcement` was only a ghost entry; the hub's conversations + pinned threads + tasks + documents + schedule are all correctly placed under the four-type model.
- **LiveKit sessions** — video session experience is unchanged, but attendance tracking is removed. When attendance becomes a real feature, it'll be designed and built fresh.
- **Email system** — `EmailTemplate` stays on `MarkdownEditor` as an acknowledged outlier. When BlockNote-to-email-safe rendering becomes a priority, that's when the outlier folds in.
- **Future Glossary / Volunteer Position pages** — both are on the Stage 2d migration list. Glossary becomes the third Page Designer placement; Volunteer Position gets a Message editor.

### What comes next

Stage 2d, in its own focused session. Scope:

1. **Schema promotions** — `TeacherProfile.bio: String? → Json?` + `Course.completionNote: String? → Json?`, with data migration converting existing text to BlockNote paragraph blocks, component rewrites (TeacherSection, CourseEditor, MarkCompleteButton), and CSS wrappers (`rim-content tp-body`, `rim-content crs-completion-note`).
2. **First Page Designer block** — design and build **SpecialNote** through the four-phase procedure. This becomes the template for the rest.
3. **Additional blocks** — Announcement, EarlyArrival, WhatToBring, DanaInvitation (each through the procedure).
4. **Field → block migrations** — Program's specialNotes, specialAnnouncement, earlyArrivalMessage, pullQuote pair, on-page danaMessage. Lesson's headerQuote pair, reflectionPrompt.
5. **SubClaim.message UI** — small wire-up to the existing schema field.
6. **Sanity migrations** — glossary → Postgres (Page Designer), volunteerPositions → Postgres (Message).
7. **Terminal code-level gate** — `<EditorField type=... placement=.../>` wrapper that makes the registry a compile-time gate.



### What was built and changed

Four distinct threads this session, each of which ended up depending on the one before it.

**1. Neon compute crisis and permanent cron removal.** Site came up fully offline at the start of the session. Every Prisma-backed page returned 500 — `/community-programs`, `/this-week`, `/teachers`, `/courses`, `/manual`, `/programs/[slug]`, `/api/auth/session`. Vercel logs all pointed at one Prisma error: `Can't reach database server at ep-super-pine-ai6ujd7t-pooler.c-4.us-east-1.aws.neon.tech:5432`. Neon console showed the project had blown past the Free-tier 100 CU-hours/month cap (110.19/100 on 2026-04-19, 12 days before the monthly reset), and the endpoint had been disabled as a quota enforcement.

Root cause was the `/api/cron/support-sync` cron firing every 5 minutes, 24/7, through `vercel.json` — 288 DB hits per day that kept the compute continuously active so scale-to-zero never engaged. Math lined up: compute running 24/7 at `.25 CU` = 6 CU-hrs/day, observed rate was 5.8 CU-hrs/day.

Fix was in two parts:
- Upgraded Neon to Launch via the Vercel Marketplace (pay-as-you-go, no flat fee, metered at $0.106/CU-hr). Site came back within a minute of plan upgrade.
- Removed the 5-min cron entry from `vercel.json` entirely. The Support Inbox already has a manual "↻ Sync Gmail" button at `components/SupportInboxClient.tsx:858` (calling `POST /api/support/sync` with a 30-second per-user rate limit). That's sufficient for the current stage of the feature — the inbox is not yet staffed by volunteers, so real-time polling provided no user-visible benefit and only compute cost. The `/api/cron/support-sync` route file stays in the tree so a schedule can be restored with one `vercel.json` entry when the feature actually launches.

**2. Host Schedule tool redesign (`/tools/schedule`).** The previous layout fired a saturated red Claim button on every unclaimed row — on a busy month that reads as "crisis everywhere," which is the opposite of what a volunteer arriving on the page needs. A month-grid mini-calendar showed 7-pixel dots with a separate legend strip to decode them, and clicking a day smooth-scrolled the list rather than filtering it, so calendar and list were doing duplicate work rather than one serving the other.

Rebuilt as one coherent view:
- **Interactive status sentence** replaces the three-way filter pill row. "3 sessions this month need a host. You're hosting 5." Both counts are clickable filter pills; a "Show all N" clears.
- **Event-pill calendar** (`hub-cal2`) with cells ~96px tall showing up to three abbreviated program name pills per day, color-coded by status. Three pills + "+N more" if a day has more. At mobile (<768px) pills collapse to thicker colored bars (14px × 4px) so the grid stays legible at phone widths.
- **Day click filters the list**. Click April 19 → "Showing 3 sessions on Saturday, April 19 · Show whole month →" banner appears, list below filters to that day. Click the day again or the banner link to clear.
- **Today** is marked with a filled blue circle around the day number (Google Calendar pattern). The earlier 4%-opacity blue tint was invisible; the circle is unmistakable.
- **Intuitive color semantics.** After a back-and-forth iteration, landed on: orange (`#d9840f`) for no host yet, red (`#c44a20`) for sub needed (urgent, teammate stepping back), green (`#5a9960`) for covered, blue (`var(--rim-blue)`) for yours, and red-bg-with-blue-border for "yours + sub requested" (mine-sub). Applied across calendar pills, mobile bars, list card left-borders, status sentence pills, legend swatches, action buttons, and the detail panel primary button.
- **Card-border unification.** Previously a 3px colored stripe on neutral-gray borders read as a sticker applied to the card. Now the whole card outline picks up a washed tint of the state color — e.g., needs-host cards have `#ecd9a6` on three sides + `#d9840f` stripe on the left, hover deepens the whole border toward the accent.
- **Card typography conforms to Messages Hub pattern.** Was using `var(--text-small)` 15px for titles; Messages Hub rule (`.hub-conv-row__title`) is `var(--text-h4)` 20px serif at 400 weight, 1.3 line-height. Schedule cards now match. Program names carry real visual weight as the primary content of each row.
- **Legend** reappeared as a five-entry color key: No host yet / Needs a sub / You're hosting / You asked for a sub / Covered.
- **Distinct mine-sub state.** Previously when you requested a sub on your own session, nothing visually changed — same blue card, same "You're hosting" label. Now the card gets a cream background, a "Sub requested" amber chip next to the program name, and the host line reads "Asking the team to cover." Calendar pill becomes red-bg + blue-border (same two-signal pattern).
- **Plain-language copy throughout.** "Claim This Session" → "I'll host this session." "Cover This Session" → "I can cover this session." "Request Sub" → "Ask someone to cover for me." "Remove Myself" → "Remove myself." "Needs Coverage" → "No host yet." Host label sentences instead of bureaucratic vocabulary.

**3. Sub-request submit bug (critical).** The `submitSubRequest` function called `message.trim()` on the RimProseEditor value. That value is BlockNote JSON (an array of blocks), not a string — `.trim()` threw a TypeError, the Promise rejected, the SessionDetail submit `onClick` handler had no try/finally, and `setSubmitting(false)` never ran. Button stuck on "Sending…" forever. And the POST never reached the server, so no team notification went out. Jesse hit this on his first real sub-request test.

Fix: `submitSubRequest` now accepts message as `any`, returns `Promise<boolean>`, uses `extractBlockNoteText()` to detect empty content and send `null` to the API, wraps the fetch in try/catch, and the submit button's onClick uses try/finally to always reset submitting state. Also captures the returned `subRequestId` from the POST response so the "I can cover" button appears correctly for other users without a page reload.

**4. Sitewide mobile viewport fix and Host Schedule mobile pass.** Jesse sent a screenshot showing the entire hub layout rendering in desktop width on his iPhone — sidebar still occupying its 260px, hub mobile bar not appearing, content squeezed. Root cause was dead-simple and embarrassing: `app/layout.tsx` had no viewport meta tag. Mobile browsers were rendering every route at ~980px desktop width and pinch-zoom-scaling to fit. Every `@media (max-width: 768px)` rule in `custom.css` had silently been ignored on mobile — not just in this session, but since the app was built.

Added `export const viewport: Viewport = { width: "device-width", initialScale: 1 }` to the root layout (Next.js 15+ Metadata API form). Also switched `.hub-ws-layout` from `display: flex` to `display: block` at <=900px as defensive belt-and-suspenders, so there's no flex context in which the position-fixed sidebar could possibly push the main column.

With viewport working, finished the mobile-friendliness pass: 44px min-height touch targets on every card/detail/nav button, iOS auto-zoom fix (`.fi`, `.ft`, `.fs` form inputs bump to 16px at <768px), chrome compression on mobile (toolhead 22→18, status margin 20→14), thicker calendar bars, stack detail-panel actions vertically so each button is full-width, full-width card button on stacked layout.

**5. Two-tap confirmation pattern for claims.** Once mobile was working, Jesse's next concern was accidental taps while scrolling past cards — a finger brushing "I'll host" could commit before he knew what happened. Plus the detail panel showed a duplicate "I'll host this session" button, producing two primary actions on screen at once. Built a two-tap confirm:
- First tap on "I'll host" or "I can cover" → button darkens to its committed color, label becomes "Tap to confirm," a 5px countdown bar animates across the top over 4 seconds, and a gentle brightness pulse (1.2s) runs on the whole button. A Cancel link appears beneath.
- Second tap within 4s → commits.
- Inactivity or Cancel → reverts to idle.

Same pattern applied to both the card-level and the detail-level primary buttons. Only one is ever on screen — when the detail expands, the card-level button hides. Cancel link on mobile is a 44px-tall tappable area (was a 20px text link). The bar starts at the top of the button rather than the bottom so the user's eye already lands on it while reading the label.

**6. Horizontal scroll lockdown.** Jesse reported slight horizontal play at the right edge on his phone. Added `overflow-x: hidden` on `html` (universal browser support fallback) and `overflow-x: clip; max-width: 100%` on `body` (newer Safari/Chrome, preserves `position: sticky` on descendants). Card titles get `overflow-wrap: anywhere; min-width: 0` so long program names break gracefully inside the card rather than pushing the row wide.

### Design decisions

- **Red isn't always bad.** The first redesign pass avoided red entirely because the original layout had 25+ red Claim buttons that read as "crisis everywhere." Jesse pushed back: red *should* mean urgent when sub-needed *is* urgent (a teammate stepping back from a commitment, team needs to act), and orange *should* mean attention when unclaimed is a standing need. The intuitive-color pass (orange/red/green/blue) is more honest than the muted teal/amber/grey it replaced. Color semantics should match emotional semantics.
- **One dominant action per state.** The card-level and detail-level primary buttons both claimed the session. With both visible when a card expanded, the user saw two identical "I'll host" buttons — confusing, and violating the "one dominant action per state" rule. The card button now hides when the card expands, so only one primary is ever on screen at a time.
- **Two-tap over modal confirmation.** For safeguarding an action that's easy to mis-trigger but cheap to undo, a two-tap arm-then-commit pattern is calmer than a modal confirmation. It's the same pattern iOS Mail uses for swipe-to-delete + undo. Doesn't interrupt flow; doesn't add a layer of UI. Pulse + countdown + cancel link together make the armed state obvious on any screen size.
- **Calendar cells show event names, not dots.** Dots required a separate legend strip to decode and gave no hint of *what* was scheduled that day. Colored pills with abbreviated program names carry both meanings at once (what + status). Truncation is a real cost — long program names lose their tails — but the tradeoff is worth it. If truncation becomes a pattern problem, add a `shortName` field to `Program` rather than go back to dots.
- **Typography conformance matters.** Mixing public-site editorial body (`var(--text-body)` 18px, 1.7 line-height) into admin/tool surfaces makes tool pages feel like they're shouting. Adding `font-size: 16px; line-height: 1.55` to `.hub-ws-main` aligns the tool shell with `.admin-ui` / `.ac-layout` per the RIM spec. Card titles at `var(--text-h4)` 20px serif match `hub-conv-row__title` across the Messages Hub, so the whole hub area reads as one design system.
- **Manual sync beats cron for unstaffed features.** A 5-minute cron is premature optimization for a feature without live users. When the Support Inbox launches to volunteers, the cron schedule can be restored with one `vercel.json` entry — right now the manual sync button is the sufficient path.

### What this connects to

- **All pages on the site** — the viewport meta fix changed mobile rendering for every route under `app/layout.tsx`. Public pages (homepage, `/community-programs`, `/this-week`, lessons) were also rendering at 980px desktop width on phones. They'll now use their existing mobile styles for real. Worth a visual pass to confirm none of them broke.
- **All hub tools** — `.hub-ws-*` chrome (sidebar, mobilebar, workspace shell) is shared across `/tools/schedule`, `/tools/inbox`, `/tools/programs`, `/tools/learning`. The mobile breakpoint overhaul, the `display: block` at <=900px, and the admin typography conformance on `.hub-ws-main` all apply to every tool.
- **Support Inbox feature** — the cron removal changes its operating model. The inbox now only syncs on explicit user action via the `↻` button. When it eventually launches to volunteers, the feature owner needs to decide whether to restore the cron (at what cadence — 15 or 30 minutes is a good balance) or keep the manual pattern. Noted in backlog.
- **Neon + Vercel billing** — the project is now on the Launch plan via Vercel Marketplace. Metered, no flat fee. Next month's bill should drop substantially with the cron gone; at current pace (no other 24/7 processes) compute usage should be in the 10–30 CU-hr range, roughly $1–4/month.
- **Host Team volunteers** — the schedule redesign changes workflow. Volunteers will see a new color language (orange for open slots, red for sub requests), a new confirmation pattern on Claim buttons, and new plain-language labels. The Host Team Hub coordinator should notify volunteers that the tool looks different.
- **`HostAssignment` / `Program` / `SubRequest` data layer** — unchanged. The redesign is cosmetic over existing behavior. Claim, unclaim, sub-request, cover-a-sub all use the same API routes with the same semantics.

### What comes next

- **Other hub tool pages** (`/tools/inbox`, `/tools/programs`, `/tools/learning`) and internal hub pages (Conversations, Tasks, Documents, Members) haven't been mobile-audited. With the viewport meta now in place, they'll at least render at phone width — but each needs its own visual pass for touch target sizing, card layout at narrow widths, and text-input 16px.
- **Public pages mobile verification** — homepage, `/community-programs`, `/this-week`, `/teachers`, `/courses`, `/programs/[slug]`, `/lessons/[slug]` should all be re-tested on mobile now that the viewport meta fires their media queries.
- **Optional `shortName` field on `Program`** — calendar pills at 12px truncate 18+ character names. A `shortName` on the Program model would let admins set "Private Teacher" or "Silent Meditation" as the pill-display name. Low priority; added to backlog.
- **Support Inbox launch** — when the Support Hub is actually staffed, restore the cron in `vercel.json` with a sane interval (15 or 30 min) and re-verify Neon compute stays under the monthly threshold.

---

## 2026-04-17 (session 87) — Editor architecture: FormatPill, Element Registry, scope system, five distinct editorial elements

### What was built

A multi-stage rebuild of the rich-text editor system. The goal was to make the editor feel like one tool across every surface while letting each surface render its own design language — document pages stay utilitarian, lesson pages bloom into full editorial treatment, program descriptions sit in between.

1. **FormatPill + Element Registry foundation** — a single floating toolbar replacing per-surface chrome. One pill everywhere; one registry (`lib/editorRegistry.ts`) that the pill's "+" menu, the slash menu, and the block-handle "Turn into" all read from. Adding a new element is one registry entry listing every context it belongs to.

2. **Scope plumbing at every render callsite** — every rendered-output wrapper now carries a third class alongside `.rim-content` and its context class: `.rim-content--document`, `.rim-content--lesson`, or `.rim-content--program`. Surfaces updated: `app/lessons/[slug]/page.tsx`, `app/programs/[slug]/page.tsx` (description + special notes), `app/course/[slug]/page.tsx`, `app/account/hub/[slug]/documents/[id]/page.tsx`, `app/admin/manual/[slug]/page.tsx`, `app/admin/editor-lab/page.tsx`, `app/account/programs/[slug]/page.tsx`, `app/admin/manual/editor/page.tsx`. This lets a single element's CSS produce three visual treatments from three scope modifiers without duplicating the class trees.

3. **Callouts reduced to Note + Decision** — the old six-variant Callout (note / info / warning / decision / practice / reflection) was replaced in the picker with just Note and Decision, each a distinct editorial choice. Legacy variants still deserialize from the DB so archived content renders; only the picker exposes the two kept roles.

4. **Five distinct editorial elements** — rebuilt the dharma group as five elements with their own visual identity rather than variants of one Callout:
   - **Pull Quote** — inline single-quote block (content + attribution prop)
   - **Verse Quote** — inline single-quote block with serif italic (content + attribution prop)
   - **Practice Suggestion** — container block with "PRACTICE" eyebrow, title prop, and block-level body via children
   - **Reflection** — container block with italic question lead-in prop and block-level body
   - **Note** (Callout) — container block with Note/Decision variants and title prop

5. **Container-body defensive seeding** — on load, any `callout` / `practiceSuggestion` / `reflection` block missing children gets a default `{ type: "paragraph" }` child injected. Stray `content: []` fields on `"none"`-content blocks are stripped. This fixes the "green box with no editable body" state and ensures the Prosemirror schema always has a valid body slot.

### Design decisions

- **Element Registry is the single source of truth.** The pill, slash, and Turn-Into menu all read it. There is no per-tier or per-context pill logic left. Element availability is declared by listing `availableIn: [...]` per entry.
- **Scope modifiers over context duplication.** Rather than writing five copies of practice-suggestion CSS keyed off `.lp-body`, `.prog-description`, `.hdoc-body`, etc., one base rule plus scope overrides (`.rim-content--lesson .rim-el-practice { … }`) handles all three tiers. This ties the tier system (Message / Document / Feature) to concrete CSS hooks that any renderer can opt into.
- **Distinct elements over callout variants.** The six-variant Callout pattern collapsed too many editorial roles into one blue-box treatment. Splitting Pull Quote / Verse Quote / Practice / Reflection / Note gives each its own visual vocabulary, which matters for dharma content where a "reflection" and a "verse" are fundamentally different reading experiences.
- **`content: "none"` + children for containers.** BlockNote's built-in schema allows inline `content` *or* block `children` but the container-body convention uses `children` for block-level nesting. Container blocks with inline `content: []` can fail Prosemirror's `createChecked`. The defensive-seeding migration guarantees shape at load time.
- **BlockNote `blockToNode` only emits `blockGroup` when `children.length > 0`.** Without a default child, the editor has no `.bn-block-group` sibling to click into — hence "uneditable box". This was the root of the bug Jesse hit testing Practice.

### What this connects to

- `RimBlockEditor` (primary editor component) — now reads the registry for its pill/slash/turn-into and migrates legacy container content on load
- `components/editor/FormatPill.tsx` — selection + empty-line pill; insert seeding uses `CONTAINER_BLOCK_TYPES` to auto-add a paragraph child when inserting container elements
- `lib/blockNoteCustomBlocks.tsx` — factories for `pullQuote`, `verseQuote`, `practiceSuggestion`, `reflection`, `callout`
- `lib/editorRegistry.ts` — context allowlists for all five dharma elements extended to `[...LESSON_ONLY, "program-description"]`
- `lib/renderRichContent.ts` — HTML output for each element, with `CONTAINER_TYPES` set so nested list children group into `<ul>`/`<ol>` correctly
- `public/css/custom.css` — ~400 new lines covering editor view (`bn-*`) and rendered output (`rim-el-*`) for each element, plus scope-aware overrides for `.rim-content--document/--lesson/--program`
- Every lesson/program/manual/hub-document display page picks up the new rendering automatically through its scope wrapper

### Known open issue (not a bug in the code)

Jesse's production browser showed the Practice Suggestion as plain text with no box. Element inspection confirmed the HTML (`div.rim-el-practice` with `__header` / `__body` children, inside `.lp-body.rim-content.rim-content--lesson`) but the Styles panel showed no `.rim-el-practice` rule matching — only `.lp-body` and `.rim-content`. Box Model showed zero margin. This is a stale-CSS / cache problem — the CSS at `public/css/custom.css:21055` is committed and served, but the browser has an older sheet. Hard reload / empty cache will resolve. Not a code fix.

### What comes next

- Verify scope styling on program-description (program detail page) and document tier (hub document / manual) once Jesse hard-reloads and the Practice box renders
- Consider migrating the Program `specialNotes` field into an inline Note block inside the description body (Jesse's observation — the separate "Special notes" section is redundant once Notes are first-class within the description)
- Potentially expose Pull Quote / Verse Quote to `program-description` only if it reads well there — currently limited to `[LESSON_ONLY, "program-description"]` in the registry

---

## 2026-04-15 (session 86) — LiveKit video session comprehensive overhaul

### What was built

Complete rewrite of the virtual session room UI and functionality:

1. **Custom conference layout (RIMConference)** — replaced LiveKit's `<VideoConference>` with a custom layout: `LayoutContextProvider` + `GridLayout`/`FocusLayout` switching, toolbar, chat sidebar, raised-hand banner, participants panel, settings panel.

2. **Chat** — `<Chat />` sidebar (300px, dark) with our own header and working ✕ close button. LiveKit's built-in close dispatched to internal state we don't use, so we hide their header and render our own.

3. **Focus/pin layout** — hover any tile to reveal a pin button (top-right). Click to switch from grid view to focus/speaker view (pinned participant large, others in carousel). Click again to unpin.

4. **Nonverbal signals** — ✋❤️🙏✓✗ buttons in toolbar. Badges render top-left of the participant tile at 44px with dark pill background. Reactive via `useParticipantInfo({ participant })` subscribing to `participantInfoObserver`.

5. **Raised-hand banner** — yellow strip below toolbar showing who has their hand up. Visible without opening the participants panel. Host gets "View" button to open the panel.

6. **Presence photo / avatar** — upload from Settings panel, saved to DB via PATCH /api/account/avatar, broadcast via participant metadata. Server-side: avatar baked into JWT token metadata so it's present on connect (no client-side race condition). Renders as centered rounded square (50% tile height, 16px radius). Grey silhouette hidden when avatar is present.

7. **Dark header** — `vs-header` changed from white (#fff) to dark (#1a1a1a) so it matches the video area. All buttons updated for dark theme.

8. **Audio playback prompt** — Safari blocks audio until user interaction. Replaced LiveKit's cryptic "Start Audio" pill with a full-screen overlay: "🔊 Tap to enable audio" with explanation text.

9. **Echo cancellation** — hosts get `echoCancellation: true` while keeping noiseSuppression off for music quality.

10. **Mute All + per-participant mute** — server-side via RoomServiceClient. Mute All in header, individual mute in participants panel.

11. **Participant name** — forced visible with `!important` overrides, 16px/500 weight, darker background pill. LiveKit tile forced to fill wrapper (width/height 100%).

### What was removed

- Background blur (WASM unreliable in Vercel/Safari)
- Brightness/contrast processor (canvas approach broken, CSS filter was poor quality)
- `BrightnessProcessor.ts` is now dead code (could be deleted)

### Design decisions

- **trackRef.participant, not useMaybeParticipantContext()** — GridLayout only provides TrackRefContext, NOT ParticipantContext. This was the root cause of avatars and signals never rendering. Fixed by getting participant directly from the track reference.
- **Avatar in JWT metadata** — client-side `setMetadata()` had a race condition on connect. Baking it into the token eliminates the timing issue entirely.
- **Own chat header** — LiveKit's Chat component has an internal close button that dispatches to `layoutContext.widget.state.showChat`, but we manage chat visibility with our own `chatOpen` state. Hiding their header and adding our own was the clean fix.
- **CSS !important on placeholder hide** — LiveKit's CSS specificity chain for `.lk-participant-placeholder` was too strong for normal selectors. `!important` was necessary.

### What this connects to

- `/session/[slug]` page — the main session page that renders VideoRoom → RIMConference
- `/api/livekit/token` — now seeds avatarUrl into JWT metadata
- `/api/livekit/mute-all`, `/api/livekit/mute-participant` — server-side mute APIs
- `/api/account/avatar` — PATCH endpoint for saving avatar URL
- `lib/livekit.ts` — `createRoomToken()` now accepts optional metadata parameter
- `prisma/schema.prisma` — User.avatarUrl field
- Dashboard "Join" button → `/session/[slug]` flow
- Host assignment system (determines who gets roomAdmin in token)
- ProgramTeacher system (also grants roomAdmin)

### What comes next

- Test with multiple participants (most testing was solo)
- Verify pin/focus layout works with 2+ people
- Verify raised-hand banner shows for remote participants
- Add a manual section for "Virtual Sessions" in the Volunteer Manual (DB-driven, needs manual section creation)
- `BrightnessProcessor.ts` can be deleted (dead code)
- Consider: auto-pin the speaking participant (active speaker detection)

---

## 2026-04-15 (session 84–85) — Community Programs redesign + This Week page

### What was built

**1. Community Programs page redesign (`/community-programs`)**
- Full redesign with `pl-` CSS prefix
- Teal hero (`rim-section--teal`) with bodhi-leaves background image (`Bodhi-Leaves.jpg`) and semi-transparent overlay — matches original Webflow template
- White pill CTA button in hero
- Programs grouped by category (`pl-cat` / `pl-cat__heading` / `pl-list`) using database `sortOrder`
- Schedule subtitle built as: `dateText` (preferred) or `buildDateLabel()` (fallback) + `formatTimeRange()` + `programFormat` label — full "Mondays · 9:30–10:30 AM CT | Zoom Only" format
- 52px Quincy CF hero title (explicit override of `--text-h1`)
- Category headings at `--text-h2` (28px), aligned with card left edge

**2. ListRow component redesign (`components/ListRow.tsx`)**
- All Webflow class names replaced with `lr-` prefix
- `lr-row` (card), `lr-info` (text block), `lr-name` (title), `lr-schedule` (subtitle), `lr-btn` (teal pill CTA)
- Specificity fix: `.lr-row .lr-name` and `.lr-row .lr-schedule` to beat `.rim-section--grey p { margin: 0 0 18px }` global rule

**3. `lib/scheduleUtils.ts` (new shared utility)**
- Extracted schedule helpers from `app/tools/schedule/page.tsx` to shared lib
- Exports: `isOccurrenceOnDate()`, `ctDateStr()`, `shiftToDate()`, `weekStart()`, `ScheduleProgram` type
- Used by both `/tools/schedule` and the new `/this-week` page
- `app/tools/schedule/page.tsx` updated to import from shared lib

**4. "This Week at RIM" page (`/this-week`)**
- Dynamic server component, `force-dynamic`
- Queries all active (non-archived, non-hidden) programs
- Groups programs Mon–Sun by running each through `isOccurrenceOnDate()` for the week's 7 date strings
- Sorts within each day by `startDatetime`
- `?week=next` query param shifts to next week
- Schedule line uses `timeText` (manual override) → `formatTimeRange()` (computed from datetimes) — no day name, already grouped by day
- "This Week / Next Week" toggle pill nav in hero
- "Schedule is subject to change." footer note
- Reuses `pl-cat`, `pl-list`, `lr-row`, `lr-btn` classes from programs list — visually identical
- `tw-` prefix for hero-only elements (hero, title, subtitle, range, nav buttons)

**5. Nav Programs dropdown (`components/Nav.tsx`)**
- Added Programs dropdown in both public desktop and member desktop nav (same `nav__dropdown` pattern)
- Links: "All Programs" → `/community-programs`, "This Week's Schedule" → `/this-week`
- Added to mobile nav in both public and member sections

### Design decisions

- **`dateText` preferred over `buildDateLabel()`** — `buildDateLabel()` generates specific dates ("Tuesday, April 14") for recurring programs that lack recurrence DB fields. `dateText` stores the human label ("Mondays"). Always prefer `dateText` first, fall back only if null.
- **This Week page reuses programs list styles completely** — no separate card CSS. `pl-cat`, `pl-list`, `lr-row`, `lr-btn` are shared. Only the hero needs `tw-` overrides.
- **52px hero titles** — both programs list and this-week pages use an explicit `font-size: 52px` override (not a token). This was a deliberate design choice matching the Webflow original; tokens cap at `--text-h1: 38px`.
- **CSS specificity rule codified** — `.rim-section--grey p { margin: 0 0 18px }` is a global trap. All component paragraph styles inside grey sections must use doubled-class selectors. Added to permanent memory.

### What this work connects to
- **`/tools/schedule`** — shares `lib/scheduleUtils.ts`. Any changes to `isOccurrenceOnDate()` affect both the host calendar tool and the public this-week page.
- **Programs database** — `dateText`, `timeText`, `startDatetime`, `endDatetime`, `programFormat`, `recurrenceFreq/Interval/Days/Count` all drive the schedule display. Missing `dateText`/`timeText` values cause degraded display (specific dates instead of recurring labels).
- **Nav component** — Programs dropdown added to all four nav contexts (public desktop, public mobile, member desktop, member mobile).
- **Community programs page** — same `lr-row`/`lr-btn` cards as the this-week page. Any change to ListRow CSS affects both.
- **Backlog** — "Program dateText/timeText Data Cleanup" added as medium priority (data must be filled via Program Editor for full schedule display quality).

### What comes next
- Fill `dateText` / `timeText` for all live programs via Program Editor (backlog item `2026-04-15-001`)
- Redesign remaining legacy pages (Donate, Volunteer, Community Membership, Login) — backlog item `2026-04-15-002`
- Homepage visual review (all 10 sections)
