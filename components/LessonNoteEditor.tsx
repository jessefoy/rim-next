"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";

const RimTiptapEditor = dynamic(
  () => import("@/components/rim-tiptap/RimTiptapEditor"),
  { ssr: false, loading: () => <div style={{ minHeight: 80 }} /> },
);

interface Props {
  lessonSlug: string;
  initialBody: unknown;
}

// The answer stays until the next keystroke, and a failed save says so: a
// member must never believe notes are kept when they aren't (2026-10-13).
type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function LessonNoteEditor({ lessonSlug, initialBody }: Props) {
  const [body, setBody] = useState<string>(() => {
    if (isHtmlString(initialBody)) return initialBody;
    return renderBlockNoteHtml(initialBody) || "";
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleChange(value: string) {
    setBody(value);
    setStatus("saving");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lessons/${lessonSlug}/note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: value }),
        });
        setStatus(res.ok ? "saved" : "error");
      } catch {
        setStatus("error");
      }
    }, 1500);
  }

  return (
    <div className="ls-notes-wrap">
      <p className="ls-notes-label">Your notes</p>
      <RimTiptapEditor
        value={body}
        onChange={handleChange}
        placeholder="Write anything that came up while reading or listening…"
        variant="message"
      />
      {status === "error" ? (
        <p className="save-note save-note--error" role="alert">
          Your latest notes were not saved. They are still here; keep writing and they will be
          saved again, or try again in a moment.
        </p>
      ) : (
        <p className={`ls-note-status${status === "saved" ? " ls-note-status--saved" : ""}`} role="status">
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved. Your notes are kept with this lesson." : ""}
        </p>
      )}
    </div>
  );
}
