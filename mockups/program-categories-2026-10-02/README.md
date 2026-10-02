# Program categories screenshots (2026-10-02)

Reference only, for Jesse's review of the mapping table. Nothing here is a spec, and nothing here is live.
Rendered locally from the branch `program-categories-2026-10-02` (no dev server), at 1280 (desktop) and
375 (phone, 2x). The public pages are server-rendered with a read-only copy of the production program data
**with the proposed mapping applied to the copy**; production itself has not been written.

- `programs-page-*`: Programs & Events, sections read from Category. Format labels and "Hosted by volunteers" on the cards, the "Silent meditation" subheading with its line, Foundations' static card, Immersion's "Upcoming dates will be listed here.", Community Groups, Special Events.
- `this-week-*`: the drop-in mark, read from Format.
- `program-silent-sit-*`: a silent sit's page. Breadcrumb "Ongoing Learning & Practice · Drop-in", the "Hosted by volunteers" row, the shared block.
- `program-drop-in-*`: Meditation and Dharma Talk's page (the Saturday page that carried the old "Drop-Ins: Open Practice and Learning." breadcrumb).
- `program-manager-category-format-*`: the real `ProgramEditor`, hydrated: the Category and Format dropdowns with their helper lines, the Silent meditation and Hosted by volunteers checkboxes, the read-only old category.
- `program-manager-course-no-silent-checkbox-*`: Format = Course, where the Silent meditation checkbox is absent (it appears only for Drop-in).
- `program-manager-validation-format-*`, `program-manager-validation-category-*`: the two validation messages (a way without a format; no category).
- `program-manager-list-*`: the admin program list with the Category and Format filters and columns.
