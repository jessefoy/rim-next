# RIM Host Team Training Plan
**Path from coordinator onboarding to Zoom cancellation by June 17, 2026**

*This document governs the operational transition from Zoom to LiveKit. It is the coordinator's reference for sequencing and the post-training checklist. Detailed system documentation lives in the staff manual and HOSTING_HUB_READINESS.md (readiness inventory, now complete).*

---

## 1. Sequence and Key Dates

| Event | Target | Status |
|---|---|---|
| Maria's onboarding | [TBD] | Pending |
| Pre-pilot smoke test | Day before pilot | Pending |
| Pilot session (Jesse + Maria + 1 volunteer host) | [TBD] | Pending |
| Full team training (Maria leads, Jesse assists) | [TBD] | Pending |
| First solo sessions for each host | 1–2 weeks post-training | — |
| Final Zoom session | [TBD] | — |
| First LiveKit-only session | [TBD] | — |
| Zoom cancellation | By June 17, 2026 | Hard deadline |

All [TBD] dates are Jesse's to set. Sequencing is fixed; specific dates are not. The hard constraint is June 17 — Zoom auto-renews on that date.

---

## 2. Maria's Onboarding (Precursor)

**Goal:** Maria arrives at the pilot already familiar with the hub, the manual, and the coordinator-specific tools. The pilot should not be the first time she has seen anything.

**Steps in order:**

1. **Hub welcome body is live.** ✓ Done — `/account/hub/host-team` has the welcome message. No action needed.

2. **Jesse assigns `HOST` role to Maria** via `/admin/members/[id]`. `sendHostRoleAssignmentEmail` fires from the "host-role-assigned" Email Template Manager template. **Prerequisite:** verify this template has real copy (not placeholder) at `/admin/email-templates` before assigning the role.

3. **Jesse assigns `HOST_MANAGER` role to Maria** (same admin interface, same save). `sendHostManagerRoleAssignmentEmail` fires automatically — coordinator welcome email linking to the hub, schedule, and manual.

4. **Maria logs in and orients independently.** She reads the hub welcome body, walks through the manual chapters in order (`host-first-week` → `host-hub` → `host-schedule` → `host-session-room` → `host-hub-team-management`), and explores the schedule tool and Rotations tab. She also reads the "Training Session — May 2026" document in the hub's Documents section (Training category) — that document exists for exactly this moment.

5. **Brief Jesse + Maria meeting** to address her questions. This meeting should happen after she's had at least a day to explore independently — not the same day as step 4.

6. **Maria is assigned as host for the pilot session.** Jesse creates a HostAssignment via the admin interface or schedule tool for the pilot program/date. This is a one-time assignment, not a standing rotation.

---

## 3. Pre-Pilot Smoke Test

*Run by Jesse the day before the pilot. Designed to be completed in 15–20 minutes. If anything fails, fix it before the pilot. If something can't be fixed in time, note it explicitly as a known issue and adjust accordingly.*

### Phase 1 — LiveKit environment (2 min)

