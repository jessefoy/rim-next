"use client";

/**
 * RimBlockEditor — Bear-inspired block editor for long-form content.
 *
 * Two toolbar contexts:
 *
 * Selection toolbar (appears above selected text):
 *   Uses ONLY native BlockNote components to avoid rendering conflicts.
 *   [B] [I] [U] [Link] [Align L/C/R] [⋯ block types + inserts]
 *
 * Empty-line pill (floats below/above cursor on empty paragraphs):
 *   Full Bear layout with custom dropdowns:
 *   [H▾] [≡▾] | [B] [I] [U] [🔗] | [⊞] [📷] [⋯]
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
  TextAlignButton,
  useBlockNoteEditor,
  useEditorSelectionChange,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import { upload } from "@vercel/blob/client";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Types ─────────────────────────────────────────────────────────────────── */

/**
 * Editor context — the registry entry this mount represents.
 * Drives which custom blocks are offered (lesson gets dharma blocks; others
 * do not). See RIM_Editor_Design.md for the full tier / context mapping.
 *
 * - "lesson"              — Feature tier (contemplative). Enables VerseQuote,
 *                           PracticeSuggestion, dharma Callout.
 * - "document"            — Document tier, generic working doc (hub documents,
 *                           hub welcome, hub home).
 * - "manual"              — Document tier, staff manual sections.
 * - "program-description" — Document tier, program detail body.
 * - "default"             — Fallback; behaves like "document".
 */
export type EditorContext =
  | "lesson"
  | "document"
  | "manual"
  | "program-description"
  | "default";

/* ── Tier slash menu allowlists ─────────────────────────────────────────────
 * Filter BlockNote's default slash items by English title (stable within a
 * major version; RIM is English-only). Dharma custom blocks are reached via
 * the empty-line pill today; Phase 5 will unify chrome and add them here too.
 */
const DOCUMENT_TIER_SLASH_TITLES = new Set<string>([
  "Paragraph",
  "Heading 2",
  "Heading 3",
  "Bullet List",
  "Numbered List",
  "Check List",
  "Quote",
  "Code Block",
  "Table",
  "Image",
]);

const FEATURE_TIER_SLASH_TITLES = new Set<string>([
  "Paragraph",
  "Heading 2",
  "Heading 3",
  "Bullet List",
  "Numbered List",
  "Check List",
  "Quote",
  "Code Block",
  "Table",
  "Image",
]);

function slashTitlesFor(context: EditorContext): Set<string> {
  if (context === "lesson") return FEATURE_TIER_SLASH_TITLES;
  return DOCUMENT_TIER_SLASH_TITLES;
}

/* ── Portal dropdown — renders at document.body to escape overflow:hidden ── */

function PortalDropdown({
  anchorRef,
  children,
  onPointerDown,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
  }, [anchorRef]);

  if (!pos) return null;

  return createPortal(
    <div
      className="bear-more-dropdown bear-more-dropdown--portal"
      style={{ position: "fixed", top: pos.top, left: pos.left }}
      onPointerDown={onPointerDown}
    >
      {children}
    </div>,
    document.body,
  );
}

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

/* ── Image upload ─────────────────────────────────────────────────────── */

async function uploadFile(file: File): Promise<string> {
  // Add timestamp to filename to avoid any browser/CDN caching issues
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const base = file.name.includes(".") ? file.name.slice(0, file.name.lastIndexOf(".")) : file.name;
  const uniqueName = `${base}-${Date.now()}${ext}`;
  const blob = await upload(uniqueName, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
  });
  return blob.url;
}

/* ── Shared helpers ────────────────────────────────────────────────────── */

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

/* ── Selection toolbar ⋯ menu ──────────────────────────────────────────
   This is the PROVEN pattern (worked before the refactor). A single ⋯
   button inside FormattingToolbar that opens a dropdown with block
   types and insert options. Only native hooks + DOM — no custom
   component trees inside FormattingToolbar.
   ──────────────────────────────────────────────────────────────────────── */

