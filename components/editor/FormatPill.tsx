"use client";

/**
 * FormatPill — the single formatting surface for every editor in RIM.
 *
 * A floating pill positioned above the current block. Appears whenever the
 * editor has focus; moves only when the cursor enters a new block (not on
 * every keystroke). Replaces both the selection bubble and the per-tier
 * empty-line pills.
 *
 * Contents are driven by lib/editorRegistry.ts → elementsForContext(context)
 * so each surface shows only what its tier allows. Visual design is
 * identical across contexts; what varies is which controls are present.
 *
 * See RIM_Editor_Design.md → "Editor Chrome — One Consistent Surface".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import {
  type EditorContext,
  elementsForContext,
  insertElementsForContext,
  groupElements,
  GROUP_LABELS,
  type EditorElement,
} from "@/lib/editorRegistry";

const PILL_HEIGHT = 44;
const PILL_GAP = 8;

/* ── Visibility helpers ──────────────────────────────────────────────────── */

/**
 * The pill is only useful in two moments:
 *   - the block is empty (user is about to write; wants to pick a block type
 *     or a style to start in);
 *   - text is selected (user wants to format the selection).
 * During active typing on a populated block, the pill gets out of the way.
 * This matches the Bear / Notion model — the pill is an affordance, not a
 * persistent chrome strip hanging over the content.
 */
function isBlockEmpty(block: unknown): boolean {
  try {
    const b = block as { content?: unknown } | null | undefined;
    if (!b) return false;
    const c = b.content;
    if (c === undefined || c === null) return true;
    if (!Array.isArray(c)) return false; // image/table/divider — not text-bearing
    if (c.length === 0) return true;
    if (
      c.length === 1 &&
      (c[0] as { type?: string; text?: string }).type === "text" &&
      !(c[0] as { text?: string }).text
    ) return true;
    return false;
  } catch { return false; }
}

function anyPillMenuOpen(): boolean {
  return typeof document !== "undefined"
    && !!document.querySelector(".fmt-pill__menu");
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function CaretIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path d="M3 4.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Shared dropdown wrapper ─────────────────────────────────────────────── */

function DropdownButton({
  label,
  active,
  open,
  onToggle,
  children,
  ariaLabel,
}: {
  label: React.ReactNode;
  active?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onToggle();
    };
    const t = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onToggle]);

  return (
    <div className="fmt-pill__dd" ref={ref}>
      <button
        type="button"
        className={`fmt-pill__btn fmt-pill__btn--dd${active ? " fmt-pill__btn--active" : ""}${open ? " fmt-pill__btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); onToggle(); }}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        {label}
        <CaretIcon />
      </button>
      {open && (
        <div
          className="fmt-pill__menu"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Paragraph / heading dropdown ────────────────────────────────────────── */

function ParagraphDropdown({
  context,
  activeBlockType,
  activeLevel,
  turnInto,
}: {
  context: EditorContext;
  activeBlockType: string;
  activeLevel: number;
  turnInto: (el: EditorElement) => void;
}) {
  const [open, setOpen] = useState(false);

  const items = elementsForContext(context).filter((el) => el.group === "text");
  if (items.length === 0) return null;

  const currentLabel =
    activeBlockType === "heading" && activeLevel === 2 ? "H2"
    : activeBlockType === "heading" && activeLevel === 3 ? "H3"
    : "¶";

  return (
    <DropdownButton
      label={<span className="fmt-pill__label">{currentLabel}</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Paragraph style"
      active={activeBlockType === "heading"}
    >
      {items.map((el) => {
        const elLevel = (el.blockProps as { level?: number } | undefined)?.level;
        const isActive =
          el.blockType === activeBlockType &&
          (elLevel === undefined || elLevel === activeLevel);
        return (
          <button
            key={el.id}
            type="button"
            className={`fmt-pill__item${isActive ? " fmt-pill__item--active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              turnInto(el);
              setOpen(false);
            }}
          >
            {el.label}
          </button>
        );
      })}
    </DropdownButton>
  );
}

/* ── List dropdown ──────────────────────────────────────────────────────── */

