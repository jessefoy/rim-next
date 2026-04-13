# Pages Inventory — CSS Migration Status

> **Scope note:** This file tracks CSS migration from Webflow classes to the design system 
> for pages that existed before the hub/tools build-out. It is NOT a complete route inventory. 
> For the full site map, see `/admin/sitemap`.

🟢 = Design system only (no Webflow class names). Safe from Webflow CSS conflicts.
🟠 = Still uses Webflow class names. Depends on normalize.css, webflow.css, rim.webflow.css.

Once ALL pages are 🟢, delete the three Webflow CSS `<link>` tags from `app/layout.tsx`.

---

## Public Pages

| Status | Route | File |
|---|---|---|
| 🟠 | `/` | `app/page.tsx` |
| 🟠 | `/community-programs` | `app/community-programs/page.tsx` |
| 🟢 | `/programs/[slug]` | `app/programs/[slug]/page.tsx` — prefix: `pg-` |
| 🟠 | `/donate` | `app/donate/page.tsx` |
| 🟠 | `/community-membership` | `app/community-membership/page.tsx` — repurposed; minimal content, low migration priority |
| 🟠 | `/course/[slug]` | `app/course/[slug]/page.tsx` |
| 🟠 | `/glossary/[slug]` | `app/glossary/[slug]/page.tsx` |
| 🟢 | `/lessons/[slug]` | `app/lessons/[slug]/page.tsx` — prefix: `lp-` |
| 🟠 | `/magazine-articles/[slug]` | `app/magazine-articles/[slug]/page.tsx` |
| 🟠 | `/volunteer-positions/[slug]` | `app/volunteer-positions/[slug]/page.tsx` |
| 🟠 | `/team/[slug]` | `app/team/[slug]/page.tsx` |
| 🟠 | `/diversity` | `app/diversity/page.tsx` |
| 🟠 | `/kalyana-mitta/community-groups-events` | `app/kalyana-mitta/community-groups-events/page.tsx` |
| 🟠 | `/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group` | `app/kalyana-mitta/guidelines-.../page.tsx` |
| 🟠 | `/kalyana-mitta/kalyana-mitta-group-application` | `app/kalyana-mitta/kalyana-mitta-group-application/page.tsx` |
| 🟠 | `/volunteerism/volunteer` | `app/volunteerism/volunteer/page.tsx` |
| 🟠 | `/volunteerism/volunteer-thanks-for-your-interest` | `app/volunteerism/volunteer-thanks-.../page.tsx` — ⚠️ orphan (form has no action URL) |

## Auth & Onboarding Pages

| Status | Route | File |
|---|---|---|
| 🟠 | `/login` | `app/login/page.tsx` |
| 🟠 | `/login/check-email` | `app/login/check-email/page.tsx` |
| 🟠 | `/login/error` | `app/login/error/page.tsx` |
| 🟢 | `/account/welcome` | `app/account/welcome/page.tsx` — prefix: `wl-` |

## Member Area

| Status | Route | File |
|---|---|---|
| 🟢 | `/account/dashboard` | `app/account/dashboard/page.tsx` — prefix: `db-` |
| 🟢 | `/account/dashboard-my-registrations` | `app/account/dashboard-my-registrations/page.tsx` — prefix: `mr-` (new) |
| 🟢 | `/account/dashboard-my-library` | `app/account/dashboard-my-library/page.tsx` — prefix: `ml-` |
| 🟢 | `/account/dashboard-my-profile` | `app/account/dashboard-my-profile/page.tsx` — prefix: `mp-` |
| 🟢 | `/account/dashboard-member-care-agreements` | `app/account/dashboard-member-care-agreements/page.tsx` — prefix: `mc-` |

## Volunteer / Registrar Area

| Status | Route | File |
|---|---|---|
| 🟢 | `/volunteer` | `app/volunteer/page.tsx` — prefix: `vol-` |
| 🟢 | `/volunteer/programs/[slug]` | `app/volunteer/programs/[slug]/page.tsx` — prefix: `vol-` |

## Admin Area

| Status | Route | File |
|---|---|---|
| 🟢 | `/admin/members` | `app/admin/members/page.tsx` — prefix: `adm-` |
| 🟢 | `/admin/members/[id]` | `app/admin/members/[id]/page.tsx` — prefix: `adm-` |
| 🟢 | `/admin/sitemap` | `app/admin/sitemap/page.tsx` — prefix: `adm-sm-` |

## Utility (no nav)

| Status | Route | File |
|---|---|---|
| 🟢 | `/update/[token]` | `app/update/[token]/page.tsx` — token-gated self-service edit |

---

## Progress: 14 / 31 pages migrated 🟢

*(Includes: `/lessons/[slug]`, `/programs/[slug]`, `/account/welcome`, `/account/dashboard`, `/account/dashboard-my-registrations`, `/account/dashboard-my-library`, `/account/dashboard-my-profile`, `/account/dashboard-member-care-agreements`, `/volunteer`, `/volunteer/programs/[slug]`, `/admin/members`, `/admin/members/[id]`, `/admin/sitemap`, `/update/[token]`)*

## Remaining 🟠 Pages — Suggested Migration Order (easiest → heaviest)

1. `/login/check-email` — simple single-message layout
2. `/login/error` — simple single-message layout
3. `/login` — form, straightforward
4. `/diversity` — mostly rich text
5. `/volunteer-positions/[slug]` — detail page
6. `/glossary/[slug]` — detail page
7. `/team/[slug]` — detail page
8. `/magazine-articles/[slug]` — article layout
9. `/kalyana-mitta/*` — 3 pages, similar patterns
10. `/volunteerism/volunteer` — public; note: interest form still has no backend
11. `/volunteerism/volunteer-thanks-for-your-interest` — ⚠️ orphan; consider deleting instead
12. `/community-membership` — repurposed; Webflow classes but minimal content, low priority
13. `/course/[slug]` — course detail
14. `/community-programs` — listing page
15. `/donate` — GiveButter widgets
16. `/` — home page (most complex, last)
