"use client";

/**
 * ReflectionQuestionsClient — member-facing reflection question UI.
 *
 * Displays multiple-choice questions for a lesson.
 * Members select an answer and submit per question. Feedback (correct/incorrect) appears inline.
 * Retakes always available (re-submission overwrites the previous answer).
 *
 * Props:
 *   - lessonSlug: string
 *   - questionsRequired: boolean — if true, all must be correct before Complete button activates
 *   - initialQuestions: question list with member's existing responses
 *   - initialAllCorrect: boolean — true if member has already answered all correctly
 *   - onAllCorrect: () => void — called when all questions are correct (enables Complete button)
 *
 * CSS prefix: ls-
 */

import { useState } from "react";

export interface QuestionOption {
  id: string;
  text: string;
  sortOrder: number;
}

export interface QuestionWithResponse {
  id: string;
  text: string;
  sortOrder: number;
  options: QuestionOption[];
  responseOptionId: string | null;
}

interface Props {
  lessonSlug: string;
  questionsRequired: boolean;
  initialQuestions: QuestionWithResponse[];
  initialAllCorrect: boolean;
  onAllCorrect?: () => void;
}

interface QuestionState {
  selectedOptionId: string | null;
  submittedOptionId: string | null;
  isCorrect: boolean | null;
  correctOptionId: string | null;
  submitting: boolean;
  error: string | null;
  showRetake: boolean;
}

function buildInitialState(
  questions: QuestionWithResponse[],
  correctMap: Map<string, string>
): Map<string, QuestionState> {
  const map = new Map<string, QuestionState>();
  for (const q of questions) {
    const responded = q.responseOptionId != null;
    const correctOptionId = correctMap.get(q.id) ?? null;
    const isCorrect = responded && correctOptionId != null
      ? q.responseOptionId === correctOptionId
      : null;
    map.set(q.id, {
      selectedOptionId: q.responseOptionId,
      submittedOptionId: q.responseOptionId,
      isCorrect: responded ? isCorrect : null,
      correctOptionId,
      submitting: false,
      error: null,
      showRetake: false,
    });
  }
  return map;
}

