# RIM Public Pages — Design System & Decisions

The implementation reference for RIM's **public-facing pages** (the rebuild that began session 148, 2026-06-13). `RIM_Web_Design_Philosophy.md` holds the *intent* (clear seeing, restraint, warmth); this holds the *concrete system* — the palette, the surface language, and the decisions made (including the ones tried and reversed, so they aren't re-proposed).

**Read this before any public-page UI/CSS work** — program detail, course landing, this-week, teachers, content pages, nav, footer. It's an **early, evolving** doc; the public rebuild is in progress.

Reference Jesse points to: the **Esther Perel** site — taken *in spirit* (warm palette, card language, calm), **not literally** (her floating nav does not fit RIM — see the tombstone).

---

## The neutral foundation — Pampas ground, white surfaces

A named, restrained neutral scale in `:root`:

| Token | Hex | Name | Role |
|---|---|---|---|
| `--rim-surface` | `#FFFFFF` | White | **Content surface.** Cards, forms, writing surfaces, and the global navigation. |
| `--rim-bg` | `#F5F3F0` | Pampas | **The page ground.** Body background and default sections. |
| `--rim-bg-accent` | `#E9E6E2` | Deeper Pampas | Secondary — gentle separation + depth for receding panels (for example, program Notes). |
| `--rim-bg-bright` | `#FAF9F7` | Light Pampas | A restrained inset or hover surface; it should never compete with a white content surface. |

**Why this is the foundation:** Pampas provides a warm, nearly-neutral page ground without asking the eye to interpret a color field. White remains reserved for the things a person reads, completes, or acts on. Mine Shaft (`#333333`, `--rim-text`) is the primary text color everywhere. The contrast quietly establishes hierarchy before typography or buttons do.

## The blue

`--rim-blue: #31576d` (was `#135274`) — the single main blue: hero backgrounds, footer, buttons, links, teal sections. A softer slate-blue than the old teal. The token flip carries ~all usages (~267); a few **hardcoded** teal stragglers remain in member/hub/admin internal UI (`#135274` + `rgba(19,82,116,a)` tints) — queued for a sweep (backlog `2026-06-13-001`).

---

## Surface language — cards lift, prose stays open, panels recede

- **Flowing prose stays open on the ground.** Long copy (a program description) is never boxed. Boxing it cramps the most contemplative thing on the page and dilutes what a box *means*.
- **Discrete modules lift as white cards.** Bounded, scannable content you act on — the program Details block, the pull-quote card. White (`#fff`) + `--card-shadow`.
- **Supplementary modules recede as panels.** `--rim-bg-accent` (Deeper Pampas), **no shadow** — the program Notes.

**The contrast *is* the design** — a lifted thing only reads as lifted because un-lifted things sit beside it. The shadow is a *signal* ("this is a discrete object"), never decoration.

### `--card-shadow` — the one card lift

```
--card-shadow: 0 1px 2px rgba(45,38,28,0.03), 0 4px 11px rgba(45,38,28,0.035);
```

