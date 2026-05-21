"use client";

/**
 * EnrollDanaButton — Course self-enroll with dana.
 *
 * Renders inline on the /course/[slug] landing CTA slot when the
 * computed access state is `can_self_enroll_dana`. The UI adapts to
 * the course's danaMode (session 123, slice 5):
 *
 *   voluntary      → amount picker with suggestedDana highlighted as default
 *   base_plus_dana → picker with base enforced as minimum, "Base $X + your dana"
 *   fixed          → single "Enroll for $X →" button, no picker
 *
 * Click → POST /api/courses/[slug]/checkout with amountCents → redirect
 * to Stripe. The webhook (/api/stripe/webhook) creates the
 * SeriesEnrollment + Donation row + receipt email on payment success.
 */

import { useState } from "react";

interface Props {
  courseSlug: string;
  danaMode: "voluntary" | "base_plus_dana" | "fixed";
  suggestedDana?: number | null;
  danaBaseAmount?: number | null;
  danaFixedAmount?: number | null;
}

// Suggested chips for voluntary mode when no suggestedDana is set.
const DEFAULT_VOLUNTARY_CHIPS = [20, 50, 100];

export default function EnrollDanaButton({
  courseSlug,
  danaMode,
  suggestedDana,
  danaBaseAmount,
  danaFixedAmount,
}: Props) {
  // ALL hooks must be declared before any conditional return (rules-of-hooks).
  // The component dispatches on danaMode below the hook declarations.

  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voluntary / base_plus_dana picker state — declared up-top even though
  // they aren't used in the fixed-mode branch. State-set fns are stable
  // refs; idle declarations are cheap.
  const isBasePlusDana = danaMode === "base_plus_dana";
  const baseAmount =
    isBasePlusDana && danaBaseAmount && danaBaseAmount > 0 ? danaBaseAmount : 0;
  const defaultAmount =
    suggestedDana && suggestedDana > 0
      ? suggestedDana
      : isBasePlusDana
      ? baseAmount
      : DEFAULT_VOLUNTARY_CHIPS[1];

  const [selectedAmount, setSelectedAmount] = useState<number | "custom">(defaultAmount);
  const [customAmount, setCustomAmount] = useState("");

  // ── Fixed mode — one button, no picker ────────────────────────────────────
  if (danaMode === "fixed") {
    const fixedAmount = danaFixedAmount && danaFixedAmount > 0 ? danaFixedAmount : 0;
    const fixedCents = Math.round(fixedAmount * 100);
    const canSubmit = fixedCents >= 100;

    async function handleFixedCheckout() {
      if (!canSubmit || loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/courses/${courseSlug}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amountCents: fixedCents }),
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

    return (
      <div className="crs-enroll-wrap">
        <button
          type="button"
          className="crs-enroll-btn"
          onClick={handleFixedCheckout}
          disabled={!canSubmit || loading}
        >
          {loading
            ? "Opening checkout…"
            : canSubmit
            ? `Enroll for $${fixedAmount} →`
            : "Enroll →"}
        </button>
        {!canSubmit && (
          <p className="crs-enroll-note">
            This course is set to fixed-amount dana, but no amount has been configured yet.
            Contact us to enroll.
          </p>
        )}
        {error && <p className="crs-enroll-error" role="alert">{error}</p>}
      </div>
    );
  }

  // ── Voluntary / Base + Dana — amount picker ───────────────────────────────
  // (isBasePlusDana, baseAmount, defaultAmount declared above with the hooks.)

  const suggestedChips: number[] = (() => {
    // Build a sensible chip set:
    //  - Voluntary: include suggestedDana (if present) + DEFAULT_VOLUNTARY_CHIPS
    //  - Base + Dana: include base, base+suggested, base+suggested*2 (or sane fallbacks)
    if (isBasePlusDana) {
      const tip = suggestedDana && suggestedDana > 0 ? suggestedDana : 25;
      const chips = [baseAmount, baseAmount + tip, baseAmount + tip * 2].filter(
        (v) => v > 0
      );
      // Dedup
      return Array.from(new Set(chips));
    }
    const chips = new Set<number>(DEFAULT_VOLUNTARY_CHIPS);
    if (suggestedDana && suggestedDana > 0) chips.add(suggestedDana);
    return Array.from(chips).sort((a, b) => a - b);
  })();

  const effectiveDollars =
    selectedAmount === "custom"
      ? Math.max(0, parseFloat(customAmount) || 0)
      : selectedAmount;
  const amountCents = Math.round(effectiveDollars * 100);

  // Validation: $1 Stripe minimum; base for base_plus_dana mode.
  const minCents = Math.max(100, Math.round(baseAmount * 100));
  const canSubmit = amountCents >= minCents;

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
      <p className="crs-dana-form__label">
        {isBasePlusDana
          ? `Base $${baseAmount} — add more if you'd like:`
          : "Choose your dana offering:"}
      </p>
      <div className="crs-dana-form__amounts">
        {suggestedChips.map((amt) => (
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
            min={Math.max(1, baseAmount)}
            step="1"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={String(Math.max(1, baseAmount))}
            className="crs-dana-form__custom-input"
            autoFocus
          />
        </div>
      )}

      {isBasePlusDana && !canSubmit && (
        <p className="crs-enroll-note">
          Minimum is ${baseAmount}. Please choose an amount of ${baseAmount} or more.
        </p>
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
