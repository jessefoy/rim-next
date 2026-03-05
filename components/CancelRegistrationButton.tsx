"use client";

import { useState } from "react";

interface Props {
  id: string;
  programTitle: string;
}

type Step = "idle" | "confirming" | "loading" | "done";

export default function CancelRegistrationButton({ id, programTitle }: Props) {
  const [step, setStep] = useState<Step>("idle");

  async function handleConfirm() {
    setStep("loading");
    try {
      const res = await fetch(`/api/account/registrations/${id}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
        alert(`Could not cancel: ${error}`);
        setStep("confirming");
        return;
      }
      setStep("done");
    } catch {
      alert("Something went wrong. Please try again.");
      setStep("confirming");
    }
  }

  if (step === "done") {
    return <p className="mr-cancel-done">✓ Registration cancelled</p>;
  }

  if (step === "confirming") {
    return (
      <div className="mr-cancel-confirm">
        <p className="mr-cancel-confirm__text">
          Cancel your spot in <strong>{programTitle}</strong>? This cannot be undone.
        </p>
        <div className="mr-cancel-confirm__actions">
          <button
            className="mr-cancel-btn--yes"
            onClick={handleConfirm}
          >
            Yes, cancel my spot
          </button>
          <button
            className="mr-cancel-btn--keep"
            onClick={() => setStep("idle")}
          >
            Keep my spot
          </button>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return <p className="mr-cancel-done">Cancelling…</p>;
  }

  // idle
  return (
    <button
      className="mr-cancel-btn"
      onClick={() => setStep("confirming")}
    >
      Cancel registration
    </button>
  );
}
