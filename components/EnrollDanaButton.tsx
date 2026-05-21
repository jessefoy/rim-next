"use client";

/**
 * EnrollDanaButton — Course self-enroll with dana.
 *
 * Renders inline on the /course/[slug] landing CTA slot when the
 * computed access state is `can_self_enroll_dana`. Click opens an
 * inline amount picker (suggested amounts + custom), then POSTs to
 * /api/courses/[slug]/checkout and redirects to Stripe.
 *
 * The webhook (/api/stripe/webhook) creates the SeriesEnrollment +
 * Donation row + receipt email on payment success.
 */

import { useState } from "react";

interface Props {
  courseSlug: string;
  // Optional suggested amounts. Defaults to $20/$50/$100. The user can
  // always type a custom amount.
  suggestedAmounts?: number[];
}

const DEFAULT_AMOUNTS = [20, 50, 100];

export default function EnrollDanaButton({
  courseSlug,
  suggestedAmounts = DEFAULT_AMOUNTS,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | "custom">(
    suggestedAmounts[1] ?? suggestedAmounts[0] ?? 50
  );
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveDollars =
    selectedAmount === "custom"
      ? Math.max(0, parseFloat(customAmount) || 0)
      : selectedAmount;
  const amountCents = Math.round(effectiveDollars * 100);
  const canSubmit = amountCents >= 100; // Stripe minimum $1.00

  async function handleCheckout() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseSlug}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data?.error ?? "Couldn't start checkout. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  if (!expanded) {
    return (
      <div className="crs-enroll-wrap">
        <button
          type="button"
          className="crs-enroll-btn"
          onClick={() => setExpanded(true)}
        >
          Enroll with dana →
        </button>
      </div>
    );
  }

  return (
    <div className="crs-dana-form" role="group" aria-label="Dana amount">
      <p className="crs-dana-form__label">Choose your dana offering:</p>
      <div className="crs-dana-form__amounts">
        {suggestedAmounts.map((amt) => (
          <button
            key={amt}
            type="button"
            className={`crs-dana-form__chip${
              selectedAmount === amt ? " crs-dana-form__chip--active" : ""
            }`}
            onClick={() => setSelectedAmount(amt)}
          >
            ${amt}
          </button>
        ))}
        <button
          type="button"
          className={`crs-dana-form__chip${
            selectedAmount === "custom" ? " crs-dana-form__chip--active" : ""
          }`}
          onClick={() => setSelectedAmount("custom")}
        >
          Other
        </button>
      </div>

      {selectedAmount === "custom" && (
        <div className="crs-dana-form__custom">
          <span className="crs-dana-form__currency">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder="0"
            className="crs-dana-form__custom-input"
            autoFocus
          />
        </div>
      )}

      <div className="crs-dana-form__actions">
        <button
          type="button"
          className="crs-enroll-btn"
          onClick={handleCheckout}
          disabled={!canSubmit || loading}
        >
          {loading
            ? "Opening checkout…"
            : `Continue with $${effectiveDollars || 0} →`}
        </button>
        <button
          type="button"
          className="crs-dana-form__cancel"
          onClick={() => {
            setExpanded(false);
            setError(null);
          }}
          disabled={loading}
        >
          Cancel
        </button>
      </div>

      {error && <p className="crs-enroll-error" role="alert">{error}</p>}

      <p className="crs-dana-form__note">
        You&rsquo;ll be redirected to a secure Stripe checkout page. You&rsquo;re
        enrolled the moment payment completes — no separate confirmation step.
      </p>
    </div>
  );
}
