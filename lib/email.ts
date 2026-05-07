import { Resend } from "resend";
import { portableTextToMarkdown } from "@/lib/portableTextEmail";
import { isBlockNoteJSON } from "@/lib/renderRichContent";
import { extractTextAsync, renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { db } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

// NEXTAUTH_URL must be set in Vercel env vars (e.g. https://rim-next.vercel.app).
// After DNS cutover, update to https://rootedinmindfulness.org.
// Defensive: trim whitespace + strip trailing slash. A stray space in the
// Vercel env var (we've hit this) lands directly inside email link URLs and
// breaks them mid-string. Trim once here, never have to think about it again.
const BASE_URL =
  (process.env.NEXTAUTH_URL ?? "http://localhost:3000").trim().replace(/\/$/, "");

// TODO: Switch EMAIL_FROM to a verified RIM domain after Resend DNS verification.
const FROM = `Rooted In Mindfulness <${process.env.EMAIL_FROM ?? "onboarding@resend.dev"}>`;

// REGISTRAR_EMAIL — set in Vercel env vars. Used for cancellation notifications.
// Falls back to EMAIL_FROM if not set.
const REGISTRAR_EMAIL =
  process.env.REGISTRAR_EMAIL ?? process.env.EMAIL_FROM ?? "onboarding@resend.dev";

// TEAM_EMAIL — the general team inbox. Used by public-form submission notifications
// (volunteer interest, Kalyana Mitta application, etc.). Configurable via env var.
const TEAM_EMAIL = process.env.TEAM_EMAIL ?? "hello@rootedinmindfulness.org";

// (JESSE_EMAIL + HOST_COORDINATOR_EMAIL removed — post-session feature removed)

// ─── Email template system ───────────────────────────────────────────────────

/**
 * Base CSS applied to every templated email via juice (CSS inlining).
 * Targets standard HTML tags produced by marked so styles survive email clients.
 * The same CSS is applied in the admin preview modal for pixel-identical rendering.
 */
export const EMAIL_BASE_CSS = `
body { font-family: 'Open Sans', Arial, sans-serif; font-size: 16px; line-height: 1.75; color: #333333; }
p { margin: 0 0 16px; font-size: 16px; line-height: 1.75; color: #333333; }
h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 400; line-height: 1.3; margin: 28px 0 12px; color: #135274; }
h3 { font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 400; line-height: 1.3; margin: 20px 0 8px; color: #135274; }
ul, ol { margin: 0 0 16px; padding-left: 24px; }
li { margin: 4px 0; font-size: 16px; line-height: 1.75; color: #333333; }
blockquote { border-left: 3px solid #d5d5d5; margin: 16px 0; padding: 12px 16px; color: #666; }
blockquote p { color: #666; margin: 0; }
a { color: #135274; text-decoration: none; }
a:hover { text-decoration: underline; }
hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
`;

/**
 * Wrap rendered markdown body HTML in RIM's standard email chrome:
 * dark-blue header stripe, white card, 600px max-width, footer.
 * Used by both sendTemplatedEmail (actual send) and the admin preview modal.
 */
export function wrapInEmailChrome(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body>
  <div style="background:#f5f5f5;padding:40px 16px;">
    <div style="max-width:600px;margin:0 auto;">
      <div style="background:#135274;padding:24px 36px;border-radius:4px 4px 0 0;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.8);">Rooted In Mindfulness</p>
      </div>
      <div style="background:#ffffff;padding:36px 36px 28px;">
        ${bodyHtml}
      </div>
      <div style="background:#ffffff;padding:16px 36px 28px;border-top:1px solid #eee;border-radius:0 0 4px 4px;">
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#777;">Rooted In Mindfulness &middot; Brookfield, WI &middot; <a href="https://rootedinmindfulness.org" style="color:#39607a;text-decoration:none;">rootedinmindfulness.org</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Render a markdown template body to fully inlined HTML ready for email delivery.
 *
 * Pipeline:
 *   1. Compile body with Handlebars (variable substitution + conditionals + loops)
 *   2. Render markdown → HTML via marked
 *   3. Wrap in RIM brand chrome (header bar + card + footer)
 *   4. Inline CSS via juice for email-client compatibility
 *
 * Same function used at send time AND in the admin preview modal —
 * guarantees what Jesse sees in preview is pixel-identical to what
 * recipients receive.
 *
 * Variables can be a flat record of strings (legacy callers) or any
 * Handlebars-compatible context (objects, arrays, booleans for {{#if}}).
 */
export async function renderTemplateToHtml(
  markdown: string,
  variables: Record<string, unknown> = {},
): Promise<string> {
  const { marked } = await import("marked");
  const juice = (await import("juice")).default;
  const Handlebars = (await import("handlebars")).default;
  const compiled = Handlebars.compile(markdown, { noEscape: true })(variables);
  const bodyHtml = await marked(compiled);
  const wrapped = wrapInEmailChrome(bodyHtml);
  return juice(wrapped, { extraCss: EMAIL_BASE_CSS, removeStyleTags: true });
}

/**
 * Render the plain-text fallback for an email.
 * If a textBody template is provided, compile it with Handlebars.
 * Otherwise, derive a readable text version from the markdown body source.
 */
export async function renderTemplateToText(
  markdownBody: string,
  textBody: string | null,
  variables: Record<string, unknown> = {},
): Promise<string> {
  const Handlebars = (await import("handlebars")).default;
  const source = textBody && textBody.trim().length > 0 ? textBody : markdownBody;
  return Handlebars.compile(source, { noEscape: true })(variables);
}

/**
 * Send a transactional email from the database template system.
 *
 * - Fetches the EmailTemplate record by slug from the DB.
 * - If the template doesn't exist OR enabled = false, silently returns (no-op).
 * - Substitutes {{variableName}} tokens in both subject and body.
 * - Converts the markdown body to inlined HTML via marked + juice.
 * - Sends via Resend.
 *
 * Errors are caught and logged — a failed templated email must never throw.
 */
export interface TemplatedEmailOptions {
  /**
   * If true, the function rethrows on send failure instead of swallowing.
   * Used for emails where the caller must surface delivery errors
   * (e.g. NextAuth magic link).
   */
  throwOnFailure?: boolean;

  /**
   * Optional file attachments passed straight through to Resend.
   * Each entry is { filename, content }. content can be a string
   * (e.g., for .ics calendar files) or a Buffer.
   */
  attachments?: { filename: string; content: string | Buffer }[];
}

export async function sendTemplatedEmail(
  slug: string,
  to: string,
  variables: Record<string, unknown>,
  options: TemplatedEmailOptions = {},
): Promise<void> {
  try {
    const template = await db.emailTemplate.findUnique({ where: { slug } });
    if (!template || !template.enabled) {
      // Normal path: silently no-op on disabled/missing templates so a
      // disabled email doesn't break the calling flow.
      // Critical path (throwOnFailure): rethrow so the caller — typically
      // NextAuth's sendVerificationRequest — surfaces the failure to the
      // user with the same "Please try again" message they'd see on a
      // network error. Without this, an accidentally-disabled magic-link
      // template would silently swallow every sign-in attempt.
      if (options.throwOnFailure) {
        throw new Error(`Email template "${slug}" is missing or disabled`);
      }
      return;
    }

    const Handlebars = (await import("handlebars")).default;
    const subject = Handlebars.compile(template.subject, { noEscape: true })(variables);
    const html    = await renderTemplateToHtml(template.body, variables);
    const text    = await renderTemplateToText(template.body, template.textBody, variables);

    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
      ...(options.attachments && options.attachments.length > 0
        ? { attachments: options.attachments }
        : {}),
    });
    if (error) {
      console.error(`[email] sendTemplatedEmail(${slug}) failed:`, error);
      if (options.throwOnFailure) {
        throw new Error(`Failed to send ${slug} email: ${error.message ?? "unknown error"}`);
      }
    }
  } catch (e) {
    console.error(`[email] sendTemplatedEmail(${slug}) threw:`, e);
    if (options.throwOnFailure) throw e;
  }
}

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
 * Managed via Email Template Manager — template: "registration-confirmation"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendRegistrationEmail(data: RegistrationEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, status, waitlistPosition, dateText, locationText } = data;
  const isWaitlisted = status === "WAITLISTED";
  await sendTemplatedEmail("registration-confirmation", to, {
    firstName,
    programTitle,
    programUrl: `${BASE_URL}/programs/${programSlug}`,
    isWaitlisted,
    waitlistPosition: waitlistPosition ?? null,
    dateText: dateText ?? "",
    locationText: locationText ?? "",
    confirmationMessageHtml: data.confirmationMessageHtml ?? "",
    googleCalendarUrl: data.googleCalendarUrl ?? "",
    icsUrl: data.icsUrl ?? "",
  });
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
 * Managed via Email Template Manager — template: "waitlist-approval"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, danaMode } = data;
  await sendTemplatedEmail("waitlist-approval", to, {
    firstName,
    programTitle,
    programUrl: `${BASE_URL}/programs/${programSlug}/register`,
    hasDana: !!danaMode && danaMode !== "none",
  });
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
 * Managed via Email Template Manager — template: "registration-cancelled-internal"
 * Recipient is REGISTRAR_EMAIL (env var), not the registrant.
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendCancellationNotificationEmail(
  data: CancellationNotificationData
): Promise<void> {
  const { registrantName, registrantEmail, programTitle, programSlug } = data;
  await sendTemplatedEmail("registration-cancelled-internal", REGISTRAR_EMAIL, {
    registrantName,
    registrantEmail,
    programTitle,
    volunteerUrl: `${BASE_URL}/account/hub/registrar/programs/${programSlug}`,
  });
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
 * Managed via Email Template Manager — template: "edit-request"
 * The link contains a single-use token that expires after 7 days.
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendEditRequestEmail(data: EditRequestEmailData): Promise<void> {
  const { to, firstName, programTitle, token } = data;
  await sendTemplatedEmail("edit-request", to, {
    firstName,
    programTitle,
    editUrl: `${BASE_URL}/update/${token}`,
  });
}

// ─── Responses-updated notification email (to registrar) ─────────────────────

export interface ResponsesUpdatedEmailData {
  registrantName: string;
  programTitle: string;
  programSlug: string;
}

/**
 * Sent to REGISTRAR_EMAIL when a registrant submits their self-service response update.
 * Managed via Email Template Manager — template: "responses-updated-internal"
 * Recipient is REGISTRAR_EMAIL (env var), not the registrant.
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendResponsesUpdatedEmail(data: ResponsesUpdatedEmailData): Promise<void> {
  const { registrantName, programTitle, programSlug } = data;
  await sendTemplatedEmail("responses-updated-internal", REGISTRAR_EMAIL, {
    registrantName,
    programTitle,
    volunteerUrl: `${BASE_URL}/account/hub/registrar/programs/${programSlug}`,
  });
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
 * Managed via Email Template Manager — template: "dana-reminder"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendDanaReminderEmail(data: DanaReminderEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug } = data;
  await sendTemplatedEmail("dana-reminder", to, {
    firstName,
    programTitle,
    registerUrl: `${BASE_URL}/programs/${programSlug}/register`,
  });
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
  // Accepts either Tiptap JSON (from Postgres) or Portable Text array (legacy).
  // Tiptap JSON has { type: "doc", content: [...] }. Portable Text is an array of blocks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reminderMessage?: any;
}

/**
 * Sent to a registrant as a reminder about an upcoming program.
 * Managed via Email Template Manager — template: "session-reminder"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendReminderEmail(data: ReminderEmailData): Promise<void> {
  const locationText = data.locationLink
    ? `[${data.locationText}](${data.locationLink})`
    : (data.locationText ?? "");

  // Render reminder message — detect BlockNote JSON vs Portable Text
  let reminderMessage = "";
  if (data.reminderMessage) {
    if (isBlockNoteJSON(data.reminderMessage)) {
      // BlockNote JSON — extract plain text for email template
      reminderMessage = await extractTextAsync(data.reminderMessage);
    } else if (Array.isArray(data.reminderMessage) && data.reminderMessage.length > 0) {
      // Legacy Portable Text array
      reminderMessage = portableTextToMarkdown(data.reminderMessage);
    }
  }

  await sendTemplatedEmail("session-reminder", data.to, {
    firstName:       data.firstName,
    programTitle:    data.programTitle,
    dateText:        data.dateText ?? "",
    locationText,
    reminderMessage,
    dashboardUrl:    `${BASE_URL}/account/dashboard`,
  });
}


// ─── Role assignment notification (to new registrar) ─────────────────────────

export interface RoleAssignmentEmailData {
  to: string;
  firstName: string | null;
}

/**
 * Sent to a member when they are granted the REGISTRAR role.
 * Managed via Email Template Manager — template: "registrar-role-assigned"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendRoleAssignmentEmail(data: RoleAssignmentEmailData): Promise<void> {
  await sendTemplatedEmail("registrar-role-assigned", data.to, {
    firstName:    data.firstName,
    dashboardUrl: `${BASE_URL}/volunteer`,
    manualUrl:    `${BASE_URL}/admin/manual`,
  });
}


// ─── Host role assignment notification (to new host) ─────────────────────────

/**
 * Sent to a member when they are granted the HOST role.
 * Managed via Email Template Manager — template: "host-role-assigned"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendHostRoleAssignmentEmail(data: RoleAssignmentEmailData): Promise<void> {
  await sendTemplatedEmail("host-role-assigned", data.to, {
    firstName:   data.firstName ?? "there",
    hostAreaUrl: `${BASE_URL}/account/hub/host-team`,
    manualUrl:   `${BASE_URL}/admin/manual`,
  });
}

// ─── Host coordinator (HOST_MANAGER) role assignment notification ─────────────

/**
 * Sent to a member when they are granted the HOST_MANAGER role.
 *
 * Bypasses the template manager — copy was approved at build time and
 * coordinator onboarding is a low-iteration email. Uses marked + wrapInEmailChrome
 * + juice for proper RIM brand chrome, matching how managed templates render.
 *
 * From address: same module-level FROM constant as all other emails.
 * Fire-and-forget — caller wraps in .catch(() => {}).
 */
export async function sendHostManagerRoleAssignmentEmail(
  data: RoleAssignmentEmailData
): Promise<void> {
  const firstName = data.firstName ?? "there";
  const hostHubUrl  = `${BASE_URL}/account/hub/host-team`;
  const scheduleUrl = `${BASE_URL}/tools/schedule`;
  const manualUrl   = `${BASE_URL}/admin/manual/host-hub-team-management`;

  const markdown = `Hi ${firstName},

You've been added as the host coordinator for RIM's virtual host team. This note is to make sure you know where everything lives before you need it.

## Your role

The coordinator is the team's main point of contact — not Jesse. You train new hosts, manage the schedule, support teammates when sessions get complicated, and hold the pastoral side of the work alongside the logistics. Jesse is available for anything that needs a teacher's attention; day-to-day the team looks to you.

## Where to start

**The Host Hub** — your team's home. Conversations, documents, the full member list. There's a welcome message there that hosts see when they arrive; it's yours to write.

**The Host Schedule** — where you manage coverage. You can view any host's assignments (not just your own), create and manage standing rotations, and reassign sessions when someone is unavailable.

**The Staff Manual** — the manual has chapters on the host role and the schedule tool, and as the coordinator you'll want to read them both. More chapters specifically for coordinator work are coming soon.

[Open the Host Hub](${hostHubUrl})
[View the Host Schedule](${scheduleUrl})
[Read the Manual](${manualUrl})`;

  const { marked } = await import("marked");
  const juice = (await import("juice")).default;
  const bodyHtml = await marked(markdown);
  const wrapped = wrapInEmailChrome(bodyHtml);
  const html = juice(wrapped, { extraCss: EMAIL_BASE_CSS });

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: "Welcome, host coordinator — your hub is ready",
      html,
    });
  } catch (e) {
    console.error("[email] sendHostManagerRoleAssignmentEmail failed:", e);
  }
}

