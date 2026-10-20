"use client";

/**
 * How team news reaches someone by email (2026-10-20). Everything is always
 * in Notifications; this decides only the email for team news (a
 * conversation, a file, a session that needs someone). Emails about the
 * person themselves (their sessions, registrations, account) always come.
 * Answered beside the button (SaveNote), like the rest of My Profile.
 */

import { useActionState, useState } from "react";
import { SaveNote } from "@/components/FormDone";
import type { TeamEmailMode } from "@/lib/notifications";

export type EmailChoiceState = { status: "idle" | "saved" | "error" };

const CHOICES: { value: TeamEmailMode; label: string; hint: string }[] = [
  { value: "each", label: "Email me each one", hint: "As it happens, as now." },
  { value: "summary", label: "One email a day", hint: "A short summary each morning of what's new on your teams." },
  { value: "none", label: "Don't email me team news", hint: "I'll check Notifications here." },
];

export default function EmailChoiceForm({
  action,
  initial,
}: {
  action: (prev: EmailChoiceState, formData: FormData) => Promise<EmailChoiceState>;
  initial: TeamEmailMode;
}) {
  const [state, formAction, pending] = useActionState<EmailChoiceState, FormData>(action, { status: "idle" });
  const [choice, setChoice] = useState<TeamEmailMode>(initial);
  const [edited, setEdited] = useState(false);
  const shown = edited ? "idle" : state.status;

  return (
    <form action={formAction} onSubmit={() => setEdited(false)} className="mp-form">
      <fieldset className="mp-choices">
        <legend className="mp-label">Email about your teams</legend>
        {CHOICES.map((c) => (
          <label key={c.value} className="mp-choice">
            <input
              type="radio"
              name="teamEmailMode"
              value={c.value}
              checked={choice === c.value}
              onChange={() => {
                setChoice(c.value);
                setEdited(true);
              }}
            />
            <span>
              <span className="mp-choice__label">{c.label}</span>
              <span className="mp-choice__hint">{c.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <p className="mp-note">Emails about you, your sessions, your registrations and your account always come.</p>
      <div className="mp-save">
        <button type="submit" className="mp-submit" disabled={pending}>
          {pending ? "Saving…" : "Save email choice"}
        </button>
        <SaveNote
          status={pending ? "saving" : shown}
          saved="Saved. We'll email you that way from now on."
          problem="Something went wrong, and your choice was not saved. Please try again."
        />
      </div>
    </form>
  );
}
