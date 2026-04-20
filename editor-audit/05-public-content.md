# Editor Audit — Sweep 5: Public-Facing Authored Content (Four-Type Framing)

**Status:** Draft. Final Stage 1 sweep. Review with Jesse, then move to Stage 2.
**Source:** Every public and member-facing route that renders authored content, as of session 89.
**Reference:** `RIM_Editor_Types.md` (canonical).

**Scope:** Sweep 5 focuses on **rendering** — where authored content is displayed to members and the public, and whether each render site uses the correct output wrapper. It cross-references the schema (Sweep 1), Sanity (Sweep 2), and tools (Sweeps 3–4) from the read side.

---

## Public page render sites

### Home (`/`)

The marketing homepage. All content is static or template-driven. No authored content renders here (no `<PortableText>`, no `renderRichContent` call).

**Recommendation:** No action.

---

### Community Programs list (`/community-programs`)

Lists all programs in the `pl-` prefix design. Each program renders via `ListRow` using template data (name, tagline, schedule, category). The `Program.description` (Page Designer) content is **not** shown on this list — it's rendered only on the detail page.

**Recommendation:** No action. List uses template data, which is correct.

---

### This Week schedule (`/this-week`)

Lists programs occurring this week by day of week. Also template-data only.

**Recommendation:** No action.

---

### Program Detail — public (`/programs/[slug]`)

**What the visitor sees:** Hero with title, image, teal overlay · icon detail rows (schedule, location, format) · optional pull quote · main description · optional special notes · CTA row (register, donate, etc.)

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `Program.description` | `renderContentBodyAsync` → inner HTML | `rim-content rim-content--program prog-description` | Correct (Page Designer output) |
| `Program.specialNotes` | `renderFormattedTextAsync` → inner HTML | `rim-content rim-content--program prog-description` (inside `.pg-notes`) | **Sunset target** — becomes a Special Note block inside description in Stage 2d |
| `Program.pullQuote` + `pullQuoteSource` | fixed template slot with `.pg-quote` | template | **Sunset target** — becomes a Pull Quote block |
| `Program.danaMessage` | `<div class="pg-dana__message">` | `pg-dana__message` | **Sunset target** (on-page version) — becomes Dana Invitation block |

**Recommendation:** The sunset targets render correctly today; migration (Stage 2d) will move them from fixed template slots into blocks inside the Page Designer output.

---

### Program Detail — member (`/account/programs/[slug]`)

**What the member sees:** Same program but with member-specific context — registration status, upcoming session info, calendar links, pending dana status, registration details, link to join.

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `Program.description` | `renderContentBodyAsync` | `rim-content rim-content--program prog-description` | Correct |
| `Program.specialNotes` | same | same wrapper | Sunset target (same as public) |
| `Program.danaMessage` | `<div class="mpd-dana__text">` | `mpd-dana__text` | Sunset target (on-page version) |
| `Program.confirmationMessage` | rendered on-page after registration in a confirmation strip | (varies) | **Message output** — correct |

**Recommendation:** Same sunset work as public program page. Confirmation message stays Message type.

---

### Lesson Detail (`/lessons/[slug]`)

