---

## 2026-08-10 (session 174) — The public pages in the house voice, and the handful is ordered

Jesse arrived with a **ratified Copy and Voice Brief** he had built in a separate chat session and asked to have implemented on rim-next. Five commits, all on `main`, `tsc --noEmit` and `npx next build` both green, every change verified against the deployed site by measurement. **No new dependencies, env vars, services, schema, migrations, crons, or email templates.** Two new routes, both prerendered static; one new CSS modifier.

The session had a false start worth recording, because the work it produced is not lost.

### Arc 0 — the forms and integrations audit (asked for, delivered, then parked by Jesse)

Jesse's opening concern was the site's forms: "newsletter sign-up, contact forms throughout the website. Some of these are hooked up to Zapier and other systems." Audited both sides — the live Webflow site (published Jul 19), the offline clone at `~/Sites/rim-site-archive/`, and our own repo — then he changed direction to the copy work before any of it was built. **Nothing was half-built; the findings are preserved in backlog `2026-08-10-003`.** The substance:

- **25 distinct forms exist on the live site; four are real intake forms.** Newsletter (home), General Volunteer Interests, Kalyana Mitta Group Application, and a **KM Group Details Form** (14 fields) that has **no equivalent in rim-next** and which *nothing on the site links to* — the coordinator almost certainly emails the link to approved groups. The rest are Memberstack auth, Webflow ecommerce checkout, and a commenting test page.
- **The integrations are invisible from outside.** Every Webflow form posts to Webflow's *own* handler — no `action` attribute, submitted by `webflow.js` — so Zapier/Mailchimp wiring lives in Webflow's dashboard, not the markup. Neither the live HTML nor the archive can reveal it. **This is the blocking unknown for cutover** and only Jesse can resolve it.
- **A possible two-list newsletter problem.** The live form carries a hidden `tags=6432381` inside a div classed `html-embed-mailchimp-tag` — a Mailchimp tag id. Our `/api/subscribe` writes to **Flodesk**, segment `6340e5b00170f97cbdfc4b87`. Mailchimp appears nowhere in the repo or docs. `FLODESK_API_KEY` **is** set in production (verified via `vercel env ls`); the round trip is untested, and testing it writes to Jesse's live list, so it stays his to run.
- **Seven live Fillout embeds** still take program registrations: `essential-dharma-study` (`7562PfDDk6us`), `bookmarks-breath`, `mindfulness-and-meditation-retreat`, `nature-meditation-km-group-2024`, `qigong-at-rim`, `rim-greater-community-engagement`, `the-heart-of-wisdom-2026`. Native `Registration` replaces the function; Fillout is a separate paid service with its own history and possibly its own Zaps.
- **The two ported forms have no durable record.** `/volunteerism/volunteer` and the KM application are email-only — no DB row. Templates are seeded `enabled: true` and go to `TEAM_EMAIL`, which is **not set in Vercel**, so both fall back to `hello@`. Worse, the server action `await`s the send *before* `redirect()`, so a failed send shows the visitor an error and loses their text. Webflow at least kept a copy in its own dashboard. **The one genuine regression the audit found.**
- Both ported forms are login-gated in rim-next, and **were login-gated on Webflow too** (`data-ms-content="members"`) — parity, not a regression. Corrected my own initial read on that.
- **`rim-connect.js` is 404ing on all 317 live pages right now.** Every Webflow page still loads `https://rim-next.vercel.app/rim-connect.js`; the bridge was removed from our side and the script tag was never pulled from Webflow. So "the bridge is gone" is only half true.
- Contact is **`mailto`, not a form** — 171 `mailto:support@…?subject=Dear RIM Support` links, nothing to port. And adjacent: GTM is on all 317 live pages while rim-next has **no analytics at all**; a Donorbox popup script sits on 57 live pages while our donate page is Givebutter.

### Arc 1 — the Copy and Voice Brief, implemented (`bf952fc`)

The brief was written against the **Webflow** site; rim-next's pages were already rebuilt with different copy (sessions 169–172). Mapping brief-section → actual route was most of the thinking, and four of its assumptions did not hold: "Programs — leave it alone" was about Webflow's page (ours is a different rebuild, and its membership block already speaks dana); "Stay Connected" is a home-page section on Webflow but the **global Footer** here, so that copy lands on every public page; the "does the site get a teachers page" open question is **already resolved** — `/teachers` exists on real profile data, just unlinked since s148; and one of the three Donate line edits had **no target** (see below).

The propagation surface worth naming: the agreements, their lead-in, and the form lead live in **`lib/communityAgreements.ts`** and are rendered by `/join`, `/account/welcome`, and `components/RegistrationForm.tsx`. Three of the brief's line edits live there, so they reached the **program registration form** and the **post-sign-in welcome ritual** too, by design.

What shipped: the home page rewritten section by section (hero names the community and the place; "Learn, Practice, and Grow Together" meets the reader's life by naming **particulars, never the epoch**; "Timeless Wisdom" drops the lineage vocabulary — Insight/Vipassana/Pāli Canon moved to **metadata**, where a seeker still finds the door; the programs chapter replaces the pandemic-era "Tuesday and Saturday"; the Dana section describes the giving before naming it). Two new pages. `/join` gained **"What membership means"** ahead of the agreements — the section that disarms dues, attendance, and the social fear, and raises the reader's own objection ("will I have to be social?") at the moment it occurs. `/diversity` replaced at half length. Two Donate line edits. One orientation line on `/this-week`. Newsletter copy, confirmation, and errors in the house voice, and `/api/subscribe` stopped surfacing Flodesk's API-consumer messages to visitors.

**Decisions made in the open, any of which Jesse can overrule at the read-aloud:**

- **Cut the brief's third "freely offered and community-supported."** The hero says it, "membership is freely offered" sits between, and the Dana section opened with the same frame — three on one page, which is the **repeating-frame** tell the house guide names as stronger than any single word. The section now opens on "We follow an old practice here," which says it more concretely one line later. Jesse's own instruction that session — dana "consistent and easy, but not over the top everywhere" — is what licensed the cut.
- **Re-homed the `/diversity` link.** The brief replaces that section's button with "Read the story of the name," which would have **orphaned the page** — nothing else on the site links `/diversity`. It became the quiet secondary beside "Become a member," matching the Dana section's button-plus-link pattern.
- **Fixed one thing outside the brief:** `/volunteerism/volunteer` read "Membership is free," a head-on violation of the price-word ruling. Now "freely offered." Left `/donate`'s "fosters" alone deliberately — the brief's Do Not Touch list limits Donate to its named edits.
- **One line has no home.** *"Dana is how a community takes care of what it loves"* was to replace "Dana promotes a healthier, selfless, caring, and grateful world" on Donate. That sentence lived **only on the home page** and went with the rewritten Dana section. Unplaced, and deliberately not forced somewhere — it would be a second potent line in a passage that already has one.

### Arc 2 — Jesse's correction: the handful is ordered, not eclectic (`090072a`)

Jesse pasted the full **community introduction** (`A Handful of Leaves: An Introduction`) — the document **given to every new participant** — and made the substantive correction of the session: *"we are not just collecting from all traditions. We have organized it in a way that it's not just picking and choosing. It is an ordered structure practice, and this is actually a response to how much we have."*

The shipped page said "gathered from across the traditions" and stopped, which reads as a spiritual supermarket — the one thing RIM is not. It also had a formatting problem that turned out to be the *same* problem: **295 words, four paragraphs, zero headings**, two of them 83 and 115 words unbroken at 78 characters per line. The sections it was missing were the headings it was missing.

Because Jesse said the articulation mattered, this followed the `how-jesse-writes` front door: Spine questions answered out loud, structure proposed, his yes before prose. The reader analysis is worth keeping — **this page's reader is not the introduction's reader.** The introduction meets someone who has already walked in and is examining their own mind under instruction, so it disarms **shame** first. The web reader carries no such weight and gets **no shame-disarming** (reassuring the unafraid reads as condescension). What they *do* carry is suspicion of eclecticism and accumulation fatigue, and the page now answers both.

Five sections: the story of the name · **why a handful** (the situation — *exposure everywhere, orientation nowhere* — and the traditions cleared of fault: each lineage complete in itself, met broadly rather than deeply, and breadth without roots scatters) · **how it is ordered** (organized **by function**, not by school or country, into seven gatherings met as the arc of a practicing life) · **one practice, many doors** (the reader's own objection — many practices competing for one cushion? — answered with the hall-and-orchestra distinction) · for anyone. Title hierarchy mirrors the introduction: eyebrow "What and how we practice", title "A Handful of Leaves". Nav label stays "Our Practice" (the bar has ~156px slack at 1024px, and the full phrase is roughly twice the width).

**The editing pass earned its keep twice.** The script flagged six items: three are the Buddha's quoted speech (overridden — depicted speech, attribution before the words), one was a genuine **trailing warrant** (`"competes with it, because nothing is on its level"` → repaired with a period, which lets the repetition do the work), and two are defended and kept — **"broadly rather than deeply"** (the contrast term the sentence turns on, not an empty intensifier) and **"add the practice gently"** (the manner *is* the instruction). Then the **architecture check found the real defect**, which no sentence-level tool would catch: **the page never turned outward.** The Buddha's words had been cut short at "Only what leads onward," dropping exactly the clause that opens the teaching past the reader. Restored to the introduction's own wording.

**Image discipline, stated as a rule going forward:** the introduction is rich with images — the pond and the mud, the sun and the frost, the house and its guests, the gardener and the rose, the medicine cabinet, the hall and the orchestra. **A web page carries one.** This page took the hall and the orchestra, because it is the image that does the anti-eclecticism work; everything else stayed in the introduction, where there is room to live inside it.

### Arc 3 — `.pp-prose--spine`, and the left-edge question answered by measurement

The page had three left edges: hero copy at 110, prose at 290, closing actions back at 110. Before changing anything I checked whether I had introduced it — and I had not. `/diversity` measures identically, and **`/donate`, the page matched to the live site by measurement and approved, centres its statement at 348 against a hero at 110.** So a centred reading column against a left-aligned hero is the **shipped, approved convention**, and the s170 one-left-edge rule is scoped to the two *listing* pages, exactly as it says.

New `.pp-prose--spine` sets `margin-left: 0` and leaves the reading measure alone, so a long-form page has one left edge. **Deliberately opt-in**, not a change to `.pp-prose`: the measured pages must not move, and both were verified unmoved after deploy (`/donate` 348/585/408, `/diversity` 290). Applied only to `/what-we-practice`, which is now 110 across hero, prose, headings, and actions.

### Your First Visit shipped provisional, by Jesse's ruling

The brief marked the first-visit logistics `[TODO: Jesse]` and forbade inventing them. Offered to hold the page unlinked; Jesse chose otherwise — *"Let's create a page with temporary text that seems good to you, and then remind me each session about this."* So two paragraphs are mine, marked `PROVISIONAL` in the source, and written to **assert nothing unverifiable about the building**: instead of inventing a parking lot, a door, or a shoe rule, they point a visitor at a person to ask. That distinction matters, because this page is linked from the home hero's primary button and a nervous first-timer standing in a parking lot is exactly who would be misled by a confident invention.

### What this connects to

- **`lib/communityAgreements.ts` → `/join` + `/account/welcome` + `RegistrationForm`.** One source, three surfaces, by design. Any future agreement edit reaches the registration flow.
- **`components/Footer.tsx` → every public page.** The newsletter block is global; `FooterWrapper` suppresses it on `/admin`, `/account`, `/tools`, `/session`, `/lessons/`, `/course/`.
- **`app/api/subscribe/route.ts` → Flodesk** (segment `6340e5b00170f97cbdfc4b87`). Its error strings render directly in the footer form, which is why they are house-voiced now and why Flodesk's own message is logged instead of shown.
- **`components/Nav.tsx`** gained a flat top-level link — the first non-dropdown item in the public bar since the s148 slimming. Both desktop and mobile menus updated. Touch targets: the new link measures 43px, its dropdown neighbours 38px (backlog `2026-08-07-009` still open on all of them).
- **The home page's dynamic doors are untouched** — only the prose above them changed. The `ProgramCategory` read, `KIND_LINES`, and the category anchors all still work as built in s172.
- **`/community-programs` membership block** — the home programs chapter deliberately re-uses its "no fees or tuition; the center is held by the people who practice here" line. Recurrence is how a line becomes the community's vocabulary; keep the two in step.
- **The Webflow cutover** — neither new page has a Webflow counterpart, so the redirect map (`2026-08-07-003`) gains nothing. But `/community-membership` → `/join` is still owed there.

### What comes next

The gate on all of this copy is **Jesse's read-aloud**, not the brief and not this log. Ratification is his explicit yes; silence is not consent. A read-aloud document carrying every block in visitor order, with the flags first, was produced and delivered.

Open and waiting on him: the first-visit logistics (`2026-08-10-002`, with a standing reminder at the top of `UP_NEXT.md`); where the unplaced dana line goes, if anywhere; whether the community introduction and the brief itself should live in the repo rather than being pasted each session; and the parked forms audit (`2026-08-10-003`).

---

## 2026-08-10 (session 173) — Five measured overflows: the sign-in pages, the phone menu, the Zoom door, and two long email addresses

A short session that started as an opening ritual and became a box-sizing audit. Three commits of fixes plus two backlog commits, all on `main`, `tsc`-green, reviewer-gated, each verified against the deployed site by measurement rather than by eye. **No new dependencies, env vars, services, schema, migrations, crons, or email templates — `public/css/custom.css` only.**

### The opening ritual closed two verification items on its own

- **The `archive-concluded-programs` cron's first run worked** (s172's open item #1). Nature Meditation KM Group is gone from `/community-programs`, gone from the Kalyana Mitta groups page, and its detail page 404s — which is the *archived* state, not merely the read-time hide, so both halves of `hideWhenPast` are proven in production. Read from the deployed site rather than Vercel logs.
- **The bad end times were still live** and Jesse fixed them mid-session (backlog `2026-08-07-011`, now closed): Awakening The Heart and The Art of Meditation had rendered "9:30 AM–10:30 PM CT" on the catalog. Re-measured after his fix — both read "9:30–10:30 AM CT".
- Also settled without asking Jesse: the hero video now **loads the MP4**, not the WebM (`currentSrc` checked on production), which was the whole of the s172 "dancing blocks" change. Only the by-eye judgement remained, and Jesse confirmed it looks fixed.

### Arc 1 — Jesse's report: "it does extend into the right border of the screen a little bit. The page that is waiting for the code."

Measured before touching CSS, per `feedback-visual-bugs-verify`. `.container-7-copy` — the wrapper on all three `/login` pages, one of the legacy Webflow classes re-implemented in `custom.css` — was `width: 100%` + 24px side padding with no `border-box`: **48px past the viewport, content shifted 24px right, the sign-in card 24px off true centre, on every viewport under ~1148px** (so most laptops, not just phones). A `max-width: 1100px` cap is why it survived on a wide monitor.

The same measurement pass found a **second live instance Jesse hadn't reported**: every row of the public phone menu (`.nav__mobile-link`) was 423px wide in a 375px viewport, clipping its right padding, row border, and hover background — on every public page. A page-level sweep can't see it because the menu is closed; it took clicking `.nav__hamburger` in the harness. The s172 sweep missed both because that sweep was scoped to *backend* classes.

`.rim-container` measured correct but only **by ancestry** — `.pl-page` and `.pp-page` each granted `border-box` through a descendant selector. Moved onto the container itself and both grandfathered rules deleted; all 10 live usages already sat under one of those wrappers, so nothing rendered differently, and a future public page that forgets the wrapper can't inherit an 80px overflow. The reviewer independently confirmed `.pp-section--airiest`'s 1220→530px card arithmetic was authored *against* border-box, so promoting it preserves that layout exactly.

Commit `08da32f`. Verified on production: 16 public routes at 375px, the menu open, and the `/login` trio at 375 / 1000 / 1440 — all zero, card centred 24/24 and 280/280.

### Arc 2 — "Can you address the things that you found?"

I had listed 18 further candidates as backlog `2026-08-10-001` and deliberately not patched them, because they all sit behind login and `feedback-visual-bugs-verify` forbids guessing at CSS I can't see. Jesse asked for them anyway — and the right answer was neither blind-patching nor deferring, but **getting evidence a different way**: reproduce each candidate's real ancestor chain (read from the component source) inside a 375px iframe on the production origin, where the deployed stylesheet is already applied, and measure. That works for signed-in surfaces without a session.

**The static pattern was wrong about 15 of 18.** The finding worth keeping: `width: 100%` + padding only overflows when *nothing shrinks the element*. Every flagged modal, dialog, and row is a **flex child**, and a flex item's `width: 100%` is a base size that `flex-shrink: 1` reduces to fit — so content-box costs it nothing. Six others land on real `input`/`textarea`/`select` elements already covered by the existing reset. My own geometric prediction said all of them overflowed; the browser disagreed and the browser was right.

Three reproduced (`7a8da4a`):

- **`.zoom-launch__panel`** — a **grid** item with an explicit width, so unlike a flex item nothing shrinks it: 385px in a 375px viewport, overhanging both edges. This is the page every virtual session's Join lands on. Fixed by `border-box`.
- **`.login-box strong`** and **`.adm2-email-confirm__text`** — **not box-sizing bugs at all.** An email address has no space or hyphen, so it is one unbreakable token; past ~34 characters at 375px it simply runs off the edge. 26px over for `maria.sprecher@rootedinmindfulness.org`, 392px for a 77-character address, 39px on the registry's email-change confirmation with a 53-character one. `overflow-wrap: anywhere` (not `break-word` — `anywhere` also lowers min-content so a flex parent can shrink). **`border-box` fixes neither**, which is the whole argument for measuring: patching the pattern would have shipped a fix, declared the audit finished, and left the sign-in page broken.

Three surfaces I suspected and left alone because they measured clean: `.adm2-header__meta`, `.mp-header__details`, `.adm2-section__hint`.

### Design decisions and why

- **Measure, don't pattern-match.** A postcss sweep of `custom.css` is a candidate generator, not a defect list — 83% false-positive rate here. The harness (real ancestor chain + `document.fonts.ready` + realistic long content) is now the documented method in `RIM_Public_Pages.md`.
- **Test with real content, not lorem.** Both email bugs are invisible with a short address. The first pass looked clean at 38 characters and only reproduced at 53 — I briefly misattributed that to a font race before pinning it to address length.
- **"I can't verify it" is a reason to build a harness, not to defer.** The deferral was right at the moment I made it and wrong to leave standing.
- **`.rim-container` hardened at source rather than left working-by-accident** — zero rendering delta, verified, and it removes a trap for the next public page.
- **Don't fix what measures correct.** 15 candidates stay untouched; the backlog item records why, so it isn't re-derived.

### What this connects to

- **The public sign-in threshold** (`/login`, `/login/check-email`, `/login/error`): the only three pages still on legacy Webflow class names. Recorded as pitfall 6 in `RIM_Auth.md`. `RIM_Web_Design_Philosophy.md`'s "Forms as Thresholds" is why a clipped code box is a correctness bug, not cosmetics.
- **The public nav** (`components/Nav.tsx`), shared by every public page. Backlog `2026-08-07-009` (nav/footer touch targets under 44px) is still open and still about the *desktop* bar — the phone rows measure 53–54px tall, so height was never the issue there.
- **The Zoom door** (`components/session/ZoomLaunch.tsx`, `/session/[slug]/enter`) — recorded as a pitfall in `RIM_Zoom.md`.
- **The Member Registry** email-change confirmation (`components/member-sections/CoreRecordSection.tsx`).
- **`RIM_Public_Pages.md` → "No global border-box"** is the authority; it now carries the flex-vs-grid correction, the long-token failure mode, and the method. This is the third session in a row that section has grown (s170 `.lr-btn`, s172 layout containers, s173 public + authenticated).

### What comes next

- **Unchanged and still Jesse's:** the drawer + rail walkthrough behind login, the half-screen-width pass, the Vercel env cleanup + Sanity project deletion (`2026-08-09-001`). The "check dialogs on your phone" ask from earlier in the session is **withdrawn** — those got measured instead.
- **The Webflow pre-cancellation errand** is the next build: the redirect map (`2026-08-07-003`, Claude can do this alone) + the asset rescue (`2026-08-09-006`, needs Jesse's downloads first).

## 2026-08-09 (session 172) — Dated events retire themselves; the member area gets its interaction floor; the home page composes

Eleven commits on `main`, every slice reviewer-gated and `tsc`-green, each verified on the deployed site to the extent auth allows. Three arcs: the dated-events feature (the s171 handoff's "next concrete step"), a member-area quality campaign that Jesse's own browsing kept sharpening, and a home-page design pass.

### Arc 1 — Dated events lead with their date, then archive themselves

- **Date-led cards** (`53c590f`, backlog `2026-08-07-008`): on `/community-programs`, a one-time upcoming program (no `recurrenceFreq`, has `startDatetime`) renders `.pl-card--date` — "Sep 10–13" leads in the same blue leading column the time occupies on a `/this-week` row; title/tagline center; time + format right; full date in a `.rim-sr-only` span for the link name; a year line only when the event isn't in the current year. **Datedness is derived from existing data** — no new schema field; kind (`RETREAT`/`EVENT`) is deliberately NOT the trigger (Bookmarks & Breath is a COMMUNITY_GROUP with a one-time date).
- **`Program.hideWhenPast`** (default true; additive migration `program_hide_when_past_v1`): once a one-time program's CT day has fully passed, it leaves the public listings — `/community-programs` AND the Kalyana Mitta community-groups page, via one shared rule `lib/programUtils.ts::hasConcludedOneTime` (the KM gap was a reviewer catch). Editor opt-out on the Visibility tab, rendered only for one-time programs. A past-but-kept program renders the plain card — a stale date is never showcased.
- **Auto-archive** (`b9d35af`, Jesse's call: "hiding past-dated one-time programs from the listing entirely is good"): a new daily cron `archive-concluded-programs` (09:15 UTC — after the CT day flips year-round; the 8th cron) sets `archivedAt` on concluded one-time programs honoring the same flag; the flag's semantic is now "this program retires itself." The Program Manager's Archived tab reads by recency (`archivedAt` desc). First scheduled catch: Nature Meditation KM Group (July 26, stale).
- **History survives the archive** — the fix archiving forced, plus what the reviewer found behind it: `/account/programs/[slug]` no longer 404s for a member holding a registration; the archived view drops live affordances (Join on Zoom → "This program has concluded.", pending-dana link and Cancel hidden — cancelling would have erased the member's own history view); and `/session/[slug]/enter` now refuses archived programs outright, **closing a pre-existing hole** where a hand-crafted URL could provision a real Zoom meeting for a manually archived recurring program during its old weekly window.

### Arc 2 — The member-area quality campaign (impeccable audit → fix → Jesse's field reports)

- **Shell orientation** (`6024cc4`): the member area had NO path back to the public site — and Nav.tsx's "member desktop nav" and "member mobile menu" blocks were unreachable dead code (the `member-bar` early-return). The member-bar now carries a **"Main site"** link on every member/admin/tool surface at every viewport (tool + hub pages render the bar without the account rail, so the header is the only placement that covers them — a reviewer catch that killed my rail-strip first design); on phones the bar sheds the wordmark and profile name to make room. Sidebar "Home" → **"My Home"**; the collapse toggle sits on the edge it collapses toward instead of `margin: 0 auto` (Jesse's "wonky... centered when open"); shell text 13→15px; `:focus-visible` on every shell element.
- **The account rail became a drawer on phones** (`edc6b73`, Jesse: "doesn't the /impeccable help make it mobile friendly?"): the horizontal scroll strip (labels hidden, groups expanding inline) was a desktop rail rotated sideways — replaced with the hub drawer's exact pattern and geometry (hamburger bar "My RIM" under the member-bar, 280px drawer, under-the-bar top:60px, no shadow, visibility-hidden when closed so links leave the tab order). One mobile pattern for both sibling rails. Strip CSS deleted from all three layered blocks; the drawer written once at the end of the cascade.
- **The interaction floor** (`d3403f2`): three parallel audits (hub workspace, tools chrome, member pages) found the same classes everywhere — **zero `:focus-visible` in the whole content layer** (~65 selectors now carry the ring; old `outline: none` rules lose by source order), ~20 sub-44px touch targets, 12-13px interactive text (now 14; inputs explicit 16 for iOS). Plus: hub drawer tab-order/aria-expanded parity; hub footer "Back to Home" → "My RIM"; ToolsNav gains a "My RIM" link + all back-labels renamed; Course Manager tables wrapped in scroll containers; pe-tabs got real tablist semantics; the dashboard dana chip's tooltip became visible words ("A voluntary gift — never required"); the program page's bare ↗ became a worded "Map ↗" link. Reviewer-gated twice; its six findings (specificity-dead declarations, the unwrapped lessons table, chip-note squeeze, collapsed-drawer gutter) all applied.
- **Jesse's field report #1** ("a lot is cut off"): at half-screen widths the admin table wrappers were `overflow: hidden` at desktop (their `overflow-x: auto` lived only in a mobile block) and the Programs/registrations/rotation tables had no scroll wrapper at all — `body{overflow-x:clip}` cut them silently. Fixed as one rule (`fb11aaf`): every wide table scrolls in its own container at every width. **Lesson absorbed: my own audit had documented the clipping band and I patched only the Course Manager — fix the documented class, not the instance.**
- **Jesse's field report #2** (the Hosting Hub screenshot — prose clipped mid-word, Edit reduced to "E"): `.hub-ws-content` and `.tools-content` are `width:100%` + horizontal padding with **no global border-box** — viewport+padding wide, everything clipped at the window edge. The s170 `.lr-btn` trap at the layout level. Fixed both, then a **deterministic sweep of all 98 backend `width:100%` rules** found exactly 16 live instances of the class (worst: `.adm2-content` — the whole admin member record clipped below 720px; the rotation manager's stacked panels; the account rail's group toggle 24px wider than its siblings). One grouped border-box rule (`dbe1dc0`). The sweep also inventoried ~14 dead CSS families for the next css-prune.

### Arc 3 — The home page composes (`738431f`, `5da3301`, `6460033`, `2e90c18`)

- **Alternating splits:** both image sections carried `--flip` (every image right); the page now reads right / left / right.
- **The category doors are real** (closes backlog `2026-08-07-001`): they read the live `ProgramCategory` taxonomy — Program Manager's own rows, in sortOrder — each deep-linking to a new `id={category.slug}` anchor on `/community-programs` (scroll-margin clears the sticky nav; verified landing at 124px). Empty categories get no door. Each door carries a public-voice line derived from its category's KIND ("Anyone can drop in — no registration needed · 5 offerings") — existing data, no new field. `categoryDisplayName` extracted to `lib/programUtils.ts`, shared with the listing so the one editorial rename can't drift. Heading: "Learn and practice with the support of others."
- **The doors chapter composes like the page's other chapters** (Jesse: "boring... less wide without a container"): words left (intro + a "no fees or tuition" line + See-all action), the doors stacked right, vertically centered — the split grammar instead of an intro floating over a grid. Door cards are a Light-Pampas inset (white cards on the white section were invisible; an inset, not a lifted card, so no shadow).
- **Dana joined the grammar**: the "plopped" open-prose section became the third split. Jesse picked the image — the held lotus — which I identified as "Lotus flower in hand" (Olga Nayda, Unsplash License), confirmed visually against his screenshot, downloaded at 2400w, and serve as a 1600w/62KB WebP. The many-hands photo returns to being solely the volunteer/KM/diversity hero. Copy note: my draft door line said "supported by dana" before the page introduces the word — fixed to "no fees or tuition" per the experience-before-the-name rule; the Dana chapter below does the naming.
- **Images, honestly:** buddga-lotus was 3744px/1.6MB for a ~640px column — now a 1600w/74KB WebP (21×). **Looking-Up-Pine-Trees (534px) and Community-Hands (900px) cannot be made sharp from the files we hold** — they serve full-bleed heroes and need higher-res re-downloads (no bigger sources exist in the site archive).
- **The hero video "dancing blocks"** (`2e90c18`): not corruption — a frame-by-frame block-artifact probe (luma gradient energy at block boundaries, every 0.4s across the 8s loop) shows both transcodes decode clean, and our file is **byte-identical (md5) to what the live Webflow site serves**, so re-extraction would change nothing. The suspect is flaky VP9 hardware decode (the hero was choosing the WebM); the MP4 (H.264, dependable everywhere) now leads the source list. Jesse to confirm by eye. The 720p-stretched-to-Retina baseline softness remains until the original pre-transcode clip is rescued from Webflow's Assets panel.

### Design decisions and why

- **`hideWhenPast` means "retires itself"** — one flag governs both the immediate read-time hide and the next-morning archive; two toggles for one lifecycle would invite drift.
- **Datedness from data shape, not category label** — `recurrenceFreq null + startDatetime` catches the community groups that carry one-time dates; kind-based triggering would have missed them.
- **One mobile drawer pattern for both rails** — the hub drawer's exact shipped geometry (under the bar, no shadow), not my first over-the-bar design; the reviewer's parity trace decided it.
- **The header owns "Main site"** — the only shell element present on every member/admin/tool/hub surface.
- **Fix the documented class, not the instance** — twice this session a defect class my own audit described stayed half-fixed until Jesse hit it in the wild.

### What this connects to

- **Program lifecycle:** `hideWhenPast` + the cron touch `/community-programs`, the KM groups page, Program Manager (Visibility tab, Archived tab, create/update API), `prisma/migrate.mjs`, `vercel.json` (8th cron), the member registration-history page, and the Zoom session enter gate. `hasConcludedOneTime` + `categoryDisplayName` live in `lib/programUtils.ts`.
- **The member shell:** Nav.tsx (member-bar), AccountSidebar (drawer), HubWorkspaceSidebar (parity fixes), ToolsNav/ToolsContext ("My RIM"), and five layered CSS blocks now capped by the interaction-floor + border-box layers at the end of `custom.css`.
- **Home page ↔ Program Manager:** the doors render the editorial taxonomy; category renames/reorders in the tool now change the home page. Home went `force-dynamic` (it reads the DB).
- **The occurrence-first grammar** now spans four surfaces: Scheduler (s167-168), `/this-week` (s170), the catalog's date-led cards, and the home doors' kind lines.

### What comes next

- **Cron's first run** (~4:15am CT): expect `[archive-concluded-programs] archived "nature-meditation-km-group"` in Vercel logs — and if those walks still run May–October, the program needs a real recurring schedule (restore is one click).
- **Jesse's eyes:** the hub/account drawers + rail toggle on his phone and desktop; the hero video dancing-blocks check on MP4.
- **Webflow asset rescue** before cancellation: the original Bodhi Leaves video (Assets panel) + higher-res pine-trees/community-hands sources; pairs with the redirect map (`2026-08-07-003`).
- **Parked with backlog entries:** in-tool links dropping `?hub=` context; the Programs tool index's missing page title; the tools-chrome hex sweep; the dead-CSS prune list.


## 2026-08-08–09 (session 171) — The optimization session: doctor pass, context diet, staleness purge, ACTIVE coordinator authority

A whole-system hygiene session, started by a Claude Code `/doctor` health check and widened by Jesse's directive: *"I think a more optimized system is better… make sure we're not breaking any of the integrity."* Everything below shipped to `main` across 9 commits, each round reviewer-gated with no blockers, `tsc`-green throughout.

### Context diet — what every future session stops paying for

- **CLAUDE.md 278 → 212 lines.** The Closing Ritual and Feature Backlog sections became project skills (`.claude/skills/closing-ritual/`, `.claude/skills/backlog/`) with one-line dispatch stubs — the full text now loads only when invoked. The design-token enumeration became a pointer to the tokens' real home in `custom.css` (the copy had already drifted from the CSS once). All Sanity content removed — see the staleness purge below. `.gitignore` gained allowlist entries so the two skills are tracked (CLAUDE.md is committed and dispatches to them by name; untracked skills would strand every other checkout).
- **UP_NEXT.md 1,856 → 177 lines (~62k → ~5.5k est. tokens).** The "Recently completed / reference" section had accreted 47 sessions of narrative back to s118, all duplicated in `session-log.md` — verified per-session before cutting. Replaced with a landmarks block. The keep-it-lean rule now lives in the closing-ritual skill (step 6) so it can't silently re-accrete.
- **Claude-side:** 9 never-used higgsfield skills disabled, 5 unused desktop-app plugins disabled, auto permission mode set as default, the Homebrew CLI upgraded 2.1.49 → 2.1.220.

### Staleness purge — the docs stop lying

- **Sanity is *fully* gone and now the docs say so.** Investigation found no `@sanity` deps and no `lib/sanity.ts` / `lib/queries.ts` — more retired than even memory claimed. Removed from CLAUDE.md (stack bullet, GROQ rules section, Key Files) and from four regions of `RIM_Stack_Reference.md` (links row, CMS row, env section, Studio/GROQ section). The one surviving rule — program slugs are `HostAssignment` join keys, permanent once assignments exist — was already in CLAUDE.md's Do Not.
- **The email-template "Sanity Studio" callout repointed to the Program Manager** — label in `EmailTemplateEditor.tsx`, seed strings, and a surgical idempotent migration (`repoint_email_template_sanity_note_to_program_manager`) that replaces only the product name inside `sanityNote` rows so any customized wording survives. Column rename queued as backlog `2026-08-08-001`.
- **`RIM_Stack_Reference.md` truth pass:** the 78-line retired session-room block, the self-hosted-droplet bullet, LiveKit env vars, cost/service rows, and the removed `rim-connect.js` Webflow-bridge rows all tombstoned; the live content embedded among them (Stripe build hardening, Editor standard, SlugField, Open Access) kept and re-verified against code. `next.config.ts` lost the webpack WASM experiments that existed only for the retired blur processor (zero WASM usage or deps remain). Verified before touching the Webflow links row that the live domain still serves `x-wf-region` — Webflow genuinely still hosts the public site.
- **Session-room CSS fully pruned:** three `css-prune.mjs` passes over **19 verified-dead prefixes** (rim-tile, rim-cb, rim-pp, gr-, vs-, rim-settings, the banners/prompts, …) — 330 dead rules + the orphaned comment region + the `rim-signal-pop` keyframe; `custom.css` 29,839 → 27,761 lines. `livekit-prefabs.css` (22.5KB vendored build, linked from nothing) deleted. Reviewer confirmed all removed rules dead-rooted with no comma-grouped live selectors; the live `sic-` sign-in styles verified intact.
- **Repo hygiene:** 7 spent working docs removed (4 April prompt/spec one-offs, the wrong-direction LiveKit-era `TRAINING_PLAN.md` + `HOSTING_HUB_READINESS.md`, and `AGENTS.md` — Codex is out of the workflow). The deliberately tombstoned docs untouched. `.claude-memory/` refreshed from a 4-month-stale snapshot to a current 48-file mirror; `PROJECT-BACKUP-AND-RESTORE.md` updated to the Zoom + Google stack; the rim-website backup dropped with that retired project. All merged branches deleted — 10 local + 15 remote; `origin/main` is now the only branch. The stranded `globals.css` removal commit (a dormant `* { box-sizing: border-box }` + Arial trap) merged; both stale worktrees removed (43MB).

### The real bug: paused coordinators kept full authority

Triaging a stranded worktree's uncommitted diff (an ACTIVE-membership fix for the since-retired Documents system) prompted a pattern audit: `lib/hubAuth.ts::isHubCoordinator` had **no status filter**, so a PAUSED/INACTIVE coordinator retained every coverage mutation — and the class was bigger than first scoped: **17 callsites, not 6**, including `isSpaceLead` in `lib/googleFiles.ts` (a paused coordinator could approve file deletions). Fixed at the choke point: the helper now requires `status: "ACTIVE"`; the Scheduler page's inline `isManager` check carries the same filter so UI and route gates agree. All 17 callsites individually verified (plus adversarially reviewed) as mutation/authority gates — visibility paths (`canAccessHubScheduler`, standing-assignment reads) deliberately untouched, so a paused member still sees their team's board. Matches the existing ACTIVE gates in `getEffectiveHostingCapability` and the `/admin/hubs` edit page. One deliberate nuance: `isSpaceLead` also scopes the pending-removals *list*, so a paused coordinator's review queue narrows to their own requests. The content-layer twin (`effectiveCoordinator` — trash, moderation, member management) was **deliberately not changed**: that's a policy call, recorded as backlog `2026-08-08-005`.

### Design decisions and why

- **Rituals became skills, but the Session Opening stayed in CLAUDE.md** — a lazily-loaded skill might not be in context at the moment the opening ritual must fire; always-loaded earns its cost exactly there.
- **Backlog categories renamed** (`Programs & Sanity` → `Programs`, `LiveKit / Session Room` → `Sessions & Zoom`); 8 LiveKit-room feature requests marked `rejected` with a session-159 note rather than deleted — history stays queryable. Two pre-existing duplicate ids renumbered.
- **Landmarks, not a second log** — UP_NEXT's job is orientation; `session-log.md` is the archive. Codified in the skill.

### What this connects to

- `lib/hubAuth.ts` gates the Scheduler (`/tools/schedule`), all `/api/host/*` coverage + standing-assignment routes, and Google Files lead authority (`isSpaceLead` → governed deletion, `canManageFileMeta`) — the ACTIVE rule now applies across all of them. Docs updated: `RIM_Scheduler.md`, `RIM_Hub_Engineering.md`, `RIM_System_Architecture.md`, `FEATURES.md`.
- The sanityNote migration runs on deploy and touches the managed EmailTemplate rows' editor callout at `/admin/emails/[slug]`.
- The closing-ritual + backlog skills are now the operative form of two CLAUDE.md contracts; the memory-backup mirror (`.claude-memory/`) is wired into closing as step 7c.
- Memory corrected: `livekit-self-hosted` now records the s161 droplet destruction (it had claimed the droplet lived on hosting OnlyOffice).

### What comes next

- **Jesse's dashboard chores:** verify the 5 plugins show disabled in `/plugin`; remove lingering `LIVEKIT_*` / `SANITY_*` Vercel env vars; delete Sanity project `xxgvfpjf` when ready (export first if anything's worth keeping).
- **Deploy check:** the sanityNote migration's per-template log lines in the Vercel build output.
- **Backlog:** `2026-08-08-001` (sanityNote column rename), `-004` (drop the orphaned `SessionChatMessage` table), `-005` (the `effectiveCoordinator` status policy question — Jesse's call).

---

## 2026-08-07 (session 170) — The two public listing pages made one system: one hero, one card, one spine

Jesse opened with a ChatGPT critique of `/community-programs` and `/this-week` and asked for my own read plus an `/impeccable` run. The session ended with both pages on a single grammar, four defects fixed that neither the critique nor a code reading had found, and the membership block rewritten in RIM's own dana language. **10 commits, all on `main`, deployed, `tsc`-green.** Authority: `RIM_Public_Pages.md`. No schema, migration, dependency, env var, cron, or email-template change.

### The critique, graded

ChatGPT's thesis — the two pages are two systems doing one job — was right, and it was verifiable rather than a matter of taste. But roughly a third of its recommendations described work already shipped (the hero CTA it wanted was on line 44; the cards were already fully clickable), and a third were data or editorial rather than code (the category headings it wanted restructured are `ProgramCategory` rows editable at `/tools/programs/categories`). Two of its suggestions were declined with reasons: stripping the `/this-week` hero would have made it the only public page without one, deepening the inconsistency it was diagnosing; and filter chips over 12 programs in 4 groups cost more attention than they save.

It also missed the two worst defects, both of which only measurement found.

### What measurement found that reading did not

**A live P0 on every phone.** `.lr-btn` overhung its card by exactly 44px at ≤430px — `width: 100%` plus 44px of horizontal padding on a `content-box` control, with no global border-box reset since `webflow.css` stopped loading. The primary action on all 17 schedule rows was visibly clipped. Fixed at the control, so `ListRow` and the Scheduler inherit it; above 430px the button has no set width, so `border-box` is a no-op there.

**Two WCAG AA failures in the `/this-week` hero**, measured with `sharp` against the actual photograph at p99 luminance in the copy column: subtitle **2.80:1** and week nav **2.96:1**, both needing 4.5. The copy column of `Bodhi-Leaves.jpg` measures **p99 0.992** — brighter than the home hero's documented 0.971. Session 169's hardening pass never reached this page.

**`/community-programs` was failing too**, at 4.29:1 — `.pl-hero` still carried the pre-hardening 88% body tier. This is the reason the fold below matters: `pp-hero` had been written as a *copy* of `pl-hero`, so only one of the two ever received the session-169 contrast floors.

**A correction worth recording.** My first contrast pass reported the eyebrow failing at 3.76:1 and I was about to darken the shared gradient. That was an artifact of sampling element boxes — the eyebrow element spans the full container while its text is ~176px wide. Re-measured on real glyph extents via `Range.getClientRects()`, it is **8.08:1**. Three darker candidate gradients were tested and all three rejected: they over-darken the photograph to fix nothing. **The committed gradient plus the committed tiers were already correct.** Measure the glyphs, not the box.

### The consolidation

- **One hero.** `.pl-hero` deleted; both listing pages use `.pp-hero`. This is what fixed `/community-programs`' contrast — the fold *was* the fix.
- **One card.** `/this-week` moved off `.lr-row` (a member-area component it had borrowed, shared with `HubScheduleClient`) onto `.pl-card--time`, a leading-time variant. It also referenced `.pl-list`, a class with **zero rules** — renamed to `.pl-grid` in the session-148 redesign, never updated here; the rows had spacing only because `.lr-row` carries `margin-bottom: 20px`.
- **17 identical "Learn More" links** became descriptive per-row names (WCAG 2.4.4). The day is carried visually-hidden via a new `.rim-sr-only`, because a daily program's name otherwise repeats seven times in a links list.
- **Today is findable.** Inverted date block, a "Today" pill, and a `#today` jump in the hero. It had been ~2,360px down on desktop, ~2,940px on mobile — on a page whose entire job is "what can I attend now."

### The spine — Jesse's "some content is narrower than others"

Measured at 1280, one page had **four different left edges**: hero copy at 110 (the container's own text edge), every block below centred inside the 1140 container at 190, then each panel's padding pushing its interior text to 214, 222 and 238. The hero read as a narrow orphan column above a wider one.

`.pl-cat` and `.pl-membership` now left-align to the container's text edge instead of centring inside it — the content moved to meet the hero, which left every other public hero (home, donate, Kalyana Mitta) exactly where it was. Later in the session Jesse asked for rows to run the full container width, so the 900px cap and its `--pp-column` token were removed entirely. **One left edge, verified at 360 / 768 / 1280 on both pages.**

`/this-week`'s footer note and empty state were the only centred elements on a page where everything else shared a left edge; both moved onto the spine.

### Hierarchy inside the element

Jesse: *"it's a little boring and without proper hierarchy within each element."* Three causes, all measurable:

1. **The cadence was flat** — 60 between chapters / 18 under a heading / 14 between cards, so a heading sat barely further from its own cards than the cards sat from each other. Ended at **96 / 36 / 24** (72 / 28 / 20 on phones) after Jesse asked for 20–30px between items; raising only the card gap would have re-flattened the groups.
2. **The card's decision fact was its quietest element** — the schedule was 13px muted, ranked below the marketing tagline. Now 15px in full text colour, with the tagline taking the muted tone.
3. **The card wasted 400px.** Only the render showed this: the card held the 900px column but its copy ran out around x=566, leaving the arrow floating unattached at the far right. Title and tagline now hold the left; **schedule and format hold their own right column**. Below 860px the right column drops under the title and returns to the left edge.

**No decoration was added.** The obvious move for differentiating four category groups is chapter eyebrows, and that is tombstoned — built, shipped and reverted in session 148, where a sparse version of a rich pattern read as cheap. The four categories are genuinely peer content; uniformity there is correct.

### Copy — and a block built then removed

A `.pp-notice` orientation block was added above the listings, replacing a redundant "Come as you are." section that was a third opening statement and put an `h2` in the same type slot as the category headings. **Jesse then asked for the notice gone**, and it was removed. The `h2` de-duplication survives; the page now has four category headings plus the membership block and nothing competing with them.

**"Good first visit" was never data.** A hardcoded `Set` of two slugs in the page file — no `Program` column, nothing in Sanity, nothing to undo in Program Manager. It shipped from a mockup and picked its two programs arbitrarily. Removed with the `.pl-card__starter` rule it was the only user of. (It had been flagged as a drift hazard in the audit for exactly this reason.)

**"Membership is free." → the dana framing.** Jesse: *"I don't like how it says 'free' at the end. It should reiterate our spirit of Dana."* He was right that it framed RIM as a pay-for-service model that happens to cost nothing. Rewritten via `/how-jesse-writes` from the language already on the home page and `/donate`:

> **We don't charge for the teachings.**
> RIM asks no fees or tuition. The center is held by the people who practice here, each giving as they are able. That giving is called **dana**. An account is how you join us on Zoom and register for what's coming.

"dana" is named *after* the giving is described, per the guide's experience-before-the-name rule, and links to `/donate#dana-at-rim`. **Worth recording: the guide's grep script returned zero hits on the incumbent copy as well as the new copy.** The script is not what separated them — the case was the architecture check, and it was stated in the open so it could be overruled.

### The stuck deploy

Commit `1cc8ab6` sat on `origin/main` for ~15 minutes without reaching production, against a ~40s norm. Ruled out as a code problem: `npx next build` compiled all routes clean locally, postcss parsed `custom.css` at 6,200 rules, and a cache-busted request returned `x-vercel-cache: MISS` / `age: 0`, proving the origin itself was serving the old build. An empty retrigger commit deployed in 40 seconds. **A stuck Vercel build, not a defect** — but the reflex worth keeping is that a deploy which does not land is diagnosed before it is explained, and never reported as shipped.

### What this connects to

- **`/programs/[slug]`** — every card's destination; its `pg-` language is what both listings must feel continuous with. The dana copy's factual claim (online needs an account, in-person does not) was verified in that page's CTA branches rather than taken from the docs.
- **`/donate`** — now linked from the membership block at its `#dana-at-rim` anchor.
- **`ListRow` + `HubScheduleClient`** — share `.lr-btn`; both inherit the border-box fix. `/this-week` no longer depends on either.
- **`ProgramCategory`** — supplies the four category headings; the taxonomy is editorial, changed in Program Manager, not in code.
- **Home-page category doors** (backlog `2026-08-07-001`) — still blocked on `id` anchors for `.pl-cat`, which this work did not add.
- **The `pp-` grammar** — `pl-hero` folded into it; `pp-btn--onblue-ghost` and `.rim-sr-only` added.

### What comes next

Dated events (Retreats) still render like weekly drop-ins with no date — the strongest remaining hierarchy move, and real information rather than decoration. The nav's own touch targets are under 44px. And two programs carry a bad `endDatetime` (10:30 PM for a morning class) that only Jesse can fix in Program Manager.

---

## 2026-08-07 (session 169) — The live Webflow site cloned, the static public pages rebuilt in RIM's own system, and the design system installed as a skill

The session began with a cost problem, not a design one: Jesse is paying for several services for the old Webflow site and wanted the front-facing pages brought into RIM Next so the domain can move. It ended with eight pages rebuilt and shipped to `main`, an offline archive of the entire Webflow site, and the RIM design system installed as a project skill. Everything is deployed and `tsc`-green.

### The archive — `~/Sites/rim-site-archive/`

A complete offline clone of `www.rootedinmindfulness.org`: **317 pages, 158 assets, 84 MB**, captured from the published sitemap with a dependency-free Python script (kept as `capture.py` alongside it). Internal links and Webflow-CDN assets are rewritten to local relative paths; all 9,187 local references were verified to resolve. **This is the only copy of those assets outside Webflow** — the CDN dies with the plan.

The capture surfaced two services nobody had inventoried: **Captivate.fm** hosts ~26 lesson audio embeds on the old site (RIM Next uses its own Vercel Blob audio, so the app does not depend on it — but the source MP3s need their own export if Captivate is cancelled), and **Flodesk** is load-bearing, since `/api/subscribe` posts to it.

### What was rebuilt

Eight static front-facing pages: home, donate, diversity, volunteer, volunteer-thanks, and the three Kalyana Mitta pages.

**The defect that made this necessary.** These pages were still wearing Webflow-era class names — `.section-19`, `.main-container`, `.grid-halves-3`, `.diversity-content-box`, `.bg-accent-2`, `.milestone-circle`, `.w-richtext`. Checked against the *deployed* stylesheet, not just local: **every one of them has zero rules**. Only `custom.css` is linked; `rim.webflow.css` and `webflow.css` sit unused in `public/css/`. The pages were rendering as bare document flow — a 1260px or full-bleed column with no cards, panels, or rhythm. This was live.

**The `pp-` public-page grammar** (~1,060 lines appended to `custom.css`, a pure append — zero existing rules modified) now carries them: hero (photo / video / flat variants), split, intro, prose, cards, row cards, panel, notice, form, quote, disclosure, give cards, statement, numbered timeline, closing. It deliberately extends the shipped `pl-`/`pg-` language rather than starting a second system.

### The lesson of the session: build from the rendering, not the text

The first pass extracted *text* from the archive and invented the composition around it. Jesse rejected the donate page — "it doesn't look like the design that I currently have" — and he was right. The correction was to **measure the live page** at 1280 with `getBoundingClientRect` and match the numbers:

| | live | first pass | after |
|---|---|---|---|
| hero columns | 560/560 | 380/616 | equal halves |
| dana card | 585 wide, 54px heading | 820 wide, 38px | exact |
| blue note | 720, centred | ~700, left | exact |
| timeline card | 530 | 490 | 530 |
| section rhythm | 130/120/140 | 96/68/68 | matched |

The same error had been made on the home hero (built dark and left-aligned; live is light, centred, navy) and on the split order.

### Design decisions

- **The home hero is dark, by Jesse's choice and against the live site.** Shown both treatments at a temporary `/hero-compare` route, he picked the dark one. This is a deliberate departure from fidelity, recorded because it will look like a mistake to a future reader comparing the two.
- **The white "paper panel" hero is retired.** RIM heroes already carry a featured floating object on some pages (the program-detail quote card); a second white rectangle on the same image was the same busyness that retired the floating nav pill.
- **The hardcoded "This Week at RIM" table was dropped from home** — seven hand-typed rows that would drift from real program data. The live site does not have it and `/this-week` does it properly.
- **KM community groups now list real Programs** from the Community Groups category instead of a hardcoded list.
- **The donate accordion became native `<details>`/`<summary>`** — keyboard-operable, no client component, no ARIA to get wrong. `DonateAccordions.tsx` deleted.
- **Lorem ipsum was removed from the volunteer page.** It is still live on the Webflow site today.

### The `/impeccable audit` and hardening pass

Scored **16/20**. The detector found **0 findings** in the authored `pp-` block; all 57 in `custom.css` are pre-existing legacy. Then contrast was measured with `sharp` against the real photographs, sampling the band the copy actually occupies:

- **Donate hero failed** — Sky Heavenly carries bright cloud through the copy column (p99 luminance 0.459); title 3.76, body 3.43. Flat scrim 0.50 → 0.70 puts them at 5.59 / 5.36.
- **Home hero failed worse** — the bodhi leaves are backlit to p99 0.971, effectively white. It inherits the shared photographic scrim, which is tuned for Community-Hands (p99 0.457). Title 2.77 → 5.85 with a dedicated `pp-hero--video` scrim that holds a dark plateau across the copy then releases so the leaves on the right stay bright.
- **Tiers moved** — eyebrow 70% → 85% (was 4.00 at 11px, needs 4.5), body 88% → 95% (88% cannot reach 4.5 over near-white footage at any scrim that leaves the image legible).
- **The donation widgets had no fallback.** Three Givebutter custom elements, one deferred script, nothing else. Donation widgets are routinely blocked by ad blockers, and RIM is 100% donation-funded — the page's entire purpose could fail silently. Added a standing phone/email line plus `noscript`.
- **Reduced motion destroyed the imagery** — the old rule hid the video and the home hero set no background image, so those users got a flat colour band. The poster now rides on `--pp-hero-image`.

**Craft-floor conflict, resolved in RIM's favour.** The `impeccable` skill bans eyebrows outright ("no brief earns it back"). RIM's committed visual world uses them throughout, and craft-floor's own opening defers to the committed world. Kept; their contrast fixed instead.

### The design system skill

Jesse generated a design system with Claude Design and asked how to install it. It is an **extraction from this codebase**, not a new design — its readme names `rim-next/` as the source and `custom.css` as the single source of truth. Its tokens were verified to match the live stylesheet exactly.

Installed at `.claude/skills/rim-design/`, invocable as `/rim-design`. Two things were done to it:

1. **Corrected the hero it teaches.** The package predated this session and documented the retired paper panel with "A place to practice, together." Installing it unchanged would have taught future sessions to rebuild exactly what Jesse rejected. `HeroPanel.jsx` rewritten plus its `.d.ts`, `.prompt.md`, the readme's Transparency/Protection/Backgrounds paragraphs, two templates, the UI kit, and the type specimen. `_ds_bundle.js` is a prebuilt artifact that still holds the old component — flagged stale rather than hand-edited.
2. **Versioned and de-duplicated.** `.claude/` was gitignored, which would have left the system untracked and free to drift from the CSS it documents. A narrow exception was added for this skill only. Its `assets/` duplicated files already in `public/`, so the 32 byte-identical ones became relative symlinks (matched by content hash, catching renames like `buddha-lotus.jpeg` → `buddga-lotus-unsplash.jpg`). 6.1 MB de-duplicated; the skill is 992K.

### What this connects to

- **`RIM_Public_Pages.md`** gains the `pp-` grammar; it is the authority for all of it.
- **`/community-programs` and `/programs/[slug]`** supplied the visual language (`pl-`/`pg-`) these pages extend. They were not modified.
- **`Nav.tsx` needed no work** — it already carries the live menu's structure and copy word-for-word, including the Get Involved dropdown descriptions. The only differences are the deliberate session-148 decisions.
- **The footer** already carried the live "Stay Connected" newsletter (Flodesk via `/api/subscribe`) and the live contact block, so home needed no duplicate band.
- **`Program` / `ProgramCategory`** are read by the KM groups page.
- **No hub, role, permission, schema, dependency, env, or email-template change.** No member, admin, tool, API, or session surface touched — verified by diff before merging, because production is in daily use by members.

### Production data uncovered

Reading the deployed site (production Neon is unreachable from Jesse's machine — `P1001`): **12 programs** across 4 categories, **1 public teacher profile** (jesse-foy), and **1 course on the public catalog — `test-course`**. Webflow has 4 real courses and 57 `/team/` pages. Also: the live home's four category doors match the real taxonomy on only **one of four** — it advertises "Classes & Courses", which is not a category, and omits "Silent Meditation Drop-Ins", which carries 10 of this week's 17 occurrences.

### What comes next

Optimizing the home page design is the next session. The immediate candidate is the four category doors: they are the weakest section on the page (four identical cards carrying only a title, three pointing at the same URL, and the taxonomy is stale). The catalog's `.pl-cat` sections have no `id`, so category links cannot work until anchors exist.

## 2026-07-17 (sessions 167–168) — Universal Space Home and app contract, clear Updates, real navigation collapse, and occurrence-first scheduling

This was one sustained design-and-implementation run across the entire member Space experience. It began with a question about whether every team needed a custom-built hub, established a universal Space plus installable-app architecture, and then refined the navigation, dashboard, Scheduler, and Updates surfaces against production screenshots. A series of implementation commits landed on `main`, plus a temporary plain-English team guide that Jesse downloaded and then asked to remove from the repository. The final state is `tsc`-green, lint-clean, CSS-brace-balanced, and pushed for Vercel's automatic deployment.

### Built + shipped

- **One universal Space Home.** Every Space now uses the same `HubHomeClient`: greeting/state sentence, genuine first-visit welcome, a short personal-attention list, pinned conversations, app contributions, and coordinator-editable welcome/orientation. The old hosting-only Home fork was retired. Passive chronological history no longer duplicates onto Home; it belongs in Updates.
- **Apps became the only deliberate modifier.** A Space may have zero, one, or several apps. `lib/toolRegistry.ts` declares each registered app's semantic icon, compatibility (`multi-space` or restricted primary Space), primary eligibility, and Home/Updates/attention promises. The exhaustive providers in `lib/hubApps.ts` fulfill those promises. Exactly one enabled registered app leads Home when apps are present; supporting apps stay compact; custom links remain navigation only. `HubAppLink.isPrimary` is protected by an additive migration + partial unique index. Admin create/edit validates compatibility and commits app replacement with the Space update in one transaction.
- **Source-aware Updates and durable attention.** `lib/hubActivity.ts` now produces one hub-scoped stream from Conversations, visible Google Files activity, member joins, and installed-app providers. Every item carries source + kind. Filters are **All / Recent / For me**; Recent is always the rolling previous seven days, so opening the page or clicking an item cannot make it disappear. The earlier `activitySeenAt` read boundary and rail dot were retired. Home attention now accepts only app-owned unresolved state (currently open Scheduler coverage), while passive personally relevant history remains available under For me.
- **A Scheduler-style Updates organizer.** The View menu now offers **Date and time** (default chronology), **All categories** (grouped), then every exact category active in that Space—enabled core sections plus installed Updates-capable apps—in alphabetical order. Exact-category filtering happens on the server before pagination, so Load more remains complete. The dropdown scrolls as new apps expand the list.
- **Navigation that truly saves space.** The account rail and Space rail now collapse to a real narrow icon rail rather than merely hiding labels inside a full-width column. Identity and every destination use distinct semantic icons. Long team lists scroll instead of being cut off. On phones, both rails remain full labeled drawers; compact desktop state is never reused as the mobile navigation.
- **Member dashboard surface fixes.** Teams remain reachable in the account rail, and the Coming up list uses a white working surface against the warm page ground so program rows read as real objects instead of disappearing into the background.
- **Occurrence-first Scheduler design.** Across the Scheduler, rotation projections/saved confirmations, `/this-week`, and the cross-hub staffing page, dated sessions lead with one calendar-style date/time block followed by program, coverage state, and next action. Time is no longer orphaned below the date tile. Single-slot coordinator actions sit inside **Manage coverage**; greeter/multi-claim rendering remains its own community-of-people model. Cards are unified, touch targets remain at least 44px, and decorative header dividers were removed where spacing already establishes the section.
- **The dated Schedule is now the sole member-facing assignment summary.** The redundant **Your rotations** card above Scheduler-enabled Spaces was removed across every hub. Rotation rules and coordinator management remain in the Rotations tab, while members see the resulting dated assignments directly in Schedule. Its two display-only database reads, client props/helpers, and dead CSS were removed with it.
- **Documentation for the team.** A plain-English guide to Spaces, Home, Updates, and apps was created for Jesse to download, then deleted from the repository as requested so GitHub does not carry a redundant team handout.

### Decisions and why

- **A Space is stable infrastructure; an app is optional capability.** Creating a new team should not require Jesse, Codex, or Claude to build a new hub variant. Configure the universal Space, install a compatible app only when the team needs one, and let the registry/provider contract integrate it consistently.
- **Multiple apps are valid, but Home still has one lead.** Supporting apps may coexist without competing for the user's first attention. This keeps the model extensible without making the Home page feel like an application marketplace.
- **Attention is not activity.** Home answers “what needs me?” Updates answers “what changed?” App-owned unresolved state stays separate from the Space-owned rendering; passive history does not create unread bookkeeping.
- **Organizing and filtering are different axes.** All / Recent / For me expresses time/relevance; Date and time / All categories / exact category expresses arrangement or source. Keeping those controls distinct makes the stream predictable.
- **Calendar hierarchy is a reusable grammar, not decoration.** Date and time belong together because they orient the volunteer to one occurrence. It applies to dated session lists, not to every timestamp or recurring-rule editor.
- **Dividers are functional, not habitual.** Use a line only when it clarifies a boundary—such as separating general View choices from exact categories inside a dropdown—not automatically beneath every heading.

### Connections

- **Space architecture:** `Hub`, `HubMember`, `HubAppLink`, the hub admin routes/form, `HubHomeClient`, `HubWorkspaceSidebar`, `lib/toolRegistry.ts`, `lib/hubApps.ts`, `lib/hubActivity.ts`, and `lib/hubContext.ts`.
- **Core Space modules:** Conversations subscriptions, Google Files audit/meta visibility, Members, Trash, and stateless seven-day Recent Updates.
- **Tools:** Scheduler is the first fully multi-Space provider; Program Manager and Course Manager remain primary-Space restricted until their reads/writes/notifications are genuinely portable.
- **Scheduler ecosystem:** Schedule + Rotations tabs, hub-specific coverage language, single-slot vs multi-claim behavior, `/this-week`, and cross-hub program staffing.
- **Member shell:** account dashboard, account rail, Space rail, mobile drawers, and semantic tool/navigation icons.

### Closing audits

- **Hub routing layers:** capability/access continues through the resolved Space and installed registered app; Scheduler Home/Updates/attention queries filter by the active `hubSlug`; UI/list queries use the resolved `hubId`/`hubSlug`; no changed email callsite or email URL exists in this slice, so recipient-pool and email-URL layers are N/A. No new `host-team` shortcut was introduced.
- **Email Template Gate:** no email sender or template was added or changed. The earlier `hub_activity_seen_v1` column remains inert for migration safety; `add_primary_to_hub_app_links` remains active.
- **Editor registry:** the live `hub-welcome` and `hub-home` Message placements remain the same editor type; only their shared Home placement/rendering changed. Native hub-document conversation documentation is marked retired.
- **Backlog:** no new item. All concerns raised in this run were implemented; existing deferred app portability and Google Files items remain in `data/backlog.json`.
- **Stack:** no dependency, environment variable, service, cron, or email-template change. `HubAppLink.isPrimary` remains active; nullable `HubMember.activitySeenAt` is retained only as a migration-safe legacy column.

### What comes next

There is no half-built code. The next concrete step is a calm signed-in production review of one ordinary Space and each Scheduler mode: desktop expanded/collapsed rail, phone drawer, Home with/without a primary app, Updates in Date and time / All categories / one exact category, and single-slot plus greeter cards. Any follow-up should be a screenshot-specific correction, not another global redesign layer.

### Behavior-memory candidates — awaiting Jesse's confirmation

1. **Mirror an existing control end-to-end when Jesse names it as the model.** “Like the Scheduler dropdown” means mirror the interaction hierarchy, live option source, selected-state behavior, and pagination semantics—not merely its pill styling.
2. **Divider lines must earn a structural job.** Do not place rules automatically beneath headings when whitespace, type, and the following card already make the boundary clear; retain them only where they genuinely separate choices or regions.

## 2026-07-16 (session 166) — Google Files fine-tuning: the file detail page (draft, attribution, conversation), Community Space retired, governed deletion, Basecamp notifications

A co-created refinement pass on the now-Google file system. Started as Jesse's "a few issues to address," explored each as a design conversation, then built the agreed shape. **11 feature commits on `main`, all deployed, `tsc`-green + reviewer-gated each; two migrations run.** Authority: `RIM_GoogleWorkspace.md`.

### Built + shipped (in order)

- **The per-file state layer + file detail page (3 slices).**
  - *Slice 1 (`b2b54f1`):* new `GoogleFileMeta` (sparse, loose `googleFileId` key — no FK to a Drive file RIM doesn't own; like `GoogleFileAudit`). Carries **creator attribution** + a **draft ("held") state**. Migration `google_file_meta_v1` **backfills creator from the earliest `create-*`/`upload` audit row** so existing files show a real "Created by" immediately. Draft is **opt-out**: documents created through RIM are born held (private to the creator until "Share with the Space"); folders/uploads are shared. `buildFileRows` filters held files from the listing (creator + GT/ADMIN see own); the Finder gained a "Your drafts" section + a Share pill + Hold/Share in the ⋯ menu. Attribution replaced Google's anonymous "modified by" in the row; a file with no record reads "Added directly in Google Drive," never the service-account.
  - *Slice 2 (`a262066`):* the **universal file detail page** `/account/files/[fileId]` — every file (except folders) opens here instead of dumping raw bytes in a tab. **Fidelity-aware rendering** (the fork Jesse chose): a *shared* Google Doc/Sheet/Slides embeds Google's own `/preview` iframe (mints an anyone-with-link **reader** — lighter than the editor mint, cross-site-guarded); a *draft* Doc uses RIM's calm HTML export (no mint — stays private); PDF/image/audio/video embed off the stream route; other Google types → an "open in Google" panel. `FileDetailActions` (client) carries attribution + "Change creator" picker, the draft toggle, and open/download. New read gate `authorizeFileRead` enforces held (a hidden draft 404s for non-creator/non-moderator). Old `/doc/[id]` → redirect.
  - *Slice 3 (`3ccd1e2`):* **conversation per file** — a dedicated `FileComment` model (NOT `HubConversationThread`: that's hub-scoped with a non-null `hubId` and feeds the hub Conversations list; a file comment had to work uniformly + never leak into that feed — a mid-build deviation from the map, flagged to Jesse). Plain-text comments, 5-emoji reactions, delete-own (leads moderate). `FileConversation` panel on the detail page.
- **Two CSS fixes (`cb7cd1f`, `5ac2750`, `58ca201`).** The detail embed frame (clip to radius, drop the box-in-a-box); the conversation width aligned to the detail content; and the **systematic one** — restored a `box-sizing: border-box` reset for form controls. Root cause: `webflow.css` (which carried the global `* { box-sizing: border-box }`) is no longer loaded (Webflow retirement), so `width:100%` fields overflowed their padded containers. This was the recurring "text box overhangs its card" Jesse had seen in multiple places.
- **Community Space retired — Phase 1 (`0d141f9`, backlog `baedc23`).** Jesse reconsidered the open, ownerless commons (it fit nothing in the new governance model — no lead to approve removals, "notify everyone" = the whole sangha). Inventoried every touchpoint first, then removed it in three layers: the `openToAllMembers` **access primitive** (dropped the `canAccessHub` 3rd param + ~15 call-sites + the AccountLayout rail query + the sidebar branches), the **Google-files Community place** (`isCommunityDriveName`/`resolveCommunityDrive`/`communityPlace`/the `"community"` key; `isReservedDriveName` now guards only the Spaces container; selftest repointed to the container), and the seeded **hub row** (migration `retire_community_space_v1`, FK-safe delete). Two-phase: the `openToAllMembers` **column drop is deferred to Phase 2** (backlog `2026-07-16-001`) — old code still SELECTs it during the build-migrate window.
- **Governed deletion (`2ba2e55`).** "Remove" is now a *proposal*, not a one-tap destroy on an open system. `GoogleFileMeta` gained `pendingDeleteAt`/`pendingDeleteById` (migration `google_file_pending_delete_v1`). PATCH actions: **request-removal** (any writer proposes; the file leaves the active list), **approve-removal** (a lead → Google's own 30-day trash), **cancel-removal** (the requester or a lead). New `isSpaceLead(viewer, place)` = GT/ADMIN or the Space's coordinator — the same "final say" set as hub Trash (`canManageTrash`); `canModerateFileConversation` delegates to it. New `GET /api/files/pending` + a "Pending removal" review section in the Finder (leads Approve/Keep; requesters Cancel) + the same on the detail page.
- **Basecamp-style notifications (`46d1315`).** Default **No one**, per-post (not a subscription), email-first. Two **new email templates** — `file-shared`, `file-comment` — seeded findUnique→create (create-if-absent, so `/admin/emails` edits are never clobbered by a deploy), allocated to a new "Files & Documents" group, added to `PRE_THRESHOLD_GATED_SLUGS`. `resolveNotifyRecipients` (none/everyone/people ∩ the notifiable pool) + `sendFileSharedEmail`/`sendFileCommentEmail`. Reusable `NotifyPicker` in the comment compose + a "Notify the Space" action on the detail page. Sends via `after()`.
- **Orphan cleanups (`3191759`).** For a file deleted directly in Drive (an admin escape hatch — members have no Drive access): `authorizeFileRequest` now uses `getFileOrNull` → a permanently-gone file returns an honest 404 "This file is no longer available" (calm in-context message) instead of the transient-sounding "try again"; and a new daily cron `sweep-orphan-file-data` clears `FileComment` + `GoogleFileMeta` rows for confirmed-gone files (trashed-recoverable files + transient errors left alone; the audit log never swept). 7th cron.

### Design decisions

- **Attribution lives at RIM's layer, not Google's.** We can't set the name Google shows an anonymous editor (no API + we assign no Google accounts) — so "Created by" is RIM's own record, shown in RIM. In-Google edits stay anonymous; that's the accepted "Google is the file cabinet, RIM holds the identity" trade.
- **Draft = opt-out, born-held.** Default-visible with an explicit "Hold as draft" preserves the "drop it in the Drive and it shows up" convenience; only RIM-created documents start held. Files created directly in Drive can't be born-held (RIM wasn't in the loop).
- **Fidelity: exact-when-shared, calm-when-draft.** Google preview for shared files (fidelity Jesse wanted); RIM export for drafts (no link minted → genuinely private on Google's side too).
- **Retire Community rather than patch it.** The open commons is the one place the coordinator-led governance model can't cover; every Space is now stewarded with a real roster. This *reverses* the s165 "Community is a Space" decision.
- **Governed deletion honors "make random tapping survivable."** Remove → pending → a lead approves; the requester can cancel. Nothing hard-deletes without a deliberate second step; Google's 30-day trash is the final net after approval.
- **Notifications are per-post, not subscriptions.** RIM's hub conversations use a mailing-list model; files deliberately use the Basecamp per-post "who needs to know about *this*" — default nobody, the dharma-correct default. Retiring Community made "Everyone" always a bounded team roster.

### Connects to

Google Workspace Files (the whole system), the per-folder access gate + audit log, `canManageTrash`/`isHubCoordinator` (the lead set), `getHubNotificationRecipients` + the pre-threshold gate + the Email Template Gate, hub Conversations infra (reused patterns), the hub access door (`canAccessHub` — signature changed), and the s165 Community/Spaces reshape (Community reversed).

### What's next / open

- **Prod verification (Jesse):** the two migrations in the deploy log; both email templates appear in `/admin/emails` (Files & Documents group); born-held drafts + Share; the detail page renders shared docs with formatting; Remove → pending → approve/keep; comment + "Notify the Space" pickers email only the chosen people; Community gone from the rail, other Spaces' Files intact.
- **Backlog:** Phase 2 `openToAllMembers` column drop (`2026-07-16-001`); the in-app notification inbox (deferred); cross-Space sharing (`2026-07-15-001`). Two low review notes accepted as-is: the notify picker over-offers paused members (silently not emailed); the standalone /notify requires write while comment-notify needs only read (moot — the button is write-gated in the UI).

## 2026-07-16 (session 165) — Finish the Google Files reshape + cut over: Mind Maps removed, Community Space, universal provisioning, finder retired, native Documents migrated & retired

Drove the whole Google-Files finish sequence from session 164 to completion, plus a full-feature removal (Mind Maps) and the one-way-door cutover. 13 commits on `main`, all deployed, `tsc`-green throughout; the big removal was inventoried by an Explore sub-agent first. RIM's document & file system **is now Google Workspace, per-Space** — the "real filing system within the hubs" goal. Authority: `RIM_GoogleWorkspace.md`.

### Built + shipped (in order)

- **Mind Maps removed entirely (`afdf5a6` Phase 1, `56eaf35` Phase 2).** Jesse called it experimental and cut it. Phase 1 deleted all code (9 components, 2 libs, 7 API routes, 3 pages), nav links, the `sendMindMapCommentEmail` builder + `mindmap-topic-comment` gated slug, the `@xyflow/react` dependency, ~140 `.mm-` CSS rules (via `css-prune` scoped to `mm-` + a `css-cut` banner block + surgical `:is()` arm strips), the 3 Prisma models + `HubConversationThread.mindMapNodeId` + backlog items — with a **flag-guarded data cleanup deleting orphaned mind-map topic threads** (they had a real `hubId` + `documentId:null`, so they'd have surfaced as phantom threads in hub feeds — the reviewer catch). Phase 2 dropped the tables/column/index/email row and removed the original CREATE entries (the s159 two-phase discipline). **css-prune hazard fix in the same push:** removed `sic-` (live sign-in-code form) + `sg-` (live /style-guide) from `DEAD_PREFIXES` so a bulk `--apply` can't nuke live CSS.
- **Community Space + per-hub Conversations toggle (`2a0cbc5`, `46a225d`).** New `Hub.openToAllMembers` primitive (every signed-in member reaches a Space's participation surfaces without a `HubMember` row) + `Hub.conversationsEnabled` (default true; toggle in hub settings). Community seeded as an open-to-all Space, **Files-only**, Conversations turn-on-able from `/admin/hubs`. `canAccessHub(member, roles, openToAll)` threaded **only** at participation gates (entry, Files, Conversations, Activity) — roster/admin gates stay membership-only, so Members/Documents/Trash are fail-closed for an open Space; the conversation gate is `conversationsEnabled && canAccessHub(...)` (no shown-but-can't-act, no hidden-but-reachable). Community merged into every member's rail; sidebar shows a reduced tab set for an open Space.
- **Files universal (`ea93749`).** ADMIN `/api/admin/hubs/provision-all` + a "Set up files for all teams" button on `/admin/hubs` — backfills every existing hub's `RIM — Spaces` folder in one click (idempotent; skips open-to-all Spaces). New hubs already auto-provision (s164). Jesse ran it; all hubs Files-ready.
- **Upload appears without refresh (`cd044ab`).** `FilesBrowser` now **polls** the listing (~15s) until the Blob→Drive `after()` transfer lands, replacing the single 1.5s soft-reload (Jesse's bug report).
- **Global finder retired (`6ea16cb`).** `/account/files` → redirect to dashboard; the "Files" rail link + `showFiles`/`memberHasFilesAccess` plumbing removed. Files live **only** per-Space now (each hub's Files tab + Community). The shared in-app Doc reader `/account/files/doc/[id]` stays.
- **Native-docs → Google migration (`0818a02` dry-run, `a0f7292` write).** Dry-run reporter first (read-only) → revealed **49 native docs, 0 uploads, 0 links, 38 active**. Then the write path: `importHtmlAsDoc` (multipart HTML→Google Doc conversion) + `migrateDocuments` (render `body`→HTML → import into the doc's home Space folder), idempotent via `HubDocument.migratedGoogleFileId`, verify-first ("Migrate 2 (test)" then "Migrate all"). Jesse migrated all + verified fidelity in Files.
- **Native Documents retired (`a2a6e56` Phase 1, `519e7ed` Phase 2) — the one-way door.** Explore-inventoried first (not cleanly isolated). Phase 1 removed 30 files (~5,760 lines): all doc pages/APIs/components, the editor, `documentAuth`, the migration tool; cross-boundary edits stripped the doc half from the **Activity feed, hub home, Trash, Conversations feed, `hubQueries`, email, and both sidebars**; schema models/enums/`documentId`/`documentCategories` removed; redirects added; orphaned doc-conversation threads deleted (same phantom-thread fix as Mind Maps). Phase 2 dropped the `hub_documents*` tables, `documentId`/`documentCategories` columns, the doc enums, and the `hub-document-*` email rows. **Kept:** RimTiptapEditor, the rich-content renderers, `relativeDate`, `HubConversationThread` (only its doc anchor went), `HubDocNotifyPanel` (Conversations' notify selector).

### Decisions

- **Community launches Files-only, admin-toggleable** (not the full open workspace) — a 1,500-member open Conversations board is a real moderation surface, so it's opt-in from hub settings, not on by default. The `conversationsEnabled` toggle generalizes to any hub.
- **Every hub is a fully-equipped Space** — all core features + apps on by default, Files auto-provisioned on create; the admin only turns things *off*. Community is the deliberate exception (open + Files-only).
- **Everything two-phase** — every DB drop (Mind Maps, Documents) shipped as code-first / drop-second, with an interim orphaned-thread cleanup, so the live-old code never 500s during the build-time migrate window.
- **Legacy/pre-staged members** are excluded from Community by the existing `agreedToTerms` gate (they can't hold a session); notifications are safe (no member pool + pre-threshold gate + Files-only sends none) — verified, no change needed.

### Connects to

Hubs (the `openToAllMembers`/`conversationsEnabled` fields + the participation-gate threading through `canAccessHub`), the Conversations feature (feed/hubQueries/Activity/Trash all lost their doc half but keep the thread model), the account + hub sidebars, `lib/email.ts` (three senders removed), Vercel Blob + Drive (migration import), and `RIM_GoogleWorkspace.md` (now as-built through cutover). `RIM_Documents.md` and `RIM_MindMaps.md` are now historical/deleted.

### What comes next

- **CSS prune** of the orphaned `doc-`/`hub-doc-` prefixes (careful — `hub-doc-notify` is shared with Conversations).
- Deferred: cross-Space file sharing (backlog `2026-07-15-001`); the literal `Hub`→`Space` code rename; the GT self-serve "create a Space" entry point.

---

## 2026-07-15 (session 164) — Google Files: the write half + the Spaces foundation (Slice 3, admin revoke, per-folder gate, auto-provisioning)

Picked up session 163's thread (Google Workspace Files, Slices 1–2 live) and drove it through the whole **writing** half plus the access + provisioning foundation that turns "folders in a shared Drive" into genuinely walled team **Spaces**. Eight commits on `main`, all deployed, each reviewer-gated (`tsc`-green throughout). Authority remains **`RIM_GoogleWorkspace.md`**.

### Built + shipped

- **Slice 3a — write layer (`b72073b`):** create Doc/Sheet/Slides/folder, rename, move, move-to-trash. One write gate per route shape (`authorizeFileWrite` per-file, `resolveWritablePlace` per-place) so no route can forget the cross-site check / read gate / write authority. Trash is Drive's own 30-day-recoverable trash — **RIM never exposes a permanent delete**, so admins hold the final say by construction (Jesse's ask). The link-as-key mint now follows the viewer's write role (a paused/read-only member opens Google as *viewer*, not editor — a real leak the review caught). New `gf-` write CSS (New menu, ⋯ row menu, dialogs, move picker).
- **Slice 3b — uploads (`d42bfb7`):** up to 500 MB via Vercel Blob staging → a new `GoogleFileTransfer` ledger → immediate `after()` transfer into Drive + a daily cron backstop (`process-file-transfers`). Idempotent against Vercel's at-least-once upload-completed webhook (`blobPathname @unique`); authorization **re-derived at transfer time**, never trusted from enqueue. One shared MIME allowlist (`ALLOWED_UPLOAD_MIME_TYPES`) for client picker + server token. Migration `google_file_transfers_v1`. New cron in `vercel.json` (6th).
- **Admin link revoke/lockdown (`a620a49`, backlog `2026-07-14-001`):** the missing other half of link-as-key. New ADMIN `/admin/google-files` lists every file a link's been minted for (from the `google_file_audit` `mint-link` log) with a live per-file exposure check; revoke one link or lock down a whole place. Non-destructive (RIM re-mints on next legitimate open). New `lib/googleFileAdmin.ts`, `getAnyonePermission`/`revokeAnyonePermission`. Was the stated prerequisite before Files goes on any real member-facing hub.
- **Drive-creation probe (`1622a10`):** added a self-cleaning probe to `/admin/google-test` to answer *empirically* whether the service account can create Shared Drives (rather than guess from docs). Jesse ran it: **`403 userCannotCreateTeamDrives`** — a bare service account **cannot** create Shared Drives without domain-wide delegation (which we deliberately don't use). This single fact decided the storage topology (below). The Drive round-trip probe passed green — core integration confirmed on prod.
- **Menu-clip fix (`afa0e1c`):** the ⋯ row menu's third item was clipped by the list card's `overflow:hidden`; dropped the clip, rounded first/last rows instead. (Jesse spotted it live.)
- **Per-folder access gate (`5e7b103`) — the keystone.** Made authorization **subtree-aware** so multiple Spaces can safely share one Drive: a whole-drive place (Community, own-Drive hub) matches by driveId; a folder-scoped place requires the file to descend from that place's root folder — a bounded, single-parent ancestry walk that **fails closed** on cycles/depth/missing-parents/drive-root. New pure `fileWithinFolderRoot` + `resolvePlaceForFile`; `authorizeFileRequest`, `resolveParentFolder`, and the doc-reader page all route through it (raw `driveId ===` checks gone). Removed dead `resolveDriveAccess`. Proven against **18 adversarial cases** (sibling-Space access, orphans, cycles, depth, mixed-misconfig) + a security review that caught the whole-drive-shortcut trusting an unenforced invariant (now fails closed). Closes the enforcement side of backlog `2026-07-14-002`.
- **Auto-provisioning (`afbaf03`):** since the SA can't create Drives, a Space's storage is an auto-created **folder** in one shared **`RIM — Spaces`** container Drive (Jesse created it + added the SA as Manager). New hubs provision on creation (best-effort, never fails the create); existing hubs get one-click "Set up files for this team." `provisionHubSpaceStorage` is idempotent + non-clobbering. The isolation invariant is enforced on the **write path** too: the hub PATCH route rejects mapping a hub whole-drive onto a managed drive (Community or the container), and the drive picker hides both (`isReservedDriveName`). An auto-provisioned hub shows a clean "managed automatically" view instead of the drive picker.

### The decisions (this is where the session's real weight is)

- **The probe result reshaped the storage topology.** SA can't create Shared Drives → we can't auto-provision a *Drive* per Space. So: **folder-per-Space inside one shared `RIM — Spaces` container Drive**, made safe by the per-folder gate. Community + any future sensitive Space keep their **own** Drive (the hard wall); ordinary Spaces are folders. The `Hub.googleDriveId` + `googleRootFolderId` fields already express both backings — no schema change needed.
- **"Everything is a Space" + user-facing rename to "Space."** Hubs are the universal container (team / project / personal / community), Basecamp-style — apps optional, template degrades to "just a place to keep things." Agreed to call them **Spaces** in the UI while keeping `Hub` as the internal code name (a literal rename is a separate, deferred pass — no user benefit). GT + ADMIN can create Spaces "on request" (crosses the deliberate ADMIN/GT boundary — recorded in `RIM_Role_Design.md`; the GT self-serve entry point is deferred, the mechanism is ready).
- **Strict per-Space filing — no global finder (Jesse's organization insight).** Files should live *only* in their Space's context; the aggregated `/account/files` finder (pick any place, drop files anywhere) is exactly what breeds "files everywhere," the community's actual problem. Decision: **remove the global finder + the sidebar "Files" link**; files are reached only inside a Space's Files tab; provisioning is **fully automatic** (no manual enable). Community becomes a Space (open to all members) so its files have a home tab. **This reshape is designed, not yet built** — it's the top of the remaining sequence.
- **Cross-Space sharing deferred (backlog `2026-07-15-001`).** The registration-spreadsheet case (one managed file, seen by several teams) needs a deliberate share-grant layer on top of the gate — *isolation by default, explicit visible sharing as the exception* (the reborn Documents placements model). Jesse: "okay if it's not right now." Note: native docs shared across hubs will collapse to their home Space at cutover until this ships.

### Connects to

Hubs (provisioning writes hub google fields; PATCH-guard + picker-filter defend the invariant), the account sidebar + hub workspace sidebar (Files tab / the to-be-removed global link), Vercel Blob (upload staging) + a new cron, the Zoom-pattern precedent (`RIM_GoogleWorkspace.md`), and the native Documents system (to be retired at cutover). Reviewer-gated throughout; the gate got a dedicated adversarial security pass.

### What comes next (the finish line — a bounded sequence, retirement is the one-way door)

1. **Community as a Space** (open-to-all access primitive) — so its files have a home once the finder is gone.
2. **Auto-provision every existing hub** + drop the manual enable step.
3. **Remove the global `/account/files` finder + sidebar link** — files per-Space only.
4. **Migrate** native docs → per-Space Google Docs (temporary tool, dry-run first; shared docs collapse to home Space).
5. **Retire** native Documents (separate deploy; the one-way door) — **only after Jesse verifies the reshaped model on prod.**

Banked here deliberately: the reshape touches all-member navigation and step 5 is irreversible — both deserve fresh focus + Jesse's prod verification (he's set up Hosting Hub's Files to poke at) rather than a marathon tail.

---

## 2026-07-14 (session 163) — Google Workspace becomes RIM's document & file system (Slices 1–2)

Jesse brought a ChatGPT-authored spec to build a Google Workspace–backed document/file system. Rather than execute it blind, we checked it against the actual repo: RIM already had a native document system (s154–161) and a standing "don't propose Google Docs" memory from the OnlyOffice era. The spec assumed a greenfield. We reframed the whole thing around RIM's own proven pattern — **"RIM orchestrates, Zoom is the room"** → **"RIM orchestrates, Google is the file cabinet."** New authority doc: **`RIM_GoogleWorkspace.md`**.

### The decision

Google Workspace **replaces** native Tiptap documents as the primary document/file system — Jesse's call ("in use it's not working as well as we'd like… less options, cultural muscle memory, a real Mac-Finder-like filing system"). `RIM_Documents.md` itself anticipated this ("if version history, inline co-editing, office layout become a real need, evaluate that as a new capability"). What Google adds that native docs couldn't: real Docs/Sheets/Slides, live co-editing, version history, and a home for PDFs/audio/large files.

**The model (the reframe that deleted half the ChatGPT spec):** one Google Cloud **service account** is RIM's only Google identity — the equivalent of the Zoom pool seat — added as Manager to each Shared Drive. **Nobody gets a Google account** (not members, not volunteers). RIM's database *is* the permission system. This dropped managed volunteer identities, Google OAuth, Google Groups + sync, the Admin SDK, and domain-wide delegation — the most security-sensitive two-thirds of the spec — because they exist only to mirror teams into Google's permission system, which RIM doesn't need. Decided forks: **link-as-key** editing (files are anyone-with-link-editable; RIM only hands the link to authorized members — the same accepted trade as no-registration Zoom links), **Drive folders are the filing system** (live-browsed, so Drive is the source of truth and can't drift), and **Community is readable + editable by all members**.

### Built + shipped (4 commits on `main`, deployed)

- **Slice 1 — foundation (`ec6c0ed`):** server-only `lib/google/` (RS256 JWT minted with `node:crypto`, no new deps; Drive ops); `Hub.googleDriveId`/`googleRootFolderId`/`googleFilesEnabled` + `GoogleFileAudit` model (migration `google_workspace_foundation_v1`, additive); the `/admin/hubs` Drive-mapping picker (fed by live drive discovery); `/admin/google-test` diagnostic whose round-trip **probes the org sharing policy** (create doc → set anyone-with-link → delete). Diagnostic chrome shared with zoom-test (`AdminSelfTest` + `adm-diag` + `DiagPill`).
- **Google-side setup (Claude drove the Cloud Console via Chrome; Jesse held the credential steps):** `rim-workspace` project, Drive API, `rim-files@…` service account. **Env untangling:** an old Calendar-era `GOOGLE_SERVICE_ACCOUNT_EMAIL` was shadowing the new key → "Invalid JWT Signature"; fixed via the Vercel CLI (authed as Jesse), then deleted three dead Calendar env vars. Sharing policy verified compatible in-app. `RIM — Community` Shared Drive created with the SA as Manager.
- **Slice 2 — the Finder read experience (`509a234`):** the per-hub **Files** tab + system-wide `/account/files`; live folder browsing (folders-first, breadcrumbs, phone drill-down); Google Docs **read inside RIM** via sanitized HTML export (semantics + emphasis only, RIM typography); binaries streamed; editing via the gated link-as-key open route. Coexists with the native Documents tab until cutover. New `gf-` CSS.
- **Reader polish (`3cd213f`):** the rendered doc sits on a white writing surface (Jesse's review of the first live read — it was floating on the ground).
- **Full-review hardening (`caf5905`):** an 8-angle review (~30 candidates → 15 findings) + fixes — see below.

### Review + hardening (the review earned its keep twice)

Slice 1's 8-angle review confirmed 10 findings (a PATCH invariant hole where clearing a drive stranded the enabled flag; the selftest writing to an arbitrary drive if cleanup failed). Slice 2's full re-review (after a usage-limit interruption that first surfaced only the security angle) confirmed 15: **security** — Community matched by exact reserved name (not substring, so "…Community Care Team" can't leak); the edit-link mint refuses cross-site GETs (no lure-to-mint); the doc reader self-gates (layouts don't re-run on soft nav); inline streaming restricted to safe types + `nosniff` (SVG/HTML would've been stored XSS on RIM's origin). **Correctness** — retry only for idempotent methods + body-cancel (no double-create, no socket leak); stale-cache-through-a-blip; URL-driven Finder (soft nav / back-forward resync); Range passthrough for audio seeking. **Shape** — one authorization rule (`getAccessiblePlaces`) all gates derive from; audit now records hub + distinguishes first-mint from routine open; `authorizeFileRequest` centralizes the per-file gate. The fix-pass review caught a 500-instead-of-502 regression I introduced (gate outside the try) — fixed.

### What this connects to

- **Native Documents (`RIM_Documents.md`)** — the system being replaced; coexists until the Slice-4 cutover, then retires. Its filing concepts (per-hub tab + master directory two-door pattern, freshness, membership gate) carried forward.
- **Hubs** — Files is a new hub module gated on `googleFilesEnabled` + membership (hub audit: access door + list query are hub-scoped, layer 1 & 3 clean; no notifications/emails, layers 2 & 4 N/A). Touched `app/api/hubs/[slug]/nav`, `AccountLayout`, `HubWorkspaceSidebar`, `WorkspaceShell`.
- **Zoom** — the architectural sibling; `lib/zoom.ts` was the model for `lib/google/`, and the pool-seat/service-account and link-as-key/no-registration parallels are exact.
- **Auth** — unchanged (6-digit codes); the new `filesViewer` gate reuses the session's `archivedAt`/`agreedToTerms`.
- **Backlog** — `2026-07-14-001` (admin link revoke/lockdown), `2026-07-14-002` (per-folder scoping enforcement).

### What comes next

Slice 3 (Create document / New folder / Upload — the writing half), then Slice 4 (cutover: migrate the few real native docs via HTML→Doc import, retire the native editor). Before enabling Files on a real member-facing hub: build the admin revoke tooling (`2026-07-14-001`).

## 2026-07-13 (session 162) — Public program refinement + one coherent authenticated design system

Jesse asked for a full design evaluation—not a cosmetic reskin—and repeatedly tested the work against rendered production screenshots. The session established the visual foundation, refined the public Program template, rebuilt the member dashboard around the actual Zoom-entry task, then carried the same grammar through every personal, hub, admin, and operational-tool destination. Fifteen implementation commits landed on `main`; the closing commit documents the resulting system.

### Built and changed

- **Visual foundation + calibration page:** the site now uses Pampas `#F5F3F0` as the page ground, Mine Shaft `#333333` for primary text, white for working/content surfaces, and a controlled deeper/light Pampas range for separation. The unlinked `/style-guide` page holds the live palette, type, buttons, fields, cards, panels, and semantic states for future calibration.
- **Public Program template:** refined the image/blue hero, quote overlap, open editorial prose, recede Notes panel, white **Gathering details** card, state-aware action zone, and Facilitators section. Details now group schedule + time, location + directions, and dana into legible rows; the CTA remains one context-aware next step rather than another fact.
- **Program/editor contract:** every Program now requires a non-empty pull quote. ProgramEditor validates it before save and both create/update routes enforce it with `422`; create now persists `programNotes` consistently. The quote source is trimmed and optional.
- **Teacher portraits:** the Member Registry teacher section now uploads a normal public portrait through the existing Vercel Blob path. Public facilitator entries link to the teacher page and use CSS to create a circular crop; coordinators do not need to manufacture circular files. Non-public/legacy facilitator names keep the plain-text fallback.
- **Zoom entry clarity:** dashboard, member Program detail, public Program detail, and `ZoomLaunch` now use consistent Zoom-specific language. Host entry and member entry are distinguishable; the launch fallback is a calm explicit action rather than inline styling.
- **Member home rebuilt around the day:** the greeting and day frame the page; Today separates the immediate/joinable offering from later sessions; the primary row aligns time, program/context, registration, and action vertically. The redundant “Zoom is open” text was removed—the visible **Join on Zoom** action already communicates that state. “Later today” belongs above the later group, not inside an event row.
- **One authenticated shell:** the member header now spans account, admin, and tools. Personal/admin pages use `AccountLayout` and the role-aware account rail. Hub pages replace it with the hub workspace rail. A hub-launched tool preserves that rail through `?hub=`; direct tool entry uses quiet tool chrome. No page stacks two sidebars.
- **Member destinations unified:** My Programs, Library, Documents, Mind Maps, Profile, member Program detail, and document reader now share widths, typography, spacing, empty states, actions, and responsive behavior while retaining their task-specific structures.
- **Hub workspaces unified:** Home, Activity, Conversations, Documents, Mind Maps, Members, and Trash use the same calm content geometry, headings, filters, list surfaces, and mobile drawer beneath the member header.
- **Admin and tools unified:** Member Registry, households, hub administration, email manager, Zoom test, Program Manager, Course Manager, lesson surfaces, and Scheduler now use the compact authenticated type scale, responsive table containment, warm ground, quiet white working surfaces, and one action language. Semantic heading structure was corrected on the touched pages.

### Design decisions and why

- **Clear seeing before decoration.** The page must reveal identity, meaning, logistics, and next action in that order. Extra labels, redundant status copy, ornamental cards, and competing navigation were removed.
- **Balance is vertical, not centered.** Jesse's “centered” correction means time/title/status/action share a composed vertical center in a row; reading order and labels remain left-aligned. Center-aligning the content would reduce scanability.
- **One rail per context.** Account navigation answers “where am I in My RIM?”; hub navigation answers “which team am I working with?” They replace one another rather than nesting. The global member bar carries identity and exit.
- **Cards are earned.** White surfaces gather a coherent object or action set. Editorial prose remains open; secondary information recedes on the accent ground. The Program Details card is logistics, not a second hero.
- **One action per state.** A live session needs a visible Join action, not both a status declaration and a Join button. The Program page similarly buttons real actions while leaving informational states as calm text.
- **CSS crops portraits.** Source images remain useful rectangular assets; `border-radius` + `object-fit` produces the round display consistently everywhere.
- **Modern means coherent, not trendy.** RIM borrows warm restraint, strong type hierarchy, and deliberate rhythm from contemporary editorial sites without copying floating navigation, excessive motion, or marketing density that conflicts with a Dharma center.

### What this connects to

- **Program ecosystem:** public detail, ProgramEditor, create/update API validation, category/kind behavior, registration/waitlist/dana CTA states, member Program detail, teacher attribution, Zoom entry, and dashboard occurrence state.
- **Member Registry:** `TeacherProfile.photoUrl`, public-profile gating, Vercel Blob upload, and teacher/facilitator links.
- **Zoom:** no provisioning/auth behavior changed; the member-facing language now accurately distinguishes host-entry, member-entry, later, and launch-fallback states.
- **Three-layer architecture:** the Member Registry, Hubs, and Tools keep their existing boundaries while now sharing one authenticated visual hierarchy.
- **Hub model:** layout and component styling changed, but capability, recipients, list scoping, and email URL routing did not.
- **Native Documents + Mind Maps:** both master directories, readers, and per-hub modules now sit coherently in the account/hub system; their access and portable-resource models are unchanged.
- **Program/Course editors:** both now have dedicated per-tool engineering references (`RIM_ProgramEditor.md`, `RIM_CourseEditor.md`) so future UI changes must trace their full ecosystems.

### Verification

- `npx tsc --noEmit` passed for the completed implementation.
- CSS parsing/brace checks and focused diffs passed during the implementation slices.
- All implementation commits were pushed to `main`; Vercel served the new stylesheet. Authenticated visual QA was performed through Jesse's production screenshots because the browser session was not signed into the private member area.
- `npm run lint` remains an unsuitable clean gate: it reports 416 pre-existing repository/worktree issues. No new lint-specific failure was identified in this slice.
- No schema migration, dependency, environment variable, service, role, permission, or email template changed.

### Hub and email audits

- **Hub routing layer 1 — capability:** unchanged; no hub authorization helper or API gate changed.
- **Layer 2 — recipients:** unchanged; no notification recipient query changed.
- **Layer 3 — UI/list data scope:** unchanged; hub components received semantic/styling classes only and retain their existing scoped queries.
- **Layer 4 — outbound URLs:** unchanged; no email builder or URL variable changed.
- **Multi-claim / coverage semantics:** unchanged.
- **Email Template Gate:** no `sendTemplatedEmail()` callsite or template was added/changed; no seed entry was required.

### What comes next

Jesse should review a representative production page in each private family—personal, hub, admin, Program Manager, Course Manager, and Scheduler—at desktop and phone width. The next work should be specific corrections from that real content, not another broad redesign. Existing follow-ons remain separate: hardcoded old-teal cleanup (`2026-06-13-001`), the public home-page rhythm, course-landing parity, and production verification of the native Documents/Mind Maps edge cases.

## 2026-07-09 (session 161) — Native Documents made production-ready; OnlyOffice retired

Jesse chose the native RIM document system over maintaining a self-hosted office server. The decision is deliberate: RIM documents are a shared writing and filing surface, not a substitute for Google Docs or Word. The system now supports the work it actually promises, and no longer carries an unused server, callback, blobs, or confusing second editor.

### Built

- **Safe native writing:** `HubDocumentEditor` now has an optional directory summary, warns before abandoning unsaved changes, registers a browser unload guard, and sends the document revision with each native save. The PATCH route returns `409` rather than overwriting a document saved by someone else. This is explicitly single-editor collaboration: presence warns, it does not pretend to merge simultaneous edits.
- **Presence is a real permissioned signal:** the heartbeat checks that the requested document belongs to the route’s hub and that the caller can edit it. Ephemeral presence preserves `updatedAt`, so an editor never creates a false conflict against their own heartbeat.
- **Access hardening:** document-derived read/edit/share/placement gates now require ACTIVE memberships. This closes the parallel gap found during Mind Maps; author and Guiding Teacher policy remains unchanged.
- **Exports:** `/api/documents/[id]/export` is resource-gated and serves actual Markdown. A print-ready page gives every native document a dependable browser **Print / Save as PDF** path without inventing a server-side PDF engine.
- **Mobile restraint:** the document toolbar becomes horizontally scrollable at phone/tablet width rather than growing into a tall sticky control area.

### Retired

- Deleted every OnlyOffice route, editor component, JWT helper, blank-file template, creation path, and `oo-` CSS.
- `retire_onlyoffice_v1` deletes the test document rows and Blob files, removes `storageKey` and `version`, and recreates `HubDocKind` without `ONLYOFFICE`. The DDL is transactional so it can retry safely on a build failure.
- Updated the filing, architecture, stack, engineering, editor, feature, and orientation documents. `RIM_OnlyOffice.md` is now a short retirement record.

### What this connects to

- **Document filing system:** native documents retain categories, search, freshness, cross-hub placements, visibility, lifecycle, notifications, conversations, and the master directory.
- **Mind Maps:** documents now match Mind Maps’ ACTIVE-membership discipline for portable resources.
- **Infrastructure / Zoom:** the OnlyOffice deployment leaves the former LiveKit droplet with no active RIM workload; after the successful Vercel deploy, Jesse can shut it down and remove the two OnlyOffice Vercel variables.

### Next

Verify create/search, stale-save protection, Markdown, print-to-PDF, and the mobile toolbar on production. No email templates changed.

### Operations follow-through

Jesse completed the retirement after deployment: removed `ONLYOFFICE_URL` and `ONLYOFFICE_JWT_SECRET` from Vercel, destroyed the former shared DigitalOcean droplet, and removed the `docs`, `livekit`, and `livekit-turn` DNS records. RIM no longer depends on DigitalOcean.

## 2026-06-29 (session 160) — Mind Maps for the Sangha: POC → persistent map → hub module → conversation per topic (4 slices, all on `main`)

A full feature arc, co-created from a single open question ("can we build a mindful mind-map system where each topic is a conversation, or should I find one?"). Answer: **build it** — because the value isn't a mind map, it's a *spatial way into Sangha conversations*, which only pays off fused with RIM's real conversation substrate (real names, hubs, follows, notifications) rather than a generic external canvas. Built as four reviewed slices, each fast-forwarded to `main` and verified on prod (auth-gated → prod, per the preview-login gap). **One new dependency: `@xyflow/react`** (React Flow, MIT). New CSS prefix `mm-`. Authority: the new **`RIM_MindMaps.md`**.

**Why slices, and the POC-first move.** A free-form spatial canvas is the busiest, most desktop-bound UI pattern there is — the opposite of RIM's calm/mobile-first restraint. So before any schema, we shipped a **throwaway no-auth POC** (`/mindmap-preview`) with hardcoded sample nodes purely to judge the metaphor in the real aesthetic. Jesse: "looks pretty good to start with." His one note — the connections "line up funny" — drove the **floating-edge** decision. Then three real slices.

### Slice 1 — a persistent map (`66a4a91`)
`MindMap` + `MindMapNode` (parentId self-FK = the branch link; edges derived, no edge table). Canvas editor: add / rename / note / drag / **reparent via edge reconnection** (cycle-guarded) / delete (guarded, no Backspace) / **"Tidy up"** (left→right tree layout + fit) / **floating edges**. **Debounced autosave.** Standalone at `/account/mindmaps`, private to the author. `lib/mindMapAuth.ts` copied from `documentAuth.ts`. POC removed; its `mm-` CSS kept. Reviewer fixes: autosave reworked to fire on real edits only (not selection), serialized, flushed on unmount with `keepalive`; mobile touch-target/iOS-zoom/token fixes.

### Slice 2 — a portable hub module (`6ad46df`)
Jesse: "there should be a module available in all hubs, just like documents, conversations." So Mind Maps became a **built-in hub tab** (added to `HubWorkspaceSidebar`) mirroring Documents end-to-end: `MindMapPlacement` (cross-hub sharing), per-map **`editPolicy`** (his "there should be an option" — `OPEN` = collaborative canvas, anyone who can see it edits / `RESTRICTED` = author + coordinators), the **share modal** (visibility + edit option + place into hubs), and the directory reworked into hub/Community/Projects sections. Create-in-hub gates on `canAccessHub`. Reviewer fixes: access/edit gates filter memberships to **ACTIVE** (a removed member can't edit an OPEN map); the GT directory community-bucket badge reflects real visibility. Flagged the parallel **documents** ACTIVE-membership gap as a background task.

### Slice 3 — a conversation per topic (`b0ef22e`)
The heart of the idea. **One shared conversation per topic** across every hub the map lives in (Jesse's choice over a per-hub split), **notified like hub conversations** (coordinators of every map-hub auto-follow; commenters/followers get emails). Reuses the conversation **tables** behind **new routes gated on `canAccessMindMap`** (participation = view access). One thread per node (`mindMapNodeId` anchor, `@@unique`, lazy-created on first comment). Plain-text comments, 5-emoji reactions, Follow/Unfollow. New `lib/mindMapConversation.ts`. **New email template `mindmap-topic-comment`** (deep-links to the map — the hub-conv templates point at hub URLs) — seeded + `PRE_THRESHOLD`-gated, per the Email Template Gate. The editor exposes **`flushSave()`** so a brand-new topic persists before its first comment. Reviewer fixes: `commentRecipients` now also notifies COMMUNITY/non-member followers + a GT author (not just map-hub members) and excludes comms-off members; `@@unique([mindMapNodeId])` + create-race catch prevents a double thread; **all saves serialized on one in-flight chain** so `flushSave` can't race the autosave; 44px mobile touch targets.

### What this connects to
- **Documents** — the direct pattern source (portable resource, `canAccessDocument` → `canAccessMindMap`, placement/visibility, share modal, hub tab, directory sections, RSC serialization). Mind Maps is RIM's **second portable resource**.
- **Hub conversations** — Slice 3 reuses its tables + subscription/reaction mechanics + the `after()` fire-and-forget notify pattern, but map-scoped (`mindMapNodeId` mirrors the `documentId` anchor precedent).
- **Hub workspace** — Mind Maps joins the built-in module set (Home/Conversations/Documents/**Mind Maps**/Members).
- **Email** — one new template through the gate; `PRE_THRESHOLD_GATED_SLUGS` extended.

### Open / next
- **Verify on prod** across the slices (see UP_NEXT). Deferred polish (backlog `2026-06-29-*`): rich-text comments, comment-count badges, per-topic unread, comment edit/delete, real-time multiplayer.
- The **documents ACTIVE-membership gate** hardening (parallel to a Slice-2 fix) is a spawned background task / backlog item.

## 2026-06-25 (session 159) — Zoom cutover + LiveKit retired; ProgramEditor perf; volunteer host docs; Zoom scheduling integrity (Layers 1+2)

A long execution session completing the Zoom migration the s158 pilot validated, plus three follow-on threads. **~7 commits on `main`, all deployed.** No new dependencies (**6 removed**); `Program.useZoom` removed from code + schema (physical DB column drop deferred — see below); no new env; **no email templates touched.** Reviewer-gated on the two substantive arcs.

### 1. Zoom cutover + LiveKit retirement
The s158 pilot succeeded, so this cut every virtual/hybrid program over to Zoom and removed the in-browser LiveKit room. Built on a `claude/zoom-cutover` branch (5 commits), fast-forwarded to `main`.
- **Routing:** all Join links → `/session/[slug]/enter`; the legacy `/session/[slug]` is now a thin redirect there (preserving an open-access `?key=`); **guest open-access entry** added to `/enter` (valid key → forwarded into Zoom, no account, never reaches the host code); an in-person program's `/enter` bounces to its page.
- **Retirement:** deleted `components/VideoRoom.tsx` + all `components/session/*` except `ZoomLaunch.tsx`, all 9 `app/api/livekit/*`, `/admin/livekit-test`, `public/noise/*`, and **6 LiveKit/noise deps** (+144 transitive). Extracted the two SDK-free helpers (`sessionDisplayName`, `roomNameForProgram`) → `lib/sessionIdentity.ts`; renamed `lib/livekitAuth.ts` → `lib/sessionAuth.ts` (the pure host-identity resolver, now feeding the Zoom `canHost` gate). Stale `/api/livekit/*` comments in sessionAuth/programHub/sessionWindow corrected.
- **Two migration-safety catches** (both worth remembering): the adversarial reviewer found the original `add_use_zoom_to_programs` migration was still present and would **re-create the dropped column on every deploy** (removed it); then I caught that dropping the column *in the cutover deploy* would 500 the member dashboard for the ~90s build window (`migrate.mjs` runs during the build against the shared prod DB, while the old code still `SELECT`s `useZoom`). So it's **two-phase**: this deploy removed the reads + the schema field; the physical `DROP COLUMN` is deferred to a safe follow-up (backlog `2026-06-25-004`). Prisma ignores the lingering column.
- `livekitRoom` was **kept** (now a vestigial-named "this program has a session" signal read by the Scheduler/host-assignments/programs page; rename → backlog `2026-06-25-001`).

### 2. ProgramEditor perf (surgical)
The reported input lag (dropdowns needing 2–3 clicks). Hoisted the `DateTimePicker` option arrays out of the render body (they were reallocated every render) and memoized the "how this appears to visitors" compute. **Could not be verified locally** (no dev server; preview-login gap) — the structural fix (split tabs into memoized children) is deferred (backlog `2026-06-25-002`) and needs a verification path first.

### 3. Volunteer host docs (plain-speak, for the anxious non-reader)
- Refined `ZOOM_HOST_GUIDE.md` — corrected the LiveKit-era claim that a host's name auto-shows as "first + last initial"; in Zoom the host **types** their name.
- Retired `SESSION_ROOM_FOR_VOLUNTEERS.md` (180-line LiveKit-room walkthrough → a tombstone pointing to the Zoom guide).
- Gave Jesse **two new docs in chat** (he's placing them — not committed to the repo): *"Once You're Hosting"* (the in-Zoom tools: co-host, mute, spotlight, recording, end-for-all) and *"What It Means to Host at RIM"* (the relational heart of the role).
- **Flagged, not yet done:** the in-app manual chapter `host-session-room` (seeded via `migrate.mjs`, v8) is LiveKit-stale — a separate reseed + deploy task; these markdown docs are the right source for it.

### 4. Zoom scheduling integrity (Layers 1 + 2)
From Jesse hitting a conflict after editing a program's time for testing — a stale meeting collided with another program on the same seat.
- **Diagnosis:** Zoom meetings are created just-in-time per occurrence; the only conflict check is at join time against meetings that already exist; nothing re-validated on edit, and a time change orphaned the old meeting on its seat.
- **Layer 1:** the `programs-pg` PUT now tears down a program's future meetings when its start/end/recurrence changes (not just on format change) — reusing `teardownProgramMeetings`, with a new `notBefore = now + EARLY_OPEN_MIN` guard so it never deletes a meeting whose entry window is open (a host may be staging). The reviewer's S1.
- **Layer 2:** new `lib/sessionConflicts.ts` — a recurrence-aware predictive check over the next 8 weeks that flags any moment where more virtual/hybrid occurrences overlap than there are Zoom seats (`zoomSeatCount()`). The overlap window `[start, end]` mirrors the runtime seat-pick exactly, so a warning predicts what the seat-pick would actually do. Returned **non-blocking** as `seatConflicts` in the PUT/POST responses; ProgramEditor shows a dismissible amber banner after a conflicting save.
- **Deferred:** the standalone coordinator integrity *view*; the create-path warning (POST redirects, surfaces on first edit); the seat-pick advisory lock (backlog `2026-06-24-008`).

### Design decisions and why
- **Two-phase column drop** — RIM's migrate-during-build model makes a same-deploy `DROP COLUMN` of a still-read column briefly fatal to the live old deployment. Reads/schema first, physical drop later.
- **Conflict warning is non-blocking** — *clear seeing*, not a trap: the coordinator decides (reschedule, add a seat, or proceed). Capacity is the real seat count, so the warning also makes "we've outgrown 2 seats" visible.
- **Predictor matches the runtime seat-pick window exactly** — no false alarms; a warning means the seat-pick really would fail.
- **The guest link is persistent and works** — the ephemeral thing is the per-occurrence Zoom meeting; the RIM `?key=` link is the stable wrapper. Open question: does RIM use external guests (keep + clarify) or not (hide)?
- **Volunteer docs embody the platform philosophy** — plain speech, one action at a time, a calm net for someone who isn't reading carefully.

### What this connects to
- **Programs / ProgramEditor / `programs-pg`** — the save routes gained the teardown + conflict check; the editor gained the warning banner (and lost the Use-Zoom toggle).
- **The Zoom seat pool** (`lib/sessionMeeting.ts`) — the integrity layers mirror its capacity + overlap; `RIM_Zoom.md` is the authority.
- **Scheduler occurrence logic** (`scheduleUtils`) + the **session window** (`sessionWindow`) — reused by the conflict predictor.
- **OnlyOffice / the DO droplet** — survives the retirement (only the LiveKit container stops).
- **The s157 preview-login gap** — still the gating need: the perf pass and any room/editor change can't be verified before prod until it's fixed.

### What comes next
- **Jesse's ops:** stop the `livekit-server` container (keep the droplet), remove the 3 `LIVEKIT_*` env vars, set the seats' recording (audio-only + per-participant), and (separately) reseed the in-app host manual for Zoom.
- The **guest-link** keep/hide decision; the optional **integrity view**; and the deferred backlog items (column drop, `livekitRoom` rename, structural perf, advisory lock).

---

## 2026-06-24 (session 158) — Zoom migration: "RIM orchestrates, Zoom is the room" — built end-to-end, pilot-ready behind a per-program flag; LiveKit not yet retired

A strategic-decision-then-build session: evaluate whether to keep the self-hosted LiveKit room or move sessions to **Zoom**, then (decision made) build the whole integration. **~14 commits on `main`, all deployed.** New service (Zoom, via a Server-to-Server OAuth app), 6 new env vars, 1 new model + 2 new Program columns, 4 idempotent additive migrations. No email templates touched. Reviewer-gated throughout. New per-tool reference **`RIM_Zoom.md`**.

### The decision (a reversal of session 120)
Jesse asked for a final call: keep LiveKit or move to Zoom (community familiarity + reliability). I produced a decision spec (3 Zoom models scored against his criteria) after verifying Zoom nonprofit pricing + the API mechanics from live sources. The unlocking insight: **only the media layer (LiveKit-in-browser) was the pain; RIM's orchestration layer was "almost the dream."** Decision (Jesse confirmed wholeheartedly): **RIM keeps orchestration; Zoom becomes the room.** This **reverses the session-120 "browser LiveKit is the committed architecture"** stand — superseded in `RIM_SessionRoom.md` + the `livekit-self-hosted` memory. Full spec in this entry's design record (the conversation).

### Account model
One RIM Zoom org account (owner `jesse@`, nonprofit discount) + **two licensed Pro pool seats** (`zoom.host@` / `zoom.host2@` → 2 concurrent meetings) + a **Server-to-Server OAuth app** ("RIM Sessions"). I drove the app creation + scopes in the Zoom Marketplace via the Chrome extension; Jesse added the env vars + bought the seats. Verified live via a new `/admin/zoom-test` diagnostic (connection + both seats Licensed/active + a create→fresh-link→registrant→delete round-trip + a DB-orchestration round-trip).

### What got built (the slices)
- **Slice 0/1 — foundation:** `lib/zoom.ts` (cached S2S token + REST helper + meeting primitives) + the `/admin/zoom-test` diagnostic. Verified all-green live.
- **Slice 2 — orchestration:** `SessionMeeting` model + `lib/sessionMeeting.ts::getOrCreateSessionMeeting` (one meeting per occurrence, idempotent, free-seat no-overlap pick, race-safe orphan cleanup) + `teardownProgramMeetings`.
- **Slice 3 — integration behind `Program.useZoom`:** the `/session/[slug]/enter` entry (gate → provision → redirect/render), editor "Use Zoom" toggle + teardown on useZoom-off/format-change/delete; **Join buttons** (dashboard + program page + Scheduler) branch on `useZoom`. LiveKit untouched for non-Zoom programs.
- **Slice 4 — own-name hosting + role-aware entry:** `/enter` became a page; host joins under their **own name** and claims host with a 6-digit code (`ZOOM_HOST_KEY`, set on the owning seat). Role-aware screen: designated host / alternate (step-in) / teacher / member (no code). Host identity still from `HostAssignment`/`resolveSessionRole` — the Hosting Hub is unchanged.
- **Recording toggle:** `Program.recordByDefault` → `auto_recording: cloud` (audio-only governed by the seats' Zoom recording settings).
- **Host guide:** `ZOOM_HOST_GUIDE.md` — plain-English, forwardable to volunteer hosts.

### The debugging arc (the join "blink")
After a clean first test, re-entry "blinked" (bounced to the dashboard). I guessed twice (stale-meeting self-heal; window/ban), then — the right move — **surfaced the real error to admins** on the entry screen. Root cause: **Zoom rate-limits Add-Registrant to ~3/day per email**; RIM re-registered each person by name on every entry → 429. Fix: **dropped per-person registration** — everyone uses the standard join link, joins by name (typed once, Zoom remembers; or signed-in name). Follow-on: meetings now created **without registration** (`approval_type 2`) so the standard link skips the registration *form*; plus an **auto-heal** that recreates any stale gone/registration-on meeting on entry. Verified working by Jesse.

### What this connects to
- **Session room / LiveKit** (`RIM_SessionRoom.md`): the room being migrated away from; LiveKit stays the default + fallback until the pilot. The s120 "committed LiveKit" decision is superseded.
- **Programs / Program Editor / `programs-pg`**: new `useZoom` + `recordByDefault` flags, whitelisted in PUT/POST, teardown hooks; the editor's Hosting & Access tab. Touched the heavily-wired program lifecycle along the integration-map seams (no occurrence-engine or label changes).
- **Scheduler / Hosting Hub** (`RIM_Scheduler.md`): unchanged for host identity (HostAssignment is the source for both LiveKit and Zoom); only the "Enter room" link target changed.
- **Dashboard / member program page**: Join CTAs branch on `useZoom`.
- **OnlyOffice / the DO droplet**: decommissioning LiveKit must NOT kill the droplet (it co-hosts OnlyOffice).
- **Preview-login gap (s157)**: still relevant — a preview test path would have helped here too.

### What comes next
1. **Pilot** one real multi-person Zoom session (set `useZoom` on one program).
2. **Cut over**: flip the rest to `useZoom` + add a `/session/[slug]` guard (LiveKit room → redirect `useZoom` programs to `/enter`).
3. **Retire LiveKit**: stop the container on the droplet (Jesse's SSH; keep the droplet) + archive the LiveKit code.
4. Set the seats' **audio-only** cloud-recording in the Zoom console.
5. Follow-ons: per-occurrence recording override; seat-pick advisory lock before heavy concurrency; ProgramEditor input-lag perf (spawned as a background task this session).

### Closing-ritual checklist
- **Editor types (4a):** no editor block/placement work — n/a.
- **Hub audit (4c):** no hub auth/routing layers changed; `resolveSessionRole` reused as-is; the Scheduler change was a link target only.
- **Email audit (4e):** no `sendTemplatedEmail` added or changed — **no templates touched.**
- **Per-tool doc (4d):** new `RIM_Zoom.md` created + added to the CLAUDE.md Design Orientation table.
- **Architectural decision (7):** the LiveKit-committed stance is superseded by the Zoom migration — recorded in `RIM_SessionRoom.md` + `RIM_Zoom.md` + the `livekit-self-hosted` memory.

## 2026-06-24 (session 157) — Session-room: background-effects/blur built → fully REVERTED, device-switch fixes, host Spotlight — net shipped (Spotlight + device "Default" + listener audio); blur deferred until a preview test path exists

A long, instructive LiveKit session-room arc, driven by community + Jesse's requests (background blur / "appearance settings like Zoom," then video quality, then device-switch bugs). **Net on `main` (`0491d43`, deployed):** host **Spotlight**, a device-dropdown **"Default" always-selectable + reset**, and **listener audio 64 → 96 kbps**. **Reverted the same session:** the **background-effects (blur + virtual background)** build + a first device-switch fix — they regressed the teacher's camera.

### Arc 1 — Background effects (blur + virtual background): built, shipped, then REVERTED
Built `@livekit/track-processors` `BackgroundProcessor` as Off / Blur (adjustable) / Virtual-background (bundled SVG scenes), opt-in in the Settings panel, off by default, feature-detected, with CPU-constrained auto-disable (`a82e7f8` — new `useBackgroundEffects` hook + `lib/backgroundProcessorConfig.ts` + a VideoSettingsPanel section + RIMConference wiring). Then a device-switch integrity fix (`b305c4e`: a processor-aware `switchCamera`, device-state reflection, a speaker `setSinkId`-support note).
**Both reverted** (`49eb151` + the `b305c4e` revert) after Jesse tested: selecting his camera went **black**. Root cause: the blur processor attaches to the camera track, and LiveKit's `restartTrack` runs `processor.restart()` **before** `sender.replaceTrack()` — on a device switch (esp. Safari) that throws and leaves the tile blank. Compounded by **blur persisting in localStorage**, so it was silently always-on after one try → every camera re-select tripped it. The detach-before-switch "fix" was reasoned-correct but unverifiable (Jesse can't test previews — see "the real blocker").

### Arc 2 — The device-black diagnosis (wrong twice before the truth)
- First wrongly theorized **Blackmagic capture cards can't feed browsers** (true for DeckLink/UltraStudio/Intensity — `getUserMedia` can't pull from them; need OBS Virtual Camera). **But Jesse's device is an ATEM Mini — a normal UVC webcam that works in browsers, and worked before my build.** So it was *my regression*, not a hardware limit. **Lesson → ask what hardware the user has BEFORE diagnosing a device issue.**
- After the revert his camera was *still* black: the ATEM had gone **non-responsive** (a device glitch a **computer restart fixed**), AND my build had **saved his camera pref to the ATEM in `localStorage`**, which **survived the code revert** — and the old dropdown only offered "Default" when nothing was saved, so he was stuck. **Lesson → a code revert does NOT undo persisted client-side state.**

### Arc 3 — "Zoomed in" tiles → keep (it's Zoom) → the "match Zoom" directive
Jesse's self-view looked cropped in the tile but correct when enlarged. Confirmed: camera tiles use **`object-fit: cover`** (crop-to-fill) in the vendored `livekit-prefabs.css` — standard Zoom gallery behavior, **not** from my (reverted) build. Jesse's call: **keep it, and make the room as Zoom-like as possible because that's what members are used to.** Adopted as the session-room design tiebreaker (extends the session-117 "Zoom-aligned" foundation).

### Arc 4 — What actually shipped (`0491d43`, reviewed, tsc-green, deployed)
1. **Host Spotlight (Zoom parity)** — closes backlog `2026-05-19-001`. New co-host-gated `POST /api/livekit/spotlight` sets LiveKit **room metadata** `{ spotlight: identity|null }` (`updateRoomMetadata`), so every client incl. late-joiners reflects it (`useRoomInfo`). Folded into the synchronous focus precedence: **personal pin > screen share > spotlight > speaker > gallery** (a viewer's own pin still wins). Co-host Spotlight/Unspotlight button per tile + room-wide banner with Stop; **auto-clears when the target leaves** (connected-guarded, idempotent); banner gated on presence.
2. **Device dropdown "Default" always selectable + reset** — the trap that stranded Jesse: once a device was saved, "Default" vanished. Now always present; selecting it clears the saved pref and falls back to the system-default device (resets a stuck camera in-app, no console).
3. **Listener audio 64 → 96 kbps** — parity with speaker; audio is a tiny fraction of the video budget.

### The real blocker (the meta-lesson)
The blur regression reached **all members in production** because **Jesse can't log in to Vercel preview deploys** — no way to verify before shipping to `main`. Fixing the **preview-login issue** (likely a sign-in callback / `NEXTAUTH_URL` mismatch on preview domains) is the highest-value next step: it's the test path whose absence caused today's pain. Until it exists, ship nothing that touches camera capture (e.g. a blur rebuild).

### Reviewer catch worth noting
The Spotlight reviewer caught a **blocker**: the new `/api/livekit/spotlight/route.ts` was **untracked** — a `git commit -am` would have shipped Spotlight client-only (every toggle a 404). Staged explicitly. **Lesson → stage new files explicitly; verify `git status` before committing.**

### Closing-ritual checklist
- **Editor types (4a):** no editor work — n/a.
- **Hub audit (4c):** no hub routing layers changed. The new spotlight route gates on `isCoHost` via `resolveSessionRole` exactly like its siblings (mute-participant/mute-all/end-session); room-metadata is owned solely by this route (grep-confirmed no other room-metadata writer).
- **Email audit (4e):** no `sendTemplatedEmail` calls added or changed — no templates touched.
- **Stack/Architecture:** new route `/api/livekit/spotlight`; Spotlight added as a co-host capability in `RIM_System_Architecture.md` Video Conferencing; no deps/env/schema/migration changes (the blur attempt added no committed deps — reverted).

### What this connects to
- **Session room** (`RIM_SessionRoom.md`): focus orchestration (spotlight in the synchronous precedence), `sessionRole` context (gained spotlight), device selection (VideoSettingsPanel), audio profiles (listener bump). The blur attempt + revert + the processor/device-switch pitfall are documented there.
- **The s147 echo decision** — unchanged: still the teacher's open-speaker endpoint; hardware-AEC speakerphone is the parallel move (Jesse handling his end).
- **Preview deploys / auth** — the preview-login gap is now the gating dependency for safe session-room iteration.

### What comes next
1. **Fix the preview-login issue** → a real test path (prerequisite for everything below).
2. Then optionally **rebuild background blur** correctly (detach-before-switch verified on a real ATEM/Safari; self-host the MediaPipe segmentation assets from `/public/segmentation`; don't silently persist blur).
3. **Spotlight mobile-start** (tile button is hover-only → add a Participants-panel action; backlog `2026-05-31-002` is adjacent).
4. **Video measurement pass** — "choppy at first" (BWE ramp + simulcast startup) + "Zoom looked sharper" (720p capture vs 1080p): measure real dashboard numbers before any bitrate/layer change (the freeze-prone zone).

---

## 2026-06-22 (session 156) — Documents filing system (OnlyOffice Slice 4): freshness + search, category governance, cross-hub sharing/visibility, the master directory — all 4 steps + the design doc shipped

Built the document **filing system** on top of the s155 OnlyOffice foundation — the "modernize file management" work Jesse asked for. **Five commits on `main`, all deployed.** No schema change, no new deps / env / services, no email templates touched. `tsc`-green each step; an independent code-reviewer sub-agent gated each step (no blockers; two SHOULD-FIX + several NICE-TO-HAVE taken). The design lives in the new **`RIM_Documents.md`**.

### The design first (RIM_Documents.md)
Jesse asked to "write RIM_Documents.md first." Four decisions, confirmed before building:
1. **Categories — tended, not gated.** Anyone creating a doc can still add a category (blocking causes *misfiling*, worse than a long list); coordinators get the curation surface that never existed. Curation-after beats gating-before.
2. **Freshness — lead with "Updated."** Provenance ("Added") demoted to hover.
3. **Version history — visible recency now**, restorable timeline deferred (we keep only the current blob; OnlyOffice has native history).
4. **Directory — hub-first sections** (+ Community + Projects), recency-within, global search. The hub is a real semantic boundary at RIM (it's *which team* + how access is computed), so grouping by it aids clear seeing rather than imposing hierarchy. Explicit non-goals: no folder nesting, no multi-tag taxonomy, no per-doc ACL editor, no full-text content search.

### Step 1 — freshness + search (per-hub Documents tab)
Rows lead with "Updated 3 days ago · Author" (relative, plain language; "Added" on hover; un-hid the row meta the old CSS hid on phones). A calm search box filters label/description/category/author and collapses the category grouping into one flat recency-sorted list while active; recency-first sort within every group. `updatedAt` serialized through the loader (the live create/edit paths already carried it). Pure surfacing, no new routes.

### Step 2 — category governance
New coordinator-gated route `/api/hub/[slug]/document-categories` (add / rename / merge-on-collision / reorder / remove; cascades to `HubDocument.category`; removal → uncategorized, not deleted) — mirrors the conversation-categories route. New `HubDocCategoryManager` modal behind a coordinator-only "Manage categories" button. Pick-from-existing is now the visual default; "+ New category" is a quiet secondary affordance (`HubDocumentsClient` + `HubDocumentEditor`). Root-cause fix (reviewer): inline category creation reuses an existing category's casing case-insensitively, so it can't mint "Forms" next to "forms."

### Step 3 — cross-hub sharing + visibility
New `/api/documents/[id]/placements` (POST/DELETE) + `/visibility` (PATCH), both `canEditDocument`-gated. The model: **origin owns the lifecycle** (archive/delete/edit at the home hub; a shared-into hub's only action is "Remove from hub" = delete its own placement); **you can only share into hubs you belong to**; create-path rejects `hubId === origin` + already-placed + non-ACTIVE target. New `HubDocShareModal` off a "Share" row action: visibility (HUB/COORDINATORS/COMMUNITY) + add/remove placements. The Documents list now surfaces docs **shared into** the hub (loader gained the placement OR-clause), badged "Shared from [hub]" / "Shared" / "Community". **Access-door shift:** the hub doc-view page moved `canAccessHub` → `canAccessDocument` (inThisHub + visibility-aware) so shared/community docs no longer 404; native Edit stays origin-only. Reviewer confirmed origin-owns-lifecycle is enforced in the DB queries (archive/delete/PATCH look the doc up by `hubId: hub.id`, so a placed-in coordinator 404s), not just the UI.

### Step 4 — the master directory `/account/documents`
A new account surface: every doc the viewer can reach, sectioned by their own active hubs → Community (reached community-wide) → Projects (hubless), recency-first within each, with a global search that flattens + dedups. Rides the pure `canAccessDocument` (a candidate-superset query trimmed by the filter, so a Coordinators-only doc never leaks to a plain member). New hub-agnostic reader `/account/documents/[id]` (`canUserAccessDocument`-gated) as the destination for Community/Projects docs (office → editor, native → read-only body, link/file → the file). "Documents" added to the account sidebar. `relativeDate` extracted to `lib/relativeDate.ts` (shared with the per-hub tab).

### Hub audit (CLAUDE.md 4c)
Audited the four routing layers: **(1) capability gating** now uses `canAccessDocument` on the doc-view page + directory; **(3) the list/UI query** surfaces placed-in docs and the directory candidate query + filter use the same active-hub membership set; **(2) no notification pools** changed; **(4) no email** touched. The cross-hub reach is the feature, not a leak — the reviewer verified the candidate query is a true superset, `canAccessDocument` closes the COORDINATORS gap, and origin-owns-lifecycle holds at the DB layer.

### What this connects to
- **OnlyOffice (RIM_OnlyOffice.md)** — office docs were the driver; §4's "move the doc-view page to canAccessDocument when Slice 4 lands" is done; §6 current-state updated.
- **`lib/documentAuth.ts`** — its pure gates (built s154/s155) are the engine every new surface rides; unchanged this session, only consumed.
- **Hubs** — first surfaces that read docs *across* hub membership; the access-door shift.
- **The conversation-categories route** — the document-categories route mirrors its auth + cascade pattern.

### What comes next
- **Verify on deploy** (Jesse): the "Manage categories" button + sidebar Documents link appear; a shared doc surfaces in a second hub badged; a Coordinators-only doc stays hidden from a plain member.
- **Ungate office docs** (backlog `2026-06-22-002`), **Slice 5** native→docx (`-003`), **office-editor polish** (`-004`), **directory/filing polish** (`-006`: archived-in-directory, comments-on-reader, sort toggle/Recent strip), **rotate the secret** (`-005`).
- **AGENTS.md** (Jesse's untracked Codex-instructions mirror of CLAUDE.md) is now missing the RIM_Documents.md Design Orientation row — sync when committing it.

### Follow-up (post-closing) — opened up access
LoriLee reported she couldn't see "+ Office doc" or "Manage categories." Diagnosis (verified from her screenshot + the gating code): both were coordinator-gated, and she's **not** actually flagged a coordinator of Support Inbox (she saw per-doc actions only on her *own* docs, none on others'). Per Jesse — these should work for any hub member:
- **Office-doc creation ungated** (commit `80f6ab8`): dropped `&& isCoordinator` on the "+ Office doc" button; the create route already allowed any member, so it was just the UI catching up. Closes backlog `2026-06-22-002` (the s154 OnlyOffice beta gate).
- **Manage-categories opened to all members**: the button (drop `isCoordinator`) + the `/api/hub/[slug]/document-categories` route (`effectiveCoordinator` → `canAccessHub`; `loadCoordinatorContext` → `loadMemberContext`). This reverses the s156 "coordinators curate" decision per Jesse (everyone should be able to make/tend a category); the destructive ops are recoverable (remove → uncategorize, rename/merge → re-file). Docs updated: `RIM_Documents.md` §5 + build order, `FEATURES.md`, `RIM_OnlyOffice.md` §6.

### Process notes
- Each step: build → `tsc` → reviewer sub-agent → fix → commit on a `claude/*` branch → fast-forward `main` → push → delete branch. Bundled steps 1+2 into one push, then 3 and 4 separately, as Jesse paced them.
- One tooling oddity: the Write tool once emitted a literal NUL byte inside a string literal (`join("\0")` where I wrote `join(" ")`); caught by a post-write NUL sweep across changed files and fixed by rewriting the file. The NUL sweep is now part of the per-step verification.

---

## 2026-06-22 (session 155) — OnlyOffice: the save loop *actually* fixed (payload-nesting), React-crash fix, comments-not-topics — both opening bugs closed; feature works on prod (gated)

Resumed at the two open bugs from s154 and closed both — and the real save bug was deeper than the s154 note guessed. **Six commits on `main`, all deployed** (live, gated to coordinators). No new deps / env / services; **no schema change / migration**; no email templates touched. `tsc`-green each step; reviewer-gated the non-trivial changes. Editor opens, edits persist, comments work. Integration sections of `RIM_OnlyOffice.md` now fully written (the payload gotcha + the React-mount pattern).

### The save loop — the real root cause (not the SSRF guard)
The s154 note fingered the callback's `isDocumentServerUrl` SSRF guard. Real issue, but **downstream and never reached.** A diagnostic log planted in the callback showed `status=undefined` on a callback whose JWT *verified* — so the secret was fine; we were reading the fields from the wrong level. **OnlyOffice signs its callback into the `Authorization` header (`JWT_HEADER=Authorization`), and that token nests the body under `payload`.** We read `verified.status`/`verified.url` at the top level → undefined → `if (status === 2 || status === 6)` never matched → nothing ever saved. Fix: `const cb = verified.payload ?? verified` (handles header-nested + body-embedded; graceful fallback).
- The morning's **host-rewrite** is still necessary (shipped): behind the Caddy-L4 + shim proxy, OnlyOffice reports the edited-file URL with an internal host Vercel can't reach; `resolveEditedFileUrl` pins it to the public `docs.` origin (also a *stronger* SSRF boundary — we fetch the host we trust, never the one we're handed). It just wasn't sufficient alone.
- **Lesson:** instrument the actual received values before theorizing. The `status=undefined` log settled a multi-hypothesis hunt; the JWT-mismatch theory (my prior note **and** a 4-agent diagnosis workflow's top-ranked cause) was a **red herring** — the editor opening with no security-token error already disproved it.

### The React white-screen crash (self-inflicted, then fixed)
To surface the editor's hidden error (masked behind the "Opening editor…" overlay), I added an onError banner + a 25s readiness timeout. That introduced `NotFoundError: The object can not be found here`: `DocsAPI.DocEditor` **replaces** its target element with an `<iframe>`, so when React toggled the overlay sibling it referenced a node OnlyOffice had swapped out. **Fix (the correct React+OnlyOffice pattern):** render an empty React-owned host div, create OnlyOffice's mount node *ourselves* inside it (React never reconciles it), overlays as trailing siblings; cleanup empties the host. Reviewer-verified crash-safe across toggle / error-swap / unmount. (I shipped the crashing change *without* a reviewer — the lesson is to review even "trivial" changes to third-party-DOM components.)

### Bug #2 — comment/doc routing (done)
Office docs jumped straight to the full-screen editor, skipping the doc page where the conversation lives. The hub list-link now lands on the doc page; that page branches on `docKind === "ONLYOFFICE"` → metadata + "Open in editor" CTA + the comment thread (instead of native body / markdown export / native edit link). Office docs are hub-origin (hubId set, default HUB visibility), so the page's hub-scoped gate works for the gated beta.

### Quick wins (Jesse's design feedback)
- **Comments, not Topics.** The doc-page panel forced a "topic title" (it reused the hub `HubConversationThread`, where `title` is required). The document *is* the subject → the panel now just says "Add a comment"; we derive a short heading from the comment's first line so the ~13 shared thread/list/detail surfaces keep working **with no schema change** (the true `title`-nullable fix is ~13 surfaces — backlogged). Relabeled "Comments" across the doc page.
- **Edit-form URL field** hidden for office docs (they keep their file in Blob, not a URL — leftover from the link form).
- Removed the temporary callback diagnostic log now that saves are confirmed.

### What this connects to
- **The save callback** — the one deliberate non-session-gated route; the payload-nesting fix lives there; `resolveEditedFileUrl` replaced `isDocumentServerUrl`.
- **HubConversationThread** — doc comments share it; "derive title from first line" keeps `title` non-null so no cross-surface ripple (the proper nullable fix is backlogged).
- **The doc-view page** (`canAccessHub`-gated) now renders office docs (CTA + comments) as well as native docs.
- **OnlyOfficeEditor** — now the canonical React+OnlyOffice embedding pattern (host-div ownership) + error surfacing.
- **LiveKit droplet / OnlyOffice server** — healthy; the proxy topology (internal-host reporting) is why the host-rewrite is needed.

### What comes next
Both opening bugs closed; the feature works end-to-end (create → edit → save → comment) but is **gated to coordinators** and **single-hub**. Remaining (UP_NEXT has the ordered list): **Slice 4** (sharing UI + master directory `/account/documents` — also where the "modernize the filing system" redesign lands; write `RIM_Documents.md` first), **ungate**, **Slice 5** (migrate native docs), polish (mobile, the still-slowish first open, version-history surfacing). Loose end: **rotate `ONLYOFFICE_JWT_SECRET`** (pasted in the s154 chat).

---

## 2026-06-22 (session 154 continued) — OnlyOffice shipped to prod *gated*; JWT mismatch fixed; save-loop + comments-routing bugs open

Continued the build: completed Slice 3b (create flow + blank `.docx/.xlsx/.pptx` templates via committed static assets), the list-link, and a **coordinator gate**, then **merged everything to `main` and deployed to production** — gated so only coordinators/admins see the "+ Office doc" button (`officeEnabled && isCoordinator`). Went to prod because Vercel **previews can't do RIM's NextAuth login** (database sessions + a fixed `NEXTAUTH_URL`). Set Production env vars; fixed a **JWT-secret mismatch** (Vercel value ≠ the droplet's) that had hung the editor on "Opening editor…". **Working on prod now: create an office doc → the editor opens with real RIM identity** (JWT handshake + token-gated download confirmed). **Two open bugs (full detail in `UP_NEXT.md`):** (1) **edits don't persist** — prime suspect the callback's SSRF guard (`isDocumentServerUrl`) rejecting OnlyOffice's proxied edited-file URL; (2) **office docs jump straight to the editor**, skipping the doc page where the conversation/comments thread lives. Also pending: **rotate the JWT secret** (it was pasted in chat). Slices 4/5/6 + ungate still ahead. Deploy-relative URLs (`requestBaseUrl`) were added so the loop works per-deployment.

---

## 2026-06-21 (session 154) — OnlyOffice office-documents: architecture + the feature spine (Slices 0–3a) on a branch

A long co-design + build session: decided to add real office-document editing (Word/Excel/PowerPoint — live co-editing, comments, version history, real pages) to hub documents by **self-hosting OnlyOffice Docs**, then built the spine. **Four commits on branch `claude/onlyoffice-docs` — NOT merged, NOT deployed**; the OnlyOffice **server is live** on the LiveKit droplet. `tsc`-green throughout; both code slices adversarially reviewed. New per-tool doc: **`RIM_OnlyOffice.md`**.

### Why OnlyOffice, and why self-hosted (the architecture decision)
Jesse wanted Google-Docs-grade editing (the native Tiptap hub-doc editor is web-flow, single-author, no pages) without members needing Google accounts.
- **You can't use "Google Docs' code"** — closed-source (canvas-rendered). Editing a Google Doc needs a Google account or anonymous editing (which breaks RIM's "community isn't anonymous").
- **Self-hosted OnlyOffice Docs (Community, free, AGPLv3)** is the fit: RIM embeds it and **mints every editing session** → accountless *and* named (real RIM identity in the doc), which Google can't do. v9.4 (May 2026) dropped the old 20-connection cap, so the free edition is production-viable. $0 software; co-hosted on the existing 8 GB LiveKit droplet (verified idle headroom).
- **Scope is the office-document slice only.** A full editor-usage inventory confirmed the RIM Tiptap editor is load-bearing across hub conversations/replies (incl. the threads under docs), program descriptions, and lesson bodies (the Dharma blocks live in exactly those 3 doc-variant surfaces). "Migrate everything / degrade the RIM editor" would have broken conversations + teaching pages — the honest answer is the clean split, OnlyOffice for office files.

### Product decisions (co-designed)
- **Full-screen dedicated editor**, not embedded-in-chrome — hub stays the calm home.
- **Comments stay related, not merged** — the hub thread under a doc stays; OnlyOffice inline comments live in the doc; no bridge.
- **v1 types:** documents, spreadsheets, presentations.
- **Per-doc visibility as a small enum** (HUB / COORDINATORS / COMMUNITY), *not* free-form per-person ACLs — calmer, avoids access-confusion. Jesse's "community-wide toggle" = the COMMUNITY level.
- **Cross-hub + hubless docs at the document level** (not "project hubs," deferred): one canonical doc placed in one hub, several, or none (a community-project doc); surfaces in each hub badged, never copied — via a placement join; `hubId` became nullable.
- **Migrate existing native hub docs → .docx** (they're plain, no Dharma blocks) — deferred to Slice 5. The **comment-title bug** (a doc's first comment shouldn't require a title) folded into Slice 6.

### What was built
- **Slice 1 (`0b73bc3`) — schema + access core.** `HubDocument` gains `docKind`/`storageKey`/`version`/`visibility`, nullable `hubId`; new `HubDocumentPlacement` join; enums `HubDocKind`/`HubDocVisibility`. Idempotent migrate.mjs `onlyoffice_documents_v1` (backfills docKind). `lib/documentAuth.ts` — central, pure, leak-free `canAccessDocument`/`canEditDocument` (author + GT always; COMMUNITY = everyone; HUB/COORDINATORS scoped to placed hubs; ADMIN does *not* auto-pass, per the s128 boundary). Nullable hubId had **zero** ripple.
- **Slice 0 (`7217906`, infra — LIVE).** Isolated stack at `/root/onlyoffice/` (OnlyOffice + a header shim), reached at **`docs.rootedinmindfulness.org`** via the LiveKit Caddy. *Caught by inspecting first:* the LiveKit Caddy is `caddyl4` in pure **Layer-4** mode (raw TCP, can't add headers) and everything uses **host networking** (OnlyOffice's bundled Redis would collide on 6379). So OnlyOffice runs bridge-networked with a tiny `caddy:2` **shim** injecting `X-Forwarded-Proto: https` (OnlyOffice requires it — verified against its docs), and the live Caddy got one SNI route → the shim. Applied backup→validate→graceful-reload; verified docs 200 + livekit 200. Runbook + rollback in `RIM_OnlyOffice.md`.
- **Slice 2 (`8a8ca98`) — the save loop.** `lib/onlyoffice.ts` (HS256 JWT via node:crypto, no dep; signed editor-config; `document.key = id-version`; SSRF + download-token guards). `GET /api/documents/[id]/editor-config` (doc-centric, `canAccessDocument`). `POST /api/onlyoffice/callback` (**session-less — JWT-only**, the one deliberate exception; status 2 bumps version atomically + dels old blob, status 6 saves in place). `GET /api/onlyoffice/download/[id]` (token-gated stream). Review: no auth-bypass; fixed version race, blob accumulation, SSRF defense-in-depth, ForceSave key-stranding, token TTL.
- **Slice 3a (`2ce04fd`) — the editor surface.** `components/OnlyOfficeEditor.tsx` (loads api.js, mounts DocsAPI.DocEditor, loading/error states, cleanup); full-screen `/account/documents/[id]/office` (server-gated); `oo-` CSS.

### What this connects to
- **HubDocument system** — generalized *in place*; native (NATIVE), links (LINK), PDFs (UPLOAD), and now OnlyOffice (ONLYOFFICE) coexist on one record with the same lifecycle/notify/conversations. The native doc system is behaviorally unchanged.
- **Hubs / access** — docs are now RIM's **first hub-optional, multi-hub resource** (a deliberate departure from "everything belongs to one hub"). Access is doc-level via the central `canAccessDocument` (placements + visibility), not a single hubId. The callback is the documented non-session-gated exception.
- **LiveKit droplet** — OnlyOffice co-hosted as an isolated, resource-capped stack; LiveKit untouched; the same Caddy now serves a third subdomain.
- **Native RIM editor** — untouched, still load-bearing for conversations + teaching content; OnlyOffice is the office-file sibling.
- **Auth** — RIM identity flows into every editing session (no external accounts), consistent with the passwordless model.

### What comes next (UP_NEXT has the ordered list — needs Jesse's env vars + a deploy to test)
1. Jesse adds `ONLYOFFICE_URL` + `ONLYOFFICE_JWT_SECRET` to Vercel; deploy the branch to a preview (runs the migration); open a doc; confirm the save loop round-trips.
2. Slice 3b (create + blank templates — generation method is the open decision), Slice 4 (sharing UI + master directory), Slice 5 (migrate native docs), Slice 6 (mode polish, mobile, comment-title fix, welcome-page hardening).

**Branch, not merged:** the feature is incomplete + untested (no Vercel env yet), so it stays on `claude/onlyoffice-docs`; merge when testable + complete.

---

## 2026-06-17 (session 153) — Member-profile consolidation: assign hubs from the registry + retire the HOST role

Built the teed-up "assign hubs from the member page," then — after Jesse found the first result cumbersome ("two places to add to a hub") — consolidated the whole member-profile membership model and **retired the plain HOST role.** Two commits on `main`, both deployed; `tsc`-green, reviewer-gated each slice. No new deps / env / services. One migration `retire_host_role_v1` (no schema change).

### Slice A — Hub memberships on the member profile + hide the legacy pool from pickers (commit `1842fed`)
- New ADMIN+REGISTRAR section on `/admin/members/[id]` to assign a person to any hub, reusing `HubMember` + the s146 FK-safe cleanup. New route `/api/admin/members/[id]/hubs` (GET/POST/DELETE). The deliberate use case is **pre-staging** — incl. a legacy-pool person reached via `?pool=legacy` (by id, so it bypasses search).
- Closed the legacy-pool leak in **all three person-pickers** (the reviewer caught it wasn't unique to the hub search): hub member search, the household add-member picker (`/api/admin/members` GET — verified picker-only, so filtered directly), and the instructor picker (`/api/members/search`). Filter is `isLegacyUnclaimed: false`; household also excludes archived.
- Extracted the FK-safe coverage cleanup into `lib/removeHubMembership.ts`, shared by the in-hub hard-remove and the new route (one source of truth for the cascade).

### Slice B — Teams + Roles & access consolidation; retire HOST (commit `9abe9cb`)
The member profile now reads as two clear controls instead of three overlapping ones:
- **Hub memberships (Teams):** every active hub as an **Off / Member / Coordinator** row — one uniform place for all team membership. Role-derived hubs (Courses ← Teacher, Registrar ← Registrar) render **locked "via … role"**; POST/DELETE refuse them (409). New `roleDerivedHubs()` helper in `lib/syncHubMembership.ts` drives the lock + the guards.
- **Roles & access:** only genuine system powers — Admin, Guiding teacher, Registrar, Teacher, and **HOST_MANAGER relabeled "Scheduling manager."** HOST and SUPPORT removed from the UI.
- **Retired the plain HOST role.** host-team *membership* is now the source of truth for being a host (verified: capability via `getEffectiveHostingCapability`, scheduler access via `canAccessHubScheduler`, tool access via `hasToolAccess` pathway-3 all read membership). `ROLE_HUB_MAPPINGS` dropped HOST/HOST_MANAGER/SUPPORT (keeps TEACHER/REGISTRAR — genuine tool/records powers, so their hubs stay role-derived). Migration `retire_host_role_v1` ensures each host's host-team membership, then strips HOST from users **and** from any course `requiredRoles` gate (the reviewer caught the course-gate regression). Idempotent, flag-guarded, membership-ensured-before-strip, skips if host-team is missing.
- Removed the now-dead "Hosts" registry filter + the HOST course-gate option.

### Design decisions + why
- **The Member Registry now WRITES hub membership** (previously hubs owned their rosters) — a deliberate shift Jesse chose so an admin can staff any team from one place.
- **HOST_MANAGER kept as a cross-hub "Scheduling manager" power**, decoupled from host-team membership: verification showed it carries genuine cross-hub `isManager` authority a per-hub Coordinator toggle doesn't replicate. A per-hub host-team coordinator is now set via Teams → Coordinator (`isCoordinator`).
- **GT stays out of the Member Registry by design.** Jesse first said ADMIN+REGISTRAR+GT, but GT isn't ADMIN (separate roles; Jesse holds both). Since Jesse already has registry access via ADMIN, adding GT would only ever hand a *future* GT the member PII the role design says it shouldn't have. So the new route is ADMIN+REGISTRAR; GT keeps assigning hub members from inside each hub (unchanged).
- **Locked role-derived rows** resolve the reviewer's sync-resurrection concern at the source: you can't remove a role-driven membership from the Teams tool — you remove the role.
- **Process:** built v1 → Jesse named the cumbersomeness → I proposed a consolidation (with a mockup) → he chose the "full fix" → I verified the host-staffing gates were membership-based *before* retiring the role, and the reviewer caught the one place that wasn't safe (course `requiredRoles`).

### What this connects to
- **Scheduler / "covers ⇒ member" (s146):** Teams writes/removes `HubMember`; removal runs the shared FK-safe cleanup so the assignment ledger can't outlive the roster. Capability + scheduler access already read membership (s92/s146) — which is what made retiring HOST safe.
- **Legacy pool / pre-staging (s142/s145):** the by-id assignment path is the pre-staging tool; pickers now hide the pool until a member claims their account.
- **Roles model + course access:** HOST retired; HOST_MANAGER → Scheduling manager; SUPPORT residual (dropped from UI, role data untouched); course `requiredRoles` no longer offers HOST.
- New per-tool doc **`RIM_MemberRegistry.md`** (added to the CLAUDE.md Design Orientation table).

### What comes next
- **Deployed-site verification** (checklist in `UP_NEXT.md`) — most important: confirm a current host can still **enter a live session + claim a slot** (proves the membership-is-source-of-truth switch held), and read the deploy log for the `retire_host_role_v1` count.
- Optional cleanup (backlog `2026-06-17-003`): the dead `addingHost`/`sendHostRoleAssignmentEmail` path in `/api/admin/members/[id]` + the residual `ROLE_COLORS.HOST`; and a "filter registry by hub/team" now the HOST role filter is gone.
- s152 ops still open: real-session media test, key-only SSH (`2026-06-17-001`), secret rotation (`2026-06-17-002`).

---

## 2026-06-17 (session 153, follow-on) — Monthly recurrence made first-class (weekday-of-month, derived from the start date)

A separate slice on top of the consolidation above, prompted by LoriLee: once-a-month programs (the Nature Meditation walks) showed a single fixed date that read as stale once it passed. **One commit `981e281` on `main`, deployed.** No new deps / env / services; **no schema change.**

### What was wrong (the audit corrected my first read)
A 14-agent audit (7 readers + 6 adversarial verifiers + synthesis) overturned my quick-grep diagnosis: the card's stale date wasn't a label bug — it's a **cached `dateText` string** on a program configured one-time. The real, latent gap: **`isOccurrenceOnDate` had WEEKLY and DAILY branches but no MONTHLY** — so any program set to "Monthly" fell through to "occurs only on its anchor date" and silently never recurred across nine surfaces (This Week, dashboard Today + Coming-up, Scheduler, claimable sessions, hub session list, standing rotations, the session-room join gate). The editor offered Monthly; the engine never honored it. (The audit also corrected me that the `.ics` export already emits `FREQ=MONTHLY`.)

### What shipped
- **The one load-bearing fix:** a MONTHLY branch in `lib/scheduleUtils.ts::isOccurrenceOnDate` — match the anchor's **weekday + position-in-month** (Nth or last), honoring interval + count, reusing the existing `getDayOfWeekOccurrenceInMonth`/`getTotalDayOfWeekOccurrencesInMonth` helpers (the same ones the rotation system uses for "last Sunday"). All nine surfaces inherit it. **"last" stays last** even in 5-week months; a "2nd Wednesday" anchor holds the 2nd Wednesday.
- **Label:** new `monthlyPatternPhrase()` in scheduleUtils; `computeDateText` (programUtils), `buildDateLabel` (dateLabel), the ProgramEditor preview, and the migrate.mjs recache copy all now read **"Last Sunday of the month"** — kept byte-identical across the four copies so the every-deploy recache can't clobber the API-saved value.
- **Case fix:** `buildDateLabel` compared `recurrenceFreq` lowercase while it's stored UPPERCASE — its weekly/daily/monthly branches were silently dead. Normalized; un-breaks auto-labels for all frequencies.
- **No schema change, no new editor input:** the weekday + position come from the existing **Start Date** (the weekday picker stays weekly-only, correctly). Jesse's call — the start date already encodes "last Sunday."

### Design decisions + why
- **Monthly = same weekday-and-position as the start date** (weekday-of-month, not calendar-date-number, and not a new schema field). The model already carries everything via `startDatetime`; "last Sunday" is derived, no migration.
- **`.ics` export deferred** (backlog `2026-06-17-004`): matching "last Sunday" in the download needs a CT `TZID`/`VTIMEZONE` treatment because the `.ics` emits start times in UTC — a naive `BYDAY/BYSETPOS` would misalign for evening programs. Not half-fixed. (Same item also fixes a pre-existing lowercase bug dropping `BYDAY` from weekly `.ics`.)
- **Verified, not assumed:** standalone date-math simulation (last Sundays roll Jun 28 / Jul 26 / Aug 30…; 2nd-Wednesday holds; interval + count bound), `tsc`, `migrate node --check`, adversarial reviewer (no showstoppers).

### What this connects to
- The whole occurrence surface set (one branch fixes all nine) + the recache migration (relabels existing monthly programs on deploy).
- **Bonus fix:** the session-room **join gate** for monthly programs — the room previously opened only on the very first session; it now opens on every monthly occurrence.
- The `.ics` export (now the one place still on date-of-month — backlog 004).

### What comes next
- **Deployed verification:** set a program to Monthly (start date on the intended weekday) → confirm it shows on the right future dates on This Week / Scheduler + the card reads "Last Sunday of the month"; run `SELECT slug, "startDatetime", "recurrenceFreq" FROM "programs" WHERE "recurrenceFreq" ILIKE 'monthly'` to see what the change touches.
- **Data fixes (UI, LoriLee/Jesse):** set the Nature Meditation walks to Monthly with the right start date; correct Recovery Dharma's end time (the "9:30–7 AM" was a bad end-time on the row).
- A plain-English update for LoriLee was drafted in-chat.

---

## 2026-06-17 (session 152) — Server hardening: DO Cloud Firewall + OS updates/reboot + SSH IP-restriction (no repo code change)

Executed the deferred server-hardening ops task from session 150 (backlog `2026-06-16-002`, now closed) on the self-hosted LiveKit droplet (`RIM-LiveKit`, `104.248.229.126`). **No repo code changed** — all DigitalOcean console + server SSH. The droplet had been running since stand-up with the firewall OFF (all ports open) and a pending OS update/reboot.

### What was done (all verified)
- **DO Cloud Firewall `rim-livekit`** — created in the DO console (driven by me via the Claude-in-Chrome extension) and attached to the droplet. Inbound whitelist (6 rules): **TCP 22 from Jesse's IP only (98.144.129.15)**; **TCP 443** (HTTPS/WSS signal + Caddy); **TCP 5349** (TURN/TLS); **TCP 7881** (WebRTC/TCP); **UDP 3478** (TURN/STUN); **UDP 50000–60000** (WebRTC media). Outbound left at DO defaults. Verified after attach (from Jesse's Mac, his IP is whitelisted): 7880 now times out (was open), SSH still works, HTTPS 200, 5349/7881 reachable.
- **OS updates + reboot** — `apt-get full-upgrade` applied 52 packages incl. a new kernel (6.8.0-71 → **6.8.0-124**); `reboot`. The stack auto-returned (post-reboot HTTPS 200, ports correct, checked via curl/nc from Jesse's Mac) because Docker is systemd-enabled and all three compose services are `restart: unless-stopped`.

### Two corrections to the session-150 documented port list (read the live config, didn't trust the doc)
Probed `livekit.yaml` (`rtc`/`turn`) + `ss -tulnH` before building the ruleset: the running config exposes **TCP 5349** (TURN/TLS — MISSING from the s150 doc's list; omitting it breaks TURN-over-TLS for UDP-blocked clients), uses **no port 80** (Caddy gets certs via TLS-ALPN on 443 — the doc said open 80; unnecessary), and binds **TCP 7880** internally only (Caddy proxies over localhost) so the firewall deliberately leaves it closed — a hardening gain (it was internet-reachable before).

### SSH posture — IP-restriction now, key-only deferred
Discovered Jesse's SSH actually authenticates by **password** — his Secure-Enclave / Secretive key is NOT in the droplet's `authorized_keys` (a `PreferredAuthentications=publickey` test returned `Permission denied`). He first chose key-only auth, but since key login doesn't work, disabling password would have locked him out — so we **deferred true key-only** and instead **scoped port 22 to his IP** in the firewall (closes the root+password brute-force surface from the rest of the internet). Password auth stays on, reachable only from his IP; the DO web **Console** is the out-of-band recovery path. `sshd -T` confirmed `50-cloud-init.conf` forces `PasswordAuthentication yes` and wins over `60-cloudimg-settings.conf` (sshd first-match), so a future key-only override must sort first (`00-hardening.conf`).

### What this connects to
Pure infrastructure around the self-hosted LiveKit server (session 150). No app code, schema, env, hub, role, registration, or email change. The server-ops record + the firewall ruleset + the SSH model now live in `RIM_SessionRoom.md` → "Server operations & hardening." Backlog `2026-06-16-002` closed; the two remaining follow-ups split into `2026-06-17-001` / `2026-06-17-002`.

### What comes next
- **Real-session media test** (the gold standard) — a live session-room join to confirm audio/video flow end-to-end through the new firewall (UDP 50000–60000 + 3478/5349). Port probes pass; a live join is the proof.
- **True key-only SSH** (deferred, backlog `2026-06-17-001`) — wire Jesse's Secretive key into SSH, confirm a passwordless login, then disable password auth.
- **Rotate `LIVEKIT_API_SECRET`** (optional, backlog `2026-06-17-002`) — pasted in the s150 setup chat; rotate when no session is live.
- The teed-up code build remains **assign hubs from the member page** (mapped + confirmed in s151).

### Process note
The DO firewall was built by me driving Jesse's browser via the Claude-in-Chrome extension (he asked me to — he was uncomfortable in the terminal). SSH steps stayed with Jesse (his Secure-Enclave key needs his Touch ID/password; a sandboxed Claude shell can't authenticate), with me preparing every command and reading results. External verification (HTTPS/port probes) I ran from his Mac (sandbox off), since those need no login. A flaky DO React dropdown twice closed the modal on an off-target option click — the reliable pattern was scroll-the-dropdown-list then click the *visible* option by coordinate, verifying each step (the SSH rule especially, since a wrong source IP would lock him out).

---

## 2026-06-16 (session 151) — LiveKit optimization: RNNoise NC (replacing dead Krisp), screen-share crash → custom synchronous focus layout, sharper share, roster cleanup

The "optimize LiveKit quality + cost" follow-on to session 150's self-hosting migration. **9 commits on `main`, deployed. One new dependency** (`@sapphi-red/web-noise-suppressor`; dropped `@livekit/krisp-noise-filter`). No new env vars/services, no schema change, no migration, no email templates touched. Per-tool detail in `RIM_SessionRoom.md`.

### 1. RNNoise noise cancellation — in-browser replacement for Cloud-only Krisp (`5353076`)
Krisp NC went inactive when RIM left LiveKit Cloud (s150). Replaced with **RNNoise**, an in-browser AI denoiser. **Decision: RNNoise over DeepFilterNet** — verified from live sources (not memory, per the s150 lesson): RNNoise is light (0.06M params, runs on every device incl. old iPads), proven for WebRTC, drop-in; DeepFilterNet3 is Krisp-class but its in-browser path is experimental + CPU-heavy (worst on the weak/iOS devices RIM has) + a single-contributor integration. For a quiet-room, mixed-device, solo-dev context, RNNoise is the fit. **Jesse verified live: "better than before, no echo, good sound."** New `components/session/RnnoiseAudioProcessor.ts` (LiveKit audio `TrackProcessor`, own 48kHz context, Bell-mode bypass via internal reroute) + `components/session/useNoiseFilter.ts` (attaches on mic-publish, exposes the same `{available,enabled,pending,toggle}` Bell mode already consumed). Worklet + WASM copied to `public/noise/`. Browser-only (the package's classes extend `AudioWorkletNode` at module scope) — safe because the `VideoRoom` subtree mounts `ssr:false`. **Echo/AEC untouched** (separate, capture-level concern). Reviewer-gated; hardened the cancelled-attach race (`stopProcessor`) + the iPad `resume()` swallow.

### 2. Screen-share crash → a custom, SYNCHRONOUS focus layout (the big arc, 6 commits)
A screen share **white-screened + dropped every receiver** (sharer stayed in). Diagnosed in layers from Jesse's console pastes + diagnostic clues:
- **Fatal crash = React #185 ("Maximum update depth")** in LiveKit's `CarouselLayout` (the focus-view filmstrip): it sizes tiles from a `useSize` measurement that feeds back on itself (the prefab CSS gives `.lk-focus-layout`/`.lk-carousel` no definite height). Only focus view mounts it; a screen share forces focus view → loop → room teardown. Gallery's `GridLayout` doesn't measure, so it never crashed. **Fix (`cc9fdf7`): replaced `FocusLayoutContainer` + `CarouselLayout` with a custom CSS layout** — a stage (`FocusLayout`, non-measuring) over a fixed-height `TrackLoop` filmstrip. (An earlier input-memo guess, `b06c192`, was wrong.)
- **Residual non-fatal #185** (RxJS subscription loop): the pin-orchestration `useEffect` read `layoutContext.pin.state` back to decide whether to re-dispatch, but LiveKit's `set_pin` reducer returns a fresh array each dispatch, so the read-back misjudged convergence → dispatched every render → `FocusLayout` re-subscribed forever. Sig-gate fix `9e0d8ad`, then superseded.
- **Blank stage for receivers** (`c9557a1`): the pinned ref was a snapshot taken before the remote track subscribed (the sharer's local track has media instantly → only they saw it).
- **"Works on refresh but not live"** (Jesse's key clue): focus engaged through a deferred effect→dispatch→pin.state→re-render round-trip that didn't reliably flip a receiver into focus view on a live transition. **FINAL FIX (`d78c5f9`): removed the LiveKit pin-reducer machinery entirely — focus is computed SYNCHRONOUSLY each render from live `tracks`** (precedence: manual pin > screen share > speaker active-speaker > gallery). `inFocusView`, the stage ref, and the filmstrip all derive from it; a share engages the same render it appears and the stage always renders a live, media-carrying ref. `LayoutContextProvider` kept but inert. Reviewer-verified against LiveKit source. **This is the robust model — do NOT reintroduce the pin reducer for focus.**

### 3. Sharper screen share (`ebb3a94` → `dd74f38`)
Small code/text was soft. LiveKit caps screen-share **capture at 1080p** by default (downscales Retina screens before encoding) and the encoder wasn't told to favor detail. Fix at the sharer's capture: `setScreenShareEnabled(true, { contentHint: "detail", resolution: 1440p })` (1440p skipped on Safari 17 — its quirk mis-captures at low res when a resolution is set), + `screenShareEncoding` 2.5→4→**8 Mbps** (1440p needs the bits). Single layer → receivers need ~8 Mbps down during a share (adaptive screen-share layers deferred for weak links).

### 4. Participant roster cleanup (`32ed585`)
- `sessionDisplayName` → **first name + last initial** ("Nancy L.") — legible on the narrow tile/roster; flows to chat too.
- **Removed the "Host Volunteer" pill** from tiles + roster. It showed *capability* (any host-team member) as if it were *session identity* — read as "staff" for someone just attending. Now only session-true pills render: **Host** (assigned to this session) + **Teacher**. Co-host controls (mute/share/Bell) unchanged, just unlabeled. The now-vestigial `cohost` metadata seed left in place (invisible) for a later cleanup.

### What this connects to
The session-room **focus/layout/pin orchestration** was rewritten (the most-iterated part of the room); the **identity/capability pill model** (the 2026-05-26 split) lost its one capability-as-identity pill; **display names** changed across tiles/roster/chat; `VideoRoom.buildRoomOptions` gained screen-share settings; the NC layer moved from Cloud-Krisp to in-browser RNNoise. No hub/role/registration/email changes.

### What comes next
- **Assign hubs from the member page** (mapped + confirmed, not built) — new `/admin/members/[id]` section + ADMIN-gated `/api/admin/members/[id]/hubs` (GET/POST/DELETE), reusing `HubMember` + the s146 cleanup-on-remove. Connects to the Scheduler "covers ⇒ member" invariant. **Architecture note when built: the Member Registry will *write* hub membership** (previously hubs owned their rosters — a deliberate convenience shift). 3 decisions pending (roles / coordinator toggle / notify).
- **Server hardening** (Jesse's ops task, pending from s150): DO Cloud Firewall (free; NOT ufw), OS update + reboot, optional secret rotation.
- Deferred: adaptive screen-share layers for weak links; vestigial `cohost` metadata cleanup; lint-clean the keep-last-speaker render-time ref (→ useState); a per-row ⋯ roster menu IF rows still read cramped.

---

## 2026-06-16 (session 150) — LiveKit migrated from Cloud → self-hosted on DigitalOcean: the cost decision + full server stand-up (no repo code change)

A long strategic + operational session. **No repo code changed** — the entire change is **infrastructure + three Vercel env vars.** Re-analyzed LiveKit Cloud costs, decided to **leave Cloud and self-host**, then stood up a working, TLS-secured, self-hosted LiveKit server on DigitalOcean and pointed RIM at it.

### Why we left Cloud
LiveKit Cloud meters **downstream data at $0.12/GB** (~$120/TB) over a 250 GB allowance. RIM's real pattern (~30 people, cameras on, ~6 sessions/wk) is ~2–4 TB/mo → **~$260–620/mo on Cloud** for all-camera circles — unsustainable for the center. (My original "really affordable" framing was under-modeled; owned to Jesse.) Self-hosting **bundles bandwidth** and keeps 100% of the built room (same open-source server + client SDK — only the server URL + keys change).

### Why DigitalOcean (not Hetzner)
Evaluated Hetzner (cheapest) but its cheap CX line + 20 TB traffic is **EU-only**; **Hetzner US CPX41 is ~$141/mo** (~4× EU — Jesse caught it on the create screen), making Hetzner-US *pricier* than DO. Hetzner-EU only wins on price if transatlantic latency is acceptable. Jesse chose **DigitalOcean US** (~$58/mo, low latency, friendliest) "considering how much we've been through" — certainty over squeezing the last $35/mo. Whole-thread principle: **don't decide on paper — measure/test cheaply.**

### What was stood up (verified live)
- **DO droplet** `RIM-LiveKit` (Ubuntu 24.04, US region, 4 vCPU/8 GB Basic, usage-based weekly backups, IPv6 off, free monitoring on). Public IP `104.248.229.126`.
- **DNS** (GoDaddy): `livekit` + `livekit-turn` A records → the droplet.
- **Docker** (official installer) → **LiveKit `generate`** ("LiveKit Server only" · Let's Encrypt · bundled Redis · Skip startup script) → `docker compose up -d` (livekit-server + Caddy/TLS + Redis). Config at `~/livekit.rootedinmindfulness.org/` on the droplet (`livekit.yaml` holds key/secret).
- **RIM repointed** via Vercel env (edited the existing three + redeployed): `NEXT_PUBLIC_LIVEKIT_URL=wss://livekit.rootedinmindfulness.org`, `LIVEKIT_API_KEY=APIk48Zv2jGTFGr`, `LIVEKIT_API_SECRET` (Jesse's password manager + the server's `livekit.yaml`).
- **Verified:** HTTPS `200 OK` + valid Let's Encrypt certs on both domains; RoomService API answers `OK` (project SDK); token-validate `success` (and `401` without a token); the `/admin/livekit-test` room connects on the new server.

### Two test-room quirks — both harness artifacts, NOT migration bugs
- **"We couldn't end the session"** in the admin test page: `end-session`'s `assertSessionDateInWindow` guard correctly refuses because the test page uses a make-believe program (`programSlug="test-room"`, no schedule/window). The server's room-ending API is proven working; real sessions pass the guard. App code unchanged by the migration.
- **No presence photo (camera off)**: the `testRoom` token branch seeds no avatar metadata and the test page passes no photo. Real sessions seed it.

### Important current-state change
**Krisp Enhanced NC is LiveKit-Cloud-only** → **now inactive** since we left Cloud. `useKrispNoiseFilter` degrades gracefully (processor undefined → Bell mode hidden), so sessions still run on the **browser's** noise suppression (on for non-teachers). The premium NC layer is gone until replaced.

### What this connects to
The whole session room (`components/session/*`, `VideoRoom.tsx`, `app/api/livekit/*`, `lib/livekit*.ts`) — the token route + `RoomServiceClient` now talk to the self-hosted server, no code touched. Stack Reference / SessionRoom / FEATURES / System Architecture all updated to "self-hosted."

### What comes next — next session "optimize LiveKit (quality + cost)"
Full brief in `UP_NEXT.md`. Headline reframe: **self-hosting bundles bandwidth, so video quality is essentially free within the droplet's transfer → the planned 360p tuning is no longer needed for cost; keep the quality Jesse likes.** Real work: (1) replace dead Krisp with a **free in-browser AI noise filter** (DeepFilterNet → RNNoise fallback; a custom audio track processor, sibling to `BrightnessProcessor`); (2) **harden** (DO Cloud Firewall to the 6 ports, OS updates + the requested reboot); (3) **real-session test** (avatars + End-for-All); (4) optionally rotate the API secret (pasted in chat).

---

## 2026-06-15 (session 149) — Session-room roster cleanup: ask-to-unmute on the tile, Mute All to the control bar, centered bar, decluttered participant list (UI-only, on `main`)

A focused session-room cleanup from Jesse's hands-on use of the LiveKit room. **One commit `5f8c13c` on `main`, deployed. UI-only — no new dependencies, env vars, services, or schema change; no API change** (Mute All reuses the existing `/api/livekit/mute-all`). Four files: `components/session/{RIMParticipantTile,ParticipantsPanel,RIMControlBar}.tsx` + `public/css/custom.css`. `tsc`-green, CSS brace-balanced (5062/5062), reviewer-gated (general-purpose sub-agent — no showstoppers, no should-fixes).

### Shipped (five asks + one)

1. **Ask-to-unmute on the tile** (`RIMParticipantTile`) — a muted remote participant's top-right hover slot now shows an **"Ask to unmute"** button (`.rim-tile-ask`, neutral, not red) exactly where **Mute** sits when they're unmuted. It publishes the same `UNMUTE_REQUEST_TOPIC` data packet the panel uses (imported from `ParticipantsPanel`; runtime-safe — the panel's back-import is `import type`, erased). Co-host only. The static "Muted" pill it replaces was removed.
2. **Name legibility + the phantom gap** (`ParticipantsPanel`) — the signal slot (`.rim-pp__signal`, a hard `min-width:32px`) was rendered on *every* row, so a 32px empty box sat between the row edge and every name. Now it renders **only** when there's a raised hand / reaction; otherwise the name starts at the row edge and reclaims the width.
3. **Mute All → control bar** (`RIMControlBar`) — moved off the list footer onto the bottom bar, **grouped with the co-host controls** beside Bell mode. Reuses `POST /api/livekit/mute-all`; label flashes "Muted N"; a real failure surfaces a transient `.rim-cb__notice` (the benign `muted:0` empty-room case stays silent — host controls must surface failure, not swallow it).
4. **Mic glyph removed** from list rows — the 🎤/🔇 is gone; mute state reads from the Mute vs "Ask to unmute" button label, and the tile nameplate still shows a mic-off glyph for everyone.
5. **Control bar centered** (Zoom-style) — `.rim-cb` became a `1fr · auto · 1fr` grid: the main cluster (`.rim-cb__main`, grid col 2) is truly centered, **End pinned far right** in `.rim-cb__end-zone` (col 3). The old left-justified look was a leftover `.rim-cb-spacer { flex:1 }` eating the slack and defeating the already-present `justify-content:center`. On ≤768px the grid collapses to a centered flex-wrap via `.rim-cb__main { display:contents }` (the proven pre-centering behavior).

### Design decisions & why

- **Keep the per-row Mute/Ask/Remove in the list, add ask-to-unmute to the tile (additive, not a move).** Tiles are hover-reveal — **no hover on touch** — so the participant panel is the *only* per-person action surface on a phone (44px targets). The tile affordance is a desktop convenience; the list stays the mobile path. (Jesse agreed with this in the map.)
- **True centering via grid, not balanced spacers.** A flex spacer/gutter approach leaves the cluster off-center by half the End button's width (End's intrinsic width loads the right side). `1fr auto 1fr` sizes the gutters purely by free space, so col 2 is genuinely centered regardless of End. End stays in its own zone (preserves the deliberate destructive-action separation).
- **Mute All grouped with co-host controls** (Jesse's pick), not next to Participants — the host-only cluster (Share / Bell / Mute All) stays together and the bar's left side reads identically for every participant.
- **The list is a roster, not a control panel** — removing the mic glyph + the empty signal gap leaves name + role pill (+ the co-host action buttons) as the "proper information." Clear seeing: the noise was obscuring the name.

### What this connects to

- **Session 147 ask-to-unmute flow** — the *receive* side (the "{Name} is inviting you to unmute" prompt in `RIMConference`) is unchanged; this added a second *send* surface on the tile. Same data-channel topic, same "we can never force a mic on" trust model.
- **Session 147 chat + participants shared right column** — the panel's narrower width since 147 is *why* the name squeezed; this cleanup is the right response to that layout.
- **The mute hotkeys (147) + Mute All** now both live on the bar as the host's mute toolkit.
- **Mobile-first** (CLAUDE.md) — the hover/touch split is the governing constraint; the ≤768px grid collapse keeps the bar usable on phones.

### What comes next

Live verification (needs a real session + a co-host + 2 devices): tile ask-to-unmute round-trip; full names with no gap; Mute All on the bar (count + a failure notice); no mic glyph; the centered cluster on desktop **and** a phone (centered wrap, End reachable, nothing clipped).

---

## 2026-06-13 (session 148) — Public-site design pass: warm palette + program-detail redesign + the flush-nav decision (UI-only; interleaved with session 147 on `main`)

A long, iterative design session on RIM's **public pages** — the rebuild Jesse has been circling. Entirely **CSS (`public/css/custom.css`) + `app/programs/[slug]/page.tsx` + `components/Nav.tsx`**; **no new dependencies, env vars, services, or schema change.** Many small commits pushed **direct to `main`** as a rapid push-to-see loop (Jesse co-edited the files and committed himself between turns — e.g. the initial warm-ground value `a1e85b2` "warm the neutral ground" is his commit). Work **interleaved with session 147's session-room commits** on `main` (147's log notes the same). Reference throughout: the **Esther Perel** site — taken *in spirit* (warm palette, card language, calm), not literally. Full design-system record + the two tombstones live in the new **`RIM_Public_Pages.md`**.

### Shipped (live)

- **Warm three-shade palette.** A named warm-neutral scale in `:root`: **Bridal Heath `#fffbf4`** (`--rim-bg-bright`, lightest, reserved) / **Dawn Pink `#f4efe8`** (`--rim-bg`, the page ground) / **Pearl Bush `#e7e0d7`** (`--rim-bg-accent`, recede/separation). The ground is Dawn Pink, **not** the lighter Bridal Heath, so white cards read as discrete objects — a near-white ground collapsed the contrast. (`5c43c91` cream/oat → `f05bc1b` the final three-shade scale.)
- **Main blue `#135274` → `#31576d`** (`adc0436`) — a softer slate-blue, the single token for hero / footer / buttons / links / teal-sections (`--rim-blue`). Catches the public hardcoded stragglers (footer bg, footer button, `.pg-/.pl-/.tw-hero::before` overlays); member/hub/admin internal-UI teal stays hardcoded (backlog).
- **`body { margin: 0 }`** (`64aa9fb`) — a real global fix: the browser's default 8px body margin was showing as a thin grey frame around every full-bleed section (hero, footer) on every page, since normalize.css isn't loaded and nothing reset it. (Jesse's eye caught it.)
- **`--card-shadow`** — one reusable, deliberately faint warm card-lift, shared by the quote + Details cards. The **second sanctioned exception** to the no-shadow rule (after `.rim-cb-popover`).
- **Slim flush nav** (`50c0dc4`) — `components/Nav.tsx` trimmed to **Programs ▾ · Get Involved ▾ · Members ▾ · Donate** (Courses + Teachers dropped from the bar; "Member Area" → "Members").
- **Program-detail redesign** (`/programs/[slug]`): hero pulled tight + balanced (title 46px + `text-wrap: balance`, subtitle 20px/400 + balance, category returned as a quiet **uppercase eyebrow** `.pg-hero__eyebrow` linking to the catalog — `9193c93`); the **quote card** straddles the hero/ground seam (22px/400 contemplative serif, `--card-shadow`); **Details** became a **white card** with **Register as a pill button** (`6e470dc` — the actionable `.pg-detail-cta__link` styled as a button; informational `__text`/`__status` states stay quiet text — the split was already in the markup); **Notes** became a **recede panel** (Pearl Bush, `3e870c0`).

### Tried & reverted (tombstones — do not re-propose; full rationale in `RIM_Public_Pages.md`)

- **The Esther-Perel floating nav pill** (`50c0dc4` … → revert `723af6b`). RIM's heroes already have a featured floating object — the quote card — so the pill became a *second* white rounded object stacked above it on the same dark hero. Two competing objects: the busyness was the "off" Jesse felt. Reverted to the flush bar (kept everything else). The float works on her site only because her hero has no card under it.
- **Chapter eyebrows + a Pearl Bush closing-invitation band** on the program page (`77edca8` → revert `06a041b`). "Didn't feel well designed aesthetically." The lesson: **a sparse version of a rich pattern reads as cheap, not minimal** — her eyebrows + color bands work inside a rich composition (illustrations, scale, color confidence); transplanted into a sparse reading column they read as form-label + newsletter-furniture.

### Design decisions & why

- **Cards lift, prose stays open, panels recede** — the surface language. **Boxing the description was explicitly rejected** (it cramps the most contemplative thing on the page and dilutes what a box *means*). The contrast between lifted and un-lifted *is* the design.
- **Subtler shadow than instinct** — Jesse calibrated `--card-shadow` to "a whisper" against the reference; the white-on-warm + rounded corners do the separating.
- **Content-agnostic line shape** — `text-wrap: balance` on title + subtitle (rather than tuning one program's wrap), since every program has different-length copy.

### What this connects to

- **Every page** — the palette tokens (`--rim-bg`, `--rim-bg-accent`, `--rim-blue`) and the `body` margin reset are global; the nav is global. Member/hub/admin surfaces shifted to the warm family too (with the noted teal stragglers).
- **The public-page rebuild** (FEATURES "Public site"; backlog `2026-06-01-001`) — this session is its real start; the design system now has a home in `RIM_Public_Pages.md`.
- **The home page** — its alternating `.rim-section--grey` sections now flatten on the warm ground (they use the primary token); they need the Pearl Bush secondary for rhythm (backlog `2026-06-13-002`).
- **The course landing page** — sibling public-detail page, still on the old colon-heading language; should adopt this system (backlog `2026-06-13-003`).
- **The offering KIND model** (`lib/programKind.ts`) — the category eyebrow reads the category; the (reverted) kind-aware "About this {kind}" heading read `kindLabel`.

### What comes next

Verify the program page across a few programs (a drop-in, a registered one, one with Notes); the home page (sections + warm ground + the nav seam now the float's gone); the member-area teal sweep; whether the public-detail pages want *any* more rhythm (and if so, with real composition, not scaffolding). **Process change adopted:** new *compositional* elements → a `claude/*` preview branch before production; spacing/color/token tweaks stay direct-to-`main`.

---

## 2026-06-11 (session 147) — Echo diagnosis (strategic, no code) + session-room batch (crash safety net, context-aware Step-In, ask-to-unmute, remove participant, chat+participants split) + mute hotkeys (M toggle / Space push-to-talk)

Three arcs. **Arc 1:** a deep diagnosis of the **LiveKit self-echo** problem ("people still hear themselves echoed through me") — no code, a strategic conclusion. **Arc 2:** a **five-feature session-room batch** from a hosting-coordinators meeting (Jesse, Maria, Nancy) — one commit `cb9ab8a` on `main`, deployed. **No new dependencies, env vars, or services.** One new `SessionBan` model + idempotent migration `session_bans_v1`. Reviewer-gated (general-purpose sub-agent, 10 findings), `tsc`-green, CSS brace-balanced (5058/5058). **Arc 3** (a same-thread follow-on after the echo conversation continued past the first closing): **mute hotkeys** — two more commits, `ca885ff` (M toggle) + `84e151c` (hold-Space push-to-talk), reviewer-gated, `tsc`-green. (History note: concurrent UI work from other sessions — palette / program-detail eyebrow / nav — interleaved into `main` between these commits; `cb9ab8a` + `144d404` verified still in HEAD's ancestry, content byte-identical, all deployed.)

### Arc 1 — Echo (diagnosis + strategic decision, no code)

Remote participants hear their own voice echoed back through Jesse's endpoint while he teaches. Investigation (code + git history + web research) established the honest mechanism and **ruled out a code defect**:
- **Echo cancellation is already ON** for all three audio profiles (`VideoRoom.buildRoomOptions`), and has been since April (`261a6fe`). Exactly one `RoomAudioRenderer`, no local-audio loopback. So the remaining echo is acoustic/endpoint, not a missing constraint.
- **The source is an endpoint, never the listener.** A person hears their double only because some *other* endpoint's open mic is re-broadcasting the room. Browser AEC can't cancel loud speakers, split-device (mic on one device, sound out another), or cross-device audio. Confirmed: Jesse's rig is a **wireless wearable mic through a Universal Audio Volt interface with sound playing out computer speakers** — the textbook split-device case AEC can't win. Turning speaker volume down reduced the echo (the diagnostic that confirms it).

**Options, researched + priced** (the "are we stuck / should we have chosen differently" question):
- **$0 — endpoint fix (chosen):** route output to a headphone so the mic never hears the room. Jesse will test **AirPods Pro output-only** (mic stays on the Volt, transparency mode for presence); a clear-tube IFB earpiece off the Volt is the invisible option.
- **$0 — macOS Voice Isolation** (Control Center mic mode) and **$0–8/mo — Krisp desktop app** (the same tech LiveKit resells, retail per-machine, free 60 min/day): both run on the *source's* machine and strip other voices from its outbound mic, but sit upstream of Bell mode (would eat the bell → a toggle each time; a headphone avoids that friction).
- **$50+/mo — LiveKit Krisp BVC** (in-room background-voice-cancellation, "Zoom-parity armor"): works in the browser now, small code change (`@livekit/krisp-noise-filter` 0.3.4→0.4.3 + `useBVC`), BUT needs LiveKit's **Ship plan ($50/mo) + $0.0012/min metered** → ~$55–90/mo. **Rejected on cost.**
- **Native app:** technically real (inherits FaceTime-grade system AEC, no permission nags) but rejected — app-store friction (the thing we left Zoom to escape) + permanent double-maintenance. Reaffirms the session-120 rejection.

**Strategic conclusion (the decision):** the platform choice **stands.** The real fork was always *native app vs browser*; we chose browser for cost + integration + no-install joining, all still true. The echo is an endpoint audio-routing habit, not a systemic browser failure or a wrong-platform mistake. **"Layer 1" (in-room detection nudging a mismatched endpoint to fix its output routing) was scoped but NOT built** — Jesse declined for now (the confirmed source is his own endpoint; sessions already invite people to mute). Free, code-only, available later if member-side echo ever materializes; BVC stays shelved as the documented escalation. Recorded in `RIM_SessionRoom.md` (Audio & echo).

### Arc 2 — Session-room batch (5 features, commit `cb9ab8a`)

Connections-mapped + approved before building.

1. **Crash safety net (the launch blocker).** Root cause: **there was no React error boundary anywhere in the app.** When Jesse shared his screen, every *remote* participant's RIMConference threw while rendering the incoming share, and with no boundary each fell to Next's white "Application Error" screen — looked like the meeting died; really N browsers crashed independently on the same receive event (Jesse the *sender* stayed in, confirming the crash is on the *receiver* path). New `RoomErrorBoundary` wraps `VideoRoom`: a render crash now degrades to a contained "Something interrupted the room — Rejoin" screen and logs `[rim-room-crash]` + component stack. The specific throwing line still needs the console from a two-window repro (the boundary makes that capture safe). Maria's "Zoom note-taking popup" = her local Zoom browser extension, not our code.
2. **Context-aware Step-In + confirm.** Nancy (acting host, not the *assigned* host) saw "Step in as Host" and clicked it cold. `RIMConference` now derives host-presence from participant metadata and reports up; the header button reads "No host yet — Step in" / "Take over as host" / (unknown) "Step in as host", and a plain-language confirm panel opens before the API call.
3. **Ask-to-unmute.** Co-hosts get "Ask to unmute" on muted roster rows → a data-channel packet (`UNMUTE_REQUEST_TOPIC`, addressed to that identity) → the recipient sees a calm "{Name} is inviting you to unmute — [Unmute] [Stay muted]" prompt; their own tap performs the unmute (browsers never let you force a mic on — the correct boundary). Sender gets "Asked ✓" feedback.
4. **Remove participant + session bans.** New `POST /api/livekit/remove-participant` (co-host gated, mirrors mute) with a 3-option confirm: remove-can-rejoin / remove-for-the-session / cancel. "For the session" writes a `SessionBan` row; `/token`, `/guest-token`, AND `/step-in` all refuse banned identities (members by id — ADMIN/GT exempt; guests by case-insensitive display name). Removed users get an honest "You've been removed" screen (new `removed` LeaveKind — `PARTICIPANT_REMOVED` no longer maps to the false "Session ended — thank you for practicing together").
5. **Chat + Participants split.** Both panels share the right column on desktop (Zoom-style stack, each flex 1 1 50%); phones (≤768px) keep the overlay behavior via `display:contents`.

**Reviewer pass — fixed before commit:** (1) **step-in ban bypass** — a banned host-team member could re-enter *as the Session Host* through Step-In; now ban-checked before the HostAssignment upsert. (2) **guest Rejoin stale-token remount** — `joinAsGuest` never passed through "loading", so a crash-boundary Rejoin remounted the old token and livekit-client's already-connected early-return silently discarded the fresh one; now sets "loading" first. (3) **member-ban name collateral** — `name` stored only for guest identities (a member ban no longer blocks a same-named guest). (4) **stale host-presence reset** on leave/load. (5) **430px touch target** on Remove. Plus the honest removed-screen.

### Arc 3 — Mute hotkeys, and where the echo arc actually landed (commits `ca885ff`, `84e151c`)

After the first closing, the echo conversation continued and **resolved — not with a purchase or a rebuild, but with mute discipline + a hotkey.** The honest landing across the deeper exploration:
- **The teacher can't use the endpoint headphone fix.** Jesse leads with open room speakers, bare-faced, ringing a physical bell — gear strapped on is cumbersome and breaks presence (a RIM-philosophy constraint, not a preference). So every $0 headphone / output-routing option is off the table *for him*.
- **The cheap retail option is the Krisp *desktop* app** (krisp.ai/noise-cancellation) — the same BVC + echo-cancellation tech LiveKit resells, bought per-machine: free tier (the pricing page reads as a 7-day trial; whether echo/BVC vs only *noise* persists on a permanent free tier is unconfirmed — test before banking on free) or ~$8/mo Core. Runs on the source's machine, one-click toggle (in Krisp's menu bar, not our Bell button), works today with no code. **macOS Voice Isolation** (Control Center mic mode) is the free Apple-system-AEC equivalent, same upstream-of-Bell-mode caveat.
- **LiveKit nonprofit discount:** none published; self-hosting the OSS server does NOT include Krisp BVC (Cloud-only). The only lever is "contact sales" — not pursued yet.
- **The "app" Jesse kept circling = the Krisp desktop app, not a native RIM app.** Native-RIM-app reaffirmed-rejected (iOS can't side-load from a website even with coder-time compressed; permanent parallel maintenance; and the GitHub issue Jesse surfaced — `client-sdk-swift` #916 — was itself a *native-SDK AEC regression*, evidence native AEC isn't bulletproof either).
- **The actual resolution: mute while others talk.** The echo loop only closes when an open mic re-broadcasts the speakers — mute during others' speech and there's nothing to echo. Jesse reasoned straight to it ("I can just press mute LOL").

So we built the hotkeys:
- **`M` toggles mute — everyone** (`ca885ff`). The *safe* hotkey: an accidental mute is harmless, the state is always visible in the control bar, and it never fires while typing in a field (input/textarea/select/contenteditable) or under an OS chord (⌘/Ctrl/Alt) or on key auto-repeat. A ref keeps the document keydown listener reading current mic state without re-subscribing on each flip. Quiet discoverability via the mute button's `title` tooltip.
- **Hold-`Space` push-to-talk — co-hosts/teachers only** (`84e151c`). Hold to talk *while muted*, release to re-mute. Kept off the general member population because Spacebar is overloaded (scroll / activate a focused button) and an accidental unmute would break a silent sit. Safety set: engages ONLY when already muted (so it never surprise-mutes a host who's unmuted via M; fails **closed** in the rare M-mute-in-flight window — documented in code), ignores auto-repeat / OS chords / typing, `preventDefault` claims the key (no scroll, no button activation), and **two stuck-open backstops** — window `blur` AND `visibilitychange` — re-mute if a hold is interrupted (tab switch, OS overlay, screen-share picker). A second reviewer pass verified against LiveKit source that the keydown-`true`/keyup-`false` sequence reliably ends muted (no open-mic race) and prompted the `visibilitychange` backstop + the keyup-not-gated-on-`inField` comment.
- The **bell is untouched** — you're unmuted (via `M`) when you ring it; only push-to-talk's brief windows are momentary.

Where the whole echo odyssey lands: **a mute key and a good habit, $0** — with Krisp desktop (~free–$8/mo) as the optional hands-off backstop and LiveKit BVC shelved unless ever wanted team-wide and wired to the Bell button.

### What this connects to
The whole session room (`/session/[slug]`, `VideoRoom`, `RIMConference`, `ParticipantsPanel`, `RIMControlBar`, all `/api/livekit/*`) · the permission model (`resolveSessionRole`, `isCoHost` gate reused by remove-participant) · Step-In (now ban-aware + auto-enrolls per session 146) · the Scheduler/HostAssignment ledger (Step-In still writes it) · the time-gate (`assertSessionDateInWindow`, reused by remove) · the data channel (ask-to-unmute joins chat/reactions on it; the unread-badge listener correctly ignores the new topic). No hub-coverage routing, editor, registration, or auth changes. **No email templates touched.**

### What's next
- **The screen-share repro** — Jesse: two windows, console open on the *viewer*, share → paste the `[rim-room-crash]` entry so we can fix the specific throwing line (the boundary already contains it). Backlog `2026-06-11-001`.
- **Co-host can ban the assigned host** — open design question for Jesse (mute has the same peer surface but a ban's blast radius is larger). Backlog `2026-06-11-002`.
- **Echo:** the resolution is mute-discipline + the new hotkeys; Jesse may also test the **Krisp desktop app** (free trial → ~$8/mo) or **macOS Voice Isolation** as a hands-off backstop. AirPods/headphone ruled out for the teacher (open speakers + bell + presence). Layer 1 + LiveKit BVC remain shelved. Backlog `2026-06-11-003`.
- **Mute hotkeys** — verify deployed: `M` toggles your mic (and types normally in chat / search / settings); a co-host holding `Space` talks then auto-re-mutes on release; the mute-button tooltip shows the Space hint for co-hosts only. Push-to-talk is co-host-only by design.
- Guest-rename ban evasion is a documented limitation (re-remove); member bans are airtight.

---

## 2026-06-10 (session 146) — Scheduler membership invariant + per-hub gating + every-hub coverage notifications

Started from Jesse's worry that the **shared Scheduler across hubs** (host-team / AV / greeter / peer-led) was getting entangled — concrete symptom: in the greeter hub, **Nancy showed as a volunteer covering sessions but didn't appear in the member "pill" picker.** It became an evaluation of the shared-component approach, then five fixes that all traced to one root insight. **Five commits on `main`, all deployed. No new dependencies, env vars, or services.** Two flag-guarded migrations (`backfill_host_team_membership_v1`, `heal_membership_orphan_assignments_v1`); no schema change. Reviewer-gated + `tsc`-green per slice.

**The evaluation (the answer to "is the shared base right?").** Two read-only investigators audited the Scheduler — one root-caused Nancy, one inventoried every hub-scoping site against the four routing layers. Verdict: **keep the shared component — it's holding.** The audit found NO cross-hub leaks; per-hub variation is absorbed by hub-config fields (`allowsMultipleAssignments`, `appliesToFormats`, `coverageNoun/verb/action`, `ProgramCoverageHub`), not per-slug branches. **The Nancy bug is not an entanglement bug** — it's a referential-integrity gap that would exist in a per-hub-component world too. Splitting would multiply the drift surface ~4×, the opposite of what Jesse wanted.

**The root insight — two sources of truth.** The Scheduler draws "who's covering" from the `HostAssignment` *ledger* but the member picker from the `HubMember` *roster*, and nothing kept them in agreement. Nancy had a greeter `HostAssignment` but no greeter `HubMember` → shown as covering, absent from the picker (the show-but-can't-act failure). Three orphan sources confirmed in code: the role fallback (assign without membership), the apply cron (rotation candidates unchecked for membership), and **member hard-DELETE leaving assignments behind — the most likely Nancy cause.**

**Shipped (five commits, in order):**
- `1c22a3c` **Membership invariant + per-hub gating + heal.** Jesse chose (AskUserQuestion) to enforce "covers ⇒ member" AND realize his instinct that you shouldn't see a hub's scheduler unless you're on that team — access was at the *tool* level, not per-hub. New `lib/hubAuth.ts::canAccessHubScheduler` (member of the hub OR HOST_MANAGER/ADMIN/GT) gates the page + month-nav GET + create POST. Self-claim auto-enrolls (`ensureActiveHubMembership`); assign-others requires real membership (no role fallback); the cron drops non-member candidates; the member DELETE cleans up future assignments + rotation rules (FK-safe). Migrations: backfill (every HOST/HOST_MANAGER → host-team row, so the gate can't lock out legacy role-only hosts) THEN heal (delete future orphans + orphan rules, logged — Jesse chose heal-live). Reviewer caught a 4th orphan source — **Step-In** — now auto-enrolls too.
- `890c50c` **Member-view filter is claimant-aware.** The pill filter used `hostUserId === selectedMember` — null on every greeter (multi-claim) row, so a greeter's signups never showed. New `sessionBelongsTo(s, userId)` (single host OR a claimant) drives the filter + count. (The literal "click Nancy, see nothing" follow-on.)
- `8234161` **Empty "Mine" state uses the coverage verb** ("not greeting" / "not covering AV", not "not hosting").
- `d3e4457` **Multi-claim header speaks the coverage noun** — "We have 1 greeter" / "2 greeters" (Jesse's wording), self-recognition preserved, AV stays uppercase.
- `2a87e1a` **Every scheduler hub gets the new-coverage notification.** Closed a documented gap (only the primary host hub was notified, only on create). New `lib/email.ts::notifyHubOfNewProgramCoverage` notifies each auxiliary hub (AV/greeter) when tagged — on create AND when added on edit (the PUT diffs `coverageHubSlugs` against existing rows so re-saving doesn't re-spam; removals stay silent). Reuses the already-hub-neutral `new-program-needs-host` template — **no new slug.**

**Key design decisions:**
- **Shared component, hub-config variation — affirmed with evidence,** not loyalty to the earlier reassurance. The audit is the evidence.
- **Enforce at the door, not reconcile after** — per-hub gating makes "non-members can't reach a hub's board" true, closing the self-claim orphan path by access control; auto-enroll is the thin safety net for oversight roles who can still reach any hub.
- **Backfill before heal** — load-bearing order: without the host-team backfill, the heal would misread legacy role-only hosts as orphans. Vercel runs migrations before serving the gated code, so no lockout window (reviewer-confirmed).
- **Per-hub email grain** — a dual-hub member gets one email per role (each with that hub's noun + scoped link), by design, not deduped per-person.

**Process change (Jesse's ask):** added closing-ritual **step 4e — email-template audit** to CLAUDE.md: every session, verify any new/changed `sendTemplatedEmail` slug is seeded in `migrate.mjs` so it appears in `/admin/emails`. Backstops the always-on Email Template Gate at closing.

**What this connects to:** the whole Scheduler (`/tools/schedule`, `HubScheduleClient`, `RotationsClient`, `applyStandingAssignments`, `/api/host/*`) · hub membership authority (`HubMember`, `lib/hubMemberAuth`, `lib/hubAuth`) · the member hard-remove route · the apply-standing-assignments cron · the session room (Step-In writes a HostAssignment → now auto-enrolls) · the program editor's auxiliary-coverage tagging (`ProgramCoverageHub`) · the Email Template Gate (reused `new-program-needs-host`) · the coverage-copy system (`getHubCoverageCopy`). No editor / registration / auth changes.

**What's next (deployed-site verification, none blocking):** (1) confirm both migrations in the deploy log — esp. the heal's orphan list (Nancy among them); if anyone removed should've been kept, add their hub membership and they re-sign-up. (2) greeter: a member's pill filter shows their signups; the header reads "We have N greeters." (3) a host-team-only coordinator can no longer edit the greeter board (intended — needs greeter membership or a manager role). (4) tag a program for greeter → the greeter team gets "may need Greeter coverage"; re-saving doesn't re-notify.

**Deferred:** reviewer nit — the coverage-hub write routes validate slug existence but not `appliesToFormats` overlap (editor prevents mismatches; a tampered payload could tag a format-mismatched hub). Backlog `2026-06-10-001`.

**Memory candidates (step 8b):** one proposed (awaiting Jesse's confirm) — **feedback: "two sources of truth"** — when one concept is read from two tables (a `HostAssignment` ledger vs a `HubMember` roster, "who's covering" vs "who's on the team"), nothing keeps them in sync; it presents as a UI/entanglement bug but is a data-integrity gap — enforce the invariant at every write + clean up on delete, never patch the display alone. The other lessons this session (evaluate-with-an-audit before validating a split; shared-base-differs-by-config) are already covered by `feedback-measure-before-agreeing` / `feedback-shared-surface-audit` + `RIM_Hub_Engineering.md`, and the "all hubs same notification system" principle is now encoded in CLAUDE.md step 4e — no new files for those.

---

## 2026-06-09 (session 145) — Member migration (Memberstack → RIM) + pre-launch fixes: name normalization · auth-page CSS · welcome-back · hub terminology

A long pre-launch session. The spine: **migrating ~1,500 existing members from the old Webflow/Memberstack site into this app**, end to end — then a run of fixes Jesse surfaced while testing the live flow. **Eight commits on `main`, all deployed. No new dependencies, env vars, or services.** One new `User.isLegacyUnclaimed Boolean @default(false)` column; four idempotent flag-guarded migrations (`user_is_legacy_unclaimed_v1`, `seed_welcome_back_email_template_v1`, `normalize_user_names_v1`, `update_coverage_email_copy_v1`). Every substantive commit reviewer-gated + `tsc`-green.

**Opening correction.** `UP_NEXT.md` described session 144 as sitting on an unmerged branch; git showed it had already been fast-forwarded to `main`, pushed, and deployed (branch deleted). Corrected the doc from the verified git state, not the prose.

**The migration model (planned with Jesse, EnterPlanMode).** Silent import → quiet pool → promote-on-login:
- Import every legacy member as an inert **`isLegacyUnclaimed`** account (`agreedToTerms:false`, `emailVerified:null`) — structurally identical to the session-142 staged-host pattern, so silence (the pre-threshold email gate), cron-survival, and promote-by-email came mostly for free.
- On first login they cross the **same Community Care Agreement gate** as a new member (fresh consent — Jesse's call, not pre-accepted); completing it flips `isLegacyUnclaimed → false` (promotion) at **both** agreement doors (`complete-profile` for the `/login` path, `join` for the `/join` path), preserving any pre-staged role/hub/schedule.
- The quiet pool is **hidden from the default `/admin/members`** (server-side `where` = OR of `isLegacyUnclaimed:false` / has-role / has-hub) but reachable via `?pool=legacy`; the cleanup cron exempts it. Memberstack activity (last login, attendance, activity count, member-since) is parked on the existing `legacy*` fields for later triage.

**Shipped (eight commits, oldest→newest):**
- `b0e344d` **Step 1 — migration scaffolding.** The marker + migration; cleanup-cron exemption; promotion flip (both doors); registry filter + `?pool=legacy` toggle + a "Legacy" badge; the `welcome-back` email (seeded); and the admin **"Send sign-in code"** helper (`POST /api/admin/members/[id]/send-signin` + `AccountAccessSection`) — the pastoral "send a stuck member a way in," reusing `signIn("resend")`, ADMIN/REGISTRAR-gated, rate-limited, refuses archived.
- `d342fc1` **Step 2 — the import tool.** An ADMIN-only browser tool (`/admin/import-legacy` + route + `lib/legacyImport.ts` + `LegacyImportClient`) that runs on Vercel (the DB is unreachable from the local sandbox, even sandbox-off). Upload the CSV → preview (dry-run, no writes) → import. Create-only marking + a bulk `createMany` for new rows + bounded-concurrency updates for collisions; idempotent.
- `2c41f3b` **+ clear-pool** (DELETE) so a test batch can be purged before the real run.
- `71ea78d` **Legacy-pool display** — a muted **"Unclaimed"** status pill replacing *both* the wrapping "Legacy" name-badge and the misleading green "Active" (every import inherited `memberStatus` default ACTIVE — the screen was asserting something untrue about 1,500 people who'd never logged in).
- `3c543da` **Removed the import tool** (page + route + client + lib) once the import was done — restorable from git history.
- `ea93963` **Name normalization** — `lib/nameCase.ts::toProperName`: conservative proper-case (only re-cases entirely-UPPER or entirely-lower names; protects intentional mixed-case — McDonald, DeShawn, van der Berg; trims whitespace; title-cases hyphens/apostrophes). Applied at the casual entry points (`/join`, registration, welcome/complete-profile, admin "+ Add member"); one-time `normalize_user_names_v1` re-cased existing rows (validated against the real export first: 141/3030 changed). Deliberately NOT on the admin member-EDIT or a member's own profile — those stay type-exactly, the hand-fix path for the few the rule under-corrects (all-caps Mc/Mac, 2-letter initials).
- `b1b5411` **Welcome-back page copy** — `/account/welcome` greets a returning legacy member ("Welcome back… a new website and home… revisit our community commitments… Step back in →") instead of the brand-new-member copy, keyed on `isLegacyUnclaimed`. Completes the fresh-agreement-with-welcome-back-copy promise (mechanism + email shipped in Step 1; this is the door).
- `bec6685` **Auth-page CSS** — `/login`, `/login/check-email`, `/login/error` spilled full-width: they use legacy Webflow classes (`.container-7-copy`, `.login-box`) + the native six-box code form (`.sic-*`), all of whose CSS lived only in `rim.webflow.css`, which the app no longer loads (Webflow-retirement; `custom.css` carries a shim that didn't include them). Added a token-based, mobile-safe shim for the auth-only classes — a centered ~440px column + a real six-box code input.
- `519b378` **Hub terminology** — finished wiring `getHubCoverageCopy()` through the surfaces that still hardcoded "host": the dashboard welcome panel ("you're on the {Noun} team"), the hub home/sidebar coverage count (generalized `hubContext` from a host-team-only case to host-team / audio-visual / peer-led, each counting its own unclaimed slots in its own noun + hub-scoped — also fixed a latent bug where the host-team count summed *every* hub's gaps), and the emails (new-program gains `{{coverageNoun}}`; the four assignment/sub templates re-seeded hub-neutral via `update_coverage_email_copy_v1`).

**Key design decisions:**
- **Passwordless stays.** Jesse weighed passwords; the deciding points: a *recoverable* password is a security no-go, the 90-day session means re-login is rare, and the migration needs *nothing* from a member. The pastoral "help a stuck member in" instinct is met by the admin Send-sign-in-code helper, not a password.
- **A boolean marker, not a `MemberStatus` enum value.** `memberStatus` is rendered + validated in several places and is orthogonal to "claimed yet?"; a self-clearing boolean touches no display code and lets a promoted member keep their real status.
- **Browser import tool (then removed), not a committed-CSV migrate block.** Keeps 1,500 members' PII out of git history; runs where the DB is reachable (Vercel). The local script's dry-run validated the field mapping with no DB. (Member ID intentionally NOT imported — it only points back at the system being retired; email is the join key; `legacyMemberstackId` was removed in session 100.)
- **Conservative name normalization** — a name is identity, so only the clearly-broken (all-caps/all-lower) get re-cased; mixed-case is left exactly as typed. Validated against the real data before touching anyone.
- **Hub-NEUTRAL email copy over per-noun substitution** — "confirmed for" / "your session" reads cleanly for every hub; reserve the actual noun for where naming the role genuinely helps (the welcome panel, "may need AV coverage"). Sidesteps the awkward "host this" grammar of the coverage `action` field.
- **Two defensible non-changes:** the dashboard early-open "Enter as host" names the live session-ROOM role (whoever opens the LiveKit room), not hub coverage; greeter (multi-claim) has no unclaimed-slot concept, so it shows no coverage count.

**What this connects to:** Auth (`/login`, `/join`, `/account/welcome`, the agreement gate, `signIn("resend")`, the rate limits) · the Member Registry (`/admin/members`, the legacy pool, name normalization at every name-write site) · the `cleanup-incomplete-accounts` cron · Registration (name normalization on guest registration; the held-row → webhook path inherits it) · the Email Template Gate (`welcome-back` seed + the 4-template re-seed) · the Scheduler / hub coverage-copy system (`getHubCoverageCopy`, `hubContext`, the dashboard host-welcome panel) · the Webflow legacy shim in `custom.css`. No editor / Tiptap / session-room changes.

**What comes next:** (1) **deployed-site verification** — confirm `normalize_user_names_v1` + `update_coverage_email_copy_v1` in the deploy log; review the 4 re-seeded templates + the welcome-back letter at `/admin/emails`; hand-fix the handful of name oddballs (Mc/Mac, TJ); (2) the **AV welcome-panel** can't be re-seen without resetting `hostWelcomeSeenAt` (one-time) — reset on Jesse's account or use a fresh AV-staged login; (3) **the other public pages** (`/donate`, kalyána-mittá, volunteer) share the same Webflow-shim gap and likely spill full-width — part of the public-page rebuild; `/donate` is launch-relevant.

**Memory candidates (step 8b):** proposed at close — (1) **project:** production Neon is unreachable from this machine even sandbox-off → one-time prod DB ops run on Vercel (a `migrate.mjs` flag-guarded block, or a temporary ADMIN browser tool); the offline script `--dry-run` validates logic without DB. (2) **feedback:** for shared copy across differently-named consumers, prefer hub-NEUTRAL wording over awkward per-noun substitution; reserve the actual noun for where naming the role helps. Awaiting Jesse's confirm.

---

## 2026-06-09 (session 144) — Pre-launch session-room integrity audit + hardening (the LiveKit "Zoom alternative")

Jesse's ask: a thorough integrity check of the LiveKit session room before go-live ("we don't have the luxury of a gradual transition"). Ran a **multi-agent integrity audit** (opt-in `Workflow`), then fixed everything real it surfaced. **All work on branch `claude/session-room-hardening` — 9 commits, 17 files, +529/−112, NOT yet merged to `main`** (deploy awaiting Jesse's go). Every substantive commit reviewer-gated + `next build`-green. **No new dependencies, env vars, or services. No DB migration** — the one schema touch was a comment; STEPIN-1's fix is a runtime Postgres advisory lock.

**The audit.** The workflow fanned out 8 failure-mode dimensions (auth resolver · action-route gates · time gate · join flow · connection lifecycle · layout · controls/chat · A/V), each finding independently re-verified by an adversarial skeptic against the real code, then a coverage critic for what the dimensions missed. 30 agents, 21 findings. The adversarial pass earned its keep: it **refuted LAYOUT-1** as a false alarm — but a parallel session had already fixed LAYOUT-1, and on inspection the parallel fix was correct and the audit's refutation wrong (the `.rim-pin-banner` is the real Unpin path; the carousel-tile Unpin was a redundant secondary). Recorded as real-low-fixed. (Full findings + verdicts + the coverage checklist: workflow output `tasks/wqgwkr4vj.output`.)

**Shipped (9 commits, oldest→newest):**
- `10b3802` **LAYOUT-1** — filter the focused track out of the carousel filmstrip so a focused camera doesn't render twice (parallel-session fix, verified + committed).
- `03741b7` **TOKEN-1** (high) gate the `testRoom` token branch on ADMIN — room names are public `slug-YYYY-MM-DD`, so any member could POST one and join any live session, bypassing the time gate + presence; **CHAT-1** (high) reject any guest `guestIdentity` lacking the `guest-` prefix on chat POST+GET — a guest could pass a member's cuid to read their private DMs / forge messages "from" them; **TOKEN-3** validate the admin-bypass sessionDate.
- `ada6946` **CONN-1** (critical) `LiveKitRoom` had no `onError`, so a failed connect stranded the user on "Connecting…" forever — added `onError` → a recoverable "Connection lost — Rejoin" screen; **CONN-2/3** classify `DisconnectReason` so a network drop / second-tab eviction no longer falsely read "Session ended."
- `77f84b6` **JOIN-1** (high) a no-webcam desktop threw `NotFoundError` on the combined getUserMedia → infinite Recovery loop; now retries `{audio:true}` so audio-only members can join.
- `282744b` **End-for-All silent failure** (blocker, from the coverage critic) — EndMenu swallowed the result; now checks `res.ok` and surfaces a failure instead of closing the menu on a still-live room; **MUTE-1** guard the mute routes' SDK calls (a departed participant no longer 500s; mute-all is per-track resilient); **CHAT-3** panel mute feedback on real failure.
- `4149e96` **rate-limiting** on the open-access `chat` (30/60s per identity) + `guest-token` (10/60s per IP) routes via the existing Postgres limiter (its first non-auth use); **CHAT-2** add `assertSessionDateInWindow` to the chat POST (the one consequential route that lacked it).
- `2108074` **CONN-4** reconnecting banner; **TOKEN-2** forge-proof "Guest" badge (keyed on the immutable `guest-` identity prefix) on tile/roster/chat; **TG-3** room-name doc fix.
- `0236654` **STEPIN-1** two volunteers tapping Step-In at once could mint two hosts — wrapped the find-then-write in a `$transaction` + a transaction-scoped `pg_advisory_xact_lock` keyed per-session.
- `291fa8d` mobile touch targets (mute buttons, header icons, view toggle → 44px on touch), chat recipient select → 16px (iOS no-zoom), Escape-to-close on the End menu.

**Key design decisions:**
- **Advisory lock over a unique index (STEPIN-1).** A DB unique on `(programSlug, sessionDate, hubSlug)` is impossible — `host_assignments` is shared with the multi-claim greeter hub, and `allowsMultipleAssignments` lives on `Hub`, not the table, so the constraint would forbid legitimate greeter rows. A per-session Postgres advisory lock serializes concurrent Step-Ins without that. **`xact`-scoped is mandatory** under Neon's PgBouncer (transaction-mode) pooling — a session-level lock could be acquired and released on different pooled backends and leak.
- **Classify the disconnect reason in `VideoRoom`, hand the page a string union** (CONN-2/3) — keeps `livekit-client` out of the page bundle while letting the page show truthful screens (ended / lost / duplicate).
- **Guest legibility via a forge-proof badge, not a name prefix** (TOKEN-2) — the LiveKit identity (`guest-…`) is server-issued and immutable; a display-name prefix could be stripped client-side via `setName`.
- **Restraint on the risky/uncertain.** TG-1 (DST gate drift) touches time math shared across the dashboard/scheduler/This-Week → deferred to a data-check, not surgery days before launch (Jesse's call). TG-2 (recurrence-count edge) is dormant (live sits are open-ended) → post-launch. Control-bar 2-row wrap + popover focus-trap need real hardware → manual pass. Recording is off (documented, no indicator). Empty-room cleanup → verify LiveKit's default.

**What this connects to:** the entire session room (`app/session/[slug]/page.tsx`, `components/VideoRoom.tsx`, all `components/session/*`, `app/api/livekit/*`, `lib/livekit.ts` / `livekitAuth.ts` / `sessionWindow.ts`); the **Scheduler** (Step-In writes the shared `HostAssignment` join key; the multi-claim greeter constraint shaped the STEPIN-1 fix); **`lib/rateLimit.ts`** (extended from the auth doors to the open-access session routes); the dashboard early-open handoff; the Hub model. No editor / Tiptap / content-block changes.

**What comes next:** (1) **deploy** — fast-forward `main` + push (→ `rim-next.vercel.app`) or a branch preview, awaiting Jesse's go; (2) **real-device verification** (the manual checklist — the true pre-launch gate); (3) the **deferred items** above. Two reviewer-flagged doc notes recorded in `RIM_SessionRoom.md`: navigating away mid-connect can fire `onConnectError` on an unmounting component (React no-ops it, harmless); STEPIN-1's lock serializes Step-In against itself only (a Step-In racing a coordinator's manual assign on the same slot stays last-writer-wins, out of scope).

**Memory candidates (step 8b):** none new — the session reinforced existing files (`feedback-reviewer-subagent` ran on every substantive commit; `feedback-measure-before-agreeing` + `feedback-restraint-over-new-surfaces` drove the TG-1/control-bar deferrals; `feedback-pattern-audit` shaped the shared-table reasoning on STEPIN-1; `feedback-merge-by-default` is why the branch awaits an explicit deploy nod). The LAYOUT-1 audit-vs-parallel reconciliation is a nice case study but doesn't generalize past "verify a refutation against the real code," already covered.

---

## 2026-06-09 (session 143) — Coverage-authority follow-ons: coordinator sub-on-behalf · greeter removal notify · first-login host panel

The three session-142 backlog items, built together as one focused slice, plus a `userId`-index fix the reviewer surfaced. **One commit, fast-forwarded to `main`.** One new `User` column (`hostWelcomeSeenAt`) + two idempotent migrations (`user_host_welcome_seen_v1`, `host_assignment_user_indexes_v1`). **No new dependencies, env vars, or services.** Jesse chose to build all three deferred items (each had been a deliberate gap in s142); the opening ritual mapped them against live code before any edit.

**The three ships (backlog `2026-06-08-001/002/003`):**

1. **Coordinator requests a sub on a host's behalf (001).** The one remaining manager-or-own-only coverage action. Widened `POST /api/host/sub-requests` from `isManager || assignment.userId === self` to also allow `isHubCoordinator(assignmentHubSlug)` — scoped to the assignment's own hub, mirroring the s142 unclaim/delete/reassign pattern (greeter/multi-claim hubs are rejected earlier in the handler, so the widening can't reach them). UI: an **"Ask the team to cover"** button now sits in the coordinator action cluster on *covered* rows (someone else hosting), ordered least-to-most-drastic ahead of Remove + Reassign. It opens a **new `ask-cover-for` modal** whose copy names the host ("Ask the team to cover for Maria… she stays assigned until someone does") so it never reads as "your session" — the backlog's specific concern. Reuses the existing sub-request POST + optimistic update (covered → needs-sub). **Completes the coordinator-as-manager-for-their-own-hub model** (assign / remove / reassign / clear / request-sub).

2. **Greeter removal now notifies (002).** A greeter coordinator's per-claimant "Remove" was silent. The shared `DELETE /api/host/assignments/[id]` now fires `sendHostAssignmentRemovedEmail` — but **only when `removedUserId !== session.user.id`**, which is exactly the self-cancel-vs-coordinator-remove distinguisher the backlog asked for (the route serves both `cancelSignUp` and `removeSignup`). Mirrors the PATCH-unclaim notification block above it; `removedUserId` captured before the delete transaction. Reuses the pre-threshold-gated `host-assignment-removed` template, so staged accounts still get nothing. **Server-only — no UI change, no new template.**

3. **First-login host-recognition panel (003).** A pre-staged host (role + schedule attached before they ever logged in) lands on their dashboard with no signpost to it. New one-time, dismissible panel — *"Welcome — you're set up to host. Your hosting schedule is already in place…"* with **View your hosting schedule →** (`/tools/schedule?hub=…`) + **Dismiss**. Both mark it seen (best-effort POST → `/api/account/host-welcome-seen`). New `User.hostWelcomeSeenAt DateTime?` (null = not yet acknowledged). The dashboard query is **double-gated** — runs the two existence lookups only when `hostWelcomeSeenAt === null` AND the member belongs to ≥1 hub (a pre-staged host is always a HubMember) — so it never runs for the large population of pure participants. New `HostWelcomePanel` client component; `db-host-welcome` CSS using the dashboard's existing rim-blue host accent (the same one `.today-row--setup` reserves for host-only affordances). Per Jesse's call (option A), existing hosts also see the panel once.

**Reviewer-driven addition:** the dashboard host lookups (and the pre-existing today-host query) filter `userId` against indexes that aren't `userId`-prefixed → seq scan. Added `@@index([userId])` to `host_assignments` + `standing_assignments` (idempotent `CREATE INDEX IF NOT EXISTS`, Prisma-convention names). The in-memory hub-membership gate is the primary fix; the indexes are the safety net + a latent-gap cleanup that also speeds the existing query.

**Design decisions + why:**
- **A distinct `ask-cover-for` modal, not a reused `ask-cover`.** The existing modal copy is first-person ("you can't make…"); a coordinator acting on a host's behalf needs host-named copy or it reads wrong. The backlog flagged exactly this "reads oddly" risk; a separate modal kind is the clean fix — ~15 lines, reusing the same optional-note editor.
- **002's distinguisher is actor identity, not a flag.** "Coordinator removed someone" vs "I cancelled myself" *is* `assignment.userId !== self`. No query param, no second endpoint — the same condition the PATCH-unclaim path already uses. The two existing callers (self-cancel, coordinator-remove) map cleanly onto it.
- **003 shows once to everyone with hosting, gated on hub membership (Jesse chose A).** The panel is genuinely useful to any host, and one-time + dismissible keeps it calm. Gating on `hubMemberships.length > 0` (already loaded) skips the lookups for non-members at zero cost; the `hostWelcomeSeenAt` flag makes it one-time. Not scoped to "newly onboarded" (option B) — that needed a recency heuristic for marginal benefit.
- **Host-framed copy ("set up to host"), not per-hub coverage-copy.** The feature's purpose is the host team, and host framing matches Jesse's stated copy. Per-hub wording (AV/greeter) is a possible refinement, noted not built.

**Hub-routing audit (this slice touched `app/api/host/*`):** (1) capability gates — 001 + 002 both gate on `isHubCoordinator(assignment.hubSlug)`, hub-scoped ✓; (2) notification pools — 001 reuses `getHubNotificationRecipients(assignmentHubSlug)`, 002 sends a direct hub-scoped email ✓; (3) UI/list queries — the new affordance is on covered rows within the `?hub=`-scoped Scheduler ✓; (4) email URL variables — 002's removal email + 001's sub-request email both route through `hubScopedUrl`, and 003's panel link is `?hub=`-scoped ✓.

**What this connects to:** the Scheduler (`/tools/schedule`, `HubScheduleClient`, the sub-request + assignment routes), the member dashboard (`/account/(authenticated)/dashboard`), the email system (reuses `host-assignment-removed` + the pre-threshold gate), the Member Registry pre-staging flow (s142 — 003 is its payoff moment), and `lib/hubAuth.ts::isHubCoordinator`. No editor / Tiptap / content-block changes (the `ask-cover-for` modal reuses the existing `message`-variant editor — no new placement).

**What's next:** deployed-site verification (the column + indexes are created by `migrate.mjs` on the Vercel deploy — 003 only comes alive once deployed). Highest-value checks: as a hub coordinator, "Ask the team to cover" on a covered row → host-named modal → team gets the cover request; remove a greeter signup → that person is emailed, but a self-cancel stays silent; a staged-then-onboarded host sees the welcome panel once and it doesn't return after dismiss.

**Memory:** wrote `coordinator-is-hub-manager.md` (the pending s142 candidate — confirmed by Jesse) + indexed it. The closing behavior-audit found no new candidates (the session ran to plan; the index gap was a code finding, not a behavior lesson).

---

## 2026-06-08 (session 142) — Pre-launch host staging · "No host needed" · coordinator coverage authority · multi-hub Scheduler consistency

A five-ship session, all on `main` and deployed. **No new dependencies, env vars, or services.** One new `Program` column (`hostingRequired`) + idempotent migration `program_hosting_required_v1`. Started from Jesse wanting to pre-populate the host team before launch; each answer surfaced the next role-model / multi-hub-integrity question, and each got chased to ground.

**The five ships, in order:**

1. **Silent host pre-staging (`5d640bd`).** Populate the host team + schedule before the app opens, with people who aren't members yet — zero notifications until they personally log in, and the normal new-member onboarding when they do. Built: (a) a **"+ Add member"** modal + `POST /api/admin/members` creating a staged account (`agreedToTerms:false`, `emailVerified:null`, no email) — the member module had no create-person flow before; (b) a **pre-threshold email gate** — `recipientHasOnboarded()` + `PRE_THRESHOLD_GATED_SLUGS` in `lib/email.ts` suppress member-directed team emails to anyone who hasn't completed sign-in, and `getHubNotificationRecipients` now excludes `emailVerified:null` members (the durable gate for every hub-pool email); (c) the **cleanup cron** no longer deletes accounts that hold a role or belong to a hub. On `/join` the account is reused by email, the name updates to what they type, and everything wired to the id (HubMember, HostAssignment, StandingAssignment) persists.

2. **"No host needed" (`8678c26`, scoped to primary in `fed2c47`).** New `Program.hostingRequired Boolean @default(true)` (the "No host needed" checkbox on the Hosting & Access tab). Self-led / community-led offerings (Recovery Dharma, drop-in groups) are excluded from the Scheduler, rotation generation, and the new-program-needs-host email — never "Needs Coverage." Stays fully visible on the public schedule, dashboard, and program page; session room unaffected.

3. **Coordinators can remove/reassign hosts (`f51b472`).** Nancy (a hub coordinator without the global HOST_MANAGER role) could *assign* a host (s140) but couldn't *remove* one. Widened unclaim/delete/reassign to `isHubCoordinator(assignment.hubSlug)` (hub-scoped), added "Remove" + "Reassign to me" on covered rows (gated `isManager`), and unclaim now notifies the removed host.

4. **Coordinators can clear cover requests (`9d815b8`).** Canceling an open sub-request was manager-or-own only; now `isHubCoordinator(assignment.hubSlug)` too, with a "Clear request" affordance on needs-sub rows. Completes the model: coordinator = manager-for-their-own-hub on coverage.

5. **Scheduler multi-hub consistency (`fed2c47`).** Jesse flagged the Scheduler as one surface shared by four hubs (host-team / peer-led single-slot; AV single-slot aux; greeter multi-claim aux) and asked whether the day's changes propagate vs. pollute. Audit + fixes: (a) **"No host needed" was over-reaching** — it removed a program from AV/greeter coverage too. Scoped it to the **primary host only** (auxiliary branch of `getProgramSlugsForHub` + `generateCandidates` + the two POST guards now keyed on `targetHubSlug === primary`). (b) **Greeter coordinators** got a per-claimant "Remove." (c) **Hid the dead assign-others picker** on multi-claim empty rows (pre-existing s140 wrinkle). Verified single-slot affordances can't leak onto greeter rows.

**Design decisions + why:**
- **Pre-threshold gate keyed to reality, not a "quiet mode" toggle.** "They won't know until they log in" *is* `emailVerified === null` — the rule literally encodes the requirement, and it's safe (a real active member always has emailVerified set). Two layers: the recipient-pool gate (durable for all hub-pool emails) + the per-builder/slug gate (1:1 emails). Auth + join-welcome deliberately NOT gated (must reach mid-signup people).
- **"No host needed" is the third axis** beside kind (*what it is*) and registration (*what registering does*): *whether any team staffs it*. Scoped to the primary host so it composes with independent auxiliary coverage — the multi-hub-correct behavior.
- **Coordinator = manager-for-their-own-hub on coverage** (Jesse: "they have the responsibility for caring for this"). Every coverage mutation now allows `isHubCoordinator(resource.hubSlug)`, scoped server-side. Plain hosts still act only on their own; no privilege escalation.
- **The Scheduler is a shared multi-hub surface** — every change checked both directions (reaches AV/greeter/peer-led where it should; doesn't bleed into the multi-claim model where it shouldn't). Now a standing rule in `RIM_Scheduler.md`.

**Reviewer track record (4 adversarial passes, each caught a real would-ship bug):** the hub-pool email leak class (ship 1); the PATCH system-role gate shadowing the new coordinator check (ship 3); the show-but-can't-staff guard inconsistency where "No host needed" surfaced a program in AV/greeter but the POST guards still refused it (ship 5).

**What this connects to:** the Member Registry (`/admin/members` + new POST), the Scheduler (`/tools/schedule`, `HubScheduleClient`, assignment + sub-request + standing routes, `lib/applyStandingAssignments.ts`, `lib/programHub.ts`), the email system (`lib/email.ts` gate + `getHubNotificationRecipients`), the cleanup cron, the ProgramEditor (Hosting & Access tab), the four scheduler hubs, and the onboarding flow. No editor / Tiptap / content changes.

**What's next:** deployed-site verification of all five — especially the staging round-trip (Add member → assign HOST → no emails → sign up via /join → onboarding fires + schedule already attached). Jesse can now pre-stage the host team. Three new backlog items (coordinator create-sub-on-behalf, greeter removal notification, first-login host recognition).

---

## 2026-06-08 (session 141) — Scheduler trust + clarity finish; coordinator Coverage grid tried & reverted; rotation editor confirms in place

Opened with a memory consolidation (`MEMORY.md` 28.1 → 4.7 KB — removed the bloated Session-Log + stale CSS sections that duplicated the repo, added two un-indexed files, retired `webflow-removal` into `project-architecture-pivot`). Then continued the Maria/host-coordinator Scheduler thread from her full feedback. **Six commits on `main`, all deployed. No new deps / env / services.**

**The arc, in order:**

1. **Enter-room (#2) — fixed (`4916757`).** The Scheduler's "Enter room →" link carried no date and the server only ever opens *today's* session, so clicking it on any non-live row dead-ended ("the room isn't on this date") — Maria's "so untested." Confirmed in code that the real recurring-session join bug was already fixed s137; the residual was a UX dead-end (the link showed on every upcoming virtual/hybrid row). Fix: gate the link to "live now" via a client-side window check, threading each occurrence's `sessionEnd` through the page loader + the `/api/host/assignments` GET so it survives month-nav. (Teacher does NOT bypass the gate — only ADMIN/GT — which is why Jesse never saw it.)

2. **Entry timing unified — host 30 / member 10 (`8f7963f`).** Extracted the window constants into `lib/sessionWindowConstants.ts` (no server-only imports → client-safe), shared by the gate (`lib/sessionWindow.ts`), the dashboard tiers, and the Scheduler link so they can't drift. Hosts/teachers get a 30-min prep/early-entry window (was 22); the member dashboard "Join now" opens at 10 min (was 12); close stays end + 30. Host-vs-member is a dashboard-UI distinction; the gate is the permissive outer boundary.

3. **Two quick wins (`260b437`).** Removed the redundant "N sessions still need coverage" banner — the "Needs help N" pill now goes amber on gaps. The cross-hub staffing "Edit in [hub] →" now deep-links single-slot hubs straight to the Rotations editor (`?view=rotations`).

4. **Coverage grid — built then reverted (`4732fd4` → `2d7a763`).** Built the Phase-2 coordinator view (slice 2): programs × weeks grid (desktop) + gap-first list (mobile), manager default landing, fill-in-place. Jesse's testing surfaced two structural strikes: the mobile list became a flat 24-row gap dump (worse than the agenda), and — decisively — the grid assumes one-weekday-weekly, so multi-day programs break it (a weekly multi-day program fragments into N repeated rows; a consecutive retreat shatters into N single-cell weekday rows). **Reverted.** The time-ordered agenda handles every program shape and is already gap-aware (amber pill + slice-1 assign-in-place).

5. **Rotation editor confirms in place (`9657d04`).** Maria's #5 — after Save & Apply you couldn't tell it took without leaving to hunt. Now a successful save shows an inline "✓ [Day]'s rotation saved" panel on that row with the change summary + projected next sessions (date → host). Reuses the live-preview projection (extracted into a shared `projectUpcoming`); save logic unchanged — a read-only confirmation captured from the form before it closes.

**Design decisions + why:**
- **The grid revert is the headline call** — "pivot when the pattern is fragile" + restraint. Two structural strikes on a view whose only net-new value (the desktop at-a-glance) didn't justify making it robust across RIM's real program variety. Jesse named the deeper instinct: *"maybe we're being reactive to her feedback… I get uncomfortable with too many things."* The answer to a list of pains isn't a new surface per pain — it's making the surfaces that exist trustworthy.
- **Teacher vs host is already modeled** (ProgramEditor sets the teacher via `ProgramTeacher`; the Scheduler sets the host via assignment/rotation) — confirmed in code; I had wrongly carried it as an open question, and Jesse rightly pushed back.

**What this connects to:** the Scheduler (`/tools/schedule`, `HubScheduleClient`, `RotationsClient`), the session-room time gate (`lib/sessionWindow.ts` + the new constants file), the dashboard "Today" early-open tiers, the cross-hub program-staffing view, and the LiveKit join flow. **No hub-routing-layer changes** (the `assignments` GET change is a display field), **no email-template changes**, the Tiptap editor system untouched.

**What's next:** deployed-site verification of all six ships (esp. a non-ADMIN member entering a live recurring Qigong session; the rotation-edit confirmation; the 30/10 thresholds). The grid could return someday as a desktop-only weekly lens if multi-day + mobile are solved (backlog `2026-06-07-001`). A plain-English reply to Maria was drafted for Jesse to post (in `UP_NEXT.md`).

**Post-closing follow-on (`1b32cb7`).** Jesse hit a hub-conversations bug while posting the reply: a reply double-posted because the Tiptap editor didn't clear after a successful submit — `RimTiptapEditor` sets `content` once at init and never re-syncs, so `setReplyBody("")` cleared the state but the editor kept showing the text, making the post look unsent and inviting a second submit. Fixed in `HubConvThreadClient`: remount the reply editor empty on success (key-bump), a synchronous `sendingReplyRef` guard (the `disabled` attribute updates a render too late to stop a fast second click), and `try/catch/finally` (no stuck button; inline error on failure). Same guard + `try/finally` added to the two new-thread compose handlers (`postThread`, `submitThread`) — they close on success so their editors already clear, but shared the double-submit/stuck-button risk. Also added the missing reply **delete**: the reply route had only PATCH (edit own), so a `DELETE` handler was added (own reply, or coordinator/GT/ADMIN for moderation — mirrors the thread model; hard delete) plus a Delete affordance with confirm on reply cards. Hub-audit note: the new DELETE is gated own-or-`effectiveCoordinator` behind `canAccessHub`; no notifications, no outbound URLs — no other routing layer touched. A related polish in the same session (`2fd8f94`): hub conversation reactions now identify their authors — a `title` tooltip + real `aria-label` mapping the reactor IDs (already stored) to names via `hubMembers`. They were anonymous counts before ("a community isn't anonymous"). Follow-on (`80be766`): a compact tap-to-reveal list (a Users-icon toggle → who reacted, grouped by emoji, dropping to its own full-width line) so authorship works on mobile, where the hover tooltip doesn't.

---

## 2026-06-07 (session 140) — Scheduler trust-restoration + coordinator gap-first view (Phase 2 slice 1)

Triggered by frustrated host-coordinator feedback on the Scheduler: *"un-host-coordinator friendly … relying on the pill buttons and constant scrolling, clicking back and forth between pages just to see where we are … no clear connections … disjointed discrete little pages you have to connect in your own head … great for a single host, a nightmare for the coordinator,"* plus six specific bug/inconsistency reports. Split into two phases — **restore trust (bugs) first, then the coordinator's view** — both shipped to `main` and deployed this session (commits `9f68c00`, `b22dd9b`).

### Investigation first (read the rotation engine as one system)

Traced `lib/applyStandingAssignments.ts` + all six standing-assignment routes + reassign + `RotationsClient`/`RotationConflictModal` end-to-end before proposing anything. Honest finding on the scariest report (#6 — "changing the Qigong host removed Maria from dates I didn't touch, even on the Tuesday drop-in"): **every apply/preview path is program-scoped; no code path crosses programs**, so the cross-program symptom isn't reproducible from code. Qigong is online-only (single-hub), so the latent cross-*hub* modal bug wasn't its cause either. Most likely real cause: **"Replace all" stomping Maria's manually self-assigned dates** (only sub-cover was protected), shown illegibly. Fixed that + instrumented the rest rather than chase a ghost.

### Phase 1 — trust fixes (`9f68c00`)

- **Orphan cleanup on pattern-editor removal (#4 root cause).** Removing a host/occurrence from a rotation deleted the *rule* but left its future `HostAssignment` rows orphaned (`standingAssignmentId` is SetNull) — so "remove Nancy" silently didn't take. The bundle-save POST now deletes those future assignments too (FK-safe SubClaim→SubRequest→HostAssignment→StandingAssignment, future-only) and emails the displaced host.
- **"Replace all" protects manual self-claims (likely #6 cause).** `applyStandingAssignments` no longer replaces `source: "manual"` conflicts under replace-all; override per-date via "Decide one by one." Server + modal agree via a shared `isShieldedFromReplaceAll` helper.
- **Conflict modal hub-scoping (latent).** The modal applied *un-hub-scoped* (never sent `hubSlug`); it now threads it through preview/apply, and the apply engine keys candidates per hub (`programSlug::dateStr::hubSlug` + `Conflict.hubSlug`). This is what *preserves* AV/greeter/host-team isolation on multi-hub programs.
- **Legibility (#5/#6).** Modal shows "N can be replaced · M protected" before commit; save / set-end-date confirmations name the concrete result ("sessions through Jul 7 kept · 3 later removed"). Removable `[rotation-apply]` server log records exact per-date from→to deltas on every replace.
- **Copy:** standing-rotation email subject "…this month" → "…upcoming sessions" (#1); "mine" empty state is context-aware when viewing another member (#3).

### Phase 2 — coordinator's synoptic view: designed + slice 1 shipped (`b22dd9b`)

Co-designed the answer to her headline: **one surface that is both the picture and the editing desk, organized by time** — programs × dates, gaps the most visible thing, edit in place. Agreed to **build mobile-first** (the hardest surface), **gap-first**.

**Slice 1 (shipped):** on the existing Schedule tab, a coordinator now sees a plain-language **"N sessions still need coverage · Show them"** banner and can **"Assign someone…"** to a gap in place — a native `<select>` of teammates, no modal / no page-hop, optimistic update + confirmation toast. Backend: `POST /api/host/assignments` now lets **hub coordinators** (not just HOST_MANAGER/ADMIN) assign others (matches the rotation routes' trust model — it had been locking out the very coordinators who staff the team), hoists the target-capability check, and assigns to an existing *unclaimed* seed instead of returning a confusing 409.

### Design decisions + why
- **Trust before view** — a synoptic view on a buggy edit engine just lets the coordinator *see* corruption faster. Correctness + legibility first.
- **Protect manual claims from "Replace all"** — don't silently stomp a deliberate human choice; make overriding explicit (clear seeing / "make random tapping survivable").
- **Mobile-first, gap-first** — a wide programs×dates grid can't fold to 390px, so build the gap-first list (the phone reality) first; the desktop grid is the "more room" version of the same model.
- **Coordinators can assign** — consistent with how the Rotations tab already trusts hub coordinators.

### Connects to
The Scheduler engine + every standing-assignment route + the Schedule/Rotations client + the conflict modal; the host-confirmation email (existing send, already hub-scoped); the `apply-standing-assignments` cron (unaffected — "leave" mode has no replace path, so manual-protection + the diagnostic log never fire there). Two reviewer-sub-agent passes (both SAFE TO COMMIT). Hub four-layer audit (CLAUDE.md §4c) clean: the assign path routes by `targetHubSlug`; notifications + URLs were already hub-scoped.

### What's next
- **Coordinator view slices 2–3:** the desktop 2-D grid, then the by-program lens with inline rotation editing + live conflict preview (later: AV/greeter + teacher/host lanes).
- **Awaiting Jesse:** the Qigong **Rotations-tab** check (Maria in the grid = rotation, or empty grid + Maria on each session = manual) — confirms which Phase-1 fix carries #6 and whether Maria-as-host-of-everything is intended (teacher vs host); the **#2 "enter room"** repro (program + the date/time clicked); deployed-site verification of today's two ships and the standing 136–139 backlog.
- **Docs needing no change (stated per ritual):** `RIM_Editor_Types.md` (no editor work), `RIM_Email_Engineering.md` (used existing sends, no new template), `RIM_Hub_Engineering.md` (the assign-gate follows the existing four-layer model — audit was clean, no new rule).

---

## 2026-06-07 (session 139) — FEATURES.md rebuild + dead-code audit + pre-launch slimming (manual, PDF export, reflection questions removed)

A slimming-for-launch session that began as "optimize FEATURES.md" and grew into a verified dead-code audit plus the removal of three unused features. **Eight commits on branch `claude/cleanup-s139`, fast-forward-merged to `main`.** `tsc` + `next build` green throughout; the DB tables for the removed features were left **dormant (no DDL)** to keep the pre-launch deploy bulletproof.

### FEATURES.md rebuilt from ground truth (`0d83b53`)

FEATURES.md had drifted to 5,007 lines / 624KB — broken TOC, duplicate section numbers, full inline text for already-removed features, an embedded duplicate session log, "Planned" items that were actually built, and heavy overlap with the 11 dedicated docs that have since peeled away its responsibilities. Jesse wanted a "safe full rebuild." The method: archive the old file, inventory the *live codebase* (every route, API route, model, cron, tool, lib, component) so the new doc reflects reality not claims, adjudicate every old section (carried / pointed-to-a-dedicated-doc / tombstoned / dropped-with-reason), and dual-cross-check (every old section has a disposition; every live surface appears). Result: a ~250-line domain-organized current-state catalog that delegates depth to the dedicated docs + `schema.prisma`. Six cross-refs citing "FEATURES §N" updated to named sections. **Lesson reinforced:** a leanness pass is only safe *after* reading what you're deleting — my first pass was structural-only yet presented as complete; Jesse's "did you evaluate against all the code?" forced the real evaluation, which found genuine gaps (a missed self-service-edit route, lesson media, over-compressed no-backstop areas).

### Dead-code usage-tracing audit (`CLEANUP.md` Theme H)

Jesse asked to verify the code is exhaustively clean. A full grep-based usage trace (every component / lib / model / enum value / route / API route / dependency → its callers) found 3 orphan components, 8 dead deps, all 39 lib + 58 models live, and no dead page routes (Next routes are URL-reachable; scan "orphans" were compositional-link false positives). The `SUPPORT` role is NOT dead — the Support Hub is kept as a normal team hub. The audit also surfaced **a real latent bug**: the host-coordinator hub-home inline save PATCHed a non-existent singular `/api/hub/[slug]/home` (404, silent) — the real route is plural `/api/hubs/[slug]/home`. Fixed.

### Three features removed (`1b2afe9`, `1f6dcef`, `ee41ad4`)

- **Staff manual** — unused, woven across ~50 sites: 5 pages, 2 API routes, 3 components, `lib/manualGroups`, the `ManualSection` model, 35 prisma seed scripts, and all manual imports/calls in `migrate.mjs`. App-ref stripping delegated to a sub-agent (tsc-gated, diff-reviewed); the data layer done by hand. **A regex bug in my migrate.mjs surgery (`[A-Za-z]*` excluded digits) left the versioned `updateManual*V3/V4/V5` calls in place while removing their imports — a runtime ReferenceError `node --check` couldn't catch; the grep-after review caught it.** Tables left dormant.
- **Schedule PDF export** — print page + PDF route + `ScheduleDocument` + the export bar; `@react-pdf/renderer` then removed.
- **Reflection Questions** — component + 3 API routes + 3 models + lesson-editor/display integration. Sub-agent caught two surfaces a model-name grep would miss (the course-TOC `_count: { questions }` relation; `MarkCompleteButton`'s locked gate). Kept the separate `reflectionPrompt` text field.

### Kept — the public content pages (decision recorded)

The "static pages" were initially framed (by me) as rough stubs. Checking each before deleting showed they're **finished content**: `/donate` (three live GiveButter widgets + Dana philosophy + giving contemplations), `/diversity` (a real values statement), `/kalyana-mitta/*` (community-group content). I recommended against deleting them — that's re-writing content, not slimming cruft — and Jesse agreed. A future *presentation* redesign (native CSS over the Webflow shim) is a redesign, not a delete.

### Safe cleanup now; DDL deferred (`6416ae0`, `be09fc4`, `791e07b`)

Jesse worried he'd forget the post-launch cleanup. The verified-dead removals are safe pre-launch *because* `next build` gates them before merge (a broken build can't reach prod): removed the 3 orphan components + 8 dead deps (`npm remove`) + 142 dead `man-` CSS rules. The one genuinely deploy-risky item — `DROP TABLE` on the dormant manual/reflection tables — was deferred (DDL, zero pre-launch benefit) and locked into `UP_NEXT.md` + `CLEANUP.md` Themes H/I so it can't be forgotten.

### Connects to / next

**Surface:** 69→63 routes · 112→106 API · 58→54 models. **Docs aligned:** FEATURES.md, CLAUDE.md (dropped the Staff-Manual closing-ritual step + the `man-` prefix), CLEANUP.md (Themes H + I), UP_NEXT.md. Touched the manual / PDF / reflection subsystems (removed), the role-assignment email templates (still reference a now-empty `manualUrl` — deferred), `migrate.mjs` (manual blocks now empty no-ops), and the lesson system (`reflectionPrompt` kept). **Next:** the deferred post-launch cleanup (drop dormant tables, prune empty migrate.mjs blocks, fix the 2 email templates, verify-then-remove the remaining suspect deps) + the standing session 136/137/138 deployed-site verification backlog.

---

## 2026-06-04 (session 138) — Status-aware registration messaging on the public program page + editor legibility

A same-day follow-on to session 137, from another LoriLee registrar report: on The Heart of Wisdom (an in-person retreat), the public program page's "what to do next" line read "Simply arrive in person · Zoom link on My Home" — a Zoom reference on an in-person-only program. Investigating it opened into a deeper messaging problem, which Jesse pushed to address holistically — both the public page and the editor.

**Three commits on `main`:** `145a0cb` (Zoom-link fix) · `b53dee0` (status-aware messaging + editor readout) · `f2d2544` (backlog) — plus this closing doc sweep.

### Part 1 — the Zoom-link leak (`145a0cb`)

`app/programs/[slug]/page.tsx`'s CTA branched only on `virtual` vs everything-else, so in-person was lumped with hybrid and inherited the "Zoom link on My Home" clause — pointing members to a link that doesn't exist (the dashboard correctly shows no join button for in-person). Split the non-virtual branch into hybrid (keeps the online clause) and in-person ("Simply arrive in person." only). Verified the member program page + dashboard already handled in-person correctly.

### Part 2 — status-aware messaging keyed off kind (`b53dee0`)

Jesse's question — "does 'registration off' mean closed?" — surfaced that the page conflated three different "no Register button" situations: drop-in (just come), not-open-yet (registration coming), and closed (registration ended). The page only knew two and mislabeled "not open yet" as "drop-in" — which is why a paid retreat with registration still off read as "Simply arrive in person." The session-137 `kind` field is exactly what disambiguates: a retreat is never a drop-in.

The public CTA now expresses the full matrix, keyed off `isOpenlyDroppable(category.kind, registrationEnabled)`:
- **Registration on:** the viewer's own standing first (registered / waitlisted) — which now survives registration closing, fixing a real bug where a registrant saw "Registration is closed" after the deadline — then "Register →" / "Join the waitlist →" (when full; repurposes the previously-dead `spotsRemaining` compute) / "Registration is closed."
- **Registration off + droppable kind** (drop-in / open community group): format-aware "how to join."
- **Registration off + commitment kind** (class / event / retreat): "Registration isn't open yet."

**The editor was the real fix, per Jesse.** A registrar had no way to see *why* the public page said what it did — the gap behind the report. The ProgramEditor gained a read-only "How this appears to visitors" readout on the Registration tab (mirrors the public logic from kind + format + registration state), an inline "Kind: X" line on the Categories tab, and corrected "Registration enabled" help text. `kind` threaded through the edit + new pages. A reviewer sub-agent verified the conditional ordering, the `spotsRemaining === 0`/null guard, and the editor-mirrors-public logic before commit.

### What this connects to
- **Offering model (session 137)** — brings the public program-detail CTA + the editor into the two-axis (kind + registration) model the dashboard and member-detail gate already used; `RIM_Offering_Model.md` updated.
- **Registration** — status-first ordering + waitlist state; display-only, no API/flow change, so `RIM_Registration.md`'s model is unaffected.
- **No schema change; no hub / email / editor-types change.**

### What's next / deferred
- **Verify on deploy:** The Heart of Wisdom now reads "Registration isn't open yet" (→ "Register" once registration is enabled); the editor readout + "Kind:" line; an in-person drop-in still says "Simply arrive in person."; the Program Manager manual chapter re-seeds v4→v5.
- **Deferred:** consolidating the two registration booleans into one control (backlog `2026-06-04-007`) — the editor readout resolved the legibility without a schema change; a dedicated `RIM_ProgramEditor.md` per-tool doc (closing-ritual step 4d), held off for this focused slice.
- **LoriLee reply** drafted (Zoom fix + the deeper retreat-vs-drop-in fix + the new editor readout) — Jesse to post on her hub document.

## 2026-06-04 (session 137) — Recurring programs restored across the schedule + explicit offering KIND on categories

A follow-on to LoriLee's registrar testing (June 3). Her screenshots flagged three things: (1) the dana banner read "A spot opened up — please complete your dana offering" on an ordinary voluntary registration — confusing waitlist-framed copy; (2) her registration captured correctly in the Registration Hub (working — no change); (3) Essential Dharma Study and Qigong didn't appear in "Coming up for you." Item 3 opened into a platform-wide bug, and then into a foundational design decision Jesse had been wanting to make before go-live.

**Two commits on `main`:** `0a893cf` (recurrence fix + dana copy) · `bfc903d` (offering KIND model) — plus this closing doc sweep.

### Part 1 — the recurrence bug (`0a893cf`)

Root cause, verified against production data (not assumed): session 131's `endDatetime` guard in `lib/scheduleUtils.ts::isOccurrenceOnDate` — `if (p.endDatetime && dateStr > endDate) return false` — was placed **before** the recurrence handling. For a recurring program, `endDatetime` is the per-occurrence **end time** (same calendar day as the anchor), **not** a series-end date. Every recurring program (all 10 carry a same-day `endDatetime`, `recurrenceCount` null) therefore reported **zero future occurrences**. The series bound is `recurrenceCount`, handled per-frequency further down. The guard silently erased recurring programs from the dashboard "Coming up," `/this-week`, the Scheduler, **standing host rotations** (the apply cron created nothing forward), and the **session-room join gate** (`lib/sessionWindow.ts` — non-ADMIN/GT members were refused tokens for recurring sessions; Jesse bypassed as ADMIN/GT, which masked it for weeks). Proven with the real helper against real rows: Good Morning Silent Meditation returned "no upcoming sessions." **Fix:** scope the `endDatetime` cutoff to the non-recurring branch only — one function, all surfaces restored. This **reverses session-131's premise** that `endDatetime` could mark a recurring series' end (incompatible with how the field is actually stored — it's the per-occurrence end time used by time-range labels, ICS links, and `sessionWindow.closesAt`). Documented as a pitfall in `RIM_Scheduler.md`. The dana banner was also corrected: waitlist-framed copy → calm voluntary invitation ("You're registered. You're also warmly invited to offer dana — a voluntary gift, received with gratitude.").

### Part 2 — explicit offering KIND on `ProgramCategory` (`bfc903d`)

Jesse's go-live concern: the dashboard shouldn't be *guessing* offering type from a tangle of flags, and "community groups" need to be separable. A **four-pass integrity audit** (hubs · courses · behavioral kind-proxies · admin/editor surfaces) confirmed adding an explicit type is additive/orthogonal — it does **not** collide with the hub system (`hostingHubSlug`/coverage/`appliesToFormats`/`allowsMultipleAssignments` are about who-hosts / format / assignment-model, not offering kind), the course system (orthogonal flags; no `courseType` needed), or the `programFormat`/`danaMode`/recurrence branches (intrinsic, not proxies). The one genuine proxy was `registrationEnabled` doing double duty (registration-open *state* vs registration-*kind*).

**The design — Jesse and I converged on it independently: the category carries the kind.** Rather than a parallel `programType` field, `ProgramCategory` gains a `kind` attribute. The category **name** stays editorial/editable (the public-page heading); `kind` is the stable, behavior-driving code. A program inherits its category's kind. Registration stays Axis 2. Behavior = kind + registration, via new `lib/programKind.ts::isOpenlyDroppable`. Kinds: `DROP_IN`, `COMMUNITY_GROUP`, `CLASS`, `EVENT`, `RETREAT`, `SERVICE`, `PRIVATE` (stable codes; labels live in code and rename without a DB migration).

**The insight that settled it:** a "kind" answers *what it is* (Jesse's plain words), not *what registering does*. Recovery Dharma and Qigong are both Community Groups but behave differently (open vs registered) — carried by the registration flag, not by multiplying kinds. So the rich vocabulary lives in kind+category; behavior stays computed.

**Placement:** "Coming up for you" = your registrations (any kind) — **never gated by kind**. "Today" / community schedule = openly-droppable kinds (`DROP_IN` always; `COMMUNITY_GROUP` when open) + your own registered/hosted sessions; `CLASS`/`EVENT`/`RETREAT` never offer a public Join to a non-registrant. The member program-detail gate switched from `registrationEnabled` to `isOpenlyDroppable` (so Essential Dharma Study — a drop-in whose registration is an enrichment — stays reachable; a commitment redirects to register). Migration `add_program_category_kind` (idempotent, flag-guarded, verified against live data before push): backfilled the 6 live categories, split "Community Groups & Events" → Community Groups + Events, added a hidden Private Sessions category, reassigned Day of Mindfulness + Bookmarks & Breath → Events and Private Teacher Meetings → Private Sessions. Kind picker added to the category manager (`/tools/programs/categories`) + categories API (POST + new PATCH).

**Folded in (intermingled in the working tree, reviewed + bundled):** the completed "consolidate duplicate occurrence helpers" task — `app/api/host/assignments/route.ts` and the dashboard now use the shared `lib/scheduleUtils` (private copies removed), plus an **eslint guard** banning re-defining `isOccurrence*` outside `scheduleUtils` so the session-137 fix can't drift again. `.claude/` added to `.gitignore`.

### What this connects to
- **Scheduling** — the recurrence fix flows through the one shared helper into `/tools/schedule`, `/this-week`, the dashboard, `applyStandingAssignments` (host rotations), and `sessionWindow` (the join gate).
- **Registration / dana** — `RIM_Registration.md` (banner copy + the visibility line) and `RIM_Offering_Model.md` (the now-implemented kind model).
- **Hubs** — audited; no routing-layer change (the only hub-area file touched, `assignments/route.ts`, was a helper-import consolidation).
- **Courses** — parallel system, unaffected (no `courseType`; only `courseAccess` live-cohort detection *could* key off kind in future).

### What's next
- **Setup (Jesse's):** turn on registration for The Heart of Wisdom; decide whether to wire Essential Dharma Study to a Course for study materials.
- **Deferred:** delete dead `hideFromDashboard` / `dayOfWeek`; rename `removeFromProgramList`; kind picker in the ProgramEditor's category-create flow (new categories default null, safe); optional "community this week" dashboard surface + a "follow / add to my schedule" signal so open offerings can reach a member's personal upcoming without registration.
- **Verify on deploy:** migration log line; category-manager kinds; dashboard placement (no public Join for unregistered class/event/retreat; recurring sessions joinable again).
- **LoriLee reply** drafted (warm, plain, three points) — Jesse to post on her hub document.

## 2026-06-03 (session 136) — Registration completes after the dana/payment choice (not before) + multi-day labels + support notification

Triggered by LoriLee's registrar feedback (screenshots): a registration was being recorded — confirmation email, dashboard listing, official log, course enrollment — **before** the person reached the Dana step, so for paid programs someone could be "registered + emailed" without paying, and for every program the "You're registered!" moment landed before the dana contemplation.

**Five commits on `main`:** `dc5ee46` (the 6-slice registration rework) · `adc5262` (softer dana-decline copy) · `da0a6a2` (support@ notification) · `1a98b7d` (multi-day date/time labels) · plus this closing doc sweep.

### The core rework (`dc5ee46`) — completion follows the dana choice

The constraint that shaped everything: the `Registration` row **must** exist before Stripe Checkout (the checkout route looks it up by id and stamps the session; the webhook keys off it). So the lever wasn't "don't create the row" — it was **decouple the row's creation from its completion side-effects** (confirmation email, course enrollment, "registered" listing) and move those to where the dana actually resolves. Built as six reviewer-gated slices:

1. **Extract `lib/registrationConfirmation.ts::sendRegistrationConfirmation(id)`** — the single place the confirmation email is assembled, callable from every completion point with just an id.
2. **New `RegistrationStatus.PENDING_PAYMENT`** (idempotent `ALTER TYPE … ADD VALUE`) — the held/provisional state.
3. **POST `/api/registrations` forks by dana shape** (derived server-side from the program, **not** the client body — closes a hole where a crafted request could register free for a paid program): free → real `REGISTERED` + email at submit; voluntary → `REGISTERED` at submit but email **deferred** to the dana choice; required-payment → `PENDING_PAYMENT` only (no account for a new guest, no email, no enrollment), holds a capacity seat. Guest abandons-then-retries reuse their held row.
4. **Completion points** — the Stripe webhook (`checkout.session.completed`) creates the account, flips `PENDING_PAYMENT → REGISTERED`, enrolls, sends the confirmation; a new **`POST /api/registrations/[id]/decline-dana`** endpoint handles the voluntary "No thank you" (marks `WAIVED` + sends the confirmation). Idempotent (gated on the Donation row existing pre-delivery; one-shot `WAIVED` latch for decline).
5. **Auto-expiry** — `expires_at` (60 min) on the Checkout Session; a `checkout.session.expired` handler deletes the held row; a daily backstop cron `cleanup-pending-registrations` (delete stale holds; finalize abandoned voluntary rows).
6. **Visibility** — `PENDING_PAYMENT` is invisible everywhere member/registrar-facing (dashboard ×2, My Registrations page + API, admin member registry, Program Manager roster/CSV/pending-dana count, course-access gate, registrar hub badge) but **counts toward capacity** (holds the seat); plus the dana-step copy no longer declares "You're registered!" before the choice, and the `?dana=cancelled` banner is mode-aware.

**The design decision Jesse refined mid-session — required vs voluntary are two different stories.** I first proposed making voluntary *also* held-until-decided (discard on abandon). Jesse's instinct corrected it: **for required dana/tuition, payment is the gate** (no payment = not registered = abandon discards); **for voluntary dana, the registration is already complete at submit** — the dana is an invitation beside it, not a gate, so abandoning an *optional* choice must never throw away a real registration. The held/discard model applies to **required-payment only**; voluntary stays registered (the cron treats a 24h-abandoned voluntary as an implicit decline: `WAIVED` + confirmation). This is why the `PENDING_PAYMENT` name stayed accurate (we'd discussed renaming to `PENDING_DANA` only if voluntary joined the held state — it didn't).

**Reviewer sub-agent** caught three real visibility leaks I'd missed (the classic drift failure — two were *second* registration queries in files where I'd only fixed the first): the member program-detail access gate (a held row would have granted gated course access **without payment** — the one with a real consequence), the dashboard "is registered for today's session" check, and the registrar hub badge count. All fixed pre-final.

### Softer dana-decline copy (`adc5262`)
Button "No thank you" → **"I'm not donating at this time"**; roster `Waived` → **"No dana"** (accurate for both a voluntary decline and a no-dana program, where "Declined" would misread).

### Support@ notification (`da0a6a2`)
LoriLee asked support@ to be notified of every registration. Built `sendRegistrationSupportNotification` firing **from inside `sendRegistrationConfirmation`** — the single "registration is now real" choke point — so it covers free/voluntary/required/waitlist, **never** fires for an abandoned hold, and can't drift if future completion paths are added. New `SUPPORT_EMAIL` constant (defaults to `support@rootedinmindfulness.org`, env-overridable); new editable template `registration-support-notification` seeded per the Email Template Gate; direct link to the program's registrations.

### Multi-day date/time labels (`1a98b7d`)
LoriLee: a 4-day retreat (Sep 10 4PM → Sep 13 12PM) listed as "September 10, 2026 · 4–12 PM CT" — a single half-day event. Root cause: `computeDateText` only looked at the start date and `computeTimeText` assumed same-day. Now derived from the start **and** end dates the coordinator already enters (no new "multi-day" control — the design win): Schedule Label → a range ("September 10–13, 2026", handles cross-month/cross-year), Time Label → "Begins 4 PM CT". Logic lives in three mirrored copies (lib, ProgramEditor preview, migrate.mjs); all updated + both save-routes pass the end date. Existing retreats self-correct via the every-deploy `recache_program_date_time_text` migration.

**What this connects to.** Registration → dana → Stripe → webhook → enrollment → confirmation email; the `Program.dateText`/`timeText` caches (session 109) now shared by the confirmation email path; `RIM_Offering_Model.md`'s previously-TBD "pending dana behavior" is now resolved (for programs); the Email Template Gate (new template seeded). New per-tool engineering doc **`RIM_Registration.md`** created (step 4d). No hub-routing-layer changes (the support notification + confirmation are not hub-scoped).

**What's next.** Deployed-site verification of the whole flow (free/voluntary-give/voluntary-decline/required-pay/required-abandon); confirm the Stripe webhook endpoint subscribes to `checkout.session.expired`; LoriLee's "testing to be continued" — more feedback may come. Optional: a "started but didn't finish paying" support heads-up (offered to LoriLee, not built).

---

## 2026-06-03 (session 135) — Guiding Teacher hub access + GUIDING_TEACHER made assignable

Started from Jesse's question: *"Shouldn't I have access to all of the hubs according to my account?"* It unwound into an access-model correction and surfaced an invisible-role bug.

**Two commits on `main`:** `4439952` (canAccessHub access door) · `1c05778` (surface GUIDING_TEACHER in the role-assignment UI).

**What was wrong (clear-seeing first).** Three tiers disagreed about hub access: the layout gated on `isMember`, the 11 sub-pages on `member || isAdmin` (dead code — the layout blocked first), and the ~20 API routes on `member` only. Net effect: an ADMIN saw a card for *every* hub on the dashboard but hit "You don't have access" on click (dead-end cards), and a GUIDING_TEACHER — whom `RIM_Role_Design.md` grants "implicit coordinator on every hub" — was silently blocked from any hub they hadn't joined, making that documented reach unreachable.

**The design decision (and why).** Hub access is a *pastoral* capability, not a technical one, so the lever is GUIDING_TEACHER (dharma authority), not ADMIN (technical). New `lib/hubAuth.ts::canAccessHub(member, roles)` is the single access door: a `HubMember` row OR `GUIDING_TEACHER`. ADMIN-alone deliberately does **not** pass — it configures hubs from `/admin/hubs` (outside) and participates from inside as a member (the session-128 boundary held). The principle Jesse and I landed on: the guiding teacher can walk into any room, but is *seen* when they do (presence stays attributable via existing `archivedById`/`editedAt` fields) — not one-way glass. Applied at the layout, 11 sub-pages, and 20 API route files (33 gate sites), collapsing the three disagreeing tiers onto one helper (the same move `effectiveCoordinator` made in session 115). Dashboard split into "Where you're contributing" (memberships, with unread badges) + a quieter "oversight" group (every other hub, transparent cards) for admin/GT — primary thing first, reach available but not competing.

**The invisible-role bug.** Verifying the fix surfaced the real root cause of Jesse's confusion: `RolesSection.tsx` only offered 5 roles — `GUIDING_TEACHER` had **no UI surface at all** and could be granted only by editing the DB. So the role that now opens every hub was invisible and unauditable, and Jesse's account may never have actually held it. Fix (`1c05778`): a "Sangha-wide authority" group exposing GUIDING_TEACHER with a plain description of what it grants. No API/schema change (the PATCH already validated the full enum, ADMIN-gated). Jesse then assigned it to himself and confirmed Course Hub access works — closing the loop honestly.

**Reviewer sub-agent** (on the access diff) found two real gaps, both fixed before commit: `/api/hub/[slug]/route.ts` used an `isMember` idiom my grep missed (now `canAccessHub`), and `categories` DELETE gated on an inline `isAdmin || isCoordinator` that omitted GT (now `effectiveCoordinator`).

**What this connects to:**
- **canAccessHub joins the hubAuth helper family** (`effectiveCoordinator` / `requireCoordinator` / `canManageTrash`) — those govern *authority within* a hub; `canAccessHub` governs *the door*. All four now honor GT; only the door distinguishes ADMIN (out) from GT (in).
- **Session 128's ADMIN boundary** is preserved and now *explained* — the access policy in `RIM_Hub_Engineering.md` was actively wrong ("GT must be a member like ADMIN") and is corrected.
- **The member registry / section-registry** (`RolesSection`) — GUIDING_TEACHER is now a first-class assignable role there.
- **Dashboard hub listing** — no longer flattens; reflects the two relationships (your teams vs. the sangha you steward).

**What comes next:**
- **GT-presence badge** (deferred, now backlogged `2026-06-03-001`) — the legibility piece: when a guiding teacher enters a hub they don't formally belong to, the team should see *them*, not an anonymous coordinator. Matters most the day RIM has a second guiding teacher.
- **A staff-manual chapter on roles + who-can-access-a-hub** doesn't exist; no current chapter was invalidated, but the gap is worth a future seed.
- Verification on the deployed site of the dashboard grouping + entering a non-member hub as GT (Jesse confirmed Course Hub works).

**Memory:** added `feedback-verify-state-not-docs.md` — don't assert a user's role/account state from documentation prose; verify the live value (DB/UI) or say you haven't. I twice told Jesse he "was" GUIDING_TEACHER based on a doc sentence; that unverified assumption was the crux of the confusion.

**Note:** the production DB (Neon) was unreachable from the dev sandbox all session (even with the network sandbox disabled — `...:5432`), so role/membership verification had to happen through the UI rather than a query. Worth remembering for future diagnostic work from this machine.

---

## 2026-06-01 (session 134) — Site-wide audit + dead-code & CSS cleanup + Webflow-reversal doc correction

Jesse asked for a full audit of the app — every route, feature, and module — to regain scope and find what's abandoned or bloated. Produced a site map, then removed the dead weight across four verification-gated commits on `main`.

**Commits:** `a5e1e41` (dead code + Sanity decommission + bug fix) · `e4d9355` (CSS audit, −3,686 lines) · `48caa0c` (Webflow-reversal doc correction) · `81c810f` (backlog + CSS-tools doc fixes).

**The audit (read-only first).** Inventoried 73 page routes, 114 API routes, ~50 Prisma models, 4 crons, ~65 components, ~40 lib modules via four parallel Explore agents (public pages, component/lib orphans, API/schema usage, tools/admin/session inventory). **Every removal claim was then verified by hand** — several agent findings were wrong and corrected before acting (see "what this connects to").

**Dead code removed (`a5e1e41`):**
- **Sanity decommission:** `/glossary/[slug]` + `/volunteer-positions/[slug]` pages, `lib/sanity.ts`, `lib/queries.ts`. `/api/admin/courses` re-pointed from retired Sanity to Postgres for linked-program names — also a **latent bug fix**: it queried Sanity with Postgres Program IDs that never matched, so the course-access admin panel's "linked programs" was always empty.
- **4 unreferenced components:** `TiptapEditor` (orphan demo, superseded by `rim-tiptap`), `SupportSettingsClient` (Support Inbox, removed s100), `HubManageClient`, `LazyVideoRoomEmbed`.
- **4 orphan API routes:** `/api/account/courses`, `/api/courses/[slug]/enrollment`, `/api/lessons/[slug]/progress`, `/api/admin/populate-livekit-rooms`.
- **`AppSetting` model** + idempotent `DROP TABLE app_settings` migration (Support Inbox residue, dead since s100).
- **2 style-guide pages** (`/style-guide`, `/admin/style-guide`).
- **Kept deliberately:** `LessonTeacher` (member-DB-backed, editor-wired, and actually displayed — see below), `SubClaim` (FK chain), `UserToolAccess` (intentional per-user grant), NextAuth adapter tables, `MigrationFlag`.

**CSS audit (`e4d9355`):** `custom.css` 27,175 → 23,489 lines (~3,686 / ~13.6% removed), all dead CSS from removed features, verified safe (brace-balanced throughout, postcss-idempotent, parses clean, **zero live classes in the removed set**). Removed: Support Inbox `si-`/`sic-` (~1,800), BlockNote/Bear/FormatPill editors + old root-Tiptap (`bn-`/`bear-`/`mantine-`/`fmt-`/`rim-block-editor`/`rim-prose-editor`/`tt-`/`rte-`/`img-`) via a postcss rule-level prune of 239 fully-dead rules (~1,370), style guide `sg-` (~300), old "my library" `ml-` (76), backlog page `bl-` (221), Editor Lab `el-`. Two reusable hygiene tools added: `scripts/css-prune.mjs` (postcss dead-rule remover, dry-run default) + `scripts/css-cut.mjs` (banner-delimited block cut) — noted in CLAUDE.md CSS Rules so future sessions find them. **Deliberately left:** the Webflow legacy shim (still load-bearing — `.section` ×67, `.w-richtext` ×8, runtime `.ProseMirror`/`.is-editor-empty`) to retire wholesale at the public-page rebuild; ~64 dead remnants grouped in shared rules with live selectors.

**Webflow-reversal doc correction (`48caa0c` + memory).** Jesse clarified a major architectural fact: RIM is no longer moving *to* Webflow — it's moving *away*, rebuilding the whole site natively as one integrated Next.js app; the public pages are early/rough, not Webflow-superseded duplicates. Corrected `RIM_Stack_Reference.md`'s "What's been built" intro (still said "moving to Webflow") and rewrote the false `memory/project-architecture-pivot.md` (claimed "pivot committed, rim-connect.js v3 live in production"). The two architecture docs were already banner-superseded. Removed 3 obsolete Webflow-workflow memory files (`feedback-audit-webflow-by-html`, `webflow-cache-and-mcp-limits`, `feedback-webflow-cleanliness`) + trimmed the MEMORY.md index.

**`/admin/ideas` (`81c810f`).** The backlog *viewer* page was found gone (intentionally removed earlier in `e480033`); `data/backlog.json` (38 items) is alive and git-tracked. Decided git-only; fixed the stale CLAUDE.md backlog step that promised a page. Kept the two CSS hygiene scripts and made them discoverable in CLAUDE.md.

**What this connects to:**
- **Sanity retirement** (`sanity-status` memory): this removed the last two Sanity-backed *pages*; `@sanity/client` + `@portabletext/*` deps remain because `MemberGate.tsx` + `lib/email.ts` still import portable-text rendering. Pruning them is queued (backlog `2026-06-01-002`).
- **CSS architecture** (FEATURES §10): the legacy Webflow shim is the only significant dead-ish CSS left, and it's coupled to the not-yet-rebuilt public pages — its retirement is part of the public-page rebuild, not a standalone cleanup (backlog `2026-06-01-001`).
- **The teacher model** (ProgramTeacher / TeacherProfile, s79/124): the audit's "LessonTeacher is write-only, drop it" was **wrong** — `LessonTeacher` is read via Prisma relation `include` and displayed on the lesson page (a "Teachers" section linking to `/teachers/[slug]`) and aggregated into a course byline. The member-DB-backed lesson-teacher integration Jesse wanted already exists. The grep missed it because it searched `db.lessonTeacher.*`, not the relation include.
- **The Webflow removal arc** (s83–102): this closes the documentation side — the *direction* (away from Webflow) is now stated correctly everywhere current.

**What's next:** public-facing pages are the next major build area (they exist but are rough). Deferred: Webflow shim retirement (with the public rebuild), `@sanity`/`@portabletext` dep prune, the s133 session-room verification pass. Spot-check this session's deploys on the editor/hub/course/program surfaces (where removed CSS lived).

---

## 2026-05-31 (session 133) — Session-room UX batch: clarity, chat, join defaults, pinning, fullscreen share, full names

Jesse brought a list of session-room ("meeting software") issues. Worked as four reviewer-gated slices + a follow-on, all on `main`, all type-checked, each shipped behind a code-reviewer sub-agent pass.

**Commits:** `232973e` (Slice A — Bell-mode label clarity + device chevrons removed) · `8021388` (Slice B — DM by clicking a name + unread-chat badge) · `6c929c2` (Slice C — join muted/dark by default + local Pin) · `f7d4517` (Slice D — fullscreen screen share + pre-share primer) · `acb8650` (full names on tiles/roster/chat).

**What shipped:**
- **Bell mode label** — stable "Bell mode" label + gold "On" marker when active (was flipping to "Clean voice" *while in* bell mode — read backwards). A clear-seeing fix.
- **Device chevrons removed** — the inline mic/camera chevrons duplicated the Settings panel and read as dead controls; `DevicePickerMenu` deleted, off-state red via `.rim-cb-btn--off`.
- **DM by clicking a name** — `ParticipantsPanel.onMessageParticipant` closes the roster, opens chat, pre-targets a private message; chat `recipient` lifted to `RIMConference`, `RIMChat` made controlled.
- **Unread-chat badge** — always-on `DataReceived` listener in `RIMConference` counts `CHAT_TOPIC` packets while the panel is closed (own sends never count — LiveKit doesn't loop publishData to the sender), resets on open, capped "9+".
- **Join muted + camera off** — `Greenroom.acquireMediaPermission()` acquires the grant via `getUserMedia` + immediate `stop()` (never publishes — "join unseen"), so later turn-on is instant; gesture chain + denial→Recovery preserved; `Status` enum renamed `auto-acquiring`/`acquiring`.
- **Local Pin** — hover a tile → Pin keeps that person as the viewer's own main view (not broadcast); `sessionRole` context carries `pinnedIdentity` + `onTogglePin`; precedence manual pin > screen share > speaker > gallery; pin banner gives a visible Unpin.
- **Fullscreen screen share** — a published ScreenShare auto-focuses for everyone (was a small tile), camera tiles drop to the filmstrip; new `ShareScreenPrimer` frames the browser's own (unstylable) picker; speaker-view "keep pin" guards require a Camera source so a stopped share can't leave a blank pin.
- **Full names** — tiles/roster/chat via `lib/livekit.ts::sessionDisplayName` (`(preferredName || firstName) + lastName`), wired into the token + chat routes; global `session.user.name` stays first-name-only.

**Design decisions and why:**
- **getUserMedia-prewarm over LiveKit enable-then-disable for join-muted.** The reviewer flagged that enable-then-disable briefly publishes a frame to the room before muting. For a contemplative space, "join unseen" is a correctness criterion, so we acquire permission without ever publishing. Standard "join muted" pattern; primes the grant for instant later turn-on.
- **Local Pin only, no host Spotlight.** Jesse chose personal pinning (anyone pins anyone, affects only their own view) — simplest, covers "keep the teacher full-screen."
- **The browser screen picker can't be made "like Zoom."** Communicated the hard web-platform constraint (getDisplayMedia source selection is browser-controlled and unstylable). The achievable approximation is a calm primer + the fullscreen result. Jesse chose the primer.
- **Full names honor `preferredName`** (consistent with the rest of the app), scoped to the session room only.
- **Bell mode / chevrons are correctness, not polish** — a toggle whose label contradicts its state and two dead arrows both violate clear-seeing.

**What this connects to:** the LiveKit session room end to end (§38) — `RIMConference` layout orchestration, control bar, tiles, chat, the Greenroom join flow, the token/chat routes; the identity-vs-capability permission model (session 125 — screen-share + pin slot into the same `layoutContext.pin` mechanism); `feedback-community-not-anonymous` (full names); `feedback-measure-before-agreeing` (latency 2+7 deferred to a live pass); `feedback-clear-seeing-is-correctness` + `feedback-pivot-when-fragile` (Bell label + getUserMedia pivot).

**Reviewer track record:** Slice A clean; Slice B clean (folded in explicit font-size + 44px mobile tap target); Slice C clean, then a focused re-review of the getUserMedia pivot (clean, flagged iOS-Safari verification); Slice D caught one medium (speaker-view stale screen-share pin) fixed pre-push. The full-name change was small/traced enough to verify directly.

**Created this session:** `RIM_SessionRoom.md` (per-tool engineering doc, closing-ritual step 4d) + Design Orientation table entry in CLAUDE.md. Manual chapter `host-session-room` bumped to v10.

**Deferred:** latency/sync (items 2 + 7) parked per Jesse — needs a live measurement pass; mobile pin-from-tile; sharer's blank self-tile; guest full-name nudge. See backlog `2026-05-31-001..004` and UP_NEXT.

**What comes next:** live verification on the deployed site (especially the iOS-Safari no-re-prompt check on join, and the uncropped fullscreen share), then the latency measurement pass when Jesse can get a 2–3 person room.

---

## 2026-05-27 (session 132 continuation) — Threshold integrity: warmth across the post-join sequence + agreement-bypass closure

Five additional commits beyond the original `/join` slice doc sweep (`c44aba1`). The morning shipped the visible UX of the threshold — `/join` page, integrated panel, two orphans deleted. The afternoon closed the invisible integrity: the threshold needed to actually be load-bearing, and several gaps existed.

**Commits, in order:**
1. `6fce1e5` — `/login/check-email` warm post-`/join` variant (state-driven)
2. `e840b68` — `auth.ts`: branch sign-in code template on `emailVerified`, not `agreedToTerms`
3. `893d698` — Enforce agreement + archive gates structurally via `(authenticated)/` route group
4. `795129e` — `/login`: not-found soft-redirect to `/join` when email doesn't exist
5. `9dcbc32` — Auth: harden the not-found check at the API level + fail-safe on DB errors

### What this work connects to

Each commit addressed one beat or one gap in the post-`/join` arc. Together they make the threshold actually be a threshold: a new member who walks through `/join` gets warmth from the first email through the dashboard landing; a visitor at `/login` cannot inadvertently end up as an un-agreed account; the dashboard cannot be reached without crossing the agreement.

### Commit 1 — `6fce1e5` — `/login/check-email` warm post-`/join` variant

Jesse named the problem precisely: *"This is the page that comes up after joining. It's appropriate, but at this stage, it should also be part of the nurturing and onboarding sequence. This is abrupt and kind of cold."* The single check-email page was serving two very different moments identically — utility for returning members, but cold-and-procedural for a member who had just completed the intentional `/join` threshold.

Approach: state-driven, not query-param-driven. Server-side `User` lookup by email returns `firstName`, `agreedAt`, `emailVerified`. New helper `isInPostJoinWindow(agreedAt, emailVerified)` returns true when `agreedAt` is within the last 5 minutes AND `emailVerified` is still null — short enough that returning members don't accidentally get warm framing, long enough to survive a submit→inbox→back cycle. Two copy variants: default (mailbox emoji + "Enter your code" + "We sent a 6-digit code to email") and post-`/join` (no emoji, "Almost there, Jesse." + "Two things just arrived in your inbox: your sign-in code, and a short welcome letter. Type the code below to enter…"). The "Two things just arrived" sentence is load-bearing — it acknowledges the welcome letter we just sent alongside the code, so the user knows the second email is for them, not noise.

Lint sidebar: `Date.now()` in a server component body trips the `react-hooks/purity` rule (over-eager about server components). Hoisting the time math into a function outside the component sidesteps it cleanly.

### Commit 2 — `e840b68` — `auth.ts` template routing fix

When Jesse asked me to audit for other "welcome back"-style inconsistencies after the check-email page, the audit found a structural one — and it was caused by something I'd just shipped. The original `/join` slice routed new members through the QUIET `sign-in-code-returning` template because `auth.ts::sendVerificationRequest` was branching on `agreedToTerms`, and `/join` sets `agreedToTerms: true` BEFORE the code email goes out. Net effect: a brand-new joiner received a routine "Your sign-in code… access your account" email instead of the warm "Welcome to Rooted In Mindfulness… complete your account" variant. The body of the returning template doesn't literally say "welcome back," but its tone is wrong for the post-threshold moment.

The right discriminator is `emailVerified`. NextAuth's PrismaAdapter sets it only after the first successful code verification, so it cleanly distinguishes "has ever signed in" from "agreed but hasn't signed in yet." All three audiences land correctly: Door B `/join` user gets the warm variant on their first code email; Door A first-time visitor (no `/join`, no `User` row yet) also gets the warm variant; Door A returning member gets the quiet variant.

The existing `NEW_USER_BODY` text works for both first-time audiences as-is — "Welcome to Rooted In Mindfulness" lands warm in both contexts, and "Enter this code on the sign-in page to complete your account" is accurate for both (`/join` users: their account exists but isn't verified; Door A first-timers: their account is about to be created). Documentation updates in `FEATURES.md` §1, `RIM_Auth.md` Door A + Door B descriptions, and `UP_NEXT.md` verification step 2 — the original `/join` slice doc sweep had incorrectly stated "the quiet returning-user template fires" because I'd misread my own intent. Lesson: the closing-ritual doc sweep should re-read what was committed earlier in the same session to catch this kind of self-introduced staleness.

### Commit 3 — `893d698` — Route-group layout: structural agreement + archive enforcement

Jesse's audit question: *"Can a member still accidentally sign up by bypassing the Join Us pathway by just signing in?"* The answer was yes — the documented enforcement (in FEATURES.md §14 and the Account Archival section) was that `proxy.ts` redirected un-agreed users to `/account/welcome` and archived users to `/account/reactivate`. That was stale documentation. `proxy.ts` is intentionally a no-op (NextAuth v5 with the Prisma adapter cannot verify sessions in the Edge runtime — running auth there causes login loops). No per-page guards enforced either gate either. Result: any first-time visitor at `/login` who verified a code landed directly on `/account/dashboard` without ever seeing the Community Care Agreements; any archived member who signed in reached the dashboard instead of the reactivation flow.

The fix uses Next.js App Router's canonical mechanism for shared auth-gating: a route group. Five directories moved into `app/account/(authenticated)/` via `git mv` (history preserved): `courses`, `dashboard`, `dashboard-my-profile`, `hub`, `programs`. Two stay outside (`welcome`, `reactivate`) so the layout's redirects to them can't loop. Route groups are URL-invisible — `/account/dashboard` etc. all resolve unchanged.

The new layout at `app/account/(authenticated)/layout.tsx` runs three checks server-side, all reading enriched session fields (no DB query): no session → `/login`; `!agreedToTerms` → `/account/welcome`; `archivedAt` set → `/account/reactivate`. `agreedToTerms` and `archivedAt` are already enriched onto `session.user` by the auth.ts session callback, so all three checks are JWT reads.

Why a layout instead of a per-page `requireMember()` helper: a helper would have worked for the immediate fix (smaller diff, same effective behavior), but would have leaked the auth concern across N files and required discipline on every new `/account/*` page added in the future. The route group enforces the gate structurally — any new route added under `(authenticated)/` is automatically gated. This is the canonical Next.js pattern and matches the RIM design philosophy: restraint means using the framework's mechanism rather than inventing a parallel one. Per the memory file [[feedback-clear-seeing-is-correctness]]: design choices that prevent drift ARE correctness, not polish.

Stale documentation cleanup in the same commit: `RIM_Auth.md` (Door A step 7 + Door B step 6), `FEATURES.md` Account Archival section + §14 key files + technical notes, and `CLAUDE.md` Workflow + Key Files — all of which had claimed `proxy.ts` enforced this. Replaced with the actual layout-based mechanism.

### Commit 4 — `795129e` — `/login` not-found soft-redirect

Jesse's next test: *"I'm trying to sign in to an account that's not in the system, and it still takes me to that enter code page."* The UX gap: typing any email at `/login` sent a 6-digit code, regardless of whether a `User` row existed. NextAuth's Resend provider creates a `VerificationToken` and dispatches the email unconditionally; the PrismaAdapter creates the User on first verification. So a visitor who thought "I'll sign in" with an email RIM had never seen got a code, typed it, became a User row with `agreedToTerms: false`, and was bounced by the new `(authenticated)/` layout to `/account/welcome` for the agreement ritual. Functional, but the UX read as "I tried to sign in and ended up in a sign-up flow without warning."

Symmetric fix to the `/join` → `/login` soft-redirect that already handled the already-member case. `/login`'s `handleSignIn` server action now does `db.user.findUnique({ where: { email } })` BEFORE calling `signIn()`; if no User exists, redirects to `/login?notMember=1&email=ENCODED` with a warm not-found panel ("We don't have an account for `<email>`. If you're new to RIM, you're warmly welcome — become a member →"). `/join` accepts `?email=` and pre-fills via a new `defaultEmail` prop on `JoinForm`. Message hierarchy on `/login`: `?notMember=1` + `?email=X` → not-found message; `?email=X` only → existing already-member message; otherwise → default form.

Privacy disclosure: this reveals whether a given email has a `User` row (different page content per email). The leak already exists via the public `/api/account/check-email` endpoint used by the program registration form's pre-fill, and for a community-membership site the UX win is worth the modest disclosure.

### Commit 5 — `9dcbc32` — Catch-all hardening + fail-safe

Jesse's clarification on the previous commit: *"I sent that last statement after I sent the first one. I didn't check your work. Did the first work fix this issue? If not, just use best practices and make sure that all of that is accounted for."* Tracing through confirmed the original fix should work once deployed (his "And it sent me a code" was deploy-timing), but the audit exposed two gaps the original commit didn't cover:

1. **DB-error fail-safe.** If the `findUnique` threw (Postgres hiccup, connection limit), `existing` would be undefined → falsy → redirect to "not a member" — falsely sending a real member to `/join`. Now both checks wrap the lookup in try/catch with a separate `lookupFailed` flag; on error, fall through to `signIn()` so real members get their code. The `(authenticated)/` layout still gates dashboard access on `agreedToTerms`, so the worst case is one extra User row that the 48h cleanup cron will sweep.

2. **Direct API bypass.** The `795129e` check lived only in `/login`'s server action. That covers browser form submissions because NextAuth's `signIn()` runs in-process from a server action — no HTTP roundtrip to `/api/auth/signin/resend`, so the catch-all wrapper doesn't fire for that path. But any OTHER caller of `POST /api/auth/signin/resend` — direct scripted POSTs, future client-side `signIn()` calls, external integrations — would bypass the `/login` check entirely. The catch-all wrapper at `app/api/auth/[...nextauth]/route.ts` now does the same existence check after the rate-limit check, with the same fail-safe semantics. Unknown emails get a 303 redirect to `/login?notMember=1&email=…`. New helper `notMemberResponse(reqUrl, email)` mirrors the shape of `rateLimitResponse(reqUrl)`.

Rate-limit ordering: the existence check fires AFTER the rate-limit check. So a probe-the-DB-for-emails attack costs rate-limit budget per probe — bounded by 20 probes per IP per 10min via `signin-ip:<ip>`.

### What's now true across every entry point

After this arc, the integrity of the threshold is comprehensive. Walking each path that could create or consume a `User` row:

| Entry point | Behavior |
|---|---|
| `/join` form | Intentional ritual; agreement required at the door; warmth all the way through |
| `/login` form (existing email) | Code sent, normal sign-in |
| `/login` form (unknown email) | Caught at server action → warm not-found panel + link to `/join?email=…` |
| Direct `POST /api/auth/signin/resend` (existing email) | Code sent, rate-limited |
| Direct `POST /api/auth/signin/resend` (unknown email) | Caught at catch-all → 303 to `/login?notMember=1&email=…` |
| Direct `POST /api/auth/callback/resend` (forged token) | Rejected by NextAuth's token verification |
| Any path that creates an un-agreed `User` row | Caught at the dashboard by `(authenticated)/` layout → `/account/welcome` |
| Any path that creates an archived-but-signed-in scenario | Caught at the dashboard by `(authenticated)/` layout → `/account/reactivate` |
| Abandoned-mid-flow User rows (either path) | Swept by the 48h cleanup cron's two-path query |

### Reviewer sub-agent track record this continuation

Skipped for all five commits — each was either a small focused change with strong type discipline, a structural move (`git mv` with no logic changes), or a documentation pass. Reviewer's value-add was lower than the cost of the round-trip for these. The original `/join` slice (`28ab0f5`) was the right place for the reviewer run, and it caught the two showstoppers there (rate-limit bypass, missing `?email=` pre-fill).

### Step 8b behavior audit

Scanning this continuation arc for memory candidates:

- **Stale documentation drift was the real pattern.** Two findings in two days: `proxy.ts` was documented as enforcing the agreement + archive gates but was a no-op; `auth.ts` was documented (by me, in the same session) as routing `/join` users to the quiet template but should have routed to warm. The first was inherited drift; the second was self-introduced staleness in the same session. The pattern isn't novel enough to memorialize as a new memory file — it's covered implicitly by existing memory files about reading the actual code before relying on documentation (`feedback-inventory-first`, `feedback-engagement`). The closing-ritual doc sweep is where this gets caught; that worked here.
- **Delegated architectural choice.** Jesse said *"Do what you feel is best and conforms to best practices and our design principles."* I chose the route-group layout over the per-page helper. That choice felt right; he didn't push back. No memory entry needed — the principle is already covered by [[feedback-clear-seeing-is-correctness]] (structural enforcement beats per-page discipline) and the existing design principles.

No new memory files this continuation. The existing ones held up.

### What comes next

The verification walk on the deployed site (see UP_NEXT.md) covers everything from this arc. After that's done and confirmed, the bigger threads still open are voice extraction (`RIM_Voice.md` — pending Jesse's writing samples), the `/account/dashboard` first-visit framing for new members (Beat 4 of the onboarding sequence, deferred until the home/dashboard design pass), and the homepage formal design.

---

## 2026-05-27 (session 132) — `/join` slice: new-member threshold door, consolidated agreement text, two orphans deleted

Four commits on `main`. The slice rebuilt the new-member sign-up flow end-to-end: a separate threshold page distinct from `/login`, the agreement text consolidated to one canonical source used by every surface, and two orphan pages (plus an entire CSS prefix) removed from the codebase.

**Commits, in order:**
1. `28ab0f5` — Add `/join` — new-member threshold page distinct from `/login`
2. `22a3210` — `/join`: integrate agreements + form into one panel; consolidate to one canonical agreement text
3. `21f14cf` — Nav: link to `/join`; delete orphan `/community-membership` page
4. `120badd` — Delete orphan `/account/dashboard-member-care-agreements` page + `.mc-*` CSS

### What this work connects to

Touches every surface that previously asked someone to commit to RIM's community ethos: `/login` (was the single dual-purpose door), `/account/welcome` (post-sign-in welcome ritual), program registration (inline agreements section for non-signed-in registrants). The Nav, public Programs listing, the diversity page, and three orphan reference pages all carried stale references to `/community-membership` from the Webflow era. Closes FEATURES.md §14 "Community Onboarding & Membership Philosophy" gap — the section described a two-path model (Path A through programs, Path B through `/login`), but a third path (intentional sign-up through a dedicated threshold page) wasn't represented either in code or in the doc.

### Commit 1 — `28ab0f5` — `/join` threshold page + shared rate-limit module

New files:
- `app/join/page.tsx` — server component, hero ("Become a member") + the Webflow intro paragraph, four agreements as cards (initial cut; restructured in commit 2), sign-up form section below.
- `components/JoinForm.tsx` — client component: first name, last name, email, optional phone, agreement checkbox, submit. Calls a new POST `/api/account/join`.
- `app/api/account/join/route.ts` — POST handler. Validates name + email + agreement. Upserts the User with `agreedToTerms: true` + `agreedAt: now`. Triggers `signIn("resend", { redirect: false })` to send the 6-digit code. Sends a warm welcome letter and enrolls in the onboarding course series in `after()` callbacks (session 96 reliability pattern). If a member with `agreedToTerms: true` already exists at the email, soft-redirects them to `/login?email=…` instead of duplicating the threshold ritual.
- `lib/authRateLimits.ts` — shared constants + key helpers (`signinEmailKey`, `signinIpKey`, `verifyIpKey`, `EMAIL_MAX = 5`, `IP_SEND_MAX = 20`, `WINDOW_SECONDS = 600`). Both `/api/auth/signin/resend` (the NextAuth catch-all) and `/api/account/join` import from here so alternating between doors does NOT double an attacker's budget. The catch-all was refactored to import from the same module.
- `lib/communityAgreements.ts` — canonical agreement text (short version, four items: title + one-sentence summary), shared lead-in copy, shared checkbox label.
- `lib/email.ts::sendJoinWelcomeEmail` — new email helper.
- `prisma/migrate.mjs` — defensive `findUnique → create` seed for the `join-welcome` template (Email Template Gate compliance).

Modified files:
- `app/login/page.tsx` — accepts `?email=` from searchParams and pre-fills via `defaultValue`, renders a calm one-liner above the form ("It looks like you already have an account with us. Sign in to continue.") when arriving from /join's soft-redirect. H1 simplified from "Join or sign in" → "Sign in". Subhead trimmed; new "New to RIM? Become a member →" link points to `/join`.
- `app/api/cron/cleanup-incomplete-accounts/route.ts` — widened from one path to two: existing `agreedToTerms = false AND createdAt > 48h` PLUS new `agreedToTerms = true AND emailVerified IS NULL AND createdAt > 48h` (the `/join` user who got a code but never verified). Without the second path, abandoned-mid-verify accounts would linger indefinitely.

**Reviewer sub-agent caught two showstoppers + one low pre-commit.** Showstopper 1: the join endpoint bypassed the session-131 rate-limit (which lives in the NextAuth catch-all) — an attacker could email-bomb arbitrary recipients via this new door. Fixed by extracting rate-limit constants to `lib/authRateLimits.ts` and applying them in the join endpoint with the same keys. Showstopper 2: `/login` didn't read `?email=` from searchParams, so the soft-redirect promise from `/join` was broken end-to-end — users landed on an empty form. Fixed. Low: re-fetch of user.id inside `after()` callback when the upsert already had it; captured directly.

### Commit 2 — `22a3210` — integrate agreements + form into one panel; consolidate to ONE canonical agreement text

Jesse spotted that the first cut rendered the four agreements twice on `/join` — once as four cards in the foreground, then again as full long-form paragraphs inside the form. Same idea, twice. Worse: `WelcomeForm` and `RegistrationForm` each kept their own collapsed `<details>` copies of the long paragraphs, so a single edit to the agreement text meant editing it in three different places with three different shapes.

The fix mirrored the Webflow Community Membership page: agreements + form live in ONE integrated panel; the agreements are a numbered list with bold titles + one-sentence summaries.

Changes:
- `lib/communityAgreements.ts` dropped the LONG paragraph version. The SHORT version is now THE canonical agreement text (renamed `COMMUNITY_AGREEMENTS_SHORT` → `COMMUNITY_AGREEMENTS`). Lead-in updated to the Webflow phrasing. Three new constants — `JOIN_HERO_TITLE`, `JOIN_HERO_INTRO`, `JOIN_FORM_LEAD` — carry the page's hero + form-section copy verbatim from the Webflow page.
- `/join` page rebuilt: header on top ("Become a member" + intro), then ONE `jn-panel` containing agreements + form together, divided by a soft rule. The agreements are an `<ol>` with title + summary per item. No more cards-and-paragraphs duplication.
- `JoinForm` dropped its long-form agreements section entirely. The form is just fields + checkbox + submit + "Already have an account →".
- `WelcomeForm` replaced its collapsed `<details>` long paragraphs with the same visible numbered list. Imports from communityAgreements.
- `RegistrationForm` did the same.
- CSS: `.jn-card`, `.jn-card__title`, `.jn-card__body`, `.jn-formwrap`, `.jn-agreements__grid`, `.jn-agreements-long__*` removed (now-unused). `.jn-panel`, `.jn-panel__heading`, `.jn-panel__subheading`, `.jn-panel__divider`, `.jn-agreements-list` added. Same numbered-list shape adapted into `.wl-agreements__list` and `.pg-form__agreements-list`. The dead `.wl-agreements__details`, `__body`, and `::-webkit-details-marker` rules (and the matching `.pg-form__agreements-*` set) removed.

Net: 219 insertions, 345 deletions. One agreement text. Three surfaces showing it identically in shape, sized for their context.

### Commit 3 — `21f14cf` — Nav repointed to /join; orphan /community-membership deleted

The Nav had a "Join Us" entry pointing at `/community-membership` — a Webflow-port read-only page that displayed the long-form agreements with no path to actually join. Now that `/join` is the threshold ritual, the read-only page is redundant. Per Jesse's call: "site's not live yet... feels safe to just get rid of it to keep our system clean."

Nav (`components/Nav.tsx`):
- Desktop "Member Area" dropdown for signed-out viewers: order swapped so "Become a Member" appears first (the threshold is the more important door for someone discovering RIM), then "Sign in" below. Copy refreshed.
- Mobile menu for signed-out viewers: "Join RIM" link replaced with "Become a Member" + a separate "Sign in" entry. Same ordering.
- Both surfaces now point at `/join`.

Orphan page removed (`app/community-membership/page.tsx`): Webflow-shim CSS classes, out-of-date long-form copy of the agreement paragraphs (which we'd just deleted from `lib/communityAgreements.ts` in commit 2).

Stale link cleanup — every other reference to `/community-membership` in active code:
- `app/community-programs/page.tsx`: hero CTA → `/join`, copy updated to "Become a Member" for consistency with the nav.
- `app/diversity/page.tsx`: "Join Us!" button → `/join`.
- `app/programs/[slug]/page.tsx` (lines 278, 287): two "member home" links that said "Members access Zoom via their **member home**" with the href pointing at `/community-membership` — a pre-existing bug where link text didn't match destination. Fixed both to `/account/dashboard`, which is what "member home" actually is and what the signed-in branch one ternary up already uses.
- `app/account/dashboard-member-care-agreements/page.tsx`: removed the dead "Read more about our community on the Community Membership page" footer link (would 404 after this commit).

### Commit 4 — `120badd` — second orphan deletion + `.mc-*` CSS cleanup

Surfaced while sweeping `/community-membership` references: `/account/dashboard-member-care-agreements` was ALSO an orphan. Nothing linked to it. Its own hard-coded copy of the deprecated long-form agreement paragraphs. Same pattern as `/community-membership` — orphan, redundant, drifted text.

Jesse confirmed deletion. Removed:
- The page file
- The entire `.mc-*` CSS block (header + `.mc-page`, `.mc-heading`, `.mc-intro`, `.mc-agreement`, `.mc-agreement__title`, `.mc-agreement__body`, `.mc-footer-link`)
- Two stragglers in shared typography selector lists: `.mc-heading + .mc-agreement__title` in the member-area headings list, `.mc-intro + .mc-list-item + .mc-confirm-text` in the member-area serif-prose list
- `.mc-page` and `.mc-heading` in the shared mobile media query

Every reference to the `.mc-` prefix and the `/dashboard-member-care-agreements` URL is gone.

### Reviewer sub-agent track record this session

- Commit 1 (`28ab0f5`): two showstoppers caught (rate-limit bypass, `/login` `?email=` missing) + one low (re-fetch user inside `after()`). All three addressed before commit.
- Commit 2 (`22a3210`): skipped — focused consolidation refactor with grep-confirmed no orphan refs, type-check + lint clean.
- Commit 3 (`21f14cf`): skipped — nav repoint + dead-link sweep, mechanical.
- Commit 4 (`120badd`): skipped — orphan deletion + CSS prefix sweep, mechanical.

### Memory candidates from step 8b behavior audit

Proposed for Jesse's confirmation at closing:

- **`feedback-community-not-anonymous.md`** — *"A community isn't a community if it's anonymous."* Triggered by Jesse's explicit statement when confirming name collection on `/join`. Generalizes to: RIM community surfaces always require real names; never default to anonymous or single-field flows for community membership.
- **`feedback-honor-the-reference.md`** — When Jesse points at a specific reference page or design ("look at the actual page"), match its actual choices. Don't combine its content with structure or text from other contexts and call that "comprehensive." Triggered by the long-paragraph redundancy on `/join` (I had rendered Webflow's short cards AND the long paragraphs from elsewhere, instead of honoring what the Webflow page actually shows).

### What comes next

UP_NEXT.md rewritten to reflect the new state. The slice is shipped, but end-to-end verification on the deployed site is pending (Jesse will walk the three paths: `/join`, the two emails landing, and Nav placement). Voice extraction for the welcome email letter remains parked until writing samples are gathered. Sessions 125–131 verification pass also still queued.

---

## 2026-05-27 (session 131) — Four small follow-ups: endDatetime guard, hub coverage editor, reliability sweep, rate-limit, auto-coordinator, closing-ritual step 8b

Five commits on `main`. Each closes a parked item from the session-130 backlog rather than starting new work. The session was a sustained "knock items off" pace: each follow-up arrived with a known shape, was implemented in 15–60 minutes including reviewer + commit, and shipped in isolation. No surprises.

**Commits, in order:**
1. `a8fbe60` — `endDatetime` guard in shared helper + hub coverage-copy admin form
2. `2d1c8d1` — Fire-and-forget reliability sweep (9 sites in 5 files)
3. `377d0f4` — Rate-limit on NextAuth signin + callback endpoints
4. `ba1f67e` — Hub-creation auto-coordinator
5. `1d46c25` — `CLAUDE.md` step 8b behavior audit added to closing ritual

### What this work connects to

All five connect to existing systems rather than introducing new ones. The endDatetime guard generalizes a local fix from the session-130 cross-hub staffing view to the entire scheduler ecosystem (Scheduler page, This Week page, applyStandingAssignments). The hub coverage-copy editor finishes the session-130 promise that "future hubs are configuration on top of the architecture, not new code" — without it, every new hub still required a migration to set its role-aware copy. The reliability sweep generalizes the session-96 `after()` fix from the welcome-email site to every remaining `.catch(() => {})` fire-and-forget pattern in the codebase. The rate-limit slice closes backlog `2026-05-21-002` ahead of the eventual `rootedinmindfulness.org` public cutover. The auto-coordinator polish closes the session-128 catch-22 at its origin. The closing-ritual step 8b is a process refinement that makes the existing memory system more rigorous.

### Commit 1 — `a8fbe60` — endDatetime guard + coverage copy editor

**The endDatetime fix.** `lib/scheduleUtils.ts::isOccurrenceOnDate()` previously didn't honor `program.endDatetime`. Ended courses surfaced phantom future sessions on every page that walked the calendar forward — Scheduler, This Week, and all 6 standing-assignment routes that consume the helper indirectly through `lib/applyStandingAssignments`. The session-130 cross-hub staffing view (commit `fc041ea`) patched the blind spot locally inside `findUpcomingDates` with a `programEndDate` clip; the comment on that local guard explicitly flagged the helper-level fix as a follow-up. Today's slice pushes the guard into the shared helper (`if (p.endDatetime && dateStr > ctDateStr(p.endDatetime.toISOString())) return false;` right after the startDatetime check, before any recurrence branch) and removes the now-redundant local clip. The interface didn't change — `endDatetime` was already on `ScheduleProgram` — so callers got the fix transparently. Strict `>` comparison so a program whose endDatetime is exactly today still shows today's session.

**The hub coverage-copy editor.** Session 130 added three new columns to the Hub model — `coverageNoun` / `coverageVerb` / `coverageAction` — and a `getHubCoverageCopy(hubSlug)` helper that resolves them with host-team defaults ("Host" / "hosting" / "host this") as fallback. A migration backfilled values for the four existing hubs. But the admin form at `/admin/hubs/[slug]/edit` had no way to change them, so any new hub created via the admin UI silently inherited host-team's words. Today's slice adds three text inputs to `HubAdminForm.tsx` in a "Role-aware copy" fieldset positioned below the Teacher pill label area. Inputs are 40-char-capped, with live hint sentences that show what each field fills (e.g. "*Fills sentences like 'Yes, I can {action}'*"). Server-side, both POST (create) and PATCH (update) destructure the three fields, sanitize via a shared `cleanCoverageInput` helper that trims + caps + falls through to `DEFAULT_COVERAGE_COPY` from `lib/programHub.ts` on empty input. **Mid-flight surprise:** I initially designed the form payload to send `null` on empty input and the API to store null, then typecheck failed because the columns are `String @default()` (non-nullable). Spent ~10 minutes redesigning the form contract to send-empty / resolve-default. Lesson recorded as a memory candidate at closing — *read the schema column types before designing the empty-value semantics for a form input*. Reviewer caught zero blocking issues; one informational observation about per-email rate-limit key cardinality (bounded by per-IP limit anyway).

### Commit 2 — `2d1c8d1` — fire-and-forget reliability sweep

Session 96 (2026-04-27) discovered that `void (async () => { … })()` after a route handler returns silently dies on Vercel — the serverless function tears down once the response goes out, killing in-flight async work. The fix was `after()` from `next/server`. Session 96 patched the welcome-email instance. Session 128 patched a few more in the host-team flows. Nine sites remained — all enrollment side-effects and role-assignment emails that had been fired with `.catch(() => {})` and were sitting there as silent-failure-waiting-to-happen.

The sweep converted all nine, in 5 files:

- `app/api/admin/members/[id]/route.ts` — role-series enrollment loop + three role-assignment emails (REGISTRAR, HOST, HOST_MANAGER). The loop was wrapped in a single `after()` block (sequential, one log line per failure) rather than N parallel `after()` calls — cleaner log output, fewer scheduled callbacks.
- `app/api/account/complete-profile/route.ts` — onboarding-series enrollment
- `app/api/account/registrations/[id]/cancel/route.ts` — cancellation notification to registrar
- `app/api/registrations/route.ts` — onboarding-series enrollment (new guest signup branch) + program-course enrollment
- `app/api/stripe/webhook/route.ts` — program-course enrollment on payment-completed event

Every conversion adds structured `console.error("[route-name] fnName failed", err)` so future failures show up in Vercel logs instead of vanishing into the old bare swallow. Reviewer-caught drive-by: a stale `// Send confirmation email — fire-and-forget, never blocks the response` comment in registrations/route.ts on a line that's actually `await`-blocking. Rewrote the comment to reflect reality (the registration flow intentionally blocks on confirmation email delivery — the user shouldn't see "you're registered" until the email is on its way).

Sites deliberately NOT touched: `request.json().catch(() => null)` parse-fallback patterns (14+ sites; deliberate, not fire-and-forget), client-side `.catch(() => {})` in `HubHomeClient` and `BrightnessProcessor` (browser code, no serverless teardown), prisma/*.ts scripts (not route handlers).

### Commit 3 — `377d0f4` — rate-limit on NextAuth signin + callback

Closes backlog `2026-05-21-002`. Two attack surfaces hardened ahead of the eventual `rootedinmindfulness.org` cutover:

- **POST /api/auth/signin/resend** — the email-send endpoint. Limited per-email (5 requests / 10 min) AND per-IP (20 requests / 10 min). The dual limit catches both an attacker spraying one address (per-email gate) and a botnet hammering many addresses from one IP (per-IP gate). A typing-error retry pattern (~1–3 sends in a sangha-aged user's session) sits well below the threshold.
- **POST /api/auth/callback/resend** — the code-verify endpoint. Limited per-IP (20 attempts / 10 min). Combined with the existing 30-minute code expiry, exhausting 1M six-digit codes would take ~350 days at the limited rate — economically dead as an attack vector.

**Storage choice — Postgres-backed.** Three options were on the table: in-memory (per-instance, weak on Vercel), Postgres-backed (Neon, already wired), Upstash Redis (textbook production-grade, new service + env vars). Postgres-backed won because RIM's sign-in volume is very low (<100/day expected), the ~5–10ms DB round-trip is negligible at that scale, and it's cross-instance without introducing a new external service. Decision is documented in the new `RIM_Auth.md`.

**Architecture:** new `RateLimitWindow` table with `key` (e.g. `signin-email:foo@bar.com`), `count`, `windowStart`, `expiresAt`, unique on `key`, indexed on `expiresAt`. New `lib/rateLimit.ts::checkRateLimit(key, max, windowSeconds)` uses a single atomic UPSERT with three parallel `CASE WHEN expiresAt <= NOW()` branches to handle "new row / expired-window-reset / active-window-increment" in one round-trip — no read-modify-write race. The `RETURNING` clause gives the post-write `count` so the caller knows immediately whether the request is allowed. Fail-open if the DB query throws (DB-down already means nothing else works either).

**The wrapper:** `app/api/auth/[...nextauth]/route.ts` was previously `export const { GET, POST } = handlers`. Replaced with a POST wrapper that inspects `url.pathname`, applies the appropriate limits (per-email via `req.clone().formData()` to read the email field, per-IP via `x-forwarded-for`), and delegates to `handlers.POST(req)` if allowed. Blocked requests redirect to `/login/error?error=RateLimit` (303) with a calm message instead of a raw 429. GET stays untouched — auth GET endpoints (CSRF, session) have no abuse vector worth limiting.

**Cleanup:** new daily cron at 10:15 UTC (5:15 AM CT) deletes expired rows. Schedule chosen to come after the existing 5:00 AM CT cleanup-incomplete-accounts cron so all daily cleanups cluster in one window.

Reviewer caught zero blocking issues. One informational note about per-email key cardinality — bounded by the per-IP limit at 20 emails/IP/window anyway.

### Commit 4 — `ba1f67e` — hub-creation auto-coordinator

Closes the session-128 catch-22 at its origin. When ADMIN lost its content-access bypass in session 128 ("ADMIN must be a HubMember to interact with hub content"), the admin who creates a new hub at POST `/admin/hubs` could no longer enter that hub without first clicking "+ Add me as coordinator" on the edit page. That button was added in session 128 as the safety-net endpoint and remains — still useful when an admin needs to bootstrap into a hub someone else created. Today's slice removes the extra click for the standard creator flow: the POST handler now writes a `HubMember` row for the calling admin atomically alongside the hub itself, via Prisma's nested `members.create` inside the same `db.hub.create`. Values mirror the existing `/api/admin/hubs/[slug]/add-me-as-coordinator` endpoint exactly so behavior is identical between the two entry points.

### Commit 5 — `1d46c25` — closing-ritual step 8b

`CLAUDE.md` closing ritual gains step 8b: at session close, re-read the transcript with one question — *did Jesse correct, validate, or surface anything that future-me should not have to learn again?* Three signals to watch for: (1) corrections ("don't," "stop"), (2) validated approaches that weren't obvious, (3) surprises about project state or external systems. Don't write the memory files silently — list each proposed entry with a one-line summary and ask Jesse to confirm or discard. Most sessions will produce zero updates; the value is in the scan, not in always finding something. The step is positioned between "Architectural decisions" (8) and "Commit and push" (9). Memory files live at `~/.claude/projects/-Users-jessefoy-Sites-rim-next/memory/` and don't get committed to git, so ordering relative to the commit step doesn't matter functionally — only reflectively.

### Reviewer sub-agent track record this session

- Commit 1 (`a8fbe60`): zero blocking findings; one informational placement note (end-of-period strict-inequality semantics).
- Commit 2 (`2d1c8d1`): one stale-comment observation (incorporated as a drive-by).
- Commit 3 (`377d0f4`): zero blocking findings; one informational cardinality note.
- Commit 4 (`ba1f67e`): skipped — single-file mirror of a known-good endpoint, well below the non-trivial threshold.

### Memory candidate from step 8b behavior audit

Proposed for Jesse's confirmation at closing:

- **`feedback-read-schema-before-form-design.md`** — when a slice adds form inputs for existing schema columns, READ the column types from `prisma/schema.prisma` before designing the empty-value semantics. UX phrasing like "leave blank to use default" doesn't tell you whether the column is `String?` (nullable) or `String @default("X")` (non-null). Triggered by ~10 minutes of rework during commit 1 when I had to redesign the form/API contract after typecheck failed against the non-nullable `coverageNoun/Verb/Action` columns.

### What comes next

Today closes the four parked items A/B/C/D from UP_NEXT. The remaining queued follow-ons (most from session 130) are smaller — admin form for hub coverage was today's #1; the verification work for sessions 125–130 remains, and the Voice extraction (`RIM_Voice.md`) prompt from session 128 is still parked pending Jesse gathering writing samples. New `RIM_Auth.md` documents the sign-in flow + rate-limit + cleanup as the authoritative per-area reference.

---

## 2026-05-26 (session 130) — Maria's beta-test fixes: sub-request discoverability, release semantics, destructive UX

Jesse opened with a four-bug report from Maria's first real beta test of the Host Hub Scheduler. Maria couldn't find the "Ask the team to cover" affordance after clicking the confirmation email link, perceived a "reset" action as having shifted her Tuesday rotation to Wednesday, found that a full reset didn't change the visible schedule, and got a "your schedule was reset" email that didn't describe what actually happened. Out of the four, two had high-confidence root causes I could fix directly and two could not be diagnosed without screenshots or DB state — for those, the slice landed defensive UX hardening that makes the next test self-diagnosing.

One commit on `main` (`960968b`). 12 files, +441 / -99. Reviewer sub-agent caught three issues pre-commit (all addressed before the commit).

### What this work connects to

This is the first user-facing test of the auxiliary-hub coverage architecture shipped in session 129. The Scheduler, the standing-rotation pipeline, the host email builders, and the Rotations management UI all sit on top of the session-129 work. The bugs Maria found weren't with the new architecture — they were pre-existing issues in how the system communicates with hosts about their rotation membership. The session-129 audit was code-correctness-only; it didn't stress-test end-to-end user flow, which is what Maria's beta surfaced.

### Bug A — sub-request affordance not visible

**Root cause:** `HubScheduleClient.tsx` renders "Ask the team to cover" only when `kind === "mine"` AND `!isPast`. The page server-side defaults to the current month. `applyStandingAssignments.ts:268` explicitly skips past dates when creating HostAssignments — so a host whose rotation lands in a future month has zero `HostAssignment` rows in the current month and zero "mine" rows on the default schedule view. The confirmation email's "Open the Schedule" link went to `/tools/schedule?hub=…` with no month, so Maria landed on May 2026 (current), saw no actionable rows, and concluded the affordance didn't exist.

**Fix:** Two surfaces touched.

1. `sendStandingAssignmentScheduledEmail` accepts a new optional `firstSessionMonth` field and deep-links the CTA URL to `/tools/schedule?month=YYYY-MM&hub=…`. Every caller (standing-assignments POST, apply route, cron) now computes the earliest session date from the apply result and passes it. The schedule page reads `?month=YYYY-MM` (permissive parsing, falls back to current month on bad input).
2. The Your Rotations panel's "Next" block becomes a clickable button. Clicking jumps the calendar to that month via the existing month-state machine (new `jumpToMonth` helper).

**`ApplyResultSession` interface gained a required `dateStr: string` field** so apply paths can compute the earliest-month deep-link cleanly. All in-repo callers were updated. (Reviewer flagged this as a potential hidden API break for any future consumer — accepted for now since the in-repo consumers are exhaustive.)

### Bug C — release email was lying

**Root cause:** `release-host` deleted future `HostAssignment` rows for one user but **left the `StandingAssignment` rule active with their userId**. The next morning at 8am UTC, the apply cron walked the rules, found the user still in the rotation rule with empty future slots, and re-created the HostAssignments. The "released" effect silently undid itself. Meanwhile the email subject claimed "Your hosting rotation has ended" and body said "The following upcoming sessions have been cleared from your schedule." Both statements were wrong on multiple axes: the rotation hadn't ended, and the cleared sessions weren't staying cleared.

**Fix:** Behavior + email both changed coherently.

1. `release-host` now deletes the released user's `StandingAssignment` rows in the bundle AND their future HostAssignments. Other people in the bundle (an alternate-pattern co-host) keep their rules untouched. The rotation continues for them.
2. New `sendStandingAssignmentReleasedEmail` signature (now `programName`-aware, sends a no-list body variant when no future HostAssignments existed yet so the user isn't silently dropped). Subject: "You've been removed from the {programName} rotation."
3. New `sendStandingAssignmentEndedEmail` builder takes over the truly-ending case (used by `end-bundle`'s "End this rotation" with `releaseFuture=true`, and by the `[id]` DELETE route). Subject preserved as "Your hosting rotation has ended."
4. UI labels in `RotationsClient` updated to match the new semantic: "Release their dates" → "Remove from rotation"; the panel copy now explains that per-date "can't make THIS one" is the job of the sub-request affordance on the Schedule tab, not this destructive-rotation action.

This makes the two exits architecturally distinct:
- **Per-date** — Maria can't make June 2 → post a sub-request on that session's row. Rotation rule stays.
- **Whole rotation** — Maria stepping out of the rotation → "Remove from rotation." Rule deleted for her; others stay.

### Bugs B + D — defensive hardening (no root cause found)

I read every code path that could plausibly produce Maria's symptoms (clear-rotations, assignments/clear, release-host, end-bundle, the inline rotation form save, the apply paths). None of them mutate `dayOfWeek` on a StandingAssignment. None shift a HostAssignment by a day. None of the clear/reset routes silently no-op. Without Maria's screenshot or a DB snapshot of Art of Meditation's rotation state I couldn't pin the root cause — so the slice landed defensive UX that makes the next test self-diagnosing instead of trying to fix code that may not be wrong.

**Hardening that landed:**

- **Specific success toasts.** "Reset · Art of Meditation (host-team) · 1 rotation rule and 4 upcoming sessions removed." Names the program, day-of-week (via context), hub, and counts explicitly. If Maria reproduces the "day shift" perception, the toast will tell her exactly what was just deleted.
- **`router.refresh()` after every destructive action.** `loadRotations()` (rotations grid) + `onScheduleStale?.()` (client month re-fetch) were already there; added `router.refresh()` to re-fetch the schedule page's SSR data — Your Rotations panel, "Next" labels, pause-map. A stale parent server component was a plausible source of the "full reset didn't change anything" symptom.
- **0/0 race-path refresh.** When `release-host` returns `{released:0, removedRules:0}` (concurrent coordinator, double-click), the grid still refreshes so a stale row doesn't persist. (Reviewer caught this gap pre-commit.)

### Reviewer sub-agent findings

Three caught pre-commit, all addressed before the commit:

1. **CONFIRMED.** `release-host` had a guard `if (host && sessions.length > 0)` that silently skipped the email when only a rotation rule was removed (no future HostAssignments yet) — contradicting an inline comment promising "we still send when only the rule was removed." Fix: email builder now renders a no-list body variant and the guard sends regardless.
2. **PLAUSIBLE.** `RotationsClient`'s 0/0 toast branch didn't call `loadRotations()` or `fullRefresh()`. Two concurrent coordinators could see stale rows. Fix: refresh in both branches.
3. **PLAUSIBLE.** `HubScheduleClient`'s `jumpToMonth` target month was extracted via `new Date(d.toLocaleString("en-US", { timeZone: TZ }))` — locale-string parsing is not in the ECMA spec and Safari has historically failed on common shapes. Fix: switched to `Intl.DateTimeFormat(...).formatToParts()`, which is engine-agnostic.

A fourth (PLAUSIBLE behavior-change) was flagged and left intentional: `release-host`'s narrowed query no longer frees HostAssignments where the user was reassigned via sub-claim (their `standingAssignmentId` points at someone else's rule). Sub-claims are individual commitments, not rotation membership — the user can post their own sub-request for those single dates. Documented in the route's docstring.

### Open follow-ons

- **DB diagnostic on Maria's account.** Three SQL queries Jesse will run when he has DB access (in UP_NEXT). If Maria's StandingAssignment state turns out to have been on Wednesday all along (data, not code), the day-shift perception is explained. If the data was Tuesday, the hardened toasts on her next test will pinpoint what action she's clicking.
- **Manual chapter.** `host-hub-team-management` or a new `host-rotations` chapter needs to explain: rotation sessions appear in their actual calendar month; use Your Rotations → Next to jump; the difference between Remove from rotation, End this rotation, and per-session Ask the team to cover.

### Architectural calls worth carrying forward

- **Audit at the user-flow layer, not just the code-correctness layer.** The session-129 audit verified hub-scoping correctness across all four routing layers but didn't stress-test end-to-end user flow. Maria's report is the kind of gap that audit pass missed. Worth adding to the closing ritual: when touching a tool, walk the user's flow as the actual user, not just the code paths.
- **The "released vs ended" distinction is permanent.** Two distinct builders forever — Released (rule removed for one person, others stay) vs Ended (rule deleted entirely). Don't merge them again.
- **Per-date vs whole-rotation are two exits, not one.** Per-session sub-request for "I can't make this date"; remove-from-rotation for "I'm leaving the rotation." UI surfaces them in distinct places and copy spells out the distinction.

### Same-day follow-ups — orphan-hub heal + the FK-Restrict pattern bug

Three additional commits landed after the original session-130 ship as real-world testing surfaced deeper issues that the first pass missed.

**Commit `11864f2` — self-diagnosing Reset rotations.** Jesse reported the per-program Reset on multi-day programs (Good Morning / Good Evening Silent Meditation) wasn't working — "no toast, rotations still there." Without screenshots or DB state I couldn't pin the failure mode from code alone (the route is a straightforward `deleteMany` on `programSlug + hubSlug` with no day filter). Shipped a diagnostic patch: client-side `console.log` under `[reset]` for every step; server-side `[reset-rotations]` log with counts; **inline result line next to the Reset button** so the outcome is at the click point (the page-level toast renders at the top of the rotations area — if the coordinator is scrolled to the bottom of a program card the toast is off-screen and the action looks like it did nothing).

**Commit `93f985e` — heal migration + atomic transfer.** Jesse confirmed the diagnostic patch's inline error caught what we needed. Root cause: orphan `StandingAssignment` rules on hubs that no longer matched the program's `hostingHubSlug`. Sequence: program set up on hub A, rotation created (hubSlug=A), program later transferred to hub B, but the rotation rule + applied future HostAssignments stayed on hub A. Invisible in every UI view (hub A's grid filters its program list by hostingHubSlug=A, so the program is no longer there; hub B's grid filters by hubSlug=B, so the orphans don't render). The apply cron walks every rule regardless of hub and keeps re-creating HostAssignments under the old hubSlug each morning. Click Reset on hub B and the route correctly clears hub B's rules — but the orphans persist and the cron repopulates. Symptom: "reset doesn't work."

Two changes shipped together:

1. **One-shot heal migration `heal_orphan_standing_assignments_v1`** in `prisma/migrate.mjs`. Walks every `StandingAssignment` whose `hubSlug` isn't in the program's valid hub set (primary `hostingHubSlug` OR any `ProgramCoverageHub` row). Deletes orphan rules + their future HostAssignment rows. Then walks future HostAssignments not tied to any rule (direct claims, SetNull cascade orphans) and applies the same heal. Past HostAssignments stay as historical record. Logs per-program before deleting so the deploy log is auditable. Idempotent via `_migration_flags`.

2. **Atomic transfer in `/api/programs-pg/[slug]` PUT handler.** When a coordinator changes a program's `hostingHubSlug`, the route now purges the old hub's `StandingAssignment` rules + future `HostAssignment` rows in the SAME `$transaction` as the `program.update`. Atomic — if cleanup throws, the transfer rolls back together. Without this, future transfers would silently recreate the orphan state the migration just healed.

**Reviewer sub-agent caught three showstoppers pre-commit on `93f985e`**, all addressed before the commit:

1. **Auxiliary-hub rotations would have been wiped.** Initial detection only consulted the program's primary `hostingHubSlug`. Every legitimate session-129 AV/greeter rotation would have been classified as orphan and deleted. Fix: valid-hubs set per program now includes the primary hub AND every `ProgramCoverageHub` row.
2. **`SubRequest.assignmentId` FK is Restrict (no cascade).** The earlier version cancelled OPEN SubRequests via `updateMany` then deleted the parent HostAssignment — FK-violates the moment any non-OPEN SubRequest (CLAIMED, CANCELLED) references the row. Fix: delete SubClaim → SubRequest → HostAssignment in that order (matches `/api/host/assignments/clear` canonical pattern).
3. **`program.update` ran outside the cleanup transaction.** If cleanup threw, the program would be on the new hub but rules/assignments stayed on the old hub — recreating the orphan state. Fix: cleanup + update wrapped in a single `$transaction` so they commit or roll back together.

**Commit `3117833` — the FK-Restrict pattern, codebase-wide audit.** After `93f985e` landed and the heal cleaned the orphans, Jesse clicked Reset on The Art of Meditation and saw `HTTP 500` (the diagnostic patch's inline result line surfaced it perfectly). Same FK-Restrict bug from reviewer finding #2 — but in the pre-existing `clear-rotations` route, which I hadn't touched in session 130 and therefore hadn't audited. Triggered by a historic CANCELLED sub-request lingering on one of the Art of Meditation HostAssignments.

The lesson: **when a reviewer finding identifies a *pattern* (not a local bug), the fix needs a codebase-wide audit of that pattern, not just a local patch.** Grepped `subRequest.updateMany` across the API and found four routes with the same shape: `clear-rotations`, `release-host`, `assignments/[id]` DELETE, `assignments/reassign`. All four replaced with the canonical SubClaim → SubRequest → HostAssignment deleteMany pattern in `$transaction`. (PATCH unclaim on `assignments/[id]` keeps the cancel-OPEN behavior because it only sets `userId = null` — no parent delete, no FK violation possible.)

### What this work connects to

This is direct follow-on from the session-130 four-bug fix and session-129's auxiliary-hub coverage architecture. The orphan-heal closes the gap that made the per-program Reset appear broken on multi-day programs that had been migrated between hubs. The atomic transfer change in the PUT handler prevents new orphans on future program transfers. The FK-Restrict audit closes a class of bug that was latent in the codebase well before session 130 — Jesse just didn't have programs with historic non-OPEN sub-requests to trigger it before.

### Architectural calls + lessons

- **Reviewer findings that identify a pattern need a codebase-wide audit.** The FK-Restrict bug was caught by the reviewer in the heal migration and the PUT handler. I fixed those two but didn't ask "where else does this pattern live?" Three production routes had the same bug latent until Jesse hit one of them. New memory file `feedback-pattern-audit.md` captures the rule: when the reviewer flags a *class* of error, grep the codebase for the pattern before considering the finding closed.
- **Destructive routes must use `SubClaim → SubRequest → HostAssignment` delete chain, atomic.** The cancel-OPEN-then-delete pattern is unsafe given FK Restrict. New section in `RIM_Scheduler.md` codifies the pattern with a checklist for future destructive routes.
- **Atomic data-state changes that span multiple writes (cleanup + update) must be wrapped in a single `$transaction`.** Sequential awaits across writes can leave inconsistent state on partial failure — exactly the failure mode that would have recreated the bug we just healed.
- **Diagnostic patches at the click point are worth shipping early.** Surfacing the actual HTTP error inline (instead of a page-level toast that may be off-screen) made the failure self-diagnosing on Jesse's next click. The page-level toast wasn't lying — it was just invisible from where he was looking. Worth keeping in mind when designing future destructive-action affordances.

### Same-day follow-ups (continued) — per-day Reset rename + cross-hub program-staffing view

After `3117833` landed and the FK-Restrict pattern fix shipped, Jesse named two design issues that emerged once the system actually worked: **(a)** for multi-day programs (Good Morning / Good Evening Silent Meditation), you can't reset a single day's rotation without using the buried "End" → manage panel path — there's no obvious per-day affordance, just a per-program nuke; **(b)** hubs are functional roles per program (Host / AV / Greeter), and there's no place to see all of those roles for one program in one view — you have to switch hub tabs.

**Commit `fc041ea`.** Three things landed together:

1. **Per-day Reset rename.** The row-level "End" button on each day in the Rotations grid becomes "Reset [Day]" — programmatically named via `DAY_LABEL[d]`. Manage panel header, the per-host removal sub-panel copy, the date-picker label, the destructive button, and the success toast all gain day-of-week context. Underlying route behavior unchanged (it was already correct — `end-bundle` keys to `(programSlug, dayOfWeek, hubSlug)`); only the UI was misleading. Toast example: "Reset Tuesday's rotation · 4 upcoming Tuesdays released. Other days untouched."

2. **Cross-hub program-staffing view.** New page at `/tools/schedule/program/[slug]`. Read-only. One section per hub covering the program (primary `hostingHubSlug` + every `ProgramCoverageHub` row). Single-slot hubs render a per-day table with host(s) and rotation pattern (e.g., "Maria · 1st & 3rd," "Nancy · 2nd & 4th"). Multi-claim hubs (greeter) render the next four upcoming sessions with signup counts. Each hub section's header has an "Edit in [hub] →" link that deep-links to `/tools/schedule?hub=<slug>` for actual editing. New `ps-` CSS prefix. Page is access-gated by the parent layout (same as the rest of `/tools/schedule`). Linked from each program card in the Rotations grid via a "View all roles →" affordance.

3. **Two more FK-Restrict gaps closed.** The audit in `3117833` caught four routes but missed two more sites doing `hostAssignment.deleteMany` without prior SubClaim/SubRequest cleanup: `standing-assignments/[id]` DELETE rotation path, and both branches of `end-bundle` (set-end-date AND release-future). Applied the canonical SubClaim → SubRequest → HostAssignment chain in `$transaction` to all three. **The FK-Restrict pattern audit for the Scheduler API is now complete.**

Reviewer sub-agent on `fc041ea` caught one medium and four lows. Fixed the medium (`findUpcomingDates` was walking past `Program.endDatetime` for ended programs — the shared `isOccurrenceOnDate` helper doesn't honor `endDatetime`, only `recurrenceCount`. Fix is local for now; pushing the check into the shared helper is a worthwhile follow-up since `/tools/schedule` and `/this-week` have the same blind spot) plus two of the lows (unused import; redundant second `db.user.findMany`). The remaining lows are belt-and-suspenders and a pre-existing pattern; documented and left.

### What this work connects to (full session-130 arc)

This is the final ship in the session-130 arc, which started with Maria's beta-test report and grew into a six-commit slice covering Maria's four bugs + the orphan-hub heal + the codebase-wide FK-Restrict audit + the per-day Reset clarity + the cross-hub staffing view. Every layer of the Scheduler — capability gates, notification recipients, UI filters, outbound URLs, destructive-route deletion patterns, multi-day per-rotation UX, and now cross-hub program-coordination view — was touched. The Scheduler is operationally sound across all four hubs (host-team, peer-led-silent-meditation, audio-visual, greeter) and ready for Maria to drive without ghost rotations or FK-Restrict surprises.

### Architectural calls + lessons (continued)

- **Hubs as functional roles per program.** The cross-hub staffing view is the first surface that respects this conceptually. It's read-only first ship — a coordinator can plan a week by looking at one program across every hub. Editing still happens per-hub via deep-link. Future iterations could allow editing-from-here, but that requires careful UX work to avoid confusion about which hub the action is scoped to.
- **Day-named labels matter for multi-day programs.** Renaming "End" → "Reset Monday" / "Reset Tuesday" etc converted a buried, ambiguous action into a clearly day-scoped one. Generic destructive-action labels work when there's only one thing they could mean; once the action is per-day in a multi-day grid, the day belongs in the label.
- **FK-Restrict pattern audit is now complete** for the Scheduler API. Six routes share the canonical SubClaim → SubRequest → HostAssignment delete-in-transaction pattern. Documented at length in `RIM_Scheduler.md`.

### Final closing arc (post-manual-update follow-ons)

Three more commits landed after the manual rewrite, each surfacing real bugs that real-world testing exposed.

**Multi-claim Rotations tab over-correction + revert (`10a161a` → `418e11f`).** Jesse sent a screenshot from the Greeter hub's Rotations tab where "Set up" wasn't letting him add people. I misread the situation — assumed greeter (multi-claim) shouldn't have a Rotations tab at all, and hid the tab entirely. That was the wrong move. Jesse corrected: he was trying to put greeters on a recurring schedule the same way you'd put hosts on a rotation, and the right framing is "the tab exists, the action failed." Reverted the hide-the-tab change in `418e11f`. This is the second time in the session-130 arc that I jumped to a wrong fix based on screenshot context instead of focusing on the user's described failure. New data point for `feedback-pattern-audit.md` — *user's description of the failure is the primary signal; supporting visual context is supporting evidence, not the framing.*

**Missing `hubSlug` in client save handlers (`b0614e9`).** The actual bug behind Jesse's "I can't save a Greeter rotation" report. The save POST in `RotationsClient.handleSave` was missing the `hubSlug` field in the body. Server-side fallback in the standing-assignments POST handler:

```ts
const programHubSlug = await getProgramHubSlug(body.programSlug);
const targetHubSlug = body.hubSlug || programHubSlug;
```

When `body.hubSlug` is undefined, `targetHubSlug` falls back to the program's **primary** hub. So saving a Greeter rotation on The Art of Meditation was silently writing the `StandingAssignment` with `hubSlug = "host-team"` (the program's primary). The Greeter view filters by `hubSlug = "greeter"` — so the new rotation never appeared on the page that submitted it. From the coordinator's perspective the action just didn't work.

Same gap in `handleEnd` and `handleSetEndDate` — both POSTed to end-bundle without `hubSlug`. Same silent wrong-hub effect. All three handlers fixed in this commit. `handleReleaseHost`, `handleProgReset`, and `handleClear` already passed `hubSlug` correctly from earlier session-130 commits; my client-side audit then was incomplete.

Also: the apply call inside the standing-assignments POST route was passing no `hubSlugFilter` to `applyStandingAssignments`, so saving one hub's rotation would re-fire apply for every other hub's rules on the same `(programSlug, dayOfWeek)`. "leave" mode is no-op when slots are filled, but the broader walk could still send spurious emails to users in unrelated hubs. Now scopes to `targetHubSlug`.

This pattern — client forgets to send a hub-scoping field, server fallback masks it — is worth specifically documenting. Adds to `RIM_Hub_Engineering.md`: *every hub-scoped client mutation must explicitly pass `hubSlug` in its body. The server's "fall back to program's primary hub" path is for backward-compat with legacy callers, not a default for new code. Treat the missing field as a client bug, not a server convenience.*

**Role-aware copy across all hubs (`adc51e2`).** Jesse pointed out (with an Audio Visual hub screenshot showing "You're hosting" on an AV assignment) that the entire UI and email copy was still host-team-centric. Hubs are functional roles per program — host, AV, greeter, facilitator — and the copy should match.

Three new fields on `Hub`:
- `coverageNoun` — "Host" / "AV" / "Greeter" / "Facilitator"
- `coverageVerb` — "hosting" / "covering AV" / "greeting" / "facilitating"
- `coverageAction` — "host this" / "cover AV" / "greet" / "facilitate"

All default to host-team values. Migration `add_hub_coverage_copy_v1` backfills the three non-host-team hubs by slug. New helper `getHubCoverageCopy(hubSlug)` returns the three strings or defaults.

UI replacements in `HubScheduleClient.tsx`:
- "Needs a host" → "{Noun} needed" ("AV needed")
- "Yes, I can host" → "Yes, I can {action}" ("Yes, I can cover AV")
- "You're hosting" → "You're {verb}" ("You're covering AV")
- "Hosted by [Name]" → "{Noun}: [Name]" ("AV: Bob")
- Toast: "You're hosting. The team has been notified." → "You're {verb}. The team has been notified."

Email replacements in `lib/email.ts`:
- `sendStandingAssignmentScheduledEmail` body: "scheduled to be {verb}" 
- `sendStandingAssignmentReplacedEmail` subject: "You're no longer {verb} {program}"
- `sendStandingAssignmentEndedEmail` subject: "Your {verb} rotation has ended"
- `sendStandingAssignmentReleasedEmail` body: "removed from the standing rotation as {Noun}"

Six email callsites (`standing-assignments` POST, `apply`, `release-host`, `end-bundle`, `[id]` DELETE, `cron`) now resolve coverage copy from the hub. Apply route + cron cache per-hub in a Map to avoid re-querying within a single email batch.

### What this work connects to

The orphan-heal + FK-Restrict + per-day Reset + cross-hub staffing view + role-aware copy together cover every "host"-centric assumption in the Scheduler that wasn't sound across the four hubs. The architecture established in session 128–129 (program ↔ hub many-to-many, single-slot vs multi-claim, hub-scoped routes) is now fully matched at the user-facing layer.

Hub configuration is the source of truth for behavior across the system:
- `hasSchedule` → renders the Host-style hub home
- `allowsMultipleAssignments` → single-slot vs open-signup Schedule UX
- `appliesToFormats` → which programs surface
- `assignmentGrantsTeacher` + `teacherLabel` → session-room pill semantics
- `coverageNoun` + `coverageVerb` + `coverageAction` → user-facing copy
- `ProgramCoverageHub` join table → primary + auxiliary program coverage

Future hubs are configuration on top of this architecture, not new code. Anyone creating a new hub in `/admin/hubs` (with the upcoming form fields, or for now via a one-off migration) gets the right behavior across the entire Scheduler.

### Final architectural calls

- **Hub config fields are the right granularity for behavior variance.** Five booleans/strings on the Hub model now drive what each hub looks and sounds like. No code branches per hub slug anywhere in the Scheduler.
- **The "user's description of the failure" beats "screenshot context" as the framing signal.** Twice in this session arc I picked the wrong fix because I led with what the screenshot was showing instead of what the user said had failed. Recorded in `feedback-pattern-audit.md`.
- **Missing-hub-scoping-field on client mutations is its own bug class.** The server's fallback to program's primary hub was designed for backward-compat. New client code should never rely on that fallback — explicit `hubSlug` is the contract. Worth a closing checklist item.

---

---

## 2026-05-25 (session 129 continued) — Post-ship fixes + thorough scheduler audit

After session 129's first ship, real-world testing surfaced a series of issues. Each got fixed in turn, then Jesse asked for a "thorough audit to make sure the integrity is sound." The audit ran clean (every routing layer hub-correct) except for two real bugs in the destructive-reset routes which were then fixed.

### The fix sequence

**1. "Host Schedule" → "Scheduler" rename** (commit `10cf18d`). The tool layout's `toolName: "Host Schedule"` was a leftover from when host-team was the only hub. Renamed to "Scheduler" — generic across all four hubs since the hub name itself sits in the sidebar already. JSDoc + metadata title updated in tandem.

**2. The hasSchedule conflation bug** (commit `0c03e03`). My session-129 migration set `hasSchedule: true` on audio-visual + greeter so they'd appear in the ProgramEditor's Auxiliary coverage fieldset. But `hasSchedule` had a second meaning I didn't account for — `app/account/hub/[slug]/page.tsx:61` uses it to route the hub's Home view to `HostHubHomeClient` (host-team-specific UI with hardcoded `/admin/manual/host-hub` links). Opening the Audio Visual hub home showed Jesse the host-team home view. Fix: separated the two concerns. `hasSchedule` stays narrow ("show the Host Hub home view") for host-team + peer-led; the new authoritative signal for "this hub uses the Scheduler" is HubAppLink existence (`toolSlug = "schedule"`). ProgramEditor + Members tab + destructive-action warning all updated to use the new signal. Migration `auxiliary_hub_has_schedule_fix_v1` walked hasSchedule back to false on AV + greeter.

**3. Helpful empty state** (commit `4a8ac15`). The empty Greeter Scheduler read as broken when it was actually correct ("no programs tagged yet"). Both Schedule and Rotations tabs now show a calm sentence pointing at the Program editor when no programs are scoped to the hub.

**4. Hosting & Access tab UX cleanup** (commit `d3efc57`). Real bug Jesse spotted in the editor: peer-led-silent-meditation appeared in BOTH the Hosting team dropdown AND the Auxiliary coverage checkboxes. Similarly AV / greeter appeared in the Hosting dropdown despite being incoherent choices for primary hosting. Fix: tightened both filters. Hosting team dropdown shows only `hasSchedule = true` hubs. Auxiliary fieldset shows only `hasSchedule = false && usesScheduler = true` AND filters by program format overlap so a virtual-only program doesn't surface AV/Greeter checkboxes. Added an intro paragraph at the top of the tab spelling out the difference between the two sections.

**5. peer-led-silent-meditation invisible in dropdown** (commit `c9598bb`). After commit 4, Jesse reported peer-led didn't appear in the Hosting team dropdown. Investigation: `hasSchedule` was never exposed in the admin form at `/admin/hubs`, so peer-led had been created with the schema default (false). It was *also* never getting the host-team-style Home view despite being a hosting hub — Jesse just didn't notice. Two-part fix: migration `peer_led_has_schedule_fix_v1` set hasSchedule=true on the existing peer-led row; the admin form now exposes "This hub runs live sessions" as a checkbox above the existing teacher-capability toggle. POST/PATCH routes accept hasSchedule; edit page wires it through initialData.

### The audit

Jesse asked for a thorough integrity audit. I worked through five phases, each tracked as a task:

| Phase | Result |
|---|---|
| Hub config matrix (4 hubs × 4 flags) | ✓ All correct |
| Layer 1: capability gates on every Scheduler API route | 🔧 1 bug found |
| Layer 2: notification recipient pools | ✓ Clean |
| Layer 3: UI filters across page + components | ✓ Clean (2 cosmetic items) |
| Layer 4: outbound URLs in emails | ✓ Clean |
| Edge cases (multi-claim, grandfather, cross-hub rotations, reassign, step-in) | ✓ All sound |

### The audit fixes (commit `cc265a8`)

**Bug A — `/api/host/programs/[slug]/clear-rotations`** was hardcoded to host-team in three places: coordinator gate, hosting-access fallback, and the `deleteMany` calls. If a hybrid program was tagged for AV/greeter auxiliary coverage, hitting the per-program Reset button would have wiped ALL hubs' rotations + future assignments on that program. Fix: accept `hubSlug` in body, gate by `isHubCoordinator + ADMIN`, scope every delete by `hubSlug`. Matches the pattern of every other standing-assignment route. RotationsClient updated to pass the active hub.

**Bug B (per Jesse's call) — "Reset everything"** was a global ADMIN-only nuclear reset that wiped HostAssignment / SubRequest / SubClaim / StandingAssignment across every hub. After the auxiliary-hub model that was a sharp edge — clicking Reset from greeter's UI would wipe host-team's data. Fix: hub-scope the reset (`hubSlug` required body field), widen the gate to hub coordinator OR ADMIN. Each hub's coordinator can now reset their own hub independently. Button copy in RotationsClient updated to "Reset this team" with help text spelling out the hub scope.

**Bonus cleanup**: removed dead `getHubNotificationRecipients` import in `assignments/route.ts`; migrated two `"host-team"` string literals in `HubScheduleClient.tsx` to use `DEFAULT_HOSTING_HUB_SLUG`.

### Architectural calls + lessons

**`hasSchedule` and `usesScheduler` are two different concerns.** Both signals are now distinct in the code:
- `Hub.hasSchedule` (boolean column) = "this hub runs live sessions" — drives Home view + Hosting team dropdown eligibility. True for host-team and peer-led. Now exposed in the admin form.
- `usesScheduler` (derived from `HubAppLink` with `toolSlug = "schedule"`) = "this hub uses the Scheduler tool" — drives ProgramEditor's Auxiliary coverage eligibility, Members tab hosting affordances, and the destructive-action warning. True for all four scheduler-using hubs.

Conflating them was the root cause of two visible bugs.

**Clear-seeing UI is correctness, not polish.** This was the cumulative lesson from the cluster of UX-confusion bugs Jesse hit. The multi-claim row's first version was a comma-list; the Auxiliary coverage and Hosting team distinction wasn't visually plain; the empty Scheduler state read as broken. Saved as memory file `feedback-clear-seeing-is-correctness.md` earlier in the session.

**Destructive routes need the same hub-scoping discipline as read routes.** The two bugs in the audit were both in destructive routes (clear-rotations, clear-everything). The four-layer routing model from `RIM_Hub_Engineering.md` applies to deletes as much as reads — arguably more, since the blast radius is bigger.

### What to verify on the deployed site

1. **Peer-led shows in dropdown.** Open any program → Hosting & Access → "Peer-Led Silent Meditation" should appear in the Hosting team dropdown alongside "Host Team (default)."
2. **Auxiliary coverage filtered correctly.** On an in-person or hybrid program, Auxiliary fieldset shows only AV + Greeter. On a virtual program, the section reads "Not applicable — virtual-only program." Peer-Led Silent Meditation no longer appears in Auxiliary.
3. **Reset this team works per-hub.** Open `/tools/schedule?hub=greeter` → Rotations tab → Reset button reads "Reset this team." Clicking through wipes greeter's data only; host-team's Scheduler is untouched.
4. **Per-program Reset works for auxiliary hubs.** Open a program tagged for AV in `/tools/schedule?hub=audio-visual` → Rotations tab → per-program Reset clears only AV's future assignments + standing rotations for that program. Host-team's data on that program is untouched.
5. **Empty hub Scheduler reads correctly.** A hub with no tagged programs shows the helpful "No programs are scheduled with this team yet" copy with a pointer to the Program editor.
6. **Admin form exposes hasSchedule.** `/admin/hubs/new` and `/admin/hubs/[slug]/edit` both show the "This hub runs live sessions" checkbox.

### Files touched in this follow-up arc

API: `app/api/host/assignments/clear/route.ts`, `app/api/host/programs/[slug]/clear-rotations/route.ts`, `app/api/host/assignments/route.ts` (dead import), `app/api/hub/[slug]/members/[userId]/route.ts`, `app/api/admin/hubs/route.ts`, `app/api/admin/hubs/[slug]/route.ts`.

Pages: `app/tools/schedule/layout.tsx`, `app/tools/schedule/page.tsx`, `app/tools/programs/[programSlug]/edit/page.tsx`, `app/tools/programs/new/page.tsx`, `app/account/hub/[slug]/members/page.tsx`, `app/admin/hubs/[slug]/edit/page.tsx`.

Components: `components/HubScheduleClient.tsx`, `components/RotationsClient.tsx`, `components/registrar/ProgramEditor.tsx`, `components/HubAdminForm.tsx`.

Migrations: `prisma/migrate.mjs` (`auxiliary_hub_has_schedule_fix_v1`, `peer_led_has_schedule_fix_v1`, plus revised `auxiliary_hub_coverage_v1` to omit the hasSchedule conflation).

### Connections (what this work touches)

- **Hub admin form is now configuration-complete** — every Hub config field that affects scheduler behavior is exposed (hasSchedule, assignmentGrantsTeacher, teacherLabel; appliesToFormats + allowsMultipleAssignments still managed by migration since AV/Greeter are the only auxiliary hubs today).
- **Destructive routes are now hub-isolated** — both clear-rotations and Reset everything respect hub boundaries; no cross-hub wipe is possible from a hub-scoped UI.
- **The four-layer audit checklist from `RIM_Hub_Engineering.md` is proven**. Running it surfaced two real bugs that would have leaked across hubs in production. The pattern stays in the closing ritual.

---

## 2026-05-25 (session 129) — Auxiliary-hub coverage: AV + Greeter hubs (one-program-many-hubs generalization)

Jesse asked for two more hubs — `audio-visual` (one AV volunteer per in-person session) and `greeter` (open multi-claim sign-up for in-person greeting) — both using the existing Scheduler tool. The right answer wasn't "copy the Silent Meditation Hub pattern" because that pattern committed to one program ↔ one hub via `Program.hostingHubSlug`. Real in-person offerings need multiple parallel role pools — a Saturday Sit needs the dharma teacher + AV + greeters as three independent role coverage scopes against the same Program record. So session 129 generalized the architecture: one program ↔ many hubs, each covering a different role.

### What shipped

**Schema** — `Program.hostingHubSlug` stays as the *primary* hub (who runs the live session, owns the LiveKit room). Two new fields on Hub: `allowsMultipleAssignments` (false = single-slot like host-team/AV, true = open multi-claim like greeter) and `appliesToFormats` (which `programFormat` values this hub schedules — virtual/hybrid for host-team and peer-led, in-person/hybrid for AV and greeter). New join table `ProgramCoverageHub` records auxiliary-hub coverage per program. `HostAssignment.hubSlug` and `StandingAssignment.hubSlug` columns carry the assignment's owning hub directly. The old `HostAssignment.@@unique([programSlug, sessionDate])` was dropped in favor of app-layer enforcement (single-slot hubs enforce uniqueness per `(programSlug, sessionDate, hubSlug)`; multi-claim hubs allow many rows). `StandingAssignment.@@unique` widened to include `hubSlug` so a program can have parallel rotations in different hubs.

**Migration** — `auxiliary_hub_coverage_v1`. Idempotent. Backfills `host_assignments.hubSlug` and `standing_assignments.hubSlug` from `programs.hostingHubSlug` (preserving every existing row's effective hub). Auto-configures `audio-visual` (single-slot + in-person/hybrid + hasSchedule) and `greeter` (multi-claim + in-person/hybrid + hasSchedule) the moment those hub rows exist.

**Helpers** in `lib/programHub.ts`: `getProgramCoverageHubs`, `getProgramSlugsForHub` (returns the union of primary + auxiliary programs), `getHubCoverageConfig` (returns the format filter + multi-claim flag).

**Scheduler page + API GET** — both now union primary + auxiliary programs for the active hub via `getProgramSlugsForHub`, apply the hub's `appliesToFormats`, and scope HostAssignment queries by `hubSlug`. Multi-claim sessions render as a community of people — plain-language state header sentence ("3 signed up · you're one of them"), stacked names with a "YOU" self-recognition mark on the signed-in user's row, action labels that read as invitation ("I'll be the first" / "I'll be there too" / "Cancel my signup"). Single-slot hubs keep the historical one-host-with-actions shape.

**ProgramEditor** — new "Auxiliary role coverage" fieldset in the Hosting & Access tab. Lists every active hub with `hasSchedule=true` minus the primary. Checked boxes write `ProgramCoverageHub` rows on save. POST/PUT in `/api/programs-pg` validate hub slugs and full-replace the coverage set.

**Assignments POST** branches on `Hub.allowsMultipleAssignments`. Single-slot: existing claim-the-seed pattern, scoped per hub. Multi-claim: each sign-up is a fresh insert, deduped per `(programSlug, sessionDate, hubSlug, userId)`. Sub-request POST refuses on multi-claim hubs ("cancel your signup instead").

**Standing rotations** — every route accepts a `hubSlug` body field (default = program's primary hub), gates by `isHubCoordinator(userId, hubSlug)`. Bundle scope `(programSlug, dayOfWeek, hubSlug)` so an AV rotation and a host-team rotation can coexist on the same program/day. `applyStandingAssignments.ts::Candidate` carries `hubSlug`; conflict detection scoped per `(programSlug, dateStr, hubSlug)` so an AV rotation candidate doesn't collide with a host-team assignment. Apply-time emails group per-user-and-hub so a user with cross-hub rotations gets one email per hub, each linking to the right Scheduler view.

**Reassign + Step-In** — both refactored from `upsert` (which required the dropped composite unique key) to `findFirst + update/create`. Reassign preserves the existing assignment's hub on the rewrite; emails route via the new row's `hubSlug`.

### Architectural calls made this session

**The one-program-many-hubs generalization is the architecturally honest shape.** Three hub slices in two weeks (Slices 1, 2.6, 129) ratcheting toward the same truth: hubs are role pools, not program owners. After 129 every layer of the stack — schema, helpers, API gates, UI, emails, standing rotations — speaks the same many-to-many vocabulary.

**Multi-claim UI is correctness, not polish.** I shipped a comma-separated list of names first and framed it as "minimum viable; refine after testing." Jesse pushed back: that framing is wrong for RIM. The design philosophy doc makes clear-seeing-at-a-glance, plain-language state sentences, and self-recognition part of correctness, not refinement. Multi-claim row was rebuilt with a state header sentence, a stacked list, a "YOU" mark on the signed-in user's row, and invitation-phrased actions. Saved as memory file `feedback-clear-seeing-is-correctness.md` so the lesson doesn't have to be re-learned.

**Sub-requests don't apply to open sign-up.** Multi-claim hubs have no "need a sub" semantic — the only exit is self-cancel. POST `/api/host/sub-requests` returns 400 on multi-claim hubs. The UI hides the affordance entirely (no "Ask the team to cover" button on greeter rows).

**Format filter declared on the hub, not hardcoded.** `Hub.appliesToFormats` lets each hub declare which `programFormat` values it schedules. Avoids brittle slug-string dispatch in the page and makes future hubs (a cleanup-crew hub for in-person, a livestream-tech hub for virtual) configuration rather than code.

### What testing on the deployed site should confirm

1. **Run migration on next push.** Vercel deploy runs `auxiliary_hub_coverage_v1`. Check the build log for the per-step output (column adds, backfills, unique-constraint swap, table create, hub auto-config). The two hubs you've already created (`audio-visual`, `greeter`) should be auto-configured by the migration's `updateMany` step.

2. **Assign the Scheduler tool to both new hubs.** `/admin/hubs/audio-visual/edit` and `/admin/hubs/greeter/edit` → add an `HubAppLink` to `/tools/schedule?hub=audio-visual` and `/tools/schedule?hub=greeter` respectively.

3. **Tag programs with auxiliary coverage.** Open an in-person or hybrid program in `/tools/programs/[slug]/edit` → Hosting & Access tab → check the "Audio Visual" and "Greeter" boxes under Auxiliary role coverage → save. The `ProgramCoverageHub` rows are written.

4. **Add members to each hub.** AV team members and greeter signups via `/account/hub/audio-visual/members` / `/account/hub/greeter/members`.

5. **AV flow (single-slot).** Sign in as an AV member, open `/tools/schedule?hub=audio-visual`. The Schedule tab shows the in-person/hybrid programs that have AV coverage enabled. Click "Yes, I can host" on a session → confirm a HostAssignment row is created with `hubSlug = "audio-visual"`. Email confirmation arrives with link `/tools/schedule?hub=audio-visual`.

6. **Greeter flow (multi-claim).** Sign in as a greeter, open `/tools/schedule?hub=greeter`. Each session card reads "No one yet — be the first?" if empty, or shows a stacked list of names with your own row marked "YOU" if you've signed up. Click "I'll be the first" → page reloads, the same row now reads "You're signed up" with your name and a "Cancel my signup" button. A second greeter signs up → row reads "2 signed up · you're one of them" for the first greeter; "2 signed up" for someone viewing as a non-claimant.

7. **Same program, different hubs.** Pick a hybrid program tagged for both host-team (primary) AND audio-visual + greeter (auxiliary). Verify three separate Scheduler views, each showing only that hub's assignments for the same session date. Three independent role pools, no cross-leak.

8. **Standing rotations per hub.** As an AV coordinator (you, or whoever you appoint), open `/tools/schedule?hub=audio-visual` → Rotations tab → set up a rotation for an AV program. Save + apply. The standing-assignment rows + applied HostAssignments all carry `hubSlug = "audio-visual"`. Verify a same-program same-day host-team rotation can coexist independently.

### Connections (what this work touches)

- **Schema:** `Hub.allowsMultipleAssignments`, `Hub.appliesToFormats`, `HostAssignment.hubSlug`, `StandingAssignment.hubSlug`, new `ProgramCoverageHub` join. Old `HostAssignment.@@unique([programSlug, sessionDate])` dropped.
- **Helpers:** `lib/programHub.ts` gains 3 new exports.
- **Migration:** `prisma/migrate.mjs` `auxiliary_hub_coverage_v1` — idempotent, value-preserving.
- **API routes touched:** `/api/host/assignments`, `/api/host/assignments/[id]`, `/api/host/assignments/reassign`, `/api/host/sub-requests`, `/api/host/sub-requests/[id]/claim`, all 6 `/api/host/standing-assignments/*`, `/api/programs-pg`, `/api/programs-pg/[slug]`, `/api/livekit/step-in`.
- **Pages + components:** `app/tools/schedule/page.tsx`, `app/tools/programs/[programSlug]/edit/page.tsx`, `app/tools/programs/new/page.tsx`, `components/HubScheduleClient.tsx`, `components/registrar/ProgramEditor.tsx`, `lib/applyStandingAssignments.ts`.
- **CSS:** `public/css/custom.css` `.hs-row__multi*` block for multi-claim rendering.
- **Docs:** `RIM_Hub_Engineering.md` (new "Auxiliary-hub coverage" section), `RIM_Scheduler.md` (multi-claim rendering, hub modes, format filter), this session-log, FEATURES.md, RIM_Stack_Reference.md, RIM_System_Architecture.md, UP_NEXT.md.
- **Memory:** `feedback-clear-seeing-is-correctness.md` new.

### What's deferred / known follow-ons

- **Manual chapters for AV and Greeter hubs.** Not seeded this session. Can be done via `/admin/manual/<slug>/edit` after the hubs go live, or as a follow-on migration seed.
- **Multi-claim sub-request semantics.** Intentionally absent — release-my-claim is the only exit on greeter sessions. If a coordinator ever needs to remove an inactive greeter from a session, it's a manager-only DELETE on the assignment id (existing route, already gated to owner/manager).
- **Assignments-GET pause-map.** Still scoped per-hub via `requestedHubSlug` lookup; verify the AV/greeter view renders paused-member badges correctly on first live test.
- **Cross-hub member coordinator UX.** No special UI yet for the case where the same person is in host-team AND audio-visual; they'll see the active hub from the URL and switch via the sidebar. Reasonable default; revisit if it becomes friction.

---

## 2026-05-22 (session 128 continued) — Slice 2 + 2.5 + 2.6 — Silent Meditation Hub operational + hub-isolation hardening + standing-rotation generalization + engineering reference docs

Long arc, several commits, three architectural layers landed.  Started with the operational Slice 2 walk-through (create the hub, transfer programs, add coordinator), then surfaced a hub-isolation gap in the email-URL layer that Slice 1 had missed (Slice 2.5), then surfaced a "shows up but doesn't work" gap in the standing-rotation API that Slice 1 had deferred (Slice 2.6), then built three engineering reference docs to prevent the same class of gap from recurring.  By the end the architecture for peer-led hubs is fully isolated end-to-end and the institutional memory is in place to keep it that way.

### The commit chain

1. **`463f3bb` (Slice 1)** — already documented in the session-128 entry below.

2. **Slice 2 — operational rollout** (multiple commits between session-128-first and now):
   - `aba2e60` — Mirror ProgramEditor's teacherLabel dropdown UX in the Hub admin form (Jesse caught the inconsistency: plain text input on the hub form vs. dropdown-with-presets on the program form)
   - `47141e2` — `"+ Add me as coordinator"` admin affordance.  Closed the catch-22 created when removing ADMIN's hub-content bypass: an admin who creates a new hub can't enter it (no membership), can't add themselves via the members tab (which is inside the hub).  New POST endpoint upserts a HubMember row for the calling ADMIN with `isCoordinator: true` + ACTIVE + hostingCapability + communicationsEnabled.  Idempotent.
   - `5a7c7ed` — Manual chapter for the Peer-Led Silent Meditation hub (`prisma/seed-manual-peer-led-silent-meditation.mjs`) + new `peer-led` group in `lib/manualGroups.ts`.  Plain-language: how rotation works, claiming a session, what the Facilitator pill means, sub-request etiquette, what the role does and doesn't ask of you.
   - `cccf020` — Renamed the Scheduler tool's default label from "Host Schedule" to "Scheduler" (in the tool registry) plus a one-time migration that updated existing HubAppLink rows still carrying the old default.
   - `dafc409` — Hub-scope the "Your Rotations" panel on `/tools/schedule`.  Was fetching all of the caller's rotations regardless of hub; Jesse caught it in the first peer-led test (Art of Meditation rotation leaking into the peer-led hub's Scheduler view).  In-memory filter by `pgPrograms.map(p => p.slug)` — Slice 1 had only addressed the data layer; this closed the UI panel.
   - The big ADMIN-bypass-on-hub-content removal: layout gate + 18 API routes changed from `!member && !isAdmin` to `!member`.  ADMIN no longer bypasses hub content; only `/admin/hubs` administration stays ADMIN-gated.  (Commit `3fba168`, before the cumulative ones documented here.)

3. **`fdb441d` (Slice 2.5 code)** — Hub-scope every outbound email URL + welcome-email reliability.  Closed the gap Slice 1 missed: every email link constructed in `lib/email.ts` was hub-agnostic, so multi-hub members (Nancy in both host-team and peer-led-silent-meditation) landed in default host-team view from any email.  Two new helpers: `hubScopedUrl(path, hubSlug)` for /tools/* paths (appends `?hub=` when slug isn't host-team default; auto-handles `?` vs `&`) and `hubHomeUrl(hubSlug)` for `/account/hub/<slug>` paths.  Every send* function in lib/email.ts now accepts `hubSlug`; every callsite passes `program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG`.  Welcome email fire-and-forget bug fixed: `/api/hub/[slug]/members` POST now uses `after()` from `next/server` and `syncHubMembership` awaits its sends.  New `emailButtonHtml(label, url)` canonical CTA button helper.  Existing `{{coverUrl}}` etc. variables retained for backward compat; new `{{coverButton}}` / `{{scheduleButton}}` / `{{hubButton}}` variables added so templates can be edited at `/admin/emails` to render the prominent button.

4. **`86ce52e` (Slice 2.5 docs)** — Three new modular engineering reference docs:
   - **`RIM_Hub_Engineering.md`** — the four routing layers (capability, recipients, UI filter, URLs), helpers, ADMIN policy, common pitfalls, grandfather policy, closing-ritual addition
   - **`RIM_Email_Engineering.md`** — template gate, URL construction rules, after() pattern, CTA convention, env-var trimming
   - **`RIM_Scheduler.md`** — per-tool reference for `/tools/schedule`
   - CLAUDE.md Design Orientation table gets three new rows pointing each task type at the right doc.  Closing ritual gets new steps 4b (engineering-doc updates), 4c (hub audit on hub-related slices), 4d (per-tool doc creation when a slice touches a tool without one — self-perpetuating mechanism).

5. **`e446213`** — Fix sub-request email: was passing `assignment.programSlug` as `programName`, rendered as "Jesse needs a sub for **good-evening-silent-meditation**" instead of "Good Evening Silent Meditation."  Per CLAUDE.md's permanent reminder: resolve Program.name from slug before sending any host email.

6. **`a80dc17`** — Conservative template-body migration: swap the canonical CTA links to the new `{{*Button}}` variables across 6 templates.  Only swap when the canonical body pattern is still present (preserves any coordinator customizations).  Per-template log output as the audit trail.  Jesse explicitly consented to the update via "do the email coding for me."

7. **`03f8537`** — Refine the Email Template Gate stance in CLAUDE.md + RIM_Email_Engineering.md.  Jesse pushed back on the "never upsert" framing — the real concern is *silent* overwrites, not all overwrites.  Now: seed-only by default; intentional `update` is fine with explicit consent, with per-template log output as the audit trail.

8. **`51d1207` (Slice 2.6 code)** — Generalize the standing-rotation API to be hub-aware.  Was deferred from Slice 1 with a "still gates by host-team" note, but Jesse noticed the Rotations tab UI was already visible to coordinators of any hub (post-Slice 2 fix) while the API was 403-ing — "shows up but doesn't work" inconsistency.  All 6 standing-assignment routes now derive their hub from the rotation's `programSlug` via `getProgramHubSlug` and gate by `isHubCoordinator(userId, programHubSlug)` (new helper in `lib/hubAuth.ts`).  Apply-all (no programSlug) requires HOST_MANAGER/ADMIN as a cross-hub global action.  Email functions accept optional `hubSlug` and use `hubScopedUrl` for the schedule link.  UI plumbing: schedule page passes hubSlug to HubScheduleClient → RotationsClient → `?hub=` on the rotation-list fetch.

9. **`d5ad0fc`** — Update RIM_Scheduler.md with the post-2.6 standing-rotation model.  Auth-per-route table; auth-follows-the-program precedence rule for the GET; StandingAssignment has no Program FK note.

10. **`89051f3`** — One-line fix that completed Slice 2.6's wiring.  Jesse opened the Rotations tab in peer-led-silent-meditation as coordinator and didn't see it.  The view-tab strip in HubScheduleClient.tsx was gated by `isHostManager` (global HOST_MANAGER role only) instead of `isManager` (the hub-aware flag that includes coordinators of the active hub).  API capability + UI visibility now match.

### Architectural calls made this session

**"Shared infrastructure, hub-scoped data" is the right architecture.**  Jesse questioned it twice ("should these be duplicated instead of sharing?" — once during the design conversation, once after the Nancy bug).  The shared approach is correct because RIM scales to low-double-digit hubs with the same coordinator practice across all of them.  But the sharp edge is real: every callsite that touches hub context must honor scoping.  Slice 2.5 + 2.6 surfaced two layers Slice 1 had missed (email URLs, standing-rotation routes).  The new engineering docs are the institutional response — every future hub-related slice now has a checklist to follow, and the closing ritual requires auditing all four routing layers before commit.

**Modularity per tool, manual chapters per hub, behavior feedback in `memory/`.**  After we built the three engineering docs (Hub + Email + Scheduler), Jesse raised the broader meta-question: "these tools have their own document that can be thoroughly created."  We codified the modular split — per-tool engineering docs (`RIM_<Tool>.md`) for the developer/Claude, per-hub `ManualSection` chapters for the human members, cross-cutting `RIM_<Concern>_Engineering.md` for shared rules, behavior memory files for collaboration patterns.  Self-perpetuating via closing-ritual step 4d.

**ADMIN no longer bypasses hub content access.**  Jesse's memory was right: hubs are team spaces and the team is defined by membership.  ADMIN configures hubs from `/admin/hubs` but participates as a member.  Matches GUIDING_TEACHER's existing pattern.  The "+ Add me as coordinator" affordance on the admin edit page closes the catch-22 this creates for the first admin into a new hub.

**Standing rotations are a generally-useful pattern, not host-team-specific.**  Every team that holds recurring sessions might want one.  Jesse pushed back on the "deferred until peer-led needs it" framing — Slice 2.6 made the generalization happen now so future hubs just work.

**Email Template Gate: protect against silent overwrites, not against intentional consented updates.**  The original rule was over-defensive.  Refined to "seed-only by default; intentional `update` with consent is fine, with per-template log output as the audit trail."

### What testing on the deployed site should confirm

(Cumulative across Slice 2.5 + 2.6 + the tab-visibility fix.)

1. **Nancy's end-to-end flow.**  Add Nancy as peer-led-silent-meditation member.  She gets a welcome email pointing to `/account/hub/peer-led-silent-meditation`.  Someone requests a sub on a Good Morning session — Nancy gets a sub-request email reading "**X** needs a sub for **Good Morning Silent Meditation**" (human-readable program name) with a "Cover this session" button (once you swap `{{coverUrl}}` for `{{coverButton}}` in the template body).  She clicks → lands on `/tools/schedule?action=cover&id=...&hub=peer-led-silent-meditation` (correct hub view).  She claims → joins the session → sees Facilitator pill + bell-friendly audio.
2. **Rotations tab visible in peer-led hub.**  Open `/tools/schedule?hub=peer-led-silent-meditation`.  You should see Schedule | Rotations tabs at the top (Slice 2.6 fix).  Click Rotations.  Empty rotations grid for peer-led programs.  Create a rotation pattern (e.g. Nancy every other Tuesday morning) — save succeeds (Slice 2.6 API generalization).  Apply — creates HostAssignment rows.  Nancy gets `sendStandingAssignmentScheduledEmail` with the schedule link scoped to peer-led hub.
3. **Welcome email actually arrives.**  Slice 1's `.catch(() => {})` was killing the email via Vercel teardown.  Add a new member to any hub; confirm the email lands in their inbox.  If it fails, the Vercel log shows the error (no more silent swallow).
4. **CTA buttons render after you edit templates.**  At `/admin/emails/sub-request-posted` (and the other five), swap the plain markdown CTA link for `{{coverButton}}` / `{{scheduleButton}}` / `{{hubButton}}`.  Save.  Next email of that type renders the canonical button (RIM-blue, white bold, centered).

### Connections (what this work touches)

- **`lib/email.ts`** — every send* function in the file now hub-aware.  Two new helpers (`hubScopedUrl`, `hubHomeUrl`).  CTA button helper (`emailButtonHtml`).
- **`lib/hubAuth.ts`** — new `isHubCoordinator(userId, hubSlug)` helper.  ADMIN-policy comment header rewritten (no content-access bypass).
- **`lib/programHub.ts`** — unchanged from Slice 1; now used by far more callsites.
- **`/api/hub/[slug]/members/route.ts`** — `after()` wrap; uses `hubHomeUrl`.
- **`/api/admin/hubs/[slug]/add-me-as-coordinator/route.ts`** — new; admin bootstrap into a hub.
- **`/api/host/sub-requests/*`, `/api/host/assignments/*`** — every send* call passes `hubSlug` from program.
- **`/api/host/standing-assignments/*`** — all 6 routes hub-routed by `getProgramHubSlug`.  Helpers consolidated to use the shared `lib/hubAuth.ts::isHubCoordinator`.
- **`/api/admin/hubs/*`** — HubAdminForm + API now expose `assignmentGrantsTeacher` + `teacherLabel` form fields (Slice 1 added the schema columns; Slice 2 added the UI).
- **`components/HubAdminForm.tsx`** — checkbox + dropdown (mirrors ProgramEditor's pattern); "+ Add me as coordinator" affordance.
- **`components/RotationsClient.tsx`** — `hubSlug` prop; `?hub=` on rotation-list fetch.
- **`components/HubScheduleClient.tsx`** — `hubSlug` prop pass-through; Rotations tab gated by `isManager` not `isHostManager`.
- **`app/account/hub/[slug]/layout.tsx`** — ADMIN-bypass removed; `hasAccess = isMember` only.
- **18 hub API routes** — `!member && !isAdmin` → `!member` (content access).  Coordinator-level checks unchanged.
- **`lib/syncHubMembership.ts`** — awaits sends instead of fire-and-forget; uses `hubHomeUrl`.
- **`prisma/migrate.mjs`** — three new flagged migration entries: scheduler-label-rename, peer-led-silent-meditation manual chapter seed, email-CTA-button swap.
- **`lib/toolRegistry.ts`** — "Host Schedule" → "Scheduler" default label.
- **`lib/manualGroups.ts`** — new `peer-led` group.
- **`CLAUDE.md`** — Design Orientation table + closing ritual updated.
- **`RIM_Hub_Engineering.md`, `RIM_Email_Engineering.md`, `RIM_Scheduler.md`** — three new engineering reference docs.

### Backlog moves

- **Closed: `2026-05-25-003`** (Silent Meditation Hub).  Architecture is fully operational + isolated end-to-end.  Pending only Jesse's live verification.
- **Still open: `2026-05-21-002`** (rate-limit on `/api/auth/callback/resend`).  Defense-in-depth, queued.
- **Still open: 9 fire-and-forget patterns** in the codebase (enrollment side-effects).  Same `after()` treatment as the welcome email; queued for a focused reliability sweep slice.

### Smaller items parked

- **Hub creation should auto-add the creator as coordinator.**  Removes the "+ Add me as coordinator" extra step.  Small follow-up.
- **Friendly "no access" message** when an admin lands at a hub they're not a member of — link them back to the admin edit page.  Small UX polish.
- **Voice-extraction (`RIM_Voice.md`)** — Jesse's writing-voice profile.  Per the blueprint-pattern discussion at the end of this session.  Queued as a small focused task.
- **Behavior-audit at closing.**  CLAUDE.md closing ritual could add step 9b: "Scan the session for corrections that should become memory files."  Five-minute change.

### Next priority

Either the **voice extraction** (~15 min focused work; produces a real reference doc that compounds the engineering-docs investment) or whatever's most pressing for the live site.  Backlog priorities to consider: rate-limit on the resend callback (`2026-05-21-002`), the fire-and-forget reliability sweep, or the hub-creation auto-coordinator polish.

---

## 2026-05-22 (session 128) — Silent Meditation Hub — Slice 1 architecture

One code commit on `main` (`500fa64`). Slice 1 of the two-slice plan documented at the end of session 127. The full design was settled in conversation; this session was straight-through implementation — schema, helper, route updates, editor restructure, schedule filter — with one reviewer-caught nit addressed before commit.

### What shipped

**Per-program hosting-hub override + hub-grants-teacher capability path.** Every program now reads a hosting hub (defaults to `host-team`); coordinators can transfer a program to a peer-led hub that confers Teacher capability — bell-friendly audio + the hub's pill label — on whoever signs up to lead a session. No `ProgramTeacher` row needed for peer leaders; the act of claiming the session IS the teacher capability when the hub grants it.

**Schema (three idempotent `ALTER TABLE ADD COLUMN IF NOT EXISTS` adds via `_migration_flags`, no backfill):**

- `Program.hostingHubSlug String?` — null defaults to `host-team`. Set per program when a coordinator wants to transfer hosting to a peer-led hub.
- `Hub.assignmentGrantsTeacher Boolean @default(false)` — when true, an active HostAssignment from this hub confers `isProgramTeacher: true` in `resolveSessionRole`.
- `Hub.teacherLabel String?` — hub-level fallback for the Teacher pill text. Used when the hub grants teacher capability and the program doesn't override.

**New helper `lib/programHub.ts`:**

- `getProgramHubSlug(programSlug)` → `string` (defaults to `"host-team"` when null)
- `getProgramHostingHub(programSlug)` → `{ slug, assignmentGrantsTeacher, teacherLabel } | null`
- `resolveTeacherPillLabel(programLabel, hubLabel)` → `string` (pill hierarchy: `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`)
- `DEFAULT_HOSTING_HUB_SLUG = "host-team"` constant for the rare direct comparison

**`resolveSessionRole` broadened (`lib/livekitAuth.ts`).** `isProgramTeacher` now layers two paths: (1) existing `ProgramTeacher` row OR (2) `assignmentGrantsTeacher: true` on the program's hub AND active HostAssignment for this session. Co-host and Step-In gates route by the program's hub instead of hardcoded `"host-team"`. Returns the resolved hub config to callers so they can apply the pill hierarchy without a second fetch.

**LiveKit token + step-in.** Both fetch the program with `hostingHubSlug` plus a nested hub join for `assignmentGrantsTeacher` + `teacherLabel`. Pill hierarchy applied consistently in seedMeta. `Mute*` and `end-session` inherit the new behavior via `resolveSessionRole` — no direct changes.

**Host operation routes route by program's hub.** `/api/host/assignments` POST (self-claim), `/api/host/sub-requests` POST + `[id]/claim` all gate by `program.hostingHubSlug ?? "host-team"`. Sub-request notification recipient pool routes to the program's hub. `/api/programs-pg` POST also fires the new-program notification to the program's hub.

**ProgramEditor restructure (per the design conversation):**

- New tab **"Hosting & Access"** between Schedule and Categories.
- `teacherLabel` moved out of Content tab into Hosting & Access.
- `isOpenAccess` + `guestAccessKey` moved out of Schedule tab into Hosting & Access.
- New `hostingHubSlug` dropdown — "Host Team (default)" stores null, plus every active hub.
- **Mid-flight warning** when changing the hub on a program with future HostAssignments: the edit page fetches the count, shows a notice clarifying the grandfather policy (existing assignments stay; new claims route to the new hub). Helps coordinators see the consequence before they save.

**Schedule page filter.** `/tools/schedule?hub=...` now filters programs by `hostingHubSlug`. Host-team scope (the default, or explicit `?hub=host-team`) uses a Prisma `OR` to catch both `null` and `"host-team"` so existing programs without an explicit field stay visible. Coordinator-record lookup and pause-state map both routed to the active hub.

**Slug validation.** POST + PUT on `programs-pg` reject non-existent hub slugs with 422 — the reviewer flagged that without validation a typo'd slug would create an orphan state. The check is one cheap DB lookup.

### Reviewer sub-agent (per the session-117 promoted pattern)

Spawned on the staged diff. Found one important item (slug validation) and a few stylistic nits. Validation added; nits left.

### Deferred to Slice 2 (intentional, documented in commit body)

- Standing-rotation routes still gate by `host-team`. Peer-led hub doesn't surface standing rotations yet — when it does, broaden the same way.
- `/api/host/assignments` GET handler's pause map still scoped to `host-team`. Slice 2 generalizes when needed.

### Connections (what this work touches)

- **Schema** — `Program`, `Hub`. No new tables; three columns.
- **Authority resolution** — `lib/livekitAuth.ts::resolveSessionRole` is the central gate; broadening it cascades to mute/end/step-in/token without per-route changes.
- **Program ownership** — the `hostingHubSlug` field is the source of truth for "which hub claims this program." Rejected category-based join earlier because categories are coordinator-editable UI groupings (session 125 lesson: don't overload one field with two meanings).
- **Pill label hierarchy** — `program.teacherLabel ?? hub.teacherLabel ?? "Teacher"`. Session 127's per-program override stays the most specific layer; hub default is the fallback for hub-granted teacher capability.
- **Editor structure** — the new "Hosting & Access" tab consolidates fields that share one concern (how the live session behaves and who has authority in it). Sets the precedent for future fields in this category (per-program audio profile, time-gate adjustments, recording policy, etc.).
- **Grandfather policy** — existing HostAssignments survive hub changes. The mid-flight warning makes this explicit at the editor.
- **Hub-as-authority (session 92)** — extends naturally. `getEffectiveHostingCapability(userId, hubSlug, fallback)` already takes a `hubSlug`; we're just passing it the one derived from the program.

### What's next — Slice 2 (admin-only, no code)

1. `/admin/hubs` → create `peer-led-silent-meditation` with `assignmentGrantsTeacher: true`, `teacherLabel: "Guide"`, type OPERATIONAL, pick coordinators.
2. Add a `HubAppLink` to `/tools/schedule?hub=peer-led-silent-meditation`.
3. Edit Good Morning / Good Evening Silent Meditation programs → Hosting & Access tab → set Hosting team to the new hub. Confirm the grandfather warning behaves correctly if upcoming HostAssignments exist.
4. Add peer leaders as HubMembers (active, hostingCapability: true).
5. First peer-leader test end-to-end: claim a session from `/tools/schedule?hub=peer-led-silent-meditation` → confirm HostAssignment row written → join the session → confirm Teacher pill reads "Guide" with bell-friendly audio.
6. Staff manual: extend `host-hub` chapter or create a new `peer-leader-hub` chapter explaining the model + claim flow + Guide pill semantics. v10 manual self-heal.
7. After Slice 2 lands, close backlog `2026-05-25-003`.

### What testing on the deployed site should confirm (backward compat — Slice 1 should be inert until programs move)

1. Open any existing program in `/tools/programs/[slug]/edit`. New "Hosting & Access" tab sits between Schedule and Categories. Dropdown reads "Host Team (default)". Save without changing anything — behavior identical.
2. teacherLabel still works after the move from Content. Existing programs (Essential Dharma Study etc.) keep whatever was set in session 127.
3. Open Access fields moved from Schedule to Hosting & Access for virtual/hybrid programs; guest links still work.
4. `/tools/schedule` (no `?hub=`) still shows every host-team program — no disappearances. The Prisma `OR` filter catches both null and explicit `"host-team"`.
5. The new hub field is wired but inert. No hub has `assignmentGrantsTeacher: true` yet, so no behavior change anywhere. Slice 2 turns it on.

---

## 2026-05-26 (session 127) — Per-program teacherLabel — Teacher / Guide / Facilitator / Instructor / Custom

One code commit on `main` (`fbbf955`) plus this closing-ritual doc sweep. Closes backlog `2026-05-25-002`. Lands before the Silent Meditation Hub (`2026-05-25-003`) so peer-led offerings can carry "Guide" pills when that hub goes live.

### What shipped

A nullable `Program.teacherLabel` column lets a coordinator override the "Teacher" pill text on the session-room participant tile per program. Null is the existing default — the renderer falls back to "Teacher" everywhere. The mechanism is unchanged: a `ProgramTeacher` row still drives the bell-friendly audio profile and the Teacher pill; only the display string varies.

**Editor surface.** The Program editor's Content tab gains a dropdown below the Teacher / Facilitators field: *Teacher (default) · Guide · Facilitator · Instructor · Custom…*. Picking Custom reveals a 20-character text input. The initial-state derivation handles all three save shapes — null → "default", one of the three preset literals → that preset, anything else → "Custom" with the saved text preserved.

**Server-side sanitization.** New `sanitizeTeacherLabel(input)` in `lib/programUtils.ts`. Allows Unicode letters and marks (for accented characters and non-Latin scripts), digits, spaces, hyphens, and apostrophes. Order matters: strip first, collapse whitespace, then trim, then slice — so a long string doesn't survive the slice because of disallowed characters that get stripped later. The reviewer sub-agent caught the original strip-after-slice ordering bug.

**Token-route plumbing.** `/api/livekit/token` and `/api/livekit/step-in` add `teacherLabel: true` to their Program select. When `isProgramTeacher` is true AND `program.teacherLabel` is non-null, they seed `teacherLabel` into participant metadata alongside `teacher: true`. Both responses also include `teacherLabel: program.teacherLabel ?? null` for client-state parity.

**Client pipeline.** Token response → `app/session/[slug]/page.tsx` stores `teacherLabel` in state → `VideoRoom` → `RIMConference` (new prop). `RIMConference`'s belt-and-suspenders metadata seeder (from session 124) gains a `needsTeacherLabelUpdate` branch that broadcasts the label via `localParticipant.setMetadata` after connect. The pattern matches the existing `host` / `teacher` / `cohost` flags: promote, don't demote.

**Renderers.** `ParticipantMetadata` interface gains `teacherLabel?: string`. `RIMParticipantTile` and `ParticipantsPanel` (both local Me row and remote rows) render `meta.teacherLabel || "Teacher"` instead of the hardcoded string. Same CSS class — color and shape are unchanged; only the text varies.

### Reviewer-caught issues (all fixed pre-commit)

The reviewer sub-agent flagged three real concerns:

1. **Sanitizer order.** Original code did `.trim().slice(0, 20).replace(strip-stuff)` — meaning a string like "Co-Leader-12345678901" would survive the 20-char slice with digits still in, then have digits stripped after, ending up shorter than intended. Fixed by reordering: strip → collapse whitespace → trim → slice → trim.
2. **Regex too tight.** Original `/[^A-Za-z\s\-]/g` blocked apostrophes, digits, accented characters, and non-Latin scripts. Widened to `/[^\p{L}\p{M}\d\s'\-]/gu` so realistic role names like "Teacher's Aide", "Co-Leader 1", "rōshi", and "Senpai" all pass. The 20-char cap is the real layout safety; the character set restriction is paranoia and was overcalibrated.
3. **Step-in response parity.** `/api/livekit/token` returned `teacherLabel`; `/api/livekit/step-in` selected it for the metadata seed but didn't include it in the response JSON. In practice teacherLabel is invariant across a single user's session (ProgramTeacher membership doesn't change on step-in), but for shape parity and future-proofing, step-in now also returns it and the page updates state from it.

The reviewer also confirmed: the dropdown's preset-vs-custom logic is correct, and the "promote-don't-demote" pattern in the metadata seeder is fine (coordinator edits mid-session are rare and the seeder runs once per join — not worth bidirectional sync).

### What this connects to

- **`ProgramTeacher` model** — unchanged. The label is purely cosmetic; the underlying ProgramTeacher row is what drives the audio profile (`teacher`), the metadata flag (`teacher: true`), and the Teacher pill (`meta.teacher`). teacherLabel is only consulted when `meta.teacher` is already true.
- **Silent Meditation Hub (`2026-05-25-003`)** — this slice is the prerequisite. Peer leaders of silent sits can now be ProgramTeachers whose pill reads "Guide" instead of "Teacher" — exactly what that hub needs when it goes live.
- **Manual chapter `host-session-room`** — needs a one-line aside in the pills section noting that some programs may show "Guide" / "Facilitator" / "Instructor" instead of "Teacher". v9 self-heal added.
- **`/admin/livekit-test`** — unaffected. The test room doesn't carry a Program record, so there's no teacherLabel to surface.

### Backlog moves

- **Closed: `2026-05-25-002`** (per-program teacherLabel dropdown). Implemented per the original spec.
- **Next priority: `2026-05-25-003`** (Silent Meditation Hub) — now unblocked. Peer-leaders can carry "Guide" pills when the hub is live.

### Next priority

Silent Meditation Hub. New Hub for peer-led offerings (Good Morning / Good Evening Silent Meditation, expandable to Recovery Dharma etc.). Self-claim + standing rotations reuse host-team infrastructure. Open design question parked there: should the bell-friendly audio profile be granted to *any* Session Host, regardless of ProgramTeacher status? Worth resolving when the hub is built.

---

## 2026-05-26 (session 126) — LiveKit time-gated tokens + per-session rooms (chat clears each session)

One code commit on `main` (`463f3bb`) plus this closing-ritual doc sweep. The session resolved one parked backlog item (server-side time gate on the token route) and quietly fixed an unintended-feature gap that surfaced while we were in there — recurring programs were sharing one LiveKit room name across every occurrence forever, and the chat was scoped only by room name, so today's chat showed last week's messages. The schema was already half-set-up for per-session scoping; the read query just never finished wiring. Jesse confirmed mid-session that *every* program — including drop-ins like Good Morning Silent Meditation — should follow the same per-session pattern. No exceptions.

### What shipped

**Two coupled changes that complete one design intent: every session is a discrete event with its own room and its own chat history.**

1. **Server-side time gate** on `/api/livekit/token` and `/api/livekit/guest-token`. Refuses to issue tokens outside a session's open window. Window opens 22 min before `Program.startDatetime` (matches the dashboard host early-open epoch from session 121) and closes 30 min after `Program.endDatetime`, falling back to +90 min when `endDatetime` is null. ADMIN and GUIDING_TEACHER bypass as a safety override (mirrors `hasEndAllAuthority`); guests have no bypass. Outside the window, the route returns `403 { error: "session-closed", message, nextOpensAt }` — the session page surfaces `message` to the user as "This session isn't open yet — it begins at 7:00 PM" or "This session has ended" or "No session right now. The next one is Tuesday at 8:15 AM." Closes backlog `2026-05-24-002`.

2. **Per-session room names.** `roomNameForProgram(slug, sessionDate)` was already designed to produce `slug-YYYY-MM-DD` when given a date, and the schema's `SessionChatMessage.sessionDate` was already ready — the session page just never passed `sessionDate` to the token route, so `roomNameForProgram` returned the bare slug for every recurring program. Now the server computes today's `sessionDate` (via the new `lib/sessionWindow.ts::getActiveSessionWindow`) and uses it for the room name. Today's room is `good-morning-sangha-2026-05-26`; tomorrow's is `good-morning-sangha-2026-05-27`. Chat (filtered by `roomName`) scopes itself per session automatically — no chat query change needed.

3. **`sessionDate` threaded through the client.** Token response now carries `sessionDate`. The session page stores it and passes it to `RIMChat` (so chat history is per-session) and into `SessionRoleContext` (so `RIMParticipantTile`'s mute action can include it). All four action callsites — mute-participant, mute-all, end-session, step-in — now send `sessionDate` in their request bodies so the server resolves the same room the client is connected to.

4. **Defense-in-depth assertion on the action routes.** The reviewer sub-agent flagged that the action routes were trusting whatever `sessionDate` the client sent. Without validation, a holder of a host-team role could POST an arbitrary `sessionDate` and have the server construct a room name targeting an arbitrary "session" — most concerning for `step-in` which WRITES a `HostAssignment` row. New `lib/sessionWindow.ts::assertSessionDateInWindow` helper wired into all four action routes refuses if the supplied `sessionDate` doesn't match the currently open window (ADMIN/GT bypass; mirrors the token-route model).

5. **Format alignment with the schedule UI.** Two formats for `sessionDate` exist in the codebase: bare `YYYY-MM-DD` (date only, used in some helpers) and full ISO `YYYY-MM-DDTHH:MM:SS.SSSZ` (used by the schedule tool when it writes `HostAssignment.sessionDate`). `resolveSessionRole`'s assignment lookup uses exact-match `new Date(sessionDate)`. The session window helper uses `scheduleUtils.shiftToDate(...).toISOString()` — the same path the schedule tool uses — so the resulting `sessionDate` matches existing assignment rows exactly. The DST drift in `shiftToDate` (24-hour increments, not wall-clock-preserving) is a pre-existing limitation of the schedule subsystem; this helper inherits it deliberately rather than forking to a DST-correct shift that would mismatch existing data.

### Forgot-to-End fallback (the design question that surfaced mid-session)

Jesse asked: what happens if someone forgets to click End for All? Three layers cover it now:

- **Explicit End-for-All** — the host taps the red End button, picks "End Meeting for All", LiveKit's `deleteRoom` runs, every participant disconnects.
- **LiveKit's empty-room idle cleanup** — if the last participant just leaves without ending, LiveKit Cloud destroys empty rooms after a short idle timeout (~5 min default).
- **The time gate at the door** — even if some stale state lingered, the token route refuses to issue new tokens after the close window. Nobody can rejoin a stale abandoned room.

Tomorrow's room is a fresh name regardless. Chat from yesterday's session stays in the DB (orphan rows with the old room name) but is invisible because nobody queries for that room name anymore. Optional future cleanup: a small cron purging `SessionChatMessage` rows older than N days. Not urgent — rows are tiny.

### Discoveries worth preserving

**The chat-persistence bug was a half-finished feature, not a code bug.** The schema (`SessionChatMessage.sessionDate`) and the room-naming function (`roomNameForProgram(slug, sessionDate)`) were both written for the per-session model. Only the call site (the session page) never passed the date. This is the second time in recent sessions where the diagnosis was "the design is already there, it just wasn't wired" — session 124's ProgramTeacher backfill was the other one (the audio-profile derivation depended on `ProgramTeacher` rows, but 13 of 16 programs had no rows). Pattern: when a feature exists in the schema and the helpers but does nothing visible, check whether the call site is passing the parameter.

**Pre-existing DST drift in `shiftToDate`.** While building the time-window helper, I initially wrote a DST-correct `ctTimeOnDate` using `Intl.DateTimeFormat` — then realized it would produce timestamps that disagreed with `HostAssignment` rows the schedule tool had already written. Reverted to using `shiftToDate` for consistency. The platform-wide DST drift (an 8 AM CT program would appear at 7 AM or 9 AM for 1–2 days twice a year in absolute UTC, but the displayed wall-clock time stays correct) is a real limitation in the schedule subsystem. Not in scope for this session. Worth a future pass.

**Reviewer caught a real defense-in-depth gap.** Spawned a reviewer sub-agent before commit (per the session-117 promoted pattern). It flagged that the four action routes trusted the client's `sessionDate` verbatim without validating against the open window. Real attack model is narrow (already-authorized host-team members; the mute/end calls are mostly no-ops on empty rooms; step-in is the one that writes data), but the fix is cheap and consistent. Added the assertion helper and wired it into all four routes. The reviewer also identified one off-by-one risk in date-string arithmetic that I traced through and confirmed was safe (the "noon UTC + 24h" pattern is the standard DST-safe day increment).

### Connections (what this work touches)

- **`/api/livekit/token`, `/api/livekit/guest-token`** — new time gate, per-session room name, returns `sessionDate` in the response.
- **`/api/livekit/end-session`, `/api/livekit/mute-participant`, `/api/livekit/mute-all`, `/api/livekit/step-in`** — all now run `assertSessionDateInWindow` before doing their work, then use the computed `effectiveSessionDate` for `roomNameForProgram`.
- **`lib/sessionWindow.ts`** — new file. `getActiveSessionWindow`, `describeInactiveWindow`, `assertSessionDateInWindow`.
- **`/session/[slug]/page.tsx`** — captures `sessionDate` from token response, threads it to `VideoRoom` and the step-in fetch. Surfaces the time-gate `message` directly to the user via the existing error state.
- **`components/VideoRoom.tsx`, `components/session/RIMConference.tsx`, `components/session/sessionRole.tsx`, `components/session/RIMControlBar.tsx`, `components/session/EndMenu.tsx`, `components/session/ParticipantsPanel.tsx`, `components/session/RIMParticipantTile.tsx`** — `sessionDate` prop added (or `sessionDate` field added to `SessionRoleContext`); passed to chat history queries and every action route call.
- **Schedule tool format alignment** — `lib/sessionWindow.ts` uses `scheduleUtils.shiftToDate(...).toISOString()` so its `sessionDate` matches existing `HostAssignment.sessionDate` rows. `resolveSessionRole`'s exact-match lookup hits correctly.
- **HostAssignment data integrity** — the step-in route now derives `sessionDate` from the validated window, not the client. New rows have aligned ISO timestamps.
- **Webflow / public surface** — none. This change is entirely member-area / session-room.

### Backlog moves

- **Closed: `2026-05-24-002`** (server-side time gate on `/api/livekit/token`). Implemented as a unified window across hosts + members (no two-epoch split — the per-session room model makes the 22/12 split unnecessary).
- **Still open: `2026-05-21-002`** (rate-limit `/api/auth/callback/resend`). Deferred per the discussion this session — preventive, not urgent. Worth building before the platform goes public on `rootedinmindfulness.org`.
- **Still open and re-confirmed parked: EndMenu audit-trail soft nudge.** No real signal yet that ending-without-assignment is happening operationally. Step-In is the explicit audit path; ADMIN/GT bypass cases are infrequent.
- **Still open: `2026-05-25-002`** (per-program `teacherLabel` dropdown). Next priority once Jesse confirms today's deploy is correct.

### Next priority

Per UP_NEXT: **per-program `teacherLabel` dropdown** (backlog `2026-05-25-002`). Small, contained, should ship before the Silent Meditation Hub so peer-led offerings carry "Guide" pills when that hub goes live.

---

## 2026-05-26 (session 125) — Session room refinements: raised-hand speaking queue, persistent vote signals, host identity-vs-capability split, Host Volunteer rename

Four code commits on `main` plus two doc commits. Started with two distinct UX questions from Jesse — could the raised hand and the vote signals work more like Zoom — and ended with a structural fix to a real host-designation bug he'd been seeing, plus a full doc sweep to keep the four canonical sources (System Architecture, Stack Reference, FEATURES, the volunteer-facing changelog) and the staff manual all aligned with the new model. The two threads turned out to be related: both were about making the session room tell the truth more clearly about who is who and what is happening.

### Commit chain

1. **`28d1298` — Raised-hand reorder + persistent vote signals.** Two related changes:
   - **Raised hand reorders tiles to top-left in raise order.** New `raisedHandAt: number` epoch-ms stamp on `ParticipantMetadata`. `RIMConference.tsx` computes a `sortedTracks` from `useTracks`, sorting hand-raised participants first by ascending timestamp (secondary sort by identity for cross-client determinism on same-ms collisions — so "Marsha is #2" is trustworthy from every viewer's perspective). Tiles are not enlarged; the reordering itself is the focus mechanism. Matches how Zoom actually solves this. Local participant's own raise also reorders their tile (via `useParticipantInfo({ participant: localParticipant })` to subscribe reactively to local metadata changes — `useRemoteParticipants` only covers remotes).
   - **Persistent ✓/✗ vote signals.** `ReactionsMenu.tsx` rewritten with a `persistent` flag per signal. Three persistent: ✋ (hand), ✓ (yes), ✗ (no) — toggle on/off, badge stays until cleared. Two timed: ❤️, 🙏 — auto-clear after ~5s. A contextual "Clear my signal" row appears at the top of the popover when the user has any persistent signal active (label reads "Lower hand" / "Clear ✓" / "Clear ✗"). One tap to clean up regardless of which is active — the "people forget to click it again" worry Jesse named, addressed without losing the persistent semantics.
   - **Numbered queue in Participants panel.** Hand-raisers show "1 ✋", "2 ✋", "3 ✋" derived from the same `raisedHandAt` sort. Local participant included in the queue. Single source of truth — panel order and grid order always agree.
   - **CSS tweak**: `.rim-pp__signal` widened from 20px fixed to 32px min-width with tabular-nums + nowrap to accommodate the queue numbers without breaking layout.

2. **`bb951e1` — Host identity/capability split + Host Volunteer rename.** The structural fix to Jesse's reported bug. Jesse joined a program where he was ProgramTeacher and ADMIN but not assigned host — and the room showed him with both Host + Teacher pills. The audit traced it to the ADMIN bypass in `resolveSessionRole`: `isSessionHost = isAdmin` skipped the HostAssignment check entirely, conflating *who is the assigned steward* (identity) with *who has the safety override on End-for-All* (capability).

   The refactor split them:

   - **`isSessionHost` is now identity-only.** `HostAssignment` match required. No role bypass. Drives the "Host" pill — an ADMIN visiting a session no longer shows it.
   - **New `hasEndAllAuthority` flag** carries the safety override. True for: assigned Host OR ADMIN OR GUIDING_TEACHER OR (Teacher when no `HostAssignment` exists for this session). Drives the End button label ("End" vs. "Leave"), the EndMenu's "End for all" option, and the `/api/livekit/end-session` server gate.
   - **Teacher-as-fallback-host rule (new).** Triggered by the conversation about Maria teaching alone on a course with no host assigned, and the planned Silent Meditation Hub (peer-led sits). Reactive at token-issue only — `anyHostAssigned` query for this exact session, including standing rotations (a standing row counts as "host present"). Authoritative gate stays the server-side re-check on `/end-session` — stale "End" buttons after a host claims later just yield 403.
   - **"Co-host" pill renamed to "Host Volunteer"** in user-facing text. Sangha-tone label for the same identity: host-team members who aren't the assigned host. Metadata field name (`cohost`) and CSS class (`--cohost`) kept stable to avoid churn.
   - **Share Screen extended from Session-Host-only to all Co-hosts.** Closes a latent bug from session 121 where Host Volunteers (and even teachers) saw the share button in the control bar but the token didn't grant the source — taps silently failed. The session-121 "Session-Host-only" restriction on share was over-tight; share is socially a Co-host capability across the board (matches Zoom/Meet).
   - **Step-In visibility broadens to ADMIN/GT without assignment.** Since they no longer auto-grant Host identity, they now correctly see the Step-In button and can write an actual `HostAssignment` row when they want to formally take the session — closes an audit-trail gap where ADMIN ending a session left no record.

   The reviewer subagent found no blockers; two cheap clarifying comments were added before commit (the server-side-re-check note in `/end-session`, the standing-assignment scope note in `livekitAuth.ts`).

3. **`984d5ed` — Docs alignment (FEATURES, System Architecture, Stack Reference, manual chapter v7).** Pure doc + migration commit. Five files:
   - `RIM_System_Architecture.md` — "Permission tiers" section rewritten around identity vs. capability. Pill priority Host → Teacher → Host Volunteer. Session-features paragraph updated for raised-hand queue + persistent vote signals.
   - `RIM_Stack_Reference.md` — long permission section replaced; top `_Last updated_` block summarizes the 2026-05-26 changes.
   - `FEATURES.md §38` — "Three-tier permission model" subsection replaced with the identity/capability model. End popover, Participants panel, Custom tile paragraphs refreshed.
   - `prisma/update-manual-host-session-room.mjs` — v7 rewrite of the staff manual chapter for hosts. New "Identity vs. capability" framing in "Who can do what". Three pills explained with the Host Volunteer name. Bell mode visibility broadened to anyone with a pill. Step-In description includes ADMIN/GT visiting a session. End-for-All button label explained around `hasEndAllAuthority`. New "Reactions and votes" section covers the speaking queue + persistent ✓/✗ + 5-second timed ❤️/🙏.
   - `prisma/migrate.mjs` — added the `update_manual_host_session_room_v7` flag entry. Self-heals on next Vercel deploy.

4. **`49da69c` — Volunteer-facing changelog refresh.** `SESSION_ROOM_FOR_VOLUNTEERS.md` brought current with the new model. Surgical edits to bring the host-identity language into line; bonus fix on the auto-hide description that had been stale since session 121.

### Architectural calls made this session

**Identity is not capability.** The audit found the real conflation: `isSessionHost` was returning true for both "you have a HostAssignment row" and "you're an ADMIN with the safety override." One flag, two meanings. The pill (identity) and the End button (capability) were both keyed on the same flag, so the pill misrepresented identity whenever the safety-override role joined. The fix names the two concerns separately: `isSessionHost` for identity, `hasEndAllAuthority` for capability. The pattern generalizes — *anytime a role-based bypass is bolted onto a flag that has both an identity meaning and a capability meaning, split the flag.*

**Teacher-as-fallback-host rule.** New, surfaced by Jesse's question about teachers teaching alone and peer-led community sits. The rule: a `ProgramTeacher` with no `HostAssignment` on the session holds End-for-All. The check looks for ANY assignment (any user) on this session — so a standing rotation counts as "host present" and the fallback doesn't fire even on an unclaimed-today instance. Reactive at token-issue; the server re-runs the check on every `/end-session` call, so the worst stale-token case is a 403 on a stale button tap. Honest about the edge case rather than papering over it.

**Share Screen is a Co-host capability across the board.** The session-121 restriction to Session-Host-only created a silent-failure mode (button visible, token didn't grant). Two ways to fix: hide the button for non-assigned-Hosts, or extend the grant. Took the latter — share is socially a Co-host action in every comparable product (Zoom, Meet, Teams), and host-team volunteers helping out should be able to show something on screen without needing to Step-In first. Hub authority gate still applies: a paused volunteer loses Co-host (and thus Share) automatically.

**"Co-host" renamed to "Host Volunteer."** Visible text only — metadata field and CSS class kept stable for code-side stability. The sangha-tone label decision came directly from Jesse's framing: "in a class with multiple host-team volunteers, maybe we can just identify them as Host Volunteer from the primary host." The label change reads more honestly in a sangha-first interface than the Zoom-borrowed "Co-host." Aligns with the broader pattern in `RIM_Web_Design_Philosophy.md` of using plain-language sangha vocabulary over platform jargon.

**Reactions and votes have three distinct behaviors on purpose.** Persistent + reordering (hand). Persistent without reordering (vote). Timed (emotional reaction). The three modes match three different social functions: the hand is a queue, the vote is a position, the reaction is a passing acknowledgment. Treating them all the same (the original behavior — only the hand was persistent) collapsed the distinctions and made votes useless. The new "Clear my signal" affordance at the top of the popover handles the "people forget" worry without giving up the persistent semantics.

### What this connects to

- **`lib/livekitAuth.ts::resolveSessionRole`** is the single source of truth — every server route that gates a session-room action calls it. Adding `hasEndAllAuthority` to its return shape was the contained way to introduce the capability concept without scattering role checks across the codebase.
- **The host-team Hub authority gate** (`getEffectiveHostingCapability`) was preserved unchanged. Co-host capability flows through it; the new End-for-All authority sits parallel as a different concern (the gate is about "is this person allowed to help in the room," not "is this person allowed to close the room").
- **Backlog item `2026-05-24-001`** (stale `isSessionHost` propagation after Step-In) is now less consequential. The original failure mode was that a previous host's client kept End-for-All visible after someone else stepped in, clicked it, got 403. With the identity/capability split, the End button is keyed on `hasEndAllAuthority` (which they may legitimately have via ADMIN/GT/teacher-fallback), and the server re-check on every `/end-session` call is the authoritative gate. The item still describes a real UI-staleness case worth fixing eventually (the Host pill on someone's tile can also go stale), but the security/correctness concern is fully closed.
- **Backlog item `2026-05-25-002`** (per-program `teacherLabel` dropdown) is the natural next slice — it builds on the same metadata pipeline. The work today added one more flag to `ParticipantMetadata`; that dropdown adds one more string. Cheap and contained.
- **`RIM_System_Architecture.md`** is now the authoritative reference for the identity/capability model. The doc was rewritten as part of this commit chain, so future sessions will see the current model before the historical one.
- **`SESSION_ROOM_FOR_VOLUNTEERS.md`** is the human-facing companion to the manual chapter. It gets updated separately because volunteers may be reading the markdown directly outside the app (Jesse shares it in trainings); the manual chapter inside the app is the source-of-truth on the live site.

### Collaboration moments worth preserving

**"Can you look at the setup really clearly for this aspect? Please do an audit."** The pivot of the session. The same engagement standard from session 124 — when there's a symptom you don't fully understand, audit before diagnosing — held again. Today's audit traced the bug through five files (resolver, token route, end-session route, RIMConference seeding, EndMenu) and named the architectural conflation cleanly. Then Jesse's follow-up questions ("isn't the admin the guiding teacher? aren't they on the same roles as hub admins/manager?" — "should the teacher have the same permissions as the host?") reframed the audit. The fix that landed wasn't the fix I'd have proposed if I'd jumped straight to code from the first read.

**Plain-English explanation pattern, repeated.** When Jesse asked "wouldn't they have the same authority as the host hub team?" — the right response was to lay out the two concepts (Host pill = identity, End button = capability) with concrete scenarios (Maria assigned, Jesse visits as ADMIN; teacher teaching alone; Silent Meditation peer-led) and let him weigh the rules from there. The proposal that emerged was sharper than either of us would have written from scratch.

**"Let's address both of those now to avoid drift."** Closing the doc gap immediately rather than letting it accumulate. The closing ritual's "don't let the docs lie" instruction landed mid-arc, not at session end — and the right call was to do the full doc sweep (four files plus the manual migration plus the volunteer changelog) as a single coherent pass, not piecemeal. The result is five sources that all describe the same model. Drift-avoidance done in real time.

### What comes next

**Verify on the deployed site:**
- Join a program where you're ProgramTeacher but not assigned host. Confirm: Teacher pill only (no Host pill). End button reads "End" (via ADMIN safety override). Step-In button visible.
- Join a program where you're NOT teaching and NOT assigned. Should show Host Volunteer pill (you're on host-team hub). End reads "End." Step-In visible.
- Step-In and confirm the Host pill appears and propagates to other clients. HostAssignment row should exist in `/tools/schedule`.
- Have a host-team volunteer join an assigned session. They should show **Host Volunteer** (not "Co-host"). Confirm Share Screen works for them — closes the latent bug.
- Raise a hand and watch the tile move top-left + queue number appear in Participants panel.
- Set ✓ in Reactions; confirm badge persists and the "Clear ✓" row appears at the top of the popover when you reopen it.

**Per-program `teacherLabel` dropdown** (backlog `2026-05-25-002`) is the next priority. Small, contained, builds on today's metadata pipeline. Adds one nullable field on Program, one dropdown in the editor, one prop on the rendering chain. Should ship before the Silent Meditation Hub so peer-led programs can render "Guide" pills cleanly when that hub goes live.

**Silent Meditation Hub** (backlog `2026-05-25-003`) is the larger structural piece. Reuses host-team infrastructure (HubMember, HostAssignment, self-claim, standing rotations). The open question about whether all Session Hosts should get the bell-friendly audio profile (vs. requiring per-program ProgramTeacher data) probably resolves during that build.

**Audit-trail observation.** After this refactor, an ADMIN ending a session with no `HostAssignment` row still leaves no audit row. If audit trails become important (e.g., for reviewing what happened in a difficult session), the Step-In flow is the answer — ADMIN/GT/teacher-fallback users can use it to formally claim the role before acting. May warrant a soft nudge in the EndMenu ("End for all without an assignment? Step in first to leave a record.") — but only if real signal emerges that audit trails matter operationally.

---

## 2026-05-25 (session 124) — LiveKit hardening: full audit, Krisp instrumentation, Step-In propagation, Zoom-style tier model, ProgramTeacher backfill, Step-In timing fix

Five code commits on `main` plus a backlog addition. Started as a follow-up to Jesse's first real test of the post-session-122 LiveKit stack with another host (Nancy) — surfaced echo, video pixelation, and an apparent host-status sync bug where she "claimed host" but Jesse didn't see her as Host. Began with a narrow read of the relevant files, then escalated into a full systematic audit when Jesse asked "did you do an audit of our implementation?" and I admitted I'd done informed analysis from partial reads, not a real audit. The audit found real bugs and a Zoom-style tier model emerged from the architectural conversation that followed.

### Five commits, in order

1. **`18a67c9` — Krisp instrumentation + attach verification + Step-In host metadata fix.**
   - **Krisp lifecycle diagnostics** in `RIMConference.tsx`. The pre-existing wiring called `setNoiseFilterEnabled(true)` once on mount with no error handling — the hook's internal Promise swallows rejection (missing WASM, unsupported browser, mic-track race). Added `[rim-krisp]`-prefixed `console.log` instrumentation at every state transition (processor available, mic published, enabled, pending), wrapped the initial enable in try/catch, and added an attach-verification effect that subscribes to `RoomEvent.LocalTrackPublished`, waits 500ms after the mic publishes, reads `track.getProcessor()` directly, and retries the enable once if the processor is loaded but not attached. Retry gated on `!isNoiseFilterEnabled && !isNoiseFilterPending` to avoid spam on mute/unmute republish cycles.
   - **Step-In host metadata bug fixed** in `app/api/livekit/step-in/route.ts`. The route was creating the new token with `{ roomAdmin: true, canShareScreen: true }` but **no metadata** — so when the stepper-in reconnected, their LiveKit participant metadata was empty and the Host badge (which keys on `meta.host` in `RIMParticipantTile.tsx`) never rendered for other participants. The route now mirrors the seedMeta pattern in `/api/livekit/token` and seeds `host: true` (plus the caller's avatarUrl if set). Client-side belt-and-suspenders in `RIMConference.tsx` extends the existing avatar-seeding effect to also `setMetadata({...prev, host: true})` whenever `isSessionHost` becomes true and the metadata doesn't already reflect it — so even if the server seed didn't land (race during reconnect, LiveKit reusing prior metadata), the explicit client call broadcasts the corrected state immediately.

   Also: `npm install` against the existing lockfile pulled **52 packages** that were missing from local `node_modules` despite being in package.json — most notably `@livekit/krisp-noise-filter`. Production deploys via Vercel's `npm ci` so this was a local-only drift, but worth flagging because Krisp's runtime behavior is invisible without instrumentation.

2. **`2d0098b` — Zoom-style tier model + three visible role pills (Host / Teacher / Co-host).** The architectural shift this session pivoted on. Jesse asked: "Might we want to consider a Zoom approach where they are all co-hosts and identified as such amongst other co-hosts, hosts, and the teacher?" After laying out the three options (per-hub / per-user / per-program for the label question), and confirming the Co-host net should widen to all active host-team HubMembers, this slice landed:
   - **`resolveSessionRole` in `lib/livekitAuth.ts`** consolidated to a single `getEffectiveHostingCapability` call with the role-based grant as the fallback: `tentativeRoleGrant = isManager || isProgramTeacher`, `hubCheckedCoHost = getEffectiveHostingCapability(userId, "host-team", tentativeRoleGrant)`. This restores the hub authority gate's ability to revoke role-based grants — a coordinator can pause a HOST_MANAGER or ProgramTeacher via HubMember status and they correctly lose Co-host. The reviewer sub-agent caught my first pass which had inadvertently bypassed the gate for managers/teachers; the consolidated call fixed it. `isHostTeam` (which gates Step-In) uses the same hub gate with `isManager` as the only role fallback — visiting ProgramTeachers without hub membership don't see Step-In.
   - **Token metadata expanded** to three orthogonal flags in `token/route.ts` and `step-in/route.ts`: `host: true` (Session Host), `teacher: true` (ProgramTeacher), `cohost: true` (Co-host AND not Host AND not Teacher). The constraint is enforced server-side and mirrored client-side in the metadata-seeding effect. A person can be both Host AND Teacher and render both pills; `cohost` is set only when neither of the other two applies, so at most two pills render per tile.
   - **Three pill variants** in `RIMParticipantTile.tsx` and `ParticipantsPanel.tsx`. CSS in `public/css/custom.css` extends the existing `.rim-tile-nameplate__host-tag` (now `__role-pill`) and `.rim-pp__role-tag` classes with `--host` (teal, same as legacy host tag), `--teacher` (warm gold for dharma identity), and `--cohost` (muted slate) modifier variants. Tile pills use higher opacity for readability on dark video; panel pills use lower opacity with brighter text on the panel's dark gray.
   - **`LocalRolePills`** component in `ParticipantsPanel.tsx` reads the local participant's role flags via `useParticipantInfo({ participant: localParticipant })` rather than `useLocalParticipant`. The reviewer caught that `useLocalParticipant` doesn't subscribe to `ParticipantMetadataChanged` events — so without explicit metadata subscription, the local Me row would have shown stale pills after a Step-In reconnect that updated flags. The switch to `useParticipantInfo` closes that gap.
   - **`isProgramTeacher` prop-drilled** through the page → VideoRoom → RIMConference → SessionRoleProvider stack. The token route returns it in the JSON response; the page tracks it in state; downstream readers gate Teacher-pill rendering and metadata seeding on it.

3. **`1d0151d` — ProgramTeacher backfill for 5 programs.** The audit had surfaced a pervasive miss: **13 of 16 active programs had no ProgramTeacher rows**, despite the session-79 introduction of ProgramTeacher being the very mechanism that drives the bell-friendly `teacher` audio profile + the new Teacher pill. Cross-referencing upcoming HostAssignments against ProgramTeacher rows showed that every recurring host (Nancy on Awakening The Heart, Jesse on The Art of Meditation) was on the `speaker` profile, not `teacher`. For Jesse hosting a meditation session in person at the center: his bells were being filtered by the browser's native noise suppression before Krisp even saw the audio — meaning Bell mode was wired up but **functionally disabled** by his audio profile.

   Looked up the legacy `Program.teacherFacilitators` free-text field plus all `User.isTeacher = true` records. Six of the 13 untaught programs had a named teacher in the legacy field, but only Maria Sprecher had a matching User account (the other five — Gina Dundun, Sam Scherer, Kerry Thomas, Christine Jacobi, Sara Neall — exist as names but not as RIM accounts). Jesse confirmed: "Those people aren't assigned a teacher role because they are not in the system yet, as we haven't gone live."

   New migration entry `backfill_program_teachers_v1` in `prisma/migrate.mjs` resolves Jesse + Maria by email (more stable than name), then defensively `findFirst → create` for five ProgramTeacher rows: Jesse on Essential Dharma Study, Meditation and Dharma Talk, Private Teacher Meetings, The Art of Meditation; Maria on Qigong at RIM. Also sets `Maria.isTeacher = true`. Aborts cleanly if either email lookup fails. Verified by running `migrate.mjs` against prod DB locally before push.

   New `scripts/audit-program-teachers.mjs`, `scripts/draft-teacher-assignments.mjs`, `scripts/lookup-teacher-users.mjs` document the audit approach.

4. **`8f00ac1` — Backlog: Silent Meditation Hub + per-program `teacherLabel`.** Two items from the conversation about peer-led offerings:
   - **`2026-05-25-002` — Per-program `teacherLabel` dropdown.** Add a nullable `Program.teacherLabel` field with a dropdown in the Program editor (Teacher / Guide / Facilitator / Instructor + custom). Threads through to the token metadata and pill renderer. Mechanism stays the same (ProgramTeacher row + teacher audio profile + pill presence); only the display string varies per program. Per-program won out over per-hub (which would force a program→hub lookup the room doesn't have and creates ambiguity when users are in multiple hubs) and per-user (which doesn't handle people who play different roles for different programs).
   - **`2026-05-25-003` — Silent Meditation Hub.** New Hub for peer-led offerings (Good Morning / Good Evening Silent Meditation; expandable to Recovery Dharma etc.). Self-claim + standing rotations reusing host-team infrastructure. Build order suggestion noted: teacherLabel ships first (small, lights up better audio profile + correct pill name immediately once ProgramTeacher rows exist), then this hub.

5. **`5b2cd16` — Step-In's 100ms setTimeout → actual disconnect-event wait.** The pre-existing handler set state to "loading" (which unmounts LiveKitRoom and starts disconnect) and then mounted the new token after exactly 100ms via `setTimeout`. The disconnect has to travel to LiveKit's servers and complete before the new connection can cleanly take its place under the same user identity. 100ms holds on most networks but races on slow ones — the artifact is a collision between the new connection arriving and the tail of the old one still being torn down. Replaced with a Promise that resolves when the LiveKitRoom's actual `Disconnected` event fires (via the existing `onLeave` callback path); `handleLeave` distinguishes Step-In disconnect from user leave by checking a resolver ref. 5-second safety timeout for the rare case where the event never lands.

### Architectural calls made this session

**The Co-host net widens to all active host-team HubMembers.** This is the Zoom-style "trust the team" model. Plain HOST role on the host-team hub now grants Co-host automatically — mute, share, Bell mode, Mute All — without needing to Step-In first. Step-In remains the mechanism for transferring the singular Session Host role (End-for-All authority). The tradeoff named: more people with mute/share capability = more chance of accident; mitigation is the existing HubMember authority gate (coordinator can pause individuals) plus visible pills so everyone knows who has what. Subtle behavior change worth flagging: plain HOST without an active HubMember record now loses Step-In. The session-92 `syncHubMembership` flow creates the HubMember on role assignment, so this should be a no-op in practice.

**Three orthogonal pill flags, with priority-display rules.** `host` / `teacher` / `cohost`. A Host who is also a Teacher renders both pills. The `cohost` flag is set only when neither of the other two applies. The constraint is enforced both server-side (token routes) and client-side (RIMConference metadata-seeding effect) so the two sources of truth can't drift.

**The bell-friendly audio profile remains gated on ProgramTeacher.** The audit surfaced the audio-profile-gap question explicitly: should *any* Session Host get bell-friendly capture (NS off, AGC off), or should only a `ProgramTeacher` row qualify? Left as an open design question in the Silent Meditation Hub backlog entry. The argument for generalizing: it would close the gap for non-teacher hosts (Nancy) without requiring per-row data hygiene. The argument against: non-teaching session hosts (e.g. a host coordinator running a logistics call) sound better with NS on. For now, ProgramTeacher remains the gate — the backfill closes the gap for the operational programs.

**The browser-vs-Zoom audio ceiling is acknowledged honestly.** Jesse named this clearly: same room, same hardware, Zoom handled the echo, LiveKit didn't. The audit confirmed our wiring is correct for what LiveKit + browser provide (browser AEC for canonical echo + Krisp NC for background noise). What's missing is what Zoom does in their native audio engine: long-delay AEC for room-coupling cases, aggressive residual suppression. There is no LiveKit-provided AEC processor we're failing to use; `@livekit/track-processors` ships only video processors, and `@livekit/krisp-noise-filter` is noise-only. Closing the gap to Zoom on the echo-prone-room case requires hardware (USB conference device with hardware AEC) or a hybrid approach (Zoom for sessions originating from the center; LiveKit for individual home participants). The choice is parked as a non-code decision.

### Collaboration moments worth preserving

**"Did you do an audit of our implementation?"** The pivot of the session. Jesse's question was sharp — and right. I'd answered three rounds of his A/V questions from informed partial reads of 6 files, presented hypotheses, and offered a fix plan. He correctly asked whether I'd actually audited, or just analyzed. I admitted I hadn't audited. The full audit that followed found the real Step-In metadata bug (not just a theory), found the Krisp local-install gap, found the audio-profile-pervasive miss, and surfaced the architectural question that led to the Zoom-style tier model. Memory entry candidate: when a subsystem has multiple symptoms across multiple sessions, "stop and audit" beats "diagnose and recommend." Already captured in `feedback-inventory-first.md`; this session reinforces it.

**Plain-English over jargon when explaining design questions.** When Jesse asked "Can you remind me and explain what the 100ms Step-In timeout is?" — the right answer is the actual flow under the hood (server hands back new token → browser has to disconnect-and-reconnect → 100ms guess) and what goes wrong when timing fails (collision under same user identity, silent step-in fail), not the variable names. The "Plain-English Explanations" memory pattern showed up again.

**Reviewer sub-agent caught two real issues in the tier-model commit.** First: my consolidated `resolveSessionRole` had inadvertently bypassed the hub gate for `HOST_MANAGER` and `ProgramTeacher` roles (the previous code passed `tentativeCoHost` as the gate's fallback, which meant hub-suspended managers/teachers correctly lost Co-host; my first pass moved them out of the gate entirely). Fixed by reverting to a single consolidated `getEffectiveHostingCapability` call with the role-based grant as the fallback. Second: `LocalRolePills` was reading `localParticipant.metadata` via `useLocalParticipant`, which doesn't subscribe to `ParticipantMetadataChanged` — switched to `useParticipantInfo` which does. Both issues real, both contained, both fixed pre-commit. Pattern confirmed worth its overhead.

**Jesse's verification question: "you're not just doing this by name, right? Maria, for example: is she actually identified in the program editor?"** Important sanity check. Confirmed by reading `app/tools/programs/[programSlug]/edit/page.tsx` + `components/registrar/ProgramEditor.tsx`: the editor loads `programTeachers` from the DB; `selectedTeachers` state is initialized from those rows; `addTeacher`/`removeTeacher` mutate it from the in-page member search; PUT endpoint runs `deleteMany` + `createMany` on save. The migration created real, editable records — not hardcoded by name. Worth the explicit answer because data migrations can hide as scaffolding.

### This connects to (interconnection record)

- **Three-tier permission model (session 121).** Unchanged in *intent* but widened in *scope*. Session 121 split Session Host / Co-host / Participant with HOST_MANAGER and ProgramTeacher as the auto-Co-host paths. This session adds active host-team HubMember as a fourth auto-Co-host path. The server-side resolution helper `lib/livekitAuth.ts::resolveSessionRole` remains the single source of truth; every server route that gates a session-room action consults it.

- **HubMember authority model (session 92).** This session leveraged it. The coordinator's ability to pause a member or revoke `hostingCapability` via the hub admin UI now correctly revokes Co-host even for HOST_MANAGER and ProgramTeacher (after the reviewer-caught hub-gate consolidation). The authority pattern was already built; this session put it to wider use.

- **Krisp Enhanced Noise Cancellation (session 122).** Same wiring (`useKrispNoiseFilter` + ref-guarded enable) but now observable. Diagnostic logs and attach verification mean the next test session will tell us definitively whether Krisp is doing its job in production, vs. the previous silent-failure mode.

- **ProgramTeacher (session 79).** The mechanism was built but only ever applied to three programs. This session brings the operational programs to parity. The audit script (`scripts/audit-program-teachers.mjs`) is now a reusable check for future drift.

- **Standing Host Assignments + Schedule tool.** Unchanged, but the Silent Meditation Hub backlog item identifies this as the infrastructure that the peer-led-sit hub would reuse.

- **`/admin/manual/host-session-room`.** Last updated at v5 in session 122. The tier-naming and pill model changed enough in this session that a v6 is queued — explains the Co-host net widening, the three-pill model, and the audio-profile/Bell-mode interaction for non-teacher hosts. Not done this session; called out in UP_NEXT.

### Up Next

Verification on the deployed site is the immediate next step — five concrete checks queued in UP_NEXT. After that, the per-program `teacherLabel` dropdown (small, fast follow-up) and the Silent Meditation Hub (larger structural piece) are the two queued LiveKit-side items. The audio-profile generalization question is parked as an open design decision inside the Silent Meditation Hub backlog notes. The Course offering drip-release work (carried from session 123) remains the next non-LiveKit slice when Jesse is ready.

---

## 2026-05-25 (session 123) — Course offering model: full build, dana parity, tabbed editor

Six commits on `main`. The largest single-session feature build in this codebase, end-to-end. Started as the "next priority" carried forward from sessions 118–122 (the architectural decision in 118; four unrelated A/V detours after). Took ~5 hours of focused work — schema → reads → landing → editor → dana → parity rebuild — with reviewer sub-agents on every commit and the user (Jesse) catching real architectural gaps mid-flight that turned a 4-slice plan into 5.

### Six commits, in order

1. **`0c996fd` — Magic-link → sign-in-code doc sweep.** Stale prose audit triggered by Jesse asking "is the whole system updated?" 8 user-facing docs corrected (CLAUDE.md, FEATURES.md, the four RIM_*.md design docs, HOSTING_HUB_READINESS.md), one user-visible string fixed (`/account/dashboard-my-profile`), staff manual self-heals via new `update_manual_host_hub_team_management_v2` migration that re-runs the existing update function with the corrected body. Email function inventory in FEATURES.md rebalanced (8 managed, 1 must-stay; `sendMagicLinkEmail` removed from the "cannot be managed" table because `sendSignInCodeEmail` is in fact managed via Email Template Manager).

2. **`927a804` — Schema slice (orthogonal flags + landing fields).** Seven new `Course` fields per `RIM_Offering_Model.md`: `allowSelfEnroll`, `selfEnrollDanaRequired`, `accessRestrictionMessage`, `heroImage`, `pullQuote`, `pullQuoteSource`, `danaText`. Idempotent backfill migration `add_course_offering_flags` maps existing `accessLevel` enum values to the new flags (`ALL_MEMBERS` → allowSelfEnroll=true; `REGISTRATION_REQUIRED` → false; `ROLE_REQUIRED` → true). `accessLevel` enum stays in the schema; reads migrate to flags first, then enum drops in a future pass. New backlog item `2026-05-25-001` filed for explicit noindex headers on `/lessons/*` and the enrolled-state of `/course/[slug]`. Plus the inverse helper `accessLevelFromFlags` in `lib/courseAccess.ts` so the legacy enum column stays in sync during transition.

3. **`6951694` — Access helper + read migration + landing page.** New `lib/courseAccess.ts` as the single source of truth: `getCourseAccessState()` returns a discriminated union over six states (anonymous, enrolled, can_self_enroll_free, can_self_enroll_dana, role_gated, bundled_only). All read sites migrated off `accessLevel`: `lib/enrollment.ts`, `app/api/courses/*`, `app/api/admin/courses`, `app/api/lessons/[slug]`, `app/courses`, `app/course/[slug]`, `app/lessons/[slug]`, `app/teachers/[slug]`, `app/tools/learning`, `components/CourseBrowse`, `components/CourseAccessSection`. The course detail page rewritten from auth-gated one-line wall to a public landing page that branches into `renderLandingView` (six states) or `renderEnrolledView` (existing TOC). Mirrors `/programs/[slug]` shape — `crs-` hero + `pg-` patterns for pull quote / details / facilitators. Anonymous visitors see the full landing with a "Sign in to enroll →" CTA pointing to `/login?callbackUrl=…`. Lesson preview shows titles only (Substack/Coursera pattern). `EnrollButton` gained `router.refresh()` after enroll/unenroll so the landing→TOC transition is automatic.

4. **`f4d8534` — CourseEditor first surfacing.** Initial pass at exposing the new flags in the editor. Replaced the legacy "Who can access this series?" radio group with three independent checkboxes (allowSelfEnroll → optionally dana-required, role-gated → role picker). Added `accessRestrictionMessage` textarea + landing-page content section (heroImage URL, pullQuote, pullQuoteSource, danaText). The legacy `accessLevel` enum column now derives from the new flags on save (lossy but kept coherent until the enum drops). Admin list at `/tools/learning` migrated to badges driven by the new flags. **This was the slice that turned out to be too simple** — see slice 5.

5. **`40b603b` — Dana self-enroll flow.** End-to-end Stripe-mediated enrollment for courses with `selfEnrollDanaRequired=true`. New `/api/courses/[slug]/checkout` endpoint creates a Stripe Checkout session (auth required, validates flags + role gate + not-already-enrolled). Webhook split: `handleCourseDanaCompleted` wraps the SeriesEnrollment + Donation writes in `db.$transaction` for atomicity; receipt email fires via `after()` from `next/server` (Next 16's fire-and-forget API) and is gated on whether the donation row was newly created so duplicate webhook deliveries don't double-send. New `Donation.courseId` / `courseTitle` columns. New email template `course-dana-receipt` with full seed entry in `migrate.mjs` per the Email Template Gate (defensive findUnique → create so admin edits at `/admin/emails` are preserved). New `EnrollDanaButton` component with hardcoded chip set.

6. **`363701a` — Dana parity + tabbed editor + categories (the big one).** This was Jesse's catch: "this is still really incomplete — shouldn't it be set up very similar to [the program editor]?" Reading the Program editor showed a real four-mode dana setup (`none`/`voluntary`/`base_plus_dana`/`fixed` with separate amount fields and a rich-text dana message) that my slice 4 had stripped down to a boolean + hardcoded chips. Plus Jesse flagged categories ("we'd need categories for this too?") and asked about the schedule analog (drip release).
    - **Schema**: five new `Course` fields paralleling Program — `danaMode`, `suggestedDana`, `danaBaseAmount`, `danaFixedAmount`, `danaMessage`. Backfill maps `selfEnrollDanaRequired=true` → `danaMode="voluntary"`. The boolean stays as a derived mirror.
    - **CourseEditor**: full rewrite from 750-line scrolling form to 1,400-line tabbed structure mirroring ProgramEditor's 7-tab pattern. Eight tabs total: **Content / Lessons / Landing / Categories / Access / Schedule / Dana / Visibility**. The Lessons tab in create mode shows a "save first" message instead of an empty list. Same `pe-` chrome (tab strip, card, form, field, checkbox) as ProgramEditor.
    - **Categories**: full CRUD endpoint at `/api/courses/categories` (public GET keeps the existing visible-only filter; new GET `?all=true` for admin lists; POST/PATCH/DELETE auth-gated). Categories tab in editor: dropdown picker + inline "Add a new category" form + list of existing categories with course-count badges and disabled-when-non-empty delete buttons.
    - **Schedule placeholder tab**: explains drip release was removed in session 100, lists the design questions the real implementation will need to answer (relative vs absolute release model, locked-lesson UX, email cadence, bundled-with-program behavior). Reserves the tab position so the next slice slots in naturally.
    - **Dana tab**: four-mode picker with conditional amount fields + rich-text `RimTiptapEditor` for `danaMessage`. Exactly mirrors Program's Dana tab in `ProgramEditor.tsx:1520`.
    - **EnrollDanaButton**: now mode-aware. Fixed mode → single "Enroll for $X →" button. Voluntary/base_plus_dana → expand-to-picker with chips driven by `suggestedDana` and `danaBaseAmount`. Validation server-side: voluntary ≥ $1; base_plus_dana ≥ base; fixed exactly = fixed.
    - **The dana mirror story stays clean**: editor writes `danaMode` directly + the derived `selfEnrollDanaRequired` mirror; PATCH endpoint derives one from the other if a legacy client sends only the boolean. Reviewer caught a rules-of-hooks violation pre-commit (hoisted hooks above conditional return); also caught the PATCH drift case and a stale schema comment — all fixed.

### Architectural calls made this session

**Public/private split on the course detail page.** `/course/[slug]` becomes public (a marketing landing for non-enrolled visitors); `/lessons/[slug]` stays auth-gated. Lesson titles visible on the public landing (Substack/Coursera pattern); lesson content never served to crawlers. The auth() redirect in `/lessons/[slug]` is the structural protection — Googlebot can't get past it to index content. Noindex headers as belt-and-suspenders backlogged separately. Mirrors `/programs/[slug]` (public) vs `/session/[slug]` (gated).

**Six visitor states, one landing page.** Anonymous, enrolled, can_self_enroll_free, can_self_enroll_dana, role_gated, bundled_only. Each gets a different CTA but the same landing shape. The role_gated and bundled_only states show `accessRestrictionMessage` (if authored) or a derived default — never a 404, never a wall. This is the "designed for overwhelmed users" principle expressed in code: every restricted state shows the full landing + a friendly contextual message.

**Editor preset vs raw flags decision (open question #4 from the offering doc).** Raw flags chosen. Three independent checkboxes (members-can-self-enroll → optionally dana-required, role-gated → role picker). Hints under each control explain the resulting behavior. Presets reduce error but hide expressiveness; the doc was undecided. Going with raw flags during transition; can layer presets on top later if it turns out to be confusing.

**Drip release deliberately deferred.** Session 100's removal was acknowledged honestly via the Schedule placeholder tab — better than pretending the feature doesn't exist. Coming back as its own focused slice with its own design pass (release model, locked-lesson UX, email cadence, bundled-with-program behavior all need decisions).

### Collaboration moments worth preserving

- **Jesse caught my under-scoping mid-build.** Twice. After slice 4 he asked "this is still really incomplete, right? Shouldn't it be set up very similar to [the program editor]?" — leading to the slice 5 dana parity build. Then he flagged categories and the schedule analog, both of which I'd missed. The codebase is large and the design constraint ("Courses and Programs should feel like peers") is the kind of thing that needs to be enforced at every detail level. Memory entry candidate: when mirroring an existing surface, READ THE WHOLE THING BEFORE BUILDING — not just the relevant fields.

- **The doc sweep matters.** Magic-link references in 8 docs would have confused every future session reader. Cheaper to fix when noticed than to live with persistent drift. The closing-ritual gate (this file) is the right place to enforce that — not just code changes but documentation freshness too.

- **Reviewer sub-agent caught real bugs.** Six reviewer runs across the session. Caught: `.jpeg` vs `.jpg` fallback (slice 2), webhook duplicate-receipt risk + two-write atomicity gap + raw-hex CSS (slice 4), rules-of-hooks violation + PATCH drift + stale comment (slice 5). The pattern is solidly worth its overhead — promoted from probation to default-on for non-trivial slices.

### This connects to (interconnection record)

- **Programs ↔ Courses parity.** `RIM_Offering_Model.md` (the architectural reference) is now actually expressed in code. Course is structurally a peer of Program, with the same `pe-` editor chrome, the same dana model, the same landing-page shape, the same content vocabulary (`heroImage`, `pullQuote`, `pullQuoteSource`, `danaText`). The structural asymmetry (Programs are time-bound + register; Courses are persistent + enroll) is preserved in the data shape; the visual/editorial peer-ness is enforced in the rendered surfaces.

- **The Course Hub team workspace.** Unchanged in this session. But the Course Manager tool (`/tools/learning`) — which the Course Hub provides as its linked tool — got the full Program-Manager-style upgrade. The hub:tool boundary stayed clean: team coordination happens in the hub, course management happens in the tool.

- **Stripe Checkout + Donation ledger.** Course dana payments now flow through the same Stripe Checkout pattern programs use. Donation rows can be filtered by `courseId` or `programId`; both can be null for non-program/non-course offerings. Webhook routing keys on `metadata.source`. The QuickBooks reconciliation logic that reads the Donation table sees both paths uniformly.

- **Onboarding + role-based enrollment.** The existing `enrollMemberInOnboardingSeries` and `enrollMemberInRoleSeries` helpers in `lib/enrollment.ts` continue working unchanged. The role-series query migrated to read `requiredRoles.has(role)` instead of `accessLevel: "ROLE_REQUIRED"` (same effect, no enum dependency).

- **Email Template Manager.** New `course-dana-receipt` template registered; appears in `/admin/emails` under the "Courses" group with full helpText. Doubles as receipt + welcome — by the time it arrives the member is already enrolled (atomic transaction in the webhook).

### Up Next

Drip release — the Schedule tab placeholder exists; the real implementation needs a focused design pass. Plus the manual chapter `/admin/manual/course-hub` still describes the legacy 3-tier model and needs updating to match the new orthogonal flags + dana modes + categories. Both queued in `UP_NEXT.md`.

---

## 2026-05-20 (session 122) — LiveKit A/V tuning: Krisp NC, per-profile video bitrate, Bell mode

One commit on `main`. Driven by real test feedback Jesse reported at the top of the session: choppiness/freezing, fluctuating video quality, and the most diagnostic complaint — hearing his own voice come back through another participant's external speaker. He asked whether we'd made a mistake choosing LiveKit and asked me to look at Daily.co as an alternative.

### The meta question — did we choose wrong?

Spent the first half of the session honestly assessing whether to switch platforms or tune what we have. Findings:

- **We're not self-hosting.** LiveKit Cloud. Build tier ($0/mo + metered usage). The Stack Reference said "Ship tier ($50/month)" — stale. Corrected as part of closing.
- **Krisp Enhanced Noise Cancellation was installed but never enabled.** `@livekit/track-processors@0.7.2` is in `package.json`; somebody (probably me in a past session) intended to wire it up and never did. That accounts for the echo complaint directly — WebRTC's built-in NS is genuinely weaker than Krisp for the external-speaker echo case.
- **The flat 2.5 Mbps publish ceiling was over-shooting Zoom**, not under-shooting it. Zoom Group HD runs ~2 Mbps; Zoom standard 720p runs ~1 Mbps. We were trying to push more than residential WiFi could sustain — which is precisely what produces the layer-switch freezes ("choppiness/freezing") people reported. Counter-intuitive but real.
- **Daily.co at our scale would cost ~$110/mo vs $0–50 on LiveKit.** Plus the rewrite cost of unwinding the custom-room architecture (three-tier permissions, magic-code auth, Greenroom/Recovery, host badges, HostAssignment integration, persistent chat, host early-open) — months of work, during which the broken-feeling current room remains live.

Recommendation to Jesse: don't switch. Enable the Krisp NC we already paid the package install for, tune the bitrates to where residential WiFi can actually sustain them, add a "Headphones recommended" line in Greenroom. He agreed.

### The work — five changes

1. **Krisp NC default-on for everyone.** Installed `@livekit/krisp-noise-filter@^0.3.4` (had to pick 0.3.x because `@livekit/components-react@2.9.20` peerOptional requires `^0.2.12 || ^0.3.0`; 0.4.x would have conflicted). `RIMConference` now uses `useKrispNoiseFilter()` from `@livekit/components-react/krisp`; a ref-guarded effect calls `setNoiseFilterEnabled(true)` once on mount. State is component-local — every new join begins NC-on.

2. **Bell mode — Co-host toggle.** Mid-session refinement from Jesse: instead of "teacher always has NC off to preserve bells" (which would leave fridge hum and traffic in his audio for the whole session), give the teacher a one-tap toggle so NC is on during teaching and off only for the bell moment. Implemented as a new button in `RIMControlBar` between Settings and the red End. Bell icon, two-state label ("Bell mode" → tap → "Clean voice"), amber tint via `--color-alert` when active. Visible only when `isCoHost && noiseFilterAvailable`. Reset to NC-on at every join — deliberate per-bell action, not a setting that persists.

3. **Per-profile video bitrate ceilings.** Replaced the flat `maxBitrate: 2_500_000` with profile-driven values in `buildRoomOptions`: teacher 2.0 / speaker 1.5 / listener 1.0 Mbps. Three explicit simulcast layers `[h180, h360, h720]` (was two — `[h180, h360]`).

4. **"Headphones recommended" line in Greenroom.** Sangha-tone framing as care for others: "Headphones recommended — they keep your audio from echoing back to others." Placed near the device-permission disclosure, not stacked on top.

5. **Manual chapter v5 (`host-session-room`)** — new Bell mode section in the manual, plus a "Headphones are recommended" note in Getting into the room. Both written at 8th-grade reading level matching the rest of the chapter. Migration flag `update_manual_host_session_room_v5` in `prisma/migrate.mjs`.

### Reviewer sub-agent — one real catch pre-commit

Default-on per the established memory. The reviewer flagged: on unsupported browsers (older Safari, some Firefox configs), the `useKrispNoiseFilter` hook silently no-ops and `isNoiseFilterEnabled` stays `false`. With my initial UI, that would have made the Bell mode button appear stuck in "Clean voice" amber state from the start — confusing because NC is off but not by user choice. Fixed by gating the button on `krisp.processor !== undefined` so it's hidden entirely when Krisp isn't actually loaded.

Other findings (useEffect dep churn, peer-dep verification, race with mic-not-yet-available, rapid-tap safety, aria-pressed polarity, h720 simulcast redundancy) were either safe-to-ship-as-is or non-issues. One real catch in a session where the surface area was small — pattern continues to be load-bearing.

### What this connects to

- **Session 86 (LiveKit foundation).** The room continues to use LiveKit Cloud, no platform change.
- **Session 117 (Zoom-aligned redesign).** The control bar layout from 117 was the place to add Bell mode — between Settings and End, matching the existing button vocabulary (icon over label, currentColor tinting). The decision to keep H.264 (vs VP9 SVC I'd floated earlier) preserves the universal-hardware-encoding-on-laptops-and-phones property that 117 deliberately chose.
- **Session 119 (Greenroom + Recovery).** The headphones note lives in Greenroom only, not Recovery. Recovery is for users who've already denied permission and need to recover; a headphone nudge there is the wrong moment.
- **Session 121 (three-tier permissions).** Bell mode visibility is gated on the existing `isCoHost` tier from `SessionRoleContext`. No new permission concept introduced; just an action on an existing tier.

### What's deferred

- **Test Microphone / Test Speakers in Settings → Audio** — still on the session-117 deferred list. If echo persists after the Krisp NC + headphones changes, this is the next escape hatch (lets a participant self-diagnose pre-session).
- **Confirm Krisp NC usage rate in the LiveKit Cloud dashboard.** The exact per-minute pricing wasn't openly published; my estimate is $10–30/mo at RIM scale, but reality will show up on the first invoice. Worth checking after the next live session.
- **Memory file `webflow-cache-and-mcp-limits.md`-style note** for "@livekit/krisp-noise-filter requires the 0.3.x line because components-react@2.9.x peerOptional is constrained to ^0.2.12 || ^0.3.0." Save for later if it comes up again.

### What's next

- **Test on a live session.** Jesse will run the next scheduled session with these changes deployed. The three test signals he should look for:
  1. Does the external-speaker echo case disappear? (Krisp NC should close it.)
  2. Does the choppiness/freezing settle? (Per-profile bitrates should resolve it for participants on residential WiFi.)
  3. Does Bell mode work for him at a real bell moment? (Visual feedback on tap, full tone of the bell preserved while in the mode, return to clean voice on re-tap.)
- **Course offering model build remains the priority** for the next session unrelated to A/V testing. Unchanged from sessions 118–121 deferral. `RIM_Offering_Model.md` is the authoritative reference.

### Process notes

- **The reviewer-before-commit pattern continues to earn its keep.** One real catch on a single-feature session.
- **Merge-to-main-by-default held.** Branch created, work committed, push, FF main, delete branch (origin). The closing-ritual docs go in a separate commit on top.
- **Plan mode was not used this session** — the work was concrete enough from the Connections Map exchange and didn't need a plan-mode pass.

---

## 2026-05-24 (session 121) — Session room cleanup: three-tier permissions, tile hover-mute, no auto-hide, host early-open

Two commits on `main`. Five small issues Jesse named from a live test, plus one follow-on. The throughline: the previous session-room model had one overloaded `isHost` flag granted to a wide pool, and a fresh test session in the host hub exposed the result — multiple people clicked "Step in as Host" sequentially, each saw the End-for-All button, and only the latest stepper could actually use it. Buttons that don't work are the worst kind of UX for an overwhelmed user. This session was the cleanup.

### Five issues from the test

Jesse listed them; I produced a Connections Map per CLAUDE.md before any code. He answered four scoping questions, including the architectural one — "How does Zoom handle this?" — which redirected the work from a tactical fix into a real model rewrite.

**(1) Tile hover-mute.** The mute button for hosts only lived in the Participants panel — slow to reach during a session. Added a hover-revealed Mute button on any remote tile for Co-host-tier users. "Muted" pill replaces the button when the participant is already muted. Suppressed on the local tile and until LiveKit's `localParticipant.identity` is bound (the reviewer caught a one-frame window where a Co-host could otherwise self-mute via the server path).

**(2) Audio echo.** Diagnosed; nothing to change. `echoCancellation: true` is already on for every audio profile in `buildRoomOptions`. The "I heard my voice" complaint is almost always acoustic (a listener with mic open and speakers on). The Audio Playback prompt already shows "Headphones recommended" copy. Honest scope note for Jesse rather than speculative tuning.

**(3) Share Screen for host/teacher only.** Both UI and server. UI: button hidden in `RIMControlBar` when not Co-host. Server: `createRoomToken` now takes a permissions object; `canPublishSources` at token mint includes `SCREEN_SHARE` only for Session Host. A participant who hacks the UI still cannot publish a screen-share track because the LiveKit grant doesn't allow it.

**(4) End-for-All permissions.** Real mismatch in the previous model: the token route granted `isHost: true` to ADMIN + HOST_MANAGER + HostAssignment + ProgramTeacher (hub-gated); end-session route accepted ADMIN + HOST_MANAGER + HostAssignment; UI showed End-for-All to anyone whose token said `isHost: true`. The right answer wasn't to align the two checks — it was to split the concept.

**(5) Auto-hide chrome.** Test volunteer found the disappearing menu confusing. Removed entirely. The 3s idle JS timer + every `.vs-page--idle` CSS rule deleted. The bottom bar is shallow enough that always-visible costs no usable real estate.

### The architectural rewrite — three permission tiers

The whole shift is in one new module, `lib/livekitAuth.ts::resolveSessionRole`. It returns `{ isSessionHost, isCoHost, isHostTeam, isProgramTeacher }` from a single helper used by every server route that gates a session-room action.

- **Session Host** (singular) = HostAssignment for this exact session, OR ADMIN. Gates **End-for-All** and **Share Screen** at the token. Only person whose tile gets a "Host" badge.
- **Co-host** = ProgramTeacher OR HOST_MANAGER OR Session Host, gated by the host-team `HubMember` capability. Gates **mute others / Mute All / manage participants** at the token (`roomAdmin: true`). No End-for-All. Carries no badge.
- **Participant** = everyone else. `canPublishSources: [MICROPHONE, CAMERA]` only. No screen share, no mute-others, no end. The UI doesn't even draw the buttons.

`canPublish: true` is gone; replaced everywhere with `canPublishSources` so Participant tier physically cannot publish a screen-share track regardless of what their UI tries to do. `createRoomToken` signature changed from `(isHost: boolean)` to `(permissions: { roomAdmin, canShareScreen })`. Five routes updated to feed it: `token`, `step-in`, `guest-token`, `mute-participant`, `mute-all`, `end-session`. Step-in's new token explicitly sets both flags true (stepping in promotes you to Session Host for the session by upserting the HostAssignment). Guest tokens are explicit Participant grants.

Client surfaces consume `isSessionHost` and `isCoHost` as separate props through `page.tsx` → `VideoRoom` → `RIMConference`. A new `SessionRoleContext` (in `components/session/sessionRole.tsx`) distributes the tier + `programSlug` + `localIdentity` to descendants of LiveKit's GridLayout — the tile component can't otherwise read them because LiveKit re-mounts tile children and doesn't accept arbitrary props. `RIMControlBar` hides Share unless Co-host; `EndMenu` shows End-for-All only for Session Host; `ParticipantsPanel`'s `isHost` prop was renamed `isCoHost` for semantic clarity (the panel's Mute affordance is a Co-host action, not a Session-Host action).

### Reviewer sub-agent — two real catches pre-commit

Default-on per the established memory. The first review caught:
- **"Host" badge was being seeded for every Co-host** — would have put a Host pill on teachers and host managers, making the label confusing (it should mean "this is who runs the room"). Tightened to `isSessionHost` only.
- **`resolveSessionRole` was running the hub-authority DB query twice** for everyone, once for Co-host and once for host-team. Cheap to fix: Co-host implies host-team, so the second call only runs for plain HOST role.
- **The `localIdentity` race window** noted above.

The second review (on the follow-on early-open work) caught:
- A `[[], []]` early-return that TypeScript would have typed as `never[][]`, fragile against future use. Replaced with letting Prisma handle empty `in` arrays (which it does correctly — returns `[]`).
- **Standing assignments silently excluded**: the host-match filter required `sessionDate` to be set, but legacy `sessionDate: null` rows (standing assignments covering every occurrence) should also count. Loosened to include them.

Both reviews ran on the staged diff before any push. Pattern continues to earn its keep.

### Follow-on — host/teacher 10-minute early-open

Same session, separate commit, separate code-review pass. Jesse asked: "The assigned host and teacher should be able to log in 10 minutes before everyone else. On the dashboard, their link should look different than it normally would — instead of 'Live Now,' something relevant to what the host is doing."

Implemented on the member dashboard's Today card. The Session Host (HostAssignment for today's occurrence) and ProgramTeacher (and ADMIN as safety override) now see a distinct **"Open early as host"** row between `start - 22min` and `start - 12min`. Teal accent to distinguish from the green "Live Now". Button reads **"Enter as host"**. Clarifier line: `Live opens at 8:15 AM`. At `start - 12min` the row collapses into the normal "Live Now" state and the host's row looks identical to everyone else's from that moment forward (per Jesse's explicit answer to the second scoping question).

Detection is one batched lookup per surface: `db.hostAssignment.findMany` + `db.programTeacher.findMany` keyed on today's program-list, then matched per session in JS using `ctDateStr`. ADMIN bypass. No N+1.

`DashboardAutoRefresh` now accepts `earlyOpenEpochs` alongside `liveStartEpochs`; the soonest upcoming epoch from the union triggers the next `router.refresh()`. The chain handles both transitions: the row appears at exactly `start - 22min`, then collapses into Live Now at exactly `start - 12min`, then enters live state, all without a manual refresh.

**Deferred and called out for Jesse explicitly:** `/api/livekit/token` has no server-side time gate today. A regular member typing `/session/[slug]` directly could connect before the live window opens. Dashboard is the only thing hiding the link. Adding a token-route gate is a separate decision; left as a backlog item.

### What this connects to

- **Session 117** — the Zoom-aligned redesign was the foundation. This session refines the permission model that was implicit in that redesign. The control bar layout, custom chat, custom tile, view toggle, audio profile axis, device pickers — all unchanged.
- **Session 92 Phase 3** — Hub Membership as Authority. `getEffectiveHostingCapability` (which gates the Co-host tier against the host-team `HubMember` record) is unchanged. The new `resolveSessionRole` calls it; this preserves the coordinator's ability to pause a member's hosting capability without touching their global Role[].
- **Session 98** — Standing Host Assignments. The dashboard's host-match logic now honors `sessionDate: null` standing assignments. Caught by the reviewer; reasonable default since standing means "covers every occurrence."
- **Trash + GUIDING_TEACHER (session 113/115)** — orthogonal. The session-room tier model is independent of `canManageTrash` / `effectiveCoordinator`. GT does not automatically get Session-Host or Co-host on every session; it's a content-authority role, not a session-room role.
- **The committed architecture (session 120)** — Mac Safari permission friction is still a watch-and-listen item; today's work didn't touch the Greenroom or Recovery. Phone dial-in via SIP and a stronger Safari-Mac pre-warning remain the next-best mitigations if a member hits it.

### What's deferred

- **Stale-state propagation after Step-In.** Multiple steppers in one session leave earlier steppers with stale `isSessionHost: true` UI state. The server is now authoritative — clicking the stale button returns 403 silently — but the UI would benefit from broadcasting a "host changed" data-channel message and re-deriving `isSessionHost` on receipt. Backlog item. Not a real-world problem in production (one assigned host per session); shows up only in test scenarios.
- **`/api/livekit/token` server-side time gate.** Match the dashboard's early-open window at the API layer so direct-URL access is also gated. Backlog item.
- **`/session/[slug]` token-route metadata expansion.** If we add the stale-state broadcast, the token route could also publish `hostIdentity` to room metadata so clients derive `isSessionHost` from `localParticipant.identity === hostIdentity` rather than the original token grant. Coupled with the broadcast fix.

### What's next

- **Course offering model build remains the priority.** Unchanged from sessions 118/119/120 deferral. `RIM_Offering_Model.md` is the authoritative reference; build order suggestion in `UP_NEXT.md`.
- **Test the early-open window on the next live session.** Visual + timing check. If the badge color, button copy, or alignment needs adjustment on mobile, easy follow-up.

### Process notes

- **Reviewer-sub-agent-before-commit ran on both commits.** Two real catches on the first, two more on the second. The pattern continues to be load-bearing.
- **Merge-to-main-by-default held both commits.** No "want me to merge?" gates. Branch created, work committed, push, FF main, delete branch — same flow both times.
- **Plan mode not used this session.** Conversation-based scoping with the Connections Map was enough. Both commits had a clear shape from the outset; plan-mode formality would have been ceremony.

### Follow-on (same day) — Sign-in form submitting empty token (`1c3d019`)

Jesse reported users hitting `/login/error?error=Configuration` after typing the 6-digit code. NextAuth v5's email-provider callback throws an error named `Configuration` (not `Verification`) from exactly one place: when `?token=` is missing or empty on `/api/auth/callback/resend`. The generic catch-all copy on `/login/error` was masking the real failure.

Root cause was in `components/login/SignInCodeForm.tsx` (built session 119): the hidden token input was uncontrolled (`defaultValue=""` plus `hiddenRef.current.value = boxes.join("")` after each state update). Ref-based DOM sync after every state update is fragile against React reconciliation, iOS autofill paths that bypass `onChange`, and any race where submission happens before the ref-write line lands. Whenever the DOM value drifted from React state, the form serialized `?token=` (empty) and NextAuth threw Configuration.

Fix: make the hidden field controlled — `value={boxes.join("")} readOnly`. DOM value re-derived from state on every render; cannot drift. Also disabled the submit button until all six boxes are filled, which closes the related early-submit hole where a user could click Sign In before finishing the code and hit the same error.

Future-useful diagnostic: `error=Configuration` on a NextAuth v5 email-flow specifically means missing/empty token at the callback — not a generic config issue. The two relevant verification-failure modes on the email provider are `Configuration` (token absent/empty) and `Verification` (token present but doesn't match DB or has expired). Knowing which is which collapses the diagnostic space immediately.

---

## 2026-05-23 (session 120) — Permission UX architectural decision + platform-aware Greenroom/Recovery

One commit (`3ffb294`) on `main`. Small code change, larger architectural moment.

### The architectural question (longer than the code)

Session opened on the queued PWA backlog item (`2026-05-21-001`) — installable RIM app intended to solve Safari's per-session camera/mic permission problem by giving installed PWAs persistent permission storage outside Safari's per-session sandbox. The conversation surfaced the real question hiding under it: **what's the right path for the session room, given who RIM's members are?**

Three paths were named explicitly and weighed against the demographic (sangha members, 65+, tech-phobic, learned helplessness with new digital tools):

- **PWA install** — iOS install ritual is genuinely hard (Share → scroll down in the share sheet → Add to Home Screen → Add), not findable for tech-phobic older users. Even with a platform-specific walkthrough page and annotated screenshots, the population we're designing for won't do it. **Rejected.**
- **Native iOS/Android app wrapping LiveKit** — would solve permissions permanently; matches the tap-an-icon pattern they already use. But months of work, ongoing maintenance, App Store gates, and the initial install (search the App Store, tap Install, wait for download) is itself a hurdle for the target demographic. **Rejected for the foreseeable future.**
- **Move sessions back to Zoom** — they already have the Zoom icon; familiar muscle memory. But the custom LiveKit room was a deliberate architectural decision (sessions 86, 117, 119) to *transcend* Zoom's limitations for this community — coordinator authority via HostAssignment, ProgramTeacher integration, hub-membership-as-authority, magic-code auth, deep integration with the rest of RIM. Path C would unwind a foundational decision. **Rejected.**

**Decision:** the browser-based custom LiveKit room is the committed architecture. The Mac Safari permission friction is a known cost we accept. We invest in *softening* the in-browser flow instead of replacing it. Session 119's Greenroom + Recovery already do most of that work; the marginal improvement in this session is making the instructions device-aware.

### What shipped

`lib/detectPlatform.ts` — small client-only helper returning `{ browser, os }` plus `defaultsToPerSessionPermission(platform)`. UA-based detection. Handles iPadOS-as-Macintosh via `"ontouchend" in document`. Handles iOS browser wrappers (`CriOS` / `FxiOS` / `EdgiOS`) by routing them to `ios` before the Macintosh+touch branch — otherwise iPhone Chrome would be misclassified as iPadOS.

`components/session/Greenroom.tsx` — the "Tired of seeing this? Set Safari to remember →" disclosure that previously showed only on Safari Mac now shows on Safari macOS *and* Safari iOS *and* Safari iPadOS (every browser that defaults to per-session permission). The step copy inside the disclosure matches the actual device: menu bar → "Settings for This Website…" on macOS, `AA` icon → "Website Settings" on iOS, `ᴬA` icon → "Website Settings" on iPadOS. On Chrome / Edge / Firefox the disclosure stays hidden — permission persists by default there, the affordance would be noise.

`components/session/Recovery.tsx` — the "Safari Mac primary + collapsed disclosure for other browsers" structure was replaced with a single primary view that matches the detected platform. Six branches: Safari macOS / iOS / iPadOS (per-device steps), Chrome+Edge desktop (camera or padlock icon at the left of the address bar), Chrome Android (padlock → Permissions), Firefox (shield / padlock icon), unrecognized (generic prose). No safety-hatch disclosure. The lead paragraph names the detected platform ("Here's how to fix it on Safari for Mac:") so the user gets a small confirmation that the screen knows where they are.

### Process notes

- **Reviewer sub-agent caught one real bug pre-commit.** iOS browser wrappers (Chrome / Firefox / Edge on iOS) have UAs that include `Macintosh` but don't always include `iPhone`/`iPad`. With touch enabled, they would have landed on the `ipados` branch — wrong for the iPhone case. Reviewer flagged it, fix added an early branch routing those wrappers to `ios`. Default-on reviewer-before-non-trivial-commit continues to earn its keep.
- **The PWA backlog item is now `status: rejected`** in `data/backlog.json` with a note explaining the architectural reasoning. Keeping the entry rather than deleting it preserves the decision history — a future session that re-asks "should we build a PWA?" can read the rejection and understand why before relitigating.

### What this connects to

- **Session 119's Greenroom + Recovery** — same components, same phase machine in `VideoRoom`, same `<LiveKitRoom>` ancestor placement so click handlers retain `useLocalParticipant()`. Detection runs in a `useEffect` after mount (avoiding SSR/hydration mismatch); the rest of the permission-decision flow is unchanged.
- **Session 117's Zoom-aligned redesign** — the session room as built is the architecture we're now explicitly committing to. The Safari permission problem is the only persistent friction in that architecture; everything else is operating as designed.
- **The PWA / native app paths** — both formally rejected in this session. Recorded here, in the backlog item update, and (implicitly) in the absence of any future scaffolding for those paths.
- **Magic-code auth (session 119)** — was scoped as the prerequisite for the PWA. With the PWA rejected, the magic-code auth becomes its own standalone improvement (multi-browser-friendly sign-in, simpler than magic-link for the demographic). Its value as a PWA prerequisite is moot; its standalone value stands.
- **Design philosophy.** *Restraint as a Practice* and *Designing for Real Users Under Pressure* both applied: the Recovery screen no longer shows instructions that don't apply to the user's device. One matched view, no disclosure, no clutter. Per CLAUDE.md's design orientation.

### What's next

- **Course offering model build is still the priority for the next session.** Unchanged from sessions 118/119 deferral. `RIM_Offering_Model.md` is the authoritative reference; build order suggestion in `UP_NEXT.md`.
- **The Mac Safari permission friction is now a watch-and-listen item.** If multiple members hit it in practice, we revisit. The phone dial-in (LiveKit SIP) and a stronger Safari-specific Greenroom pre-warning were named as next-best mitigations should that need arise. Not built yet — held for actual data.

---

## 2026-05-21 (session 119) — LiveKit Greenroom + magic-code auth (Safari per-session permission fix)

Two threads driven by a real testing incident: a tester clicked "Never for this Website" on the Safari camera/microphone prompt while testing the session room, silently breaking themselves with no recovery path. Diagnosis widened into two changes — one direct fix for the prompt UX, one architectural change that unblocks the future PWA direction.

### Thread 1 — Greenroom + Recovery for the LiveKit session room (`d2a0008`, fix `8577348`)

Built a pre-prompt screen ("Greenroom") that primes the user before the browser camera/microphone prompt fires, and a denial-recovery screen for the small number who still click Never. The Greenroom skips itself silently when permission state is `'granted'` (Chrome remembers Allow; Safari does too if the user has set persistent Allow via Settings for This Website). Architecturally, both screens are children of `<LiveKitRoom>` so the Continue click handler has `useLocalParticipant()` and can call `Promise.all([setMicrophoneEnabled(true), setCameraEnabled(true)])` synchronously — the iOS Safari user-gesture chain only survives if both calls fire inside one click handler.

The initial implementation included a "speculative auto-publish" path that used a localStorage `joined-before` flag to skip the Greenroom on repeat visits. Jesse tested it and discovered the bug it caused: on Safari (per-session default Allow), the Permissions API reports `'prompt'` on the return visit even though the user clicked Allow last time. The speculative path fired `setCameraEnabled` from a `useEffect` (no user gesture), Safari prompted again without the priming card visible, and the user got the exact bare-prompt experience the Greenroom was built to prevent. Fixed in `8577348` by removing the speculative branch entirely — auto-skip only when Permissions API confirms `'granted'`.

Pattern worth remembering: speculative permission attempts from non-gesture contexts are unsafe on Safari. Only auto-publish when the API confirms state is granted. The reviewer sub-agent flagged adjacent concerns during the first commit's review but I underweighted the warning — caught during user testing instead.

Recovery screen instructions are Safari Mac-specific in the primary block (the actual problem case for the demographic), with a collapsed "different browser" section for Safari iOS + a generic paragraph covering Chrome/Firefox/Edge. No platform-by-platform conditional rendering — fewer code paths, simpler to maintain. The Recovery button is a literal "Refresh page" because Safari's Permissions API does not reliably re-query state after a Settings change without a page reload.

Reviewer sub-agent surfaced four pre-commit items, all addressed in the same worktree before merging: `useCallback` for stable Greenroom callbacks, local CSS custom properties for the dark-surface palette (`--gr-bg`, `--gr-text`, etc.), token-based mobile breakpoint, and `overflow-y: auto` on the screen for short viewports with expanded instructions.

Notable scope-creep observation: the original prompt Jesse pasted into Claude (the spec from a prior session) had grown to a 7-step, 6-component plan with platform-specific instruction blocks for five browsers, listen-only fallback, no-device fallback, in-room follow-through toast with modal overlay, and a dual-mode Recovery component. Jesse pushed back on scope. The actual proportional spec was: Greenroom + Safari-focused Recovery, ~250 lines TSX + ~190 lines CSS. Everything else moved to deferred. The proportional version shipped cleanly; the kitchen-sink version would have introduced surface area without proportional user-value gain.

### Thread 2 — Magic link → 6-digit sign-in code (`45e7be4`, expiry tweak `a13b34f`)

Replaced magic-link authentication with magic-code (6-digit) authentication. Users now type a code from their email instead of clicking a link. Two reasons converged on this:

1. **Safari's per-session permission model AND magic links both have a "default browser" trap.** A user on Safari clicks a magic link in their Mail app → opens in Safari → authenticates Safari → but they wanted Chrome, and now their Chrome session is still signed out. Magic links lock the user to whichever browser the OS opens.
2. **PWAs can't reliably receive magic-link clicks on iOS.** The OS routes the click to Safari, not to the installed PWA; the PWA has its own cookie partition and stays signed out. Industry-standard solution (Slack, Apple, Mercury, Notion all do this): 6-digit codes the user types into whichever app/browser they're standing in.

Architecture: `auth.ts` overrides `generateVerificationToken` to return a 6-digit code via `crypto.randomInt(100000, 1000000)`. The same NextAuth Email-provider verification flow still runs (DB-backed `VerificationToken` table, `(identifier, token)` composite key, single-use). The "click the link" path is gone; the email shows only the code, large and centered. The `/login/check-email` page transitioned from a stateless "check your inbox" landing to a real form that GETs `/api/auth/callback/resend?token=CODE&email=EMAIL&callbackUrl=/account/dashboard` — same NextAuth callback that magic-link clicks used to hit.

`/login` server action calls `signIn("resend", { email, redirect: false })`, manually inspects the returned URL for error params, and routes the user to `/login/check-email?email=ENCODED` on success. The reviewer caught a BLOCKER here pre-merge: `signIn` with `redirect: false` does NOT throw on email-send failure — it returns an error-page URL string. My initial try/catch would have silently dropped failed sends. Fix detects error params in the returned URL and redirects to `/login?error=send-failed`.

Code expiry was 10 minutes in the first commit; bumped to 30 in `a13b34f` after Jesse pointed out users walking away from email and coming back were hitting expiry. Done as a defensive migration that only updates the existing template body if it still contains "expires in 10 minutes" — so admin edits via `/admin/emails` are preserved.

NextAuth's default behavior of allowing multiple unconsumed codes to coexist (each `signIn` call creates a fresh `VerificationToken` row, all valid until consumed or expired) was kept as-is — Jesse noted he uses this himself.

### What this work connects to

- **Session room (Greenroom):** sits inside `<LiveKitRoom>` inside `VideoRoom`. The phase switch (`greenroom | recovery | conference`) is the new internal state machine. Existing pieces — `RIMConference`, `RIMControlBar`, `ParticipantsPanel`, audio profile axis — all unchanged. Step-in host flow remounts VideoRoom which briefly re-enters Greenroom; with confirmed-granted permissions it auto-skips so the friction is a sub-second "Connecting…" silent card. Accepted for v1.
- **Auth flow (sign-in code):** every page that gated on `auth()` continues to work identically. Session callback, 90-day session, agreedToTerms gate, role enrichment — all untouched. Only the *acquisition* path changed; the *enforcement* path is the same. Existing magic-link templates were deleted by the migration; the `seed_magic_link_email_templates` migration entry is dead code on fresh installs (creates rows the next migration immediately deletes) — backlog cleanup item.
- **PWA work (deferred):** code-based auth was the prerequisite. With this shipped, the PWA spec can proceed without the iOS link-routing trap that would have blocked it. Greenroom auto-skip means PWA users get a silent prompt-free experience inside the app (installed PWAs get persistent permission storage that's distinct from Safari's per-session sandbox).
- **Email Template Gate:** both new templates (`sign-in-code-new-user`, `sign-in-code-returning`) seeded via defensive `findUnique → create` so any admin edits at `/admin/emails` are preserved on re-run. Both `enabled: true`. helpText references the `{{code}}` variable.
- **Reviewer sub-agent default-on pattern (per memory):** ran on both threads. Caught the speculative-auto-publish concern (underweighted by me, hit in user testing), the signIn-return-vs-throw BLOCKER (caught and fixed pre-merge), the stale `/login/error/page.tsx` copy and pre-Next-16 `Promise<searchParams>` shape, and the no-rate-limit-on-callback concern (deferred to backlog).

### What's next

- **Course offering model build (session 118 thread) is the priority for the next session.** All of session 118's architecture (orthogonal flags on Course, six-state landing page, `RIM_Offering_Model.md` as authoritative reference) is unchanged and unstarted. See `UP_NEXT.md`.
- **PWA spec.** Deferred for now. The full design space is in this session's transcript — install paths per platform, magic-code auth pairing (now shipped), PWA permission persistence on iOS Safari being the actual lever. Real spec when it becomes priority.
- **Rate-limit `/api/auth/callback/resend`.** Backlog. 6-digit codes × 30-min window × no IP rate limit = a determined attacker with a victim's email could brute-force. Low realistic risk at sangha scale.

---

## 2026-05-20 (session 118) — Library extraction shipped; Course offering model architecture decided

Two coordinated threads. The first shipped code; the second produced architecture for the next build pass.

### Thread 1 — Library extraction (shipped: `6c57073`, follow-up `822029f`)

The Member Home & Library — Offering-Type Cleanup plan from the prior session executed. Five things landed:

- **Courses removed from `/account/dashboard`.** The "Welcome to RIM" onboarding card and the "Where you're studying" enrollment block both gone. The dashboard now reads as sessions-and-community, not a mix of sessions and courses.
- **Onboarding welcome moved to `/account/courses` (Library).** `MyCourseLibrary` accepts a new `onboardingCourses` prop and renders the welcome variant at the top when present. The dashboard greeting gained a quiet "Visit your Library →" link alongside the existing community-schedule link.
- **Honest framing on registrations.** `/account/programs` heading and metadata renamed "My Programs" → "My Registrations" (sidebar already said this). The dashboard greeting's "X sessions today" count now reflects the member's own commitments (registered live + later + in-person), not every community virtual/hybrid program running today. The Today card itself continues to show all community programs — that's its job.
- **`Course.publishOnPublicCatalog` opt-in flag.** New Boolean field on Course, default false. Public `/courses` catalog filters `publishOnPublicCatalog: true` so onboarding, internal training, and role-assigned courses stay off the catalog unless explicitly published. Backfill migration in `prisma/migrate.mjs` flips `isActive=true AND isOnboarding=false` courses to true to preserve current visibility.
- **CSS cleanup (`822029f`).** Orphaned `db2-courses-line` rules removed after the dashboard course sections were extracted.

### Thread 2 — Course offering model architecture (no code; doc: `RIM_Offering_Model.md`)

Mid-session, Jesse pulled the conversation back to a broader question that had been entangled with the cleanup plan: how Programs and Courses relate as offering types, and how the access model should evolve to support the four scenarios he cares about — free-for-members, dana-required self-enroll, manual-grant-only, onboarding auto-enroll — plus hybrids with linked Programs.

The architectural decision: **replace `Course.accessLevel` (enum) with orthogonal flags** so a single Course can carry multiple acquisition paths simultaneously. This is the natural shape for a hybrid that's both bundled with a live Program AND available for standalone dana-enroll after the cohort wraps.

New flags on `Course`:
- `allowSelfEnroll: Boolean`
- `selfEnrollDanaRequired: Boolean`
- Existing: `requiredRoles`, `isOnboarding`, `publishOnPublicCatalog`

Plus new content fields needed for a real Course detail landing page:
- `Course.heroImage`, `Course.pullQuote`, `Course.pullQuoteSource`, `Course.danaText` — mirror Program parallels
- `Course.accessRestrictionMessage` — authored "friendly message" shown when the visitor can't self-enroll

UX decisions also locked in this session:
- Lesson titles **shown** to non-enrolled visitors (TOC is part of the offering, not a hidden gate).
- Hybrid dual-path shown as **primary live-cohort CTA + quiet secondary standalone line**. Resolved live cohort = next linked Program with open registration and a future start date. Standalone path always-active when `allowSelfEnroll=true`; live just disappears when no Program qualifies.
- Hero image and pull quote **added to Course** parallel to Program, so the visual vocabulary stays consistent.
- Restricted states (role-gated, manual-grant-only, bundled-only-with-no-open-cohort) **always show the full landing with a friendly contextual message** in the CTA slot. Never 404. Never a one-line wall.

Six states the `/course/[slug]` page must handle, captured in the doc's state matrix. Open questions parked for build (pending-dana behavior, `CourseAccess` vs `SeriesEnrollment` boundary, refund policy, editor presets vs raw flags, default fallback for `accessRestrictionMessage`).

### What this connects to

- **Existing Program system.** The Program detail page (`/programs/[slug]`) is the visual reference — the Course landing mirrors its shape (hero + pull quote + description + details block + CTA + facilitators) but with library framing instead of schedule framing. Dana flow on courses uses the same Stripe Checkout mechanism as programs.
- **`ProgramCourse` join.** Already exists, already wires hybrid bundling. The new model doesn't change the join — it just composes with the new `allowSelfEnroll` flag so a single Course can have both bundled and standalone paths.
- **`CourseAccess` table.** Already exists for manual grants. The boundary between `CourseAccess` and `SeriesEnrollment` is one of the open questions to resolve at build time.
- **`MyCourseLibrary` component.** Will need to surface the dana state (paid / pending) per-enrollment if the dana model differs from program dana.
- **`/admin/emails` template manager.** New templates needed at build: course-enrollment-confirmation, course-dana-receipt, course-access-granted (manual). Each must ship with a seed entry in `prisma/migrate.mjs` per the Email Template Gate.
- **`RIM_System_Architecture.md`** updated with a companion-docs pointer so `RIM_Offering_Model.md` is discoverable from the main architecture index.

### What comes next

Build of the orthogonal-flags schema + new Course content fields + `/course/[slug]` pre-enrollment landing state. Reference `RIM_Offering_Model.md` before any code. No timeline; the architecture is committed and durable, so the next session can pick it up cold.

### Collaboration notes

- **Closing-ritual item #8 paid off.** Jesse pushed back when I started talking about UX while the schema decision wasn't on disk — exactly the failure mode item #8 was added to prevent. Capturing the decision in `RIM_Offering_Model.md` mid-session (not waiting for the closing ritual) is the right move when architecture is being decided. Don't let decisions live only in a conversation that will be compacted.
- **Conflated-threads risk.** Earlier in the session I treated "the cleanup plan" and "the broader offering-type discussion" as one thread, when they were actually two. Jesse named this clearly ("I thought we were still discussing this"). The cleanup was already approved and just needed executing; the broader question was a separate architectural conversation. Separating those next time saves a confused back-and-forth.

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
