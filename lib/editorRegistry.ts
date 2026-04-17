/**
 * Editor Element Registry — single source of truth for every insertable /
 * convertible block across all editor surfaces. The pill's "+" menu, the
 * slash menu, and the block-handle "Turn into" all read from this file.
 *
 * Adding a new element is one registry entry: list every context it belongs
 * to in `availableIn[]`, and it surfaces automatically.
 *
 * See RIM_Editor_Design.md → "Element Registry" for the full contract.
 */

import type { ReactNode } from "react";

// ── Contexts ─────────────────────────────────────────────────────────────────

export type EditorContext =
  // Document tier
  | "hub-document"
  | "hub-welcome"
  | "hub-home"
  | "manual"
  | "program-description"
  // Feature tier
  | "lesson"
  // Email-bound (Message + tables + future attachments)
  | "support-reply"
  | "program-message"
  // Message tier — team messaging
  | "hub-announcement"
  | "hub-task"
  | "hub-conversation"
  // Message tier — short prose
  | "course-description"
  | "site-banner"
  | "schedule-submessage"
  // Message tier — internal notes
  | "lesson-notes"
  | "admin-notes"
  | "household-notes"
  | "volunteer-note"
  // Minimal
  | "reflection-question";

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
  /** Which surfaces may offer this element. */
  availableIn: EditorContext[];
  /** If true, the element is only shown in the pill's "+" insert menu — not in "Turn into". */
  insertOnly?: boolean;
  /** If true, shown in "Turn into" but not insert (e.g., converting to a type). */
  turnIntoOnly?: boolean;
}

// ── Context groupings (DRY helpers) ──────────────────────────────────────────
// Keep these in sync with the intended reach of each element group.

const DOCUMENT_LIKE: EditorContext[] = [
  "hub-document",
  "hub-welcome",
  "hub-home",
  "manual",
  "program-description",
];

const LESSON_ONLY: EditorContext[] = ["lesson"];

const DOCUMENT_AND_LESSON: EditorContext[] = [...DOCUMENT_LIKE, ...LESSON_ONLY];

const EMAIL_BOUND: EditorContext[] = ["support-reply", "program-message"];

const TEAM_MESSAGING: EditorContext[] = [
  "hub-announcement",
  "hub-task",
  "hub-conversation",
];

const SHORT_PROSE: EditorContext[] = [
  "course-description",
  "site-banner",
  "schedule-submessage",
];

const INTERNAL_NOTES: EditorContext[] = [
  "lesson-notes",
  "admin-notes",
  "household-notes",
  "volunteer-note",
];

/** All Message-tier surfaces that allow tables (excluding minimal contexts). */
const MESSAGE_WITH_TABLES: EditorContext[] = [
  ...EMAIL_BOUND,
  ...TEAM_MESSAGING,
];

/** Every context except the minimal "reflection-question" one. */
const ALL_EXCEPT_MINIMAL: EditorContext[] = [
  ...DOCUMENT_AND_LESSON,
  ...EMAIL_BOUND,
  ...TEAM_MESSAGING,
  ...SHORT_PROSE,
  ...INTERNAL_NOTES,
];

// ── Registry ────────────────────────────────────────────────────────────────

