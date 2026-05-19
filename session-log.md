---

## 2026-05-19 (session 117) — Session room: six-issue fix → Zoom-aligned redesign → A/V quality + auto-hide

Single long session with one through-line: bring the LiveKit session room to "feels like Zoom" before Maria's host training. Three phases, thirteen commits, all on `main`.

### Phase 1 — Six-issue fix pass (`e37cff9`)

Jesse listed six concrete defects from Sangha testing:
1. Per-participant mute icon not appearing for hosts
2. Mute/unmute button confusing — members clicked the chevron, not the button
3. Audio choppy / echoey
4. Non-hosts couldn't see participant list
5. Chat had no history
6. No direct messages

Entered plan mode, produced a Connections Map + grouped fixes (Group A: mute UX, B: participants, C: audio, D: chat). Approved, built, reviewed via sub-agent (caught two real issues — `participants.length+1` mismatch with rendered rows; auto-pin effect re-running every render), committed.

Key changes in this commit:
- `RIMControlBar` (new) replaces LiveKit's stock `<ControlBar />`. Wide labeled buttons (this was the e37cff9 overcorrection — fixed in Phase 2).
- `ParticipantsPanel` mute-button visibility bug — `[].every() === true` + `!pub.track` race on fresh joins. Switched to `participant.isMicrophoneEnabled` (canonical flag).
- `audioProfile: teacher | speaker | listener` axis derived in token route. Teacher = `ProgramTeacher` for this program (not "any host"); preserves bell-friendly capture profile. Others get clean speech defaults. DTX off everywhere.
- Token route returns `audioProfile`, drops `needsHiFiAudio`. Page threads it to `VideoRoom`.
- `RIMChat` (new) replaces stock `<Chat />`. New `SessionChatMessage` Prisma model + `/api/livekit/chat` (GET/POST). Live via `room.localParticipant.publishData(..., { destinationIdentities })` for DMs. History persists; new joiners get full chat on entry. Server-side filtering on read so DMs only return to sender + recipients.
- `isHost` gates removed from participants panel button + panel mount; non-hosts now see roster.
- Headphone hint in audio-playback prompt.
- `NonverbalToolbar` consolidated into a Reactions popover (built in Phase 2).
- `EndMenu` + `ReactionsMenu` (new components in Phase 2).

### Phase 1.5 — Build fix (`f74ff6d`)

First push of the branch surfaced a pre-existing fragility: `lib/stripe.ts` threw at module evaluation if `STRIPE_SECRET_KEY` was absent, which crashes preview builds (`next build` collects page data and imports `/api/stripe/webhook`). Wrapped Stripe in a lazy-init Proxy so the env-var check defers to first runtime access. Production unaffected (env var is set there). Pattern matches the session-116 `prisma/migrate.mjs` env-guard.

### Phase 2 — Zoom-aligned redesign (six commits: `ec93a58` `cc5b01c` `0b5112f` `4eb1904` `756a791` `99dd6fd`)

After Phase 1 landed, Jesse asked: "Out of curiosity, can we make it look like a cloned Zoom?" The path that emerged through dialogue: don't go for pixel-clone of Zoom's brand, but adopt Zoom's *information architecture* across every surface — button positions, panel layout, popover behavior, color treatment — so member muscle memory transfers cleanly. Zoom wins where our pattern and theirs differ, unless `RIM_Web_Design_Philosophy.md` says otherwise.

Plan file written, approved, executed across six commits:

1. **Control bar reshape + header trim (`ec93a58`).** Replaced the wide-labeled buttons from `e37cff9` with Zoom-style icon-stacked-over-label (~64×52px). Mic and Camera become two-part clusters (main button + thin divider + chevron). `Participants`, `Chat`, `Settings`, `Share Screen`, `Reactions`, red `End` button — every action that used to be in the page header or RIMConference top toolbar now lives in the bottom control bar in its Zoom-equivalent position. `NonverbalToolbar.tsx` deleted; signals live inside the Reactions popover. Page header trimmed to three slots: Step-In (left), program name (center), fullscreen + help (right). Mute All → Participants panel footer. End-for-All → End popover. Hand-raise "View" button ungated (non-hosts can use it too now). CLAUDE.md updated with a scoped box-shadow exception for control-bar popovers.

2. **Device pickers + Settings audio/video (`cc5b01c`).** Wired the previously-disabled mic and camera chevrons to upward popovers that enumerate `MediaDeviceInfo`, mark the active one, and live-swap via `room.switchActiveDevice()`. Preferences persist in `localStorage` under `rim-livekit-prefs`. `VideoSettingsPanel.tsx` grew Audio and Video sections sharing the same prefs.

3. **Speaker / Gallery view toggle (`0b5112f`).** New `ViewToggle.tsx` segmented control in the top-right of the page header. Gallery default. Speaker view auto-pins active speaker via `useSpeakingParticipants`. Persists in `localStorage`.

4. **Participants panel polish (`4eb1904`).** Sticky local Me row at top with "(you)" tag and a "Host" pill when applicable. Host pill also on remote rows where token marked them as host. Host status encoded in participant metadata at token-issue time (`host: true`) because `roomAdmin` permission isn't exposed cross-client. Search box appears at participant count > 10.

5. **Tile aesthetic (`756a791`).** Custom Zoom-style nameplate with mic icon + name; active-speaker yellow outline (3px `#fde047`) via `useIsSpeaking`; signal badge shrunk from 44px to 22px; rounded 8px corners. (Nameplate further refined in Phase 3.)

6. **Reviewer polish (`99dd6fd`).** Sub-agent on cumulative diff caught: auto-pin effect re-running every render (added `useRef` short-circuit + identity-based gating); `as never` casts in `DevicePickerMenu` (replaced with `Track.Source.*`); spoofability of Host tag (`canUpdateOwnMetadata: true` means a client can fake `host: true` — documented as a UI cue, not a security boundary; actual host actions are gated server-side via `auth() + role + HostAssignment`).

### Phase 3 — A/V quality + visible-bug fixes + final feel (four commits: `b0e3011` `a545360` `7379e96` `57abef7` `b2c45a9`)

Jesse reported video quality was "not great compared to Zoom" and asked for audio to also be good.

- **H.264 + audio bitrate bumps (`b0e3011`).** Switched from VP8 to H.264 (the codec Zoom uses; universal hardware encode/decode; visibly cleaner than VP8 at the same bitrate). Explicit `videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }`. All audio profiles now publish with explicit `audioPreset.maxBitrate` — listener 64 kbps, speaker 96 kbps, teacher 128 kbps. Default was ~20 kbps, which was the source of "thin/unclear" voice complaints. DTX off everywhere.

