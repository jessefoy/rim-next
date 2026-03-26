# RIM Next — Project Memory

## Session Log

**2026-03-21 (session 71)** — RimBlockEditor full feature build. Bear-inspired toolbar (selection + empty-line pill). Image upload (pill + drag-and-drop, alignment overlay, all-user upload). Advanced tables (split cells, colors, headers, delete button). Heading hierarchy (H1:32px, H2:24px, H3:20px — discovered `data-level` only set by disabled SideMenu, must target `<h1>`/`<h2>`/`<h3>` tags; CSS injected via `<style>` tag on mount). Block type selector dropdown. Document locking (author lock + ADMIN override + presence heartbeat). Blob cleanup (`lib/blobCleanup.ts`). Render fixes: list grouping (`<ul>`/`<ol>` wrappers), image `<figure>`, table `<thead>`/`<tbody>`, BlockNote color token resolution (named tokens → actual hex via `BN_TEXT_COLORS`/`BN_BG_COLORS`). Editor-view parity (injected styles match doc-body). Schema: HubDocument gained `isLocked`, `editingById`, `editingAt`, `addedById`. New: `lib/blobCleanup.ts`, API routes `/lock` + `/presence`. Key files: `RimBlockEditor.tsx`, `HubDocumentEditor.tsx`, `renderRichContent.ts`.

## CSS Architecture Decision (critical)
We are ABANDONING the Webflow CSS approach entirely. Do NOT continue patching `rim.webflow.css` or writing overrides in `custom.css`.

**The plan:**
- Remove dependency on `webflow.css` and `rim.webflow.css`
- Build a new design system from scratch: clean, repeatable, easy to modify
- Three conceptual layers:
  1. **Aesthetic layer** — visual design, typography, color, spacing (our own CSS)
  2. **Content layer** — Sanity CMS, GROQ queries, Portable Text
  3. **Functional layer** — NextAuth, Prisma/PostgreSQL, membership, APIs

**Design system goals:**
- Standardized, logical CSS class names (not Webflow-generated cryptic names)
- Repeatable layout patterns and component sections
- Decentralized — styles close to their components, easy to find and modify

## Design System
- **lp- prefix** for lesson page classes (no Webflow dependencies)
- Fonts: `'quincy-cf'` (Adobe Typekit) for headings, `'Open Sans'` for body/UI, `'Libre Baskerville'` for quotes/blockquotes
- Body text: `#333333`, 17px, line-height 1.8
- Hero bg: `#0d2235` (deep dark navy)
- Dana section bg: `#f7f2ee` (warm cream)
- Content max-width: 800px centered

## Current Status
- Lesson page fully rebuilt with new design system (lp- prefix CSS)
- DanaSection component updated to use new lp-dana classes
- Libre Baskerville added to Google Fonts load in layout.tsx
- Next page to rebuild: program detail page

## Key Files
- `public/css/custom.css` — currently holds overrides (will be replaced)
- `public/css/` — Webflow CSS files (to be removed after new system is built)