One reusable, deliberately **faint** warm shadow. The white-on-warm contrast + rounded corners do most of the separating; the shadow only reinforces. Every white card uses this token (quote card + Details card). Dialed to "a whisper" (Jesse's calibration: subtler is righter).

> **Sole sanctioned exception** to the CSS "no box-shadows" rule. White cards on the warm public-page ground may use `--card-shadow`. Nothing else. (The former LiveKit control-bar popover exception disappeared when that room was retired in session 159.)

## Style guide — `/style-guide`

An unlinked, no-indexed visual calibration page. It is not public navigation or a second design project; it is the place to review the live palette, typography, cards, panels, buttons, fields, and semantic feedback states together before extending the system. Use it when a visual change affects more than one screen.

---

## Navigation — flush bar (NOT a floating pill)

A **flush, full-width white bar** (`.nav` `#fff`, sticky, `100px` inner); heroes start beneath it. Slimmed to three dropdown doors + Donate: **Programs ▾ · Get Involved ▾ · Members ▾ · Donate** (Courses + Teachers removed from the bar; "Member Area" → "Members"). Lives in `components/Nav.tsx` (global, all pages).

### TOMBSTONE — the floating nav pill (tried & reverted, session 148)

An Esther-Perel-style **floating cream/white rounded pill** nav was built, shipped, and **reverted**. Why it failed *for RIM specifically*: RIM's program heroes already have a featured floating object — **the quote card**. The pill became a *second* white rounded object stacked above the quote card on the same dark hero ("white slab / blue / title / blue / white slab") — the duplication was the busyness Jesse felt as "off." The Esther Perel float works because her hero has **no card under it**; the pill is the only object. **Do not re-propose the floating nav.** Flush chrome is invisible chrome, which is the point. (Commits `50c0dc4` → revert `723af6b`.)

---

## The program detail page (`/programs/[slug]`)

Session 162 refined this template around one use: help a visitor understand the offering, then see the relevant next step without turning the page into a dashboard. It also tightened the contract with Program Manager: every Program now requires a pull quote (client and API validation), and linked public teacher profiles can supply portrait cards.

Top to bottom:

1. **Blue hero** — `#31576d` over `programImage`, with a `::before` overlay. Contains: a category **eyebrow** (`.pg-hero__eyebrow` — quiet uppercase, white at 0.72, links to `/community-programs`) · title (`.pg-hero__title`, 46px serif, `text-wrap: balance`) · subtitle (`.pg-hero__tagline`, 20px/400, `text-wrap: balance`).
2. **Quote card** straddling the hero/ground seam — white, `--card-shadow`, `.pg-quote__text` 22px/400 serif; overlaps up `-84px` (≈ centered for a two-line quote; longer quotes grow downward keeping a constant in-hero overlap).
3. **Description prose** — open on the ground (no box).
4. **Notes**, when authored — a recede panel (`.pg-notes`, Deeper Pampas, no shadow). The heading belongs to the authored content; the template does not inject a redundant “Notes” label.
5. **Gathering details** white card (`.pg-details-section`, `--card-shadow`) — each fact is one aligned icon/content row. Schedule + time share a row; location + directions share a row; dana is one row. A ruled action zone follows the facts so the next step is related but not mistaken for another fact.
6. **One state-aware next step.** Actionable states (`.pg-detail-cta__link` — Register / Join the waitlist / go to My Home for Zoom) use the rim-blue pill. Informational states (`.pg-detail-cta__text` / `.pg-detail-cta__status` — registered, waitlisted, registration not open, arrive in person) stay quiet text. Logged-in and logged-out Zoom paths differ deliberately: members go to My Home; visitors sign in first. Button the actions; leave the messages calm.
7. **Facilitators**, when present — linked public teacher profiles render as a circular portrait (or initials) plus name and lead to `/teachers/[slug]`; legacy plain-text facilitator names remain simple text. Store/upload a normal portrait in the Member Registry and let CSS crop it with `border-radius: 50%` + `object-fit: cover`; do not manufacture circular image files.
8. Footer.

`text-wrap: balance` on title + subtitle is deliberate: every program has different-length copy, so the line shape must be **content-agnostic** (balanced lines for any title/tagline) rather than tuned for one example.

The Details card should not become a second hero. Its white surface gathers logistics; the quote and program meaning remain the page's emotional center. Do not add status badges, extra buttons, or a label before every value when the row content is already self-evident.

### TOMBSTONE — chapter eyebrows + closing band (tried & reverted, session 148)

Adding **uppercase chapter eyebrows** ("ABOUT THIS DROP-IN" / "DETAILS" / "FACILITATORS") on the ground plus a **full-bleed Pearl Bush closing-invitation band** before the footer was built and **reverted** ("didn't feel well designed aesthetically"). The lesson: **a sparse version of a rich pattern reads as cheap, not minimal.** The reference's eyebrows + color bands work because they sit inside a *rich composition* (illustrations, confident color, scale contrast); transplanted into a sparse reading column, a small gray uppercase label reads as a *form label* and a beige-on-beige centered-text band reads as *newsletter furniture*. If the page wants more rhythm later, it needs the **substance** (visual anchors, real composition), not just the scaffolding. **Do not re-add the eyebrows/band without the composition to justify them.** (Commit `77edca8` → revert `06a041b`.) The hero **category eyebrow** (`9193c93`) is separate and stays.

---

## Process — everything ships to `main`

**Push design work straight to `main`, including new compositional elements.** Jesse, session 170: *"Oh, please always go ahead and push to main."*

This **supersedes the session-148 proposal** that new compositional elements sit on a `claude/*` preview branch until he had looked. That distinction is retired. RIM's loop is push-to-see: Vercel deploys `main` in ~1–2 minutes and Jesse looks at the real site, not a preview URL. A branch held for review stalls the loop and hides the work behind a link he has to go find; a revert is one commit, so waiting costs more than a wrong pattern does.

Work on a `claude/*` branch for the type-check and reviewer gates if useful, then fast-forward `main` and delete the branch **in the same turn**. Never end a turn with finished, verified work parked on a branch.

**Shipping straight to production raises the bar on self-verification, it does not lower it.** Measure the rendered result before pushing — and if a deploy does not land, diagnose it before explaining it, and never report it as shipped. (Session 170 lost ~15 minutes to a stuck Vercel build; `npx next build` locally, a postcss parse, and a cache-busted request showing `x-vercel-cache: MISS` proved the code was fine, and an empty retrigger commit deployed in 40 seconds.)

---

## The `pp-` grammar — the static front-facing pages (session 169)

One shared surface language for the pages that are neither catalog nor program detail: **home, donate, diversity, volunteer (+ thanks), and the three Kalyana Mitta pages.**

Session 174 added two more: **`/what-we-practice`** (A Handful of Leaves — the page that answers what RIM is) and **`/your-first-visit`** (what walking in is actually like). Both are pure prose on the ground, per the sparse-≠-minimal tombstone — a reading page must not be dressed in card scaffolding it doesn't need.

**Why it exists.** These pages were still wearing Webflow-era class names — `.section-19`, `.main-container`, `.grid-halves-3`, `.diversity-content-box`, `.bg-accent-2`, `.milestone-circle`, `.w-richtext`, `.button-2` — and **none of them has a rule in `custom.css`**. Only `custom.css` is linked; `rim.webflow.css` and `webflow.css` sit unused in `public/css/`. The pages rendered as bare document flow. This shipped that way for months.

`pp-` deliberately extends the `pl-`/`pg-` language rather than starting a second system: same hero grammar, same card lift, same recede panel, same eyebrow treatment.

### The pieces

| Class | What it is |
|---|---|
| `.pp-hero` (+ `--flat`, `--video`, `--donate`) | Hero over photography, footage, or flat blue. Pass a photo with `--pp-hero-image`. |
| `.pp-hero__eyebrow / __title / __body / __actions / __link` | The hero tiers. |
| `.pp-section` (+ `--white`, `--accent`, `--tight`, `--last`, `--airy`, `--airiest`) | Page rhythm. |
| `.pp-intro` | Section opener: eyebrow, serif title, body. |
| `.pp-prose` (+ `--spine`) | Flowing copy at `--reading-width`, open on the ground, never boxed. `--spine` left-aligns it to the container text edge instead of centring — see below. |
| `.pp-cards` / `.pp-card` (+ `--row`) | Discrete modules that lift. Row cards match `.pl-card` exactly. |
| `.pp-panel` | Supplementary content that recedes. Deeper Pampas, never a shadow. |
| `.pp-notice` | The calm "you need an account" message. A message, not an alarm. |
| `.pp-form` | Forms sit on a white surface. 16px input floor (iOS zoom). |
| `.pp-quote` | Centred pull quote. |
| `.pp-details` | Native `<details>`/`<summary>` disclosure. |
| `.pp-give` / `.pp-statement` / `.pp-timeline` / `.pp-steps` | The donate page's three blocks. |
| `.pp-closing` | Section-ending aside; mirrors `.pl-membership`. |

### Rules learned the hard way

**Build from the rendering, not the text.** The first pass extracted copy from the archived Webflow HTML and invented the composition around it. Every page was wrong in ways reading the markup could never reveal. The fix was to open the live page and **measure it** — `getBoundingClientRect` at 1280 — then match the numbers. On donate that moved the hero from 380/616 to equal halves, the statement card from 820 to **585** with a **54px** heading, the note to **720 centred**, and the timeline card from 490 to **530**. Do this before rebuilding any remaining page.

**A section opener and a prose block must share a column.** `.pp-intro` is 900px and `.pp-prose` is 700px; centring both independently puts the heading ~100px left of its own body text. `.pp-intro ~ .pp-prose` now takes the opener's box and moves the reading measure onto the text.

**Split media stretches, it does not centre.** Against a tall copy column a centred image floats with dead space above and below.

### Contrast over photography — measured, not eyeballed

Scrims sized by eye failed WCAG AA on their own photographs. Measure with `sharp` against the actual image, sampling the band the copy occupies, and use a high percentile (p99) rather than the mean:

| Image | p99 luminance in the copy column | Consequence |
|---|---:|---|
| Community-Hands (volunteer/KM/diversity) | 0.457 | the shared photo scrim is tuned for this |
| Sky Heavenly (donate) | 0.459 | needed its flat scrim at **0.70**, not 0.50 |
| Bodhi poster (home) | **0.971** | backlit leaves are effectively white; needed its own `--video` scrim |

**Tier floors:** hero body **95%** white (88% cannot reach 4.5:1 over near-white footage at any scrim that leaves the image legible); eyebrow **85%** (70% measured 4.00 at 11px, under the 4.5 required).

### TOMBSTONE — the white hero "paper panel" (retired session 169)

The home hero held its copy inside a 95%-opaque white panel. Retired for the same reason as the floating nav pill: RIM heroes already carry a featured floating object on some pages (the program-detail quote card), and a second white rectangle on the same image reads as clutter. Copy now sits directly on the scrim, protected by the scrim alone. **Do not re-propose the paper panel.**

### Recorded departure — the home hero is dark by choice

The live site's home hero is **light**: centred navy serif on the bright footage. That is the legible answer to a near-white video. RIM Next ships a **dark, left-aligned** hero because Jesse compared both at a temporary `/hero-compare` route and preferred it. The scrim was strengthened to carry white type at AA. This is a deliberate departure from the live site, not an oversight.

### The eyebrow ban does not apply here

The `impeccable` skill's craft floor bans eyebrows outright ("a ban, not a default: no brief earns it back"). RIM's committed visual world uses them — the hero category eyebrow, `pl-hero__eyebrow`, `sg-eyebrow`, the live donate page's "THE PRACTICE OF FINANCIAL DANA". Craft-floor's own opening defers to the committed world. **Eyebrows stay.**

### Third-party embeds need a standing fallback

The donate page's entire purpose is three Givebutter custom elements behind one deferred script. Donation widgets are routinely blocked by ad blockers, and RIM is 100% donation-funded, so a silent failure costs real money. `.pp-give__assist` carries phone and email under the cards, plus a `noscript`. **Always visible, not revealed on failure** — hydration is not observable without JavaScript, so a guess either hides it when needed or cries wolf when not.


---

## The two listing pages — one system (session 170)

`/community-programs` and `/this-week` are one job done twice, and are now built from one grammar. Read this before touching either.

### One hero — `.pl-hero` is gone

Both pages use **`.pp-hero`**. `pp-hero` had originally been written as a *copy* of `pl-hero`, which is precisely why only one of the two ever received the session-169 contrast hardening: `/community-programs` was still shipping the pre-hardening 88% body tier and measured **4.29:1**. Folding them was the contrast fix, not a side effect of it. Pass the photograph via `--pp-hero-image` / `--pp-hero-position`.

### One card

| Class | Where | Shape |
|---|---|---|
| `.pl-card` | `/community-programs` | title + tagline left · schedule + format right (`.pl-card__when`) · arrow |
| `.pl-card--time` | `/this-week` | time leads · title + format · arrow |
| `.pl-card--date` | `/community-programs`, one-time upcoming programs (s172) | date leads ("Sep 10–13", year line only when not this year) · title + tagline · time + format right · arrow |

The time-led variant matches the **occurrence-first agenda grammar** the Scheduler settled on in sessions 167–168: a dated session leads with its time. The date-led variant (session 172) is its catalog counterpart: for a one-time event the **date** is the decision criterion. Datedness is **data shape** (`recurrenceFreq` null + `startDatetime`), never category kind — community groups carry one-time dates too. Concluded one-time programs auto-hide/auto-archive via `Program.hideWhenPast` (see `RIM_ProgramEditor.md`); a past-but-kept program renders the plain card — a stale date is never showcased. Each `.pl-cat` carries `id={category.slug}` (+ `scroll-margin-top: 124px` clearing the sticky nav) — the home page's doors deep-link to them.

**`/this-week` no longer borrows from the member area.** It had been built on `.lr-row` / `.lr-btn` — components shared with `HubScheduleClient` — and referenced `.pl-list`, a class with **zero rules** since the session-148 rename to `.pl-grid`. Its rows had spacing only because `.lr-row` carries a `margin-bottom`. That is the whole reason the two pages read as different sites.

### The spine — one left edge

Every block on a public listing page **left-aligns to `.rim-container`'s text edge and runs its full width**. Before session 170 one page had four different left edges: hero copy at 110, blocks centred inside the 1140 container at 190, and interior text at 214 / 222 / 238 depending on each panel's padding.

Two rules follow:

- **Content adapts to the hero, never the reverse.** Aligning the blocks left rather than widening the hero is what kept home, donate and the Kalyana Mitta heroes untouched.
- **Rows fill the container.** A 900px cap inside a 1140px container leaves every row 160px short of its own column. The `--pp-column` token that carried that cap was removed in the same session it was introduced.

### Cadence

**96 between chapters · 36 under a heading · 24 between cards** (72 / 28 / 20 at ≤430px).

The interval that matters is the *ratio*, not any single value. It was 60 / 18 / 14, where a heading sat barely further from its own cards than the cards sat from each other, so four groups read as one uniform field. When Jesse asked for 20–30px between items, the other two intervals had to grow with it or the flatness returns.

### Contrast — measure glyphs, not boxes

The session-169 rule stands, with one correction that changed a decision. Sampling an **element box** reported the hero eyebrow at 3.76:1 and nearly triggered a gradient change; the eyebrow *element* spans the full container while its text is ~176px wide. Re-measured on real glyph extents (`Range.getClientRects()`) it is **8.08:1**. Three darker candidate gradients were then tested and rejected — they over-darken the photograph to fix nothing.

**The committed `pp-hero` gradient plus its committed tiers (85% eyebrow / 95% body) already clear AA on both photographs.** Verified failures at the time of the fold: `/this-week` subtitle 2.80:1 and week nav 2.96:1 (its own `Bodhi-Leaves.jpg` copy column measures **p99 0.992**), `/community-programs` body 4.29:1.

**Non-text contrast counts.** `.pp-btn--onblue-ghost` uses a 75% white outline, not 60% — a control's boundary is WCAG 1.4.11 (3:1) and 60% measured 2.8:1.

### No global border-box — check every full-width control

`webflow.css` no longer loads, so there is no `* { box-sizing: border-box }`; `custom.css` resets only `input`/`textarea`/`select`. `.lr-btn` took `width: 100%` at ≤430px with 44px of horizontal padding and **overhung its card by exactly 44px on every phone**, clipping the primary action on 17 rows. Any control given a percentage width must declare `box-sizing` itself.

**The trap struck again at the layout level (session 172):** `.hub-ws-content` and `.tools-content` were `width: 100%` + horizontal padding — every hub destination and tool page rendered viewport-plus-padding wide and clipped at the window edge at half-screen widths (`body { overflow-x: clip }` cuts silently, no scrollbar). A deterministic sweep of all 98 backend `width: 100%` rules found 16 live instances of the class; all are border-box now (grouped rule at the end of `custom.css`). **Any new `width: 100%` + padding rule must declare `border-box` at birth.**

**Session 173 — where the trap actually bites, and where it doesn't.** The s172 sweep was scoped to backend classes, so it missed two live public instances: `.container-7-copy` (the wrapper on all three `/login` pages — 48px over, content shifted 24px right, the sign-in card off-centre, on every viewport under ~1148px, i.e. most laptops as well as every phone) and `.nav__mobile-link` (every row of the public mobile menu 423px wide in a 375px viewport, right padding + row border + hover background clipped — invisible to a page-level sweep because the menu is closed). `.rim-container` was safe **only by ancestry** (`.pl-page`/`.pp-page` each granted border-box by descendant selector); the property now lives on the container itself so a new public page that forgets the wrapper can't inherit an 80px overflow.

The correction worth keeping — **`width: 100%` + padding only overflows when nothing shrinks the element:**

- **Flex children are safe.** A flex item's `width: 100%` is a base size that `flex-shrink: 1` reduces to fit, so content-box costs it nothing. Measured across 10 flagged modals, dialogs, and rows (`.adm-modal`, `.hs-modal`, `.hub-mem-dialog__panel`, `.gf-dialog`, `.gf-row`, `.hs-rot__*`, …) — every one sat exactly at its container's width. A static pattern-match over `custom.css` flagged 18 candidates and **15 were false positives**; only measurement separated them.
- **Grid items and plain blocks are not.** `.zoom-launch__panel` is a grid item with an explicit `width: min(100%, 520px)`, so nothing shrinks it: 385px in a 375px viewport, overhanging both edges because the grid centres it. This is the shape to look for.
- **A long unbreakable token looks identical and needs a different fix.** An email address contains no space or hyphen, so it is one token: past ~34 characters at 375px it simply runs off the edge, and `box-sizing` does nothing because the constraint is the token, not the padding. Fixed with `overflow-wrap: anywhere` (not `break-word` — `anywhere` also lowers min-content so a flex parent can shrink). Live instances: the code-entry page printing the member's own address back to them (26px over for `maria.sprecher@rootedinmindfulness.org`, 392px for a 77-character address, and the value is user-supplied so there is no safe upper bound) and `.adm2-email-confirm__text`. The `.gf-dialog__*` rules already carried `anywhere`, which is why long filenames were clean.

**Method, for the next time this comes up.** Don't reason about the geometry — measure it. Render the page (or rebuild the candidate's real ancestor chain from the component source) at 375px in an iframe and flag every element whose `getBoundingClientRect().right` exceeds `documentElement.clientWidth`; then inject the candidate fix and re-measure. Test with realistic long content, not lorem — the email-token bugs are invisible with a short address, and awaiting `document.fonts.ready` before measuring avoids a false clean. This works for signed-in surfaces without a session, which is what made the s173 authenticated-area audit possible.

