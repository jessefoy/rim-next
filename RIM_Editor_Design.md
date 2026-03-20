# RIM Editor Design
**How content is written, stored, and displayed across the platform**

Claude Code: Read this file before working on any editor component, content rendering, display page, or CSS that touches rich text output.

---

## The Intention

RIM's design is rooted in a Dharma principle: clear seeing is the prerequisite for wise and compassionate response. This applies to every interface — including the tools volunteers and staff use to create content.

An editor should feel calm and capable. The person writing a lesson should be thinking about the teaching, not about the tool. The person creating a hub document should be able to make something genuinely useful without wrestling with formatting. The output should be beautiful without effort — because the system has made the right choices in advance.

This means:
- The editor interaction is always the same. Type `/` to open the block menu. What's available depends on context.
- Available blocks are limited to what belongs in that context. A lesson has contemplative blocks. A hub document has document blocks. A conversation reply has nothing except prose.
- Output CSS is context-specific. The same paragraph block renders differently in a lesson than in a manual than in a hub document. This is intentional.
- Every editor context is registered here. Nothing is added without a corresponding entry in this file.

---

## The Two Editors

### RimBlockEditor
Full block editor. Used for structured, long-form content.
- Headings (H2/H3), tables, bullet/numbered lists, blockquotes, dividers, code blocks
- Custom blocks via slash menu — context-dependent (see registry)
- Used when: content has structure, hierarchy, or contemplative elements

### RimProseEditor
Prose editor. Used for messages, notes, short descriptions.
- Paragraphs, bullet/numbered lists, blockquotes
- Bold, italic, underline, links
- No headings, no tables, no custom blocks
- `minimal` prop: strips to Bold + Italic + Link only
- Used when: content is conversational or short-form

Both editors:
- Store content as BlockNote JSON (array of block objects)
- Are uncontrolled after mount — initialContent set once
- Fire onChange with the new block array on every change
- Accept a `legacyHtml` prop for Tiptap-era content migration

---

## Context Registry

Every place in the system that uses an editor is registered here. When adding a new editor surface, add an entry before building.

### lesson
**Editor:** RimBlockEditor
**Custom blocks:** VerseQuote, PracticeSuggestion, Callout
**Output CSS class:** `lp-body`
**Used in:** LessonEditor → lesson page (`/lessons/[slug]`)
**Design intent:** The primary contemplative content surface. Reading a lesson should feel like reading a well-designed dharma text. Generous line height, serif headings, pull quotes, verse blocks with left-rule treatment, practice suggestions in warm teal. Unhurried. Nothing competes with the content.

### manual
**Editor:** RimBlockEditor
**Custom blocks:** InfoCallout (note/tip, not dharma-flavored)
**Output CSS class:** `man-body`
**Used in:** ManualSectionEditor → manual page (`/admin/manual/[slug]`)
**Design intent:** Structured reference documentation. Tables with styled headers, note/tip callout boxes, clear heading hierarchy. Feels like a well-organized internal wiki. Not contemplative — informational. The original hand-crafted manual HTML is the aesthetic reference.

### hub-document
**Editor:** RimBlockEditor
**Custom blocks:** None
**Output CSS class:** `hdoc-body`
**Used in:** HubDocumentEditor → hub document view (`/account/hub/[slug]/documents/[id]`)
**Design intent:** A mature working document. Notion is the reference — clean, spacious, block-based, typeset. Meeting notes, volunteer guidelines, process docs. The editor should feel capable and the output should feel like a real document, not a webpage.

### program-description
**Editor:** RimBlockEditor
**Custom blocks:** Callout
**Output CSS class:** `prog-description`
**Used in:** ProgramEditor → program detail page
**Design intent:** Rich program information. Can include callout boxes for important details (e.g., "What to bring", "Location notes"). Readable and warm.

### course-description
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** `crs-description`
**Used in:** CourseEditor → series page
**Design intent:** Short descriptive prose. No headings. Sets the tone for the series without overwhelming the lesson list.

### hub-announcement
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** `ann-item__body`
**Used in:** HubAnnouncementsClient
**Design intent:** Clear, direct team messages. Prose with lists when needed. Not a document — a message.

### hub-conversation
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** `cv-post__body`
**Used in:** HubConvClient, HubConvThreadClient
**Design intent:** Conversational. Minimal. Should feel like a thoughtful message, not a formatted document.

