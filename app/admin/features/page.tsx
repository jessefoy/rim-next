import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Feature Inventory — Admin" };

// ─── Types ──────────────────────────────────────────────────────────────────

type FeatureStatus = "active" | "stub" | "planned" | "partial";

interface FeatureEntry {
  name: string;
  locations: string[];       // URL paths or "API: /path", "File: path/to/file"
  what: string;              // what it does (1–3 sentences)
  relatedTo: string[];       // functional relationships (plain-language strings)
  status?: FeatureStatus;
  note?: string;
}

interface FunctionalArea {
  id: string;
  title: string;
  icon: string;
  desc: string;
  features: FeatureEntry[];
}

// ─── Feature Data ─────────────────────────────────────────────────────────────

const AREAS: FunctionalArea[] = [
  {
    id: "auth",
    title: "Authentication & Onboarding",
    icon: "🔐",
    desc: "How members join the community and sign in. Magic-link only — no passwords.",
    features: [
      {
        name: "Magic Link Login",
        locations: ["/login", "/login/check-email", "/login/error", "File: auth.ts"],
        what: "Members enter their email and receive a one-time sign-in link via Resend. No password is ever set or required. Works the same whether the person is new or returning — new users flow directly into the onboarding step.",
        relatedTo: [
          "Triggers Community Welcome flow for first-time users",
          "Feeds session into all protected routes (Route Protection)",
          "Uses Resend email service (shared with Email & Notifications)",
        ],
      },
      {
        name: "Community Welcome / Onboarding",
        locations: ["/account/welcome", "API: POST /api/account/complete-profile"],
        what: "First-time members must set their name and check the community agreements checkbox before accessing the member area. Declining immediately deletes the account and signs the user out. Abandoning the page (closing the browser) results in cleanup by the daily cron after 48 hours.",
        relatedTo: [
          "Blocks access to member area until complete (Route Protection)",
          "Writes firstName, lastName, phone, agreedToTerms to Postgres",
          "Community agreements also collected inline during Program Registration",
          "Abandoned incomplete accounts cleaned by the Cleanup Cron",
        ],
      },
      {
        name: "Account Reactivation (Archived Members)",
        locations: ["/account/reactivate", "API: PATCH /api/account/reactivate"],
        what: "Members who have been archived by an admin can reactivate themselves via a magic link. Landing on this page clears archivedAt in one click and redirects to the dashboard. Registering for any program also auto-restores an archived member.",
        relatedTo: [
          "Triggered by Member Archive system (Member Management)",
          "Route Protection redirects archived sessions here instead of the member area",
          "Auto-restore also fires at Program Registration (no login required path)",
        ],
      },
      {
        name: "Cleanup Cron — Incomplete Accounts",
        locations: ["API: GET /api/cron/cleanup-incomplete-accounts", "File: vercel.json (cron schedule)"],
        what: "Runs daily at 15:00 UTC. Deletes User records where agreedToTerms = false and the account is older than 48 hours — removing people who started the sign-in flow but never completed onboarding.",
        relatedTo: [
          "Targets accounts created by magic-link login but never completed Community Welcome",
          "Keeps member list clean for Member Management (Admin)",
          "Scheduled alongside the Reminder Cron in vercel.json",
        ],
      },
    ],
  },

  {
    id: "routes",
    title: "Route Protection",
    icon: "🛡️",
    desc: "What happens when someone tries to access a protected URL without the right credentials.",
    features: [
      {
        name: "Proxy (Auth Guard)",
        locations: ["File: proxy.ts (Next.js 16 — replaces middleware.ts)"],
        what: "Intercepts requests to protected URL prefixes before they reach page components. Redirects unauthenticated users to /login, members who haven't agreed to terms to /account/welcome, and archived members to /account/reactivate.",
        relatedTo: [
          "Protects /account/*, /volunteer/*, /admin/*, /course/*, /account/hub/*",
          "Reads session cookie set by Authentication",
          "Works with Member Archive system (checks archivedAt)",
          "Works with Community Onboarding system (checks agreedToTerms)",
        ],
      },
      {
        name: "Role-Based Access (Server Components)",
        locations: ["/volunteer/*", "/admin/*", "/account/hub/*"],
        what: "Staff-only pages perform a second role check inside the server component beyond what the proxy does. If the user is authenticated but lacks the required role, an 'unauthorized' message is rendered inline (no graceful redirect yet).",
        relatedTo: [
          "Roles assigned via Member Management (Admin)",
          "Session carries roles array populated by auth.ts session callback",
          "Connects to every staff and admin feature area",
        ],
      },
    ],
  },

  {
    id: "registration",
    title: "Program Registration",
    icon: "📋",
    desc: "The full flow for registering for a program — from the form through confirmation. The front door to community membership.",
    features: [
      {
        name: "Registration Form (inline on program page)",
        locations: ["/programs/[slug]", "Component: RegistrationForm.tsx", "API: POST /api/registrations"],
        what: "Displayed on the program detail page when registrationEnabled = true in Postgres. Collects name, email, phone, custom per-program questions, and (for non-logged-in users) the community agreements checkbox. Handles capacity limits, waitlisting, closed registration, and duplicate prevention.",
        relatedTo: [
          "Connects to Postgres (Program model) for program configuration (custom fields, capacity, deadline)",
          "Triggers Confirmation Email on success",
          "Leads into Dana / Stripe Payment step post-registration",
          "Email Recognition system pre-fills known members",
          "Writes back agreedToTerms to member profile if checkbox shown",
          "Auto-restores archived members who register",
        ],
      },
      {
        name: "Standalone Registration Page",
        locations: ["/programs/[slug]/register"],
        what: "A focused, nav-free version of the registration form — same logic and components as the inline form. Useful for direct links in emails or on external sites.",
        relatedTo: [
          "Same backend: POST /api/registrations",
          "Same Email Recognition, capacity, and dana logic",
          "Linked from the registration confirmation email CTA",
        ],
      },
      {
        name: "Email Recognition & Field Locking",
        locations: ["Component: RegistrationForm.tsx", "API: GET /api/account/check-email"],
        what: "When a non-logged-in person types their email and blurs the field, the form calls /api/account/check-email. If the email matches a known account, name and phone are pre-filled from the account record and locked (readOnly). Account values always win — they cannot be overwritten by form submission.",
        relatedTo: [
          "Protects member profile data integrity (Member Management)",
          "Connects account data (Postgres) to registration form (public page)",
          "Works on both inline (/programs/[slug]) and standalone (/programs/[slug]/register)",
        ],
      },
      {
        name: "Capacity Limits & Waitlist",
        locations: ["/programs/[slug]", "API: POST /api/registrations"],
        what: "Each program can have a registrationCapacity set in Postgres. When capacity is reached, new registrants are placed on the waitlist and assigned a position number. Waitlisted registrants do not see the dana step — their donationStatus is NOT_REQUIRED until promoted.",
        relatedTo: [
          "Capacity and deadline configured in the Program model (programs schema)",
          "Waitlist promotion handled in Volunteer / Registrar Tools",
          "Spot-opened alert shown in volunteer table when a cancellation creates a vacancy",
          "Member self-cancel also triggers spot-opened alert",
        ],
      },
      {
        name: "Custom Per-Program Questions",
        locations: ["Program Editor (programs → Registration tab)", "Component: RegistrationForm.tsx", "API: POST /api/registrations"],
        what: "Program coordinators can define custom questions for each program in Postgres (short text, long text, yes/no, dropdown). Answers are stored as a JSON object on the Registration record and shown to registrars in the volunteer table.",
        relatedTo: [
          "Configured in the Program model (registrationFields array on programs schema)",
          "Displayed and editable inline in Volunteer / Registrar Tools",
          "Included as columns in CSV Export",
          "Can be updated by registrant via Self-Service Edit Link",
        ],
      },
      {
        name: "Duplicate Prevention",
        locations: ["API: POST /api/registrations"],
        what: "A registration is a duplicate if the same userId + programId already exists with a non-CANCELLED status. Cancelled registrants can re-register. The form shows a 'you're already registered' message for logged-in users; duplicate prevention for guests happens in the API.",
        relatedTo: [
          "Checked before any DB write in POST /api/registrations",
          "Cancelled registrations are exempt — re-registration is allowed",
        ],
      },
      {
        name: "Member Self-Cancel Registration",
        locations: ["/account/dashboard-my-registrations", "Component: CancelRegistrationButton.tsx", "API: POST /api/account/registrations/[id]/cancel"],
        what: "Members can cancel their own active registrations from the My Programs page. A 4-state button (idle → confirming → loading → done) with inline confirmation. Sends a cancellation notification to the registrar. Spot-opened badge appears in the volunteer table when the cancellation creates a vacancy.",
        relatedTo: [
          "Triggers Cancellation Notification email to registrar",
          "Updates Capacity — may show 'spot opened' alert in Volunteer / Registrar Tools",
          "Auth-gated + ownership check (member can only cancel their own registrations)",
        ],
      },
    ],
  },

  {
    id: "email",
    title: "Email & Notifications",
    icon: "✉️",
    desc: "Every transactional email the system sends. All sent via Resend. All failures are logged but never block the triggering action.",
    features: [
      {
        name: "Registration Confirmation Email",
        locations: ["File: lib/email.ts (sendRegistrationEmail)", "API: POST /api/registrations"],
        what: "Sent immediately after a successful registration. Two variants: REGISTERED (subject: 'You're registered — [Program]', with add-to-calendar links) and WAITLISTED (subject: 'You're on the waitlist — [Program]', with waitlist position). Includes the per-program confirmationMessage rich text if set in Postgres.",
        relatedTo: [
          "Triggered by Program Registration",
          "Includes calendar links if startDatetime/endDatetime set in Postgres",
          "confirmationMessage block configured in the Program model",
          "Converted by lib/portableTextEmail.ts for email-safe rendering",
        ],
      },
      {
        name: "Waitlist Approval Email",
        locations: ["File: lib/email.ts (sendApprovalEmail)", "API: PATCH /api/registrations/[id]"],
        what: "Sent when a registrar promotes a registrant from WAITLISTED to APPROVED or REGISTERED. Includes the program date/time/location and, if the program has a dana practice, a 'Complete Dana Offering' button linking to the program page.",
        relatedTo: [
          "Triggered by Waitlist Promotion action in Volunteer / Registrar Tools",
          "Dana section conditional on program's danaMode (Postgres (Program model))",
          "When approved, donationStatus flips from NOT_REQUIRED to PENDING",
        ],
      },
      {
        name: "Cancellation Notification (to Registrar)",
        locations: ["File: lib/email.ts (sendCancellationNotificationEmail)", "API: PATCH /api/registrations/[id], API: POST /api/account/registrations/[id]/cancel"],
        what: "Sent to REGISTRAR_EMAIL whenever a registration is cancelled — whether by the registrar in the volunteer table, or by the member themselves. Includes registrant name, email, program, and a link to the registration table.",
        relatedTo: [
          "Triggered by registrar Cancel action (Volunteer / Registrar Tools)",
          "Also triggered by Member Self-Cancel (Program Registration)",
          "REGISTRAR_EMAIL set in Vercel environment variables",
        ],
      },
      {
        name: "Edit Request Email (to Registrant)",
        locations: ["File: lib/email.ts (sendEditRequestEmail)", "API: PATCH /api/registrations/[id] (action: sendEditRequest)"],
        what: "Sent when a registrar clicks 'Send Edit Request.' Includes a 'Update My Responses →' button linking to /update/[token]. The token expires in 7 days and is single-use.",
        relatedTo: [
          "Triggered from Volunteer / Registrar Tools (Send Edit Request action)",
          "Links to Self-Service Edit Link page (/update/[token])",
          "Token system connects to the Registration record (editToken, editTokenExpiresAt fields)",
        ],
      },
      {
        name: "Responses Updated Notification (to Registrar)",
        locations: ["File: lib/email.ts (sendResponsesUpdatedEmail)", "API: POST /api/update/[token]"],
        what: "Sent to REGISTRAR_EMAIL when a registrant submits the self-service edit form. Includes a link to the volunteer registration table for the program.",
        relatedTo: [
          "Triggered by Self-Service Edit Link form submission",
          "REGISTRAR_EMAIL env var",
          "Counterpart to Edit Request Email",
        ],
      },
      {
        name: "Program Reminder Email",
        locations: ["File: lib/email.ts (sendReminderEmail)", "API: GET /api/cron/send-reminders, POST /api/programs/[slug]/send-reminder, PATCH /api/registrations/[id] (action: sendReminder)"],
        what: "Sent to active (REGISTERED/APPROVED) registrants before a program. Managed template — body editable at /admin/emails (slug: session-reminder). Includes date/time/location and an optional custom reminderMessage from Postgres (converted to markdown via portableTextToMarkdown() before template insertion). Can be sent automatically by the daily cron (if reminderDate is set in Postgres), in bulk via the volunteer table banner, or per-row via the Actions panel. reminderSentAt prevents double-sends across all paths.",
        relatedTo: [
          "reminderDate and reminderMessage configured in the Program model",
          "Shown in Volunteer / Registrar Tools (reminder banner + per-row button)",
          "Scheduled via Scheduling & Automation (Reminder Cron)",
          "Managed via Email Template Manager (slug: session-reminder)",
        ],
      },
      {
        name: "Dana Reminder Email (Manual)",
        locations: ["File: lib/email.ts (sendDanaReminderEmail)", "API: PATCH /api/registrations/[id] (action: sendDanaReminder)"],
        what: "A gentle nudge to registrants whose donationStatus is PENDING (skipped the dana step). Sent manually by a registrar from the volunteer table. Returns 400 if donationStatus is not PENDING.",
        relatedTo: [
          "Available in Volunteer / Registrar Tools for REGISTERED/APPROVED rows with PENDING dana",
          "Links registrant to the program page dana step (Stripe/Dana)",
          "Future: automated daily cron version planned (see Not Yet Built)",
        ],
      },
      {
        name: "REGISTRAR Role Notification Email",
        locations: ["File: lib/email.ts (sendRoleAssignmentEmail)", "API: PATCH /api/admin/members/[id]"],
        what: "Sent automatically (fire-and-forget) when the REGISTRAR role is newly granted to a member. Highlights two bookmarks: the Registrations dashboard and the Staff Manual. Not re-sent if REGISTRAR is already set when changes are saved.",
        relatedTo: [
          "Triggered by Role Assignment in Member Management (Admin)",
          "Links to /account/registrar and /admin/manual",
          "HOST role assignment has a separate notification email",
        ],
      },
      {
        name: "HOST Role Notification Email",
        locations: ["File: lib/email.ts (sendHostRoleAssignmentEmail)", "API: PATCH /api/admin/members/[id]"],
        what: "Sent once when the HOST role is first assigned to a member. Managed template — body editable at /admin/emails (slug: host-role-assigned).",
        relatedTo: [
          "Triggered by HOST Role Assignment in Member Management (Admin)",
          "Links to /account/hub/host-team and relevant documentation",
          "Managed via Email Template Manager (slug: host-role-assigned)",
        ],
      },
      {
        name: "Email Template Manager",
        locations: ["Page: /admin/emails", "Page: /admin/emails/[slug]", "File: components/EmailTemplateEditor.tsx", "File: components/RimEditor.tsx", "File: lib/tiptap-variable-node.ts", "API: PATCH /api/admin/emails/[slug]", "API: POST /api/admin/emails/[slug]/preview"],
        what: "Database-backed system for editing transactional email copy without code deploys. 7 managed templates stored in the email_templates table (Postgres). Admins can edit subject lines, body copy (rich Tiptap markdown editor with variable chip insertion), enable/disable delivery, and preview rendered output. Chrome bands show the email header/footer wrapper. Contextual help text above the subject explains each template; Program-origin variables are called out with a distinct teal callout. 11 email functions remain hardcoded for structural reasons (attachments, conditional logic, auth flows) — documented with comment blocks in lib/email.ts.",
        relatedTo: [
          "Managed templates: session-reminder, first-time-attendee, returning-after-absence, host-role-assigned, sub-request-posted, sub-request-claimed, missing-report-alert",
          "Uses RimEditor (Tiptap v3) with custom VariableNode for {{token}} pills",
          "portableTextToMarkdown() in lib/portableTextEmail.ts for PT → template variable conversion",
          "Render pipeline: sendTemplatedEmail → marked → wrapInEmailChrome → juice → Resend",
          "Seed files: seed-email-templates.js, seed-email-groups.ts, seed-email-help-text.js",
        ],
      },
      {
        name: "Newsletter Signup",
        locations: ["/api/subscribe (POST)", "File: api/subscribe.js (also in rim-website Eleventy)"],
        what: "Used by the newsletter signup form in the site footer. Adds the subscriber to Flodesk and assigns them to the RIM segment.",
        relatedTo: [
          "Footer component (public-facing, no auth required)",
          "Flodesk segment ID configured in environment variables",
        ],
      },
    ],
  },

  {
    id: "dana",
    title: "Payment & Dana (Stripe)",
    icon: "💰",
    desc: "The dana (generosity) practice step that appears after registration. Powered by Stripe Checkout. Never a barrier to registration — always a separate invitation.",
    features: [
      {
        name: "Dana Step UI (inline, post-registration)",
        locations: ["/programs/[slug]", "/programs/[slug]/register", "Component: RegistrationForm.tsx"],
        what: "After confirming registration, REGISTERED (not WAITLISTED) participants see an inline dana invitation. Shows program-specific message, a pre-filled editable amount, and two choices: 'Offer dana →' (opens Stripe Checkout) or 'I'll contribute another time' (genuinely optional — leaves donationStatus: PENDING). The dana step is skipped entirely for danaMode: none.",
        relatedTo: [
          "Dana mode and amounts configured in the Program model (programs → Dana tab)",
          "Stripe Checkout Session Creation (API)",
          "donationStatus on Registration record (Postgres DB)",
          "Add-to-Calendar Links (appear post-registration, before dana step for REGISTERED)",
        ],
      },
      {
        name: "Dana Modes",
        locations: ["Program Editor (programs → Dana tab)", "File: sanity/schemas/programs.js"],
        what: "Four modes configurable per program: none (free, no step), voluntary (suggested editable amount), base_plus_dana (fixed required base cost + editable dana on top), fixed (set price, no dana framing). If required amount fields are blank, the step is skipped and donationStatus set to WAIVED.",
        relatedTo: [
          "Drives behavior of Dana Step UI",
          "Controls donationStatus assigned to waitlisted registrants (always NOT_REQUIRED)",
          "Dana mode determines email content in Waitlist Approval Email",
        ],
      },
      {
        name: "Stripe Checkout Session Creation",
        locations: ["API: POST /api/stripe/checkout", "File: lib/stripe.ts"],
        what: "Creates a Stripe-hosted Checkout session with line items, metadata (registrationId, programTitle, donorName, etc.), success/cancel redirect URLs. Returns the session URL. Stripe handles all card data — PCI compliant.",
        relatedTo: [
          "Called by Dana Step UI when member clicks 'Offer dana'",
          "Metadata enables QuickBooks reconciliation",
          "stripeSessionId stamped on Registration for deduplication",
          "Leads to Stripe Webhook on payment completion",
        ],
      },
      {
        name: "Stripe Webhook",
        locations: ["API: POST /api/stripe/webhook"],
        what: "Receives checkout.session.completed events from Stripe. Verifies the Stripe-Signature header, updates the Registration record (donationStatus: COMPLETED, donationAmount in cents), and writes a Donation ledger record. Idempotent — checks stripeSessionId before processing to handle duplicate webhook deliveries.",
        relatedTo: [
          "Triggered by Stripe after successful payment",
          "Writes to Donation DB model (Postgres)",
          "Updates Registration donationStatus",
          "stripeSessionId deduplication guard",
        ],
      },
      {
        name: "Donation Ledger (DB Model — UI Planned)",
        locations: ["File: prisma/schema.prisma (Donation model)"],
        what: "A unified record of every contribution regardless of source (STRIPE, GIVEBUTTER, CASH, CHECK, OTHER). The schema is live and Stripe dana donations write here automatically via the webhook from day one. The admin UI for viewing, manually entering, or exporting donations does not yet exist.",
        relatedTo: [
          "Written by Stripe Webhook on every completed payment",
          "Planned: /admin/donations UI for manual entry, GiveButter import, QuickBooks export",
          "Linked to Registration and User records",
        ],
        status: "partial",
        note: "DB schema + Stripe write live; admin UI not yet built",
      },
      {
        name: "Add-to-Calendar Links",
        locations: ["/programs/[slug] (post-registration)", "API: GET /api/programs/[slug]/ical", "File: lib/calendarLinks.ts"],
        what: "After confirming registration, members see '+ Google Calendar' and '+ Apple / Outlook' links. Google Calendar link opens pre-filled. The .ics route returns an RFC 5545 file for Apple/Outlook download. Links only appear when startDatetime/endDatetime are set in Postgres. Recurrence rules (RRULE) are generated from the 4 recurrence fields in Postgres.",
        relatedTo: [
          "startDatetime/endDatetime configured in the Program model (programs → Schedule & Location tab)",
          "Recurrence fields (recurrenceFreq, recurrenceInterval, recurrenceDays, recurrenceCount) drive the RRULE — null recurrenceCount = no COUNT in RRULE = infinite recurrence",
          "Also included in Registration Confirmation Email",
        ],
      },
    ],
  },

  {
    id: "volunteer",
    title: "Volunteer / Registrar Tools",
    icon: "📊",
    desc: "Private staff area for managing program registrations. Accessible at /account/registrar. Requires login; REGISTRAR or ADMIN role.",
    features: [
      {
        name: "Registrar Program List",
        locations: ["/account/registrar"],
        what: "Lists all programs where registrationEnabled = true (from Postgres). Shows registration counts by status (total, registered, waitlisted, approved). Each program links to its registration table.",
        relatedTo: [
          "Postgres — registrationEnabled field on programs",
          "Registration counts from Postgres DB",
          "Entry point to Registration Management Table",
        ],
      },
      {
        name: "Registration Management Table",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: GET /api/programs/[slug]/registrations"],
        what: "Full registrant list for a program with filtering by status. Each row shows name, email, phone, status badge, donation status, and registration date. Click to expand for custom field answers and staff notes. Mobile view transforms into a card layout.",
        relatedTo: [
          "All registration actions connect to PATCH /api/registrations/[id]",
          "Custom fields come from both Registration DB and Program model (field type definitions)",
          "All email actions connect to Email & Notifications",
          "CSV Export (API: GET /api/programs/[slug]/registrations?format=csv)",
        ],
      },
      {
        name: "Promote / Cancel / Restore Actions",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id]"],
        what: "Context-aware action buttons per row: WAITLISTED → 'Promote →' (moves to APPROVED, sets donationStatus, sends approval email); REGISTERED/APPROVED → 'Cancel' (with inline confirm, sends cancellation notification); CANCELLED → 'Restore' (moves back to REGISTERED). Optimistic UI.",
        relatedTo: [
          "Waitlist Approval Email triggered on promote",
          "Cancellation Notification Email triggered on cancel",
          "donationStatus auto-set based on program's danaMode on promote",
          "Spot-opened alert shown in table when cancellation creates a vacancy",
        ],
      },
      {
        name: "Inline Custom Field Editing",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id]"],
        what: "Registrar can edit a registrant's custom field answers inline without a page reload. Click 'Edit' next to the RESPONSES column header to enter edit mode. Input type is determined by the field definition in Postgres: yesNo → dropdown, select → dropdown with program options, longText → textarea, shortText → text input.",
        relatedTo: [
          "Field type definitions from Postgres (Program model) (registrationFields)",
          "Stores answers as JSON in Registration.customFields",
          "Also editable by the registrant via Self-Service Edit Link",
        ],
      },
      {
        name: "Send Edit Request (Self-Service Edit Link)",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendEditRequest)", "/update/[token]"],
        what: "Registrar can send a non-cancelled registrant a secure one-time link to update their own custom field answers without logging in. The link expires in 7 days and is invalidated immediately after use.",
        relatedTo: [
          "Edit Request Email (to registrant)",
          "Responses Updated Notification (to registrar) on submit",
          "Self-Service Edit Link page (/update/[token])",
          "editToken + editTokenExpiresAt fields on Registration DB model",
        ],
      },
      {
        name: "Send Reminder (Per-Row & Bulk)",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendReminder), POST /api/programs/[slug]/send-reminder"],
        what: "Per-row: 'Send Reminder' button on REGISTERED/APPROVED rows. Shows sent timestamp after first send; re-sends possible. Bulk: 'Send to Remaining N' button in the reminder banner above the table (shown when reminderDate is set in Postgres). reminderSentAt prevents double-sends from cron + manual.",
        relatedTo: [
          "Program Reminder Email",
          "reminderDate set in the Program model (programs → Registration tab)",
          "Reminder Cron also fires from the same reminderDate",
        ],
      },
      {
        name: "Send Dana Reminder (Per-Row, Manual)",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendDanaReminder)"],
        what: "Available for REGISTERED/APPROVED rows where donationStatus is PENDING. Sends a gentle dana nudge email. Returns 400 if donationStatus is not PENDING.",
        relatedTo: [
          "Dana Reminder Email",
          "Payment & Dana (Stripe) — donationStatus: PENDING",
          "Planned: automated cron version for PENDING donations ≥24h old",
        ],
      },
      {
        name: "CSV Export",
        locations: ["API: GET /api/programs/[slug]/registrations?format=csv", "Component: VolunteerTable.tsx (download link)"],
        what: "Exports all registrations for a program as a CSV file. Custom field answers are included as dynamically named columns. A plain <a download> link — no JS fetch.",
        relatedTo: [
          "Custom fields from Registration.customFields JSON",
          "Available in Registration Management Table for any registration-enabled program",
        ],
      },
      {
        name: "Spot-Opened Alert",
        locations: ["/account/registrar/[slug]", "Component: VolunteerTable.tsx"],
        what: "When a cancellation (by staff or member) creates a vacancy, a banner appears in the volunteer table indicating a spot is now open and a waitlisted registrant could be promoted.",
        relatedTo: [
          "Triggered by Cancel action (Promote / Cancel / Restore Actions)",
          "Also triggered by Member Self-Cancel (Program Registration)",
          "Encourages registrar to promote from Waitlist",
        ],
      },
    ],
  },

  {
    id: "hub",
    title: "Host Community Hub",
    icon: "🏠",
    desc: "The internal collaboration space for the host volunteer team. Replaces spreadsheets and Basecamp. Accessible at /account/hub/host-team. Requires HOST, HOST_MANAGER, or ADMIN role.",
    features: [
      {
        name: "Schedule Tab",
        locations: ["/account/hub/host-team/schedule", "/account/hub/host-team/schedule", "Component: HubScheduleClient.tsx", "API: GET /api/host/assignments"],
        what: "7-column calendar + list view showing all HostAssignment records for the current month. Filter pills (All / Mine / Needs Attention) filter both views. Calendar: single-card spec layout with today-circle, color-coded event chips (mine=steel-lt, covered=sage-lt, needs=terra-lt). List view: clicking a row expands a SessionDetail panel inline, directly beneath that row. Calendar view shows SessionDetail below the calendar grid. From the panel: claim an open session, request a sub, or (HOST_MANAGER) assign a host. Shared HubScheduleClient receives apiBase prop — /api/host for both the old /account/hub/host-team/schedule page and /account/hub/host-team/schedule.",
        relatedTo: [
          "HostAssignment Postgres model — links userId + programSlug (+ optional sessionDate)",
          "Postgres — program names, meet links, room accounts read from hostProgramsQuery",
          "Assignment Manager — HOST_MANAGER creates/removes assignments shown here",
          "Google Meet Integration — meetLink and meetHostAccount fields",
          "hub-cal, hub-sched-list-*, hub-detail CSS classes in public/css/custom.css",
        ],
      },
      {
        name: "Sub Board",
        locations: ["/account/hub/host-team/subs", "Component: SubBoard.tsx", "Component: SubRequestForm.tsx", "API: GET /api/host/sub-requests, POST /api/host/sub-requests, POST /api/host/sub-requests/[id]/claim, PATCH /api/host/sub-requests/[id] (cancel)"],
        what: "Any HOST/HOST_MANAGER/ADMIN user can post a sub request for a session they can't cover, choosing from their own assignments and optionally specifying a date. Open requests appear on the board for any hub member to claim. Claiming flips the status to CLAIMED atomically (db.$transaction). Cannot claim your own request.",
        relatedTo: [
          "SubRequest + SubClaim Postgres models",
          "Notifies all hub members on request creation (email + alert)",
          "Notifies original requester when claimed (email + alert)",
          "Sub request status: OPEN → CLAIMED or CANCELLED",
        ],
      },
      {
        name: "Threads",
        locations: ["/account/hub/host-team/threads", "/account/hub/host-team/threads/[id]", "Component: HubThreadDetailClient.tsx", "API: GET/POST /api/host/threads, GET/PATCH /api/host/threads/[id], POST /api/host/threads/[id]/replies"],
        what: "A discussion board with two categories: OPERATIONAL (peer support, tips, questions) and CONTEMPLATION (weekly teacher/manager post for group reflection). Any hub member can create threads and reply using FormattedEditor (rich text with underline, alignment, word count). Thread and reply bodies stored as Tiptap JSON, rendered via renderFormattedText(). HOST_MANAGER/ADMIN can close (no new replies) or archive (hidden from main list) threads. Reply notification targets thread author + all prior repliers (deduplicated, excluding the current replier). Posting a reply bumps thread updatedAt so it floats to the top.",
        relatedTo: [
          "HostThread + HostReply Postgres models; ThreadStatus enum: OPEN / CLOSED / ARCHIVED",
          "New thread notifies all hub members (email + alert)",
          "New reply notifies thread author + prior repliers (email + alert)",
          "Close/archive restricted to HOST_MANAGER and ADMIN",
        ],
      },
      {
        name: "Assignment Manager",
        locations: ["/account/hub/host-team/schedule", "Component: AssignmentManager.tsx", "API: GET/POST /api/host/assignments, DELETE /api/host/assignments/[id]"],
        what: "HOST_MANAGER and ADMIN only. Displays all virtual/hybrid programs (without zoomLink filter — so hosts can be assigned before a Meet link is created). For each program, shows current assignments with a remove button. Assigns a host by selecting from a dropdown of HOST/HOST_MANAGER/ADMIN users.",
        relatedTo: [
          "HostAssignment Postgres model — the join between a user and a program/session",
          "allVirtualProgramsQuery (lib/queries.ts) — all virtual+hybrid programs without zoomLink filter",
          "Schedule Tab reflects assignments created here",
          "⚠️ programSlug is the join key — never change a program's slug once assignments exist",
        ],
      },
      {
        name: "Alert Strip",
        locations: ["/account/dashboard", "Component: AlertStrip.tsx", "API: GET /api/account/alerts, PATCH /api/account/alerts (mark-read / mark-all-read)"],
        what: "An unread alert badge and expandable strip rendered above the nav cards on the member dashboard. Shows unread count in a badge; clicking the alert icon expands the list. Each alert links to the relevant hub page. Clicking an alert marks it read; 'Mark all as read' bulk action available.",
        relatedTo: [
          "Alert Postgres model — type, message, linkUrl, read flag, userId",
          "AlertType enum: SUB_REQUEST · SUB_CLAIMED · NEW_THREAD · NEW_REPLY · UNASSIGNED_SESSION",
          "Alerts created alongside notification emails in every API route that fires notifications",
          "Unassigned-Hosts Cron creates UNASSIGNED_SESSION alerts",
        ],
      },
      {
        name: "Unassigned-Hosts Cron",
        locations: ["API: GET /api/cron/check-unassigned-hosts", "File: vercel.json (cron schedule: 0 16 * * *)"],
        what: "Runs daily at 16:00 UTC. Fetches all virtual/hybrid programs from Postgres with startDatetime within the next 30 days. Cross-checks against HostAssignment records. For any program with no standing assignment, creates UNASSIGNED_SESSION alerts for all HOST_MANAGER and ADMIN users. Deduplication: checks if an alert with the same linkUrl was created in the last 24 hours — safe to run multiple times per day.",
        relatedTo: [
          "Alert Postgres model — UNASSIGNED_SESSION type",
          "Postgres — programs with startDatetime used for the 30-day window",
          "HostAssignment Postgres model — checked for standing assignments (sessionDate: null)",
          "CRON_SECRET env var — same auth pattern as send-reminders and cleanup crons",
        ],
      },
      {
        name: "Live Session View",
        locations: ["/account/hub/host-team/session", "Component: SessionLiveClient.tsx", "File: app/account/hub/[slug]/session/page.tsx"],
        what: "Real-time attendance view for the host team. Shows all virtual/hybrid programs running today with their attendees (from SessionAttendance records). Attendees appear as name chips with New and Welcome Back badges. Registered-but-not-joined names appear in a muted list below. Polls via router.refresh() every 60 seconds. Visible to HOST, HOST_MANAGER, REGISTRAR, and ADMIN.",
        relatedTo: [
          "SessionAttendance Postgres model — records written by Join button on dashboard",
          "Session Attendance Join Route — writes attendance when member clicks Join",
          "Postgres query — fetches today's programs with recurrence data",
          "isOccurrenceToday() — JS-side recurrence logic to filter today's programs",
        ],
      },
      {
        name: "Flag Attendee for Follow-Up",
        locations: ["/account/hub/host-team/session", "API: PATCH /api/attendance/[recordId]/flag", "Component: SessionLiveClient.tsx"],
        what: "Hosts can tap any attendee chip to toggle a flaggedByHost boolean on their SessionAttendance record. Flagged chips get a small dot. The flag is a personal note — it does not notify anyone or persist beyond the current session record. Intended as an in-session prompt for post-session follow-up.",
        relatedTo: [
          "SessionAttendance Postgres model — flaggedByHost field",
          "Live Session View — flag state appears in the chip, updates on next poll",
          "Post-Session Form — where flagged names can be written up as follow-up notes",
        ],
      },
      {
        name: "End Session Button",
        locations: ["/account/hub/host-team/session", "API: POST /api/attendance/session/[programSlug]/end", "Component: SessionLiveClient.tsx"],
        what: "HOST, HOST_MANAGER, and ADMIN users see a 'Close session & write notes →' button on each active program card. Clicking it POSTs to the end API, sets sessionEndedAt on the SessionReport (upsert — creates a stub if no report exists yet), then redirects to the post-session form. A 'Session closed [time] CT' badge appears on the card for all host team members on their next poll. Once sessionEndedAt is set, the Join route silently blocks new attendance for that session.",
        relatedTo: [
          "SessionReport Postgres model — sessionEndedAt DateTime? field",
          "Session Attendance Join Route — checks sessionEndedAt before processing any join click",
          "Post-Session Form — redirect destination after session is closed",
          "Live Session View — badge and button rendering, isEnded computed from sessionEnded || !!sessionEndedAt",
        ],
      },
      {
        name: "Session Attendance Join Route",
        locations: ["API: POST /api/attendance/join", "File: app/api/attendance/join/route.ts"],
        what: "Called when a member clicks the Join button on their dashboard. Guards: (1) sessionEndedAt hard cutoff — if host has closed the session, silently returns ok:true without writing a record; (2) time-window guard — allows joins only within 1 hour before start to 1 hour after end (DB fetch). On first join, computes isNewMember (no prior records) and returningAfterAbsence (last record older than 6 weeks). Upsert: if record already exists for the day, updates joinedAt only.",
        relatedTo: [
          "SessionAttendance Postgres model — userId + programSlug + sessionDate unique key",
          "SessionReport — sessionEndedAt checked before DB window fetch (DB-first, faster)",
          "Dashboard Hub — Join button fires this route; DashboardAutoRefresh triggers router.refresh() on window open",
          "Live Session View — attendance records written here appear as chips",
        ],
      },
      {
        name: "Post-Session Form",
        locations: ["/account/hub/host-team/session/[programSlug]/post", "Component: PostSessionClient.tsx", "API: POST /api/attendance/session/[programSlug]/post"],
        what: "Three-section form filed after each session. Section 1: Flagged people — each person tapped during the session appears with a FormattedEditor note field and 4 routing radio buttons (No action / Gentle follow-up / Jesse only — sensitive / Technical issue), each with a plain-language description. Section 2: Session reflection (FormattedEditor, optional but encouraged). Section 3: Resource to share with attendees (URL + brief note). All hosts see the full form — no co-host distinction. Autosaves to localStorage on every change, keyed by programSlug + sessionDate. Submitting upserts SessionReport + updates SessionAttendance routing + sends notification email to Jesse and/or coordinator. Notes and reflections stored as Tiptap JSON (Json?). Email notifications use extractText() for plain-text.",
        relatedTo: [
          "SessionReport Postgres model — reflection Json?, resourceUrl, resourceNote, submittedByAssignedHost",
          "SessionAttendance Postgres model — postSessionNote Json?, postSessionAction enum",
          "FormattedEditor (Tiptap JSON) — all multi-line text fields",
          "lib/renderRichContent.ts — extractText() for email, renderFormattedText() for history display",
          "End Session Button — creates stub SessionReport, form fills the rest",
          "Live Session View — post-session link appears when isEnded",
          "Session History — coordinator view shows flagged attendees with notes and routing",
        ],
      },
    ],
  },

  {
    id: "member",
    title: "Member Experience",
    icon: "👤",
    desc: "The member area — everything a logged-in community member can see and do.",
    features: [
      {
        name: "Dashboard Hub",
        locations: ["/account/dashboard"],
        what: "The member area home page. Displays greeting, Today's Virtual Sessions (Live Now + Later Today sections), upcoming program registrations, quick links, pending dana reminders, and hub memberships. Today's sessions use JS-side recurrence logic (isOccurrenceToday) — join button appears only in Live Now, 12 min before start. DashboardAutoRefresh silently calls router.refresh() at the exact moment each Later Today session enters its window — no page reload.",
        relatedTo: [
          "virtualDashboardProgramsQuery fetches all virtual/hybrid programs with recurrence fields; isOccurrenceToday() + shiftToToday() compute today's occurrences",
          "Pending dana prompt connects to Program Registration dana step",
          "Staff access panel connects to Volunteer/Admin areas",
          "Navigation (nav-) links to all member sub-pages",
        ],
      },
      {
        name: "My Programs (Registration History)",
        locations: ["/account/dashboard-my-registrations", "Component: CancelRegistrationButton.tsx", "API: GET /api/account/registrations"],
        what: "Shows the member's complete registration history — active first, then past/cancelled. Each card shows program title, date/time/location (enriched from Postgres), status badge, waitlist position, and pending dana prompt. Active registrations have a cancel button.",
        relatedTo: [
          "Registration records from Postgres DB, enriched with program data from Postgres",
          "Member Self-Cancel Registration (Program Registration)",
          "Dana prompt links to Payment & Dana step",
        ],
      },
      {
        name: "My Library",
        locations: ["/account/dashboard-my-library"],
        what: "Curated list of dharma learning resources. Currently hardcoded with 4 items (one link goes to the old Webflow site). Has 'work in progress' copy. A proper dynamic rebuild is planned.",
        relatedTo: [
          "Planned: pull member-accessible courses and resources from Postgres based on access level and registration history",
          "Course Access System — would show courses the member can access",
        ],
        status: "stub",
        note: "Content hardcoded; planned: dynamic version",
      },
      {
        name: "My Profile",
        locations: ["/account/dashboard-my-profile", "API: server action (direct Postgres write)"],
        what: "Members can update their first name, last name, and phone. Email is shown as read-only — it is the magic link identifier. Success state shown via ?saved=true URL param.",
        relatedTo: [
          "Profile data shared with Program Registration (email recognition pre-fills from this)",
          "Field locking in registration form protects these values",
          "Planned: self-service email change (see Not Yet Built section)",
        ],
      },
      {
        name: "Community Care Agreements",
        locations: ["/account/dashboard-member-care-agreements"],
        what: "The full 4-point community care agreements — readable anytime from the member nav. Content is hardcoded in the component.",
        relatedTo: [
          "Agreements first accepted on Community Welcome page",
          "Also presented inline during Program Registration for non-members",
          "Public version also at /community-membership",
        ],
      },
    ],
  },

  {
    id: "courses",
    title: "Series Access & Content",
    icon: "📚",
    desc: "Member-gated series and lesson pages. Series and lessons live in Postgres. Access can be open to all members, granted via program registration, or manually granted by an admin. Content managed via Course Hub. UI label is 'Series'; DB model is still 'Course'.",
    features: [
      {
        name: "Series Page",
        locations: ["/course/[slug]"],
        what: "Series page redesigned in session 59 to match the lp- design language: warm var(--rim-bg) background, centered weight-400 serif header, crs-rule hr divider, white lesson cards with 10px border radius. Each lesson card shows a number, the lesson title, and a small color-coded SVG icon indicating media type (teal square = audio, amber square = video, slate square = text-only). Section labels appear as subheadings between lesson cards. Access gating: accessLevel in Postgres (MEMBERS or REGISTRATION_REQUIRED). Non-members see a registration prompt.",
        relatedTo: [
          "accessLevel set on Course model in Postgres (managed via Course Hub)",
          "Auto-access via ProgramCourse join table (replaces old Sanity linkedCourses)",
          "Manual grants managed in Member Management (CourseAccessSection)",
          "crs- CSS prefix in public/css/custom.css",
        ],
      },
      {
        name: "Lesson Pages",
        locations: ["/lessons/[slug]"],
        what: "Individual lesson pages rendered from Postgres. Body is Tiptap JSON, rendered via renderContentBody() from lib/renderRichContent.ts. Supports custom blocks: verseQuote (pull quote), practiceCallout (teal practice box), calloutText (highlighted insight). Also supports audio player, video embed, hero image, header quote, teacher attribution, and downloadable resources.",
        relatedTo: [
          "Lesson model in Postgres (managed via Course Hub)",
          "lib/renderRichContent.ts — renderContentBody() for Tiptap JSON rendering",
          "lp- prefix CSS (design system)",
          "Course pages link to lessons via CourseLesson join table",
        ],
      },
      {
        name: "Auto-Access via Registration",
        locations: ["/course/[slug]"],
        what: "If a course is linked to a program via the ProgramCourse table, any member with an active (REGISTERED or APPROVED) registration for that program automatically gets access. Checked dynamically at page render — no DB write needed. Pure Postgres query.",
        relatedTo: [
          "ProgramCourse join table (programId references Program.id)",
          "Registration status (Postgres) checked at page render time",
          "Program-course links managed from Course Hub course editor",
        ],
      },
      {
        name: "Manual Course Access Grants",
        locations: ["/admin/members/[id]", "Component: CourseAccessSection.tsx", "API: POST /api/admin/members/[id]/course-access, DELETE /api/admin/members/[id]/course-access"],
        what: "Admins and registrars can grant or revoke access to any course for any member from the member detail page. Inline UI shows all courses with status badges (All Members / Via Registration / Manual Grant / No Access) and grant/revoke controls with warning dialogs.",
        relatedTo: [
          "CourseAccess model in Postgres (userId + courseSlug unique, optional FK to Course)",
          "Course Page Gating (supplements auto-access)",
          "Accessible from Member Management (Admin) — member detail page",
        ],
      },
    ],
  },

  {
    id: "members-admin",
    title: "Member Management (Admin)",
    icon: "🛠️",
    desc: "Admin and registrar tools for managing the community member database. Search, edit profiles, assign roles, manage status, add tags, track households, and import members.",
    features: [
      {
        name: "Member List",
        locations: ["/admin/members", "Component: MembersTable.tsx", "API: GET /api/admin/members"],
        what: "Searchable, sortable, filterable table of all community members. Search by name/email (client-side). Sort by any column header. Status filter dropdown (All / Active / Visitor / Student / Volunteer / Inactive). Click any row to open member detail.",
        relatedTo: [
          "Member Detail (Admin)",
          "CSV Import (opens panel inline)",
          "Roles & Permissions",
          "Member Status (Inactive blocks login)",
        ],
      },
      {
        name: "Member Detail — Enhanced Profile",
        locations: ["/admin/members/[id]", "Component: MemberDetail.tsx", "API: PATCH /api/admin/members/[id]"],
        what: "Full profile view with enhanced fields: first/last/preferred name, phone, structured address (Street/City/State/Zip), member status, first visit date, tags (freeform pills), and admin notes (hidden from members). Also: assign/revoke roles, manage course access, view registration history, and manage household membership.",
        relatedTo: [
          "Member Status system (INACTIVE drives archivedAt + login block)",
          "Tags — freeform labels, no predefined list",
          "Admin Notes — only visible in admin view",
          "Household section embedded here (HouseholdSection component)",
          "Roles assigned here cascade to Email & Notifications",
          "Course Access System (CourseAccessSection embedded here)",
          "Program Editor Access panel (invite/revoke from here)",
        ],
      },
      {
        name: "Member Status",
        locations: ["/admin/members/[id]", "Component: MemberDetail.tsx", "Prisma: memberStatus enum on User"],
        what: "Five statuses: ACTIVE (default), VISITOR (exploring), STUDENT (enrolled), VOLUNTEER (contributing), INACTIVE (blocked). INACTIVE is the only status that blocks login — it stamps archivedAt and kills the member's active sessions. Setting any other status clears archivedAt and re-enables login. Legacy archived members (archivedAt set, no memberStatus) are shown as INACTIVE in the UI and synced to DB on first save.",
        relatedTo: [
          "Route Protection reads archivedAt to redirect blocked members to /account/reactivate",
          "Account Reactivation — admin can restore by changing status away from INACTIVE",
          "effectiveStatus pattern handles legacy archived members cleanly",
        ],
      },
      {
        name: "CSV Import (Memberstack Migration)",
        locations: ["/admin/members", "Component: MemberImport.tsx", "API: POST /api/admin/members/import"],
        what: "Upload a CSV to upsert members by email. Fills blank profile fields only — never overwrites existing data. Returns { created, updated, skipped } counts. Designed for the Memberstack migration but usable for any CSV of name/email/phone records.",
        relatedTo: [
          "Upsert by email — connects to existing User records",
          "Never overwrites — safe to run multiple times",
          "Member List reflects imported members immediately",
        ],
      },
      {
        name: "Sanity Studio Access — REMOVED (session 54)",
        locations: ["/admin/members/[id]"],
        what: "REMOVED in session 54. The Sanity invitation system was deleted when programs migrated to Postgres. The sanity-invite API route, revokeSanityAccess(), sanityInvitedAt field, and all related UI were removed.",
        relatedTo: [],
        note: "Removed — programs now managed via Program Editor in Registrar Hub",
      },
    ],
  },

  {
    id: "households",
    title: "Household / Family Grouping",
    icon: "🏠",
    desc: "Link members who belong to the same family or household. Shared address, primary contact, and relationship labels.",
    features: [
      {
        name: "Household List",
        locations: ["/admin/households", "API: GET /api/admin/households"],
        what: "Lists every household with the primary contact's name, member count, and address summary. At the bottom: a custom relationship label frequency table showing every free-text 'Other' label used (e.g. 'roommate × 3') — helps identify terms to add to the enum in the future.",
        relatedTo: [
          "Household Detail page (link from each row)",
          "Member Detail (HouseholdSection shows which household a member belongs to)",
        ],
      },
      {
        name: "Household Detail",
        locations: ["/admin/households/[id]", "Component: HouseholdDetail.tsx", "API: PATCH/DELETE /api/admin/households/[id]"],
        what: "Edit the household name, shared address, and notes. Member list shows all members with their relationship labels, a 'Set primary' action, and a 'Remove' action. Add Member search lets you find and add any member who isn't already in a household. Delete is available to admins only, when the household has one or zero members.",
        relatedTo: [
          "Member Detail (links to member profiles from household member rows)",
          "Household List (breadcrumb back)",
          "API: /api/admin/households/[id]/members for add/remove/set-primary",
        ],
      },
      {
        name: "Household Section (Member Profile)",
        locations: ["Component: HouseholdSection.tsx", "Embedded in: MemberDetail.tsx"],
        what: "Appears on every member profile. If the member isn't in a household: two options — 'Create new household' (makes this member the primary contact) or 'Add to existing household' (search for another member → system finds their household → set relationship and join). Once in a household: shows the household card with name, address, other members, relationship labels, and 'Remove from household' button.",
        relatedTo: [
          "Household Detail (household name is a link to the detail page)",
          "API: GET /api/admin/members/[id]/household — discovers a member's household for the join flow",
          "Address fallback: if member has no address but household does, a hint appears in the Contact section",
        ],
      },
    ],
  },

  {
    id: "automation",
    title: "Scheduling & Automation",
    icon: "⏰",
    desc: "Vercel Cron Jobs that run on a schedule. Configured in vercel.json.",
    features: [
      {
        name: "Reminder Cron",
        locations: ["API: GET /api/cron/send-reminders", "File: vercel.json (cron: 0 14 * * *)"],
        what: "Runs daily at 14:00 UTC (9:00 AM Central). Queries Postgres for programs whose reminderDate falls within the past 24 hours, then sends the reminder email to all REGISTERED/APPROVED registrants who haven't received it yet (reminderSentAt is null).",
        relatedTo: [
          "Program Reminder Email",
          "reminderDate configured in the Program model (programs → Registration tab)",
          "reminderSentAt on Registration record prevents double-sends with manual path",
          "CRON_SECRET Bearer token for authentication",
        ],
      },
      {
        name: "Cleanup Cron — Incomplete Accounts",
        locations: ["API: GET /api/cron/cleanup-incomplete-accounts", "File: vercel.json (cron: 0 15 * * *)"],
        what: "Runs daily at 15:00 UTC. Deletes User records where agreedToTerms = false and the account was created more than 48 hours ago — removing abandoned incomplete onboarding sessions.",
        relatedTo: [
          "Community Welcome / Onboarding (Authentication & Onboarding)",
          "Keeps member list clean",
          "CRON_SECRET Bearer token for authentication",
        ],
      },
    ],
  },

  {
    id: "meet",
    title: "Google Meet Integration",
    icon: "🎥",
    desc: "Lifecycle management of Google Meet spaces for virtual and hybrid programs. Meet links are created manually by registrars. Calendar sync happens inline when programs are saved. Uses Domain-Wide Delegation to impersonate shared room accounts.",
    features: [
      {
        name: "Calendar Sync on Save (replaced webhook in session 54)",
        locations: ["API: PUT /api/programs-pg/[slug]", "File: lib/google-meet.ts"],
        what: "When a program is saved via the PUT handler, if the start time or name changed, the Google Calendar room booking updates automatically. If programFormat is changed to in-person, the calendar event is deleted and Meet fields are cleared. A confirmation dialog warns before this destructive action. The old Sanity webhook was deleted.",
        relatedTo: [
          "Postgres — programFormat, startDatetime, zoomLink, meetHostAccount, calendarEventId fields",
          "Google Workspace (Domain-Wide Delegation, room account calendars)",
          "GOOGLE_ROOM_EMAILS env var (pool of room accounts)",
        ],
      },
      {
        name: "Manual Create Meet Button",
        locations: ["/account/registrar/[slug]", "Component: CreateMeetButton.tsx", "API: POST /api/programs/[slug]/google-meet"],
        what: "Registrars create Meet links manually from the registrar program detail page. The panel appears when programFormat is virtual or hybrid. 'Create Google Meet' finds a free room account, creates the space, and writes the link + room assignment to the program record. 'Remove Meet' deletes the calendar booking and clears all Meet fields. An orphan guard (409) prevents creating a duplicate if a link already exists.",
        relatedTo: [
          "Postgres — writes zoomLink, meetHostAccount, calendarEventId",
          "Volunteer Tools — CreateMeetButton in the program detail page",
        ],
      },
      {
        name: "Room Account Assignment",
        locations: ["File: lib/google-meet.ts"],
        what: "The system checks each room account's primary Google Calendar for events during the program's time window. The first conflict-free room is assigned. The Meet space is created under that room's identity via DWD impersonation. calendarEventId is stored in Postgres to enable future updates/deletions without touching the Meet link.",
        relatedTo: [
          "Google Calendar API (conflict detection + event CRUD)",
          "Google Meet API (space creation)",
          "startDatetime on programs (Postgres) drives conflict detection",
        ],
      },
      {
        name: "Meet Link on Dashboard & Host Hub",
        locations: ["/account/dashboard", "/account/hub/host-team"],
        what: "Google Meet links are shown to logged-in members on the Dashboard under 'Today's Sessions.' HOST users also see their assigned meet links on the host schedule tab. Links are deliberately NOT shown in confirmation emails or on public program pages — members must be logged in to access them.",
        relatedTo: [
          "Dashboard Hub (Member Experience)",
          "Host Community Hub — Schedule Tab",
          "Community philosophy: Meet links require login to protect sessions for members",
        ],
      },
    ],
  },

  {
    id: "sanity",
    title: "Postgres (Program model)",
    icon: "🗂️",
    desc: "The content management system powering all dynamic content. Schema lives at /Users/jessefoy/Sites/rim-website/sanity/ — shared between rim-next and the Eleventy site.",
    features: [
      {
        name: "Programs Schema",
        locations: ["File: sanity/schemas/programs.js", "Program Editor: programs collection"],
        what: "The richest schema in the system. Six workflow tabs: 1 — Basics (category, tagline, image, teachers, description), 2 — When & Where (dateText, startDatetime, programFormat, venue, location fields, recurrence, Meet link), 3 — Registration (capacity, custom questions, linked courses), 4 — Emails (confirmationMessage, reminderDate, reminderMessage), 5 — Dana (danaMode, amounts), 6 — Settings (two separate hide toggles: 'Hide from Member Dashboard' controls dashboard/session tracker, 'Hide from Programs & Events Page' controls public listing — both fields cross-reference each other in Postgres; sortOrder, dayOfWeek). Key fields: `programFormat` (in-person/virtual/hybrid, drives Where row + Meet panel visibility); `venue` (at-rim auto-fills RIM address via lib/locations.ts, or 'other' for custom location).",
        relatedTo: [
          "Drives Program Registration (all registration fields)",
          "Drives Payment & Dana (danaMode, amounts, message)",
          "Drives Email & Notifications (reminderDate, reminderMessage, confirmationMessage)",
          "Drives Google Meet Integration (meetLink, meetHostAccount) — virtual/hybrid only",
          "Drives Dashboard 'Today' panel (dayOfWeek, hideFromDashboard)",
          "lib/locations.ts resolves venue → address for emails, calendar links, program page",
          "richContent shared type for description and other rich text fields",
        ],
      },
      {
        name: "Lessons Schema (Legacy — migrated to Postgres)",
        locations: ["File: sanity/schemas/lessons.js", "Program Editor: lessons collection"],
        what: "Original Sanity schema for lessons. Lessons have been migrated to Postgres and are now managed via the Course Hub. This schema remains in Postgres for reference but is no longer the source of truth.",
        relatedTo: [
          "Lesson page (/lessons/[slug]) — now reads from Postgres",
          "Course Hub — CRUD management of lessons",
          "Lesson model in Postgres (prisma/schema.prisma)",
        ],
        status: "partial",
        note: "Migrated to Postgres — Sanity schema retained for reference",
      },
      {
        name: "Courses Schema (Legacy — migrated to Postgres)",
        locations: ["File: sanity/schemas/courses.js", "Program Editor: courses collection"],
        what: "Original Sanity schema for courses. Courses have been migrated to Postgres and are now managed via the Course Hub. Access levels, lesson groupings, and program links all live in Postgres now.",
        relatedTo: [
          "Course Access System (/course/[slug]) — now reads from Postgres",
          "Course Hub — CRUD management of courses",
          "Course model + ProgramCourse join table in Postgres",
        ],
        status: "partial",
        note: "Migrated to Postgres — Sanity schema retained for reference",
      },
      {
        name: "richContent Shared Schema",
        locations: ["File: sanity/schemas/richContent.js"],
        what: "A named array type used by lessonContent in Sanity. Both lessons and programs have migrated to Postgres (Tiptap JSON) as of sessions 50–54. This schema remains in Sanity for reference and any remaining Sanity-managed content, but is no longer the primary content source for lessons or programs.",
        relatedTo: [
          "Lesson pages (lp- prefix) — now Tiptap/Postgres via renderContentBody()",
          "Program detail pages (pg- prefix) — now Tiptap/Postgres via renderContentBody()",
          "lib/renderRichContent.ts — Tiptap rendering for both",
        ],
      },
      {
        name: "Other CMS Content Types",
        locations: ["Program Editor: magazineArticles, glossaryTerms, team, volunteerPositions, programCategories"],
        what: "Additional content types: Magazine Articles (member-gated long-form content), Glossary Terms (Dharma definitions with Pali/Sanskrit), Team (teacher and staff bios), Volunteer Positions (open roles with descriptions), Program Categories (groups programs on the listing page).",
        relatedTo: [
          "/magazine-articles/[slug] (member gate)",
          "/glossary/[slug]",
          "/team/[slug]",
          "/volunteer-positions/[slug]",
          "/community-programs (programs grouped by programCategory)",
        ],
      },
    ],
  },

  {
    id: "course-hub",
    title: "Course Hub & Content Management",
    icon: "🎓",
    desc: "Full CRUD for series and lessons, accessible to TEACHER and ADMIN roles via the Course Hub. Content stored in Postgres. Tiptap WYSIWYG editors with underline, text alignment, typography, character count, tables, and custom block support. UI calls them 'Series'; DB model is still 'Course'.",
    features: [
      {
        name: "Course Hub Workspace",
        locations: ["/account/hub/courses", "/account/hub/courses/courses", "/account/hub/courses/lessons"],
        what: "A hub workspace for TEACHER and ADMIN roles. Reuses the multi-hub system. Primary tabs are Series and Lessons (instead of the default Announcements). Hub root redirects to /account/hub/courses/courses. Also includes Announcements, Documents, Conversations, and Members tabs.",
        relatedTo: [
          "Multi-Hub Workspace System (/account/hub/[slug])",
          "TEACHER role assignment (syncHubMembership auto-creates HubMember)",
          "Series Access & Content (series/lesson data managed here)",
        ],
      },
      {
        name: "Series Editor",
        locations: ["/account/hub/courses/courses/new", "/account/hub/courses/courses/[courseSlug]", "Component: CourseEditor.tsx", "API: POST /api/courses, PATCH /api/courses/[slug], DELETE /api/courses/[slug]"],
        what: "Create and edit series: title, slug, subheading, FormattedEditor description (with underline, text alignment, word count), access level (MEMBERS / REGISTRATION_REQUIRED), active toggle. Sort order was removed in session 59. Edit mode includes a unified lesson + section manager: a flat ListItem[] union type drives a drag list where section-divider rows and lesson rows are all first-class draggable items. Section rows have an inline-editable label and a ✕ remove button. + Add Section button uses th-btn--ghost style. Lessons are added via search-to-add (debounced API search). Delete is guarded — returns 409 if ProgramCourse records exist.",
        relatedTo: [
          "Course model in Postgres (CourseLesson.groupLabel = section header for a lesson)",
          "Lesson search API (/api/lessons/search)",
          "ProgramCourse join table (links programs to courses in Postgres)",
          "Series Access & Content (access levels enforced at /course/[slug])",
          "th-section-row CSS in public/css/custom.css",
        ],
      },
      {
        name: "Lesson Editor (ContentEditor)",
        locations: ["/account/hub/courses/lessons/new", "/account/hub/courses/lessons/[lessonSlug]", "Component: LessonEditor.tsx", "API: POST /api/lessons, PATCH /api/lessons/[slug], DELETE /api/lessons/[slug]"],
        what: "Create and edit lessons with ContentEditor (Tiptap WYSIWYG). Toolbar: Bold, Italic, Underline, H2, H3, UL, OL, Link, Align L/C/R, Insert Table, plus custom block buttons: + Verse, + Practice, + Callout. Table context toolbar: +Row, +Col, −Row, −Col, Delete Table. Typography extension auto-converts smart quotes, em dashes, ellipsis. Character count footer shows word count. Content stored as Tiptap JSON. Media section: image and audio upload via Vercel Blob, video URL. Also: header quote, teacher names, and an inline resource list builder.",
        relatedTo: [
          "Lesson model in Postgres (body: Json?)",
          "File uploads via /api/upload (Vercel Blob)",
          "Custom block rendering on /lessons/[slug] (renderContentBody from lib/renderRichContent.ts)",
          "CourseLesson join table (lessons grouped into courses)",
          "Editor Standard (§28 in FEATURES.md)",
        ],
      },
      {
        name: "File Upload (Vercel Blob)",
        locations: ["API: POST /api/upload"],
        what: "Client-side upload endpoint for TEACHER and ADMIN roles. Uses Vercel Blob client-side upload pattern — browser uploads directly to Blob storage (bypasses 4.5 MB serverless body limit). Max file size 500 MB. Auth checked during token generation only. Auto-saves to DB immediately after upload. Requires BLOB_READ_WRITE_TOKEN env var.",
        relatedTo: [
          "Lesson Editor — image and audio upload fields",
          "Vercel Blob service (external)",
          "BLOB_READ_WRITE_TOKEN environment variable",
        ],
      },
    ],
  },

  {
    id: "public",
    title: "Public Pages",
    icon: "🌐",
    desc: "Pages visible to anyone — no login required. Mix of static pages and CMS-powered templates.",
    features: [
      {
        name: "Home Page",
        locations: ["/"],
        what: "Hero video, community introduction, programs preview card, Donate and Join CTAs.",
        relatedTo: [
          "Links to /community-programs (Programs Listing)",
          "Links to /donate (Donation page)",
          "Links to /login (Join or Sign In)",
        ],
        status: "active",
        note: "🟠 Webflow CSS",
      },
      {
        name: "Programs Listing",
        locations: ["/community-programs"],
        what: "All programs grouped by programCategory from Postgres. Drop-ins and registration-based programs. Each program links to its detail page.",
        relatedTo: [
          "Postgres — programs and programCategories schemas",
          "Program Detail pages (/programs/[slug])",
        ],
        status: "active",
        note: "🟠 Webflow CSS",
      },
      {
        name: "Program Detail & Registration",
        locations: ["/programs/[slug]"],
        what: "Hero, floating details card, registration form, Zoom link (members only). Dana step post-registration. Add-to-calendar links after confirmation.",
        relatedTo: [
          "Program Registration (full system)",
          "Payment & Dana (Stripe)",
          "Postgres — programs schema",
          "Google Meet Integration (Zoom link shown to members)",
        ],
        status: "active",
        note: "🟢 Design system (pg- prefix)",
      },
      {
        name: "Dharma Lessons",
        locations: ["/lessons/[slug]"],
        what: "Audio player, video embed, Tiptap JSON body rendered via renderContentBody() — verseQuote pull quotes, practiceCallout suggestion boxes, calloutText highlighted insights. Data reads from Postgres (migrated from Sanity, session 50).",
        relatedTo: [
          "Postgres — Lesson model (managed via Course Hub)",
          "Course pages (/course/[slug]) — lessons grouped into courses",
          "lib/renderRichContent.ts — renderContentBody() for Tiptap JSON rendering",
        ],
        status: "active",
        note: "🟢 Design system (lp- prefix)",
      },
      {
        name: "Donate Page",
        locations: ["/donate"],
        what: "GiveButter-powered donation page with RIM Dana and Teacher Dana widgets.",
        relatedTo: [
          "GiveButter (external) — no backend connection yet",
          "Planned: replace with native Stripe donation page",
          "Planned: import GiveButter history into Donation ledger",
        ],
        status: "active",
        note: "🟠 Webflow CSS",
      },
      {
        name: "Community Agreements (Public)",
        locations: ["/community-membership"],
        what: "Full 4-point community care agreements plus a 'Join or sign in →' button. Repurposed from the old Memberstack signup form.",
        relatedTo: [
          "Same agreements shown on /account/welcome (Community Onboarding)",
          "Same agreements shown inline during Program Registration",
          "Member version at /account/dashboard-member-care-agreements",
        ],
      },
      {
        name: "Other Static / CMS Pages",
        locations: ["/diversity", "/glossary/[slug]", "/team/[slug]", "/volunteer-positions/[slug]", "/kalyana-mitta/*", "/magazine-articles/[slug]"],
        what: "Diversity statement, glossary term definitions, teacher/staff bios, volunteer position descriptions, Kalyana Mitta community group pages, and member-gated magazine articles (login wall for logged-out visitors).",
        relatedTo: [
          "Postgres — glossaryTerms, team, volunteerPositions, magazineArticles schemas",
          "Kalyana Mitta: group application requires login (/kalyana-mitta/kalyana-mitta-group-application)",
          "Volunteer positions: interest form has no backend endpoint (planned)",
        ],
      },
    ],
  },

  {
    id: "admin-tools",
    title: "Site Administration Tools",
    icon: "⚙️",
    desc: "Internal admin pages for developers and site managers. ADMIN role required.",
    features: [
      {
        name: "Site Architecture",
        locations: ["/admin/sitemap"],
        what: "Visual reference of every page on the site organized by section. Access badges, CSS layer indicator, page status (stub/orphan/repurposed), implemented features, and planned features per page. Also shows a 'Not Yet Built' section.",
        relatedTo: [
          "Complements this Feature Inventory page",
          "Page-centric view vs. feature-centric view",
        ],
      },
      {
        name: "Feature Inventory (this page)",
        locations: ["/admin/features"],
        what: "Comprehensive listing of every feature organized by functional area. Shows where each feature lives, what it does, and what it's functionally related to.",
        relatedTo: [
          "Site Architecture (/admin/sitemap) — page-centric sibling",
          "Staff Manual (/admin/manual) — staff-facing documentation",
          "Roadmap (/admin/roadmap) — what's planned next",
        ],
      },
      {
        name: "Staff Reference Manual",
        locations: ["/admin/manual"],
        what: "Two-chapter plain-English guide for REGISTRAR and ADMIN staff. Chapter 1: Registration Management (9 sections covering all registrar workflows). Chapter 2: Programs (field-by-field documentation for the Program Editor). Organized as expandable accordion sections.",
        relatedTo: [
          "Volunteer / Registrar Tools (Chapter 1 subject matter)",
          "Postgres (Program model) (Chapter 2 subject matter)",
          "Linked from the role notification email sent to new registrars",
          "Dashboard staff access panel links here",
        ],
      },
      {
        name: "Roadmap",
        locations: ["/admin/roadmap"],
        what: "Developer-facing list of planned features and improvements, prioritized by urgency, with effort estimates and reference to relevant FEATURES.md sections.",
        relatedTo: [
          "FEATURES.md (source of truth for implementation details)",
          "Site Architecture (/admin/sitemap) 'Not Yet Built' section",
        ],
      },
      {
        name: "Ideas",
        locations: ["/admin/ideas"],
        what: "A scratchpad for feature ideas and future directions — not yet prioritized for the roadmap.",
        relatedTo: ["Feeds into Roadmap when ideas mature to plans"],
      },
    ],
  },

  {
    id: "nav",
    title: "Navigation",
    icon: "🧭",
    desc: "The global navigation component. No Webflow dependency.",
    features: [
      {
        name: "Global Nav Component",
        locations: ["Component: components/Nav.tsx", "File: public/css/custom.css (nav- prefix)"],
        what: "Sticky header with CSS hover dropdowns. React useState hamburger for mobile. isMemberArea and isAdmin flags drive conditional nav items. No Webflow classes or webflow.js.",
        relatedTo: [
          "Member Area — nav shows My Programs, My Library, My Profile, Our Agreements, Dashboard links",
          "Admin — nav shows Members, Site Architecture, Manual, Roadmap, Ideas links",
          "Authentication — Sign Out link appears when session exists",
        ],
      },
    ],
  },
  {
    id: "support-inbox",
    title: "Support Inbox",
    icon: "📧",
    desc: "Gmail-integrated shared inbox for support@rootedinmindfulness.org. Three-column email client with thread management, reply composer, internal notes, templates, and member matching.",
    features: [
      {
        name: "Gmail Sync Engine",
        locations: ["File: lib/gmail.ts", "File: lib/supportSync.ts", "API: /api/cron/support-sync", "API: /api/support/sync"],
        what: "OAuth2 connection to Gmail. Incremental sync via historyId — 90-day initial fetch, then deltas every 5 minutes via Vercel cron. Parses messages, extracts attachments, matches senders to User records.",
        relatedTo: ["Support Inbox UI", "Member Management", "Notifications"],
      },
      {
        name: "Inbox UI (three-column client)",
        locations: ["Page: /account/hub/support/inbox", "Component: SupportInboxClient.tsx"],
        what: "Thread list (fluid 320–400px) with 5 filter pills + search. Message timeline with inline notes. Reply composer with FormattedEditor + file attachments. Collapsible sidebar with status, assignment, member context, contact history. Responsive: single-column on mobile with back button.",
        relatedTo: ["Gmail Sync Engine", "Thread Management", "Templates", "Notifications"],
      },
      {
        name: "Thread Management",
        locations: ["API: /api/support/threads", "API: /api/support/threads/[id]"],
        what: "CRUD for support threads. Four statuses (OPEN/CLAIMED/WAITING/RESOLVED). Assignment to team members. Soft delete (trash) with restore. Hard delete (ADMIN only). Contact history query for sidebar.",
        relatedTo: ["Inbox UI", "Notifications", "Member Management"],
      },
      {
        name: "Reply & Compose",
        locations: ["API: /api/support/threads/[id]/reply", "API: /api/support/compose"],
        what: "Send replies via Gmail API (threaded). Compose new outbound emails. Per-user email signatures appended to all outbound messages. File attachments via Vercel Blob (25 MB limit).",
        relatedTo: ["Inbox UI", "Templates", "Gmail Sync Engine"],
      },
      {
        name: "Internal Notes",
        locations: ["API: /api/support/threads/[id]/note"],
        what: "Private notes on threads, visible only to support team. Tiptap JSON body. Rendered in amber-themed cards in the timeline. Triggers notification to assigned member.",
        relatedTo: ["Inbox UI", "Notifications"],
      },
      {
        name: "Email Templates",
        locations: ["API: /api/support/templates", "API: /api/support/templates/[id]"],
        what: "Reusable response templates with Tiptap JSON body and optional subject line. ADMIN manages CRUD. All support members can use templates via picker dropdown in reply and compose forms.",
        relatedTo: ["Reply & Compose", "Inbox UI"],
      },
      {
        name: "Support Settings",
        locations: ["Page: /account/hub/support/settings", "Component: SupportSettingsClient.tsx", "API: /api/support/settings", "API: /api/support/signature"],
        what: "Gmail connection (ADMIN), default assignee (ADMIN), template management (ADMIN), re-match members (ADMIN), per-user signature, email notification toggle. Signature pre-fills from User.title.",
        relatedTo: ["Gmail Sync Engine", "Templates", "Notifications"],
      },
      {
        name: "Support Notifications",
        locations: ["File: lib/supportNotify.ts"],
        what: "In-app Alert records + optional email notifications via Resend. Three alert types: SUPPORT_ASSIGNED, SUPPORT_NEW_REPLY, SUPPORT_NEW_NOTE. 5-minute deduplication. Fire-and-forget pattern. Notification emails use NEXTAUTH_URL env var (not hardcoded domain).",
        relatedTo: ["Thread Management", "Internal Notes", "Reply & Compose"],
      },
      {
        name: "Security Hardening (session 57)",
        locations: ["File: lib/supportSync.ts", "API: /api/support/threads/[id]/reply", "API: /api/support/threads/[id]/note", "API: /api/support/threads/[id]", "API: /api/support/sync", "API: /api/support/signature", "API: /api/support/attachment/[messageId]/[attachmentId]"],
        what: "12 security fixes applied after independent audit: (1) Soft-delete bypass fix — sync skips deleted threads entirely, no resurrection. (2) Reply/note on deleted threads return 404. (3) SSRF guard on attachment fetch — only Vercel Blob domain allowed (isSafeBlobUrl()). (4) Attachment proxy ownership check — messageId verified in DB before proxying. (5) 20 MB cap on attachment buffering before arrayBuffer(). (6) 30s rate limit on manual sync per user (AppSetting). (7) Status PATCH enum validation — unknown values return 400. (8) Signature field HTML escaping on outbound emails. (9) 100-char max on signature name/role/tagline. (10) Audit log on hard delete (Vercel logs). (11) NEXTAUTH_URL in notification emails. (12) Dedup comment in supportNotify.ts.",
        relatedTo: ["Gmail Sync Engine", "Reply & Compose", "Thread Management", "Support Settings", "Support Notifications"],
        note: "All 12 fixes committed in 43676d3 (2026-03-16).",
      },
    ],
  },
];

