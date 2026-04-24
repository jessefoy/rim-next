# RIM Editor Design — ARCHIVED

> ⚠️ **This document is archived. It has been superseded by [`RIM_Editor_Types.md`](RIM_Editor_Types.md), which is now the canonical reference for the editor system (block library, placement registry, surface types, wrapper classes).**
>
> Kept only for historical context and to preserve the original design rationale. Do not update this file. Do not cite it as current. If something here contradicts `RIM_Editor_Types.md` or the code, `RIM_Editor_Types.md` and the code win.

---

**Original content below — preserved as written. May contain references to patterns that have since evolved.**

---

**How content is written, stored, and displayed across the platform**

Claude Code: Read this file before working on any editor component, content rendering, display page, or CSS that touches rich text output. This document is the contract. The code follows this file — not the other way around. If code and this file disagree, the code is wrong and should be corrected.

---

## The Intention

RIM's design is rooted in a Dharma principle: clear seeing is the prerequisite for wise and compassionate response. This applies to every interface — including the tools volunteers and staff use to create content.

An editor should feel calm and capable. The person writing a lesson should be thinking about the teaching, not about the tool. The person posting a quick message shouldn't be given the same scaffolding as someone authoring a document. The output should be beautiful without effort — because the system has made the right choices in advance.

This means:
- Every editor surface belongs to exactly one **tier**. The tier defines what blocks are allowed.
- Available blocks are limited to what belongs in that context. A reply does not need headings. A document does not need dharma blocks. A lesson does.
- Output CSS is context-specific. The same paragraph block renders differently in a lesson than in a manual than in a hub document. This is intentional.
- WYSIWYG parity is a contract: the editor view and the rendered output must match. If a block looks different in edit than in view, that is a bug.
- Every editor context is registered here. Nothing is added without a corresponding entry.

---

## The Three Tiers

Every rich text surface in RIM belongs to one of three tiers. The tier is a design decision, not an implementation detail — it describes what the writer can do and what the reader will see.

### Tier 1 — Message

**Intent:** Conversational. A thoughtful note, not a formatted document. Structure comes from lists, bold emphasis, and blockquotes — not from headings.

**Allowed blocks:**
- Paragraph
- Bullet list, numbered list (including nested)
- Blockquote
- Code block
- Table *(via slash menu only — not on selection bubble; for structured reference like schedules and roles)*

**Allowed inline formatting:**
- Bold, italic, underline, strikethrough
- Inline code
- Links

**Excluded:**
- Headings (H1/H2/H3) — flatten visual hierarchy in a feed of messages
- Images — attached separately when a surface needs them
- Dividers
- All custom dharma blocks

**Why no headings:** in a stream of messages (conversations, announcements, tasks), a reply with an H2 reads like its own article. Slack, Linear, Basecamp, and Intercom all remove headings from their message editors for the same reason.

**Why tables:** volunteers coordinate schedules, role assignments, timing. A 3×4 table is better than five bullet points for that content. Slash-menu-only gating keeps them out of the way until needed.

**Implementation engine:** `RimProseEditor` — a prose-focused BlockNote instance with tier-appropriate block schema.

---

### Tier 2 — Document

**Intent:** A working document. Notion is the reference: clean, spacious, block-based, typeset. Meeting notes, onboarding guides, program descriptions, manual sections. The editor should feel capable and the output should feel like a real document, not a webpage.

**Allowed blocks:**
- Everything in Tier 1 (Message)
- **H2, H3** headings *(H1 is reserved for page titles rendered separately by the page layout)*
- Images *(with caption, alignment)*
- Dividers
- **InfoCallout** — a neutral note/tip box with an icon. One variant: informational. Used for "what to bring", "location note", "important"

**Excluded:**
- H1 (page title only)
- Dharma-flavored custom blocks (VerseQuote, PracticeSuggestion, dharma Callout)

**Why no H1 in the editor:** page titles are structural data (program name, document title, manual section name) stored as plain text on the model and rendered by the page layout. Letting writers create their own H1 in the body breaks heading hierarchy for accessibility and confuses the visual anchor of the page.

