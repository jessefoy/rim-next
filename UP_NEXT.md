# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active

### Session 154 (2026-06-21→22) — ⏯ RESUME HERE: OnlyOffice DEPLOYED to prod (gated to coordinators); two bugs to fix first

**Supersedes the "feature spine on a branch" note below — it's now merged to `main` + LIVE on production, gated.** The whole feature (Slices 0–3b + create UI + list-link + a coordinator gate) is on `main`, deployed. Vercel **Production** env: `ONLYOFFICE_URL=https://docs.rootedinmindfulness.org` + `ONLYOFFICE_JWT_SECRET` (matches the droplet, after a mismatch fix). The "+ Office doc" button shows only to coordinators/admins (`officeEnabled && isCoordinator` in `HubDocumentsClient`); members see nothing.

**WORKS on prod:** create an office doc → the OnlyOffice editor opens full-screen with real RIM identity (JWT handshake + token-gated download both confirmed). The earlier "Opening editor…" hang was a JWT-secret mismatch (Vercel ≠ droplet), now fixed.

**🐛 FIX FIRST (tomorrow's opening work):**
1. **Edits don't persist (the save loop).** Editor opens, but type → close → reopen = blank. **Prime suspect: the SSRF guard in `app/api/onlyoffice/callback/route.ts` (`isDocumentServerUrl(url)`) is rejecting OnlyOffice's edited-file URL** — behind the Caddy-L4 + shim proxy, OnlyOffice likely reports an internal/different host, so the callback returns `{error:0}` WITHOUT saving. **DO FIRST — get evidence:** Vercel function logs for `[onlyoffice/callback]` after a fresh edit. A `rejected edited-file url` line = confirmed SSRF → fix: relax `isDocumentServerUrl` to also allow private/internal hosts (keep *a* check — the JWT is the real security, and the secret was exposed in chat, so don't fully drop it). A `save failed` line = the fetch/blob step. Add a `console.log` of the received `status` + `url` to the callback to make it unambiguous.
2. **Comments/conversation routing (my design miss).** Office docs link STRAIGHT to the full-screen editor (`/account/documents/[id]/office`), skipping the doc page where the conversation thread (comments) lives. **FIX: office docs should open a doc *page* first** — conversation thread + an "Open in editor" button — NOT the bare editor. Point the office-doc list-link at the hub view page `/account/hub/[slug]/documents/[id]` (already renders `HubDocConversationsClient`) and make that page handle `docKind=ONLYOFFICE` (metadata + conversation + "Open editor" CTA instead of native `body`). (Hubless docs need a doc-centric page later — Slice 4.)

**THEN, in order:** rotate `ONLYOFFICE_JWT_SECRET` (it was pasted in the s154 chat — regenerate `/root/onlyoffice/.env`, `docker compose up -d --force-recreate onlyoffice-docs`, update Vercel Prod+Preview, redeploy) → **Slice 4** (sharing/visibility UI: share-with-hubs + visibility dropdown + badges; master directory `/account/documents` = per-hub sections gated by `canAccessDocument` + Community/Projects) → **Slice 5** (migrate plain native docs → .docx, server-side) → **Slice 6** (RIM-access→OnlyOffice-mode polish, mobile, the comment-title fix, **surface OnlyOffice editor errors** — the loading overlay currently hides them — and the edit-form url-field cleanup for office docs) → **UNGATE** (drop the `&& isCoordinator` clause so all hub members get office docs).

**Key files:** `lib/onlyoffice.ts` (JWT/config/seed + the SSRF `isDocumentServerUrl`), `app/api/onlyoffice/callback/route.ts` (bug #1 lives here), `components/HubDocumentsClient.tsx` (the list-link — bug #2 here), `components/OnlyOfficeEditor.tsx`, `app/account/(authenticated)/documents/[id]/office/page.tsx`, `app/api/documents/[id]/editor-config/route.ts`. Infra runbook + rollback: `RIM_OnlyOffice.md`. Server: `ssh root@104.248.229.126`; OnlyOffice logs `cd /root/onlyoffice && docker compose logs --since 3m onlyoffice-docs`.

### Session 154 (2026-06-21) — OnlyOffice office documents: feature spine built on a branch; needs Vercel env + deploy to test

Decided + built the spine of office-document editing for hub documents via **self-hosted OnlyOffice**. **Four commits on branch `claude/onlyoffice-docs` — NOT merged, NOT deployed** (prod app + DB untouched). The OnlyOffice **server is live** on the LiveKit droplet. Full narrative in `session-log.md` (session 154); per-tool reference + infra runbook in **`RIM_OnlyOffice.md`**.

**Done (branch + live infra):**
- **Slice 0 (live):** OnlyOffice Docs Community at `docs.rootedinmindfulness.org` — isolated stack + header shim on the LiveKit droplet, Caddy L4 route + LE cert. Verified docs 200 / livekit 200.
- **Slice 1:** `HubDocument` generalized (docKind / storageKey / version / visibility, nullable hubId, `HubDocumentPlacement` join, enums) + idempotent `onlyoffice_documents_v1` migration + `lib/documentAuth.ts` (central `canAccessDocument` / `canEditDocument`).
- **Slice 2:** the save loop — `lib/onlyoffice.ts` (HS256 JWT, config builder) + `editor-config` / `callback` / `download` routes. Reviewed + hardened.
- **Slice 3a:** the editor surface — `OnlyOfficeEditor` component + full-screen `/account/documents/[id]/office` + `oo-` CSS.

**NEXT SESSION — opening moves, in order:**
1. **Jesse:** add to Vercel env — `ONLYOFFICE_URL=https://docs.rootedinmindfulness.org` and `ONLYOFFICE_JWT_SECRET` (value: `cat /root/onlyoffice/.env` on the droplet — straight into Vercel, never chat).
2. **Deploy the branch to a preview** — the build runs `migrate.mjs` (applies `onlyoffice_documents_v1` — additive, idempotent) and brings the routes + editor surface live against the live `docs.` server.
3. **Seed one OnlyOffice doc + open it** at `/account/documents/<id>/office` → confirm the loop round-trips (edit → close → version bumps + new blob in storage).
4. Then build the rest:
   - **Slice 3b** — create flow + blank `.docx/.xlsx/.pptx` templates. **Open decision:** how to generate valid blanks — a library (docx / exceljs / pptxgenjs), committed binary templates, or hand-rolled OOXML (`.pptx` is the hard one; can't test locally, so decide with testability in mind).
   - **Slice 4** — sharing/visibility UI (share-with-hubs picker + visibility dropdown + shared badges) + the master directory `/account/documents` (per-hub sections gated by `canAccessDocument` + a Community/Projects section). *Guard the placement create-path: reject `hubId === document.hubId` so the origin isn't double-listed (reviewer note).*
   - **Slice 5** — migrate existing plain native hub docs → `.docx` (server-side, reversible).
   - **Slice 6** — RIM-access→OnlyOffice-mode polish, named co-edit, mobile (Community mobile editing is limited — weigh the nonprofit Enterprise discount), the **comment-title fix** (`HubConversationThread.title` → nullable + ~15 consumer surfaces; doc-attached threads drop the required title), OnlyOffice welcome-page hardening.

**In-session task list mirrors the slices: #1–#3 complete, #4 in progress (3a done), #5–#7 pending.**

**Don't re-derive:** the whole architecture + decisions are in `RIM_OnlyOffice.md` and the session-log. Docs are now RIM's first hub-optional / multi-hub resource (placement model); doc access is doc-level via `canAccessDocument`; the OnlyOffice callback is the one deliberate non-session-gated route (JWT-only).

### Session 153 (follow-on, 2026-06-17) — Monthly recurrence is now first-class — on `main` & deployed; deployed verification + two data fixes pending

After the consolidation closing, shipped a separate slice (LoriLee's report: once-a-month programs showed a stale fixed date). **One commit `981e281` on `main`, deployed.** No deps/env/services/schema change. Diagnosis came from a 14-agent audit that corrected my first read. Full record in `session-log.md` (session 153 follow-on).

**Shipped + live:** a MONTHLY branch in `lib/scheduleUtils.ts::isOccurrenceOnDate` — match the start date's weekday + position-in-month ("last Sunday", "2nd Wednesday"; honoring interval + count; reuses the existing weekday-occurrence helpers; "last" stays last). All nine occurrence surfaces inherit it; the session-room **join gate for monthly programs is fixed** as a bonus (it previously opened only on the first session). Labels read "Last Sunday of the month," kept identical across the four copies (programUtils, dateLabel, ProgramEditor preview, migrate.mjs recache) so the recache can't clobber it; `buildDateLabel` case-normalized (its branches were silently dead). No schema change — the pattern derives from the existing Start Date. Verified: date-math simulation + `tsc` + reviewer (no showstoppers).

**OPEN — deployed verification + data fixes (none blocking):**
1. Set a program to Monthly (start date on the intended weekday) → confirm it appears on the right future dates on This Week / Scheduler + the card reads "Last Sunday of the month."
2. Prod check: `SELECT slug, "startDatetime", "recurrenceFreq" FROM "programs" WHERE "recurrenceFreq" ILIKE 'monthly'` — see which programs the change relabels/repeats.
3. **Data (UI):** set the Nature Meditation walks to Monthly + the right start date; correct Recovery Dharma's end time ("9:30–7 AM" is a bad end-time on the row).

**Follow-up:** the `.ics` "add to calendar" for monthly still places it by date-of-month — backlog `2026-06-17-004` (needs CT `TZID`; also fixes a pre-existing weekly `BYDAY` drop). A plain-English update for LoriLee was drafted in-chat.

### Session 153 (2026-06-17) — Member-profile consolidation: assign hubs from the registry + retire the HOST role — both on `main` & deployed; deployed-site verification pending

Built the teed-up "assign hubs from the member page," then consolidated it after Jesse found it cumbersome ("two places to add to a hub"). **Two commits on `main`, deployed.** No new deps/env/services. One migration `retire_host_role_v1` (no schema change — strips the plain HOST role from users + course `requiredRoles` after ensuring host-team membership). Full record in `session-log.md` (session 153) + the new `RIM_MemberRegistry.md`.

**Shipped + live:**
- **Member profile = two clear controls.** *Hub memberships* (Teams): every active hub as Off/Member/Coordinator — the one place to set team membership; role-derived hubs (Courses ← Teacher, Registrar ← Registrar) locked "via … role" (POST/DELETE 409). *Roles & access*: Admin / Guiding teacher / Registrar / Teacher / **Scheduling manager** (HOST_MANAGER relabeled). HOST + SUPPORT off the UI.
- **Plain HOST role retired** — host-team *membership* is the source of truth for being a host (capability + scheduler + tool access already read membership; verified before retiring). `roleDerivedHubs()` drives the locks; `lib/removeHubMembership.ts` shares the FK-safe cleanup; new route `/api/admin/members/[id]/hubs` (ADMIN+REGISTRAR; GT stays out by design — it isn't ADMIN).
- **Legacy pool hidden from all three person-pickers** (hub search, household add, instructor picker); admins still pre-stage legacy people by id from the profile.

**OPEN — deployed-site verification (none blocking):**
1. **The key check:** a current host can still **enter a live session + claim a slot** (proves the membership-is-source-of-truth switch held). Read the deploy log for `retire_host_role_v1: stripped HOST from N user(s) + M course gate(s)`.
2. Member profile shows Roles & access + Hub memberships; a teacher's Courses row is locked "via teacher role"; host-team is an editable row.
3. Set someone host-team → Coordinator → they get host-team coordinator authority without a role.
4. Pre-stage a legacy person (`?pool=legacy` → their profile) onto a hub → sticks.

**NEXT / queued:**
- Optional cleanup (backlog `2026-06-17-003`): dead `addingHost`/`sendHostRoleAssignmentEmail` path + residual `ROLE_COLORS.HOST`; a "filter registry by hub/team" now the HOST filter is gone.
- s152 ops still open: real-session media test, key-only SSH (`2026-06-17-001`), secret rotation (`2026-06-17-002`).

**Memory candidates (step 7b — awaiting Jesse's confirm):** (1) *feedback* — when a new control overlaps an existing mechanism (roles auto-creating hub memberships + a new hub panel = "two places to add to a hub"), proactively unify into one source-of-truth surface rather than ship the second path; Jesse spots the duplication immediately. (2) *feedback/user* — offered safe-slice vs full-fix (retiring HOST), Jesse chose the full clean fix; he prefers the correct end-state over minimal-risk patches *when the core is verified safe* (read the gates first).

### Session 152 (2026-06-17) — Server hardening: DO Cloud Firewall + OS updates/reboot + SSH IP-restriction — done & verified; member-page hub-assignment still the teed-up next code build

The deferred s150 ops task (backlog `2026-06-16-002`, now closed). **No repo code changed** — DigitalOcean console + server SSH only. Full record in `session-log.md` (session 152); the server-ops reference (firewall ruleset, SSH model, management commands) is in `RIM_SessionRoom.md` → "Server operations & hardening."

**Shipped + verified:**
- **DO Cloud Firewall `rim-livekit`** attached to the droplet (`RIM-LiveKit`, `104.248.229.126`). Inbound whitelist: **TCP 22 from Jesse's IP only (98.144.129.15)**, 443, 5349, 7881; **UDP 3478, 50000–60000**; outbound default. 7880 (internal), 80 (unused), 2019/6379/53 (localhost) all closed. Verified after attach: 7880 times out, SSH works, HTTPS 200, 5349/7881 open. (Built by Claude driving the DO console via the Chrome extension — Jesse asked me to.)
- **OS updates + reboot** — 52 packages incl. kernel 6.8.0-71 → **6.8.0-124**; rebooted; stack auto-returned (Docker enabled + `restart: unless-stopped`). Verified from Jesse's Mac: post-reboot HTTPS 200, ports correct.
- **SSH 22 IP-restricted** — the agreed substitute for key-only, because Jesse's SSH authenticates by **password** (his Secretive/Secure-Enclave key isn't in the droplet's authorized_keys). Password auth still on but reachable only from his IP; DO web Console is the out-of-band recovery.

**Doc corrections (read the live config, not the s150 doc):** the running `livekit.yaml`/`ss` showed **5349 (TURN/TLS) is live** (the doc omitted it) and **80 is unused** (TLS-ALPN on 443) — so the ruleset added 5349, dropped 80, and closes the internal 7880.

**OPEN — follow-ups (none blocking):**
1. **Real-session media test** (gold standard) — a live join to confirm audio/video flows end-to-end through the firewall (UDP media + TURN). Port probes pass; a live join is the proof.
2. **True key-only SSH** (backlog `2026-06-17-001`) — wire Jesse's Secretive key into SSH (`authorized_keys` + `IdentityAgent` in `~/.ssh/config`), confirm passwordless login, then a `00-hardening.conf` disabling password auth (must sort before `50-cloud-init.conf`). ~10 min.
3. **Rotate `LIVEKIT_API_SECRET`** (backlog `2026-06-17-002`) — pasted in the s150 setup chat; rotate when no session is live.

**NEXT CODE BUILD (unchanged from s151) — assign hubs from the member page** (mapped + confirmed, ready): a new `/admin/members/[id]` section + ADMIN-gated `/api/admin/members/[id]/hubs` (GET all hubs+memberships / POST add / DELETE remove), reusing `HubMember` + the s146 FK-safe cleanup-on-remove. Connects to the Scheduler **"covers ⇒ member"** invariant. **Architecture note when built:** the Member Registry will *write* hub membership (previously hubs owned their rosters — a deliberate convenience shift; update `RIM_System_Architecture.md` then). **3 decisions to confirm at the start** (recs in caps): roles — ADMIN-ONLY or +REGISTRAR; coordinator — MEMBER-ONLY or include a coordinator toggle; notify on add — SILENT or send hub-welcome.

**Memory candidates (step 7b — awaiting Jesse's confirm):** (1) *user/feedback* — for infra/terminal/server-ops work, Jesse prefers Claude to DRIVE (browser via the Chrome extension; run external checks itself) rather than be handed long command blocks to paste ("I'm not sure what I am doing"); when SSH needs his auth, give ONE short command, not a multi-step block. (2) *reference* — RIM LiveKit server access: droplet `RIM-LiveKit` `104.248.229.126`, SSH root via **password + a Secure-Enclave (Secretive) key that isn't yet in authorized_keys**; a sandboxed Claude shell CAN'T SSH (needs Jesse interactive / the DO web Console out-of-band); now gated by DO Cloud Firewall `rim-livekit`.

### Session 151 (2026-06-16) — LiveKit optimization: RNNoise NC + screen-share fully fixed (custom synchronous focus layout) + sharper share + roster cleanup — all on `main` & deployed; member-page hub-assignment is the teed-up next build

The "optimize quality + cost" follow-on to s150's self-hosting. **9 commits on `main`, deployed. One new dep** (`@sapphi-red/web-noise-suppressor`; dropped `@livekit/krisp-noise-filter`). No env/services/schema/migration/email changes. Full narrative in `session-log.md` (session 151); session-room detail in `RIM_SessionRoom.md`.

**Shipped + verified:**
- **RNNoise NC** (`5353076`) — in-browser replacement for the dead Cloud Krisp. Jesse verified live: *"better than before, no echo, good sound."* Decision (RNNoise > DeepFilterNet) + why in `RIM_SessionRoom.md`. Bell mode preserved (bypasses the processor); echo unchanged (separate concern).
- **Screen share fully fixed** — from "crashes + drops every receiver" to live, stable, sharp, across a 7-round arc. **Final architecture: focus is computed SYNCHRONOUSLY from live tracks** (`d78c5f9`), replacing LiveKit's measuring `CarouselLayout` + the deferred pin-reducer round-trip. **Do NOT reintroduce the pin reducer for focus.** Quality: 1440p capture + `contentHint:"detail"` + 8 Mbps (`dd74f38`).
- **Roster cleanup** (`32ed585`) — first-name + last-initial names; **"Host Volunteer" pill removed** (only session-true Host/Teacher pills render).

**OPEN — verification (none blocking):** Jesse re-tests: (a) roster — names "Nancy L.", no Host Volunteer pill, Host/Teacher stay, no truncation (if still cramped → a per-row ⋯ menu); (b) screen-share sharpness at 1440p/8Mbps (if soft, that's the ceiling; if a weak-link member freezes during a share → add adaptive screen-share layers).

**NEXT BUILD — assign hubs from the member page (mapped + confirmed, ready):**
A new section on `/admin/members/[id]` to view + assign the person's hub memberships, all hubs. Shape: new `components/member-sections/HubMembershipSection.tsx` + a `lib/memberSectionRegistry.tsx` entry + new ADMIN-gated route `/api/admin/members/[id]/hubs` (GET all hubs+memberships / POST add / DELETE remove), reusing `HubMember` + the s146 FK-safe cleanup-on-remove (`app/api/hub/[slug]/members/[userId]/route.ts:226–236`). Connects to the Scheduler **"covers ⇒ member"** invariant. **Architecture note when built:** the Member Registry will *write* hub membership (previously hubs owned their rosters — a deliberate convenience shift Jesse chose; update `RIM_System_Architecture.md` then). **3 decisions to confirm at the start** (recs in caps): roles — ADMIN-ONLY or +REGISTRAR; coordinator — MEMBER-ONLY or include a coordinator toggle; notify on add — SILENT or send hub-welcome.

**Also pending:** **Server hardening** (Jesse's ops task from s150): DO Cloud Firewall (free; NOT ufw — Docker bypasses it), apply OS updates + reboot, optionally rotate `LIVEKIT_API_SECRET`. Deferred follow-ups: vestigial `cohost` metadata cleanup; lint-clean the keep-last-speaker render-time ref (→ useState, `react-hooks/refs`).

**Memory candidate (step 7b — awaiting Jesse's confirm):** *feedback* — for a hard third-party-library bug I can't reproduce locally, READ THE LIBRARY'S ACTUAL MECHANISM/SOURCE (and lean on user diagnostic clues like "works on refresh") rather than shipping incremental guesses; prefer a robust fix that OWNS the logic (compute synchronously, in our control) over patching the library's fragile internals. (The screen-share arc: 2 wrong/incomplete fixes before reading LiveKit's CarouselLayout/reducer source + the CSS led to the synchronous-focus refactor that held.)

### Session 150 (2026-06-16) — LiveKit migrated from Cloud → self-hosted on DigitalOcean (live & verified); next session = optimize quality + cost

**No repo code changed** — the entire change is infrastructure + three Vercel env vars. RIM now runs on a **self-hosted LiveKit server** instead of LiveKit Cloud, to escape Cloud's $0.12/GB bandwidth pricing (which made all-camera 30-person circles ~$260–620/mo). Full narrative in `session-log.md` (2026-06-16); service lines updated in `RIM_Stack_Reference.md` / `RIM_SessionRoom.md` / FEATURES / `RIM_System_Architecture.md`.

**Live now (verified):** server `wss://livekit.rootedinmindfulness.org` — DigitalOcean droplet `RIM-LiveKit` (Ubuntu 24.04, IP `104.248.229.126`, ~$58/mo flat incl. backups), Docker Compose (livekit-server + Caddy/TLS + Redis + TURN), config at `~/livekit.rootedinmindfulness.org/`. Vercel env: `NEXT_PUBLIC_LIVEKIT_URL` / `LIVEKIT_API_KEY` (`APIk48Zv2jGTFGr`) / `LIVEKIT_API_SECRET` (Jesse's password manager + the server's `livekit.yaml`). HTTPS 200 + valid LE certs both domains; RoomService API + token-validate confirmed; admin test room connects. SSH: `ssh root@104.248.229.126`; manage with `cd ~/livekit.rootedinmindfulness.org && docker compose {ps,logs,restart,pull}`.

**⚠️ Current-state change:** **Krisp Enhanced NC is Cloud-only → now INACTIVE.** Sessions run on **browser noise suppression only** (still on for non-teachers). `useKrispNoiseFilter` degrades gracefully (Bell-mode button hidden). Restoring strong NC is the top next-session item.

---

#### NEXT SESSION GOAL — "optimize LiveKit: quality + cost"

Jesse: *"I want to optimize the quality and cost… I actually liked the video quality."* Brief assembled so we start informed.

**THE COST REFRAME (read first):** On Cloud, video quality drove the bill ($0.12/GB) — so the old plan was to tune *down* to 360p to save money. **That rationale is gone.** Self-hosting **bundles bandwidth** (DO droplet includes a few TB; ~$0.01/GB only past that). So **video quality is essentially free within the included transfer → keep the quality Jesse likes.** Optimization is now: (a) keep/validate that quality within server CPU (4 vCPU) + included bandwidth, (b) **replace the now-dead Krisp NC** with a free in-browser AI filter, (c) confirm monthly transfer stays under the droplet allowance (resize before degrading quality).

**A. Current video baseline (the config Jesse likes — `components/VideoRoom.tsx::buildRoomOptions`):**
- Capture **720p** (1280×720), **H.264**, **30 fps**
- Simulcast layers **180p (~160 kbps) · 360p (~450 kbps) · 720p** (top capped by ceiling)
- Bitrate ceiling: **teacher 2.0 Mbps · co-host/speaker 1.5 · listener 1.5**
- Audio: teacher 128 / speaker 96 / listener 64 kbps; **DTX off**
- **adaptiveStream on, dynacast on** (auto-downscale small tiles / pause unwatched layers)
- → He likes this. **Don't reflexively drop to 360p.** Reconsider only if 4 vCPU CPU or bandwidth says so — resize the droplet before degrading quality.

**B. Echo + noise reduction — options & costs (self-hosted context):**

| Layer | Status now | Self-hosted? | Cost |
|---|---|---|---|
| Echo cancellation (browser WebRTC, all profiles) | **Active** | Yes (browser-native) | $0 |
| Browser noise suppression (non-teachers) | **Active** | Yes (browser-native) | $0 |
| **Krisp Enhanced NC** (`useKrispNoiseFilter`) | **INACTIVE** (Cloud-only) | **No** | — (was bundled on Cloud) |
| **DeepFilterNet** in-browser AI NC | not built | **Yes** (custom audio track processor, sibling to `BrightnessProcessor`) | **$0** — newer/stronger; **recommended replacement** |
| **RNNoise** in-browser AI NC | not built | Yes (proven — Jitsi uses it) | $0 — fallback |
| **ai-coustics** | not built | Yes (own license key) | **paid**, usage-billed, top-tier — only if browser+AI isn't enough |
| DTLN / server-side agent NC | not built | Yes but heavy (agent pipeline, server CPU) | $0 but **skip** — wrong shape for human meetings |

→ **Plan:** wire a free in-browser AI filter (DeepFilterNet → RNNoise fallback) as an audio track processor; when it's on, turn the browser's basic NS *off* on that path (don't stack — over-scrubs sibilants). Keep/repurpose "Bell mode" to toggle the new filter off for bells/bowls. (Integration packages: `@sapphi-red/web-noise-suppressor`, `@shiguredo/noise-suppression` — both wire into LiveKit's `setProcessor`.)

**C. Server hardening (do before relying on it for a real production session):**
1. **DO Cloud Firewall** allowing ONLY: 22/tcp · 80/tcp · 443/tcp · 7881/tcp · 3478/udp · 50000–60000/udp. (Firewall is currently OFF. Use a DO Cloud Firewall, **not `ufw`** — Docker publishes ports straight through iptables and bypasses ufw.)
2. Apply pending OS updates + the **reboot** the server is requesting (also proves auto-restart: compose `restart: unless-stopped` + Docker daemon enabled).
3. Optionally **rotate `LIVEKIT_API_SECRET`** (it was pasted in the setup chat) — regenerate in `livekit.yaml`, update the three Vercel vars, redeploy.

**D. Real-session test** (the admin test page is a bare harness — the only faithful test): in a live session confirm avatars show (camera off) and **End-for-All** actually ends the room.

**Code touch-points next session:** `components/VideoRoom.tsx` (`buildRoomOptions`), `components/session/RIMConference.tsx` (swap `useKrispNoiseFilter` → new processor), a new `components/session/` audio processor (model on `BrightnessProcessor.ts`), `RIMControlBar.tsx` (Bell-mode → new filter toggle). Per CLAUDE.md: read `RIM_SessionRoom.md` + produce a connections map before building.

**Memory candidates (step 7b — awaiting Jesse's confirm):** (1) *project* — LiveKit is now **self-hosted on DigitalOcean** (the durable infra fact, for fast recall next session); (2) *feedback* — **verify external service pricing/specs from live sources before quoting** (this session I gave confident numbers from memory that were wrong 3× — LiveKit bandwidth cost, Cloud all-camera total, Hetzner-US price — each corrected by the live page; the cost was trust + time). Confirm or discard.

### Session 149 (2026-06-15) — Session-room roster cleanup: ask-to-unmute on the tile, Mute All to the control bar, centered bar, decluttered list — shipped to `main` & deployed; live verification pending

A focused LiveKit session-room cleanup from Jesse's hands-on use. **One commit `5f8c13c` on `main`, deployed. UI-only — no new deps/env/services, no schema, no API change** (Mute All reuses `/api/livekit/mute-all`). Four files (`components/session/{RIMParticipantTile,ParticipantsPanel,RIMControlBar}.tsx` + `custom.css`). `tsc`-green, CSS brace-balanced (5062/5062), reviewer-gated (no showstoppers). Full record in `session-log.md` (2026-06-15) + `RIM_SessionRoom.md` ("Control bar layout, Mute All, roster cleanup").

**Shipped (live):**
- **Ask-to-unmute on the tile** — a muted participant's top-right hover slot shows "Ask to unmute" (`.rim-tile-ask`, co-host) where Mute sits when unmuted; same `UNMUTE_REQUEST_TOPIC` packet. Kept on the roster row too (tiles have no hover on touch → the panel is the mobile path).
- **Name legibility** — the always-rendered empty `.rim-pp__signal` slot (a 32px phantom gap before every name) now renders only for a raised hand/reaction; the mic glyph is gone. Rows are a clean name + role pill.
- **Mute All → control bar** — moved off the list footer, grouped with the co-host controls beside Bell mode; label flashes "Muted N", a real failure shows `.rim-cb__notice`.
- **Control bar centered** (Zoom-style) — `.rim-cb` is a `1fr auto 1fr` grid; `.rim-cb__main` truly centered, End pinned right in `.rim-cb__end-zone`; ≤768px collapses to a centered flex-wrap.

**OPEN — live verification (needs a real session + a co-host + 2 devices; none blocking):**
1. Hover a **muted** person's tile → "Ask to unmute" appears next to where Mute would be → click → they get the unmute prompt.
2. Participant list shows **full names, no leading gap**; a raised hand still shows "1 ✋".
3. **Mute All** on the bottom bar (co-host) near Bell mode → mutes everyone, label flashes "Muted N"; a paused co-host sees the failure notice.
4. No mic glyph on list rows.
5. The control cluster is **centered**, End far right — check desktop **and** a phone (centered wrap, End reachable, nothing clipped).

**Memory candidate (step 8b — awaiting Jesse's confirm):** when moving an action onto a **hover-only surface** (a video tile), keep a **touch-reachable** path for it (the roster), because tiles have no hover on phones — the participant panel is the only per-person action surface on touch. (A reusable UI-affordance rule beyond the session room.) Confirm or discard.

### Session 148 (2026-06-13) — Public-site design pass: warm palette + program-detail redesign + flush-nav decision — all on `main` & deployed; verification pending

A long iterative design session on the **public pages** (the rebuild). **UI-only** — CSS + `app/programs/[slug]/page.tsx` + `components/Nav.tsx`; **no new deps/env/services, no schema change.** Pushed direct to `main` (push-to-see loop; Jesse co-edited + committed himself between turns — the warm-ground value is his commit `a1e85b2`). Interleaved with session 147's session-room commits. Full design-system record + the two tombstones in the new **`RIM_Public_Pages.md`**; narrative in `session-log.md`.

**Shipped (live):** warm three-shade palette (**Bridal Heath `#fffbf4`** / **Dawn Pink `#f4efe8`** ground / **Pearl Bush `#e7e0d7`**); main blue `#135274`→`#31576d`; `body{margin:0}` global frame fix; `--card-shadow` card-lift token; slim flush nav (Programs / Get Involved / Members + Donate); program-detail redesign (balanced hero + category eyebrow, quote card on the seam, Details as a white card with Register-as-pill-button, Notes as a recede panel).

**Tried & reverted (don't re-propose — see `RIM_Public_Pages.md`):** the Esther-Perel **floating nav pill** (competed with the quote card → reverted to the flush bar) and **chapter eyebrows + a closing band** (sparse scaffolding of a rich pattern read cheap).

**OPEN — next steps (none blocking):**
1. **Deployed-site verification** — the program page across a few programs: a drop-in (Awakening The Heart) for "no registration needed"; a registered one (EDS, where Jesse's logged in) for the "you're registered" CTA; one with Notes (Qigong) to see the Pearl Bush recede panel in flow. Confirm the flush nav + warm ground feel right across pages.
2. **Home page** — its alternating `.rim-section--grey` sections flatten on the warm ground (they use the primary token); repoint to the Pearl Bush secondary so the rhythm returns (backlog `2026-06-13-002`). The home hero/nav seam is also worth a look now the float's gone.
3. **Member-area teal sweep** — hardcoded `#135274` + `rgba(19,82,116)` tints in hub/hs/admin UI the token flip didn't reach (backlog `2026-06-13-001`).
4. **Course landing page** — bring `/course/[slug]` into the new palette/card system, matching the *shipped* program-page language (NOT the reverted eyebrows/band) (backlog `2026-06-13-003`).

**Process adopted:** new *compositional* design elements (bands, section patterns, new heading languages) → a `claude/*` preview branch for a look before production; spacing/color/token tweaks stay direct-to-`main`. (The chapters/band revert is why.)

**Memory candidates (step 8b — awaiting Jesse's confirm):** (1) **Jesse co-edits the repo between turns** — verify the working tree before committing; his commits interleave with mine. (2) **New compositional design elements → preview branch first** (the process rule above). (3) **A sparse version of a rich pattern reads as cheap, not minimal** — design lesson from the chapters/band revert. (4) **Esther Perel is the reference *in spirit*, not literally** — the float doesn't fit RIM (the quote card competes).

### Session 147 (2026-06-11) — Echo diagnosis (strategic, no code) + session-room batch (5 features) + mute hotkeys — shipped to `main` & deployed; verification + 2 decisions pending

Three arcs (echo · session-room batch · mute hotkeys). **Arc 1 — echo (no code):** diagnosed the self-echo problem ("people hear themselves echoed through me") end-to-end and concluded it's an **endpoint** problem, not a code bug — echo cancellation is already on for all profiles; the source is a mic-on-one-device / sound-on-another split (Jesse's wireless mic → Universal Audio Volt → computer speakers). **Decision:** fix endpoint-side (Jesse testing **AirPods output-only**). Krisp BVC (~$55–90/mo Ship plan) shelved on cost; native app rejected (reaffirms s120); "Layer 1" in-room nudge scoped but not built (Jesse declined). Platform choice stands. **Arc 2 — session-room batch:** one commit `cb9ab8a` on `main`, deployed. **No new deps/env/services.** New `SessionBan` model + migration `session_bans_v1`; new route `/api/livekit/remove-participant`. Reviewer-gated (10 findings, 5 fixed pre-commit), `tsc`-green. Full narrative in `session-log.md` (2026-06-11 session 147).

**Shipped (5 features in `cb9ab8a`):**
- **Crash safety net** — `RoomErrorBoundary` wraps `VideoRoom`; the app had NO error boundary, so a render crash (the screen-share *receiver* crash) white-screened every remote participant. Now contained → "Something interrupted the room — Rejoin" + `[rim-room-crash]` log.
- **Context-aware Step-In + confirm** — label reads "No host yet — Step in" / "Take over as host" by detected host-presence; confirm panel before acting (Nancy clicked it cold).
- **Ask-to-unmute** — co-host invites a muted member via data channel; recipient one-taps to unmute (can't force a mic on).
- **Remove participant + session bans** — `/api/livekit/remove-participant`, 3-option confirm (rejoin-able / for-the-session / cancel); bans enforced at `/token` + `/guest-token` + `/step-in`; honest "You've been removed" screen.
- **Chat + Participants split** — share the right column on desktop, overlay on phones.
- **Mute hotkeys** (follow-on commits `ca885ff` + `84e151c`) — `M` toggles mute for *everyone*; hold-`Space` push-to-talk for *co-hosts/teachers only*. The $0 resolution of the echo arc (mute while others talk; the teacher can't use headphones — open speakers + live bell + presence). Safety: engages-only-when-muted, typing-guarded, window-blur + visibilitychange backstops; reviewer-verified no stuck-open-mic race.

**OPEN — verification + decisions (none blocking deploy):**
1. **Screen-share two-window repro** (Jesse) — console open on the *viewer*, share → paste the `[rim-room-crash]` entry so we fix the specific throwing line. Backlog `2026-06-11-001`.
2. **Decision (Jesse):** should a co-host be able to remove/ban the assigned Host? Built as "any co-host" for now; mute has the same peer surface but a ban's blast radius is larger. Backlog `2026-06-11-002`.
3. **Echo:** Jesse tests AirPods/headphone output-only. Layer 1 + BVC shelved (backlog `2026-06-11-003`).
4. **Deployed-site checks:** confirm `session_bans` table in the deploy log; a co-host Remove (both modes) + the removed person's screen; ask-to-unmute round-trip; chat + participants side-by-side on desktop; Step-In label/confirm; **`M` toggles your mic (and types normally in chat); a co-host holding `Space` talks then auto-re-mutes on release.**

**Memory candidates (step 8b — awaiting Jesse's confirm):** listed at session close — (1) **don't accept platform-limitation excuses** (when Jesse reports a problem other tools don't have, find the real cause + real options, don't stop at "the browser can't"); (2) **the echo diagnosis + Jesse's audio rig** (split-device source; the priced options ladder); (3) **cost+integration bounds solutions** (RIM left Zoom for both; recurring per-minute fees are a hard sell). Confirm or discard.

**Guest-ban limitation (documented):** a removed guest can rejoin under a different name (guest identities mint fresh per join); host re-removes. Member bans are airtight.

### Session 146 (2026-06-10) — Scheduler membership invariant ("covers ⇒ member") + per-hub gating + every-hub coverage notifications — all shipped to `main` & deployed; deployed-site verification pending

From Jesse's worry that the shared Scheduler across hubs was entangled (symptom: in greeter, **Nancy showed as covering sessions but was missing from the member pill**). Evaluated the shared-component approach first — **verdict: keep it** (the audit found no cross-hub leaks; the bug was a data-integrity gap, not entanglement) — then shipped five fixes that all traced to one root insight: the `HostAssignment` *ledger* and the `HubMember` *roster* were two sources of truth with nothing keeping them in sync. **Five commits on `main`, all deployed. No new deps / env / services.** Two flag-guarded migrations (`backfill_host_team_membership_v1`, `heal_membership_orphan_assignments_v1`); no schema change. Full narrative in `session-log.md` (2026-06-10 session 146).

**Shipped:**
- `1c22a3c` — the membership invariant + **per-hub Scheduler gating** (`lib/hubAuth.ts::canAccessHubScheduler`: member of the hub OR HOST_MANAGER/ADMIN/GT) + create/cron/removal enforcement + Step-In auto-enroll + the host-team backfill + the live orphan heal.
- `890c50c` — member-view pill filter is claimant-aware (`sessionBelongsTo`) so a greeter's signups show.
- `8234161` — empty "Mine" state uses the hub's coverage verb.
- `d3e4457` — multi-claim header speaks the coverage noun ("We have N greeters").
- `2a87e1a` — every scheduler hub gets the new-coverage email (aux hubs on create + edit-add; reuses `new-program-needs-host`, no new slug).

**Process:** CLAUDE.md closing ritual gained **step 4e** (email-template audit — verify new/changed `sendTemplatedEmail` slugs are seeded so they appear in `/admin/emails`), per Jesse's ask.

**OPEN — deployed-site verification (none blocking):**
1. Confirm both migrations in the Vercel deploy log — especially the **heal's orphan list** (Nancy among them). **If anyone the heal removed should actually be on that team, add their hub membership** (the hub's Members page) and they re-sign-up. The heal removes only *future* coverage, and logs every row.
2. Greeter: click a member in the pill → their signups show; a session row header reads "We have N greeters."
3. A **host-team-only coordinator can no longer edit the greeter board** (intended — needs greeter membership or HOST_MANAGER/ADMIN/GT). Confirm no one who legitimately needs cross-team reach is blocked.
4. Tag a program for greeter coverage (editor → Hosting & Access) → the greeter team gets "may need Greeter coverage"; re-saving the editor sends nothing.

**Deferred:** backlog `2026-06-10-001` — validate `appliesToFormats` overlap on the coverage-hub write routes (reviewer nit; the editor already prevents mismatches in normal use).

**Memory candidate (step 8b — awaiting Jesse's confirm):** feedback **"two sources of truth"** — when one concept is read from two tables (a ledger vs a roster, "who's covering" vs "who's on the team"), nothing keeps them in sync; it presents as a UI/entanglement bug but is a data-integrity gap — enforce the invariant at every write + clean up on delete, never patch the display alone. (The session's other lessons are already covered by `feedback-measure-before-agreeing` / `feedback-shared-surface-audit` and the new CLAUDE.md step 4e.)

### Session 145 (2026-06-09) — Member migration (Memberstack → RIM) end-to-end + pre-launch fixes — all shipped to `main` & deployed; deployed-site verification pending

**Eight commits on `main`, all deployed. No new deps / env / services.** One new `User.isLegacyUnclaimed` column + 4 migrations (`user_is_legacy_unclaimed_v1`, `seed_welcome_back_email_template_v1`, `normalize_user_names_v1`, `update_coverage_email_copy_v1`). Full narrative in `session-log.md` (2026-06-09 session 145).

**Shipped:**
- **Member migration** — silent import → quiet `isLegacyUnclaimed` pool → promote-on-login (fresh agreement, both `/login` and `/join` doors); the registry hides the pool by default (`?pool=legacy` reveals it); welcome-back email; admin **"Send sign-in code"** helper. The browser import tool imported ~1,516 members, then was **removed** (restorable: `git revert 3c543da`).
- **Legacy pool** shows a muted **"Unclaimed"** status, not "Active".
- **Welcome-back** page copy on `/account/welcome` for returning members ("you're on a new site… revisit the commitments").
- **Name normalization** — `lib/nameCase.ts::toProperName` (conservative: only all-caps/all-lower; mixed-case protected); one-time cleanup + on-entry (join / registration / welcome / add-member). NOT on admin member-edit or profile self-edit (the type-exactly hand-fix path).
- **Auth-page CSS** — `/login`, `/login/check-email`, `/login/error` full-width spill fixed (Webflow-shim gap — those pages' classes lived only in the un-loaded `rim.webflow.css`).
- **Hub terminology** — `getHubCoverageCopy()` wired through the dashboard welcome panel ("you're on the {Noun} team"), the hub home/sidebar count (AV/greeter/peer-led now show their own noun + hub-scoped), and 4 re-seeded emails (hub-neutral; new-program gains `{{coverageNoun}}`).

**OPEN — next steps (deployed-site verification, none blocking):**
1. Confirm the deploy log shows `normalize_user_names_v1` (the before→after name audit) + `update_coverage_email_copy_v1` (4 ✔ lines). Review the 4 re-seeded templates + the welcome-back letter at `/admin/emails` — those are Jesse's to tune.
2. **Hand-fix the name oddballs** the conservative rule under-corrects: all-caps Mc/Mac (→ "Mcdonald"), 2-letter initials ("TJ"→"Tj"), the `RIM-AV` account. Use the member **EDIT** screen (type-exactly — it doesn't re-normalize).
3. **AV welcome-panel** is one-time (`hostWelcomeSeenAt`); to *see* the AV/greeter version, reset that flag on an account (Neon console) or use a fresh AV-staged test login.
4. **Other public pages** (`/donate`, kalyána-mittá, volunteer) share the auth-pages Webflow-shim gap → likely full-width. Part of the public-page rebuild; `/donate` is launch-relevant — extend the shim or rebuild.

**Deferred / queued:** legacy-pool **triage view** (surface the `legacy*` activity columns — last login / activity count / true "member since" — + a "never logged in" filter; ~495 of 1,516 never logged in) → backlog `2026-06-09-005`. Member ID intentionally not imported (points only at the retired system).

### Session 144 (2026-06-09) — Pre-launch session-room integrity audit + hardening — merged to `main` & deployed; real-device verification pending

Jesse asked for a thorough integrity check of the LiveKit session room (the Zoom alternative) before go-live. Ran a multi-agent integrity audit (8 dimensions · adversarial per-finding verification · coverage critic → 30 agents, 21 findings), then fixed everything real. **9 commits, 17 files, reviewer-gated + `next build`-green — fast-forwarded to `main`, pushed (`origin/main` in sync → Vercel auto-deployed to `rim-next.vercel.app`); branch `claude/session-room-hardening` deleted.** No new deps/env/services; **no DB migration** (STEPIN-1 is a runtime advisory lock; the one schema touch is a comment).

**Fixed:** TOKEN-1 (member room-bypass) · CHAT-1 (guest DM read/spoof) · TOKEN-3 · CHAT-2 (chat window gate) · rate-limiting (chat + guest-token) · CONN-1 (connect-hang, critical) · CONN-2/3 (truthful disconnects) · CONN-4 (reconnect banner) · JOIN-1 (no-camera lockout) · End-for-All silent-failure · MUTE-1/mute-all resilience · CHAT-3 (mute feedback) · STEPIN-1 (two-hosts race) · LAYOUT-1 · TOKEN-2 (guest badge) · touch targets · iOS-zoom · Escape-to-close · TG-3 doc. (Per-commit map in `session-log.md` 2026-06-09 session 144.)

**OPEN — the one remaining gate:**
1. **Real-device verification — the true pre-launch gate** (Jesse only, needs 2+ devices/browsers): End-for-All actually ends the room (incl. the stale-teacher-token 403 path) + now *says so* on failure; two volunteers Step-In at once → exactly one Host; kill/restore WiFi mid-session → "Reconnecting…" → recovers, or a truthful "Connection lost — Rejoin" (not "Session ended"); same member on phone+laptop → "You joined from another place"; iOS join with no second permission prompt + a mic-only desktop joins audio-only; control bar reachable at 360–390px; a guest shows the "Guest" badge + the chat rate-limit holds.

**DONE this session (verified against git, not prose):** the 9 code commits + the closing-ritual docs commit (RIM_SessionRoom.md, session-log, FEATURES, RIM_System_Architecture, RIM_Stack_Reference, this file) were fast-forwarded to `main` and pushed — `origin/main` is in sync, so Vercel has auto-deployed → `rim-next.vercel.app`. The `claude/session-room-hardening` branch was deleted. No migration runs on deploy.

**Deferred (documented decisions — do NOT silently forget):**
- **TG-1 (DST gate drift)** — a recurring *evening* program whose start time was stored in the other DST season has its gate window an hour off vs the public-page time. Jesse chose a **data-check** (check/normalize affected programs' stored times) over changing time math shared across the dashboard/scheduler/This-Week pre-launch. The common Join path (dashboard→gate) is self-consistent and never locks anyone out; only a direct-navigate-from-the-public-page is affected.
- **TG-2 (recurrence-count cutoff)** — off-by-one in both directions for fixed-length count series; dormant (live sits are open-ended) → post-launch.
- **Control-bar 2-row wrap + End placement at 360–390px**, and **full popover focus-trap / return-focus** → need real hardware (manual pass).
- **BrightnessProcessor** mobile perf — measure before changing (don't disable blind).
- **Empty-room cleanup** — verify LiveKit Cloud's default reclaims empty rooms (operational; End-for-All-fails-loudly + the door time-gate backstop it).
- **Recording** — off & staying off (Jesse); documented, no indicator.
- **Guest-to-guest chat identity binding** — the CHAT-1 prefix check closes the member-impersonation vector; binding to the verified LiveKit token (guest-on-guest) is a smaller post-launch hardening.

**Audit artifact:** full findings + adversarial verdicts + the coverage critic's manual checklist are in the workflow output (`tasks/wqgwkr4vj.output`) — useful if a deferred item is revisited.

### Session 143 (2026-06-09) — Coverage-authority follow-ons (s142 backlog 001/002/003) + coordinator-is-hub-manager memory — shipped to `main` & deployed; deployed-site verification pending

Built the three deferred session-142 backlog items in one slice + the reviewer's `userId`-index fix. **One commit fast-forwarded to `main`. No new deps / env / services.** New `User.hostWelcomeSeenAt` column + `userId` indexes on `host_assignments`/`standing_assignments`; migrations `user_host_welcome_seen_v1`, `host_assignment_user_indexes_v1`. Full narrative in `session-log.md` (2026-06-09 session 143).

**Shipped:**
- **Coordinator sub-on-behalf (001)** — `POST /api/host/sub-requests` gate widened to `isManager || isHubCoordinator(assignmentHubSlug)`; an "Ask the team to cover" button on covered rows opens a new host-named `ask-cover-for` modal. Completes the coordinator coverage role model (assign/remove/reassign/clear/request-sub).
- **Greeter removal notify (002)** — `DELETE /api/host/assignments/[id]` now emails the removed person when `removedUserId !== self` (coordinator-remove notifies; self-cancel stays silent). Reuses the pre-threshold-gated `host-assignment-removed` template. Server-only.
- **First-login host panel (003)** — one-time dismissible `HostWelcomePanel` on the dashboard for a just-onboarded pre-staged host; gated on `hostWelcomeSeenAt === null` + hub membership; `POST /api/account/host-welcome-seen` dismiss endpoint. Per Jesse (option A) existing hosts also see it once.
- **`userId` indexes** on `host_assignments` + `standing_assignments` (reviewer finding; also speeds the existing today-host query).
- **Memory:** `coordinator-is-hub-manager.md` written + indexed (the pending s142 candidate, confirmed by Jesse).

**OPEN — next steps:**
1. **Deployed-site verification** (003 only comes alive once `migrate.mjs` runs on the Vercel deploy — it creates the column + indexes). Highest-value: (a) as a **hub coordinator** on a covered row → "Ask the team to cover" → host-named modal → the team gets the cover request and the row flips to "[host] needs help"; (b) a **greeter coordinator removes a signup** → that person gets the removal email, but a **self-cancel** sends nothing; (c) a **staged-then-onboarded host** lands on the dashboard → sees the welcome panel once → Dismiss (or follow the link) → it doesn't return on reload.
2. **s142's five-ship verification still stands** (the staging round-trip especially) — carried forward below.

**Behavior audit (step 8b):** no new memory candidates — the session ran to plan; the index gap was a code finding, not a behavior lesson. The one pending candidate (coordinator-is-hub-manager) was written + confirmed.

### Session 142 (2026-06-08) — Pre-launch host staging · "No host needed" · coordinator coverage authority · multi-hub Scheduler consistency — all 5 shipped to `main` & deployed; deployed-site verification pending

**Five commits on `main`, all deployed. No new deps / env / services.** One new `Program.hostingRequired` column + migration `program_hosting_required_v1`. Full narrative in `session-log.md` (2026-06-08 session 142).

**Shipped (in order):**
- **Silent host pre-staging** (`5d640bd`) — "+ Add member" in the Member Registry (`POST /api/admin/members`, staged account: agreedToTerms:false / emailVerified:null / no email) + a **pre-threshold email gate** (`recipientHasOnboarded` + `PRE_THRESHOLD_GATED_SLUGS` in `lib/email.ts`; `getHubNotificationRecipients` excludes emailVerified:null) + cleanup cron no longer deletes role/hub-holders. On `/join` the account is reused by email, name updates, schedule/hub stays attached.
- **"No host needed"** (`8678c26`) — `Program.hostingRequired` toggle on the Hosting & Access tab; self-led programs excluded from the Scheduler + rotations + needs-host email; still visible on public/dashboard/program page; room unaffected.
- **Coordinators remove/reassign hosts** (`f51b472`) — unclaim/delete/reassign widened to `isHubCoordinator(assignment.hubSlug)`; "Remove" + "Reassign to me" on covered rows; removed host is notified.
- **Coordinators clear cover requests** (`9d815b8`) — sub-request cancel widened to hub coordinators; "Clear request" on needs-sub rows.
- **Scheduler multi-hub consistency** (`fed2c47`) — scoped "No host needed" to the **primary host only** (auxiliary AV/greeter coverage stays); greeter coordinators can remove a signup; hid the dead assign-others picker on multi-claim rows.

**OPEN — next steps:**
1. **Deployed-site verification** of all five. Highest-value: (a) the **staging round-trip** — `/admin/members` → "+ Add member" (test email) → assign HOST on the profile → confirm NO emails arrive → build a rotation including them (no email) → sign in as that email via *Become a member* → confirm onboarding fires, name updates, and their schedule/hub is already attached; (b) mark a virtual program "No host needed" → it drops off `/tools/schedule` but stays on `/this-week` + dashboard; (c) as a **hub coordinator** (not HOST_MANAGER), on a covered row: "Remove" (host removed + notified, slot reopens) and "Reassign to me"; on a needs-sub row: "Clear request"; (d) greeter coordinator removes someone's signup.
2. **Jesse can now pre-stage the host team** (the original ask) — has names + emails.

**New backlog items (session 142):** `2026-06-08-001` coordinator create-sub-request-on-behalf; `2026-06-08-002` greeter removal notification (currently silent); `2026-06-08-003` first-login "you're set up as a host" recognition moment.

**Memory candidates (step 8b — awaiting Jesse's confirm):** (1) **multi-hub Scheduler awareness** — the Scheduler is one surface shared by host-team/peer-led/AV/greeter that use it differently; any change must be checked in both directions (propagates where it should, doesn't pollute the multi-claim model); (2) **coordinator = manager-for-their-own-hub** — hub coordinators carry responsibility for their team's coverage and should have the full coverage-management authority (assign/remove/reassign/clear), hub-scoped.

### Session 141 (2026-06-08) — Scheduler trust + clarity finish; Coverage grid tried & reverted; rotation editor confirms in place — all shipped to `main` & deployed; deployed-site verification pending

Continued the Maria/host-coordinator Scheduler thread (+ a `MEMORY.md` consolidation at the open: 28.1 → 4.7 KB). **Six commits on `main`, all deployed. No new deps / env / services.**

**Shipped (in order):**
- **Enter-room #2 fixed** (`4916757`) — "Enter room →" shows only when a session is actually enterable (the link carried no date; the server only opens *today's*, so it dead-ended on every other row). Threads `sessionEnd` through the page loader + assignments GET. (The real recurring-join bug was already fixed s137; this was the residual UX dead-end.)
- **Entry timing unified, host 30 / member 10** (`8f7963f`) — new `lib/sessionWindowConstants.ts` (client-safe) shared by the gate, the dashboard tiers, and the Scheduler link. Host/teacher early-entry 22→30; member "Join now" 12→10; close still +30.
- **Two quick wins** (`260b437`) — removed the redundant "N still need coverage" banner (the "Needs help" pill now goes amber on gaps); staffing "Edit in [hub] →" deep-links to the Rotations editor (`?view=rotations`).
- **Coverage grid built then reverted** (`4732fd4`→`2d7a763`) — the programs×weeks grid broke on mobile (flat gap dump) and on multi-day programs (fragments into weekday rows; retreats shatter). Reverted; the agenda handles every shape and is already gap-aware. Restraint over a fragile surface.
- **Rotation editor confirms in place** (`9657d04`) — Maria's #5: after Save & Apply, an inline "✓ [Day]'s rotation saved" panel shows the change + projected next sessions, so the result is visible without hunting.
- **Post-closing — hub reply fixes** (`1b32cb7`) — a hub conversation reply double-posted because the Tiptap editor wasn't clearing after a successful submit (sets content once at init; never re-syncs) → it looked unsent → re-submit. Fixed with a key-bump remount + synchronous guard + try/catch/finally; same guard added to the two new-thread compose handlers. Added the missing reply **delete** (DELETE route — own reply or coordinator/GT/ADMIN — + a Delete affordance with confirm); the route previously had only PATCH.
- **Post-closing — reactions identify reactors** (`2fd8f94`) — hub reaction buttons now show *who* reacted (a hover tooltip + aria-label), not just a count. Reactor IDs were already stored; mapped to names via `hubMembers`. ("A community isn't anonymous.") Follow-on (`80be766`): a compact tap-to-reveal (Users-icon toggle → grouped list) so it works on mobile where hover doesn't.

**OPEN — next steps:**
1. **Deployed-site verification** of all six ships. Highest-value: (a) a **non-ADMIN/non-GT member** entering a **live recurring** session (Qigong) — confirms the s137 join fix for real; (b) the rotation-edit **in-place confirmation** after Save & Apply; (c) host-30 / member-10 thresholds (set a start time, check each role); (d) "Enter room" hidden on non-live rows; (e) the amber "Needs help" pill on gaps; (f) hub conversation replies — posting clears the editor and appears once (no double-post), and you can delete your own reply (use it to remove the duplicate on Maria's thread); (g) tap the people icon by a reaction to see who reacted (a compact list on mobile; hover also shows it on desktop).
2. **Post the Maria reply** (drafted at the bottom of this entry).
3. **Qigong data question for Jesse** (not code): Maria is Qigong's *teacher* and also on the 5th-Wed host rotation — intended, or should the teacher not be rostered as host?

**Deferred / queued:**
- **Coverage grid could return** as a desktop-only "weekly programs" lens IF multi-day + mobile are solved (backlog `2026-06-07-001`). Not now.
- Sessions 136–140 deployed-site verification backlog still stands.

**Memory candidate (step 8b):** one new — *restraint over reactive new-surfaces* (don't answer a list of feedback pains with a new view per pain; make existing surfaces trustworthy; the grid build-and-revert is the cautionary tale). `feedback-pivot-when-fragile` reinforced. `MEMORY.md` size issue resolved by this session's consolidation.

**Maria reply (final — for Jesse to post):**
> Hi Maria,
>
> Thank you for testing the scheduler so thoroughly and writing up exactly what you ran into. Your notes were detailed enough that we could trace each item to its cause rather than guess, and they drove a focused round of work on the tool. Here is what was happening and what has changed:
>
> **The rotation emails.** They were saying "this month" when a rotation actually runs across the whole year — which is what made it look like you had signed up for 30 sessions in a single month. The wording now reads "upcoming sessions," so it reflects what is really being scheduled.
>
> **"Enter room."** Two separate things were going on. The button was appearing on every session row, including ones that weren't open yet — so clicking it on a future date left you at a dead end with nothing to do but go back. It now appears only when a session is genuinely open (from about a half hour before it begins through a little after it ends). Separately, we found and fixed an underlying problem that had been preventing entry into recurring sessions specifically, so those are reachable now as well.
>
> **Viewing another person's schedule.** When you were looking at Silvia's schedule, the "you're not hosting anything here" wording assumed it was your own. It is now written for whoever you are actually viewing.
>
> **Editing rotations.** This is where most of the work went. We traced the trouble you had changing and removing hosts to a few real problems underneath: a blanket "Replace all" was overwriting dates someone had chosen by hand, and removing a host from a rotation wasn't always clearing their upcoming sessions, so the change looked like it hadn't taken. Both are fixed, and edits are now scoped to the specific program and team you are working in, so a change in one place cannot quietly affect another. The kind of unexpected removal you saw should not happen again.
>
> **Seeing that an edit took.** You described having to leave the editor, go to the schedule, jump to July, and scroll to confirm an end-date change had worked. That round-trip is gone: after you Save & apply, the editor now shows the result right there — the next several sessions and who is hosting each — so you can confirm the change landed without going anywhere.
>
> It is also worth saying plainly: the system is live but not yet fully set up. Most of the host team isn't in it yet and many rotations haven't been built, which is why so many sessions currently show as needing coverage — and that is what makes the schedule look busier and more demanding than it will be in everyday use. As the rest of the hosts are added and their rotations are in place, the large majority of sessions will simply show who is hosting, open slots will be the exception rather than the rule, and both the schedule and the month view should feel noticeably calmer. A good part of the "a lot going on" feeling is the half-populated state, not the tool itself.
>
> One deliberate choice worth naming: in response to your point about the tool feeling disjointed, we looked closely at building a single all-in-one scheduling view, and chose not to add another page. We would rather make the schedule and the rotation editor you already use clearer and more dependable than add more surface to learn. If that "see everything in one place" need is still there once you have worked with these changes, we would rather design it carefully with you than bolt it on.
>
> Thank you again — this kind of careful, specific feedback is what makes the tool genuinely better, and it is appreciated.

---

### Session 140 (2026-06-07) — Scheduler trust-restoration + coordinator gap-first view (Phase 2 slice 1) — shipped to `main` & deployed; deployed-site verification pending

From frustrated host-coordinator feedback on the Scheduler. Two phases, both on `main`:

**Phase 1 — trust fixes (`9f68c00`):**
- Pattern-editor removal now cleans up the removed host's future sessions (was orphaning them — "remove Nancy" didn't take) + emails them. (#4)
- "Replace all" protects manually self-assigned dates (only sub-cover was protected before) — the likely cause of "Maria removed unexpectedly." Override per-date. (#6)
- Conflict modal now hub-scoped (threads `hubSlug`); apply engine keys candidates per hub — preserves AV/greeter/host-team isolation (latent bug).
- Legibility: modal "N can be replaced · M protected"; save / set-end-date confirmations name what changed; removable `[rotation-apply]` server log captures per-date deltas.
- Copy: rotation email "this month"→"upcoming sessions" (#1); "mine" empty state context-aware when viewing another member (#3).

**Phase 2 — coordinator view, slice 1 (`b22dd9b`):** gap-first **"N sessions still need coverage · Show them"** banner + **"Assign someone…"** in place on needs-coverage rows (native picker, optimistic update, toast). Backend: hub coordinators can now assign others (not just HOST_MANAGER/ADMIN); assign-to-unclaimed-seed handled; capability check hoisted.

**The Phase 2 design (agreed — this is the roadmap):** ONE surface that's both the picture and the editing desk, organized by **time** — programs × dates, gaps the most visible thing, edit in place. **Mobile-first, gap-first.** Slice 1 (done) = the gap list + assign-in-place on the Schedule tab. **Slice 2 = the desktop 2-D grid; Slice 3 = the by-program lens with inline rotation editing + live conflict preview** (later: AV/greeter + teacher/host lanes). North star: kill the page-hopping, show the whole picture, edit where you look. (Full vision + ASCII sketches + the mobile by-date/by-program lenses are in the session-140 transcript.)

**OPEN — next concrete steps:**
1. **Coordinator view slice 2 (desktop grid)** — the next build.
2. **Awaiting Jesse (diagnostic, not blocking):** open **Rotations → Qigong** — Maria filled in the grid cells (a standing rotation) OR an empty grid while Maria's on each session in the Schedule tab (manual self-claims)? Confirms which Phase-1 fix carries #6, and whether Maria-as-host-of-every-session is intended (the teacher-vs-host distinction). Plus the **#2 "enter room"** repro (which program + the exact date/time clicked).
3. **Deployed-site verification of today's two ships:** a real rotation edit with "Replace all" → manual dates stay protected + the "N can be replaced · M protected" line + a concrete confirmation; remove a host via the pattern editor → their upcoming sessions actually disappear + they're emailed; as a coordinator on a phone → the banner shows, "Assign someone…" fills a gap, the assignee gets the email.

**Memory candidates (step 8b):** none — the scan found existing memory files held (investigate-before-fixing, measure-before-agreeing, mobile-first, plain-English design proposals are all covered; nothing was corrected or surprising). `MEMORY.md` is still over its size limit (flagged sessions 138 + 140) — a `/consolidate-memory` pass remains worth doing.

### Session 139 (2026-06-07) — FEATURES.md rebuild + dead-code audit + pre-launch slimming (3 features removed) — merged to `main` & deployed; session-log written. Only the deferred post-launch cleanup below remains.

A big slimming-for-launch session. **All work is on branch `claude/cleanup-s139`** (8 commits beyond `e7f25e9`), pushed, `tsc` + `next build` green. **NOT yet merged to `main`** — Jesse to confirm the Vercel preview build is green (`gh` unavailable in-sandbox), then fast-forward `main` → production deploy + delete the branch.

**Shipped on the branch (verified):**
- **FEATURES.md rebuilt** from a live-codebase inventory: 5,007 → ~250 lines, domain-organized current-state catalog delegating depth to the dedicated docs + `schema.prisma`. Removed-feature tombstone table; planned items point to CLEANUP/backlog. Old version in git history. The 6 cross-refs citing "FEATURES §N" updated to named sections.
- **Dead-code usage-tracing audit** (`CLEANUP.md` Theme H) — every component/lib/model/route/dep traced to callers.
- **Bug fixed:** host-coordinator hub-home inline save PATCHed a non-existent singular `/api/hub/[slug]/home` (404, silent) → corrected to plural `/api/hubs/[slug]/home`.
- **Removed 3 unused features:** staff manual (5 pages / 2 APIs / 3 components / model / 35 seed scripts / all `migrate.mjs` wiring), Schedule PDF export, Reflection Questions (kept the separate `reflectionPrompt`). **DB tables left dormant — no DDL ran.**
- **Safe cleanup done:** 3 orphan components (MemberGate/DanaSection/VideoRoomEmbed) + 8 dead deps (`npm remove`) + 142 dead `man-` CSS rules pruned.
- **Surface:** 69→63 routes · 112→106 API · 58→54 models. Docs aligned (FEATURES/CLAUDE/CLEANUP).
- **Kept (decision recorded):** all public content pages — `/donate` (live GiveButter widgets + Dana content), `/diversity`, `/kalyana-mitta/*`, `/volunteerism/*`. Finished content, not stubs — a future *look* redesign ≠ a delete.

**OPEN — deferred post-launch cleanup (still stands, DO NOT FORGET — `CLEANUP.md` Themes H + I):**
   - **DROP the dormant tables** `manual_sections`, `reflection_questions` / `_options` / `_responses` + the `Lesson.questionsRequired` column (one idempotent migration). Deferred only because DDL is deploy-critical with zero pre-launch benefit.
   - Prune the now-empty manual migration blocks in `migrate.mjs` (cosmetic).
   - Remove the `manualUrl` var + "Read the Staff Manual" link from the live `registrar-role-assigned` + `host-role-assigned` email templates (renders an empty link now).
   - Verify-then-remove deps: `@tiptap/extension-{character-count,color,floating-menu,text-style}` + `@livekit/components-styles` (**KEEP** `-bubble-menu` + `@livekit/krisp-noise-filter` — live features).
   - The session 136/137/138 deployed-site verification backlog still stands.

### Session 138 (2026-06-04) — Status-aware registration messaging (public page + editor); same-day follow-on to 137 (shipped; deployed-site verification pending)

From a second LoriLee registrar report (her "Removing Zoom Link on In-Person Only Programs" hub doc). **Three commits on `main`:** `145a0cb` (Zoom-link fix) · `b53dee0` (status-aware messaging + editor readout) · `f2d2544` (backlog `2026-06-04-007`) + this doc sweep.

**Shipped:**
- **Zoom-link leak fixed** — `app/programs/[slug]/page.tsx` no longer shows "Zoom link on My Home" on an in-person-only program (in-person/hybrid were lumped together; now split).
- **Status-aware CTA** — the public program page's "what to do next" line now expresses the full registration matrix, keyed off `isOpenlyDroppable(category.kind, registrationEnabled)`: registration-on → the viewer's own standing first (registered/waitlisted, **surviving registration close** — fixes the bug where a registrant saw "Registration is closed" after the deadline), then Register → / Join the waitlist → (when full; repurposes the previously-dead `spotsRemaining`) / Registration is closed; registration-off → a droppable kind shows format-aware "how to join", a commitment kind shows **"Registration isn't open yet."** (resolves a retreat-with-registration-off reading as a drop-in).
- **Editor legibility (the real fix, per Jesse)** — ProgramEditor gained a read-only **"How this appears to visitors"** readout on the Registration tab + an inline **"Kind: X"** line on the Categories tab + corrected "Registration enabled" help text; `kind` threaded through the edit/new pages. Manual chapter re-seeded v4→v5.

**What to verify on the deployed site:**
1. **The Heart of Wisdom** now reads **"Registration isn't open yet."** (not "Simply arrive in person"). Turn registration on → it flips to "Register →" on its own.
2. Open it in the editor → **Registration tab** shows the "How this appears" panel; **Categories tab** shows "Kind: Retreat." *(If the panel says "Drop-in," that program's category kind isn't a commitment kind — the readout is exactly the tool to catch it; fix on `/tools/programs/categories`.)*
3. An in-person drop-in still shows "Simply arrive in person."; virtual still shows the Zoom link.
4. Deploy log shows the `seed_manual_program_manager_v5` re-seed.

**To post:** the **LoriLee reply** drafted this session (covers the Zoom fix + the deeper retreat-vs-drop-in fix + the new editor readout) — post on her "Removing Zoom Link on In-Person Only Programs" hub document.

**Deferred / queued:**
- **Backlog `2026-06-04-007`** — consolidate the two registration booleans (`registrationEnabled` + `registrationClosed`) into one control. The editor readout resolved the legibility without a schema change; revisit only if the two-boolean model keeps confusing volunteers.
- **`RIM_ProgramEditor.md`** per-tool doc (closing-ritual step 4d) — held off this slice; the kind/registration-display note went into `RIM_Offering_Model.md` instead. Worth creating when the ProgramEditor next gets substantial work.
- **Kind-aware register verbs** ("Reserve your seat" / "Join this group" / "Register for materials") — still deferred (the offering-model doc's "Implication for copy"); the structural distinction is live, the per-kind wording is not.

**Memory candidates (step 8b):** none new — today reinforced "think holistically / inventory first," already covered by existing memory files. (Reminder: `MEMORY.md` is over its size limit — a `/consolidate-memory` pass is worth doing.)

### Session 137 (2026-06-04) — Recurrence fix (recurring programs were vanishing) + explicit offering KIND (shipped; deployed-site verification pending)

From LoriLee's June-3 registrar feedback. **Two commits on `main`:** `0a893cf` (recurrence fix + dana copy) · `bfc903d` (offering KIND model + folded-in occurrence-helper consolidation) + this doc sweep.

**Shipped:**
- **Recurrence fix** — `lib/scheduleUtils.ts::isOccurrenceOnDate` no longer treats `endDatetime` as a series-end cutoff for **recurring** programs (it's the per-occurrence end *time*; the series bound is `recurrenceCount`). The session-131 guard had erased **every** recurring program from the dashboard "Coming up," `/this-week`, the Scheduler, standing host rotations, and the **session-room join gate** (non-ADMIN/GT members couldn't join recurring sessions; Jesse bypassed as ADMIN/GT, masking it). Fix scopes the cutoff to non-recurring. Verified against live prod data.
- **Dana banner copy** — My Registrations pending-dana banner: waitlist-framed "A spot opened up…" → calm "You're registered. You're also warmly invited to offer dana — a voluntary gift, received with gratitude."
- **Offering KIND** — new `ProgramCategory.kind` (stable code in `lib/programKind.ts`: DROP_IN/COMMUNITY_GROUP/CLASS/EVENT/RETREAT/SERVICE/PRIVATE). The category **name** stays editorial; **kind** drives behavior. Dashboard "Today" + the member program-detail gate compute from `isOpenlyDroppable(kind, registrationEnabled)`; "Coming up for you" stays registration-driven (any kind). Category manager (`/tools/programs/categories`) gained a per-row Kind picker (+ categories API `PATCH`). Migration `add_program_category_kind` split "Community Groups & Events" → Community Groups + Events, added a hidden Private Sessions category, reassigned Day of Mindfulness + Bookmarks & Breath → Events and Private Teacher Meetings → Private Sessions.
- **Folded in:** the completed duplicate-occurrence-helper consolidation (host assignments route + dashboard now use the shared `lib/scheduleUtils`; eslint guard against re-defining `isOccurrence*`) + `.claude/` gitignored.

**Key design call (Jesse + I converged independently):** the **category carries the kind** — not a parallel `programType`. Kind = *what it is*; registration = *what registering does*; behavior = both. One concept; several categories may share a kind; one category = one kind.

**What to verify on the deployed site:**
1. Deploy log: `✔ Applied: add_program_category_kind …` + the `seed_manual_program_manager_v4` re-seed (updated category manual chapter).
2. **Category manager** (`/tools/programs/categories`) — a Kind dropdown per row; Community Groups / Events / Private Sessions present.
3. **Dashboard** — a non-registered member sees **no** public "Join now" for a class/event/retreat; drop-ins + open community groups still show; EDS (drop-in) still joinable; recurring sessions (Good Morning etc.) **joinable again**.
4. **`/this-week` + Scheduler** show recurring programs again.
5. **Host rotations** backfill on the next **08:00 UTC** `apply-standing-assignments` cron (or hit `/api/cron/apply-standing-assignments` manually) — confirm future assignments reappear for recurring programs.
6. LoriLee's "Coming up for you" shows **Essential Dharma Study + Qigong**.

**Setup tasks (Jesse's, not code):**
- Turn on registration for **The Heart of Wisdom** (paid retreat; `registrationEnabled` is currently off — the kind model treats it as a commitment meanwhile so it's safe, but registration must be on for people to actually sign up).
- Decide whether to wire **Essential Dharma Study** to a Course (`ProgramCourse`) for its "registration unlocks study materials" intent.

**LoriLee reply** drafted this session (warm, plain, three points) — post as a comment on her "Registered Program Visibility" hub document.

**Also shipped this session (follow-up commit `ce46899`):** the **category manager** (`/tools/programs/categories`) is now the single complete home — inline rename + Kind dropdown + reorder + add (with kind) + delete. The ProgramEditor's duplicate inline category-create (`CategoryOrderInline`) was removed; its Categories tab keeps the per-program picker and links to the manager. Kind labels stay global (one definition in `lib/programKind.ts`).

**Queued (backlog `2026-06-04-001`, `-002`, `-004`, `-005`, `-006`):** delete dead `hideFromDashboard`/`dayOfWeek`; rename `removeFromProgramList`; "community this week" dashboard surface; "follow / add to my schedule" signal for open offerings; category delete-guard count mismatch (page counts all programs incl. archived, server counts non-archived — pre-existing, low). (`-003`, the ProgramEditor category-create kind picker, is **done** — resolved by the manager consolidation.)

**Memory candidates (step 8b — awaiting Jesse's confirm):** proposed at session close — (1) anchor a taxonomy/enum decision to *behavior*, keep names flexible, make it reversible to lower the stakes; (2) verify a data-migration's targets against the live DB before writing it (the seed file was stale — it lacked the live "Retreats" category). Both `feedback-*` candidates; confirm or discard.

### Session 136 (2026-06-03) — Registration completes after the dana/payment choice (shipped; deployed-site verification pending)

From LoriLee's registrar feedback. Registration was being committed (confirmation email, dashboard listing, course enrollment) **before** the dana step — so paid programs could be "registered" without payment. **Five commits on `main`:** `dc5ee46` (6-slice rework) · `adc5262` (decline copy) · `da0a6a2` (support@ notify) · `1a98b7d` (multi-day labels) · + this doc sweep.

**Shipped — the model now:**
- **Free** (`danaMode none`) → registered + confirmation at submit.
- **Voluntary** → registered at submit (it's optional — a real registration), but the confirmation email **waits** for give or decline; abandoning the dana step **keeps** them registered (the daily cron treats a 24h-abandoned voluntary as an implicit decline → `WAIVED` + confirmation). Decline button now reads **"I'm not donating at this time"**; roster shows **"No dana"**.
- **Required payment** (`fixed` / `base_plus_dana` w/ amount) → new **`PENDING_PAYMENT`** held row only: no account for a new guest, no email, no enrollment, holds a seat, invisible everywhere member/registrar-facing. The Stripe webhook completes it on payment (creates account, → `REGISTERED`, enrolls, sends confirmation). Abandon → `checkout.session.expired` deletes the held row (daily backstop cron too). **Server derives required-vs-not from the program, not the client.**
- **Support@ notification** fires from inside `sendRegistrationConfirmation` (the "registration is real" choke point) for every real registration, never for a held/abandoned one.

**Key design call (Jesse refined it):** required vs voluntary are *two different stories* — required dana **gates** registration (abandon = discard); voluntary dana is an **invitation beside** a registration that's already complete (abandon = stays registered). Don't apply the held/discard model to voluntary.

**What to verify on the deployed site** (needs real test registrations + a Stripe test payment):
1. **Free** program → registered + confirmation immediately.
2. **Voluntary** → submit shows the dana step ("One more step", not "You're registered!"); **give** → Stripe → confirmation; **decline** ("I'm not donating at this time") → confirmation + roster shows "No dana"; **abandon** (close tab) → still registered, confirmation lands within ~24h via cron.
3. **Required-payment** → submit holds a seat but shows nothing on dashboard/roster; **pay** → now appears + confirmation; **abandon at Stripe** → nothing registered, nothing on roster, held seat releases (≤60 min via `expired`, backstop ≤ daily cron).
4. **Support@** gets an email for each completed registration (with name/email/program/dana-status + link to the program's registrations); none for abandoned holds. Quick template check: `/admin/emails` → "New Registration — Support Notification" present + enabled.
5. **Multi-day retreat** ("The Heart of Wisdom") now reads **"September 10–13, 2026 · Begins 4 PM CT"** on the card and confirmation email.

**Stripe action for Jesse:** confirm the webhook endpoint subscribes to **`checkout.session.expired`** (already covered if it's "all events"). Without it, abandoned paid holds clear only via the daily cron instead of in real time.

**Queued / open:**
- **LoriLee's "testing to be continued"** — more registrar feedback may come. (Several items this session were *prior* feedback that predated the fixes — check timing before treating as a bug.)
- **Optional:** a "started a paid registration but didn't finish" support heads-up (offered to LoriLee, deliberately not built — an unfinished checkout isn't a registration).
- **Backlog `2026-06-03-003`** — multi-day time label shows "Begins 4 PM CT" (drops :00 per system style); revisit if "4:00 PM" is preferred. **Backlog `2026-06-03-002`** — optional abandoned-paid-registration heads-up to support@ (offered to LoriLee, not built).
- **New doc:** `RIM_Registration.md` (per-tool engineering reference) created this session; added to the CLAUDE.md Design Orientation table.

### Session 135 (2026-06-03) — Guiding Teacher hub access + GUIDING_TEACHER made assignable (shipped; Course Hub access confirmed by Jesse)

Started from Jesse's question "shouldn't I have access to all hubs?" → an access-model correction + an invisible-role bug fix. **Two commits on `main`:** `4439952` (`canAccessHub` access door) · `1c05778` (surface GUIDING_TEACHER in the role UI). Plus this closing-ritual doc sweep.

**Shipped & confirmed working:**
- **`lib/hubAuth.ts::canAccessHub(member, roles)`** — single hub-access door: a `HubMember` row OR `GUIDING_TEACHER`. Applied at the hub layout + 11 sub-pages + 20 API route files (33 gate sites), collapsing three disagreeing membership checks. ADMIN-alone still does NOT pass (session-128 boundary); GT now passes WITHOUT a membership row (deliberate divergence — pastoral reach is dharma authority, not technical). Reviewer sub-agent found + we fixed two gaps pre-merge (`/api/hub/[slug]/route.ts` `isMember` idiom; `categories` DELETE omitting GT).
- **Dashboard** split: "Where you're contributing" (memberships, unread badges) + quieter "Other hubs — oversight" group (admin/GT) — no more dead-end cards.
- **`GUIDING_TEACHER` now assignable** in `components/member-sections/RolesSection.tsx` ("Sangha-wide authority" group). Was the only live role with no UI surface (DB-console-only). **Jesse assigned it to himself and confirmed Course Hub access now works** — loop closed.

**What to verify on the deployed site (light — core path already confirmed):**
- Dashboard shows your member hubs up top + the oversight group below; an ADMIN-who-isn't-GT is still blocked from non-member hubs.
- Entering a few different non-member hubs as GT (read + post + moderate).

**Queued follow-ons from this session:**
- **GT-presence badge** — backlog `2026-06-03-001`. When a GT enters a hub they're not a member of, the team should see *them*, not an anonymous coordinator. The legibility half of "walk into any room but be seen." Matters most with a 2nd guiding teacher.
- **Staff-manual chapter on roles + who-can-access-a-hub** — doesn't exist; nothing was invalidated this session, but the gap is worth a future seed.
- **New memory:** `feedback-verify-state-not-docs.md` (don't assert role/account state from doc prose; verify the live value).
- **Env note:** production Neon was unreachable from the dev sandbox all session (even network-sandbox-off) — role/membership checks had to go through the UI. Remember for future diagnostics from this machine.

### Session 134 (2026-06-01) — Site-wide audit + dead-code/CSS cleanup + Webflow-reversal doc fix (shipped; deploy spot-check pending)

Full audit of the app to regain scope, then removed the dead weight. Four commits on `main` (`a5e1e41`, `e4d9355`, `48caa0c`, `81c810f`) + the closing-ritual doc sweep.

**Shipped:**
- **Dead app code** (~2,670 lines): 2 Sanity pages (`/glossary`, `/volunteer-positions`) + `lib/sanity.ts` + `lib/queries.ts`; 4 unreferenced components (`TiptapEditor`, `SupportSettingsClient`, `HubManageClient`, `LazyVideoRoomEmbed`); 4 orphan API routes; `AppSetting` model + DROP-TABLE migration; both style-guide pages. **Bug fix:** `/api/admin/courses` now reads linked-program names from Postgres (was querying retired Sanity with Postgres IDs → always empty).
- **CSS audit:** `custom.css` 27,175 → 23,489 (~3,686 dead lines gone), verified safe (brace-balanced, postcss-idempotent, zero live classes removed). Hygiene scripts `scripts/css-prune.mjs` + `css-cut.mjs` kept + noted in CLAUDE.md.
- **Webflow-reversal doc fix:** corrected `RIM_Stack_Reference.md` intro + `project-architecture-pivot.md` memory; removed 3 obsolete Webflow-workflow memory files. RIM is one integrated Next.js app; Webflow being retired.

**What to verify on the deployed site:** spot-check the surfaces where removed CSS lived — **any rich-text editor** (hub doc / course / lesson / program editor), a **hub home**, a **course + lesson page**, a **program page**. If anything's visually off, `git revert e4d9355` is clean and isolated.

**Deferred / queued (from this session):**
- **Public-facing pages are the next major build area** — they exist but are rough. The Webflow legacy shim in `custom.css` (`.section`, `.w-*`, runtime `.ProseMirror`) retires *with* that rebuild, not before. Backlog `2026-06-01-001`.
- **`@sanity`/`@portabletext` dep prune** — pages gone, but `MemberGate.tsx` + `lib/email.ts` still import portable-text. Backlog `2026-06-01-002`.
- **Memory candidate proposed at closing (step 8b):** a "verify-before-removing" feedback file (Prisma relation includes / raw SQL / template literals / adapter tables evade naive greps) — awaiting Jesse's confirm.

### Session 133 (2026-05-31) — Session-room UX batch (shipped; live verification pending)

Jesse brought a list of session-room ("meeting software") issues. Worked as four reviewer-gated slices + a follow-on, all pushed to `main` (Vercel deploys each). Each type-checked and code-reviewed before push.

**Commits, in order:** `232973e` (Slice A — Bell-mode label clarity + device chevrons removed) → `8021388` (Slice B — DM by clicking a name + unread-chat badge) → `6c929c2` (Slice C — join muted/dark by default + local Pin) → `f7d4517` (Slice D — fullscreen screen share + pre-share primer) → `acb8650` (full names on tiles/roster/chat). Plus the closing-ritual doc sweep.

**What to verify on the deployed site** (needs a real session; some needs a 2nd person / co-host):

1. **Bell mode** (host/co-host) — label always reads "Bell mode"; tapping it shows a gold highlight + "On" marker; tap again returns to quiet default. No "Clean voice" flip.
2. **Chevrons gone** — Mute/Start Video are plain buttons; device switching is in Settings (⚙), which has mic/speaker/camera dropdowns.
3. **DM by name** — open Participants → click someone's name → roster closes, chat opens, "To:" pre-set to them; send → private. The "To:" dropdown still works.
4. **Unread badge** — with chat closed, have someone send → count appears on Chat button; opening clears it; own sends never count.
5. **Join muted/dark** — everyone lands with mic + camera off. ⚠️ **Key check (iOS Safari):** join, then tap Start Video / Unmute → confirm NO second permission prompt. If it re-prompts, tell Claude — fall back to LiveKit enable-then-disable (see RIM_SessionRoom.md "Join flow").
6. **Local Pin** — hover a tile → Pin → that person stays as your main view even when others speak; "📌 Pinned … — Unpin" banner up top; pinning changes only your view. Try pinning the teacher while someone else talks.
7. **Fullscreen screen share** (co-host) — click Share Screen → primer appears → "Choose what to share" → browser picker → the share fills everyone's view with camera tiles in a filmstrip; Stop Share returns to grid. Confirm the whole shared screen shows uncropped.
8. **Full names** — tiles, roster, and chat show first + last. (Uses `preferredName || firstName` + lastName — so a member who goes by "Jess" shows "Jess Foy". Flagged to Jesse; change to strict firstName if he prefers.)

**Open / awaiting Jesse:**
- The whole verification pass above (especially #5 iOS-Safari re-prompt and #7 uncropped share).
- **Does the preferredName-honoring full name read right?** If Jesse wants strict registered first+last, it's a one-line change in `lib/livekit.ts::sessionDisplayName`.
- **Sharer's own focus tile may be blank** during a whole-screen share (recursive capture) — offered to suppress share-focus for the sharer if it bugs him (backlog `2026-05-31-003`).

**Deferred / queued (backlog):**
- **Latency/sync (items 2 + 7)** — parked per Jesse; needs a live measurement pass (LiveKit stats + Krisp A/B). Backlog `2026-05-31-001`. Do NOT change codec/bitrate blind.
- **Mobile pin-from-tile** — hover-only today; add a Pin action to the Participants panel for touch. Backlog `2026-05-31-002`.
- **Guest full-name nudge** on the open-access join screen. Backlog `2026-05-31-004`.

**Docs created/updated this session:** new per-tool engineering doc `RIM_SessionRoom.md` (+ CLAUDE.md Design Orientation table entry); manual chapter `host-session-room` v10 (`prisma/update-manual-host-session-room.mjs` + migrate flag); FEATURES §38; RIM_Stack_Reference; RIM_System_Architecture; SESSION_ROOM_FOR_VOLUNTEERS.

**Memory candidates (proposed at closing — see below; awaiting Jesse's confirm).**

### Carried-over follow-ons (from sessions 125–132, still queued)

- **Voice extraction (`RIM_Voice.md`)** — parked, pending Jesse's 5–10 writing samples.
- **Sessions 125–132 verification** on the deployed site — accumulated test pass.
- **Beat 4 — `/account/dashboard` first-visit framing**, banyan tree image on `/join`, footer `/join` link, magic-link migration cleanup, noindex headers — all queued, none urgent.

---

### Previously — Session 132 + continuation (2026-05-27) — `/join` slice + threshold integrity pass

Nine commits on `main` across one long day. Morning shipped the visible UX of the new-member threshold (`/join` page, integrated panel, agreement consolidation, two orphans deleted). Afternoon closed the invisible integrity (post-`/join` warmth across check-email + emails, route-group layout enforcing agreement + archive, soft-redirects in both directions between `/login` and `/join`).

**Commits, in order:**

Original `/join` slice (covered in the prior closing-ritual commit `c44aba1`):
1. `28ab0f5` — `/join` page + `/api/account/join` endpoint + `join-welcome` email + shared `lib/authRateLimits.ts`
2. `22a3210` — Integrate agreements + form into one panel; consolidate to one canonical agreement text
3. `21f14cf` — Nav repointed to `/join`; orphan `/community-membership` deleted; four stale links swept
4. `120badd` — Second orphan deleted (`/account/dashboard-member-care-agreements`) + `.mc-*` CSS removed

Continuation (covered by this closing-ritual commit):
5. `6fce1e5` — `/login/check-email` warm post-`/join` variant (state-driven 5-min window)
6. `e840b68` — `auth.ts` template branching corrected: `emailVerified` not `agreedToTerms`
7. `893d698` — `(authenticated)/` route-group layout enforcing 3 gates structurally
8. `795129e` — `/login` not-found soft-redirect to `/join` when email doesn't exist
9. `9dcbc32` — Catch-all hardening (existence check at HTTP entry) + DB-error fail-safe

### What to verify on the deployed site

The full sequence to walk for a new joiner:

1. **`/join` signed out.** Hero + integrated panel with the four agreements (numbered list, title bold + one-sentence summary) above the form. Submit with a brand-new test email.
2. **Two emails arrive.** Subject: "Your Rooted In Mindfulness sign-in code: …" (with the WARM "Welcome to Rooted In Mindfulness" body — this was fixed in `e840b68`). And the separate `join-welcome` letter "Welcome to Rooted In Mindfulness, `{firstName}`" alongside.
3. **`/login/check-email` shows the warm variant.** No mailbox emoji. Headline "Almost there, `{firstName}`." Body: "Two things just arrived in your inbox: your sign-in code, and a short welcome letter. Type the code below to enter…"
4. **Type the code.** Should land DIRECTLY at `/account/dashboard` (skipping `/account/welcome` because `agreedToTerms` is already true). The `(authenticated)/` layout passes all three gates (session ✓, agreed ✓, not archived ✓).

The full sequence to walk for an unknown-email attempt at `/login`:

5. **Type a never-used email at `/login`.** Should land back at `/login?notMember=1&email=…` with the warm panel: "We don't have an account for `<email>`. If you're new to RIM, you're warmly welcome — become a member →" The link carries the email forward.
6. **Click "become a member."** Lands on `/join?email=…` with the email field pre-filled.

The full sequence to walk for an already-member at `/join`:

7. **Type an already-joined email at `/join`.** Form submits; API returns `{ alreadyMember: true }`; client navigates to `/login?email=…` with the warm "It looks like you already have an account with us" message and the email pre-filled.

Defense-in-depth verification:

8. **Direct `POST /api/auth/signin/resend` with an unknown email** (e.g., via `curl` or a script) — should get a 303 redirect to `/login?notMember=1&email=…` from the catch-all wrapper.
9. **Direct attempt to reach `/account/dashboard` as an un-agreed account** — should redirect to `/account/welcome`. (Hard to test without an artificially-created un-agreed account; the cleanup cron will create one transiently if you abandon `/join`.)
10. **Archived test member signing in** — should redirect to `/account/reactivate`, not the dashboard.

### Memory candidates from step 8b

Scanned the continuation arc; no new memory candidates. The "stale documentation drift" pattern (proxy.ts and `auth.ts` template routing) is already covered implicitly by existing memory files about reading actual code (`feedback-inventory-first`, `feedback-engagement`). The structural-vs-per-page-helper architectural choice is covered by `feedback-clear-seeing-is-correctness`. The existing memory files held up.

### Known follow-ons (queued, none urgent)

- **Voice extraction (`RIM_Voice.md`).** Still parked. Pending Jesse gathering 5–10 writing samples. The `join-welcome` and (now) `sign-in-code-new-user` templates are the best candidates for a first voice rewrite when ready.
- **Beat 4 — `/account/dashboard` first-visit framing.** A first-time member sees the same dashboard as a tenth-time member. A short "Here's where things live" panel that fades after a few visits would close the warmth arc end-to-end. Deferred until the home/dashboard formal design pass.
- **Banyan tree image on `/join`.** Webflow has one; we don't have the asset in the repo. ~10 line wire when available. Backlog `2026-05-27-002`.
- **Footer link to `/join`.** Quiet always-on entry. Backlog `2026-05-27-001`.
- **Per-page session redirects under `(authenticated)/` are now redundant.** Each gated page still has its own `if (!session) redirect("/login")`; the layout already does this. Harmless but cluttering. New backlog item.
- **Sessions 125–131 verification on the deployed site.** Still queued.
- **Magic-link migration cleanup** (backlog `2026-05-21-003`). Mechanical.
- **Noindex headers on member-only pages** (backlog `2026-05-25-001`). Belt-and-suspenders.

### Smaller items still parked

- **Replaced-user email parity** in `sendStandingAssignmentReplacedEmail` — no signal to act on.
- **Inline editing in the cross-hub staffing view** — currently read-only; deep-links to per-hub editing.
- **Audit-trail soft nudge in EndMenu** — speculative.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected at session 120.

---

### Previously — Session 132 (2026-05-27) — `/join` slice: new-member threshold door shipped

Four commits on `main`. The slice rebuilt the new-member sign-up flow end-to-end. Sign-in and sign-up are now two doors over the same passwordless code mechanism: `/login` for existing members, `/join` for new ones. The agreement text is consolidated into a single canonical source used by every surface; two orphan pages were deleted in the process.

**Commits:**
1. `28ab0f5` — Add `/join` page, `/api/account/join` endpoint, `join-welcome` email template, `lib/authRateLimits.ts` shared rate-limit module
2. `22a3210` — Integrate agreements + form into one panel on `/join`; consolidate to one canonical agreement text; refactor WelcomeForm + RegistrationForm to use it
3. `21f14cf` — Nav repointed to `/join`; orphan `/community-membership` page deleted; four stale link references swept (including a pre-existing "member home" bug on program pages)
4. `120badd` — Second orphan deleted (`/account/dashboard-member-care-agreements`) + entire `.mc-*` CSS prefix removed

### What to verify on the deployed site

1. **`/join` signed out** — confirm the integrated panel: hero with "Become a member" + warm intro, single cream-toned panel with the four agreements as a numbered list (title bold, one-sentence summary each), soft divider, then form. No card grid, no long paragraphs below the form.
2. **Submit `/join` with a test email** — within seconds, both emails should arrive: the 6-digit code (the warm `sign-in-code-new-user` template — "Welcome to Rooted In Mindfulness") AND the warm welcome letter (`join-welcome` template). Typing the code at `/login/check-email` should land you on `/account/dashboard` directly, skipping `/account/welcome` because `agreedToTerms` is already true. Future sign-ins flip to the quiet `sign-in-code-returning` template because `emailVerified` is set on the first verification.
3. **Already-member soft-redirect** — re-submit `/join` with the same email. Should land at `/login?email=…` with the input pre-filled and the calm one-liner "It looks like you already have an account with us. Sign in to continue." above the form.
4. **Rate-limit shared with `/login`** — six `/join` submissions from the same email in a row should hit the calm `/login/error?error=RateLimit` page on the sixth. Six `/login` requests from the same email (without `/join`) should hit the same gate.
5. **Nav (signed out)** — "Member Area" dropdown should show "Become a Member" first, "Sign in" second. Both desktop dropdown and mobile menu.
6. **`/community-membership` and `/account/dashboard-member-care-agreements` 404** — verify the deleted routes return 404 (hard-refresh or incognito if needed for the Vercel edge cache).
7. **Welcome letter copy** — at `/admin/emails`, find "Join — Community Welcome Letter" under the "Sign-in & Authentication" group. Body is a first-draft in RIM's voice; edit freely. Variables available: `{{firstName}}`, `{{{dashboardButton}}}` (triple-brace HTML), `{{dashboardUrl}}`, `{{supportEmail}}`.

### Memory file candidates from step 8b behavior audit (pending Jesse's confirmation at closing)

- **`feedback-community-not-anonymous.md`** — *"A community isn't a community if it's anonymous."* Generalizes to: RIM community surfaces always require real names; never default to anonymous or single-field flows for community membership.
- **`feedback-honor-the-reference.md`** — When Jesse points at a specific reference page or design, match its actual choices. Don't combine its content with structure or text from other contexts and call that "comprehensive." Triggered by the long-paragraph redundancy on `/join`.

### Known follow-ons (queued, none urgent)

- **Voice extraction (`RIM_Voice.md`).** Still parked from session 128. Pending Jesse gathering 5–10 writing samples. The new `join-welcome` template is one of the best candidates for a first voice-rewrite pass.
- **Banyan tree image on `/join`.** The Webflow Community Membership page has a banyan-tree image on the right. Not ported because we don't have the asset in the repo. Easy 10-line wire when the asset is available.
- **Footer link to `/join`.** Quiet, always-on entry. Worth adding once the footer cleanup pass comes around.
- **Home page join CTA.** Currently `/` is a rough draft; Jesse said no formal CTA work yet. Revisit when home is designed.
- **Verification of sessions 125–131 on the deployed site.** A whole accumulated test pass.
- **Magic-link migration cleanup** (backlog `2026-05-21-003`). Remove dead seed entries from `prisma/migrate.mjs`. Mechanical.
- **Noindex headers on member-only pages** (backlog `2026-05-25-001`). Belt-and-suspenders pass on `/lessons/*` and the enrolled branch of `/course/[slug]`.

### Smaller items still parked

- **Replaced-user email parity** in `sendStandingAssignmentReplacedEmail` — doesn't use `firstSessionMonth` for the deep-link. Documented in session-130 close; no signal to act on.
- **Inline editing in the cross-hub staffing view** — read-only with deep-links to per-hub editing. Requires careful UX about which hub a given action is scoped to.
- **Audit-trail soft nudge in EndMenu** — speculative; don't build until real signal.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected at session 120; architecture parked.

---

### Previously — Session 131 (2026-05-27) — final close — four parked-item closures + closing-ritual step 8b

Five commits on `main` (`a8fbe60`, `2d1c8d1`, `377d0f4`, `ba1f67e`, `1d46c25`) plus the closing-ritual doc sweep. Each commit closed a parked item from the session-130 backlog. No new work started; today was a sustained knock-it-off-the-list pace.

**What's now live (verification pending on the deployed site):**

1. **`isOccurrenceOnDate` honors `endDatetime`** (`a8fbe60`). Ended courses no longer surface phantom future sessions on `/tools/schedule`, `/this-week`, or any of the 6 standing-assignment routes. The local clip in the cross-hub staffing view (session 130's `fc041ea` patch) was removed — the shared helper now does the right thing everywhere.
2. **Hub coverage-copy editor** (`a8fbe60`). The "Role-aware copy" fieldset at `/admin/hubs/[slug]/edit` exposes `coverageNoun` / `coverageVerb` / `coverageAction` with live hint sentences. Blank input resolves to host-team defaults from `DEFAULT_COVERAGE_COPY`. Finishes the session-130 promise that future hubs are configuration on top of the architecture, not new code.
3. **Fire-and-forget reliability sweep** (`2d1c8d1`). 9 sites in 5 files converted from `.catch(() => {})` to `after()` from `next/server` with structured `console.error` logging. Generalizes the session-96 welcome-email fix. Sites: admin/members PATCH (role-series enrollment + 3 role emails), account/complete-profile, account/registrations cancel, registrations POST (2 sites), stripe webhook.
4. **Rate-limit on NextAuth signin + callback** (`377d0f4`). Postgres-backed, cross-instance, no new external service. Thresholds: signin/resend at 5/10min per email + 20/10min per IP; callback/resend at 20/10min per IP. Blocked → calm message at `/login/error?error=RateLimit`. New per-area engineering doc `RIM_Auth.md`. Closes backlog `2026-05-21-002`.
5. **Hub-creation auto-coordinator** (`ba1f67e`). `POST /api/admin/hubs` writes a `HubMember` row for the calling admin atomically alongside the hub. Closes the session-128 catch-22 at its origin. Safety-net `/api/admin/hubs/[slug]/add-me-as-coordinator` stays for the inherited-hub case.
6. **`CLAUDE.md` step 8b** (`1d46c25`). Closing ritual gains a behavior-audit step — scan the session for corrections, validated approaches, and surprises that should become memory files. Propose for confirmation before commit.

**Memory file added this session:** `feedback-read-schema-before-form-design.md` (pending Jesse's confirmation at closing — propose-and-confirm pattern from new step 8b).

### What to verify on the deployed site

1. **Open `/admin/hubs/audio-visual/edit`.** The "Role-aware copy" section sits below the Teacher pill area. Three inputs pre-filled with "AV" / "covering AV" / "cover AV" (backfilled by session 130's migration). Clear one, save, reload — should read the host-team default back ("Host" / "hosting" / "host this").
2. **Pick a recurring program with an `endDatetime` in the past** (or set one temporarily on a test program). Confirm `/tools/schedule` and `/this-week` no longer show sessions past that date.
3. **Add a HOST role to a test member from `/admin/members`.** They should receive the host-role welcome email reliably (was probably working before but unreliable; the `after()` wrap closes the silent-fail mode).
4. **Cancel a test registration from `/account/programs/[slug]`.** Registrar should get the cancellation email.
5. **Request 6 sign-in codes in a row from `/login` using the same email.** The 6th should land on `/login/error?error=RateLimit` with the calm message. The other code paths (single typo retry, regular daily sign-in) should be unaffected.
6. **Create a new test hub at `/admin/hubs/new`.** Immediately go to `/account/hub/<slug>` — should land you inside without the bootstrap step.
7. **Vercel logs:** the next daily run at 5:15 AM CT should show `[cleanup-rate-limits] Deleted N expired window(s).`

### Known follow-ons (queued, none urgent)

- **Voice extraction (`RIM_Voice.md`).** Still parked since session 128. Pending Jesse gathering 5–10 writing samples that sound most like him; ~15–20 minutes of focused work once samples are ready.
- **Verification of sessions 125–130 on the deployed site.** A whole accumulated test pass. Worth a dedicated session — host a real practice session, exercise each surface (raised-hand queue, persistent vote signals, time-gated tokens, per-session rooms, per-program teacherLabel, hub-coverage routing, multi-claim Scheduler, role-aware copy, per-day Reset, cross-hub staffing view, rate-limit, auto-coordinator).
- **Magic-link migration cleanup** (backlog `2026-05-21-003`). Remove the dead `seed_magic_link_email_templates` migration entries from `prisma/migrate.mjs`. Mechanical cleanup; no user impact.
- **Noindex headers on member-only pages** (backlog `2026-05-25-001`). Belt-and-suspenders pass — auth gate already prevents content delivery; this prevents indexing in case of misconfiguration. Add `metadata.robots = "noindex, nofollow"` to `/lessons/[slug]/page.tsx` and the enrolled-state branch of `/course/[slug]/page.tsx`. Possibly add `app/robots.ts` to declare site-wide crawler allow/disallow paths.

### Smaller items still parked

- **Replaced-user email parity** in `sendStandingAssignmentReplacedEmail` — doesn't use `firstSessionMonth` for the deep-link. Documented in session-130 close; no signal to act on.
- **Inline editing in the cross-hub staffing view** — currently read-only; deep-links to per-hub editing. Requires careful UX about which hub a given action is scoped to (the same surface shows multiple hubs). Parked.
- **Audit-trail soft nudge in EndMenu** — speculative; don't build until real signal.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected at session 120; architecture parked.

---

### Previously — Session 130 (2026-05-26) — Maria's beta-test fixes + the full follow-up arc

Four-bug fix from Maria's beta + six follow-up commits triggered by Jesse's real-world testing across multiple hubs. **Ten commits total on `main`:** `960968b` → `38f4582` → `11864f2` → `93f985e` → `3117833` → `313beff` → `fc041ea` → `f263194` → `71822d0` → `418e11f` → `b0614e9` → `adc51e2` → final closing doc sweep.

**The follow-up arc (same day):**

1. **Diagnostic patch (`11864f2`).** Jesse reported the per-program Reset wasn't working on multi-day programs. Couldn't pin the failure from code alone — shipped client-side `console.log` under `[reset]`, server-side `[reset-rotations]` log, and **an inline result line at the click point** so the next test would be self-diagnosing.
2. **Orphan-heal migration + atomic transfer (`93f985e`).** Root cause located: orphan `StandingAssignment` rules on hubs that no longer matched the program's current `hostingHubSlug` (programs that had been transferred between hubs after rotations were set up). One-shot heal migration `heal_orphan_standing_assignments_v1` deletes orphan rules + their future HostAssignments site-wide. Program-transfer PUT handler now wraps cleanup + update in a single `$transaction` so this can't recur. Reviewer caught three showstoppers pre-commit (auxiliary-hub-aware detection, SubRequest FK violation, non-atomic transfer); all three addressed before the commit.
3. **FK-Restrict pattern fix (`3117833`).** After the heal landed and Jesse retested, the inline diagnostic patch from step 1 surfaced `HTTP 500` on a different program's Reset — a historic CANCELLED sub-request was FK-Restrict-blocking the parent HostAssignment delete. Same SubRequest-FK bug the reviewer flagged for the migration, but in four pre-existing production routes. Audited the codebase with `grep subRequest.updateMany`, found four offenders (`clear-rotations`, `release-host`, `assignments/[id]` DELETE, `assignments/reassign`), all replaced with the canonical SubClaim → SubRequest → HostAssignment deleteMany pattern in `$transaction`. PATCH unclaim keeps cancel-OPEN behavior because it doesn't delete the parent.

4. **Per-day Reset rename + cross-hub program-staffing view + two more FK gaps (`fc041ea`).** Jesse named two design issues that emerged once the system worked: multi-day programs need a per-day Reset as a first-class affordance, and hubs are functional roles per program that should be viewable in one place. Three things landed: (a) row-level "End" button → "Reset [Day]" (programmatically day-named) with day-aware copy through the manage panel and toasts; (b) new read-only page at `/tools/schedule/program/[slug]` showing one program across every covering hub — per-day rotation tables for single-slot hubs, signup counts for multi-claim. Linked from each program card via "View all roles →"; (c) two more FK-Restrict gaps closed (`standing-assignments/[id]` DELETE rotation + both branches of `end-bundle`) — completing the FK-Restrict pattern audit for the Scheduler API. Reviewer caught one medium (`findUpcomingDates` ignoring `Program.endDatetime`) and two cleanest lows pre-commit; all addressed.

5. **Manual chapter rewrite (`71822d0`).** Host Rotations chapter rewritten as v5 to match session-130 reality — hubs-as-roles framing, per-day Reset rename, Remove-from-rotation rename, two-reset-levels section, per-date-vs-whole-rotation distinction, cross-hub staffing view. Host Schedule chapter rewritten as v6 — tool rename to "Scheduler," clickable "Next" affordance, deep-link email behavior, multi-hub framing.

6. **Wrong move + revert: hide Rotations tab on multi-claim hubs (`10a161a` → `418e11f`).** Jesse sent a screenshot from Greeter showing Rotations didn't let him add people. I misread — assumed greeter (multi-claim) shouldn't have a Rotations tab at all and hid the tab. Wrong fix. Jesse corrected: he was trying to put greeters on a recurring schedule via the rotation pattern, and the tab is the right place. Reverted. Second time in the arc I led with screenshot context over the user's described failure mode. Lesson recorded in `feedback-pattern-audit.md`: *user's description of the failure is the primary signal; supporting visual context is supporting evidence, not the framing.*

7. **The actual bug: missing `hubSlug` in client save handlers (`b0614e9`).** `RotationsClient.handleSave`, `handleEnd`, and `handleSetEndDate` were POSTing without `hubSlug`. Server fell back to the program's primary hub, silently writing rotations into the wrong hub. A Greeter coordinator saving a Greeter rotation on a hybrid program found the rule landing in host-team. All three handlers fixed. Apply call inside standing-assignments POST also scoped to `targetHubSlug`. New rule in `RIM_Hub_Engineering.md`: every client-side mutation targeting a hub-scoped resource must explicitly pass `hubSlug`.

8. **Role-aware copy across all hubs (`adc51e2`).** Jesse spotted (with an AV hub screenshot) that the UI still said "You're hosting" on Audio Visual assignments. Three new fields on `Hub` — `coverageNoun` / `coverageVerb` / `coverageAction` — defaulting to host-team values. Migration `add_hub_coverage_copy_v1` backfilled the three non-host-team hubs. New helper `getHubCoverageCopy(hubSlug)`. UI and email copy now read from the hub's config: "AV needed" / "You're covering AV" / "AV: Bob" on AV; "Facilitator needed" / "You're facilitating" / "Facilitator: Nancy" on peer-led. Six email send sites updated. Future hubs are configuration on top of the architecture, not new code.

**What to verify on the deployed site once `fc041ea` lands:**

1. **Per-day Reset.** Open a multi-day program's row in the Rotations grid. The right-side red button reads "Reset Monday" / "Reset Tuesday" etc, day-named. Clicking it opens a manage panel whose copy is day-scoped throughout. The destructive option reads "Reset Tuesday's rotation. … Other days for [Program] are untouched. Past sessions stay on the record."
2. **Cross-hub staffing view.** Click "View all roles →" on a program card in the Rotations grid. Lands at `/tools/schedule/program/[slug]`. Each hub covering this program (primary + auxiliary) gets its own section. Single-slot hubs show a per-day table with host(s) and pattern; multi-claim hubs show the next 4 upcoming sessions with signup counts. Every section has an "Edit in [hub] →" deep-link back to that hub's Rotations tab.
3. **Reset rotations works on The Art of Meditation** (carry-over from `3117833`): inline result line is green, Tuesday row collapses to empty, program card disappears.
4. **No more orphan rotations** (carry-over from `93f985e`): Awakening The Heart shows empty grid; peer-led-silent-meditation programs only show rotations that exist on the peer-led hub.
5. **End-bundle and standing-[id] DELETE no longer 500** on programs with historic non-OPEN SubRequests. Try ending a rotation that's been around long enough to have a CANCELLED sub-request on it — should now complete cleanly.

**Original session-130 four-bug fix (first commit `960968b`):**

- **Bug A** — sub-request affordance discoverable: standing-assignment confirmation email deep-links to `?month=YYYY-MM` of the earliest scheduled session; Your Rotations panel "Next" block is now a clickable button that jumps the calendar to that month.
- **Bug C** — release-host behavior + email rewritten. The route now deletes the user's StandingAssignment rules in the bundle (so the cron can't re-apply); two distinct email builders (Released for release-host, Ended for end-bundle); "Release their dates" UI label → "Remove from rotation" with explanatory copy.
- **Bugs B + D** — defensive UX hardening. Every destructive action calls `router.refresh()` after `loadRotations()` so the schedule page's SSR data re-fetches; success toasts name program/day/hub/counts explicitly; 0/0 race path also refreshes.

**Reviewer sub-agent track record this session:**

- Pre-commit on `960968b`: caught 3 issues (missing email when only rule removed; missing refresh on 0/0 path; fragile locale-string parsing).
- Pre-commit on `93f985e`: caught 3 showstoppers (auxiliary-hub-blind detection; SubRequest FK; non-atomic transfer).
- Post-commit on `3117833`: pattern not generalized from the prior review — the reviewer correctly flagged "this is a pattern, audit the codebase," I read it as "fix this site." Lesson recorded in `RIM_Hub_Engineering.md`.

**What shipped:**
- **Bug A** — sub-request affordance discoverable: standing-assignment confirmation email deep-links to `?month=YYYY-MM` of the earliest scheduled session; Your Rotations panel "Next" block is now a clickable button that jumps the calendar to that month.
- **Bug C** — release-host behavior + email rewritten. The route now deletes the user's StandingAssignment rules in the bundle (so the cron can't re-apply); two distinct email builders (Released for release-host, Ended for end-bundle); "Release their dates" UI label → "Remove from rotation" with explanatory copy.
- **Bugs B + D** — defensive UX hardening since neither could be diagnosed without Maria's screenshot or DB state. Every destructive action calls `router.refresh()` after `loadRotations()` so the schedule page's SSR data re-fetches; success toasts name program/day/hub/counts explicitly; 0/0 race path also refreshes.

**Reviewer sub-agent caught three issues pre-commit:** missing email when only the rule was removed (no future HostAssignments yet); missing refresh on the 0/0 race path; fragile `new Date(d.toLocaleString(...))` for CT month extraction (switched to `Intl.DateTimeFormat.formatToParts()`).

### Additional verification (full session-130 arc on the deployed site)

These are the verifications carried from the original four-bug fix, still pending end-to-end:

1. **Sub-request flow end-to-end.** Set up a rotation starting in a future month. Confirmation email arrives. Click the "Open the Schedule" CTA — should land directly on the month of the earliest session. "Ask the team to cover" affordance visible on your rotation rows.
2. **Your Rotations panel "Next" is clickable.** From any month, click the "Next →" block on a rotation card. Calendar jumps to that month.
3. **"Remove from rotation" semantic.** Add a second host to a rotation bundle. Click "Remove from rotation" on the second host. They should be removed and the other host stays. Run the apply-standing-assignments cron manually — the removed host should NOT be re-applied.
4. **Truthful emails.** Trigger a release-host: subject "You've been removed from the {programName} rotation." Trigger an end-bundle "End this rotation" with releaseFuture=true: subject "Your hosting rotation has ended."
5. **Toasts are specific.** Click "Reset rotations" on a program — toast names program, hub, counts. Click "Reset this team" — toast names the hub explicitly.
6. **Schedule page deep-link.** Try `/tools/schedule?month=2026-08&hub=host-team` directly — should land on August 2026 view. Bad input (`?month=foo`) silently falls back to current month.

### Known follow-ons (queued)

- ~~**Manual chapter.**~~ ✅ Closed in `71822d0`.
- **Admin form exposure for hub coverage copy.** `/admin/hubs/[slug]/edit` doesn't yet have inputs for the three new `coverage*` fields. New hubs created via the form get host-team defaults. Currently the only way to change them is a one-off migration. ~15 min slice — three text inputs + POST/PATCH wiring.
- **Push the `endDatetime` check into `isOccurrenceOnDate`.** The staffing view fixes it locally for itself; `/tools/schedule` and `/this-week` share the helper and have the same blind spot. Small refactor, removes a future-bug class.
- **Editing in the staffing view.** Currently read-only with deep-link to per-hub editing. A future iteration could allow inline editing — but it requires careful UX about which hub the action is scoped to, because the same surface shows multiple hubs.
- **Behavior change re: sub-claim rows on rotation removal.** `release-host` no longer frees future HostAssignments where the user took the row via sub-claim. Intentional — sub-claims are individual commitments. Documented. Revisit if it causes operational confusion.
- **Replaced-user email parity.** `sendStandingAssignmentReplacedEmail` doesn't use `firstSessionMonth` — but a displaced user has no future rows in those months so the deep-link wouldn't help. Leave as-is unless signal emerges.
- **(Low priority) Profile-edit silent-name-erasure bug.** `app/account/(authenticated)/dashboard-my-profile/page.tsx` lines 77-85 — the server action writes whatever the form submits, including empty strings. If a user opens their profile and saves without filling firstName/lastName (common when those were always null and only `preferredName` was set), their existing values are silently overwritten. Surfaced when Maria's record showed her name as "Unnamed" after she'd been testing — almost certainly her own profile save with empty inputs cleared the fields. **Restore via `/admin/members/[id]`** as the one-time fix; the code change to prevent recurrence is small (read existing values, only overwrite when form value is non-empty). Loses the "clear a field" affordance, which is rarely a real need.

### Memory files added this session

- `feedback-pattern-audit.md` — when the reviewer sub-agent identifies a class of bug (not a single local mistake), the fix is not done until the same pattern has been grepped across the codebase. Triggered by the FK-Restrict pattern surfacing in three production routes after I fixed it only in the migration + PUT handler. **Second data point added at the end of the arc:** *the user's described failure mode is the primary framing signal; supporting screenshot context is supporting evidence, not the framing.* Two over-corrections in the arc traced to this — multi-claim Rotations-tab hide (revert) and the broader "is this UI conceptually wrong" reading instead of "this specific click failed."

---

### Session 129 + follow-ups (2026-05-25) — Auxiliary-hub coverage shipped, refined, and audited

The session-129 architecture is now operational + post-ship-tested + audited. Six commits beyond the original ship:

1. `10cf18d` — "Host Schedule" h1 renamed to "Scheduler" (generic across hubs)
2. `0c03e03` — `hasSchedule` vs `usesScheduler` separation (real bug — AV/greeter were rendering the host-team-style Home view)
3. `4a8ac15` — Helpful empty-state copy on Scheduler + Rotations when no programs are tagged for the hub
4. `d3efc57` — Hosting & Access tab UX cleanup (clean filters on Hosting team dropdown + Auxiliary fieldset, intro paragraph, format-aware Auxiliary list)
5. `c9598bb` — `hasSchedule` exposed in admin form + data fix for peer-led-silent-meditation (had been false in DB since admin form never exposed it)
6. `cc265a8` — Audit fixes: `clear-rotations` route is now hub-aware; "Reset everything" is now per-hub + hub-coordinator-gated

**Architecture is now sound across all four scheduler-using hubs** (host-team, peer-led-silent-meditation, audio-visual, greeter). The five-phase audit confirmed every routing layer is hub-correct and every edge case behaves.

### What to verify on the deployed site once `cc265a8` lands

1. **Peer-Led Silent Meditation appears in the Hosting team dropdown** on any program editor → Hosting & Access tab.
2. **Auxiliary coverage is cleanly filtered.** In-person/hybrid programs show only AV + Greeter under "Auxiliary role coverage." Virtual-only programs show "Not applicable" copy. Peer-Led Silent Meditation no longer appears in Auxiliary.
3. **The "This hub runs live sessions" checkbox** appears in `/admin/hubs/[slug]/edit`. Checked on host-team + peer-led; unchecked on AV + greeter.
4. **"Reset this team" works per-hub.** Open `/tools/schedule?hub=greeter` → Rotations tab → Reset wipes only greeter's data. Host-team Scheduler stays intact.
5. **Per-program Reset is also per-hub.** A hybrid program tagged for AV: clicking Reset rotations from `?hub=audio-visual` only clears AV's rotations on that program. The program's host-team rotations are untouched.
6. **Empty Scheduler reads correctly.** A hub with no tagged programs shows the helpful "No programs are scheduled with this team yet" copy rather than a blank page.

### Setup steps still pending (not blocking)

To get programs flowing into the AV + Greeter Schedulers:

1. **Add Scheduler `HubAppLink`** to `/admin/hubs/audio-visual/edit` and `/admin/hubs/greeter/edit`. Path: `/tools/schedule`. The sidebar auto-appends `?hub=<slug>`.
2. **Tag programs.** Open in-person or hybrid programs in `/tools/programs/[slug]/edit` → Hosting & Access tab → tick "Audio Visual" and/or "Greeter" under Auxiliary role coverage.
3. **Add hub members** via each hub's Members tab.

### Known follow-ons (queued, not urgent)

- **Hub-aware new-program notifications.** When a coordinator creates a hybrid program AND ticks AV/greeter auxiliary coverage, only the primary hub gets the "new program needs a host" email. The auxiliary teams don't yet. Worth a separate slice when the operational need is real.
- **Manual chapters for AV + Greeter hubs.** Not seeded this session. Can be authored via `/admin/manual/<slug>/edit` after the hubs go live, or as a follow-on migration seed. The greeter chapter should explain the open-sign-up model.
- **AV sub-request flow live test.** Single-slot AV inherits sub-requests automatically. Verify on first live test that the AV team's notification pool routes correctly (should — code uses `assignment.hubSlug`).
- **PDF schedule export hub-scoping.** Currently exports all of the requesting user's HostAssignments regardless of hub. Probably fine since it's a personal export; revisit if AV/greeter members ask.

### Memory files added in this session

- `feedback-clear-seeing-is-correctness.md` — for RIM UI work, visual hierarchy + plain-language state + self-recognition are correctness criteria, not polish to defer. Triggered by my initial "minimum viable + refine later" framing of the multi-claim Scheduler row. Already indexed in MEMORY.md.

---

### Session 129 (2026-05-25) — Auxiliary-hub coverage: AV + Greeter hubs shipped (original entry below for cross-reference)

One coherent slice landed all in one push: the program↔hub model generalized from 1:1 to many-to-many with a role dimension, AV + Greeter hubs configured + wired into the Scheduler, multi-claim sign-up UX added for the greeter hub.

**What you'll do on the deployed site after this push completes:**

1. **Wait ~2 min for Vercel.** Watch the build log for the `auxiliary_hub_coverage_v1` migration output — column adds, backfills, unique-constraint swap, table create, hub auto-config. The two hubs you pre-created (`audio-visual`, `greeter`) get auto-configured by the migration's `updateMany` step (formats + multi-claim flag + `hasSchedule`).

2. **Assign the Scheduler tool to both new hubs.** `/admin/hubs/audio-visual/edit` and `/admin/hubs/greeter/edit` → add a `HubAppLink` to `/tools/schedule?hub=audio-visual` and `/tools/schedule?hub=greeter` respectively. (Held off intentionally during the build — assigning before the code landed would have shown empty calendars; now there's a destination.)

3. **Tag programs with auxiliary coverage.** Open any in-person or hybrid program in `/tools/programs/[slug]/edit` → Hosting & Access tab → check "Audio Visual" and "Greeter" under the new "Auxiliary role coverage" fieldset → save. `ProgramCoverageHub` rows written.

4. **Add members.** AV team members and greeter signups via each hub's Members tab. Standard hub-membership flow.

5. **Exercise the two flows.**
   - **AV (single-slot):** sign in as an AV member → `/tools/schedule?hub=audio-visual` → click "Yes, I can host" on an open session → confirm HostAssignment row in `hubSlug = audio-visual`. Email confirmation links back to `/tools/schedule?hub=audio-visual`.
   - **Greeter (multi-claim):** sign in as a greeter → `/tools/schedule?hub=greeter` → each session card reads "No one yet — be the first?" when empty. Click "I'll be the first" → row updates to "You're signed up" with your name plus a "YOU" mark. A second greeter signs up → "2 signed up · you're one of them" / "2 signed up" depending on who's viewing.

6. **Verify three independent role pools on a hybrid program.** Pick a program tagged for host-team (primary) + audio-visual + greeter. Three Scheduler views (`?hub=host-team`, `?hub=audio-visual`, `?hub=greeter`), each showing only its own claims for the same session date.

7. **Standing rotations per hub.** As coordinator, open `/tools/schedule?hub=audio-visual` → Rotations tab → set up an AV rotation. Save + apply. Verify the applied HostAssignments land in `hubSlug = audio-visual`; verify a same-program same-day host-team rotation can coexist independently.

**Architectural calls made this session worth carrying forward:**

- **One program ↔ many hubs is the right shape.** This is the third hub generalization in two weeks (Slices 1, 2.6, 129) ratcheting toward the same truth: hubs are role pools, not program owners. After 129 every layer — schema, helpers, API gates, UI, emails, standing rotations — speaks the same many-to-many vocabulary. Future hubs (cleanup crew, livestream tech, etc.) are configuration on top of this architecture, not new code.
- **Clear-seeing UI is correctness, not polish.** Jesse pushed back on my framing of the first multi-claim row as "minimum viable; refine after testing." For RIM specifically, plain-language state sentences + visual hierarchy + self-recognition are correctness criteria per the design philosophy doc, not refinement to defer. Saved as memory file `feedback-clear-seeing-is-correctness.md`.
- **Sub-requests don't apply to open sign-up.** Greeter hub has no "need a sub" semantic — release-my-claim is the only exit. API enforces; UI hides the affordance.
- **Format filter declared on the hub, not hardcoded.** `Hub.appliesToFormats` makes future hubs configuration rather than code changes.

**Known follow-ons (not blocking; do when signal emerges):**

- **Manual chapters for AV + Greeter.** Not seeded this session. Can be authored via `/admin/manual/<slug>/edit` or as a follow-on migration seed. The greeter chapter especially should explain the open-sign-up model (no sub-requests; cancel-my-signup is the only exit).
- **Cross-hub coordinator UX.** No special UI yet for someone who's in host-team + audio-visual + greeter. They see the active hub from the URL and switch via the sidebar. Probably fine; revisit if it becomes friction.
- **AV sub-request flow.** Single-slot AV inherits sub-requests automatically. Verify on first live test that the AV team's notification pool routes correctly (it should — uses `assignment.hubSlug`).
- **Assignments-GET pause-map.** Already scoped per-requested-hub; verify on first live test that AV/greeter paused-member badges render correctly.

---

### Session 128 cumulative (2026-05-22) — Silent Meditation Hub fully operational + hub-isolation hardening + engineering reference docs

Single long arc: Slice 1 architecture (already documented in last close), then Slice 2 operational rollout, then Slice 2.5 hub-isolation hardening (the gap Slice 1 missed — email URLs + welcome-email reliability), then Slice 2.6 standing-rotation generalization (the gap Slice 1 had deferred), then three engineering reference docs to prevent the same class of gap from recurring.

**State of the architecture:** the Silent Meditation Hub is fully operational and properly isolated end-to-end. Closes backlog `2026-05-25-003`.

**Commits on `main` from this arc (chronological):** `aba2e60` (Hub admin form dropdown UX), `47141e2` (Add-me-as-coordinator endpoint), `3fba168` (ADMIN no longer bypasses hub content), `5a7c7ed` (manual chapter), `cccf020` (Scheduler tool rename), `dafc409` (Your Rotations panel hub-scope), `fdb441d` (Slice 2.5 code), `86ce52e` (Slice 2.5 engineering docs + CLAUDE.md updates), `e446213` (sub-request email program name fix), `a80dc17` (CTA button template swap migration), `03f8537` (Email Template Gate policy clarification), `51d1207` (Slice 2.6 standing-rotation generalization), `d5ad0fc` (Scheduler doc post-2.6 update), `89051f3` (Rotations tab visibility fix).

**What's now operational:**

- `peer-led-silent-meditation` hub exists with `assignmentGrantsTeacher: true`, `teacherLabel: "Facilitator"`, Jesse as coordinator
- Good Morning + Good Evening Silent Meditation programs transferred to the hub
- Peer leaders can claim sessions; act of claiming confers Teacher capability (Facilitator pill + bell-friendly audio) without needing a ProgramTeacher row
- Every email sent from a peer-led action carries `?hub=peer-led-silent-meditation` so recipients land in the correct hub view
- Welcome emails actually deliver (was silently killed by Vercel teardown pre-fix)
- Rotations tab visible in the peer-led hub for coordinators; API gates by program's hub via the new `isHubCoordinator` helper
- ADMIN must be a HubMember to interact with hub content (matches GUIDING_TEACHER pattern; "+ Add me as coordinator" admin affordance closes the bootstrap catch-22)

**Three new modular engineering reference docs** loaded via the Design Orientation table:

- `RIM_Hub_Engineering.md` — every rule for hub-touching code (the four routing layers, helpers, ADMIN policy, common pitfalls)
- `RIM_Email_Engineering.md` — every rule for outbound email code (template gate, URL helpers, after() pattern, CTA convention)
- `RIM_Scheduler.md` — per-tool reference for `/tools/schedule` and its routes

CLAUDE.md closing ritual gains four new steps: 4b (engineering-doc updates), 4c (hub audit across the four routing layers), 4d (per-tool engineering doc creation when a slice touches a tool without one — self-perpetuating, grows the docset organically).

**What testing on the deployed site should confirm (cumulative):**

1. **Nancy's end-to-end flow.** Add Nancy as peer-led-silent-meditation member → she gets a welcome email pointing to `/account/hub/peer-led-silent-meditation`. Someone requests a sub on a Good Morning session → Nancy gets a sub-request email reading "X needs a sub for **Good Morning Silent Meditation**" (human-readable program name) with the "Cover this session" link landing her at `/tools/schedule?action=cover&id=...&hub=peer-led-silent-meditation`. She claims → joins the session room → sees Facilitator pill (warm gold) + bell-friendly audio + End-for-All authority.
2. **Rotations tab visible in peer-led hub.** Open `/tools/schedule?hub=peer-led-silent-meditation` as coordinator. Schedule | Rotations tab strip at the top. Click Rotations. Empty rotations grid. Create a rotation, save (no 403), apply. Affected peer leader gets the standing-rotation scheduled email with the link scoped to peer-led hub.
3. **CTA buttons render after template edit.** At `/admin/emails/sub-request-posted` (and the other five touched templates), swap the plain markdown CTA link for `{{coverButton}}` / `{{scheduleButton}}` / `{{hubButton}}`. Save. Next email renders the canonical button (RIM-blue, white bold, centered).
4. **Welcome email actually delivers.** Add a new member to any hub; confirm the email lands. If failure occurs, the Vercel log shows the error (no more silent swallow).
5. **ADMIN-without-membership is correctly blocked from hub content** but can still configure hubs from `/admin/hubs`. The "+ Add me as coordinator" button on the admin edit page bootstraps you in.

**Known limitations / parked:**

- **Apply-all standing-assignment emails span hubs.** When a single user's batched emails cover sessions across hubs (rare manager-only case), the schedule link falls through to host-team scope. Acceptable for now; could split into per-hub emails if signal emerges.
- **Assignments-GET pause-map still host-team-scoped.** Low impact (UI affordance, not security gate); revisit when peer-led members start being paused via their hub.
- **PDF schedule export not hub-scoped.** "My schedule" is personal; revisit if peer-led members ask.
- **9 other fire-and-forget patterns** in the codebase (enrollment side-effects in `/api/admin/members`, `/api/account/complete-profile`, `/api/registrations`, `/api/stripe/webhook`). Same `after()` treatment as the welcome-email fix. Queued for a focused reliability sweep.
- **Hub creation could auto-add the creator as coordinator.** Removes the "+ Add me as coordinator" extra step. Small polish.
- **Friendly "no access" message for admins.** When an admin lands at a hub they're not a member of, link them back to the admin edit page. Small UX polish.

---

### Next priority — Voice extraction (`RIM_Voice.md`)

Discussed at the end of this session in response to Jesse's "Co-work OS blueprint" prompt. The pattern RIM is missing: a writing-voice profile extracted from Jesse's actual writing samples, loaded contextually for any prose-producing task (manual chapter drafts, session-log entries, UP_NEXT rewrites, email body drafts).

**Process:** Jesse gathers 5–10 things he's written that sound most like him — manual chapter edits, conversation thread replies in hubs, sangha emails, a personal blog post if he has one. Run the analysis: extract mechanics (sentence structure, cadence), tone attributes, vocabulary choices, structural quirks, avoid-list. Save as `RIM_Voice.md`. Add to CLAUDE.md Design Orientation table: *"Any task that produces prose for the RIM voice (manual chapters, sangha emails, public copy, session-log entries) — read `RIM_Voice.md`."*

Expected 15–20 minutes of focused work when Jesse has the samples ready. Compounds with the engineering-docs investment — Claude's output across all docs and email drafts becomes measurably closer to Jesse's voice.

---

### Then — choose one

A) **Behavior-audit at closing.** Add step 9b to CLAUDE.md closing ritual: *"Scan the session for corrections that should become memory files. Propose new memory entries or updates."* Five-minute change. Makes the existing memory system more rigorous.

B) **Fire-and-forget reliability sweep.** The 9 remaining `.catch(() => {})` patterns in the codebase (non-email enrollment side-effects). Same shape as the welcome-email fix; codebase-wide. Could lose enrollments, role-side-effects, or payment-completed actions today. Not urgent until something breaks operationally, but the pattern is identified.

C) **Hub-creation auto-coordinator polish.** Removes the "+ Add me as coordinator" extra step. Every future hub creation just works.

D) **Rate-limit on `/api/auth/callback/resend`** (`2026-05-21-002`). Defense-in-depth. Worth doing before the platform goes public on `rootedinmindfulness.org`.

---

### Smaller items still parked

- **Rate-limit `/api/auth/callback/resend`** — `2026-05-21-002`. Still open.
- **Audit-trail soft nudge in EndMenu** — speculative; don't build until real signal.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected; architecture decision parked at session 120.

---

### Previously — Session 128 (2026-05-22) — Silent Meditation Hub Slice 1 architecture shipped (now superseded by the cumulative entry above)

One code commit on `main` (`500fa64`). All of Slice 1 of the two-slice plan documented at the end of session 127. The architecture is now in place; the actual `peer-led-silent-meditation` hub doesn't exist yet — Slice 2 creates it via `/admin/hubs` and moves the silent-sit programs onto it.

**Slice 1 is inert until Slice 2 lands** — no program has `hostingHubSlug` set (everything still routes to host-team), no hub has `assignmentGrantsTeacher: true`, so no behavior change is visible to anyone yet. That's intentional.

**What shipped (`500fa64`):**

- Three new schema columns (idempotent ALTER TABLE adds, no backfill): `Program.hostingHubSlug String?` (null = `host-team` default), `Hub.assignmentGrantsTeacher Boolean @default(false)`, `Hub.teacherLabel String?`.
- New helper `lib/programHub.ts` with `getProgramHubSlug`, `getProgramHostingHub`, `resolveTeacherPillLabel`, `DEFAULT_HOSTING_HUB_SLUG`.
- `resolveSessionRole` broadens — `isProgramTeacher` layers two paths now: existing `ProgramTeacher` row OR active HostAssignment in a hub that grants teacher capability. Co-host + Step-In gates route by program's hub.
- LiveKit token + step-in apply the pill label hierarchy `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`.
- Host operation routes (`/api/host/assignments` POST, sub-requests POST + claim, programs-pg POST notification) all route to the program's hub.
- Schedule page filters programs by hub (host-team scope catches null + explicit via Prisma `OR`).
- ProgramEditor restructured — new "Hosting & Access" tab between Schedule and Categories. `teacherLabel` moved out of Content; `isOpenAccess` + `guestAccessKey` moved out of Schedule. Added `hostingHubSlug` dropdown ("Host Team (default)" stores null; other options are active hubs).
- Mid-flight warning when a coordinator changes the hub on a program with future HostAssignments — count fetched on the edit page; grandfather policy explained inline.
- Slug validation on POST + PUT (`programs-pg`) — 422 on unknown hub slug. Reviewer sub-agent caught this pre-commit.

**Deferred to Slice 2 (intentional, documented in commit body):**

- Standing-rotation routes still gate by `host-team`. Peer-led hub doesn't surface standing rotations yet.
- Assignments-GET pause map still gates by `host-team`. Generalize when Slice 2 needs it.

**What testing on the deployed site should confirm (backward compat — should be inert):**

1. Open any existing program in `/tools/programs/[slug]/edit`. New "Hosting & Access" tab sits between Schedule and Categories. Dropdown reads "Host Team (default)". Save without changing — behavior identical.
2. `teacherLabel` (session 127) still works after the move from Content to Hosting & Access.
3. Open Access (`isOpenAccess` + `guestAccessKey`) moved from Schedule to Hosting & Access for virtual/hybrid programs; guest links still work.
4. `/tools/schedule` with no `?hub=` still shows every host-team program — no disappearances. The Prisma `OR` filter catches null and explicit `"host-team"`.
5. The new hub field is wired but inert. No hub has `assignmentGrantsTeacher: true` yet, so no behavior change anywhere. Slice 2 turns it on.

---

### Next priority — Silent Meditation Hub Slice 2 (admin-only, no code)

The architecture is fully built. Slice 2 is admin actions in production:

1. **Create the hub.** `/admin/hubs` → create `peer-led-silent-meditation`. Type OPERATIONAL. Set `assignmentGrantsTeacher: true` and `teacherLabel: "Guide"`. Pick coordinator(s).
2. **Add the tool link.** Create a `HubAppLink` pointing to `/tools/schedule?hub=peer-led-silent-meditation` so members reach the schedule from their hub home.
3. **Transfer programs.** Edit Good Morning Silent Meditation and Good Evening Silent Meditation → "Hosting & Access" tab → set Hosting team to `peer-led-silent-meditation`. The mid-flight warning will fire if any host-team members have already claimed upcoming sessions — confirm the grandfather notice reads correctly (existing assignments stay; new claims route to the new hub).
4. **Add peer leaders as HubMembers.** Active status, `hostingCapability: true`, `communicationsEnabled` per each leader's preference. Coordinator handles via the hub's Members tab.
5. **End-to-end test.** A peer leader signs in → opens `/tools/schedule?hub=peer-led-silent-meditation` → sees the next open Good Morning session → clicks claim → confirms HostAssignment row created → joins the session room → confirms (a) their tile shows the **Guide** pill (warm gold, hub-level label), (b) bell-friendly audio is on, (c) End-for-All authority is theirs as the assigned host.
6. **Staff manual.** Either extend the existing `host-hub` chapter or create a new `peer-leader-hub` chapter explaining: how the hub differs from host-team, the claim flow, what the Guide pill means, the bell-friendly audio profile. Migration self-heal (v10 of the relevant chapter).
7. **Close backlog `2026-05-25-003`** when the hub is operational and the first session has been claimed + run successfully.

**Things to confirm during Slice 2:**

- **Sub-requests work the same flow, scoped to the new hub.** A peer leader who needs a sub for next Tuesday submits via the same UI → sub-request emails go to other active peer-led hub members → another peer leader claims. The recipient pool routes by program's hub (Slice 1 changed this); the email template stays the same (`host-assignment-confirmation`, `host-assignment-removed`).
- **Standing rotations are still host-team-only.** Peer-led hub doesn't have a rotations feature yet (deferred). If the silent sits want standing rotations later, that's a Slice 3 generalization.
- **Programs without ProgramTeacher rows are fine.** A peer leader who claims a session gets the Teacher pill (label "Guide") + bell-friendly audio purely from the hub's `assignmentGrantsTeacher` flag. No need to wire them as ProgramTeachers.

---

### Then — verification of sessions 126 + 127 + 128 on the deployed site

All three sessions of session-room work have not yet been verified end-to-end on the live site:

- **126** — time-gated tokens, per-session room names, chat clearing each session.
- **127** — per-program `teacherLabel` override (Teacher / Guide / Facilitator / Instructor / Custom).
- **128** — new "Hosting & Access" tab, field moves, hub dropdown (inert until Slice 2).

Plus the session 125 work (raised-hand queue, persistent vote signals, host identity-vs-capability split) is also still pending end-to-end test on a live session.

Worth a single dedicated test session — host a real practice session, exercise each surface, capture any drift before traffic grows.

---

### Smaller items still parked

- **Rate-limit `/api/auth/callback/resend`** — `2026-05-21-002`. Defense-in-depth. Worth building before the platform goes public on `rootedinmindfulness.org`.
- **Audit-trail soft nudge in EndMenu** — speculative; don't build until real signal.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected; architecture decision parked at session 120.

---

### Session 127 (2026-05-26) — Per-program teacherLabel shipped; verification pending on deployed site

One code commit on `main` (`fbbf955`) plus a closing-ritual doc sweep. Closes backlog `2026-05-25-002`. Lands as the prerequisite for the Silent Meditation Hub (`2026-05-25-003`) so peer-led offerings can carry "Guide" pills when that hub goes live.

**What shipped (`fbbf955`):**

- New nullable `Program.teacherLabel String?` column. Null = default "Teacher" pill text (existing behavior). Coordinator can override per program — "Guide" for peer-led silent sits, "Facilitator" for recovery offerings, "Instructor" for skills classes, or a Custom… free-text label (max 20 chars).
- ProgramEditor Content tab gains a dropdown below Teacher / Facilitators: *Teacher (default) · Guide · Facilitator · Instructor · Custom…*. Custom reveals a text input.
- Server-side sanitizer `lib/programUtils.ts::sanitizeTeacherLabel` allows Unicode letters/marks (for accented characters and non-Latin scripts), digits, spaces, hyphens, apostrophes. Strips → collapses whitespace → trims → slices at 20 → trims again.
- `/api/livekit/token` and `/api/livekit/step-in` add `teacherLabel: true` to the Program select. When `isProgramTeacher` AND `program.teacherLabel` non-null, they seed `teacherLabel` into participant metadata alongside `teacher: true`. Both responses also return `teacherLabel` for client-state parity.
- Session page captures `teacherLabel` from token + step-in responses, threads it through `VideoRoom` → `RIMConference` (new prop). RIMConference's belt-and-suspenders metadata seeder broadcasts the label via `localParticipant.setMetadata` after connect.
- `ParticipantMetadata` interface gains `teacherLabel?: string`. `RIMParticipantTile` and `ParticipantsPanel` (both local Me row and remote rows) render `meta.teacherLabel || "Teacher"` instead of the hardcoded string.
- Manual chapter `host-session-room` v9 self-heals on next deploy — adds a one-line note to the Teacher pill section explaining the per-program label variation.

**Mechanism is unchanged.** A `ProgramTeacher` row still drives the bell-friendly audio profile and the Teacher pill on the tile. teacherLabel is purely cosmetic — same CSS class, same color (warm gold), only the text varies.

**Reviewer sub-agent caught three concerns pre-commit (all fixed):**

1. Sanitizer ordering — strip → slice, not slice → strip.
2. Regex too tight — widened from `/[^A-Za-z\\s\\-]/g` to `/[^\\p{L}\\p{M}\\d\\s'\\-]/gu` so realistic role names like "Teacher's Aide", "Co-Leader 1", "rōshi", "Senpai" all pass.
3. Step-in response parity — now also returns `teacherLabel` alongside the token route.

**What testing on the deployed site should confirm:**

1. **ProgramEditor dropdown.** Open one of the programs you teach (e.g. Essential Dharma Study) in `/tools/programs/[slug]/edit`, Content tab. The "Pill label for linked teachers" dropdown is below the Teacher / Facilitators field. Picking Custom reveals a text input.
2. **Default behavior unchanged.** Save with the dropdown on "Teacher (default)" — should round-trip null in the DB. Join the session; your tile still shows the "Teacher" pill, identical to before.
3. **Custom label round-trip.** Change the dropdown to "Guide" on one of the silent-sit programs (Good Morning Silent Meditation, once you set up a ProgramTeacher for it). Save. Join the session as that teacher. Your tile and your row in the Participants panel should now read "Guide" instead of "Teacher" — same gold color.
4. **Sanitizer.** Try typing a custom label with disallowed characters (HTML tags, emojis, special punctuation). Save. The stored value should be the cleaned string; weird characters should be stripped.
5. **Step-In propagation.** Have a teacher Step-In on a program where they're a ProgramTeacher and teacherLabel is set. Their pill should immediately show the correct label, not "Teacher".

**Known limitations:**

- **The label survives mid-session via promote-don't-demote.** If a coordinator changes the label from "Guide" back to "Teacher (default)" while someone is mid-session, the seeder won't clear the prior `teacherLabel` from the participant's metadata until they reload. Cosmetic only; not worth bidirectional sync logic.
- **The pill is a UI cue, not a security boundary.** `canUpdateOwnMetadata: true` still applies — a malicious client could forge `teacherLabel` in their own metadata. The pill is what the participant *claims* to be, not a server-validated identity. Real authority (mute, end, screen share) is still gated server-side via `resolveSessionRole`.

---

### Next priority — Silent Meditation Hub (backlog `2026-05-25-003`)

**Design fully decided in session 127 follow-up conversation. Build can begin cold.** Hub is specific to peer-led silent meditation; the *pattern* it establishes will template future peer-led hubs.

#### Final design

**Hub name:** `peer-led-silent-meditation` (long but explicit; this hub is specific to the silent meditation offerings).

**Program ↔ Hub link.** New column **`Program.hostingHubSlug String?`** on Program. Null defaults to `host-team` (the implicit default; preserves every existing program's behavior — pure additive, no backfill needed). Set to `peer-led-silent-meditation` on silent-sit programs to transfer hosting authority.

> **Why not the category?** Categories are coordinator-editable UI groupings. If a coordinator deletes/renames a category, the hosting policy would silently break. Same lesson as session 125 (identity vs. capability): don't overload one field with two meanings. Direct field on Program is explicit, survives category restructuring, and matches how `HostAssignment.programSlug` already works (slugs are stable join keys per CLAUDE.md).

**Hub grants teacher capability.** Two new fields on Hub:

- **`Hub.assignmentGrantsTeacher Boolean @default(false)`** — when true, an active HostAssignment from this hub confers teacher capability on top of host capability. Host-team stays false (existing behavior). Peer-led-silent-meditation hub sets true.
- **`Hub.teacherLabel String?`** — default pill text for assignments from this hub when `assignmentGrantsTeacher` is true. Peer-led hub sets `"Guide"`.

**`resolveSessionRole` broadens.** `isProgramTeacher` becomes true if EITHER (existing) a `ProgramTeacher` row exists OR (new) the user has an active HostAssignment for this session AND the program's hub has `assignmentGrantsTeacher: true`. Audio-profile derivation and Teacher pill rendering inherit naturally.

**Teacher pill label hierarchy.** `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"` — most specific wins. Program-level override (session 127) still takes priority; hub default is the fallback when the assignment grants teacher capability.

**Capability gates broaden by hub.** `getEffectiveHostingCapability` is per-hub already; the change is in *which* hub is consulted for a given program — derived from `program.hostingHubSlug ?? "host-team"`. Self-claim, sub-request, mute-*, end-session, step-in all route by program → hub.

**Sub-requests work the same flow, scoped to program's hub.** Recipient pool is `getHubNotificationRecipients(program.hostingHubSlug ?? "host-team")`. UI/routes unchanged in shape; only the hub-scope of who-gets-notified changes.

**Schedule view: strict per-hub.** `/tools/schedule?hub=peer-led-silent-meditation` shows only programs whose `hostingHubSlug` is this hub. No unified view — multi-hub members switch via the sidebar. The page already takes `?hub=` context via `getToolHubContext`.

**Mid-flight migration policy: grandfather existing HostAssignments.** When a program transitions from one hub to another (`hostingHubSlug` changes), existing future HostAssignments stay (the assigned person keeps their session). New self-claims route to the new hub. Editor shows a warning when changing the field on a program with upcoming assignments.

#### Editor UX — new tab "Hosting & Access"

ProgramEditor gets a new tab between Schedule and Categories. **Tab name: "Hosting & Access".** Most coordinator-friendly because the label tells you exactly what's there: hosting (who runs it) and access (who can join). Decided after rejecting "Session" (ambiguous), "Hosting" (overloads with Host Team), "Live Event" (loses the "who can come" dimension), and "Session Room" (codebase-familiar but Zoom-y).

**Order:** Content · Schedule · **Hosting & Access** · Categories · Registration · Dana · Home Card · Visibility

**What lives there:**

- `hostingHubSlug` (new) — "Hosting team" dropdown. Default option reads "Host Team (default)" and stores null. Options pulled from the active hub list. Always applies (in-person or virtual). Mid-flight change shows a warning if upcoming HostAssignments exist on the program.
- `teacherLabel` — **moved from Content tab.** Closely tied to who-runs-the-session, not editorial. The teacher search itself stays in Content (the teacher is editorial — they appear on the public program page); only the pill label moves.
- `isOpenAccess` + `guestAccessKey` — **moved from Schedule tab.** They're about who can join, not when/where.

**Why the moves.** Three fields scattered across two tabs share one concern: how the live session behaves and who has authority in it. The trend will continue (per-program audio profile, time-gate adjustments, recording policy, participant cap, chat permissions are all plausibly coming). Better to relocate two fields now than to keep adding to the wrong places. teacherLabel just shipped two commits ago — this is the cheapest possible moment to relocate it.

#### Open design question — bell-friendly audio fallback

**Resolved.** Earlier-parked question ("should *any* Session Host get bell-friendly audio, regardless of ProgramTeacher status?") is closed by this design. The hub-grants-teacher mechanism makes per-row teacher data unnecessary for peer-led offerings: being assigned to lead a session in this hub IS the teacher capability. No flag needed on the audio-profile derivation itself. The architecture is cleaner than per-program "bellFriendlyForHost" flags would have been.

#### Build plan — two slices

**Slice 1 — Architecture (code, no new hub yet).**

1. Schema: add `Program.hostingHubSlug String?`, `Hub.assignmentGrantsTeacher Boolean @default(false)`, `Hub.teacherLabel String?`. Migration in `prisma/migrate.mjs` — three `ALTER TABLE` adds, no backfill.
2. `resolveSessionRole` (`lib/livekitAuth.ts`): broaden `isProgramTeacher` to include the hub-assignment path. Update the comment header.
3. Pill label hierarchy in token + step-in seeds: `program.teacherLabel ?? hub.teacherLabel ?? null`. Fetch hub when needed; cache the join in the program select where possible.
4. Capability gate broadening: helper `getProgramHubSlug(programSlug): string` that returns `program.hostingHubSlug ?? "host-team"`. Use it in mute-*, end-session, step-in, sub-request, self-claim, schedule tool.
5. ProgramEditor: add the "Hosting & Access" tab. Move teacherLabel out of Content. Move isOpenAccess + guestAccessKey out of Schedule. Add hostingHubSlug dropdown.
6. `/tools/schedule` filter: when `?hub=...` is set, filter to programs where `hostingHubSlug === that hub` (or fall through to host-team for null when hub is host-team).
7. Mid-flight change warning in ProgramEditor: when coordinator picks a different hub on a program with upcoming HostAssignments, show a notice listing the count + clarifying the grandfather policy.
8. Type-check, reviewer sub-agent, commit, push.

**Slice 2 — Configuration (no code; admin actions + first run).**

1. Create `peer-led-silent-meditation` via `/admin/hubs`. Set `assignmentGrantsTeacher: true`, `teacherLabel: "Guide"`. Type OPERATIONAL. Pick coordinator(s).
2. Add an `HubAppLink` to `/tools/schedule?hub=peer-led-silent-meditation`.
3. Decide which silent meditation programs (Good Morning, Good Evening) get `hostingHubSlug: "peer-led-silent-meditation"`. Set via the new dropdown. Confirm the grandfather warning behaves correctly if any host-team assignments exist.
4. Add the first peer leader(s) as HubMembers (active, hostingCapability true, communicationsEnabled per preference).
5. Have a peer leader test the claim flow end-to-end: `/tools/schedule?hub=peer-led-silent-meditation` → see open sessions → click claim → confirm HostAssignment row written → join the session → confirm Teacher pill reads "Guide" with bell-friendly audio.
6. Manual chapter — extend `host-hub` or create `peer-leader-hub` chapter explaining the model + claim flow. Closing-ritual update.

#### Files this will touch (slice 1)

- `prisma/schema.prisma` — Program.hostingHubSlug, Hub.assignmentGrantsTeacher, Hub.teacherLabel
- `prisma/migrate.mjs` — three ALTER TABLE entries with migration flags
- `lib/livekitAuth.ts` — broaden isProgramTeacher, update comments
- `lib/hubMemberAuth.ts` (possibly) — helper `getProgramHubSlug` or similar
- `app/api/livekit/token/route.ts` — fetch hub teacherLabel, fall through label hierarchy
- `app/api/livekit/step-in/route.ts` — same
- `app/api/livekit/mute-participant/route.ts`, `app/api/livekit/mute-all/route.ts`, `app/api/livekit/end-session/route.ts` — route by program hub
- `app/api/host/assignments/route.ts` — self-claim respects program.hostingHubSlug
- `app/api/host/sub-requests/route.ts` — recipient pool routes by program hub
- `components/registrar/ProgramEditor.tsx` — new tab; move teacherLabel + Open Access; add hostingHubSlug dropdown; mid-flight warning
- `app/api/programs-pg/route.ts` + `app/api/programs-pg/[slug]/route.ts` — accept hostingHubSlug
- `app/tools/schedule/page.tsx` — filter programs by hub
- `app/tools/programs/[programSlug]/edit/page.tsx` — pass hostingHubSlug to ProgramEditor initialData
- Doc sweep at closing: session-log, FEATURES.md §38, Stack Reference, System Architecture, manual chapter, backlog (close `2026-05-25-003` after slice 2), UP_NEXT

---

### Smaller items still parked

- **`/api/livekit/token` server-side time gate** — ✅ Closed in session 126.
- **Per-program teacherLabel dropdown** — ✅ Closed in session 127 (this session).
- **Rate-limit `/api/auth/callback/resend`** — `2026-05-21-002`. Still open. Defense-in-depth; preventive. Worth building before the platform goes public on `rootedinmindfulness.org`.
- **Audit-trail soft nudge in EndMenu** — speculative; don't build until real signal.
- **The PWA / native-app conversation** — `2026-05-21-001` rejected; architecture decision parked at session 120.

---

### Session 126 (2026-05-26) — LiveKit time-gated tokens + per-session rooms shipped; verification pending on deployed site

One code commit on `main` (`463f3bb`) plus a closing-ritual doc sweep. Closed one parked backlog item (server-side time gate) and quietly resolved a long-standing gap that surfaced mid-session — recurring programs were sharing one LiveKit room name across every occurrence, and chat scoped only by room name meant today's chat showed last week's messages. Jesse confirmed the policy mid-session: *every* program follows the per-session pattern, drop-ins included. No exceptions.

**What shipped (commit `463f3bb`):**

1. **Server-side time gate** on `/api/livekit/token` and `/api/livekit/guest-token`. Opens at `Program.startDatetime - 22 min`, closes at `Program.endDatetime + 30 min` (or `startDatetime + 90 min` when endDatetime is null). ADMIN and GUIDING_TEACHER bypass; guests have no bypass. Outside the window the route returns 403 with a plain-English `message` that the session page surfaces directly. Closes backlog `2026-05-24-002`.

2. **Per-session LiveKit room names.** Every program — recurring or one-off — now produces a room name like `slug-YYYY-MM-DD`. The schema (`SessionChatMessage.sessionDate`, `roomNameForProgram(slug, sessionDate)`) was already half-set-up for this; only the call site never passed the date. Token route now computes today's `sessionDate` via the new `lib/sessionWindow.ts::getActiveSessionWindow` and uses it for the room name. Chat (filtered by `roomName`) scopes per-session automatically with no query change. The session page captures `sessionDate` from the token response and threads it through `RIMChat`, `SessionRoleContext`, and the four action route callsites (mute-participant, mute-all, end-session, step-in).

3. **Defense-in-depth assertion** `assertSessionDateInWindow` on all four action routes. Refuses if the caller-supplied `sessionDate` doesn't match the currently open window (ADMIN/GT bypass). Step-In is the highest-stakes route (it writes a HostAssignment row); the others have low blast radius but the assertion is consistent. Caught by the reviewer sub-agent pre-commit.

4. **Forgot-to-End fallback (three layers).** Explicit End-for-All; LiveKit's empty-room idle cleanup (~5 min); the time gate at the door refusing new tokens after close. Tomorrow's room is a fresh name regardless.

5. **Format alignment.** Session window helper uses `scheduleUtils.shiftToDate(...).toISOString()` so the `sessionDate` it produces matches the format the schedule tool writes to `HostAssignment.sessionDate` — `resolveSessionRole`'s exact-match lookup hits existing rows correctly.

6. **Manual chapter v8 self-heal.** `host-session-room` chapter gains two paragraphs in "Your room opens early" explaining the time gate and per-session room policy. Migration flag `update_manual_host_session_room_v8` fires on next deploy.

**What testing on the deployed site should confirm:**

1. **The time gate refuses direct-URL access outside the window.** Sign in as a regular member, navigate to `/session/good-morning-sangha` (or similar) at 3am. Should show the calm "This session isn't open yet — it begins at X:XX" message. Repeat as ADMIN (you) — should let you in (bypass).
2. **The room actually opens 22 minutes before start.** Watch the dashboard around 22 min before a program. The "Open early as host" affordance shows up, and clicking through successfully connects (the page used to do this; verify it still does after the gate).
3. **Chat is per-session.** Join a recurring program, send a message in chat. Note the room name in the URL or the network tab (`good-morning-sangha-2026-05-26`). Next time that program meets (tomorrow if daily, next week if weekly), join and confirm yesterday's chat is *not* visible. The chat history should be empty/fresh.
4. **End-for-All still works.** As host, click End → "End for all". Everyone disconnects. Tomorrow's session opens in a fresh room.
5. **Mute-participant / Mute All still work.** Co-host hovers a tile, clicks the red Mute button. Participant gets server-side muted. Mute All button in the Participants panel footer mutes everyone.
6. **Step-In still works.** As a host-team member who isn't the assigned host, click "Step in as Host" in the header. The HostAssignment row gets written for the correct sessionDate (same ISO format the schedule tool uses); your tile now shows the Host pill.
7. **Manual chapter v8 self-heals on next deploy.** Visit `/admin/manual/host-session-room` after Vercel finishes; "Your room opens early" should have the two new paragraphs about the time gate and per-session rooms.

**Known limitations / parked items:**

- **Chat is not time-gated.** Chat reads and writes are high-frequency and the practical harm of an out-of-window write is small (an orphan message that nobody reads). If consistency matters more than perf, we can gate it as a follow-up.
- **Yesterday's chat rows are orphans, not deleted.** They stay in `SessionChatMessage` with the old slug-only `roomName` ("good-morning-sangha" instead of "good-morning-sangha-2026-05-25"). Nobody queries them. Harmless. A future cleanup cron could prune rows older than N days if storage ever matters.
- **Pre-existing DST drift in `scheduleUtils.shiftToDate`.** I inherited it deliberately for format alignment with existing HostAssignment rows. Effect: an 8 AM CT program could appear at 7 or 9 AM in absolute UTC for 1–2 days after a DST transition. Wall-clock CT display stays correct everywhere; only the underlying ISO timestamp drifts. A future pass on `shiftToDate` would fix this platform-wide.
- **Rate-limit on `/api/auth/callback/resend`** (`2026-05-21-002`) is still open. Discussed this session; deferred per Jesse's call — preventive, not urgent. Worth building before the platform goes public on `rootedinmindfulness.org`.
- **Audit-trail soft nudge in EndMenu** — re-confirmed parked. Step-In is the explicit audit path; ADMIN/GT bypass cases are infrequent. No real signal yet that ending-without-assignment is happening operationally.

---

### Next priority — Per-program `teacherLabel` dropdown (backlog `2026-05-25-002`)

Carried over from session 124–125, unchanged. Small, contained, lights up better behavior immediately. Add a nullable `Program.teacherLabel` field, a dropdown in the Program editor (Teacher / Guide / Facilitator / Instructor + custom), thread through to the token metadata and pill renderer. Should ship before the Silent Meditation Hub so peer-led offerings carry "Guide" pills when that hub goes live.

---

### Then — Silent Meditation Hub (backlog `2026-05-25-003`)

Unchanged. New Hub for peer-led offerings. Self-claim + standing rotations reuse host-team infrastructure.

---

### Session 125 (2026-05-26) — Session room refinements + host model audit fix shipped; verification pending on deployed site

Four code commits plus two doc commits on `main`. Two threads merged: the raised-hand / vote-signal UX refinements Jesse asked for, and the host-designation audit that surfaced when he reported seeing both Host + Teacher pills on a program he wasn't assigned to host. The fix is the cleanest version of "Session Host (singular)" the system has ever had — identity (pill) is now genuinely separate from capability (button), and the conflation that was misleading him in real-world use is closed.

**The four code commits and two doc commits, in order:**

1. `28d1298` — Raised-hand reorder + persistent vote signals + numbered speaking queue
2. `bb951e1` — Host identity/capability split + Host Volunteer rename + Share Screen widening + teacher-fallback rule
3. `984d5ed` — Docs alignment (FEATURES §38, System Architecture, Stack Reference, manual chapter v7 migration)
4. `49da69c` — Volunteer-facing changelog refresh

See `session-log.md` session 125 entry for the full chronology.

**What testing on the deployed site should confirm:**

1. **The host-designation bug Jesse reported.** Join one of the four programs you teach (Essential Dharma Study, Meditation and Dharma Talk, Private Teacher Meetings, The Art of Meditation) where no `HostAssignment` exists for the session. **Expected:** Teacher pill only (no more misleading Host pill). End button reads "End" — via the ADMIN safety override OR the teacher-fallback (both fire, either grants authority). Step-In button visible in the header. Tapping Step-In writes a real `HostAssignment` and your pill becomes Host.
2. **Joining as ADMIN on a program someone else hosts.** When Maria runs Qigong at RIM, joining as ADMIN should show: Maria with the Host pill (singular). You show **Host Volunteer** pill (since you're an active host-team HubMember). End button reads "End" because of ADMIN safety override, but the pill stops misrepresenting you. Maria sees "End" because she's the assigned host. The button label differs based on capability; both can act.
3. **Three pills render with correct priority.** Host (teal) singular on assigned host. Teacher (warm gold) on ProgramTeacher. Host Volunteer (muted slate, renamed from "Co-host") on other host-team members. Maximum two pills per tile (Host + Teacher; never three) — the `cohost` flag is suppressed when either Host or Teacher applies.
4. **Share Screen works for host-team volunteers** who aren't the assigned host. Pre-this-deploy they saw the button but the token didn't grant the source — taps silently failed. Now it should work end-to-end.
5. **Raised-hand reordering + queue.** Have someone raise their hand. Their tile should move to top-left of the grid. Have a second person raise — their tile sits next to the first, in that order. Open the Participants panel; the rows should show "1 ✋", "2 ✋". From any other participant's view, the order should match (cross-client determinism via secondary identity sort).
6. **Persistent vote signals.** Tap ✓ — badge persists on your tile, doesn't move you, doesn't auto-clear. Open Reactions popover again; the top row should read "Clear ✓" — one tap to clean up. Repeat with ✗. Confirm ❤️ and 🙏 still auto-clear after ~5 seconds (they're meant to be timed, not persistent).
7. **Manual chapter v7 self-heal.** Visit `/admin/manual/host-session-room` after the Vercel deploy completes. The chapter should reflect the new model: identity vs. capability section, three pills (Host / Teacher / Host Volunteer), Bell mode broadened visibility, ADMIN/GT in the Step-In description, new "Reactions and votes" section. The `update_manual_host_session_room_v7` migration flag fires on the next deploy.

**Known limitations / parked items:**

- **Audit-trail gap when ADMIN ends without assignment.** ADMIN/GT/teacher-fallback users can End-for-All without leaving a `HostAssignment` row. Step-In is the explicit path that creates the audit row. Watching for real signal that audit trails matter operationally before adding a soft nudge in the EndMenu.
- **Backlog `2026-05-24-001`** (stale `isSessionHost` propagation after Step-In) is *narrower* in impact now but still open. The original failure (stale End button → silent 403) is closed because the server-side re-check is authoritative. The remaining UI-staleness case is the Host pill on a previous host's tile lingering until reload — pure visual, no consequence.
- **The browser-vs-Zoom audio ceiling** carries over from session 124. Unchanged by this session.

---

### Next priority — Per-program `teacherLabel` dropdown (backlog `2026-05-25-002`)

Carried over from session 124, unchanged. Small, contained, lights up better behavior immediately. Add a nullable `Program.teacherLabel` field, a dropdown in the Program editor (Teacher / Guide / Facilitator / Instructor + custom), thread through to the token metadata and pill renderer.

The session-125 metadata pipeline makes this even cheaper to add: `ParticipantMetadata` already carries the `teacher` flag; adding `teacherLabel` is one more string. The pill renderer (`RIMParticipantTile.tsx`, `ParticipantsPanel.tsx`) already reads `meta` — would just need `meta.teacherLabel ?? "Teacher"` in the pill text. One new column in `prisma/schema.prisma`, one migration, one dropdown in `components/registrar/ProgramEditor.tsx`, one prop addition to the data path.

Should ship before the Silent Meditation Hub so peer-led offerings carry "Guide" pills when that hub goes live.

---

### Then — Silent Meditation Hub (backlog `2026-05-25-003`)

Unchanged from session 124. Larger structural piece. New Hub for peer-led offerings. Self-claim + standing rotations reuse host-team infrastructure.

**Open design question parked inside that backlog entry:** should the bell-friendly audio profile be granted to *any* Session Host (regardless of ProgramTeacher status)? Would help Nancy on Awakening The Heart and any peer-leader of a silent sit without needing per-row teacher data. Counter-argument from the role-design doc: non-teaching session hosts (logistics calls) sound better with NS on. Resolve when this hub or the teacherLabel slice is built — the teacherLabel build is probably the natural place since it touches the audio-profile derivation chain anyway.

---

### Smaller items still parked

- **`/api/livekit/token` server-side time gate** — backlog `2026-05-24-002`. Direct URL access to `/session/[slug]` is currently ungated. Not closed by today's work.
- **Rate-limit `/api/auth/callback/resend`** — backlog `2026-05-21-002`. Sign-in code brute-force defense-in-depth.
- **The PWA / native-app conversation** — `2026-05-21-001` is explicitly rejected; the architecture decision parked at session 120 stands.
- **Audit-trail soft nudge in EndMenu** — if real operational signal emerges that ending-without-assignment is happening regularly and we need the record, add a "Step in first to leave a record" hint above the "End Meeting for All" item. Speculative; don't build until the signal is real.

---

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
