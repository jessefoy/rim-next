"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COMMUNITY_AGREEMENTS_CHECKBOX_LABEL } from "@/lib/communityAgreements";

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function JoinForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed || status === "submitting") return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/account/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          agreedToTerms: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      // Rate-limited — match the NextAuth /signin/resend behavior by landing
      // on the calm error page rather than showing an inline error.
      if (res.status === 429 || data?.rateLimited) {
        router.push("/login/error?error=RateLimit");
        return;
      }

      if (!res.ok) {
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }

      // Returning member detected — gently route to /login instead.
      if (data.alreadyMember) {
        router.push(`/login?email=${encodeURIComponent(email.trim())}`);
        return;
      }

      // Code was sent; land on the existing check-email page (NextAuth's
      // verifyRequest target). The page uses the email query param to
      // construct the verification URL on code submit.
      router.push(`/login/check-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="jn-form" noValidate>
      <div className="jn-form__row jn-form__row--split">
        <div className="jn-field">
          <label htmlFor="jn-first" className="jn-label">
            First name <span className="jn-required">*</span>
          </label>
          <input
            id="jn-first"
            className="jn-input"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            autoComplete="given-name"
            placeholder="Your first name"
          />
        </div>
        <div className="jn-field">
          <label htmlFor="jn-last" className="jn-label">
            Last name <span className="jn-required">*</span>
          </label>
          <input
            id="jn-last"
            className="jn-input"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            autoComplete="family-name"
            placeholder="Your last name"
          />
        </div>
      </div>

      <div className="jn-field">
        <label htmlFor="jn-email" className="jn-label">
          Email <span className="jn-required">*</span>
        </label>
        <input
          id="jn-email"
          className="jn-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      <div className="jn-field">
        <label htmlFor="jn-phone" className="jn-label">
          Phone <span className="jn-optional">(optional)</span>
        </label>
        <input
          id="jn-phone"
          className="jn-input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          autoComplete="tel"
          placeholder="(414) 555-0100"
        />
      </div>

      <label className="jn-checkbox-label">
        <input
          type="checkbox"
          className="jn-checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          required
        />
        <span>{COMMUNITY_AGREEMENTS_CHECKBOX_LABEL}</span>
      </label>

      {errorMsg && <p className="jn-error">{errorMsg}</p>}

      <button
        type="submit"
        className="jn-submit"
        disabled={!agreed || status === "submitting"}
      >
        {status === "submitting" ? "Sending your code…" : "Join the community →"}
      </button>

      <p className="jn-already">
        Already have an account?{" "}
        <a href="/login" className="jn-already__link">
          Sign in
        </a>
      </p>
    </form>
  );
}
