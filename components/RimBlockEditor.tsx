"use client";

/**
 * RimBlockEditor — full-featured block editor for long-form content.
 * Replaces ContentEditor. Supports headings, tables, lists, and custom
 * Dharma blocks (VerseQuote, PracticeSuggestion, Callout) via slash commands.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

interface Props {
  value: any;            // BlockNote JSON (array of blocks) or null
  onChange: (json: any) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RimBlockEditor({
  value,
  onChange,
  minHeight = 420,
}: Props) {
  const editor = useCreateBlockNote(
    {
      schema: rimBlockSchema,
      initialContent: Array.isArray(value) && value.length > 0 ? value : undefined,
    },
    // deps: value intentionally excluded — BlockNoteView is uncontrolled after mount
    []
  );

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
