"use client";

/**
 * RimBlockEditor — full-featured block editor for long-form content.
 *
 * Bear-inspired design:
 *   - No side menu (no hovering drag handle / + button)
 *   - Clean floating toolbar when text is selected: B, I, U, Link, ⋯
 *   - Additional formatting (headings, lists, quote) behind the ⋯ menu
 *   - Slash commands (/) for inserting blocks including custom Dharma blocks
 *   - Inter font for clean document editing
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  useCreateBlockNote,
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  FormattingToolbarController,
  FormattingToolbar,
  BasicTextStyleButton,
  CreateLinkButton,
  useBlockNoteEditor,
  useEditorSelectionChange,
} from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import { BlockNoteView } from "@blocknote/mantine";
import { RiQuoteText, RiPlantLine, RiInformationLine } from "react-icons/ri";
import { rimTheme } from "@/lib/blockNoteTheme";
import { rimBlockSchema } from "@/lib/blockNoteCustomBlocks";

/* ── Bear-style ⋯ More menu ────────────────────────────────────────────── */

function MoreMenuButton() {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Track which block type is active for visual feedback
  const [activeBlock, setActiveBlock] = useState<string>("");
  useEditorSelectionChange(() => {
    const block = editor.getTextCursorPosition().block;
    setActiveBlock(block?.type ?? "");
  });

  function setBlockType(type: string, props?: Record<string, any>) {
    editor.focus();
    editor.updateBlock(editor.getTextCursorPosition().block, {
      type: type as any,
      props,
    });
    setOpen(false);
  }

  const items = [
    { label: "Heading 2", type: "heading", props: { level: 2 }, match: activeBlock === "heading" },
    { label: "Heading 3", type: "heading", props: { level: 3 }, match: activeBlock === "heading" },
    { label: "Bullet list", type: "bulletListItem", match: activeBlock === "bulletListItem" },
    { label: "Numbered list", type: "numberedListItem", match: activeBlock === "numberedListItem" },
    { label: "Quote", type: "quote", match: activeBlock === "quote" },
    { label: "Paragraph", type: "paragraph", match: activeBlock === "paragraph" },
  ];

  return (
    <div className="bear-more-wrap" ref={ref}>
      <button
        type="button"
        className={`bear-more-btn${open ? " bear-more-btn--open" : ""}`}
        onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }}
        aria-label="More formatting"
        title="More formatting"
      >
        ⋯
      </button>
      {open && (
        <div className="bear-more-dropdown" onPointerDown={(e) => e.stopPropagation()}>
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
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main editor ────────────────────────────────────────────────────────── */

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
        sideMenu={false}
        formattingToolbar={false}
      >
        {/* Bear-style formatting toolbar: B / I / U / Link / ⋯ */}
        <FormattingToolbarController
          formattingToolbar={() => (
            <FormattingToolbar>
              <BasicTextStyleButton key="bold" basicTextStyle="bold" />
              <BasicTextStyleButton key="italic" basicTextStyle="italic" />
              <BasicTextStyleButton key="underline" basicTextStyle="underline" />
              <CreateLinkButton key="link" />
              <MoreMenuButton key="more" />
            </FormattingToolbar>
          )}
        />
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={getSlashMenuItems}
        />
      </BlockNoteView>
    </div>
  );
}
