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

> **Second sanctioned exception** to the CSS "no box-shadows" rule (after `.rim-cb-popover`). White cards on the warm public-page ground may use `--card-shadow`. Nothing else.

## Style guide — `/style-guide`

An unlinked, no-indexed visual calibration page. It is not public navigation or a second design project; it is the place to review the live palette, typography, cards, panels, buttons, fields, and semantic feedback states together before extending the system. Use it when a visual change affects more than one screen.

---

## Navigation — flush bar (NOT a floating pill)

A **flush, full-width white bar** (`.nav` `#fff`, sticky, `100px` inner); heroes start beneath it. Slimmed to three dropdown doors + Donate: **Programs ▾ · Get Involved ▾ · Members ▾ · Donate** (Courses + Teachers removed from the bar; "Member Area" → "Members"). Lives in `components/Nav.tsx` (global, all pages).

### TOMBSTONE — the floating nav pill (tried & reverted, session 148)

An Esther-Perel-style **floating cream/white rounded pill** nav was built, shipped, and **reverted**. Why it failed *for RIM specifically*: RIM's program heroes already have a featured floating object — **the quote card**. The pill became a *second* white rounded object stacked above the quote card on the same dark hero ("white slab / blue / title / blue / white slab") — the duplication was the busyness Jesse felt as "off." The Esther Perel float works because her hero has **no card under it**; the pill is the only object. **Do not re-propose the floating nav.** Flush chrome is invisible chrome, which is the point. (Commits `50c0dc4` → revert `723af6b`.)

---

## The program detail page (`/programs/[slug]`)

Top to bottom:

1. **Blue hero** — `#31576d` over `programImage`, with a `::before` overlay. Contains: a category **eyebrow** (`.pg-hero__eyebrow` — quiet uppercase, white at 0.72, links to `/community-programs`) · title (`.pg-hero__title`, 46px serif, `text-wrap: balance`) · subtitle (`.pg-hero__tagline`, 20px/400, `text-wrap: balance`).
2. **Quote card** straddling the hero/ground seam — white, `--card-shadow`, `.pg-quote__text` 22px/400 serif; overlaps up `-84px` (≈ centered for a two-line quote; longer quotes grow downward keeping a constant in-hero overlap).
3. **Description prose** — open on the ground (no box).
4. **Details** white card (`.pg-details-section`, `--card-shadow`) — schedule/time/place/dana rows, then the CTA. The CTA is polymorphic and the markup already splits it: actionable states (`.pg-detail-cta__link` — Register / Join the waitlist / Access Zoom) are styled as a **rim-blue pill button**; informational states (`.pg-detail-cta__text` / `.pg-detail-cta__status` — "you're registered" / "registration isn't open yet" / "simply arrive in person") stay **quiet text**. Button-the-actions, leave-the-messages.
5. **Notes** recede panel (`.pg-notes`, Deeper Pampas, no shadow).
6. Footer.

`text-wrap: balance` on title + subtitle is deliberate: every program has different-length copy, so the line shape must be **content-agnostic** (balanced lines for any title/tagline) rather than tuned for one example.

### TOMBSTONE — chapter eyebrows + closing band (tried & reverted, session 148)

Adding **uppercase chapter eyebrows** ("ABOUT THIS DROP-IN" / "DETAILS" / "FACILITATORS") on the ground plus a **full-bleed Pearl Bush closing-invitation band** before the footer was built and **reverted** ("didn't feel well designed aesthetically"). The lesson: **a sparse version of a rich pattern reads as cheap, not minimal.** The reference's eyebrows + color bands work because they sit inside a *rich composition* (illustrations, confident color, scale contrast); transplanted into a sparse reading column, a small gray uppercase label reads as a *form label* and a beige-on-beige centered-text band reads as *newsletter furniture*. If the page wants more rhythm later, it needs the **substance** (visual anchors, real composition), not just the scaffolding. **Do not re-add the eyebrows/band without the composition to justify them.** (Commit `77edca8` → revert `06a041b`.) The hero **category eyebrow** (`9193c93`) is separate and stays.

---

## Process — preview before production for new design elements

- **Spacing nudges, color swaps, token tweaks** → direct to `main` (the fast push-to-see loop).
- **New compositional elements** (a band, a section pattern, a new heading language) → a `claude/*` **preview branch** for a look *before* production. Vercel deploys every branch as a preview. The chapters/band revert is the cautionary tale — sparse-scaffolding mistakes are only visible rendered.

*(Proposed session 148 — confirm with Jesse.)*

---

## Known follow-ons (see `data/backlog.json`)

- **`2026-06-13-001`** — member/hub/admin internal UI still holds hardcoded old teal the token flip didn't reach; sweep.
- **`2026-06-13-002`** — home page alternating sections (`.rim-section--grey` uses `--rim-bg`) flatten on the warm ground; repoint to the Pearl Bush secondary for rhythm.
- **`2026-06-13-003`** — course landing (`/course/[slug]`) still on the old colon-heading language; bring into this system (but **not** the reverted eyebrows/band — match the *shipped* program-page language).

---

*Rooted in Mindfulness · public-page rebuild · begun session 148 (2026-06-13). Evolving — update as the system settles.*