// ─── Host Community Hub emails ───────────────────────────────────────────────

export interface SubRequestEmailData {
  to: string;
  firstName: string | null;
  requesterName: string;
  programName: string;
  sessionDate: string | null; // formatted date string, or null for standing
  message: string | null;
  subRequestId: string;       // for deep-link "Cover this session" button
}

/**
 * Sent to all hosts when a sub request is posted.
 * Managed via Email Template Manager — template: "sub-request-posted"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 *
 * Template variables:
 *   {{coverUrl}} — deep link that opens the schedule with the cover modal
 *                  pre-opened on the right session. Recipient confirms in one tap.
 *   {{hubUrl}}   — fallback link to the schedule page
 */
export async function sendSubRequestEmail(data: SubRequestEmailData): Promise<void> {
  const sessionLabel = data.sessionDate ? ` on ${data.sessionDate}` : "";
  await sendTemplatedEmail("sub-request-posted", data.to, {
    firstName:     data.firstName ?? "there",
    requesterName: data.requesterName,
    programName:   data.programName,
    sessionDate:   sessionLabel,
    message:       data.message ?? "",
    hubUrl:        `${BASE_URL}/tools/schedule`,
    coverUrl:      `${BASE_URL}/tools/schedule?action=cover&id=${data.subRequestId}`,
  });
}

