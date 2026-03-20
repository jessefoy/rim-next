"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Design:
 *   - No side menu, no slash commands
 *   - Floating pill toolbar on text selection: B, I, U, Link
 *   - Persistent bottom bar (toggleable): H ▾, List ▾, B, I, U, Link, ⋯
 *   - Context-specific ⋯ menu: Dharma blocks for lessons, etc.
 *   - Inter font, generous line height, clean Bear-like feel
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type EditorContext = "lesson" | "document" | "default";

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  action: (editor: any) => void;
}

/* ── Context-specific ⋯ items ──────────────────────────────────────────── */

function getDharmaItems(): ContextMenuItem[] {
  return [
    {
      label: "Verse Quote",
      icon: <RiQuoteText size={15} />,
      action: (editor) => {
        const block = editor.getTextCursorPosition().block;
        editor.insertBlocks([{ type: "verseQuote" as any }], block, "after");
        // Move cursor into new block
        const newBlock = editor.getTextCursorPosition().nextBlock;
        if (newBlock) editor.setTextCursorPosition(newBlock, "start");
      },
    },
    {
      label: "Practice Suggestion",
      icon: <RiPlantLine size={15} />,
      action: (editor) => {
        const block = editor.getTextCursorPosition().block;
        editor.insertBlocks([{ type: "practiceSuggestion" as any }], block, "after");
        const newBlock = editor.getTextCursorPosition().nextBlock;
        if (newBlock) editor.setTextCursorPosition(newBlock, "start");
      },
    },
    {
      label: "Callout",
      icon: <RiInformationLine size={15} />,
      action: (editor) => {
        const block = editor.getTextCursorPosition().block;
        editor.insertBlocks([{ type: "callout" as any }], block, "after");
        const newBlock = editor.getTextCursorPosition().nextBlock;
        if (newBlock) editor.setTextCursorPosition(newBlock, "start");
      },
    },
  ];
}

function getDocumentItems(): ContextMenuItem[] {
  return [
    {
      label: "Horizontal Rule",
      action: (editor) => {
        const block = editor.getTextCursorPosition().block;
        editor.insertBlocks(
          [{ type: "paragraph" as any, content: [{ type: "text", text: "---", styles: {} }] }],
          block,
          "after"
        );
      },
    },
    {
      label: "Table",
      action: (editor) => {
        const block = editor.getTextCursorPosition().block;
        editor.insertBlocks([{ type: "table" as any }], block, "after");
      },
    },
  ];
}

function getContextItems(context: EditorContext): ContextMenuItem[] {
  switch (context) {
    case "lesson":
      return [...getDharmaItems(), ...getDocumentItems()];
    case "document":
      return getDocumentItems();
    default:
      return getDocumentItems();
  }
}

/* ── Dropdown helper ───────────────────────────────────────────────────── */

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return { open, setOpen, ref };
}

/* ── Bear-style persistent bottom bar ──────────────────────────────────── */

