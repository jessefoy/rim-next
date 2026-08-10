# RIM Zoom Integration — Engineering Reference

**The per-tool reference for "RIM orchestrates, Zoom is the room."** Read this before
touching the Zoom entry (`app/session/[slug]/enter/`), the Zoom helpers
(`lib/zoom.ts`, `lib/sessionMeeting.ts`), or the `useZoom` / `recordByDefault`
program flags.

Companion docs: `RIM_SessionRoom.md` (historical LiveKit reference),
`RIM_System_Architecture.md` (Video Conferencing — permission model, still the
authority for host identity), `RIM_Stack_Reference.md` (env + deps),
`RIM_Scheduler.md` (HostAssignment — who the host is).

> **Status (session 159, 2026-06-25): CUT OVER — Zoom is the room for every
> virtual/hybrid session.** The pilot succeeded; the in-browser LiveKit room was
> retired (code removed) and the per-program `useZoom` flag dropped. `/session/[slug]`
> now redirects to `/session/[slug]/enter` (the single entry). The former shared
> DigitalOcean droplet was decommissioned in session 161; Zoom has no DigitalOcean dependency.
> See "Cutover (done)" at the bottom.

---

## The decision (a reversal)

Through session 120 the committed architecture was the **custom in-browser LiveKit
room** (Zoom was deliberately left behind in s86/s117). Session 158 **reversed
that** for the room layer only: members kept reporting missing features + browser
limits (echo cancellation, "something always a little off"), and a dharma
community that can't afford a failed session values Zoom's **familiarity +
reliability**. The insight that unlocked it: *only the media layer (LiveKit
in-browser) was the problem; RIM's orchestration layer — program → auto-provision
→ assignment → dashboard join → host identity — was the part Jesse loved.* So:

> **RIM keeps the orchestration. Zoom becomes the room.**

RIM still owns scheduling, the dashboard "Join", registration/dana gating, the
time-window, `HostAssignment`. Zoom provides the actual A/V (native app:
familiar, reliable, best AEC, phone dial-in). The full decision spec + the three
models considered (links / embedded Meeting SDK / Video SDK) is in `session-log.md`
(session 158).

---

## The model

- **One Zoom organization account** owned by `jesse@rootedinmindfulness.org`
  (nonprofit discount applied), with **two licensed Pro "pool seats"**
  (`zoom.host@` + `zoom.host2@`). The seats are infrastructure — nobody logs into
  them. Two seats = up to **2 concurrent meetings** (Pro = 1 concurrent/user).
- **A Server-to-Server OAuth app** ("RIM Sessions") in that account provides the
  API credentials. JWT is dead; this is the current model.
- **One Zoom meeting per session occurrence**, created just-in-time on a free
  seat, stored in the `SessionMeeting` table. Reused within the occurrence;
  recreated if it dies.
- **No per-person registration** (see Pitfalls — Zoom rate-limits it). Everyone
  joins via the meeting's **standard join link** under their own name (typed once,
  remembered by Zoom; or their signed-in Zoom name).
- **The host claims host** with a 6-digit code (`ZOOM_HOST_KEY`) — so the host
  shows as themselves AND holds host controls, with no paid account.

---

## Env vars (Vercel)

| Var | What |
|---|---|
| `ZOOM_ACCOUNT_ID` | the RIM Zoom org account id |
| `ZOOM_OAUTH_CLIENT_ID` / `ZOOM_OAUTH_CLIENT_SECRET` | the "RIM Sessions" S2S app creds |
| `ZOOM_SEAT_A_EMAIL` / `ZOOM_SEAT_B_EMAIL` | `zoom.host@` / `zoom.host2@` — the pool seats |
| `ZOOM_HOST_KEY` | 6-digit Claim-Host code; RIM sets it on the owning seat + shows it to hosts |

S2S scopes (granted on the app): `meeting:write:meeting:admin`,
`meeting:read:meeting:admin`, `meeting:update:meeting:admin`,
`meeting:delete:meeting:admin`, `meeting:write:registrant:admin` (legacy, unused
now), `user:read:user:admin`, `user:update:user:admin` (host-key set).

## Key files

| File | Role |
|---|---|
| `lib/zoom.ts` | S2S token (cached) + `zoomApi` helper; `createMeeting` / `getMeeting` / `deleteMeeting` / `ensureSeatHostKey` (+ `addMeetingRegistrant`, now used only by the self-test); `getZoomUser` |
| `lib/sessionMeeting.ts` | Orchestration: `getOrCreateSessionMeeting` (idempotent per occurrence, free-seat pick, race-safe), `deleteSessionMeeting`, `teardownProgramMeetings` |
| `app/session/[slug]/enter/page.tsx` | The Zoom entry (server component): gate → provision/self-heal → role-aware render. Member → `ZoomLaunch`; host-capable → `HostLanding` (+ code); admin error panel |
| `components/session/ZoomLaunch.tsx` | "Opening Zoom…" → `window.location.replace(joinUrl)` |
| `app/admin/zoom-test/page.tsx` + `components/admin/AdminSelfTest.tsx` (shared with `/admin/google-test`; renamed from ZoomSelfTest, session 163) | ADMIN diagnostic: connection check + provisioning round-trip + orchestration round-trip |
| `app/api/admin/zoom/selftest*` | The two self-test routes |
| `prisma/schema.prisma` | `SessionMeeting` model; `Program.useZoom` + `Program.recordByDefault` |

