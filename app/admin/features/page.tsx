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
          "Protects /account/*, /volunteer/*, /admin/*, /course/*, /hosts/*",
          "Reads session cookie set by Authentication",
          "Works with Member Archive system (checks archivedAt)",
          "Works with Community Onboarding system (checks agreedToTerms)",
        ],
      },
      {
        name: "Role-Based Access (Server Components)",
        locations: ["/volunteer/*", "/admin/*", "/hosts/*"],
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
        what: "Displayed on the program detail page when registrationEnabled = true in Sanity. Collects name, email, phone, custom per-program questions, and (for non-logged-in users) the community agreements checkbox. Handles capacity limits, waitlisting, closed registration, and duplicate prevention.",
        relatedTo: [
          "Connects to Sanity CMS for program configuration (custom fields, capacity, deadline)",
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
          "Connects account data (Postgres) to registration form (Sanity/public page)",
          "Works on both inline (/programs/[slug]) and standalone (/programs/[slug]/register)",
        ],
      },
      {
        name: "Capacity Limits & Waitlist",
        locations: ["/programs/[slug]", "API: POST /api/registrations"],
        what: "Each program can have a registrationCapacity set in Sanity. When capacity is reached, new registrants are placed on the waitlist and assigned a position number. Waitlisted registrants do not see the dana step — their donationStatus is NOT_REQUIRED until promoted.",
        relatedTo: [
          "Capacity and deadline configured in Sanity CMS (programs schema)",
          "Waitlist promotion handled in Volunteer / Registrar Tools",
          "Spot-opened alert shown in volunteer table when a cancellation creates a vacancy",
          "Member self-cancel also triggers spot-opened alert",
        ],
      },
      {
        name: "Custom Per-Program Questions",
        locations: ["Sanity Studio (programs → Registration tab)", "Component: RegistrationForm.tsx", "API: POST /api/registrations"],
        what: "Program coordinators can define custom questions for each program in Sanity (short text, long text, yes/no, dropdown). Answers are stored as a JSON object on the Registration record and shown to registrars in the volunteer table.",
        relatedTo: [
          "Configured in Sanity CMS (registrationFields array on programs schema)",
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
        what: "Sent immediately after a successful registration. Two variants: REGISTERED (subject: 'You're registered — [Program]', with add-to-calendar links) and WAITLISTED (subject: 'You're on the waitlist — [Program]', with waitlist position). Includes the per-program confirmationMessage rich text if set in Sanity.",
        relatedTo: [
          "Triggered by Program Registration",
          "Includes calendar links if startDatetime/endDatetime set in Sanity",
          "confirmationMessage block configured in Sanity CMS",
          "Converted by lib/portableTextEmail.ts for email-safe rendering",
        ],
      },
      {
        name: "Waitlist Approval Email",
        locations: ["File: lib/email.ts (sendApprovalEmail)", "API: PATCH /api/registrations/[id]"],
        what: "Sent when a registrar promotes a registrant from WAITLISTED to APPROVED or REGISTERED. Includes the program date/time/location and, if the program has a dana practice, a 'Complete Dana Offering' button linking to the program page.",
        relatedTo: [
          "Triggered by Waitlist Promotion action in Volunteer / Registrar Tools",
          "Dana section conditional on program's danaMode (Sanity CMS)",
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
        what: "Sent to active (REGISTERED/APPROVED) registrants before a program. Includes date/time/location and an optional custom reminderMessage from Sanity. Can be sent automatically by the daily cron (if reminderDate is set in Sanity), in bulk via the volunteer table banner, or per-row via the Actions panel. reminderSentAt prevents double-sends across all paths.",
        relatedTo: [
          "reminderDate and reminderMessage configured in Sanity CMS",
          "Shown in Volunteer / Registrar Tools (reminder banner + per-row button)",
          "Scheduled via Scheduling & Automation (Reminder Cron)",
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
          "Links to /volunteer and /admin/manual",
          "HOST role assignment has a separate notification email",
        ],
      },
      {
        name: "HOST Role Notification Email",
        locations: ["File: lib/email.ts (sendHostRoleAssignmentEmail)", "API: PATCH /api/admin/members/[id]"],
        what: "Sent once when the HOST role is first assigned to a member. Similar structure to the REGISTRAR notification.",
        relatedTo: [
          "Triggered by HOST Role Assignment in Member Management (Admin)",
          "Links to /hosts and relevant documentation",
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
          "Dana mode and amounts configured in Sanity CMS (programs → Dana tab)",
          "Stripe Checkout Session Creation (API)",
          "donationStatus on Registration record (Postgres DB)",
          "Add-to-Calendar Links (appear post-registration, before dana step for REGISTERED)",
        ],
      },
      {
        name: "Dana Modes (Sanity)",
        locations: ["Sanity Studio (programs → Dana tab)", "File: sanity/schemas/programs.js"],
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
        what: "After confirming registration, members see '+ Google Calendar' and '+ Apple / Outlook' links. Google Calendar link opens pre-filled. The .ics route returns an RFC 5545 file for Apple/Outlook download. Links only appear when startDatetime/endDatetime are set in Sanity. Recurrence rules (RRULE) are generated from the 4 recurrence fields in Sanity.",
        relatedTo: [
          "startDatetime/endDatetime configured in Sanity CMS (programs → Schedule & Location tab)",
          "Recurrence fields (recurrenceFreq, recurrenceInterval, recurrenceDays, recurrenceCount) drive the RRULE",
          "Also included in Registration Confirmation Email",
        ],
      },
    ],
  },

  {
    id: "volunteer",
    title: "Volunteer / Registrar Tools",
    icon: "📊",
    desc: "Private staff area for managing program registrations. Accessible at /volunteer. Requires login; REGISTRAR or ADMIN role recommended.",
    features: [
      {
        name: "Registrar Program List",
        locations: ["/volunteer"],
        what: "Lists all programs where registrationEnabled = true (from Sanity). Shows registration counts by status (total, registered, waitlisted, approved). Each program links to its registration table.",
        relatedTo: [
          "Sanity CMS — registrationEnabled field on programs",
          "Registration counts from Postgres DB",
          "Entry point to Registration Management Table",
        ],
      },
      {
        name: "Registration Management Table",
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: GET /api/programs/[slug]/registrations"],
        what: "Full registrant list for a program with filtering by status. Each row shows name, email, phone, status badge, donation status, and registration date. Click to expand for custom field answers and staff notes. Mobile view transforms into a card layout.",
        relatedTo: [
          "All registration actions connect to PATCH /api/registrations/[id]",
          "Custom fields come from both Registration DB and Sanity (field type definitions)",
          "All email actions connect to Email & Notifications",
          "CSV Export (API: GET /api/programs/[slug]/registrations?format=csv)",
        ],
      },
      {
        name: "Promote / Cancel / Restore Actions",
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id]"],
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
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id]"],
        what: "Registrar can edit a registrant's custom field answers inline without a page reload. Click 'Edit' next to the RESPONSES column header to enter edit mode. Input type is determined by the field definition in Sanity: yesNo → dropdown, select → dropdown with program options, longText → textarea, shortText → text input.",
        relatedTo: [
          "Field type definitions from Sanity CMS (registrationFields)",
          "Stores answers as JSON in Registration.customFields",
          "Also editable by the registrant via Self-Service Edit Link",
        ],
      },
      {
        name: "Send Edit Request (Self-Service Edit Link)",
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendEditRequest)", "/update/[token]"],
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
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendReminder), POST /api/programs/[slug]/send-reminder"],
        what: "Per-row: 'Send Reminder' button on REGISTERED/APPROVED rows. Shows sent timestamp after first send; re-sends possible. Bulk: 'Send to Remaining N' button in the reminder banner above the table (shown when reminderDate is set in Sanity). reminderSentAt prevents double-sends from cron + manual.",
        relatedTo: [
          "Program Reminder Email",
          "reminderDate set in Sanity CMS (programs → Registration tab)",
          "Reminder Cron also fires from the same reminderDate",
        ],
      },
      {
        name: "Send Dana Reminder (Per-Row, Manual)",
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx", "API: PATCH /api/registrations/[id] (action: sendDanaReminder)"],
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
        locations: ["/volunteer/programs/[slug]", "Component: VolunteerTable.tsx"],
        what: "When a cancellation (by staff or member) creates a vacancy, a banner appears in the volunteer table indicating a spot is now open and a waitlisted registrant could be promoted.",
        relatedTo: [
          "Triggered by Cancel action (Promote / Cancel / Restore Actions)",
          "Also triggered by Member Self-Cancel (Program Registration)",
          "Encourages registrar to promote from Waitlist",
        ],
      },
      {
        name: "Host Area",
        locations: ["/hosts"],
        what: "A page for the host team (HOST, REGISTRAR, or ADMIN roles) listing virtual programs with their assigned Google Meet room and join link. Includes 'How to host' guidance.",
        relatedTo: [
          "Google Meet Integration — room accounts and meet links",
          "HOST Role (Roles & Permissions)",
          "Sanity CMS — virtual programs with meetLink and meetHostAccount fields",
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
        what: "The member area home page. Displays 5 nav cards (Today's Sessions, My Programs, My Library, Our Agreements, My Profile), today's drop-in Zoom links (Milwaukee/CT timezone-aware), pending dana reminders for waitlist-promoted members, and a staff access panel (only visible to REGISTRAR and ADMIN roles).",
        relatedTo: [
          "Today's sessions queried from Sanity by day of week",
          "Pending dana prompt connects to Program Registration dana step",
          "Staff access panel connects to Volunteer/Admin areas",
          "Navigation (nav-) links to all member sub-pages",
        ],
      },
      {
        name: "My Programs (Registration History)",
        locations: ["/account/dashboard-my-registrations", "Component: CancelRegistrationButton.tsx", "API: GET /api/account/registrations"],
        what: "Shows the member's complete registration history — active first, then past/cancelled. Each card shows program title, date/time/location (enriched from Sanity), status badge, waitlist position, and pending dana prompt. Active registrations have a cancel button.",
        relatedTo: [
          "Registration records from Postgres DB, enriched with Sanity program data",
          "Member Self-Cancel Registration (Program Registration)",
          "Dana prompt links to Payment & Dana step",
        ],
      },
      {
        name: "My Library",
        locations: ["/account/dashboard-my-library"],
        what: "Curated list of dharma learning resources. Currently hardcoded with 4 items (one link goes to the old Webflow site). Has 'work in progress' copy. A proper dynamic rebuild is planned.",
        relatedTo: [
          "Planned: pull member-accessible courses and resources from Sanity based on access level and registration history",
          "Course Access System — would show courses the member can access",
        ],
        status: "stub",
        note: "Content hardcoded; planned: dynamic Sanity-driven version",
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
    title: "Course Access",
    icon: "📚",
    desc: "Member-gated course pages. Access can be open to all members, granted via program registration, or manually granted by an admin.",
    features: [
      {
        name: "Course Page Gating",
        locations: ["/course/[slug]"],
        what: "Each course has an accessLevel in Sanity: 'members' (any logged-in member) or 'registration_required' (must have an active registration for a linked program, or have a manual CourseAccess grant). Non-members see a 'Join or sign in →' wall.",
        relatedTo: [
          "accessLevel set in Sanity Studio (Courses)",
          "Auto-access via Program Registration (linkedCourses on programs schema)",
          "Manual grants managed in Member Management (CourseAccessSection)",
          "Lessons listed as clickable cards; section titles as non-linked dividers",
        ],
      },
      {
        name: "Auto-Access via Registration",
        locations: ["/course/[slug]", "File: lib/queries.ts (allCoursesWithLinkedProgramsQuery)"],
        what: "If a course has linkedCourses in Sanity pointing to a program, any member with an active (REGISTERED or APPROVED) registration for that program automatically gets access. Checked dynamically at page render — no DB write needed.",
        relatedTo: [
          "linkedCourses field on programs schema (Sanity CMS)",
          "Reverse reference GROQ query: *[_type == 'programs' && ^._id in linkedCourses[]._ref]",
          "Registration status (Postgres) checked at page render time",
        ],
      },
      {
        name: "Manual Course Access Grants",
        locations: ["/admin/members/[id]", "Component: CourseAccessSection.tsx", "API: POST /api/admin/members/[id]/course-access, DELETE /api/admin/members/[id]/course-access"],
        what: "Admins and registrars can grant or revoke access to any course for any member from the member detail page. Inline UI shows all courses with status badges (All Members / Via Registration / Manual Grant / No Access) and grant/revoke controls with warning dialogs.",
        relatedTo: [
          "CourseAccess model in Postgres (userId + courseSlug unique)",
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
    desc: "ADMIN-only tools for managing the community member database. Search, edit, assign roles, import, archive, and delete.",
    features: [
      {
        name: "Member List",
        locations: ["/admin/members", "Component: MembersTable.tsx", "API: GET /api/admin/members"],
        what: "Searchable, filterable table of all community members. Client-side search (no round-trip) by name or email. Role filter: All / Admins / Registrars / No roles. Archived toggle (hidden by default — appears only when archivedCount > 0). Click any row to open member detail.",
        relatedTo: [
          "Member Detail (Admin)",
          "CSV Import (opens panel inline)",
          "Roles & Permissions",
          "Archive system (shows/hides archived rows)",
        ],
      },
      {
        name: "Member Detail",
        locations: ["/admin/members/[id]", "Component: MemberDetail.tsx", "API: PATCH /api/admin/members/[id]"],
        what: "Full profile view: edit name/phone, assign/revoke roles (ADMIN, REGISTRAR), manage course access, view registration history, and archive/restore/delete the member.",
        relatedTo: [
          "Roles assigned here cascade to Email & Notifications (role notification email)",
          "Course Access System (CourseAccessSection component embedded here)",
          "Sanity Studio Access panel (invite/revoke from here)",
          "Archive/restore/delete connects to Account Reactivation",
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
        name: "Archive, Restore & Delete",
        locations: ["/admin/members/[id]", "Component: MemberDetail.tsx (Danger Zone)", "API: PATCH /api/admin/members/[id] (action: archive / restore), DELETE /api/admin/members/[id]"],
        what: "Three membership states: Active (default), Archived (has registrations — session killed, member redirected to /account/reactivate), Deleted (zero registrations only — hard delete with cascade). Archive/delete require confirmation dialogs. Delete blocked with 409 if registrations exist.",
        relatedTo: [
          "Archive kills all sessions immediately (Postgres sessions table)",
          "Route Protection redirects archived members to /account/reactivate",
          "Account Reactivation (self-service path back to Active)",
          "Auto-restore fires when archived member registers for a program",
        ],
      },
      {
        name: "Sanity Studio Access (Invite / Revoke)",
        locations: ["/admin/members/[id]", "Component: MemberDetail.tsx (Sanity Studio Access panel)", "API: POST /api/admin/members/[id]/sanity-invite"],
        what: "Admins can invite staff members to Sanity Studio directly from the member detail page. Invite is sent via the Sanity Management API. sanityInvitedAt is stamped on the User record. When the REGISTRAR role is revoked, Sanity access is also revoked automatically (async).",
        relatedTo: [
          "Sanity CMS (the studio at rooted-in-mindfulness.sanity.studio)",
          "REGISTRAR and ADMIN roles in Roles & Permissions",
          "SANITY_MANAGEMENT_TOKEN env var (Developer role in Sanity)",
          "Staff dashboard card links to Sanity Studio (Member Dashboard)",
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
        what: "Runs daily at 14:00 UTC (9:00 AM Central). Queries Sanity for programs whose reminderDate falls within the past 24 hours, then sends the reminder email to all REGISTERED/APPROVED registrants who haven't received it yet (reminderSentAt is null).",
        relatedTo: [
          "Program Reminder Email",
          "reminderDate configured in Sanity CMS (programs → Registration tab)",
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
    desc: "Creating and assigning Google Meet spaces to virtual programs. Uses Domain-Wide Delegation to impersonate shared room accounts.",
    features: [
      {
        name: "Create Meet Button",
        locations: ["/hosts", "Component: CreateMeetButton.tsx", "API: POST /api/programs/[slug]/google-meet", "File: lib/google-meet.ts"],
        what: "Hosts and admins can create a persistent Google Meet space for a virtual program from the Host Area. The button assigns one of the shared room accounts (meet1@, meet2@, etc.) based on calendar availability, creates the Meet space, and saves the meetLink and meetHostAccount back to Sanity.",
        relatedTo: [
          "Host Area (/hosts) — entry point",
          "Sanity CMS — meetLink and meetHostAccount fields on programs",
          "Google Workspace (Domain-Wide Delegation, room account calendars)",
          "GOOGLE_ROOM_EMAILS env var (list of room account emails)",
        ],
      },
      {
        name: "Room Account Assignment",
        locations: ["File: lib/google-meet.ts"],
        what: "The system checks each room account's primary Google Calendar for conflicts on the program's scheduled day. The first conflict-free room is assigned. The Meet space is created under that room's identity via DWD impersonation.",
        relatedTo: [
          "Google Calendar API (conflict detection)",
          "Google Meet API (space creation)",
          "startDatetime on programs (Sanity) drives conflict detection",
        ],
      },
      {
        name: "Meet Link on Dashboard & Host Area",
        locations: ["/account/dashboard", "/hosts"],
        what: "Google Meet links are shown to logged-in members on the Dashboard under 'Today's Sessions.' They are also shown on the Host Area for staff reference. Links are deliberately NOT shown in confirmation emails or on public program pages — members must be logged in to access them.",
        relatedTo: [
          "Dashboard Hub (Member Experience)",
          "Host Area (Volunteer / Registrar Tools)",
          "Community philosophy: Meet links require login to protect sessions for members",
        ],
      },
    ],
  },

  {
    id: "sanity",
    title: "Sanity CMS",
    icon: "🗂️",
    desc: "The content management system powering all dynamic content. Schema lives at /Users/jessefoy/Sites/rim-website/sanity/ — shared between rim-next and the Eleventy site.",
    features: [
      {
        name: "Programs Schema",
        locations: ["File: sanity/schemas/programs.js", "Sanity Studio: programs collection"],
        what: "The richest schema in the system. Six tabs: Content, Schedule & Location, Registration, Dana, Dashboard, Visibility. Controls everything from program description and teacher to registration capacity, custom questions, dana mode, reminder dates, and Google Meet link.",
        relatedTo: [
          "Drives Program Registration (all registration fields)",
          "Drives Payment & Dana (danaMode, amounts, message)",
          "Drives Email & Notifications (reminderDate, reminderMessage, confirmationMessage)",
          "Drives Google Meet Integration (meetLink, meetHostAccount)",
          "Drives Dashboard 'Today' panel (dayOfWeek, hideFromDashboard)",
          "richContent shared type for description and other rich text fields",
        ],
      },
      {
        name: "Lessons Schema",
        locations: ["File: sanity/schemas/lessons.js", "Sanity Studio: lessons collection"],
        what: "Schema for individual dharma lessons. Supports audio files, video embeds, and rich PortableText content (pull quotes, verse quotes, callout blocks, practice suggestions) via the shared richContent type.",
        relatedTo: [
          "Lesson page (/lessons/[slug])",
          "richContent shared block schema (shared with programs description)",
          "Course schema (lessons are grouped into courses)",
        ],
      },
      {
        name: "Courses Schema",
        locations: ["File: sanity/schemas/courses.js", "Sanity Studio: courses collection"],
        what: "Groups lessons into a course. Has an accessLevel field (members / registration_required) that drives Course Access gating. Programs can link to courses via linkedCourses, granting access to registered members.",
        relatedTo: [
          "Course Access System (/course/[slug])",
          "Programs schema (linkedCourses references)",
          "Lessons schema",
        ],
      },
      {
        name: "richContent Shared Schema",
        locations: ["File: sanity/schemas/richContent.js"],
        what: "A named array type used by both lessonContent (lessons) and programDescription (programs). Contains standard text blocks plus custom types: practiceCallout, bodyQuote, verseQuote, calloutText. Adding a new block type here automatically makes it available in both content types.",
        relatedTo: [
          "Lesson pages (lp- prefix) — full rendering",
          "Program detail pages (pg- prefix) — programDescription",
          "portableTextComponents map in JSX for rendering",
        ],
      },
      {
        name: "Other CMS Content Types",
        locations: ["Sanity Studio: magazineArticles, glossaryTerms, team, volunteerPositions, programCategories"],
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
        what: "All programs grouped by programCategory from Sanity. Drop-ins and registration-based programs. Each program links to its detail page.",
        relatedTo: [
          "Sanity CMS — programs and programCategories schemas",
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
          "Sanity CMS — programs schema",
          "Google Meet Integration (Zoom link shown to members)",
        ],
        status: "active",
        note: "🟢 Design system (pg- prefix)",
      },
      {
        name: "Dharma Lessons",
        locations: ["/lessons/[slug]"],
        what: "Audio player, video embed, rich PortableText — pull quotes, verse quotes, callout blocks, practice suggestions.",
        relatedTo: [
          "Sanity CMS — lessons schema and richContent shared type",
          "Course pages (/course/[slug]) — lessons grouped into courses",
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
          "Sanity CMS — glossaryTerms, team, volunteerPositions, magazineArticles schemas",
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
        what: "Two-chapter plain-English guide for REGISTRAR and ADMIN staff. Chapter 1: Registration Management (9 sections covering all registrar workflows). Chapter 2: Programs in Sanity Studio (11 sections with field-by-field documentation). Organized as expandable accordion sections.",
        relatedTo: [
          "Volunteer / Registrar Tools (Chapter 1 subject matter)",
          "Sanity CMS (Chapter 2 subject matter)",
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
          {AREAS.map((area) => (
            <a key={area.id} href={`#${area.id}`} className="adm-fi-jump__link">
              {area.icon} {area.title}
            </a>
          ))}
        </nav>

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
