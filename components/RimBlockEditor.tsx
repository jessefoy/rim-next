"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Toolbar layout (matches Bear):
 *   [H▾] [≡▾] | [B] [I] [U] [🔗] [≡] | [⊞] [📷] [⋯]
 *
 * Appears on text selection (above) AND on empty paragraphs (below/above).
 * Pill flips above cursor when near viewport bottom.
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
  TextAlignButton,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type EditorContext = "lesson" | "document" | "default";

/* ── SVG Icons ────────────────────────────────────────────────────────────── */

function LinkIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function TableIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function ImageIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function ListIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function CaretIcon() {
  return (
    <svg width={8} height={8} viewBox="0 0 8 8" fill="currentColor" style={{ marginLeft: 1, opacity: 0.5 }}>
      <path d="M1 2.5 L4 5.5 L7 2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Image upload helper (lazy import to avoid module-level side effects) ── */

async function uploadFile(file: File): Promise<string> {
  const { upload } = await import("@vercel/blob/client");
  const blob = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return blob.url;
}

/* ── Shared close-on-click-outside hook ────────────────────────────────── */

function useClickOutside(ref: React.RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, ref, onClose]);
}

/* ── Safe insert block helper ──────────────────────────────────────────── */

function useInsertBlock() {
  const editor = useBlockNoteEditor();
  return useCallback((type: string, props?: Record<string, any>) => {
    try {
      const block = editor.getTextCursorPosition().block;
      const spec: Record<string, any> = { type: type as any };
      if (props) spec.props = props;
      editor.insertBlocks([spec as any], block, "after");
      setTimeout(() => {
        try {
          const next = editor.getTextCursorPosition().nextBlock;
          if (next) editor.setTextCursorPosition(next, "start");
        } catch {}
        editor.focus();
      }, 50);
    } catch (err) {
      console.error("RimBlockEditor: insertBlock failed", err);
    }
  }, [editor]);
}

/* ── Heading dropdown (H▾) ─────────────────────────────────────────────── */

function HeadingDropdown() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const [activeBlock, setActiveBlock] = useState<string>("");
  const [activeLevel, setActiveLevel] = useState<number>(0);
  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      setActiveBlock(block?.type ?? "");
      setActiveLevel((block?.props as any)?.level ?? 0);
    } catch {}
  });

  function setBlockType(type: string, props?: Record<string, any>) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any, props });
    } catch {}
    setOpen(false);
  }

  const isHeading = activeBlock === "heading";

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        type="button"
        className={`bear-dd-btn${isHeading ? " bear-dd-btn--active" : ""}${open ? " bear-dd-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Heading"
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>H</span>
        <CaretIcon />
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`bear-more-item${isHeading && activeLevel === 2 ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 2 }); }}>
            Heading 2
          </button>
          <button type="button" className={`bear-more-item${isHeading && activeLevel === 3 ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 3 }); }}>
            Heading 3
          </button>
          <div className="bear-more-divider" />
          <button type="button" className={`bear-more-item${activeBlock === "paragraph" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("paragraph"); }}>
            Paragraph
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Block type dropdown (≡▾) — lists, quote ───────────────────────────── */

function BlockTypeDropdown() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const [activeBlock, setActiveBlock] = useState<string>("");
  useEditorSelectionChange(() => {
    try {
      setActiveBlock(editor.getTextCursorPosition().block?.type ?? "");
    } catch {}
  });

  function setBlockType(type: string) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any });
    } catch {}
    setOpen(false);
  }

  const isListOrQuote = ["bulletListItem", "numberedListItem", "quote"].includes(activeBlock);

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        type="button"
        className={`bear-dd-btn${isListOrQuote ? " bear-dd-btn--active" : ""}${open ? " bear-dd-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Lists & quotes"
      >
        <ListIcon size={14} />
        <CaretIcon />
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`bear-more-item${activeBlock === "bulletListItem" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("bulletListItem"); }}>
            Bullet List
          </button>
          <button type="button" className={`bear-more-item${activeBlock === "numberedListItem" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("numberedListItem"); }}>
            Numbered List
          </button>
          <div className="bear-more-divider" />
          <button type="button" className={`bear-more-item${activeBlock === "quote" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("quote"); }}>
            Block Quote
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Table insert button ──────────────────────────────────────────────── */