`Program.recordByDefault` is the **cloud-record** toggle (set in the editor's
Hosting & Access tab; audio-only / per-speaker tracks depend on the pool seats' Zoom
recording settings). The session-159 cutover removed `Program.useZoom` from
all code + schema — every virtual/hybrid program routes to Zoom now (the physical
DB column drop is a safe follow-up, backlog `2026-06-25-004`). The session-role authority is
`lib/sessionAuth.ts` (renamed from `livekitAuth.ts`); `lib/sessionIdentity.ts` holds
`sessionDisplayName` + `roomNameForProgram` (the `SessionBan` scope key). CSS: the
entry/host screens use inline styles + tokens (no new prefix).

## The entry flow (`/session/[slug]/enter`)

1. The dashboard / program page / Scheduler "Join" links all point at
   `/session/[slug]/enter`. The legacy `/session/[slug]` URL redirects there too
   (preserving an open-access `?key=`), so old bookmarks/guest links still resolve.
2. `/enter` gates: auth (or a valid open-access guest `?key=`) → **archived
   programs bounce to the dashboard** (`archivedAt`, session 172 — an archived
   program has no live sessions, and this closes the hand-crafted-URL path that
   could provision a meeting for a manually archived recurring program during
   its old weekly window) → in-person programs bounce to their page → time
   window (`getActiveSessionWindow`, ADMIN/GT bypass) → `SessionBan` (members
   by id; guests have none).
3. Provision/reuse the occurrence's meeting + fetch its standard join link
   (`getMeeting`), with **self-heal** (see below).
4. Resolve role (`resolveSessionRole`). `canHost = isSessionHost || isHostTeam ||
   isProgramTeacher || hasEndAllAuthority`.