// ─── System-level overview data ───────────────────────────────────────────────

const USER_TYPES = [
  {
    who: "Public visitor",
    login: "None",
    canDo: "Browse programs, lessons (some), glossary, teacher bios. Register for programs — no account needed.",
  },
  {
    who: "Registered participant",
    login: "None yet",
    canDo: "Has a User record in Postgres after registering. Receives confirmation and reminder emails. May never have logged in.",
  },
  {
    who: "Community member",
    login: "Magic link",
    canDo: "Everything above, plus: dashboard, My Programs, My Library, member-gated courses and articles.",
  },
  {
    who: "Registrar / HOST / HOST_MANAGER / SUPPORT",
    login: "Magic link + role",
    canDo: "Registrar: registration management, Program Editor. HOST: Host Community Hub — schedule, sub board, threads. HOST_MANAGER: everything HOST plus assignment management. SUPPORT: Support Inbox — shared email client, thread management, reply, notes, templates.",
  },
  {
    who: "Admin",
    login: "Magic link + ADMIN role",
    canDo: "Everything, plus: member management, role assignment, all admin tools (/admin/*).",
  },
];

const SYSTEM_MAP: { area: string; needs: string; powers: string; note: string }[] = [
  {
    area: "Content (Postgres + Sanity)",
    needs: "Programs/courses/lessons in Postgres; teams/glossary/magazine in Sanity CMS",
    powers: "Every page that displays content — programs, lessons, courses, emails, dashboard, volunteer tools",
    note: "Programs fully in Postgres since session 54. Non-program Sanity content still depends on SANITY_API_TOKEN.",
  },
  {
    area: "Program Registration",
    needs: "Postgres (program config) · Postgres (stores records) · Resend (sends email) · Stripe (takes payment)",
    powers: "Volunteer table · Member 'My Programs' · Course access auto-grant · Donation ledger · Member onboarding path",
    note: "The front door. Most members first appear in the DB through a registration, not a direct login.",
  },
  {
    area: "Email & Notifications",
    needs: "Resend API · Postgres (content fields: reminderMessage, confirmationMessage) · Postgres (registrant data)",
    powers: "Triggered by: Registration · Volunteer Tools · Scheduling Crons · Member Management (role emails)",
    note: "All email failures are logged but never block the triggering action — a failed send never breaks a registration.",
  },
  {
    area: "Payment & Dana (Stripe)",
    needs: "Stripe API · Postgres (Registration record) · Postgres (dana config: mode, amounts, message)",
    powers: "Donation ledger record (via webhook) · Registration donationStatus updated · Thank-you state on program page",
    note: "Stripe Checkout (hosted page) handles all card data — no card details ever touch our server.",
  },
  {
    area: "Authentication & Onboarding",
    needs: "Resend (magic link delivery) · Postgres (session + user storage) · NextAuth v5",
    powers: "All protected areas — member experience, staff tools, admin pages. Sets up the session everything else reads.",
    note: "If Resend is down, no one can log in — magic link is the only authentication method.",
  },
  {
    area: "Route Protection",
    needs: "Auth session (NextAuth) · Postgres (archivedAt, agreedToTerms on User)",
    powers: "Enforces who can access /account/*, /admin/*, /course/* (hub sub-routes protected by server-component role check)",
    note: "Lives in proxy.ts — the Next.js 16 rename of middleware.ts. Do not recreate middleware.ts.",
  },
  {
    area: "Member Experience",
    needs: "Auth (session) · Postgres (user + registration + course + lesson records) · Postgres (program data)",
    powers: "Dashboard · My Programs · My Library · My Profile · Care Agreements — everything a logged-in member sees",
    note: "Google Meet links are deliberately shown only here (not in emails) — login is required to see them.",
  },
  {
    area: "Volunteer / Registrar Tools",
    needs: "Postgres (registrations) · Postgres (field definitions, program data) · Email system (action triggers)",
    powers: "Status updates · Bulk reminders · CSV export · Inline field editing · Self-service edit links sent",
    note: "",
  },
  {
    area: "Course Access & Content",
    needs: "Postgres (Course, Lesson, ProgramCourse, CourseAccess, Registration status) · Postgres (program names for ProgramCourse display during Phase 2)",
    powers: "Gates or allows access to /course/[slug] and /lessons/[slug] pages for each member · Course Hub manages all content",
    note: "Courses and lessons migrated from Postgres to Postgres (session 50). Access checked dynamically at page render.",
  },
  {
    area: "Member Management (Admin)",
    needs: "Postgres (all user + registration data) · Email (role notifications) · Email (role notifications)",
    powers: "Roles (unlock staff areas) · Member status (INACTIVE blocks login) · Tags + admin notes · Program Editor access · Household linking",
    note: "Never spread a Prisma include result into Client Component props — always construct props explicitly.",
  },
  {
    area: "Household / Family Grouping",
    needs: "Postgres (Household + HouseholdMember models) · Member Management (member search for join flow)",
    powers: "Groups members by family — shared address, primary contact, relationship labels visible on member profiles and household detail page",
    note: "userId @unique on HouseholdMember enforces one household per member at the DB level. 409 with human-readable error if member already belongs to a household.",
  },
  {
    area: "Host Community Hub",
    needs: "Postgres (HostAssignment, SubRequest, SubClaim, HostThread, HostReply, Alert models) · Postgres (program names and meet links) · Email (hub notification emails) · Auth (HOST / HOST_MANAGER / ADMIN roles)",
    powers: "Schedule tab (who covers which program) · Sub board (coverage requests) · Threads (discussion) · AlertStrip on dashboard (unread badge) · Unassigned-hosts cron alert",
    note: "programSlug is the join key for HostAssignment — never change a program slug once assignments exist. Slug changes silently orphan assignments.",
  },
  {
    area: "Scheduling & Automation",
    needs: "Postgres (reminderDate, startDatetime) · Postgres (registration records, reminderSentAt, Alert records) · Email · Vercel Cron (CRON_SECRET)",
    powers: "Auto-sends reminder emails on reminderDate · Deletes incomplete accounts after 48 hours · Creates UNASSIGNED_SESSION alerts for programs within 30 days with no host assigned",
    note: "Uses a 24-hour lookback window — safe even if cron runs slightly off-schedule. reminderSentAt and alert dedup prevent double-sends.",
  },
  {
    area: "Google Meet Integration",
    needs: "Google Workspace API (DWD) · Postgres (Program model) · Google Calendar (conflict detection on room accounts)",
    powers: "meetLink + meetHostAccount + calendarEventId saved to the program record · Shown on Dashboard today panel and Host Area · Calendar event auto-updates when startDatetime changes",
    note: "DWD must grant meetings.space.created + calendar.events scope in Google Admin. Calendar sync is inline in the PUT handler (no webhook needed).",
  },
];