**Why InfoCallout instead of dharma Callout:** a program description or meeting document needs a neutral "Note" or "Tip" box. The warm-amber dharma Callout carries contemplative tone that doesn't belong in a working document.

**Implementation engine:** `RimBlockEditor` with `context="document"`.

---

### Tier 3 — Feature (Contemplative)

**Intent:** Primary contemplative content — the surfaces where RIM's dharma voice is expressed most directly. Reading should feel like reading a well-designed dharma text.

**Allowed blocks:**
- Everything in Tier 2 (Document)
- **Pull Quote** — inline single-quote block with optional attribution; visual pause for a line worth sitting with
- **Verse Quote** — inline single-quote block rendered in serif italic; for scripture, poetry, canonical passages
- **Practice Suggestion** — container block with "PRACTICE" eyebrow, title, and block-level body; a practice invitation
- **Reflection** — container block with italic question lead-in and block-level body; for prompts that invite sitting with
- **Note / Decision** (Callout) — container block, either a neutral Note or a decision-flagging Decision

**Excluded:**
- H1 (page title only)

**Currently used in:** Lessons and program descriptions. Pull Quote / Verse Quote / Practice / Reflection are scoped to `[lesson, program-description]`; Note / Decision are available across lessons, program descriptions, and email-bound surfaces.

**Implementation engine:** `RimBlockEditor` with `context="lesson"` or `context="program-description"`.

---

## Editor Chrome — One Consistent Surface

Every editor, regardless of tier, uses the same interaction patterns. Users learn the pill once and use it everywhere. What varies per surface is *which elements are offered*, never how the chrome looks.

**Three surfaces:**

1. **Format Pill** — a single floating toolbar. Appears above the current block whenever the editor has focus. Moves only when the cursor enters a new block (not on every keystroke). Flips below when near viewport bottom. Contains:
   - `[Paragraph ▾]` — paragraph / H2 / H3 *(H1 reserved for page titles)*
   - `[List ▾]` — bullet / numbered / checklist / quote
   - `B I U S` — bold / italic / underline / strikethrough
   - `[Color ▾]` — text color
   - `[Link]` — create / edit link
   - `[Align ▾]` — left / center / right *(where applicable)*
   - `[+ Insert ▾]` — element picker, filtered by context

   Which controls render is context-dependent — a Message-tier surface with no headings omits the Paragraph dropdown; a Minimal surface only shows `B I [Link]`.

2. **Slash menu** — typing `/` opens the same Insert dropdown that the pill's `+` opens. Keyboard shortcut, identical list, identical order.

3. **Block handle** — hover the left gutter of any block. Offers:
   - Drag to reorder
   - *Turn into ▸* — convert block type (reads from the Element Registry)
   - Duplicate
   - Delete

**Rules:**
- **One pill design, everywhere.** Visual parity across tiers is absolute.
- **No separate selection bubble.** The pill absorbs that job. Inline formatting lives on the pill.
- **Pill `+` and slash menu read the same registry.** Two paths, one list.
- The block handle's hover zone is the narrow left gutter only.
- If a pill button for a block type isn't registered for this context, it is hidden — never shown disabled.

---

## Element Registry

`lib/editorRegistry.ts` is the single source of truth for every insertable or convertible block. Adding a new element is one registry entry — the pill, slash menu, and block-handle "Turn into" menu all surface it automatically in every context where it's allowed.

**Entry shape:**
```ts
{
  id: "verse-quote",
  label: "Verse Quote",
  icon: <QuoteIcon />,
  group: "dharma",                         // for grouping in the picker
  blockType: "verseQuote",                 // BlockNote block type
  insert: (editor) => { /* insert logic */ },
  turnInto?: (editor, block) => { /* conversion logic */ },
  availableIn: ["lesson"],                 // context allowlist
}
```