export interface SubClaimedEmailData {
  to: string;
  firstName: string | null;
  claimerName: string;
  programName: string;
  sessionDate: string | null;
  message: string | null;
}

/**
 * Sent to the requesting host when their sub request is claimed.
 * Managed via Email Template Manager — template: "sub-request-claimed"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendSubClaimedEmail(data: SubClaimedEmailData): Promise<void> {
  const sessionLabel = data.sessionDate ? ` on ${data.sessionDate}` : "";
  await sendTemplatedEmail("sub-request-claimed", data.to, {
    firstName:   data.firstName ?? "there",
    claimerName: data.claimerName,
    programName: data.programName,
    sessionDate: sessionLabel,
    message:     data.message ?? "",
    hubUrl:      `${BASE_URL}/tools/schedule`,
  });
}

export interface NewProgramNeedsHostEmailData {
  to: string;
  firstName: string | null;
  programName: string;
  programFormat: string; // "Virtual" or "In-person and virtual"
}

/**
 * Sent to active host-team members when a new virtual or hybrid program
 * is created. Heads-up that a new program may need host coverage.
 * Managed via Email Template Manager — template: "new-program-needs-host"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendNewProgramNeedsHostEmail(data: NewProgramNeedsHostEmailData): Promise<void> {
  await sendTemplatedEmail("new-program-needs-host", data.to, {
    firstName:     data.firstName,
    programName:   data.programName,
    programFormat: data.programFormat,
    scheduleUrl:   `${BASE_URL}/tools/schedule`,
  });
}

// ─── Standing assignment scheduled notification ───────────────────────────────

export interface StandingAssignmentScheduledEmailData {
  to: string;
  firstName: string | null;
  sessions: Array<{ programName: string; dateLabel: string }>;
}

/**
 * Sent to a host when standing-assignment logic auto-creates one or more
 * HostAssignment records for them. Groups all newly scheduled sessions for
 * that host into a single email so they don't receive one per session.
 *
 * Bypasses the template manager — content is straightforward and doesn't
 * need coordinator editing.
 */
