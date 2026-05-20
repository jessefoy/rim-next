"use client";

/**
 * SignInCodeForm — six-box code input for /login/check-email.
 *
 * Visual: six small boxes, one digit each, with a space between cells.
 *
 * Submission: a hidden `token` field is the actual form field (the visible
 * boxes are unnamed). The token field is **controlled** — its value is
 * derived from state on every render via `value={code}`, so the DOM value
 * cannot drift from React state and the form always submits the current
 * code. The form is a GET to /api/auth/callback/resend (same endpoint
 * magic-link clicks used to hit) — URL params end up as
 * ?token=123456&email=...&callbackUrl=...
 *
 * Submit is disabled until all six boxes are filled — prevents the empty-
 * token submission that NextAuth treats as a Configuration error rather
 * than a verification failure (which would be the surface for a wrong code).
 *
 * Paste & iOS autofill: both arrive as a single value >1 char into the
 * first input (or into any input, depending on browser). We detect any
 * value-length-greater-than-1 on input and treat it as a "distribute"
 * event — split the digits across the six boxes. autoComplete="one-time-code"
 * on the first box triggers iOS's QuickType code suggestion.
 *
 * Keyboard: auto-advance on input, backspace clears current and focuses
 * previous when current is already empty. Arrow keys move between boxes.
 */

import { useRef, useState } from "react";

const BOX_COUNT = 6;

interface Props {
  email: string;
  callbackUrl?: string;
}

export default function SignInCodeForm({ email, callbackUrl = "/account/dashboard" }: Props) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const [boxes, setBoxes] = useState<string[]>(() => Array(BOX_COUNT).fill(""));
  const code = boxes.join("");
  const isComplete = code.length === BOX_COUNT;

  function distribute(rawDigits: string) {
    const digits = rawDigits.replace(/\D/g, "").slice(0, BOX_COUNT);
    const next = Array(BOX_COUNT).fill("");
    for (let i = 0; i < digits.length; i++) next[i] = digits[i];
    setBoxes(next);
    // Focus the next empty box, or the last box if full.
    const focusIndex = Math.min(digits.length, BOX_COUNT - 1);
    inputRefs.current[focusIndex]?.focus();
    if (digits.length === BOX_COUNT) {
      inputRefs.current[focusIndex]?.select();
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, index: number) {
    const value = e.target.value;
    if (value.length > 1) {
      // Paste, autofill, or rapid two-key input — distribute across boxes.
      distribute(value);
      return;
    }
    if (value && !/\d/.test(value)) {
      // Reject non-digit single chars.
      const next = [...boxes];
      next[index] = "";
      setBoxes(next);
      return;
    }
    const next = [...boxes];
    next[index] = value;
    setBoxes(next);
    if (value && index < BOX_COUNT - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      if (boxes[index]) {
        // Default behavior clears the cell; we let it run.
        return;
      }
      // Empty cell + backspace = move to previous and clear it.
      if (index > 0) {
        e.preventDefault();
        const next = [...boxes];
        next[index - 1] = "";
        setBoxes(next);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      return;
    }
    if (e.key === "ArrowRight" && index < BOX_COUNT - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      return;
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    distribute(text);
  }

  return (
    <form
      method="GET"
      action="/api/auth/callback/resend"
      className="sic-form"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {/* Controlled hidden field — value re-derived from state on every render. */}
      <input type="hidden" name="token" value={code} readOnly />

      <label className="sic-form__label" htmlFor="sic-box-0">
        6-digit code
      </label>

      <div className="sic-boxes" role="group" aria-label="6-digit verification code">
        {boxes.map((value, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            id={`sic-box-${i}`}
            className="sic-box"
            type="text"
            inputMode="numeric"
            pattern="\d"
            maxLength={1}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1} of ${BOX_COUNT}`}
            value={value}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
          />
        ))}
      </div>

      <button
        type="submit"
        className="sic-form__submit"
        disabled={!isComplete}
        aria-disabled={!isComplete}
      >
        Sign in →
      </button>
    </form>
  );
}