**Groups** (render order in the picker):
- `text` — paragraph, H1–H4
- `lists` — bullet list, numbered list, checklist
- `structure` — quote, code block, table, divider
- `media` — image, file attachment
- `callouts` — Note, Decision *(both map to the `callout` block, differentiated by the `variant` prop)*
- `dharma` — Pull Quote, Verse Quote, Practice Suggestion, Reflection

**Context allowlists** flow from each surface's tier and voice:
- `hub-document`, `hub-welcome`, `hub-home`, `manual` — text + lists + structure + media + callouts (Note, Decision)
- `program-description` — same as hub-document, plus the full `dharma` group (Pull Quote, Verse Quote, Practice Suggestion, Reflection)
- `lesson` — everything, including all `dharma` elements
- `support-reply`, `program-message-*` — lists + structure (code, table) + media (file attachment) + callouts (Note, Decision); no headings, no dharma, no images
- Message-tier surfaces (hub-announcement, hub-conversation, hub-task, etc.) — lists + structure (quote, code); no headings, no media, no dharma

**When adding a new element:**
1. Define the custom block in `lib/blockNoteCustomBlocks.tsx` (if new).
2. Add one entry to `lib/editorRegistry.ts` listing every context in `availableIn[]`.
3. Write output CSS for each context that hosts it.
4. Verify in the Editor Lab.

**Never:**
- Build a bespoke per-tier pill or insert menu. Always go through the registry.
- Add an element to a context without writing the output CSS for that context.

---

## WYSIWYG Parity Contract

The editor view and the rendered view must match. A writer sees what the reader will see.

**The technique:**
1. The editor's content-editable root is wrapped in `<div class="rim-content rim-content--[scope] [context-class]">` — the same three-class wrapper the rendered page uses.
2. Editor-only affordances (placeholder, cursor, selection highlight, drag handle, slash menu, empty-line pill, block handle, top toolbar) are scoped to selectors narrow enough not to touch content rendering — they hang off `.ProseMirror`, never off content block tags.
3. Context CSS is written once and consumed by both surfaces. No separate "editor theme" CSS.

**The three-class wrapper:**
```html
<div class="rim-content rim-content--{scope} {context-class}">…</div>
```
- `rim-content` — shared base: font stack, list rhythm, paragraph spacing, safe defaults.
- `rim-content--document` / `rim-content--lesson` / `rim-content--program` — the **scope modifier**. Declares the surface's design voice. One element (e.g. `.rim-el-practice`) can read these and produce utilitarian treatment in documents, full editorial in lessons, and a middle register in programs — without duplicating class trees.
- `{context-class}` — the per-surface tuning (`lp-body`, `prog-description`, `hdoc-body`, `man-body`, etc.). This is where heading sizes, column width, and context-specific overrides live.

Scope modifiers are the hinge point. They let a shared element library (`.rim-el-*`) be reused across tiers, with the scope class deciding how bold or how quiet that element reads.

**The rule:**
- If a block looks visibly different in edit vs. view, it is a bug.
- Fix the context CSS, not the editor theme.
- The Editor Lab (`/admin/editor-lab`) is the verification surface — every change must be checked there.

---

## Context Registry

Every place in the system that uses an editor is registered here. **When adding a new editor surface, add an entry before building.** Each entry is mapped to exactly one tier.

### Feature tier (Tier 3)

#### lesson
- **Engine:** RimBlockEditor · `context="lesson"`
- **Custom blocks:** VerseQuote · PracticeSuggestion · dharma Callout
- **Output CSS:** `rim-content lp-body`
- **Used in:** LessonEditor → lesson page (`/lessons/[slug]`)
- **Design intent:** Generous, contemplative, serif headings, warm treatment for pull quotes and verse. Unhurried. Nothing competes with the content.

### Document tier (Tier 2)

#### hub-document
- **Engine:** RimBlockEditor · `context="document"`
- **Custom blocks:** InfoCallout
- **Output CSS:** `rim-content hdoc-body`
- **Used in:** HubDocumentEditor → hub document view (`/account/hub/[slug]/documents/[id]`)
- **Design intent:** A mature working document. Notion-like. Volunteer guidelines, meeting notes, process docs.

