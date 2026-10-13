import { Resend } from "resend";
import { portableTextToMarkdown } from "@/lib/portableTextEmail";
import { isBlockNoteJSON } from "@/lib/renderRichContent";
import { extractTextAsync, renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { db } from "@/lib/db";
import { DEFAULT_HOSTING_HUB_SLUG, getHubCoverageCopy } from "@/lib/programHub";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { RIM_ADDRESS, RIM_EIN, RIM_LEGAL_NAME } from "@/lib/locations";
import { FORM_KIND, formNoticeSubject } from "@/lib/formSubmissions";

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

// SUPPORT_EMAIL — the team inbox notified on every new registration (LorieLee
// request). Defaults to the known address; override via env if it ever changes.
const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ?? "support@rootedinmindfulness.org";

// ─── URL helpers for hub-scoped links ────────────────────────────────────────
//
// Slice 2.5 (2026-05-22) discovered every outbound email URL was hub-agnostic
// — the link in a sub-request notification just said /tools/schedule, so a
// multi-hub member (Nancy, both host-team + peer-led-silent-meditation) would
// land in the default host-team view regardless of which hub the email was
// about. Closed by these two helpers:
//
//   hubScopedUrl(path, hubSlug)
//     For /tools/* and similar paths where the hub is a query-param scope
//     of a shared tool. Appends ?hub=<slug> when slug is given and isn't
//     the host-team default (the schedule page treats null/missing/host-team
//     as the same; skipping the param keeps URLs clean in host-team emails).
//
//   hubHomeUrl(hubSlug)
//     For /account/hub/<slug>/* paths where the hub IS the path. Always
//     uses the supplied slug; never falls back to a default.
//
// Both compose with BASE_URL so the trailing-whitespace defense (line 14)
// is honored automatically. See RIM_Email_Engineering.md for the full
// pattern + when to use which.

/**
 * NOTE: pass `path` without a `#fragment` — fragments must come AFTER query
 * parameters in valid URLs, and this helper appends `?hub=` / `&hub=` so a
 * fragment in `path` would land in the wrong position.  No callsite uses
 * fragments today; revisit if one needs to.
 */
export function hubScopedUrl(path: string, hubSlug?: string | null): string {
  const base = `${BASE_URL}${path}`;
  if (!hubSlug || hubSlug === DEFAULT_HOSTING_HUB_SLUG) return base;
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${sep}hub=${encodeURIComponent(hubSlug)}`;
}

export function hubHomeUrl(hubSlug: string): string {
  return `${BASE_URL}/account/hub/${hubSlug}`;
}

/**
 * Canonical CTA button for emails.  Inline-styled (email clients strip
 * stylesheets) and centered.  Use this for any "do the thing" link that
 * deserves visual emphasis — sub-request cover, claim, enroll, etc.
 *
 * Templates pass this rendered HTML as a variable (e.g. `{{coverButton}}`)
 * rather than building the markup themselves, so the visual style stays
 * consistent across every email and updates here propagate automatically.
 *
 * Per RIM_Email_Engineering.md.  The site's own button: a pill in
 * `--rim-blue` (#31576D), 16px semibold (2026-10-13; was the pre-flip
 * teal #135274 with 6px corners).
 */
export function emailButtonHtml(label: string, url: string): string {
  // Outer table is the Outlook-safe centering trick — div text-align fails
  // there.  Padded anchor is the button itself; bgcolor mirrors the CSS bg
  // for clients that strip CSS.
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:28px auto;">
  <tr>
    <td bgcolor="#31576D" style="border-radius:999px;background-color:#31576D;">
      <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:'Open Sans',Arial,sans-serif;font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;
}

// Public form notices (2026-10-13): each form goes to the people who act on it,
// as the old site's Zaps did, and Jesse gets every one to keep track.
const VOLUNTEER_FORM_TO = "volunteer@rootedinmindfulness.org";
const KALYANA_MITTA_FORM_TO = ["jesse@rootedinmindfulness.org", "KalyanaMitta@rootedinmindfulness.org"];
const FORM_COPY_TO = "jesse@rootedinmindfulness.org";

// (JESSE_EMAIL + HOST_COORDINATOR_EMAIL removed — post-session feature removed)

// ─── Email template system ───────────────────────────────────────────────────

/**
 * Base CSS applied to every templated email via juice (CSS inlining).
 * Targets standard HTML tags produced by marked so styles survive email clients.
 * The same CSS is applied in the admin preview modal for pixel-identical rendering.
 */
export const EMAIL_BASE_CSS = `
body { margin: 0; padding: 0; background: #F6F3F0; font-family: 'Open Sans', Arial, sans-serif; font-size: 17px; line-height: 1.8; color: #333333; }
p { margin: 0 0 30px; font-size: 17px; line-height: 1.8; color: #333333; }
h2 { font-family: Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif; font-size: 24px; font-weight: 400; line-height: 1.3; margin: 8px 0 16px; color: #333333; }
h3 { font-family: Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif; font-size: 20px; font-weight: 400; line-height: 1.3; margin: 8px 0 12px; color: #333333; }
ul, ol { margin: 0 0 30px; padding-left: 24px; }
li { margin: 4px 0; font-size: 17px; line-height: 1.8; color: #333333; }
blockquote { border-left: 3px solid #D7D7D7; margin: 0 0 30px; padding: 4px 18px; color: #555555; }
blockquote p { color: #555555; margin: 0; }
a { color: #31576D; text-decoration: underline; }
hr { border: none; border-top: 1px solid #E6E1DB; margin: 30px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
`;

/**
 * Wrap rendered body HTML in RIM's email chrome, matching Jesse's Flodesk
 * template (2026-10-13, measured from the shared template): a warm off-white
 * page (#F6F3F0), the lotus logo (90px; 56px on phones) and "Rooted In
 * Mindfulness" in Baskerville centered on it, the message on a white 600px
 * panel with 40px padding (Open Sans 17px / 1.8, #333), and below it a short
 * rule and the address in small Baskerville. No unsubscribe line: these are
 * system emails (Jesse); Flodesk carries the mass email that needs one.
 * Tables for Outlook. Used by every email the app sends and by the admin
 * preview, so what /admin/emails shows is what members receive.
 */
export function wrapInEmailChrome(bodyHtml: string): string {
  const serif = "Baskerville,'Baskerville Old Face','Libre Baskerville',Georgia,serif";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <style>
    @media only screen and (max-width: 480px) {
      .rim-email-logo { width: 56px !important; height: 56px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F6F3F0;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F6F3F0" style="background:#F6F3F0;">
    <tr>
      <td align="center" style="padding:45px 0 0;">
        <img src="${BASE_URL}/images/email-logo.png" width="90" height="90" alt="Rooted In Mindfulness" class="rim-email-logo" style="display:block;width:90px;height:90px;border:0;">
        <p style="margin:20px 10px 45px;font-family:${serif};font-size:28px;line-height:1.3;font-weight:400;color:#333333;text-align:center;">Rooted In Mindfulness</p>
      </td>
    </tr>
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="max-width:600px;background:#ffffff;">
          <tr>
            <td style="padding:40px 40px 10px;text-align:left;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding:70px 10px 50px;">
        <table role="presentation" width="150" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid #D7D7D7;font-size:0;line-height:0;">&nbsp;</td></tr></table>
        <p style="margin:30px 0 0;font-family:${serif};font-size:12px;line-height:1.8;color:#6E6E6E;text-align:center;">Rooted In Mindfulness &middot; ${RIM_ADDRESS}</p>
      </td>
    </tr>
  </table>
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
   * (e.g. NextAuth sign-in code).
   */
  throwOnFailure?: boolean;

  /**
   * Optional file attachments passed straight through to Resend.
   * Each entry is { filename, content }. content can be a string
   * (e.g., for .ics calendar files) or a Buffer.
   */
  attachments?: { filename: string; content: string | Buffer }[];

  /** Blind copy (the form notices copy Jesse). */
  bcc?: string;

  /** Reply-To, so a staff notice can be answered straight to the sender. */
  replyTo?: string;

  /**
   * Replaces the template's subject. Only for a label code must keep
   * consistent (the form notices' "RIM form · Kind · Name").
   */
  subject?: string;
}

// ─── Pre-threshold notification gate ─────────────────────────────────────────
//
// An admin can stage a person in the system before that person has ever logged
// in — e.g. pre-populating the host team before launch: create the account,
// assign the HOST role, put them on the schedule. A staged account exists with
// `emailVerified = null` until they complete their first sign-in.
//
// While they're still a placeholder, member-directed TEAM notifications
// (role-assigned, hub-welcome, host/standing-assignment) must not reach them —
// they'd be confused by "you're scheduled to host" for a system they've never
// seen. The rule: suppress those emails when the recipient has an account that
// hasn't completed sign-in. The moment they log in (emailVerified is set),
// every email flows normally.
//
// NOT applied to sign-in codes or the join-welcome letter — those MUST reach a
// mid-signup person whose emailVerified is still null. Only the role/hub/host
// builders are gated: the templated ones via PRE_THRESHOLD_GATED_SLUGS inside
// sendTemplatedEmail, the hardcoded (resend-direct) ones via an inline call.
async function recipientHasOnboarded(to: string): Promise<boolean> {
  try {
    // `to` is expected to be a bare email (every gated callsite passes one). A
    // display-name-wrapped address ("Name <e@x>") would miss the lookup and
    // fail open (send) — acceptable, and not a shape any current caller uses.
    const u = await db.user.findUnique({
      where: { email: to.trim().toLowerCase() },
      select: { emailVerified: true },
    });
    if (!u) return true;             // not a member record (external addr) — never suppress
    return u.emailVerified !== null; // known account that hasn't signed in → suppress
  } catch (e) {
    // Fail open: a DB hiccup must not silently swallow a real notification.
    console.error("[email] recipientHasOnboarded lookup failed; sending anyway:", e);
    return true;
  }
}

// Templated, member-directed team notifications gated by the rule above. Kept as
// a set so the check lives in one place inside sendTemplatedEmail rather than
// scattered across every builder. Auth + welcome + registration/dana slugs are
// deliberately absent — those legitimately reach mid-signup or non-member people.
//
// Two-layer model (keep them in sync):
//   • POOL emails (recipients from getHubNotificationRecipients —
//     new-program-needs-host, sub-request-*) are gated at the source: that
//     helper already excludes emailVerified:null members, so they DON'T need to
//     be listed here, and any future pool email is covered automatically.
//   • DIRECT / subscription / author-picked emails to a specific member are
//     listed here because they bypass that pool. A future member-directed hub
//     email of that kind must be added to this set.
const PRE_THRESHOLD_GATED_SLUGS = new Set<string>([
  "registrar-role-assigned",
  "host-role-assigned",
  "host-assignment-confirmation",
  "host-assignment-removed",
  "hub-welcome",
  // Conversation/document notifications go to thread subscribers / author-picked
  // recipients (not the hub pool), so they need explicit gating here.
  "hub-conv-new-thread",
  "hub-conv-new-reply",
  // File notifications go to per-post picked recipients (may include a directly
  // chosen individual), so gate them here too.
  "file-shared",
  "file-comment",
]);

export async function sendTemplatedEmail(
  slug: string,
  to: string | string[],
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
      // network error. Without this, an accidentally-disabled sign-in-code
      // template would silently swallow every sign-in attempt.
      if (options.throwOnFailure) {
        throw new Error(`Email template "${slug}" is missing or disabled`);
      }
      return;
    }

    // Pre-threshold gate: don't send a member-directed team notification to a
    // staged account that hasn't logged in yet. See recipientHasOnboarded.
    // Gated sends go to one member; a list is never checked, so it is held.
    if (
      PRE_THRESHOLD_GATED_SLUGS.has(slug) &&
      (Array.isArray(to) || !(await recipientHasOnboarded(to)))
    ) {
      console.log(`[email] suppressed "${slug}" to pre-threshold account ${to}`);
      return;
    }

    const Handlebars = (await import("handlebars")).default;
    const subject = options.subject ?? Handlebars.compile(template.subject, { noEscape: true })(variables);
    const html    = await renderTemplateToHtml(template.body, variables);
    const text    = await renderTemplateToText(template.body, template.textBody, variables);

    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text,
      ...(options.bcc ? { bcc: options.bcc } : {}),
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
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

// ─── New-registration notification (to support) ──────────────────────────────

export interface RegistrationSupportNotificationData {
  registrantName: string;
  registrantEmail: string;
  programTitle: string;
  programSlug: string;
  status: string;         // RegistrationStatus
  donationStatus: string; // DonationStatus
}

const DANA_STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Received",
  PENDING: "Pending",
  WAIVED: "No dana",
  NOT_REQUIRED: "—",
};

/**
 * Notify support@ that a registration just became official. Fires from inside
 * sendRegistrationConfirmation — the single "registration is now real" choke
 * point — so it covers free (at submit), voluntary (once they give or decline),
 * required (once paid), and waitlist (at submit), and never fires for an
 * abandoned/unpaid hold. LorieLee request.
 * Managed via Email Template Manager — template: "registration-support-notification"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendRegistrationSupportNotification(
  data: RegistrationSupportNotificationData
): Promise<void> {
  const manageUrl = `${BASE_URL}/tools/programs/${data.programSlug}`;
  await sendTemplatedEmail("registration-support-notification", SUPPORT_EMAIL, {
    registrantName: data.registrantName,
    registrantEmail: data.registrantEmail,
    programTitle: data.programTitle,
    status: data.status === "WAITLISTED" ? "Waitlisted" : "Registered",
    danaStatus: DANA_STATUS_LABEL[data.donationStatus] ?? data.donationStatus,
    manageUrl,
    manageButton: emailButtonHtml("View in Program Manager", manageUrl),
  });
}

// ─── Waitlist approval email ─────────────────────────────────────────────────

export interface ApprovalEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  danaMode?: string | null; // if set and not "none", include a dana section
  /** Cents the program requires before the place is held (fixed / base). 0 = optional dana. */
  requiredCents?: number;
}

/**
 * Sent when a registrar promotes someone from WAITLISTED → APPROVED.
 * Managed via Email Template Manager — template: "waitlist-approval"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, danaMode, requiredCents = 0 } = data;
  const paymentRequired = requiredCents > 0;
  await sendTemplatedEmail("waitlist-approval", to, {
    firstName,
    programTitle,
    programUrl: `${BASE_URL}/programs/${programSlug}/register`,
    // Optional dana and a required payment read differently; never both.
    hasDana: !paymentRequired && !!danaMode && danaMode !== "none",
    paymentRequired,
    paymentUsd: (requiredCents / 100).toFixed(2),
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
 * Sent to the registrar when staff cancel a registration.
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
    volunteerUrl: `${BASE_URL}/tools/programs/${programSlug}`,
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
    volunteerUrl: `${BASE_URL}/tools/programs/${programSlug}`,
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

// ─── Course dana receipt (session 123, slice 4) ──────────────────────────────

export interface CourseDanaReceiptEmailData {
  to: string;
  firstName: string;
  courseTitle: string;
  courseSlug: string;
  amountCents: number;
}

/**
 * Sent by the Stripe webhook when a member completes course self-enroll dana.
 * Doubles as enrollment confirmation — the SeriesEnrollment row was created
 * in the same handler, so by the time this lands the member already has access.
 *
 * Managed via Email Template Manager — template: "course-dana-receipt".
 * Email Template Gate: matching seed entry in prisma/migrate.mjs ships with
 * the same commit.
 */
export async function sendCourseDanaReceiptEmail(
  data: CourseDanaReceiptEmailData
): Promise<void> {
  const { to, firstName, courseTitle, courseSlug, amountCents } = data;
  const amountUsd = (amountCents / 100).toFixed(2);
  await sendTemplatedEmail("course-dana-receipt", to, {
    firstName,
    courseTitle,
    amountUsd,
    courseUrl: `${BASE_URL}/course/${courseSlug}`,
  });
}

// ─── Program registration dana receipt (2026-09-24) ─────────────────────────

export interface RegistrationDanaReceiptEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  totalCents: number;
  /** The registration-payment part (fixed amount, or the base of "base + dana"). */
  feeCents: number;
  /** The gift part: voluntary dana, or the extra above a base. */
  giftCents: number;
  paidAt: Date;
}

/**
 * Sent by the Stripe webhook alongside the registration confirmation, once per
 * completed program payment. It is the member's record of what they gave: RIM's
 * legal name and EIN, the gift amount and date, and a goods-or-services
 * statement, with any registration payment named separately from the gift.
 * Wording is provisional pending review by RIM's accountant.
 *
 * Managed via Email Template Manager — template: "registration-dana-receipt"
 * (seeded in prisma/migrate.mjs, same commit).
 */
export async function sendRegistrationDanaReceiptEmail(
  data: RegistrationDanaReceiptEmailData,
): Promise<void> {
  const usd = (cents: number) => (cents / 100).toFixed(2);
  await sendTemplatedEmail("registration-dana-receipt", data.to, {
    firstName: data.firstName || "friend",
    programTitle: data.programTitle,
    totalUsd: usd(data.totalCents),
    feeUsd: usd(data.feeCents),
    giftUsd: usd(data.giftCents),
    hasFee: data.feeCents > 0,
    hasGift: data.giftCents > 0,
    paidDate: data.paidAt.toLocaleDateString("en-US", {
      timeZone: "America/Chicago",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    orgLegalName: RIM_LEGAL_NAME,
    orgEin: RIM_EIN,
    orgAddress: RIM_ADDRESS,
  });
}

// ─── Join welcome email ─────────────────────────────────────────────────────

export interface JoinWelcomeEmailData {
  to: string;
  firstName: string;
}

/**
 * Sent immediately after a new member completes the /join threshold (name +
 * email + agreements). Lands alongside the sign-in code email — the code is
 * the door, this is the embrace. Tone: warm, unhurried, like a letter from a
 * teacher.
 *
 * The onboarding course drip series starts firing separately via
 * enrollMemberInOnboardingSeries; this email is the single one-time letter.
 *
 * Managed via Email Template Manager — template: "join-welcome".
 * Email Template Gate: matching seed entry in prisma/migrate.mjs ships with
 * the same commit.
 */
export async function sendJoinWelcomeEmail(
  data: JoinWelcomeEmailData
): Promise<void> {
  const { to, firstName } = data;
  await sendTemplatedEmail("join-welcome", to, {
    firstName,
    dashboardButton: emailButtonHtml("Visit your dashboard", `${BASE_URL}/account/dashboard`),
    dashboardUrl: `${BASE_URL}/account/dashboard`,
    supportEmail: "support@rootedinmindfulness.org",
  });
}

// ─── Legacy welcome-back email ──────────────────────────────────────────────

export interface LegacyWelcomeBackEmailData {
  to: string;
  firstName: string;
}

/**
 * Sent once when a migrated legacy member (from the old Webflow/Memberstack
 * site) crosses the agreement gate on first login to the new platform — their
 * "promotion" out of the quiet import pool. The returning-member counterpart of
 * sendJoinWelcomeEmail: it acknowledges the rebuilt home rather than welcoming a
 * newcomer. Fired via after() from the two agreement-completion endpoints
 * (complete-profile, join), only when the account was isLegacyUnclaimed before
 * the flip.
 *
 * Managed via Email Template Manager — template: "welcome-back".
 * Email Template Gate: matching seed entry in prisma/migrate.mjs ships with
 * the same commit.
 */
export async function sendLegacyWelcomeBackEmail(
  data: LegacyWelcomeBackEmailData
): Promise<void> {
  const { to, firstName } = data;
  await sendTemplatedEmail("welcome-back", to, {
    firstName,
    dashboardButton: emailButtonHtml("Visit your dashboard", `${BASE_URL}/account/dashboard`),
    dashboardUrl: `${BASE_URL}/account/dashboard`,
    supportEmail: "support@rootedinmindfulness.org",
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
  if (!(await recipientHasOnboarded(data.to))) {
    console.log(`[email] suppressed host-manager role email to pre-threshold account ${data.to}`);
    return;
  }
  const firstName = data.firstName ?? "there";
  const hostHubUrl  = hubHomeUrl(DEFAULT_HOSTING_HUB_SLUG);
  const scheduleUrl = hubScopedUrl("/tools/schedule", DEFAULT_HOSTING_HUB_SLUG);

  const markdown = `Hi ${firstName},

You've been added as the host coordinator for RIM's virtual host team. This note is to make sure you know where everything lives before you need it.

## Your role

The coordinator is the team's main point of contact — not Jesse. You train new hosts, manage the schedule, support teammates when sessions get complicated, and hold the pastoral side of the work alongside the logistics. Jesse is available for anything that needs a teacher's attention; day-to-day the team looks to you.

## Where to start

**The Hosting Team** — your team's home: conversations, files and the full member list. Under the team's name is one line about the team; as coordinator, it's yours to write.

**The Scheduler** — where you manage coverage. You can view any host's assignments (not just your own), create and manage standing rotations, and reassign sessions when someone is unavailable.

[Open the Hosting Team](${hostHubUrl})
[Open the Scheduler](${scheduleUrl})`;

  const { marked } = await import("marked");
  const juice = (await import("juice")).default;
  const bodyHtml = await marked(markdown);
  const wrapped = wrapInEmailChrome(bodyHtml);
  const html = juice(wrapped, { extraCss: EMAIL_BASE_CSS });

  try {
    await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: "Welcome, host coordinator — your team is ready",
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
  /** Hub the program belongs to (Program.hostingHubSlug or "host-team").
   *  Passed to hubScopedUrl so the email link lands the recipient in the
   *  right hub view, not the default host-team. Slice 2.5. */
  hubSlug: string;
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
  const coverUrl = hubScopedUrl(`/tools/schedule?action=cover&id=${data.subRequestId}`, data.hubSlug);
  await sendTemplatedEmail("sub-request-posted", data.to, {
    firstName:     data.firstName ?? "there",
    requesterName: data.requesterName,
    programName:   data.programName,
    sessionDate:   sessionLabel,
    message:       data.message ?? "",
    hubUrl:        hubScopedUrl("/tools/schedule", data.hubSlug),
    coverUrl,
    // New as of Slice 2.5 — canonical CTA button.  Templates can paste
    // {{coverButton}} where they want a prominent "Cover this session"
    // affordance, in place of (or alongside) the plain coverUrl link.
    coverButton:   emailButtonHtml("Cover this session", coverUrl),
  });
}

export interface SubClaimedEmailData {
  to: string;
  firstName: string | null;
  claimerName: string;
  programName: string;
  sessionDate: string | null;
  message: string | null;
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

/**
 * Sent to the requesting host when their sub request is claimed.
 * Managed via Email Template Manager — template: "sub-request-claimed"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendSubClaimedEmail(data: SubClaimedEmailData): Promise<void> {
  const sessionLabel = data.sessionDate ? ` on ${data.sessionDate}` : "";
  const hubUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  await sendTemplatedEmail("sub-request-claimed", data.to, {
    firstName:    data.firstName ?? "there",
    claimerName:  data.claimerName,
    programName:  data.programName,
    sessionDate:  sessionLabel,
    message:      data.message ?? "",
    hubUrl,
    // New as of Slice 2.5 — paste {{scheduleButton}} in the template
    // for a prominent "View your schedule" affordance.
    scheduleButton: emailButtonHtml("View your schedule", hubUrl),
  });
}

export interface NewProgramNeedsHostEmailData {
  to: string;
  firstName: string | null;
  programName: string;
  programFormat: string; // "Virtual" or "In-person and virtual"
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

/**
 * Sent to active host-team members when a new virtual or hybrid program
 * is created. Heads-up that a new program may need host coverage.
 * Managed via Email Template Manager — template: "new-program-needs-host"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendNewProgramNeedsHostEmail(data: NewProgramNeedsHostEmailData): Promise<void> {
  const scheduleUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  const copy = await getHubCoverageCopy(data.hubSlug);
  await sendTemplatedEmail("new-program-needs-host", data.to, {
    firstName:      data.firstName,
    programName:    data.programName,
    programFormat:  data.programFormat,
    coverageNoun:   copy.noun,
    scheduleUrl,
    scheduleButton: emailButtonHtml("Open the schedule", scheduleUrl),
  });
}

/**
 * Notify a hub's team that a program now needs their coverage — the same
 * heads-up the primary host hub gets when a program is created, generalized so
 * EVERY scheduler hub behaves alike: an auxiliary hub (AV / greeter / …) hears
 * about a program tagged for it, on create or when added on edit. Hub-neutral —
 * sendNewProgramNeedsHostEmail resolves the hub's own coverage noun ("needs a
 * greeter" / "needs an AV") and scopes the link; getHubNotificationRecipients
 * applies the ACTIVE + communications + pre-threshold (emailVerified) filters,
 * so staged/legacy members get nothing. Caller wraps in after() — this assumes
 * deferred work.
 */
export async function notifyHubOfNewProgramCoverage(opts: {
  hubSlug: string;
  programName: string;
  programFormat: string | null; // raw Program.programFormat
  excludeUserId?: string;
}): Promise<void> {
  const recipients = await getHubNotificationRecipients(
    opts.hubSlug,
    opts.excludeUserId ? { excludeUserId: opts.excludeUserId } : undefined,
  );
  if (recipients.length === 0) return;
  const programFormat =
    opts.programFormat === "virtual" ? "Virtual"
    : opts.programFormat === "in-person" ? "In-person"
    : "In-person and virtual";
  await Promise.all(
    recipients.map((u) =>
      sendNewProgramNeedsHostEmail({
        to: u.email,
        firstName: u.firstName,
        programName: opts.programName,
        programFormat,
        hubSlug: opts.hubSlug,
      }),
    ),
  );
}

// ─── Host assignment confirmation ──────────────────────────────────────────
//
// Sent to the host every time they become responsible for a session — whether
// they claimed a sub-request, self-claimed an unassigned session, were assigned
// by a manager, or reassigned via the manager override.
//
// Standing rotations have their own batched email (sendStandingAssignmentScheduledEmail,
// hardcoded) because a rotation creates many assignments at once. This template
// is for one-off per-session assignments.
//
// Template variables:
//   firstName, programName, dateText, scheduleUrl, requesterNote (optional)

export interface HostAssignmentConfirmationEmailData {
  to: string;
  firstName: string | null;
  programName: string;
  /** Pre-formatted "Thu, May 22 · 8:15 AM" style label, or null if no session date set. */
  dateText: string | null;
  /** Optional note from the original sub-request, when this confirmation is for a sub-claim. */
  requesterNote?: string | null;
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

export async function sendHostAssignmentConfirmationEmail(
  data: HostAssignmentConfirmationEmailData,
): Promise<void> {
  const scheduleUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  await sendTemplatedEmail("host-assignment-confirmation", data.to, {
    firstName:     data.firstName ?? "there",
    programName:   data.programName,
    dateText:      data.dateText ?? "",
    requesterNote: data.requesterNote ?? "",
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  });
}

// ─── Host assignment removed (displaced by manager reassign) ───────────────
//
// Sent to a host when a manager reassigns their session to someone else.
// Standing rotations use sendStandingAssignmentReplacedEmail (batched, hardcoded);
// this is for the one-off manager-override path on /api/host/assignments/reassign.

export interface HostAssignmentRemovedEmailData {
  to: string;
  firstName: string | null;
  programName: string;
  dateText: string | null;
  /** Name of the person who reassigned (the manager). */
  byName: string;
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

export async function sendHostAssignmentRemovedEmail(
  data: HostAssignmentRemovedEmailData,
): Promise<void> {
  const scheduleUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  await sendTemplatedEmail("host-assignment-removed", data.to, {
    firstName:   data.firstName ?? "there",
    programName: data.programName,
    dateText:    data.dateText ?? "",
    byName:      data.byName,
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  });
}

// ─── Standing assignment scheduled notification ───────────────────────────────
//
// Hub scope (Slice 2.6): standing-assignment emails accept an optional
// hubSlug. Per-program apply paths pass the program's hub so the schedule
// link in the email lands the recipient in the correct hub view. The
// apply-all path (manager-only cross-hub action) doesn't pass it — the
// link falls through to host-team scope, which is acceptable for the rare
// cross-hub case. When the same user's batched sessions span multiple
// hubs, splitting into per-hub emails could be a follow-up.

export interface StandingAssignmentScheduledEmailData {
  to: string;
  firstName: string | null;
  sessions: Array<{ programName: string; dateLabel: string }>;
  /** Hub the rotation belongs to. Omit for cross-hub apply-all calls. */
  hubSlug?: string;
  /** First scheduled session's month in `YYYY-MM` form (CT). When supplied,
   *  the email's "Schedule" link deep-links to that month so the recipient
   *  lands on the actual rows they're scheduled for rather than the current
   *  month, which usually has no rotation-derived rows for them yet. */
  firstSessionMonth?: string;
  /** Role-aware copy (session 130 follow-up). When omitted, defaults to
   *  host-team language ("hosting", "Host"). When the rotation is on AV
   *  / greeter / peer-led, callers should pass the hub's copy so the
   *  email subject + body speak the role's language. */
  coverageCopy?: { noun: string; verb: string; action: string };
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
  if (!(await recipientHasOnboarded(data.to))) {
    console.log(`[email] suppressed standing-assignment-scheduled to pre-threshold account ${data.to}`);
    return;
  }
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  // Role-aware copy: "hosting" → "covering AV" / "greeting" / "facilitating"
  // when the rotation is on a non-host-team hub. Defaults to host language.
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  const subject =
    count === 1
      ? `You're scheduled — ${data.sessions[0].programName}`
      : `You're scheduled for ${count} upcoming sessions`;
  // Deep-link to the month of the FIRST scheduled session when provided.
  const schedulePath = data.firstSessionMonth
    ? `/tools/schedule?month=${data.firstSessionMonth}`
    : "/tools/schedule";
  const scheduleUrl = hubScopedUrl(schedulePath, data.hubSlug);
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been applied. You're scheduled to be ${copy.verb} the following ${count === 1 ? "session" : "sessions"}:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>${emailButtonHtml("Open the Schedule", scheduleUrl)}</p>
<p>If you can't make any of these dates, open the Schedule and use <strong>Ask the team to cover</strong> on that session's row.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing rotation.</p>`;

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
  if (!(await recipientHasOnboarded(data.to))) {
    console.log(`[email] suppressed standing-assignment-replaced to pre-threshold account ${data.to}`);
    return;
  }
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  const subject =
    count === 1
      ? `You're no longer ${copy.verb} ${data.sessions[0].programName} on ${data.sessions[0].dateLabel}`
      : `You've been replaced on ${count} upcoming sessions`;
  const scheduleUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your coordinator has updated the standing rotation. You're no longer scheduled to be ${copy.verb} the following ${count === 1 ? "session" : "sessions"}:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>If you have questions about this change, please reach out to your coordinator. You can see your current schedule any time on the <a href="${scheduleUrl}" style="color:#31576D;">Schedule</a>.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentReplacedEmail failed:", e);
  }
}

/**
 * Sent to a host when a coordinator REMOVES them from a rotation via the
 * "Remove from rotation" action (release-host). The user's rotation rule in
 * the bundle is deleted AND their future HostAssignment rows in the bundle
 * are freed. Other people in the same bundle (e.g. an alternate-pattern
 * co-host) remain in the rotation — only the released user is removed.
 *
 * Subject + body match the actual operation (session 130 fix): previously
 * this builder claimed "your standing rotation has been ended," which was
 * misleading on two counts — the bundle's rotation often continued for other
 * people, AND the cron would re-apply the released user the next morning
 * because the StandingAssignment row was untouched. Both issues are closed by
 * session 130's behavior change in release-host plus this rewrite.
 */
export interface StandingAssignmentReleasedEmailData {
  to: string;
  firstName: string | null;
  /** The program the user was removed from. Required so the subject/body can
   *  speak in program-specific terms even when no session dates are listed
   *  (the rule existed but the cron hadn't applied any HostAssignments yet). */
  programName: string;
  /** Future-session dates being freed up. May be empty when the user had a
   *  rotation rule but no materialized HostAssignment rows yet — in that case
   *  we send a shorter no-list variant so the user still hears about the
   *  removal. */
  sessions: Array<{ programName: string; dateLabel: string }>;
  /** Hub the rotation belonged to. */
  hubSlug?: string;
  /** Role-aware copy (session 130 follow-up) — used so the body reads "AV
   *  rotation" / "facilitator rotation" instead of host-team default. */
  coverageCopy?: { noun: string; verb: string; action: string };
}

export async function sendStandingAssignmentReleasedEmail(
  data: StandingAssignmentReleasedEmailData
): Promise<void> {
  if (!(await recipientHasOnboarded(data.to))) {
    console.log(`[email] suppressed standing-assignment-released to pre-threshold account ${data.to}`);
    return;
  }
  const count = data.sessions.length;
  const programName = data.programName;
  const subject =
    count === 0
      ? `You've been removed from the ${programName} rotation`
      : count === 1
        ? `You've been removed from the ${programName} rotation`
        : `You've been removed from the ${programName} rotation (${count} dates freed)`;
  const scheduleUrl = hubScopedUrl("/tools/schedule", data.hubSlug);
  // Two body variants — with or without a list of dates. The no-list case is
  // session 130's fix for "rule exists, no future HostAssignments yet" so the
  // user still hears about the removal instead of being silently dropped.
  const listHtml = count === 0
    ? ""
    : `<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${data.sessions
        .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
        .join("")}</ul>`;
  const datesIntro = count === 0
    ? `<p>You won't be scheduled for upcoming sessions of this program through this rotation.</p>`
    : `<p>The following upcoming ${count === 1 ? "date is" : "dates are"} no longer assigned to you:</p>
${listHtml}
<p>These slots are now open for other hosts to claim.</p>`;
  // Role-aware role noun in the body ("standing rotation as Host / AV /
  // Greeter / Facilitator"). Defaults to host language when not supplied.
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>A coordinator has removed you from the standing rotation as <strong>${copy.noun}</strong> for <strong>${programName}</strong>.</p>
${datesIntro}
<p>If this was unexpected or you'd like to talk about it, please reach out to your coordinator.</p>
<p style="color:#666;font-size:14px;"><a href="${scheduleUrl}" style="color:#31576D;">View the Schedule</a> &middot; This is an automated message from your standing rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentReleasedEmail failed:", e);
  }
}

/**
 * Sent to every host in a rotation bundle when a coordinator ENDS the entire
 * rotation rule (end-bundle's "End this rotation" with releaseFuture=true).
 * Distinct from `sendStandingAssignmentReleasedEmail`, which only removes one
 * person from a still-active rotation.
 *
 * Subject + body claim the rotation has ended because — for this code path —
 * it actually has: the StandingAssignment record is deleted, so the cron has
 * nothing left to re-apply.
 */
export async function sendStandingAssignmentEndedEmail(
  data: StandingAssignmentScheduledEmailData
): Promise<void> {
  if (data.sessions.length === 0) return;
  if (!(await recipientHasOnboarded(data.to))) {
    console.log(`[email] suppressed standing-assignment-ended to pre-threshold account ${data.to}`);
    return;
  }
  const count = data.sessions.length;
  const listHtml = data.sessions
    .map((s) => `<li style="margin-bottom:6px;">${s.programName} &mdash; ${s.dateLabel}</li>`)
    .join("");
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  const subject =
    count === 1
      ? `Your ${copy.verb} rotation has ended`
      : `Your ${copy.verb} rotation has ended (${count} sessions cleared)`;
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been ended. The following upcoming ${count === 1 ? "session has" : "sessions have"} been cleared from your schedule:</p>
<ul style="font-size:16px;line-height:1.7;padding-left:20px;">${listHtml}</ul>
<p>Thank you for the time you've contributed. If this was unexpected or you'd like to talk about it, please reach out to your coordinator.</p>
<p style="color:#666;font-size:14px;">This is an automated message from your standing rotation.</p>`;

  try {
    await resend.emails.send({ from: FROM, to: data.to, subject, html });
  } catch (e) {
    console.error("[email] sendStandingAssignmentEndedEmail failed:", e);
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
  documentTitle?: string; // set when the thread belongs to a document
}

/**
 * Sent to hub coordinators when a new conversation thread is created.
 * Works for any hub — not hardcoded to a specific hub.
 */
export async function sendHubConvNewThreadEmail(data: HubConvNewThreadEmailData): Promise<void> {
  await sendTemplatedEmail("hub-conv-new-thread", data.to, {
    firstName:     data.firstName,
    authorName:    data.authorName,
    hubName:       data.hubName,
    threadTitle:   data.threadTitle,
    documentTitle: data.documentTitle ?? null,
    threadUrl:     `${BASE_URL}/account/hub/${data.hubSlug}/conversations/${data.threadId}`,
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

// ─── Google Files notifications (Basecamp-style, per-post opt-in) ────────────
// Sent only to the specific people the poster chose to notify (default: no
// one). Both deep-link to the file's detail page.

export async function sendFileSharedEmail(data: {
  to: string;
  firstName: string | null;
  sharerName: string;
  fileName: string;
  spaceName: string;
  note: string | null;
  fileId: string;
}): Promise<void> {
  await sendTemplatedEmail("file-shared", data.to, {
    firstName: data.firstName,
    sharerName: data.sharerName,
    fileName: data.fileName,
    spaceName: data.spaceName,
    note: data.note ?? "",
    fileUrl: `${BASE_URL}/account/files/${data.fileId}`,
  });
}

export async function sendFileCommentEmail(data: {
  to: string;
  firstName: string | null;
  commenterName: string;
  fileName: string;
  spaceName: string;
  excerpt: string;
  fileId: string;
}): Promise<void> {
  await sendTemplatedEmail("file-comment", data.to, {
    firstName: data.firstName,
    commenterName: data.commenterName,
    fileName: data.fileName,
    spaceName: data.spaceName,
    excerpt: data.excerpt,
    fileUrl: `${BASE_URL}/account/files/${data.fileId}`,
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
    hubButton: emailButtonHtml("Open your team", data.hubUrl),
  });
}

// ─── Hub document notifications ──────────────────────────────────────────────

// ─── Public form submission notifications ────────────────────────────────────
// Both forms save a FormSubmission first (lib/formSubmissions.ts) and send
// these from after(), so a failed send never loses a submission. The subject
// is set here, "RIM form · Kind · Name", so the label never drifts; Reply-To
// is the sender, so the recipient can answer straight back.

export interface VolunteerInterestEmailData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  interests: string;
}

/**
 * Sent to volunteer@ (blind copy to Jesse) when a member submits the
 * volunteer interest form.
 * Managed via Email Template Manager — template: "volunteer-interest-internal"
 * Errors are caught inside sendTemplatedEmail.
 */
export async function sendVolunteerInterestEmail(data: VolunteerInterestEmailData): Promise<void> {
  await sendTemplatedEmail("volunteer-interest-internal", VOLUNTEER_FORM_TO, {
    firstName: data.firstName,
    lastName:  data.lastName,
    email:     data.email,
    phone:     data.phone ?? "",
    interests: data.interests,
  }, {
    subject: formNoticeSubject(FORM_KIND.volunteer, data.firstName, data.lastName),
    bcc:     FORM_COPY_TO,
    replyTo: data.email,
  });
}

export interface KalyanaApplicationEmailData {
  firstName: string;
  lastName: string;
  email: string;
  idea: string;
}

/**
 * Sent to Jesse and KalyanaMitta@ when a member applies to start a Kalyana
 * Mitta group (Jesse is already a recipient, so no blind copy).
 * Managed via Email Template Manager — template: "kalyana-application-internal"
 * Errors are caught inside sendTemplatedEmail.
 */
export async function sendKalyanaApplicationEmail(data: KalyanaApplicationEmailData): Promise<void> {
  await sendTemplatedEmail("kalyana-application-internal", KALYANA_MITTA_FORM_TO, {
    firstName: data.firstName,
    lastName:  data.lastName,
    email:     data.email,
    idea:      data.idea,
  }, {
    subject: formNoticeSubject(FORM_KIND.kalyanaMitta, data.firstName, data.lastName),
    replyTo: data.email,
  });
}

// ─── Community care: "If harm happens" ────────────────────────────────────────

export interface CareConcernEmailData {
  name: string;
  email: string;
  message: string;
  /** True when the sender was signed in (name and email come from their record). */
  isMember: boolean;
}

function escapeEmailHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Sends a message from /community-care-agreements/concern to the guiding
 * teacher, with Reply-To set to the sender so the reply goes straight back.
 * Hardcoded, not in the template manager, on purpose: it carries someone's
 * private account of harm, and a disabled or edited template would silently
 * drop it. It is also awaited (not fire-and-forget) and returns whether
 * Resend accepted it, so the page can tell the sender truthfully.
 * Recipient: CARE_CONCERN_EMAIL, else jesse@rootedinmindfulness.org (never
 * shown on the page; Jesse, 2026-10-12).
 */
export async function sendCareConcernEmail(data: CareConcernEmailData): Promise<boolean> {
  const to =
    process.env.CARE_CONCERN_EMAIL?.trim() || "jesse@rootedinmindfulness.org";
  const who = `${data.name} <${data.email}>`;
  const status = data.isMember ? "a signed-in member" : "a visitor (not signed in)";
  const text =
    `A message from the "If harm happens" form.\n\n` +
    `From: ${who}, ${status}\n` +
    `Reply to this email to answer them directly.\n\n` +
    `${data.message}\n`;
  const html = wrapInEmailChrome(
    `<p>A message from the &ldquo;If harm happens&rdquo; form.</p>` +
      `<p><strong>From:</strong> ${escapeEmailHtml(who)}, ${status}<br>` +
      `Reply to this email to answer them directly.</p>` +
      `<p style="white-space:pre-wrap">${escapeEmailHtml(data.message)}</p>`
  );
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      replyTo: data.email,
      subject: `Community care: a message from ${data.name}`,
      text,
      html,
    });
    if (error) {
      console.error("[care-concern] Resend refused the message:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[care-concern] send failed:", err);
    return false;
  }
}

// ─── Sign-in code email (authentication) ──────────────────────────────────────

/**
 * Sends the NextAuth sign-in code email for sign-in / account creation.
 * Managed via Email Template Manager — two templates:
 *   - "sign-in-code-new-user"  (subject + copy for first-time visitors)
 *   - "sign-in-code-returning" (subject + copy for existing members)
 *
 * Both are flagged ⚠️ CRITICAL in their descriptions because disabling
 * one breaks authentication. We pass throwOnFailure so a disabled or
 * missing template surfaces as a failure to NextAuth (which then shows
 * "Failed to send sign-in email. Please try again." to the user) rather
 * than silently swallowing the sign-in.
 *
 * The {{code}} variable is the NextAuth-generated 6-digit verification
 * token, injected at call time. Codes expire in 10 minutes.
 */
export async function sendSignInCodeEmail({
  to,
  code,
  isNewUser,
}: {
  to: string;
  code: string;
  isNewUser: boolean;
}): Promise<void> {
  // "Sign me in from this device": opens the code page with the code already
  // filled in. It deliberately does NOT sign in on its own. Mail security
  // scanners open links automatically, and an auto-submitting link would use
  // up the single-use code before the member ever clicked. The member taps
  // Sign in on the page, so a scanner's visit changes nothing.
  const signInUrl =
    `${BASE_URL}/login/check-email?email=${encodeURIComponent(to)}&code=${encodeURIComponent(code)}`;
  try {
    await sendTemplatedEmail(
      isNewUser ? "sign-in-code-new-user" : "sign-in-code-returning",
      to,
      {
        code,
        signInUrl,
        signInButton: emailButtonHtml("Sign me in from this device", signInUrl),
      },
      { throwOnFailure: true },
    );
  } catch (e) {
    console.error("[email] Failed to send sign-in code email:", e);
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
