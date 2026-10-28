# Up Next — In-Progress Work

Read first when opening RIM. Updated 2026-10-27 (closing ritual). Full history belongs in `session-log.md`.

## Active — 2026-10-28: Content editors change the site through the RIM Guide

Built and pushed. **Phases 1 to 3 of the guide acting for each person are in:** programs (start, change, archive), Registration (every action on a person's card, messages, the reminder, settings), and teams (the Scheduler's everyday actions and Conversations; rotations, resets and membership stay on the site), with the ask-first rule for anything that emails others. Phase 4 (creating courses and lessons) is next, from a Connections Map. Reference: `volunteer-guide/README.md`; role: `RIM_Role_Design.md`, "Content Editor". A **Content editor** (role in Roles & access) can, through the guide, change anything the Programs, Course Manager, email and teacher-page editors save (through those editors' own saves, now in `lib/programSave.ts` and `lib/contentSaves.ts`) and the words on the pages (a words-only commit to `main`). No approval; every change is listed at `/admin/content-changes` and emailed to Jesse. A program's rename now reaches registrations, donations and Zoom (editor too).

**Waiting on Jesse:**
- Create the GitHub key and add it to Vercel as `GITHUB_CONTENT_TOKEN` (until then page words can't change; the guide says so).
- Give the Content editor role (himself included) in Roles & access.
- Paste the new `volunteer-guide/INSTRUCTIONS.md` into the project's instructions; send the updated PDF if wanted.
- Try one change of each kind; check the email and the History page. **Content editors commit to `main`: pull before pushing.**
- Read-aloud: the Allow page's new sentence, the Roles & access line, the email `content-changed`, the History pages, the editor's Zoom-name note.

## Earlier — 2026-10-27 closed: the RIM Guide for volunteers; settled dana confirms

Everything is on `main` (`4768649` … `b5e97f2`, and this closing). Narrative: `session-log.md`, 2026-10-27. Reference: `volunteer-guide/README.md` (and the new `CLAUDE.md` row).

**Live and verified:** the **RIM Guide**, a shared view-only Claude project in RIM's Claude for Nonprofits workspace, answering from the **RIM Guide connector** (`/api/guide-mcp/<key>`, read-only: the `volunteer-guide/` topics and public pages read live). Verified from this session and by Jesse inside the shared project. LoriLee has a User / Standard seat. **Keep the topics current:** any change to a feature the guide describes updates its topic in the same commit (it is served live; a stale topic tells volunteers the old way). **Settling dana in Registration** ("Given another way", "No dana for them") now sends the held confirmation once; reviewed, not tested live.

**Waiting on Jesse:**
- Send LoriLee `volunteer-guide/Getting started with the RIM Guide.pdf` and the short text; share is done. Check the model in a new project chat (Sonnet 5.5 at Default expected; if not, one step goes into the PDF).
- Optional: set the RIM Guide connector's tools to Always allow in Organization settings, so she isn't asked.
- **Mindful Photography is public with placeholder "Xxxx" text** (its quote, description, facilitator); fix or hide it.
- Offered, not taken: a read-only production check for anyone the old dana buttons left unconfirmed (registered, dana marked by the team before today, no confirmation).
- Why members can't cancel their own registration: the reason was never written down; the guide says "ask Jesse" until it is.
- Read-aloud: the card's new lines ("Their confirmation goes to [email].", "Their confirmation went out.", "Their dana was already settled. Reload the page to see where it stands.") and the PDF.
- Carried from Oct 26: share the private Programs and Registration guide with LoriLee; the tutorial lines changed after approval; confirm the Scheduler's and Updates' filled row actions; the Trial Workshop's note after (due Oct 27 ~10 AM CT, preview-checked only); the "give online" email's wording (`2026-10-24-002`).

**On launch day (add to the list below):** the connector's address moves with `NEXTAUTH_URL`; re-add it in Claude (Organization settings > Connectors) at the new domain and have volunteers press Connect again.

**Next concrete step:** none owed. **Coming up:** the November 1 sweep (see the 2026-10-22 section). **Queued:** `2026-10-27-002` a Send feedback page (once notes start arriving), `2026-10-27-001` the webhook guard, `2026-10-27-003` suggest an edit; and from Oct 26: `2026-10-26-001` to `-004`, `2026-10-24-001`.

**Method, for measuring signed-in pages:** the built-in browser pane holds Jesse's session on rim-next.vercel.app; same-origin iframes measure several pages at once. The pane draws streamed pages twice (React 19 waits for an animation frame the pane never runs), so measure only the visible copy.

## Earlier — 2026-10-26 (later) closed: Registration Team tutorials, the Programs list, one button language

Narrative: `session-log.md`, 2026-10-26 (later). Its open items are carried in Active above.

## Earlier — 2026-10-26 closed: Programs and Registration, built and checked

Narrative: `session-log.md`, 2026-10-24 to 10-26 (and 10-23 to 10-24 for Phase 1). Plan, rulings, trials: `mockups/registration-2026-10-23/BUILD_PLAN.md`. References: `RIM_Registration_App.md`, `RIM_ProgramEditor.md`, `RIM_Registration.md`, `RIM_Member_Area.md`, `RIM_Hub_Engineering.md`. Its open items are carried in Active above.

## Earlier — 2026-10-22 closed: shorter pages, the three circles, an integrity pass; every public page measured and recomposed

Everything is on `main` (`57628ff` … `901d362`, and this closing). Narrative, word counts and measurements: `session-log.md`, 2026-10-22 (and its "Later" sections). Design record, vocabulary and rules: `RIM_Public_Pages.md`, "Shorter pages and the three circles". The Oct 21 to 22 Tutorials work is now documented (`RIM_Tutorials.md`; `session-log.md`, 2026-10-21 to 10-22).

**Live:**
- **The condensation brief** (vault `CARE/4 Promotion/08-promotion-site-brief-condensation-2026-10-22.md`, whose Part B now matches the site) on ten pages, with his rulings: "It is freely offered"; New to RIM's cost note, Open My Home and Zoom-link line gone; Home's Dana keeps where gifts go and the retreat minimum; Calm and ease names the everyday pressures; the Handful keeps the shape of a practice; "and we reduce harm" stays cut.
- **Every public page measured and recomposed** (1280, 900, 390): text columns on the grid's col-7 line (Home, New to RIM, Diverse Together); Practice for real life's circles as panels named inside; one 13px eyebrow spec; program pages, the registration card and Donate bordered, not lifted; card titles and fact names stepped under their headings; reading measures on long notes; Donate's give cards side by side on tablets, its zig-zag reflections kept (a one-column version was undone by his choice); Diverse Together's motto beside the reading.

**Waiting on Jesse:**
- **Read-aloud** of the ten pages and today's new words: "Read more" / "Show less", the screen-reader heading "About this program", eyebrows that repeat their heading ("Welcome" / "New to RIM", "A first gathering" / "A drop-in gathering", "A fuller introduction" / "Foundations"), Diverse Together's "What we share" under "What we share is the direction."; and every tutorial (`RIM_Tutorials.md`).
- **Ways to Give's two facts** (backlog `2026-10-22-001`); the members' Handful introduction follows the vault (`2026-10-22-002`).
- **Tutorials:** which move behind sign-in (`2026-10-21-001`); Zoom's phone claim-host steps confirmed in a test meeting.

**Coming up:** the **November 1 sweep** ("begins in November" / "First offered in November", including New to RIM's "Our first offering begins in November"); **Sacred Clarity** (March 16, 2026) still the only Immersion listing. **Queued, small:** Home's program-card titles 32 under 38 (`2026-10-22-003`), the last two 11px labels (`2026-10-22-004`), Courses onto the public system (`2026-10-22-005`), This Week's boxes in boxes (mock first). The design skill has an update (`npx impeccable update`).

**Next concrete step:** the November 1 sweep, then Jesse's read-aloud; the items still open from Oct 20 below.

## Earlier — 2026-10-20 (later) closed: My Home without Coming up; Notifications categorized

Everything is on `main` (`5c09dc8` … `183fa34`, and the closing docs; the earlier Oct 20 work `20da9b6` … `af3f4fc`). Narrative: `session-log.md`, 2026-10-20 (later) and 2026-10-19 (later) to 10-20.

**Live:**
- **My Home is Today, then This week's schedule.** Coming up, "All upcoming programs" and the `?view=upcoming` page are removed to be rethought (backlog `2026-10-20-004` records what existed and the questions). Registered in-person sessions still appear in Today. The welcome and `/join` lines no longer promise "what's coming up".
- **Notifications, categorized like team Updates:** All · Unread, **From** a team (every team the person is on, before any notice), **View** by kind (Schedule, Conversations, Files, Programs, Your account), counts within each other; rows read "Hosting Team · Schedule". A new notice kind must go in `NOTICE_TYPES` (the harness enforces it).
- From the morning: team Updates as an inbox, one filter grammar, the lead's brief, Notifications with the email choice.

**Watch:**
- **The `bd09b27` deploy log:** "Session reminder link: …" says whether `session-reminder`'s button became "View the program →" or was left alone as edited (then paste `{{programUrl}}` in `/admin/emails`).
- **The first lead briefs** from Oct 21 (the full brief Monday Oct 26), and **the first notices**: open a row signed in, use both pickers, check the counts.
- **The Oct 20 08:00 UTC rotation run** (seat lock, `ruleFillsDate`) was never checked: its cron log and the Scheduler integrity count (was 180 sessions, 30 rotations, 0 problems).

**Waiting on Jesse:**
- **Read-aloud:** the Updates and Notifications pages (titles, intros, empty states, "Needs you", buttons; the pickers' "From", "Everywhere", "View" and the five kinds), notice titles, My Profile's email choice, `notifications-daily-summary`, My Home's welcome line, `/join`'s signed-in line, "View the program →".
- **Still owed from Oct 19:** the signed-in walk of that pass's interactions; the email template drafts (Read-Aloud v3).

**Next concrete step:** read the `bd09b27` deploy log line and the Oct 21 brief; look at Notifications signed in; then the read-aloud. **Queued:** `2026-10-20-004` (upcoming programs, rethought), `2026-10-20-005` (messages from the center in Notifications, some priority), `2026-10-20-006` (file notify picker), `2026-10-20-001` (a Practice program setting), `2026-10-20-002` (retire `coverage-still-needed`), `2026-10-20-003`; CLEANUP #72–77; `2026-10-18-001`; `2026-10-16-001`.

## Earlier — 2026-10-19 closed: the integrity pass

Narrative: `session-log.md`, 2026-10-19. Program Manager is Registrar, Admin and Guiding Teacher only; inactive means off the team's schedule; guests finish waitlist/dana from a signed link; in-page confirmations replace pop-ups; `custom.css` pruned with no visual change. The October 19 read-aloud is ratified. **Still owed:** the signed-in walk (the inactive dialog, a file removal request, a reply delete, the Program Manager save note and slug lock, a Course/Lesson leave guard, the Rotations Apply failure line); the email template drafts (Read-Aloud v3: Scheduling manager welcome, registrar Staff Manual line and subject, rotation subjects naming the role, "with the {team}" in file-shared, colons for em-dashes), each needing his read-aloud, consent and an explicit `update` in `migrate.mjs`.

## Earlier — 2026-10-18 closed: every role accounted for; Peer-Led staffed; every other week

Narrative: `session-log.md`, 2026-10-16 (later) to 10-18. Coverage notices live; Peer-Led staffed; every other week (**don't roll back past `9534dab`**). **Still owed** (not part of the Oct 19 read): the read-aloud of the four coverage emails and the Scheduler lines from that session; the `/admin/emails` check that `host-assignment-confirmation`, `host-assignment-removed`, `sub-request-claimed` carry the role words; ask Maria what "the website isn't set up to see a listed host yet" meant; how the first Monday look-ahead (Oct 19) read to the teams. The Dummy Test Program stays while hosts train (its 6:00 AM sessions show in notices until archived).

## Earlier — 2026-10-16 closed: the Scheduler, sound for every team; sessions keep their Central time

Narrative: `session-log.md`, 2026-10-15 to 10-16. Only the hosting team hosts; one set of rules for every scheduling team; new teams by configuration; sessions keep their Central time across Nov 1 (`shiftToDate`). Its signed-in walk was done 2026-10-18 (clean; fixes above). Still owed: the read-aloud of "Take this session?", "Off the schedule", "Can take sessions on the schedule", "Take them off their sessions", "You're greeting", "Cover needed", and `coverage-sessions-cleared`, `sessions-cleared-schedule-change`.

## Earlier — 2026-10-15 closed: one person, one account

Narrative: `session-log.md`, 2026-10-15. Silvia, LoriLee and Jesse each have one account at their RIM address; old addresses still lead in ("Send code to my new email"; the way back reads "← Back to sign in"); the Members list shows teams; possible second accounts are flagged; Admin can merge. **Open:** a signed-in look at `/admin/members` and one profile with real data; the first real merge is the end-to-end proof. **Queued:** `2026-10-15-001`, `2026-10-15-002`, `2026-10-12-003`. Before the teams sign-in note goes out, check the "Possible second account" filter.

## Earlier — 2026-10-14 closed: outside meeting rooms live; LoriLee's review ruled and live; every email in one look

Everything is on `main` (`6063bf5` … `41e305e`, `fedbecd`, the closing docs). Narrative: `session-log.md`, 2026-10-14 (evening), (later) and 2026-10-14.

**Live from this evening: outside meeting rooms.** Program Manager → Hosting & Access → "Where it meets online": RIM's Zoom, or an outside link (`Program.outsideMeetingUrl`), with the public Join option and a "Who can join, with these settings" summary. The door keeps every gate and the window, then forwards; no seat, no host code. `RIM_Zoom.md` → "Outside rooms". **No program uses it yet.**

**Live from tonight: confirmation emails and links** (`734b16b`): the Confirmation Message help (how to add a link), "Map and directions" for another venue, one link tidy-up for every link box. **Waiting:** Jesse checks `registration-confirmation` in `/admin/emails` still holds `{{confirmationMessageHtml}}`, then sends LoriLee the four-page PDF (session scratchpad; his voice, read the note first); LoriLee adds Qigong's handout link and uses **Resend Confirmation** for earlier registrants; read-aloud of the two help lines and "Map and directions". Queued: `2026-10-14-006` (absolute links in program emails; check saved links).

**Waiting from this evening:**
- **LoriLee adds the two links.** Recovery Dharma: she set it up with the old Webflow link and asked where the checkbox was (the guide's "Check the Who can get in box" meant *read*); her settings were right, so **Jesse sends her the reply: it isn't something to tick, press Save**, and paste the new link over the old one when Recovery Dharma sends it. The editor's wording is now short plain instructions and the summary is "Who can join, with these settings" (2026-10-14, late night); the web guide matches ([Outside Meeting Links](https://claude.ai/artifact/XyEZPshu1FSxDRJ2SDhjTT)); the PDF still says "Check". Our Hearts Were Made for This: guest link stays on, public box unchecked unless Jesse and Sara decide.
- **This Week** (live, 2026-10-14 late night): no rule beside each day; blue date blocks aligned with the times.
- **Look at the new Hosting & Access section signed in** when the first link goes in (never seen signed in; verified by tsc, the harness and review). Then press Join at the next Sunday session to see the forward.
- **Read-aloud, the new public lines:** "Join on Zoom →" (a public program page), "You can join from [time] on [day], Central Time." (the door, early), "Sign in to find the meeting link →".
- **Queued:** in-app help guides (`2026-10-14-004`, from this guide); drop the old `zoomLink` / `meetHostAccount` columns (`2026-10-14-005`).

**Live from today:** teacher support said once (`TEACHER_SUPPORT`, `PROGRAM_DANA_SHARE`) on Donate, Home and registration; `/join` tells a signed-in member "You're already a member"; the agreements' "traditionally called sangha"; Diverse Together's and New to RIM's lines; "Who may benefit" and four new program lines in production; all ratified by Jesse. Earlier: every email through one renderer, and a single Return is a new line in templates.

**Waiting on Jesse:**
- **Teams before the sign-in note.** Only 13 people are on the 15 teams (Peer-Led Silent Meditation has two; Course Team none). LoriLee and Cindy gather who serves on each team; I add them in one approved batch (Member Registry → Hub memberships; silent until they sign in); then the drafted note goes out (address: rim-next.vercel.app until launch, help at support@). Not signed in yet: Stacy Isaacson, Daniela Oliveira, Wendy Peche. Program Central has no apps installed, so adding leads (Maria, Marne) gives no editing power.
- **Look at `/join` signed in** (the built-in browser pane holds a signed-in session since 2026-10-26, so this can now be checked here).
- **The fundraiser's donation link** (December 5 gathering): waiting on the fundraising team.
- **Sacred Clarity**, dated March 16, 2026, still the only Immersion program (wrong date, or hide-when-past off): read its row, propose the fix.
- **A skim of long templates in `/admin/emails`** for a line now breaking mid-sentence (the edited production bodies weren't read), or allow that read.
- **Programs & Events and section differentiation: parked** (mockup `mockups/programs-2026-10-14/`; backlog `2026-10-14-001`, `-002`). His sentence about the circled header ended at "The way that these are": ask.
- **"Their message"** (the care notice's heading) for his read-aloud. Optional: Good Evening now says "close your day" twice.

**Still open from October 13 (evening):** the signed-in look (a team Home's line; Files as a lead, Leads only, a move each way, a member's view; a form send and a profile save); the leads sort their files before launch (duplicates in Drive's trash until about November 12); the read-aloud of that evening's lines ("You don't need to do anything else", My Home's welcome, the Saved and error lines, `leads-files-update`); Flodesk (Zaps on until the domain moves, then delete the bot contacts; link programs already taking registrations to their segments); send the volunteer note ([Member List Cleanup](https://claude.ai/artifact/XsbNosdwgMutzK3ZtFDxzf)) and one test message through `/community-care-agreements/concern`; the open offer of a read-only count of registrations detached by the old sweep (`2026-10-13-003`); the October 12 rulings (one name for the agreements in the footer and "Practice with us"; whether the Library names Taking CARE; the cancellation line; the glossary `2026-10-12-002`; archived teams for the rare member; the "agreements updated" notice `2026-10-12-001`; Taking CARE Foundations' details).

**Before launch (in order):**
1. **Self-service email change** with verification, notice and history (`2026-10-12-003`, high); Flodesk can't change an address through its API.
2. **Launch configuration:** Stripe live (`2026-09-24-001`); with the domain move, change `NEXTAUTH_URL` in Vercel in the same step; rotate the database password.
3. **On the day the domain moves:** delete the bot contacts in Flodesk (Jesse); run Import members once more, then remove the tool, its rail link and `lib/legacyImport.ts`, delete `MEMBERSTACK_SECRET_KEY` in Vercel and the key in Memberstack (`2026-10-13-001`); export Webflow's Forms history; then cancel Zapier. (The old Webflow Donate page's "Teachers receive no payment or compensation" goes with it.) Re-add the RIM Guide connector in Claude at the new domain (`volunteer-guide/README.md`).
4. **Delete the Dummy Test Program** and its test registrations (Jesse, 2026-10-14). Until then it is restored for Nancy and Maria's Zoom testing, hidden: off Programs & Events, This Week and the sitemap, Open entry off (it shows on My Home only to its registrants, hosts and admins); the guest link still admits testers.
5. **Watch the first real registration** create its Flodesk segment and the first member sign-in join Members (Vercel log).

**Queued (backlog):** `2026-10-14-003` community calendars (high, right after launch); `2026-07-15-001` collaboration between teams (high, after launch; LoriLee's #11 and #15 folded in); `2026-10-13-008` a one-off email to a chosen group; `2026-10-13-005` a true "needs help" count on the Scheduler card. **Deploy watch:** if a push doesn't show in Vercel's Deployments within a few minutes, deploy it from the dashboard (Create Deployment → main).

## Still open from October 2 — categories, Open entry, and history and roots are live; the pages await Jesse's read-aloud

**Live on `main`** (`a481eb4` the categories merge, `3b2ed9e` the history-and-roots merge; the narrative is in `session-log.md`, 2026-10-02 (later); the design record is `RIM_Public_Pages.md`, "The three ways, Category and Format, and Open entry" and "Our way of practice, and our roots"):
- **Category and Format on every program**, with Silent meditation and Hosted by volunteers: the Program Manager's two required dropdowns and the admin list filters, and Programs & Events, the shared block, breadcrumbs, This Week and the Kalyana Mitta page reading them. **The migration was applied to production** (20 programs, Jesse's approved mapping with his changes; snapshot, drift guard, one transaction, whole-table diff: only the five new columns changed; `updatedAt` untouched). `lib/programChapters.ts` is gone.
- **Open entry** (`Program.openEntry`): access is its own per-program setting, beside registration in the Program Manager. Category and Format are labels and never decide access. Backfilled so all 20 programs keep exactly the access they had (proved before and after, and across all 49 Category x Format combinations).
- **History and roots** (drafts file §8) and the Handful as a members' reference (§9): About "How we began" (nonprofit dharma center in 2016), Our Roots rewritten whole, "our way of practice," silent illumination at the heart, "Buddhist teachings." The member introduction is re-derived ("which is how we practice").
- **`join-welcome`** no longer promises a series of welcome notes (production row, with consent; seed matched). Backlog `2026-10-02-003` is closed.

**Production state changed on 2026-10-02 (each write authorized by name):** `dummy-test-program` archived; the Meditation and Dharma Talk text; the program-categories migration (five columns on all 20 programs); the `join-welcome` body (two edits: "courses", then the welcome-notes paragraph removed). Snapshots are in the temp directory. Production **is reachable from this machine** (`.env.production.local`); `CLAUDE.md` says how to treat it. Never run `npm run build` locally, and do not run the `vercel` CLI (it logs in by itself).

**Next concrete step:** Jesse's read-aloud on the published pages (corrections come back through `08-promotion-site-drafts-integration-2026-10-01.md`), and, **signed in**, three looks I could not do: (1) the real Program Manager (Categories tab, the Registration tab's Open entry checkbox and readout) and **saving a program from it**: the editor was verified hydrated in headless Chrome and the API by review, but a real save (POST/PUT with the new fields) has not been run against production; (2) the two Handful member pages and the My Home card; (3) Today on My Home. Then launch (the domain move; the date is Jesse's; October 5 passed with the site still at rim-next.vercel.app).

**For Jesse's ear, or his rulings (open):**
- **Database-held "the Buddha's teachings"** (reported, not written, per the brief): Meditation and Dharma Talk's description ("The talk draws on the Buddha's teachings") and Essential Dharma Study's ("The Buddha's core teachings"). The first glosses the Dharma and would become "Buddhist teachings"; the second may mean the Buddha's own. Jesse's call per record.
- **Our Hearts Were Made for This is now a Community Group** (his ruling): it moved to Community Groups on Programs & Events, now appears on the Kalyana Mitta groups page, and no longer carries the shared Taking CARE block. Open entry stays on, so its access is unchanged. Is that the page he wants it on?
- **Essential Dharma Study** has registration and open entry together, so This Week marks it Drop-in while its program page offers only "Register →" (the "Simply arrive" line shows only where registration is off, as before). A small wording question for him, if it reads oddly.
- **Words owed:** Essential Dharma Study named on the Handful page, if that is where it is taught; whether Foundations can promise "no one will be turned away"; Meditation and Dharma Talk's one sentence on the shape of a morning; New to RIM's "What a gathering is like" with parking and the stairs question; whether the Handful introduction's "companion guide to the sitting itself" exists.
- **For the vault, not the repo:** the vault's MBSR brief still carries the old long About wording (the live About carries his short form).
- **Smaller:** the lesson reader's own "Learning & Practice" label (`2026-10-02-004`); a way between the two Handful pages and a print button (`2026-10-02-005`).
- **Cleanup that is ready, not done:** the old `ProgramCategory` and its `kind` (`lib/programKind.ts`, the `openEntry == null` and legacy-category fallbacks in `lib/programOffering.ts`) can be removed now that every row is filled (backlog `2026-10-02-006`).

**Before and at launch (the domain move):** the Webflow redirect map (`2026-08-07-003`, 17 redirects against 317 pages) and forms audit (`2026-08-10-003`); the Stripe go-live checklist (`2026-09-24-001`); unpublish the public Test Course (`2026-09-02-001`; it is also why the sitemap omits `/courses`); the domain move (then confirm `robots.txt`, the sitemap and each page's canonical on rootedinmindfulness.org; the `rim-next.vercel.app` host keeps its `noindex` header); share cards and the remaining descriptions (`2026-10-01-001`). **November 1 sweep:** "begins in November" / "First offered in November" on Home, New to RIM, Foundations (page and metadata description) and the Programs & Events Foundations introduction; the Saturday Meditation and Dharma Talk line (Home, New to RIM, Foundations).

**Still to verify (needs Jesse signed in):** the two Handful pages and the My Home card in a real session (here they were checked signed-out, where they redirect to sign-in, and by a stand-in render with the account shell); Members reads "Hi, [name]"; the phone sheet's signed-in foot; the account and hub phone drawers no longer scroll the page behind. **Safari:** a keyboard-opened nav panel's link takes a mouse click (untestable in Chromium).

**Queued:** the other weekly program texts (launch week: Awakening the Heart, The Art of Meditation, Essential Dharma Study, Our Hearts Were Made for This, the two silent sits; the Art of Meditation's epigraph is a loose Dhammapada paraphrase); Diverse Together, Volunteer and Community Groups copy; the other public pages onto the revised grid (`2026-09-28-001`); the button pass on untouched pages' text links (`2026-09-25-002`); First Steps (`2026-09-25-003`); the recording (`2026-09-25-004`). Two primary buttons still go to `/this-week` by Jesse's choice (teacher profiles' "See this week").

**Method (no dev server):** the documented render method now has a harness: transpile the pages with the repo's `tsc` into a scratch folder, stub `@/lib/db`, `@/auth`, `next/navigation` and `server-only`, render with `react-dom/server` using a read-only fixture exported from production, place the markup in the live shell (a built page's head and footer, local `custom.css`), and drive headless Chrome over CDP for screenshots at 1280 and 375 (and `Emulation.setEmulatedMedia` for print). Production reads and writes use `.env.production.local`: probe, snapshot, drift check, one transaction by unique key, whole-table diff. Delete the scratch scripts after.

## Still open from September 24 (integrity pass)

**Stripe state:** sandbox only. `STRIPE_SECRET_KEY` = sandbox `sk_test_`; webhook destination `rim-site-dana-2026` (both checkout events). Live has no destination; go-live checklist is backlog `2026-09-24-001`. The Dummy Test Program still has the test registration and registration enabled.

**Waiting on Jesse:**
- **Read-aloud** of the new copy: sign-in button/code page, dana step, receipt, approval line, Stripe lines, Zoom notices, readout, overlap banner, thank-you page, and `ZOOM_COORDINATOR_GUIDE.md` (sent as Markdown/HTML for the Zoom Coordinator Google Doc).
- **Accountant** review of the receipt's "For your records" statement (RIM is IRS-classified as a church, 170(b)(1)(A)(i)).
- Switch **"Awakening to the Beauty of This Moment"** to Voluntary dana, $175 suggested (it's `fixed` $175 now).
- **Flodesk design** (`2026-09-24-002`): does he send to segments or the whole list?
- Check Flodesk for his test signup's segment and any welcome email.

**Next concrete step:** with Jesse signed in, check the Visibility readout on a few programs and one `/enter` notice; then take the read-aloud flags.

**Earlier handoff still open:** the September member redesign's signed-in review (My Home, Profile, Community Care, My Teams, team Home/Files, Registry, Scheduler, Program/Course Manager; file preference persistence and shared pins). Files search covers the loaded folder only (`2026-09-22-002`).

## Pending questions / follow-ons

- **Memory confirmation pending:** proposed preference: distinguish previewed, implemented, deployed and verified work, naming remaining checks. No personal memory or backup mirror changed without Jesse’s confirmation. Product/design decisions are already in project docs.
- **Codex:** Jesse is working with Claude only for now (2026-09-27, after the withdrawn Codex review). The `AGENTS.md` bridge is deferred; if Codex returns it needs guardrails as well as orientation (backlog `2026-09-22-001`). Commits authored `jessefoy` may come from another agent: read the message and scope before assuming they are Jesse's hand edits.
- **Email provider decided (2026-09-24):** Jesse is staying with Flodesk (already paid, ~4,500 subscribers, $418/year). Integration design is backlog `2026-09-24-002`.

## Standing reminder — public copy still awaits Jesse

Remind Jesse each session until resolved: parking and which entrance to use are still unwritten on `/new-to-rim` (which replaced `/your-first-visit`; Jesse supplied the other practical details 2026-09-25) (`2026-08-10-002`); the s174/s176 public copy requires his explicit read-aloud approval. Shipping is not ratification. Community Care now shares canonical text across **five** surfaces: join, welcome, registration, public agreements and member care. The live `/diversity` image `color-powder-diversity.webp` still lacks recorded provenance.

Other pending decisions: public Test Course/teacher profile data (`2026-09-02-001`); whether to commit the community introduction/Copy and Voice Brief; source cleanup of `NEXTAUTH_URL`, retired service variables/Sanity project and the retired Community Drive (`2026-08-09-001`). `TEAM_EMAIL` was previously unset. These are recorded findings, not rechecked at this closing.

## Queued work / earlier verification

- Webflow cutover: redirects (`2026-08-07-003`), asset rescue (`2026-08-09-006`), forms/Zapier audit (`2026-08-10-003`). Wiring requires dashboard evidence; do not infer it from markup.
- Tool hub-context links (`2026-08-09-002`), Program Manager index title (`-003`), tool hex sweep (`-004`), dead CSS (`-005`); coordinator ACTIVE policy (`2026-08-08-005`).
- Teacher course listing (`2026-09-02-002`), authored rich-text cleanup (`-003`), retired login CSS (`-004`). Prior public targets (`2026-08-07-009`) and volunteer/KM measurement (`-002`) may already be satisfied; recheck before changing. Consolidate visually-hidden utilities (`-010`); course landing (`2026-06-13-003`).
- Earlier Files checks: drafts → Share, attribution, governed removal, notification templates visible in `/admin/emails`, old documents URL redirects. Notification sends require explicit user authorization.
- Editor toolbar polish, optional Stage 2d blocks, eventual legacy BlockNote walker removal, coordinator notes and duplicate-Aside behavior remain parked. Document export was fixed in s102; that historical native-document system is now retired.

## Recently completed / reference

- LoriLee's review, teacher support stated once, `/join` for members, the teams read (2026-10-14, later): `session-log.md` 2026-10-14 (later); `RIM_Public_Pages.md` Copy and voice; `RIM_Auth.md`; `RIM_ProgramEditor.md`.
- One email renderer, form-notice shape, template line breaks (2026-10-14): `session-log.md` 2026-10-14; `RIM_Email_Engineering.md` ("The look").
- Form inboxes, the answer rule, team Home simplified, Leads only (2026-10-13 evening): `session-log.md` 2026-10-13 (evening); `RIM_Hub_Engineering.md`; `RIM_GoogleWorkspace.md` §12.
- Category and Format, Open entry, history and roots (2026-10-02, later): `session-log.md` 2026-10-02 (later); `RIM_Public_Pages.md` ("The three ways, Category and Format, and Open entry"; "Our way of practice, and our roots"); `RIM_Offering_Model.md`; `RIM_ProgramEditor.md`.
- The integration pass and its follow-up (2026-10-01 to 10-02): `session-log.md` 2026-10-02 (includes the F11 categorization survey); `RIM_Public_Pages.md` ("The integration pass"); `RIM_ProgramEditor.md` (optional pull quote); `RIM_Member_Area.md` (the Handful pages, My Home card).
- Revisions 8 to 12a, the menu, Diversity, the dana account, the MBSR line and bios, the footer (2026-09-30 to 2026-10-01): `session-log.md` 2026-09-30 and 2026-10-01; `RIM_Public_Pages.md` (Revisions 11, 12, 12a, the menu, the footer and teacher page); `RIM_Registration.md` (receipts to RIM); `RIM_ProgramEditor.md` (dana templates); `CLAUDE.md` (production reachable).
- Brief, handout, vision, balance (2026-09-26): `session-log.md` 2026-09-26; `RIM_Public_Pages.md` → "The reading column" and Copy and voice (2026-09-26).
- The center, stated (2026-09-25): `session-log.md` 2026-09-25; `RIM_Public_Pages.md` → "The center, stated"; copy in the vault's `04-community-website-copy-2026-09-25.md`.
- September 24 integrity pass: `session-log.md` 2026-09-24; `RIM_Registration.md` (receipt, thank-you, voluntary dana), `RIM_Zoom.md` (seat pick, door permissions).
- September member redesign: `RIM_Member_Area.md`; closing entry 2026-09-22 in `session-log.md`.
- s176 public consistency / Sanity image rescue: `RIM_Public_Pages.md`; full session narrative already archived.
- s175 member self-cancellation removed: `ab686b1`; retain staff registration management.
- s174 public voice; s171–173 context diet, access and box-model rules: design/role references and session log.
- s165–168 Google Files and universal Home/Updates: `RIM_GoogleWorkspace.md`, `RIM_Hub_Engineering.md`.
- s159 Zoom cutover; s153 HOST retirement; s119 sign-in codes: corresponding engineering references.

## Jesse’s standing calls

Push to `main`; no local dev server. Do not run a local build that invokes the production migration. Preserve the no-member-cancellation decision. Use RIM’s design and voice rules; copy remains provisional until read aloud. `/teachers` is out of the menu until the profiles carry photos (About's "Our teachers" button does link to it, per the Revision 10 brief). Public design tombstones live in `RIM_Public_Pages.md`; do not silently recreate them. Production data: read only when he asks; write only with his approval of specific records, with a snapshot, drift check, one transaction and a whole-table diff (`CLAUDE.md`). Pages push to `main` and go live; the real-domain launch (once planned for October 5) has not happened yet; until then the site is at rim-next.vercel.app (reachable, not announced).

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
- **`min-height` on a content-box element ADDS to its padding.** Raising a touch target with `min-height: 44px` on an element that keeps `padding: 8px 12px` produces a 60px box, not a 44px one — and this repo has no global `* { box-sizing: border-box }`. Session 176 grew the whole public nav bar this way, leaving `.nav__link` at 60px beside a `<button>` sibling at 44px (buttons are border-box by UA default). **Always pair a target-size `min-height` with `box-sizing: border-box`.**
- **An appended single-class `display` overrides an earlier media query.** `custom.css` is appended to, so a rule added at the end beats a media-query rule of equal specificity declared earlier. Session 176 appended `.nav__donate { display: inline-flex }` and silently **un-hid** the desktop DONATE button on phones (it carries `display: none` under 768px), which pushed the hamburger 9px off-screen on every public page. **Any appended `display` on a responsively-hidden class must live inside the breakpoint it belongs to.**
- **`tsc` and `next build` prove a page compiles, not that it composes.** All three of session 176's regressions passed both, and all three were found by measuring the deployed page. For any visual change, measure the rendered result (`getBoundingClientRect` after `document.fonts.ready`, at 375 and 1280) before calling it done.
- **`html { overflow-x: clip }`, not `hidden`.** `overflow-x: hidden` creates a scroll container that breaks `position: sticky` for descendants in Safari/Chromium. `clip` clips overflow without making the element scrollable.
- **Scroll locks go on `<html>`, not `<body>`.** Because `html` carries `overflow-x: clip`, a `body { overflow: hidden }` never propagates to the viewport and the page keeps scrolling behind a modal (measured on the nav sheet, 2026-09-28). The nav sheet and `useNavigationDrawer` both lock `document.documentElement`.

---

*When this section is cleared or archived, write the next in-progress context in its place. Do not let this file grow into a log — session-log.md is the log.*
