"use client";

/**
 * RimProseEditor — lightweight prose editor for notes, messages, and short fields.
 * Replaces FormattedEditor. Restricted to paragraph, bullet/numbered lists, and quotes.
 * No headings, no custom blocks, no slash menu.
 *
 * Props:
 *   minimal  — when true, shows only Bold + Italic + Link in the formatting toolbar
 *
 * Stores content as BlockNote JSON (array of blocks).
 */

import "@blocknote/mantine/style.css";
import { useCreateBlockNote } from "@blocknote/react";
import {
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
  minimal?: boolean;    // strips toolbar to Bold + Italic + Link only
}

export default function RimProseEditor({
  value,
  onChange,
  minHeight = 160,
  minimal = false,
}: Props) {
  const editor = useCreateBlockNote(
    {
      schema: rimProseSchema,
      initialContent: Array.isArray(value) && value.length > 0 ? value : undefined,
    },
    []
  );

  if (minimal) {
    return (
      <div className="rim-prose-editor" style={{ minHeight }}>
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

  return (
    <div className="rim-prose-editor" style={{ minHeight }}>
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