### Specificity — `pp-` is declared ~26,000 lines after `pl-`

A single-class `pl-` rule loses to a single-class `pp-` rule on source order. A `pl-` override of anything `pp-` sets needs a doubled selector (`.pp-notice.pl-catalog__notice`). This silently swallowed both a `max-width` and a `margin` in session 170.

### Badges must come from data

**`GOOD_FIRST_VISIT_SLUGS` was a hardcoded `Set` of two program slugs in the page file** — no column, no CMS, arbitrary by construction, shipped from a mockup. Removed session 170 at Jesse's instruction. Any future per-program badge comes from a `Program` field editable in Program Manager, or it does not ship. This is the same drift mechanism that made the home page's four category doors go stale.

### The reading column — `.pp-prose--spine` (session 174)

`.pp-prose` centres a `--reading-width` (700px) column, so on a page whose hero copy sits at 110 the prose lands at **290** and the closing actions return to 110: three left edges. `.pp-prose--spine` sets `margin-left: 0` and leaves the measure alone, giving one left edge for the whole page.

**It is opt-in, and must stay opt-in.** Centred standalone prose is the *shipped, approved* convention on the pages that were measured against the live site — `/donate` centres its statement at **348** against a hero at 110, and `/diversity` measures **290**. Changing `.pp-prose` itself would move both. Use `--spine` on pages long enough that the misalignment reads as drift; `/what-we-practice` is the first (110 across hero, prose, headings, and actions). The family is now deliberately inconsistent pending Jesse's call — backlog `2026-08-10-006`.

