import { Resend } from "resend";
import {
  portableTextToEmailHtml,
  portableTextToEmailText,
} from "@/lib/portableTextEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

// NEXTAUTH_URL must be set in Vercel env vars (e.g. https://rim-next.vercel.app).
// After DNS cutover, update to https://rootedinmindfulness.org.
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// TODO: Switch EMAIL_FROM to a verified RIM domain after Resend DNS verification.
const FROM = `Rooted In Mindfulness <${process.env.EMAIL_FROM ?? "onboarding@resend.dev"}>`;

// REGISTRAR_EMAIL — set in Vercel env vars. Used for cancellation notifications.
// Falls back to EMAIL_FROM if not set.
const REGISTRAR_EMAIL =
  process.env.REGISTRAR_EMAIL ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev";

// JESSE_EMAIL — set in Vercel env vars. Used for sensitive post-session flags.
// Falls back to REGISTRAR_EMAIL if not set.
const JESSE_EMAIL =
  process.env.JESSE_EMAIL ?? REGISTRAR_EMAIL;

// HOST_COORDINATOR_EMAIL — set in Vercel env vars. Used for technical issues + gentle follow-up routing.
// Falls back to REGISTRAR_EMAIL if not set.
const HOST_COORDINATOR_EMAIL =
  process.env.HOST_COORDINATOR_EMAIL ?? REGISTRAR_EMAIL;

// ─── Public interface ────────────────────────────────────────────────────────

export interface RegistrationEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  status: "REGISTERED" | "WAITLISTED";
  waitlistPosition?: number | null;
  dateText?: string | null;
  locationText?: string | null;
  // Program-specific confirmation copy from Sanity (rendered from Portable Text)
  confirmationMessageHtml?: string;
  confirmationMessageText?: string;
  // Add-to-calendar links — only included when program has startDatetime set in Sanity
  googleCalendarUrl?: string;
  icsUrl?: string;
}

/**
 * Send a registration confirmation or waitlist email.
 * Errors are caught and logged — a failed email must never fail the registration.
 */
export async function sendRegistrationEmail(data: RegistrationEmailData): Promise<void> {
  const {
    to, firstName, programTitle, programSlug,
    status, waitlistPosition, dateText, locationText,
  } = data;

  const isWaitlisted = status === "WAITLISTED";
  const programUrl   = `${BASE_URL}/programs/${programSlug}`;

  const subject = isWaitlisted
    ? `You're on the waitlist — ${programTitle}`
    : `You're registered — ${programTitle}`;

  const params: BuildParams = {
    firstName, programTitle, programUrl,
    isWaitlisted, waitlistPosition,
    dateText, locationText,
    confirmationMessageHtml: data.confirmationMessageHtml,
    confirmationMessageText: data.confirmationMessageText,
    googleCalendarUrl: data.googleCalendarUrl,
    icsUrl: data.icsUrl,
  };

  // Resend v4+ returns { data, error } instead of throwing — check both.
  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject,
    html:    buildHtml(params),
    text:    buildText(params),
  });
  if (error) {
    console.error("[email] Failed to send registration confirmation:", error);
  }
}

// ─── Waitlist approval email ─────────────────────────────────────────────────

export interface ApprovalEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  danaMode?: string | null; // if set and not "none", include a dana section
}

/**
 * Sent when a registrar promotes someone from WAITLISTED → APPROVED.
 * When the program has a dana practice, includes a section with a link to complete the offering.
 * Errors are caught and logged — must never fail the status update.
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, danaMode } = data;
  // Dana link goes to the dedicated register page so the member lands directly
  // on the dana step without scrolling past program content.
  const programUrl = `${BASE_URL}/programs/${programSlug}/register`;
  const hasDana = !!danaMode && danaMode !== "none";

  // Resend v4+ returns { data, error } instead of throwing — check both.
  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: `Your spot is confirmed — ${programTitle}`,
    html:    buildApprovalHtml({ firstName, programTitle, programUrl, hasDana }),
    text:    buildApprovalText({ firstName, programTitle, programUrl, hasDana }),
  });
  if (error) {
    console.error("[email] Failed to send approval confirmation:", error);
  }
}

// ─── Cancellation notification email (to registrar) ─────────────────────────

export interface CancellationNotificationData {
  registrantName: string;
  registrantEmail: string;
  programTitle: string;
  programSlug: string;
}

/**
 * Sent to the registrar when any registration is cancelled (by staff or by the member).
 * Uses REGISTRAR_EMAIL env var. Errors are caught and logged.
 */
export async function sendCancellationNotificationEmail(
  data: CancellationNotificationData
): Promise<void> {
  const { registrantName, registrantEmail, programTitle, programSlug } = data;
  const volunteerUrl = `${BASE_URL}/volunteer/programs/${programSlug}`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      REGISTRAR_EMAIL,
    subject: `Registration cancelled — ${registrantName} (${programTitle})`,
    html:    buildCancellationHtml({ registrantName, registrantEmail, programTitle, volunteerUrl }),
    text:    buildCancellationText({ registrantName, registrantEmail, programTitle, volunteerUrl }),
  });
  if (error) {
    console.error("[email] Failed to send cancellation notification:", error);
  }
}

// ─── Email builders ──────────────────────────────────────────────────────────

