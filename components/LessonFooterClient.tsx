"use client";

/**
 * LessonFooterClient — client-side wrapper for the enrolled-member lesson footer.
 *
 * Renders the reflection prompt, personal notes, and the Mark Complete button.
 *
 * CSS prefix: ls-
 */

import LessonNoteEditor from "@/components/LessonNoteEditor";
import MarkCompleteButton from "@/components/MarkCompleteButton";

interface Props {
  lessonSlug: string;
  courseSlug?: string;
  reflectionPrompt?: string | null;
  initialNoteBody: object | null;
  initialCompleted: boolean;
  courseCompletionNote?: string | null;
}

export default function LessonFooterClient({
  lessonSlug,
  courseSlug,
  reflectionPrompt,
  initialNoteBody,
  initialCompleted,
  courseCompletionNote,
}: Props) {
  return (
    <div className="ls-lesson-footer">
      {/* 1. Reflection prompt */}
      {reflectionPrompt && (
        <p className="ls-reflection">{reflectionPrompt}</p>
      )}

      {/* 2. Personal notes */}
      <LessonNoteEditor
        lessonSlug={lessonSlug}
        initialBody={initialNoteBody}
      />

      {/* 3. Mark complete */}
      <MarkCompleteButton
        lessonSlug={lessonSlug}
        courseSlug={courseSlug}
        initialCompleted={initialCompleted}
        courseCompletionNote={courseCompletionNote}
      />
    </div>
  );
}
