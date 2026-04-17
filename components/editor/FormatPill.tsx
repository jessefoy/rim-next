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
  activeToggleable,
  turnInto,
  toggleCollapsible,
  clearFormatting,
}: {
  context: EditorContext;
  activeBlockType: string;
  activeLevel: number;
  activeToggleable: boolean;
  turnInto: (el: EditorElement) => void;
  toggleCollapsible: () => void;
  clearFormatting: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = elementsForContext(context).filter((el) => el.group === "text");
  if (items.length === 0) return null;

  const currentLabel =
    activeBlockType === "heading" && activeLevel >= 1 && activeLevel <= 6
      ? `H${activeLevel}`
      : "¶";

  const onHeading = activeBlockType === "heading";

  return (
    <DropdownButton
      label={<span className="fmt-pill__label">{currentLabel}</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Paragraph style"
      active={onHeading}
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
      {onHeading && (
        <>
          <div className="fmt-pill__menu-divider" />
          <button
            type="button"
            className={`fmt-pill__item${activeToggleable ? " fmt-pill__item--active" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              toggleCollapsible();
              setOpen(false);
            }}
          >
            {activeToggleable ? "✓ Collapsible" : "Make collapsible"}
          </button>
        </>
      )}
      <div className="fmt-pill__menu-divider" />
      <button
        type="button"
        className="fmt-pill__item"
        onMouseDown={(e) => {
          e.preventDefault();
          clearFormatting();
          setOpen(false);
        }}
      >
        Clear formatting
      </button>
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

/* ── Color dropdown (text + background palette) ──────────────────────────── */

const COLOR_PALETTE: { name: string; label: string; swatch: string; fg: string; bg: string }[] = [
  { name: "default", label: "Default",  swatch: "#555555", fg: "inherit",   bg: "transparent" },
  { name: "gray",    label: "Gray",     swatch: "#9b9a97", fg: "#6b6b6b",   bg: "#ededeb"     },
  { name: "brown",   label: "Brown",    swatch: "#a57b48", fg: "#6b4a2b",   bg: "#e9dfd5"     },
  { name: "red",     label: "Red",      swatch: "#e03e3e", fg: "#a22828",   bg: "#fbe4e4"     },
  { name: "orange",  label: "Orange",   swatch: "#d9730d", fg: "#8a4d08",   bg: "#fbe4c9"     },
  { name: "yellow",  label: "Yellow",   swatch: "#dfab01", fg: "#8a6b00",   bg: "#fcf4c9"     },
  { name: "green",   label: "Green",    swatch: "#0f7b6c", fg: "#1a5b50",   bg: "#ddedea"     },
  { name: "blue",    label: "Blue",     swatch: "#0b6e99", fg: "#1a4b6b",   bg: "#d8e6f2"     },
  { name: "purple",  label: "Purple",   swatch: "#6940a5", fg: "#4a2d73",   bg: "#e5dcf0"     },
  { name: "pink",    label: "Pink",     swatch: "#ad1a72", fg: "#7a135a",   bg: "#f5dbed"     },
];

function ColorDropdown({
  activeTextColor,
  activeBgColor,
  setColor,
}: {
  activeTextColor: string;
  activeBgColor: string;
  setColor: (kind: "textColor" | "backgroundColor", value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownButton
      label={
        <span
          className="fmt-pill__label"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 18,
            height: 18,
            fontWeight: 600,
            color: activeTextColor !== "default"
              ? (COLOR_PALETTE.find((c) => c.name === activeTextColor)?.fg ?? "inherit")
              : "inherit",
            background: activeBgColor !== "default"
              ? (COLOR_PALETTE.find((c) => c.name === activeBgColor)?.bg ?? "transparent")
              : "transparent",
            borderRadius: 3,
          }}
        >
          A
        </span>
      }
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Text color"
    >
      <div className="fmt-pill__menu-group-label">Text color</div>
      <div className="fmt-pill__swatches">
        {COLOR_PALETTE.map((c) => (
          <button
            key={`fg-${c.name}`}
            type="button"
            className={`fmt-pill__swatch${activeTextColor === c.name ? " fmt-pill__swatch--active" : ""}`}
            title={c.label}
            onMouseDown={(e) => { e.preventDefault(); setColor("textColor", c.name); setOpen(false); }}
          >
            <span style={{ color: c.name === "default" ? "var(--rim-text)" : c.fg }}>A</span>
          </button>
        ))}
      </div>
      <div className="fmt-pill__menu-divider" />
      <div className="fmt-pill__menu-group-label">Highlight</div>
      <div className="fmt-pill__swatches">
        {COLOR_PALETTE.map((c) => (
          <button
            key={`bg-${c.name}`}
            type="button"
            className={`fmt-pill__swatch${activeBgColor === c.name ? " fmt-pill__swatch--active" : ""}`}
            title={c.label}
            onMouseDown={(e) => { e.preventDefault(); setColor("backgroundColor", c.name); setOpen(false); }}
          >
            <span style={{ background: c.name === "default" ? "transparent" : c.bg, padding: "0 4px", borderRadius: 2 }}>A</span>
          </button>
        ))}
      </div>
    </DropdownButton>
  );
}

/* ── Link button (popover with URL input) ────────────────────────────────── */

function LinkButton({
  activeHref,
  createLink,
  removeLink,
}: {
  activeHref: string | null;
  createLink: (url: string) => void;
  removeLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl(activeHref ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, activeHref]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const t = setTimeout(() => document.addEventListener("pointerdown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function commit() {
    const trimmed = url.trim();
    if (trimmed) createLink(trimmed); else removeLink();
    setOpen(false);
  }

  return (
    <div className="fmt-pill__dd" ref={ref}>
      <button
        type="button"
        className={`fmt-pill__btn${activeHref ? " fmt-pill__btn--active" : ""}${open ? " fmt-pill__btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        aria-label="Link"
        title="Link"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M6.5 9.5l3-3M5.5 11.5a2.5 2.5 0 010-3.54l1.5-1.5M10.5 4.5a2.5 2.5 0 010 3.54l-1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          className="fmt-pill__menu fmt-pill__menu--link"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            className="fmt-pill__link-input"
            type="url"
            placeholder="Paste or type a URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
            }}
          />
          <div className="fmt-pill__link-row">
            <button type="button" className="fmt-pill__btn" onMouseDown={(e) => { e.preventDefault(); commit(); }}>
              {activeHref ? "Update" : "Apply"}
            </button>
            {activeHref && (
              <button type="button" className="fmt-pill__btn" onMouseDown={(e) => { e.preventDefault(); removeLink(); setOpen(false); }}>
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Align dropdown ──────────────────────────────────────────────────────── */

function AlignDropdown({
  activeAlign,
  setAlign,
}: {
  activeAlign: string;
  setAlign: (value: "left" | "center" | "right" | "justify") => void;
}) {
  const [open, setOpen] = useState(false);
  const icon = (a: string) => {
    const lines: Record<string, number[]> = {
      left:    [12, 8, 10, 6],
      center:  [12, 8, 10, 6],
      right:   [12, 8, 10, 6],
      justify: [12, 12, 12, 12],
    };
    const offsets: Record<string, number> = { left: 2, center: 4, right: 6, justify: 2 };
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        {lines[a].map((w, i) => (
          <rect
            key={i}
            x={a === "center" ? (16 - w) / 2 : a === "right" ? 16 - w - 2 : offsets[a]}
            y={3 + i * 2.5}
            width={w}
            height="1.3"
            rx="0.5"
            fill="currentColor"
          />
        ))}
      </svg>
    );
  };
  return (
    <DropdownButton
      label={<span className="fmt-pill__label" style={{ display: "inline-flex", alignItems: "center" }}>{icon(activeAlign || "left")}</span>}
      open={open}
      onToggle={() => setOpen(!open)}
      ariaLabel="Alignment"
    >
      {(["left", "center", "right", "justify"] as const).map((a) => (
        <button
          key={a}
          type="button"
          className={`fmt-pill__item${activeAlign === a ? " fmt-pill__item--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); setAlign(a); setOpen(false); }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {icon(a)}
            <span style={{ textTransform: "capitalize" }}>{a}</span>
          </span>
        </button>
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
  const [activeAlign, setActiveAlign] = useState<string>("left");
  const [activeToggleable, setActiveToggleable] = useState<boolean>(false);
  const [activeStyles, setActiveStyles] = useState<Record<string, unknown>>({});
  const [activeHref, setActiveHref] = useState<string | null>(null);

  /* ── Sync state from current block + selection ───────────────────────── */

  const syncFromCursor = useCallback(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      if (!block) return null;
      const props = (block.props ?? {}) as Record<string, unknown>;
      setActiveBlockType(block.type);
      setActiveLevel((props.level as number) ?? 0);
      setActiveAlign(((props.textAlignment as string) ?? "left"));
      setActiveToggleable(!!props.isToggleable);
      setActiveStyles(editor.getActiveStyles() as Record<string, unknown>);
      try {
        const href = (editor as unknown as { getSelectedLinkUrl?: () => string | undefined })
          .getSelectedLinkUrl?.();
        setActiveHref(href || null);
      } catch { setActiveHref(null); }
      return block;
    } catch {
      return null;
    }
  }, [editor]);

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
    const block = syncFromCursor();
    if (!block) { setVisible(false); return; }
    if (block.id !== activeBlockIdRef.current) {
      activeBlockIdRef.current = block.id;
      reposition(block.id);
    }
    const hasSelection = !!editor.getSelection();
    setVisible(isBlockEmpty(block) || hasSelection || anyPillMenuOpen());
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
      const block = syncFromCursor();
      if (!block) return;
      activeBlockIdRef.current = block.id;
      reposition(block.id);
      const hasSelection = !!editor.getSelection();
      setVisible(isBlockEmpty(block) || hasSelection || anyPillMenuOpen());
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
  }, [editor, reposition, syncFromCursor]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const toggleStyle = useCallback((style: string) => {
    try {
      editor.focus();
      editor.toggleStyles({ [style]: true } as Record<string, true>);
      setActiveStyles(editor.getActiveStyles() as Record<string, unknown>);
    } catch {}
  }, [editor]);

  const setColor = useCallback(
    (kind: "textColor" | "backgroundColor", value: string) => {
      try {
        editor.focus();
        // BlockNote applies textColor / backgroundColor via addStyles with the
        // named palette key as value; clearing uses removeStyles.
        if (value === "default") {
          (editor as unknown as { removeStyles: (s: Record<string, string>) => void })
            .removeStyles({ [kind]: "" });
        } else {
          (editor as unknown as { addStyles: (s: Record<string, string>) => void })
            .addStyles({ [kind]: value });
        }
        setActiveStyles(editor.getActiveStyles() as Record<string, unknown>);
      } catch {}
    },
    [editor],
  );

  const setAlign = useCallback(
    (value: "left" | "center" | "right" | "justify") => {
      try {
        editor.focus();
        const block = editor.getTextCursorPosition().block;
        editor.updateBlock(block, {
          props: { textAlignment: value } as never,
        });
        setActiveAlign(value);
      } catch {}
    },
    [editor],
  );

  const createLink = useCallback(
    (url: string) => {
      try {
        editor.focus();
        (editor as unknown as { createLink: (u: string) => void }).createLink(url);
        setActiveHref(url);
      } catch {}
    },
    [editor],
  );

  const removeLink = useCallback(() => {
    try {
      editor.focus();
      // BlockNote removes a link by creating an empty-url link over the range;
      // the cleanest programmatic path is to clear the link mark via the
      // underlying editor's commands.
      const bn = editor as unknown as {
        _tiptapEditor?: { commands?: { unsetLink?: () => void } };
      };
      bn._tiptapEditor?.commands?.unsetLink?.();
      setActiveHref(null);
    } catch {}
  }, [editor]);

  const toggleCollapsible = useCallback(() => {
    try {
      editor.focus();
      const block = editor.getTextCursorPosition().block;
      const curr = !!((block.props as Record<string, unknown>)?.isToggleable);
      editor.updateBlock(block, {
        props: { isToggleable: !curr } as never,
      });
      setActiveToggleable(!curr);
    } catch {}
  }, [editor]);

  const clearFormatting = useCallback(() => {
    try {
      editor.focus();
      const keys = ["bold", "italic", "underline", "strike", "code", "textColor", "backgroundColor"];
      const obj: Record<string, string> = {};
      for (const k of keys) obj[k] = "";
      (editor as unknown as { removeStyles: (s: Record<string, string>) => void })
        .removeStyles(obj);
      setActiveStyles({});
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
        const currentProps = (block.props ?? {}) as Record<string, unknown>;
        const elProps = (el.blockProps ?? {}) as Record<string, unknown>;
        const propsMatch = Object.entries(elProps).every(
          ([k, v]) => currentProps[k] === v,
        );
        const isAlreadyThisType = currentType === el.blockType && propsMatch;
        // Converting into a container callout: move the block's inline content
        // into a paragraph child so it isn't lost when schema drops it.
        if (!isAlreadyThisType && el.blockType === "callout") {
          const inline = Array.isArray((block as any).content)
            ? (block as any).content
            : [];
          editor.updateBlock(block, {
            type: "callout" as never,
            props: elProps as never,
            children: [
              { type: "paragraph" as never, content: inline as never },
            ] as never,
          });
          return;
        }
        editor.updateBlock(block, {
          type: (isAlreadyThisType ? "paragraph" : el.blockType) as never,
          props: (isAlreadyThisType ? {} : elProps) as never,
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
        } else if (el.blockType === "callout") {
          // Container callout — seed with one empty paragraph child so the
          // body has an editable block ready.
          editor.insertBlocks(
            [{
              type: "callout" as never,
              props: (el.blockProps ?? {}) as never,
              children: [{ type: "paragraph" as never }],
            }],
            block,
            "after",
          );
          setTimeout(() => {
            try {
              const next = editor.getTextCursorPosition().nextBlock;
              const firstChild = next?.children?.[0];
              if (firstChild) {
                editor.setTextCursorPosition(firstChild.id, "start");
                editor.focus();
              }
            } catch {}
          }, 50);
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
        activeToggleable={activeToggleable}
        turnInto={turnInto}
        toggleCollapsible={toggleCollapsible}
        clearFormatting={clearFormatting}
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
      <StyleButton
        style="strike"
        label={<s>S</s>}
        active={!!activeStyles.strike}
        onToggle={toggleStyle}
      />
      <StyleButton
        style="code"
        label={<code style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{`< >`}</code>}
        active={!!activeStyles.code}
        onToggle={toggleStyle}
      />

      <span className="fmt-pill__sep" />

      <ColorDropdown
        activeTextColor={(activeStyles.textColor as string) || "default"}
        activeBgColor={(activeStyles.backgroundColor as string) || "default"}
        setColor={setColor}
      />
      <LinkButton
        activeHref={activeHref}
        createLink={createLink}
        removeLink={removeLink}
      />
      <AlignDropdown activeAlign={activeAlign} setAlign={setAlign} />

      <span className="fmt-pill__sep" />

      <InsertDropdown context={context} insertElement={insertElement} />
    </div>,
    document.body,
  );
}