The s170 **"one left edge"** rule is scoped to the two *listing* pages, exactly as written. It is not a sitewide law, and this measurement is why.

### The spine, decided — `.pp-page--spine` (session 176, closes `2026-08-10-006`)

**Jesse's ruling: prose rides the container text edge on every long-form page except `/donate`.** The centred convention survives only there, because its statement and note were measured against the live site.

**The mechanism moved from the block to the page.** `.pp-prose--spine` alone was not enough: it left `.pp-intro` centred at **190** while its own prose sat at **110** — the same misalignment the spine exists to remove, one level up. `.pp-page--spine` on the page root now zeroes the left margin of both `.pp-intro` and `.pp-prose`, so an opener and its body cannot drift apart. `.pp-prose--spine` is kept (documented, and subsumed by the page class).

Adopted on `/what-we-practice`, `/your-first-visit`, and the three Kalyana Mitta pages. `/diversity` was already on 110 via the draft's `dv-layout` (1060 max-width inside a 1060 container). **Measured after deploy: 110 across hero, headings, and prose on all five.**

The geometry, so nobody re-derives it: `.rim-container` is 1140 with 40px padding, so at 1280 its text edge is **110** and its content box is **1060**. `.pp-intro` (900) centres to 190; `.pp-prose` (700) to 290; `.pp-intro ~ .pp-prose` (900, children capped 700) to 190. Zeroing the left margin puts all three on 110. `.pp-actions` is already there as a plain block.

