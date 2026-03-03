# Pages Inventory — CSS Migration Status

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
| 🟠 | `/account/dashboard` | `app/account/dashboard/page.tsx` |
| 🟠 | `/account/dashboard-my-library` | `app/account/dashboard-my-library/page.tsx` — ⚠️ stub (hardcoded, links to old Webflow site) |
| 🟠 | `/account/dashboard-my-profile` | `app/account/dashboard-my-profile/page.tsx` |
| 🟠 | `/account/dashboard-member-care-agreements` | `app/account/dashboard-member-care-agreements/page.tsx` |

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

## Progress: 9 / 30 pages migrated 🟢

*(Includes: `/lessons/[slug]`, `/programs/[slug]`, `/account/welcome`, `/volunteer`, `/volunteer/programs/[slug]`, `/admin/members`, `/admin/members/[id]`, `/admin/sitemap`, `/update/[token]`)*

## Remaining 🟠 Pages — Suggested Migration Order (easiest → heaviest)

1. `/login/check-email` — simple single-message layout
2. `/login/error` — simple single-message layout
3. `/login` — form, straightforward
4. `/account/dashboard-my-profile` — small form
5. `/account/dashboard-member-care-agreements` — rich text
6. `/account/dashboard` — Zoom links layout
7. `/account/dashboard-my-library` — ⚠️ stub; needs rebuild before migration makes sense
8. `/diversity` — mostly rich text
9. `/volunteer-positions/[slug]` — detail page
10. `/glossary/[slug]` — detail page
11. `/team/[slug]` — detail page
12. `/magazine-articles/[slug]` — article layout
13. `/kalyana-mitta/*` — 3 pages, similar patterns
14. `/volunteerism/volunteer` — public; note: interest form still has no backend
15. `/volunteerism/volunteer-thanks-for-your-interest` — ⚠️ orphan; consider deleting instead
16. `/community-membership` — repurposed; Webflow classes but minimal content, low priority
17. `/course/[slug]` — course detail
18. `/community-programs` — listing page
19. `/donate` — GiveButter widgets
20. `/` — home page (most complex, last)
