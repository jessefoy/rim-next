"use client";

/**
 * RimProseEditor — prose editor for notes, messages, descriptions, and short fields.
 *
 * Uses the same rimBlockSchema as RimBlockEditor (one schema, two toolbars).
 * Any fix or block type added to the full editor is available here automatically.
 *
 * Props:
 *   variant    — "document" (default): full formatting toolbar, standard padding.
 *                "compact": selection-only floating toolbar with contextual formatting
 *                (B/I/U/Link + H2/H3 + Bullet/Ordered/Quote), reduced padding.
 *                For message compose fields.
 *   minimal    — when true, shows only Bold + Italic + Link in the formatting toolbar
 *   legacyHtml — pre-rendered HTML from server (Tiptap JSON → HTML).
 *                Imported into BlockNote on mount when value is null/empty.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect } from "react";
import {
  useCreateBlockNote,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
  BlockTypeSelect,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

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
