# RIM Website — Improvements Backlog

Prioritized list of things to address as we build forward.
Update this file as items are fixed or discovered.

---

## High Priority (affects live functionality)

- [ ] **Memberstack domain** — add `resilient-dusk-c0e48e.netlify.app` to Live mode
      allowed domains in Memberstack dashboard (user action needed)

- [ ] **Class Recordings** — currently have placeholder test data; need real content
      entered in Sanity Studio. Class Recording Topics collection is also empty.

- [ ] **Other page templates** — audit all pages in `src/` to confirm CMS fields
      are fully fetched (same issue fixed on programs.js — other data files
      may also be missing detail-page fields)

---

## CSS / Layout

- [ ] **Global audit** — the programlistblock fix (flexbox replace) pattern may
      apply to other grid-based layouts sitewide. Audit each page type:
      team member cards, glossary, magazine articles, courses, class recordings

- [ ] **Mobile nav styling** — when hamburger menu opens, the nav items use
      Webflow's existing `.mobile-nav-link` styles which may need tweaking
      for spacing/readability

- [ ] **`place-items` / grid alignment** — scan rim.webflow.css for other
      instances of `place-items: center end` that could misalign content

---

## Content / CMS

- [ ] **Rich text content audit** — programDescription, signedOutInstructions,
      signedInInstructions were imported from HTML; spot-check several programs
      in Sanity Studio to confirm they rendered correctly

- [ ] **Zoom links** — verify in Sanity Studio that all program zoom links
      imported correctly and are current

- [ ] **Program images** — largeProgramImage was uploaded from Webflow CDN
      during import; confirm images display correctly on detail pages

---

## Architecture / Foundation

- [ ] **Incremental builds / webhooks** — set up Sanity → Netlify webhook so
      content changes trigger a rebuild automatically (currently manual deploy needed)
      Netlify: Build hooks → create hook URL → Sanity: Settings → API → Webhooks

- [ ] **Rebuild on content change** — related to above; currently site only
      updates when code is pushed to GitHub

- [ ] **Image optimization** — Sanity images are served via cdn.sanity.io with
      transform params available (e.g. ?w=800&auto=format). Currently serving
      full-size originals. Add width/format params to image URLs in templates.

- [ ] **`alt` text on images** — many `<img>` tags have empty `alt=""`;
      add alt text fields to Sanity schemas where missing

- [ ] **Open Graph / social meta** — base.njk only has basic title/description.
      Add og:image, og:type, Twitter card tags, especially for program pages.

- [ ] **Sitemap** — add eleventy-plugin-sitemap for SEO

- [ ] **404 page** — verify 404.njk renders correctly via Netlify's 404 handling

---

## Migration Readiness (before DNS cutover)

- [ ] Full content QA pass — every page type checked on staging
- [ ] Memberstack: confirm all member-protected pages work in Live mode
- [ ] Forms: test Netlify Forms newsletter signup end-to-end
- [ ] Fillout registration forms: test on a registration-required program
- [ ] GiveButter donate page: confirm donate flow works
- [ ] Redirects: audit all internal links work (no broken hrefs from Webflow .html)
- [ ] Analytics: confirm Google Analytics / Google Ads tags firing
- [ ] Performance: run Lighthouse audit before cutover
