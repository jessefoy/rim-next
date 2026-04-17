"use client";

/**
 * RimProseEditor — the Message-tier engine (Tier 1).
 *
 * Drives every conversational surface: conversations, announcements, tasks,
 * support replies, admin/household/volunteer notes, lesson notes,
 * reflection-question prompts, site banner, schedule sub-messages, and
 * program message fields. See RIM_Editor_Design.md for the full context
 * registry.
 *
 * Shares rimBlockSchema with RimBlockEditor; the difference is the toolbar
 * configuration and the tier's block allowlist — not a different engine.
 *
 * Props:
 *   variant    — Toolbar density within the Message tier. Does NOT select a
 *                tier — the engine is always Message here; variant only
 *                changes how much chrome is visible.
 *                "document" (default): always-visible formatting toolbar,
 *                    standard padding. Used for longer message surfaces
 *                    (announcement composer, support reply, admin notes).
 *                "compact": selection-only floating toolbar, reduced padding.
 *                    Used for inline message composers (conversation reply,
 *                    task body, comment fields).
 *                The name "document" is a legacy carryover from before the
 *                tier system; it describes toolbar density, not Tier 2
 *                Document. Phase 5 of the editor redesign will unify chrome
 *                across tiers and retire this prop.
 *   minimal    — when true, shows only Bold + Italic + Link in the toolbar.
 *                For fields where even lists feel like too much (e.g.
 *                reflection-question prompts).
 *   legacyHtml — pre-rendered HTML from server (Tiptap JSON → HTML).
 *                Imported into BlockNote on mount when value is null/empty.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState } from "react";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
  BlockTypeSelect,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenuController,
  DragHandleButton,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import { filterSuggestionItems } from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Message tier allowlist ─────────────────────────────────────────────────
 * Slash menu items permitted in Message-tier surfaces per RIM_Editor_Design.md.
 * Filter by title (English); BlockNote's built-in titles are stable within a
 * major version and RIM is English-only. Dharma custom blocks and headings
 * are deliberately excluded.
 */
const MESSAGE_TIER_SLASH_TITLES = new Set<string>([
  "Paragraph",
  "Bullet List",
  "Numbered List",
  "Check List",
  "Quote",
  "Code Block",
  "Table",
]);

interface Props {
  value: any;
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
  minimal?: boolean;         // strips toolbar to Bold + Italic + Link only
  variant?: "document" | "compact"; // compact = message-sized fields, selection-only toolbar
  legacyHtml?: string;       // pre-rendered HTML for Tiptap → BlockNote import on mount
}

/* ── Compact formatting toolbar ─────────────────────────────────────────── */
/* Uses only BlockNote built-in components — custom components inside
   FormattingToolbar cause client-side crashes (see commit 59a02ae).        */

/* ── Message-tier empty-line pill ───────────────────────────────────────────
 * Minimal pill for Message tier: a single "+" button on empty paragraphs
 * that opens a dropdown of tier-appropriate inserts (lists, quote, code,
 * table). No headings, no images — those are Document/Feature only.
 * Uses the same bear-* CSS classes as RimBlockEditor's pill for visual
 * parity. Mounted only for the "document" variant (large message surfaces).
 */

const MESSAGE_PILL_HEIGHT = 40;

