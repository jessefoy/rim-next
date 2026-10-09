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

Session 162 refined this template around one use: help a visitor understand the offering, then see the relevant next step without turning the page into a dashboard. It also tightened the contract with Program Manager: every Program required a pull quote (client and API validation; **relaxed 2026-10-02: the quote is optional, see "The integration pass"**), and linked public teacher profiles can supply portrait cards.

Top to bottom:

1. **Blue hero** — `#31576d` over `programImage`, with a `::before` overlay. Contains: a category **eyebrow** (`.pg-hero__eyebrow` — quiet uppercase, white at 0.72, links to `/community-programs`) · title (`.pg-hero__title`, 46px serif, `text-wrap: balance`) · subtitle (`.pg-hero__tagline`, 20px/400, `text-wrap: balance`).
2. **Quote card** (optional since 2026-10-02) straddling the hero/ground seam — white, `--card-shadow`, `.pg-quote__text` 22px/400 serif; overlaps up `-84px` (≈ centered for a two-line quote; longer quotes grow downward keeping a constant in-hero overlap).
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

Session 174 added two more: **`/what-we-practice`** (A Handful of Leaves — the page that answers what RIM is) and **`/your-first-visit`** (what walking in is actually like). *(2026-09-25: now `/our-roots` and `/new-to-rim`; the old URLs redirect.)* Both are pure prose on the ground, per the sparse-≠-minimal tombstone — a reading page must not be dressed in card scaffolding it doesn't need.

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

**It is opt-in, and must stay opt-in.** Centred standalone prose is the *shipped, approved* convention on the pages that were measured against the live site — `/donate` centres its statement at **348** against a hero at 110, and `/diversity` measures **290**. Changing `.pp-prose` itself would move both. Use `--spine` on pages long enough that the misalignment reads as drift; `/what-we-practice` was the first (110 across hero, prose, headings, and actions). **Superseded by the next section:** session 176 settled the family and moved the mechanism to a page-level class. `/donate` is still the one page that centres, for the reason given above.

The s170 **"one left edge"** rule is scoped to the two *listing* pages, exactly as written. It is not a sitewide law, and this measurement is why.

### The spine, decided — `.pp-page--spine` (session 176, closes `2026-08-10-006`)

> **Superseded for reading pages, 2026-09-26:** see "The reading column" below. The spine still governs home, KM groups and teacher profiles.

**Jesse's ruling: prose rides the container text edge on every long-form page except `/donate`.** The centred convention survives only there, because its statement and note were measured against the live site.

**The mechanism moved from the block to the page.** `.pp-prose--spine` alone was not enough: it left `.pp-intro` centred at **190** while its own prose sat at **110** — the same misalignment the spine exists to remove, one level up. `.pp-page--spine` on the page root now zeroes the left margin of both `.pp-intro` and `.pp-prose`, so an opener and its body cannot drift apart. `.pp-prose--spine` is kept (documented, and subsumed by the page class).

Adopted on `/what-we-practice`, `/your-first-visit` (now `/our-roots`, `/new-to-rim`), and the three Kalyana Mitta pages. `/diversity` was already on 110 via the draft's `dv-layout` (1060 max-width inside a 1060 container). **Measured after deploy: 110 across hero, headings, and prose on all five.**

The geometry, so nobody re-derives it: `.rim-container` is 1140 with 40px padding, so at 1280 its text edge is **110** and its content box is **1060**. `.pp-intro` (900) centres to 190; `.pp-prose` (700) to 290; `.pp-intro ~ .pp-prose` (900, children capped 700) to 190. Zeroing the left margin puts all three on 110. `.pp-actions` is already there as a plain block.

### The reading column — `.pp-page--column` (2026-09-26, supersedes the spine for reading pages)

**Jesse's screenshot of `/new-to-rim` at ~1320px showed the problem the spine created:** the 700px reading column sat on the container's left edge with a 360px empty band to its right, on every reading page ("not balanced"). Measured across 22 pages at 375–1440 before changing anything.