function TableInsertButton() {
  const insertBlock = useInsertBlock();
  return (
    <div className="bear-more-wrap">
      <button
        type="button"
        className="bear-dd-btn"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          insertBlock("table");
        }}
        title="Insert table"
      >
        <TableIcon size={14} />
      </button>
    </div>
  );
}

/* ── Image insert button ──────────────────────────────────────────────── */

function ImageInsertButton() {
  const insertBlock = useInsertBlock();
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="bear-more-wrap">
      <button
        type="button"
        className="bear-dd-btn"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          fileRef.current?.click();
        }}
        title="Insert image"
      >
        <ImageIcon size={14} />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            insertBlock("image", { url, name: file.name });
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Context menu (⋯) — page-specific insert blocks only ──────────────── */

function ContextMenuButton({ context = "default" as EditorContext }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const insertBlock = useInsertBlock();

  const insertItems = useMemo(() => {
    const items: { label: string; icon?: React.ReactNode; type: string }[] = [];
    if (context === "lesson") {
      items.push(
        { label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { label: "Practice Suggestion", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    return items;
  }, [context]);

  if (insertItems.length === 0) return null;

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        type="button"
        className={`bear-dd-btn${open ? " bear-dd-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        aria-label="Special blocks"
        title="Special blocks"
      >
        ⋯
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          {insertItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="bear-more-item"
              onMouseDown={(e) => {
                e.preventDefault();
                insertBlock(item.type);
                setOpen(false);
              }}
            >
              {item.icon && <span className="bear-more-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Standalone dropdown components for EmptyLinePill ───────────────────
   Same logic as above but using custom pill button styling.
   ──────────────────────────────────────────────────────────────────────── */

function PillHeadingDropdown() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const [activeBlock, setActiveBlock] = useState<string>("");
  const [activeLevel, setActiveLevel] = useState<number>(0);
  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      setActiveBlock(block?.type ?? "");
      setActiveLevel((block?.props as any)?.level ?? 0);
    } catch {}
  });

  function setBlockType(type: string, props?: Record<string, any>) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any, props });
    } catch {}
    setOpen(false);
  }

  const isHeading = activeBlock === "heading";

  return (
    <div className="bear-more-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        className={`bear-pill__btn bear-pill__btn--dd${isHeading ? " bear-pill__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Heading"
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>H</span>
        <CaretIcon />
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`bear-more-item${isHeading && activeLevel === 2 ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 2 }); }}>
            Heading 2
          </button>
          <button type="button" className={`bear-more-item${isHeading && activeLevel === 3 ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 3 }); }}>
            Heading 3
          </button>
          <div className="bear-more-divider" />
          <button type="button" className={`bear-more-item${activeBlock === "paragraph" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("paragraph"); }}>
            Paragraph
          </button>
        </div>
      )}
    </div>
  );
}

function PillBlockTypeDropdown() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const [activeBlock, setActiveBlock] = useState<string>("");
  useEditorSelectionChange(() => {
    try {
      setActiveBlock(editor.getTextCursorPosition().block?.type ?? "");
    } catch {}
  });

  function setBlockType(type: string) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any });
    } catch {}
    setOpen(false);
  }

  const isListOrQuote = ["bulletListItem", "numberedListItem", "quote"].includes(activeBlock);

  return (
    <div className="bear-more-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        className={`bear-pill__btn bear-pill__btn--dd${isListOrQuote ? " bear-pill__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Lists & quotes"
      >
        <ListIcon size={14} />
        <CaretIcon />
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`bear-more-item${activeBlock === "bulletListItem" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("bulletListItem"); }}>
            Bullet List
          </button>
          <button type="button" className={`bear-more-item${activeBlock === "numberedListItem" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("numberedListItem"); }}>
            Numbered List
          </button>
          <div className="bear-more-divider" />
          <button type="button" className={`bear-more-item${activeBlock === "quote" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("quote"); }}>
            Block Quote
          </button>
        </div>
      )}
    </div>
  );
}

function PillContextMenu({ context, onAction }: { context: EditorContext; onAction?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  const insertBlock = useInsertBlock();

  const insertItems = useMemo(() => {
    const items: { label: string; icon?: React.ReactNode; type: string }[] = [];
    if (context === "lesson") {
      items.push(
        { label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { label: "Practice Suggestion", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    return items;
  }, [context]);

  if (insertItems.length === 0) return null;

  return (
    <div className="bear-more-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        className={`bear-pill__btn${open ? " bear-pill__btn--active" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Special blocks"
      >
        ⋯
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          {insertItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="bear-more-item"
              onMouseDown={(e) => {
                e.preventDefault();
                insertBlock(item.type);
                setOpen(false);
                onAction?.();
              }}
            >
              {item.icon && <span className="bear-more-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Empty-line pill ───────────────────────────────────────────────────
   Flips above cursor when near viewport bottom.
   150ms debounce prevents flash when typing through Enter.
   ──────────────────────────────────────────────────────────────────────── */

const PILL_HEIGHT = 48;

function EmptyLinePill({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [flipped, setFlipped] = useState(false);
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
    try {
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

      const viewportH = window.innerHeight;
      const spaceBelow = viewportH - rect.bottom;
      const shouldFlip = spaceBelow < PILL_HEIGHT + 24;

      setFlipped(shouldFlip);
      if (shouldFlip) {
        setPos({ top: rect.top - PILL_HEIGHT - 8, left: Math.max(16, rect.left - 80) });
      } else {
        setPos({ top: rect.bottom + 8, left: Math.max(16, rect.left - 80) });
      }
    } catch {}
  }

  useEditorSelectionChange(() => {
    try {
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
    } catch {
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

  function toggleStyle(style: string) {
    try {
      editor.focus();
      editor.toggleStyles({ [style]: true } as any);
    } catch {}
  }

  function insertLink() {
    editor.focus();
    const url = window.prompt("Link URL:");
    if (url) {
      try { editor.createLink(url); } catch {}
    }
  }

  const insertBlock = useInsertBlock();

  if (!show) return null;

  return (
    <div
      ref={menuRef}
      className={`bear-float${flipped ? " bear-float--above" : ""}`}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bear-pill">
        <PillHeadingDropdown />
        <PillBlockTypeDropdown />

        <span className="bear-pill__sep" />

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
        ><LinkIcon size={14} /></button>

        <span className="bear-pill__sep" />

        <button
          className="bear-pill__btn"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            insertBlock("table");
            setShow(false);
          }}
          title="Insert table"
        ><TableIcon size={14} /></button>

        <PillContextMenu context={context} onAction={() => setShow(false)} />
      </div>
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
      uploadFile,
      dictionary: {
        placeholders: {
          default: "Type something…",
          heading: "Heading",
          bulletListItem: "List",
          numberedListItem: "List",
          checkListItem: "List",
        },
      } as any,
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
        {/* Selection pill */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <HeadingDropdown key="heading" />
              <BlockTypeDropdown key="blockType" />
              <BasicTextStyleButton key="bold" basicTextStyle="bold" />
              <BasicTextStyleButton key="italic" basicTextStyle="italic" />
              <BasicTextStyleButton key="underline" basicTextStyle="underline" />
              <CreateLinkButton key="link" />
              <TextAlignButton key="alignLeft" textAlignment="left" />
              <TextAlignButton key="alignCenter" textAlignment="center" />
              <TextAlignButton key="alignRight" textAlignment="right" />
              <TableInsertButton key="table" />
              <ImageInsertButton key="image" />
              <ContextMenuButton key="context" context={context} />
            </FormattingToolbar>
          )}
        />
        {/* Empty line pill */}
        <EmptyLinePill context={context} />
      </BlockNoteView>
    </div>
  );
}