### The two heading tiers are a system, not drift (session 176)

A measured audit flagged `.pp-intro__title` rendering at **38px** on home, volunteer, KM groups and donate but **28px** (`--h2`) on volunteer's second opener and the KM application. **This is not a defect and must not be "fixed".** It is a consistently applied two-tier system that had simply never been written down:

- **38px (`--text-h1`) = a chapter opener.** Home's four section titles, "Current volunteer needs".
- **28px (`.pp-intro__title--h2`) = a form or secondary lead**, always paired with `.pp-intro--center`. "Tell us about your interests", "Tell us about your idea".

Every `--h2` use sits on a centred intro leading a form. Flattening home's chapter openers to 28 to make the numbers match would destroy the s172 composition. Donate's `--display` h1 (67.5) and 54px statement title are likewise **measured, deliberate** variants, not drift.

What *were* real defects: two heading-level skips, both fixed in s176. The program page's `.pg-section-heading` pair was styled at the h2 tier but marked `h3` under the `h1` (zero visual change to fix), and KM guidelines had ten peer sections as `h3` with no `h2`.

### The threshold pages joined the system (session 176)

`/join`, the three `/login` pages, `/teachers`, `/teachers/[slug]` and `/courses` each carried a private vocabulary (`jn-`, `tpr-`, `cls-`, and on login the last Webflow-era markup on the public site). A measured audit put it plainly: **the site was authored at the centre and generic at the edges, and it changed identity at the exact moment a visitor commits.** All six now open on a `pp-hero` with the standard tiers, put reading copy in `.pp-prose` at 18px, forms on `.pp-form`, and cards on `.pp-card` (12px + `--card-shadow`, replacing 8px and 10px radii with hover-only shadows).