export default function ReflectionQuestionsClient({
  lessonSlug,
  questionsRequired,
  initialQuestions,
  initialAllCorrect,
  onAllCorrect,
}: Props) {
  // correctOptionId isn't available client-side until first submit — start null
  const [states, setStates] = useState<Map<string, QuestionState>>(() =>
    buildInitialState(initialQuestions, new Map())
  );
  const [allCorrect, setAllCorrect] = useState(initialAllCorrect);

  if (initialQuestions.length === 0) return null;

  function updateState(questionId: string, patch: Partial<QuestionState>) {
    setStates((prev) => {
      const next = new Map(prev);
      next.set(questionId, { ...prev.get(questionId)!, ...patch });
      return next;
    });
  }

  function checkAllCorrect(newStates: Map<string, QuestionState>): boolean {
    for (const q of initialQuestions) {
      const s = newStates.get(q.id);
      if (!s || s.isCorrect !== true) return false;
    }
    return true;
  }

  async function handleSubmit(questionId: string) {
    const s = states.get(questionId);
    if (!s || !s.selectedOptionId) return;

    updateState(questionId, { submitting: true, error: null });

    try {
      const res = await fetch(
        `/api/lessons/${lessonSlug}/questions/${questionId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId: s.selectedOptionId }),
        }
      );

      if (!res.ok) {
        const d = await res.json();
        updateState(questionId, { submitting: false, error: d.error || "Failed to save" });
        return;
      }

      const { isCorrect, correctOptionId } = await res.json() as {
        isCorrect: boolean;
        correctOptionId: string | null;
      };

      setStates((prev) => {
        const next = new Map(prev);
        next.set(questionId, {
          ...prev.get(questionId)!,
          submitting: false,
          submittedOptionId: s.selectedOptionId,
          isCorrect,
          correctOptionId,
          showRetake: false,
          error: null,
        });

        const nowAllCorrect = checkAllCorrect(next);
        if (nowAllCorrect && !allCorrect) {
          setAllCorrect(true);
          onAllCorrect?.();
        }
        return next;
      });
    } catch {
      updateState(questionId, { submitting: false, error: "Network error" });
    }
  }

  function handleRetake(questionId: string) {
    updateState(questionId, {
      showRetake: true,
      isCorrect: null,
      submittedOptionId: null,
      selectedOptionId: null,
      error: null,
    });
  }

  return (
    <div className="ls-questions">
      <div className="ls-questions__header">
        <h3 className="ls-questions__title">Reflection Questions</h3>
        <p className="ls-questions__privacy">
          Your answers are private — only you can see them.
        </p>
        {questionsRequired && !allCorrect && (
          <p className="ls-questions__gate-note">
            Answer all questions correctly to enable the Complete button.
          </p>
        )}
        {questionsRequired && allCorrect && (
          <p className="ls-questions__gate-done">
            ✓ All questions answered correctly — you may now mark this lesson complete.
          </p>
        )}
      </div>

      <div className="ls-questions__list">
        {initialQuestions.map((q, qi) => {
          const s = states.get(q.id)!;
          const answered = s.submittedOptionId != null && s.isCorrect !== null;
          const isRetaking = s.showRetake;

          return (
            <div
              key={q.id}
              className={`ls-question${answered && !isRetaking ? (s.isCorrect ? " ls-question--correct" : " ls-question--incorrect") : ""}`}
            >
              <p className="ls-question__text">
                <span className="ls-question__num">{qi + 1}.</span> {q.text}
              </p>

              {answered && !isRetaking ? (
                // Answered state
                <div className="ls-question__result">
                  <p className={`ls-question__feedback ${s.isCorrect ? "ls-question__feedback--correct" : "ls-question__feedback--incorrect"}`}>
                    {s.isCorrect ? "✓ Correct" : "✗ Not quite"}
                  </p>
                  <div className="ls-question__answered-options">
                    {q.options.map((opt) => {
                      const wasSelected = opt.id === s.submittedOptionId;
                      const isCorrectOpt = opt.id === s.correctOptionId;
                      return (
                        <div
                          key={opt.id}
                          className={`ls-option ls-option--result${wasSelected ? " ls-option--selected" : ""}${isCorrectOpt ? " ls-option--correct-ans" : ""}${wasSelected && !isCorrectOpt ? " ls-option--wrong-ans" : ""}`}
                        >
                          {opt.text}
                          {isCorrectOpt && <span className="ls-option__badge ls-option__badge--correct">Correct answer</span>}
                          {wasSelected && !isCorrectOpt && <span className="ls-option__badge ls-option__badge--yours">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="ls-btn--retake"
                    onClick={() => handleRetake(q.id)}
                  >
                    Try again
                  </button>
                </div>
              ) : (
                // Selection state
                <div className="ls-question__input">
                  <div className="ls-question__options">
                    {q.options.map((opt) => (
                      <label
                        key={opt.id}
                        className={`ls-option ls-option--selectable${s.selectedOptionId === opt.id ? " ls-option--active" : ""}`}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          value={opt.id}
                          checked={s.selectedOptionId === opt.id}
                          onChange={() => updateState(q.id, { selectedOptionId: opt.id })}
                          className="ls-option__radio"
                        />
                        {opt.text}
                      </label>
                    ))}
                  </div>
                  {s.error && <p className="ls-question__error">{s.error}</p>}
                  <button
                    type="button"
                    className="ls-btn--submit-answer"
                    onClick={() => handleSubmit(q.id)}
                    disabled={!s.selectedOptionId || s.submitting}
                  >
                    {s.submitting ? "Saving…" : "Submit"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!questionsRequired && (
        <p className="ls-questions__gentle-note">
          These questions are for your own reflection — they don&apos;t affect lesson completion.
        </p>
      )}
    </div>
  );
}
