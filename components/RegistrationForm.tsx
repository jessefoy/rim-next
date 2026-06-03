"use client";

import { useState } from "react";
import {
  COMMUNITY_AGREEMENTS,
  COMMUNITY_AGREEMENTS_LEAD_IN,
  COMMUNITY_AGREEMENTS_CHECKBOX_LABEL,
} from "@/lib/communityAgreements";

// Auto-formats digits into (XXX) XXX-XXXX as the user types
function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export interface RegistrationField {
  _key: string;
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required: boolean;
  options?: string[];
}

interface Props {
  program: {
    _id: string;
    slug: { current: string };
    name: string;
    registrationCapacity?: number | null;
    // Dana fields (replaces suggestedDonation)
    danaMode?: string | null;        // "none" | "voluntary" | "base_plus_dana" | "fixed"
    suggestedDana?: number | null;   // pre-filled amount for voluntary / extra dana
    danaBaseAmount?: number | null;  // required base fee for base_plus_dana
    danaFixedAmount?: number | null; // set price for fixed mode
    danaMessageHtml?: string | null; // Pre-rendered HTML for the dana step message
    registrationFields?: RegistrationField[];
    dateText?: string | null;
    locationText?: string | null;
  };
  spotsRemaining: number | null;
  userProfile?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  sessionUserId?: string | null;
  alreadyRegistered?: boolean;
  // For members promoted from waitlist — show dana step immediately
  existingDonationStatus?: string | null;
  existingRegistrationId?: string | null;
  deadlinePassed?: boolean;
}

type FormState =
  | "idle"
  | "submitting"
  | "waitlisted"
  | "dana"             // registration confirmed, dana step shown
  | "dana_redirecting" // checkout session created, about to redirect
  | "done"             // all complete (no dana needed or dana skipped)
  | "error"
  | "duplicate";

