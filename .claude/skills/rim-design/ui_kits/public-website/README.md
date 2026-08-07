# Public Website UI kit

Recreation of the public rootedinmindfulness.org surfaces from `rim-next` (`app/page.tsx`, `app/community-programs`, `app/programs/[slug]`, `components/Nav.tsx`, `components/Footer.tsx`) and the `hp-` / `pl-` / `pg-` blocks of `public/css/custom.css`.

| File | Source |
|---|---|
| `Home.jsx` | `app/page.tsx` + `hp-` CSS |
| `ProgramsList.jsx` | `app/community-programs/page.tsx` + `pl-` CSS |
| `ProgramDetail.jsx` | `app/programs/[slug]/page.tsx` + `pg-` CSS |

`index.html` wires them into a click-through: home → catalog → a program detail, with the real nav and footer around them.

Content is real RIM copy where the source had it; program titles beyond the homepage schedule are representative, not a live catalog.
