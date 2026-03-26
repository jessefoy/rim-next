# RIM Pages Inventory

**Reference paths:**
- Webflow export: `/Users/jessefoy/Sites/rim-website/webflow-export/rim.webflow/`
- Eleventy templates: `/Users/jessefoy/Sites/rim-website/src/`
- rim-next app: `/Users/jessefoy/Sites/rim-next/app/`

---

## Progress Summary

| Status | Count | Pages |
|--------|-------|-------|
| 🟢 Design System | 3 | `/lessons/[slug]`, `/class-recording/[slug]`, `/programs/[slug]` |
| 🟠 Webflow (to migrate) | ~21 | All other pages |
| ⏭️ Skipped / Decommissioned | 4 | search, waiting room, commenting, work-in-progress |
| ⚠️ Not yet built | 2 | access denied, group detail form |

## Shared Components (not pages, but design-system ready)

| Component | Status | Notes |
|-----------|--------|-------|
| `components/Footer.tsx` | 🟢 Design System | `rim-footer*` classes, `var(--font-serif)` headings, bg `#3C4A51` |
| `components/Nav.tsx` | 🟠 Webflow | Uses Webflow nav classes |

**End state:** remove these 3 lines from `app/layout.tsx`:
```
<link rel="stylesheet" href="/css/normalize.css" />
<link rel="stylesheet" href="/css/webflow.css" />
<link rel="stylesheet" href="/css/rim.webflow.css" />
```

---

## Shared Reading-Column Utilities (reusable across all 🟢 pages)

These `lp-` classes live in `custom.css` and can be used by any design-system page — no duplication needed.

| Class | Purpose |
|-------|---------|
| `.lp-content` | Centered reading column (`max-width: 640px`, padding) |
| `.lp-label` | ALL-CAPS small category label above title |
| `.lp-body` | PortableText rich text — Open Sans 17px/1.8 |
| `.lp-video` | 16:9 responsive iframe embed |
| `.lp-divider` | Short centered decorative rule |
| `.lp-teacher` `.lp-teacher__photo` `.lp-teacher__by` `.lp-teacher__name` | Teacher byline row |
| `.lp-pullquote` `.lp-pullquote__cite` | Hero pull quote — centered, large `"` mark (absolute position, `::before`), italic serif, balanced spacing |
| `.lp-callout` `.lp-callout__title` `.lp-callout__content` | Practice Suggestion box — warm bg, teal left border, rich text (bold/italic/lists) |
| `.lp-body-quote` `.lp-body-quote__text` `.lp-body-quote__cite` | Inline body quote — smaller italic serif, left rule, attribution below |
| `.lp-dana` | Dana/donation callout block |

---

## CSS Layer Legend

Every page in rim-next falls into one of two CSS layers:

- **🟠 Webflow** — JSX uses raw Webflow class names; `custom.css` patches/overrides them. Still depends on `rim.webflow.css` being loaded.
- **🟢 Design System** — JSX uses only prefixed classes + CSS variables (`var(--rim-*)`). Zero Webflow class dependencies.

**How to tell which layer a page is on:**
- Open the page's `.tsx` — if you see class names like `section`, `w-section`, `f-header-wrapper`, `background-white`, `w-richtext` → it's 🟠 Webflow
- If you only see prefixed classes and no Webflow names → it's 🟢 Design System

**Goal:** Migrate all pages to 🟢, then remove the three Webflow CSS imports from `layout.tsx`.

---

## CMS Template Pages (dynamic, slug-based)

| Page Type | Route | rim-next page.tsx | CSS Layer |
|-----------|-------|-------------------|-----------|
| Lessons | `/lessons/[slug]` | `lessons/[slug]/page.tsx` | 🟢 Design System — `lp-` prefix, no Webflow classes |
| Courses | `/course/[slug]` | `course/[slug]/page.tsx` | 🟠 Webflow — uses `f-header-wrapper-left`, `rich-text-block-19`, etc. |
| Programs | `/programs/[slug]` | `programs/[slug]/page.tsx` | 🟢 Design System — `pg-` prefix, floating details card, `#93A2AA` hero |
| Class Recordings | `/class-recording/[slug]` | `class-recording/[slug]/page.tsx` | 🟢 Design System — `cr-` prefix, reuses `lp-content/body/video/divider` |
| Team Members | `/team/[slug]` | `team/[slug]/page.tsx` | 🟠 Webflow |
| Glossary Terms | `/glossary/[slug]` | `glossary/[slug]/page.tsx` | 🟠 Webflow |
| Magazine Articles | `/magazine-articles/[slug]` | `magazine-articles/[slug]/page.tsx` | 🟠 Webflow |
| Volunteer Positions | `/volunteer-positions/[slug]` | `volunteer-positions/[slug]/page.tsx` | 🟠 Webflow |

