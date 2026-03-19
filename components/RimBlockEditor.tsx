"use client";

/**
 * RimBlockEditor — full-featured block editor for long-form content.
 * Replaces ContentEditor. Supports headings, tables, lists, and custom
 * Dharma blocks (VerseQuote, PracticeSuggestion, Callout) via slash commands.
 *
 * Props:
 *   legacyHtml — pre-rendered HTML from server (Tiptap JSON → HTML).
 *                Imported into BlockNote on mount when value is null/empty.
 *                Enables editing of existing Tiptap content without data migration.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

interface Props {
  value: any;            // BlockNote JSON (array of blocks) or null
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
  legacyHtml?: string;  // pre-rendered HTML for Tiptap → BlockNote import on mount
}

export default function RimBlockEditor({
  value,
  onChange,
  minHeight = 420,
  legacyHtml,
}: Props) {
  const hasBlockNoteContent = Array.isArray(value) && value.length > 0;

  const editor = useCreateBlockNote(
    {
      schema: rimBlockSchema,
      initialContent: hasBlockNoteContent ? value : undefined,
    },
    // deps: value intentionally excluded — BlockNoteView is uncontrolled after mount
    []
  );

  // Import legacy HTML (pre-rendered from Tiptap JSON) on mount when no BlockNote content exists
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
      />
    </div>
  );
}
