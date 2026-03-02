import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// NEXTAUTH_URL must be set in Vercel env vars (e.g. https://rim-next.vercel.app).
// After DNS cutover, update to https://rootedinmindfulness.org.
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// TODO: Switch EMAIL_FROM to a verified RIM domain after Resend DNS verification.
const FROM = `Rooted In Mindfulness <${process.env.EMAIL_FROM ?? "onboarding@resend.dev"}>`;

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
  };

  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject,
      html:    buildHtml(params),
      text:    buildText(params),
    });
  } catch (err) {
    console.error("[email] Failed to send registration confirmation:", err);
  }
}

// ─── Waitlist approval email ─────────────────────────────────────────────────

export interface ApprovalEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
}

/**
 * Sent when a registrar moves someone from WAITLISTED → APPROVED.
 * Errors are caught and logged — must never fail the status update.
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug } = data;
  const programUrl = `${BASE_URL}/programs/${programSlug}`;

  try {
    await resend.emails.send({
      from:    FROM,
      to,
      subject: `Your spot is confirmed — ${programTitle}`,
      html:    buildApprovalHtml({ firstName, programTitle, programUrl }),
      text:    buildApprovalText({ firstName, programTitle, programUrl }),
    });
  } catch (err) {
    console.error("[email] Failed to send approval confirmation:", err);
  }
}

function buildApprovalHtml({ firstName, programTitle, programUrl }: {
  firstName: string; programTitle: string; programUrl: string;
}): string {
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

function buildApprovalText({ firstName, programTitle, programUrl }: {
  firstName: string; programTitle: string; programUrl: string;
}): string {
  return [
    `Hi ${firstName},`,
    "",
    `Good news — a spot has opened up and you've been confirmed for ${programTitle}.`,
    "We look forward to practicing together.",
    "",
    `View program details: ${programUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}

// ─── Internal helpers ────────────────────────────────────────────────────────

interface BuildParams {
  firstName: string;
  programTitle: string;
  programUrl: string;
  isWaitlisted: boolean;
  waitlistPosition?: number | null;
  dateText?: string | null;
  timeText?: string | null;
  locationText?: string | null;
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
       ${detailsBlock}`;

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

  return [
    `Hi ${p.firstName},`,
    "",
    `You're registered for ${p.programTitle}. We look forward to practicing together.`,
    "",
    ...(details ? [details, ""] : []),
    `View program details: ${p.programUrl}`,
    "",
    "—",
    "Rooted In Mindfulness · Brookfield, WI",
    "rootedinmindfulness.org",
  ].join("\n");
}