function BearBottomBar({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [activeBlock, setActiveBlock] = useState<string>("");
  const [activeStyles, setActiveStyles] = useState<Record<string, any>>({});
  const [showBar, setShowBar] = useState(true);

  // Track current block type and inline styles
  useEditorSelectionChange(() => {
    const block = editor.getTextCursorPosition().block;
    setActiveBlock(block?.type ?? "");
    try {
      setActiveStyles(editor.getActiveStyles());
    } catch {
      setActiveStyles({});
    }
  });

  // --- Heading dropdown ---
  const hDrop = useDropdown();
  const headingItems = [
    { label: "Heading 2", type: "heading", props: { level: 2 } },
    { label: "Heading 3", type: "heading", props: { level: 3 } },
    { label: "Paragraph", type: "paragraph", props: undefined },
  ];

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, {
      type: type as any,
      props,
    });
  }

  // --- List dropdown ---
  const listDrop = useDropdown();
  const listItems = [
    { label: "Bullet List", type: "bulletListItem" },
    { label: "Numbered List", type: "numberedListItem" },
    { label: "Quote", type: "quote" },
  ];

  // --- Context ⋯ dropdown ---
  const ctxDrop = useDropdown();
  const contextItems = useMemo(() => getContextItems(context), [context]);

  // --- Inline style toggles ---
  function toggleStyle(style: string) {
    editor.focus();
    editor.toggleStyles({ [style]: true } as any);
  }

  // --- Link ---
  function insertLink() {
    editor.focus();
    const url = window.prompt("Link URL:");
    if (!url) return;
    editor.createLink(url);
  }

  if (!showBar) {
    return (
      <div className="bear-bar bear-bar--collapsed">
        <button
          type="button"
          className="bear-bar__toggle"
          onMouseDown={(e) => { e.preventDefault(); setShowBar(true); }}
          title="Show toolbar"
        >
          ▲
        </button>
      </div>
    );
  }

  return (
    <div className="bear-bar">
      {/* Heading dropdown */}
      <div className="bear-bar__group" ref={hDrop.ref}>
        <button
          type="button"
          className={`bear-bar__btn bear-bar__btn--dropdown${activeBlock === "heading" ? " bear-bar__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); hDrop.setOpen(!hDrop.open); }}
          title="Headings"
        >
          H
        </button>
        {hDrop.open && (
          <div className="bear-bar__dropdown bear-bar__dropdown--up">
            {headingItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`bear-bar__dropdown-item${
                  activeBlock === item.type ? " bear-bar__dropdown-item--active" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setBlockType(item.type, item.props);
                  hDrop.setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List dropdown */}
      <div className="bear-bar__group" ref={listDrop.ref}>
        <button
          type="button"
          className={`bear-bar__btn bear-bar__btn--dropdown${
            ["bulletListItem", "numberedListItem", "quote"].includes(activeBlock) ? " bear-bar__btn--active" : ""
          }`}
          onMouseDown={(e) => { e.preventDefault(); listDrop.setOpen(!listDrop.open); }}
          title="Lists & quotes"
        >
          ≡
        </button>
        {listDrop.open && (
          <div className="bear-bar__dropdown bear-bar__dropdown--up">
            {listItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`bear-bar__dropdown-item${
                  activeBlock === item.type ? " bear-bar__dropdown-item--active" : ""
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setBlockType(item.type);
                  listDrop.setOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bear-bar__sep" />

      {/* Inline formatting */}
      <button
        type="button"
        className={`bear-bar__btn${activeStyles.bold ? " bear-bar__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); toggleStyle("bold"); }}
        title="Bold"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        className={`bear-bar__btn${activeStyles.italic ? " bear-bar__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); toggleStyle("italic"); }}
        title="Italic"
      >
        <em>I</em>
      </button>
      <button
        type="button"
        className={`bear-bar__btn${activeStyles.underline ? " bear-bar__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); toggleStyle("underline"); }}
        title="Underline"
      >
        <u>U</u>
      </button>
      <button
        type="button"
        className="bear-bar__btn"
        onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
        title="Insert link"
      >
        🔗
      </button>

      {/* Context ⋯ menu */}
      {contextItems.length > 0 && (
        <>
          <div className="bear-bar__sep" />
          <div className="bear-bar__group" ref={ctxDrop.ref}>
            <button
              type="button"
              className={`bear-bar__btn bear-bar__btn--dropdown${ctxDrop.open ? " bear-bar__btn--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); ctxDrop.setOpen(!ctxDrop.open); }}
              title="Insert block"
            >
              ⋯
            </button>
            {ctxDrop.open && (
              <div className="bear-bar__dropdown bear-bar__dropdown--up bear-bar__dropdown--right">
                {contextItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="bear-bar__dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      item.action(editor);
                      ctxDrop.setOpen(false);
                      editor.focus();
                    }}
                  >
                    {item.icon && <span className="bear-bar__dropdown-icon">{item.icon}</span>}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Toggle bar off */}
      <button
        type="button"
        className="bear-bar__toggle"
        onMouseDown={(e) => { e.preventDefault(); setShowBar(false); }}
        title="Hide toolbar"
      >
        ▼
      </button>
    </div>
  );
}

/* ── Main editor ────────────────────────────────────────────────────────── */

interface Props {
  value: any;            // BlockNote JSON (array of blocks) or null
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
  legacyHtml?: string;  // pre-rendered HTML for Tiptap → BlockNote import on mount
  context?: EditorContext;  // controls ⋯ menu items
}

export default function RimBlockEditor({
  value,
  onChange,
  minHeight = 420,
  legacyHtml,
  context = "default",
}: Props) {
  const hasBlockNoteContent = Array.isArray(value) && value.length > 0;

  const editor = useCreateBlockNote(
    {
      schema: rimBlockSchema,
      initialContent: hasBlockNoteContent ? value : undefined,
    },
    []
  );

  // Import legacy HTML on mount when no BlockNote content exists
  useEffect(() => {
    if (legacyHtml && !hasBlockNoteContent) {
      const blocks = editor.tryParseHTMLToBlocks(legacyHtml);
      if (blocks.length > 0) {
        editor.replaceBlocks(editor.document, blocks);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rim-block-editor" style={{ minHeight }}>
      <BlockNoteView
        editor={editor}
        theme={rimTheme}
        onChange={(editor) => onChange(editor.document)}
        slashMenu={false}
        sideMenu={false}
        formattingToolbar={false}
      >
        {/* Floating pill toolbar on text selection: B / I / U / Link */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BasicTextStyleButton key="bold" basicTextStyle="bold" />
              <BasicTextStyleButton key="italic" basicTextStyle="italic" />
              <BasicTextStyleButton key="underline" basicTextStyle="underline" />
              <CreateLinkButton key="link" />
            </FormattingToolbar>
          )}
        />
        {/* Bear-style persistent bottom bar */}
        <BearBottomBar context={context} />
      </BlockNoteView>
    </div>
  );
}
