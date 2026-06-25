# RIM Zoom Integration — Engineering Reference

**The per-tool reference for "RIM orchestrates, Zoom is the room."** Read this before
touching the Zoom entry (`app/session/[slug]/enter/`), the Zoom helpers
(`lib/zoom.ts`, `lib/sessionMeeting.ts`), or the `useZoom` / `recordByDefault`
program flags.

Companion docs: `RIM_SessionRoom.md` (the LiveKit room being migrated away from),
`RIM_System_Architecture.md` (Video Conferencing — permission model, still the
authority for host identity), `RIM_Stack_Reference.md` (env + deps),
`RIM_Scheduler.md` (HostAssignment — who the host is).

> **Status (session 158, 2026-06-24): built + pilot-ready, behind a per-program
> flag.** The whole join path works (verified live by Jesse). LiveKit is still the
> default and is **not** retired — that waits on a real multi-person pilot. See
> "Pilot & cutover" at the bottom.

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
| `app/admin/zoom-test/page.tsx` + `components/admin/ZoomSelfTest.tsx` | ADMIN diagnostic: connection check + provisioning round-trip + orchestration round-trip |
| `app/api/admin/zoom/selftest*` | The two self-test routes |
| `prisma/schema.prisma` | `SessionMeeting` model; `Program.useZoom` + `Program.recordByDefault` |

`Program.useZoom` (default false) is the **pilot routing flag** (set in the editor's
Hosting & Access tab). `Program.recordByDefault` is the **audio-only cloud-record**
toggle. CSS: the entry/host screens use inline styles + tokens (no new prefix).

## The entry flow (`/session/[slug]/enter`)

1. The dashboard / program page / Scheduler "Join" links branch on `useZoom`:
   `useZoom` → `/session/[slug]/enter`; otherwise the LiveKit room (untouched).
2. `/enter` gates: auth → `useZoom` (else redirect to the LiveKit room) → time
   window (`getActiveSessionWindow`, ADMIN/GT bypass) → `SessionBan`.
3. Provision/reuse the occurrence's meeting + fetch its standard join link
   (`getMeeting`), with **self-heal** (see below).
4. Resolve role (`resolveSessionRole`). `canHost = isSessionHost || isHostTeam ||
   isProgramTeacher || hasEndAllAuthority`.
5. **Member** (not host-capable) → `ZoomLaunch` (straight into Zoom).
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

## Pilot & cutover (NOT done yet)

Built but **LiveKit is still the default + the fallback.** Order:
1. **Pilot** one real multi-person session on Zoom (set `useZoom` on one program).
2. **Flip** the rest to `useZoom` + add a `/session/[slug]` guard so the LiveKit
   room redirects `useZoom` programs to `/enter` (closes the direct-nav/bookmark
   gap; not built yet).
3. **Decommission** LiveKit: stop the `livekit-server` container on the DO droplet
   (Jesse's SSH — **keep the droplet, it co-hosts OnlyOffice**); archive
   `components/session/*`, `components/VideoRoom.tsx`, `app/api/livekit/*`.

Don't retire LiveKit before the pilot — it's the can't-fail room with no fallback
once gone.
