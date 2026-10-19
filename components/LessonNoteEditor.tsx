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
  // Words typed but not yet sent; null once they're on their way.
  const pendingRef = useRef<string | null>(null);

  function save(value: string, keepalive = false) {
    const payload = JSON.stringify({ body: value });
    fetch(`/api/lessons/${lessonSlug}/note`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: payload,
      // keepalive lets the save finish as the page closes; browsers refuse it
      // above 64 KB, so a very long note goes as an ordinary request.
      keepalive: keepalive && new Blob([payload]).size < 60000, // bytes, the keepalive limit
    })
      .then((res) => {
        // A newer edit is waiting: its own save will answer.
        if (pendingRef.current === null) setStatus(res.ok ? "saved" : "error");
      })
      .catch(() => {
        if (pendingRef.current === null) setStatus("error");
      });
  }

  // Leaving the lesson, closing the tab or switching away while a save is
  // still waiting: send it now, so the last few seconds of writing are kept.
  useEffect(() => {
    function flush() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = null;
      const value = pendingRef.current;
      if (value === null) return;
      pendingRef.current = null;
      save(value, true);
    }
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonSlug]);

  function handleChange(value: string) {
    setBody(value);
    setStatus("saving");
    pendingRef.current = value;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      pendingRef.current = null;
      save(value);
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