- [ ] Open `/admin/livekit-test`. Enter any room name (e.g. `smoke-test-1`) and click Join. Your camera and microphone should work and a video room should open.
  - **If the room fails to open:** check that `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `NEXT_PUBLIC_LIVEKIT_URL` are all set in Vercel Settings → Environment Variables. If any are missing, the session room is non-functional. Fix this before anything else.
  - **If the room opens but audio/camera fail:** browser permissions. Click the lock icon in the address bar → allow microphone and camera → reload.

### Phase 2 — Hub and manual chapters (3 min)

- [ ] `/account/hub/host-team` loads. Welcome body shows "Welcome to the Host Hub." followed by the four paragraphs with working links (Host Schedule → `/tools/schedule`, Staff Manual → `/admin/manual`, Conversations → hub conversations).
- [ ] `/admin/manual/host-first-week` loads and shows five sections ("Right after you join" through "When questions come up").
- [ ] `/admin/manual/host-schedule` loads and ends with the "For coordinators" section (member picker, Rotations tab, Reassign-to-me).
- [ ] `/admin/manual/host-session-room` loads. Contains "The twelve minutes before" (second section from top) and "Step in as Host" as its own section.

### Phase 3 — Schedule tool (3 min)

- [ ] `/tools/schedule` loads and shows upcoming sessions for virtual or hybrid programs. If no sessions appear: verify programs have `programFormat: "virtual"` or `"hybrid"` via `/tools/programs` → any program → Schedule tab. In-person programs do not appear in the host schedule.
- [ ] Member picker works: click the ▾ arrow beside the "Mine" pill. A dropdown of host-team members should appear. Select one and verify the schedule switches to their view.
- [ ] Rotations tab is visible (requires HOST_MANAGER or ADMIN role on the logged-in account).

### Phase 4 — Active host records (2 min)

- [ ] Load `/account/hub/host-team` → Members tab. Every host who will be in the pilot should appear with status ACTIVE. Verify `communicationsEnabled` is true for all pilot participants — any host where this is false will not receive sub-request emails. Toggle it from the Members tab if needed.

### Phase 5 — Email functions (5 min)

- [ ] **`host-role-assigned` template:** Load `/admin/email-templates`. Find "host-role-assigned". Verify it has real copy — not a placeholder. This is the only host email routed through the template manager; all others are built in code. A blank template means new hosts get a garbled email on assignment day.
- [ ] **Sub-request + claim flow:** From the schedule tool, open a session you're assigned to and click "Ask the team to cover." Check your inbox. The email should arrive with a "Cover this session →" deep-link button. Verify the URL is `https://rim-next.vercel.app/tools/schedule?...` — no trailing space after the domain (this was a bug fixed in session 96).
- [ ] **Sub claimed email:** From a second account (incognito), claim the sub request. Verify the original requester receives a "someone stepped in" notification.
- [ ] Cancel the test sub request and undo the test claim to restore the session to its pre-test state.

### Phase 6 — Session room host controls (5 min)

*Use two browser windows or two accounts. Use a real virtual program slug.*

- [ ] **Window A (assigned host or ADMIN):** Join `/session/[slug]`. Header should show: program name, "Mute All", "End for All" (red), "Fullscreen", "?" help icon. No "Step in as Host" button.
- [ ] **Window B (HOST role, not the assigned host):** Join the same session. Should show "Step in as Host" button only — not "Mute All" or "End for All".
- [ ] **Step in:** In window B, click "Step in as Host." Verify ~2-second reconnect pause, then full host controls appear. Both windows now have host controls — this is expected behavior.
- [ ] **Mute All:** In window A, click "Mute All." Button shows "Muting…" briefly, then "Muted N." Participants in window B can still unmute themselves (host-side mute is not a lock).
- [ ] **End for All drill:** Click "End for All." Verify the confirmation modal appears with a clear description of what will happen. Click "Cancel." Room stays live.
- [ ] Close both windows. LiveKit rooms expire when empty — no action needed.

### Phase 7 — Standing assignments cron (if applicable, 1 min)

If Maria has set up rotations in the Rotations tab and you want to verify assignments will appear without waiting for the 8am UTC cron, hit the cron route directly as ADMIN by visiting `/api/cron/apply-standing-assignments` in your browser. It will run immediately and return a JSON summary of what was applied.

### Quick reference: what breaks what

| Item | Impact if broken |
|---|---|
| Missing LiveKit env vars | Session room doesn't open at all |
| Program `programFormat` not set to virtual/hybrid | Program invisible in host schedule |
| HubMember `communicationsEnabled: false` | Host invisible to sub-request emails |
| `host-role-assigned` template empty | New host welcome email garbled |
| HubMember `status` ≠ ACTIVE | Token route denies host controls even if assigned |
| `hostingCapability: false` on HubMember | Same as above |

---

## 4. Pilot Session

**Participants:** Jesse, Maria, one volunteer host.

**Length:** 75–90 minutes.

**Goals:**
- Test the full-team training agenda end-to-end before the real session
- Give Maria practice running the agenda in the facilitator role
- Surface system issues, content gaps, or confusing moments before the full session
- Give the volunteer host a genuine first training experience

