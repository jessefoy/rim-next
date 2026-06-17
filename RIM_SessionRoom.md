# RIM Session Room — Engineering Reference

**The per-tool reference for the LiveKit video session room.** Read this before touching anything under `components/session/`, `components/VideoRoom.tsx`, or `app/api/livekit/*`.

Companion docs: `RIM_System_Architecture.md` (Video Conferencing section — the authoritative permission model), `RIM_Stack_Reference.md` (LiveKit env + deps), FEATURES.md → "Session Room — LiveKit" (feature record), `SESSION_ROOM_FOR_VOLUNTEERS.md` (host/volunteer-facing changelog), and the DB manual chapter `host-session-room` (seeded via `prisma/update-manual-host-session-room.mjs`).

---

## What it is

A custom full-page WebRTC video room built on **self-hosted LiveKit** (DigitalOcean droplet `104.248.229.126`, as of session 150 — migrated off LiveKit Cloud to escape per-GB bandwidth pricing; server `wss://livekit.rootedinmindfulness.org`, Docker Compose: livekit-server + Caddy/TLS + Redis + TURN; config on the droplet at `~/livekit.rootedinmindfulness.org/`; pointed into the app via Vercel env `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`). **Noise cancellation is RNNoise** (session 151) — an in-browser AI denoiser (`@sapphi-red/web-noise-suppressor`) that replaced Cloud-only Krisp when RIM left LiveKit Cloud; see "Names, audio, Bell mode." The **focus view (screen share / pin / speaker) is a fully custom layout** (session 151) — NOT LiveKit's `FocusLayoutContainer`/`CarouselLayout`, which loop on a screen share; see "Layout orchestration." Not LiveKit's stock `VideoConference` — a bespoke layout (`RIMConference`) with a Zoom-aligned control bar, custom tiles, persistent chat, nonverbal signals, role pills, and host controls. Members and guests join in the browser with no external accounts or app installs.

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
| `components/session/RIMConference.tsx` | The layout. Grid (gallery) + custom focus view; **SYNCHRONOUS focus-target computation** (session 151 — no LiveKit pin reducer); raised-hand reorder; RNNoise wiring (via `useNoiseFilter`); unread-chat counter; metadata seeding |
| `components/session/RnnoiseAudioProcessor.ts` | RNNoise audio `TrackProcessor` (session 151) — own 48 kHz AudioContext, mic→RNNoise→destination graph; Bell mode reroutes source→destination (bypass). Worklet + WASM served from `public/noise/`; browser-only (classes extend `AudioWorkletNode` at module scope; safe via `VideoRoom`'s `ssr:false`) |
| `components/session/useNoiseFilter.ts` | Hook (session 151): attaches RnnoiseAudioProcessor on mic-publish; returns `{available,enabled,pending,toggle}` (the Bell-mode trio, replacing `useKrispNoiseFilter`) |
| `components/session/RIMControlBar.tsx` | Bottom control bar: mic/cam, Participants, Chat, Share (+ primer), Reactions, Settings, Bell mode, **Mute All** (co-host, session 149), End. The cluster is **grid-centered** (`1fr auto 1fr`) with End pinned right (`.rim-cb__end-zone`); collapses to a centered flex-wrap ≤768px. **Mute hotkeys** (session 147): `M` toggle (all), hold-`Space` push-to-talk (co-hosts) |
| `components/session/ShareScreenPrimer.tsx` | Calm primer popover before the browser's screen picker |
| `components/session/RIMParticipantTile.tsx` | Custom tile: nameplate, role pills, signal badge, avatar/initials, hover Mute / **Ask-to-unmute** (co-host — Ask shows on a muted participant, session 149), hover Pin (everyone) |
| `components/session/ParticipantsPanel.tsx` | Roster: Me row, raised-hand queue, per-row mute / **ask-to-unmute** (co-host), **Remove** (+ 3-option confirm), **click-name → DM**. Session 149: rows are a clean name + role pill — the mic glyph + the always-on empty signal slot were removed; Mute All moved to the control bar (footer now only carries a failure notice). Exports `UNMUTE_REQUEST_TOPIC` (also imported by the tile) |
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

## Layout orchestration (RIMConference) — SYNCHRONOUS focus (session 151)

The focus target is computed **synchronously in render** from the live `tracks` array — NOT via LiveKit's `layoutContext.pin` reducer (removed in session 151; the `LayoutContextProvider` is kept but inert, for child components). `focusTarget` precedence, highest first:

1. **Manual pin** (`pinnedIdentity`, this viewer only) — that participant's camera/placeholder track. Always wins. (Released via a small `useEffect` when they leave — can't `setState` in render.)
2. **Active screen share** — the published `ScreenShare` track (Zoom default). Over gallery/speaker.
3. **Speaker view** (`view === "speaker"`) — the active speaker's camera; if silent, keep the last speaker (`lastSpeakerFocusRef`); else first remote camera.
4. **Gallery** — `focusTarget = null`.