function ToolbarMoreMenu({ context = "default" as EditorContext }) {
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

  function insertBlockAfter(type: string, props?: Record<string, any>) {
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
      console.error("insertBlockAfter failed:", err);
    }
    setOpen(false);
  }

  function insertTable() {
    try {
      const block = editor.getTextCursorPosition().block;
      const emptyCell = [{ type: "text" as const, text: "", styles: {} }];
      const makeRow = (n: number) => ({
        cells: Array.from({ length: n }, () => ({
          type: "tableCell" as const,
          content: emptyCell,
          props: { colspan: 1, rowspan: 1 },
        })),
      });
      const tableBlock = {
        type: "table" as any,
        content: {
          type: "tableContent" as const,
          columnWidths: [undefined, undefined, undefined],
          rows: [makeRow(3), makeRow(3), makeRow(3)],
        },
      };
      editor.insertBlocks([tableBlock as any], block, "after");
      setTimeout(() => editor.focus(), 50);
    } catch (err) {
      console.error("insertTable failed:", err);
    }
    setOpen(false);
  }

  const blockItems = [
    { label: "Heading 1", type: "heading", props: { level: 1 }, match: activeBlock === "heading" && activeLevel === 1 },
    { label: "Heading 2", type: "heading", props: { level: 2 }, match: activeBlock === "heading" && activeLevel === 2 },
    { label: "Heading 3", type: "heading", props: { level: 3 }, match: activeBlock === "heading" && activeLevel === 3 },
    { label: "Bullet list", type: "bulletListItem", match: activeBlock === "bulletListItem" },
    { label: "Numbered list", type: "numberedListItem", match: activeBlock === "numberedListItem" },
    { label: "Quote", type: "quote", match: activeBlock === "quote" },
    { label: "Paragraph", type: "paragraph", match: activeBlock === "paragraph" },
  ];

  const insertItems = useMemo(() => {
    const items: { label: string; icon?: React.ReactNode; type: string }[] = [];
    items.push({ label: "Table", type: "table" });
    items.push({ label: "Image", type: "image" });
    if (context === "lesson") {
      items.push(
        { label: "Verse Quote", icon: <RiQuoteText size={15} />, type: "verseQuote" },
        { label: "Practice Suggestion", icon: <RiPlantLine size={15} />, type: "practiceSuggestion" },
        { label: "Callout", icon: <RiInformationLine size={15} />, type: "callout" },
      );
    }
    return items;
  }, [context]);

  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`bear-more-btn${open ? " bear-more-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        aria-label="More formatting"
        title="More formatting"
      >
        ⋯
      </button>
      {open && (
        <PortalDropdown anchorRef={btnRef} onPointerDown={(e) => e.stopPropagation()}>
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
          <div className="bear-more-divider" />
          {insertItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="bear-more-item"
              onMouseDown={(e) => {
                e.preventDefault();
                if (item.type === "table") insertTable();
                else insertBlockAfter(item.type);
              }}
            >
              {item.icon && <span className="bear-more-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </PortalDropdown>
      )}
    </div>
  );
}

/* ── Empty-line pill components ─────────────────────────────────────────
   Full Bear layout with custom dropdowns. These are plain HTML/React
   components — NOT inside FormattingToolbar — so they work fine.
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
        <span style={{ fontWeight: 700, fontSize: "var(--text-ui)" }}>H</span>
        <CaretIcon />
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={`bear-more-item${isHeading && activeLevel === 1 ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("heading", { level: 1 }); }}>
            Heading 1
          </button>
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
    try { setActiveBlock(editor.getTextCursorPosition().block?.type ?? ""); } catch {}
  });

  function setBlockType(type: string) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any });
    } catch {}
    setOpen(false);
  }

  const isListOrQuote = ["bulletListItem", "numberedListItem", "checkListItem", "quote"].includes(activeBlock);

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
          <button type="button" className={`bear-more-item${activeBlock === "checkListItem" ? " bear-more-item--active" : ""}`}
            onMouseDown={(e) => { e.preventDefault(); setBlockType("checkListItem"); }}>
            Checklist
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
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, open, close);

  function insertBlockAfter(type: string) {
    try {
      const block = editor.getTextCursorPosition().block;
      editor.insertBlocks([{ type: type as any }], block, "after");
      setTimeout(() => {
        try {
          const next = editor.getTextCursorPosition().nextBlock;
          if (next) editor.setTextCursorPosition(next, "start");
        } catch {}
        editor.focus();
      }, 50);
    } catch {}
    setOpen(false);
    onAction?.();
  }

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
            <button key={item.label} type="button" className="bear-more-item"
              onMouseDown={(e) => { e.preventDefault(); insertBlockAfter(item.type); }}>
              {item.icon && <span className="bear-more-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Empty-line pill ──────────────────────────────────────────────────── */

const PILL_HEIGHT = 48;

function EmptyLinePill({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [flipped, setFlipped] = useState(false);
  const [activeStyles, setActiveStyles] = useState<Record<string, any>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nonTextCooldown = useRef<number>(0);

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
        const el = range.startContainer instanceof HTMLElement
          ? range.startContainer
          : range.startContainer.parentElement;
        if (el) rect = el.getBoundingClientRect();
      }
      const viewportH = window.innerHeight;
      const shouldFlip = viewportH - rect.bottom < PILL_HEIGHT + 24;
      setFlipped(shouldFlip);
      setPos({
        top: shouldFlip ? rect.top - PILL_HEIGHT - 8 : rect.bottom + 8,
        left: Math.max(16, rect.left - 80),
      });
    } catch {}
  }

  useEditorSelectionChange(() => {
    try {
      if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
      const sel = editor.getSelection();
      if (sel) { setShow(false); return; }
      // Don't show pill on non-text blocks (image, table, etc.)
      const block = editor.getTextCursorPosition().block;
      const nonTextBlocks = ["image", "table", "video", "audio", "file"];
      if (block && nonTextBlocks.includes(block.type)) {
        setShow(false);
        // Set cooldown so pill won't immediately steal focus when cursor
        // moves from image/table to an adjacent empty line
        nonTextCooldown.current = Date.now();
        return;
      }
      // Skip if we just left a non-text block (800ms cooldown)
      if (Date.now() - nonTextCooldown.current < 800) { setShow(false); return; }
      try { setActiveStyles(editor.getActiveStyles()); } catch { setActiveStyles({}); }
      if (isBlockEmpty()) {
        updatePos();
        showTimer.current = setTimeout(() => setShow(true), 150);
      } else {
        setShow(false);
      }
    } catch { setShow(false); }
  });

  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current); }, []);

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
    try { editor.focus(); editor.toggleStyles({ [style]: true } as any); } catch {}
  }

  function insertBlockAfter(type: string) {
    try {
      const block = editor.getTextCursorPosition().block;
      editor.insertBlocks([{ type: type as any }], block, "after");
      setTimeout(() => {
        try {
          const next = editor.getTextCursorPosition().nextBlock;
          if (next) editor.setTextCursorPosition(next, "start");
        } catch {}
        editor.focus();
      }, 50);
    } catch (err) {
      console.error("insertBlockAfter failed:", err);
    }
    setShow(false);
  }

  function insertTable() {
    try {
      const block = editor.getTextCursorPosition().block;
      const emptyCell = [{ type: "text" as const, text: "", styles: {} }];
      const makeRow = (n: number) => ({
        cells: Array.from({ length: n }, () => ({
          type: "tableCell" as const,
          content: emptyCell,
          props: { colspan: 1, rowspan: 1 },
        })),
      });
      const tableBlock = {
        type: "table" as any,
        content: {
          type: "tableContent" as const,
          columnWidths: [undefined, undefined, undefined],
          rows: [makeRow(3), makeRow(3), makeRow(3)],
        },
      };
      editor.insertBlocks([tableBlock as any], block, "after");
      setTimeout(() => editor.focus(), 50);
    } catch (err) {
      console.error("insertTable failed:", err);
    }
    setShow(false);
  }

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

        <button className={`bear-pill__btn${activeStyles.bold ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("bold"); }} title="Bold">
          <strong>B</strong></button>
        <button className={`bear-pill__btn${activeStyles.italic ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("italic"); }} title="Italic">
          <em>I</em></button>
        <button className={`bear-pill__btn${activeStyles.underline ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); toggleStyle("underline"); }} title="Underline">
          <u>U</u></button>

        <span className="bear-pill__sep" />

        <button className="bear-pill__btn"
          onMouseDown={(e) => { e.preventDefault(); insertTable(); }} title="Insert table">
          <TableIcon size={14} /></button>
        <button className="bear-pill__btn"
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); fileRef.current?.click(); }}
          title="Insert image">
          <ImageIcon size={14} /></button>

        <PillContextMenu context={context} onAction={() => setShow(false)} />
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file && file.type.startsWith("image/")) {
            try {
              // Upload first, then insert with URL already set
              const url = await uploadFile(file);
              const block = editor.getTextCursorPosition().block;
              editor.insertBlocks(
                [{ type: "image" as any, props: { url, name: file.name } }],
                block,
                "after"
              );
              editor.focus();
            } catch (err) {
              console.error("Image upload failed:", err);
            }
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

/* ── Image alignment overlay ──────────────────────────────────────────────
   Injects L/C/R alignment buttons directly INTO the image block's DOM
   element so there's zero gap to cross. Shows on hover, stays while
   interacting. Uses a portal-free DOM injection approach.
   ──────────────────────────────────────────────────────────────────────── */

function ImageAlignOverlay() {
  const editor = useBlockNoteEditor();

  useEffect(() => {
    const editorEl = editor.domElement;
    if (!editorEl) return;

    let currentOverlay: HTMLElement | null = null;
    let currentBlockId: string | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    function clearHideTimer() {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }

    function removeOverlay() {
      if (currentOverlay) {
        currentOverlay.remove();
        currentOverlay = null;
        currentBlockId = null;
      }
    }

    function startHideTimer() {
      clearHideTimer();
      hideTimer = setTimeout(() => {
        removeOverlay();
      }, 300);
    }

    function findBlockData(blockId: string) {
      try {
        return editor.document.find((b: any) => b.id === blockId);
      } catch { return null; }
    }

    function showOverlay(imgBlockEl: Element) {
      const blockId = imgBlockEl.closest("[data-id]")?.getAttribute("data-id");
      if (!blockId) return;

      // Already showing for this block
      if (currentBlockId === blockId && currentOverlay) {
        clearHideTimer();
        return;
      }

      const block = findBlockData(blockId);
      if (!block || block.type !== "image" || !(block.props as any)?.url) return;

      removeOverlay();
      currentBlockId = blockId;

      const overlay = document.createElement("div");
      overlay.className = "img-align-overlay";
      const currentAlign = (block.props as any)?.textAlignment || "left";

      const aligns = [
        { key: "left", lines: "3,6,21,6 3,12,15,12 3,18,18,18" },
        { key: "center", lines: "3,6,21,6 6,12,18,12 4,18,20,18" },
        { key: "right", lines: "3,6,21,6 9,12,21,12 6,18,21,18" },
      ];

      aligns.forEach(({ key, lines }) => {
        const btn = document.createElement("button");
        btn.className = `img-align-btn${currentAlign === key ? " img-align-btn--active" : ""}`;
        btn.title = key === "center" ? "Center" : `Align ${key}`;
        const svgLines = lines.split(" ").map((l) => {
          const [x1, y1, x2, y2] = l.split(",");
          return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        }).join("");
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${svgLines}</svg>`;
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            editor.updateBlock(block, { props: { textAlignment: key } } as any);
            // Update active states
            overlay.querySelectorAll(".img-align-btn").forEach((b) => b.classList.remove("img-align-btn--active"));
            btn.classList.add("img-align-btn--active");
          } catch (err) {
            console.error("setAlign failed:", err);
          }
        });
        overlay.appendChild(btn);
      });

      overlay.addEventListener("mouseenter", clearHideTimer);
      overlay.addEventListener("mouseleave", startHideTimer);

      // Insert into the image block's visual wrapper so it sits ON the image
      const visualWrapper = imgBlockEl.querySelector(".bn-visual-media-wrapper")
        || imgBlockEl.querySelector(".bn-file-block-content-wrapper")
        || imgBlockEl;
      if (visualWrapper) {
        (visualWrapper as HTMLElement).style.position = "relative";
        overlay.style.position = "absolute";
        overlay.style.bottom = "8px";
        overlay.style.left = "50%";
        overlay.style.transform = "translateX(-50%)";
        overlay.style.zIndex = "200";
        visualWrapper.appendChild(overlay);
      }

      currentOverlay = overlay;
    }

    function onMouseOver(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const imgContent = target.closest("[data-content-type='image']");
      if (imgContent) {
        clearHideTimer();
        showOverlay(imgContent);
      }
    }

    function onMouseOut(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const related = e.relatedTarget as HTMLElement | null;
      // Stay visible if moving within the image or to the overlay
      if (related?.closest("[data-content-type='image']")) return;
      if (related?.closest(".img-align-overlay")) return;
      if (target.closest("[data-content-type='image']") || target.closest(".img-align-overlay")) {
        startHideTimer();
      }
    }

    editorEl.addEventListener("mouseover", onMouseOver);
    editorEl.addEventListener("mouseout", onMouseOut);

    return () => {
      editorEl.removeEventListener("mouseover", onMouseOver);
      editorEl.removeEventListener("mouseout", onMouseOut);
      clearHideTimer();
      removeOverlay();
    };
  }, [editor]);

  return null; // No React rendering — uses DOM injection
}

