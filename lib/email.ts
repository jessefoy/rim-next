import { Resend } from "resend";
import { portableTextToMarkdown } from "@/lib/portableTextEmail";
import { isBlockNoteJSON } from "@/lib/renderRichContent";
import { extractTextAsync, renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { db } from "@/lib/db";

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
    if (!template || !template.enabled) return;

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


// ─── Host role assignment notification (to new Meet host) ────────────────────

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
 * HARDCODED — must stay. Do NOT migrate to the template system.
 *
 * Why must stay: called from auth.ts sendVerificationRequest as part of the
 * NextAuth authentication contract. The URL is a signed, time-limited token
 * generated by NextAuth — it must be injected at call time and cannot be
 * pre-stored or sent through the async template pipeline. Also rethrows on
 * failure (unlike all other email functions) so NextAuth can surface the error.
 *
 * Variables: url (NextAuth magic link), isNewUser (controls subject + body copy)
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
<body style="margin:0;padding:24px 0;background-color:#f5f5f5;font-family:Georgia,'Times New Roman',serif;">
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
                line-height:1.6;color:#777;">
        If you didn&#39;t request this link, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding:20px 36px 28px;border-top:1px solid #eee;">
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#777;">
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