`/join` is the one worth remembering: its body copy — the most consequential reading RIM asks anyone to do — had been **15px grey**, and the 16×16 checkbox that gates the submit button was the smallest target on the site. Copy unchanged; only the surfaces carrying it.

The dead `jn-` page-shell rules are deliberately left in `custom.css` for one deploy so a revert is one commit. Prune with `scripts/css-prune.mjs` once settled.

### The public chrome got the member area's floor (session 176)

Session 172 gave every *authenticated* surface 44px targets and a 16px input floor. The public nav and footer never got that pass, so the pages a first-time visitor meets were the only ones below it. Now: nav links, dropdown toggles, DONATE and the hamburger at 44px; footer inputs at 16px (under it, **iOS zooms the page on focus** — and that newsletter form renders on every public page); footer contact and legal rows at 44px and **78% white** (was 50%, under 4.5:1 on the blue).

> **The specificity trap, from the other direction.** Appending `.nav__donate { display: inline-flex }` at the end of `custom.css` **overrode the `display: none` it carries under 768px**, un-hiding the desktop DONATE button on phones. The 97px button then pushed the hamburger to x=340, so a 44px control ended at 384 in a 375px viewport — 9px of the primary mobile nav control off-screen, on every public page. An appended single-class rule beats an earlier media-query rule of equal specificity. **Any appended `display` on a responsively-hidden class must live inside the breakpoint it belongs to.** Caught by measuring the deploy, not by reasoning about it.

