# RIM Session Room — Engineering Reference

**The per-tool reference for the LiveKit video session room.** Read this before touching anything under `components/session/`, `components/VideoRoom.tsx`, or `app/api/livekit/*`.

Companion docs: `RIM_System_Architecture.md` (Video Conferencing section — the authoritative permission model), `RIM_Stack_Reference.md` (LiveKit env + deps), FEATURES.md → "Session Room — LiveKit" (feature record), `SESSION_ROOM_FOR_VOLUNTEERS.md` (host/volunteer-facing changelog), and the DB manual chapter `host-session-room` (seeded via `prisma/update-manual-host-session-room.mjs`).

---

## What it is

A custom full-page WebRTC video room built on **LiveKit Cloud (Build tier)**. Not LiveKit's stock `VideoConference` — a bespoke layout (`RIMConference`) with a Zoom-aligned control bar, custom tiles, persistent chat, nonverbal signals, role pills, and host controls. Members and guests join in the browser with no external accounts or app installs.

**Entry:** `/session/[slug]` (and `/session/[slug]?key=…` for open-access guests). Reached from the dashboard "Join" / "Enter as host" buttons and the Scheduler.

---

## Key files

| File | Role |
|---|---|
| `app/session/[slug]/page.tsx` | Page: fetches token, holds `view` (speaker/gallery) + `sessionDate`, renders `VideoRoom` + `ViewToggle` |
| `components/VideoRoom.tsx` | `LiveKitRoom` wrapper — `audio={false} video={false}` (join muted/dark); per-profile `RoomOptions` (codec/bitrate/capture); phase machine greenroom → recovery → conference; `classifyDisconnect` (adds `removed`); relays `onHostPresence` |
| `components/session/RoomErrorBoundary.tsx` | Crash safety net (session 147) — class error boundary wrapping `VideoRoom`. Catches any render throw, shows a contained "Something interrupted the room — Rejoin" screen (`onRecover` = the page's `retry`), logs `[rim-room-crash]` + component stack |
| `components/session/Greenroom.tsx` | Pre-prompt primer; **acquires camera/mic permission via getUserMedia + stop (never publishes)** so the user joins unseen; routes denial to Recovery |
| `components/session/Recovery.tsx` | Permission-denied recovery screen, platform-matched instructions (`lib/detectPlatform.ts`) |
| `components/session/RIMConference.tsx` | The layout. Grid/focus orchestration, pin precedence, screen-share auto-focus, raised-hand reorder, Krisp wiring, unread-chat counter, metadata seeding |
| `components/session/RIMControlBar.tsx` | Bottom control bar: mic/cam, Participants, Chat, Share (+ primer), Reactions, Settings, Bell mode, End |
| `components/session/ShareScreenPrimer.tsx` | Calm primer popover before the browser's screen picker |
| `components/session/RIMParticipantTile.tsx` | Custom tile: nameplate, role pills, signal badge, avatar/initials, hover Mute (co-host), hover Pin (everyone) |
| `components/session/ParticipantsPanel.tsx` | Roster: Me row, raised-hand queue, per-row mute (co-host), **ask-to-unmute** on muted rows, **Remove** (+ 3-option confirm), Mute All, **click-name → DM**. Exports `UNMUTE_REQUEST_TOPIC` |
| `components/session/RIMChat.tsx` | Persistent chat + DMs over LiveKit data channel; exports `CHAT_TOPIC` |
| `components/session/ReactionsMenu.tsx` | Nonverbal signals popover (hand/heart/namaste/yes/no) |
| `components/session/EndMenu.tsx` | End/Leave popover (End-for-All gated on `hasEndAllAuthority`) |
| `components/session/VideoSettingsPanel.tsx` | Settings: mic/speaker/camera device selection + presence photo. **The only device-switch surface** (inline chevrons removed session 133) |
| `components/session/ViewToggle.tsx` | Speaker/Gallery segmented control (header) |
| `components/session/sessionRole.tsx` | `SessionRoleContext` — distributes tier + pin state to tiles without prop-drilling through LiveKit layouts |
| `components/session/ControlBarIcons.tsx` | Inline SVG icon set |
| `lib/livekit.ts` | Server SDK: `createRoomToken`, `roomNameForProgram`, `endRoom`, **`sessionDisplayName`** |
| `lib/livekitAuth.ts` | `resolveSessionRole` — the identity/capability resolver |
| `lib/sessionWindow.ts` | Time-gate: `getActiveSessionWindow`, `describeInactiveWindow`, `assertSessionDateInWindow` |
| `app/api/livekit/token` · `guest-token` · `chat` · `mute-participant` · `mute-all` · `end-session` · `step-in` · `remove-participant` | Server routes (`token`/`guest-token`/`step-in` enforce `SessionBan`) |

CSS prefix: `.rim-cb-*` (control bar), `.rim-tile-*` (tiles), `.rim-pp-*` (participants panel), `.rim-chat*`, `.rim-conference*`, `.rim-hand-banner` / `.rim-pin-banner`, `.gr-*` (greenroom), all in `public/css/custom.css`. LiveKit prefab styles loaded lazily from `public/css/livekit-prefabs.css` (do not edit — it's a vendored build; e.g. it already sets `object-fit: contain` for `[data-lk-source=screen_share]`).

---

## Permission model — identity vs. capability

The authoritative description lives in `RIM_System_Architecture.md`. In short, `resolveSessionRole(userId, programSlug, sessionDate, roles, programHubInfo)` returns:

- **`isSessionHost`** — identity. A `HostAssignment` for this exact session. **No role bypass.** Drives the teal **Host** pill (`meta.host`).
- **`isProgramTeacher`** — a `ProgramTeacher` row **or** an active assignment in a hub whose `assignmentGrantsTeacher` is true. Drives the **Teacher** pill (`meta.teacher`) + the bell-friendly `teacher` audio profile.
- **`isCoHost`** — capability. Any active host-team `HubMember` (`hostingCapability`), `HOST_MANAGER`, ADMIN, GUIDING_TEACHER. Gates mute, Mute All, Share Screen, Bell mode, **ask-to-unmute**, **remove participant**, manage participants. When neither Host nor Teacher applies, drives the **Host Volunteer** pill (`meta.cohost`).
- **`hasEndAllAuthority`** — capability. Assigned host OR ADMIN OR GUIDING_TEACHER OR Teacher-when-no-host. Gates End-for-All (button label + `end-session` route).
- **`isHostTeam`** — gates Step-In visibility (`isHostTeam && !isSessionHost`).

**Pills are UI cues, not a security boundary.** `canUpdateOwnMetadata: true` lets a client forge `host`/`teacher`/`cohost`. Real actions are re-checked server-side via the same `resolveSessionRole`. Never gate a real action on metadata alone.

Three orthogonal metadata flags (`host`/`teacher`/`cohost`) are seeded at token issue **and** re-broadcast by `RIMConference`'s metadata-seeding effect (belt-and-suspenders for reconnect/Step-In races). `cohost` is set only when neither host nor teacher applies, so a tile renders at most two pills.

---

## Layout orchestration (RIMConference)

One `useEffect` drives `layoutContext.pin` (LiveKit's focus pin). **Precedence, highest first:**

1. **Manual pin** (`pinnedIdentity`, this viewer only) — pin that participant's camera/placeholder track. Always wins.
2. **Active screen share** — auto-focus the published `ScreenShare` track (Zoom default). Overrides gallery/speaker.
3. **Speaker view** (`view === "speaker"`) — follow the active speaker.
4. **Gallery** — clear the pin; grid layout.

`inFocusView = (pinnedIdentity || hasScreenShare || view==="speaker") && pin.state.length > 0`.

**Convergence rule (critical):** LiveKit's `set_pin` reducer returns a fresh array every dispatch, so any dispatch re-renders. Guard every dispatch with a "same pin?" check before dispatching, or the effect loops. Manual-pin and screen-share branches compare `publication?.trackSid` (handles placeholder ↔ real-track transitions when a camera/share toggles); converges in one extra render. Speaker-view "keep current pin" guards additionally require `currentPinnedRef.source === Camera` — otherwise a stopped screen-share leaves a dead pin in speaker view.

`sortedTracks` is **camera-only** (screen-share is never a grid/filmstrip tile — it's the focus). Hand-raised tiles sort to the top-left in `raisedHandAt` order, tiebroken by identity for cross-client determinism.

`SessionRoleContext` carries `pinnedIdentity` + `onTogglePin` so tiles (re-mounted by LiveKit layouts) can pin/unpin without prop-drilling. The pin is **local/personal** — never broadcast. (No host "spotlight for everyone" yet — deferred.)

---

## Join flow — muted + dark, unseen (session 133)

`VideoRoom` mounts `LiveKitRoom` with `audio={false} video={false}`. `Greenroom.acquireMediaPermission()` calls `navigator.mediaDevices.getUserMedia({audio,video})` then **immediately stops the tracks** — it acquires the browser grant without ever publishing to the room. The user lands with mic + camera off and turns them on when ready (instant, because the grant is primed).

- **Why getUserMedia-prewarm, not LiveKit enable-then-disable:** the latter briefly publishes to the SFU before muting — another participant could catch a frame. For a contemplative space, "join unseen" is a correctness criterion, so we acquire-without-publishing.
- **Gesture chain:** `getUserMedia` must run from the user gesture on iOS Safari. It's the first `await` in the Continue click handler. The granted-state path runs in a post-Connected effect with no prompt (already granted → no gesture needed).
- **Denial / no camera (JOIN-1, session 144):** `getUserMedia({audio,video})` throwing `NotAllowedError` (deny) or `NotReadableError` (busy) → `onDenied()` → Recovery. `NotFoundError` (no webcam — e.g. a desktop) now **retries `{audio:true}`** so audio-only members join instead of dead-ending in Recovery; only if that retry also throws does it route to Recovery. Both the Continue handler and the auto-acquire effect share this via `acquireMediaPermission`.
- **The `Status` enum** is `"checking" | "auto-acquiring" | "manual" | "acquiring"` (renamed from "publishing" — nothing publishes).
- **Verify on real iOS Safari:** after join, tapping Start Video / Unmute must NOT re-prompt (per-session grant should hold). If it ever does, fall back to LiveKit enable-then-disable.

---

## Connection lifecycle & failure screens (session 144)

`LiveKitRoom` is mounted with `onError` (CONN-1) and a reason-aware `onDisconnected` (CONN-2/3):

- **Connect failure** (`onError`) — when the connect promise rejects (a LiveKit blip, flaky/captive-portal WiFi), the page shows a recoverable **"Connection lost — Rejoin"** screen (`state="connection-lost"`) that re-fetches the token and remounts. Without this the user was stranded on the Greenroom "Connecting…" forever — `LiveKitRoom` swallows the rejection (no `Disconnected` event fires on a *failed initial* connect).
- **Disconnect classification** — `VideoRoom.classifyDisconnect(reason)` maps `DisconnectReason` → `"ended" | "lost" | "duplicate"` and hands the page that string (so `livekit-client` stays out of the page bundle). `CLIENT_INITIATED` / `ROOM_DELETED` / `SERVER_SHUTDOWN` / `PARTICIPANT_REMOVED` → "Session ended"; `DUPLICATE_IDENTITY` → **"You joined from another place"** (a second tab/device evicting the first — CONN-3); everything else (network drop past the retry ladder, signal close, unknown) → "Connection lost — Rejoin" (CONN-2). **Step-In's deliberate disconnect is unaffected** — its resolver early-return in `handleLeave` runs *before* the kind branching.
- **Reconnecting banner** (CONN-4) — `RIMConference` shows a calm "Reconnecting…" banner via `useConnectionState()` while LiveKit auto-recovers a transient drop; a recovery that fully fails surfaces as the "Connection lost" screen above.

---

## Chat

- Messages POST to `/api/livekit/chat` (persisted in `SessionChatMessage`, filtered by `roomName` so chat is per-session) and re-emit on the LiveKit data channel under `CHAT_TOPIC` (`"rim-chat"`, exported from `RIMChat.tsx` — single source of truth).
- **DMs:** `recipient` is lifted to `RIMConference` (`chatRecipient`) so `ParticipantsPanel`'s click-name affordance can set it + open chat. `RIMChat` is controlled via `recipient`/`onRecipientChange`. DMs use `destinationIdentities`.
- **Unread badge:** `RIMConference` runs an always-on `DataReceived` listener (the in-panel listener only exists while chat is open). It counts `CHAT_TOPIC` packets while `chatOpenRef.current` is false; resets on open. LiveKit doesn't loop `publishData` to the sender, so own messages never inflate the count; DMs to others never reach this client. Capped "9+" in the badge.

---

## Names, audio, Bell mode

- **Display name:** `lib/livekit.ts::sessionDisplayName(user, fallback)` → `(preferredName || firstName) + lastName`. Used for the LiveKit participant `name` (token route) and chat `fromName` (chat route) so the room shows **full names**. The global `session.user.name` stays first-name-only (`auth.ts`) — do NOT change that; full names are a session-room-only choice. Guests enter their own free-form name.
- **Audio profile** (`teacher`/`speaker`/`listener`) → capture defaults + per-profile bitrate in `VideoRoom.buildRoomOptions`. `teacher` (ProgramTeacher) disables noise suppression + AGC for bells.
- **Krisp NC** default-on every join via `useKrispNoiseFilter`. **Bell mode** (co-host) flips it off so bells pass through. The button keeps the stable label **"Bell mode"** with a gold highlight + "On" marker when active (it must NOT flip the label to "Clean voice" — that read backwards; fixed session 133). Resets to NC-on each join. Hidden where Krisp is unsupported.

---

## Time gate

`/api/livekit/token` and `/guest-token` refuse tokens outside the window: opens `start − 30min` (session 141 — was 22; from `lib/sessionWindowConstants.ts`), closes `end + 30min` (or `start + 90min` when no end). ADMIN/GT bypass; guests don't. `assertSessionDateInWindow` is wired defense-in-depth into mute-participant, mute-all, end-session, step-in, **and the chat POST** (CHAT-2, session 144). Per-session room names (`slug-YYYY-MM-DD`) mean recurring programs get a fresh room each occurrence — the suffix is the **UTC** date, not CT (cosmetic; every caller derives it from the same canonical `sessionDate`, so no split — TG-3). **Session 144 also:** the `testRoom` token branch is ADMIN-gated (was open to any authenticated member — TOKEN-1), and the open-access `chat` + `guest-token` routes are rate-limited via `lib/rateLimit.ts` (chat 30/60s per identity; guest-token 10/60s per IP).

---

## Crash safety net (session 147)

`RoomErrorBoundary` wraps `VideoRoom` in `app/session/[slug]/page.tsx`. **Before it existed, the app had no React error boundary anywhere** — so any uncaught render throw inside the room (LiveKit layout components included) fell through to Next.js's last-resort white "Application Error" screen. That is exactly what every *remote* participant saw when a screen share started: the share's *receiver* render path threw, and with no boundary each viewer's whole app white-screened at once (the sharer, who runs a different code path, stayed in — which is the signature of a receiver-side crash, not a room-wide failure).

- The boundary degrades a crash to a contained **"Something interrupted the room — Rejoin"** screen (`.vs-message--crash`, absolutely positioned over the `.vs-room` area so the header stays usable). **Rejoin** calls `onRecover` = the page's `retry()` (fresh token + full remount).
- `componentDidCatch` logs `console.error("[rim-room-crash]", error, componentStack)`. The **specific** screen-share throwing line is still unconfirmed — capture it with a two-window repro (console open on the *viewer*); the boundary makes that safe to run live. Backlog `2026-06-11-001`.
- This is the categorical fix (contained failure regardless of the bug); fixing the specific trigger is the follow-on.

## Host controls — mute, ask-to-unmute, remove (session 147)

All gated by `isCoHost`, re-checked server-side via `resolveSessionRole` (pills are never the gate).

- **Ask-to-unmute** — on a muted roster row the action slot becomes "Ask to unmute". It publishes a data-channel packet on `UNMUTE_REQUEST_TOPIC` (`"rim-unmute-request"`, exported from `ParticipantsPanel`) addressed to that identity (`destinationIdentities`). `RIMConference` runs an always-on `DataReceived` listener for that topic (ignored if the mic is already on) → a centered **"{Name} is inviting you to unmute — [Unmute] [Stay muted]"** prompt. The recipient's own tap calls `setMicrophoneEnabled(true)` — **we can never force a mic on (browser consent); the invitation + their tap IS the feature.** Same trust tier as Reactions. The unread-chat badge listener filters by `CHAT_TOPIC`, so the new topic can't inflate it.
- **Remove participant** — `POST /api/livekit/remove-participant` (mirrors `mute-participant`: auth → `assertSessionDateInWindow` → `resolveSessionRole` `isCoHost` → `RoomServiceClient.removeParticipant`, benign no-op on a left target). A row "Remove" opens a 3-option confirm: **remove-can-rejoin** / **remove-for-the-session** / cancel (random taps survivable — nothing destructive on one tap).
- **Session bans** — remove-for-the-session writes a `SessionBan` row (`session_bans` table) **before** the kick (so a kick/leave race can't beat a rejoin). Enforced at all three token-mint paths: `/token` (members by `identity` = userId; **ADMIN/GT exempt**, mirroring the time-gate bypass), `/guest-token` (guests by **case-insensitive display name** — guest identities are minted fresh per join, so the name is the only stable handle), and `/step-in` (checked **before** the HostAssignment upsert — without it a banned host-team member could re-enter *as the Session Host*; reviewer finding). `name` is stored on a ban row **only for guest identities** — storing it on member rows would collaterally block a legitimate same-named guest. Bans expire naturally with the per-day room name (no cleanup).
- **Removed screen** — `classifyDisconnect` maps `DisconnectReason.PARTICIPANT_REMOVED` → a new `removed` `LeaveKind` → an honest "You've been removed from this session" page. It must NOT fall into the `ended` branch (that says "Session ended — thank you for practicing together", a falsehood for someone just removed).
- **Open question (Jesse's call):** any co-host can remove/ban the assigned Host or another co-host — only self-removal is blocked. Same peer surface as Mute, but a ban's blast radius is larger (a banned non-ADMIN host is locked out of their own session). Backlog `2026-06-11-002`.

## Context-aware Step-In (session 147)

The Step-In button (page header, `isHostTeam && !isSessionHost`) previously always read "Step in as Host" and a coordinator who was acting host but not the *assigned* host clicked it cold. Now `RIMConference` derives **host-presence** (`meta.host` on the local participant or any remote) and reports it up via `onHostPresence` → `VideoRoom` → page state. The label: **"No host yet — Step in"** (no host present) / **"Take over as host"** (a host is present) / "Step in as host" (unknown — room not mounted). A plain-language **confirm panel** opens before `handleStepIn` runs. The page resets `hostPresent` to `null` on leave/reload so a prior connection's signal can't drive the next one's label. `onHostPresence` is metadata-derived → a UI cue only; never gate a real action on it.

## Chat + Participants layout (session 147)

The two panels share a right-side column (`.rim-conference__side`) inside `RIMConference`'s main flex row. **Desktop (≥769px):** `ParticipantsPanel` docks `position:static` above chat, each `flex 1 1 50%`, Zoom-style — both visible at once; a single open panel fills the column. **Phones (≤768px):** the wrapper is `display:contents`, so each panel keeps its original behavior (participants = fixed overlay + backdrop, chat = sidebar) — a 390px phone can't host video plus two panels. `ParticipantsPanel` was moved out of the overlay-siblings block into this column (it still renders its own backdrop, hidden on desktop via CSS).

## Audio & echo — the standing decision (session 147)

Self-echo ("people hear themselves echoed through me") was diagnosed end-to-end and is **not a code defect**:

- **Echo cancellation is ON** for all three audio profiles (`VideoRoom.buildRoomOptions`), and has been since April (`261a6fe` flipped the host profile `false→true`). There is exactly one `RoomAudioRenderer` and no local-audio loopback. Don't "fix" echo by toggling capture flags — it's already correct.
- **Echo is an *endpoint* problem, and the source is never the listener.** A person hears their own double only because some *other* endpoint's open mic is re-broadcasting the room. Browser AEC cannot cancel loud speakers, split-device setups (mic on one device, sound out another), or cross-device audio. The confirmed real-world source: a teacher's **wireless mic → Universal Audio Volt interface → computer speakers** (split-device). The fix is **endpoint-side** — route output to a headphone so the mic never hears the room (headphones/output-routing, AirPods output-only, a clear-tube IFB earpiece off the interface).
- **Krisp BVC** (background voice cancellation) is the only in-room "Zoom-parity" lever — it strips *other* voices from a source's outbound mic, even on speakers. It works in the browser now (`@livekit/krisp-noise-filter` 0.4.x + `useBVC`, installed via `useKrispNoiseFilter`'s `filterOptions`), is a small code change, and runs on the *source's* machine only (you don't need every member to have it). **But it requires LiveKit's Ship plan ($50/mo) + $0.0012/min metered (~$55–90/mo) — shelved on cost** (RIM left Zoom for cost + integration; a recurring fee defeats half the point). Endpoint Krisp desktop / macOS Voice Isolation are the free per-machine equivalents, but both sit *upstream* of Bell mode (they'd eat the bell — a toggle each ring; a headphone avoids that).
- **"Layer 1"** — an in-room nudge that detects a mismatched output route (mic belongs to a headset/AirPods but sound is going to laptop speakers) and offers a one-tap "send sound to headset" — was scoped but **not built**: Jesse declined (the confirmed source is his own endpoint; sessions already invite people to mute). It's free, code-only, available later if member-side echo materializes.
- **The platform choice stands.** The real fork was always *native app vs browser*; browser was chosen for cost + integration + no-install joining, all still true. Native-app rebuild (FaceTime-grade system AEC) was rejected at session 120 and reaffirmed here (app-store + install friction + permanent double-maintenance).

## Common pitfalls

- **Custom tiles must use `trackRef.participant`**, not `useMaybeParticipantContext()` — GridLayout provides only `TrackRefContext`.
- **Pin dispatch loops:** never dispatch `set_pin` unconditionally inside the orchestration effect — guard with a same-pin check (identity + `publication.trackSid`). See the convergence rule above.
- **Speaker-view stale pin:** "keep current pin" guards must check `source === Camera`, or a stopped screen-share leaves a blank pinned tile.
- **`session.user.name` is first-name only** — for any session-room display use `sessionDisplayName` against DB name fields, not the session name.
- **Background work in routes** uses `after()` from `next/server` (Vercel kills `void (async)()` after the response).
- **Don't edit `public/css/livekit-prefabs.css`** — vendored build.
- **The browser screen-picker (getDisplayMedia) cannot be restyled or replaced** — web security. Frame it with the primer; don't try to clone Zoom's picker.
- **Host controls must surface failure** (session 144) — EndMenu + the mute handlers check `res.ok`. The server returns a benign `{ok:true, muted:0}` when a mute target already left, so a notice flashes only on a *real* failure (a paused co-host's 403). Don't revert these to the silent `try{…}catch{}` pattern.
- **Step-In is serialized by a `pg_advisory_xact_lock`**, NOT a DB unique index (session 144) — `host_assignments` is shared with the multi-claim greeter hub, so a unique constraint would forbid legitimate greeter rows. Keep the lock **`xact`-scoped** (Neon PgBouncer pooling leaks a session lock) and keep token issuance + notifications *outside* the transaction.
- **Guest identity is trusted only with the `guest-` prefix** (CHAT-1, session 144) — the chat route rejects any `guestIdentity` without it (member ids are cuids); the "Guest" badge + DM scoping both key off this immutable, server-issued prefix. Guest-to-guest binding (verify the token) is the deferred next step.
- **Connect-cancel on unmount** (reviewer note) — navigating away *while still connecting* can fire `onConnectError` on an unmounting component; React no-ops the `setState`. Harmless — don't "fix" it with a ref-guard that breaks the real CONN-1 path.
- **A Rejoin path MUST pass through `state="loading"`** before remounting (session 147) — the guest `joinAsGuest` originally didn't, so a crash-boundary/connection-lost Rejoin remounted `LiveKitRoom` with the *old* token still in state; livekit-client's already-connected early-return then silently discarded the fresh token. `loadToken` and `joinAsGuest` both set `"loading"` (which unmounts the room) before fetching. Keep it.
- **The app has exactly one error boundary** (`RoomErrorBoundary`, session 147) and it's scoped to the room. A render throw *outside* it still white-screens. If you add another high-stakes client surface, give it its own boundary — don't assume one exists.
- **`SessionBan` enforcement lives at every token-mint path** — `/token`, `/guest-token`, AND `/step-in`. If you add a fourth way to mint a room token, it must check the ban too (the step-in path was the reviewer's catch). ADMIN/GT are exempt by design.
- **Guest bans are name-based and evadable** — a removed guest who rejoins under a different display name slips the ban (guest identities are minted fresh per join). Accepted limitation; the host re-removes. Member bans (by id) are airtight. Binding a guest to a verified token is the deferred hardening (also noted in CHAT-1).
- **Echo is not a capture-flag bug** — AEC is already on for all profiles; don't re-litigate it in `buildRoomOptions`. See "Audio & echo" above; the fix is endpoint-side or (paid) BVC, not a constraint toggle.

---

## Deferred / known gaps

- **Screen-share specific throwing line** (session 147) — the `RoomErrorBoundary` now *contains* the crash, but the exact render exception is unconfirmed. Capture it with a two-window repro (console on the viewer) → fix the line. Backlog `2026-06-11-001`.
- **Echo — BVC escalation** (session 147) — if endpoint fixes (headphones / output routing) don't resolve member-side echo, the in-room lever is LiveKit Krisp **BVC** (~$55–90/mo on the Ship plan; `@livekit/krisp-noise-filter` 0.4.x + `useBVC`). Shelved on cost. **"Layer 1"** (free, in-room output-routing-mismatch nudge) was scoped but not built — available later. See "Audio & echo".
- **Co-host can remove/ban the assigned Host** (session 147) — only self-removal is blocked. Decide whether to reserve remove-for-the-session for the assigned host / a manager. Backlog `2026-06-11-002`.
- **Latency / sync tuning** (lip-sync, occasional desync) — needs a live measurement pass (LiveKit stats + Krisp A/B). Don't change codec/bitrate blind.
- **Mobile pin-from-tile** — the Pin button is hover-reveal (desktop), parity with the Mute button. Touch can unpin (banner) but not initiate a pin. A Pin action in the Participants panel would close the gap.
- **Sharer's own focus tile** can be blank during a whole-screen share (recursive capture). Could suppress share-focus for the sharer specifically.
- **Host "Spotlight"** (pin for everyone) — not built; local Pin only.
- **PDF schedule export hub-scoping**, **assignments-GET pause map** — see Scheduler doc; not session-room.
- **(session 144 deferrals, documented):** TG-1 DST gate-drift → a **data-check**, not surgery on shared time math (the dashboard→gate path is self-consistent; only direct-navigate-from-the-public-page is affected); TG-2 recurrence-count cutoff edge (dormant — live sits are open-ended); the control-bar 2-row wrap + End placement at 360–390px and a full popover focus-trap/return-focus (need real hardware); BrightnessProcessor mobile cost (measure first); empty-room cleanup (verify LiveKit's default); recording is **off** (no indicator — a documented decision); guest-to-guest chat identity binding (the prefix check covers the member-impersonation vector).

---

*Rooted in Mindfulness · Working document · created session 133 (2026-05-31).*
