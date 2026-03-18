"use client";

/**
 * LessonNoteEditor — private per-lesson note for the authenticated member.
 * Uses FormattedEditor (Tiptap JSON). Auto-saves 2s after the last keystroke.
 * CSS prefix: lp-
 */

import { useState, useEffect, useRef, useCallback } from "react";
import FormattedEditor from "@/components/FormattedEditor";

interface Props {
  lessonSlug: string;
  initialBody: any; // Tiptap JSON or null
}

type SaveState = "idle" | "saving" | "saved" | "error";

export default function LessonNoteEditor({ lessonSlug, initialBody }: Props) {
  const [body, setBody] = useState<any>(initialBody);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [expanded, setExpanded] = useState(!!initialBody);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (value: any) => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/lessons/${lessonSlug}/note`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: value }),
      });
      setSaveState(res.ok ? "saved" : "error");
      if (res.ok) setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
    }
  }, [lessonSlug]);

  function handleChange(value: any) {
    setBody(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => save(value), 2000);
  }

  // Cleanup timer on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!expanded) {
    return (
      <div className="lp-notes-collapsed">
        <button
          type="button"
          className="lp-notes-toggle"
          onClick={() => setExpanded(true)}
        >
          + Add a personal note
        </button>
      </div>
    );
  }

  return (
    <div className="lp-notes">
      <div className="lp-notes__header">
        <p className="lp-notes__label">Your Notes</p>
        <span className="lp-notes__save-state">
          {saveState === "saving" && "Saving…"}
          {saveState === "saved"  && "Saved"}
          {saveState === "error"  && "Save failed"}
        </span>
      </div>
      <FormattedEditor
        value={body}
        onChange={handleChange}
        placeholder="Your thoughts, questions, or intentions from this lesson…"
        minHeight={120}
      />
    </div>
  );
}
