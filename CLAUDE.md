# RIM Next — Claude Instructions

## Workflow
- Build locally with `npm run build` to catch TypeScript errors before pushing.
- Push to GitHub; Vercel auto-deploys on merge to main.
- Keep changes minimal and focused. No over-engineering or speculative improvements.
- Prefer editing existing files over creating new ones.

## Stack
- Next.js 15 (App Router) + TypeScript
- Sanity CMS via `@sanity/client` + GROQ queries
- Auth: NextAuth v5 (`@auth/prisma-adapter`) with Resend magic-link email
- Prisma + PostgreSQL for user/session storage
- CSS: Webflow CSS files served from `public/css/` — do NOT use Tailwind or CSS modules for page layout

## CSS Rules
- Never edit `normalize.css`, `webflow.css`, or `rim.webflow.css` in `public/css/`.
- All custom styles go in `public/css/custom.css` only.
- Use Webflow class names exactly as they appear — they are defined in `rim.webflow.css`.
- Source of truth for correct CSS class names: `rim-website` Eleventy templates at `/Users/jessefoy/Sites/rim-website/src/`.

## Key Files
- `app/layout.tsx` — root layout, loads all CSS + fonts, wraps in `<SessionProvider>`
- `components/Nav.tsx` — full nav (desktop + mobile), loads `nav.js` via useEffect
- `components/Footer.tsx` — footer with Flodesk newsletter form
- `components/ListRow.tsx` — universal list-row card (programs, dashboard, library, course lessons)
- `components/SeriesListItem.tsx` — lesson rows inside course pages (delegates to ListRow)
- `components/DanaSection.tsx` — generosity block at bottom of lesson pages
- `components/TeacherList.tsx` — teacher/facilitator attribution (variant: "lesson" | "program")
- `components/MemberGate.tsx` — auth wall shown to logged-out visitors
- `lib/queries.ts` — all Sanity GROQ queries
- `lib/sanity.ts` — Sanity client config
- `auth.ts` — NextAuth config (Resend + Prisma adapter)
- `prisma/schema.prisma` — database schema
- `public/css/custom.css` — all custom CSS overrides
- `public/nav.js` — Webflow nav script (handles dropdowns + mobile hamburger)

## Sanity / GROQ
- Always exclude drafts: `!(_id in path("drafts.**"))`
- `_type` values are plural (e.g. `"programs"` not `"program"`)
- `dayOfWeek` is an array ref: `dayOfWeek[]->` not `dayOfWeek->`

## Auth Migration Notes
- This project replaces Memberstack (used in `rim-website`) with NextAuth + magic-link email.
- Member-gated content: check session server-side with `auth()` or client-side with `useSession()`.
- `MemberGate` component renders the logged-out message. Program pages use `isLoggedIn` from `auth()`.
- Login flow: `/login` → Resend sends magic link → `/login/check-email` → user clicks link → redirects to `/account/dashboard`.

## CSS Class Patterns (Key Webflow Classes)
- Page sections: `.section`, `.background-white`, `.background-grey`, `.section-10`
- Containers: `.content-container`, `.content-container.centered`, `.content-container.left`
- Program list rows: `.w-layout-grid.programlistblock` → `.dashboard-list-name-and-date-container` → `.event-name`
- Course header: `.course-header` → `.f-container-regular` → `.f-header-wrapper-left`
- Lesson hero: `.section.lesson-hero` → `.lesson-page-heading`
- Lesson resources: `.lesson-resource-block-continer` → `.lesson-resource-item` (flex card: name + button)
- Headings: `.heading-9` (main), `.heading-39` (sub), `.heading-9-copy` (list page), `.course-title`, `.lesson-page-heading`
- Buttons: `.button-2.w-button`, `.button-2-white.w-button`, `.program-list-button.w-button`, `.button-primary.w-button`
- Breadcrumb: `.breadcrumb-link.w-inline-block` → `.text-block-58`
- Dashboard: `.page-wrapper` → `.dashboard-section` → `.dashboard-content`

## Do Not
- Add webflow.js — removed intentionally (conflicts with nav.js)
- Create two nav menus — single `w-nav-menu` required for hamburger
- Use inline styles for layout — put overrides in `custom.css`
- Commit or expose API keys or secrets
- Invent CSS class names — always use classes from `rim.webflow.css` or `custom.css`
