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

type SaveStatus = "idle" | "saving" | "saved";

export default function LessonNoteEditor({ lessonSlug, initialBody }: Props) {
  const [body, setBody] = useState<string>(() => {
    if (isHtmlString(initialBody)) return initialBody;
    return renderBlockNoteHtml(initialBody) || "";
  });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
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
        if (res.ok) {
          setStatus("saved");
          if (fadeRef.current) clearTimeout(fadeRef.current);
          fadeRef.current = setTimeout(() => setStatus("idle"), 3000);
        } else {
          setStatus("idle");
        }
      } catch {
        setStatus("idle");
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
      {status !== "idle" && (
        <p className={`ls-note-status${status === "saved" ? " ls-note-status--saved" : ""}`}>
          {status === "saving" ? "Saving…" : "Saved"}
        </p>
      )}
    </div>
  );
}
