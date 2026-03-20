"use client";

/**
 * ReflectionQuestionsClient — member-facing reflection question UI.
 *
 * Group submission model: member selects answers for all questions freely,
 * then submits once. Feedback appears on all questions simultaneously.
 * A single Retake link clears the entire set (server + client) and resets
 * to selection state.
 *
 * Props:
 *   - lessonSlug: string
 *   - questionsRequired: boolean — if true, all must be correct before Complete activates
 *   - initialQuestions: question list with member's existing responses
 *   - initialAllCorrect: boolean — true if member has already answered all correctly
 *   - onAllCorrect: () => void — called when all answers are submitted correctly
 *   - onRetake: () => void — called on retake (re-locks the Complete button)
 *
 * CSS prefix: ls-
 */

import { useState } from "react";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

export interface QuestionOption {
  id: string;
  text: string;
  sortOrder: number;
}

export interface QuestionWithResponse {
  id: string;
  body: unknown;
  bodyHtml: string;
  sortOrder: number;
  options: QuestionOption[];
  responseOptionId: string | null;
}

interface QuestionResult {
  isCorrect: boolean;
  correctOptionId: string | null;
}

interface Props {
  lessonSlug: string;
  questionsRequired: boolean;
  initialQuestions: QuestionWithResponse[];
  initialAllCorrect: boolean;
  onAllCorrect?: () => void;
  onRetake?: () => void;
}

export default function ReflectionQuestionsClient({
  lessonSlug,
  questionsRequired,
  initialQuestions,
  initialAllCorrect,
  onAllCorrect,
  onRetake,
}: Props) {
  // Always start unselected — responseOptionId is only used for initialAllCorrect, not for pre-filling UI
  const [selections, setSelections] = useState<Map<string, string | null>>(() => {
    const m = new Map<string, string | null>();
    for (const q of initialQuestions) m.set(q.id, null);
    return m;
  });

  // null = not yet submitted in this session; Map = submitted, holds per-question results
  const [results, setResults] = useState<Map<string, QuestionResult> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [allCorrect, setAllCorrect] = useState(initialAllCorrect);

  if (initialQuestions.length === 0) return null;

  const hasSubmitted = results !== null;
  const allSelected = initialQuestions.every((q) => selections.get(q.id) != null);

  async function handleSubmitAll() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const responses = await Promise.all(
        initialQuestions.map(async (q) => {
          const optionId = selections.get(q.id)!;
          const res = await fetch(
            `/api/lessons/${lessonSlug}/questions/${q.id}/respond`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ optionId }),
            }
          );
          if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || "Failed to save answer");
          }
          const data = (await res.json()) as QuestionResult;
          return { questionId: q.id, ...data };
        })
      );

      const newResults = new Map<string, QuestionResult>(
        responses.map((r) => [
          r.questionId,
          { isCorrect: r.isCorrect, correctOptionId: r.correctOptionId },
        ])
      );
      setResults(newResults);

      const nowAllCorrect = responses.every((r) => r.isCorrect);
      setAllCorrect(nowAllCorrect);
      if (nowAllCorrect) onAllCorrect?.();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetake() {
    setRetaking(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/lessons/${lessonSlug}/questions/responses`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to clear answers");
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to clear answers");
      setRetaking(false);
      return;
    }

    // Reset all client state
    const cleared = new Map<string, string | null>();
    for (const q of initialQuestions) cleared.set(q.id, null);
    setSelections(cleared);
    setResults(null);
    setAllCorrect(false);
    onRetake?.();
    setRetaking(false);
  }

  return (
    <div className="ls-questions">
      <div className="ls-questions__header">
        <h3 className="ls-questions__title">Reflection Questions</h3>
        <p className="ls-questions__privacy">
          Your answers are private — only you can see them.
        </p>
        {questionsRequired && allCorrect && (
          <p className="ls-questions__gate-done">
            ✓ All questions answered correctly — you may now mark this lesson complete.
          </p>
        )}
      </div>

      <div className="ls-questions__list">
        {initialQuestions.map((q, qi) => {
          const selectedId = selections.get(q.id) ?? null;
          const result = results?.get(q.id) ?? null;
          const answered = hasSubmitted && result !== null;

          return (
            <div
              key={q.id}
              className={`ls-question${
                answered
                  ? result.isCorrect
                    ? " ls-question--correct"
                    : " ls-question--incorrect"
                  : ""
              }`}
            >
              <div className="ls-question__text">
                <span className="ls-question__num">{qi + 1}.</span>
                <span dangerouslySetInnerHTML={{ __html: q.bodyHtml || renderBlockNoteHtml(q.body) }} />
              </div>

              {answered ? (
                // Post-submit: feedback + highlighted options
                <div className="ls-question__result">
                  <p
                    className={`ls-question__feedback ${
                      result.isCorrect
                        ? "ls-question__feedback--correct"
                        : "ls-question__feedback--incorrect"
                    }`}
                  >
                    {result.isCorrect ? "✓ Correct" : "✗ Not quite"}
                  </p>
                  <div className="ls-question__answered-options">
                    {q.options.map((opt) => {
                      const wasSelected = opt.id === selectedId;
                      const isCorrectOpt = opt.id === result.correctOptionId;
                      return (
                        <div
                          key={opt.id}
                          className={`ls-option ls-option--result${
                            wasSelected ? " ls-option--selected" : ""
                          }${isCorrectOpt ? " ls-option--correct-ans" : ""}${
                            wasSelected && !isCorrectOpt
                              ? " ls-option--wrong-ans"
                              : ""
                          }`}
                        >
                          {opt.text}
                          {isCorrectOpt && (
                            <span className="ls-option__badge ls-option__badge--correct">
                              Correct answer
                            </span>
                          )}
                          {wasSelected && !isCorrectOpt && (
                            <span className="ls-option__badge ls-option__badge--yours">
                              Your answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Pre-submit: radio selection
                <div className="ls-question__options">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`ls-option ls-option--selectable${
                        selectedId === opt.id ? " ls-option--active" : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        value={opt.id}
                        checked={selectedId === opt.id}
                        onChange={() =>
                          setSelections((prev) => {
                            const next = new Map(prev);
                            next.set(q.id, opt.id);
                            return next;
                          })
                        }
                        className="ls-option__radio"
                      />
                      {opt.text}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ls-questions__actions">
        {!hasSubmitted ? (
          <button
            type="button"
            className="ls-btn--submit-all"
            onClick={handleSubmitAll}
            disabled={!allSelected || submitting}
          >
            {submitting ? "Submitting…" : "Submit answers."}
          </button>
        ) : (
          <button
            type="button"
            className="ls-btn--retake-all"
            onClick={handleRetake}
            disabled={retaking}
          >
            {retaking ? "Clearing…" : "Retake reflection questions."}
          </button>
        )}
        {submitError && <p className="ls-question__error">{submitError}</p>}
      </div>

      {!questionsRequired && (
        <p className="ls-questions__gentle-note">
          These questions are for your own reflection — they don&apos;t affect lesson
          completion.
        </p>
      )}
    </div>
  );
}