/* ── Table delete overlay ─────────────────────────────────────────────────
   Injects an × button at top-right of each table block for deletion.
   Uses DOM injection (same pattern as ImageAlignOverlay).
   ──────────────────────────────────────────────────────────────────────── */

function TableDeleteOverlay() {
  const editor = useBlockNoteEditor();

  useEffect(() => {
    const editorEl = editor.domElement;
    if (!editorEl) return;

    function injectDeleteBtn(tableBlock: Element) {
      if (tableBlock.querySelector(".table-delete-btn")) return;

      const blockId = tableBlock.closest("[data-id]")?.getAttribute("data-id");
      if (!blockId) return;

      // Ensure the content-type wrapper is positioned
      (tableBlock as HTMLElement).style.position = "relative";

      const btn = document.createElement("button");
      btn.className = "table-delete-btn";
      btn.type = "button";
      btn.title = "Delete table";
      btn.innerHTML = "×";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          const block = editor.document.find((b: any) => b.id === blockId);
          if (block) {
            editor.removeBlocks([block]);
          }
        } catch (err) {
          console.error("Table delete failed:", err);
        }
      });

      tableBlock.appendChild(btn);
    }

    // Observe DOM for table blocks (they may be inserted dynamically)
    const observer = new MutationObserver(() => {
      editorEl.querySelectorAll("[data-content-type='table']").forEach(injectDeleteBtn);
    });

    // Initial injection
    editorEl.querySelectorAll("[data-content-type='table']").forEach(injectDeleteBtn);

    observer.observe(editorEl, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [editor]);

  return null;
}