function ListDropdown({
  context,
  activeBlockType,
  turnInto,
}: {
  context: EditorContext;
  activeBlockType: string;
  turnInto: (el: EditorElement) => void;
}) {
  const [open, setOpen] = useState(false);

  const items = elementsForContext(context).filter((el) => el.group === "lists");
  if (items.length === 0) return null;

  const isListActive = items.some((el) => el.blockType === activeBlockType);

  return (
    <DropdownButton
      label={<span className="fmt-pill__label">•</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Lists & quotes"
      active={isListActive}
    >
      {items.map((el) => (
        <button
          key={el.id}
          type="button"
          className={`fmt-pill__item${activeBlockType === el.blockType ? " fmt-pill__item--active" : ""}`}
          onMouseDown={(e) => {
            e.preventDefault();
            turnInto(el);
            setOpen(false);
          }}
        >
          {el.label}
        </button>
      ))}
    </DropdownButton>
  );
}

/* ── Insert (+) dropdown ────────────────────────────────────────────────── */

function InsertDropdown({
  context,
  insertElement,
}: {
  context: EditorContext;
  insertElement: (el: EditorElement) => void;
}) {
  const [open, setOpen] = useState(false);
  const elements = insertElementsForContext(context).filter(
    (el) => el.group !== "text" && el.group !== "lists",
  );
  if (elements.length === 0) return null;

  const groups = groupElements(elements);

  return (
    <DropdownButton
      label={<span className="fmt-pill__label" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1 }}>+</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Insert element"
    >
      {groups.map(({ group, items }, idx) => (
        <div key={group}>
          {idx > 0 && <div className="fmt-pill__menu-divider" />}
          <div className="fmt-pill__menu-group-label">{GROUP_LABELS[group]}</div>
          {items.map((el) => (
            <button
              key={el.id}
              type="button"
              className="fmt-pill__item"
              onMouseDown={(e) => {
                e.preventDefault();
                insertElement(el);
                setOpen(false);
              }}
            >
              {el.label}
            </button>
          ))}
        </div>
      ))}
    </DropdownButton>
  );
}

/* ── Inline style button ─────────────────────────────────────────────────── */

