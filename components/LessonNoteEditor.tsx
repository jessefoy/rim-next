"use client";

import { useState, useRef, useEffect } from "react";
import RimProseEditor from "@/components/RimProseEditor";

interface Props {
  lessonSlug: string;
  initialBody: object | null;
}

type SaveStatus = "idle" | "saving" | "saved";

export default function LessonNoteEditor({ lessonSlug, initialBody }: Props) {
  const [body, setBody] = useState<object | null>(initialBody);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, []);

  function handleChange(value: object | null) {
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
      <RimProseEditor
        value={body}
        onChange={handleChange}
        placeholder="Write anything that came up while reading or listening…"
        variant="compact"
      />
      {status !== "idle" && (
        <p className={`ls-note-status${status === "saved" ? " ls-note-status--saved" : ""}`}>
          {status === "saving" ? "Saving…" : "Saved"}
        </p>
      )}
    </div>
  );
}