/* ── Toolbar block-type dropdown ──────────────────────────────────────────
   Shows current block type (¶, H2, H3, etc.) with dropdown to switch.
   ──────────────────────────────────────────────────────────────────────── */

function ToolbarBlockTypeSelect() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [activeBlock, setActiveBlock] = useState<string>("paragraph");
  const [activeLevel, setActiveLevel] = useState<number>(0);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      setActiveBlock(block?.type ?? "paragraph");
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

  // Label for the current block type
  const label = activeBlock === "heading" && activeLevel === 1 ? "H1"
    : activeBlock === "heading" && activeLevel === 2 ? "H2"
    : activeBlock === "heading" && activeLevel === 3 ? "H3"
    : activeBlock === "bulletListItem" ? "•"
    : activeBlock === "numberedListItem" ? "1."
    : activeBlock === "checkListItem" ? "☑"
    : activeBlock === "quote" ? "❝"
    : "¶";

  const items = [
    { label: "Paragraph", short: "¶", type: "paragraph", match: activeBlock === "paragraph" },
    { label: "Heading 1", short: "H1", type: "heading", props: { level: 1 }, match: activeBlock === "heading" && activeLevel === 1 },
    { label: "Heading 2", short: "H2", type: "heading", props: { level: 2 }, match: activeBlock === "heading" && activeLevel === 2 },
    { label: "Heading 3", short: "H3", type: "heading", props: { level: 3 }, match: activeBlock === "heading" && activeLevel === 3 },
    { label: "Bullet list", short: "•", type: "bulletListItem", match: activeBlock === "bulletListItem" },
    { label: "Numbered list", short: "1.", type: "numberedListItem", match: activeBlock === "numberedListItem" },
    { label: "Checklist", short: "☑", type: "checkListItem", match: activeBlock === "checkListItem" },
    { label: "Quote", short: "❝", type: "quote", match: activeBlock === "quote" },
  ];

  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        className={`bear-dd-btn${open ? " bear-dd-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        title="Block type"
      >
        <span style={{ fontWeight: 700, fontSize: "var(--text-xs)", minWidth: 18, textAlign: "center" }}>{label}</span>
        <CaretIcon />
      </button>
      {open && (
        <PortalDropdown anchorRef={btnRef} onPointerDown={(e) => e.stopPropagation()}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`bear-more-item${item.match ? " bear-more-item--active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                setBlockType(item.type, item.props);
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 24 }}>{item.short}</span>
              {item.label}
            </button>
          ))}
        </PortalDropdown>
      )}
    </div>
  );
}