5. **Guest** (valid open-access `?key=`, no account) or **member** (not
   host-capable) → `ZoomLaunch` (straight into Zoom).
   **Host-capable** → `HostLanding`, a role-aware screen (4 tiers):
   - **Designated host** ("you're hosting" + claim code),
   - **Alternate** (host-team, not assigned today: "[name] is today's host" +
     step-in code),
   - **Teacher** ("you're teaching" + host name + step-in code),
   - **Admin/GT** → treated as alternate.
   - **Regular members never see the code** (structurally — they get `ZoomLaunch`,
     which can't receive the key).

Host identity comes from the **same `HostAssignment` / `resolveSessionRole`** the
LiveKit room used — the Hosting Hub/Scheduler is unchanged. The only Zoom-specific
change was the link *targets*.

## Self-heal (why re-entry is reliable)

`getMeeting` on entry both fetches the join link **and** verifies the meeting. The
entry recreates the meeting once when it's:
- **gone** (404 / Zoom code 3001 — a host ended/deleted it), or
- **registration-on** (`settings.approval_type` 0/1 — a meeting made before the
  no-registration fix; it would show a registration form).

The recreate is loop-safe (a fresh meeting is always `approval_type 2`). So a host
who closes a meeting and re-enters within the window always lands in a live,
form-free meeting. (`meetingIsGone()` matches 404/3001; the approval_type check
heals old registration meetings.)

## Recording

`Program.recordByDefault` → `getOrCreateSessionMeeting({recordToCloud})` →
`createMeeting` sets `auto_recording: "cloud"`. **Audio-only is NOT a per-meeting
field** — it's governed by the pool seats' Zoom recording settings: in the Zoom
console set Cloud recording to "Record an audio only file" and uncheck the video
views. Zoom shows its native recording indicator/consent. Per-program default
today; per-occurrence override is a noted follow-on (the `SessionMeeting`
mechanism supports it).

## Scheduling integrity (seat conflicts)

The seat pool is finite (`zoomSeatCount()` = the configured seats, 2 today) and
meetings are created just-in-time per occurrence — so the only *runtime* conflict
check is the seat-pick in `getOrCreateSessionMeeting`, at join time, against
meetings that already exist. Two layers (session 159) add integrity around edits
and scheduling:

- **Layer 1 — edits self-clean (`programs-pg` PUT).** When a virtual/hybrid
  program's start/end/recurrence changes, its FUTURE meetings are torn down
  (`teardownProgramMeetings`, fire-and-forget) and recreated correctly on the next
  join — so a time change can't orphan the old meeting on its seat. The teardown
  passes `notBefore: now + EARLY_OPEN_MIN`, so it never deletes a meeting whose
  entry window is already open (a host may be staging in it).
- **Layer 2 — predictive warning (`lib/sessionConflicts.ts`).** On save, a
  recurrence-aware check enumerates virtual/hybrid occurrences over the next ~8
  weeks and flags any moment where more overlap than there are seats. The overlap
  window `[start, end]` is computed identically to the seat-pick's stored
  `[sessionDate, endTime]` (same `shiftToDate` + `FALLBACK_DURATION_MIN`), so a
  warning predicts exactly what the seat-pick would do at runtime. Returned
  **non-blocking** as `seatConflicts` in the PUT/POST response; the ProgramEditor
  shows a dismissible banner — the coordinator decides (move a time, add a seat, or
  proceed). Capacity is the real seat count, so "we've outgrown 2 seats" is visible
  rather than surfacing as `NoSeatAvailableError` at a session start.

**Deferred:** a standalone coordinator integrity *view*; the create-path warning
(POST redirects, so it surfaces on the new program's first edit); the seat-pick
advisory lock for the TOCTOU gap (see Pitfalls, backlog `2026-06-24-008`); a
reconciliation cron to sweep orphaned/past meeting rows.

## Guest (open-access) entry

`Program.isOpenAccess` + `guestAccessKey` give a stable, shareable RIM link —
`/session/[slug]?key=<key>` — that forwards a no-account guest into the *current*
occurrence's Zoom meeting (creating it if they're first), during the entry window
only. The link is **persistent** (it changes only if the key is reset); what's
ephemeral is the underlying per-occurrence Zoom meeting, which the link
transparently wraps — the same relationship the member dashboard "Join" has. So
guest access *is* possible with the per-occurrence model. Outside the window a
guest is bounced to `/programs/[slug]`. Open question (session 159): whether RIM
actually uses external guests (keep + clarify the editor copy) or not (hide the
share-link UI).

## Pitfalls (hard-won)

- **Add-Registrant is rate-limited ~3/day per email.** Pre-registering each person
  by name to pre-fill the display name hit this on repeat joins → 429 → bounce.
  **We dropped per-person registration entirely** — standard join link, type your
  name. Don't reintroduce registrant-per-user without solving this.
- **Registration on → a registration *form* on the standard link.** Create
  meetings with `approval_type: 2` (no registration). Old registration-on meetings
  self-heal (recreate) on entry.
- **`start_url` expires ~2h from creation** (not from start time). We don't use it
  for hosting (own-name + Claim-Host instead); only the admin self-test re-`GET`s
  it. If ever used, fetch just-in-time.
- **Concurrency = licensed seats.** 2 Pro seats → 2 concurrent meetings. A 3rd
  overlapping session would have no free seat (`NoSeatAvailableError`). The
  seat-pick has a documented TOCTOU gap (not lock-serialized) — fine at pilot
  scale; add a transaction-scoped advisory lock (like Step-In) before heavy
  concurrent use.
- **Names aren't pre-filled.** Accountless members type their name on first join
  (Zoom remembers it on that device after); signed-in members show their Zoom
  name — which RIM cannot override. We can't remotely log anyone out of their Zoom.
- **`redirect()` to external URLs:** the member path uses a client
  `window.location.replace` (`ZoomLaunch`), not server `redirect()`, for the
  external Zoom URL. Gating `redirect()`s are all same-origin + before the try.
- **`ZoomLaunch`'s panel is a GRID item, so nothing shrinks it** (fixed session
  173). `.zoom-launch__panel` had `width: min(100%, 520px)` + 40px padding with no
  `box-sizing: border-box`, and because `.zoom-launch` is `display: grid` — not
  flex — the panel was never shrunk to fit: 385px wide in a 375px viewport,
  overhanging both edges (the grid centres it, so it clipped 25px left and 5px
  right). This is the page **every virtual session's Join button lands on**, so
  it's phone-critical. Any new rule here that sets a width plus padding must
  declare `border-box`; a flex child would have been safe, a grid child is not.
  Full rule + the measurement method: `RIM_Public_Pages.md` → "No global border-box."

## Cutover (done — session 159)

The pilot succeeded, so the migration is complete:
1. **Pilot** ✅ — one real multi-person Zoom session ran well.
2. **Flipped** ✅ — `useZoom` was removed from all code + schema (the physical DB
   column drop is a safe follow-up, backlog `2026-06-25-004`); every virtual/hybrid
   program routes to `/session/[slug]/enter`, and the legacy `/session/[slug]` URL
   now redirects there (preserving guest `?key=`), closing the direct-nav/bookmark gap.
3. **Decommissioned** ✅ (code) — the in-browser LiveKit room is removed:
   `components/VideoRoom.tsx`, all of `components/session/*` except `ZoomLaunch.tsx`,
   all `app/api/livekit/*`, `lib/livekit.ts`, `/admin/livekit-test`, the RNNoise
   assets, and the 6 LiveKit/noise npm deps. The two SDK-free helpers moved to
   `lib/sessionIdentity.ts`; `lib/livekitAuth.ts` → `lib/sessionAuth.ts`.

**Operations follow-through:** the former DigitalOcean droplet and its retired DNS
records were removed in session 161. `NEXT_PUBLIC_LIVEKIT_URL`, `LIVEKIT_API_KEY`,
and `LIVEKIT_API_SECRET` are unused; if they remain in Vercel, remove them as
non-blocking credential housekeeping.
- **Recording:** on the two pool seats, set Zoom cloud recording to "Record an audio
  only file" **and** "Record a separate audio file of each participant" — the
  per-speaker option yields a clean teacher track when the teacher is named.