const DATA_FLOWS: {
  id: string;
  title: string;
  subtitle: string;
  steps: { area: string; what: string }[];
}[] = [
  {
    id: "flow-registration",
    title: "A new visitor registers for a program",
    subtitle: "From first click on the site to active community member",
    steps: [
      { area: "Public Pages",       what: "Visitor finds the program on /community-programs or a direct link." },
      { area: "Postgres (Program model)",         what: "Program page loads: title, description, date/time, capacity, custom questions, dana configuration." },
      { area: "Registration Form",  what: "Visitor fills out the form. On email blur: check-email API runs — if the email is known, name and phone pre-fill from their account and lock (can't be overwritten)." },
      { area: "Postgres",           what: "User record found or created by email. Registration record created: REGISTERED if capacity available, WAITLISTED if full. Status determines everything downstream." },
      { area: "Email",              what: "Confirmation email sent immediately — registered or waitlisted variant, with add-to-calendar links if program datetimes are set in Postgres." },
      { area: "Stripe / Dana",      what: "If REGISTERED and danaMode ≠ none: a dana invitation appears inline after the confirmation message. Visitor can offer dana or genuinely skip." },
      { area: "Stripe Webhook",     what: "If the visitor pays: Stripe fires a webhook to our API → donationStatus → COMPLETED → a Donation record is written to Postgres." },
      { area: "Registrar Tools",    what: "The registration now appears in /account/registrar/[slug] for the registrar to see, manage, and act on." },
      { area: "Scheduling",         what: "On the program's reminderDate: the daily cron fires and sends a reminder email to all active registrants who haven't received one yet." },
      { area: "Auth + Onboarding",  what: "If the visitor logs in for the first time (via magic link), they land at /account/welcome to set their name and agree to community agreements." },
      { area: "Member Experience",  what: "Member now sees their registration on My Programs, the program's Meet link on the Dashboard today panel, and any linked courses in My Library." },
      { area: "Course Access",      what: "If the program has linkedCourses in Postgres: the member can now open those course pages at /course/[slug] — no extra grant needed." },
    ],
  },
  {
    id: "flow-login",
    title: "A member logs in on a Tuesday morning",
    subtitle: "From inbox to dashboard",
    steps: [
      { area: "Auth",               what: "Member enters email at /login → Resend sends a magic link → member clicks it → a session is created and stored in Postgres." },
      { area: "Route Protection",   what: "Session is checked against three conditions: agreedToTerms = false → /account/welcome; archivedAt is set → /account/reactivate; otherwise → /account/dashboard." },
      { area: "Member Experience",  what: "Dashboard loads. Today's drop-in sessions are queried from Postgres filtered by day of week (Milwaukee/CT timezone). Virtual programs show their Google Meet links." },
      { area: "Postgres (Program model)",         what: "Programs scheduled for today's day of week appear in the Today's Sessions panel. The meet link is read from the meetLink field saved earlier by the Google Meet integration." },
      { area: "Postgres",           what: "Dashboard also checks for any PENDING donationStatus registrations and shows a gentle reminder card if found." },
      { area: "Member Experience",  what: "Member navigates to My Programs: registration history loaded from Postgres, enriched with program date and location data from Postgres." },
      { area: "Course Access",      what: "Member opens /course/[slug]: three checks run — accessLevel = 'members'? Active registration for a linked program? Manual CourseAccess grant? If any pass, the course opens." },
    ],
  },
];

