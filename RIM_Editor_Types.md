# RIM Editor Types

**This is the canonical reference for how content is authored across the RIM platform.** It supersedes `RIM_Editor_Design.md` — that document captured an earlier tier-based model that had drifted from the code and grew into a registry of places rather than a taxonomy of editors. This document replaces it.

Read this file before working on any editor component, content rendering surface, or schema field that holds authored text. If code and this file disagree, the code is wrong and should be corrected.

> ## ⚠️ Migration in progress (started session 96, 2026-04-27)
>
> **The editor engine is moving from BlockNote to Tiptap.** The four types described below remain unchanged — they are about *what content is*, not *what library produces it*. What's changing is the implementation:
>
> - **Old:** `RimBlockEditor` (Document + Page Designer) and `RimProseEditor` (Message + Form Field), both BlockNote-based, both storing **BlockNote JSON**.
> - **New:** `RimTiptapEditor` (one component, three variants: `minimal` / `message` / `document`), Tiptap-based, storing **plain HTML strings**.
>
> Phase 1 (session 96) built the new editor and mounted it in the Editor Lab; production surfaces are still on the old editors. Phases 2–5 migrate surfaces and existing data. See `UP_NEXT.md` for the active phase and `session-log.md` (session 96) for context.
>
> Until the migration completes, this document describes the *current state*: type definitions still hold; the placement registry below still reflects the BlockNote-based components in production. As surfaces migrate, the placement entries will be updated to reference `RimTiptapEditor` and the `variant` they use.

---

## The Intention

RIM's design is rooted in a Dharma principle: clear seeing is the prerequisite for wise and compassionate response. This applies to the tools volunteers and staff use to create content.

An editor should feel calm and capable. The person writing a lesson should be thinking about the teaching, not the tool. The person posting a quick message shouldn't be given the same scaffolding as someone authoring a document. The system makes the right choices in advance so the author can focus on the content.

Two principles govern everything that follows:

1. **Small vocabulary.** Four editor types, never more. Every authored thing in RIM picks one. The author learns four things; the author doesn't have to guess.
2. **Separation of template and content.** A page is made of two things: structured data the system queries (dates, categories, prices, registration capacity), and authored content where the author speaks. These belong in different places and are shaped differently. The editor is only for the content half.

---

## The Core Distinction — Template vs. Content

Every authored page in RIM (a program, a lesson, a glossary entry, a manual section, a hub document) is built from two parts:

### Template data — structured, hard-coded, queried

Fields the page template renders in fixed positions: dates, times, location, registration capacity, category, teacher assignments, prices, slugs, image URLs, recurrence rules, schedule flags. These drive features — "today's programs," "this week's schedule," calendar events, member dashboards, email merging. Because they drive features, they must be structured and queryable. They live as fields on the model and are rendered by the page template in specific slots.

**Template data never lives inside the editor.** A program's start time is not prose; it's data. It stays as a field.

### Authored content — prose and design, composed in an editor

The writing the author does — the voice, the teaching, the framing, the invitation. This is where the author speaks. It lives in an editor. The editor determines what kinds of content the author can compose.

**Authored content never lives in a structured field.** A program's invitation isn't a database column; it's a page the author writes.

### The shift this creates

RIM's older data model has drifted from this distinction. Several authored fields on Program and Lesson (special notes, early arrival messages, dana invitations, header quotes, reflection prompts) exist as separate top-level fields because the old Webflow-era system couldn't put rich content inside a page. Each one ends up rendered as a fixed slot in the template.

With a proper Page Designer editor, these slots become **blocks the author inserts inline** — in the places they belong within the main content. The fields sunset; the blocks take their place. The author gets full control; the template gets simpler.

This migration is described later in the document.

---

## The Four Editor Types

Every editor surface in RIM is an instance of one of four types. The type is chosen by the purpose the author is working toward, not by where the output renders. Output destinations vary independently (see "Output Destinations" below).

### 1. Document

**Purpose:** Write a sophisticated standalone document. The output is read as a document.

**What it's for:** Hub documents, manual sections, internal process guides, onboarding materials. Working documents with structure — headings, tables, images, callouts, dividers.

**What the author gets:**
- Paragraphs, bullet lists, numbered lists, checklists
- H2 and H3 headings (H1 is reserved for the page title, rendered by the template)
- Tables
- Images with captions and alignment
- Dividers
- Code blocks
- Quotes
- Callouts (Note, Decision)
- Inline formatting: bold, italic, underline, strikethrough, inline code, links

