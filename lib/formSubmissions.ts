/**
 * Public form submissions (2026-10-13): the volunteer interest form and the
 * Kalyana Mitta group application. Each is saved (FormSubmission) before its
 * notification is sent, so a failed send never loses one; ADMIN reads them at
 * /admin/form-submissions. Recipients and the "RIM form · Kind · Name" subject
 * label live with the sends in lib/email.ts.
 */
export const FORM_KIND = {
  volunteer: "volunteer-interest",
  kalyanaMitta: "kalyana-mitta-application",
} as const;

export type FormKind = (typeof FORM_KIND)[keyof typeof FORM_KIND];

/** The kind's name in the subject label and on the admin page. */
export const FORM_KIND_LABEL: Record<FormKind, string> = {
  "volunteer-interest": "Volunteer interest",
  "kalyana-mitta-application": "Kalyana Mitta application",
};

/** The one subject every form notification carries: "RIM form · Kind · Name". */
export function formNoticeSubject(kind: FormKind, firstName: string, lastName: string): string {
  const name = `${firstName} ${lastName}`.trim();
  return `RIM form · ${FORM_KIND_LABEL[kind]}${name ? ` · ${name}` : ""}`;
}

/** Trim a submitted field and cap its length (line breaks kept, for messages). */
export function formField(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/** A one-line field (a name, an email): line breaks and tabs become spaces. */
export function formLine(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** One plain address: no lists, spaces or query characters. */
export function isPlainEmail(email: string): boolean {
  return /^[^\s@,;?&<>"]+@[^\s@,;?&<>"]+\.[^\s@,;?&<>"]+$/.test(email);
}

/**
 * What a form's server action returns, so the page never reloads: what the
 * person wrote stays on screen through an error, and success shows FormDone.
 * "email": the address doesn't look right; "signin": the session lapsed.
 */
export type FormSendStatus = "idle" | "sent" | "error" | "email" | "signin";
export type FormSendState = { status: FormSendStatus; firstName?: string };