export async function sendStandingAssignmentScheduledEmail(
  data: StandingAssignmentScheduledEmailData
): Promise<void> {
  if (data.sessions.length === 0) return;
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  const subject =
    count === 1
      ? `You're scheduled to host ${data.sessions[0].programName}`
      : `You're scheduled to host ${count} sessions this month`;
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been applied. You're scheduled to host the following ${count === 1 ? "session" : "sessions"}:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>If you need coverage for any of these, <a href="${BASE_URL}/tools/schedule" style="color:#135274;">post a sub-request</a> from the Host Schedule.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing host rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentScheduledEmail failed:", e);
  }
}

/**
 * Sent to a host when a coordinator's rotation change DISPLACED them from one
 * or more sessions they were previously scheduled to host. Soft, informational
 * tone — the coordinator made a deliberate change; the host is just being
 * informed.
 */
export async function sendStandingAssignmentReplacedEmail(
  data: StandingAssignmentScheduledEmailData
): Promise<void> {
  if (data.sessions.length === 0) return;
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  const subject =
    count === 1
      ? `You're no longer hosting ${data.sessions[0].programName} on ${data.sessions[0].dateLabel}`
      : `You've been replaced on ${count} upcoming sessions`;
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your hosting coordinator has updated the standing rotation. You're no longer scheduled to host the following ${count === 1 ? "session" : "sessions"}:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>If you have questions about this change, please reach out to your coordinator. You can see your current schedule any time on the <a href="${BASE_URL}/tools/schedule" style="color:#135274;">Host Schedule</a>.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing host rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentReplacedEmail failed:", e);
  }
}