function MessageTierPill() {
  const editor = useBlockNoteEditor();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [flipped, setFlipped] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function isBlockEmpty() {
    try {
      const block = editor.getTextCursorPosition().block;
      if (!block || block.type !== "paragraph") return false;
      const c: any = (block as any).content;
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
      const shouldFlip = viewportH - rect.bottom < MESSAGE_PILL_HEIGHT + 24;
      setFlipped(shouldFlip);
      setPos({
        top: shouldFlip ? rect.top - MESSAGE_PILL_HEIGHT - 8 : rect.bottom + 8,
        left: Math.max(16, rect.left - 12),
      });
    } catch {}
  }

  useEditorSelectionChange(() => {
    try {
      if (showTimer.current) { clearTimeout(showTimer.current); showTimer.current = null; }
      const sel = editor.getSelection();
      if (sel) { setShow(false); setOpen(false); return; }
      if (isBlockEmpty()) {
        updatePos();
        showTimer.current = setTimeout(() => setShow(true), 150);
      } else {
        setShow(false);
        setOpen(false);
      }
    } catch { setShow(false); }
  });

  useEffect(() => () => { if (showTimer.current) clearTimeout(showTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPtr = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => document.addEventListener("pointerdown", onPtr), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("pointerdown", onPtr);
    };
  }, [open]);

  function setBlockType(type: string) {
    try {
      editor.focus();
      editor.updateBlock(editor.getTextCursorPosition().block, { type: type as any });
    } catch {}
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
      editor.insertBlocks(
        [{
          type: "table" as any,
          content: {
            type: "tableContent" as const,
            columnWidths: [undefined, undefined, undefined],
            rows: [makeRow(3), makeRow(3), makeRow(3)],
          },
        } as any],
        block,
        "after",
      );
      setTimeout(() => editor.focus(), 50);
    } catch {}
    setOpen(false);
  }

  if (!show) return null;

  const items = [
    { label: "Bullet List", action: () => setBlockType("bulletListItem") },
    { label: "Numbered List", action: () => setBlockType("numberedListItem") },
    { label: "Checklist", action: () => setBlockType("checkListItem") },
    { label: "Quote", action: () => setBlockType("quote") },
    { label: "Code Block", action: () => setBlockType("codeBlock") },
    { label: "Table", action: insertTable },
  ];

  return (
    <div
      ref={menuRef}
      className={`bear-float${flipped ? " bear-float--above" : ""}`}
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 300 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="bear-pill" style={{ position: "relative" }}>
        <button
          className={`bear-pill__btn${open ? " bear-pill__btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
          title="Insert block"
          aria-label="Insert block"
        >
          <span style={{ fontSize: 16, fontWeight: 500, lineHeight: 1 }}>+</span>
        </button>
        {open && (
          <div
            className="bear-more-dropdown"
            style={{ position: "absolute", top: "100%", left: 0, marginTop: 6 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                className="bear-more-item"
                onMouseDown={(e) => { e.preventDefault(); it.action(); }}
              >
                {it.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactFormattingToolbar() {
  return (
    <FormattingToolbar>
      <BlockTypeSelect key="blockType" />
      <BasicTextStyleButton key="bold" basicTextStyle="bold" />
      <BasicTextStyleButton key="italic" basicTextStyle="italic" />
      <BasicTextStyleButton key="underline" basicTextStyle="underline" />
      <CreateLinkButton key="link" />
    </FormattingToolbar>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function RimProseEditor({
  value,
  onChange,
  minHeight,
  minimal = false,
  variant = "document",
  legacyHtml,
}: Props) {
  const isCompact = variant === "compact";
  const effectiveMinHeight = minHeight ?? (isCompact ? 80 : 160);
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

  // Message-tier slash menu: filter to allowed block types.
  const messageTierSlashMenu = (
    <SuggestionMenuController
      triggerCharacter="/"
      getItems={async (query) => {
        const all = getDefaultReactSlashMenuItems(editor);
        const filtered = all.filter((item) =>
          MESSAGE_TIER_SLASH_TITLES.has(item.title)
        );
        return filterSuggestionItems(filtered, query);
      }}
    />
  );

  // Compact variant: selection-only floating toolbar with full formatting
  if (isCompact) {
    return (
      <div className="rim-prose-editor rim-prose-editor--compact" style={{ minHeight: effectiveMinHeight }}>
        <BlockNoteView
          editor={editor}
          theme={rimTheme}
          onChange={(editor) => onChange(editor.document)}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
        >
          <FormattingToolbarController
            formattingToolbar={CompactFormattingToolbar}
          />
          {messageTierSlashMenu}
        </BlockNoteView>
      </div>
    );
  }

  // Minimal variant: reduced toolbar (no slash menu — field is too small)
  if (minimal) {
    return (
      <div className="rim-prose-editor" style={{ minHeight: effectiveMinHeight }}>
        <BlockNoteView
          editor={editor}
          theme={rimTheme}
          onChange={(editor) => onChange(editor.document)}
          formattingToolbar={false}
          slashMenu={false}
          sideMenu={false}
        >
          <FormattingToolbarController
            formattingToolbar={() => (
              <FormattingToolbar>
                <BasicTextStyleButton key="bold" basicTextStyle="bold" />
                <BasicTextStyleButton key="italic" basicTextStyle="italic" />
                <CreateLinkButton key="link" />
              </FormattingToolbar>
            )}
          />
        </BlockNoteView>
      </div>
    );
  }

  // Document variant (default): full toolbar + block handle + empty-line pill
  return (
    <div className="rim-prose-editor" style={{ minHeight: effectiveMinHeight }}>
      <BlockNoteView
        editor={editor}
        theme={rimTheme}
        onChange={(editor) => onChange(editor.document)}
        slashMenu={false}
        sideMenu={false}
      >
        {/* Block handle — drag-only; no + button (pill/slash handle inserts) */}
        <SideMenuController
          sideMenu={(props) => <DragHandleButton {...props} />}
        />
        {messageTierSlashMenu}
        <MessageTierPill />
      </BlockNoteView>
    </div>
  );
}
