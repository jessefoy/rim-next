/**
 * Editor Element Registry — single source of truth for every insertable /
 * convertible block across all editor placements.
 *
 * The pill's "+" menu, the slash menu, and the block-handle "Turn into" all
 * read from this file. Adding a new element is one registry entry: list every
 * placement it belongs to in `availableIn[]`, and it surfaces automatically.
 *
 * See `RIM_Editor_Types.md` (project root) for the canonical design reference.
 * It defines the four editor types (Document, Page Designer, Message, Form
 * Field) and the template-vs-content distinction that governs this registry.
 */

import type { ReactNode } from "react";

// ── Four editor types ────────────────────────────────────────────────────────
// Every placement maps to exactly one of these. See RIM_Editor_Types.md.

export type EditorType =
  | "document"      // standalone sophisticated document (headings, tables, images, callouts)
  | "page-designer" // authored-content composed from design blocks inside a page template
  | "message"       // general communication (prose + lists, no headings/images)
  | "form-field";   // inline-only (bold/italic/link)

// ── Placements ───────────────────────────────────────────────────────────────
// Named surfaces where an editor is instantiated. Each placement maps to one
// EditorType via PLACEMENT_TYPE below. New placements require:
//   (1) an entry here,
//   (2) an entry in PLACEMENT_TYPE,
//   (3) an output CSS class registered in custom.css,
//   (4) an entry in the Placement Registry in RIM_Editor_Types.md.

export type EditorPlacement =
  // Document type
  | "hub-document"
  | "manual"
  // Page Designer type
  | "program-description"
  | "lesson"
  // Message type — hub surfaces
  | "hub-welcome"
  | "hub-home"
  | "hub-conversation"
  | "hub-task"
  // Message type — email-bound / support
  | "support-reply"
  | "support-note"              // internal note on a support thread (not email)
  | "support-template"          // reusable reply body; becomes email content when used
  | "program-message"
  // Message type — scheduling messages
  | "sub-claim-message"         // message from sub-claimer back to original host
  // Message type — promotions (Stage 2d — schema change pending)
  | "teacher-bio"               // TeacherProfile.bio (String? → Json? pending)
  | "course-completion-note"    // Course.completionNote (String? → Json? pending)
  // Message type — short prose
  | "course-description"
  | "site-banner"
  | "schedule-submessage"
  // Message type — internal notes
  | "lesson-notes"
  | "admin-notes"
  | "household-notes"
  | "volunteer-note"
  // Form Field type
  | "reflection-question";

/** Legacy alias — call sites use `EditorContext`; kept for compatibility. */
export type EditorContext = EditorPlacement;

// Placement → type mapping. The single authority for "what kind of editor
// does this placement use". If a placement doesn't appear here, it's invalid.
export const PLACEMENT_TYPE: Record<EditorPlacement, EditorType> = {
  // Document
  "hub-document": "document",
  "manual": "document",
  // Page Designer
  "program-description": "page-designer",
  "lesson": "page-designer",
  // Message — hub
  "hub-welcome": "message",
  "hub-home": "message",
  "hub-conversation": "message",
  "hub-task": "message",
  // Message — email-bound / support
  "support-reply": "message",
  "support-note": "message",
  "support-template": "message",
  "program-message": "message",
  // Message — scheduling
  "sub-claim-message": "message",
  // Message — promotions (Stage 2d)
  "teacher-bio": "message",
  "course-completion-note": "message",
  // Message — short prose
  "course-description": "message",
  "site-banner": "message",
  "schedule-submessage": "message",
  // Message — internal notes
  "lesson-notes": "message",
  "admin-notes": "message",
  "household-notes": "message",
  "volunteer-note": "message",
  // Form Field
  "reflection-question": "form-field",
};

// ── Element shape ────────────────────────────────────────────────────────────

export type ElementGroup =
  | "text"
  | "lists"
  | "structure"
  | "media"
  | "callouts"
  | "dharma";

export interface EditorElement {
  id: string;
  label: string;
  icon?: ReactNode;
  group: ElementGroup;
  /** BlockNote block type string — matches the schema definition. */
  blockType: string;
  /** Optional props applied on insert / turn-into (e.g., heading level). */
  blockProps?: Record<string, unknown>;
  /** Which placements may offer this element. */
  availableIn: EditorPlacement[];
  /** If true, the element is only shown in the pill's "+" insert menu — not in "Turn into". */
  insertOnly?: boolean;
  /** If true, shown in "Turn into" but not insert (e.g., converting to a type). */
  turnIntoOnly?: boolean;
}

