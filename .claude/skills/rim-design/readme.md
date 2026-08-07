# Rooted in Mindfulness — Design System

> **Installed as a project skill at `.claude/skills/rim-design/` (session 169).**
>
> **`public/css/custom.css` remains the single source of truth.** The tokens here
> are a verified copy of it, not a parallel system — when the two disagree, the
> stylesheet wins and this package is what needs updating. Do not link `styles.css`
> into the app; the app already loads `custom.css`.
>
> Use this skill for: prototypes and throwaway mocks, checking a rule before
> writing CSS, and pulling assets for artifacts. Not for: introducing a token,
> colour, or size that isn't already in `custom.css`.
>
> **Known stale:** `_ds_bundle.js` is a prebuilt bundle that still contains the
> retired paper-panel `HeroPanel`. The source component in
> `components/content/` is correct; the bundle was not rebuilt.

**Rooted in Mindfulness (RIM)** is a Buddhist-rooted meditation and dharma community in Brookfield, Wisconsin — a 501(c)(3) nonprofit. Everything RIM offers is free, sustained by *dana* (generosity): drop-in sittings, multi-week courses, dharma study, qigong, community groups, and a member area for registration and team coordination. Jesse Foy is the founding and guiding teacher.

The visual language is deliberately quiet: white surfaces on a warm Pampas ground, an editorial serif for headings, generous body text, one blue, one shadow, and almost no motion. The design's job is to get out of the way.

## Sources

| Source | What it gave us |
|---|---|
| `rim-next/` (local Next.js codebase, read-only mount) | The whole system. `public/css/custom.css` (28,654 lines) is the single source of truth for tokens, type, and every page block. |
| `rim-next/app/style-guide/page.tsx` + the `sg-` CSS block | RIM's own calibration page — colour roles, type, common elements, feedback states. |
| `rim-next/public/fonts/` | Quincy CF webfonts (self-hosted, all weights + italics). Copied into `assets/fonts/`. |
| `rim-next/public/images/`, `public/videos/` | Logos, nature photography, legacy program-detail icon PNGs. |
| `rim-next/memory/pages-inventory.md` | Route map and CSS-migration status per page. |

No Figma file, brand book, or slide template was provided. There are therefore **no sample slides** in this system.

## Products

1. **Public website** — homepage, community programs catalog, program detail, teachers, donate, diversity, kalyana mitta, volunteerism. UI kit: `ui_kits/public-website/`.
2. **Member area** — signed-in dashboard ("today" + "coming up"), registrations, course library, profile, community care agreements, Zoom handoff. UI kit: `ui_kits/member-area/`.
3. **Internal tools** (host hub, registrar, admin, LiveKit video sessions) — large surfaces in `rim-next`, **not** recreated here. They reuse the same tokens with `hub-`, `vol-`, `adm-`, `adm2-`, `rim-` prefixes.

---

## CONTENT FUNDAMENTALS

RIM writes like a person who has already made room for you. The prose is plain, warm, unhurried, and never sells.

**Voice**
- **"We" for the community, "you" for the reader.** "We sit together, we study the teachings." / "Whatever brought you here, you're welcome."
- **Second person is an invitation, never an instruction.** "Come when you can, as often as you like." Not "Sign up now."
- **Never manages the reader.** Body copy is described in the source CSS as "deliberately generous: it gives the reader room to arrive… without feeling managed by the page."
- **Names the real reason someone is here, including the hard one.** "Some are going through something hard and need a place where they don't have to explain themselves."
- **Removes barriers explicitly and early.** "No experience needed. No fees." / "You don't need to be Buddhist to practice here."

**Casing and punctuation**
- Sentence case everywhere. Titles are sentence case with occasional Title Case for named programs ("The Art of Meditation", "Foundations of Mindfulness").
- ALL CAPS appears in exactly two places: the uppercase eyebrow label (11px, letter-spaced) and the DONATE pill.
- Arrows close links: "See All Programs →", "About Our Teachers →". Back links use "← Back to RIM".
- Middot `·` separates facts in a meta row: "Wednesdays · 10:00 AM · Online".
- Pāli terms are italicised on first use and glossed inline: "in the spirit of *dana* — a Pāli word meaning generosity of heart, mind, and action."
- Em dashes are frequent; they carry the conversational rhythm.

**Error and system copy is human, never technical.**
"Something needs fixing. Check the highlighted field and try again." · "Please note. This action needs your attention." · "Please enter your email address." Never a code, never "invalid".

**Testimonials are anonymous.** Always "— Community member". The teacher is "— Jesse".

**Emoji:** essentially none. The whole codebase contains one — 🙏 in the newsletter thank-you ("Thank you! You're on the list. 🙏"). Do not add more. The footer's "Powered by Kind People :)" uses a typed smiley, not an emoji, and is part of the brand's voice.

