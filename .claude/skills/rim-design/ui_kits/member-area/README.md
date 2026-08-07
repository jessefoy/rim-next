# Member Area UI kit

Recreation of the signed-in RIM surfaces from `rim-next` (`components/Nav.tsx` member branch, `components/AccountSidebar.tsx`, `app/account/dashboard`, `app/account/dashboard-my-profile`) and the `member-bar` / `ac-` / `db2-` / `today-` / `mr-` / `zoom-launch-` blocks of `public/css/custom.css`.

| File | Source |
|---|---|
| `Dashboard.jsx` | `app/account/dashboard` + `db2-`/`today-` CSS |
| `Registrations.jsx` | `app/account/dashboard-my-registrations` + `mr-`/`lr-` CSS |
| `Profile.jsx` | `app/account/dashboard-my-profile` + `mp-` CSS |

`index.html` runs the click-through: sign-out → passwordless sign-in → dashboard → Join (Zoom handoff) → registrations → profile (save shows the success state).

**Not recreated:** the Host Hub workspace (conversations, files, schedule, rotations), the registrar and admin tools, and the LiveKit video session — those are large internal surfaces in `rim-next` and are called out as blank rather than invented.