---

## Static Public Pages

| Page | Route | rim-next page.tsx | CSS Layer |
|------|-------|-------------------|-----------|
| Homepage | `/` | `page.tsx` | 🟠 Webflow |
| Community Programs | `/community-programs` | `community-programs/page.tsx` | 🟠 Webflow — `programlistblock` partially overridden |
| Donate | `/donate` | `donate/page.tsx` | 🟠 Webflow |
| Diversity | `/diversity` | `diversity/page.tsx` | 🟠 Webflow |
| Community Membership | `/community-membership` | `community-membership/page.tsx` | 🟠 Webflow |
| Search | `/search` | — | ⏭️ Skipped |

---

## Kalyana-Mitta Pages

| Page | Route | rim-next page.tsx | CSS Layer |
|------|-------|-------------------|-----------|
| Community Groups & Events | `/kalyana-mitta/community-groups-events` | `kalyana-mitta/community-groups-events/page.tsx` | 🟠 Webflow |
| Guidelines for Starting a Group | `/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group` | `kalyana-mitta/.../page.tsx` | 🟠 Webflow |
| Group Application | `/kalyana-mitta/kalyana-mitta-group-application` | `kalyana-mitta/.../page.tsx` | 🟠 Webflow |
| Group Detail Form | `/kalyana-mitta/kalyana-mitta-group-detail-form` | — | ⚠️ Not built |

---

## Volunteerism Pages

| Page | Route | rim-next page.tsx | CSS Layer |
|------|-------|-------------------|-----------|
| Volunteer | `/volunteerism/volunteer` | `volunteerism/volunteer/page.tsx` | 🟠 Webflow |
| Volunteer Thanks | `/volunteerism/volunteer-thanks-for-your-interest` | `volunteerism/.../page.tsx` | 🟠 Webflow |

---

## Auth Pages

| Page | Route | rim-next page.tsx | CSS Layer |
|------|-------|-------------------|-----------|
| Login | `/login` | `login/page.tsx` | 🟠 Webflow |
| Check Email | `/login/check-email` | `login/check-email/page.tsx` | 🟠 Webflow |
| Login Error | `/login/error` | `login/error/page.tsx` | 🟠 Webflow |
| Sign Up | `/community-membership` | `community-membership/page.tsx` | 🟠 Webflow |
| Access Denied | — | — | ⚠️ Not built |

---

## Member Area Pages

| Page | Route | rim-next page.tsx | CSS Layer |
|------|-------|-------------------|-----------|
| Dashboard | `/account/dashboard` | `account/dashboard/page.tsx` | 🟠 Webflow |
| My Library | `/account/dashboard-my-library` | `account/dashboard-my-library/page.tsx` | 🟠 Webflow |
| My Profile | `/account/dashboard-my-profile` | `account/dashboard-my-profile/page.tsx` | 🟠 Webflow |
| Member Care Agreements | `/account/dashboard-member-care-agreements` | `account/dashboard-member-care-agreements/page.tsx` | 🟠 Webflow |
| Waiting Room | — | — | ⏭️ Decommissioned |
| Commenting Test | — | — | ⏭️ Decommissioned |

---

## Error / Utility Pages

| Page | Route | rim-next | CSS Layer |
|------|-------|----------|-----------|
| 404 Not Found | `/not-found` | `not-found.tsx` | 🟠 Webflow |
| 401 Unauthorized | — | — | ⚠️ Not built |

---

## Intentionally Not Migrated (Webflow-specific or decommissioned)

| File | Reason |
|------|--------|
| `checkout.html`, `order-confirmation.html`, `detail_product.html`, `detail_sku.html`, `detail_category.html` | Webflow ecommerce — not used |
| `reset-password.html`, `update-password.html`, `password/*`, `log-in.html`, `user-account.html` | Replaced by NextAuth magic link |
| `detail_class-recording-topics.html`, `detail_weekdays.html`, `detail_program-categories.html`, `detail_resources.html` | CMS types not used in rim-next |
| `home-temp.html` | Webflow temp page |
| `work-in-progress/*` | Not migrating |
| `site-resources/style-guide.html` | Internal Webflow reference only |