/**
 * Sent to a host when a coordinator ENDS their rotation with the "release
 * future assignments" option. Tells them which upcoming sessions were cleared
 * from their schedule so they're not surprised.
 */
export async function sendStandingAssignmentReleasedEmail(
  data: StandingAssignmentScheduledEmailData
): Promise<void> {
  if (data.sessions.length === 0) return;
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  const subject =
    count === 1
      ? `Your hosting rotation has ended`
      : `Your hosting rotation has ended (${count} sessions cleared)`;
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been ended. The following upcoming ${count === 1 ? "session has" : "sessions have"} been cleared from your schedule:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>Thank you for the time you've contributed. If this was unexpected or you'd like to talk about it, please reach out to your coordinator.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing host rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentReleasedEmail failed:", e);
  }
}

// ── Removed: sendNewThreadEmail + NewThreadEmailData (session 76) ────────────
// Superseded by sendHubConvNewThreadEmail (generic, any hub). Zero call sites.

// ── Removed: sendNewReplyEmail + NewReplyEmailData (session 76) ──────────────
// Superseded by sendHubConvNewReplyEmail (generic, any hub). Zero call sites.

// ─── Hub Conversation Notifications (generic, any hub) ───────────────────────

export interface HubConvNewThreadEmailData {
  to: string;
  firstName: string | null;
  authorName: string;
  hubName: string;
  hubSlug: string;
  threadTitle: string;
  threadId: string;
}