function StyleButton({
  style,
  label,
  active,
  onToggle,
}: {
  style: string;
  label: React.ReactNode;
  active: boolean;
  onToggle: (style: string) => void;
}) {
  return (
    <button
      type="button"
      className={`fmt-pill__btn${active ? " fmt-pill__btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); onToggle(style); }}
      aria-label={style}
      title={style}
    >
      {label}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export function FormatPill({ context }: { context: EditorContext }) {
  const editor = useBlockNoteEditor();

  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [flipped, setFlipped] = useState(false);

  const activeBlockIdRef = useRef<string | null>(null);
  const [activeBlockType, setActiveBlockType] = useState<string>("paragraph");
  const [activeLevel, setActiveLevel] = useState<number>(0);
  const [activeStyles, setActiveStyles] = useState<Record<string, unknown>>({});

  /* ── Positioning ──────────────────────────────────────────────────────── */

  const reposition = useCallback((blockId: string | null) => {
    if (!blockId) { setPos(null); return; }
    const el = document.querySelector(`[data-id="${blockId}"]`) as HTMLElement | null;
    if (!el) { setPos(null); return; }
    const rect = el.getBoundingClientRect();
    const shouldFlipBelow = rect.top - PILL_HEIGHT - 12 < 0;
    setFlipped(shouldFlipBelow);
    setPos({
      top: shouldFlipBelow ? rect.bottom + PILL_GAP : rect.top - PILL_HEIGHT - PILL_GAP,
      left: rect.left,
    });
  }, []);

  /* ── Track cursor → block + styles ────────────────────────────────────── */

  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      if (!block) { setVisible(false); return; }
      setActiveBlockType(block.type);
      setActiveLevel(((block.props as Record<string, unknown>)?.level as number) ?? 0);
      setActiveStyles(editor.getActiveStyles() as Record<string, unknown>);
      if (block.id !== activeBlockIdRef.current) {
        activeBlockIdRef.current = block.id;
        reposition(block.id);
      }
      // Show only when the pill is actually useful: empty block, active
      // selection, or an open pill menu. Otherwise get out of the way while
      // the user is typing.
      const hasSelection = !!editor.getSelection();
      setVisible(isBlockEmpty(block) || hasSelection || anyPillMenuOpen());
    } catch {
      setVisible(false);
    }
  });

  /* ── Reposition on scroll/resize ──────────────────────────────────────── */

  useEffect(() => {
    if (!visible) return;
    const onChange = () => reposition(activeBlockIdRef.current);
    window.addEventListener("scroll", onChange, { passive: true, capture: true });
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [visible, reposition]);

  /* ── Show on editor focus, hide on blur ──────────────────────────────── */

  useEffect(() => {
    const el = editor.domElement;
    if (!el) return;

    const onFocusIn = () => {
      try {
        const block = editor.getTextCursorPosition().block;
        if (!block) return;
        activeBlockIdRef.current = block.id;
        setActiveBlockType(block.type);
        setActiveLevel(((block.props as Record<string, unknown>)?.level as number) ?? 0);
        setActiveStyles(editor.getActiveStyles() as Record<string, unknown>);
        reposition(block.id);
        const hasSelection = !!editor.getSelection();
        setVisible(isBlockEmpty(block) || hasSelection || anyPillMenuOpen());
      } catch {}
    };

    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as HTMLElement | null;
      // Stay visible if focus moved into the pill
      if (next && next.closest(".fmt-pill")) return;
      // Stay visible if focus is still inside the editor DOM
      if (next && el.contains(next)) return;
      setVisible(false);
    };

    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [editor, reposition]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const toggleStyle = useCallback((style: string) => {
    try {
      editor.focus();
      editor.toggleStyles({ [style]: true } as Record<string, true>);
    } catch {}
  }, [editor]);

  /**
   * Toggle a block into the chosen type — or back to paragraph if it's
   * already that type. Matches the Bear / Notion pattern: clicking "Bullet
   * List" on a bullet list turns it back into a paragraph.
   */
  const turnInto = useCallback(
    (el: EditorElement) => {
      try {
        editor.focus();
        const block = editor.getTextCursorPosition().block;
        const currentType = block.type;
        const currentLevel =
          ((block.props as Record<string, unknown>)?.level as number | undefined) ?? 0;
        const elLevel =
          ((el.blockProps as Record<string, unknown> | undefined)?.level as
            | number
            | undefined) ?? 0;
        const isAlreadyThisType =
          currentType === el.blockType &&
          (el.blockType !== "heading" || currentLevel === elLevel);
        editor.updateBlock(block, {
          type: (isAlreadyThisType ? "paragraph" : el.blockType) as never,
          props: (isAlreadyThisType ? {} : (el.blockProps ?? {})) as never,
        });
      } catch {}
    },
    [editor],
  );

  const insertElement = useCallback(
    (el: EditorElement) => {
      try {
        const block = editor.getTextCursorPosition().block;

        if (el.blockType === "table") {
          const emptyCell = [{ type: "text" as const, text: "", styles: {} }];
          const makeRow = (n: number) => ({
            cells: Array.from({ length: n }, () => ({
              type: "tableCell" as const,
              content: emptyCell,
              props: { colspan: 1, rowspan: 1 },
            })),
          });
          editor.insertBlocks(
            [{
              type: "table" as never,
              content: {
                type: "tableContent" as const,
                columnWidths: [undefined, undefined, undefined],
                rows: [makeRow(3), makeRow(3), makeRow(3)],
              } as never,
            }],
            block,
            "after",
          );
        } else {
          editor.insertBlocks(
            [{
              type: el.blockType as never,
              props: (el.blockProps ?? {}) as never,
            }],
            block,
            "after",
          );
          setTimeout(() => {
            try {
              const next = editor.getTextCursorPosition().nextBlock;
              if (next) editor.setTextCursorPosition(next, "start");
            } catch {}
            editor.focus();
          }, 50);
        }
      } catch (err) {
        console.error("insertElement failed:", err);
      }
    },
    [editor],
  );

  /* ── Render ───────────────────────────────────────────────────────────── */

  if (!visible || !pos) return null;

  return createPortal(
    <div
      className={`fmt-pill${flipped ? " fmt-pill--flipped" : ""}`}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 400 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ParagraphDropdown
        context={context}
        activeBlockType={activeBlockType}
        activeLevel={activeLevel}
        turnInto={turnInto}
      />
      <ListDropdown
        context={context}
        activeBlockType={activeBlockType}
        turnInto={turnInto}
      />

      <span className="fmt-pill__sep" />

      <StyleButton
        style="bold"
        label={<strong>B</strong>}
        active={!!activeStyles.bold}
        onToggle={toggleStyle}
      />
      <StyleButton
        style="italic"
        label={<em>I</em>}
        active={!!activeStyles.italic}
        onToggle={toggleStyle}
      />
      <StyleButton
        style="underline"
        label={<u>U</u>}
        active={!!activeStyles.underline}
        onToggle={toggleStyle}
      />

      <span className="fmt-pill__sep" />

      <InsertDropdown context={context} insertElement={insertElement} />
    </div>,
    document.body,
  );
}