Screenshot comparison with Zoom showed our session was rendering a generic gray silhouette (LiveKit's default) for participants without uploaded presence photos, vs Zoom's centered profile picture.

- **Initials fallback + pure-black background (`a545360`).** Hide LK's silhouette unconditionally. Render an initials circle (first letter of first + last name token) on a deterministic muted color hashed from identity. Pattern matches Slack / Google Meet / Zoom. Conference background `#111` → `#000` to match Zoom's depth.

- **SVG icons + tighter spacing (`7379e96`).** Replaced emoji icons (🎤 🔇 📹 etc.) with inline Lucide-style line SVGs at 20×20 with 2px stroke. Off-state still tints red via `currentColor`. Removed the two 16px gap dividers between button groups in the control bar (`rim-cb-gap` deleted). Base gap 4 → 6 px. Buttons flow as a continuous cluster the way Zoom does.

- **Initials oval → circle (`57abef7`).** Jesse spotted the initials avatar rendering as a tall oval. Bug: `font-size: 14cqw` on a 1900px-wide tile produced a 266px tall "J" glyph; `aspect-ratio: 1` was being overridden by content height. Fixed with explicit `width/height: min(40cqh, 240px)` (using container-query *height* so it scales with the shorter axis) and `font-size: min(18cqh, 96px)`.

Then the bigger insight from Jesse: "Pause and contemplate the images very carefully." The Zoom screenshot showed no toolbars at all — only the avatar, name, and a single status pill — because **Zoom's UI auto-hides when idle**. That was the missing thing — not icon style or spacing, but the toolbar being permanently visible at all.

- **Auto-hide chrome + Zoom-style nameplate (`b2c45a9`).** Page tracks idle via 3-second timer reset by mousemove / keydown / touchstart / focus. CSS fades `.vs-header` and `.rim-cb` with `opacity 0` + small `translateY` on `.vs-page--idle`. `:has()` selectors re-show chrome when any panel or popover is open (so device pickers, reactions, end menu, chat / participants / settings sidebars never get cut off mid-interaction). `:hover` on the bars also restores them. Touch devices (`hover: none`) never fade. Nameplate restyle: dropped the dark pill background; white text bottom-left with `text-shadow: 0 1px 2px rgba(0,0,0,0.85)` for legibility against any video color. Mic-off SVG only renders when the participant is muted (no icon when unmuted), in red.

### Collaboration experiments — round 2

- **Plan mode** used twice (six-issue fix, Zoom redesign). Worked well both times — the forcing function of "write evaluation before any edits" keeps assumptions visible.
- **Reviewer sub-agent before commit** used twice. First run on the six-issue diff caught two real issues. Second run on the Zoom-redesign cumulative diff caught two more (effect thrash, type casts). Both runs surfaced things the main loop missed. Memory at `feedback-reviewer-subagent.md` was on probation pending two more positive passes; now confirmed. Promote to default-before-non-trivial-commit pattern.
- **Merge to main by default** — first session honoring `feedback-merge-by-default.md`. After each phase: push branch → fast-forward `main` → delete branch. Pattern held; production deploys followed each phase without an extra "want me to merge?" gate.

### Concrete connections (what was touched)

- New: `components/session/RIMChat.tsx`, `RIMControlBar.tsx`, `ReactionsMenu.tsx`, `EndMenu.tsx`, `DevicePickerMenu.tsx`, `ViewToggle.tsx`, `ControlBarIcons.tsx`
- New: `app/api/livekit/chat/route.ts`
- New: `SessionChatMessage` Prisma model + `session_chat_messages` table + `prisma/migrate.mjs` entry
- Deleted: `components/session/NonverbalToolbar.tsx`
- Major rewrites: `components/session/RIMParticipantTile.tsx`, `ParticipantsPanel.tsx`, `RIMConference.tsx`, `VideoSettingsPanel.tsx`, `components/VideoRoom.tsx`, `app/session/[slug]/page.tsx`
- API change: `app/api/livekit/token/route.ts` returns `audioProfile` (was `needsHiFiAudio`); seeds `host` in metadata
- Infra: `lib/stripe.ts` lazy-init Proxy
- CSS: extensive rewrite in `public/css/custom.css` — Zoom-style control bar, popovers, view toggle, initials avatar, auto-hide chrome, nameplate
- Docs: `CLAUDE.md` (box-shadow exception for popovers), `SESSION_ROOM_FOR_VOLUNTEERS.md` (new — plain-English changelog for hosts/sangha)

### Commits

`e37cff9` Session room: six-issue fix pass
`f74ff6d` Build: lazy-init Stripe client so preview builds don't throw on import
`ec93a58` Session room: Zoom-aligned control bar + header trim
`cc5b01c` Session room: device pickers + Settings audio/video sections
`0b5112f` Session room: Speaker / Gallery view toggle
`4eb1904` Session room: participants panel polish
`756a791` Session room: Zoom-style tile aesthetic
`99dd6fd` Session room: reviewer-flagged polish
`b0e3011` Session room: H.264 video + higher audio bitrate
`a545360` Session room: initials fallback + pure-black background
`7379e96` Session room: SVG icons + tighter control-bar spacing
`57abef7` Session room: initials avatar — circle, not oval
`b2c45a9` Session room: auto-hide chrome + Zoom-style nameplate

### Backlog added

- **Spotlight** (host-driven global pin everyone sees) — Zoom feature we don't have.
- **Mirror video toggle** in Settings → Video.
- **Test Microphone / Test Speakers** in Settings → Audio.
- **Host-tag spoofability hardening** — if we want a non-spoofable Host indicator, route avatar/signal updates through a server-side `RoomServiceClient.updateParticipant` endpoint and remove `canUpdateOwnMetadata` from the token grant. Documented as risk-accepted for now.

### What's still on the radar

- Sangha-confidence test: one Sangha member who used the prior version saying "this feels like Zoom" without prompting.
- Maria training session (queued downstream from session 115 / 116).

---

## 2026-05-18 (session 116) — Member home pass + first reviewer-subagent run

Started from a question about an Anthropic-published "explore → plan → code → commit" Claude Code video. Evaluated it against the existing RIM workflow (already richer in most respects), committed to trying two things from it: actually using plan mode (shift+tab) for non-trivial work, and spinning up a code-reviewer sub-agent on the staged diff before commit. Then immediately exercised both on a member home (`/account/dashboard`) pass.

**Member home audit.** Jesse's framing: the dashboard "doesn't feel very well designed to support the average RIM community member." Read the page in plan mode and produced a written evaluation against `RIM_Web_Design_Philosophy.md` (designing for overwhelmed users, clear seeing, one dominant action per state). The honest finding: the page does its job during the 12-min pre-session window — big Join button, "Live Now" badge, unmistakable — but the other 99% of the time it had no answer to "what's next for me?" The greeting carried the visual weight that should belong to the next commitment. "Your Programs" sorted by `createdAt: desc`, not by what's coming next. No surface for the casual community-drop-in path. Section labels categorical ("Your Programs"), not stateful.

**What landed (three commits, all on `main`):**

1. **`nextOccurrenceOnOrAfter()` in `lib/scheduleUtils.ts`** — walks forward up to `maxDays` from a CT date string, returns the next date the program runs. Short-circuits for non-recurring programs with anchors in the past (returns null immediately).

2. **Registrations sorted by next-occurrence ascending, filtered to upcoming-only.** The previous `orderBy: { createdAt: "desc" }` + `take: 5` was platform thinking. Query now selects recurrence fields + `programFormat`, takes 20, JS computes next-occurrence then sorts/filters/slices to 5.

3. **Inline session time on each "Coming up for you" row.** "Essential Dharma Study · 8:15 AM" — start time projected to the next occurrence's date via existing `shiftToDate()`.

4. **"See this week's community schedule →" link** in the greeting block. Quiet `--rim-mid` link in `--text-xs`. For members who don't pre-register.

5. **Section label renames.** "Your Programs" → "Coming up for you." "Your Series" → "Where you're studying." "Your Hubs" → "Where you're contributing." Stateful sentences in line with the session-110 "Dashboard → Home" direction.

6. **Today's in-person registrations surface in the Today card.** Originally Today showed only virtual/hybrid; an in-person registration that fell on today lived under "Coming up for you" with a today-pill. Split-brain on what "today" means. Now Today renders in-person rows alongside the virtual ones (quiet "In-person" tag, no Join button), and "Coming up for you" filters out today's date. Summary count ("N session(s) today") includes in-person today.

7. **`prisma/migrate.mjs` guards against missing DB env.** The Vercel preview build for the branch failed because `prisma generate && node prisma/migrate.mjs && next build` runs migrate.mjs unconditionally and preview deploys don't see `POSTGRES_PRISMA_URL`. Added a top-of-`main()` guard: log a friendly note and return when the env var is absent. Production deploys unaffected. Pre-existing fragility surfaced by the first non-main branch push in a long time.

**Built and deliberately removed: the "Your next session" block.** First plan was to render a persistent block between the greeting and the Today card, showing the member's next commitment whenever Today was empty. Built it; the reviewer sub-agent caught four real issues (visual regression — weekday in narrow time column; non-deterministic `take: 20` after dropping `orderBy`; unbounded 365-day walk for past anchors; stale-pill rendering for past registrations); fixed those. Then Jesse pushed back on the *concept*: "We can do strict soonest, but I wonder if it should be there on the dashboard or if it should be in a link." Pulled the block entirely. The schedule link plus the now-time-bearing "Coming up for you" rows carry the same information without a third surface competing for attention. *Restraint is itself the design principle here.*

**Reviewer sub-agent — first data point.** The transcript-evaluation conversation produced an agreement to try the reviewer sub-agent on the next non-trivial diff before commit and see if it earned its keep. The dashboard pass was that diff. The reviewer caught four real issues across visual hierarchy, data correctness, perf, and stale-state rendering. Two of the four (the `take: 20` orderBy drop, the past-anchor 365-loop) are exactly the kind of "I touched something next to it and didn't think about the consequence" failure the main loop misses. First data point is positive. Skipped on the second (smaller) diff. New memory at `feedback-reviewer-subagent.md` captures the pattern; still on probation pending more passes.

**Plan mode first real use.** Used `EnterPlanMode` for the member-home evaluation. The forcing function is real — no edits during read; final plan written to a plan file before any change. For implementation, the loop was: enter plan mode → write evaluation/Connections Map → exit plan mode → implement. Cleaner than the chat-based Connections Map pattern. Not making it a hard requirement, but using it on non-trivial features from here.

**Vercel deploy detour.** When the branch was first pushed (separately from the merge), Vercel built a preview that failed in migrate.mjs (no DB env). Jesse pasted the log thinking it might be the production build. Clarified: production main deploy was separate and would succeed. Fix: migrate.mjs env guard (above). Deleted the now-stale remote branch `claude/sad-hopper-d44915` (ref at `1d3f7b1`, before the fix) to clear the failing-preview clutter from Vercel.

**Connections Map (what was touched):**
- `lib/scheduleUtils.ts` — new helper, +27 lines
- `app/account/dashboard/page.tsx` — query expansion (recurrence fields + `programFormat`), next-occurrence sort, upcoming-only filter, in-person-today logic, section renames, time-inline JSX, schedule link, summary count
- `public/css/custom.css` — `db2-greeting__schedule` link styling, `db2-upcoming__time` inline-time styling
- `prisma/migrate.mjs` — env-guard at top of `main()`
- `FEATURES.md` — section 6a rewritten
- `RIM_Stack_Reference.md` — migrate.mjs env-guard note under build pipeline
- `UP_NEXT.md` — Active rewritten
- `data/backlog.json` — preview-env-DB consideration added
- Memory: `feedback-reviewer-subagent.md` added; `MEMORY.md` index entry added

**No changes to:** `RIM_System_Architecture.md` (no hub/tool/role/permission logic touched), `RIM_Editor_Types.md` (no editor surfaces touched), `RIM_Role_Design.md` (no role changes), staff manual at `/admin/manual` (the Member Home chapter is DB-stored — if a refresh is wanted, that's an admin-UI edit, not a code change).

**Commits:**
- `1d3f7b1` Member home: sort by next occurrence, show times, link this-week
- `0b12f99` Build: skip migrations cleanly when DB env is missing
- `ac2317b` Member home: surface today's in-person sessions in the Today card

All fast-forwarded to `main` via `git push origin claude/sad-hopper-d44915:main`. Remote branch `claude/sad-hopper-d44915` deleted.

**What comes next.** Plan-mode + reviewer-subagent are still on probation as habit. Two more non-trivial passes will tell whether they're permanent fixtures or theatrical overhead. The dashboard pass landed about as restrained as it can get; Jesse may notice it feels too subtle, in which case the next move is either a more visible weighting of the next commitment (top row of "Coming up for you" gets bigger), or a broader rethink (do we even need both a Today card and a "Coming up for you" list, or could one surface adapt across all states?). Hold for Jesse's read on the deployed page.

---

## 2026-05-14 (session 115) — Hub-system consistency audit + seven-commit cleanup

A systematic inventory of every hub element (sidebar, home, conversations, documents, activity, members, trash, manual, settings, dashboard card) against the most-recent hub work (Hosting Hub) as canonical, "minus the application." Found and fixed four bug classes, expanded GUIDING_TEACHER scope, removed three hardcoded slug literals, seeded welcome content for the three empty hubs, and unified the archive mechanism between threads and documents. Seven commits shipped directly to `main`.

### The audit (Connections Map)

The 9 hub surfaces inventoried:

1. **Sidebar** — `HubWorkspaceSidebar.tsx`. Single flat nav: Home → tools → Activity / Conversations / Documents / Manual / Members → footer (Trash, Settings, Back). Consistent 9/9 across all hubs.
2. **Home** — `app/account/hub/[slug]/page.tsx` + `HubHomeClient` / `HostHubHomeClient`. The host hub branches to a different client component to render the "Our offerings this month" panel (tightly coupled to the Schedule tool).
3. **Conversations** — `app/account/hub/[slug]/conversations/page.tsx` + `HubConvClient`. Categories, pinned, archive, trash, subscriptions all generic.
4. **Documents** — `app/account/hub/[slug]/documents/*` + `HubDocumentsClient`. Three-stage lifecycle (Active → Archived → Trash) fully generic. Document conversations tied to docId (session 114).
5. **Activity stream** — `app/account/hub/[slug]/activity/page.tsx` + `HubActivityClient` (session 114). Generic, computed union.
6. **Members** — `app/account/hub/[slug]/members/page.tsx` + `HubMembersClient`. Coordinator-only editing of status / hostingCapability / communications / pause notes. Host-team had a literal-slug branch for the "Can host sessions" affordance.
7. **Manual** — `app/account/hub/[slug]/manual/page.tsx`. Hub-scoped projection of `ManualSection` records via `hubSlug` filter.
8. **Trash** — `app/account/hub/[slug]/trash/page.tsx` (session 113). `canManageTrash` gates ADMIN / GUIDING_TEACHER / hub coordinator.
9. **Dashboard hub card** — `app/account/dashboard/page.tsx`. Per-hub unread badge.

The seeded hub set is `host-team` (Hosting Hub), `courses` (Course Hub), `registrar` (Registration Hub), `support` (Support Hub) — see `prisma/seed-hubs.ts`. The "14 + 2" hubs mention in some older docs is aspirational, not current; the additional-hubs-via-`/admin/hubs` pathway is in place but unused.

### Findings (the inventory)

Four bug classes, three drift points, and one model-asymmetry, ranked by impact. All addressed.

**P1 — Filter bugs in unread/feed queries (commit `571e331`).** Three field mistakes appearing in 6 sites:

1. `status: { not: "ARCHIVED" }` — the schema only has `OPEN | CLOSED`, so the filter never matched anything. Archived (CLOSED) threads leaked into dashboard unread badge, sidebar Conversations badge, and hub Home "Recent conversations."
2. Missing `documentId: null` — let document threads bleed into the hub-level Conversations feed (server-rendered on first load), dashboard unread count, and hub Home pinned/recent.
3. Missing `deletedAt: null` — trashed threads appeared on hub Home; replies to trashed threads appeared in the Activity stream.

Centralized the canonical filter as `activeHubThreadWhere(hubId)` in new `lib/hubQueries.ts`. Swapped 5 sites to use it; fixed the 2 activity-stream reply queries inline (they intentionally show closed-thread history, so they only filter `deletedAt`).

**P2 — Hide empty Manual sidebar link (commit `24d049a`).** Three of four hubs had no `ManualSection` rows tagged to their slug — the Manual link in the sidebar led to "No manual chapters for this hub yet." The layout now fetches a `manualCount` alongside the hub and passes `hasManual: boolean` to `HubWorkspaceSidebar`, which only renders the Manual entry when chapters exist. Same wiring through `/api/hubs/[slug]/nav` for tool surfaces.

**P3 — Drop host-team literals (commit `93f9995`).** Three sites checked `slug === "host-team"` as a string literal. All three now read `hub.hasSchedule` (the schema field that's already true for host-team and false for the others). No behavior change for the current hub set, but a future hosting hub works without code edits. `HubMembersClient`'s `isHostTeam` flag renames to `isHostingHub` for the same reason.

**P2 — GUIDING_TEACHER scope (commit `b73cbda`).** The role existed (session 113) but only had explicit trash authority via `canManageTrash`. The natural question — should GT also act as coordinator on hubs they're not a member of? — was undecided. Jesse picked the broadest scope: **GT acts as an implicit coordinator on every hub for content + moderation, but does NOT inherit ADMIN-level technical authority** (hard-remove member, hub config, hub create/delete, system-wide settings). New helper `effectiveCoordinator(member, roles)` in `lib/hubAuth.ts` returns true for `member.isCoordinator || ADMIN || GUIDING_TEACHER`. Swept 14 sites that previously inlined `(member?.isCoordinator ?? false) || isAdmin`. `requireCoordinator` gains GT bypass. Document-lock override extends to GT alongside ADMIN (lock is "author asserts sole authorship"; coordinators don't override, but technical/dharma authorities do for moderation/restoration). Documented as a full role section in `RIM_Role_Design.md`.

**Pre-existing soft issue — Settings sidebar link (commit `b86ddf6`).** Found mid-audit: the sidebar's "Hub settings" link was rendered for coordinators-or-admins, but the target `/admin/hubs/[slug]/edit` is strictly ADMIN-only. Coordinators (and after the GT expansion, GT holders) clicked into a "You don't have permission" wall. Gated the link to ADMIN-only. Coordinator-side editing of hub content (welcome, home content) is already inline for the host hub; for non-host hubs it remains a deferred surface decision.

**P2 — Welcome seeds (commit `ac235d5`).** `courses`, `registrar`, and `support` all entered the audit with empty `welcomeBody` — Hub Home read as abandoned. Added `prisma/seed-non-host-hub-home-content.mjs` with starter welcomes in the same practice-grounded voice as the host-hub seed (`seed-host-hub-home-content.mjs`). Defensive write: only sets when `welcomeBody` is null; coordinator edits are preserved. `homeContent` (the "Team directory" block on host hub) is left null — no generic placeholder makes sense; each team can author when shape stabilizes.

**P2 — Archive mechanism unification (commit `20ba301`).** `HubDocument` used `archivedAt DateTime?` since session 113; `HubConversationThread` used the overloaded `status: "CLOSED"`. The asymmetry was the root cause of the P1 `status: { not: "ARCHIVED" }` drift — when the canonical archive marker is a magic string in an enum, code authors guess and sometimes guess wrong. Added `archivedAt` + `archivedById` columns to `hub_conversation_threads`, backfilled `archivedAt = updatedAt` for every existing `status = 'CLOSED'` row. `activeHubThreadWhere` now filters `archivedAt: null`. DELETE precondition, replies-block, and GET `?status=` translation all use `archivedAt`. PATCH status-change keeps `status` in sync for backward compat with clients that still read it; a future cleanup can drop the column once nothing reads `status`.

### Design decisions

**Most-recent-as-canonical for inventory.** Two evaluation standards were on the table: design intent from the docs, or current best-in-class hub work. Jesse picked the latter — the Hosting Hub (most touched in sessions 111–114) becomes the reference. "Minus the application" means the schedule-tool-coupled "Our offerings this month" panel doesn't count against other hubs; only the chrome counts.

**GT scope = "soft admin at the content layer; not at the configuration layer."** Three options offered (trash-only / trash + structural moderation / full coordinator on every hub). Jesse picked option C — broadest reach. Rationale documented in `RIM_Role_Design.md`: a senior teacher should be able to step into any conversation, restore an accidentally-deleted document, archive a thread that ran its course, or remove a member who has stopped participating, **without** also needing to be the person who configures Vercel or runs migrations. Decoupling the technical-operator role from the dharma-authority role lets a future second guiding teacher be added without also handing them the keys.

**Welcomes in Jesse's voice.** Three drafts presented inline; ship-as-drafted approved. Defensive seed pattern means edits at `/admin/hubs/[slug]/edit` are preserved on every future build.

**Archive unification kept status in sync rather than removing it.** Lower-risk path. The `status` column becomes vestigial — a couple of UI checks (`HubConvThreadClient.isClosed`, `HubConvClient` status displays) still read it; they continue to work because PATCH keeps it accurate. A future cleanup migration can drop the column once those UI reads are migrated to `archivedAt`. Added to the backlog.

**Push-to-main is the project's workflow.** First commit went to the worktree branch only out of caution; Jesse confirmed push-to-main is the documented Vercel auto-deploy workflow for this solo project. All subsequent commits went straight to `main` via `git push origin HEAD:main`.

### Interconnections (what this work touches)

- **Hub system as a whole** — every hub now has correct unread badges, hides the Manual link when empty, has a welcome message, and shares an archive mechanism with documents.
- **Role design** — `GUIDING_TEACHER` is no longer just a trash-authority role; it's the canonical "dharma authority without technical scope" role across every hub.
- **Schema** — `HubConversationThread` gains two columns + a `User?` relation; a future cleanup will remove the legacy `status` column.
- **Query layer** — new `lib/hubQueries.ts` is the canonical helper for hub-thread filtering. Any future code that filters hub threads should use it.
- **Maria training (next concrete step per `UP_NEXT.md`)** — the surfaces she will demo are materially more coherent than at session start. P1 bug fixes alone clean up three visible-to-her drift points.

### What comes next

The seven items in the original inventory recommendation list are all done. The next concrete step is Maria training (see `UP_NEXT.md`). After that, deferred items in the backlog include:

- Drop the legacy `HubConversationThread.status` column once UI reads are migrated to `archivedAt`
- Build a coordinator-friendly surface for editing hub welcome / home content on non-host hubs (currently ADMIN-only via `/admin/hubs/[slug]/edit`)

### New patterns to remember

- **`activeHubThreadWhere(hubId)` is the canonical filter** for hub-level conversation threads. Use it for any unread badge, feed query, or count. Don't inline the filter shape.
- **`effectiveCoordinator(member, roles)` is the canonical "is this user acting as coordinator?" check.** Replaces the inline `(member?.isCoordinator ?? false) || isAdmin` pattern; includes GUIDING_TEACHER as well as ADMIN.
- **GT is a soft admin at the content + moderation layer.** Anywhere the model asks "is this user a coordinator?", GT answers yes. Anywhere the model asks "is this user ADMIN?" (hub config, hard-remove member, ADMIN-only surfaces), GT answers no.
- **Archive markers should be nullable timestamps, not enum strings.** The P1 bugs were rooted in the `"CLOSED"`-vs-`"ARCHIVED"` enum confusion. With `archivedAt: null`, there is no string to forget. `HubConversationThread` now matches `HubDocument` in shape.
- **For new schema columns, use the in-array `migrations` entry pattern (with `_migration_flags`)**, not the bottom-of-`main()` inline pattern, when the change is a schema column add. The inline pattern is for content-only seeds.

---



Two features, three bug fixes, and a missing DB migration.

### 1. Image overflow fix

Hub documents were displaying images wider than the page. Root cause: no `max-width` on `img` inside `.rim-content`. One-line fix: `.rim-content img { max-width: 100%; height: auto; display: block; }` added to `custom.css` in the universal editor output base block. Applies to every rich-text surface in the app.

### 2. Document conversations

Each hub document now has its own conversation section, below the document card on the document view page. Threads here are contextually tied to that document — they don't appear in the hub's main Conversations feed, which stays scoped to hub-level discussion.

**What it looks like:** A "N conversations ↓" anchor link in the document's meta row scrolls down to the `#doc-conversations` section. The compose form is a stripped-down version of the hub composer — title input + `RimTiptapEditor` message body + `HubDocNotifyPanel` for optional member notification. Posted threads link out to the shared thread detail page, which now shows "← Back to [Document]" as the back link instead of "← Conversations".

**Schema change:** `HubConversationThread` gained an optional `documentId` FK (`String?`, ON DELETE CASCADE). Hub Conversations feed and `countUnreadConversations` both filter to `documentId: null`. Document conversations filter to `documentId: docId`.

**New files:** `app/api/hub/[slug]/documents/[id]/conversations/route.ts` (GET list + POST create, seeds subscriptions via `after()`), `components/HubDocConversationsClient.tsx` (CSS prefix `doc-conv-`).

**Modified files:** `prisma/schema.prisma`, `app/api/hub/[slug]/conversations/route.ts`, `lib/hubContext.ts`, `app/account/hub/[slug]/documents/[id]/page.tsx`, `app/account/hub/[slug]/conversations/[id]/page.tsx`, `components/HubConvThreadClient.tsx`, `lib/email.ts`.

### 3. Unified Activity stream

A new `/account/hub/[slug]/activity` page shows everything that's happened in a hub in a single chronological river: documents added, documents updated, hub conversations started, hub conversation replies, document conversations started, document conversation replies. Four filter pills narrow the view: All / Documents / Conversations / Mine.

Each item is a single link row: icon + label (e.g. "**Maria** started a conversation on *Team Norms* — Is our check-in time working?") + timestamp. Clicking navigates to the source (document page or thread). Load-more cursor pagination via `GET /api/hub/[slug]/activity`.

Activity is the first item in the sidebar `otherItems` list, above Conversations.

**New files:** `app/account/hub/[slug]/activity/page.tsx`, `app/api/hub/[slug]/activity/route.ts`, `components/HubActivityClient.tsx` (CSS prefix `hub-act-`).

**Modified files:** `components/HubWorkspaceSidebar.tsx` (Activity link added).

### 4. Bug fixes

Three prop errors and one missing DB migration surfaced during this session:

1. **Wrong prop on `RimTiptapEditor`:** Used `initialContent={body}` — correct prop is `value`. Fixed before first push.
2. **Invalid props on `HubDocNotifyPanel`:** Passed `hubSlug`, `helpNote`, `alreadyNotified` — none of which exist on that component. Stripped; coordinator note rendered inline above the panel instead.
3. **Missing DB migration:** `documentId` column was in the Prisma schema but never added to Neon via `migrate.mjs`. Caused a runtime 500 on all hub pages after the build succeeded. Fixed with `add_document_id_to_hub_conversation_threads` migration.

**Pattern to remember:** Always `grep` a component's Props interface before writing usage. Don't assume prop names from memory or from similar components.

### Design decisions

- **Model C chosen for document conversations.** Three options were considered: (A) document threads appear in hub Conversations feed with a "Re: [doc]" label, (B) documents link to a filtered view of the conversations feed, (C) threads live on the document page only and a separate Activity stream surfaces everything. Jesse chose C — conversations stay contextual, nothing is lost from the main feed, and the Activity stream becomes the single place to see the full hub picture.
- **Activity is a computed union query, not a new model.** No new DB table. The stream is assembled at query time from five parallel lookups with a sort + slice. Trade-off: no server-side pagination on the initial load, but the first 30 items fit well within a page view.

---

## 2026-05-13 (session 113) — Hub notifications, subscriptions, three-stage delete, host confirmation emails, residue cleanup

Eight commits, all on `main`. The session began with one request — add per-document notifications — and grew into a connected pass that touched the entire hub notification + lifecycle system.

### 1. Hub Documents — per-document notification system + PDF upload (commit `3b6fc4b`)

Two features, one form. Authors can now attach a PDF (Vercel Blob client upload via `@vercel/blob/client`, max 500 MB) by toggling Link/File in the existing "Add Resource" form. Auto-populates the label from the filename.

Notifications follow the Basecamp pattern: at creation, the author chooses specific members to notify (default: nobody checked). After creation, a `Notify` button on each row opens a modal that pre-selects members not yet notified for that document.

**Schema:** new `HubDocumentNotification` model (event log, `documentId × userId × eventType` rows, no unique constraint), `PDF` value added to `HubDocumentFileType` enum.

**New routes:**
- `GET /api/hub/[slug]/documents/[id]/notify` — returns members + notification history
- `POST /api/hub/[slug]/documents/[id]/notify` — sends to a chosen list

**New email templates** (seeded via `prisma/migrate.mjs`, both in group `05-hubs`): `hub-document-created`, `hub-document-updated`. Sends use `after()` from `next/server` for reliable serverless dispatch.

**Shared component:** `components/HubDocNotifyPanel.tsx` — reused later in conversations.

### 2. Notification dedup + missing email template backfill (commit `767aa9b`)

Server-side dedup on `(documentId, userId, eventType)` in all three send paths. UI shows already-notified members as disabled `✓ Notified [date]` rows with checkbox locked — Basecamp pattern, belt + suspenders.

Audit of `lib/email.ts` vs. `prisma/migrate.mjs` found **four templates referenced by code but never seeded** — silently no-op'ing in production. Backfilled via defensive `findUnique → create` (so any manual `/admin/emails` edits stayed untouched): `session-reminder`, `host-role-assigned`, `sub-request-claimed`, `drip-lesson-available`.

**New gate added to `CLAUDE.md`** ("Email Template Gate"): every `sendTemplatedEmail(slug, …)` call must ship with a matching seed entry in `prisma/migrate.mjs` in the same commit. Documents the defensive create-not-upsert pattern and names the intentional hardcoded exceptions (host coordinator welcome, standing-assignment notifications).

### 3. Conversations — Basecamp-style thread subscriptions (commit `70c759c`)

Replaced the implicit "notify coordinators on new thread / notify participants on reply" with explicit subscription rows.

**New model:** `HubThreadSubscription { threadId, userId, subscribedAt, source }` with `source ∈ {AUTHOR, COORDINATOR_AUTO, ADDED, SELF}`.

**Mental model:**
- A thread has subscribers; subscribers get every reply automatically.
- Author + coordinators + anyone picked in the "Also notify" panel are subscribed at thread creation.
- Replier is auto-subscribed (subscribe-by-replying). Picker on replies adds new subscribers; they receive this reply and every future one.
- Self-subscribe and unsubscribe via Bell pill in the thread header.

**Backfill migration:** for every existing thread, subscribe (author + all prior repliers + all current coordinators). Preserves the prior implicit behavior — nobody loses email after deploy.

**New routes:** `GET/POST/DELETE /api/hub/[slug]/conversations/[id]/subscribe`. The thread + reply POST routes accept optional `notifyUserIds` (additive — these become subscribers).

**UI:** compose form gets a help line "N coordinators of this hub are automatically notified" + picker filtered to non-coordinators. Thread header gets `Following ✓` / `Follow` pill. Reply box has collapsed "+ Notify someone new…" link expanding the shared `HubDocNotifyPanel`. Same component, two surfaces.

### 4. Two-stage delete: archive + trash with manager review (commit `b2e9f95`)

New shared lifecycle pattern. Member can soft-delete; the item vanishes from member views and surfaces only in a per-hub Trash visible to (Admin / Guiding Teacher / Hub Coordinator).

**Schema:**
- New `GUIDING_TEACHER` role in the `Role` enum (sangha-wide dharma authority, distinct from `ADMIN`; Jesse currently holds both but the concept is preserved for future teachers).
- `HubDocument` gains `archivedAt`, `archivedById`, `deletedAt`, `deletedById`.
- `HubConversationThread` gains `deletedAt`, `deletedById` (status `CLOSED` already serves as archive for threads).

**Permission helper:** `canManageTrash(roles, isCoordinator)` in `lib/hubAuth.ts` — single source of truth. ADMIN ∈ roles OR GUIDING_TEACHER ∈ roles OR `HubMember.isCoordinator === true`.

**New routes for both documents and conversations:**
- `POST /{id}/archive` (documents only — threads use existing `CLOSED` status)
- `POST /{id}/restore`
- `POST /{id}/permanent-delete`
- existing `DELETE /{id}` becomes soft-delete

**Trash page:** `/account/hub/[slug]/trash` lists soft-deleted documents + threads side by side, sorted by deletion date. Restore + "Delete permanently" on each row. Hub layout passes `canManageTrash` to the sidebar; non-managers don't see the link and direct URL access redirects them away.

**Safety:** trashed items 404 for non-managers even via direct URL; PATCH refuses with "restore it first"; permanent-delete requires the item to already be in trash (no one-shot hard delete).

### 5. Three-stage lifecycle enforcement (commit `f37e267`)

Initial implementation let members go straight from Active to Trash. Jesse clarified the intent: only Archive is available on active items; Delete only appears on archived items, and it sends to the manager trash.

Aligned both UI and API to this rule:
- Documents: Delete button hidden when `!doc.archivedAt`. Editor footer button changed from `Delete` to `Archive`.
- Conversations: "Move to trash" menu item only renders when `isClosed`. Menu labels relabeled `Close thread` → `Archive thread`, `Reopen thread` → `Unarchive thread`. "Closed" badge → "Archived". List filter tabs `Open / Closed` → `Active / Archived`.
- Status change (archive/unarchive) is now author OR coordinator (was coordinator-only); pin/unpin remains coordinator-only.
- API: both DELETE endpoints 400 with "Archive this … first" unless the item is archived.

### 6. Host assignment confirmation emails — every path (commit `7f9f6e2`)

Audit found that only standing-rotation assignments emailed the new host. Every other path — sub-claim, self-claim, manager-assigns-to-user, claim via PATCH, manager reassign — left the new host with no inbox record.

**Two new templates** (seeded defensively):
- `host-assignment-confirmation` — sent to anyone who becomes a host on a single session, regardless of the path. Variables: `firstName`, `programName`, `dateText`, `requesterNote` (optional, only on sub-claim), `scheduleUrl`.
- `host-assignment-removed` — sent to a host displaced by a manager reassign. (Standing-rotation displacement keeps its existing hardcoded batched email.)

**Wired into:**
- `POST /api/host/sub-requests/[id]/claim` — claimer gets confirmation alongside existing requester email; both now use resolved `Program.name` instead of slug.
- `POST /api/host/assignments` — fires on self-claim AND when a manager assigns to another user; covers both the create-and-claim-existing-unclaimed and create-new branches.
- `PATCH /api/host/assignments/[id]` (action=claim) — claimer gets confirmation.
- `POST /api/host/assignments/reassign` — new host gets confirmation, previously-assigned host gets removal email. The TODO comment that promised displaced-host notification is now actually true.

**Side benefit:** the slug-as-program-name (e.g. `first-floor-pull-back-2024-07-14`) was leaking into the existing `sub-request-claimed` email. Every route now resolves `Program.name` from the slug before sending.

### 7. Tasks + Alerts residue cleanup (commit `809c6b9`)

The Tasks and Alerts modules were deleted in session 96 but residue survived in five places. Audited the codebase and the supporting docs:

- `lib/editorRegistry.ts`: dropped `hub-task` from the `EditorPlacement` union and from `PLACEMENT_TYPE`, `MESSAGE_PLACEMENTS`, `MESSAGE_WITH_TABLES`, `MESSAGE_WITH_FILES`. The Tiptap `TaskList` extension stays — different thing (in-editor inline checklist).
- Removed "Alerts" from cascade-delete enumeration comments in `app/api/admin/members/[id]/route.ts` and `app/api/account/complete-profile/route.ts`.
- Dropped the one-time `remove_tasks_feature` and `remove_alerts_module` migrations from `prisma/migrate.mjs` (already flagged in prod, inert on fresh DB).
- Updated three stale "alert-creation/dedup happens in lib/supportNotify.ts" descriptions — that file no longer exists.
- `RIM_Hub_Model.md` + `RIM_System_Architecture.md`: trimmed Tasks from the hub core sections list. `FEATURES.md`: removed Tasks from the per-hub tab table, added Trash row, added removal footnote.

### 8. Support Inbox residue cleanup (commit `f122a30`)

The Support Inbox application was removed in session 100; HubAppLinks + ManualSection were stripped in session 110; but residue survived in eight more places.

- `app/manual/page.tsx`, `app/admin/manual/page.tsx`, `app/admin/manual/[slug]/page.tsx`: `support: "Support Inbox"` → `support: "Support Hub"` in the hubLabel maps. The Support Hub still exists; it just has no inbox tool.
- Dropped the `seed_support_notification_email_template` and `remove_support_inbox_residue` migrations (their work is done).
- Removed the "06 · Support Inbox" group section from `organize_email_templates_with_groups_and_helptext`.
- Removed the inbox UPDATE from `add_tool_slug_to_hub_app_links` (no rows match anymore).
- Removed the dead `manualSection.updateMany({ slug: "support-inbox" })` call from the host-schedule seed block.
- **New cleanup migration** `drop_support_notification_template` deletes the orphaned `support-notification` email template row from `/admin/emails` (no sender, no UI consumer).
- Deleted `prisma/update-manual-system-section.ts` (session-63 one-shot with outdated content) and `prisma/seed-email-templates.js` (pre-migrate.mjs seed superseded).
- `prisma/seed-manual.ts`: removed SUPPORT role lines from volunteer-roles seed (SUPPORT was also removed in session 100); added `GUIDING_TEACHER` to match current Role enum.
- `RIM_Hub_Model.md`: dropped the example `/api/tools/inbox/context` endpoint. `FEATURES.md`: footnoted the session-73 tools-extraction callout. Backlog: removed the "Restore support-sync cron when Support Inbox launches" item (it's not launching), updated the mobile-audit item to drop `/tools/inbox` + `/tasks` and add `/account/hub/[slug]/trash`.

### Design decisions

1. **Notification dedup is per-event-type, not per-document.** Same person can legitimately get `created` then `updated` for the same doc — those are distinct events. Subscriber model for threads removes the question entirely (subscribed = receives all events).

2. **Coordinator role at the hub level remains distinct from sangha-wide GUIDING_TEACHER role.** Both gate trash, but coordinator is per-hub authority and GUIDING_TEACHER is sangha-wide dharma authority. Today they map 1:1 onto Jesse (ADMIN); the distinction matters for future teachers who might have dharma authority but no technical admin role.

3. **Three-stage lifecycle, not two.** Members never have a "go straight to trash" option — Archive is the deliberate intermediate step. The Archived view is member-visible, read-only, and reversible. Trash is manager-only.

4. **Archive concept is unified under "archive" terminology, but conversations keep their existing CLOSED status as the underlying data model.** No schema rename — just label changes in the UI. Avoids a migration for cosmetic reasons; preserves the meaning of `status: "CLOSED"` for the API.

5. **Every host gets a confirmation email when they become a host, regardless of how.** Standing rotations had it; per-session paths didn't. Now they all do. One template handles five paths via optional `requesterNote` variable.

6. **Email Template Gate added as a discipline gate in `CLAUDE.md`.** The audit surfaced four templates missing for months. Going forward, every `sendTemplatedEmail` slug must have a `migrate.mjs` seed in the same commit.

### What this connects to

- Hub architecture is unchanged structurally — every hub gets every feature automatically because the routes are `[slug]`-parameterized and the data is keyed by `hubId`. The Host Hub, Support Hub, Course Hub, Registrar Hub, and every governance hub now have document archive/trash, conversation subscriptions, and the Trash page (managers only).
- LiveKit, programs, registrations are unaffected.
- Standing-rotation emails remain hardcoded — they're batched, content-specific, and don't fit the per-session template model. Acceptable exception noted in code + CLAUDE.md.

### What comes next

- Maria training session per `TRAINING_PLAN.md` — sessions 111/112 features are live, sessions 113 features (notifications, subscriptions, trash) are live as of this session.
- Optional UX validation in the deployed app: PDF upload flow, notification dedup behavior, "Follow" toggle, Trash page UX.
- Optional future polish: email confirmation copy review at `/admin/emails`; consider showing `requesterNote` more prominently in `host-assignment-confirmation` when populated.

---

## 2026-05-13 (session 112) — Host hub: LiveKit room gap fix + Enter room link in host schedule

Two small, connected changes. Both came from the same question: could a coordinator lose the connection to the virtual conferencing space in a way they couldn't fix from the hub?

**Background:** The LiveKit room name is always derived from the program slug (`roomNameForProgram(slug, sessionDate)` in `lib/livekit.ts`). The token API never uses the `livekitRoom` field — it always goes through the slug. But the member program detail page (`/account/programs/[slug]`) gates the "Join Session" button on `livekitRoom` being non-null. So a new virtual/hybrid program started with `livekitRoom = null` and that page showed "Session link will appear here when available" even though the room itself worked fine.

**Fix 1 — Auto-set `livekitRoom` on create/edit.** `POST /api/programs-pg` now writes `livekitRoom = slug` whenever `programFormat` is virtual or hybrid. `PUT /api/programs-pg/[slug]` backfills it whenever format changes *to* virtual/hybrid and the field is null. In-person programs are untouched.

**Fix 2 — "Enter room →" link in host schedule rows.** Every upcoming virtual/hybrid session row in `HubScheduleClient` now shows a small "Enter room →" link below the format label, opening `/session/{programSlug}` in a new tab. Always visible — not gated by session time — so hosts can test their audio/camera beforehand or arrive 10–12 minutes early to hold the welcoming space. Styled as `.hs-row__join` (13px, 70% opacity at rest), visually subordinate to the main action button.

**Manual updated.** `host-schedule` chapter v5 (`update-manual-host-schedule-v4.mjs`, flag `update_manual_host_schedule_v5`): new "For virtual and hybrid sessions — entering the room" section, placed between "What you see when you arrive" and "The four buttons you might see."

**What this connects to:**
- `app/api/programs-pg/route.ts` — POST handler, livekitRoom auto-set
- `app/api/programs-pg/[slug]/route.ts` — PUT handler, backfill on format change
- `components/HubScheduleClient.tsx` — Enter room link in HsRow
- `public/css/custom.css` — .hs-row__join style
- `prisma/update-manual-host-schedule-v4.mjs` + `prisma/migrate.mjs` — manual v5
- Member program detail page (`/account/programs/[slug]`) — Join button now always present for virtual/hybrid

**What comes next:** Maria training session per TRAINING_PLAN.md.

---

## 2026-05-13 (session 111) — Host rotation management UX overhaul

Three closely-related changes, all driven by a single real-world need: hub coordinators needed to manage rotations, and the tooling needed to cover three distinct operations cleanly — releasing one person from a shared rotation, ending an entire rotation bundle, and resetting a program's rotation structure from scratch.

**Coordinator access.** Rotation controls were previously gated to HOST_MANAGER and ADMIN only. `app/tools/schedule/page.tsx` now queries `HubMember` for coordinator status on the host-team hub and merges the result into a single `isManager` boolean. That value flows through `HubScheduleClient` (prop renamed `isAdmin → isManager`) into `RotationsClient` where it gates the manage panel's release section, the per-program Reset button, and the global "Reset everything" button.

**Release one person's upcoming dates.** New `POST /api/host/standing-assignments/release-host` endpoint. The scenario it solves: Nancy and Silvia share an Alternate rotation (Nancy 1st & 3rd, Silvia 2nd & 4th). Nancy is stepping back with no replacement ready. Ending the whole rotation would displace Silvia and email her unnecessarily. The release operation finds future HostAssignment rows for `userId` within the `(programSlug, dayOfWeek)` bundle, cancels open SubRequests, deletes the assignments, and emails Nancy. Silvia's assignments stay intact. StandingAssignment rules stay — the rotation is still active and can be edited to add a replacement.

**Flat manage panel with three options.** End opens a single panel: (1) release one person's upcoming dates, (2) end on a specific date, (3) end this rotation now. No sub-views, no `endPanelView` state.

**"End this rotation" simplified to one option.** A previous iteration had two End options. Jesse identified that "keep existing sessions, stop generating" leaves dozens of future assignments in place — not useful when actually ending a rotation. Graceful wind-down is already covered by the Edit form's end-date field. Removed option 1. End now always releases future dates and emails affected hosts.

**Global soft-clear removed.** "Clear upcoming schedule" deleted future HostAssignments while leaving rotation rules intact — making it a no-op after the next cron run. Only "Reset everything" (nuclear) remains as a global option.

**Per-program Reset.** "Reset rotations" button at the bottom of each program card (manager only). Calls `POST /api/host/programs/[slug]/clear-rotations` with `mode: "reset"` — deletes all StandingAssignment rules and future HostAssignments for that program only.

**"End on a specific date."** Date picker + "Set end date" button added to the flat panel. Extends `end-bundle` with an optional `endsOn: "YYYY-MM-DD"` param — sets `endsOn` on StandingAssignment records and silently trims any pre-generated HostAssignment rows beyond that date. No email sent (coordinator planning action). Sessions up to and including the end date stay untouched.

**Manual updated.** `host-rotations` chapter at v4 via `prisma/update-manual-host-rotations-v4.mjs`: all three end-panel options documented, including "end on a specific date" and the equivalence of the Edit form's end-date field. Wired into `migrate.mjs` with flag `update_manual_host_rotations_v4`.

**What this connects to:**
- `components/RotationsClient.tsx` — coordinator UI, flat manage panel
- `components/HubScheduleClient.tsx` — `isManager` prop
- `app/tools/schedule/page.tsx` — coordinator DB check
- `app/api/host/standing-assignments/release-host/route.ts` — new
- `app/api/host/programs/[slug]/clear-rotations/route.ts` — new
- `lib/email.ts` — `sendStandingAssignmentReleasedEmail`
- `prisma/migrate.mjs` + `update-manual-host-rotations-v3.mjs` — manual update
- `FEATURES.md` — Feature 45 updated

---

## 2026-05-13 (session 110) — Member-area cleanup: Dashboard → Home, dead-link sweep, Support Inbox tool residue strip

Pure cleanup session, no new feature work. Started from a screenshot Jesse sent of the member dashboard with the sidebar open: a "Support Inbox" entry under "Your Hubs," dead admin links in the Staff section ("Roadmap," "Banner," "Editor Lab"), an Admin dropdown in the top nav pointing at routes that don't exist, and the word "Dashboard" everywhere — a word Jesse said members find abstract and don't connect to a community-login experience.

**Three threads of work, all merged in one commit `8d81ce3`.**

**Thread 1 — Dashboard → Home rename across the member area.** Members now see "Home." `AccountSidebar` renamed `Dashboard` → `Home` with the `Home` icon from lucide-react. Top nav's "My Dashboard" link renamed to "My Home" in both desktop and mobile contexts, plus the same edit in the public site's Member Area dropdown. Page metadata title updated. Tool back-link labels (`ToolsContext`, `tools/schedule/layout.tsx`, `tools/learning/layout.tsx`, `tools/programs/layout.tsx`) changed from `"Dashboard"` to `"Home"` so the back-arrow in tools points to the new vocabulary. `HubWorkspaceSidebar` footer "Back to dashboard" + tooltip → "Back to Home." Public program-detail CTAs ("Access Zoom Link in Dashboard," "member dashboard," "Zoom link in dashboard") rewritten to "My Home" / "member home." Admin vocabulary tracked: ProgramEditor's "Dashboard" tab renamed to "Home Card" with matching help-text rewrites ("member dashboards" → "member home" everywhere). RolesSection's hint "the member's dashboard will show" → "the member's home will show." Style guide ListRow description updated. The URL `/account/dashboard` is unchanged — only the label moved.

**Thread 2 — Dead-link sweep.** Five dead admin destinations removed from navigation surfaces. Sidebar STAFF section lost `Roadmap` (`/admin/roadmap`, never existed), `Banner` (`/admin/banner`, removed session 100), `Editor Lab` (`/admin/editor-lab`, never created as a Next route despite being mentioned in older stack docs). The Admin dropdown in the member-area top nav contained only two items — `Site Architecture` (`/admin/sitemap`) and `Feature Inventory` (`/admin/features`) — both already gone per `CLEANUP.md` §F items #50–#51. Removing them empties the dropdown so the whole dropdown shell came out with them. `Courses` and `Teachers` came out of the member-area top nav with the same logic Jesse confirmed: the sidebar is the authoritative member rail, so the top nav stays minimal (My Home + Programs dropdown + Sign Out + Donate). I briefly added a Sanity Studio link in their place; Jesse pushed back — Sanity is effectively retired (per `CLEANUP.md` #56 + the post-Webflow-reversal state) — and I reverted it.

**Thread 3 — Support Inbox tool residue strip.** Jesse mentioned seeing dead "Support Inbox" / "Inbox Settings" links inside the Support Hub workspace itself: leftover wiring from a tool that was removed in session 100 but whose hub still surfaced its UI hooks. Goal: the Support Hub stays as a core-only team workspace (Home, Conversations, Documents, Members) — same shape as any other tool-less hub — and every breadcrumb of the inbox tool gets cleared. (1) `lib/toolRegistry.ts` lost its `inbox` entry. (2) `lib/hubContext.ts` lost its `case "support":` block that returned `toolBySlug("inbox")` as `primaryTool` — that's what was rendering the "X open requests · Open tool →" card on the hub home with a dead button. (3) `lib/manualGroups.ts` lost the "For the support team" group + its single `support-inbox` chapter reference. (4) `HubHomeClient.tsx` lost `support: "support-inbox"` from the `orientationManualSlug` map (the `?` icon in the hub header). (5) `components/SupportInboxClient.tsx` deleted — 1,736 lines of three-column inbox UI that nothing was importing. (6) `RolesSection.tsx` and `CourseEditor.tsx` lost `SUPPORT` from their role pickers + `ROLE_DESCRIPTIONS` map. (7) `api/upload/route.ts` lost `SUPPORT` from its full-access role check; full-access is now `ADMIN`-only. (8) `prisma/seed-hubs.ts` no longer seeds two HubAppLink rows for the Support Hub. (9) `prisma/seed-manual-chapters.ts` lost the `support-inbox` section block + the cross-references in `volunteer-roles.relations` and the meta-section slug table. (10) New `prisma/migrate.mjs` entry `remove_support_inbox_residue` deletes the existing `HubAppLink` rows on the Support Hub pointing at `/tools/inbox*` plus the `support-inbox` `ManualSection` row — idempotent via `_migration_flags`, runs on next deploy and goes silent after.

**Audit phase — Jesse pushed for thoroughness.** After my first pass I marked things "done" and Jesse pushed back: "really evaluate what was removed so that we can ensure that our system is clean." Re-grepped systematically and found six more user-visible "Dashboard" stragglers I'd missed: public program page CTAs (4), HubWorkspaceSidebar footer (1), ProgramEditor field help text (3), RolesSection hint (1), style-guide page (1), tools/layout.tsx comment listing "schedule, inbox, programs, learning" as tools (1). All cleaned in the same commit. Final sweep confirmed: zero `/tools/inbox`, `/admin/banner`, `/admin/roadmap`, `/admin/editor-lab`, `/admin/sitemap`, `/admin/features`, `/admin/manual/editor` references anywhere; zero `SupportInboxClient` / `supportInbox` / `gmailCredential` references; zero user-visible "Dashboard" labels in active code.

**Sanity status documented.** Jesse's Sanity correction surfaced that there was no memory file documenting Sanity's retirement. Wrote `memory/sanity-status.md` and indexed it in `MEMORY.md` — full inventory of the Sanity residue still in the codebase (`lib/sanity.ts`, `lib/queries.ts`, two public-route pages, `@sanity/client` package dep) with a "don't propose Sanity for new work" directive. Aligns with `CLEANUP.md` #56 which has the Sanity schemas marked future-removable but doesn't reach the code-level residue.

**Two things deliberately not touched, flagged for later.** (a) **DB-stored email-template wording.** The live `registrar-role-assigned` template body still says "[Go to my dashboard →]({{dashboardUrl}})" and reminder templates say "Your session link and full details are on your dashboard." The variable name `dashboardUrl` is a contract between `lib/email.ts:434` and DB template content — renaming requires coordinated changes and live templates are edited at `/admin/emails`, not via code/migration. Best resolved by editing each affected template in the admin UI. (b) **`SUPPORT` enum value in `prisma/schema.prisma`.** Still present at line 135. Removing a Prisma enum value while any user row still references it in `roles[]` will crash, and I can't audit user records from here. Out of scope; needs separate audit pass before removal.

**Git/auth detour.** Push failed initially — GitHub had regenerated Jesse's "RIM Website Development" PAT and the macOS keychain was silently feeding the old (now-invalid) value. Worked through: regenerate token on GitHub → clear `github.com` entries in Keychain Access → `git push origin HEAD:main` from the worktree. After the one-time keychain refresh, subsequent pushes from this session work silently again (shared `osxkeychain` helper).

**What this connects to:**
- Member-area nav surfaces: `components/AccountSidebar.tsx`, `components/Nav.tsx` (desktop + mobile + public dropdown), `components/HubWorkspaceSidebar.tsx`
- Tool framing: `components/ToolsContext.tsx`, `app/tools/{schedule,learning,programs}/layout.tsx`, `app/tools/layout.tsx`
- Page metadata + content: `app/account/dashboard/page.tsx`, `app/programs/[slug]/page.tsx`, `app/style-guide/page.tsx`
- Admin surfaces: `components/registrar/ProgramEditor.tsx` (tab + help text), `components/member-sections/RolesSection.tsx` (hint + role list)
- Hub wiring: `lib/toolRegistry.ts`, `lib/hubContext.ts`, `lib/manualGroups.ts`, `components/HubHomeClient.tsx`
- Role pickers: `components/CourseEditor.tsx`, `app/api/upload/route.ts`
- Seeds + migration: `prisma/seed-hubs.ts`, `prisma/seed-manual-chapters.ts`, `prisma/migrate.mjs` (+ new `remove_support_inbox_residue` migration)
- Deletion: `components/SupportInboxClient.tsx` (1,736 lines)
- Memory: new `memory/sanity-status.md` + `MEMORY.md` index entry

**Net change:** 23 files touched, +95/−1,922 lines.

**New memory:** `sanity-status.md` — Sanity is effectively retired; don't propose it for new work; lists every code-level residue point.

**What comes next:** Maria training session per `TRAINING_PLAN.md` is still the primary next milestone. Two cleanup follow-ons surfaced this session: (1) hand-edit the affected email templates at `/admin/emails` to replace "dashboard" wording with "home" — only safe via UI since the templates live in the DB; (2) audit user `roles[]` arrays for `SUPPORT` before attempting to remove that enum value from the Prisma schema.

---

## 2026-05-07 (session 109) — Rotation panel cards, schedule PDF export, program label drift fix

Two-themed session. First half: more schedule tool polish on top of session 108's work. Second half: chasing a real production bug (stale time labels on the public listing) that landed in a structural fix.

**Rotation panel — card layout.** The chip layout from session 108 was a stopgap. New design Jesse mocked up: stacked horizontal cards, white background with a 0.5px hairline border, left side carrying the program name (16px/500) + a meta line (pattern · end-month, e.g. "1st & 3rd of the month · until Dec 2026"), right side a "NEXT" microlabel + the date·time of the next upcoming session. The "next" data needed to be real database state, not month-dependent client state — added a second query in `app/tools/schedule/page.tsx` that fetches the earliest upcoming `HostAssignment` per rotation slug for the current user (`nextSessionBySlug`), passed through as a prop. CT-formatted "Tue, May 20 · 8:00 AM" via `formatNextSession`. New CSS prefix `hs-myrot__card`/`__left`/`__right`/`__prog`/`__meta`/`__next-label`/`__next-date`. Old chip styles deleted.

**Schedule print → real PDF.** Started as a browser-print page (`/tools/schedule/print` with `@media print` chrome-hiding). Worked, but Jesse asked for "a PDF, not a print of the page" so we'd have full control over typography and page breaks. Pivoted mid-session to `@react-pdf/renderer` v4.5.1 — React-based PDF library that renders server-side without headless Chromium, so it ships on Vercel's serverless runtime without any extra setup. New route `app/api/host/schedule/pdf/route.ts` streams `application/pdf`; new component `app/api/host/schedule/pdf/ScheduleDocument.tsx` defines the layout. The print page (`/tools/schedule/print`) is now just a date-range form with a "Download PDF" link that opens the API route in a new tab. Dropped the entire `@media print` CSS path and the in-page schedule HTML rendering. (npm install hit a root-owned cache file in `~/.npm/_cacache` from a past `sudo npm` — worked around with `--cache /tmp/npm-cache-rim`.)

**PDF redesign — table layout for at-a-glance reading.** First PDF was a day-card-per-session pattern carried over from the HTML version — wasted vertical space when each day had one session, repeated the program name on every row, no quick summary, no "next" emphasis. Rebuilt as a clean table: column header (Day · Date · Time · Program · Format), month dividers (MAY 2026 / JUNE 2026), single-line rows with hairline rules. Summary line under the title — "7 sessions · Thursdays at 8:15 AM" when DOW + time match across all sessions, just the count otherwise. Next upcoming session marked with a teal ▸ in a leftmost marker column + a pale teal row tint (`#eef5f9`). Column header is `fixed` so it repeats on page breaks. Type sizes tuned for arm's-length printed reading: 17pt title, 10pt body, 9pt format col, 8pt section eyebrows.

**Program editor — stale dateText/timeText drift.** Bug Jesse caught: Essential Dharma Study showed 9:30 AM on the public programs listing but the editor's startDatetime was 8:15 AM. Root cause: `Program.timeText` and `Program.dateText` were designed as auto-default-with-override fields, but the implementation conflated the two states. The editor used a "dirty" flag that compared the stored value against the freshly-computed value on load; if they differed, it treated the row as a manual override and refused to update. But the editor also wrote the auto-computed value back to the DB on every save — so any program ever saved would have stored == computed at save time, then later (when source fields changed) stored != computed, falsely tripping the dirty check. The labels froze at first save. Fix: drop the override mechanism entirely. `dateText` and `timeText` are now pure caches of the source fields, recomputed by the server on every POST and PUT. Lifted `computeTimeText` and `computeDateText` from the editor into `lib/programUtils.ts` so server and client share the same logic. The editor still shows the live-computed values, just as read-only previews — the input is no longer the source of truth. Existing rows will self-heal on next save, and a new entry in `prisma/migrate.mjs` (`recache_program_date_time_text`) walks every program on every deploy and refreshes any whose cached label disagrees with the freshly computed one. Cheap, idempotent — after the first deploy it's a no-op, and we leave it in place as ongoing drift insurance. (Inlined the compute helpers into migrate.mjs because it's plain ESM and can't import .ts directly; kept identical to the lib version.)

**What this connects to:**
- `components/HubScheduleClient.tsx` (panel JSX), `app/tools/schedule/page.tsx` (`nextSessionBySlug` query), `public/css/custom.css` (`hs-myrot__*` rewrite)
- `app/api/host/schedule/pdf/route.ts` + `ScheduleDocument.tsx` (new), `app/tools/schedule/print/page.tsx` + `PrintControls.tsx` (rewritten as form)
- `lib/programUtils.ts` (gained `computeTimeText`, `computeDateText`), `app/api/programs-pg/route.ts` (POST), `app/api/programs-pg/[slug]/route.ts` (PUT), `components/registrar/ProgramEditor.tsx` (dirty tracking removed, fields read-only)
- `prisma/migrate.mjs` (new `recache_program_date_time_text` migration with inlined compute helpers)
- New dep: `@react-pdf/renderer ^4.5.1`

**What comes next:** Maria training session per `TRAINING_PLAN.md`. Jesse confirms PDF render quality and rotation panel behavior on Vercel. Backlog item `2026-04-15-001` (Program dateText/timeText cleanup) is now resolved by the fix + migration.

---

## 2026-05-07 (session 108) — Schedule tool polish: rotation panel, form cleanup, pattern preview

Pre-training polish across the rotation UI. Six items from the opening brief; all shipped in three commits.

**Standing Rotations panel redesign (items 3 + 4).** The old panel was a gray-box paragraph list that read like an alert. Key problem: a user on an "alternate" rotation (FIRST + THIRD records in the DB for the same program) saw two separate list items for the same program — "Awakening The Heart — 1st of the month" / "Awakening The Heart — 3rd of the month" — which looked like two distinct rotations. Root cause: a display issue, not a data model issue. The `StandingAssignment` model correctly stores one record per occurrence-slot; the display just wasn't grouping them. Fix: group `myRotations` by `programSlug` before rendering. New `formatOccurrences()` maps occurrence sets to readable patterns (`[FIRST, THIRD]` → "1st & 3rd of the month", `[ALL]` → "every session", `[FIRST,SECOND,THIRD,FOURTH]` → "every week", etc.). New layout: inline chips, one per program, showing program name · pattern · end date (month/year only). No gray box, no alert feel. Changes: `HubScheduleClient.tsx` + `hs-myrot` CSS.

**Rotation form cleanup (items 1, 2, 6).** Three changes in one commit. (1) Dropped "Pair weeks" from `PATTERN_OPTIONS`. Form now has three choices: Same / Alternate / Custom. Existing pair rotations in the DB are unaffected — `detectPattern()` correctly falls them through to "custom" on edit. API validation updated to match. (2) 5th-week host field collapsed to a reveal link by default, mirroring the end-date UX already in the form. Pre-expanded when editing a rotation that already has a 5th-week host set. For "same" pattern: `+ Override 5th week (optional)`; for others: `+ Assign 5th-week host (optional)`. Most months have no 5th occurrence so this stays out of the way. (3) Grid de-emphasis while editing: when a row's inline form is open, all other rows in that program card dim to `opacity: 0.4` with `pointer-events: none`. The active row stays full weight. Removes visual competition between prior-state data and the form being filled. Changes: `RotationsClient.tsx`, `app/api/host/standing-assignments/route.ts`, CSS.

**Pattern preview (item 5).** After selecting a pattern and assigning hosts, a "Preview" row appears at the bottom of the form showing the next 6 sessions for that day with the projected host name. Updates live as the coordinator changes selects. Hidden until at least one host is picked. Implementation: three pure-JS helpers at module level — `upcomingDates(dayOfWeek, n)` walks forward from today to find the next N dates matching the rotation's weekday; `occurrenceInMonth(dateStr)` counts which occurrence that is; `resolvePreviewHost(occN, form)` applies the current pattern+hosts to return the right userId. No API call — all derived from form state. The 5th-week override is respected in the preview too. Layout: date label + host name in a wrapping row inside a tinted card. Changes: `RotationsClient.tsx`, CSS.

**What this connects to:** `HubScheduleClient.tsx` (panel), `RotationsClient.tsx` (form), `app/api/host/standing-assignments/route.ts` (validation), `public/css/custom.css`. No schema changes. No email changes. No manual chapter changes (no "Pair weeks" language existed in manual content). FEATURES.md section 45 updated.

**What comes next:** Jesse tests on Vercel. The training session with Maria is the primary next milestone.

## 2026-05-07 (session 107) — Training session preparation: TRAINING_PLAN.md + hub training document

### What was done

Two deliverables completing the readiness work for the May training session.

**`TRAINING_PLAN.md` — operational reference for Jesse and the host coordinator.** Created in repo root. 9 sections:
1. Sequence and Key Dates (table with [TBD] dates and the June 17 hard deadline).
2. Maria's Onboarding (precursor steps: accounts, hub access, manual chapters to read before the pilot).
3. Pre-Pilot Smoke Test (7-phase checklist for Jesse + Maria the day before the pilot): LiveKit env via `/admin/livekit-test`; hub and manual chapter routes; schedule tool (programFormat field, member picker visibility, Rotations tab for coordinator); `communicationsEnabled` check on HubMember records; email template verification including the `sendTemplatedEmail("host-role-assigned", ...)` risk (template content may still be placeholder copy); two-window session room host controls test; cron manual trigger at `/api/cron/apply-standing-assignments` (accepts GET as ADMIN).
4. Pilot Session (Jesse + Maria + one volunteer host; outcomes, what happens if something breaks).
5. Full Team Training (live exercise: 6 rounds — audio prompt handling, Mute All with button feedback, Step in as Host with reconnect pause explained, per-participant mute, End for All drill without executing, sub-request flow).
6. Between Training and Cutover (solo sessions with pairing, coordinator support, rotations re-run if needed).
7. Cutover Protocol (5-day buffer before June 17; confirmation checklist before canceling Zoom).
8. Post-Cutover (P1–P3 deferred items from HOSTING_HUB_READINESS.md).
9. Open Questions (table format for Jesse to resolve).

**Hub training document — "Training Session — May 2026".** Seeded into the host-team hub (new "Training" category) via `prisma/seed-host-hub-training-doc.mjs`. Written for the host team members who will receive it in advance. Content: what's changing and why (Zoom → LiveKit, June 17 deadline), what to read beforehand (links to four manual chapters: host-first-week, host-hub, host-schedule, host-session-room), what the training will cover (5-item agenda of the live exercise), after the training (pairing period, final Zoom session, cutover), cutover dates table with [TBD] placeholders, questions link to Conversations. Matches the hub welcome body voice (practical, sangha-grounded, designed for overwhelmed users).

`HOSTING_HUB_READINESS.md` closed out with a completion note — all T and B items complete, `TRAINING_PLAN.md` now governs the path forward.

### What this connects to

- `prisma/seed-host-hub-training-doc.mjs` — new file; `migrate.mjs` updated with import + `seed_host_hub_training_doc_v1` flag block.
- Host-team hub document system — same upsert-by-hub+label pattern as `seed-host-hub-team-docs.mjs`; new "Training" category added to `Hub.documentCategories`.
- `TRAINING_PLAN.md` — standalone operational document, no code dependency; referenced by `HOSTING_HUB_READINESS.md`.
- Manual chapters referenced in the training doc: `host-first-week`, `host-hub`, `host-schedule`, `host-session-room` (all built and live as of sessions 99–106).
- The smoke test section references `/api/cron/apply-standing-assignments` GET route (no UI button for bulk apply — code-confirmed in `RotationsClient.tsx`).
- The smoke test flags `communicationsEnabled: false` on `HubMember` as the field that makes a host invisible to sub-request emails.
- The smoke test flags the `host-role-assigned` email template as a risk — confirmed via grep that `sendHostRoleAssignmentEmail` uses `sendTemplatedEmail("host-role-assigned", ...)`, so the Template Manager content must be verified before training.

### What comes next

Jesse fills in the [TBD] dates in both `TRAINING_PLAN.md` and the hub training document (update the hub document via the hub's document editor or by re-running the seed). Theme B (Google Meet env cleanup: items #15–17) remains as manual steps Jesse does when ready. P1–P3 post-cutover items deferred to after June 17.

---

## 2026-05-07 (session 106) — Host manual completion: first-week chapter, role design update, coordinator schedule guide

### What was done

Three "build before training" items from `HOSTING_HUB_READINESS.md` closed in one session. All documentation work; no code changes to application routes or components.

**B2 — host-first-week chapter.** New `ManualSection` seeded via `prisma/seed-manual-host-first-week.mjs`. Plain HTML body (post-Tiptap canonical format). Five sections drawn verbatim from Jesse's provided text: right after you join, before your first session, during and after, the first month, when questions come up. Placed first in the host-team manual group in `lib/manualGroups.ts` — it's the orientation chapter, so it should appear before everything else. DB order 4. `seed_manual_host_first_week_v1` flag added to `migrate.mjs`.

**B3 — RIM_Role_Design.md Virtual Host section refreshed.** In-place edit of the Virtual Host section — refresh, not rewrite. Changes:
- Opening description: "Google Meet" → "the RIM session room"; technical dimension rewritten to describe the actual session room (join from schedule or dashboard, host controls, Step in as Host affordance).
- "What the system needs to support — During the session": replaced the live-view build spec with current state: built session 43-45, removed session 89, deferred as D1–D2.
- "After the session": replaced post-session form spec with current state: never fully built, infrastructure removed session 76, deferred as D3.
- "Automated emails": replaced "starting in disabled state" with current state: never operationalized, infrastructure removed session 76, deferred as D4.
- "What's deferred and why": added D1–D4 entries with historical context.
- "Phase 1 scope" subsection: removed entirely (the pointer "see the Claude Code session brief" was dead-ended; that brief no longer exists).
- "Design decisions and why": minor update to the automated emails rationale wording (no substantive change).
- Decision made deliberately: keeping "Relational/pastoral" label unchanged. Changing it to "Relational/practice of sangha" would require touching the Registrar section for consistency — scope creep on B3. The Registrar section also uses "relational/pastoral"; both documents are internal architectural references where the register is appropriate.

**B4 — host-schedule coordinator section.** "For coordinators" section appended to `update-manual-host-schedule.mjs` (v3). Three subsections:
1. "Checking any teammate's schedule" — member picker framed as a situational-awareness tool that all hosts have, used differently by coordinators (team-wide coverage check, spotting overload, confirming new host assignments). Explicitly NOT framed as coordinator-exclusive.
2. "The Rotations tab" — coordinator-only, brief, references the host-rotations chapter for detail.
3. "Reassigning a session to yourself" — coordinator-only on covered sessions; confirmation window described including side effects (previous host removed, notified; open sub-request closed).
`update_manual_host_schedule_v3` flag added to `migrate.mjs`.

**HOSTING_HUB_READINESS.md updated:** B2, B3, B4 removed from the "Build before training" action list (replaced with a completion table). Category 7 documentation table updated to reflect the new chapter and the role design refresh. Summary view updated: "Five host manual chapters" (was three), "only T3 remains."

### What this connects to

- **`prisma/seed-manual-host-first-week.mjs`** — new file; exports `seedManualHostFirstWeek(db)`.
- **`prisma/migrate.mjs`** — import added for `seedManualHostFirstWeek`; two new flag blocks: `seed_manual_host_first_week_v1` and `update_manual_host_schedule_v3`.
- **`lib/manualGroups.ts`** — `host-first-week` added as first entry in the `host-team` group's slugs array.
- **`prisma/update-manual-host-schedule.mjs`** — "For coordinators" section appended; file header updated to note v3.
- **`RIM_Role_Design.md`** — Virtual Host section updated; design intent preserved; implementation language updated to match reality.
- **`HOSTING_HUB_READINESS.md`** — Category 7 and consolidated action list updated; summary updated.
- **Training readiness** — B1, B2, B3, B4, T1, T2 all complete. T3 (hub welcome body) remains — a Jesse/Maria content task, not a build.

### Design decisions

- **Five sections for host-first-week, not a condensed overview.** Each section has a different frame: joining, preparation, first session, ongoing patterns, escalation paths. Combining them would lose the temporal arc — a new host reads through it in sequence, not as reference material.
- **Member picker explicitly framed as non-coordinator-exclusive in B4.** Jesse's original prompt said "coordinators can assign hosts other than themselves" — this was incorrect (the member picker is a view tool, not an assignment tool). Corrected before writing, confirmed with Jesse. The framing "this is the same picker you saw in the host orientation; here's how coordinators use it differently" preserves the truth while explaining the coordinator-specific use pattern.
- **B3 keeps "Relational/pastoral" label.** Updating to "Relational/practice of sangha" would require the Registrar section for consistency — that's scope creep. Both are internal architectural docs; the register is appropriate there even if the member-facing welcome body uses a different phrase.

---

## 2026-05-07 (session 105) — Session room manual chapter (T2)

### What was done

**T2 — Session room chapter v3.** The `host-session-room` manual chapter already existed (written session 99, corrected session 103 v2). The HOSTING_HUB_READINESS.md inventory had marked it as a gap — correctly, because two significant things were missing: the twelve-minute pre-session section (the relational/pastoral dimension of the host role, the most important thing a host does) and the Step in as Host section (a distinct affordance for host-team members who aren't the assigned host, with a different audience than the rest of the controls).

**Chapter changes (v3):**
- New opening section: "The twelve minutes before." Holds the relational side of the role — arrive early, welcome people as they filter in, hold the space without an agenda. Drawn from `RIM_Role_Design.md`'s design intent. This is what the role is *for*, and it was completely absent from v1 and v2.
- New section: "Step in as Host." Who sees this button (host-team members who aren't the assigned host), what it does (grants full host controls without pre-assignment), when to use it (assigned host no-shows, coordinator checking in, second host joining), and that the transition is invisible to participants.
- Fullscreen button noted in the what-you-see list.
- Navigation path clarified (Schedule card → Join session, or dashboard).
- "During the session" makes explicit that the teacher leads content and the host holds the room — the default is presence, not activity.
- `ManualSection.description` updated to reflect new coverage.

**Help icon (code change, three lines of JSX):** `?` link added to the session page header (`app/session/[slug]/page.tsx`), visible only to `isHostTeam` members. Links to `/admin/manual/host-session-room?from=host-team`, opens in a new tab. Dark-themed `.vs-header__help` CSS class added to `custom.css` (matches the dark session room header — different from the light `.hs-help-icon` on the schedule tool). The user approved this code change explicitly despite the session being characterized as documentation work.

**Backlog entry added:** Architectural question about whether the Step In gate should exist at all (vs. automatic host capability for all active host-team HubMembers). Filed as 2026-05-07-001, priority low, post-cutover.

### What this connects to

- **`prisma/update-manual-host-session-room.mjs`** — chapter content (v3). Wired into `migrate.mjs` with `update_manual_host_session_room_v3` flag.
- **`app/session/[slug]/page.tsx`** — help icon addition. No functional logic changed; the conditional `isHostTeam && (...)` renders one new anchor element.
- **`public/css/custom.css`** — `.vs-header__help` styles, placed adjacent to `.vs-header__fullscreen`.
- **`RIM_Role_Design.md`** — the twelve-minute section draws directly from the "Relational/pastoral" description in the Virtual Host section. That section still has Google Meet implementation language (B3 in HOSTING_HUB_READINESS.md) — that's a separate task.
- **Training readiness** — T2 is resolved. The one remaining blocker is T3 (hub welcome body), which is a Jesse/Maria content task, not a build.

### Design decisions

- **Step In as its own section, not folded into Host Controls.** The audience is different: the assigned host never sees the Step In button. Folding it into a controls section that only the assigned host has would confuse first-time readers. Its own section, clearly labeled, lets the two audiences navigate independently.
- **The twelve minutes is the second section, not an afterthought.** Placing it before the technical walkthrough signals its priority. A host reading the chapter linearly encounters the relational framing before they encounter any button.
- **Honest about the video system being new.** The troubleshooting section says "This video system is newer than what some volunteers have used before." That's the factual situation. Pretending otherwise would undermine trust.

---

## 2026-05-07 (session 104) — HOST_MANAGER welcome email + paused host badge

### What was done

**T1 — sendHostManagerRoleAssignmentEmail.** New email function in `lib/email.ts`, triggered when `HOST_MANAGER` is newly added to a member's roles in `/api/admin/members/[id]/route.ts`. Uses the same inline markdown → marked → wrapInEmailChrome → juice pipeline as other role-assignment emails. Coordinator-appropriate copy: welcomes Maria by name, orients her to the hub and schedule tool, points to the manual with a note that more coordinator-specific chapters are coming soon. Subject: "Welcome, host coordinator — your hub is ready." Three links: hub home, schedule tool, manual (host-hub-team-management chapter). Fire-and-forget via `.catch(() => {})` — mirrors the existing `addingHost` pattern exactly.

**B1 — Paused host visual indicator.** Amber pill badge ("paused" or "inactive") appears on covered session rows in the host schedule when the assigned host's HubMember status is not fully active. Implementation spans three files:

- `app/tools/schedule/page.tsx` — added `pauseMap` construction (single hub lookup + one `hubMember.findMany`) after the assignments query; added `hostBadge: "paused" | "inactive" | null` to the `SessionItem` interface; passes `hostBadge` on every session push.
- `app/api/host/assignments/route.ts` — same `pauseMap` pattern added to the GET handler's month-navigation path; `hostBadge` included on every session in the JSON response.
- `components/HubScheduleClient.tsx` — `hostBadge` added to the `Session` interface with JSDoc distinguishing the two states; `HsRow` covered case renders `<span className="hs-row__paused-badge">` alongside the host name when `hostBadge` is non-null.
- `public/css/custom.css` — `.hs-row__paused-badge` styled adjacent to `.hs-row__new-badge` using `--color-warning` and `--color-warning-bg` tokens (no new color variables).

The distinction between "paused" and "inactive" matters: INACTIVE can co-occur with an active HostAssignment when a coordinator marks someone inactive without releasing their sessions. The "inactive" badge signals higher urgency — that session needs a host, not just a note.

### What this connects to

- **Host schedule (`/tools/schedule`)** — both the server-rendered initial load and the client-side month-navigation API now carry pause state through to the UI. No N+1: pause state is fetched in a single hub + member query per request, not per session.
- **HubMember authority model (Phase 3)** — `getEffectiveHostingCapability()` already gates LiveKit token grants, sub-claims, and assignment creation. The badge closes the loop on the coordinator's view: the system was already refusing paused hosts at action points; coordinators can now see the pause state without cross-referencing the Members tab.
- **Training readiness** — T1 and B1 were both on the `HOSTING_HUB_READINESS.md` action list. Both are now complete. Remaining blockers: T2 (session room manual chapter) and T3 (hub welcome body, a Jesse/Maria content task, not a build).
- **`lib/email.ts`** — stale comment on `sendHostRoleAssignmentEmail` ("to new Meet host") was corrected to "to new host" as part of the adjacent work.

### Design decisions

- **Inline HTML email, not template manager.** The coordinator welcome email bakes its copy directly (marked + juice), same approach as standing-assignment digest emails. Reason: coordinator onboarding is low-iteration copy that doesn't need admin-side editability; the template manager overhead adds friction before the email can fire.
- **Single typed field (`hostBadge`) rather than two booleans.** A discriminated `"paused" | "inactive" | null` value is cleaner to pass through four layers (DB → page → API → component) than `isPaused: boolean, isInactive: boolean`. The client renders based on the string value directly.
- **Amber tokens, no new variables.** `--color-warning` and `--color-warning-bg` already existed in `:root`. Informational, not alarming — the badge reads as a note, not a warning.

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