#### manual
- **Engine:** RimBlockEditor · `context="manual"`
- **Custom blocks:** InfoCallout
- **Output CSS:** `rim-content man-body`
- **Used in:** ManualSectionEditor → manual page (`/admin/manual/[slug]`)
- **Design intent:** Structured reference documentation. Tables with styled headers, note/tip boxes, clear heading hierarchy. Feels like a well-organized internal wiki. Informational — not contemplative.

#### program-description
- **Engine:** RimBlockEditor · `context="program-description"`
- **Custom blocks:** InfoCallout
- **Output CSS:** `rim-content prog-description`
- **Used in:** ProgramEditor → program detail page (`/programs/[slug]`)
- **Design intent:** Rich program information with callout boxes for important details. Readable and warm but not contemplative — this is functional information about a program.

#### hub-welcome
- **Engine:** RimBlockEditor · `context="document"`
- **Custom blocks:** InfoCallout
- **Output CSS:** `rim-content hdoc-body`
- **Used in:** HubAdminForm (welcome body field)
- **Design intent:** First-screen welcome content for hub members. Full document capability.

#### hub-home
- **Engine:** RimBlockEditor · `context="document"`
- **Custom blocks:** InfoCallout
- **Output CSS:** `rim-content hdoc-body`
- **Used in:** HubAdminForm (home content field)
- **Design intent:** Hub home dashboard content. Full document capability.

### Message tier (Tier 1)

#### course-description
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content crs-desc`
- **Used in:** CourseEditor → series page
- **Design intent:** Short descriptive prose. Sets the tone for the series without overwhelming the lesson list.

#### hub-announcement
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content ann-item__body`
- **Used in:** HubAnnouncementsClient
- **Design intent:** Clear, direct team messages. Prose with lists and optional tables when needed.

#### hub-conversation
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content hub-conv-post__body`
- **Used in:** HubConvClient, HubConvThreadClient (OP body + replies)
- **Design intent:** Conversational. Should feel like a thoughtful message, not a formatted document.

#### hub-task
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content tsk-body`
- **Used in:** HubTasksClient (task body + subtask body)
- **Design intent:** Task descriptions. Usually brief; tables useful for step lists and role assignments.

#### admin-notes
- **Engine:** RimProseEditor
- **Output CSS:** inline rendering in member profile (no wrapper)
- **Used in:** AdminNotesSection
- **Design intent:** Internal staff notes about a member. Plain prose. Not displayed to the member.

#### household-notes
- **Engine:** RimProseEditor
- **Output CSS:** inline rendering in household detail (no wrapper)
- **Used in:** HouseholdDetail
- **Design intent:** Internal admin notes about a household. Plain prose.

#### support-reply
- **Engine:** RimProseEditor
- **Output CSS:** email HTML (inlined via juice on send)
- **Used in:** SupportInboxClient (reply + compose)
- **Design intent:** Outgoing support email. Plain and warm. Output rendered through an email-safe pipeline (see "Emails" below).

