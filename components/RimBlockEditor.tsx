"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Design:
 *   - No side menu (no hovering drag handle / + button)
 *   - Clean floating pill toolbar on text selection: B, I, U, Link, ⋯
 *   - ⋯ menu: headings, lists, quote, paragraph + context-specific blocks
 *   - Empty paragraph: compact floating menu with same block options
 *   - Inter font for clean document editing
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useMemo, useState, useRef } from "react";
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

/* ── Bear-style ⋯ More menu (inside the pill toolbar) ──────────────────── */

function MoreMenuButton({ context = "default" as EditorContext }) {
  const editor = useBlockNoteEditor();
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

  const [activeBlock, setActiveBlock] = useState<string>("");
  useEditorSelectionChange(() => {
    const block = editor.getTextCursorPosition().block;
    setActiveBlock(block?.type ?? "");
  });

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, {
      type: type as any,
      props,
    });
    setOpen(false);
  }

  function insertBlockAfter(type: string) {
    const block = editor.getTextCursorPosition().block;
    editor.insertBlocks([{ type: type as any }], block, "after");
    setTimeout(() => {
      try {
        const next = editor.getTextCursorPosition().nextBlock;
        if (next) editor.setTextCursorPosition(next, "start");
      } catch {}
      editor.focus();
    }, 50);
    setOpen(false);
  }

  const blockItems = [
    { label: "Heading 2", type: "heading", props: { level: 2 }, match: activeBlock === "heading" },
    { label: "Heading 3", type: "heading", props: { level: 3 }, match: activeBlock === "heading" },
    { label: "Bullet list", type: "bulletListItem", match: activeBlock === "bulletListItem" },
    { label: "Numbered list", type: "numberedListItem", match: activeBlock === "numberedListItem" },
    { label: "Quote", type: "quote", match: activeBlock === "quote" },
    { label: "Paragraph", type: "paragraph", match: activeBlock === "paragraph" },
  ];

  const insertItems = useMemo(() => {
    const items: { label: string; icon?: React.ReactNode; type: string }[] = [];
    if (context === "lesson") {
      items.push(
        { label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { label: "Practice Suggestion", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    items.push({ label: "Table", type: "table" });
    return items;
  }, [context]);

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        type="button"
        className={`bear-more-btn${open ? " bear-more-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        aria-label="More formatting"
        title="More formatting"
      >
        ⋯
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          {blockItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`bear-more-item${item.match ? " bear-more-item--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setBlockType(item.type, item.props);
              }}
            >
              {item.label}
            </button>
          ))}
          {insertItems.length > 0 && (
            <>
              <div className="bear-more-divider" />
              {insertItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="bear-more-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertBlockAfter(item.type);
                  }}
                >
                  {item.icon && <span className="bear-more-icon">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Empty-line floating menu ──────────────────────────────────────────
   When cursor lands in an empty paragraph, a compact menu appears
   with block-type and insert options (same items as the ⋯ dropdown).
   150ms debounce prevents flash when typing through Enter.
   ──────────────────────────────────────────────────────────────────────── */

function EmptyLineMenu({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeBlock, setActiveBlock] = useState<string>("");

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

    try {
      setActiveBlock(editor.getTextCursorPosition().block?.type ?? "");
    } catch {}

    if (isBlockEmpty()) {
      updatePos();
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

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, {
      type: type as any,
      props,
    });
    setShow(false);
  }

  function insertBlockAfter(type: string) {
    const block = editor.getTextCursorPosition().block;
    editor.insertBlocks([{ type: type as any }], block, "after");
    setTimeout(() => {
      try {
        const next = editor.getTextCursorPosition().nextBlock;
        if (next) editor.setTextCursorPosition(next, "start");
      } catch {}
      editor.focus();
    }, 50);
    setShow(false);
  }

  const blockItems = [
    { label: "Heading 2", type: "heading", props: { level: 2 }, match: activeBlock === "heading" },
    { label: "Heading 3", type: "heading", props: { level: 3 }, match: activeBlock === "heading" },
    { label: "Bullet list", type: "bulletListItem", match: activeBlock === "bulletListItem" },
    { label: "Numbered list", type: "numberedListItem", match: activeBlock === "numberedListItem" },
    { label: "Quote", type: "quote", match: activeBlock === "quote" },
    { label: "Paragraph", type: "paragraph", match: activeBlock === "paragraph" },
  ];

  const insertItems = useMemo(() => {
    const items: { label: string; icon?: React.ReactNode; type: string }[] = [];
    if (context === "lesson") {
      items.push(
        { label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { label: "Practice Suggestion", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    items.push({ label: "Table", type: "table" });
    return items;
  }, [context]);

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className="bear-float"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bear-more-dropdown bear-more-dropdown--floating">
        {blockItems.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`bear-more-item${item.match ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setBlockType(item.type, item.props);
            }}
          >
            {item.label}
          </button>
        ))}
        {insertItems.length > 0 && (
          <>
            <div className="bear-more-divider" />
            {insertItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="bear-more-item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertBlockAfter(item.type);
                }}
              >
                {item.icon && <span className="bear-more-icon">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </>
        )}
      </div>
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
  context?: EditorContext;  // controls which blocks appear in ⋯ menu
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
        {/* Bear-style pill toolbar: B / I / U / Link / ⋯ */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BasicTextStyleButton key="bold" basicTextStyle="bold" />
              <BasicTextStyleButton key="italic" basicTextStyle="italic" />
              <BasicTextStyleButton key="underline" basicTextStyle="underline" />
              <CreateLinkButton key="link" />
              <MoreMenuButton key="more" context={context} />
            </FormattingToolbar>
          )}
        />
        {/* Empty-line menu: same block options, appears on new paragraphs */}
        <EmptyLineMenu context={context} />
      </BlockNoteView>
    </div>
  );
}
