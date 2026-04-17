# RIM Editor Design
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
- **VerseQuote** — contemplative verse with optional attribution; serif italic with left-rule and warm background
- **PracticeSuggestion** — a practice invitation; teal-tinted box with "Practice" label badge
- **Callout** (dharma) — warm amber callout for important lesson notes

**Excluded:**
- H1 (page title only)

**Currently used in:** Lessons only. If a future feature develops its own contemplative voice (e.g., retreat reflections, dharma talk transcripts), it joins this tier.

**Implementation engine:** `RimBlockEditor` with `context="lesson"`.

---

## Editor Chrome — Consistent Across All Tiers

Every editor, regardless of tier, uses the same interaction patterns. Users learn these once and use them everywhere.

**Five surfaces, layered:**

1. **Selection bubble** — appears above selected text. Inline formatting only: bold, italic, underline, link, align (where applicable). Never shows block-insert actions.
2. **Empty-line pill** — appears at the left edge of any empty paragraph block. Opens a block picker. Notion/Medium pattern.
3. **Slash menu** — typing `/` anywhere opens the block picker, filtered to the current tier. Power-user shortcut for the same inserts as the empty-line pill.
4. **Block handle** — hover-reveals on the left of each block. Offers: drag to reorder, delete, duplicate, turn-into.
5. **Focus-revealed top toolbar** — appears when the editor has focus; disappears when it loses focus. Persistent actions that don't require a selection: block type selector, insert menu (image, table, divider, callout), undo, redo. Never duplicates the selection bubble's inline actions.

**Rules:**
- If a placeholder says "Press `/` for commands", the slash menu must work. No broken affordances.
- Empty-line pill and slash menu offer the same block set — two paths to one action.
- Top toolbar does not duplicate the selection bubble. Inline formatting is in the bubble only.
- The block handle's hover area is narrow (left gutter) — does not appear on hover of the block body.
- Focus-revealed toolbar animates in softly (opacity + 4px translate) so it doesn't jolt the page.

---

## WYSIWYG Parity Contract

The editor view and the rendered view must match. A writer sees what the reader will see.

**The technique:**
1. The editor's content-editable root is wrapped in `<div class="rim-content [context-class]">` — the same wrapper the rendered page uses.
2. Editor-only affordances (placeholder, cursor, selection highlight, drag handle, slash menu, empty-line pill, block handle, top toolbar) are scoped to selectors narrow enough not to touch content rendering — they hang off `.ProseMirror`, never off content block tags.
3. Context CSS is written once and consumed by both surfaces. No separate "editor theme" CSS.

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

Custom block rendering
- VerseQuote: serif italic, left-rule, warm background, attribution in small caps (Feature only)
- PracticeSuggestion: teal-tinted box, "Practice" label badge (Feature only)
- Dharma Callout: warm amber (Feature only)
- InfoCallout: neutral blue-grey, "Note" or "Tip" prefix (Document only)

**The rule:**
Output CSS lives in `custom.css` under a comment header matching the context name. It is written when the context is first built and updated as the design evolves. It is never borrowed from another context.

---

## The Custom Block System

Custom blocks are defined in `lib/blockNoteCustomBlocks.tsx`.

**Current blocks:**
- `verseQuote` — contemplative verse, optional attribution (Feature tier)
- `practiceSuggestion` — practice invitation (Feature tier)
- `callout` — dharma-flavored warm callout (Feature tier)
- `infoCallout` — neutral note/tip box (Document tier) *(add during Phase 3 if not yet present)*

**Each block has:**
- An editor render (what you see while writing — must match the output)
- A `toExternalHTML` render (what gets stored/exported)
- A CSS class that maps to the output tier

**When adding a new custom block:**
1. Decide which tier(s) it belongs to
2. Define it in `blockNoteCustomBlocks.tsx`
3. Add it to the appropriate schema (per tier)
4. Write editor-view CSS (inherits through the `rim-content [context]` wrapper — no separate `bn-` theme CSS)
5. Register it in this document under the tier(s) it belongs to
6. Never reuse a custom block type name that already exists — the type string is stored in the database permanently

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