export const EDITOR_ELEMENTS: EditorElement[] = [
  // ── Text ──────────────────────────────────────────────────────────────────
  {
    id: "paragraph",
    label: "Paragraph",
    group: "text",
    blockType: "paragraph",
    availableIn: ALL_EXCEPT_MINIMAL,
    turnIntoOnly: true,
  },
  {
    id: "heading-1",
    label: "Heading 1",
    group: "text",
    blockType: "heading",
    blockProps: { level: 1 },
    availableIn: DOCUMENT_LIKE,
  },
  {
    id: "heading-2",
    label: "Heading 2",
    group: "text",
    blockType: "heading",
    blockProps: { level: 2 },
    availableIn: DOCUMENT_AND_LESSON,
  },
  {
    id: "heading-3",
    label: "Heading 3",
    group: "text",
    blockType: "heading",
    blockProps: { level: 3 },
    availableIn: DOCUMENT_AND_LESSON,
  },
  {
    id: "heading-4",
    label: "Heading 4",
    group: "text",
    blockType: "heading",
    blockProps: { level: 4 },
    availableIn: DOCUMENT_LIKE,
  },

  // ── Lists ─────────────────────────────────────────────────────────────────
  {
    id: "bullet-list",
    label: "Bullet List",
    group: "lists",
    blockType: "bulletListItem",
    availableIn: ALL_EXCEPT_MINIMAL,
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    group: "lists",
    blockType: "numberedListItem",
    availableIn: ALL_EXCEPT_MINIMAL,
  },
  {
    id: "check-list",
    label: "Checklist",
    group: "lists",
    blockType: "checkListItem",
    availableIn: ALL_EXCEPT_MINIMAL,
  },

  // ── Structure ─────────────────────────────────────────────────────────────
  {
    id: "quote",
    label: "Quote",
    group: "structure",
    blockType: "quote",
    availableIn: ALL_EXCEPT_MINIMAL,
  },
  {
    id: "code-block",
    label: "Code Block",
    group: "structure",
    blockType: "codeBlock",
    availableIn: [...DOCUMENT_AND_LESSON, ...MESSAGE_WITH_TABLES],
  },
  {
    id: "table",
    label: "Table",
    group: "structure",
    blockType: "table",
    availableIn: [...DOCUMENT_AND_LESSON, ...MESSAGE_WITH_TABLES],
    insertOnly: true,
  },
  {
    id: "divider",
    label: "Divider",
    group: "structure",
    blockType: "divider",
    availableIn: DOCUMENT_AND_LESSON,
    insertOnly: true,
  },

  // ── Media ─────────────────────────────────────────────────────────────────
  {
    id: "image",
    label: "Image",
    group: "media",
    blockType: "image",
    availableIn: DOCUMENT_AND_LESSON,
    insertOnly: true,
  },
  {
    id: "file",
    label: "File attachment",
    group: "media",
    blockType: "file",
    availableIn: [...DOCUMENT_AND_LESSON, ...MESSAGE_WITH_TABLES],
    insertOnly: true,
  },

  // ── Callouts (shared across documents, lessons, and email-bound) ─────────
  // Note variants (info, warning) exist in the block schema for legacy content
  // but are intentionally not offered here — Jesse kept only Note + Decision
  // as the two meaningful callout roles.
  {
    id: "callout-note",
    label: "Note",
    group: "callouts",
    blockType: "callout",
    blockProps: { variant: "note" },
    availableIn: [...DOCUMENT_AND_LESSON, ...MESSAGE_WITH_TABLES],
  },
  {
    id: "callout-decision",
    label: "Decision",
    group: "callouts",
    blockType: "callout",
    blockProps: { variant: "decision" },
    availableIn: [...DOCUMENT_AND_LESSON, ...MESSAGE_WITH_TABLES],
  },

  // ── Dharma (editorial elements — lesson + program-description) ───────────
  // Five distinct elements, each with its own visual identity. Pull Quote and
  // Verse Quote are inline single-quote blocks; Practice Suggestion and
  // Reflection are container blocks with block-level bodies.
  {
    id: "pull-quote",
    label: "Pull Quote",
    group: "dharma",
    blockType: "pullQuote",
    availableIn: [...LESSON_ONLY, "program-description"],
  },
  {
    id: "verse-quote",
    label: "Verse Quote",
    group: "dharma",
    blockType: "verseQuote",
    availableIn: [...LESSON_ONLY, "program-description"],
  },
  {
    id: "practice-suggestion",
    label: "Practice Suggestion",
    group: "dharma",
    blockType: "practiceSuggestion",
    availableIn: [...LESSON_ONLY, "program-description"],
  },
  {
    id: "reflection",
    label: "Reflection",
    group: "dharma",
    blockType: "reflection",
    availableIn: [...LESSON_ONLY, "program-description"],
  },
];

// ── Queries ──────────────────────────────────────────────────────────────────

/** All elements that may appear in this context, preserving registry order. */
export function elementsForContext(context: EditorContext): EditorElement[] {
  return EDITOR_ELEMENTS.filter((el) => el.availableIn.includes(context));
}

/** Elements offered in the pill's "+" / slash menu for this context. */
export function insertElementsForContext(
  context: EditorContext,
): EditorElement[] {
  return elementsForContext(context).filter((el) => !el.turnIntoOnly);
}

/** Elements offered in the block-handle "Turn into" menu for this context. */
export function turnIntoElementsForContext(
  context: EditorContext,
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