function buildApprovalHtml({ firstName, programTitle, programUrl, hasDana }: {
  firstName: string; programTitle: string; programUrl: string; hasDana: boolean;
}): string {
  const danaSection = hasDana ? `
    <div style="margin:28px 0 0;padding:20px 24px;background:#ede9e5;border-radius:4px;">
      <p style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:16px;
                line-height:1.7;color:#333333;">
        This program includes a dana (generosity) practice. When you&rsquo;re ready,
        you can make your offering from the program page.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#39607a;">
            <a href="${programUrl}"
               style="display:inline-block;padding:10px 20px;font-family:Arial,Helvetica,sans-serif;
                      font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              Complete Dana Offering
            </a>
          </td>
        </tr>
      </table>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your spot is confirmed</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        Your spot is confirmed
      </h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Good news — a spot has opened up and you&#39;ve been confirmed for
        <strong>${programTitle}</strong>. We look forward to practicing together.
      </p>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${programUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              View Program Details
            </a>
          </td>
        </tr>
      </table>

      ${danaSection}
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        Questions? Reply to this email or visit
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildApprovalText({ firstName, programTitle, programUrl, hasDana }: {
  firstName: string; programTitle: string; programUrl: string; hasDana: boolean;
}): string {
  const lines = [
    `Hi ${firstName},`,
    "",
    `Good news — a spot has opened up and you've been confirmed for ${programTitle}.`,
    "We look forward to practicing together.",
    "",
    `View program details: ${programUrl}`,
  ];

  if (hasDana) {
    lines.push(
      "",
      "─",
      "Dana Practice",
      "This program includes a dana (generosity) practice.",
      "When you're ready, visit the program page to complete your offering:",
      programUrl,
    );
  }

  lines.push("", "—", "Rooted In Mindfulness · Brookfield, WI", "rootedinmindfulness.org");
  return lines.join("\n");
}