**What it doesn't have:** Design blocks (those belong to the Page Designer).

**Reference feel:** Notion. Clean, spacious, block-based, typeset.

### 2. Page Designer

**Purpose:** Compose the authored-content portion of a templated page. The editor isn't just for formatting text — it's for **placing design elements the page uses**. The output is rendered as part of a published page.

**What it's for:** Program descriptions, lesson bodies, glossary entries, and the pattern extends to anything where a page template has a "main content" slot that the author fills with voice and visual components.

**What the author gets:**
- Everything in the Document type (paragraphs, lists, headings, tables, images, dividers, callouts, code, quotes, inline formatting)
- Plus a **block library of design elements** — authored-in-place components that carry their own visual identity on the page:
  - **Pull Quote** — a visual pause for a line worth sitting with
  - **Verse Quote** — serif italic with attribution, for scripture, poetry, canonical text
  - **Practice Suggestion** — a framed practice invitation with title and body
  - **Reflection** — an italic question lead-in with block-level body
  - **Special Note** — a styled note box (replaces the old `specialNotes` field)
  - **Early Arrival / What to Bring** — practical info blocks for programs (replace old separate fields)
  - **Dana Invitation** — the contribution ask (replaces the old `danaMessage` field on rendered web output)
  - New blocks added as needed (see "Block Library" below)

**What it doesn't have:** Nothing structural that belongs in the template (dates, times, schedule, registration settings). Those stay as fields.

**Reference feel:** A thoughtful page builder — but constrained. The author composes from a curated library of blocks, each with a clear visual identity. The template still owns the page frame; the author owns the page body.

### 3. Message

**Purpose:** Write a communication. Prose with structure where it helps.

**What it's for:** The most common editor. Used anywhere the author is speaking to someone — conversations, tasks, announcements, internal notes, support replies, short program messages, short site banners.

**What the author gets:**
- Paragraphs, bullet lists, numbered lists, checklists
- Blockquotes
- Tables (for structured reference like schedules or role assignments)
- Code blocks
- Inline formatting: bold, italic, underline, strikethrough, inline code, links

**What it doesn't have:**
- Headings — in a stream of messages, a reply with an H2 reads like its own article. Slack, Linear, and Basecamp all remove headings from their message editors for the same reason.
- Images — when a surface needs them, they're attached separately, not embedded in the message body.
- Design blocks — those belong to the Page Designer.

**Reference feel:** Conversational. A thoughtful message, not a formatted document. Can be visually larger (a program description's dana message) or smaller (a task's body) depending on the surface, but the editor is the same.

### 4. Form Field

**Purpose:** Inline-only rich input. Used when the author is filling out a form and the only capability needed is emphasis and links.

**What it's for:** Reflection question bodies, other short prose fields where a full editor would be overkill but plain text would be too rigid.

**What the author gets:**
- Bold, italic, links
- Nothing else. No block types, no lists, no separate blocks, no line breaks treated as separate paragraphs.

**Reference feel:** A rich `<input>`. Minimal and contained.

---

## The Outlier — Markdown (email templates)

Transactional email templates are authored in a separate `MarkdownEditor` (Tiptap + markdown), not in any of the four types above. This is an implementation artifact: the markdown-to-email pipeline (via `marked` and `juice`) produces reliably styled HTML across email clients, and rebuilding that pipeline on a BlockNote foundation is a project of its own.

**For now:** email templates stay on MarkdownEditor. This is the only editor surface outside the four types.

**Future:** when a BlockNote-to-email-safe-HTML renderer is built, email templates will fold into the Document or Message type, depending on complexity. Until then, treat MarkdownEditor as an acknowledged outlier, not a precedent.

**Gmail integration (Support Inbox send path) is a separate concern entirely.** That pipeline — sending a Message-type reply out through Gmail's API — is not part of this document's scope. It will be designed separately.

---

## Output Destinations

The editor type is chosen by the author's purpose. The *output destination* is where the content is rendered, and it's independent of the type.

Any editor's content can be rendered to:

- **A web template** — a fixed page where the content occupies a specific slot (program page, lesson page, manual page, hub page, glossary page). Rendered as HTML with a context-specific CSS wrapper.
- **An interactive web surface** — live in-app content that the user reads as it's written (conversations, tasks, announcements, support threads, internal notes).
- **A transactional email** — sent to the member's inbox (registration confirmations, reminders, sub-claim notifications). Output must be email-safe: no custom blocks that don't render reliably in email clients.

