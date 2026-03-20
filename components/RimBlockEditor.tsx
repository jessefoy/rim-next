"use client";

/**
 * RimBlockEditor — Unified contextual editor menu.
 *
 * One horizontal pill toolbar for all editor interactions:
 *   - Text selection → pill above selection: [B] [I] [U] [🔗] | [H▾] [≡▾] [+▾]
 *   - Empty paragraph → same pill below cursor: [H▾] [≡▾] [+▾]
 *   - No side menu, no slash commands, no bottom bar
 *   - Context prop controls which blocks appear in the + dropdown
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useState, useRef, useMemo } from "react";
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

/* ── Dropdown helper ───────────────────────────────────────────────────── */

function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return { open, setOpen, ref };
}

/* ── Unified pill toolbar (the "one menu") ─────────────────────────────
   Horizontal bar: [B] [I] [U] [🔗] | [H▾] [≡▾] [+▾]
   Rendered by FormattingToolbarController (selection) and CommandMenu (empty line).
   Same component, same look, different trigger.
   ──────────────────────────────────────────────────────────────────────── */

function UnifiedToolbar({
  hasTextSelection,
  context,
  onAction,
}: {
  hasTextSelection: boolean;
  context: EditorContext;
  onAction?: () => void;
}) {
  const editor = useBlockNoteEditor();
  const [activeBlock, setActiveBlock] = useState("");
  const [activeStyles, setActiveStyles] = useState<Record<string, any>>({});

  useEditorSelectionChange(() => {
    try { setActiveBlock(editor.getTextCursorPosition().block?.type ?? ""); } catch { setActiveBlock(""); }
    try { setActiveStyles(editor.getActiveStyles()); } catch { setActiveStyles({}); }
  });

  const hDrop = useDropdown();
  const listDrop = useDropdown();
  const insertDrop = useDropdown();

  /* ── Actions ── */

  function toggleStyle(style: string) {
    editor.focus();
    editor.toggleStyles({ [style]: true } as any);
  }

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any, props });
    hDrop.setOpen(false);
    listDrop.setOpen(false);
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
    insertDrop.setOpen(false);
    onAction?.();
  }

  function insertLink() {
    editor.focus();
    const url = window.prompt("Link URL:");
    if (url) editor.createLink(url);
  }

  /* Close other dropdowns when one opens */
  function openOnly(target: "h" | "list" | "insert") {
    hDrop.setOpen(target === "h" ? !hDrop.open : false);
    listDrop.setOpen(target === "list" ? !listDrop.open : false);
    insertDrop.setOpen(target === "insert" ? !insertDrop.open : false);
  }

  /* ── Context insert items ── */

  const insertItems = useMemo(() => {
    const items: { id: string; label: string; icon?: React.ReactNode; type: string }[] = [];
    if (context === "lesson") {
      items.push(
        { id: "verse", label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { id: "practice", label: "Practice", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { id: "callout", label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    items.push({ id: "table", label: "Table", type: "table" });
    return items;
  }, [context]);

  return (
    <div className="uem-bar" onMouseDown={(e) => e.preventDefault()}>
      {/* ── Inline formatting (only with text selection) ── */}
      {hasTextSelection && (
        <>
          <button
            className={`uem-bar__btn${activeStyles.bold ? " uem-bar__btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("bold"); }}
            title="Bold"
          ><strong>B</strong></button>
          <button
            className={`uem-bar__btn${activeStyles.italic ? " uem-bar__btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("italic"); }}
            title="Italic"
          ><em>I</em></button>
          <button
            className={`uem-bar__btn${activeStyles.underline ? " uem-bar__btn--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); toggleStyle("underline"); }}
            title="Underline"
          ><u>U</u></button>
          <button
            className="uem-bar__btn"
            onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
            title="Link"
          >🔗</button>
          <div className="uem-bar__sep" />
        </>
      )}

      {/* ── Heading dropdown ── */}
      <div className="uem-bar__group" ref={hDrop.ref}>
        <button
          className={`uem-bar__btn${activeBlock === "heading" ? " uem-bar__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); openOnly("h"); }}
          title="Headings"
        >H</button>
        {hDrop.open && (
          <div className="uem-bar__dropdown" onPointerDown={(e) => e.stopPropagation()}>
            <button className={`uem-bar__dd-item${activeBlock === "heading" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 2 }); }}>Heading 2</button>
            <button className={`uem-bar__dd-item${activeBlock === "heading" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 3 }); }}>Heading 3</button>
            <button className={`uem-bar__dd-item${activeBlock === "paragraph" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("paragraph"); }}>Paragraph</button>
          </div>
        )}
      </div>

      {/* ── List / quote dropdown ── */}
      <div className="uem-bar__group" ref={listDrop.ref}>
        <button
          className={`uem-bar__btn${["bulletListItem", "numberedListItem", "quote"].includes(activeBlock) ? " uem-bar__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); openOnly("list"); }}
          title="Lists & Quotes"
        >≡</button>
        {listDrop.open && (
          <div className="uem-bar__dropdown" onPointerDown={(e) => e.stopPropagation()}>
            <button className={`uem-bar__dd-item${activeBlock === "bulletListItem" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("bulletListItem"); }}>Bullet List</button>
            <button className={`uem-bar__dd-item${activeBlock === "numberedListItem" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("numberedListItem"); }}>Numbered List</button>
            <button className={`uem-bar__dd-item${activeBlock === "quote" ? " uem-bar__dd-item--active" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); setBlockType("quote"); }}>Quote</button>
          </div>
        )}
      </div>

      {/* ── Insert dropdown (context-specific) ── */}
      <div className="uem-bar__group" ref={insertDrop.ref}>
        <button
          className="uem-bar__btn"
          onMouseDown={(e) => { e.preventDefault(); openOnly("insert"); }}
          title="Insert Block"
        >+</button>
        {insertDrop.open && (
          <div className="uem-bar__dropdown" onPointerDown={(e) => e.stopPropagation()}>
            {insertItems.map((item) => (
              <button
                key={item.id}
                className="uem-bar__dd-item"
                onMouseDown={(e) => { e.preventDefault(); insertBlockAfter(item.type); }}
              >
                {item.icon && <span className="uem-bar__dd-icon">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Command menu — shows toolbar on empty paragraphs ──────────────────
   Detects empty paragraph → positions the same UnifiedToolbar below cursor.
   Brief debounce prevents flash when pressing Enter and immediately typing.
   No slash detection, no content manipulation — clean trigger only.
   ──────────────────────────────────────────────────────────────────────── */

function CommandMenu({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function updatePos() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    let rect = range.getBoundingClientRect();
    if (rect.height === 0 && rect.width === 0) {
      const el =
        range.startContainer instanceof HTMLElement
          ? range.startContainer
          : range.startContainer.parentElement;
      if (el) rect = el.getBoundingClientRect();
    }
    setPos({ top: rect.bottom + 8, left: Math.max(16, rect.left) });
  }

  useEditorSelectionChange(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }

    const sel = editor.getSelection();
    if (sel) { setShow(false); return; }

    if (isBlockEmpty()) {
      updatePos();
      // 150ms debounce: if user types immediately after Enter, menu never flashes
      showTimer.current = setTimeout(() => setShow(true), 150);
    } else {
      setShow(false);
    }
  });

  useEffect(() => {
    return () => { if (showTimer.current) clearTimeout(showTimer.current); };
  }, []);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShow(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onPtr = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShow(false);
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", onPtr), 0);
    return () => { clearTimeout(t); document.removeEventListener("pointerdown", onPtr); };
  }, [show]);

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className="uem-bar__floating"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
    >
      <UnifiedToolbar
        hasTextSelection={false}
        context={context}
        onAction={() => setShow(false)}
      />
    </div>
  );
}

/* ── Main editor ────────────────────────────────────────────────────────── */

interface Props {
  value: any;
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
  legacyHtml?: string;
  context?: EditorContext;
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
        {/* Selection: pill toolbar above selected text */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <UnifiedToolbar hasTextSelection={true} context={context} />
          )}
        />
        {/* Empty line: same pill toolbar below cursor */}
        <CommandMenu context={context} />
      </BlockNoteView>
    </div>
  );
}
