"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface WelcomeFormProps {
  defaultFirstName?: string;
  defaultLastName?: string;
  defaultPhone?: string;
}

export default function WelcomeForm({
  defaultFirstName = "",
  defaultLastName = "",
  defaultPhone = "",
}: WelcomeFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [phone, setPhone] = useState(defaultPhone);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "declining" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) return;
    setStatus("saving");
    setErrorMsg("");
    try {
      const res = await fetch("/api/account/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      // Reload session and redirect to dashboard
      router.push("/account/dashboard");
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  async function handleDecline() {
    setStatus("declining");
    try {
      await fetch("/api/account/complete-profile", { method: "DELETE" });
    } catch {
      // best effort — sign them out regardless
    }
    // Sign out and redirect to home
    router.push("/api/auth/signout?callbackUrl=/");
  }

  return (
    <form onSubmit={handleSubmit} className="wl-form">
      <div className="wl-field">
        <label htmlFor="wl-first" className="wl-label">First name <span className="wl-required">*</span></label>
        <input
          id="wl-first"
          className="wl-input"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          autoComplete="given-name"
          placeholder="Your first name"
        />
      </div>

      <div className="wl-field">
        <label htmlFor="wl-last" className="wl-label">Last name <span className="wl-required">*</span></label>
        <input
          id="wl-last"
          className="wl-input"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          autoComplete="family-name"
          placeholder="Your last name"
        />
      </div>

      <div className="wl-field">
        <label htmlFor="wl-phone" className="wl-label">Phone <span className="wl-optional">(optional)</span></label>
        <input
          id="wl-phone"
          className="wl-input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          autoComplete="tel"
          placeholder="(414) 555-0100"
        />
      </div>

      <div className="wl-agreements">
        <p className="wl-agreements__text">
          Rooted In Mindfulness is a community held by shared values of presence, care, and
          respect. We practice together, support one another, and create a container of trust.
          We ask that everyone participate using their real name and show up with the same
          care and attention they would bring to a sitting practice.{" "}
          <a href="/community-membership" className="wl-agreements__link" target="_blank" rel="noopener noreferrer">
            Read our full community care agreements →
          </a>
        </p>
        <label className="wl-checkbox-label">
          <input
            type="checkbox"
            className="wl-checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            required
          />
          <span>I&apos;m entering this community in a spirit of care and respect.</span>
        </label>
      </div>

      {errorMsg && <p className="wl-error">{errorMsg}</p>}

      <button
        type="submit"
        className="wl-submit"
        disabled={!agreed || status === "saving"}
      >
        {status === "saving" ? "Joining…" : "Join the community →"}
      </button>

      <div className="wl-decline">
        {!showDeclineConfirm ? (
          <button
            type="button"
            className="wl-decline__link"
            onClick={() => setShowDeclineConfirm(true)}
          >
            I&apos;d rather not join
          </button>
        ) : (
          <div className="wl-decline__confirm">
            <p className="wl-decline__confirm-text">
              This will remove your account. You&apos;re always welcome to return.
            </p>
            <button
              type="button"
              className="wl-decline__yes"
              onClick={handleDecline}
              disabled={status === "declining"}
            >
              {status === "declining" ? "Removing…" : "Yes, remove my account"}
            </button>
            <button
              type="button"
              className="wl-decline__cancel"
              onClick={() => setShowDeclineConfirm(false)}
            >
              Never mind
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