#### lesson-notes
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content ls-notes-body`
- **Used in:** LessonNoteEditor
- **Design intent:** A member's personal reflection space. Private. Minimal chrome, inviting feel.

#### reflection-question
- **Engine:** RimProseEditor (minimal — bold/italic/link only)
- **Output CSS:** `ls-question__text` (inline rendering)
- **Used in:** LessonEditor (question body field)
- **Design intent:** Short question text. May include bold/italic for emphasis. Rendered inline with a question number prefix.

#### volunteer-note
- **Engine:** RimProseEditor
- **Output CSS:** inline in volunteer registrar table
- **Used in:** registrar/VolunteerTable (inline note edit)
- **Design intent:** Short staff notes on a volunteer registration. Plain prose.

#### site-banner
- **Engine:** RimProseEditor
- **Output CSS:** `rim-content ban-body`
- **Used in:** `/admin/banner`
- **Design intent:** Site-wide announcement strip. Short, direct, optionally with a link.

#### program-message-fields
- **Engine:** RimProseEditor
- **Output CSS:** varies by surface (`pg-dana__message`, `mpd-dana__text`, email HTML)
- **Used in:** ProgramEditor — special announcement, early arrival, confirmation message, reminder message, dana message
- **Design intent:** Short directional messages to registrants. Prose with lists.

#### schedule-submessage
- **Engine:** RimProseEditor
- **Output CSS:** inline rendering
- **Used in:** HubScheduleClient
- **Design intent:** Optional sub-message on a scheduled event. Brief prose.

### Outlier — not in the tier system

#### email-template (MarkdownEditor)
- **Engine:** MarkdownEditor (Tiptap + tiptap-markdown, NOT BlockNote)
- **Custom blocks:** VariableNode (`{{variable}}` template tags)
- **Output CSS:** email HTML (inline styles via marked → juice → Resend)
- **Used in:** EmailTemplateEditor
- **Design intent:** Email template authoring. Input/output is markdown, not BlockNote JSON. This is the only editor surface that does NOT use BlockNote. Kept separate because the markdown pipeline produces email-safe inlined HTML reliably. When user-generated BlockNote content needs to flow into email, add a dedicated BlockNote-to-email renderer — do not merge pipelines.

---

## Adding a New Context

1. Decide which tier the surface belongs to (Message, Document, Feature).
2. Define the output CSS class and where it will render (e.g., `rim-content fn-body`).
3. Add an entry to the registry above under the correct tier.
4. Pass the appropriate `context` prop to the editor (for RimBlockEditor) or select the right engine (RimProseEditor for Message).
5. Write the output CSS in `custom.css` under a clearly labeled section with the context name.
6. Never reuse another context's output CSS class for a new context — even if they look similar today. They will diverge.
7. Verify in the Editor Lab (`/admin/editor-lab`) that the tier's blocks render correctly in the new context's CSS.

---

## Output CSS Guidelines

Each context gets its own CSS class wrapping rendered HTML. Every wrapper also carries the shared `rim-content` base class. Global design tokens apply everywhere. Context classes tune the specific presentation.

**The two-class rule:**
```html
<div class="rim-content [context-class]">...rendered HTML...</div>
```
- `rim-content` = the shared foundation: font stack, list styles, base paragraph spacing, safe defaults.
- `[context-class]` = the tier- and surface-specific tuning: heading sizes, paragraph rhythm, color accents, table treatment.

**What varies by context:**

Heading sizes and weight
- Feature tier (lesson): serif, generous, unhurried
- Document tier: clear hierarchy, slightly smaller
- Message tier: no headings (rule)

Paragraph spacing and line height
- Feature: 1.8 line height, generous paragraph spacing
- Document: 1.55–1.7, workmanlike
- Message: 1.55, compact

Table styling
- Document / Feature: full styling, headers, borders
- Message: simpler styling, no heavy borders — tables in messages should feel calm

Custom block rendering (keyed by scope modifier — the rendered output uses shared `.rim-el-*` classes that read `.rim-content--document/--lesson/--program` for tier-specific treatment)
- Pull Quote: small indented left-rule quote in document scope; centered large serif pull quote in lesson / program scope
- Verse Quote: serif italic with left-rule + attribution (all scopes; size tuned per scope)
- Practice Suggestion: teal-tinted box with "PRACTICE" eyebrow; sans title in document scope, serif Quincy CF title in lesson / program scope
- Reflection: italic question lead-in + block-level body; hairline rules above and below (all scopes)
- Note / Decision (Callout): neutral Note vs green-flagged Decision; same chrome across scopes, tuned spacing per tier

**The rule:**
Output CSS lives in `custom.css` under a comment header matching the context name. It is written when the context is first built and updated as the design evolves. It is never borrowed from another context.

---

## Custom Blocks — BlockNote Implementation Layer

Custom blocks (the BlockNote side) live in `lib/blockNoteCustomBlocks.tsx`. Each custom block has:
- An editor render (what you see while writing — must match the output)
- A `toExternalHTML` render (what gets stored/exported)
- A CSS class that maps to the output surface's `rim-content [context]` wrapper

The registry (`lib/editorRegistry.ts`) sits on top — the registry is what the UI reads to decide which custom blocks to offer where. Adding a custom block is two files: the BlockNote definition, and the registry entry.

**Current custom blocks:**
- `pullQuote` — inline single-quote block with attribution prop *(dharma group; lesson + program-description)*
- `verseQuote` — inline single-quote block, serif italic, with attribution prop *(dharma group; lesson + program-description)*
- `practiceSuggestion` — container block with title prop and block-level body *(dharma group; lesson + program-description)*
- `reflection` — container block with italic question prop and block-level body *(dharma group; lesson + program-description)*
- `callout` — container block with `variant` prop (Note or Decision) and title prop *(callouts group; document + lesson + email-bound)*

**Container blocks** (`callout`, `practiceSuggestion`, `reflection`) use BlockNote's `content: "none"` schema + `children` for their block-level body. `lib/blockNoteCustomBlocks.tsx` exports `CONTAINER_BLOCK_TYPES` — renderer, migration, and insert logic all key off this set. On load, `RimBlockEditor` runs a defensive migration (`migrateLegacyContainers`) that:
- Strips stray `content` fields from any "none"-content block (would fail Prosemirror's `createChecked`).
- Converts legacy inline content into a `{ type: "paragraph", content: [...] }` child.
- Seeds an empty `{ type: "paragraph" }` child onto any container with no children (without this, BlockNote emits no `blockGroup` sibling and the container renders as uneditable chrome).

**Never** reuse a custom block type name that already exists — the type string is stored in the database permanently. Legacy callout variants (`info`, `warning`, `practice`, `reflection` as variant strings) still deserialize for archived content even though the picker now exposes only Note and Decision.

---

## Render Pipeline Reference

**Server render (accurate, full fidelity):**
```ts
import { renderContentBodyAsync } from "@/lib/renderRichContentServer"
const html = await renderContentBodyAsync(json)
```
Use in RSC page components. Handles BlockNote JSON, legacy Tiptap JSON, and rawHtml format. Renders custom dharma blocks correctly.

**Client render (lightweight fallback):**
```ts
import { renderBlockNoteHtml } from "@/lib/renderRichContent"
const html = renderBlockNoteHtml(json)
```
Use only when pre-rendered HTML isn't available from server (optimistic UI after a client mutation, the Editor Lab, etc.). Does not render custom dharma blocks with full fidelity.

**The pattern:**
Server component pre-renders → passes `bodyHtml` string as prop → client component renders with `dangerouslySetInnerHTML`.

Never call `renderContentBodyAsync` from a client component.
Never call `renderBlockNoteHtml` when a server render is available.

---

## Emails and Rich Content

Transactional emails use the `MarkdownEditor` pipeline (admin templates, fully inlined via juice). BlockNote JSON does not currently flow into emails.

**If a future flow needs user-written BlockNote content in email** (e.g., the support reply body passed through as rich, or announcement emails with Message-tier formatting):

1. Keep the `MarkdownEditor` + juice path as-is for admin template authoring.
2. Add a `renderMessageTierToEmailHtml(json)` helper that converts BlockNote JSON (Message tier blocks only — the email-safe subset) to inlined HTML using the same style tokens as admin templates.
3. Register the flow in this document.
4. Do not expand email to carry Document or Feature tier content — images, callouts, and dharma blocks don't render reliably across email clients.

**Consideration for the current support reply flow:** audit whether the reply body currently ships BlockNote JSON, rendered HTML, or plain text to Resend. If it ships rendered HTML from `renderBlockNoteHtml` without juice, that HTML may have display issues in strict email clients. Fix before going live.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · April 2026*
*Read this file before working on any editor, renderer, or content display surface.*
