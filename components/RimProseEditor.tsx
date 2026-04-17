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