function buildCancellationHtml({ registrantName, registrantEmail, programTitle, volunteerUrl }: {
  registrantName: string; registrantEmail: string; programTitle: string; volunteerUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Registration cancelled</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness — Registrar Notification
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;
                 font-weight:400;line-height:1.3;color:#135274;">
        Registration Cancelled
      </h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        A registration has been cancelled for <strong>${programTitle}</strong>.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0"
             style="margin:0 0 28px;border-left:3px solid #c8bcb2;padding-left:16px;">
        <tr>
          <td style="padding:3px 0;font-size:15px;color:#56504a;">
            <strong>Name:</strong> ${registrantName}
          </td>
        </tr>
        <tr>
          <td style="padding:3px 0;font-size:15px;color:#56504a;">
            <strong>Email:</strong> ${registrantEmail}
          </td>
        </tr>
      </table>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#56504a;font-family:Georgia,serif;">
        If there are waitlisted members, you may want to offer the spot to the next person.
      </p>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${volunteerUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              View Registrations
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildCancellationText({ registrantName, registrantEmail, programTitle, volunteerUrl }: {
  registrantName: string; registrantEmail: string; programTitle: string; volunteerUrl: string;
}): string {
  return [
    `Registration Cancelled — ${programTitle}`,
    "",
    `Name: ${registrantName}`,
    `Email: ${registrantEmail}`,
    "",
    "If there are waitlisted members, you may want to offer the spot to the next person.",
    "",
    `View registrations: ${volunteerUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");
}

// ─── Self-service edit request email (to registrant) ─────────────────────────

export interface EditRequestEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  token: string;
}

/**
 * Sent by a registrar to invite a registrant to update their own responses.
 * The token is single-use and expires after 7 days.
 * Errors are caught and logged — must never fail the request.
 */
export async function sendEditRequestEmail(data: EditRequestEmailData): Promise<void> {
  const { to, firstName, programTitle, token } = data;
  const editUrl = `${BASE_URL}/update/${token}`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: `Update your responses — ${programTitle}`,
    html:    buildEditRequestHtml({ firstName, programTitle, editUrl }),
    text:    buildEditRequestText({ firstName, programTitle, editUrl }),
  });
  if (error) {
    console.error("[email] Failed to send edit request:", error);
  }
}

// ─── Responses-updated notification email (to registrar) ─────────────────────

export interface ResponsesUpdatedEmailData {
  registrantName: string;
  programTitle: string;
  programSlug: string;
}

/**
 * Sent to REGISTRAR_EMAIL when a registrant submits their self-service response update.
 * Errors are caught and logged.
 */
export async function sendResponsesUpdatedEmail(data: ResponsesUpdatedEmailData): Promise<void> {
  const { registrantName, programTitle, programSlug } = data;
  const volunteerUrl = `${BASE_URL}/volunteer/programs/${programSlug}`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to:      REGISTRAR_EMAIL,
    subject: `${registrantName} updated their responses — ${programTitle}`,
    html:    buildResponsesUpdatedHtml({ registrantName, programTitle, volunteerUrl }),
    text:    buildResponsesUpdatedText({ registrantName, programTitle, volunteerUrl }),
  });
  if (error) {
    console.error("[email] Failed to send responses-updated notification:", error);
  }
}

// ─── Dana reminder email (to registrant) ─────────────────────────────────────

export interface DanaReminderEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
}

/**
 * Sent by a registrar to a member whose donationStatus is PENDING.
 * Gentle reminder with a direct link to the /register page dana step.
 * Errors are caught and logged — must never fail the request.
 */
export async function sendDanaReminderEmail(data: DanaReminderEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug } = data;
  const registerUrl = `${BASE_URL}/programs/${programSlug}/register`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: `A gentle reminder — your dana for ${programTitle}`,
    html:    buildDanaReminderHtml({ firstName, programTitle, registerUrl }),
    text:    buildDanaReminderText({ firstName, programTitle, registerUrl }),
  });
  if (error) {
    console.error("[email] Failed to send dana reminder:", error);
  }
}

// ─── Program reminder email (to registrant) ──────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortableTextBlock = any;

export interface ReminderEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  dateText?: string | null;
  locationText?: string | null;
  locationLink?: string | null;
  zoomLink?: string | null;
  reminderMessage?: PortableTextBlock[] | null;
}

/**
 * Sent to a registrant as a reminder about an upcoming program.
 * Can be triggered automatically by a daily cron or manually by a registrar.
 * Errors are caught and logged — must never fail the send operation.
 */
export async function sendReminderEmail(data: ReminderEmailData): Promise<void> {
  const {
    to, firstName, programTitle, programSlug,
    dateText, locationText, locationLink,
    zoomLink, reminderMessage,
  } = data;

  const reminderHtml = reminderMessage?.length
    ? portableTextToEmailHtml(reminderMessage)
    : null;
  const reminderText = reminderMessage?.length
    ? portableTextToEmailText(reminderMessage)
    : null;

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: `A reminder — ${programTitle}`,
    html:    buildReminderHtml({
      firstName, programTitle, programSlug,
      dateText, locationText, locationLink,
      zoomLink, reminderHtml,
    }),
    text:    buildReminderText({
      firstName, programTitle, programSlug,
      dateText, locationText,
      zoomLink, reminderText,
    }),
  });
  if (error) {
    console.error("[email] Failed to send reminder:", error);
  }
}

// ─── Reminder builders ────────────────────────────────────────────────────────

function buildReminderHtml({
  firstName, programTitle, programSlug,
  dateText, locationText, locationLink,
  zoomLink, reminderHtml,
}: {
  firstName: string; programTitle: string; programSlug: string;
  dateText?: string | null;
  locationText?: string | null; locationLink?: string | null;
  zoomLink?: string | null;
  reminderHtml?: string | null;
}): string {
  const programUrl = `${BASE_URL}/programs/${programSlug}`;
  const ctaUrl     = `${BASE_URL}/account/dashboard`;
  const ctaLabel   = "Go to my dashboard";

  const locationRow = locationText
    ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📍&nbsp; ${
        locationLink
          ? `<a href="${locationLink}" style="color:#39607a;text-decoration:none;">${locationText}</a>`
          : locationText
      }</td></tr>`
    : "";

  const detailRows = [
    dateText ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📅&nbsp; ${dateText}</td></tr>` : "",
    locationRow,
  ].filter(Boolean).join("");

  const detailsBlock = detailRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0"
          style="margin:0 0 28px;border-left:3px solid #c8bcb2;padding-left:16px;">
        ${detailRows}
      </table>`
    : "";

  const customMessageBlock = reminderHtml
    ? `<div style="margin:0 0 28px;padding:20px 24px;background:#f6f3f0;border-radius:4px;">
         ${reminderHtml}
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>A reminder — ${programTitle}</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        A reminder
      </h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        This is a friendly reminder about <strong>${programTitle}</strong>,
        coming up soon. We look forward to practicing together.
      </p>

      ${detailsBlock}
      ${customMessageBlock}

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${ctaUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        Questions? Reply to this email or visit
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildReminderText({
  firstName, programTitle, programSlug,
  dateText, locationText,
  zoomLink, reminderText,
}: {
  firstName: string; programTitle: string; programSlug: string;
  dateText?: string | null;
  locationText?: string | null;
  zoomLink?: string | null;
  reminderText?: string | null;
}): string {
  const programUrl = `${BASE_URL}/programs/${programSlug}`;
  const ctaUrl     = `${BASE_URL}/account/dashboard`;
  const ctaLabel   = "Go to my dashboard";

  const details = [
    dateText     ? `When: ${dateText}`         : "",
    locationText ? `Location: ${locationText}` : "",
  ].filter(Boolean).join("\n");

  const customLines = reminderText?.trim()
    ? ["─", reminderText.trim(), ""]
    : [];

  return [
    `Hi ${firstName},`,
    "",
    `This is a friendly reminder about ${programTitle}, coming up soon.`,
    "We look forward to practicing together.",
    "",
    ...(details ? [details, ""] : []),
    ...customLines,
    `${ctaLabel}: ${ctaUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Internal helpers (registration confirmation / waitlist) ─────────────────

interface BuildParams {
  firstName: string;
  programTitle: string;
  programUrl: string;
  isWaitlisted: boolean;
  waitlistPosition?: number | null;
  dateText?: string | null;
  locationText?: string | null;
  confirmationMessageHtml?: string;
  confirmationMessageText?: string;
  googleCalendarUrl?: string;
  icsUrl?: string;
}

function buildHtml(p: BuildParams): string {
  const detailRows = [
    p.dateText     ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📅&nbsp; ${p.dateText}</td></tr>` : "",
    p.locationText ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📍&nbsp; ${p.locationText}</td></tr>` : "",
  ].filter(Boolean).join("");

  const detailsBlock = detailRows
    ? `<table role="presentation" cellpadding="0" cellspacing="0"
          style="margin:0 0 28px;border-left:3px solid #c8bcb2;padding-left:16px;">
        ${detailRows}
      </table>`
    : "";

  // Custom program message — only shown on confirmed (non-waitlisted) registrations
  const customMessageBlock =
    !p.isWaitlisted && p.confirmationMessageHtml
      ? `<div style="margin:0 0 28px;padding:20px 24px;background:#f6f3f0;border-radius:4px;">
           ${p.confirmationMessageHtml}
         </div>`
      : "";

  // Add-to-calendar links — only shown on confirmed registrations when startDatetime is set
  const calendarLinksBlock =
    !p.isWaitlisted && p.googleCalendarUrl
      ? `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;
                  letter-spacing:0.10em;text-transform:uppercase;color:#6b6059;">
           Add to calendar
         </p>
         <p style="margin:0 0 28px;">
           <a href="${p.googleCalendarUrl}"
              style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#39607a;text-decoration:none;">
             Google Calendar
           </a>
           ${p.icsUrl ? `&nbsp;&middot;&nbsp;<a href="${p.icsUrl}"
              style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#39607a;text-decoration:none;">
             Apple / Outlook (.ics)
           </a>` : ""}
         </p>`
      : "";

  const bodyHtml = p.isWaitlisted
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
         Hi ${p.firstName},
       </p>
       <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
         You&#39;re on the waitlist for <strong>${p.programTitle}</strong>.${
           p.waitlistPosition
             ? ` You&#39;re currently <strong>#${p.waitlistPosition}</strong> in line.`
             : ""
         }
       </p>
       <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
         If a spot opens up, we&#39;ll email you right away.
       </p>`
    : `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
         Hi ${p.firstName},
       </p>
       <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
         You&#39;re registered for <strong>${p.programTitle}</strong>.
         We look forward to practicing together.
       </p>
       ${detailsBlock}
       ${customMessageBlock}
       ${calendarLinksBlock}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${p.isWaitlisted ? "You're on the waitlist" : "Registration confirmed"}</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        ${p.isWaitlisted ? "You&#39;re on the waitlist" : "Registration confirmed"}
      </h1>

      ${bodyHtml}

      <!-- CTA — table wrapper ensures correct rendering in Outlook -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${p.programUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              View Program Details
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        Questions? Reply to this email or visit
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildText(p: BuildParams): string {
  const details = [
    p.dateText     ? `When: ${p.dateText}`         : "",
    p.locationText ? `Location: ${p.locationText}` : "",
  ].filter(Boolean).join("\n");

  if (p.isWaitlisted) {
    return [
      `Hi ${p.firstName},`,
      "",
      `You're on the waitlist for ${p.programTitle}.${
        p.waitlistPosition ? ` You're currently #${p.waitlistPosition} in line.` : ""
      }`,
      "",
      "If a spot opens up, we'll email you right away.",
      "",
      `View program details: ${p.programUrl}`,
      "",
      "—",
      "Rooted In Mindfulness · Brookfield, WI",
      "rootedinmindfulness.org",
    ].join("\n");
  }

  const customMessageLines =
    p.confirmationMessageText?.trim()
      ? ["─", p.confirmationMessageText.trim(), ""]
      : [];

  const calendarLines = p.googleCalendarUrl
    ? [
        "Add to calendar:",
        `  Google Calendar: ${p.googleCalendarUrl}`,
        ...(p.icsUrl ? [`  Apple / Outlook: ${p.icsUrl}`] : []),
        "",
      ]
    : [];

  return [
    `Hi ${p.firstName},`,
    "",
    `You're registered for ${p.programTitle}. We look forward to practicing together.`,
    "",
    ...(details ? [details, ""] : []),
    ...customMessageLines,
    ...calendarLines,
    `View program details: ${p.programUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Dana reminder builders ───────────────────────────────────────────────────

function buildDanaReminderHtml({ firstName, programTitle, registerUrl }: {
  firstName: string; programTitle: string; registerUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>A gentle reminder — your dana</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        A gentle reminder
      </h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Just a gentle note that your dana offering for <strong>${programTitle}</strong>
        is still pending. Whenever you feel moved to, you can complete it here:
      </p>

      <!-- Dana CTA -->
      <div style="margin:0 0 28px;padding:20px 24px;background:#ede9e5;border-radius:4px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-radius:4px;background:#39607a;">
              <a href="${registerUrl}"
                 style="display:inline-block;padding:10px 20px;font-family:Arial,Helvetica,sans-serif;
                        font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
                Complete Your Dana Offering
              </a>
            </td>
          </tr>
        </table>
      </div>

      <p style="margin:0;font-size:15px;line-height:1.75;color:#6b6059;font-family:Georgia,serif;font-style:italic;">
        Dana is entirely optional — please only complete it if and when it feels right
        for you. Your participation is what matters most.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        Questions? Reply to this email or visit
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildDanaReminderText({ firstName, programTitle, registerUrl }: {
  firstName: string; programTitle: string; registerUrl: string;
}): string {
  return [
    `Hi ${firstName},`,
    "",
    `Just a gentle note that your dana offering for ${programTitle} is still pending.`,
    "",
    "Whenever you feel moved to, you can complete it here:",
    registerUrl,
    "",
    "Dana is entirely optional — please only complete it if and when it feels right",
    "for you. Your participation is what matters most.",
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Edit request builders ────────────────────────────────────────────────────

function buildEditRequestHtml({ firstName, programTitle, editUrl }: {
  firstName: string; programTitle: string; editUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Update your responses</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        Update your responses
      </h1>
      <p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        Your registrar has invited you to review and update your registration responses for
        <strong>${programTitle}</strong>. Click below to open your pre-filled form.
      </p>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="border-radius:4px;background:#39607a;">
            <a href="${editUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              Update My Responses
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;line-height:1.7;color:#6b6059;font-family:Arial,Helvetica,sans-serif;">
        This link is unique to you and expires in 7 days. It can only be used once.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        Questions? Reply to this email or visit
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildEditRequestText({ firstName, programTitle, editUrl }: {
  firstName: string; programTitle: string; editUrl: string;
}): string {
  return [
    `Hi ${firstName},`,
    "",
    `Your registrar has invited you to review and update your registration responses for ${programTitle}.`,
    "",
    "Update your responses here:",
    editUrl,
    "",
    "This link is unique to you, expires in 7 days, and can only be used once.",
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Responses-updated notification builders ──────────────────────────────────

function buildResponsesUpdatedHtml({ registrantName, programTitle, volunteerUrl }: {
  registrantName: string; programTitle: string; volunteerUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Responses updated</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness — Registrar Notification
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:22px;
                 font-weight:400;line-height:1.3;color:#135274;">
        Responses Updated
      </h1>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,serif;">
        <strong>${registrantName}</strong> has updated their registration responses for
        <strong>${programTitle}</strong>.
      </p>

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${volunteerUrl}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              View Registration
            </a>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildResponsesUpdatedText({ registrantName, programTitle, volunteerUrl }: {
  registrantName: string; programTitle: string; volunteerUrl: string;
}): string {
  return [
    `Responses Updated — ${programTitle}`,
    "",
    `${registrantName} has updated their registration responses.`,
    "",
    `View registration: ${volunteerUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");
}

// ─── Role assignment notification (to new registrar) ─────────────────────────

export interface RoleAssignmentEmailData {
  to: string;
  firstName: string | null;
}

/**
 * Sent to a member when they are granted the REGISTRAR role.
 * Tells them what the role means, where to go, and where to find help.
 * Fire-and-forget — errors are caught and logged.
 */
export async function sendRoleAssignmentEmail(data: RoleAssignmentEmailData): Promise<void> {
  const { to, firstName } = data;
  const dashboardUrl = `${BASE_URL}/volunteer`;
  const manualUrl    = `${BASE_URL}/admin/manual`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: "You've been added as a registrar — Rooted In Mindfulness",
    html:    buildRoleAssignmentHtml({ firstName, dashboardUrl, manualUrl }),
    text:    buildRoleAssignmentText({ firstName, dashboardUrl, manualUrl }),
  });
  if (error) {
    console.error("[email] Failed to send role assignment notification:", error);
  }
}

function buildRoleAssignmentHtml({
  firstName,
  dashboardUrl,
  manualUrl,
}: {
  firstName: string | null;
  dashboardUrl: string;
  manualUrl: string;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're a registrar</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr>
          <td style="background:#135274;padding:28px 36px;">
            <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
              You've been added as a <strong>registrar</strong> for Rooted In Mindfulness. This means you can now view and manage program registrations — approve and cancel spots, promote people from the waitlist, send reminders, and export attendee lists.
            </p>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
              Two things to bookmark: your <strong>Registrations dashboard</strong> where you'll do your day-to-day work, and the <strong>Staff Manual</strong> — a plain-English guide to every part of the system. Start with the manual if anything is unclear.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="border-radius:3px;background:#135274;">
                  <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'Open Sans',Arial,sans-serif;">Go to Registrations &#8594;</a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="border-radius:3px;border:1.5px solid #39607a;">
                  <a href="${manualUrl}" style="display:inline-block;padding:11px 24px;font-size:15px;font-weight:600;color:#39607a;text-decoration:none;font-family:'Open Sans',Arial,sans-serif;">Read the Staff Manual &#8594;</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:14px;line-height:1.75;color:#6b6059;font-family:'Open Sans',Arial,sans-serif;">
              If you have any questions, reply to this email or reach out directly. Welcome to the team.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #ede9e5;">
            <p style="margin:0;font-size:12px;color:#9b8e85;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness &middot; Brookfield, WI</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRoleAssignmentText({
  firstName,
  dashboardUrl,
  manualUrl,
}: {
  firstName: string | null;
  dashboardUrl: string;
  manualUrl: string;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return [
    greeting,
    "",
    "You've been added as a registrar for Rooted In Mindfulness.",
    "",
    "This means you can now view and manage program registrations — approve and cancel spots, promote people from the waitlist, send reminders, and export attendee lists.",
    "",
    "Two things to bookmark:",
    `  Registrations dashboard: ${dashboardUrl}`,
    `  Staff Manual (start here for guidance): ${manualUrl}`,
    "",
    "If you have any questions, reply to this email or reach out directly. Welcome to the team.",
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Host role assignment notification (to new Meet host) ────────────────────

/**
 * Sent to a member when they are granted the HOST role.
 * Tells them what the role means and where to find their session assignments.
 * Fire-and-forget — errors are caught and logged.
 */
export async function sendHostRoleAssignmentEmail(data: RoleAssignmentEmailData): Promise<void> {
  const { to, firstName } = data;
  const hostAreaUrl = `${BASE_URL}/hosts`;
  const manualUrl   = `${BASE_URL}/admin/manual`;

  const { error } = await resend.emails.send({
    from:    FROM,
    to,
    subject: "You've been added as a Meet host — Rooted In Mindfulness",
    html:    buildHostRoleAssignmentHtml({ firstName, hostAreaUrl, manualUrl }),
    text:    buildHostRoleAssignmentText({ firstName, hostAreaUrl, manualUrl }),
  });
  if (error) {
    console.error("[email] Failed to send host role assignment notification:", error);
  }
}

function buildHostRoleAssignmentHtml({
  firstName,
  hostAreaUrl,
  manualUrl,
}: {
  firstName: string | null;
  hostAreaUrl: string;
  manualUrl: string;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>You're a Meet host</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
        <tr>
          <td style="background:#135274;padding:28px 36px;">
            <p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 36px 28px;">
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
              You've been added as a <strong>Google Meet host</strong> for Rooted In Mindfulness. Thank you for helping hold this space for the community.
            </p>
            <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
              Your <strong>Host Area</strong> shows every virtual program and the Google account you'll need to sign into before hosting each one. Bookmark it — that's your home base before each session.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td style="border-radius:3px;background:#135274;">
                  <a href="${hostAreaUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;font-family:'Open Sans',Arial,sans-serif;">Go to Host Area &#8594;</a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="border-radius:3px;border:1.5px solid #39607a;">
                  <a href="${manualUrl}" style="display:inline-block;padding:11px 24px;font-size:15px;font-weight:600;color:#39607a;text-decoration:none;font-family:'Open Sans',Arial,sans-serif;">Read the Volunteer Manual &#8594;</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:14px;line-height:1.75;color:#6b6059;font-family:'Open Sans',Arial,sans-serif;">
              If you have any questions, reply to this email or reach out directly. Welcome to the host team.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #ede9e5;">
            <p style="margin:0;font-size:12px;color:#9b8e85;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness &middot; Brookfield, WI</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildHostRoleAssignmentText({
  firstName,
  hostAreaUrl,
  manualUrl,
}: {
  firstName: string | null;
  hostAreaUrl: string;
  manualUrl: string;
}): string {
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  return [
    greeting,
    "",
    "You've been added as a Google Meet host for Rooted In Mindfulness. Thank you for helping hold this space for the community.",
    "",
    "Your Host Area shows every virtual program and the Google account you'll need to sign into before hosting each one:",
    `  Host Area: ${hostAreaUrl}`,
    "",
    "Volunteer Manual (guidance for all volunteers):",
    `  ${manualUrl}`,
    "",
    "If you have any questions, reply to this email or reach out directly. Welcome to the host team.",
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Host Community Hub emails ───────────────────────────────────────────────

export interface SubRequestEmailData {
  to: string;
  firstName: string | null;
  requesterName: string;
  programName: string;
  sessionDate: string | null; // formatted date string, or null for standing
  message: string | null;
}

export async function sendSubRequestEmail(data: SubRequestEmailData): Promise<void> {
  const { to, firstName, requesterName, programName, sessionDate, message } = data;
  const hubUrl = `${BASE_URL}/account/host/subs`;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const sessionLabel = sessionDate ? ` on ${sessionDate}` : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sub needed</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:#135274;padding:28px 36px;"><p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness</p></td></tr>
<tr><td style="padding:36px 36px 28px;">
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
  <strong>${requesterName}</strong> needs a sub for <strong>${programName}</strong>${sessionLabel}.
</p>
${message ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56504a;font-family:Georgia,'Times New Roman',serif;background:#f6f3f0;padding:16px 20px;border-radius:4px;">"${message}"</p>` : ""}
<table cellpadding="0" cellspacing="0" style="margin-top:8px;">
<tr><td style="background:#135274;border-radius:3px;padding:12px 24px;">
<a href="${hubUrl}" style="font-family:'Open Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View Sub Board →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
<p style="margin:0;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">Rooted In Mindfulness · Brookfield, WI</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    greeting,
    "",
    `${requesterName} needs a sub for ${programName}${sessionLabel}.`,
    message ? `\n"${message}"\n` : "",
    `View the sub board: ${hubUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: `Sub needed: ${programName}${sessionLabel}`,
    html, text,
  });
  if (error) console.error("[email] sendSubRequestEmail failed:", error);
}

export interface SubClaimedEmailData {
  to: string;
  firstName: string | null;
  claimerName: string;
  programName: string;
  sessionDate: string | null;
  message: string | null;
}

export async function sendSubClaimedEmail(data: SubClaimedEmailData): Promise<void> {
  const { to, firstName, claimerName, programName, sessionDate, message } = data;
  const hubUrl = `${BASE_URL}/account/host/subs`;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const sessionLabel = sessionDate ? ` on ${sessionDate}` : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sub covered</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:#135274;padding:28px 36px;"><p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness</p></td></tr>
<tr><td style="padding:36px 36px 28px;">
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
  Your sub request for <strong>${programName}</strong>${sessionLabel} has been covered — <strong>${claimerName}</strong> will take the session.
</p>
${message ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56504a;font-family:Georgia,'Times New Roman',serif;background:#f6f3f0;padding:16px 20px;border-radius:4px;">"${message}"</p>` : ""}
<table cellpadding="0" cellspacing="0" style="margin-top:8px;">
<tr><td style="background:#135274;border-radius:3px;padding:12px 24px;">
<a href="${hubUrl}" style="font-family:'Open Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">View Sub Board →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
<p style="margin:0;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">Rooted In Mindfulness · Brookfield, WI</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    greeting,
    "",
    `Your sub request for ${programName}${sessionLabel} has been covered — ${claimerName} will take the session.`,
    message ? `\n"${message}"\n` : "",
    `View the sub board: ${hubUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: `Sub covered: ${programName}${sessionLabel}`,
    html, text,
  });
  if (error) console.error("[email] sendSubClaimedEmail failed:", error);
}

export interface NewThreadEmailData {
  to: string;
  firstName: string | null;
  authorName: string;
  threadTitle: string;
  category: "OPERATIONAL" | "CONTEMPLATION";
  threadId: string;
}

export async function sendNewThreadEmail(data: NewThreadEmailData): Promise<void> {
  const { to, firstName, authorName, threadTitle, category, threadId } = data;
  const threadUrl = `${BASE_URL}/account/host/threads/${threadId}`;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";
  const categoryLabel = category === "CONTEMPLATION" ? "Contemplation" : "Operational";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New thread</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:#135274;padding:28px 36px;"><p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness · Host Hub</p></td></tr>
<tr><td style="padding:36px 36px 28px;">
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
<p style="margin:0 0 8px;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#6b6059;font-family:'Open Sans',Arial,sans-serif;">${categoryLabel}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
  <strong>${authorName}</strong> started a new thread: <em>${threadTitle}</em>
</p>
<table cellpadding="0" cellspacing="0" style="margin-top:8px;">
<tr><td style="background:#135274;border-radius:3px;padding:12px 24px;">
<a href="${threadUrl}" style="font-family:'Open Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Read Thread →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
<p style="margin:0;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">Rooted In Mindfulness · Brookfield, WI</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    greeting,
    "",
    `${authorName} started a new ${categoryLabel} thread: "${threadTitle}"`,
    "",
    `Read it here: ${threadUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: `New thread: ${threadTitle}`,
    html, text,
  });
  if (error) console.error("[email] sendNewThreadEmail failed:", error);
}

export interface NewReplyEmailData {
  to: string;
  firstName: string | null;
  replierName: string;
  threadTitle: string;
  threadId: string;
}

export async function sendNewReplyEmail(data: NewReplyEmailData): Promise<void> {
  const { to, firstName, replierName, threadTitle, threadId } = data;
  const threadUrl = `${BASE_URL}/account/host/threads/${threadId}`;
  const greeting = firstName ? `Hi ${firstName},` : "Hello,";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New reply</title></head>
<body style="margin:0;padding:0;background:#f6f3f0;font-family:'Open Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3f0;padding:40px 16px;">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:4px;overflow:hidden;">
<tr><td style="background:#135274;padding:28px 36px;"><p style="margin:0;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#c5d8e4;font-family:'Open Sans',Arial,sans-serif;">Rooted In Mindfulness · Host Hub</p></td></tr>
<tr><td style="padding:36px 36px 28px;">
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">${greeting}</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
  <strong>${replierName}</strong> replied to <em>${threadTitle}</em>.
</p>
<table cellpadding="0" cellspacing="0" style="margin-top:8px;">
<tr><td style="background:#135274;border-radius:3px;padding:12px 24px;">
<a href="${threadUrl}" style="font-family:'Open Sans',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Read Thread →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
<p style="margin:0;font-family:'Open Sans',Arial,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">Rooted In Mindfulness · Brookfield, WI</p>
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    greeting,
    "",
    `${replierName} replied to "${threadTitle}".`,
    "",
    `Read it here: ${threadUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
  ].join("\n");

  const { error } = await resend.emails.send({
    from: FROM, to,
    subject: `New reply on: ${threadTitle}`,
    html, text,
  });
  if (error) console.error("[email] sendNewReplyEmail failed:", error);
}

// ─── Magic link email (authentication) ───────────────────────────────────────
// Called from auth.ts sendVerificationRequest — replaces the default NextAuth template.
// isNewUser = true when the account doesn't exist yet or agreedToTerms is false.

export async function sendMagicLinkEmail({
  to,
  url,
  isNewUser,
}: {
  to: string;
  url: string;
  isNewUser: boolean;
}): Promise<void> {
  const subject = isNewUser
    ? "Welcome to Rooted In Mindfulness — your link to join"
    : "Your sign-in link — Rooted In Mindfulness";

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html: buildMagicLinkHtml({ url, isNewUser }),
    text: buildMagicLinkText({ url, isNewUser }),
  });

  if (error) {
    console.error("[email] Failed to send magic link email:", error);
    // Rethrow so NextAuth surfaces the failure rather than silently dropping it.
    throw new Error("Failed to send sign-in email. Please try again.");
  }
}

function buildMagicLinkHtml({ url, isNewUser }: { url: string; isNewUser: boolean }): string {
  const title   = isNewUser ? "You&#39;re joining the community" : "Your sign-in link";
  const bodyHtml = isNewUser
    ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
         We&#39;re glad you&#39;re here.
       </p>
       <p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
         Click the button below to complete your account and step into the Rooted In Mindfulness
         community. This link is for you only and expires in 24&#160;hours.
       </p>`
    : `<p style="margin:0 0 28px;font-size:16px;line-height:1.75;color:#333333;font-family:Georgia,'Times New Roman',serif;">
         Click the button below to sign in to your account.
         This link expires in 24&#160;hours.
       </p>`;

  const ctaLabel = isNewUser ? "Complete my account &#8594;" : "Sign in &#8594;";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${isNewUser ? "Welcome to Rooted In Mindfulness" : "Sign in to Rooted In Mindfulness"}</title>
</head>
<body style="margin:0;padding:24px 0;background-color:#f6f3f0;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#135274;padding:24px 36px;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;
                letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.75);">
        Rooted In Mindfulness
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 36px 28px;">
      <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:26px;
                 font-weight:400;line-height:1.3;color:#135274;">
        ${title}
      </h1>

      ${bodyHtml}

      <!-- CTA -->
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-radius:4px;background:#135274;">
            <a href="${url}"
               style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;
                      font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">
              ${ctaLabel}
            </a>
          </td>
        </tr>
      </table>

      <p style="margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
                line-height:1.6;color:#6b6059;">
        If you didn&#39;t request this link, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #ede9e5;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#6b6059;">
        Rooted In Mindfulness &middot; Brookfield, WI<br>
        <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">
          rootedinmindfulness.org
        </a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildMagicLinkText({ url, isNewUser }: { url: string; isNewUser: boolean }): string {
  if (isNewUser) {
    return [
      "Welcome to Rooted In Mindfulness",
      "",
      "We're glad you're here.",
      "",
      "Click the link below to complete your account and join the community.",
      "This link is for you only and expires in 24 hours.",
      "",
      url,
      "",
      "If you didn't request this link, you can safely ignore this email.",
      "",
      "—",
      "Rooted In Mindfulness · Brookfield, WI",
      "rootedinmindfulness.org",
    ].join("\n");
  }

  return [
    "Your sign-in link — Rooted In Mindfulness",
    "",
    "Click the link below to sign in to your account.",
    "This link expires in 24 hours.",
    "",
    url,
    "",
    "If you didn't request this link, you can safely ignore this email.",
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── POST-SESSION NOTIFICATION ───────────────────────────────────────────────
// Sent to Jesse and/or the host coordinator when a host submits the post-session form.
// One email per recipient, consolidating all flags addressed to that person.
// Routing logic:
//   GENTLE_FOLLOWUP → Jesse + host coordinator
//   JESSE_ONLY       → Jesse only (private)
//   TECHNICAL_ISSUE  → host coordinator only
//   NONE             → no email
// Also sends if there's a resource to share (routes to registrar/Jesse for review).

export interface PostSessionFlagItem {
  name: string;
  note: string | null;
  action: string;
}

export interface PostSessionNotificationData {
  programSlug: string;
  sessionDate: Date;
  hostName: string;
  flags: PostSessionFlagItem[];
  reflection: string | null;
  resourceUrl: string | null;
  resourceNote: string | null;
}

export async function sendPostSessionNotification(
  data: PostSessionNotificationData
): Promise<void> {
  const { programSlug, sessionDate, hostName, flags, reflection, resourceUrl, resourceNote } = data;

  const dateStr = sessionDate.toLocaleDateString("en-US", {
    timeZone: "America/Chicago",
    weekday: "long", month: "long", day: "numeric",
  });

  // Determine which flags go to which recipients
  const forJesse   = flags.filter((f) => f.action === "GENTLE_FOLLOWUP" || f.action === "JESSE_ONLY");
  const forCoord   = flags.filter((f) => f.action === "GENTLE_FOLLOWUP" || f.action === "TECHNICAL_ISSUE");

  // Build recipient list (deduplicated)
  const recipients = new Map<string, PostSessionFlagItem[]>();

  if (forJesse.length > 0 || resourceUrl) {
    recipients.set(JESSE_EMAIL, forJesse);
  }
  if (forCoord.length > 0) {
    const existing = recipients.get(HOST_COORDINATOR_EMAIL) ?? [];
    recipients.set(HOST_COORDINATOR_EMAIL, [...new Set([...existing, ...forCoord])]);
  }

  // Send one email per recipient
  const sends = Array.from(recipients.entries()).map(async ([to, recipientFlags]) => {
    const flagBlock = recipientFlags.length > 0
      ? recipientFlags.map((f) => [
          `<li><strong>${f.name}</strong>${f.note ? ` — ${f.note}` : ""} <em>(${f.action.replace(/_/g, " ").toLowerCase()})</em></li>`,
        ]).join("")
      : "";

    const reflectionBlock = reflection
      ? `<p><strong>Session reflection from ${hostName}:</strong><br>${reflection}</p>`
      : "";

    const resourceBlock = resourceUrl
      ? `<p><strong>Resource to share with attendees:</strong><br>
          ${resourceUrl}${resourceNote ? `<br><em>${resourceNote}</em>` : ""}
          <br><small>This has not been sent yet — please review and send when ready.</small></p>`
      : "";

    const html = `
      <h2 style="font-size:18px;font-weight:600;">Post-session report — ${programSlug}</h2>
      <p><strong>Date:</strong> ${dateStr} &nbsp; <strong>Host:</strong> ${hostName}</p>
      ${flagBlock ? `<p><strong>Flagged attendees:</strong></p><ul>${flagBlock}</ul>` : ""}
      ${reflectionBlock}
      ${resourceBlock}
      <p style="color:#888;font-size:12px;margin-top:24px;">
        Rooted In Mindfulness · rootedinmindfulness.org<br>
        This notification was generated from the Host Team hub post-session form.
      </p>
    `;

    const textParts = [
      `Post-session report — ${programSlug}`,
      `Date: ${dateStr}  |  Host: ${hostName}`,
      "",
    ];
    if (recipientFlags.length > 0) {
      textParts.push("Flagged attendees:");
      recipientFlags.forEach((f) => {
        textParts.push(`  • ${f.name}${f.note ? ` — ${f.note}` : ""} (${f.action.replace(/_/g, " ").toLowerCase()})`);
      });
      textParts.push("");
    }
    if (reflection) textParts.push(`Session reflection from ${hostName}:\n${reflection}`, "");
    if (resourceUrl) {
      textParts.push(`Resource to share: ${resourceUrl}`);
      if (resourceNote) textParts.push(resourceNote);
      textParts.push("(Not yet sent — please review and send when ready)", "");
    }
    textParts.push("—", "Rooted In Mindfulness · rootedinmindfulness.org");

    try {
      await resend.emails.send({
        from: FROM,
        to,
        subject: `Post-session: ${programSlug} — ${dateStr}`,
        html,
        text: textParts.join("\n"),
      });
    } catch (e) {
      console.error(`[email] sendPostSessionNotification to ${to} failed:`, e);
    }
  });

  await Promise.all(sends);
}

// ─── ATTENDANCE AUTOMATED EMAILS ─────────────────────────────────────────────
// ⚠️ DRAFT — DO NOT ENABLE until Jesse approves copy.
// Controlled by ENABLE_ATTENDANCE_EMAILS=true env var (default: disabled).
// Fire-and-forget from POST /api/attendance/join.

interface AttendanceEmailData {
  to: string;
  firstName: string;
}

/**
 * Email 1 — First-time attendee.
 * Trigger: isNewMember = true on a new SessionAttendance record.
 *
 * ⚠️ DRAFT COPY — needs Jesse's approval before enabling.
 */
export async function sendFirstTimeAttendeeEmail(
  data: AttendanceEmailData
): Promise<void> {
  const { to, firstName } = data;

  // DRAFT subject — replace before enabling
  const subject = `[DRAFT] Welcome to your first RIM session, ${firstName}`;

  const html = `
    <p>Dear ${firstName},</p>
    <p><strong>[DRAFT — copy not yet approved]</strong></p>
    <p>It was wonderful to have you with us tonight. Welcome to Rooted In Mindfulness.</p>
    <p>We hope you felt at home. Please know you're always welcome to return.</p>
    <p>With warmth,<br>The RIM Host Team</p>
    <p style="color:#888;font-size:12px;">Rooted In Mindfulness · rootedinmindfulness.org</p>
  `;

  const text = [
    `Dear ${firstName},`,
    "",
    "[DRAFT — copy not yet approved]",
    "",
    "It was wonderful to have you with us tonight. Welcome to Rooted In Mindfulness.",
    "",
    "We hope you felt at home. Please know you're always welcome to return.",
    "",
    "With warmth,",
    "The RIM Host Team",
    "",
    "—",
    "Rooted In Mindfulness · rootedinmindfulness.org",
  ].join("\n");

  try {
    await resend.emails.send({ from: FROM, to, subject, html, text });
  } catch (e) {
    console.error("[email] sendFirstTimeAttendeeEmail failed:", e);
  }
}

/**
 * Email 2 — Returning after absence.
 * Trigger: returningAfterAbsence = true on a new SessionAttendance record.
 *
 * ⚠️ DRAFT COPY — needs Jesse's approval before enabling.
 */
export async function sendReturningAfterAbsenceEmail(
  data: AttendanceEmailData
): Promise<void> {
  const { to, firstName } = data;

  // DRAFT subject — replace before enabling
  const subject = `[DRAFT] Good to see you again, ${firstName}`;

  const html = `
    <p>Dear ${firstName},</p>
    <p><strong>[DRAFT — copy not yet approved]</strong></p>
    <p>It was lovely to have you back with us tonight. We're glad you're here.</p>
    <p>With warmth,<br>The RIM Host Team</p>
    <p style="color:#888;font-size:12px;">Rooted In Mindfulness · rootedinmindfulness.org</p>
  `;

  const text = [
    `Dear ${firstName},`,
    "",
    "[DRAFT — copy not yet approved]",
    "",
    "It was lovely to have you back with us tonight. We're glad you're here.",
    "",
    "With warmth,",
    "The RIM Host Team",
    "",
    "—",
    "Rooted In Mindfulness · rootedinmindfulness.org",
  ].join("\n");

  try {
    await resend.emails.send({ from: FROM, to, subject, html, text });
  } catch (e) {
    console.error("[email] sendReturningAfterAbsenceEmail failed:", e);
  }
}