**Structure:**

Run the full-team agenda (§5) with two modifications:
1. After each major section, pause 2–3 minutes for Maria and Jesse to debrief — "what worked, what to adjust"
2. The live exercise runs for real with all three participants in the session room

Close with a 15–20 minute Maria + Jesse debrief:
- What was unclear in the agenda?
- What did the volunteer host find confusing?
- Any system behavior that surprised anyone?
- What changes before the full session?

**Output:**
- Refined agenda for the full team training
- Prioritized fix list (owner, deadline, severity) for anything that broke or confused

**Scheduling note:** Don't schedule the full team session less than 3–4 days after the pilot. If the pilot surfaces a system issue that needs a build, Jesse needs time to address it.

---

## 5. Full Team Training

**Length:** ≤60 minutes. Hard cap — volunteer time is scarce.

**Facilitator:** Maria. Jesse opens and closes.

**Pre-meeting ask for hosts (Conversations post or direct message the day before):**
- Read the "Training Session — May 2026" document in the hub's Documents section
- Have your camera and microphone ready
- Use Chrome or Firefox if possible (Safari has stricter audio permissions)

---

### Agenda

**Opening — Jesse (~5 min)**

What we're doing and why: replacing Zoom with a system that lives inside the tools the team already uses. What this isn't: a technical deep-dive. A hands-on orientation.

Cover: the Zoom cutover timeline and the June 17 hard deadline.

Pass to Maria.

---

**Host Hub orientation — Maria (~10 min)**

Walk through live while everyone is logged in:
- Hub home: welcome body, "Our offerings this month" panel
- The "?" help icon — where it links
- Conversations tab — the team's communication channel; where to post questions
- Documents section — where the training document they read lives; where session resources will live
- Members tab — who's on the team, what status means

*Manual reference: `/admin/manual/host-hub`*

---

**Schedule Tool — Maria (~10 min)**

Walk through `/tools/schedule` live:
- What the four session card states mean: Needs a host / Mine / Needs cover / Covered
- Claiming a session ("Yes, I can host this")
- Asking for cover ("Ask the team to cover") and the email it sends
- Cancelling a cover request
- Filter pills — All, Needs help, Mine, My requests
- Member picker (▾ on Mine pill) — all hosts can use it for awareness; coordinators use it to check coverage
- Deep-link emails: the "Cover this session →" button opens the schedule with the modal pre-opened — one tap from email to confirmed

Coordinator-only (Maria covers briefly, addresses the full team):
- Rotations tab — sets the standing pattern; schedule fills in automatically
- Reassign to me — on covered sessions; describe the side effects (previous host notified, sub-request closed)

*Manual reference: `/admin/manual/host-schedule`*

---

**Session Room — Maria (~10 min)**

Navigate from the schedule: session card → "Join session" button.

Walk through the join sequence:
- Audio prompt: click "Allow" when the browser asks. If dismissed by accident, reload the page.
- What the header shows: program name, Mute All, End for All, Fullscreen, "?" help link
- The "?" links to the session room chapter — tell hosts about it now

The twelve-minute-before window:
- Plan to join 12 minutes early
- Not setup time — the room is already open
- Greet people as they arrive; welcome anyone new
- This is the relational work, equally important as the technical work

During the session:
- The teacher leads content; the host holds the room
- Watch chat, mute background noise as needed, stay attentive and unobtrusive
- Default is presence, not activity

Step in as Host:
- Visible to host-team members who aren't the assigned host
- Grants full host controls — use when the assigned host can't make it, or when a coordinator is co-facilitating

Closing the room: click "End for All," confirm in the modal.

*Manual reference: `/admin/manual/host-session-room`*

---

**Live exercise — Maria facilitates, Jesse supports (~15 min)**

Everyone is in the session room together. Work through this sequence:

**1. Join with audio (3 min)**

Everyone joins `/session/[real virtual program slug]`.

- Safari/Firefox users: handle the audio prompt — click "Allow." If audio fails after joining, go to the address bar lock icon → Permissions → Microphone → Allow, then reload.
- Wait until everyone's camera and audio confirm before moving on.