The same editor type can render to any of these. A Message editor fills both a hub conversation (interactive web) and an outgoing support reply (transactional email). What changes is the output CSS and, for email, the render path (email-safe HTML, not the in-app pipeline).

**Rule for Page Designer blocks in email:** they don't render reliably in email clients. Any content bound for email must stay within the Message type's feature set. Programs that currently render their dana ask in both a page block and an email will need the *email* version authored separately in a Message-type field, or a carefully-designed email-safe rendering of the block.

---

## Block Library (for Page Designer)

The Page Designer's value depends on its block library — the set of design elements the author can insert. These are authored components: each has a defined appearance, its own editable fields (title, body, attribution, icon, etc.), and its own rendering rules.

### The block registry is a design commitment

Every block added to the library is a visual commitment that gets used across the platform. Blocks must cohere with each other and with the RIM design language. They aren't ad-hoc — adding one is a deliberate act.

### Same block, different placements — scope modifiers

A block has **one editor experience** (the same fields, the same UX everywhere it's inserted) but **its rendered output adapts to where it lives**.

A Pull Quote, for example, is always the same block: the author writes the quote, writes the attribution, that's it. But:
- In a **hub document**, it renders as a small indented left-rule quote.
- In a **lesson**, it renders as a large centered serif pull quote.
- In a **program description**, it renders as a middle-register quote.

This is done with **scope modifiers** on the output wrapper. The rendered HTML is the same structure everywhere (`<div class="rim-el-pull-quote">...`). The wrapper `<div class="rim-content rim-content--[scope] [placement-class]">` declares the scope (document, program, lesson), and the CSS for `.rim-content--lesson .rim-el-pull-quote` tunes the rendering for that scope.

One block, many renderings, one editor experience.

### Block Creation Procedure

A new block enters the library through a four-phase process. This is a design commitment, not a code task.

**Phase 1 — Proposal.** Before any code is written, a **block brief** is drafted in conversation. One page, four questions:

1. **What is it called and what does it display?** Working name, one-sentence visual identity.
2. **What placement needs it right now?** Specific (e.g., "a Special Note block for programs"), not speculative.
3. **What does the author edit?** The block's fields — title, body, attribution, icon, variant — and the authoring experience.
4. **What existing block might it overlap with?** If it's just a tuned Callout or Reflection, don't add it; modify the existing block instead.

**Phase 2 — Design.** Once the brief is approved:

- Visual design sketched in each scope it will render in (document, program, lesson, etc.). The scope modifiers are the hinge point; this is where it's decided whether the block looks calm in one scope and editorial in another.
- `availableIn` decided — which placements may offer this block.
- Fields and behavior agreed: is the title optional? Can the body contain other blocks? Can it be nested?

**Phase 3 — Implementation.**

- Define the block in `lib/blockNoteCustomBlocks.tsx`.
- Add the registry entry listing fields and `availableIn`.
- Write output CSS for each scope that hosts the Page Designer.
- Add the block to the Editor Lab (`/admin/editor-lab`) for verification.

**Phase 4 — Review and lock-in.**

- Verify in the Editor Lab that the block renders correctly in every scope it's available in.
- Verify in a real placement (drop it into a program or lesson).
- Commit with a message that names the block and its scopes.
- Update this document — add the new block to the library roster.

**After first committed use, the block is locked.** Renaming, adding or removing fields, or changing rendering become coordinated changes across every placement. The block type name, stored permanently in the database, is a one-way door.

### Block Library Roster

*The authoritative list of blocks currently in the library. Updated whenever a block is added or modified. Each entry: name · one-sentence visual identity · fields · scopes (availableIn) · date added.*

#### Aside (callout variant: `aside`)
- **Visual identity:** Neutral shaded rectangle wrapping child blocks. No icon, no border, no baked-in title. Title, if wanted, is an author-added heading block inside (H2/H3/H4). Color is determined by the render scope class — document scope gets a flat gray; lesson/program scopes can override via CSS.
- **Fields:** None. Pure structural wrapper. `children: []` holds the authored content (headings, paragraphs, lists).
- **Scopes (`availableIn`):** `DOCUMENT_LIKE` — `hub-document`, `manual`, `program-description`, `lesson`.
- **Editor chrome:** None. The `render()` function returns a zero-height `contentEditable={false}` marker div. BlockNote renders the children as a normal block-group sibling; the shaded background comes from CSS `:has()` on the ancestor `.bn-block`. Backspace at position 0 of the first child unwraps the container — standard rich-text container behavior.
- **Output class:** `rim-el-note rim-el-note--aside`.
- **Added:** 2026-04-20 (session 90).

#### Callout — Note variant (callout variant: `note`)
- **Visual identity:** Titled box with a 💡 icon. Compact, used for "aside information worth surfacing." Warm beige tint.
- **Fields:** `title: String` (optional).
- **Scopes:** `DOCUMENT_LIKE` + `MESSAGE_WITH_TABLES`.
- **Output class:** `lp-callout-block lp-callout-block--note rim-el-note rim-el-note--note`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

#### Callout — Decision variant (callout variant: `decision`)
- **Visual identity:** Titled box with a ✓ icon. Marks a concluded decision. Teal-green tint.
- **Fields:** `title: String` (optional).
- **Scopes:** `DOCUMENT_LIKE` + `MESSAGE_WITH_TABLES`.
- **Output class:** `lp-callout-block lp-callout-block--decision rim-el-note rim-el-note--decision`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

#### Pull Quote (block: `pullQuote`)
- **Visual identity:** Oversized centered serif quote with decorative teal mark. Dramatic, page-scale.
- **Fields:** `attribution: String` (optional). Content is a single inline string.
- **Scopes:** `DHARMA_BLOCKS_ALLOWED` — `program-description`, `lesson`.
- **Output class:** `rim-el-pull-quote`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

#### Verse Quote (block: `verseQuote`)
- **Visual identity:** Smaller centered serif quote, reverent. Used for canonical or external dharma text.
- **Fields:** `attribution: String` (optional). Content is a single inline string.
- **Scopes:** `DHARMA_BLOCKS_ALLOWED` — `program-description`, `lesson`.
- **Output class:** `rim-el-verse lp-verse-quote`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

#### Practice Suggestion (block: `practiceSuggestion`)
- **Visual identity:** "PRACTICE" eyebrow + serif title + block-level body. Contemplative invitation.
- **Fields:** `title: String` (optional). Body is children (paragraphs, lists).
- **Scopes:** `DHARMA_BLOCKS_ALLOWED` — `program-description`, `lesson`.
- **Output class:** `rim-el-practice`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

#### Reflection (block: `reflection`)
- **Visual identity:** Italic question lead-in + block-level body. Invites sitting with the question.
- **Fields:** `question: String` (optional). Body is children.
- **Scopes:** `DHARMA_BLOCKS_ALLOWED` — `program-description`, `lesson`.
- **Output class:** `rim-el-reflection`.
- **Added:** pre-Stage 2d (migrated into roster 2026-04-20).

### Blocks modify when used

As the library grows, existing blocks may be modified — new fields added, rendering refined, new scopes added. These are coordinated changes: a block modification requires updating every placement that uses it.

---

## How to Place a New Editor

When building a new surface that needs authored content, the process is:

1. **Decide what kind of content it is.** A standalone document? A page body composed from design blocks? A communication? A form field?
2. **Pick the editor type** from the four above.
3. **Decide the output destination.** Web template, interactive web, or email?
4. **Define the output CSS class.** e.g., `rim-content gloss-body` for a new glossary body placement.
5. **Register the placement** in the placement registry (see below). This is the single source of truth for "this surface uses the X type, renders into Y wrapper, lives at route Z."
6. **Never invent a new editor type.** If the surface doesn't fit one of the four, the surface is wrong — reshape the feature, don't add a type.
7. **Never reuse another placement's output CSS class.** Each placement has its own class, even if they look similar today. They will diverge.
8. **Verify in the Editor Lab** that the type's blocks render correctly in the new placement's CSS.

---

## Placement Registry

Every current placement — where each editor type is instantiated and how its output is wrapped. This is the authoritative reference for "this surface uses X editor, output wraps in Y class." When adding a new placement, add an entry here first.

The placement name (e.g., `hub-document`) is the same string used in `lib/editorRegistry.ts`. Block availability is derived from the type.

### Document type

#### `hub-document`
- **Component:** `components/HubDocumentEditor.tsx`
- **Schema field:** `HubDocument.body`
- **Output destination:** interactive web
- **Output wrapper:** `rim-content hdoc-body`
- **Route:** `/account/hub/[slug]/documents/[id]`

#### `manual`
- **Component:** `components/ManualSectionEditor.tsx`
- **Schema field:** `ManualSection.body`
- **Output destination:** web template
- **Output wrapper:** `rim-content man-body`
- **Route:** `/admin/manual/[slug]`

### Page Designer type

#### `program-description`
- **Component:** `components/registrar/ProgramEditor.tsx` (Content tab)
- **Schema field:** `Program.description`
- **Output destination:** web template
- **Output wrapper:** `rim-content rim-content--program prog-description`
- **Routes:** `/programs/[slug]`, `/account/programs/[slug]`
- **Notes:** Will absorb blocks replacing `specialNotes`, `specialAnnouncement`, `earlyArrivalMessage`, `pullQuote` pair, and on-page `danaMessage` in Stage 2d.

#### `lesson`
- **Component:** `components/LessonEditor.tsx`
- **Schema field:** `Lesson.body`
- **Output destination:** web template
- **Output wrapper:** `rim-content rim-content--lesson lp-body`
- **Route:** `/lessons/[slug]`
- **Notes:** Will absorb blocks replacing `headerQuote` / `quoteSource` and `reflectionPrompt` in Stage 2d.

### Message type

Uses `RimProseEditor`. `variant="dense"` for longer surfaces; `variant="compact"` for inline / short surfaces; `minimal` for Form Field-like single-line inputs.

#### `hub-welcome`
- **Schema field:** `Hub.welcomeBody`
- **Component:** `components/HubAdminForm.tsx`
- **Variant:** dense
- **Output destination:** web template
- **Output wrapper:** interactively rendered in `HubHomeClient` welcome interstitial
- **Route:** `/account/hub/[slug]` (first-visit interstitial)

#### `hub-home`
- **Schema field:** `Hub.homeContent`
- **Component:** `components/HubAdminForm.tsx`
- **Variant:** dense
- **Output destination:** web template
- **Output wrapper:** rendered inside hub home orientation block

#### `hub-conversation`
- **Schema fields:** `HubConversationThread.body`, `HubConversationReply.body`
- **Components:** `HubConvClient.tsx`, `HubConvThreadClient.tsx`
- **Variant:** compact
- **Output destination:** interactive web
- **Output wrapper:** `rim-content hub-conv-post__body`

#### `hub-task`
- **Schema fields:** `Task.body`, `Subtask.body`
- **Component:** `HubTasksClient.tsx`
- **Variant:** dense (task), compact (subtask)
- **Output destination:** interactive web
- **Output wrapper:** `rim-content tsk-body`

#### `support-reply`
- **Client state (no schema field)** — reply / compose drafts in Support Inbox.
- **Component:** `SupportInboxClient.tsx` (reply editor, compose editor)
- **Variant:** compact
- **Output destination:** transactional email (Gmail API via outbound message)

#### `support-note`
- **Schema field:** `SupportNote.body`
- **Component:** `SupportInboxClient.tsx` (internal note editor)
- **Variant:** compact
- **Output destination:** interactive web (staff-only)
- **Notes:** Not email-bound. Distinct from `support-reply` so future features (e.g. internal-only images or rich blocks) can be allowed here without leaking to outgoing emails.

#### `support-template`
- **Schema field:** `SupportTemplate.body`
- **Component:** `SupportSettingsClient.tsx`
- **Variant:** dense
- **Output destination:** eventual transactional email (when inserted into a reply)
- **Notes:** Matches `support-reply` capabilities (email-safe subset).

#### `program-message`
- **Schema fields:** `Program.confirmationMessage`, `Program.reminderMessage`, `Program.danaMessage`
- **Component:** `components/registrar/ProgramEditor.tsx`
- **Variant:** dense
- **Output destination:** web template + transactional email
- **Output wrappers:** varies by surface (`pg-dana__message`, `mpd-dana__text`, email HTML)
- **Notes:** `danaMessage` on-page rendering will migrate to a Dana Invitation block in Stage 2d; the email version stays a Message field.

#### `course-description`
- **Schema field:** `Course.description`
- **Component:** `CourseEditor.tsx`
- **Variant:** dense
- **Output destination:** web template
- **Output wrapper:** `rim-content crs-desc`
- **Route:** `/course/[slug]`

#### `site-banner`
- **Schema field:** `SiteBanner.body`
- **Component:** `app/admin/banner/page.tsx`
- **Variant:** compact
- **Output destination:** web template (site-wide layout)
- **Output wrapper:** `rim-content ban-body`

#### `schedule-submessage`
- **Schema field:** `SubRequest.message`
- **Component:** `HubScheduleClient.tsx`
- **Variant:** compact
- **Output destination:** interactive web + transactional email

#### `sub-claim-message`
- **Schema field:** `SubClaim.message`
- **Component:** *(UI pending — registered but not yet wired)*
- **Variant:** compact (when built)
- **Output destination:** transactional email (part of sub-claimed notification)
- **Notes:** Small feature follow-up — add optional message field to the "claim this sub" confirmation dialog.

#### `lesson-notes`
- **Schema field:** `LessonNote.body`
- **Component:** `LessonNoteEditor.tsx`
- **Variant:** compact
- **Output destination:** interactive web (member's private view)
- **Output wrapper:** `rim-content ls-notes-body`

#### `admin-notes`
- **Schema field:** `User.adminNotes`
- **Component:** `components/member-sections/AdminNotesSection.tsx`
- **Variant:** compact
- **Output destination:** interactive web (staff-only)
- **Output wrapper:** inline (no wrapper)

#### `household-notes`
- **Schema field:** `Household.notes`
- **Component:** `HouseholdDetail.tsx`
- **Variant:** compact
- **Output destination:** interactive web (staff-only)
- **Output wrapper:** inline

#### `volunteer-note`
- **Schema field:** `Registration.notes`
- **Component:** `components/registrar/VolunteerTable.tsx`
- **Variant:** compact
- **Output destination:** interactive web (staff-only)
- **Output wrapper:** inline row

### Form Field type

#### `reflection-question`
- **Schema field:** `ReflectionQuestion.body`
- **Component:** `LessonEditor.tsx` (question body field)
- **Uses:** `RimProseEditor` with `minimal={true}` (bold / italic / link only)
- **Output destination:** web template
- **Output wrapper:** `ls-question__text` (inline)

### Outlier

#### `email-template` (MarkdownEditor)
- **Component:** `EmailTemplateEditor.tsx`
- **Schema field:** `EmailTemplate.body`
- **Storage:** Markdown (not BlockNote JSON)
- **Output destination:** transactional email (via `marked` → `juice` → Resend)
- **Notes:** Outside the four-type model. Will fold into Document or Message when a BlockNote-to-email-safe renderer is built.

---

### Registered but pending implementation

These placements are registered but their schema or UI is still being built:

#### `teacher-bio`
- **Target schema field:** `TeacherProfile.bio` (currently `String?`, will become `Json?`)
- **Target component:** `components/member-sections/TeacherSection.tsx`
- **Variant (when wired):** compact
- **Output destination:** web template (`/teachers/[slug]`)
- **Output wrapper (when wired):** `rim-content tp-body`
- **Status:** Schema promotion + component + render change pending (Stage 2d).

#### `course-completion-note`
- **Target schema field:** `Course.completionNote` (currently `String?`, will become `Json?`)
- **Target component:** `components/CourseEditor.tsx`
- **Variant (when wired):** compact
- **Output destination:** interactive web (shown on series completion)
- **Output wrapper (when wired):** `rim-content crs-completion-note`
- **Status:** Schema promotion + component + render change pending (Stage 2d).

### Planned placements (not yet registered — future migrations)

- `volunteer-position` — Message type, volunteer position description (Stage 2d, from Sanity)
- `glossary` — Page Designer type, glossary entry body (Stage 2d, from Sanity)

---

## Migration Pattern

Several existing Program and Lesson fields need to move from top-level fields into Page Designer blocks. The migration pattern for each is:

1. **Identify the block that replaces it.** e.g., `Program.specialNotes` → `Special Note` block inside `Program.description`.
2. **Build the block** (editor definition, registry entry, CSS in each scope).
3. **Write a data migration** that reads the old field and inserts a matching block into the main editor's content at the author's intended position (usually at the end, or a reasonable default).
4. **Update the page template** to stop rendering the old field as a separate slot.
5. **Mark the old field deprecated in the schema.** Remove the field in a later pass once no code reads it.

The migration is done one field at a time, per schema, with a commit for each. This lets any single change be reverted without affecting the others.

---

## What This Document Does Not Cover

- **Specific blocks in the library** beyond the initial set are added via the process in "When to add a new block."
- **The Gmail integration** for the Support Inbox is a separate design concern and not covered here.
- **The email-safe rendering pipeline** for BlockNote content (when it's built) is a separate engineering project and will be documented separately.
- **CSS token reference** is in `CLAUDE.md` and `custom.css`. This document references tokens by name but doesn't redefine them.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · session 89, 2026-04-20*
*Supersedes RIM_Editor_Design.md*