`inFocusView = !!focusTarget`. The stage renders `<FocusLayout trackRef={focusTarget} />` (the LIVE ref — carries freshly-subscribed remote media); the filmstrip is a fixed-height `<TrackLoop tracks={carouselTracks}>` (camera tiles minus the focused one). CSS: `.rim-focus` / `__stage` / `__strip`.

**Why synchronous (the session-151 rewrite — do NOT revert to the pin reducer):** the old `useEffect → pin.dispatch → pin.state → re-render` machinery caused a cascade of screen-share failures — a React #185 measure-loop in LiveKit's `CarouselLayout`, an RxJS re-subscribe loop from reading the fresh-array `set_pin` state back, a blank receiver stage from pinning a pre-subscription snapshot ref, and a "works on refresh but not live" engagement gap. Computing focus straight off `tracks` each render fixes all of them: a mid-session share engages the same render it appears, and the stage always renders a live ref. (Full arc in `session-log.md` session 151.)

`sortedTracks` is **camera-only** (screen-share is never a grid/filmstrip tile — it's the focus). Hand-raised tiles sort to the top-left in `raisedHandAt` order, tiebroken by identity for cross-client determinism.

`SessionRoleContext` carries `pinnedIdentity` + `onTogglePin` so tiles can pin/unpin without prop-drilling. The pin is **local/personal** — never broadcast. (No host "spotlight for everyone" yet — deferred.)

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

- **Display name:** `lib/livekit.ts::sessionDisplayName(user, fallback)` → `(preferredName || firstName) + last INITIAL` ("Nancy L.", session 151 — was the full surname; shortened for the narrow tile/roster, still a real name). Used for the LiveKit participant `name` (token route) and chat `fromName` (chat route). The global `session.user.name` stays first-name-only (`auth.ts`) — do NOT change that. Guests enter their own free-form name.
- **Audio profile** (`teacher`/`speaker`/`listener`) → capture defaults + per-profile bitrate in `VideoRoom.buildRoomOptions`. `teacher` (ProgramTeacher) disables browser noise suppression + AGC for bells. **Screen share** publishes at `contentHint:"detail"`, up to 1440p capture (`RIMControlBar.startScreenShare`; skipped on Safari 17), `screenShareEncoding` 8 Mbps @ 15fps — crisp text/slides (session 151). Single layer → ~8 Mbps down for receivers during a share (adaptive layers deferred for weak links).
- **RNNoise NC** (session 151, replacing Cloud-only Krisp) default-on every join via the local `useNoiseFilter` hook + `RnnoiseAudioProcessor`. **Bell mode** (co-host) bypasses the processor (source→destination) so bells pass through. The button keeps the stable label **"Bell mode"** with a gold highlight + "On" marker when active (it must NOT flip to "Clean voice" — read backwards; session 133). Resets to NC-on each join. Hidden where RNNoise (AudioWorklet) is unsupported. **Echo/AEC is a separate, capture-level concern — RNNoise does not touch it** (browser AEC stays on for all profiles; the s147 endpoint-echo decision stands).

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

- **Ask-to-unmute** — on a muted roster row the action slot becomes "Ask to unmute". It publishes a data-channel packet on `UNMUTE_REQUEST_TOPIC` (`"rim-unmute-request"`, exported from `ParticipantsPanel`) addressed to that identity (`destinationIdentities`). `RIMConference` runs an always-on `DataReceived` listener for that topic (ignored if the mic is already on) → a centered **"{Name} is inviting you to unmute — [Unmute] [Stay muted]"** prompt. The recipient's own tap calls `setMicrophoneEnabled(true)` — **we can never force a mic on (browser consent); the invitation + their tap IS the feature.** Same trust tier as Reactions. The unread-chat badge listener filters by `CHAT_TOPIC`, so the new topic can't inflate it. **Session 149:** the same invitation is now *also* a **tile-hover** affordance — a muted participant's tile shows an "Ask to unmute" button (`.rim-tile-ask`) in the top-right slot where Mute sits when unmuted, publishing the identical packet. The tile imports `UNMUTE_REQUEST_TOPIC` from `ParticipantsPanel` (runtime-safe — the panel's reverse import of the tile is `import type`, erased). The roster keeps its per-row action too: **tiles have no hover on touch, so the panel is the only per-person action surface on a phone.**
- **Remove participant** — `POST /api/livekit/remove-participant` (mirrors `mute-participant`: auth → `assertSessionDateInWindow` → `resolveSessionRole` `isCoHost` → `RoomServiceClient.removeParticipant`, benign no-op on a left target). A row "Remove" opens a 3-option confirm: **remove-can-rejoin** / **remove-for-the-session** / cancel (random taps survivable — nothing destructive on one tap).
- **Session bans** — remove-for-the-session writes a `SessionBan` row (`session_bans` table) **before** the kick (so a kick/leave race can't beat a rejoin). Enforced at all three token-mint paths: `/token` (members by `identity` = userId; **ADMIN/GT exempt**, mirroring the time-gate bypass), `/guest-token` (guests by **case-insensitive display name** — guest identities are minted fresh per join, so the name is the only stable handle), and `/step-in` (checked **before** the HostAssignment upsert — without it a banned host-team member could re-enter *as the Session Host*; reviewer finding). `name` is stored on a ban row **only for guest identities** — storing it on member rows would collaterally block a legitimate same-named guest. Bans expire naturally with the per-day room name (no cleanup).
- **Removed screen** — `classifyDisconnect` maps `DisconnectReason.PARTICIPANT_REMOVED` → a new `removed` `LeaveKind` → an honest "You've been removed from this session" page. It must NOT fall into the `ended` branch (that says "Session ended — thank you for practicing together", a falsehood for someone just removed).
- **Open question (Jesse's call):** any co-host can remove/ban the assigned Host or another co-host — only self-removal is blocked. Same peer surface as Mute, but a ban's blast radius is larger (a banned non-ADMIN host is locked out of their own session). Backlog `2026-06-11-002`.

## Control bar layout, Mute All, roster cleanup (session 149)

- **Centered control bar.** `.rim-cb` is a `grid-template-columns: 1fr auto 1fr`: `.rim-cb__main` (the button cluster) is explicitly `grid-column: 2` and centers between two equal free-space tracks; `.rim-cb__end-zone` is `grid-column: 3` (`justify-self:end`) so End/Leave stays pinned right. This *truly* centers the cluster — a flex spacer/gutter approach leaves it off-center by half the End button's width (End's intrinsic width loads the right side). The old left-justified look was a leftover `.rim-cb-spacer { flex:1 }` consuming the slack and defeating the already-present `justify-content:center`. **≤768px:** the grid collapses to `display:flex; flex-wrap:wrap; justify-content:center` with `.rim-cb__main { display:contents }` (hoists the buttons into the centered wrap) — the proven pre-centering mobile behavior, so the narrow bar doesn't get squeezed by the gutters.
- **Mute All lives on the control bar** (co-host), grouped with the host controls beside Bell mode — moved off the Participants footer. Reuses `POST /api/livekit/mute-all` (`{programSlug, sessionDate}`); the button label flashes "Muted N" on success and a transient `.rim-cb__notice` (centered above the bar) appears on a real failure. The benign empty-room `{muted:0}` ok stays silent — **host controls must surface failure, not swallow it** (same rule as the per-row handlers + EndMenu).
- **Roster is a clean name + role.** The per-row mic glyph (🎤/🔇) and the always-rendered empty signal slot (`.rim-pp__signal`, a 32px `min-width` that showed as a phantom gap before every name) are gone — the signal slot now renders **only** for a raised hand / reaction. Mute state is read from the per-row Mute vs "Ask to unmute" label, and the tile nameplate's mic-off glyph still shows it to everyone. The footer now only carries the transient per-row failure notice.

## Context-aware Step-In (session 147)

The Step-In button (page header, `isHostTeam && !isSessionHost`) previously always read "Step in as Host" and a coordinator who was acting host but not the *assigned* host clicked it cold. Now `RIMConference` derives **host-presence** (`meta.host` on the local participant or any remote) and reports it up via `onHostPresence` → `VideoRoom` → page state. The label: **"No host yet — Step in"** (no host present) / **"Take over as host"** (a host is present) / "Step in as host" (unknown — room not mounted). A plain-language **confirm panel** opens before `handleStepIn` runs. The page resets `hostPresent` to `null` on leave/reload so a prior connection's signal can't drive the next one's label. `onHostPresence` is metadata-derived → a UI cue only; never gate a real action on it.

## Chat + Participants layout (session 147)

The two panels share a right-side column (`.rim-conference__side`) inside `RIMConference`'s main flex row. **Desktop (≥769px):** `ParticipantsPanel` docks `position:static` above chat, each `flex 1 1 50%`, Zoom-style — both visible at once; a single open panel fills the column. **Phones (≤768px):** the wrapper is `display:contents`, so each panel keeps its original behavior (participants = fixed overlay + backdrop, chat = sidebar) — a 390px phone can't host video plus two panels. `ParticipantsPanel` was moved out of the overlay-siblings block into this column (it still renders its own backdrop, hidden on desktop via CSS).

## Audio & echo — the standing decision (session 147)

Self-echo ("people hear themselves echoed through me") was diagnosed end-to-end and is **not a code defect**:

- **Echo cancellation is ON** for all three audio profiles (`VideoRoom.buildRoomOptions`), and has been since April (`261a6fe` flipped the host profile `false→true`). There is exactly one `RoomAudioRenderer` and no local-audio loopback. Don't "fix" echo by toggling capture flags — it's already correct.
- **Echo is an *endpoint* problem, and the source is never the listener.** A person hears their own double only because some *other* endpoint's open mic is re-broadcasting the room. Browser AEC cannot cancel loud speakers, split-device setups (mic on one device, sound out another), or cross-device audio. The confirmed real-world source: a teacher's **wireless mic → Universal Audio Volt interface → computer speakers** (split-device). The fix is **endpoint-side** — route output to a headphone so the mic never hears the room (headphones/output-routing, AirPods output-only, a clear-tube IFB earpiece off the interface). **For the teacher specifically this is OFF the table:** Jesse leads with open room speakers, bare-faced, ringing a live bell — gear strapped on breaks presence (a RIM-philosophy constraint, not a preference). So his endpoint can't use a headphone; see the resolution at the end of this section.
- **Krisp BVC** (background voice cancellation) is the only in-room "Zoom-parity" lever — it strips *other* voices from a source's outbound mic, even on speakers. It works in the browser now (`@livekit/krisp-noise-filter` 0.4.x + `useBVC`, installed via `useKrispNoiseFilter`'s `filterOptions`), is a small code change, and runs on the *source's* machine only (you don't need every member to have it). **But it requires LiveKit's Ship plan ($50/mo) + $0.0012/min metered (~$55–90/mo) — shelved on cost** (RIM left Zoom for cost + integration; a recurring fee defeats half the point). Endpoint Krisp desktop / macOS Voice Isolation are the free per-machine equivalents, but both sit *upstream* of Bell mode (they'd eat the bell — a toggle each ring; a headphone avoids that).
- **"Layer 1"** — an in-room nudge that detects a mismatched output route (mic belongs to a headset/AirPods but sound is going to laptop speakers) and offers a one-tap "send sound to headset" — was scoped but **not built**: Jesse declined (the confirmed source is his own endpoint; sessions already invite people to mute). It's free, code-only, available later if member-side echo materializes.
- **The platform choice stands.** The real fork was always *native app vs browser*; browser was chosen for cost + integration + no-install joining, all still true. Native-app rebuild (FaceTime-grade system AEC) was rejected at session 120 and reaffirmed here (app-store + install friction — iOS can't even side-load from a website — + permanent double-maintenance; and `client-sdk-swift` #916 shows native AEC regresses too).
- **The resolution (session 147): mute discipline + a hotkey, $0.** The echo loop only closes when an open mic re-broadcasts the speakers — so muting while others talk removes the source. Shipped `M`-to-toggle (everyone) + hold-`Space` push-to-talk (co-hosts) — see "Keyboard controls" below. Optional hands-off backstops, on the *source's* machine, no code: the **Krisp *desktop* app** (krisp.ai/noise-cancellation — the same BVC + echo-cancellation tech LiveKit resells, bought retail; free trial then ~$8/mo Core; one-click toggle in its menu bar, upstream of Bell mode so it eats the bell) or **macOS Voice Isolation** (Control Center mic mode). **LiveKit publishes no nonprofit discount** (self-hosting the OSS server does NOT include Cloud-only BVC); the only lever is "contact sales," not pursued. The "app" weighed was the Krisp desktop app — not a native RIM app.

## Keyboard controls (session 147)

Wired in `RIMControlBar` (it holds `room` + `toggleMic`). Both are document-level keydown listeners sharing one rule: **never fire while the user is typing** — bail when the event target is an `INPUT` / `TEXTAREA` / `SELECT` or `isContentEditable` (the chat compose is a `<textarea>`; also the participant-search `<input>` and the settings `<select>`s).

- **`M` — toggle mute, EVERYONE.** The *safe* hotkey: an accidental mute is harmless and the state is always visible in the bar. Ignores OS chords (⌘/Ctrl/Alt) and key auto-repeat. A `toggleMicRef` keeps the once-bound listener pointed at the latest `toggleMic` (current `micEnabled`) without re-subscribing on each flip. Discoverability: the mute button's `title` reads "Mute (M)" / "Unmute (M)".
- **Hold-`Space` — push-to-talk, CO-HOSTS/TEACHERS ONLY** (`isCoHostRef`). Hold to talk *while muted*, release to re-mute. Kept off the general member population because Spacebar is overloaded (scroll / activate a focused button) — an accidental unmute would break a silent sit. Safety design:
  - **Engages only when already muted** (`if (lp.isMicrophoneEnabled) return`) — never surprise-mutes a host who unmuted via `M`. In the rare window where `M`'s mute is still in-flight the flag still reads unmuted and PTT no-ops *that once* — it fails **closed** (stays muted), never open. Documented in code; accepted.
  - **`pttActiveRef`** marks whether *this* hold opened the mic, so keyup/blur/visibility only ever close a mic PTT itself opened.
  - **Two stuck-open backstops:** window `blur` AND `document` `visibilitychange` both call `release()` — if a hold is interrupted by a tab switch, OS overlay, or the screen-share picker (a focus-steal that may swallow keyup), the mic still closes. A stuck-open mic is the worst failure in a silent room.
  - `release()` gates **only** on `pttActiveRef`, deliberately NOT on `inField` — otherwise hold-Space → click into chat → release would strand the mic open.
  - `preventDefault` on engage claims the key (no scroll, no focused-button click); matches `e.code === "Space"`. Co-host tooltip when muted: "Unmute (M) · or hold Space to talk".
  - Reviewer-verified against LiveKit source: the keydown-`true`/keyup-`false` mutation sequence reliably ends muted (LiveKit's `pendingPublishing` serialization), so a fast tap can't leave the mic open.

The **bell is unaffected** — you're unmuted via `M` when you ring it.

## Common pitfalls

- **Custom tiles must use `trackRef.participant`**, not `useMaybeParticipantContext()` — GridLayout provides only `TrackRefContext`.
- **Focus is SYNCHRONOUS — do NOT reintroduce LiveKit's pin reducer** (session 151). The old `useEffect → layoutContext.pin.dispatch → read pin.state back` pattern caused four distinct screen-share failures (a `CarouselLayout` #185 measure-loop, an RxJS re-subscribe loop, a blank receiver stage, a "works-on-refresh-not-live" gap). `focusTarget` is now computed in render from live `tracks`; keep it that way. See "Layout orchestration."
- **The focus stage renders the LIVE track ref** (`focusTarget` from `tracks`), never a stored snapshot — a snapshot of a *remote* screen share predates subscription and shows a blank stage on receivers (the sharer's local track has media instantly, masking it).
- **Don't use LiveKit's `CarouselLayout`/`FocusLayoutContainer`** — they size tiles from a `useSize` measurement with no definite-height container, which feedback-loops to React #185 (only in focus view, so a screen share triggers it). The custom `.rim-focus` stage + `TrackLoop` strip has no measurement.
- **Screen-share crispness is capture-side** (session 151) — LiveKit caps capture at 1080p by default and won't favor detail; `RIMControlBar.startScreenShare` passes `contentHint:"detail"` + 1440p resolution (skip on Safari 17 — it mis-captures low-res when a resolution is set), and `buildRoomOptions.screenShareEncoding` carries the bitrate (8 Mbps).
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
- **Echo is not a capture-flag bug** — AEC is already on for all profiles; don't re-litigate it in `buildRoomOptions`. See "Audio & echo" above; the fix is endpoint-side, mute-discipline + the M/Space hotkeys, or (paid) BVC — not a constraint toggle.
- **Push-to-talk must fail closed** (session 147) — hold-`Space` engages ONLY when already muted and re-mutes on keyup, window `blur`, AND `visibilitychange`. Never add an `inField` guard to its `release()` (would strand the mic open after hold → click-into-chat → release), and never open the mic on keydown without the blur + visibilitychange backstops. A stuck-open mic in a silent room is the worst failure.

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