**2. Mute All (2 min)**

The designated pilot host clicks "Mute All."

- Note the button feedback: "Muting…" → "Muted N" (where N is the participant count). That's the confirmation it worked.
- Everyone unmutes themselves — participants can always self-unmute. Host-side mute is not a lock.

**3. Step in as Host (4 min)**

A second HOST or HOST_MANAGER participant clicks "Step in as Host."

- Watch for the ~2-second reconnect pause. This is expected, not a failure. The client is fetching a new token with host grants and reconnecting.
- After reconnect: that person sees full host controls. The original host also still has controls — both are now co-hosts.
- Maria names the use case: "This is how a coordinator joins mid-session when the assigned host can't connect. You don't need to be pre-assigned. Any host-team member can step in."

**4. Per-participant mute (2 min)**

Inside the video tile panel (hover over a participant tile):
- Find the individual mute control
- Mute one participant; the muted indicator on their tile changes
- The participant can still self-unmute

This is for targeted situations — someone's dog is barking during a sit, or a connection issue is creating noise — not for general audience management (use Mute All for that).

**5. End for All — drill without executing (2 min)**

The host clicks "End for All."

- Everyone reads the confirmation modal together.
- The host clicks "Cancel." Room stays live.
- Maria: "This is what stands between you and accidentally ending a 40-person meditation mid-session. The extra step is intentional."

If Jesse wants to close the training room at the end of the session, he clicks End for All and confirms. Otherwise the room auto-expires when everyone leaves.

**6. Sub-request flow (2 min, time allowing)**

One host opens a real future session they're assigned to and clicks "Ask the team to cover."