/**
 * Sent to hub coordinators when a new conversation thread is created.
 * Works for any hub — not hardcoded to a specific hub.
 */
export async function sendHubConvNewThreadEmail(data: HubConvNewThreadEmailData): Promise<void> {
  await sendTemplatedEmail("hub-conv-new-thread", data.to, {
    firstName:   data.firstName,
    authorName:  data.authorName,
    hubName:     data.hubName,
    threadTitle: data.threadTitle,
    threadUrl:   `${BASE_URL}/account/hub/${data.hubSlug}/conversations/${data.threadId}`,
  });
}

export interface HubConvNewReplyEmailData {
  to: string;
  firstName: string | null;
  replierName: string;
  hubName: string;
  hubSlug: string;
  threadTitle: string;
  threadId: string;
}

/**
 * Sent to thread participants when a new reply is posted.
 * Works for any hub — not hardcoded to a specific hub.
 */
export async function sendHubConvNewReplyEmail(data: HubConvNewReplyEmailData): Promise<void> {
  await sendTemplatedEmail("hub-conv-new-reply", data.to, {
    firstName:   data.firstName,
    replierName: data.replierName,
    hubName:     data.hubName,
    threadTitle: data.threadTitle,
    threadUrl:   `${BASE_URL}/account/hub/${data.hubSlug}/conversations/${data.threadId}`,
  });
}

// ─── Hub Welcome Email ───────────────────────────────────────────────────────

export interface HubWelcomeEmailData {
  to: string;
  firstName: string | null;
  hubName: string;
  hubUrl: string;
}

/**
 * Sent when a member is added to a hub — either by a coordinator manually
 * or automatically via syncHubMembership when a role is granted.
 * Fire-and-forget in both call sites. Errors are logged, never thrown.
 */
