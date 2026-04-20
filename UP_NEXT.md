# Up Next — In-Progress Work

**Read this at the start of every new session.** Updated at closing. Shows what's half-built, what's being tested, and what's the next concrete step — so the next session resumes from where the last one ended instead of starting cold.

---

## Active: Mobile rollout + Host Schedule verification (session 88, 2026-04-19)

Session 88 was a big one — it started with the whole site offline and ended with a fully redesigned Host Schedule, a permanent fix for mobile rendering across the entire platform, and the Neon database moved to a paid plan. All commits are pushed. Open items are verification + downstream cleanup.

### What was built and is now live

- **Neon upgrade + cron removal.** Site went offline at session open (Free-tier compute cap blown by a 5-min Gmail sync cron). Upgraded to Neon Launch via Vercel Marketplace (metered, no flat fee). Removed the 5-min cron from `vercel.json` — the manual `↻` sync button in `/tools/inbox` is the sole sync path until the feature launches. See backlog `2026-04-19-002` for when to restore.
- **Host Schedule redesign.** `/tools/schedule` rebuilt end-to-end: interactive status sentence (clickable counts that filter), event-pill calendar with color semantics (orange = no host, red = sub needed, green = covered, blue = yours), today-circle marker, day-click filters the list below, five-swatch legend, card titles conform to Messages Hub spec (`var(--text-h4)` 20px serif), distinct mine-sub state (amber "Sub requested" chip), card borders tinted in state color, plain-language copy throughout ("I'll host this session", "Ask someone to cover for me").
- **Sub-request submit bug fixed.** `submitSubRequest` was calling `.trim()` on BlockNote JSON → button stuck on "Sending…" forever and POST never reached server. Now handles rich content properly, returns `Promise<boolean>`, captures the returned `subRequestId`, keeps `selected` in sync.
- **Sitewide viewport meta fix.** `app/layout.tsx` was missing `export const viewport: Viewport = { width: "device-width", initialScale: 1 }`. Mobile browsers had been rendering every route at ~980px desktop width and silently ignoring every mobile media query *since the app was built*. The fix affects every page on the site.
- **Host Schedule mobile pass.** 44px touch targets on every button, iOS 16px anti-zoom on `.fi`/`.ft`/`.fs` at `<768px`, chrome compression, thicker calendar bars, full-width card buttons on mobile stack, `.hub-ws-layout` switched to block at `<=900px` (defensive against position-fixed sidebar quirks).
- **Two-tap confirmation pattern.** Primary action buttons (card-level and detail-level) now require arm-then-commit. First tap darkens the button, shows "Tap to confirm" + 4s countdown bar at the top + 1.2s brightness pulse + Cancel link. Second tap commits; inactivity or Cancel reverts. Only one primary button on screen at a time (card-level hides when detail expands).
- **Horizontal overflow lockdown.** `html { overflow-x: hidden }` + `body { overflow-x: clip; max-width: 100% }`. Card titles get `overflow-wrap: anywhere`.

### Open at session close

1. **Verify Host Schedule on Jesse's phone.** After the latest deploy, the calendar should render at phone width, the 2-tap confirm should work, the "Ask someone to cover for me" flow should succeed (no stuck "Sending…"), the sub-request should visually change the card to mine-sub state. Jesse was testing these throughout the session; confirmation after the final commit (`446f8b2`) is the last piece.
2. **Mobile audit for the rest of the platform.** Viewport meta now fires mobile styles sitewide for the first time. Some pages may suddenly look broken because they've always rendered as desktop-scaled on phones. Candidates: `/tools/inbox`, `/tools/programs`, `/tools/learning`, `/account/hub/[slug]/conversations` / `/tasks` / `/documents` / `/members`, public pages (homepage, `/community-programs`, `/this-week`, `/teachers`, `/courses`, `/programs/[slug]`, `/lessons/[slug]`). See backlog `2026-04-19-003`.
3. **Off-center / horizontal shift.** Jesse mentioned content felt slightly off-center on the phone screenshot even after the overflow lockdown. Defensive rules are in place but may need further chasing if he still sees it. Specific culprit likely a long program name or grid rounding; `overflow-wrap: anywhere` + `min-width: 0` on titles should already cover the most common case.

### Queued follow-ons (from backlog)

- `2026-04-19-001` — Add `shortName` to `Program` so calendar pills can show readable abbreviations without truncation.
- `2026-04-19-002` — Restore `support-sync` cron when the Support Inbox launches to volunteers (at 15 or 30 min cadence, not 5 min).
- `2026-04-19-003` — Mobile audit for remaining tool and hub pages now that viewport meta is live.
- `2026-04-17-003` — Migrate Program `specialNotes` into an inline Note block (carried from session 87).

### Key files to reference

- `components/HubScheduleClient.tsx` — the redesigned tool. Status sentence, calendar, list, SessionDetail all in one file. Two-tap confirm state at both the outer component (`cardConfirm`) and the SessionDetail (`confirming`).
- `public/css/custom.css` — lines ~11915 onward for hub-schedule, hub-cal2, hub-sched-status/legend/dayfilter; line ~14125 for hub-lv cards; line ~14260 for hub-detail.
- `app/layout.tsx` — now exports `viewport: Viewport`. Do not remove.
- `vercel.json` — `/api/cron/support-sync` entry deliberately absent; restore when volunteers staff the inbox.
- `prisma/schema.prisma` — untouched this session. `HostAssignment`, `Program`, `SubRequest`, `HubMember` all unchanged; the redesign is cosmetic over existing data.
- `RIM_Web_Design_Philosophy.md` — "Designing for real users under pressure" is the principle driving the two-tap confirm and the larger touch targets. Keep this as the reference for future tool redesigns.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