**Reading pages now sit in one centred column, hero copy included.** `.pp-page--column` (worn alongside `--spine`, whose margin rules keep every block on the column's edge) narrows `.rim-container` to `calc(var(--reading-width) + 80px)`, so the content box is exactly the reading measure and the page is symmetric (290/290 at 1280, 370/370 at 1440). **What is different from the pre-s176 centring:** that centred the prose alone, leaving the hero at 110 and the prose at 290 (three left edges). Here the hero copy moves into the same column, so the one-left-edge goal survives and the balance returns.

**The header is the program-detail header** (Jesse: the program detail page's header and content are "balanced and centered. This is good design"): eyebrow, title and line centred in the column; the program hero's tiers (13px eyebrow, 52px title, 20px line; 34/18 on phones); and its vertical scrim (`rim-blue` 84% → `rim-dark` 91%), which suits centred copy where the horizontal `pp-hero` gradient suits left-set copy. Content below keeps left-set text in the centred column, exactly as the program pages do.

**Where it applies:** `/new-to-rim`, `/care`, `/why-we-practice`, `/our-roots`, `/about`, `/outreach`, `/join`, `/community-care-agreements`, and the KM guidelines and application. **Where it does not:** home, `/donate`, the listings, KM groups and teacher profiles, whose splits and card grids genuinely fill the container. They keep `.pp-page--spine` (or their measured centring, on donate).

**Also from the balance pass (one block before the authenticated readability contract):**
- On full-container spine pages the closing panel fills its area (`max-width: none`); in a column it stacks (words, then the button).
- `.pp-btn` never wraps above 560px (`white-space: nowrap`); on phones a long label balances. Headings, hero lines and card titles `text-wrap: balance`; running text `text-wrap: pretty`.
- Consecutive `.pp-closing__body` paragraphs get 16px between them (they had none).
- `.pp-details__summary` is reading content: 18px, not 15px under 18px answers.
- Meta chips (format, Today, lesson counts) have a 13px floor; eyebrows stay 11px (uppercase and tracked, contrast measured at that size).
- Method: measure with an iframe harness (getBoundingClientRect + Range line counts) at 375/768/1280/1440, preview new CSS by injecting it into the live pages, then re-measure after deploy.

**Reading aids on the longest reading page (`/why-we-practice`, 2026-09-30, Revision 8).** Three additions, each scoped so no other reading page moves (CSS block "WHY WE PRACTICE — reading aids"):
- **"On this page"** (`.pp-toc`): a `nav` with `aria-label`, an `ol` of the section headings, two columns from 600px (four and four), one stacked list below. Links are 44px rows in `--rim-blue`, underlined (the prose-link convention); the small label is `aria-hidden` so the nav does not announce twice. One array in the page file feeds the nav and the `h2` ids, so they cannot drift. The brief said "ten sections"; the page has eight, and the nav lists eight. Jump targets clear the sticky nav through the existing `.pp-prose h2[id]` scroll margin (measured 124px from the top).
- **Section spacing on the scale** (`.pp-prose--sections`): h2 64 above and 24 below (48 above on phones), heading size unchanged (`--text-h2`, 28; 24 on phones, the existing 768 rule). The 32px `--text-h2-lg` tier was not needed: a 28px Quincy heading over 18px text already reads larger, and eight headings at 32 would crowd the 52px hero title. Paragraph gap stays at the existing 22 (the brief's "16" was a misstatement of the current value; Jesse confirmed keeping it).
- **The pull statement** (`.pp-quote--set`): the same white card and lift as `.pp-quote`, left-set. `.pp-quote` is centred for a short quotation; about seventy-five words centred read ragged on both edges in a left-set column. A `div` and `p`, not a `blockquote`, because it is the page's own words rather than a quotation.
- **Page-title separator:** a spaced hyphen, as the home page uses. Seven other reading pages still carry the em-dash form ("Our Roots — Rooted In Mindfulness"); a sitewide pass is one decision for Jesse.

**About and Our Roots (2026-09-30, Revision 10).** One job per page: About says who we are and links out (Taking CARE, Why We Practice, Our Roots, dana and volunteering, the teachers, New to RIM); Our Roots says where the practice comes from. Both stay on `.pp-page--column` with `.pp-prose--sections` spacing.
- **About:** a summary paragraph, then seven sections, each closing with its own button row (first primary, second ghost). The prose is split around the rows (`.pp-prose` styles every `a` in it as an underlined text link, which would also restyle a `.pp-btn` placed inside), and `.pp-actions + .pp-prose--sections` restores the heading gap. Vision and mission render `RIM_VISION` and `RIM_MISSION` as two `.pp-quote--set` cards with bold run-in labels, kept because two statements in a row read well as cards; `id="vision"` and `id="mission"` sit on the cards (the Kalyana Mitta guidelines link `/about#vision`). Address, phone and email come from `lib/locations.ts`, the constants the footer reads too, so they cannot drift. No "On this page" list: seven short sections, about 650 words; the brief assumed eight.
- **Our Roots:** *(rewritten whole again 2026-10-02, see "Our way of practice, and our roots" below; the six sections and the "Rooted in Chan" heading described here are retired.)* six sections ("Why a handful" folded into "A handful of leaves"; "Taking CARE, rooted in all of this" is new). The one image is the hall and the orchestra, said in words, in "Rooted in Chan." The Order of Interbeing's first training is an inline quotation inside its sentence, not a pull quote. Open for Jesse's ear: keeping that quotation, and the Mahayana line.

### The strategic grid (2026-09-28, proposed; home first)

**Why.** Jesse, reviewing the live home page: "not just a grid but a *strategic* grid, a truly solid proportional system for the site." Things "look a little wonky." The audit below shows why: the home page's sections each chose their own columns, so nothing shares an edge.

#### The audit (live site, 2026-09-28, before any change)

Measured with an iframe harness (`getBoundingClientRect`, Range line counts, computed padding) on `/` and `/programs/good-morning-silent-meditation`.

| | Home at 1280 | Program detail at 1280 |
|---|---|---|
| Text-block left edges | **21 distinct.** Main ones: 110 (container), 536 (chapter body), 672 (split copy); cards at 110 / 381 / 652 / 923 (examples) and 110 / 471 / 833 (pathways); closing panel inside at 158 | **2**: 290 (everything) and 320 (inside the details card) |
| Column widths | chapter head 362 + body 634 (4fr/7fr, 64 gap); splits 498 + 498 (64 gap); examples 4 x 247; pathways 3 x 337 | one 700 column (hero, quote, body, details) |
| Text measure (chars per line) | body 37-73 (avg 56); card text **17-32** (avg 21) | body 63-78 (avg 72) |
| Section padding | 68 / 68 (closing 68 / 88); 52 at 768 and below | hero 112; body sections by component margins |
| Heading to body | 18 | 14-18 |
| Item gaps | 24 (examples, pathways), 14 x 24 (button rows), 64 (split) | card-internal |

Same pattern at 1024 and 1440 (the numbers shift with the container). At 768 the chapter already stacks (edges 20 / 46 / 48 plus card interiors); at 375 everything is at 20 except card interiors (42) and the closing panel (46).

**What the audit says.** The program page works because it has *one* column; the home page fails because its chapters (4fr/7fr), splits (1fr/1fr) and card rows (4-up, 3-up) are three unrelated proportional systems. Card text at 17-32 characters per line is the "dense narrow tiles" Jesse saw.

#### The system

**1. One container, one 12-column grid.** The container is `.rim-container` as it is today: 1140 max with 40px margins, so a 1060px content box at 1140 and wider. Inside it, **12 columns with a 24px gutter** from 1024px up (column 66.3px at 1060), **20px** from 600 to 1023, and **a single column below 600** (a phone has room for one measure; a four-column phone grid would only fragment it). Twelve divides into halves, thirds, quarters and sixths, which is exactly what the page needs (two edges, three pathways, a reading column). Outer margins stay 40 (above 768) and 20 (768 and below) in this pass; **32 at tablet** is the target for the sitewide pass, because changing `.rim-container` now would move every page.

At 1280 the column lines fall at **110, 200, 291, 381, 471, 562, 652, 742, 833, 923, 1013, 1104** (and 1170 at the right).

**2. The two text edges.** On a page composed from this grid, **every block of text starts on column 1 or column 7** (110 and 652 at 1280). Card rows add their own column lines, and reading pages use one edge (column 3). No other text edges.

**3. A vertical scale on an 8px base.** `--space-1` 8 · `--space-2` 16 · `--space-3` 24 · `--space-4` 32 · `--space-5` 48 · `--space-6` 64 · `--space-7` 96.
- Section padding: **64** desktop, **48** below 1024 (was 68 / 52). The last section's bottom: 96.
- Heading to body (when stacked): **24**. Paragraph to paragraph: **16**.
- Chapter to its card row or group list: **48**. Group to group: **48**.
- Items in a stack: **16**. Items in a card row: the gutter (**24**).
- Closing panel padding below 1024: **32**.

**4. The named layouts.**

| Layout | Desktop (1024 and up) | Below 1024 | Below 600 |
|---|---|---|---|
| **Chapter** | heading and eyebrow in cols 1-5, col 6 air, body in cols 7-12 (518px at 1280, about 60 chars) | stacked: heading, then body in cols 1-10 (about 68 chars) | stacked, full width |
| **Split** | copy 6 cols, media 5 cols, 1 col air. Image left: media 1-5, copy 7-12. Image right: copy 1-6, media 8-12. Copy starts on col 1 or col 7 | stacked: media full width, copy cols 1-10 | stacked |
| **Card row** | items span whole column counts: 3 x 4 cols (thirds), or 2 x 6 (halves) | one card per row in cols 1-10 (no orphaned third card) | one per row |
| **Group panels** (new, for Practice for real life; Jesse chose option C, Addendum C1) | three Pampas panels in the thirds (4 cols each), label at the top in the eyebrow style, examples stacked inside with hairline dividers; panels in a row share a height | one panel per row, cols 1-10 | stacked, in order |
| **Closing panel** | the chapter layout on a recessed ground: the panel's background extends 48px beyond the container on each side, so its heading and body land on the same col 1 and col 7 as the page above | stacked inside a 32px-padded panel | same |
| **Reading column** (existing) | cols 3-10: 699px, the program page's and the reading pages' 700 column | full width within margins | same |

**5. Reading measures.** Body text 60-75 characters per line (chapter body 518px is about 60; reading column 699px is about 72-78 at 18px). Card and item text 40-60. In thirds (the pathway cards and the group panels) text measures about 32-36 per line at desktop (16px); that is the known cost of thirds, accepted with option C. At tablet widths, where panels run one per row in cols 1-10, examples measure about 45-71.

**6. The program detail page fits already.** Its 700 column **is** cols 3-10 of this grid (290 to 990 at 1280): same container, same edges. It is the model for its type and does not change. Two small differences are noted for later, not fixed now: its phone gutter is 24 where the container's is 20, and the quote card is 720 wide against the 699 column.

**What is different from the tombstones.** Nothing reverted is re-proposed. The home page keeps a left edge (col 1), not the retired session-176 spine rule as a mechanism; reading pages keep "The reading column" (cols 3-10). The group labels in Practice for real life use the eyebrow style inside a rich composition (items, insets, a closing arc), not the sparse chapter eyebrows over bare prose that the session-148 tombstone warns against.

#### Revised by Addendum E (2026-09-28, the Claude Design handoff; home only so far)

Jesse chose a Claude Design layout pass for the home page (handoff `design_handoff_home_layout/`, options 1b and 2a). It keeps the system above (the container, the 12 columns, the two text edges) and revises these parts of it. **Where this section and the list above disagree, this section is current.**

- **Widths.** Two edges hold from 769 up (1141+ is the 1060 box; 769-1140 is vw − 80). **431-768:** one column, text in cols 1-10 (568 at 768), and **40px side margins on the home page only** (the container's own 20 at 768 is unchanged sitewide). **430 and below:** one column, full width, 20px margins. Jesse, on the 769-1023 band: "Let's try the handoff for now. We may change our mind if it doesn't look good." At 800 the text column measures about 37 characters per line, under this section's 60 floor; stacking below 1024 (text capped at the reading width) is the known alternative.
- **Rhythm.** Sections **96** (64 at 768, 48 on phones), replacing 64 / 48. Paragraphs **24** apart (was 16). Blocks inside a section **64** (48 on phones); the H4 intro to its figure row 48 (32). Eyebrow to heading 8; heading to stacked text 24; text to buttons 32; buttons 16 apart, natural width, wrapping (now the site-wide button standard, below).
- **One size per tag.** h2 38 on every section (28 on phones only); a Quincy 24/1.5 lead paragraph (`.home-lead`) opens H2 and H9. Body 18 everywhere, including panel items (was 16 in the thirds). **Revised 2026-09-29 (Jesse, on the live page):** h3 is now **32** (`--text-h2-lg`, new token; group labels in `--rim-blue` and the pathway card titles; 28 on phones) and the item title is **24** (`--text-h3`; was h4 at 20, which read smaller than its own 18px text because Quincy's x-height is small; 24 on phones too). The rule that came out of it: a heading must read larger than the text under it, not only be a larger number. Pathway card text is now 18 (was 15).
- **Chapter** heading is cols 1-6 (was 1-5).
- **Group panels (Practice for real life), option 1b, replacing option C:** three **stacked** full-width Pampas panels, 16 apart. Each bleeds 32px past the content box and pads 32 back in, so its label (h3) sits on col 1 and its items on col 7; items divided by a hairline with 24 above and below. At 768 no bleed, label above items; items measure about 58 characters at desktop, where the thirds measured 32-36. This reverses Addendum C1 on Jesse's own choice in Claude Design.
- **H4, option 2a:** the CARE circle (cols 1-6, max 480, on col 1; centred when stacked) beside the eight words as a four-row list (Quincy 28, hairline rows, middot `--rim-text-muted` and `aria-hidden`), then the paragraphs and button on col 7. **Option 2c** (drops the word list, the circle carries the words) waits on content sign-off.
- **Splits:** images are **4:7** (object-fit via background cover, radius 16), top-aligned with the eyebrow. Stacked, **the image follows its text** (was: image first), full content width, 3:4 at 768 and 2:3 on phones.
- **H6:** the buttons follow the three cards (content order). **H9:** the recessed closing panel is retired; the call is a plain chapter on white with a lead paragraph.
- **The hero's paragraphs run out to the col-7 line** (2026-09-29, Jesse: the hero text's right edge even with the left edge of the text below; 769 and up). The box is **two gutters** past col 6 and the paragraphs use `text-wrap: pretty`, not the hero's `balance` (which held every line short). Ragged ends straddle the line: at 1280 they span 605-679, mean 651, against 652 (1024: mean 526 against 524; 800: about 27px short). **Tried and rejected: justified text.** It put the edge exactly on the line but stretched some word spaces to twice normal, and Jesse preferred bringing the ragged edge out. One gutter was tried first and read as unchanged, because ragged ends still stopped 10-80px short. Contrast measured over 16 frames of the loop in the widened strip: body text 6.03:1 worst case (6.24 before), so the scrim was not changed. The hero's first button reads "New to RIM?" (Jesse's question mark).
- **Kept against the handoff, on purpose:** the hero's measured scrim (the handoff's flat 0.74 navy measures about 3.3:1 over the near-white poster); the 60px hero headline that is live (the handoff's "52" was not); the 12px card and panel radius and the 3px focus ring used sitewide (the handoff's 10 and 2 would make home the odd page out); the existing eyebrow colour; no "[Held: …]" note on the Foundations card (a placeholder, and the brief says not to include it); no landlord line (Jesse, B1).
- **Measured on a local render in the live shell before pushing** (the method in `UP_NEXT.md`): zero overflow at 1440 / 1024 / 800 / 768 / 375; text edges 190 and 732 at 1440 (the other lefts are card interiors); panels 1124 wide at 1440; pines 428 × 748.
- **The pine photo, re-sourced (same night, Jesse approved the download):** RIM's only copy, and Webflow's, was 534 × 800. The original is Casey Horner's "Looking up" (Felton, CA; Unsplash License, unsplash.com/photos/4rDCa5hBlCs). Served as `Looking-Up-Pine-Trees-unsplash-1000.webp` (1000 × 1498, 463KB: 856 device px on retina desktop, ~1005 on phones, 1.4x stacked at 768) and, for the `/community-programs` hero, `Looking-Up-Pine-Trees-band-1600.webp` (a 2:1 band at the old 48% framing, 379KB). The 2400w source is not committed; re-download it from Unsplash to re-crop. The old 534px jpg stays because the legacy Webflow CSS references it.

#### Migration order for the other public pages (later passes; launch is October 5)

1. **`/donate`**: the most edges on the site (hero lead, give cards, a centred statement, the timeline). Map the give cards to 2 x 6, the statement to cols 3-10, and the timeline to halves.
2. **`/community-programs` and `/this-week`**: listing rows already fill the container; set category headings on col 1, rows full width, and the 96 / 36 / 24 cadence onto the scale (96 / 32 / 24).
3. **`/volunteerism/volunteer`** (and thanks): splits and forms onto split and reading-column layouts.
4. **Kalyana Mitta** (groups, guidelines, application): groups page cards into a card row; the other two are reading pages (cols 3-10, already close).
5. **`/diversity`**: its `dv-layout` (1060) becomes chapter plus reading column.
6. **`/teachers` and `/teachers/[slug]`**: cards into a 3 x 4 or 4 x 3 card row; profile body to the reading column.
7. **`/courses` and `/course/[slug]`**: course cards into a card row; the landing into the program-detail model.
8. **Reading pages** (New to RIM, Taking Care, Why We Practice, Our Roots, About, Outreach, the agreements page): already on cols 3-10; confirm only, and move their section padding onto the scale.
9. **`/programs/[slug]`, `/join`, `/login`**: already fit; align the phone gutter (24 to 20), and set the 32px tablet margin sitewide with the container.

### Revision 11: lead with why, and the pages as one system (2026-10-01)

Each page answers one question, just enough, and points to the next. **Why We Practice** now runs why-first: Why people come · Something already here · What gets in the way · The moment of choice · **How practice benefits our lives and our world** (new, replaces "A fuller life") · What we practice for · Together, and in our lives · Beyond ourselves. "Joy and difficulty" became "Why people come" and moved first, with a widened middle paragraph. The anchors `#joy-and-difficulty` and `#a-fuller-life` are gone; nothing else in the repo linked to them. The "On this page" list follows the new order; its long fifth title wraps to two lines (47px) and adds 3px on a phone, so the first heading sits at about 893px and the first paragraph at about 948px at 375. **Home's Practice for real life** is one introduction paragraph (the benefits live on Why We Practice now), and its button became "How practice benefits our lives" → `/why-we-practice#how-practice-benefits`, since Taking CARE's own button sits one section below. **Taking CARE** links to Why We Practice from its closing paragraph; **New to RIM** opens its questions with "What can practice help with?" (`QUESTIONS` is now a typed array so one answer can carry a link); **Donate** states the cost facts the same way in three places (for most programs no one is turned away for being unable to pay; overnight retreats carry a minimum; a hoped-for fund for those costs) and the Teaching Fund card names the guiding teacher's role and modest salary (for Jesse's ear).

### Revision 12: where each kind of gift goes (2026-10-01)

One account, said the same way on every surface (Jesse, 2026-10-01): monthly dana and general dana (one-time gifts, the dana bowl at the center) support RIM's operations and expenses, including the guiding teacher's work leading the center; **program dana is split equally, half to RIM and half to the Teaching Fund** for teacher livelihood; people can also give to the Teaching Fund directly; there is **no outreach fund yet**; RIM does not use the title "executive director" (Revision 11 had put it on Donate; removed). Changed: Donate's two card bodies, Outreach's Cost ("gifts to RIM support our outreach as well"), one sentence pair on home, and the program editor's built-in dana texts ("General support", "Teacher support"; they are only starting templates, each program stores its own text). Program pages now point to Donate: a "How dana works at RIM" link under the dana line on `/programs/[slug]`, and one sentence with the same link in the registration dana step (`.pg-dana__where`, shown in voluntary and base-plus-dana modes, not fixed or none). **The Teaching Fund widgets** (`pnbnmp`, `j2WG2L`) are two Givebutter campaigns, "Support Amy Gardner" and "Support Jesse Foy": one-time or monthly, preset amounts, a note field, no designation field. A giver designates by choosing the teacher's campaign, so the card says "each gift goes to the teacher you choose" (Revision 12a; Revision 12 first said "a gift can be designated for a particular teacher"). There is no undesignated Teaching Fund button, and only two teachers are offered; Jesse keeps these forms until RIM builds its own donation integration after launch. **Revision 12a (2026-10-01):** the program editor's templates no longer repeat the split, since the registration dana step states it on every program: "General support" is two sentences, and "Teacher support" became "Reciprocity" (it no longer describes where the money goes). Receipts and the ledger stay as they are: program gifts are recorded and receipted as gifts to Rooted In Mindfulness, and the split is RIM's internal allocation.

### The footer, and the teacher page (2026-10-01)

**The footer is `--rim-blue` (`#31576D`), the same token and value as every `.pp-btn`**; there is one footer rule, and no footer at all in the signed-in areas (`FooterWrapper` suppresses it for `/admin`, `/account`, `/tools`, `/session`, `/lessons/`, `/course/`). Jesse asked for the footer to match the buttons, then confirmed the hex; nothing needed to change but its elements. On that blue the form field's border was 2.37:1 and its placeholder 2.9:1 (the placeholders are the only visible labels), and the fields hid their focus outline. Now: border 60% white (3.96:1), placeholder 85% white (4.63:1), a white 3px focus ring (7.7:1) on the footer's fields, Subscribe button and links, `aria-label`s on the two fields, and the decorative dot `aria-hidden`. The site has no global focus ring (rings are per component, in `--rim-mid`, which vanishes on this blue), so any new element on the dark footer needs the white ring. A darker footer would be `#0d2235` (16.2:1); the options are in `mockups/footer-2026-10-01/`.

**Teachers.** `/teachers/[slug]` renders `TeacherProfile.bio` as paragraphs, splitting on blank lines (it had been one `<p>`); the listing card shows the first 120 characters. The bio is plain text. Jesse's public bio and his member-profile bio (an HTML string, the editor's current storage form) were written to production on 2026-10-01 with his approval. About carries the short MBSR line ("through the Center for Mindfulness at the University of Massachusetts Medical School", "over 25 years of studying and practicing", "mindfulness-based mind-body medical practice since 2006"); the teacher bio carries the long one (the Center for Mindfulness in Medicine, Health Care, and Society, under Kabat-Zinn, Santorelli and Meleo-Meyer). "Our Teachers" is not in the menu until the profile has a photo.

### The menu, restructured (2026-10-01, Jesse approved; the current menu is under "The integration pass", 2026-10-02)

Compared against Spirit Rock, SF Zen Center, Zen Center of Los Angeles, Insight Meditation Society, Insight Meditation Center, Insight Meditation Community of Washington, East Bay Meditation Center and Village Zendo, and against Nielsen Norman Group's menu guidance (four to six primary categories, plain words, each link once). Every peer has a top-level **About**; RIM's was buried under "Our Practice." Now: **New to RIM** (flat) · **Practice** (Why We Practice, Taking CARE) · **Programs** · **About** (About RIM, Our Roots, Diverse Together, Community Care Agreements) · **Get Involved** · **Members** (Become a Member, Sign in; My Home, Sign out) · the Donate pill. Our Roots sits in About beside the lineage-style items peers keep there; the agreements sit with values under About rather than only under Members. "Our Teachers" joins About once the teacher page is populated. The desktop bar's natural width rose from ~1038 to ~1098px, so the phone layout now takes over at **1120px** (was 1060), in the CSS and in `PublicNavSheet`'s `matchMedia`; measured, it fits at 1121 with a long signed-in name (8px to spare). Menu descriptions are provisional (Jesse's ear, tracker 7d).

**Diversity is a front-door value, not an orphan.** The old Webflow home ended its hero with a "Diverse Together - Learn More" button; the rebuilt site had dropped every link to `/diversity`. It is back in the About menu, the footer, a ghost button and a sentence on home, and a sentence in New to RIM. Jesse's fuller meaning (2026-10-01): all kinds of difference, including political; anyone who shares the root intentions belongs; nobody is left out; differences make the community stronger. The waving-hands-and-rainbow row from the old site was not carried: five hands read as one kind of difference, a rainbow as another, and a screen reader announces every emoji.

### The button standard (2026-09-28)

Jesse: "We should create a best practice standard." One rule for every public `.pp-btn`:

- **A button is as wide as its label, on every screen.** The pill is 48px tall (the 44px target with room), 26px of padding each side, a 15px/600 label. So "Our roots" is about 122px and "Taking CARE: the eight words" about 262px. Labels never wrap above 560px; below it a long label balances onto two lines.
- **Buttons sit in a wrapping row, 16px apart** (`.pp-actions`, both axes), on the section's text edge (centred only inside a centred intro). A section has one primary; a second action is the outline button.
- **The one exception is a form's submit** (`.pp-form__submit`), which fills the column on phones (430 and below): it closes a full-width form, and the thumb meets it there.
- **Never stretch a pair or a hero's buttons.** Two full-width bars read as equal weight and blur the one-dominant-action rule, and a stretched pill reads as a banner, not a control.

Until this ruling every `.pp-btn` went full width at 430 and below (and the closing-panel link at 768), which is what the phone pages showed. Measured after the change on 20 public pages at 375: zero overflow, no target under 44px, nothing stretched but form submits.

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

**Updated 2026-09-25 (Jesse):** RIM is a dharma community **rooted in the silent illumination tradition of Chan**, drawing on the whole Buddhist tradition through A Handful of Leaves, in the manner of Thích Nhất Hạnh, informed by mindfulness-based programs and modern science. It is **not** a Vipassana, Theravāda, or modern insight center; never describe it as "insight meditation" in copy or metadata. A Handful of Leaves is the *container*, the body of teaching RIM draws on, not the tradition's name; public copy leads with the tradition and explains the handful after (`/our-roots`). RIM's stated center (what the practice is for) lives in the vault's `1 Model/01-framework-what-rim-is.md`; public words in `4 Promotion/04-community-website-copy-2026-09-25.md`.

**Updated 2026-09-26 (Jesse), for every page:**
- **Vision and mission are stated once and repeated.** `RIM_VISION` and `RIM_MISSION` in `lib/communityAgreements.ts` are the only source; never retype them. The vision is Jesse's arc of the practice (master reference Sections 2–3); the mission is RIM's repeated actions (*Flock Not Clock*: vision is what we want to see and realize, mission the repeated actions that bring it about). The repeating-frame tell does not apply to them. `RIM_WHAT_BINDS` ("unhealthy patterns of mind and action") is final by Jesse's ruling of 2026-09-30. The mission was replaced the same day by his approved text (right effort: know ourselves, cultivate what is healthy and wholesome, release what binds).
- **The circle of benefit** is "ourselves, those we care about, and our shared world." "One another" names the sangha's mutual support, never the middle circle. The handout's practice sentence ("of ourselves, of those we love, of the world, and of this moment") stays verbatim.
- **"Freer of," not "free from"**: freedom grows; it is never a finished state.
- **Universal, not scenario framing.** A page does not open on an assumed situation; it may include some readers and exclude others.
- **The four pairs are teacher-side** (the dyad architecture; register line). Public pages present eight words; home's four cards follow the circle's quarters without naming pairs.
- **`/care` is the handout.** Change it only with the handout, and name any web-only difference in the vault copy doc.
- **Silent illumination** is named, then its halves are said as clarity (Aware) and presence (Attitude). "Great" (wisdom, compassion, action) is part of the teaching: not caught in our limited perspective.

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

## The center, stated (2026-09-25)

The public site was reorganized so RIM's stated center is the first thing a visitor meets and every page is a face of it. **Copy lives in the vault first** (`Dharma Study/10 — Dharma Canon/CARE/4 Promotion/04-community-website-copy-2026-09-25.md`); change the words there, then in code. Teacher-side authority for the center is the vault's `1 Model/01-framework-what-rim-is.md`.

- **Home grounds alternate** ground / white / ground / white / ground / white / ground. Door lists (CARE pairs, the pathway) are white lifted cards, so they sit on the ground. "Practice for real life" sits on white with its six items in borderless Pampas insets (`.pp-uses`): particulars, not destinations, so an inset rather than a lifted card. It shipped as open type first and read as a wall of text (Jesse, same evening). Light Pampas was tried in the browser and rejected: ~2% off white, it barely separates. Home now carries `.pp-page--spine`.
- **Labels are named destinations** ("Your first visit," "This week's schedule," "Ways to give"), per the 2026-09-23 house rule (no imperatives on the page), on every page this pass touched. Untouched pages keep their older invitation labels until their own pass. "Come as you are" stays, as owned language.
- **The two faces.** RIM's own pages say plainly that RIM is a dharma community grounded in traditional Buddhist wisdom, with silent illumination at the heart of its practice (2026-10-02: RIM is not strictly Chan). `/outreach` and the questions on `/new-to-rim` carry the Taking CARE face: a mindfulness-based program, secular in the Dalai Lama's sense, rooted in tradition, asking no belief.
- **The CARE circle** (`components/CareCircle.tsx`) follows the handout artwork, not the 9/23 mock: Calm and Connect upper left, Aware and Attitude upper right, Recognize and Remember lower right, Embody and Engage lower left. It is one image to assistive technology. It appears on `/care` only; whether it belongs anywhere else is Jesse's call.
- **Revision 2 (same evening).** New to RIM is the newcomer's front door, the common practice-center pattern: one "New here?" page, a flat link first in the bar, and the home hero's primary button. The Programs dropdown is two items (schedule, catalog). **The hamburger breakpoint moved from 940 to 1060px:** the bar measured 56px of slack at 941 before the ~110px New to RIM link, so its natural width is now ~1020. All four width queries (two in the nav block near the top, two in the s176 target-size block near the end) change together. Foundations had no page of its own at this point; **superseded 2026-10-01: `/foundations` is a static page** (what Foundations is, standing in until it exists as a Program, with the programs page's one Foundations card linking to it).
- **Presentation rulings, same night (Jesse).** Standalone text links ("… →") are buttons: a section's one action is the primary pill, a second action an outline button (`pp-btn--ghost`, or `pp-btn--onblue-ghost` in a hero), so one dominant action per section still holds. Door cards carry no arrow circle ("a little too busy"); the whole card stays the link and the title turns blue on hover. A grid of short text items on white gets borderless Pampas insets (`.pp-uses__item`), never bare type ("just text with no separation"); Light Pampas was tried and is too faint on white. Pages this pass did not touch still carry older text links (backlog).
- **The distillation** (`.pp-distillation`): a few set-apart italic lines after a reading page's prose, as How We Write sanctions. `/why-we-practice` is the only use.

## The home page composition (session 172)

> **Superseded 2026-09-28:** the home page is now composed on "The strategic grid" above. What holds today: text-led chapters use the chapter layout (heading cols 1-5, text cols 7-12); images stagger (the CARE circle left, the trees right, the lotus left); Practice for real life is three stacked group panels on the two edges (Addendum E, option 1b); the three ways in are a card row in thirds; the call closes as a plain chapter (the recessed closing panel retired in Addendum E). The Buddha-and-lotus photo was tried beside Practice for real life on 2026-09-27 and removed the same day (awkward beside one paragraph). The copy source for the home page is the vault's `04-community-homepage-revision-2026-09-28.md`. The notes below are the session-172 history.

- **Splits alternate** — image right (What we do) / left (Community) / right (Dana). Both had carried `--flip`; every image on one side was the redundancy Jesse flagged.
- **The doors are dynamic** — the live `ProgramCategory` taxonomy (Program Manager's rows, sortOrder), each with a kind-derived public line + offerings count (`KIND_LINES` in `app/page.tsx`), deep-linking to the listing's category anchors. Empty categories get no door; the page is `force-dynamic`. `categoryDisplayName` (lib/programUtils.ts) is shared with the listing so the one editorial rename can't drift. **Badges/doors come from data** — the s170 rule, now honored.
- **The doors chapter uses the split grammar** — words left, doors right (Light-Pampas insets on the white section: white cards on white were invisible; an inset, not a lifted card, so no shadow).
- **Dana is the third split** — the held lotus ("Lotus flower in hand", Olga Nayda, Unsplash License; 2400w source + 1600w/62KB WebP). An offered flower is the dana gesture; the many-hands photo stays the volunteer/KM/diversity hero only.
- **Images:** splits serve 1600w WebP (buddga-lotus went 1.6MB → 74KB). **Sharpness ceiling:** Looking-Up-Pine-Trees was 534px (re-sourced from the Unsplash original 2026-09-28) and Community-Hands is 900px — both serve full-bleed heroes and need higher-res re-downloads; no processing adds pixels.
- **Hero video prefers MP4** — flaky VP9 hardware decode produced intermittent "dancing blocks"; both transcodes verified clean frame-by-frame and byte-identical to the live Webflow copies. Baseline 720p-on-Retina softness remains until the original clip is rescued from Webflow's Assets panel.

## The integration pass: the site as one whole (2026-10-01 and 2026-10-02)

Jesse's rulings, 2026-10-02: publish it ("Since the site's not live yet"; launch is Monday, October 5, when rootedinmindfulness.org moves here, and until then `rim-next.vercel.app` sends `noindex`); his read-aloud continues on the published pages, and corrections come back through the vault drafts file (`08-promotion-site-drafts-integration-2026-10-01.md`, the words authority for the pages below).

### The three ways, Category and Format, and Open entry (2026-10-02)

Taking CARE is offered in **three ways: Foundations, Ongoing Learning & Practice, Immersion**. (The middle way was "Learning & Practice", then "Ongoing Practice" for a few hours on 2026-10-02, until Jesse's final wording: "ongoing learning and practice". The ampersand is used in headings, labels and the editor, as in "Programs & Events"; the anchor is `#ongoing-learning-and-practice`.) Wherever the ways are described: "series" is "courses" and "practice days" is "days of mindfulness".

**The model lives in the data and the Program Manager** (`lib/programOffering.ts`, the one module; `RIM_ProgramEditor.md`, `RIM_Offering_Model.md`). Every program carries a required **Category** (Foundations, Ongoing Learning & Practice, Immersion, Community Group, Special Event, and the internal Service and Private), a **Format** (Drop-in, Class, Course, Workshop, Day of mindfulness, Retreat; required for the three ways, optional for Community Groups and Special Events, and in sentence case on the site), a **Silent meditation** checkbox (a kind of drop-in, not its own format) and a **Hosted by volunteers** checkbox (the label on cards and pages; "hosted," not "led," because a silent sit has no teaching; Community Groups are member-led by definition and do not need it). `lib/programChapters.ts` (the map from old category slugs to chapters) is **retired**: the Programs & Events sections are read from Category.

| Category (anchor) | Section on Programs & Events | Notes |
|---|---|---|
| Foundations (`#foundations`) | one static card to `/foundations` when no Foundations program is scheduled; the scheduled programs when there are | always shown |
| Ongoing Learning & Practice (`#ongoing-learning-and-practice`) | drop-ins first, then the "Silent meditation" subheading and its line ("Silent sitting together on Zoom, mornings and evenings, hosted by volunteers from our community."), then "Classes" (was "Courses and classes" until 2026-10-08: courses are Immersion) | always shown, because Home's door links the anchor |
| Immersion (`#immersion`) | its introduction (workshops, courses, days of mindfulness, retreats), and "Upcoming dates will be listed here." when empty | always shown |
| Community Groups (`#community-groups`) | member-led; no shared block, no Hosted label | |
| Special Events (`#special-events`) | no shared block (the anchor was `#events`) | |
| Service (`#service`) | internal; no public section until a Service program is scheduled, then its own "Service" heading | both Service programs are archived today |
| Private | never listed | |

Each card carries its Format label and "Hosted by volunteers" where checked, on one quiet line (`.pl-card__labels`); detail pages carry a breadcrumb such as "Ongoing Learning & Practice · Drop-in" linking to the section. The section introductions are the brief's Part B3 words (Ongoing Learning & Practice's: "Drop-ins, silent meditation, and courses through the week, in person and online. The drop-ins are open any week, and they are the easiest way in.").

**What Category and Format decide, and what they never decide (Jesse, 2026-10-02: "Format must not decide access").** They decide labels and grouping only: the sections, the Format label, the breadcrumb, whether the shared block shows (the three ways, the silent sits included; not Community Groups or Special Events). **They never set registration, access (who may join without registering), Zoom entry, the suggested contribution, or the dana minimum.** Access is its own per-program setting, **Open entry** (`Program.openEntry`, read by `hasOpenEntry`): anyone signed in may join, in person or on Zoom, without registering. The "Simply arrive" line, My Home's Today, Zoom entry, and This Week's **Drop-in** mark all follow it. A program can have registration and open entry together (Essential Dharma Study). Open entry is not the Open Access guest link. The migration (applied 2026-10-02) backfilled Open entry to each program's current answer, so no program's access changed. Dana minimums apply only where RIM pays a host and stay their own setting, set by hand.

**The 2026-10-02 mapping** (Jesse approved it with changes): Awakening the Heart, The Art of Meditation, Essential Dharma Study, Meditation and Dharma Talk, and the two silent sits are Ongoing Learning & Practice / Drop-in (the silent sits also Silent meditation and Hosted by volunteers); Our Hearts Were Made for This, Qigong at RIM, Recovery Dharma, Nature Meditation and Bookmarks & Breath are Community Groups (Our Hearts, a collaboration with the Christine Center led by a RIM volunteer, has open entry on; Format empty for all); the December gathering is a Special Event; Day of Mindfulness and Awakening to the Beauty of This Moment are Immersion / Day of mindfulness; The Heart of Wisdom is Immersion / Retreat; Sacred Clarity is Immersion / Workshop; the two community-service programs are Service; Private Teacher Meetings is Private.

**Tombstones.** The chapter map by old category slug (`lib/programChapters.ts`, built and shipped 2026-10-01) lasted one day; the old `ProgramCategory` and its `kind` remain only as a fallback for an unset Open entry and as the "hide from the Programs page" flag, and are ready to remove (backlog). An earlier plan to derive access from Format = Drop-in (the program-categories brief's own C0) was built, then reversed by Jesse the same day: do not re-derive access from Format or Category.

**The shared program block** (`components/ProgramSharedBlock.tsx`) sits between "Gathering details" and "Facilitators" on every program in the three ways (the silent sits included), not on Community Groups or Special Events: Taking CARE, "our way of practice," is present in every gathering (link `/care`), and programs list a suggested contribution so no one is turned away (link `/donate#dana-at-rim`). It is a recede panel (`.pg-notes.pg-shared`), not a lifted card: the details card above already carries the lift.

**The pull quote is optional** (2026-10-02). A program may be saved without a quote or its source; a source cannot stand without its quote (422). Three live programs have a quote and no source, which is allowed. A program with no quote renders `pg-hero--no-quote` and `pg-content--no-quote` (a hero sized to its words, content starting a quote card's margin below). The Meditation and Dharma Talk epigraph was removed this way (the Sharon Salzberg wording was never checked against its source).

### Our way of practice, and our roots (2026-10-02)

Jesse's rulings, 2026-10-02, with the words in the vault drafts file §8 (verbatim on the pages): **the roots are the tradition, and Taking CARE grows from them. Silent illumination is the heart of the practice. Taking CARE is "our way of practice," a mindfulness-based approach true to traditional Buddhist wisdom and teachings. The Dharma is glossed as "Buddhist teachings."** RIM is not strictly Chan, so the site names silent illumination as its heart and says it comes from Chan, instead of claiming the school: "Rooted in Chan" and "The shared Dharma" are retired as headings, and "our root practice" is gone from every page. Where the words mean the historical Buddha himself ("the Buddha's earliest teachings," "earliest words," the grove story, the Buddha's attendant on Join), they stay.

- **About, "How we began"** (`#how-we-began`, four paragraphs): RIM began as the name under which Jesse taught MBSR in medical settings and other organizations, then by donation, then in a small practice space; became a nonprofit dharma center in 2016; and Taking CARE is the next step in that story. The introduction and "Where it comes from" carry silent illumination as the heart.
- **Our Roots** (rewritten whole): Many traditions, one family; At the heart of our practice; For the benefit of all; A Handful of Leaves; Taking CARE grows from all of this; For modern life (links to `/about#how-we-began`); For anyone. Ids follow the headings (`#many-traditions-one-family`, `#at-the-heart-of-our-practice`, `#for-the-benefit-of-all` which Why We Practice links to, `#a-handful-of-leaves`, `#taking-care-grows-from-all-of-this`, `#for-modern-life`, `#for-anyone`).
- **Home** (Taking CARE opening, "Buddhist teachings," description), **the Taking CARE page, Foundations, New to RIM, Why We Practice** ("Taking CARE is how we train this moment."), and the shared block say "our way of practice." Home, About and Our Roots have the §8.7 descriptions.
- **Database-held texts** still carry "the Buddha's teachings" (Meditation and Dharma Talk's description, Essential Dharma Study's "The Buddha's core teachings"); reported, not written (backlog).

### The Handful of Leaves

- **`/handful-of-leaves`** (public, in Practice): six sections with "On this page", words verbatim from the drafts file. "Walking it" opens "Members can explore the handful in their member area, beginning with *A Handful of Leaves: An Introduction* and the map of its teachings" (2026-10-02, drafts §9: the handful is a members' reference for deepening, not a handout at the door; Taking CARE is the entry), and "member area" links to sign-in (or, for a signed-in member, to the introduction) via `components/MemberAreaLink.tsx`.
- **Two members-only reading pages** in the member area: `/account/handful-of-leaves` (the introduction) and `/account/handful-of-leaves/map` (Categories & Elements, Community Edition). They sit in the `(authenticated)` route group, so the layout's gate sends a signed-out visitor to sign-in. They render `content/handful-of-leaves/introduction.md` and `map.md` (`lib/handfulContent.ts`, `marked`), with the document's own first heading as the page title, the aliased Obsidian wikilink in the introduction's first line (`[[A Handful of Leaves — Categories & Elements (Community Edition)|A Handful of Leaves: Categories & Elements]]`) rendered once, as the alias, linked to the map page, and a print stylesheet (`@media print` in the "A HANDFUL OF LEAVES" block: the member header and rail drop away, black on white at 11.5pt). `next.config.ts` carries `outputFileTracingIncludes` so the files ship with those routes.
- **My Home** carries one card (`components/HandfulHomeCard.tsx`): "A Handful of Leaves", "A reference for the teachings behind our practice, to return to whenever something arises in practice or in life." (2026-10-02, drafts §9), links "The introduction" and "The map".

> **The derived-work rule (Jesse's vault law).** The vault is canonical: `Dharma Study/10 — Dharma Canon/Handful of Leaves/A Handful of Leaves — An Introduction.md` and `… — Categories & Elements (Community Edition).md`. The repo files in `content/handful-of-leaves/` are **derived works**: each is a verbatim copy of the vault body under derived-work frontmatter (`type: website-page`, `derives_from`, `sources_as_of: 2026-10-01`, `status: living`). **Never edit a word in the repo copy.** When the vault changes, re-derive: copy the new body under the same frontmatter, update `sources_as_of`, and diff the body against the vault file (byte-identical after the frontmatter). A derived copy edited as if it were a source caused the July 2026 36-versus-34 fork (vault `Working Agreements`). The map's list uses em-dashes structurally ("Sukhāya Hitāya"), and both documents are verbatim, so the no-em-dash rule for public prose does not reach them.

### Metadata and crawling

One title separator, " - ", on every page (including admin and member titles). Meta descriptions for the listing, This Week, Teachers, each program (its tagline plus " at Rooted in Mindfulness in Brookfield, Wisconsin."), and the December gathering. `metadataBase` is `https://rootedinmindfulness.org` (`lib/siteUrl.ts`) with a per-page canonical (`alternates.canonical: "./"`). The `rim-next.vercel.app` host sends `X-Robots-Tag: noindex, nofollow` (a host-conditional header in `vercel.json`; Vercel adds noindex to previews itself, but not to the production alias). `app/robots.ts` allows the public pages and closes `/account/`, `/admin/`, `/tools/`, `/api/`, `/session/`, `/update/`, `/login`, `/lessons/`, a program's `/register` and `/thank-you`, and `/style-guide`, and names the sitemap. `app/sitemap.ts` (built on request) lists the public static pages, the programs a visitor can find on Programs & Events, and public teacher profiles; it leaves out the public course catalog until real courses exist. The footer year is generated.

### The menu now

New to RIM · **Practice** (Why We Practice, Taking CARE, Our Roots, A Handful of Leaves) · **Programs** (Foundations, Programs & Events, This Week's Schedule) · About (About RIM, Diverse Together, Community Care Agreements; Our Roots moved to Practice, 2026-10-02) · Get Involved · Members · Donate.

### Dated facts: sweep on November 1

"First offered in November" / "begins in November" appears on **New to RIM** (Where to begin), **Foundations** (the page and its metadata description), and the **Programs & Events** Foundations introduction (the home card lost its date on 2026-10-08). Also the Saturday Meditation and Dharma Talk line (New to RIM, Foundations) if the program changes; home no longer names it ("any of our drop-ins makes a welcoming first visit"), because Jesse may rename some drop-ins; the home cards read program names from Program Manager, so a rename reaches home on its own.

### Left for later (words or facts owed by Jesse)

New to RIM "What a gathering is like" and parking; Meditation and Dharma Talk's one sentence on the shape of a morning; Essential Dharma Study named on the Handful page if that is where it is taught; whether the Handful introduction's promised "companion guide to the sitting itself" exists; Foundations' dates, format, and whether it can promise that no one is turned away; the other weekly program texts (launch week). The programs page's Day of Mindfulness placement (Events, not Immersion) and a possible restructure into two independent program fields (way and format) are in the backlog.

## The home page in Jesse's words (2026-10-08)

Jesse read the live home page aloud, rewording as he went, and asked for a minimal polish that kept his words, plus a look at why the three ways "doesn't quite present itself in a way that is clear that these are the actual programs." The words are in the vault's `04-community-homepage-revision-2026-09-28.md` (Part One, revised 2026-10-08; the twelve flag rulings in its log; his verbatim lines in the master reference's Appendix A). What the design record needs:

- **Why the three ways did not read as programs.** The heading said "Where to begin, and where it leads" and the word *program* never appeared before the button; three paragraphs of agreements and membership sat between "offered in three ways" and the cards; and the cards carried a category name and one abstract line, in the same lifted-card grammar as the site's concept doors. The sparse-version-of-a-rich-pattern problem (the session-148 lesson), in the other direction: the scaffolding without the substance.
- **The section now (after the critique, later the same day):** eyebrow **"Programs"**; heading "Our programs, and where to begin"; one sentence ("RIM's programs are offered in three ways. No experience is needed for any of them, and every gathering is open to you."); **three cards in thirds, each naming what its way contains** (Foundations: course or workshop, self-paced online in time; Ongoing: drop-ins teacher-led, silent meditation hosted by volunteers, community groups; Immersion: workshops, courses, days of mindfulness, retreats), each with two short sentences and linking to `/foundations` or the catalog's section anchor; one sentence on membership with the agreements link; buttons **Programs & events · This week's schedule**. **Home is static again.** The kinds are stable copy in `app/page.tsx`; the scheduled programs live on Programs & Events and This Week.
- **What came before it, the same afternoon, and why it went.** The first build listed each way's live program names (from `lib/publicPrograms.ts`, the catalog's listing rule), first in thirds (measured: the Ongoing card ran 886px and stretched the other two), then as full-width rows on the two text edges (175 / 351 / 205). Jesse: "this section just blends so much into the rest of the site... a little busy." A dual-assessment critique (`.impeccable/critique/`, 19/32) named the mechanisms: the same chapter grammar as every neighbour, the program list in the same hairline idiom as the CARE words, 353 words over 2.1 viewports (3.8 on a phone), the label "Taking part," and names that carry no type information (format, cadence and venue do). Two directions were mocked on the live page: **types** (the cards above) and **schedule** (each program with format · day and time · venue, the reviewer's own recommendation). Jesse chose types: it answers "what kinds of programs" in five seconds and keeps home from becoming a second schedule beside This Week. **Not a tombstone:** the schedule rows were never shipped; if home ever needs a time, that mock is the shape (names linking to their programs, a 15px muted meta line from `formatLabel`, `dateText` and the delivery field). `lib/publicPrograms.ts` stays as the catalog's loader. The `a.pp-card.home-paths__card` phone-padding selector that never matched the div card was fixed in the same pass.
- **The card is a `div`, not a link** (the review): the title's link carries an `::after` stretched over the card, so the whole card is clickable while the link's accessible name is the way's title; hover reads on the card and the focus ring uses `:has(.home-paths__link:focus-visible)`.
- **Practice for real life, re-tested** at Jesse's request against four frames (mindfulness-based interventions, happiness and thriving, the WHO's well-being, the tradition's mundane and supermundane; the vault's research record, 2026-10-08 log): "Work and its pressures" is **"The pressures of life and work"** with caregiving, money and attention; Knowing ourselves names "the habits we reach for when we are tired or hurting"; The people in our lives ends "that company becomes a place to belong." **Why We Practice, section 5,** gains one paragraph naming well-being whole and the research honestly (support, not proof). The division holds: home shows a week, Why We Practice explains why.
- **New to RIM** (same pass): the drop-in sentence links this week's schedule instead of naming a program; Foundations carries its format; **the stairs are said plainly** ("Our rooms are reached by stairs; the building is an older one and has no elevator..."), with online gatherings as a full way in and off-site gatherings named. Parking and which door are still unwritten (`2026-08-10-002`).
- **His rulings that reach other surfaces:** `RIM_WHAT_BINDS` is now **"unhealthy patterns of heart, mind, and action"** (supersedes 2026-09-30; the vision, the agreements frame on five surfaces, and About follow). **Courses are Immersion** ("sometimes drop-ins are offered as a series, but courses are something that you register for separately"): the catalog intros, the Ongoing subheading ("Classes"), the Foundations page and the editor's Category help say so; a drop-in series stays a drop-in. **Community groups stay their own section** beside the three ways (member-led fellowship, not RIM's teaching; Claude's call, accepted) and are named in the Ongoing card's prose. **The Foundations program is named**, "Taking CARE: Foundations of Meditation and Mindful Living," with his formats line ("usually as a course or workshop, and, in time, as a self-paced online option"), from one constant feeding home, the catalog's standing card and `/foundations`; "Finding your footing" is retired.
- **Words he ruled on:** the hero keeps the handout's practice sentence over his spoken "the world we share" (the third time it had drifted); "healthy and wholesome," not "healthy and good"; the silent-illumination paragraph is **cut from home** (Our Roots and About keep it); "glimpse" is out ("Nobody uses that in this context"; "We find it whenever we notice..."); "empowered" became "find more strength," and "our best self" became the mission's "the wakeful nature already within each and every one of us"; "Ancient wisdom for a modern life" dropped (a tagline, and home's eyebrows are short labels); the close integrated (what practice clears now opens Practice for real life, and a short close stays so the page does not end on Dana).
- **Still provisional** until he reads the published page; the words are his, the polish is not yet read aloud in its final form.

## The public refresh (2026-10-09)

Jesse reviewed a redesign of the public site in ChatGPT's web designer and handed it over as a package (`rim-development-handoff.zip`: `IMPLEMENTATION-BRIEF.md`, `routes.json`, `approved-content.json`, the static reference under `reference/dist/`, two screenshots; snapshot of the live site taken the morning of 2026-10-09, after the read-aloud push of the night before). It is a re-skin of twenty public routes, integrated in phases on `main` (his choice: "work with it in the way that we have been"), each phase its own commit, measured at 1280, 900, 390 and 320 before it ships. The package itself is not in the repo.

**His four rulings before the build (2026-10-09):**
- **Surfaces: borders, as reviewed.** Public cards, panels, quotes, notices and closing panels are white with a 1px `--rim-rule` border and a 12px radius, and no shadow; home's sections divide with a hairline; the three program-category cards carry a hover lift (translate 4px and a soft shadow), the one motion. This supersedes the session-148 card lift (`--card-shadow` stays defined for the member area). `CLAUDE.md` carries the rule.
- **Colours: the reference's tones as tokens.** `--rim-heading` (#253c46, public headings), `--rim-text-soft` (#485652, intro, card and fact text), `--rim-label` (#3b5967, eyebrows and small labels), `--rim-gold-soft` (#f0dda9, the tag and link on the filled Foundations card). Two text tokens: `--text-action` (16px, standalone button labels) and `--text-card` (17px, text inside cards and panels). No hex entered a rule.
- **Practice for real life: his words, trimmed.** The reference shortened his nine items to one-liners; the brief said not to reintroduce shortened summaries; his worry was length. Each item keeps its title and its first one or two sentences, in his words (25 to 35 words), in the reference's three columns. The fuller texts of 2026-10-08 stay in the vault's home working draft, and Why We Practice carries the depth.
- **Delivery: `main`, in phases.** A Vercel branch preview has no database, so the catalog, This Week, the groups page and the teacher pages would not render there; `rim-next.vercel.app` is unannounced and `noindex`.

**Kept against the reference, on purpose:** focus rings stay blue (the reference's are a red outside the palette); phone buttons keep their natural width (the September 28 button standard; the reference stretches them); home's hero title keeps its size; "Come as you are" is not repeated in the programs intro (the hero has it); the designer's imperatives ("Choose the kind of practice you're looking for", "Make space to settle more fully", "Join a drop-in any week, or return regularly") are house-voiced; and the reference's preview-only line on This Week ("For current dates… view the live RIM schedule") does not come over.

**Where the reference meets a tombstone:** the category doors above the catalog listings sit where the session-170 orientation notice was removed. What is different: they are navigation to the sections, not an explanatory panel, and Jesse reviewed them. Practice for real life's three columns reverse Addendum E's stacked panels (his own choice of 2026-09-28, after thirds measured ~32 characters a line); with the trimmed items the columns measure as the reference does.

**Phase 1, the shared vocabulary (in place, not appended):** `.pp-btn` at 16px with 12/24 padding and a blue focus ring; `.pp-btn--ghost` outlined in blue; `.pp-btn--onblue-ghost` a plain 1px white outline; `.pp-card`, `.pp-quote` (left-set, sans 20px, 680 wide), `.pp-panel`, `.pp-closing`, `.pp-notice`, `.pl-card`, `.pl-membership` bordered and shadowless; `.pp-intro__eyebrow` and `.pp-closing__eyebrow` in `--rim-label`; `.pp-intro__title` and the prose h2/h3 in `--rim-heading`, prose h2 at 32; `.pp-section` 72 / last 80; `html { scroll-padding-top: 88px }`. The new pieces live in the "THE PUBLIC REFRESH — 2026-10-09" block before the readability contract: `.pp-hero--quiet` (a left-set header on the ground with a hairline beneath, no photograph; every refreshed public page wears it except home's video and New to RIM's photograph) and the catalog's `pl-overview` / `pl-doors` / `pl-door` / `pl-community-links` / boxed `pl-cat` with `pl-cat__label` and `pl-cat__count` / the phone `pl-card__link`.

**Phase 2, home (`app/page.tsx`; the home block rewritten whole):** order hero · What brings us together · **Our programs, and where to begin** (third, was sixth) · Practice for real life · Our practice is taking care · Deep roots · Taking part · Dana · It matters how we live. Grounds: white, Pampas, Pampas, Pampas, white, Pampas, white, Pampas (the reference's cascade as it rendered), each with a hairline above. Sections 72 / 56 / 48. **The eyebrow sits in its own row** (`.home-eyebrow`) above the heading/copy columns, so the body starts level with the heading; measured on the programs section, both at y=2551. A location line in the hero ("Brookfield, Wisconsin · In person & online"); the hero's height from its content. **The programs section:** intro (h2 col 1, one sentence col 7), three category cards in thirds (`.home-pathway`, Foundations filled blue, a tag, a title, two sentences, "View … programs"), then `.home-begin`: "Planning your first visit?" with Plan your first visit, and "Join us this week." with This week's schedule. Measured: cards 464 equal at 1280, 533 at 900, stacked on phones. **Practice for real life:** three `.home-theme` columns with a 2px label rule, each a white panel of three items with hairline dividers and equal rows; the closing row of one paragraph and the button. **Taking CARE:** heading and introduction at full width, then the circle beside the key of four equal rows in equal halves (518 × 518 at 1280, 398 at 900, the same top edge), then the explanation and button at full width; natural rows on phones. Splits at 4:5 (4:3 and 2:3 stacked).

**Phase 3, the catalog and This Week:** the catalog's hero is quiet (the pine band left with it) and leads to This week's schedule; **the categories come before the listings**: an eyebrow, "Our program categories", one sentence, three doors (`.pl-door`, a 3px blue top rule) to the sections, and "Also in our community" with Community groups and Special events links shown only when the data has them. Each section is a bordered box with its heading on a blue bar, a label ("Taking CARE program category" for the three ways, "Community offerings" for the rest) and a count from the data ("6 programs"); the Foundations standing card says "About Foundations"; on phones the trailing arrow gives way to "View program →" inside the card. This Week's hero is quiet with the week buttons as a filled and a ghost pill and "Jump to today" as a ghost; its week navigation keeps `?week=next`.

**Still to do (phases 4 to 6):** New to RIM (two entry choices, fact lists, the stairs kept), Why We Practice and the reading pages (sticky chapter navigation on desktop, a disclosure on phones, bordered quotes, the benefits as three cards), Get Involved (one spine, View group, the closing panel with Start a group and its guidelines together, opportunities before the quotation) and the teacher cards (Read biography). Every wording change the reference made is in the flags file for Jesse's read; nothing is ratified by shipping.

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

### Program notices (September 2026)

The general program catalog and weekly schedule retain `specialAnnouncement` as a visible Update. They no longer render `earlyArrivalMessage` under “Good to know.” That routine preparation appears beside the relevant offering on the signed-in member’s Today view, in a disclosure. This is a placement change; authors still edit the same program field. Do not remove urgent updates or hide cancellation/time-change information with routine preparation.