/* ── Conditional formatting toolbar ───────────────────────────────────────
   Hides the toolbar for image/table blocks (they have their own controls).
   ──────────────────────────────────────────────────────────────────────── */

function ConditionalFormattingToolbar({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();
  const [blockType, setBlockType] = useState<string>("");

  useEditorSelectionChange(() => {
    try {
      setBlockType(editor.getTextCursorPosition().block?.type ?? "");
    } catch {}
  });

  // Don't show toolbar for image/table blocks
  if (["image", "table", "video", "audio", "file"].includes(blockType)) {
    return null;
  }

  return (
    <FormattingToolbar>
      <ToolbarBlockTypeSelect key="blockType" />
      <BasicTextStyleButton key="bold" basicTextStyle="bold" />
      <BasicTextStyleButton key="italic" basicTextStyle="italic" />
      <BasicTextStyleButton key="underline" basicTextStyle="underline" />
      <CreateLinkButton key="link" />
      <TextAlignButton key="align-left" textAlignment="left" />
      <TextAlignButton key="align-center" textAlignment="center" />
      <TextAlignButton key="align-right" textAlignment="right" />
      <ToolbarMoreMenu key="more" context={context} />
    </FormattingToolbar>
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

  // Strip leading empty paragraphs so the document doesn't start with blank lines
  const cleanedContent = useMemo(() => {
    if (!hasBlockNoteContent) return undefined;
    let start = 0;
    while (
      start < value.length - 1 && // keep at least one block
      value[start].type === "paragraph" &&
      (!value[start].content || value[start].content.length === 0)
    ) {
      start++;
    }
    return start > 0 ? value.slice(start) : value;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editor = useCreateBlockNote(
    {
      schema: rimBlockSchema,
      initialContent: cleanedContent,
      uploadFile,
      tables: {
        splitCells: true,
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true,
      },
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

  // Inject heading size overrides AFTER BlockNote CSS loads.
  // BlockNote renders actual <h1>, <h2>, <h3> tags inside [data-content-type="heading"].
  // Note: data-level is only set by SideMenu which we've disabled (sideMenu={false}),
  // so we must target the actual HTML heading tags directly.
  useEffect(() => {
    const id = "rim-heading-overrides";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .rim-block-editor .bn-block-content[data-content-type="heading"] h1 {
        font-size: 32px !important; line-height: 1.2 !important;
        margin-top: 24px !important; margin-bottom: 8px !important;
      }
      .rim-block-editor .bn-block-content[data-content-type="heading"] h2 {
        font-size: 24px !important; line-height: 1.25 !important;
        margin-top: 20px !important; margin-bottom: 6px !important;
      }
      .rim-block-editor .bn-block-content[data-content-type="heading"] h3 {
        font-size: 20px !important; line-height: 1.3 !important;
        margin-top: 16px !important; margin-bottom: 4px !important;
      }
      .rim-block-editor .bn-block-content[data-content-type="heading"] h1,
      .rim-block-editor .bn-block-content[data-content-type="heading"] h2,
      .rim-block-editor .bn-block-content[data-content-type="heading"] h3 {
        font-family: var(--font-doc) !important;
        font-weight: 700 !important;
        letter-spacing: -0.01em !important;
      }
      /* Reset any block-level font-size that BlockNote's transition animation sets */
      .rim-block-editor .bn-block-outer[data-prev-type="heading"] > .bn-block > .bn-block-content:not([data-content-type="heading"]) {
        font-size: 16px !important; font-weight: 400 !important;
      }
      /* ── Paragraph spacing ── */
      .rim-block-editor .bn-block-content[data-content-type="paragraph"] {
        margin-bottom: 4px !important;
      }
      /* ── Lists — match doc-body view mode ── */
      .rim-block-editor .bn-block-content[data-content-type="bulletListItem"],
      .rim-block-editor .bn-block-content[data-content-type="numberedListItem"] {
        margin-bottom: 2px !important;
      }
      /* ── Blockquote ── */
      .rim-block-editor .bn-block-content[data-content-type="quote"] {
        border-left: 3px solid #d5d5d5 !important;
        padding-left: 20px !important;
        color: var(--rim-text-muted) !important;
        font-style: italic !important;
      }
      /* ── Links ── */
      .rim-block-editor .bn-editor a {
        color: var(--rim-mid) !important;
        text-decoration: underline !important;
        text-underline-offset: 2px !important;
      }
      .rim-block-editor .bn-editor a:hover {
        color: var(--rim-blue) !important;
      }
      /* ── Table cells — borders + padding to match doc-body ── */
      .rim-block-editor table td,
      .rim-block-editor table th {
        border: 1px solid #d5d0cb !important;
        padding: 10px 14px !important;
        vertical-align: top !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

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
        {/* Selection toolbar — hidden for image/table blocks which have their own controls */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <ConditionalFormattingToolbar context={context} />
          )}
        />
        {/* Slash menu — tier-filtered. Native menu off; this replaces it. */}
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) => {
            const allowed = slashTitlesFor(context);
            const all = getDefaultReactSlashMenuItems(editor);
            const filtered = all.filter((item) => allowed.has(item.title));
            return filterSuggestionItems(filtered, query);
          }}
        />
        {/* Empty line — full Bear pill */}
        <EmptyLinePill context={context} />
        {/* Image alignment overlay — shows L/C/R on the image itself */}
        <ImageAlignOverlay />
        {/* Table delete button — × at top-right corner on hover */}
        <TableDeleteOverlay />
      </BlockNoteView>
    </div>
  );
}
