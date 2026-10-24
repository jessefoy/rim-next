"use client";

import { useState } from "react";
import type { RegistrationField } from "@/app/update/[token]/page";
import FormDone from "@/components/FormDone";
import { questionKey } from "@/lib/registrationAnswers";

interface Props {
  token: string;
  fields: RegistrationField[];
  /** Their answers, by the question's id (or wording, before ids), and by
   *  their stored key for old answers no current question has. */
  initialAnswers: Record<string, string>;
  /** Old answers that match no current question: their stored key, and the
   *  question's wording when they answered it. */
  oldAnswers: { key: string; label: string }[];
}

export default function UpdateForm({ token, fields, initialAnswers, oldAnswers }: Props) {
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(initialAnswers);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/update/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: customAnswers }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <FormDone title="Thank you. Your answers have been saved.">
        <p>You don&rsquo;t need to do anything else. You can close this page.</p>
      </FormDone>
    );
  }

  // The program's questions first; then any old answers no current question
  // has (a question removed or reworded after they registered), as plain text.

  return (
    <form onSubmit={handleSubmit}>
      {/* Render defined fields */}
      {fields.map((field, fieldIndex) => {
        const key = questionKey(field);
        const value = customAnswers[key] ?? "";
        const id = `field-${field._key ?? `q${fieldIndex}`}`;

        return (
          <div className="ur-field" key={field._key ?? `q${fieldIndex}`}>
            <label className="ur-label" htmlFor={id}>
              {field.label}
              {field.required && <span aria-hidden="true"> *</span>}
            </label>

            {field.fieldType === "longText" ? (
              <textarea
                id={id}
                className="ur-textarea"
                value={value}
                onChange={(e) =>
                  setCustomAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            ) : field.fieldType === "yesNo" ? (
              <select
                id={id}
                className="ur-select"
                value={value}
                onChange={(e) =>
                  setCustomAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                }
              >
                <option value="">— select —</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            ) : field.fieldType === "select" && field.options?.length ? (
              <select
                id={id}
                className="ur-select"
                value={value}
                onChange={(e) =>
                  setCustomAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                }
              >
                <option value="">— select —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              /* shortText (default) */
              <input
                id={id}
                type="text"
                className="ur-input"
                value={value}
                onChange={(e) =>
                  setCustomAnswers((prev) => ({ ...prev, [key]: e.target.value }))
                }
              />
            )}
          </div>
        );
      })}

      {/* Render orphaned fields (labels no longer in program definition) */}
      {oldAnswers.map(({ key, label }) => (
        <div className="ur-field" key={key}>
          <label className="ur-label" htmlFor={`orphan-${key}`}>
            {label}
          </label>
          <input
            id={`orphan-${key}`}
            type="text"
            className="ur-input"
            value={customAnswers[key] ?? ""}
            onChange={(e) =>
              setCustomAnswers((prev) => ({ ...prev, [key]: e.target.value }))
            }
          />
        </div>
      ))}

      {error && (
        <p role="alert" style={{ color: "var(--color-error)", fontSize: "var(--text-ui)", marginBottom: "16px" }}>{error}</p>
      )}

      <button type="submit" className="ur-submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save My Responses"}
      </button>
    </form>
  );
}