**Things RIM never says:** "unlock", "transform your life", "join today", "limited spots", "sign up now", "our mission is to". Nothing urgent, nothing aspirational-marketing.

---

## VISUAL FOUNDATIONS

**Colour.** The page recedes into Pampas (`#f5f3f0`); the content people read and act on rests on white. One blue does everything — `#31576d` for actions, hero bands, and the footer, hovering to `#39607a`. `#0d2235` deep navy exists only inside hero scrims. Text is three greys used strictly by role (`#333` body, `#555` quotes, `#666` captions). The only warm accent in the entire system is the donate red `#c23b3b`. Semantic feedback colours (green/amber/red) appear as background+accent pairs and nowhere else.

**Type.** Quincy CF (self-hosted, weight 400 almost always) for headings, pull quotes, program names, and card titles. Open Sans for everything else. The scale is locked at ten sizes — do not invent an eleventh. Body is 18px / 1.7 for editorial and 14px for interface density. Line height is 1.3 for headings, 1.7 for body. The one recurring exception is 17px in program detail rows, inherited from the Webflow original.

**Spacing and layout.** Sections breathe at 96px top and bottom (64px under 768px, 48px under 430px). The container is 1140px with 40px side padding; long-form prose is capped at a 700px reading column; catalogs sit at 900px. Fixed chrome: 100px public nav (sticky white), 68px member bar (sticky, `--rim-bg-bright`), 248px account rail collapsing to 64px. Tap targets are never under 44px.

**Backgrounds.** No gradients as decoration. The homepage hero is a looping bodhi-leaf **video** at 100% cover under a flat `rgba(12,18,22,0.38)` scrim, with the copy left-aligned directly on the footage. Program and catalog heroes are nature photography under a **linear blue-to-navy scrim** (`--rim-blue` 84% → `--rim-dark` 91% vertically; a left-to-right variant on the catalog). Everything else is a flat colour. No patterns, no textures, no noise, no illustration.

**Imagery.** Quiet nature, cool-to-neutral light, no people's faces in hero positions — bodhi leaves, pine canopy, forest path, still water, hands on a tree. Always scrimmed when text sits over it. Never warm-graded, never black and white, never grainy.

**Cards.** White, 10px radius (12px for list/program cards, 16px for quote and details cards), and exactly **one** shadow in the whole system: `0 1px 2px rgba(45,38,28,.03), 0 4px 11px rgba(45,38,28,.035)` — described in the source as "deliberately a whisper". Member-area cards often use a 1px `--rim-rule` border *instead of* lift. Panels (`--rim-bg-accent`) never lift at all.

**Borders and rules.** `#dedbd7` warm-neutral hairlines separate schedule rows, detail rows, list items, and sections. A 3px top rule sits above testimonials. A 3px **left** border appears only on inline state messages and the homepage closing quote — never as a decorative card accent.

**Buttons.** Always pills (`9999px`). Primary is filled blue; secondary is white with a blue rule; ghost is a bare blue label; donate is the red pill. Minimum height 44px, 14px semibold label. The single uppercase, letter-spaced button in the system is the homepage hero CTA (32px radius, not a full pill — a Webflow inheritance).

**Hover.** Buttons darken/shift fill to `--rim-mid`; some legacy buttons drop to `opacity: 0.85`. Links underline. Cards shift their **fill** to `--rim-bg-bright` — never their shadow, never a lift. Nav links pick up a `--rim-bg` background. Hero CTA arrows nudge 4px right.

**Press.** Nothing. There is no active/pressed treatment anywhere in the system — no colour change, no shrink, no transform.

**Focus.** `outline: 2px solid var(--rim-mid); outline-offset: 2px`. Consistent, visible, never removed.

**Disabled.** `opacity: 0.4–0.5`, `cursor: default`, and for buttons the fill flattens to `--rim-mid`.

**Animation.** Almost none. Transitions are 0.15s on colour/background/border only. Chevrons rotate 180°. The hero arrow translates 4px. No scale, no bounce, no spring, no parallax, no entrance or scroll animation. The only moving image on the site is the hero video loop.

**Transparency and blur.** No backdrop blur anywhere. Transparency is used for exactly two things: hero scrims over imagery, and white-on-blue text tiers in the footer (`rgba(255,255,255,.92/.88/.75/.5)`). (A 95%-opaque white hero paper panel existed through session 168 and was retired in 169 — hero copy now sits directly on the scrim.) `color-mix()` builds the scrims from the blue tokens rather than hardcoding.

**Protection.** Text over imagery is always protected by a full-bleed scrim — never by a text-shadow, never by a partial capsule, and (since session 169) never by a paper panel.

**Layout rules.** Public nav and member bar are sticky; nothing else is fixed. Mobile breaks at 768px and 430px. No horizontal scroll ever (`overflow-x: clip` on `html`).

---

## ICONOGRAPHY