- Watch for the sub-request email (describe it if it's slow)
- That host clicks "Cancel my request" immediately to restore the session

---

**Q&A — (~5–10 min)**

Maria fields first. Jesse catches what she doesn't.

**Questions to anticipate:**

- *"What if my internet drops mid-session?"* If you reconnect quickly, the room is still there — rejoin and your host controls return. If you can't reconnect, message Maria immediately so she can Step in from her computer.
- *"Can participants see each other before I officially start?"* Yes. The room is open once anyone joins. The host joining 12 minutes early is visible to early participants — that's the point.
- *"What if a participant can't get their audio working?"* Direct them to check browser permissions (lock icon in address bar), then try reloading. If still broken, they can try a different browser. You can't fix it from your side — just let them know you see them trying and keep the session moving.
- *"What if something really goes wrong during a live session?"* Stay calm. Do what's available. If it's a system failure, message Maria; she'll loop in Jesse if needed. Debrief afterward — don't try to diagnose during a session.

---

**Close — Jesse (~2–3 min)**

Name what was just accomplished. The sangha framing: this isn't just tools — it's how we hold space for an online community. The care that goes into clicking a button correctly and the care that goes into welcoming a newcomer are expressions of the same thing.

First solo sessions: within 1–2 weeks. Maria will follow up individually.

Where to go with questions: Conversations tab first, then Maria directly, then Jesse for pastoral matters.

---

## 6. Hub Document

**Document:** "Training Session — May 2026" in the host-team hub → Documents → Training category.

**Seeded via:** `prisma/seed-host-hub-training-doc.mjs` — same upsert pattern as the other team documents. Contains: warm welcome, pre-reading links to three manual chapters, agenda preview, post-training next steps, cutover timeline with placeholder dates.

**Before training day:** Update the [TBD] date and time placeholders in the document once they're confirmed. Maria can do this via the hub's document editor after the dates are set.

**After training:** Maria may update the document with actual dates and any post-training notes (first solo session scheduling, coordinator check-in process, etc.).

---

## 7. Post-Training Period

**First solo sessions:** Each host should host a real session within 1–2 weeks of training. Maria coordinates this — either via standing rotations or by asking hosts to claim specific sessions. The goal is a real solo session while the training is fresh.

**Maria's check-ins:** After each host's first solo session, Maria has a brief conversation: "How did it go, anything you noticed, anything you want to walk through?" Not a formal review — a debrief. This surfaces issues early and builds team cohesion.

**Issues tracking:** All issues go to the host-team Conversations tab first. Maria triages:
- Technical issue → she investigates; pings Jesse if it's a system problem
- Role or coverage question → she handles
- Something pastoral (a participant situation, something that affected the host) → she handles or escalates to Jesse

**Standing rotations:** Maria establishes the team's standing rotation pattern within the first week after training.

Process:
1. Informal conversation with hosts about schedules and preferences
2. Set up rotations in the Rotations tab for each recurring virtual/hybrid session
3. Trigger the cron manually to generate the first batch of HostAssignment records: visit `/api/cron/apply-standing-assignments` as ADMIN in your browser. It runs immediately and returns a JSON summary.
4. The daily cron (8am UTC / 2am CT) maintains assignments going forward. If Maria sets up a new rotation during the day and wants assignments visible before the next morning, use the manual trigger above.

---

## 8. Cutover Protocol

### Member communications

- **When:** Before the first LiveKit-only session — with enough lead time for members to prepare. At least one week in advance of the last Zoom session.
- **What to say:** Members don't need to create an account, download software, or do anything differently. They click "Join" from their dashboard (or the guest link if they have one) and a session room opens in their browser. The experience will look different from Zoom but the mechanics are the same.
- **Channel:** [TBD — Jesse to decide. Email to registered members? Newsletter? Both?]
- **Who writes it:** Jesse. Share a draft with Maria before sending — she may have suggestions.

### Last Zoom session

- Identify the last Zoom session in advance and announce it to attendees during that session: "This is our last session via the current platform. Next time, join the same way — from your dashboard — and it will look a little different."
- No separate email required unless Jesse wants one.

### First LiveKit-only session

- Jesse assigns the host well in advance (not last-minute)
- Maria is available (on call, not necessarily in the room) for the first session of each recurring program switching over
- Jesse joins as ADMIN for at least the first two or three sessions post-cutover — he can Step in from anywhere if something goes wrong
- Hosts know: if something breaks during a live session, post in Conversations immediately and keep the room calm. Don't try to diagnose mid-session.

### Fallback plan

If LiveKit has serious issues in the first week:
- Jesse is notified immediately via direct message (not just Conversations)
- Decision point: is this a transient issue (retry on next session) or systemic (temporarily reactivate Zoom)?
- Threshold for fallback: two consecutive sessions with technical failures affecting more than one-third of participants, OR a single session where no host can connect at all
- If reactivating Zoom: Jesse reactivates the subscription and sends a short member notice within 24 hours

### Zoom cancellation

- **Who executes:** Jesse (account owner)
- **What triggers it:** 1–2 weeks of stable LiveKit-only sessions with no fallback needed
- **Hard deadline:** Cancel before June 17, 2026 — Zoom auto-renews on that date
- **Buffer:** Cancel at least 5 days before June 17 to avoid an automatic renewal charge

---

## 9. Open Questions / Decisions Still Pending

| Item | Owner | Notes |
|---|---|---|
| All specific dates (onboarding, pilot, full team, first LiveKit-only, final Zoom, Zoom cancellation) | Jesse | Sequencing above is fixed; the dates are Jesse's to set |
| Which volunteer host joins the pilot | Jesse + Maria | Ideally someone available and technically comfortable; they get a genuine first training experience |
| Member communication content and channel | Jesse | Draft and share with Maria before sending |
| "host-role-assigned" template copy | Jesse | Verify at `/admin/email-templates` before assigning HOST role to anyone |
| First LiveKit-only session — which program and date | Jesse + Maria | The specific session that marks the transition |
| Whether to send a pre-training reminder to hosts | Maria | Simple Conversations post the day before: "reminder to read the Training document before we meet" |

---

*Created: 2026-05-07, session 107.*
*Companion files: `HOSTING_HUB_READINESS.md` (readiness inventory — complete), `UP_NEXT.md`, `session-log.md`.*
*Deadline: Zoom renews 2026-06-17. Cancel before this date.*