const CRITICAL_DEPS: { system: string; breaks: string[] }[] = [
  {
    system: "Postgres (Program model) (API token expired or Studio unreachable)",
    breaks: [
      "Program pages fail to load — all content comes from Postgres",
      "Registration form has no config: capacity, custom questions, and dana mode are all missing",
      "Dashboard 'Today' panel is empty",
      "Volunteer table can't determine field types for inline editing",
      "Google Meet links can't be saved back to the program record after creation",
    ],
  },
  {
    system: "Resend (email service down or API key revoked)",
    breaks: [
      "Magic link login fails completely — no one can sign in",
      "No confirmation emails after registration",
      "No reminder, role assignment, or edit-request emails sent",
    ],
  },
  {
    system: "Postgres / Neon database (connection string broken)",
    breaks: [
      "No registrations accepted — can't write to the DB",
      "No member logins — sessions are stored in Postgres",
      "Volunteer table is empty — reads from Postgres",
      "Member Management inaccessible",
      "Course access grants can't be checked or written",
    ],
  },
  {
    system: "Stripe webhook secret wrong (STRIPE_WEBHOOK_SECRET rotated without updating Vercel)",
    breaks: [
      "Dana step appears and visitor can attempt payment — but webhook signature fails",
      "donationStatus stays PENDING forever even after successful payment",
      "No Donation records written to Postgres",
    ],
  },
  {
    system: "Vercel Cron (CRON_SECRET missing or wrong in Vercel env)",
    breaks: [
      "Reminder emails not auto-sent on reminderDate (manual send in the volunteer table still works)",
      "Incomplete onboarding accounts accumulate and are never cleaned up",
      "UNASSIGNED_SESSION alerts not created for HOST_MANAGER/ADMIN when programs approach without a host",
    ],
  },
  {
    system: "AUTH_SECRET rotated in Vercel env without clearing existing sessions",
    breaks: [
      "All existing sessions are immediately invalidated — every logged-in member is signed out on their next request",
      "Members must re-authenticate via magic link",
    ],
  },
  {
    system: "Google Workspace / DWD misconfigured (scope revoked or service account broken)",
    breaks: [
      "Can't create new Google Meet spaces (manual creation still possible in Google Workspace admin)",
      "meetHostAccount not written back to the program record after creation attempt",
      "Existing meet links already saved to the program record still work — no impact on past programs or the host schedule tab",
    ],
  },
  {
    system: "Gmail OAuth token expired or revoked (GmailCredential invalid)",
    breaks: [
      "Support Inbox stops syncing new threads — cron fails silently every 5 minutes",
      "Replies and composed emails cannot be sent via Gmail API",
      "Existing thread data in Postgres is unaffected — just no new messages or sending capability",
      "Fix: Admin reconnects Gmail from Support Hub Settings tab (new OAuth2 flow)",
    ],
  },
  {
    system: "REGISTRAR_EMAIL env var missing from Vercel",
    breaks: [
      "Cancellation and 'responses updated' notifications fall back to EMAIL_FROM — still sent, just to a different address",
      "Not a hard failure, but the registrar may miss notifications",
    ],
  },
];

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<FeatureStatus, { label: string; cls: string }> = {
  active:   { label: "Active",   cls: "adm-fi-status--active" },
  stub:     { label: "Stub",     cls: "adm-fi-status--stub" },
  planned:  { label: "Planned",  cls: "adm-fi-status--planned" },
  partial:  { label: "Partial",  cls: "adm-fi-status--partial" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminFeaturesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const totalFeatures = AREAS.reduce((sum, a) => sum + a.features.length, 0);

  return (
    <div className="adm-page">
      <div className="adm-content adm-fi-content">

        {/* ── Header ── */}
        <div className="adm-fi-header">
          <div className="adm-fi-header__left">
            <Link href="/admin/members" className="adm-back">← Members</Link>
            <h1 className="adm-fi-title">Feature Inventory</h1>
            <p className="adm-fi-subtitle">
              Every feature organized by functional area.{" "}
              <strong>{totalFeatures} features</strong> across{" "}
              <strong>{AREAS.length} areas</strong>.
              Shows where each feature lives, what it does, and how it connects to the rest of the system.
            </p>
          </div>
          <div className="adm-fi-header__links">
            <Link href="/admin/sitemap" className="adm-sm-ext-link">Site Architecture →</Link>
            <Link href="/admin/manual" className="adm-sm-ext-link">Staff Manual →</Link>
            <Link href="/admin/roadmap" className="adm-sm-ext-link">Roadmap →</Link>
          </div>
        </div>

        {/* ── Quick-jump nav ── */}
        <nav className="adm-fi-jump">
          <div className="adm-fi-jump__row">
            <span className="adm-fi-jump__group-label">System view</span>
            <a href="#overview"      className="adm-fi-jump__link adm-fi-jump__link--sys">Overview</a>
            <a href="#system-map"    className="adm-fi-jump__link adm-fi-jump__link--sys">System Map</a>
            <a href="#data-flows"    className="adm-fi-jump__link adm-fi-jump__link--sys">Data Flows</a>
            <a href="#if-x-breaks"   className="adm-fi-jump__link adm-fi-jump__link--sys">If X Breaks</a>
          </div>
          <div className="adm-fi-jump__divider" />
          <div className="adm-fi-jump__row">
            <span className="adm-fi-jump__group-label">Feature areas</span>
            {AREAS.map((area) => (
              <a key={area.id} href={`#${area.id}`} className="adm-fi-jump__link">
                {area.icon} {area.title}
              </a>
            ))}
          </div>
        </nav>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── SYSTEM OVERVIEW ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <section id="overview" className="adm-fi-sys-section">
          <h2 className="adm-fi-sys-section__title">What is this system?</h2>

          <div className="adm-fi-overview-prose">
            <p>
              <strong>RIM Next</strong> is the website and member platform for Rooted in Mindfulness —
              a community insight meditation center in Brookfield, WI. It does four things:
            </p>
            <ol className="adm-fi-overview-list">
              <li><strong>Publishes</strong> programs, teachings, and resources for anyone to browse — no account needed.</li>
              <li><strong>Lets visitors register</strong> for programs without an account. Registration is the primary front door to community membership — most members first appear in the database this way.</li>
              <li><strong>Gives members a personal space</strong> — a dashboard, registration history, dharma library, and access to member-gated courses.</li>
              <li><strong>Gives staff the tools</strong> to manage registrations, members, and content — without needing direct database access.</li>
            </ol>
            <p>
              Programs, courses, lessons, and member data all live in <strong>Postgres</strong> (hosted on Neon), managed by staff via the Program Editor, Course Hub, and admin tools. Some non-program content (teams, glossary, magazine articles) still lives in <strong>Sanity CMS</strong>.
            </p>
          </div>

          <h3 className="adm-fi-sys-section__subtitle">Who uses this system</h3>
          <div className="adm-fi-table-wrap">
            <table className="adm-fi-table">
              <thead>
                <tr>
                  <th>Who</th>
                  <th>Login</th>
                  <th>What they can do</th>
                </tr>
              </thead>
              <tbody>
                {USER_TYPES.map((u) => (
                  <tr key={u.who}>
                    <td><strong>{u.who}</strong></td>
                    <td className="adm-fi-table__muted">{u.login}</td>
                    <td>{u.canDo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="adm-fi-overview-note">
            <strong>Key philosophy:</strong> Registration always confirms first — payment (dana) is a
            separate optional invitation, never a gate. Google Meet links are only visible when logged
            in — they are not in emails or on public pages. Every User record with{" "}
            <code>agreedToTerms = true</code> is an intentional community member.
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── SYSTEM MAP ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <section id="system-map" className="adm-fi-sys-section">
          <h2 className="adm-fi-sys-section__title">How the system connects</h2>
          <p className="adm-fi-sys-section__intro">
            Each functional area has things it <strong>needs</strong> to work, and things it{" "}
            <strong>powers</strong> when it works. This map shows both directions.
            Reading it tells you: if I change area X, what else might be affected?
          </p>

          <div className="adm-fi-table-wrap">
            <table className="adm-fi-table adm-fi-table--map">
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>Area</th>
                  <th style={{ width: "33%" }}>Needs (depends on)</th>
                  <th style={{ width: "33%" }}>Powers (enables)</th>
                  <th style={{ width: "18%" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {SYSTEM_MAP.map((row) => (
                  <tr key={row.area}>
                    <td><strong>{row.area}</strong></td>
                    <td className="adm-fi-table__small">{row.needs}</td>
                    <td className="adm-fi-table__small">{row.powers}</td>
                    <td className="adm-fi-table__note">{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── DATA FLOWS ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <section id="data-flows" className="adm-fi-sys-section">
          <h2 className="adm-fi-sys-section__title">How data moves through the system</h2>
          <p className="adm-fi-sys-section__intro">
            Two complete end-to-end scenarios that touch most of the system. Each step is
            labeled with the area responsible. Read these to understand how the parts
            work together as a whole.
          </p>

          <div className="adm-fi-flows">
            {DATA_FLOWS.map((flow) => (
              <div key={flow.id} className="adm-fi-flow">
                <div className="adm-fi-flow__head">
                  <div className="adm-fi-flow__title">{flow.title}</div>
                  <div className="adm-fi-flow__subtitle">{flow.subtitle}</div>
                </div>
                <ol className="adm-fi-flow__steps">
                  {flow.steps.map((step, i) => (
                    <li key={i} className="adm-fi-flow__step">
                      <span className="adm-fi-flow__step-area">{step.area}</span>
                      <span className="adm-fi-flow__step-text">{step.what}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* ── IF X BREAKS ── */}
        {/* ════════════════════════════════════════════════════════════════════ */}

        <section id="if-x-breaks" className="adm-fi-sys-section">
          <h2 className="adm-fi-sys-section__title">If X breaks, what stops working?</h2>
          <p className="adm-fi-sys-section__intro">
            A quick-reference guide to cascading failures. Useful for diagnosing an incident
            or understanding which env vars and external services are critical.
          </p>

          <div className="adm-fi-deps">
            {CRITICAL_DEPS.map((dep) => (
              <div key={dep.system} className="adm-fi-dep">
                <div className="adm-fi-dep__system">⚠️ {dep.system}</div>
                <ul className="adm-fi-dep__breaks">
                  {dep.breaks.map((b) => (
                    <li key={b} className="adm-fi-dep__break-item">{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider before feature detail ── */}
        <div className="adm-fi-detail-header">
          <h2 className="adm-fi-detail-header__title">Feature detail</h2>
          <p className="adm-fi-detail-header__desc">
            Every feature in the system, organized by area — with exact locations,
            plain-language descriptions, and functional relationships.
          </p>
        </div>

        {/* ── Feature Areas ── */}
        <div className="adm-fi-areas">
          {AREAS.map((area) => (
            <section key={area.id} id={area.id} className="adm-fi-area">
              <div className="adm-fi-area__head">
                <div className="adm-fi-area__icon">{area.icon}</div>
                <div>
                  <h2 className="adm-fi-area__title">{area.title}</h2>
                  <p className="adm-fi-area__desc">{area.desc}</p>
                </div>
                <span className="adm-fi-area__count">{area.features.length} feature{area.features.length !== 1 ? "s" : ""}</span>
              </div>

              <div className="adm-fi-features">
                {area.features.map((feat) => {
                  const statusInfo = feat.status ? STATUS_CONFIG[feat.status] : null;
                  return (
                    <div key={feat.name} className="adm-fi-feat">
                      <div className="adm-fi-feat__head">
                        <h3 className="adm-fi-feat__name">{feat.name}</h3>
                        <div className="adm-fi-feat__badges">
                          {statusInfo && statusInfo.label !== "Active" && (
                            <span className={`adm-fi-status ${statusInfo.cls}`}>{statusInfo.label}</span>
                          )}
                          {feat.note && <span className="adm-fi-feat__note">{feat.note}</span>}
                        </div>
                      </div>

                      <div className="adm-fi-feat__body">
                        {/* Where */}
                        <div className="adm-fi-feat__row">
                          <span className="adm-fi-feat__label">Where</span>
                          <div className="adm-fi-feat__locations">
                            {feat.locations.map((loc) => (
                              <code key={loc} className="adm-fi-feat__loc">{loc}</code>
                            ))}
                          </div>
                        </div>

                        {/* What */}
                        <div className="adm-fi-feat__row">
                          <span className="adm-fi-feat__label">What</span>
                          <p className="adm-fi-feat__what">{feat.what}</p>
                        </div>

                        {/* Related to */}
                        <div className="adm-fi-feat__row">
                          <span className="adm-fi-feat__label">Related&nbsp;to</span>
                          <ul className="adm-fi-feat__related">
                            {feat.relatedTo.map((rel) => (
                              <li key={rel} className="adm-fi-feat__rel-item">{rel}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="adm-sm-footer-note">
          <strong>Note:</strong> This page is maintained manually. When new features are built,
          update this file (<code>app/admin/features/page.tsx</code>) and{" "}
          <code>FEATURES.md</code> in the same session.
          <br /><br />
          <strong>Source of truth:</strong>{" "}
          <code>FEATURES.md</code> in the project root contains full technical notes,
          implementation details, and the session log.
        </div>

      </div>
    </div>
  );
}