// ── Placement groupings by type (DRY helpers) ────────────────────────────────
// Derived from PLACEMENT_TYPE. These are the arrays elements use to express
// "available in all Document placements", "available in all Page Designer
// placements", etc.

const DOCUMENT_PLACEMENTS: EditorPlacement[] = [
  "hub-document",
  "manual",
];

const PAGE_DESIGNER_PLACEMENTS: EditorPlacement[] = [
  "program-description",
  "lesson",
];

const MESSAGE_PLACEMENTS: EditorPlacement[] = [
  "hub-welcome",
  "hub-home",
  "hub-conversation",
  "hub-task",
  "support-reply",
  "support-note",
  "support-template",
  "program-message",
  "sub-claim-message",
  "course-description",
  "course-completion-note",
  "site-banner",
  "schedule-submessage",
  "lesson-notes",
  "admin-notes",
  "household-notes",
  "volunteer-note",
  "teacher-bio",
];

const FORM_FIELD_PLACEMENTS: EditorPlacement[] = [
  "reflection-question",
];

// ── Block-availability helpers (composed from the groupings above) ──────────

/** Placements that offer full document structure (headings, images, dividers). */
const DOCUMENT_LIKE: EditorPlacement[] = [
  ...DOCUMENT_PLACEMENTS,
  ...PAGE_DESIGNER_PLACEMENTS,
];

/** Placements that host dharma / custom design blocks (Pull Quote, etc.). */
const DHARMA_BLOCKS_ALLOWED: EditorPlacement[] = [...PAGE_DESIGNER_PLACEMENTS];

/** Message placements that allow tables (coordination content). */
const MESSAGE_WITH_TABLES: EditorPlacement[] = [
  "support-reply",
  "support-template",
  "program-message",
  "hub-conversation",
  "hub-task",
];

/** Message placements that allow file attachments (email-bound or document-like). */
const MESSAGE_WITH_FILES: EditorPlacement[] = [
  "support-reply",
  "support-template",
  "program-message",
  "hub-conversation",
  "hub-task",
];

/** Every placement except the minimal Form Field ones. */
const ALL_EXCEPT_FORM_FIELD: EditorPlacement[] = [
  ...DOCUMENT_LIKE,
  ...MESSAGE_PLACEMENTS,
];

// ── Registry ────────────────────────────────────────────────────────────────

