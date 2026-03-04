"use client";

import { useState } from "react";

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
    danaMessage?: string | null;     // CMS-authored message for the dana step
    registrationFields?: RegistrationField[];
    dateText?: string | null;
    timeText?: string | null;
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

    const handleSkipDana = () => setFormState("done");

    return (
      <div className="pg-form__success">
        {hasPendingDana ? (
          <>
            <h3>Your spot is confirmed!</h3>
            <p>
              A spot opened up and you&rsquo;ve been confirmed for this program.
              Complete your dana offering below when you&rsquo;re ready.
            </p>
          </>
        ) : (
          <>
            <h3>You&rsquo;re registered!</h3>
            <p>A confirmation will be sent to {form.email}.</p>
          </>
        )}

        <div className="pg-dana">
          {program.danaMessage && (
            <p className="pg-dana__message">{program.danaMessage}</p>
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
            className="pg-form__submit"
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
              No thank you
            </button>
          )}
        </div>
      </div>
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
      const res = await fetch("/api/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: program._id,
          programSlug: program.slug.current,
          programTitle: program.name,
          registrationCapacity: program.registrationCapacity ?? null,
          danaMode: program.danaMode ?? "none",
          dateText: program.dateText ?? null,
          timeText: program.timeText ?? null,
          locationText: program.locationText ?? null,
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

      // Registration confirmed — check if dana step is needed
      setRegistrationId(data.registrationId ?? null);

      const shouldShowDana =
        data.registrationId &&
        program.danaMode &&
        program.danaMode !== "none";

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
            className="pg-form__input"
            value={form.firstName}
            onChange={handleField}
            required
            autoComplete="given-name"
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
            className="pg-form__input"
            value={form.lastName}
            onChange={handleField}
            required
            autoComplete="family-name"
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
            This email is on file for <strong>{foundMember.firstName} {foundMember.lastName}</strong> — we&rsquo;ve updated the name fields above. Edit if needed.
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
          className="pg-form__input"
          value={form.phone}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
          }
          placeholder="(414) 555-0100"
          autoComplete="tel"
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
          <p className="pg-form__agreements-text">
            Rooted In Mindfulness is an intentional community held by shared values of
            presence, care, and respect. We ask that everyone participate using their
            real name and engage with the same care they would bring to a sitting practice.
          </p>
          <details className="pg-form__agreements-details">
            <summary className="pg-form__agreements-summary">Read our community care agreements</summary>
            <div className="pg-form__agreements-body">
              <h4>1. Care for Yourself</h4>
              <p>Meditation and mindful living allow us to transform unhealthy patterns of the
              heart and mind, helping us realize authentic health, well-being, meaning, and
              happiness. While a community, teachers, and supportive friends can be powerful
              allies on the path of awakening, it is ultimately up to each of us to take the
              necessary steps along the journey.</p>
              <h4>2. Care for Others</h4>
              <p>The work of self-discovery and development can be challenging to undertake alone.
              Being part of a loving community where each member genuinely cares for one another&apos;s
              well-being offers a true refuge. Showing up and sharing an intentional space to learn
              and practice with friends is immeasurably beneficial for both ourselves and our shared world.</p>
              <h4>3. Care for RIM: Our Shared Refuge</h4>
              <p>RIM is co-created through the generosity, goodwill, and appreciation of its community.
              As a living expression of generosity, RIM is 100% community-funded and entirely dependent
              on donations. These cover all operating costs, contribute to teacher livelihoods, and
              maintain the building. RIM does not charge fixed fees — we ask that members contribute
              an ongoing amount (RIM Dana) that feels right to them.</p>
              <h4>4. Care for Our Shared Mission and Vision</h4>
              <p>RIM is a community refuge dedicated to learning and practicing the dharma, meditation,
              and mindful living. We do this to understand ourselves, others, and the world — aiming to
              free ourselves from unhealthy thoughts, words, and actions in order to realize a world
              where all beings live with great wisdom and great compassion.</p>
            </div>
          </details>
          <label className="pg-form__agreements-check">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              required
            />
            <span>I&apos;m entering this community in a spirit of care and respect.</span>
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