export async function sendHubWelcomeEmail(data: HubWelcomeEmailData): Promise<void> {
  await sendTemplatedEmail("hub-welcome", data.to, {
    firstName: data.firstName,
    hubName:   data.hubName,
    hubUrl:    data.hubUrl,
  });
}

// ─── Public form submission notifications (to TEAM_EMAIL) ────────────────────

export interface VolunteerInterestEmailData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  interests: string;
}

/**
 * Sent to TEAM_EMAIL when a member submits the volunteer interest form.
 * Managed via Email Template Manager — template: "volunteer-interest-internal"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendVolunteerInterestEmail(data: VolunteerInterestEmailData): Promise<void> {
  await sendTemplatedEmail("volunteer-interest-internal", TEAM_EMAIL, {
    firstName: data.firstName,
    lastName:  data.lastName,
    email:     data.email,
    phone:     data.phone ?? "",
    interests: data.interests,
  });
}

export interface KalyanaApplicationEmailData {
  firstName: string;
  lastName: string;
  email: string;
  idea: string;
}

/**
 * Sent to TEAM_EMAIL when a member submits the Kalyana Mitta group application.
 * Managed via Email Template Manager — template: "kalyana-application-internal"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendKalyanaApplicationEmail(data: KalyanaApplicationEmailData): Promise<void> {
  await sendTemplatedEmail("kalyana-application-internal", TEAM_EMAIL, {
    firstName: data.firstName,
    lastName:  data.lastName,
    email:     data.email,
    idea:      data.idea,
  });
}

// ─── Magic link email (authentication) ───────────────────────────────────────

/**
 * Sends the NextAuth magic link email for sign-in / account creation.
 * Managed via Email Template Manager — two templates:
 *   - "magic-link-new-user"  (subject + copy for first-time visitors)
 *   - "magic-link-returning" (subject + copy for existing members)
 *
 * Both are flagged ⚠️ CRITICAL in their descriptions because disabling
 * one breaks authentication. We pass throwOnFailure so a disabled or
 * missing template surfaces as a failure to NextAuth (which then shows
 * "Failed to send sign-in email. Please try again." to the user) rather
 * than silently swallowing the sign-in.
 *
 * The {{url}} variable is the NextAuth-generated time-limited token,
 * injected at call time.
 */
export async function sendMagicLinkEmail({
  to,
  url,
  isNewUser,
}: {
  to: string;
  url: string;
  isNewUser: boolean;
}): Promise<void> {
  try {
    await sendTemplatedEmail(
      isNewUser ? "magic-link-new-user" : "magic-link-returning",
      to,
      { url },
      { throwOnFailure: true },
    );
  } catch (e) {
    console.error("[email] Failed to send magic link email:", e);
    // Re-throw with the user-facing message so NextAuth surfaces it.
    throw new Error("Failed to send sign-in email. Please try again.");
  }
}

// (post-session notification function removed — feature removed in session 76)

// ── Removed: Attendance automated emails + SessionAttendance recording itself
// (session 89 — abandoned session-reflection module dropped pre-launch).

// ─── MISSING REPORT NOTIFICATION ─────────────────────────────────────────────
// Managed via Email Template Manager — copy lives in DB, not here.
// ── Removed: sendMissingReportEmail + MissingReportEmailData (session 76) ────
// Used "missing-report-alert" template via sendTemplatedEmail. Cron still exists
// at /api/cron/missing-reports but was calling this with zero active callers.
// Restore from git history if the missing-reports cron is re-enabled.

// ─── Drip / Scheduled Lesson Release ─────────────────────────────────────────

export interface DripLessonAvailableData {
  to: string;
  memberFirstName: string;
  lessonTitle: string;
  seriesTitle: string;
  lessonUrl: string;
}

export async function sendDripLessonAvailableEmail(data: DripLessonAvailableData): Promise<void> {
  await sendTemplatedEmail("drip-lesson-available", data.to, {
    memberFirstName: data.memberFirstName,
    lessonTitle: data.lessonTitle,
    seriesTitle: data.seriesTitle,
    lessonUrl: data.lessonUrl,
  });
}
