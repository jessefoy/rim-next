"use client";

/**
 * The Kalyana Mitta group application
 * (/kalyana-mitta/kalyana-mitta-group-application). Same pattern as
 * VolunteerInterestForm: no page reload, "Sending…" on the button, a problem
 * beside it with what was written kept (controlled fields), the confirmation
 * brought to the person (FormDone), and the member's name and email filled in
 * from their record. The page's server action saves before it emails.
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import FormDone, { FormProblem } from "@/components/FormDone";
import type { FormSendState } from "@/lib/formSubmissions";
import type { MemberPrefill } from "@/components/VolunteerInterestForm";

export default function KalyanaApplicationForm({
  action,
  member,
}: {
  action: (prev: FormSendState, formData: FormData) => Promise<FormSendState>;
  member: MemberPrefill;
}) {
  const [state, formAction, pending] = useActionState<FormSendState, FormData>(action, { status: "idle" });
  const [firstName, setFirstName] = useState(member.firstName);
  const [lastName, setLastName] = useState(member.lastName);
  const [email, setEmail] = useState(member.email);
  const [idea, setIdea] = useState("");

  if (state.status === "sent") {
    return (
      <FormDone title={`Thank you${state.firstName ? `, ${state.firstName}` : ""}. Your application has been sent.`}>
        <p>
          The Kalyana Mitta Coordinator will be in touch soon. You don&rsquo;t need to do anything
          else.
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
        <label className="pp-form__label" htmlFor="idea">
          Tell us about your idea for a Kalyana Mitta group at RIM
        </label>
        <textarea
          id="idea"
          name="idea"
          maxLength={5000}
          required
          className="pp-form__textarea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
      </div>

      <FormProblem status={pending ? "idle" : state.status} />
      <button type="submit" className="pp-btn pp-form__submit" disabled={pending}>
        {pending ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
