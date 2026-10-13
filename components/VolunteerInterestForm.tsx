"use client";

/**
 * The volunteer interest form (/volunteerism/volunteer). A client component
 * so the page never reloads: the button says "Sending…", a problem appears
 * beside it with what was written kept, and the confirmation comes to the
 * person (FormDone). Fields are controlled so an error keeps them. The
 * member's name, email and phone are filled in from their record. The action
 * is the page's server action, which saves the submission before emailing
 * volunteer@ (lib/formSubmissions.ts).
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import FormDone, { FormProblem } from "@/components/FormDone";
import type { FormSendState } from "@/lib/formSubmissions";

export interface MemberPrefill {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function VolunteerInterestForm({
  action,
  member,
}: {
  action: (prev: FormSendState, formData: FormData) => Promise<FormSendState>;
  member: MemberPrefill;
}) {
  const [state, formAction, pending] = useActionState<FormSendState, FormData>(action, { status: "idle" });
  // Controlled, because React clears uncontrolled fields after an action:
  // what someone wrote must survive an error.
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [email, setEmail] = useState(member.email);
  const [phone, setPhone] = useState(member.phone);
  const [interests, setInterests] = useState("");

  if (state.status === "sent") {
    return (
      <FormDone title={`Thank you${state.firstName ? `, ${state.firstName}` : ""}. Your note has been sent.`}>
        <p>
          Someone from RIM will be in touch when something fits what you enjoy. You don&rsquo;t
          need to do anything else.
        </p>
        <div className="pp-actions">
          <Link href="/account/dashboard" className="pp-btn pp-btn--ghost">
            Go to My Home
          </Link>
        </div>
      </FormDone>
    );
  }

  return (
    <form action={formAction} className="pp-form">
      <div className="pp-form__row">
        <div className="pp-form__field">
          <label className="pp-form__label" htmlFor="firstName">First name</label>
          <input
            className="pp-form__input"
            maxLength={256}
            name="firstName"
            type="text"
            id="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="pp-form__field">
          <label className="pp-form__label" htmlFor="lastName">Last name</label>
          <input
            className="pp-form__input"
            maxLength={256}
            name="lastName"
            type="text"
            id="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="pp-form__row">
        <div className="pp-form__field">
          <label className="pp-form__label" htmlFor="email">Email address</label>
          <input
            className="pp-form__input"
            maxLength={256}
            name="email"
            type="email"
            id="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="pp-form__field">
          <label className="pp-form__label" htmlFor="phone">Phone number</label>
          <input
            className="pp-form__input"
            maxLength={256}
            name="phone"
            type="tel"
            id="phone"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="pp-form__help">Optional.</p>
        </div>
      </div>

      <div className="pp-form__field">
        <label className="pp-form__label" htmlFor="interests">My interests and talents</label>
        <textarea
          name="interests"
          maxLength={5000}
          id="interests"
          className="pp-form__textarea"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
        />
      </div>

      <FormProblem status={pending ? "idle" : state.status} />
      <button type="submit" className="pp-btn pp-form__submit" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
