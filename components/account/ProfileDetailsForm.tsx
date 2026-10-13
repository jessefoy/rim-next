"use client";

/**
 * My Profile's personal details. The save is answered beside the button and
 * stays until the next edit (SaveNote), instead of a banner at the top of the
 * page after a reload (Jesse, 2026-10-13: every submit answered where the
 * person is looking). Controlled fields, so an error keeps what was typed.
 * The action is the page's server action.
 */

import { useActionState, useState } from "react";
import { SaveNote } from "@/components/FormDone";

export type ProfileSaveState = { status: "idle" | "saved" | "error" };

export interface ProfileDetails {
  firstName: string;
  lastName: string;
  preferredName: string;
  phone: string;
  title: string;
}

export default function ProfileDetailsForm({
  action,
  initial,
}: {
  action: (prev: ProfileSaveState, formData: FormData) => Promise<ProfileSaveState>;
  initial: ProfileDetails;
}) {
  const [state, formAction, pending] = useActionState<ProfileSaveState, FormData>(action, { status: "idle" });
  const [fields, setFields] = useState<ProfileDetails>(initial);
  // The answer stays until the person changes something again.
  const [edited, setEdited] = useState(false);
  const shown = edited ? "idle" : state.status;

  const field = (key: keyof ProfileDetails) => ({
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((f) => ({ ...f, [key]: e.target.value }));
      setEdited(true);
    },
  });

  return (
    <form action={formAction} onSubmit={() => setEdited(false)} className="mp-form">
      <div className="mp-field__row">
        <div className="mp-field">
          <label htmlFor="firstName" className="mp-label">First name</label>
          <input className="mp-input" name="firstName" type="text" autoComplete="given-name" id="firstName" maxLength={256} {...field("firstName")} />
        </div>
        <div className="mp-field">
          <label htmlFor="lastName" className="mp-label">Last name</label>
          <input className="mp-input" name="lastName" type="text" autoComplete="family-name" id="lastName" maxLength={256} {...field("lastName")} />
        </div>
      </div>
      <div className="mp-field">
        <label htmlFor="preferredName" className="mp-label">Preferred name</label>
        <input className="mp-input" name="preferredName" type="text" id="preferredName" maxLength={256} placeholder="How you'd like to be addressed" {...field("preferredName")} />
      </div>
      <div className="mp-field">
        <label htmlFor="phone" className="mp-label">Phone</label>
        <input className="mp-input" name="phone" type="tel" autoComplete="tel" id="phone" maxLength={256} {...field("phone")} />
      </div>
      <div className="mp-field">
        <label htmlFor="title" className="mp-label">Title</label>
        <input className="mp-input" name="title" type="text" id="title" maxLength={256} placeholder="e.g. Guiding Teacher, Program Registrar" {...field("title")} />
      </div>
      <div className="mp-save">
        <button type="submit" className="mp-submit" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        <SaveNote
          status={pending ? "saving" : shown}
          saved="Saved. Your profile is up to date."
          problem="Something went wrong, and your changes were not saved. They are still here. Please try again."
        />
      </div>
    </form>
  );
}
