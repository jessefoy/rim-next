"use client";

/**
 * RimProseEditor — lightweight prose editor for notes, messages, and short fields.
 * Restricted to paragraph, bullet/numbered lists, and quotes.
 * No headings, no custom blocks, no slash menu.
 *
 * Props:
 *   variant    — "document" (default): full formatting toolbar, standard padding.
 *                "compact": selection-only floating toolbar with full formatting
 *                (bold/italic/underline/link + bullet/ordered list), reduced padding.
 *                For message compose fields.
 *   minimal    — when true, shows only Bold + Italic + Link in the formatting toolbar
 *   legacyHtml — pre-rendered HTML from server (Tiptap JSON → HTML).
 *                Imported into BlockNote on mount when value is null/empty.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useState, useCallback } from "react";
import {
  useCreateBlockNote,
  useBlockNoteEditor,
  useEditorSelectionChange,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimProseSchema } from "@/lib/blockNoteCustomBlocks";

interface Props {
  value: any;
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
  minimal?: boolean;         // strips toolbar to Bold + Italic + Link only
  variant?: "document" | "compact"; // compact = message-sized fields, selection-only toolbar
  legacyHtml?: string;       // pre-rendered HTML for Tiptap → BlockNote import on mount
}

/* ── Block-type toggle button for the compact toolbar ──────────────────── */

function BlockTypeToggle({
  blockType,
  icon,
  title,
}: {
  blockType: "bulletListItem" | "numberedListItem";
  icon: React.ReactNode;
  title: string;
}) {
  const editor = useBlockNoteEditor();
  const [active, setActive] = useState(false);

  useEditorSelectionChange(() => {
    try {
      const block = editor.getTextCursorPosition().block;
      setActive(block?.type === blockType);
    } catch {
      setActive(false);
    }
  });

  const toggle = useCallback(() => {
    try {
      editor.focus();
      const block = editor.getTextCursorPosition().block;
      if (block.type === blockType) {
        editor.updateBlock(block, { type: "paragraph" as any });
      } else {
        editor.updateBlock(block, { type: blockType as any });
      }
    } catch {}
  }, [editor, blockType]);

  return (
    <button
      type="button"
      className={`rte-compact-btn${active ? " rte-compact-btn--active" : ""}`}
      onMouseDown={(e) => { e.preventDefault(); toggle(); }}
      title={title}
    >
      {icon}
    </button>
  );
}

/* ── Compact formatting toolbar ─────────────────────────────────────────── */

function CompactFormattingToolbar() {
  return (
    <FormattingToolbar>
      {/* Inline styles */}
      <BasicTextStyleButton key="bold" basicTextStyle="bold" />
      <BasicTextStyleButton key="italic" basicTextStyle="italic" />
      <BasicTextStyleButton key="underline" basicTextStyle="underline" />
      <CreateLinkButton key="link" />

      {/* Divider */}
      <span key="div" className="rte-compact-divider" />

      {/* Block types */}
      <BlockTypeToggle
        key="bullet"
        blockType="bulletListItem"
        title="Bullet list"
        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="4" r="1.5"/><rect x="6" y="3" width="8" height="2" rx="0.5"/><circle cx="3" cy="8" r="1.5"/><rect x="6" y="7" width="8" height="2" rx="0.5"/><circle cx="3" cy="12" r="1.5"/><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>}
      />
      <BlockTypeToggle
        key="ordered"
        blockType="numberedListItem"
        title="Numbered list"
        icon={<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><text x="1" y="5.5" fontSize="6" fontWeight="700" fontFamily="sans-serif">1</text><rect x="6" y="3" width="8" height="2" rx="0.5"/><text x="1" y="9.5" fontSize="6" fontWeight="700" fontFamily="sans-serif">2</text><rect x="6" y="7" width="8" height="2" rx="0.5"/><text x="1" y="13.5" fontSize="6" fontWeight="700" fontFamily="sans-serif">3</text><rect x="6" y="11" width="8" height="2" rx="0.5"/></svg>}
      />
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
      schema: rimProseSchema,
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
        </BlockNoteView>
      </div>
    );
  }

  // Minimal variant: reduced toolbar
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

  // Document variant (default): full toolbar
  return (
    <div className="rim-prose-editor" style={{ minHeight: effectiveMinHeight }}>
      <BlockNoteView
        editor={editor}
        theme={rimTheme}
        onChange={(editor) => onChange(editor.document)}
        slashMenu={false}
        sideMenu={false}
      />
    </div>
  );
}
