---
name: Editor standard for text fields
description: "RimProseEditor (BlockNote JSON) for all multi-line communication fields; RimBlockEditor for structured content; MarkdownEditor for email templates ONLY. Never use plain textarea."
type: feedback
---

Two BlockNote editors, one schema (`rimBlockSchema`), one renderer. Never use plain `<textarea>` for rich text.

**RimBlockEditor** (`components/RimBlockEditor.tsx`) — full document editor with Bear-style pill toolbar, headings, tables, images, lists, custom Dharma blocks (VerseQuote, PracticeSuggestion, Callout via slash commands). Used for: `Lesson.body`, `Program.description`, manual sections, hub documents.

**RimProseEditor** (`components/RimProseEditor.tsx`) — prose editor with two variants:
- `variant="document"` — full toolbar (for task bodies, hub home content, longer prose)
- `variant="compact"` — selection-only toolbar (for notes, messages, short descriptions, subtask details)

**MarkdownEditor** (`components/MarkdownEditor.tsx`) — Tiptap-based, email templates ONLY. Not the platform standard.

**Why:** BlockNote replaced all Tiptap editors in session 69. FormattedEditor and ContentEditor were deleted. The entire platform standardized on BlockNote JSON stored in `Json?` Prisma fields.

**How to apply:**
- Multi-line communication field (notes, reflections, messages) → `RimProseEditor variant="compact"`
- Document-length content (task body, hub home, welcome text) → `RimProseEditor variant="document"`
- Structured content with custom blocks (lessons, programs, manual) → `RimBlockEditor`
- DB field must be `Json?` (not `String?`) to store BlockNote JSON
- Server rendering: `renderContentBodyAsync()` / `renderFormattedTextAsync()` from `lib/renderRichContentServer.ts`
- Client rendering: `renderBlockNoteHtml()` from `lib/renderRichContent.ts`
- Plain text extraction: `extractBlockNoteText()` from `lib/renderRichContent.ts`
- Single-line inputs (name, email, URL, short label) remain `<input type="text">`
- Never put custom React components inside `FormattingToolbar` — causes crashes