- **Lucide (`lucide-react`) is the active icon system**, used at **17px with `strokeWidth={1.75}`** in the account rail and hub sidebars, and 15–20px elsewhere. Icons in this system are loaded from the Lucide UMD CDN (`unpkg.com/lucide@0.469.0`) — the codebase's own set, not a substitute.
- Names actually used in `rim-next`: `Home, CalendarCheck, BookOpen, UserCircle, Users, UsersRound, HouseHeart, Layers, Mail, Settings, ChevronDown, ChevronsLeft, ChevronsRight, ShieldCheck, ArrowLeft, Pin, Pencil, Trash2, Check, Plus, X, MoreHorizontal, SmilePlus, Bell, BellOff, MessageSquare, FileText, CalendarDays, UserPlus`.
- **Legacy PNG icons** from the Webflow era still appear on program detail rows: `Date.png`, `Time.png`, `Location.png`, `Dana.png`, `Registration.png`. Copied to `assets/icons/`. Use Lucide for new work.
- **Loose SVGs** copied in: `Text-Accent-Line.svg` (decorative rule under headings), `magnifying-glass.svg`, `file-upload.svg`, `profile-placeholder.svg`.
- **A `fontello` icon font** (`assets/fonts/fontello.*`) ships in the codebase but is **not referenced by the active stylesheet** — it is a Webflow leftover. Copied for completeness; do not use it.
- **Unicode as iconography:** `▾` dropdown caret, `·` meta separator, `→`/`←` link arrows, `•` custom list bullet. These are intentional and should be preserved.
- **Emoji as iconography: never.** (One 🙏 exists, in the newsletter confirmation.)
- **Avatars** are initial-only circles on `--rim-bg-accent` with a `--rim-blue` letter. No photos.

---

## Index

| Path | What's in it |
|---|---|
| `styles.css` | The single entry point consumers link. `@import` lines only. |
| `tokens/fonts.css` | Quincy CF `@font-face` rules (8 faces). Open Sans comes from Google Fonts. |
| `tokens/colors.css` | Base palette, verbatim from `custom.css`. |
| `tokens/typography.css` | Font stacks, the locked ten-step scale, line heights, eyebrow tracking. |
| `tokens/spacing.css` | Spacing scale, container/reading widths, chrome heights. *(Derived — see additions below.)* |
| `tokens/radius-shadow.css` | Radii, the one card shadow, transition durations. |
| `tokens/semantic.css` | Role aliases (`--surface-card`, `--action-primary`, `--text-link`…). |
| `tokens/base.css` | Global element defaults mirroring `custom.css` base typography. |
| `guidelines/*.card.html` | 18 foundation specimen cards (Colors, Type, Spacing, Brand). |
| `assets/fonts/` | Quincy CF woff2 ×8, fontello (legacy, unused). |
| `assets/logo/` | Roundel, white footer roundel, favicon. |
| `assets/images/` | Nature photography and the hero video poster. |
| `assets/icons/` | Legacy program PNGs and loose SVGs. |
| `components/core/` | Button, Card, Panel, Badge, Eyebrow, StateMessage, TextField |
| `components/content/` | ListRow, ProgramCard, PullQuote, DetailRow, Testimonial, ScheduleRow, HeroPanel |
| `components/navigation/` | SiteNav, SiteFooter, MemberBar, AccountSidebar |
| `templates/marketing-page/` | **Template** — public RIM page: hero, welcome, weekly schedule, voices, teal band, footer |
| `templates/member-page/` | **Template** — signed-in shell: member bar, account rail, personal home |
| `ui_kits/public-website/` | Home → catalog → program detail, click-through |
| `ui_kits/member-area/` | Sign-in → dashboard → Zoom handoff → registrations → profile |
| `SKILL.md` | Agent Skills wrapper for use in Claude Code. |

### Intentional additions

- **Spacing scale** (`tokens/spacing.css`) — `custom.css` uses literal pixel values with no named scale. The tokens here are measured from real usage, not invented; every value appears in the source.
- **Semantic aliases** (`tokens/semantic.css`) — role names layered over the existing `--rim-*` base tokens, so consumers can reason about surfaces instead of colours. The base tokens remain authoritative.
- **`Eyebrow`, `Badge`, `StateMessage`, `TextField`** — these exist in `custom.css` as repeated class patterns (`sg-eyebrow`/`pl-hero__eyebrow`, `db2-chip`/`today-live-badge`, `sg-state`, `sg-card input`) rather than as named React components. Promoting them keeps consumers from re-deriving them.

### Not built

- **Slide templates.** No deck or slide source was provided; none were invented.
- **Host hub, registrar, and admin UI kits.** These are extensive internal surfaces (`hub-`, `vol-`, `adm-`, `adm2-`, `hs-`, `pe-` prefixes, ~15,000 lines of CSS). Ask if you want any of them recreated.
- **LiveKit video session UI.** Dark-themed, third-party-driven, and outside the RIM light palette.
