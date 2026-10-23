import { Resend } from "resend";
import { ACCOUNT_SOURCE, PROGRAMS_SOURCE, appPath, isUrgentSession, recordNotice, settleNoticeEmail, teamSource, type NoticeInput } from "@/lib/notifications";
import { portableTextToMarkdown } from "@/lib/portableTextEmail";
import { isBlockNoteJSON } from "@/lib/renderRichContent";
import { extractTextAsync, renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { db } from "@/lib/db";
import { ctMonthKey, fmtSessionDay, fmtSessionWhen } from "@/lib/timezone";
import { DEFAULT_HOSTING_HUB_SLUG, getHubCoverageConfig, getHubCoverageCopy, teamPhrase } from "@/lib/programHub";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { RIM_ADDRESS, RIM_EIN, RIM_LEGAL_NAME, emailSafeLink, markdownLinkText } from "@/lib/locations";
import { registrationResumeKey } from "@/lib/registrationLink";
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
/** A team as a notice's source, named as people read it. */
async function teamNotice(hubSlug: string | null | undefined): Promise<{ sourceKey: string; sourceLabel: string }> {
  const slug = hubSlug || DEFAULT_HOSTING_HUB_SLUG;
  const hub = await db.hub.findUnique({ where: { slug }, select: { name: true } });
  return teamSource(slug, hub?.name ?? "Your team");
}

/** "Good Evening · Thu, Oct 22 at 6:30 PM". */
function sessionLine(programName: string, sessionAt: Date | null | undefined, fallback?: string | null): string {
  const when = fmtSessionWhen(sessionAt ?? null) ?? fallback;
  return when ? `${programName} · ${when}` : programName;
}

/** An app path ("/tools/schedule?hub=…") as a full link for an email. */
export function emailLink(path: string): string {
  return `${BASE_URL}${path}`;
}

export function hubScopedUrl(path: string, hubSlug?: string | null): string {
  const base = `${BASE_URL}${path}`;
  if (!hubSlug || hubSlug === DEFAULT_HOSTING_HUB_SLUG) return base;
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${sep}hub=${encodeURIComponent(hubSlug)}`;
}

/** The Scheduler link for a session's month, so the session is on screen. */
function scheduleUrlFor(hubSlug: string | null | undefined, sessionAt?: Date | null, extra = ""): string {
  const params = [extra, sessionAt ? `month=${ctMonthKey(sessionAt)}` : ""].filter(Boolean).join("&");
  return hubScopedUrl(`/tools/schedule${params ? `?${params}` : ""}`, hubSlug);
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
 * Base CSS inlined into every email by `renderEmailHtml` (juice).
 * Targets standard HTML tags produced by marked so styles survive email clients.
 * Text tags carry the font themselves because Gmail drops the body's style.
 * The same CSS is applied in the admin preview modal for pixel-identical rendering.
 */
const EMAIL_SANS = "'Open Sans', Arial, sans-serif";

export const EMAIL_BASE_CSS = `
body { margin: 0; padding: 0; background: #F6F3F0; font-family: 'Open Sans', Arial, sans-serif; font-size: 17px; line-height: 1.8; color: #333333; }
p { margin: 0 0 30px; font-family: 'Open Sans', Arial, sans-serif; font-size: 17px; line-height: 1.8; color: #333333; }
h2 { font-family: Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif; font-size: 24px; font-weight: 400; line-height: 1.3; margin: 8px 0 16px; color: #333333; }
h3 { font-family: Baskerville, 'Baskerville Old Face', 'Libre Baskerville', Georgia, serif; font-size: 20px; font-weight: 400; line-height: 1.3; margin: 8px 0 12px; color: #333333; }
ul, ol { margin: 0 0 30px; padding-left: 24px; }
li { margin: 4px 0; font-family: 'Open Sans', Arial, sans-serif; font-size: 17px; line-height: 1.8; color: #333333; }
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
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
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
            <td style="padding:40px 40px 10px;text-align:left;font-family:${EMAIL_SANS};font-size:17px;line-height:1.8;color:#333333;">
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
 * The one way an email's HTML is made: RIM's chrome around the body, then the
 * base CSS inlined. Every send (templated or hand-written) and the admin
 * preview go through here, so no email can carry the frame without the text
 * style, or neither (2026-10-14: the care-concern and rotation emails had).
 */
export async function renderEmailHtml(bodyHtml: string): Promise<string> {
  // Loaded on send, not with the module: auth.ts imports this file.
  const juice = (await import("juice")).default;
  return juice(wrapInEmailChrome(bodyHtml), { extraCss: EMAIL_BASE_CSS, removeStyleTags: true });
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
  const Handlebars = (await import("handlebars")).default;
  const compiled = Handlebars.compile(markdown, { noEscape: true })(variables);
  // A single Return is a new line, as an author typing in /admin/emails
  // expects (2026-10-14; it had joined "Name:" and "Email:" into one line).
  // MarkdownEditor shows lines the same way.
  const bodyHtml = await marked(compiled, { breaks: true });
  return await renderEmailHtml(bodyHtml);
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
  memberText: string[] = [],
): Promise<string> {
  const Handlebars = (await import("handlebars")).default;
  const source = textBody && textBody.trim().length > 0 ? textBody : markdownBody;
  return Handlebars.compile(source, { noEscape: true })(textVariables(variables, memberText));
}

/** Escape what a member typed for the markdown body: HTML characters, and
 *  the marks that make links, emphasis and code. */
function inertMemberText(variables: Record<string, unknown>, keys: string[] | undefined): Record<string, unknown> {
  if (!keys?.length) return variables;
  const out = { ...variables };
  for (const key of keys) {
    const value = out[key];
    if (typeof value !== "string") continue;
    out[key] = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/([\\`*_[\]])/g, "\\$1")
      // A line that starts like a heading, list or table stays a line of
      // text (2026-10-23: the registration team's messages are many lines).
      .replace(/^(\s*)([#+\-=|])/gm, "$1\\$2")
      .replace(/^(\s*\d+)([.)])/gm, "$1\\$2")
      .replace(/^ {4,}/gm, "   ");
  }
  return out;
}

/**
 * Variables for the plain-text part. A button or a rendered message is HTML,
 * and went into the text part as raw markup (2026-10-19 audit): a link becomes
 * "Label: URL", other tags are dropped, a few entities are decoded.
 */
function textVariables(variables: Record<string, unknown>, memberText: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variables)) {
    // What a member typed is shown as typed, angle brackets and all.
    if (typeof value !== "string" || memberText.includes(key) || !/<[a-z][\s\S]*>/i.test(value)) {
      out[key] = value;
      continue;
    }
    out[key] = value
      .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
        const text = label.replace(/<[^>]+>/g, "").trim();
        return text && text !== href ? `${text}: ${href}` : href;
      })
      .replace(/<\/(p|div|li|h[1-6]|tr)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&") // last, so "&amp;lt;" stays "&lt;"
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  return out;
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
   * The same news for the person's Notifications (2026-10-20): written once,
   * shown in /account/notifications, and for team news ("team") emailed by
   * their choice (each one, a daily summary, or none). One recipient only.
   */
  notice?: NoticeInput;
  /** Record the notice only, no email: the person's team emails are
   *  switched off by a coordinator (2026-10-20). */
  noticeOnly?: boolean;

  /**
   * Variables a member typed (a title, a note, a name). In the email's body
   * they are made inert, so markup shows as the characters typed instead of
   * becoming a link or HTML in another member's inbox (2026-10-19 audit).
   * The subject and the text part, which are plain text, use them as typed.
   */
  memberText?: string[];

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
  // "Your session is covered" goes straight to the person who was hosting, who
  // may be a staged account a coordinator asked cover for (2026-10-15).
  "sub-request-claimed",
  // A schedule change cleared someone's sessions (2026-10-16).
  "sessions-cleared-schedule-change",
  // Any other coverage change that took someone off sessions (2026-10-16).
  "coverage-sessions-cleared",
  // The two-days-before reminder to the person serving (2026-10-16).
  "coverage-session-reminder",
]);

export async function sendTemplatedEmail(
  slug: string,
  to: string | string[],
  variables: Record<string, unknown>,
  options: TemplatedEmailOptions = {},
): Promise<void> {
  try {
    // Notifications first: the inbox holds it whatever the email does.
    // Team news goes by the person's choice; personal notices always send.
    // A team notice is settled once emailed (or not wanted); one left
    // unsettled is due for the person's daily summary.
    let teamNoticeId: string | null = null;
    if (options.notice && typeof to === "string") {
      const recorded = await recordNotice(to, options.notice);
      if (recorded && options.notice.category === "team") {
        if (options.noticeOnly) {
          await settleNoticeEmail(recorded.id);
          return;
        }
        // Urgent team news always emails; the rest follows their choice.
        if (!options.notice.urgent && recorded.mode === "summary") return;
        if (!options.notice.urgent && recorded.mode === "none") {
          await settleNoticeEmail(recorded.id);
          return;
        }
        teamNoticeId = recorded.id;
      }
    }
    if (options.noticeOnly) return;

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
    const html    = await renderTemplateToHtml(template.body, inertMemberText(variables, options.memberText));
    const text    = await renderTemplateToText(template.body, template.textBody, variables, options.memberText);

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
    } else if (teamNoticeId) {
      await settleNoticeEmail(teamNoticeId);
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
  /** Map and directions for a venue other than RIM (lib/locations.ts emailLink). */
  locationUrl?: string | null;
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
    locationUrl: data.locationUrl ?? "",
    confirmationMessageHtml: data.confirmationMessageHtml ?? "",
    googleCalendarUrl: data.googleCalendarUrl ?? "",
    icsUrl: data.icsUrl ?? "",
  }, {
    notice: {
      kind: "registration-confirmation",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: isWaitlisted
        ? `You're on the waitlist for ${programTitle}`
        : `You're registered for ${programTitle}`,
      detail: [dateText, locationText].filter(Boolean).join("\n") || null,
      href: `/programs/${programSlug}`,
      threadKey: `program:${programSlug}`,
    },
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
  /** The registration, so the link resumes it for a guest who isn't signed in. */
  registrationId: string;
}

/** The register page for one registration: a guest who isn't signed in can
 *  finish it (pay or offer dana) from the email. Without it the page showed a
 *  fresh form, which answered "already registered" (2026-10-19 audit). The
 *  link carries a signed key (lib/registrationLink.ts); without a secret it
 *  falls back to the plain page. */
function registrationResumeUrl(programSlug: string, registrationId: string): string {
  const key = registrationResumeKey(registrationId);
  const base = `${BASE_URL}/programs/${programSlug}/register`;
  return key ? `${base}?r=${encodeURIComponent(registrationId)}&t=${encodeURIComponent(key)}` : base;
}

/**
 * Sent when a registrar promotes someone from WAITLISTED → APPROVED.
 * Managed via Email Template Manager — template: "waitlist-approval"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendApprovalEmail(data: ApprovalEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, danaMode, requiredCents = 0, registrationId } = data;
  const paymentRequired = requiredCents > 0;
  await sendTemplatedEmail("waitlist-approval", to, {
    firstName,
    programTitle,
    programUrl: registrationResumeUrl(programSlug, registrationId),
    // Optional dana and a required payment read differently; never both.
    hasDana: !paymentRequired && !!danaMode && danaMode !== "none",
    paymentRequired,
    paymentUsd: (requiredCents / 100).toFixed(2),
  }, {
    notice: {
      kind: "waitlist-approval",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: `A place opened for you in ${programTitle}`,
      detail: paymentRequired ? "Your place is held once the payment is made." : "Finish your registration from the email or the program's page.",
      href: appPath(registrationResumeUrl(programSlug, registrationId)),
      threadKey: `program:${programSlug}`,
    },
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
  registrationId: string;
}

/**
 * Sent by a registrar to a member whose donationStatus is PENDING.
 * Managed via Email Template Manager — template: "dana-reminder"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendDanaReminderEmail(data: DanaReminderEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, registrationId } = data;
  await sendTemplatedEmail("dana-reminder", to, {
    firstName,
    programTitle,
    registerUrl: registrationResumeUrl(programSlug, registrationId),
  }, {
    notice: {
      kind: "dana-reminder",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: `Your dana for ${programTitle} is still open`,
      href: appPath(registrationResumeUrl(programSlug, registrationId)),
      threadKey: `program:${programSlug}`,
    },
  });
}

// ─── A message from the registration team (2026-10-23) ───────────────────────

export interface RegistrationMessageEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  programSlug: string;
  /** What the registration team typed: shown as typed, never as markup. */
  subject: string;
  message: string;
  /** A test to the sender: "[Test]" in the subject and no notice recorded. */
  test?: boolean;
}

/**
 * The Registration app's "Message people" (2026-10-23): one note from the
 * registration team to the people registered for (or waiting on) a program.
 * Replies go to the registrar's inbox. The route sends these one at a time
 * in after() (sendEachPaced).
 *
 * Managed via Email Template Manager — template: "registration-message".
 * Email Template Gate: matching seed entry in prisma/migrate.mjs ships with
 * the same commit.
 */
export async function sendRegistrationMessageEmail(data: RegistrationMessageEmailData): Promise<void> {
  const { to, firstName, programTitle, programSlug, subject, message, test } = data;
  const programUrl = `${BASE_URL}/programs/${programSlug}`;
  await sendTemplatedEmail("registration-message", to, {
    firstName,
    programTitle,
    subject,
    message,
    programUrl,
    programButton: emailButtonHtml("View the program →", programUrl),
  }, {
    memberText: ["firstName", "programTitle", "subject", "message"],
    replyTo: REGISTRAR_EMAIL,
    ...(test ? { subject: `[Test] ${subject}` } : {
      notice: {
        kind: "registration-message",
        category: "personal",
        ...PROGRAMS_SOURCE,
        title: `${programTitle}: ${subject}`,
        href: appPath(programUrl),
        threadKey: `program:${programSlug}`,
      },
    }),
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
  }, {
    notice: {
      kind: "course-dana-receipt",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: `Your receipt for ${courseTitle} ($${amountUsd})`,
      href: `/course/${courseSlug}`,
    },
  });
}

// ─── Program registration dana receipt (2026-09-24) ─────────────────────────

export interface RegistrationDanaReceiptEmailData {
  to: string;
  firstName: string;
  programTitle: string;
  /** The program's page is where the receipt's notice leads. */
  programSlug: string;
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
  }, {
    notice: {
      kind: "registration-dana-receipt",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: `Your receipt for ${data.programTitle} ($${usd(data.totalCents)})`,
      detail: "The receipt is in your email, with what you gave and RIM's details for your records.",
      href: `/programs/${data.programSlug}`,
    },
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
  }, {
    notice: { kind: "welcome-back", category: "personal", ...ACCOUNT_SOURCE, title: "Welcome back to RIM", href: "/account/dashboard" },
  });
}

// ─── Accounts merged (to the address kept) ───────────────────────────────────

/**
 * Sent when an admin merges a person's two accounts (lib/memberMerge.ts), to
 * the address they sign in with now. Template `accounts-merged`, seeded in
 * prisma/migrate.mjs. Not pre-threshold-gated: it tells the person how to get in.
 */
export async function sendAccountsMergedEmail(data: {
  to: string;
  firstName: string | null;
  formerEmail: string;
}): Promise<void> {
  await sendTemplatedEmail("accounts-merged", data.to, {
    firstName: data.firstName || "there",
    email: data.to,
    formerEmail: data.formerEmail,
    signInButton: emailButtonHtml("Sign in", `${BASE_URL}/login?email=${encodeURIComponent(data.to)}`),
    signInUrl: `${BASE_URL}/login`,
    supportEmail: "support@rootedinmindfulness.org",
  }, {
    notice: {
      kind: "accounts-merged",
      category: "personal",
      ...ACCOUNT_SOURCE,
      title: "Your two accounts are now one",
      detail: `You sign in with ${data.to}. Your old address, ${data.formerEmail}, still leads here.`,
      href: "/account/dashboard-my-profile",
    },
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
  // The editor's HTML string (current), an older Tiptap document, or a legacy
  // BlockNote / Portable Text array.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reminderMessage?: any;
}

/**
 * Sent to a registrant as a reminder about an upcoming program.
 * Managed via Email Template Manager — template: "session-reminder"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendReminderEmail(data: ReminderEmailData): Promise<void> {
  // A link only when it is safe in markdown (lib/locations.ts emailSafeLink),
  // with the text escaped so a "]" in a venue name can't end it early.
  const safeLink = emailSafeLink(data.locationLink);
  const locationText = safeLink && data.locationText
    ? `[${markdownLinkText(data.locationText)}](${safeLink})`
    : (data.locationText ?? "");

  // Render reminder message. The editor saves HTML (RimTiptapEditor); render
  // it the way the confirmation's message is (2026-10-19 audit: an HTML string
  // matched neither older format, so every reminder went out without the
  // coordinator's message). BlockNote and Portable Text stay for old rows.
  let reminderMessage = "";
  if (data.reminderMessage && !Array.isArray(data.reminderMessage)) {
    // HTML, or an older Tiptap document: rendered as the confirmation is.
    const html = await renderFormattedTextAsync(data.reminderMessage);
    // An emptied editor saves "<p></p>": no message, not a blank block.
    if (html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim()) reminderMessage = html;
  } else if (data.reminderMessage) {
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
    // My Home no longer lists upcoming programs (2026-10-20), so the button
    // opens the program's page; dashboardUrl stays for an edited template.
    programUrl:      `${BASE_URL}/programs/${data.programSlug}`,
    dashboardUrl:    `${BASE_URL}/account/dashboard`,
  }, {
    notice: {
      kind: "session-reminder",
      category: "personal",
      ...PROGRAMS_SOURCE,
      title: `${data.programTitle} is coming up${data.dateText ? `: ${data.dateText}` : ""}`,
      detail: data.locationText ?? null,
      href: `/programs/${data.programSlug}`,
      threadKey: `program:${data.programSlug}`,
    },
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
  }, {
    notice: { kind: "registrar-role-assigned", category: "personal", ...ACCOUNT_SOURCE, title: "You're now a registrar", href: "/tools/programs" },
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
  }, {
    notice: { kind: "host-role-assigned", category: "personal", ...ACCOUNT_SOURCE, title: "You're now on the Hosting Team", href: "/account/hub/host-team" },
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
  const html = await renderEmailHtml(await marked(markdown, { breaks: true }));

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: data.to,
      subject: "Welcome, host coordinator — your team is ready",
      html,
    });
    if (error) console.error("[email] sendHostManagerRoleAssignmentEmail refused:", error);
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
  /** The session's start, so the link opens its month (2026-10-15). */
  sessionAt?: Date | null;
  /** Hub the program belongs to (Program.hostingHubSlug or "host-team").
   *  Passed to hubScopedUrl so the email link lands the recipient in the
   *  right hub view, not the default host-team. Slice 2.5. */
  hubSlug: string;
  /** Their team emails are off: the notice only (2026-10-20). */
  noticeOnly?: boolean;
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
  const when = fmtSessionWhen(data.sessionAt) ?? data.sessionDate;
  const sessionLabel = when ? ` on ${when}` : "";
  const coverUrl = scheduleUrlFor(data.hubSlug, data.sessionAt, `action=cover&id=${data.subRequestId}`);
  // The team's own claim phrase ("host this", "cover AV", "facilitate").
  const copy = await getHubCoverageCopy(data.hubSlug);
  await sendTemplatedEmail("sub-request-posted", data.to, {
    coverageAction: copy.action,
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
  }, {
    memberText: ["requesterName", "message"],
    noticeOnly: data.noticeOnly,
    notice: {
      urgent: isUrgentSession(data.sessionAt),
      kind: "sub-request-posted",
      category: "team",
      ...(await teamNotice(data.hubSlug)),
      title: `${data.requesterName} asked for someone to cover ${sessionLine(data.programName, data.sessionAt, data.sessionDate)}`,
      detail: data.message || null,
      href: appPath(scheduleUrlFor(data.hubSlug, data.sessionAt)),
      threadKey: `cover:${data.subRequestId}`,
    },
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
  /** The session, so the link opens its month. */
  sessionAt?: Date | null;
}

/**
 * Sent to the requesting host when their sub request is claimed.
 * Managed via Email Template Manager — template: "sub-request-claimed"
 * Fire-and-forget — errors caught inside sendTemplatedEmail.
 */
export async function sendSubClaimedEmail(data: SubClaimedEmailData): Promise<void> {
  const when = fmtSessionWhen(data.sessionAt) ?? data.sessionDate;
  const sessionLabel = when ? ` on ${when}` : "";
  const hubUrl = scheduleUrlFor(data.hubSlug, data.sessionAt);
  await sendTemplatedEmail("sub-request-claimed", data.to, {
    ...(await coverageWords(data.hubSlug)),
    firstName:    data.firstName ?? "there",
    claimerName:  data.claimerName,
    programName:  data.programName,
    sessionDate:  sessionLabel,
    message:      data.message ?? "",
    hubUrl,
    // New as of Slice 2.5 — paste {{scheduleButton}} in the template
    // for a prominent "View your schedule" affordance.
    scheduleButton: emailButtonHtml("View your schedule", hubUrl),
  }, {
    memberText: ["claimerName", "message"],
    notice: {
      kind: "sub-request-claimed",
      category: "personal",
      ...(await teamNotice(data.hubSlug)),
      title: `${data.claimerName} is covering your ${sessionLine(data.programName, data.sessionAt, data.sessionDate)}`,
      detail: data.message || null,
      href: appPath(hubUrl),
    },
  });
}

export interface NewProgramNeedsHostEmailData {
  to: string;
  firstName: string | null;
  programName: string;
  programFormat: string; // "Virtual" or "In-person and virtual"
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
  /** Their team emails are off: the notice only (2026-10-20). */
  noticeOnly?: boolean;
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
  }, {
    noticeOnly: data.noticeOnly,
    notice: {
      kind: "new-program-needs-host",
      category: "team",
      ...(await teamNotice(data.hubSlug)),
      title: `A new program needs this team: ${data.programName}`,
      detail: data.programFormat || null,
      href: appPath(scheduleUrl),
    },
  });
}

/**
 * Send one email per recipient, one after another with a short gap. The mail
 * service allows 10 requests a second, so a team-wide send fired all at once
 * lost emails past about ten people, logged only (2026-10-19 audit; the
 * coverage notices already paced themselves for this). A failure on one
 * recipient never stops the rest.
 */
export async function sendEachPaced<T>(
  items: T[],
  send: (item: T) => Promise<unknown>,
  label: string,
  gapMs = 600,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, gapMs));
    try {
      await send(items[i]);
    } catch (err) {
      console.error(`[email] ${label} failed for one recipient`, err);
    }
  }
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
  const recipients = await getHubNotificationRecipients(opts.hubSlug, {
    canCover: true,
    withMuted: true,
    ...(opts.excludeUserId ? { excludeUserId: opts.excludeUserId } : {}),
  });
  if (recipients.length === 0) return;
  const programFormat =
    opts.programFormat === "virtual" ? "Virtual"
    : opts.programFormat === "in-person" ? "In-person"
    : "In-person and virtual";
  await sendEachPaced(recipients, (u) =>
    sendNewProgramNeedsHostEmail({
      to: u.email,
      firstName: u.firstName,
      programName: opts.programName,
      programFormat,
      hubSlug: opts.hubSlug,
      noticeOnly: u.muted,
    }),
    "new-program-needs-host",
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
  /** The session's start, so the link opens its month (2026-10-15). */
  sessionAt?: Date | null;
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

/** Whether this team signs people up openly (greeters) rather than one per session. */
async function isOpenSignUp(hubSlug: string | null | undefined): Promise<boolean> {
  if (!hubSlug) return false;
  return (await getHubCoverageConfig(hubSlug))?.allowsMultipleAssignments ?? false;
}

/**
 * The team's role as it reads mid-sentence ("as host", "as greeter", "your
 * facilitator rotation"); an abbreviation written in capitals stays as
 * written ("as AV"). Building sentences from the -ing verb produced "to be
 * covering AV the following sessions" (2026-10-16 audit).
 */
function roleInline(copy: { noun: string }): string {
  return /^[A-Z0-9/&]+$/.test(copy.noun) ? copy.noun : copy.noun.toLowerCase();
}

/**
 * The role after "needs": "a greeter", "a host", "an usher", but "AV" (an
 * abbreviation takes no article).
 */
function needsRole(copy: { noun: string }): string {
  if (/^[A-Z0-9/&]+$/.test(copy.noun)) return copy.noun;
  const role = roleInline(copy);
  return `${/^[aeiou]/i.test(role) ? "an" : "a"} ${role}`;
}

/**
 * The words every coverage email names the role and team with (2026-10-16,
 * Jesse, on "You're confirmed for Dummy Test Program": "Confirmed to greet,
 * because what if they're part of different teams?"). Spread into the
 * template's variables:
 *   coverageRole  "greeter" / "host" / "AV"   ("confirmed as greeter")
 *   coverageVerb  "greeting" / "hosting"      ("You're greeting: …")
 *   coverageAction "greet" / "host this"      ("If you can greet, …")
 *   needsRole     "a greeter" / "AV"          ("needs a greeter")
 *   teamName      "the …" form: "Greeter team", "Hosting Team"
 */
export async function coverageWords(hubSlug: string | null | undefined): Promise<{
  coverageRole: string;
  coverageVerb: string;
  coverageAction: string;
  needsRole: string;
  teamName: string;
}> {
  const slug = hubSlug || DEFAULT_HOSTING_HUB_SLUG;
  const [copy, hub] = await Promise.all([
    getHubCoverageCopy(slug),
    db.hub.findUnique({ where: { slug }, select: { name: true } }),
  ]);
  return {
    coverageRole: roleInline(copy),
    coverageVerb: copy.verb,
    coverageAction: copy.action,
    needsRole: needsRole(copy),
    teamName: teamPhrase(hub?.name ?? "Hosting Team"),
  };
}

/**
 * What to do if plans change, in the team's own terms (2026-10-15): an open
 * sign-up team (greeters) has no sub requests, so it never hears "request a sub".
 */
async function changeNoteText(hubSlug: string | null | undefined): Promise<string> {
  return (await isOpenSignUp(hubSlug))
    ? "If anything changes, you can cancel your sign-up from the schedule."
    : "If anything changes, open the schedule and use Ask the team to cover on that session.";
}
async function changeNoteHtml(hubSlug: string | null | undefined): Promise<string> {
  return (await isOpenSignUp(hubSlug))
    ? "<p>If you can't make one of these dates, open the Schedule and cancel your sign-up for it.</p>"
    : "<p>If you can't make any of these dates, open the Schedule and use <strong>Ask the team to cover</strong> on that session's row.</p>";
}

export async function sendHostAssignmentConfirmationEmail(
  data: HostAssignmentConfirmationEmailData,
): Promise<void> {
  const scheduleUrl = scheduleUrlFor(data.hubSlug, data.sessionAt);
  await sendTemplatedEmail("host-assignment-confirmation", data.to, {
    ...(await coverageWords(data.hubSlug)),
    changeNote:    await changeNoteText(data.hubSlug),
    firstName:     data.firstName ?? "there",
    programName:   data.programName,
    dateText:      fmtSessionWhen(data.sessionAt) ?? data.dateText ?? "",
    requesterNote: data.requesterNote ?? "",
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  }, {
    notice: {
      kind: "host-assignment-confirmation",
      category: "personal",
      ...(await teamNotice(data.hubSlug)),
      title: `You're ${(await coverageWords(data.hubSlug)).coverageVerb} at ${sessionLine(data.programName, data.sessionAt, data.dateText)}`,
      detail: data.requesterNote || null,
      href: appPath(scheduleUrl),
    },
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
  /** The session's start, so the link opens its month (2026-10-15). */
  sessionAt?: Date | null;
  /** Hub the program belongs to. Slice 2.5. */
  hubSlug: string;
}

export async function sendHostAssignmentRemovedEmail(
  data: HostAssignmentRemovedEmailData,
): Promise<void> {
  const scheduleUrl = scheduleUrlFor(data.hubSlug, data.sessionAt);
  await sendTemplatedEmail("host-assignment-removed", data.to, {
    ...(await coverageWords(data.hubSlug)),
    firstName:   data.firstName ?? "there",
    programName: data.programName,
    dateText:    fmtSessionWhen(data.sessionAt) ?? data.dateText ?? "",
    byName:      data.byName,
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  }, {
    notice: {
      kind: "host-assignment-removed",
      category: "personal",
      ...(await teamNotice(data.hubSlug)),
      title: `You're no longer ${(await coverageWords(data.hubSlug)).coverageVerb} at ${sessionLine(data.programName, data.sessionAt, data.dateText)}`,
      detail: data.byName ? `${data.byName} made this change.` : null,
      href: appPath(scheduleUrl),
    },
  });
}

/**
 * A program moved to a different schedule, so sessions someone had on the old
 * days no longer happen (lib/programHub.ts clearOffScheduleCoverage). One
 * email per person per team, listing the dates. Template:
 * "sessions-cleared-schedule-change" (seeded in prisma/migrate.mjs).
 */
export async function sendSessionsClearedEmail(data: {
  to: string;
  firstName: string | null;
  programName: string;
  sessionDates: Date[];
  hubSlug: string;
}): Promise<void> {
  if (data.sessionDates.length === 0) return;
  const sorted = [...data.sessionDates].sort((a, b) => a.getTime() - b.getTime());
  const scheduleUrl = scheduleUrlFor(data.hubSlug, sorted[0]);
  await sendTemplatedEmail("sessions-cleared-schedule-change", data.to, {
    firstName:   data.firstName ?? "there",
    programName: data.programName,
    sessionList: sorted.map((d) => `- ${fmtSessionDay(d)}`).join("\n"),
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  }, {
    notice: {
      kind: "sessions-cleared-schedule-change",
      category: "personal",
      ...(await teamNotice(data.hubSlug)),
      title: `${data.programName}'s schedule changed: you're off ${sorted.length === 1 ? "1 session" : `${sorted.length} sessions`}`,
      detail: sorted.map((d) => fmtSessionDay(d)).join("\n"),
      href: appPath(scheduleUrl),
    },
  });
}

/**
 * A coverage change took people off sessions: tell each one (2026-10-16
 * audit: seven paths cleared sessions silently, from a hosting-team change to
 * a team reset). One email per person per team, listing program and date;
 * never to the person who made the change, an archived account, or a seat
 * with no one in it. `reason` is one plain sentence naming what happened,
 * written by the caller (it knows the program or team). Template:
 * "coverage-sessions-cleared" (seeded in prisma/migrate.mjs). Call inside
 * after(); failures are logged per person.
 */
export async function sendCoverageClearedEmails(opts: {
  rows: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[];
  /** A sentence, or one built from the team as it reads after "the" (teamPhrase). */
  reason: string | ((team: string) => string);
  excludeUserId?: string;
}): Promise<void> {
  const groups = new Map<string, { userId: string; hubSlug: string; rows: { programSlug: string; sessionDate: Date | null }[] }>();
  for (const r of opts.rows) {
    if (!r.userId || r.userId === opts.excludeUserId) continue;
    const key = `${r.userId}::${r.hubSlug}`;
    const g = groups.get(key) ?? { userId: r.userId, hubSlug: r.hubSlug, rows: [] };
    g.rows.push({ programSlug: r.programSlug, sessionDate: r.sessionDate });
    groups.set(key, g);
  }
  if (groups.size === 0) return;
  const programSlugs = [...new Set(opts.rows.map((r) => r.programSlug))];
  const hubSlugs = [...new Set([...groups.values()].map((g) => g.hubSlug))];
  const [programs, hubs] = await Promise.all([
    db.program.findMany({ where: { slug: { in: programSlugs } }, select: { slug: true, name: true } }),
    db.hub.findMany({ where: { slug: { in: hubSlugs } }, select: { slug: true, name: true } }),
  ]);
  const programName = new Map(programs.map((p) => [p.slug, p.name]));
  const teamName = new Map(hubs.map((h) => [h.slug, h.name]));
  for (const g of groups.values()) {
    try {
      const user = await db.user.findUnique({ where: { id: g.userId }, select: { email: true, firstName: true, archivedAt: true } });
      if (!user?.email || user.archivedAt) continue;
      const sorted = [...g.rows].sort((a, b) => (a.sessionDate?.getTime() ?? 0) - (b.sessionDate?.getTime() ?? 0));
      const team = teamName.get(g.hubSlug) ?? g.hubSlug;
      const scheduleUrl = scheduleUrlFor(g.hubSlug, sorted.find((r) => r.sessionDate)?.sessionDate ?? null);
      await sendTemplatedEmail("coverage-sessions-cleared", user.email, {
        firstName:   user.firstName ?? "there",
        teamName:    team,
        // Reasons read "the …": "the Greeter team", "the Hosting Team".
        reason:      typeof opts.reason === "function" ? opts.reason(teamPhrase(team)) : opts.reason,
        sessionList: sorted
          .map((r) => `- ${programName.get(r.programSlug) ?? r.programSlug}${r.sessionDate ? `, ${fmtSessionDay(r.sessionDate)}` : ""}`)
          .join("\n"),
        scheduleUrl,
        scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
      }, {
        notice: {
          kind: "coverage-sessions-cleared",
          category: "personal",
          ...teamSource(g.hubSlug, team),
          title: `You're off ${sorted.length === 1 ? "1 session" : `${sorted.length} sessions`} with the ${teamPhrase(team)}`,
          detail: [
            typeof opts.reason === "function" ? opts.reason(teamPhrase(team)) : opts.reason,
            ...sorted.map((r) => `${programName.get(r.programSlug) ?? r.programSlug}${r.sessionDate ? `, ${fmtSessionDay(r.sessionDate)}` : ""}`),
          ].join("\n"),
          href: appPath(scheduleUrl),
        },
      });
    } catch (e) {
      console.error("[email] coverage-sessions-cleared failed", e);
    }
  }
}

// ─── Sessions that need someone (2026-10-16) ────────────────────────────────
//
// Jesse: "this is one of the main features to support teams and to make sure
// roles are all accounted for." Before this, a team heard only when someone
// asked for cover; a session emptied any other way went quiet. Who is told,
// when (rulings, 2026-10-16): the team, at once, when a session within two
// weeks loses its last person; the team, weekly, about the next two weeks;
// the coordinator two days before about anything still open; the person
// serving, two days before. Callers and timing: lib/coverageNotices.ts.

/** One session in a coverage email's list. */
export interface CoverageSessionLine {
  programName: string;
  sessionAt: Date | null;
  /** A short note after the date, e.g. "Maria asked for cover". */
  note?: string | null;
}

function coverageSessionList(sessions: CoverageSessionLine[]): string {
  return sessions
    .map((s) => `- **${s.programName}**, ${fmtSessionWhen(s.sessionAt) ?? "date to be confirmed"}${s.note ? ` (${s.note})` : ""}`)
    .join("\n");
}

function firstSessionAt(sessions: CoverageSessionLine[]): Date | null {
  return sessions.map((s) => s.sessionAt).filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

/**
 * A session within two weeks has just lost its last person. Template:
 * "coverage-gap-opened". Recipients come from getHubNotificationRecipients
 * (canCover), so the pre-threshold gate applies at the source.
 */
export async function sendCoverageGapEmail(data: {
  to: string;
  firstName: string | null;
  hubSlug: string;
  sessions: CoverageSessionLine[];
  noticeOnly?: boolean;
}): Promise<void> {
  if (data.sessions.length === 0) return;
  const words = await coverageWords(data.hubSlug);
  const one = data.sessions.length === 1 ? data.sessions[0] : null;
  const scheduleUrl = scheduleUrlFor(data.hubSlug, firstSessionAt(data.sessions));
  await sendTemplatedEmail("coverage-gap-opened", data.to, {
    ...words,
    firstName: data.firstName ?? "there",
    headline: one
      ? `Needs ${words.needsRole}: ${one.programName} · ${fmtSessionWhen(one.sessionAt) ?? "date to be confirmed"}`
      : `${data.sessions.length} sessions need ${words.needsRole}`,
    opening: one
      ? `This session coming up has no ${words.coverageRole} now:`
      : `These sessions coming up have no ${words.coverageRole} now:`,
    sessionList: coverageSessionList(data.sessions),
    scheduleUrl,
    scheduleButton: emailButtonHtml("Open the schedule", scheduleUrl),
  }, {
    noticeOnly: data.noticeOnly,
    notice: {
      urgent: data.sessions.some((x) => isUrgentSession(x.sessionAt)),
      kind: "coverage-gap-opened",
      category: "team",
      ...(await teamNotice(data.hubSlug)),
      title: one
        ? `${sessionLine(one.programName, one.sessionAt)} needs ${words.needsRole}`
        : `${data.sessions.length} sessions coming up need ${words.needsRole}`,
      detail: one ? null : data.sessions.map((x) => sessionLine(x.programName, x.sessionAt)).join("\n"),
      href: appPath(scheduleUrl),
    },
  });
}

/** The weekly look-ahead: the next two weeks' sessions still needing someone. Template: "coverage-lookahead". */
export async function sendCoverageLookaheadEmail(data: {
  to: string;
  firstName: string | null;
  hubSlug: string;
  sessions: CoverageSessionLine[];
  noticeOnly?: boolean;
}): Promise<void> {
  if (data.sessions.length === 0) return;
  const words = await coverageWords(data.hubSlug);
  const n = data.sessions.length;
  const scheduleUrl = scheduleUrlFor(data.hubSlug, firstSessionAt(data.sessions));
  await sendTemplatedEmail("coverage-lookahead", data.to, {
    ...words,
    firstName: data.firstName ?? "there",
    headline: n === 1
      ? `1 session in the next two weeks needs ${words.needsRole}`
      : `${n} sessions in the next two weeks need ${words.needsRole}`,
    sessionList: coverageSessionList(data.sessions),
    scheduleUrl,
    scheduleButton: emailButtonHtml("Open the schedule", scheduleUrl),
  }, {
    noticeOnly: data.noticeOnly,
    notice: {
      urgent: data.sessions.some((x) => isUrgentSession(x.sessionAt)),
      kind: "coverage-lookahead",
      category: "team",
      ...(await teamNotice(data.hubSlug)),
      title: n === 1
        ? `1 session in the next two weeks needs ${words.needsRole}`
        : `${n} sessions in the next two weeks need ${words.needsRole}`,
      detail: data.sessions.map((x) => `${sessionLine(x.programName, x.sessionAt)}${x.note ? ` (${x.note})` : ""}`).join("\n"),
      href: appPath(scheduleUrl),
    },
  });
}

/**
 * Two days before, to the person serving: the session, their role, and who
 * else is serving it (2026-10-16 ruling: a host isn't emailed about a
 * supporting team's gap; their reminder shows it). Template:
 * "coverage-session-reminder" (pre-threshold gated by slug).
 */
export async function sendCoverageReminderEmail(data: {
  to: string;
  firstName: string | null;
  hubSlug: string;
  programName: string;
  sessionAt: Date | null;
  /** Markdown list: "- Host: Jesse Foy", "- Greeters: none yet". */
  teamPicture: string;
  /** Set when they asked for cover and no one has taken it. */
  coverNote?: string | null;
  /** Set for the hosting team on an online session: when the room opens. */
  roomNote?: string | null;
}): Promise<void> {
  const scheduleUrl = scheduleUrlFor(data.hubSlug, data.sessionAt);
  await sendTemplatedEmail("coverage-session-reminder", data.to, {
    ...(await coverageWords(data.hubSlug)),
    firstName: data.firstName ?? "there",
    programName: data.programName,
    dateText: fmtSessionWhen(data.sessionAt) ?? "",
    teamPicture: data.teamPicture,
    coverNote: data.coverNote ?? "",
    roomNote: data.roomNote ?? "",
    changeNote: await changeNoteText(data.hubSlug),
    scheduleUrl,
    scheduleButton: emailButtonHtml("View your schedule", scheduleUrl),
  }, {
    notice: {
      kind: "coverage-session-reminder",
      category: "personal",
      ...(await teamNotice(data.hubSlug)),
      title: `Reminder: you're ${(await coverageWords(data.hubSlug)).coverageVerb} at ${sessionLine(data.programName, data.sessionAt)}`,
      detail: [data.coverNote, data.teamPicture.replace(/^- /gm, ""), data.roomNote].filter(Boolean).join("\n"),
      href: appPath(scheduleUrl),
    },
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
    .map((s) => `<li>${s.programName}, ${s.dateLabel}</li>`)
    .join("");
  // Role-aware copy: "hosting" → "covering AV" / "greeting" / "facilitating"
  // when the rotation is on a non-host-team hub. Defaults to host language.
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  await recordNotice(data.to, {
    kind: "standing-assignment-scheduled",
    category: "personal",
    ...(await teamNotice(data.hubSlug)),
    title: `You're on a rotation: ${data.sessions.length === 1 ? "1 upcoming session" : `${data.sessions.length} upcoming sessions`} scheduled`,
    detail: data.sessions.map((x) => `${x.programName}, ${x.dateLabel}`).join("\n"),
    href: appPath(scheduleUrlFor(data.hubSlug)),
  });
  const subject =
    count === 1
      ? `You're scheduled for ${data.sessions[0].programName}`
      : `You're scheduled for ${count} upcoming sessions`;
  // Deep-link to the month of the FIRST scheduled session when provided.
  const schedulePath = data.firstSessionMonth
    ? `/tools/schedule?month=${data.firstSessionMonth}`
    : "/tools/schedule";
  const scheduleUrl = hubScopedUrl(schedulePath, data.hubSlug);
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been applied. You're scheduled as ${roleInline(copy)} for the following ${count === 1 ? "session" : "sessions"}:</p>
<ul>${listHtml}</ul>
${emailButtonHtml("Open the Schedule", scheduleUrl)}
${await changeNoteHtml(data.hubSlug)}
<p>This is an automated message from your standing rotation.</p>`;

  try {
    // Resend answers a refusal with { error } rather than throwing
    // (2026-10-19 audit: these sends never saw one).
    const { error } = await resend.emails.send({ from: FROM, to: data.to, subject, html: await renderEmailHtml(html) });
    if (error) console.error("[email] sendStandingAssignmentScheduledEmail refused:", error);
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
    .map((s) => `<li>${s.programName}, ${s.dateLabel}</li>`)
    .join("");
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  await recordNotice(data.to, {
    kind: "standing-assignment-replaced",
    category: "personal",
    ...(await teamNotice(data.hubSlug)),
    title: `You're no longer scheduled for ${data.sessions.length === 1 ? "1 rotation session" : `${data.sessions.length} rotation sessions`}`,
    detail: data.sessions.map((x) => `${x.programName}, ${x.dateLabel}`).join("\n"),
    href: appPath(scheduleUrlFor(data.hubSlug)),
  });
  const subject =
    count === 1
      ? `You're no longer scheduled for ${data.sessions[0].programName} on ${data.sessions[0].dateLabel}`
      : `You're no longer scheduled for ${count} upcoming sessions`;
  const scheduleUrl = hubScopedUrl(
    data.firstSessionMonth ? `/tools/schedule?month=${data.firstSessionMonth}` : "/tools/schedule",
    data.hubSlug,
  );
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your coordinator has updated the standing rotation. You're no longer scheduled as ${roleInline(copy)} for the following ${count === 1 ? "session" : "sessions"}:</p>
<ul>${listHtml}</ul>
<p>If you have questions about this change, please reach out to your coordinator. You can see your current schedule any time on the <a href="${scheduleUrl}">Schedule</a>.</p>
<p>This is an automated message from your standing rotation.</p>`;

  try {
    // Resend answers a refusal with { error } rather than throwing
    // (2026-10-19 audit: these sends never saw one).
    const { error } = await resend.emails.send({ from: FROM, to: data.to, subject, html: await renderEmailHtml(html) });
    if (error) console.error("[email] sendStandingAssignmentReplacedEmail refused:", error);
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
  await recordNotice(data.to, {
    kind: "standing-assignment-released",
    category: "personal",
    ...(await teamNotice(data.hubSlug)),
    title: `You're off the ${data.programName} rotation`,
    detail: data.sessions.length ? data.sessions.map((x) => `${x.programName}, ${x.dateLabel}`).join("\n") : null,
    href: appPath(scheduleUrlFor(data.hubSlug)),
  });
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
    : `<ul>${data.sessions
        .map((s) => `<li>${s.programName}, ${s.dateLabel}</li>`)
        .join("")}</ul>`;
  const datesIntro = count === 0
    ? `<p>You won't be scheduled for upcoming sessions of this program through this rotation.</p>`
    : `<p>The following upcoming ${count === 1 ? "date is" : "dates are"} no longer assigned to you:</p>
${listHtml}
<p>${(await isOpenSignUp(data.hubSlug)) ? "Others on the team can still sign up for them." : "They're now open for others on the team to take."}</p>`;
  // Role-aware role noun in the body ("standing rotation as Host / AV /
  // Greeter / Facilitator"). Defaults to host language when not supplied.
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>A coordinator has removed you from the standing rotation as ${roleInline(copy)} for <strong>${programName}</strong>.</p>
${datesIntro}
<p>If this was unexpected or you'd like to talk about it, please reach out to your coordinator.</p>
<p><a href="${scheduleUrl}">View the Schedule</a> &middot; This is an automated message from your standing rotation.</p>`;

  try {
    // Resend answers a refusal with { error } rather than throwing
    // (2026-10-19 audit: these sends never saw one).
    const { error } = await resend.emails.send({ from: FROM, to: data.to, subject, html: await renderEmailHtml(html) });
    if (error) console.error("[email] sendStandingAssignmentReleasedEmail refused:", error);
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
    .map((s) => `<li>${s.programName}, ${s.dateLabel}</li>`)
    .join("");
  const copy = data.coverageCopy ?? { noun: "Host", verb: "hosting", action: "host this" };
  await recordNotice(data.to, {
    kind: "standing-assignment-ended",
    category: "personal",
    ...(await teamNotice(data.hubSlug)),
    title: `Your rotation has ended: ${data.sessions.length === 1 ? "1 session" : `${data.sessions.length} sessions`} released`,
    detail: data.sessions.map((x) => `${x.programName}, ${x.dateLabel}`).join("\n"),
    href: appPath(scheduleUrlFor(data.hubSlug)),
  });
  const subject =
    count === 1
      ? `Your ${roleInline(copy)} rotation has ended`
      : `Your ${roleInline(copy)} rotation has ended (${count} sessions cleared)`;
  const scheduleUrl = hubScopedUrl(
    data.firstSessionMonth ? `/tools/schedule?month=${data.firstSessionMonth}` : "/tools/schedule",
    data.hubSlug,
  );
  const html = `
<p>Hi ${data.firstName ?? "there"},</p>
<p>Your standing rotation has been ended. The following upcoming ${count === 1 ? "session has" : "sessions have"} been cleared from your schedule:</p>
<ul>${listHtml}</ul>
<p>Thank you for the time you've contributed. If this was unexpected or you'd like to talk about it, please reach out to your coordinator.</p>
<p><a href="${scheduleUrl}">View the Schedule</a> &middot; This is an automated message from your standing rotation.</p>`;

  try {
    // Resend answers a refusal with { error } rather than throwing
    // (2026-10-19 audit: these sends never saw one).
    const { error } = await resend.emails.send({ from: FROM, to: data.to, subject, html: await renderEmailHtml(html) });
    if (error) console.error("[email] sendStandingAssignmentEndedEmail refused:", error);
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
  /** The opening words, for Notifications. */
  excerpt?: string | null;
  /** Their team emails are off: the notice only. */
  noticeOnly?: boolean;
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
  }, {
    memberText: ["threadTitle", "authorName"],
    noticeOnly: data.noticeOnly,
    notice: {
      kind: "hub-conv-new-thread",
      category: "team",
      ...teamSource(data.hubSlug, data.hubName),
      title: `${data.authorName} started "${data.threadTitle}"`,
      detail: data.excerpt || null,
      href: `/account/hub/${data.hubSlug}/conversations/${data.threadId}`,
      threadKey: `conv:${data.threadId}`,
    },
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
  /** Notifications open the thread at this reply, with its opening words. */
  replyId?: string;
  excerpt?: string | null;
  noticeOnly?: boolean;
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
  }, {
    memberText: ["threadTitle", "replierName"],
    noticeOnly: data.noticeOnly,
    notice: {
      kind: "hub-conv-new-reply",
      category: "team",
      ...teamSource(data.hubSlug, data.hubName),
      title: `${data.replierName} replied in "${data.threadTitle}"`,
      detail: data.excerpt || null,
      href: `/account/hub/${data.hubSlug}/conversations/${data.threadId}${data.replyId ? `#reply-${data.replyId}` : ""}`,
      threadKey: `conv:${data.threadId}`,
    },
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
  /** The file's place ("hub:<slug>"), for Notifications' source. */
  placeKey?: string;
  noticeOnly?: boolean;
}): Promise<void> {
  await sendTemplatedEmail("file-shared", data.to, {
    firstName: data.firstName,
    sharerName: data.sharerName,
    fileName: data.fileName,
    spaceName: data.spaceName,
    note: data.note ?? "",
    fileUrl: `${BASE_URL}/account/files/${data.fileId}`,
  }, {
    memberText: ["sharerName", "fileName", "note"],
    noticeOnly: data.noticeOnly,
    notice: {
      kind: "file-shared",
      category: "team",
      ...(data.placeKey?.startsWith("hub:") ? teamSource(data.placeKey.slice(4), data.spaceName) : { sourceKey: `files:${data.spaceName}`, sourceLabel: data.spaceName }),
      title: `${data.sharerName} shared ${data.fileName}`,
      detail: data.note || null,
      href: `/account/files/${data.fileId}`,
      threadKey: `file:${data.fileId}`,
    },
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
  placeKey?: string;
  /** Notifications open the file at this comment. */
  commentId?: string;
  noticeOnly?: boolean;
}): Promise<void> {
  await sendTemplatedEmail("file-comment", data.to, {
    firstName: data.firstName,
    commenterName: data.commenterName,
    fileName: data.fileName,
    spaceName: data.spaceName,
    excerpt: data.excerpt,
    fileUrl: `${BASE_URL}/account/files/${data.fileId}`,
  }, {
    memberText: ["commenterName", "fileName", "excerpt"],
    noticeOnly: data.noticeOnly,
    notice: {
      kind: "file-comment",
      category: "team",
      ...(data.placeKey?.startsWith("hub:") ? teamSource(data.placeKey.slice(4), data.spaceName) : { sourceKey: `files:${data.spaceName}`, sourceLabel: data.spaceName }),
      title: `${data.commenterName} commented on ${data.fileName}`,
      detail: data.excerpt || null,
      href: `/account/files/${data.fileId}${data.commentId ? `#comment-${data.commentId}` : ""}`,
      threadKey: `file:${data.fileId}`,
    },
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
  const hubPath = appPath(data.hubUrl);
  await sendTemplatedEmail("hub-welcome", data.to, {
    firstName: data.firstName,
    hubName:   data.hubName,
    hubUrl:    data.hubUrl,
    hubButton: emailButtonHtml("Open your team", data.hubUrl),
  }, {
    notice: {
      kind: "hub-welcome",
      category: "personal",
      ...teamSource(hubPath.split("/")[3] ?? "", data.hubName),
      title: `Welcome to the ${teamPhrase(data.hubName)}`,
      href: hubPath,
    },
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
  // The form-notice shape (as the volunteer and Kalyana Mitta notices): the
  // form as a heading, who sent it in a quiet block, their words under their
  // own heading, and what to do after a rule.
  const email = escapeEmailHtml(data.email);
  const html = await renderEmailHtml(
    `<h2>A message from the &ldquo;If harm happens&rdquo; form</h2>` +
      `<blockquote><p><strong>Name:</strong> ${escapeEmailHtml(data.name)}<br>` +
      `<strong>Email:</strong> <a href="mailto:${email}">${email}</a><br>` +
      `${data.isMember ? "A signed-in member" : "A visitor (not signed in)"}</p></blockquote>` +
      `<h3>Their message</h3>` +
      `<p style="white-space:pre-wrap">${escapeEmailHtml(data.message)}</p>` +
      `<hr>` +
      `<p>Reply to this email to answer them directly.</p>`
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
