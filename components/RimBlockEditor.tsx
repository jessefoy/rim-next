"use client";

/**
 * RimBlockEditor — full-featured block editor for long-form content.
 * Replaces ContentEditor. Supports headings, tables, lists, and custom
 * Dharma blocks (VerseQuote, PracticeSuggestion, Callout) via slash commands.
 *
 * Props:
 *   legacyHtml — pre-rendered HTML from server (Tiptap JSON → HTML).
 *                Imported into BlockNote on mount when value is null/empty.
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useMemo } from "react";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
} from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
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

  // Custom slash menu: default items + Dharma blocks
  const getSlashMenuItems = useMemo(
    () => async (query: string) => {
      const defaultItems = getDefaultReactSlashMenuItems(editor);
      const dharmaItems = [
        {
          title: "Verse Quote",
          subtext: "Italic serif block with attribution line",
          icon: <RiQuoteText size={18} />,
          onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
              type: "verseQuote" as any,
            });
          },
          aliases: ["verse", "quote", "poetry", "sutta"],
          group: "Dharma",
          key: "verse_quote",
        },
        {
          title: "Practice Suggestion",
          subtext: "Teal practice box with label",
          icon: <RiPlantLine size={18} />,
          onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
              type: "practiceSuggestion" as any,
            });
          },
          aliases: ["practice", "suggestion", "meditation", "exercise"],
          group: "Dharma",
          key: "practice_suggestion",
        },
        {
          title: "Callout",
          subtext: "Highlighted note or aside",
          icon: <RiInformationLine size={18} />,
          onItemClick: () => {
            insertOrUpdateBlockForSlashMenu(editor, {
              type: "callout" as any,
            });
          },
          aliases: ["callout", "note", "aside", "info", "warning"],
          group: "Dharma",
          key: "callout",
        },
      ];
      return filterSuggestionItems(
        [...defaultItems, ...dharmaItems],
        query
      );
    },
    [editor]
  );

  return (
    <div className="rim-block-editor" style={{ minHeight }}>
      <BlockNoteView
        editor={editor}
        theme={rimTheme}
        onChange={(editor) => onChange(editor.document)}
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
      </BlockNoteView>
    </div>
  );
}
