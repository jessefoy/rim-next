# RIM Tutorials — the per-tool reference

Picture-led how-tos for members and volunteers, built 2026-10-21 and 2026-10-22 (Jesse: *"think about it holistically… remembering that these people are not very tech-savvy"*). Wording on every tutorial is provisional until Jesse's read-aloud.

## Routes

| Route | What it is |
|---|---|
| `/tutorials` | The index, as one path: **Start here** (numbered, for everyone, read in order), then **Find your team** (each team's tutorials in order, the leads' under "If you lead this team"). |
| `/tutorials/[slug]` | One tutorial, a step at a time (`components/TutorialSteps.tsx`). "On a phone" / "On a computer" swaps the drawings and the words that differ. `#step-N` opens a step. The last step leads to the next tutorial ("Start here · 2 of 4"; Start here ends at Find your team). |
| `/tutorials/[slug]/watch` | The same tutorial played like a video (`components/TutorialPlayer.tsx`): one Play button, each step's screen with its words as a large caption, a finger that travels to the marked place and taps. Pause, Back, Next, Watch again, a progress bar, the phone/computer switch. Only tutorials in `WATCH_READY` (`components/tutorials/pageData.ts`) offer it; today that is Signing in. |

Open to everyone, `noindex`, in no menu, footer or sitemap: Jesse shares them by link. Whether some move behind sign-in is backlog `2026-10-21-001` (keep Signing in readable signed out: a person who can't sign in yet needs it). Retired addresses forward in `vercel.json` (`getting-started-for-guides` → the Peer-Led team on the index, `hosting-on-zoom` → `zoom-for-hosts`).

## The tutorials

- **Start here** (`startHere.tsx`): Signing in (the code, the first visit's Welcome page, trouble); Finding your way (My Home, Menu, My Teams, a team's own ☰ on a phone); Your team's space (Updates and Needs you, Conversations, Files, Members); Emails and notifications (Notifications, the email choice, every email a team member may get).
- **Each team** (Hosting Team, Peer-Led Silent Meditation, Greeter, Audio/Visual, Jesse's choice of four): the Scheduler in the team's own words (`schedulerTutorials.tsx`: single-slot teams take a session, ask for cover, step in; greeters sign up and cancel their own sign-up) and, for the two teams that hold Zoom rooms, leading a session on Zoom (`zoomTutorials.tsx`: My Home, the host code, your name in Zoom, Participants, Claim host; no one signs in to Zoom).
- **For leads** (`leadTutorials.tsx`): Leading your team (the team's line, Members, who hasn't signed in, Paused and Inactive, Leads only, removals, the brief) and The Scheduler for leads.

## How it is built

- **One file per group of tutorials** in `components/tutorials/`, typed by `types.ts` (`Tutorial`, `TutorialStep` with an optional `computer` override, an optional `reference` block such as the list of emails), listed in `index.ts` (`TUTORIALS`, `START_HERE`, `TEAM_PATHS`). Adding a tutorial is one entry there and a place in a team's path; it is not a new route.
- **Drawings, not screenshots** (`drawing.tsx`, `screens.tsx`, `memberScreens.tsx`): RIM's own screens redrawn at the app's sizes on its tokens and scaled to their frame, with sample names and no member's data, so they stay true as the app changes only if updated with it. Each step carries `alt` for screen readers.
- **One source for both pages:** `pageData.ts` gives the step-by-step page and the player the same steps and end link, so they can't drift.
- **The player's pacing:** a step lasts long enough to read its caption at about two and a half words a second (never under seven seconds), and the finger moves within its first seconds. Plain timers, not animation frames (a tab out of view holds frames back, which left the finger short of its mark). Reduced motion: the finger appears in place. On phones and short computer windows the drawing sizes to leave its caption on the same screen.
- **Links in from where people get stuck:** `lib/tutorialLinks.ts` (kept apart so a page that links a step doesn't load the drawings). The Zoom door's host page links "How to claim host in Zoom" to the hosting team's Zoom tutorial at the Participants step (`claimHostHelpHref`, by `Program.hostingHubSlug`), in a new tab so the host code stays in view.
- **CSS:** the `tut-` block, before the authenticated readability contract.

## Pitfalls and open items

- **Zoom's phone app doesn't document claiming host with the host key**; the phone steps are unconfirmed until Jesse or Maria checks one in a test meeting (backlog `2026-10-21-001` notes).
- **Every word was checked against the app** (two surveys and a reviewer). When the Scheduler, My Home, Members or Notifications change, the tutorials that draw them change in the same commit.
- A team added later gets tutorials only when it is added to `TEAM_PATHS`; its Scheduler words come from its own coverage copy.
- The 11px "If you lead this team" label was left out of the 2026-10-22 eyebrow pass (13px everywhere else on public pages).
