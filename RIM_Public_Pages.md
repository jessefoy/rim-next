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

## Process — preview before production for new design elements

- **Spacing nudges, color swaps, token tweaks** → direct to `main` (the fast push-to-see loop).
- **New compositional elements** (a band, a section pattern, a new heading language) → a `claude/*` **preview branch** for a look *before* production. Vercel deploys every branch as a preview. The chapters/band revert is the cautionary tale — sparse-scaffolding mistakes are only visible rendered.

*(Proposed session 148 — confirm with Jesse.)*

---

## The `pp-` grammar — the static front-facing pages (session 169)

One shared surface language for the pages that are neither catalog nor program detail: **home, donate, diversity, volunteer (+ thanks), and the three Kalyana Mitta pages.**

**Why it exists.** These pages were still wearing Webflow-era class names — `.section-19`, `.main-container`, `.grid-halves-3`, `.diversity-content-box`, `.bg-accent-2`, `.milestone-circle`, `.w-richtext`, `.button-2` — and **none of them has a rule in `custom.css`**. Only `custom.css` is linked; `rim.webflow.css` and `webflow.css` sit unused in `public/css/`. The pages rendered as bare document flow. This shipped that way for months.

`pp-` deliberately extends the `pl-`/`pg-` language rather than starting a second system: same hero grammar, same card lift, same recede panel, same eyebrow treatment.

### The pieces

| Class | What it is |
|---|---|
| `.pp-hero` (+ `--flat`, `--video`, `--donate`) | Hero over photography, footage, or flat blue. Pass a photo with `--pp-hero-image`. |
| `.pp-hero__eyebrow / __title / __body / __actions / __link` | The hero tiers. |
| `.pp-section` (+ `--white`, `--accent`, `--tight`, `--last`, `--airy`, `--airiest`) | Page rhythm. |
| `.pp-intro` | Section opener: eyebrow, serif title, body. |
| `.pp-prose` | Flowing copy at `--reading-width`, open on the ground, never boxed. |
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

## Known follow-ons (see `data/backlog.json`)

- **`2026-06-13-001`** — member/hub/admin internal UI still holds hardcoded old teal the token flip didn't reach; sweep.
- **`2026-06-13-002`** — home page alternating sections (`.rim-section--grey` uses `--rim-bg`) flatten on the warm ground; repoint to the Pearl Bush secondary for rhythm. *(Largely superseded: home is on `pp-` as of session 169.)*
- **`2026-08-07-001`** — the home page's four category doors are stale and non-functional: they match the real taxonomy on one of four, omit Silent Meditation Drop-Ins, and three of four link to the same URL. Needs `id` anchors on `.pl-cat` first.
- **`2026-08-07-002`** — volunteer and the three Kalyana Mitta pages have never been measured against the live rendering, which is what caught every donate discrepancy.
- **`2026-06-13-003`** — course landing (`/course/[slug]`) still on the old colon-heading language; bring into this system (but **not** the reverted eyebrows/band — match the *shipped* program-page language).

---

*Rooted in Mindfulness · public-page rebuild · begun session 148 (2026-06-13); the `pp-` grammar added session 169 (2026-08-07). Evolving — update as the system settles.*