### admin-notes
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** rendered inline in member profile (no wrapper)
**Used in:** AdminNotesSection
**Design intent:** Internal notes. Plain prose. Not displayed to members.

### support-reply
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** email HTML (inline styles via Resend)
**Used in:** SupportInboxClient (reply + compose)
**Design intent:** Outgoing email. Output must be email-safe HTML. Plain and warm — not formatted like a web page.

### lesson-notes
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** `ls-notes-body`
**Used in:** LessonNoteEditor
**Design intent:** Personal and private. A member's own reflection space. Minimal chrome, inviting feel.

### reflection-question
**Editor:** RimProseEditor
**Custom blocks:** None
**Output CSS class:** `ls-question__text` (inline rendering)
**Used in:** LessonEditor (question body field)
**Design intent:** Short question text. May include bold/italic for emphasis. Rendered inline with a question number prefix.

---

## Adding a New Context

When a new editor surface is needed:

1. Decide: is this structural content (RimBlockEditor) or conversational content (RimProseEditor)?
2. Decide: which custom blocks belong here, if any?
3. Define the output CSS class and where it will render.
4. Add an entry to this registry.
5. Add a `context` prop value to `RimBlockEditor` if custom blocks differ from existing contexts.
6. Write the output CSS in `custom.css` under a clearly labeled section with the context name.
7. Never reuse another context's output CSS class for a new context — even if they look similar today. They will diverge.

---

## Output CSS Guidelines

Each context gets its own CSS class wrapping rendered HTML. Global design tokens (`--rim-bg`, `--font-serif`, etc.) apply everywhere. Context classes tune the specific presentation.

### What varies by context

**Heading sizes and weight**
- Lesson (`lp-body`): generous, serif, unhurried
- Manual (`man-body`): clear hierarchy, slightly smaller
- Hub document (`hdoc-body`): clean, functional, Notion-like

**Paragraph spacing and line height**
- Lesson: 1.8 line height, generous paragraph spacing
- Hub document: tighter, more workmanlike
- Conversation/notes: minimal

**Table styling**
- Manual: striped headers, clear borders, readable
- Hub document: clean, minimal borders
- Lesson: rarely used, but if present, warm treatment

**Custom block rendering**
- VerseQuote: serif italic, left-rule, warm background, attribution in small caps. Lesson only.
- PracticeSuggestion: teal-tinted box, "Practice" label badge. Lesson only.
- Callout (dharma): warm amber, used for important lesson notes.
- InfoCallout (manual): neutral blue-grey, "Note" or "Tip" prefix.

### The rule

Output CSS lives in `custom.css` under a comment header matching the context name. It is written when the context is first built and updated as the design evolves. It is never borrowed from another context.

---

## The Custom Block System

Custom blocks are defined in `lib/blockNoteCustomBlocks.tsx`.

Current blocks:
- `verseQuote` — contemplative verse, optional attribution
- `practiceSuggestion` — practice invitation
- `callout` — general callout with variant (info/note/warning)

Each block has:
- An editor render (what you see while writing)
- A `toExternalHTML` render (what gets stored/exported)
- A CSS class that maps to the output context

When adding a new custom block:
1. Define it in `blockNoteCustomBlocks.tsx`
2. Add it to the appropriate schema (`rimBlockSchema` or a new context schema)
3. Write both editor-view CSS (`bn-` prefix) and output CSS (`lp-`, `man-`, etc. depending on context)
4. Register it in this document under the context(s) it belongs to
5. Never use a custom block type name that already exists — the type string is stored in the database permanently

---

## Render Pipeline Reference

**Server render (accurate, full fidelity):**
```ts
import { renderContentBodyAsync } from "@/lib/renderRichContentServer"
const html = await renderContentBodyAsync(json)
```
Use in RSC page components. Handles BlockNote JSON, legacy Tiptap JSON, and rawHtml format.

**Client render (lightweight fallback):**
```ts
import { renderBlockNoteHtml } from "@/lib/renderRichContent"
const html = renderBlockNoteHtml(json)
```
Use only when pre-rendered HTML isn't available from server. Does not render custom Dharma blocks accurately.

**The pattern:**
Server component pre-renders → passes `bodyHtml` string as prop → client component renders with `dangerouslySetInnerHTML`.

Never call `renderContentBodyAsync` from a client component.
Never call `renderBlockNoteHtml` when a server render is available.

---

*Rooted in Mindfulness · rootedinmindfulness.org*
*Working document · March 2026*
*Read this file before working on any editor, renderer, or content display surface.*
