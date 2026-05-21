# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### Session 124 (2026-05-25) — LiveKit hardening shipped; verification pending on deployed site

Five commits on `main`. The Step-In bug Jesse reported in real-world use is fixed, the Krisp pipeline is now observable, the host architecture is the Zoom-style "trust the team" model with three visible role pills, and the operational programs are at audio-profile parity.

**The five commits:**

1. `18a67c9` — Krisp lifecycle instrumentation + attach verify + Step-In host metadata fix
2. `2d0098b` — Zoom-style tier model + three visible role pills (Host / Teacher / Co-host); Co-host net widens to active host-team HubMembers; hub authority gate consolidated
3. `1d0151d` — ProgramTeacher backfill for 5 programs (Jesse on Essential Dharma Study + Meditation and Dharma Talk + Private Teacher Meetings + The Art of Meditation; Maria Sprecher on Qigong at RIM with `isTeacher=true`)
4. `8f00ac1` — Backlog: Silent Meditation Hub + per-program `teacherLabel` dropdown
5. `5b2cd16` — Step-In's 100ms `setTimeout` replaced with actual `Disconnected`-event-wait (5s safety fallback)

See `session-log.md` session 124 entry for the full chronology.

**What testing on the deployed site should confirm:**

1. **`[rim-krisp]` console output in DevTools.** Open Chrome DevTools → Console *before* clicking Join. Filter the console with `[rim-krisp]`. You'll see the lifecycle: `requesting initial enable` → `state: { processorReady: ..., enabled: ..., pending: ... }` → `initial enable returned` (good) or `failed:` (bad — Krisp isn't loading) → `local mic published, scheduling 500ms attach verify` → `verify (500ms after publish): { attached: true|false, ... }`. **The signal to watch is `attached: true` in the verify log.** If true, Krisp is actually filtering audio in production. Also check DevTools Network tab filtered by `wasm` — at least one WASM file should download on first join.
2. **Step-In Host badge propagation.** Have someone Step-In, confirm the Host pill renders on their tile *from your side* (not just theirs). The metadata fix + client-side broadcast should make this immediate, no longer requiring a refresh.
3. **Three pills render correctly.** Host pill on the assigned host (teal). Teacher pill on you when you join one of the four programs you teach (warm gold). Co-host pill on a host-team member who is neither Host nor Teacher (muted slate). A Host who is also a Teacher should show both pills side-by-side.
4. **Maria appears in `/tools/programs/qigong-at-rim/edit`.** Confirm she's listed in the Teachers section and is editable like any other field (the backfill created a real DB record; not hardcoded).
5. **Bell mode actually does something.** Toggle Bell mode during one of your four dharma programs (where you're now on the `teacher` audio profile with NS off). Compare with someone in the room: bells should pass through with their full tone when Bell mode is engaged, and be cleaned up when it's not. Previously, native browser NS was filtering bells at the capture layer regardless of Bell mode state — that's now closed for your programs.
6. **Step-In timing on a slow network.** Lower priority. The previous 100ms `setTimeout` is replaced with a Promise resolved by the actual `Disconnected` event. Should work better on slow networks where the disconnect needed longer than 100ms to complete.

**Known limitations / parked items:**

- **`@livekit/krisp-noise-filter` local install drift** — `npm ls` confirmed the package was missing from local `node_modules` despite being in package.json and the lockfile. `npm install` pulled 52 packages that were missing. Production deploys via `npm ci` so this was a local-only drift; production almost certainly has Krisp. The instrumentation logs will confirm definitively in your next test session.
- **The browser-vs-Zoom audio ceiling** — your A/B comparison (Zoom session right before LiveKit test, same room, same hardware, Zoom handled the echo) confirmed the gap is real. Our wiring is correct for what LiveKit + browser provide; the missing piece is what Zoom does in their native audio engine (long-delay AEC for room-coupling, aggressive residual suppression). No LiveKit AEC processor exists to slot in. Closing the gap from here requires hardware (USB conference device with hardware AEC at the center) or a hybrid (Zoom for sessions originating from the center; LiveKit for individual home participants). The choice is a non-code decision parked for when you're ready.
- **Manual chapter `host-session-room` needs a v6.** The session-122 v5 chapter doesn't mention the three-pill model, the widened Co-host net, or the Bell-mode-needs-teacher-profile interaction. Not done this session; queued.

---

### Next priority — Per-program `teacherLabel` dropdown (backlog `2026-05-25-002`)

Small, contained, lights up better behavior immediately. Add a nullable `Program.teacherLabel` field, a dropdown in the Program editor (Teacher / Guide / Facilitator / Instructor + custom), thread through to the token metadata and pill renderer. Mechanism stays the same — a `ProgramTeacher` row still drives the bell-friendly audio profile and still puts the pill on the tile — only the display string varies per program. Should ship before the Silent Meditation Hub so peer-led offerings can carry "Guide" pills when that hub goes live.

Roughly: one new field in `prisma/schema.prisma`, one migration to add the column, one dropdown in `components/registrar/ProgramEditor.tsx`, one prop addition to the data path (token route → page → VideoRoom → RIMConference → metadata → pill), one comment update on ParticipantMetadata.

---

### Then — Silent Meditation Hub (backlog `2026-05-25-003`)

Larger structural piece. New Hub for peer-led offerings (Good Morning / Good Evening Silent Meditation, expandable to Recovery Dharma etc.). Self-claim + standing rotations reuse host-team infrastructure. The new pieces are the Hub record (created via `/admin/hubs`), a coordinator decision about which programs the hub is allowed to claim, and possibly extending `/tools/schedule` to surface open silent-sit sessions alongside host-team ones.

**Open design question parked inside this item's backlog notes:** should the bell-friendly audio profile be granted to *any* Session Host (regardless of ProgramTeacher status)? Would help Nancy on Awakening The Heart and any peer-leader of a silent sit without needing per-row teacher data. Counter-argument: non-teaching session hosts (logistics calls) sound better with NS on. Resolve when this hub or the teacherLabel slice is built.

---

### Smaller items still parked

- **Manual chapter `host-session-room` v6** — describe three-pill model, widened Co-host net, Bell-mode-needs-teacher-profile interaction, the Krisp instrumentation logs (or, after the logs are removed post-verification, just the runtime behavior).
- **The PWA / native-app conversation** — `2026-05-21-001` is explicitly rejected; the architecture decision parked at session 120 stands. Re-litigate only if real signal emerges.
- **`/api/livekit/token` server-side time gate** — backlog `2026-05-24-002`. Direct URL access to `/session/[slug]` is currently ungated.
- **Rate-limit `/api/auth/callback/resend`** — backlog `2026-05-21-002`. Sign-in code brute-force defense-in-depth.

---

### Session 123 (2026-05-25) — Course offering model: full build shipped

Six commits on `main`. The Course offering architecture from `RIM_Offering_Model.md` (decided session 118) is now real code, end-to-end. Programs and Courses are structural peers — same editor chrome, same dana model, same landing-page shape, same content vocabulary.

**The six commits:**

1. `0c996fd` — Magic-link → sign-in-code doc sweep
2. `927a804` — Schema slice (orthogonal flags + landing fields + backfill migration)
3. `6951694` — Access helper (`lib/courseAccess.ts`) + read migration + public landing page
4. `f4d8534` — CourseEditor first surfacing (superseded by slice 5)
5. `40b603b` — Dana self-enroll flow (Stripe Checkout + webhook + receipt email)
6. `363701a` — Dana parity + tabbed editor (8 tabs) + category CRUD + Schedule placeholder

See `session-log.md` session 123 entry for the full chronology.

**What testing on the deployed site should confirm:**

1. **`/course/[slug]` rendering as logged-out** — should show the full landing page (hero, pull quote, description, lesson preview titles, facilitators) with a "Sign in to enroll →" CTA pointing to `/login?callbackUrl=/course/[slug]`.
2. **`/course/[slug]` rendering as logged-in non-enrolled** — landing page with the correct state-aware CTA per the course's flags (free Enroll button / dana picker / "Register for the live cohort" link / role-restriction message).
3. **`/course/[slug]` rendering as enrolled** — existing TOC view (enrollment transitions should be automatic via `router.refresh()` after self-enroll).
4. **CourseEditor at `/tools/learning/[slug]`** — eight tabs, all behaviors working. The Dana tab's four modes (None / Voluntary / Base + Dana / Fixed) with conditional amount fields + the rich `danaMessage` editor. The Categories tab can create, list (with course counts), and delete-when-empty.
5. **Dana self-enroll end-to-end** — create a course with `danaMode="voluntary"` + `suggestedDana=50`; visit `/course/[slug]`; the picker should default to $50. Complete checkout with `4242 4242 4242 4242`; the webhook should create the SeriesEnrollment + Donation row + send the receipt; the success redirect lands back on the course page with the dana banner. Confirm in Stripe test dashboard, in `db.donation` / `db.seriesEnrollment` via Prisma Studio, and that the receipt email arrived.
6. **Fixed-mode dana** — try a course with `danaMode="fixed"` + `danaFixedAmount=300`. The button should show "Enroll for $300 →" with no picker. The checkout endpoint should reject any other amount.
7. **base_plus_dana** — try a course with base=100, suggested=25. The picker should show chips `[$100, $125, $150]`, with $100 as the enforced minimum.
8. **Sign-in code flow** — test the magic-link → sign-in-code language fix in the profile page (`/account/dashboard-my-profile`). The staff manual at `/admin/manual/host-hub-team-management` should self-heal to "sign-in code" wording on the next Vercel deploy.

**Known limitations / acknowledged gaps:**

- **Hero image** is a plain URL field (no upload). Follow the lesson editor's Vercel Blob pattern when ready.
- **Drip release** (Schedule tab) is a placeholder explaining the next slice. See "Next priority" below.
- **The manual chapter `/admin/manual/course-hub`** still describes the legacy 3-tier model and needs a content rewrite for the new orthogonal flags + dana modes + categories. Either edit at `/admin/manual/course-hub/edit` in the admin UI, or write a small migration to update the DB row.
- **The `accessLevel` enum** stays in the schema during transition. The editor derives a coherent value on save. Drop comes in a later slice after production observation confirms no readers remain.
- **Existing courses with `selfEnrollDanaRequired=true`** got backfilled to `danaMode="voluntary"`. Their `suggestedDana` is null until you set one — until then, the picker shows default $20/$50/$100 chips.
- **Categories don't exist yet** in the DB. Create the first one via the Categories tab when you edit your first course.

---

### Next priority — Drip release (Course Schedule tab)

The Schedule tab placeholder in the CourseEditor explains drip release is coming. The real implementation is the natural next slice. **Design decisions to make before code:**

1. **Release model** — relative ("Lesson 2 unlocks 7 days after enrollment") or absolute ("Lesson 2 unlocks Oct 15") or both?
2. **Locked-lesson UX** — hide entirely / show title with "Unlocks in 3 days" countdown / show title + content but block the Complete button?
3. **Email cadence** — notify when each lesson unlocks / weekly digest / disabled?
4. **Onboarding courses** — auto-enrolled members get drip the same way, or full immediate access?
5. **Bundled with a live Program** — drip schedule tied to the Program start date when bundled? Or independent?

**Schema changes the slice would need** (roughly mirroring what was removed in session 100):

- `Course.dripEnabled Boolean @default(false)`
- `Course.dripIntervalDays Int?` — relative-cadence default
- `Course.hideLockedLessons Boolean @default(false)` — UX preference
- `Lesson.releaseDate DateTime?` — absolute release per lesson (override)
- `Lesson.releaseDelayDays Int?` — relative override per lesson

Plus a cron job (likely `/api/cron/drip-release`) that walks enrolled members daily, checks if any lesson has just become available, sends the `drip-lesson-available` email (the template row from the session 100 seed is still in the DB and ready to use — the helper just needs rebuilding in `lib/email.ts`).

Reference `RIM_Offering_Model.md` if/when the doc gets a drip section. The doc doesn't currently address drip — that conversation needs to happen first.

---

### Manual chapter update — `/admin/manual/course-hub`

Still describes the legacy 3-tier access model (`ALL_MEMBERS` / `REGISTRATION_REQUIRED` / `ROLE_REQUIRED`). After session 123 the model is orthogonal flags + four dana modes + categories. Needs a content rewrite that:

- Explains the seven canonical course shapes from `RIM_Offering_Model.md` (Free, Dana self-enroll, Manual grant only, Onboarding, Bundled with Program, Hybrid, Role-locked)
- Walks the coordinator through the new CourseEditor tabs
- Explains the four dana modes with examples
- Documents category creation + assignment

Two paths: edit at `/admin/manual/course-hub/edit` in the admin UI (quick, one chapter), or write a small `update-manual-course-hub-v2.mjs` script with a migration flag (durable, self-healing on future deploys). Lean toward the migration script — it's the same pattern used for the session-119 manual self-heal.

---

### Session 122 (2026-05-20) — LiveKit A/V tuning: Krisp NC + per-profile video bitrate + Bell mode (shipped)

One code commit on `main` (`913def9`) plus a docs commit. All work shipped. No in-progress code.

**What shipped (`913def9`):**

- **Krisp Enhanced Noise Cancellation, default-on for every participant.** New dep `@livekit/krisp-noise-filter@^0.3.4` (had to pick the 0.3.x line because `@livekit/components-react@2.9.20` peerOptional requires `^0.2.12 || ^0.3.0`; 0.4.x conflicted). `RIMConference` uses `useKrispNoiseFilter()` from `@livekit/components-react/krisp`; a ref-guarded effect calls `setNoiseFilterEnabled(true)` once on mount. State is component-local — every new join begins NC-on.
- **Bell mode — Co-host toggle in the control bar.** Visible between Settings and the red End, only when `isCoHost && noiseFilterAvailable` (the latter hidden on browsers where Krisp isn't supported so the toggle never lies about NC state). Tap to flip NC off (amber tint via `--color-alert`, label "Clean voice"); re-tap to return to NC on (default styling, label "Bell mode"). For ringing bells, singing bowls, gongs.
- **Per-profile video bitrate ceilings.** Replaced the flat 2.5 Mbps with profile-driven values: teacher 2.0 / speaker 1.5 / listener 1.0 Mbps. Three explicit simulcast layers `[h180, h360, h720]`. The previous flat ceiling overshot residential-WiFi sustain and produced layer-switch freezes — that's the "choppiness" complaint.
- **Greenroom "Headphones recommended" line.** Sangha-tone framing: "they keep your audio from echoing back to others."
- **Manual chapter `host-session-room` v5.** Bell mode section + headphones note. Migration flag `update_manual_host_session_room_v5`.

**Decisions made this session worth preserving:**

- **LiveKit stays.** Daily.co evaluated and rejected (~$110/mo at RIM scale vs $0–50 on LiveKit; plus the rewrite cost of unwinding the custom-room architecture). Documented in `RIM_Stack_Reference.md` and `RIM_System_Architecture.md`.
- **LiveKit Cloud tier corrected from Ship → Build.** Stack Reference was lying.
- **Bell mode resets at every join.** Deliberate per-bell action, not a persisted preference. A teacher who forgets to toggle back has Bell mode reset automatically on the next session join.

**Three signals to test on the next live session:**

1. Does the external-speaker echo case disappear? Krisp NC should close it for the publisher whose speakers were the echo source.
2. Does the choppiness/freezing settle on residential WiFi? Per-profile bitrates should resolve it.
3. Does Bell mode work in practice? Visual feedback on tap, full bell tone preserved while engaged, return to clean voice on re-tap.

**Confirm Krisp NC usage cost** in the LiveKit Cloud dashboard after the first session — the per-minute rate isn't openly published; estimate was $10–30/mo at RIM scale.

---

### Priority for the next session that isn't follow-up testing — Course offering model build (carried over from session 118, unchanged)

**The Course offering model architecture (`RIM_Offering_Model.md`) is the priority for the next session.** No code has been written for this yet. Sessions 119, 120, 121, and 122 were unrelated detours (Safari permission UX, session-room cleanup, A/V tuning) — see below. Course-offering work resumes from the same starting point session 118 ended on.

**Build order suggestion (from session 118, still applicable):**

1. Schema: add the orthogonal-flag fields and the new content fields to `Course` in `prisma/schema.prisma`. Backfill migration in `prisma/migrate.mjs` mapping the existing `accessLevel` enum to the new flags (rules in `RIM_Offering_Model.md`).
2. Update `MyCourseLibrary`, `/courses` catalog filter, `/api/courses`, `CourseEditor`, and `/course/[slug]` access logic to read the new flags. Leave the enum in place during transition.
3. Build the pre-enrollment landing state on `/course/[slug]` for the six states. Reference `pg-` styles from `/programs/[slug]`; adopt parallel `crs-` styles.
4. Build the dana flow for `selfEnrollDanaRequired` courses (parallel to program registration's Stripe Checkout path; new endpoint).
5. Surface `publishOnPublicCatalog` and the new fields in `CourseEditor`. Decide presets-vs-raw-flags at build.
6. Drop the `accessLevel` enum once all reads have migrated.

**Reference `RIM_Offering_Model.md` before writing any code.** Open questions parked there (pending-dana behavior, `CourseAccess` vs `SeriesEnrollment` boundary, refund/cancellation, editor presets vs raw flags, default fallback for `accessRestrictionMessage`) — resolve as they come up during build, not pre-emptively.

---

### Session 121 (2026-05-24) — Session room cleanup: three-tier permissions + tile hover-mute + no auto-hide + host early-open (shipped)

Two commits on `main`. All five issues Jesse named from the live test are addressed.

**What shipped:**

- **Three-tier permission model** (`lib/livekitAuth.ts::resolveSessionRole`) replaces the overloaded single `isHost` flag:
  - **Session Host** (singular) = HostAssignment for this exact session OR ADMIN. End-for-All + Share Screen. Only person whose tile carries the "Host" badge.
  - **Co-host** = ProgramTeacher OR HOST_MANAGER OR Session Host, hub-gated. Mute others, Mute All, Share Screen, manage participants. No End-for-All. No badge.
  - **Participant** = everyone else. Mic + camera only via `canPublishSources` at the token; no screen share even if they bypass the UI.
- **Tile hover-mute** — Co-hosts see a red Mute button on hover of any remote tile. "Muted" pill when already muted. Suppressed on local tile.
- **Auto-hide chrome removed.** Chrome stays visible always. JS idle timer + every `.vs-page--idle` CSS rule deleted.
- **Share Screen** hidden for non-Co-hosts in UI; token grant blocks it at the source.
- **End for All** is now Session-Host-only at both the server (`/api/livekit/end-session`) and the UI (`EndMenu`).
- **Host/teacher 10-minute early-open on the dashboard** — assigned host (HostAssignment for today) and ProgramTeacher (and ADMIN) see a distinct "Open early as host" row between `start - 22min` and `start - 12min`. Teal accent. Button reads "Enter as host". `Live opens at X:XX` clarifier. Row collapses to normal Live Now state at `start - 12min`. `DashboardAutoRefresh` honors the new early epochs and chains the transitions automatically.

**Code changes:** `lib/livekitAuth.ts` (new), `components/session/sessionRole.tsx` (new), `lib/livekit.ts`, all five `/api/livekit/*` routes, `app/session/[slug]/page.tsx`, `components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `RIMControlBar.tsx`, `RIMParticipantTile.tsx`, `EndMenu.tsx`, `ParticipantsPanel.tsx`, `app/admin/livekit-test/page.tsx`, `app/account/dashboard/page.tsx`, `components/DashboardAutoRefresh.tsx`, `public/css/custom.css`.

**Manual chapter v4 (`host-session-room`) updated** to reflect the new tier model, tile hover-mute, no-auto-hide, Share-Screen as Session-Host-only, and the early-open window. Migration flag `update_manual_host_session_room_v4` in `prisma/migrate.mjs`.

**No in-progress code.** All work shipped to `main`. Test on the next live session.

**Same-day follow-on (`1c3d019`):** sign-in form was submitting an empty token (`?token=` instead of `?token=123456`), surfacing as `error=Configuration` on `/login/error` with the generic catch-all message. Root cause: hidden token field was uncontrolled with ref-based DOM sync; the ref could drift from state under React reconciliation, iOS autofill, and any race where submission happened before the ref-write landed. Fixed by making the hidden field controlled (`value={boxes.join("")} readOnly`) and disabling the submit button until all six boxes are filled. Auth flow is now reliable; the `Verification` error path (wrong/expired code) now surfaces its real message instead of being masked by the Configuration error.

**Deferred to backlog:**
- Stale-state propagation after Step-In (data-channel "host changed" broadcast → clients re-derive `isSessionHost`). Not a production problem; surfaces only in test scenarios.
- `/api/livekit/token` server-side time gate to match the dashboard's early-open window. Direct-URL access to `/session/[slug]` is currently ungated.

---

### Session 120 (2026-05-23) — Permission UX architectural decision + platform-aware Greenroom/Recovery (shipped)

One commit (`3ffb294`) on `main`. Small code change with a larger architectural moment underneath.

**Architectural decision: the browser-based custom LiveKit room is the committed architecture.** Three alternatives were weighed and explicitly rejected against the demographic (sangha 65+, tech-phobic):

- **PWA install** — iOS install ritual too hard for this audience. *Rejected.* Backlog item `2026-05-21-001` updated to `status: rejected` with reasoning preserved.
- **Native iOS/Android app** — months of work + App Store gates; even initial install is a hurdle. *Rejected for the foreseeable future.*
- **Move sessions back to Zoom** — would unwind sessions 86/117/119's foundational decision to transcend Zoom for this community (HostAssignment, ProgramTeacher, hub-as-authority, magic-code auth). *Rejected.*

**What shipped (`3ffb294`):**

- `lib/detectPlatform.ts` — new client-only helper returning `{ browser, os }` + `defaultsToPerSessionPermission(platform)`. UA-based detection. Handles iPadOS-as-Macintosh (`ontouchend` check) and iOS browser wrappers (`CriOS`/`FxiOS`/`EdgiOS` routed to `ios` before the Mac+touch branch — reviewer-caught bug fix pre-commit).
- `components/session/Greenroom.tsx` — "Set Safari to remember" disclosure now shows for all per-session-permission browsers (Safari macOS *and* iOS *and* iPadOS) with device-matched copy. Hidden on Chrome/Edge/Firefox.
- `components/session/Recovery.tsx` — single primary view matching the detected platform. Six branches (Safari macOS/iOS/iPadOS, Chrome+Edge desktop, Chrome Android, Firefox) + generic-prose fallback. No safety-hatch disclosure (decided session 120 — adding it for everyone reintroduces the noise the matched view removes).

**No in-progress code.** All work shipped. Test on the deployed site once Vercel completes the deploy.

**The Mac Safari permission friction is now a watch-and-listen item.** If members hit it repeatedly in practice, next-best mitigations are: phone dial-in via LiveKit SIP (audio-only fallback that preserves community presence — matches the "tap a phone number" pattern this demographic actually uses), or a stronger Safari-Mac-specific pre-warning. Not built yet — held for real signal.

---

### Session 119 (2026-05-21) — LiveKit Greenroom + magic-code auth (shipped, no in-progress code)

Four commits, all merged to `main`. See `session-log.md` entry for full chronology.

**Greenroom + Recovery (`d2a0008`, fix `8577348`):** pre-prompt screen that primes users before the browser camera/microphone permission prompt fires; denial-state Recovery screen with Safari Mac fix instructions. Auto-skips silently when Permissions API confirms `'granted'`. (Updated session 120: platform-aware instructions for all matched platforms — see session-120 section above.) Component files: `components/session/Greenroom.tsx`, `components/session/Recovery.tsx`. Phase machine inside `VideoRoom.tsx`. CSS: `gr-` prefix in `public/css/custom.css`.

**Auth flow switched from magic link to 6-digit sign-in code (`45e7be4`, expiry tweak `a13b34f`):** users now type a code from their email instead of clicking a link. 30-minute expiry. Templates renamed `magic-link-*` → `sign-in-code-*` (migration deletes old rows). Files: `auth.ts`, `lib/email.ts`, `prisma/migrate.mjs` (two new migration entries), `app/login/page.tsx`, `app/login/check-email/page.tsx`, `app/login/error/page.tsx`. The old `seed_magic_link_email_templates` migration entry is now dead code on fresh installs (creates rows the next migration immediately deletes) — backlog cleanup item.

**Deferred to backlog (still open):**

1. ~~**PWA install.**~~ *Rejected session 120.* See `data/backlog.json` `2026-05-21-001`.
2. **Rate-limit `/api/auth/callback/resend`.** 6-digit keyspace × 30-min window × no IP rate limit = a determined attacker who knows a victim's email could brute-force within the window. Low realistic risk at sangha scale but worth a per-IP or per-email rate limit before this gets meaningful traffic. *(In `data/backlog.json` as `2026-05-21-002`.)*
3. **Cleanup of dead magic-link migration entries.** `seed_magic_link_email_templates` and the magic-link entries inside `organize_email_templates_with_groups_and_helptext` are now dead code (the followup migration deletes the rows they create). Mechanical cleanup. *(In `data/backlog.json` as `2026-05-21-003`.)*

~~**One staff-manual touch-up Jesse should do manually:** `/admin/manual/host-hub-team-management` has a sentence telling coordinators how to direct a new person to create an account, and it still references "magic link."~~ ✅ **Resolved during the magic-link doc sweep (session 123).** Took the migration route after all — added `update_manual_host_hub_team_management_v2` flag in `prisma/migrate.mjs` that re-runs `updateManualHostHubTeamManagement(db)` to push the corrected body to the live DB row on the next deploy.

---

### Session 118 (2026-05-20) — original context, preserved for cross-reference

**(1) Library extraction shipped (commit `6c57073`).** Member home cleanup per the approved plan: courses removed from `/account/dashboard`, onboarding welcome moved to `/account/courses` Library page, "My Programs" → "My Registrations," greeting session count fixed to member commitments only, new `Course.publishOnPublicCatalog` flag added (backfill in `prisma/migrate.mjs`), Course editor toggle wired. Follow-up commit `822029f` removed orphaned `db2-courses-line` CSS rules.

**(2) Course offering model architecture decided — see `RIM_Offering_Model.md`.** Mid-session discussion separated two threads that had been entangled (the cleanup, and the broader question of how Programs and Courses relate as offering types). Two architectural pillars locked in:

- **Schema model: orthogonal flags replace `Course.accessLevel` enum.** New flags: `allowSelfEnroll`, `selfEnrollDanaRequired` (plus existing `requiredRoles`, `isOnboarding`, `publishOnPublicCatalog`). Plus new content fields parallel to Program — `heroImage`, `pullQuote`, `pullQuoteSource`, `danaText`, and a new `accessRestrictionMessage` field for friendly "you can't enter this way" copy. A single Course can now carry multiple acquisition paths simultaneously — the natural shape for a hybrid bundled with a live Program AND available for standalone dana-enroll.

- **UX model: Course detail page becomes a real landing page.** Six-state matrix locked in (not signed in / can self-enroll free / can self-enroll with dana / role-gated without role / bundled-only / enrolled). Layout mirrors `/programs/[slug]` shape — hero + pull quote + description + about-this-course block + CTA + facilitators. Lesson titles shown to non-enrolled visitors. Hybrids show live cohort as primary + standalone as quiet secondary line. Restricted states always show full landing + friendly message — never 404, never one-line wall.

Resolved-live-cohort rule: live path is "active" whenever a linked Program has open registration with a future start; standalone path always-active when `allowSelfEnroll=true`; live messaging just disappears when no Program qualifies. No admin-flip needed.

**No code written yet** — this is architecture-first. The doc is the authoritative reference for the build.

**Next concrete step:** Begin the build. Order suggestion (revise during work):

1. Schema: add the orthogonal-flag fields and the new content fields to `Course` in `prisma/schema.prisma`. Backfill migration in `prisma/migrate.mjs` mapping the existing `accessLevel` enum to the new flags (rules in `RIM_Offering_Model.md`).
2. Update `MyCourseLibrary`, `/courses` catalog filter, `/api/courses`, `CourseEditor`, and `/course/[slug]` access logic to read the new flags. Leave the enum in place during transition.
3. Build the pre-enrollment landing state on `/course/[slug]` for the six states. Reference `pg-` styles from `/programs/[slug]`; adopt parallel `crs-` styles.
4. Build the dana flow for `selfEnrollDanaRequired` courses (parallel to program registration's Stripe Checkout path; new endpoint).
5. Surface `publishOnPublicCatalog` and the new fields in `CourseEditor`. Decide presets-vs-raw-flags at build.
6. Drop the `accessLevel` enum once all reads have migrated.

Reference `RIM_Offering_Model.md` before writing any code. Open questions parked there (pending-dana behavior, `CourseAccess` vs `SeriesEnrollment` boundary, refund/cancellation, editor presets vs raw flags, default fallback for `accessRestrictionMessage`) — resolve as they come up during build, not pre-emptively.

---

**Session 117 (2026-05-19)** — Session room: six-issue fix → Zoom-aligned redesign → A/V quality + auto-hide. Thirteen commits on `main`. Branch `claude/auto-hide-chrome` is the final stop (locally; merged to main and deleted on origin). See session-log entry for full chronology; the volunteer-facing changelog is at `SESSION_ROOM_FOR_VOLUNTEERS.md`.

**What's now live in the LiveKit session room:**

- **Bottom Zoom-style control bar** — icon-stacked-over-label, Lucide SVG icons, two-part Mic + Camera clusters with device-picker chevrons, Reactions popover, red End button with End-for-All + Leave popover. Page header trimmed to Step-In / program name / View toggle + Fullscreen + Help.
- **Three-way audio profile** (teacher / speaker / listener) driving capture flags and publish bitrate (128 / 96 / 64 kbps). H.264 video at 2.5 Mbps / 30 fps. DTX off. Default ~20 kbps was the source of "thin voice" complaints.
- **Custom persistent chat** with direct messages. New `SessionChatMessage` model + `/api/livekit/chat` (GET history, POST persist + dedup). Live via LiveKit data channel. Recipient picker → server-filtered DMs.
- **Custom tile** — Zoom-style nameplate (no pill, white text + text-shadow, mic-off only when muted), active-speaker yellow outline, initials-circle avatar fallback (deterministic muted color hashed from identity), pure-black room background.
- **Speaker / Gallery view toggle** with `useSpeakingParticipants` auto-pin (ref-gated to avoid per-render thrash).
- **Participants panel** sticky Me row, Host pills from token metadata, raised hands floated, per-row mute (host), Mute All footer, search at >10.
- **Device pickers** on mic/cam chevrons + matching Settings sections. Persist to `localStorage` under `rim-livekit-prefs`.
- **Auto-hide chrome** — 3s idle timer, `:has()` overrides for panels/popovers, `:hover` restores, touch never fades.

**Build hardening:** `lib/stripe.ts` lazy-init Proxy so preview builds don't throw on import. Pairs with the session-116 `prisma/migrate.mjs` env-guard.

**Collaboration experiments — promoted from probation:**
- **Plan mode** used twice (six-issue fix, Zoom redesign). Worth keeping for non-trivial work.
- **Reviewer sub-agent before commit** used twice. First run caught the participants count/row mismatch + a false-positive on `onLeave`. Second run caught the auto-pin re-render thrash + `as never` casts. Promote to default-before-non-trivial-commit pattern.
- **Merge to main by default** held all session. No "want me to merge?" gates.

**Next concrete step:** hold for Jesse's testing on the deployed room. Possible follow-up if a Sangha member tests and reports specifics. Maria training session per `TRAINING_PLAN.md` remains the queued downstream item from session 115/116.

**Deferred from session 117 (in backlog):**

1. **Spotlight** — host-driven global pin everyone sees (we have local pin in Speaker view, but not Zoom's spotlight).
2. **Mirror video toggle** in Settings → Video.
3. **Test Microphone / Test Speakers** affordances in Settings → Audio.
4. **Host-tag spoofability hardening** — `canUpdateOwnMetadata: true` lets a client claim Host in their own metadata; UI cue only, real actions server-gated. If we want a non-spoofable tag, proxy avatar/signal updates via `RoomServiceClient.updateParticipant` and drop the grant. Risk-accepted for now.
5. **Settings scroll-to-section** — chevron popovers' "Audio Settings…" / "Camera Settings…" link opens the panel but doesn't scroll to the relevant section. Sections are short; minor.

**Deferred from session 113 (still open):**

1. **`volunteer-roles` chapter** — `prisma/seed-manual.ts` updated in-file (SUPPORT removed, GUIDING_TEACHER added), but the DB record at `/admin/manual/volunteer-roles` was not refreshed. Edit manually at `/admin/manual/volunteer-roles/edit`, or write a small `update-manual-volunteer-roles-v2.mjs` script gated by a migration flag.
2. **`host-hub` chapter** — Should mention the Documents notification picker and Archive → Trash flow, and point coordinators to the Trash page.
3. **New `hub-trash` chapter (optional)** — Short chapter explaining the manager-facing Trash page (admins/coordinators/guiding teachers).

**Parked follow-ons from earlier sessions:**

1. **Email template wording in DB** — `registrar-role-assigned` and reminder templates still contain "dashboard" language. Safe path: edit at `/admin/emails`; keep the `dashboardUrl` binding name for now.
2. **`SUPPORT` enum value in `prisma/schema.prisma:135`** — Still present. Removing a Prisma enum value while any user row references it in `roles[]` will crash. Needs a user-records audit (`SELECT id FROM users WHERE 'SUPPORT' = ANY(roles)`) before removal. Out of scope.

**From session 115 (still in backlog):**

1. **Drop legacy `HubConversationThread.status` column** — A couple of UI checks (`HubConvThreadClient.isClosed`, archive toggle buttons in `HubConvClient`) still read `status`. Migrate them to `archivedAt`, then drop the column. Mechanical, low-risk, no rush.
2. **Coordinator-friendly hub content editing for non-host hubs** — Currently welcome / home content on the three non-host hubs (`courses`, `registrar`, `support`) is editable only via the ADMIN form at `/admin/hubs/[slug]/edit`. Either extend `HostHubHomeClient`'s inline edit affordance to all hubs, or build a coordinator-scoped settings page. Decision: which surface?

**New from session 116 (in backlog):**

1. **Functional Vercel preview deploys** — migrate.mjs now skips gracefully on preview builds, but the app itself still has no DB at runtime in preview. Two options: (a) add a staging/preview Postgres and wire its URL to Vercel's Preview env scope, (b) accept that previews are build-only checks (won't run end-to-end). Worth a decision before regular branch work resumes.

**Theme B (Google Meet) remains.** Items #15–17 are still manual steps Jesse will do when ready:
- #15 — Remove four Google Meet env vars from Vercel project settings
- #16 — Revoke/delete the service account in Google Cloud Console
- #17 — Archive or delete `meet1@`–`meet4@` Google Workspace accounts

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