**What the member sees:** Hero with title + image + optional audio player · optional pull quote block at top · main lesson body · optional reflection questions · optional teachers block · optional resources block.

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `Lesson.body` | `renderContentBodyAsync` | `rim-content rim-content--lesson lp-body` | Correct (Page Designer output) |
| `Lesson.headerQuote` + `quoteSource` | fixed template slot | template | **Sunset target** — becomes a Pull Quote or Verse Quote block inside body |
| `Lesson.reflectionPrompt` | fixed template slot at bottom | template | **Sunset target** — becomes a Reflection block inside body |
| `ReflectionQuestion.body` | `renderFormattedTextAsync` | `ls-question__text` inline | Correct (Form Field output) |
| `LessonNote.body` (member's personal note) | `renderFormattedTextAsync` | `rim-content ls-notes-body` | Correct (Message output) |

**Recommendation:** Three sunset migrations (Stage 2d). Otherwise correct.

---

### Course / Series Detail (`/course/[slug]` or `/courses/[slug]`)

**What the member sees:** Series title, subheading, description, list of lessons with group labels, teachers, link to first lesson.

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `Course.description` | `renderFormattedTextAsync` | `rim-content crs-desc` | Correct (Message output) |
| `Course.completionNote` | plain `<p>` (since it's currently a String) | — | **Promote target** — becomes Message. Rendered on completion. |
| `CourseLesson.groupLabel` | plain header | template | Template data |

**Recommendation:** Promote `completionNote` in Stage 2. Otherwise correct.

---

### Teacher profile (`/teachers/[slug]`)

**What the visitor sees:** Photo, name, title, bio, list of lessons and series taught.

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `TeacherProfile.bio` | plain `<p>` (since it's currently a String) | — | **Promote target** — becomes Message type in Stage 2. Will render with a wrapper like `rim-content tp-body`. |

**Recommendation:** Promote `bio` to Message. Define the output wrapper at that time.

---

### Glossary term (`/glossary/[slug]`)

Currently pulls from Sanity. Simple page with name, pali, sanskrit, synonyms. No rich content today.

**Status:** Migration target (Sweep 2) — move to Postgres with a new `body: Json?` Page Designer field. Template-data fields (pali/sanskrit/synonyms) remain fields.

**Post-migration render:**
- Pali/Sanskrit/synonyms → template slots
- `body` → `rim-content rim-content--glossary gloss-body` (new wrapper class)

**Recommendation:** Part of Stage 2d migration.

---

### Volunteer position (`/volunteer-positions/[slug]`)

Currently Sanity-backed. Renders `positionDescription` (Portable Text) inside legacy `rich-text-block-19 w-richtext` wrapper. Links to `/team/[slug]` for current volunteers (which is being sunset).

**Status:** Migration target (Sweep 2) — move to Postgres with `positionDescription: Json?` as Message type.

**Post-migration render:**
- name / isOpen / currentVolunteers → template slots (currentVolunteers links to `/teachers/[slug]`)
- `positionDescription` → `rim-content vp-body` (new wrapper class)

**Recommendation:** Part of Stage 2d migration.

---

### Magazine article (`/magazine-articles/[slug]`)

Sunset (Sweep 2). Will be deleted as part of Stage 2c cleanup.

---

### Team member (`/team/[slug]`)

Sunset (Sweep 2). Will be deleted as part of Stage 2c cleanup.

---

### Manual section (`/admin/manual/[slug]`)

**What the staff member sees:** Chapter of the internal staff manual, read-only view.

**Authored content render sites:**

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `ManualSection.body` | `renderContentBodyAsync` | `rim-content man-body` | Correct (Document output) |

**Recommendation:** Correct. No action.

---

### Hub document view (`/account/hub/[slug]/documents/[id]`)

**What the member sees:** Document title, body, metadata, edit/lock controls for authors.

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `HubDocument.body` | `renderContentBodyAsync` | `rim-content hdoc-body` | Correct (Document output) |

**Recommendation:** Correct.

---

### Site banner (rendered across all routes via layout)

| Source | Rendered as | Wrapper class | Status |
|---|---|---|---|
| `SiteBanner.body` | `renderBlockNoteHtml` | `rim-content ban-body` | Correct (Message output) |

---

### Dashboard (`/account/dashboard`)

Member's landing page. Renders summaries (today's programs, recent activity, hub cards, upcoming sessions). No authored content is rendered here — it's all template data and program/session state.

**Recommendation:** No action.

---

## Drift caught in Sweep 5

No new drift. Sweep 5 confirms from the render side that the four-type model lines up with how content is actually displayed. Every authored-content render site either:

- Uses the correct wrapper class for its type ✓
- Is a sunset target (content moves into blocks inside a Page Designer surface) — captured in Stage 2d plan
- Is a promote target (plain text becomes Message) — captured in Stage 2 plan
- Belongs to a migrating or sunsetting Sanity type — captured in Stage 2c/2d plan

---

## New output wrappers needed after migrations

Stage 2 creates or modifies these CSS wrappers:

| Surface | Wrapper class | Type |
|---|---|---|
| Glossary entry body (new) | `rim-content rim-content--glossary gloss-body` | Page Designer |
| Volunteer position description (new) | `rim-content vp-body` | Message |
| Teacher profile bio (new) | `rim-content tp-body` | Message |
| Course completion note (new) | `rim-content crs-completion` | Message |

Each one lives in `custom.css` under a clearly labeled section. `RIM_Editor_Types.md` Placement Registry gets updated with the full list.

---

## Summary

Sweep 5 closes Stage 1. Every authored-content surface in RIM — Postgres field, Sanity field, component, render site — has been classified under the four-type model.

**Final Stage 1 counts:**

- **Document type:** 2 placements (`HubDocument.body`, `ManualSection.body`)
- **Page Designer type:** 2 placements today (`Program.description`, `Lesson.body`); 2 more coming (glossary, possibly magazine if resurrected)
- **Message type:** 20+ placements across conversations, tasks, notes, announcements, support, program messages, banner, short descriptions
- **Form Field type:** 1 placement (`ReflectionQuestion.body`)
- **Outlier:** 1 (`EmailTemplate.body` / MarkdownEditor)
- **Sunset → block:** 5 on Program, 3 on Lesson, ~2 Sanity types to fully delete
- **Sunset → delete:** 5 schema objects (abandoned session module) + 2 Sanity types (teams, magazine)
- **Plain → promote:** 2 fields (`TeacherProfile.bio`, `Course.completionNote`)

Nothing is unclassified. Nothing is unexplained. Nothing is drift-flagged without a resolution path.

---

## What Stage 1 delivers

- `RIM_Editor_Types.md` as the canonical reference, gated by `CLAUDE.md`
- Five sweep documents in `editor-audit/` detailing every decision
- A clean Stage 2 plan with four batches (2a rename, 2b drift fixes, 2c cleanup, 2d Page Designer blocks + migrations)
- Shared vocabulary (Template data · Document · Page Designer · Message · Form Field · Outlier)
- A block creation procedure for all future additions

Stage 2 is next. Review the sweep files and confirm you're ready for code changes.

---

## Open questions for Jesse

1. **Stage 2 execution cadence** — four batches (2a, 2b, 2c, 2d). Do them in one session or spread across multiple? 2d alone is substantial (new blocks + data migrations) and probably deserves its own session or two.
2. **2a ordering** — the renaming batch is cheap and non-user-visible. Safe to do first. Confirm you want me to start there?
3. **Stage 3 placement registry** — populate it during Stage 2 as each batch lands, rather than after Stage 2 is complete. That way the doc matches the code at every commit. Agreed?
