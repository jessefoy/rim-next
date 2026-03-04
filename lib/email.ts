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

// ─── Public interface ────────────────────────────────────────────────────────

export interface RegistrationEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  status: "REGISTERED" | "WAITLISTED";
  waitlistPosition?: number | null;
  dateText?: string | null;
  timeText?: string | null;
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
    status, waitlistPosition, dateText, timeText, locationText,
  } = data;

  const isWaitlisted = status === "WAITLISTED";
  const programUrl   = `${BASE_URL}/programs/${programSlug}`;

  const subject = isWaitlisted
    ? `You're on the waitlist — ${programTitle}`
    : `You're registered — ${programTitle}`;

  const params: BuildParams = {
    firstName, programTitle, programUrl,
    isWaitlisted, waitlistPosition,
    dateText, timeText, locationText,
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
  timeText?: string | null;
  locationText?: string | null;
  locationLink?: string | null;
  zoomLink?: string | null;
  zoomLinkText?: string | null;
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
    dateText, timeText, locationText, locationLink,
    zoomLink, zoomLinkText, reminderMessage,
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
      dateText, timeText, locationText, locationLink,
      zoomLink, zoomLinkText, reminderHtml,
    }),
    text:    buildReminderText({
      firstName, programTitle, programSlug,
      dateText, timeText, locationText,
      zoomLink, zoomLinkText, reminderText,
    }),
  });
  if (error) {
    console.error("[email] Failed to send reminder:", error);
  }
}

// ─── Reminder builders ────────────────────────────────────────────────────────

function buildReminderHtml({
  firstName, programTitle, programSlug,
  dateText, timeText, locationText, locationLink,
  zoomLink, zoomLinkText, reminderHtml,
}: {
  firstName: string; programTitle: string; programSlug: string;
  dateText?: string | null; timeText?: string | null;
  locationText?: string | null; locationLink?: string | null;
  zoomLink?: string | null; zoomLinkText?: string | null;
  reminderHtml?: string | null;
}): string {
  const programUrl = `${BASE_URL}/programs/${programSlug}`;
  const ctaUrl     = zoomLink ?? programUrl;
  const ctaLabel   = zoomLink ? (zoomLinkText ?? "Join on Zoom") : "View Program Details";

  const locationRow = locationText
    ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📍&nbsp; ${
        locationLink
          ? `<a href="${locationLink}" style="color:#39607a;text-decoration:none;">${locationText}</a>`
          : locationText
      }</td></tr>`
    : "";

  const detailRows = [
    dateText     ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📅&nbsp; ${dateText}</td></tr>` : "",
    timeText     ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">🕐&nbsp; ${timeText}</td></tr>` : "",
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
  dateText, timeText, locationText,
  zoomLink, zoomLinkText, reminderText,
}: {
  firstName: string; programTitle: string; programSlug: string;
  dateText?: string | null; timeText?: string | null;
  locationText?: string | null;
  zoomLink?: string | null; zoomLinkText?: string | null;
  reminderText?: string | null;
}): string {
  const programUrl = `${BASE_URL}/programs/${programSlug}`;
  const ctaUrl     = zoomLink ?? programUrl;
  const ctaLabel   = zoomLink ? (zoomLinkText ?? "Join on Zoom") : "View Program Details";

  const details = [
    dateText     ? `Date: ${dateText}`         : "",
    timeText     ? `Time: ${timeText}`         : "",
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
  timeText?: string | null;
  locationText?: string | null;
  confirmationMessageHtml?: string;
  confirmationMessageText?: string;
  googleCalendarUrl?: string;
  icsUrl?: string;
}

function buildHtml(p: BuildParams): string {
  const detailRows = [
    p.dateText     ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">📅&nbsp; ${p.dateText}</td></tr>` : "",
    p.timeText     ? `<tr><td style="padding:3px 0;font-size:15px;color:#56504a;">🕐&nbsp; ${p.timeText}</td></tr>` : "",
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
    p.dateText     ? `Date: ${p.dateText}`         : "",
    p.timeText     ? `Time: ${p.timeText}`         : "",
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
