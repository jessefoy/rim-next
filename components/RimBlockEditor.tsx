"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Design:
 *   - No side menu (no hovering drag handle / + button)
 *   - Clean floating pill toolbar: B, I, U, Link, ⋯
 *   - Appears on text selection (above) AND on empty paragraphs (below)
 *   - ⋯ holds block types + context-specific insert blocks
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

/* ── Bear-style ⋯ More menu (lives inside the pill toolbar) ───────────── */

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

/* ── Standalone ⋯ button for the empty-line pill ──────────────────────
   Same as MoreMenuButton but works outside FormattingToolbarController.
   Uses editor API directly instead of BlockNote's toolbar button context.
   ──────────────────────────────────────────────────────────────────────── */

function StandaloneMoreButton({ context, onAction }: { context: EditorContext; onAction?: () => void }) {
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
    try { setActiveBlock(editor.getTextCursorPosition().block?.type ?? ""); } catch {}
  });

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any, props });
    setOpen(false);
    onAction?.();
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
    onAction?.();
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
    <div className="bear-more-wrap" ref={ref} style={{ position: "relative" }}>
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
              onMouseDown={(e) => { e.preventDefault(); setBlockType(item.type, item.props); }}
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
                  onMouseDown={(e) => { e.preventDefault(); insertBlockAfter(item.type); }}
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

/* ── Empty-line pill ───────────────────────────────────────────────────
   When cursor lands in an empty paragraph, the SAME pill toolbar appears
   below the cursor. B/I/U/Link + ⋯ — identical to the selection pill.
   150ms debounce prevents flash when typing through Enter.
   ──────────────────────────────────────────────────────────────────────── */

function EmptyLinePill({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [activeStyles, setActiveStyles] = useState<Record<string, any>>({});
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
    // Center the pill below the cursor line
    setPos({ top: rect.bottom + 8, left: Math.max(16, rect.left - 40) });
  }

  useEditorSelectionChange(() => {
    if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }

    const sel = editor.getSelection();
    if (sel) { setShow(false); return; }

    try { setActiveStyles(editor.getActiveStyles()); } catch { setActiveStyles({}); }

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

  /* ── Inline style toggles (same as the pill toolbar buttons) ── */
  function toggleStyle(style: string) {
    editor.focus();
    editor.toggleStyles({ [style]: true } as any);
  }

  function insertLink() {
    editor.focus();
    const url = window.prompt("Link URL:");
    if (url) editor.createLink(url);
  }

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className="bear-float"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* The pill — same shape and style as the selection toolbar */}
      <div className="bear-pill">
        <button
          className={`bear-pill__btn${activeStyles.bold ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("bold"); }}
          title="Bold"
        ><strong>B</strong></button>
        <button
          className={`bear-pill__btn${activeStyles.italic ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("italic"); }}
          title="Italic"
        ><em>I</em></button>
        <button
          className={`bear-pill__btn${activeStyles.underline ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("underline"); }}
          title="Underline"
        ><u>U</u></button>
        <button
          className="bear-pill__btn"
          onMouseDown={(e) => { e.preventDefault(); insertLink(); }}
          title="Link"
        >🔗</button>
        <StandaloneMoreButton context={context} onAction={() => setShow(false)} />
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
      dictionary: {
        placeholders: {
          default: "Enter text or press Space for menu",
          heading: "Heading",
          bulletListItem: "List",
          numberedListItem: "List",
          checkListItem: "List",
        },
      } as any,
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
        {/* Selection: the original Bear pill — B / I / U / Link / ⋯ */}
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
        {/* Empty line: the same pill, floating below cursor */}
        <EmptyLinePill context={context} />
      </BlockNoteView>
    </div>
  );
}
