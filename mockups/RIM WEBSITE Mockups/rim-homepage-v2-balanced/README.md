# Rooted in Mindfulness — Balanced Programs Revision

This is a separate revision of the refined Version 2 site. Earlier versions remain preserved.

## What changed

The Programs page was rebuilt so it no longer speaks almost exclusively to first-time visitors. It now supports people beginning, returning, deepening, seeking community, attending retreats, and accessing the member area.

The visual treatment is quieter:

- neutral program lists rather than a different gradient on every card;
- color used at the program-family level;
- a smaller hero and more restrained typography;
- clear schedules and formats visible without clicking;
- no filters or unfamiliar interface controls;
- explicit links for current offerings, first visits, and members.

Read `PROGRAMS-BALANCE-REVIEW.md` for the full rationale and persona mapping.

## Main files

- `programs.html` — revised programs directory
- `styles.css` — shared site styles plus the balanced programs system
- `script.js` — navigation and reveal behavior
- `screenshots/programs-desktop.png`
- `screenshots/programs-mobile.png`

## Prototype notes

All forms, authentication, registrations, program data, and member functions remain front-end prototypes. Program content should be rendered from the production CMS. The HTML includes `data-cms-*` attributes to indicate collection and field boundaries.