### Inline prose links: 24×24, not 44×44 (session 176)

A link inside a sentence cannot take a 44px box without breaking the leading. Public prose links get vertical padding to clear **WCAG 2.5.8 (24×24)**, which is the correct target for an inline link; 2.5.5's 44×44 is for standalone controls. And every public `mailto:`/`tel:` link carries `overflow-wrap: anywhere` — an address is one unbreakable token, so past ~34 characters at 375px it runs off the edge and `box-sizing` does nothing (session 173's distinction). The KM guidelines coordinator address measured 333px wide, 2px past the viewport.

---

## Copy and voice — the public pages (session 174)

The public pages carry a **ratified copy standard**, not just a design system. The rules live in the **`/how-jesse-writes` skill** (`references/how-we-write.md` — read it fresh; it was amended six times in one day during its fast season). Invoke the skill for anything longer than a label. What follows is only what a RIM implementer needs at the door.

**The five that bite most often on the web:**

- **Never "free" as a price word.** Not "free," not "free of charge," not "no cost." The house wording is **freely offered** and **community-supported**. This is a ruling: *free* is a price word and dana is a gift economy, not a fee waived. Session 174 caught `/volunteerism/volunteer` still saying "Membership is free."
- **No em-dashes in prose**, no exclamation points in system text, no "Oops." Errors sound like a person: *"Something went wrong. Try again, or email us and we'll add you ourselves."*
- **Button labels are invitations, not commands** — "Come sit with us," "Plan your first visit." Never "Get Started!"
- **Never name the epoch.** No "turbulent times," no "today's fast-paced world," no "in a world where," anywhere on the site. Name the **particulars** instead — the home page's "full days that somehow do not nourish" is the model.
- **Never narrate the reader's inner life.** Point at things; let them do their own feeling.

**Three rules learned on the web surface specifically:**

- **One image per page.** The community introduction is rich with them (the pond and the mud, the sun and the frost, the house and its guests, the gardener and the rose, the medicine cabinet, the hall and the orchestra). A page takes **one**, chosen for the work it does — `/what-we-practice` takes the hall and the orchestra because that image answers the eclecticism suspicion. Stacking is banned; the rest stay in the introduction, where there is room to live inside them.
- **The repeating frame is the tell to watch when implementing a brief.** A sentence-frame clean once is a fingerprint thrice, and word-level tools pass it clean. Session 174: "freely offered and community-supported" was to appear in the home hero *and* open the Dana section, with "membership is freely offered" between them — three on one page. One was cut. Check across sections, not per sentence.
- **The web reader is not the introduction's reader.** The introduction meets someone who has already walked in and is examining their own mind under instruction, so it disarms **shame** first. A visitor carries no such weight, and reassurance aimed at the unafraid reads as condescension. Name that as a decision rather than applying the move by reflex.

**Run the script, then bring the flags.** `python scripts/style_check.py <draft.md> --community` in the skill directory. It finds candidates, never scores — sort every hit into fixed / defended out loud / overridden. The standing false positive is **first person inside depicted speech** (the Buddha's quoted words, the reader's own interior question); the script cannot see quotation context. And the script is not the real gate: session 174's architecture check found that a page **never turned outward**, which every sentence-level tool passed clean.

**Ratification is Jesse's read-aloud, and nothing else.** Not the brief, not the session log, not a positive reaction, not silence. Implemented copy ships and stays **provisional** until he has read it aloud and ruled. Give him the copy as one markdown document in visitor order with the flags first — clicking through eight pages is the wrong instrument for a read-aloud.

**What RIM is, in one line, because getting it wrong is the recurring failure:** the handful is an **ordered structure** — organized by function into seven gatherings — and it exists **as a response to** having every tradition available at once. It is not eclectic gathering and it is not picking and choosing. The authority is the community introduction (`A Handful of Leaves: An Introduction`), the document given to every new participant. See `/what-we-practice` and the session-174 log.

### Copy — the membership block speaks dana, not "free"

"Membership is free." framed RIM as a pay-for-service model that happens to cost nothing, which inverts the actual model. The block now reads from the language already on the home page and `/donate`: no fees or tuition, the center held by the people who practice here, each giving as they are able, **with "dana" named after the giving is described** (the `/how-jesse-writes` experience-before-the-name rule) and linked to `/donate#dana-at-rim`.

