"use client";

import { useState } from "react";
import type { RegistrationField } from "@/app/update/[token]/page";

interface Props {
  token: string;
  fields: RegistrationField[];
  currentCustomFields: Record<string, string>;
}

export default function UpdateForm({ token, fields, currentCustomFields }: Props) {
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(currentCustomFields);
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
      <div className="ur-success">
        <p>✓ Your responses have been updated. Thank you!</p>
        <p style={{ fontSize: "15px", marginTop: "12px", color: "var(--rim-text-muted)" }}>
          You can close this page.
        </p>
      </div>
    );
  }

  // Build the list of fields to display.
  // Fields from the program definition take precedence; any stored answers whose
  // label doesn't match a current field are appended as plain text inputs (edge
  // case: field was removed from the program after registration).
  const definedLabels = new Set(fields.map((f) => f.label));
  const orphanedLabels = Object.keys(currentCustomFields).filter((l) => !definedLabels.has(l));

  return (
    <form onSubmit={handleSubmit}>
      {/* Render defined fields */}
      {fields.map((field) => {
        const value = customAnswers[field.label] ?? "";
        const id = `field-${field._key}`;

        return (
          <div className="ur-field" key={field._key}>
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
                  setCustomAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))
                }
              />
            ) : field.fieldType === "yesNo" ? (
              <select
                id={id}
                className="ur-select"
                value={value}
                onChange={(e) =>
                  setCustomAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))
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
                  setCustomAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))
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
                  setCustomAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))
                }
              />
            )}
          </div>
        );
      })}

      {/* Render orphaned fields (labels no longer in program definition) */}
      {orphanedLabels.map((label) => (
        <div className="ur-field" key={label}>
          <label className="ur-label" htmlFor={`orphan-${label}`}>
            {label}
          </label>
          <input
            id={`orphan-${label}`}
            type="text"
            className="ur-input"
            value={customAnswers[label] ?? ""}
            onChange={(e) =>
              setCustomAnswers((prev) => ({ ...prev, [label]: e.target.value }))
            }
          />
        </div>
      ))}

      {error && (
        <p style={{ color: "#a83232", fontSize: "14px", marginBottom: "16px" }}>{error}</p>
      )}

      <button type="submit" className="ur-submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save My Responses"}
      </button>
    </form>
  );
}