export default function RegistrationForm({
  program,
  spotsRemaining,
  userProfile,
  sessionUserId,
  alreadyRegistered,
  existingDonationStatus,
  existingRegistrationId,
  deadlinePassed,
}: Props) {
  // If the member was promoted from waitlist, show the dana step immediately
  const hasPendingDana = alreadyRegistered && existingDonationStatus === "PENDING";

  const [form, setForm] = useState({
    firstName: userProfile?.firstName ?? "",
    lastName: userProfile?.lastName ?? "",
    email: userProfile?.email ?? "",
    phone: userProfile?.phone ?? "",
  });
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState<FormState>(hasPendingDana ? "dana" : "idle");
  const [errorMessage, setErrorMessage] = useState("");
  // Non-logged-in users must agree to community terms before registering
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Email recognition — pre-fill returning members' info on blur
  const [emailCheckStatus, setEmailCheckStatus] = useState<"idle" | "checking" | "found" | "not_found">("idle");
  const [foundMember, setFoundMember] = useState<{
    firstName: string; lastName: string; phone: string; agreedToTerms: boolean;
  } | null>(null);

  // Dana state — pre-populate registrationId for promoted waitlist members
  const [registrationId, setRegistrationId] = useState<string | null>(
    hasPendingDana ? (existingRegistrationId ?? null) : null
  );
  const [danaInput, setDanaInput] = useState<string>(
    String(program.suggestedDana ?? "")
  );

  // ── Already registered (and NOT in pending-dana state) ───────────────────────
  if (alreadyRegistered && !hasPendingDana) {
    return (
      <p className="pg-form__already">
        ✓ You&rsquo;re already registered for this program.
      </p>
    );
  }

  // ── Deadline passed ─────────────────────────────────────────────────────────
  if (deadlinePassed) {
    return (
      <p className="pg-form__already">
        Registration for this program has closed.
      </p>
    );
  }

  // ── Waitlisted ──────────────────────────────────────────────────────────────
  if (formState === "waitlisted") {
    return (
      <div className="pg-form__success pg-form__success--waitlist">
        <h3>You&rsquo;re on the waitlist</h3>
        <p>
          This program is currently full. We&rsquo;ll reach out to {form.email} if a spot opens up.
        </p>
      </div>
    );
  }

  // ── Done (no dana needed, or dana skipped) ──────────────────────────────────
  if (formState === "done") {
    return (
      <div className="pg-form__success">
        <h3>You&rsquo;re registered!</h3>
        <p>We&rsquo;ll look forward to seeing you. A confirmation will be sent to {form.email}.</p>
      </div>
    );
  }

  // ── Dana step ───────────────────────────────────────────────────────────────
  if (formState === "dana" || formState === "dana_redirecting") {
    const danaMode = program.danaMode ?? "voluntary";
    const isFixed = danaMode === "fixed";
    const isBasePlusDana = danaMode === "base_plus_dana";
    const baseAmount = program.danaBaseAmount ?? 0;
    const fixedAmount = program.danaFixedAmount ?? 0;
    const extraDana = Math.max(0, parseFloat(danaInput) || 0);

    // Total amount in dollars
    const totalDollars = isFixed
      ? fixedAmount
      : isBasePlusDana
      ? baseAmount + extraDana
      : extraDana; // voluntary

    const totalCents = Math.round(totalDollars * 100);
    const canSubmit = totalCents >= 100; // Stripe minimum $1.00

    const handleDanaCheckout = async () => {
      if (!registrationId || totalCents < 100) return;
      setFormState("dana_redirecting");
      setErrorMessage("");

      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            registrationId,
            amountCents: totalCents,
            programTitle: program.name,
            programSlug: program.slug.current,
            donorName: `${form.firstName} ${form.lastName}`.trim(),
            donorEmail: form.email,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) {
          setErrorMessage(data.error ?? "Could not start checkout. Please try again.");
          setFormState("dana");
          return;
        }
        window.location.href = data.url;
      } catch {
        setErrorMessage("Network error. Please check your connection and try again.");
        setFormState("dana");
      }
    };

    const handleSkipDana = async () => {
      setErrorMessage("");
      // Completing the registration without a gift. The decline endpoint marks
      // dana WAIVED and sends the confirmation — so the "you're registered"
      // moment lands here, after the choice. Non-blocking on failure: they're
      // registered regardless, and the cleanup sweep finalizes a stale row.
      if (registrationId) {
        try {
          await fetch(`/api/registrations/${registrationId}/decline-dana`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email }),
          });
        } catch {
          // swallow — landing on "done" matters more than the email round-trip
        }
      }
      setFormState("done");
    };

    return (
      <>
        <div className="pg-form__success">
          {hasPendingDana ? (
            <>
              <h3>Your spot is confirmed!</h3>
              <p>
                A spot opened up and you&rsquo;ve been confirmed for this program.
                Complete your dana offering below when you&rsquo;re ready.
              </p>
            </>
          ) : isFixed || isBasePlusDana ? (
            <>
              <h3>One more step</h3>
              <p>
                Complete your registration for {program.name} with your
                contribution below — your place is confirmed once your payment
                goes through.
              </p>
            </>
          ) : (
            <>
              <h3>One more step</h3>
              <p>
                Your place is reserved. Make your dana offering below, or choose
                &ldquo;I&rsquo;m not donating at this time&rdquo; — either one
                completes your registration.
              </p>
            </>
          )}
        </div>

        <div className="pg-dana">
          <p className="pg-dana__eyebrow">Dana</p>
          {program.danaMessageHtml && (
            <div className="pg-dana__message man-body rim-content" dangerouslySetInnerHTML={{ __html: program.danaMessageHtml }} />
          )}

          {/* Fixed mode — single set price */}
          {isFixed && (
            <div className="pg-dana__field">
              <div className="pg-dana__fixed-amount">
                ${fixedAmount.toFixed(2)}
              </div>
            </div>
          )}

          {/* Base + Dana mode — fixed base fee, optional dana on top */}
          {isBasePlusDana && (
            <div className="pg-dana__breakdown">
              <div className="pg-dana__row">
                <span className="pg-dana__row-label">Program fee</span>
                <span className="pg-dana__row-value">${baseAmount.toFixed(2)}</span>
              </div>
              <div className="pg-dana__row">
                <label className="pg-dana__row-label" htmlFor="dana-extra">
                  Additional dana
                </label>
                <div className="pg-dana__input-wrap">
                  <span className="pg-dana__currency">$</span>
                  <input
                    id="dana-extra"
                    type="number"
                    className="pg-dana__input"
                    value={danaInput}
                    onChange={(e) => setDanaInput(e.target.value)}
                    min="0"
                    step="1"
                  />
                </div>
              </div>
              <div className="pg-dana__total">
                Total: ${totalDollars.toFixed(2)}
              </div>
            </div>
          )}

          {/* Voluntary mode — fully editable amount */}
          {danaMode === "voluntary" && (
            <div className="pg-dana__field">
              <label className="pg-dana__label" htmlFor="dana-amount">
                Your offering
              </label>
              <div className="pg-dana__input-wrap">
                <span className="pg-dana__currency">$</span>
                <input
                  id="dana-amount"
                  type="number"
                  className="pg-dana__input"
                  value={danaInput}
                  onChange={(e) => setDanaInput(e.target.value)}
                  min="1"
                  step="1"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="pg-form__error">{errorMessage}</div>
          )}

          <button
            type="button"
            className="pg-dana__btn"
            disabled={formState === "dana_redirecting" || !canSubmit}
            onClick={handleDanaCheckout}
          >
            {formState === "dana_redirecting"
              ? "Redirecting to checkout…"
              : `Continue — $${totalDollars.toFixed(2)}`}
          </button>

          {/* Skip option for voluntary mode only */}
          {danaMode === "voluntary" && (
            <button
              type="button"
              className="pg-dana__skip"
              onClick={handleSkipDana}
            >
              I&rsquo;m not donating at this time
            </button>
          )}
        </div>
      </>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  // On email blur: look up the address and pre-fill if it belongs to a known member.
  // Non-blocking — form works normally regardless of the outcome.
  const handleEmailBlur = async () => {
    if (sessionUserId || !form.email.includes("@")) return;
    setEmailCheckStatus("checking");
    try {
      const res = await fetch(`/api/account/check-email?email=${encodeURIComponent(form.email)}`);
      const data = await res.json();
      if (data.exists) {
        setFoundMember(data);
        // Account values win — corrects typos and restores the member's real name.
        // Fall back to what they typed only if the account has no value for that field.
        setForm((prev) => ({
          ...prev,
          firstName: data.firstName || prev.firstName,
          lastName: data.lastName || prev.lastName,
          phone: data.phone || prev.phone,
        }));
        if (data.agreedToTerms) setAgreedToTerms(true);
        setEmailCheckStatus("found");
      } else {
        setFoundMember(null);
        setEmailCheckStatus("not_found");
      }
    } catch {
      setEmailCheckStatus("idle"); // fail silently — form still works
    }
  };

  const handleField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCustom = (label: string, value: string) => {
    setCustomAnswers((prev) => ({ ...prev, [label]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("submitting");
    setErrorMessage("");

    // Build customFields payload — only include fields with answers
    const customFields: Record<string, string> = {};
    for (const [k, v] of Object.entries(customAnswers)) {
      if (v.trim()) customFields[k] = v.trim();
    }

    try {
      // The server derives the dana shape (none / voluntary / required-payment)
      // from the program record itself — the client doesn't send it, and can't
      // influence whether payment is required. Capacity, date, and location are
      // likewise resolved server-side. We send only identity + answers.
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: program._id,
          programSlug: program.slug.current,
          programTitle: program.name,
          userId: sessionUserId ?? undefined,
          // Logged-in members already agreed; guests agree via checkbox on this form
          agreedToTerms: sessionUserId ? true : agreedToTerms,
          ...form,
          customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
        }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setFormState("duplicate");
        return;
      }
      if (!res.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setFormState("error");
        return;
      }

      if (data.status === "WAITLISTED") {
        setFormState("waitlisted");
        return;
      }

      // Registration confirmed — check if dana step is needed.
      // Skip if: no mode, mode is "none", or fixed mode with no amount configured.
      setRegistrationId(data.registrationId ?? null);

      const hasConfiguredAmount =
        program.danaMode === "fixed"
          ? (program.danaFixedAmount ?? 0) > 0
          : program.danaMode === "base_plus_dana"
          ? (program.danaBaseAmount ?? 0) > 0
          : true; // voluntary always shows

      const shouldShowDana =
        data.registrationId &&
        program.danaMode &&
        program.danaMode !== "none" &&
        hasConfiguredAmount;

      if (shouldShowDana) {
        setDanaInput(String(program.suggestedDana ?? ""));
        setFormState("dana");
      } else {
        setFormState("done");
      }
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setFormState("error");
    }
  };

  // ── Capacity messaging ──────────────────────────────────────────────────────
  const isFull = spotsRemaining !== null && spotsRemaining === 0;
  const almostFull = spotsRemaining !== null && spotsRemaining > 0 && spotsRemaining <= 5;

  return (
    <form className="pg-form" onSubmit={handleSubmit} noValidate>

      {/* Capacity notices */}
      {isFull && (
        <div className="pg-form__waitlist-notice">
          <strong>This program is full.</strong> You can still submit below to join the waitlist —
          we&rsquo;ll contact you if a spot opens.
        </div>
      )}
      {almostFull && (
        <div className="pg-form__warning">
          Only <strong>{spotsRemaining} {spotsRemaining === 1 ? "spot" : "spots"}</strong> remaining!
        </div>
      )}

      {/* ── Standard fields ── */}
      <div className="pg-form__row">
        <div className="pg-form__field">
          <label className="pg-form__label" htmlFor="reg-firstName">
            First Name <span className="pg-form__required">*</span>
          </label>
          <input
            id="reg-firstName"
            name="firstName"
            type="text"
            className={`pg-form__input${emailCheckStatus === "found" ? " pg-form__input--locked" : ""}`}
            value={form.firstName}
            onChange={handleField}
            required
            autoComplete="given-name"
            readOnly={emailCheckStatus === "found"}
          />
        </div>
        <div className="pg-form__field">
          <label className="pg-form__label" htmlFor="reg-lastName">
            Last Name <span className="pg-form__required">*</span>
          </label>
          <input
            id="reg-lastName"
            name="lastName"
            type="text"
            className={`pg-form__input${emailCheckStatus === "found" ? " pg-form__input--locked" : ""}`}
            value={form.lastName}
            onChange={handleField}
            required
            autoComplete="family-name"
            readOnly={emailCheckStatus === "found"}
          />
        </div>
      </div>

      <div className="pg-form__field">
        <label className="pg-form__label" htmlFor="reg-email">
          Email <span className="pg-form__required">*</span>
        </label>
        <input
          id="reg-email"
          name="email"
          type="email"
          className="pg-form__input"
          value={form.email}
          onChange={(e) => {
            handleField(e);
            // Reset recognition state when email changes
            if (emailCheckStatus !== "idle") {
              setEmailCheckStatus("idle");
              setFoundMember(null);
            }
          }}
          onBlur={handleEmailBlur}
          required
          autoComplete="email"
          readOnly={!!sessionUserId}
        />
        {!sessionUserId && emailCheckStatus === "found" && foundMember && (
          <p className="pg-form__email-found">
            Welcome back, <strong>{foundMember.firstName} {foundMember.lastName}</strong>! Your registration will be linked to your account.
          </p>
        )}
      </div>

      <div className="pg-form__field">
        <label className="pg-form__label" htmlFor="reg-phone">
          Phone
        </label>
        <input
          id="reg-phone"
          name="phone"
          type="tel"
          className={`pg-form__input${emailCheckStatus === "found" ? " pg-form__input--locked" : ""}`}
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
          }
          placeholder="(414) 555-0100"
          autoComplete="tel"
          readOnly={emailCheckStatus === "found"}
        />
      </div>

      {/* ── Dynamic custom fields ── */}
      {program.registrationFields?.map((field) => (
        <div key={field._key} className="pg-form__field">
          <label className="pg-form__label" htmlFor={`reg-custom-${field._key}`}>
            {field.label}
            {field.required && <span className="pg-form__required"> *</span>}
          </label>

          {field.fieldType === "shortText" && (
            <input
              id={`reg-custom-${field._key}`}
              type="text"
              className="pg-form__input"
              value={customAnswers[field.label] ?? ""}
              onChange={(e) => handleCustom(field.label, e.target.value)}
              required={field.required}
            />
          )}

          {field.fieldType === "longText" && (
            <textarea
              id={`reg-custom-${field._key}`}
              className="pg-form__textarea"
              value={customAnswers[field.label] ?? ""}
              onChange={(e) => handleCustom(field.label, e.target.value)}
              required={field.required}
            />
          )}

          {field.fieldType === "yesNo" && (
            <select
              id={`reg-custom-${field._key}`}
              className="pg-form__select"
              value={customAnswers[field.label] ?? ""}
              onChange={(e) => handleCustom(field.label, e.target.value)}
              required={field.required}
            >
              <option value="">— Select —</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          )}

          {field.fieldType === "select" && (
            <select
              id={`reg-custom-${field._key}`}
              className="pg-form__select"
              value={customAnswers[field.label] ?? ""}
              onChange={(e) => handleCustom(field.label, e.target.value)}
              required={field.required}
            >
              <option value="">— Select —</option>
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      {/* ── Community agreements — shown for non-logged-in registrants who haven't agreed yet ── */}
      {!sessionUserId && !(emailCheckStatus === "found" && foundMember?.agreedToTerms) && (
        <div className="pg-form__agreements">
          <h4 className="pg-form__agreements-heading">Community Care Agreements</h4>
          <p className="pg-form__agreements-text">{COMMUNITY_AGREEMENTS_LEAD_IN}</p>
          <ol className="pg-form__agreements-list">
            {COMMUNITY_AGREEMENTS.map((a) => (
              <li key={a.title} className="pg-form__agreements-item">
                <strong className="pg-form__agreements-title">{a.title}</strong>
                <span className="pg-form__agreements-summary">{a.summary}</span>
              </li>
            ))}
          </ol>
          <label className="pg-form__agreements-check">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              required
            />
            <span>{COMMUNITY_AGREEMENTS_CHECKBOX_LABEL}</span>
          </label>
        </div>
      )}

      {/* ── Error ── */}
      {formState === "error" && (
        <div className="pg-form__error">{errorMessage}</div>
      )}
      {formState === "duplicate" && (
        <div className="pg-form__error">
          It looks like you&rsquo;re already registered for this program.
        </div>
      )}

      <button
        type="submit"
        className="pg-form__submit"
        disabled={formState === "submitting" || (!sessionUserId && !agreedToTerms)}
      >
        {formState === "submitting"
          ? "Submitting…"
          : isFull
          ? "Join Waitlist"
          : "Register"}
      </button>
    </form>
  );
}
