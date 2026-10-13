"use client";

/**
 * The "If harm happens" form (/community-care-agreements/concern).
 * A client component so that what someone has written is never lost: the
 * fields are controlled, and a failed or rate-limited send returns a status
 * instead of reloading the page. The action itself is the page's server
 * action (it reads the session; the message is emailed, never stored).
 */

import { useActionState, useState } from "react";
import Link from "next/link";
import FormDone from "@/components/FormDone";

export type CareConcernStatus = "idle" | "sent" | "error" | "wait";
export type CareConcernState = { status: CareConcernStatus };

export default function CareConcernForm({
  action,
  member,
}: {
  action: (prev: CareConcernState, formData: FormData) => Promise<CareConcernState>;
  member: { name: string; email: string } | null;
}) {
  const [state, formAction, pending] = useActionState<CareConcernState, FormData>(action, { status: "idle" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  if (state.status === "sent") {
    return (
      <FormDone title="Thank you for writing. Your message has been sent.">
        <p>
          It has reached Jesse, who will reply to you. You don&rsquo;t need to do anything else.
        </p>
        <div className="pp-actions">
          <Link href="/community-care-agreements" className="pp-btn pp-btn--ghost">
            Back to the Community Care Agreements
          </Link>
        </div>
      </FormDone>
    );
  }

  return (
    <form action={formAction} className="pp-form cc-concern__form">
      <p className="cc-concern__safety">If anyone is in danger right now, call 911.</p>

      {member ? (
        <>
          <p className="cc-concern__sender">
            Sending as {member.name} ({member.email}).
          </p>
          {/* Used only if the session has lapsed by the time they send. */}
          <input type="hidden" name="name" value={member.name} />
          <input type="hidden" name="email" value={member.email} />
        </>
      ) : (
        <div className="pp-form__row">
          <div className="pp-form__field">
            <label className="pp-form__label" htmlFor="cc-name">Your name</label>
            <input
              className="pp-form__input"
              id="cc-name"
              name="name"
              type="text"
              maxLength={200}
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="pp-form__field">
            <label className="pp-form__label" htmlFor="cc-email">Your email</label>
            <input
              className="pp-form__input"
              id="cc-email"
              name="email"
              type="email"
              maxLength={254}
              autoComplete="email"
              required
              aria-describedby="cc-email-help"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="pp-form__help" id="cc-email-help">So Jesse can reply. It is never shared.</p>
          </div>
        </div>
      )}

      <div className="pp-form__field">
        <label className="pp-form__label" htmlFor="cc-message">Your message</label>
        <textarea
          className="pp-form__textarea"
          id="cc-message"
          name="message"
          maxLength={5000}
          required
          aria-describedby="cc-message-help"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="pp-form__help" id="cc-message-help">Write as much or as little as you like.</p>
      </div>

      {/* A field people never see; automated senders fill it. */}
      <div className="cc-concern__trap" aria-hidden="true">
        <label htmlFor="cc-leave-blank">Leave this empty</label>
        <input id="cc-leave-blank" name="cc_leave_blank" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>

      {/* Beside the button, where the person is looking (FormDone, 2026-10-13). */}
      {state.status === "error" && (
        <p className="pp-form__error" role="alert">
          Something went wrong, and your message was not sent. What you wrote is still here.
          Please try again, or speak with a teacher after any gathering.
        </p>
      )}
      {state.status === "wait" && (
        <p className="pp-form__error" role="alert">
          Several messages have been sent from here in a short time. What you wrote is still
          here. Please wait a little and try again, or speak with a teacher after any gathering.
        </p>
      )}

      <button type="submit" className="pp-btn pp-form__submit" disabled={pending}>
        {pending ? "Sending…" : "Send privately"}
      </button>
    </form>
  );
}
