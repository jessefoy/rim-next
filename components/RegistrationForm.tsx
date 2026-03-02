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
    suggestedDonation?: number | null;
    registrationFields?: RegistrationField[];
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
  deadlinePassed?: boolean;
}

type FormState = "idle" | "submitting" | "registered" | "waitlisted" | "error" | "duplicate";

export default function RegistrationForm({
  program,
  spotsRemaining,
  userProfile,
  sessionUserId,
  alreadyRegistered,
  deadlinePassed,
}: Props) {
  const [form, setForm] = useState({
    firstName: userProfile?.firstName ?? "",
    lastName: userProfile?.lastName ?? "",
    email: userProfile?.email ?? "",
    phone: userProfile?.phone ?? "",
    comments: "",
  });
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // ── Already registered ──────────────────────────────────────────────────────
  if (alreadyRegistered) {
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

  // ── Success states ──────────────────────────────────────────────────────────
  if (formState === "registered") {
    return (
      <div className="pg-form__success">
        <h3>You&rsquo;re registered!</h3>
        <p>We&rsquo;ll look forward to seeing you. A confirmation will be sent to {form.email}.</p>
      </div>
    );
  }

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

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
          userId: sessionUserId ?? undefined,
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

      setFormState(data.status === "WAITLISTED" ? "waitlisted" : "registered");
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
          onChange={handleField}
          required
          autoComplete="email"
          readOnly={!!sessionUserId}
        />
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

      {/* ── Comments ── */}
      <div className="pg-form__field">
        <label className="pg-form__label" htmlFor="reg-comments">
          Questions or Comments
        </label>
        <textarea
          id="reg-comments"
          name="comments"
          className="pg-form__textarea"
          value={form.comments}
          onChange={handleField}
        />
      </div>

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
        disabled={formState === "submitting"}
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
