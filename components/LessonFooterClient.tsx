"use client";

/**
 * LessonFooterClient — client-side wrapper for the enrolled-member lesson footer.
 *
 * Holds allCorrect state so ReflectionQuestionsClient can unlock MarkCompleteButton
 * when questionsRequired = true.
 *
 * CSS prefix: ls-
 */

import { useState } from "react";
import ReflectionQuestionsClient, { QuestionWithResponse } from "@/components/ReflectionQuestionsClient";
import LessonNoteEditor from "@/components/LessonNoteEditor";
import MarkCompleteButton from "@/components/MarkCompleteButton";

interface Props {
  lessonSlug: string;
  courseSlug?: string;
  reflectionPrompt?: string | null;
  initialNoteBody: object | null;
  initialCompleted: boolean;
  courseCompletionNote?: string | null;
  questionsRequired: boolean;
  initialQuestions: QuestionWithResponse[];
  initialAllCorrect: boolean;
}

export default function LessonFooterClient({
  lessonSlug,
  courseSlug,
  reflectionPrompt,
  initialNoteBody,
  initialCompleted,
  courseCompletionNote,
  questionsRequired,
  initialQuestions,
  initialAllCorrect,
}: Props) {
  const [allCorrect, setAllCorrect] = useState(initialAllCorrect);

  // If questionsRequired and not all correct, Complete button is locked
  const completeLocked = questionsRequired && !allCorrect;

  return (
    <div className="ls-lesson-footer">
      {/* 1. Reflection prompt */}
      {reflectionPrompt && (
        <>
          <hr className="ls-reflection-rule" />
          <p className="ls-reflection">{reflectionPrompt}</p>
        </>
      )}

      {/* 2. Reflection questions */}
      {initialQuestions.length > 0 && (
        <>
          <hr className="ls-reflection-rule" />
          <ReflectionQuestionsClient
            lessonSlug={lessonSlug}
            questionsRequired={questionsRequired}
            initialQuestions={initialQuestions}
            initialAllCorrect={initialAllCorrect}
            onAllCorrect={() => setAllCorrect(true)}
          />
        </>
      )}

      {/* 3. Personal notes */}
      <LessonNoteEditor
        lessonSlug={lessonSlug}
        initialBody={initialNoteBody}
      />

      {/* 4. Mark complete — locked if questionsRequired and not all correct */}
      <MarkCompleteButton
        lessonSlug={lessonSlug}
        courseSlug={courseSlug}
        initialCompleted={initialCompleted}
        courseCompletionNote={courseCompletionNote}
        locked={completeLocked}
      />
    </div>
  );
}
