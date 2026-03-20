"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Unified contextual menu model:
 *   - One menu for everything: formatting, block types, insertions
 *   - On text selection → menu appears above selection (with inline B/I/U/Link)
 *   - On new/empty line → same menu appears below cursor (block types & insertions)
 *   - On "/" typed → same menu appears, filterable by typing
 *   - No side menu, no separate slash menu, no bottom bar
 *   - Context prop controls which special blocks appear (Dharma for lessons, etc.)
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type EditorContext = "lesson" | "document" | "default";

/* ── Unified menu content (shared between selection + empty-line triggers) ── */

function UnifiedMenuContent({
  hasTextSelection,
  context,
  onAction,
  filter,
}: {
  hasTextSelection: boolean;
  context: EditorContext;
  onAction?: () => void;
  filter?: string;
}) {
  const editor = useBlockNoteEditor();
  const [activeBlock, setActiveBlock] = useState("");
  const [activeStyles, setActiveStyles] = useState<Record<string, any>>({});

  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      setActiveBlock(block?.type ?? "");
    } catch { setActiveBlock(""); }
    try {
      setActiveStyles(editor.getActiveStyles());
    } catch { setActiveStyles({}); }
  });

  /* ── Actions ── */

  function toggleStyle(style: string) {
    editor.focus();
    editor.toggleStyles({ [style]: true } as any);
    // Keep menu open for multi-style toggling
  }

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, {
      type: type as any,
      props,
    });
    onAction?.();
  }

  function insertBlockAfter(type: string, props?: Record<string, any>) {
    const block = editor.getTextCursorPosition().block;
    editor.insertBlocks([{ type: type as any, props }], block, "after");
    setTimeout(() => {
      try {
        const next = editor.getTextCursorPosition().nextBlock;
        if (next) editor.setTextCursorPosition(next, "start");
      } catch {}
      editor.focus();
    }, 50);
    onAction?.();
  }

  function insertLink() {
    editor.focus();
    const url = window.prompt("Link URL:");
    if (url) editor.createLink(url);
  }

  /* ── Item definitions ── */

  const blockItems = [
    { id: "h2", label: "Heading 2", keywords: ["heading", "h2", "title"], type: "heading", props: { level: 2 } },
    { id: "h3", label: "Heading 3", keywords: ["heading", "h3", "subtitle"], type: "heading", props: { level: 3 } },
    { id: "p", label: "Paragraph", keywords: ["paragraph", "text", "body"], type: "paragraph", props: undefined },
  ];

  const listItems = [
    { id: "ul", label: "Bullet List", keywords: ["bullet", "list", "unordered"], type: "bulletListItem" },
    { id: "ol", label: "Numbered List", keywords: ["numbered", "ordered", "list"], type: "numberedListItem" },
    { id: "quote", label: "Quote", keywords: ["quote", "blockquote", "citation"], type: "quote" },
  ];

  const insertItems = useMemo(() => {
    const items: { id: string; label: string; keywords: string[]; icon?: React.ReactNode; type: string; props?: any }[] = [];
    if (context === "lesson") {
      items.push(
        { id: "verse", label: "Verse Quote", keywords: ["verse", "poetry", "sutta"], icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { id: "practice", label: "Practice Suggestion", keywords: ["practice", "meditation", "exercise"], icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { id: "callout", label: "Callout", keywords: ["callout", "note", "aside", "info"], icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    items.push(
      { id: "table", label: "Table", keywords: ["table", "grid", "data"], type: "table" },
    );
    return items;
  }, [context]);

  /* ── Filtering ── */

  const q = (filter ?? "").toLowerCase().trim();

  function matchesFilter(item: { label: string; keywords?: string[] }) {
    if (!q) return true;
    if (item.label.toLowerCase().includes(q)) return true;
    if (item.keywords?.some((k) => k.includes(q))) return true;
    return false;
  }

  const filteredBlocks = blockItems.filter(matchesFilter);
  const filteredLists = listItems.filter(matchesFilter);
  const filteredInserts = insertItems.filter(matchesFilter);
  const hasAnyResults = filteredBlocks.length + filteredLists.length + filteredInserts.length > 0;

  return (
    <div className="uem" onMouseDown={(e) => e.preventDefault()}>
      {/* ── Inline formatting (only when text is selected) ── */}
      {hasTextSelection && !q && (
        <div className="uem__inline-row">
          <button
            className={`uem__inline-btn${activeStyles.bold ? " uem__inline-btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("bold"); }}
            title="Bold"
          ><strong>B</strong></button>
          <button
            className={`uem__inline-btn${activeStyles.italic ? " uem__inline-btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("italic"); }}
            title="Italic"
          ><em>I</em></button>
          <button
            className={`uem__inline-btn${activeStyles.underline ? " uem__inline-btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("underline"); }}
            title="Underline"
          ><u>U</u></button>
          <button
            className="uem__inline-btn"
            onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
            title="Link"
          >🔗</button>
        </div>
      )}

      {/* ── Block types ── */}
      {filteredBlocks.length > 0 && (
        <div className="uem__section">
          <span className="uem__section-label">Blocks</span>
          {filteredBlocks.map((item) => (
            <button
              key={item.id}
              className={`uem__item${activeBlock === item.type ? " uem__item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType(item.type, item.props); }}
            >{item.label}</button>
          ))}
        </div>
      )}

      {/* ── Lists & quotes ── */}
      {filteredLists.length > 0 && (
        <div className="uem__section">
          <span className="uem__section-label">Lists</span>
          {filteredLists.map((item) => (
            <button
              key={item.id}
              className={`uem__item${activeBlock === item.type ? " uem__item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType(item.type); }}
            >{item.label}</button>
          ))}
        </div>
      )}

      {/* ── Insert blocks (context-specific) ── */}
      {filteredInserts.length > 0 && (
        <div className="uem__section">
          <span className="uem__section-label">Insert</span>
          {filteredInserts.map((item) => (
            <button
              key={item.id}
              className="uem__item"
              onMouseDown={(e) => { e.preventDefault(); insertBlockAfter(item.type, item.props); }}
            >
              {item.icon && <span className="uem__item-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* ── No results ── */}
      {q && !hasAnyResults && (
        <div className="uem__empty">No matching items</div>
      )}
    </div>
  );
}

/* ── Empty-line & slash-command floating menu ──────────────────────────── */

function CommandMenu({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState("");
  const [isSlashMode, setIsSlashMode] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /** Check if cursor is in an empty paragraph */
  function isBlockEmpty() {
    try {
      const block = editor.getTextCursorPosition().block;
      if (!block || block.type !== "paragraph") return false;
      const c = block.content;
      if (!c || !Array.isArray(c) || c.length === 0) return true;
      if (c.length === 1 && c[0].type === "text" && (!c[0].text || c[0].text === "")) return true;
      return false;
    } catch { return false; }
  }

  /** Check if current block text starts with "/" (slash command) */
  function getSlashQuery(): string | null {
    try {
      const block = editor.getTextCursorPosition().block;
      if (!block) return null;
      const c = block.content;
      if (!Array.isArray(c) || c.length === 0) return null;
      const text = c.map((n: any) => n.text ?? "").join("");
      if (text.startsWith("/")) return text.slice(1);
      return null;
    } catch { return null; }
  }

  /** Position the menu near the cursor */
  function updatePos() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    // For collapsed range in empty element, use parent node
    if (rect.height === 0 && rect.width === 0) {
      const el =
        range.startContainer instanceof HTMLElement
          ? range.startContainer
          : range.startContainer.parentElement;
      if (el) rect = el.getBoundingClientRect();
    }
    // Flip above cursor if not enough space below
    const menuHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < menuHeight + 16) {
      setPos({ top: rect.top - menuHeight - 8, left: Math.max(16, rect.left) });
    } else {
      setPos({ top: rect.bottom + 8, left: Math.max(16, rect.left) });
    }
  }

  /* Listen for selection changes to detect empty lines */
  useEditorSelectionChange(() => {
    // If text is selected, the FormattingToolbarController handles it
    const sel = editor.getSelection();
    if (sel) {
      setShow(false);
      setIsSlashMode(false);
      setSlashFilter("");
      return;
    }

    // Check for slash command first
    const sq = getSlashQuery();
    if (sq !== null) {
      setIsSlashMode(true);
      setSlashFilter(sq);
      updatePos();
      setShow(true);
      return;
    }

    // Check for empty paragraph
    if (isBlockEmpty()) {
      setIsSlashMode(false);
      setSlashFilter("");
      updatePos();
      setShow(true);
      return;
    }

    // Otherwise, hide
    setShow(false);
    setIsSlashMode(false);
    setSlashFilter("");
  });

  /** When a menu action fires, clean up slash text if needed */
  function handleAction() {
    if (isSlashMode) {
      // Remove the "/..." text from the current block
      try {
        const block = editor.getTextCursorPosition().block;
        editor.updateBlock(block, { content: [] });
      } catch {}
    }
    setShow(false);
    setIsSlashMode(false);
    setSlashFilter("");
  }

  /** Close on Escape */
  useEffect(() => {
    if (!show) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShow(false);
        setIsSlashMode(false);
        setSlashFilter("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [show]);

  /** Close on click outside */
  useEffect(() => {
    if (!show) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShow(false);
        setIsSlashMode(false);
        setSlashFilter("");
      }
    }
    // Use timeout to avoid catching the triggering event
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className="uem__floating"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
    >
      <UnifiedMenuContent
        hasTextSelection={false}
        context={context}
        onAction={handleAction}
        filter={slashFilter}
      />
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
  context?: EditorContext;  // controls which special blocks appear in ⋯
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
        {/* Selection menu — unified contextual menu on text selection */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <UnifiedMenuContent
              hasTextSelection={true}
              context={context}
            />
          )}
        />
        {/* Command menu — same unified menu on empty lines and "/" */}
        <CommandMenu context={context} />
      </BlockNoteView>
    </div>
  );
}