export const EDITOR_ELEMENTS: EditorElement[] = [
  // ── Text ──────────────────────────────────────────────────────────────────
  {
    id: "paragraph",
    label: "Paragraph",
    group: "text",
    blockType: "paragraph",
    availableIn: ALL_EXCEPT_FORM_FIELD,
    turnIntoOnly: true,
  },
  {
    id: "heading-1",
    label: "Heading 1",
    group: "text",
    blockType: "heading",
    blockProps: { level: 1 },
    availableIn: DOCUMENT_PLACEMENTS,
  },
  {
    id: "heading-2",
    label: "Heading 2",
    group: "text",
    blockType: "heading",
    blockProps: { level: 2 },
    availableIn: DOCUMENT_LIKE,
  },
  {
    id: "heading-3",
    label: "Heading 3",
    group: "text",
    blockType: "heading",
    blockProps: { level: 3 },
    availableIn: DOCUMENT_LIKE,
  },
  {
    id: "heading-4",
    label: "Heading 4",
    group: "text",
    blockType: "heading",
    blockProps: { level: 4 },
    availableIn: DOCUMENT_PLACEMENTS,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  {
    id: "bullet-list",
    label: "Bullet List",
    group: "lists",
    blockType: "bulletListItem",
    availableIn: ALL_EXCEPT_FORM_FIELD,
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    group: "lists",
    blockType: "numberedListItem",
    availableIn: ALL_EXCEPT_FORM_FIELD,
  },
  {
    id: "check-list",
    label: "Checklist",
    group: "lists",
    blockType: "checkListItem",
    availableIn: ALL_EXCEPT_FORM_FIELD,
  },

  // ── Structure ─────────────────────────────────────────────────────────────
  {
    id: "quote",
    label: "Quote",
    group: "structure",
    blockType: "quote",
    availableIn: ALL_EXCEPT_FORM_FIELD,
  },
  {
    id: "code-block",
    label: "Code Block",
    group: "structure",
    blockType: "codeBlock",
    availableIn: [...DOCUMENT_LIKE, ...MESSAGE_WITH_TABLES],
  },
  {
    id: "table",
    label: "Table",
    group: "structure",
    blockType: "table",
    availableIn: [...DOCUMENT_LIKE, ...MESSAGE_WITH_TABLES],
    insertOnly: true,
  },
  {
    id: "divider",
    label: "Divider",
    group: "structure",
    blockType: "divider",
    availableIn: DOCUMENT_LIKE,
    insertOnly: true,
  },

  // ── Media ─────────────────────────────────────────────────────────────────
  {
    id: "image",
    label: "Image",
    group: "media",
    blockType: "image",
    availableIn: DOCUMENT_LIKE,
    insertOnly: true,
  },
  {
    id: "file",
    label: "File attachment",
    group: "media",
    blockType: "file",
    availableIn: [...DOCUMENT_LIKE, ...MESSAGE_WITH_FILES],
    insertOnly: true,
  },

  // ── Callouts ──────────────────────────────────────────────────────────────
  // Note + Decision only (legacy info/warning variants remain in the block
  // schema for archived content but are not offered here).
  {
    id: "callout-note",
    label: "Note",
    group: "callouts",
    blockType: "callout",
    blockProps: { variant: "note" },
    availableIn: [...DOCUMENT_LIKE, ...MESSAGE_WITH_TABLES],
  },
  {
    id: "callout-decision",
    label: "Decision",
    group: "callouts",
    blockType: "callout",
    blockProps: { variant: "decision" },
    availableIn: [...DOCUMENT_LIKE, ...MESSAGE_WITH_TABLES],
  },

  // ── Dharma (design blocks for Page Designer placements only) ─────────────
  // Pull Quote and Verse Quote are inline single-quote blocks; Practice
  // Suggestion and Reflection are container blocks with block-level bodies.
  {
    id: "pull-quote",
    label: "Pull Quote",
    group: "dharma",
    blockType: "pullQuote",
    availableIn: DHARMA_BLOCKS_ALLOWED,
  },
  {
    id: "verse-quote",
    label: "Verse Quote",
    group: "dharma",
    blockType: "verseQuote",
    availableIn: DHARMA_BLOCKS_ALLOWED,
  },
  {
    id: "practice-suggestion",
    label: "Practice Suggestion",
    group: "dharma",
    blockType: "practiceSuggestion",
    availableIn: DHARMA_BLOCKS_ALLOWED,
  },
  {
    id: "reflection",
    label: "Reflection",
    group: "dharma",
    blockType: "reflection",
    availableIn: DHARMA_BLOCKS_ALLOWED,
  },
];

// ── Queries ──────────────────────────────────────────────────────────────────

/** All elements that may appear in this placement, preserving registry order. */
export function elementsForContext(context: EditorPlacement): EditorElement[] {
  return EDITOR_ELEMENTS.filter((el) => el.availableIn.includes(context));
}

/** Elements offered in the pill's "+" / slash menu for this placement. */
export function insertElementsForContext(
  context: EditorPlacement,
): EditorElement[] {
  return elementsForContext(context).filter((el) => !el.turnIntoOnly);
}

/** Elements offered in the block-handle "Turn into" menu for this placement. */
export function turnIntoElementsForContext(
  context: EditorPlacement,
): EditorElement[] {
  return elementsForContext(context).filter((el) => !el.insertOnly);
}

/** Group elements by their `group` key, preserving registry order within each group. */
export function groupElements(
  elements: EditorElement[],
): { group: ElementGroup; items: EditorElement[] }[] {
  const order: ElementGroup[] = [
    "text",
    "lists",
    "structure",
    "media",
    "callouts",
    "dharma",
  ];
  const buckets = new Map<ElementGroup, EditorElement[]>();
  for (const el of elements) {
    const bucket = buckets.get(el.group) ?? [];
    bucket.push(el);
    buckets.set(el.group, bucket);
  }
  return order
    .filter((g) => buckets.has(g))
    .map((group) => ({ group, items: buckets.get(group)! }));
}

/** Human-readable label for an element group. */
export const GROUP_LABELS: Record<ElementGroup, string> = {
  text: "Text",
  lists: "Lists",
  structure: "Structure",
  media: "Media",
  callouts: "Callouts",
  dharma: "Dharma",
};