Two things worth carrying forward. The house style **script returned zero hits on the incumbent copy as well as the replacement** — it is not what justifies a rewrite; the architecture check is, and it should be stated in the open so it can be overruled. And the factual claim in that copy (online needs an account, in-person does not) was **verified in `app/programs/[slug]/page.tsx`'s CTA branches**, not taken from doc prose.

### Accessibility

- **Row links carry their own name.** 17 links called "Learn More" became per-row descriptive names (WCAG 2.4.4). The day is carried in a **`.rim-sr-only`** span, because a daily program's name otherwise repeats seven times in a links list. (`.rim-sr-only` is a third visually-hidden utility alongside `.th-sr-only` and `.gf-visually-hidden` — consolidation candidate.)
- **Program names are headings** on both pages (`h1` → `h2` day/category → `h3` program). `/this-week` had been rendering them as `<p>`.
- `aria-current` names the active week.

### TOMBSTONE — the orientation notice above the listings (session 170)

A `.pp-notice` panel was added above the program listings carrying the practical answer a visitor lacks (most offerings are drop-in; in-person needs nothing; Zoom needs a free account). It replaced a redundant "Come as you are." section. **Jesse asked for it removed the same session.** The `h2` de-duplication it achieved was kept — that heading had been sitting in the same type slot as the category headings and read as a category. **Do not re-add a standing explanatory panel above the listings.**

---

## The home page composition (session 172)

- **Splits alternate** — image right (What we do) / left (Community) / right (Dana). Both had carried `--flip`; every image on one side was the redundancy Jesse flagged.
- **The doors are dynamic** — the live `ProgramCategory` taxonomy (Program Manager's rows, sortOrder), each with a kind-derived public line + offerings count (`KIND_LINES` in `app/page.tsx`), deep-linking to the listing's category anchors. Empty categories get no door; the page is `force-dynamic`. `categoryDisplayName` (lib/programUtils.ts) is shared with the listing so the one editorial rename can't drift. **Badges/doors come from data** — the s170 rule, now honored.
- **The doors chapter uses the split grammar** — words left, doors right (Light-Pampas insets on the white section: white cards on white were invisible; an inset, not a lifted card, so no shadow).
- **Dana is the third split** — the held lotus ("Lotus flower in hand", Olga Nayda, Unsplash License; 2400w source + 1600w/62KB WebP). An offered flower is the dana gesture; the many-hands photo stays the volunteer/KM/diversity hero only.
- **Images:** splits serve 1600w WebP (buddga-lotus went 1.6MB → 74KB). **Sharpness ceiling:** Looking-Up-Pine-Trees is 534px and Community-Hands 900px — both serve full-bleed heroes and need higher-res re-downloads; no processing adds pixels.
- **Hero video prefers MP4** — flaky VP9 hardware decode produced intermittent "dancing blocks"; both transcodes verified clean frame-by-frame and byte-identical to the live Webflow copies. Baseline 720p-on-Retina softness remains until the original clip is rescued from Webflow's Assets panel.

## Known follow-ons (see `data/backlog.json`)

- **`2026-06-13-001`** — member/hub/admin internal UI still holds hardcoded old teal the token flip didn't reach; sweep.
- **`2026-06-13-002`** — home page alternating sections (`.rim-section--grey` uses `--rim-bg`) flatten on the warm ground; repoint to the Pearl Bush secondary for rhythm. *(Largely superseded: home is on `pp-` as of session 169.)*
- ~~**`2026-08-07-001`**~~ — **done session 172**: the doors are dynamic and anchored (see "The home page composition").
- **`2026-08-07-002`** — volunteer and the three Kalyana Mitta pages have never been measured against the live rendering, which is what caught every donate discrepancy.
- ~~**`2026-08-07-008`**~~ — **done session 172**: the date-led `.pl-card--date` + `hideWhenPast` auto-retire (see "One card").
- **`2026-08-07-009`** — the global nav's own touch targets are under 44px (Programs / Get Involved / Members at 38px, Donate at 36px, the footer phone link at 24px). Shared by every page.
- **`2026-08-07-010`** — three visually-hidden utilities now exist (`.rim-sr-only`, `.th-sr-only`, `.gf-visually-hidden`); consolidate onto one.
- **`2026-06-13-003`** — course landing (`/course/[slug]`) still on the old colon-heading language; bring into this system (but **not** the reverted eyebrows/band — match the *shipped* program-page language).

---

*Rooted in Mindfulness · public-page rebuild · begun session 148 (2026-06-13); the `pp-` grammar added session 169; the two listing pages unified onto one hero, one card and one spine session 170 (both 2026-08-07). Evolving — update as the system settles.*
