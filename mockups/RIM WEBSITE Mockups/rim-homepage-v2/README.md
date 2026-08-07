# Rooted in Mindfulness — Site Concept V2

This is a separate prototype. It does not overwrite or replace `/mnt/data/rim-homepage`.

## Content architecture

### Public journey
1. **Home** — emotional recognition, reassurance, one recommended gathering, weekly preview, depth, belonging.
2. **New Here** — literal first-visit expectations, practical questions, and one recommended first step.
3. **Programs** — CMS-driven directory with visible schedule, format, commitment, and dana information.
4. **This Week** — CMS-driven date view optimized for scanning in under ten seconds.
5. **Program Detail** — reusable CMS template modeled on a book jacket: promise, description, practical panel, experience, facilitator, CTA.
6. **Teachings** — freely offered resources and clear Buddhist roots.
7. **Community** — belonging, Kalyana Mitta, member voices, and deeper participation.
8. **About** — tradition, purpose, guiding teacher, and organizational grounding.
9. **Join RIM** — separates a free account from deeper community membership.
10. **Support RIM** — dana and specific volunteer paths.

### Member journey
11. **Login** — focused sign-in with no public-site distractions.
12. **Member Dashboard** — today’s links first, followed by upcoming programs, learning, and community notices.

## Navigation decision

Primary public navigation: **New here · Programs · This week · Teachings · Community · About**

A visually distinct **Member sign in** action is always available. Support and membership links are in the footer and contextual sections rather than competing with the first invitation to attend.

## CMS model

The prototype includes attributes such as `data-cms-template`, `data-cms-field`, `data-cms-block`, and `data-cms-collection` to show intended bindings.

Program cards and detail pages should share these fields:
- title
- slug
- type/category
- short description
- long description
- recurrence / dates
- start and end time
- timezone
- format
- location
- commitment level
- experience level
- dana / fee language
- primary CTA label and destination
- optional first-visit badge
- optional quote
- optional highlights
- one or more facilitators

Optional blocks should be conditionally removed when empty.

## Notes

- Newsletter, login, Zoom, account creation, registration, and donation actions are demonstration links.
- Weekly dates are static prototype content and should come from the event database in production.
- Actual community-care agreements should replace the placeholder copy on `join.html`.
- The design deliberately uses member voices and transparent descriptions while original community photography is not yet available.
