import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Staff Manual — Admin" };

// ─── Types ──────────────────────────────────────────────────────────────────

interface Feature {
  name: string;
  who?: string;
  desc: string;
  bullets?: string[];
}

interface Module {
  id: string;
  title: string;
  who: string;
  intro: string;
  features: Feature[];
}

interface NoteItem {
  title: string;
  body: string;
}

// ─── Modules ─────────────────────────────────────────────────────────────────

const MODULES: Module[] = [
  {
    id: "auth",
    title: "Authentication & Sign-In",
    who: "All users",
    intro:
      "Members sign in with a magic link — no password needed. The system sends a one-click link to their email. Works identically for new and returning members, and for staff.",
    features: [
      {
        name: "Magic Link Sign-In",
        who: "Members, Staff",
        desc: "Visitors go to /login, enter their email address, and receive a secure link via Resend. Clicking the link signs them in automatically. There is no password to create, remember, or reset. Sessions persist across browser sessions via a database-backed cookie.",
      },
      {
        name: '"Join or Sign In" Login Page',
        who: "Visitors, returning members",
        desc: 'The login page is framed as an entry point for both new visitors and existing members — not just "existing accounts." A brief note explains how magic links work and tells new visitors they\'ll set up their name and community agreements on first sign-in.',
      },
      {
        name: "Session Management",
        who: "System",
        desc: "Sessions are stored in the Postgres database, not in client cookies. When an admin archives a member, all their active sessions are immediately deleted — they are logged out on their next request. The cleanup cron removes sessions belonging to incomplete accounts after 48 hours.",
      },
    ],
  },

  {
    id: "roles",
    title: "Roles & Permissions",
    who: "Admin",
    intro:
      "Users can hold one or more staff roles that unlock protected areas of the site. Regular community members have no roles — membership itself is the default state for any account with agreedToTerms = true.",
    features: [
      {
        name: "Available Roles",
        who: "Admin",
        desc: "Five staff roles are defined. Holding a role is additive — it unlocks additional areas without changing anything about the member experience.",
        bullets: [
          "ADMIN — full site access: member management, admin tools, registrar area, all admin pages",
          "REGISTRAR — access to the volunteer/registrar area to manage program registrations",
          "TREASURER — intended for donation management (management UI not yet built)",
          "TEACHER — defined in the system, not yet active",
          "VOLUNTEER — defined in the system, not yet active",
        ],
      },
      {
        name: "Assigning Roles",
        who: "Admin",
        desc: "Roles are assigned from the member detail page (/admin/members/[id]) via checkboxes. Each role shows a brief description. Clicking Save applies all role changes in one API call.",
      },
      {
        name: "Dashboard Integration",
        who: "Staff",
        desc: "Assigned roles automatically surface as additional staff cards on the member's dashboard. ADMIN sees: Registrations + Members. REGISTRAR sees: Registrations. If a user holds both ADMIN and REGISTRAR, the shared links are deduplicated — no duplicate cards.",
      },
      {
        name: "Authorization Enforcement",
        who: "System",
        desc: "Route protection is layered: proxy.ts blocks unauthenticated access to protected paths. Server components then check session.user.roles for role-specific access. Admin-only pages return a plain 'not authorized' message if the user lacks the ADMIN role; they do not redirect.",
      },
    ],
  },

  {
    id: "onboarding",
    title: "Community Onboarding",
    who: "All new members",
    intro:
      "RIM is an intentional community — not a platform. The onboarding flow is designed to feel like entering a held, intentional space. Every member record in the database represents a real person who has actively chosen to participate.",
    features: [
      {
        name: "Path A — Through a Program (Primary Path)",
        who: "New members",
        desc: "When someone registers for a program, the registration form is the threshold. It collects first name, last name, email, phone, and a brief community agreements checkbox — all on one form. Their User record is created or updated at this point. The confirmation email includes a magic link to their dashboard. Clicking it brings them straight in, no additional steps. Profile is already populated.",
      },
      {
        name: "Path B — Direct Login (Magic Link First)",
        who: "New members via direct login",
        desc: "Someone goes to /login and enters their email. The first time they use the magic link, proxy.ts intercepts and redirects them to /account/welcome before the dashboard. This is a warm, community-voiced page: name (required), phone (optional), community agreements checkbox. Once completed, they go to the dashboard and never see the welcome page again.",
      },
      {
        name: "Community Agreements",
        who: "All new members",
        desc: "A brief, warm statement of RIM's values — not a legal document. Something close to what you'd hear at the opening of a retreat. Members confirm it once: either on the registration form (Path A) or the welcome page (Path B). The checkbox is hidden on all future forms and pages once agreedToTerms is true.",
      },
      {
        name: "Explicit Decline",
        who: "Visitors",
        desc: "The welcome page includes a visible 'I'd rather not join' link. Clicking it immediately deletes the User record and all related data, signs the visitor out, and redirects to the public homepage. The decision is respected; no record is kept.",
      },
      {
        name: "Incomplete Account Cleanup",
        who: "System (automatic)",
        desc: "A daily cron at 15:00 UTC deletes User records where agreedToTerms is false and the account is older than 48 hours. This removes abandoned accounts — people who clicked a magic link and closed the browser before completing their profile. Silent, automatic, daily.",
      },
      {
        name: "Archive & Self-Service Reactivation",
        who: "Admin (archive), Members (reactivate)",
        desc: "Archiving is a 'sleeping' state, not a permanent lock. RIM's ethos is welcoming — if someone moves away and later wants to return, they can do so without contacting staff. Two re-entry paths: (1) register for any program — the registration API automatically clears archivedAt; (2) click a magic link → land on /account/reactivate → one button restores account → dashboard.",
      },
    ],
  },

  {
    id: "registration",
    title: "Program Registration",
    who: "Anyone (no account required)",
    intro:
      "The complete system for registering for programs. Handles capacity, waitlisting, custom questions, email confirmation, and an integrated dana (contribution) invitation via Stripe. Registration is always the first step; payment is always a separate, optional invitation after the spot is confirmed.",
    features: [
      {
        name: "Registration Form",
        who: "Anyone",
        desc: "Standard fields: first name, last name, email, phone. Optional custom fields configured per-program in Sanity. No account required — anyone with an email address can register. Logged-in members get a shorter form (name/phone pre-filled, email locked to their account).",
      },
      {
        name: "Returning Member Recognition",
        who: "Non-logged-in visitors",
        desc: "When a visitor enters their email and leaves the field, the form checks if the email matches a known account. If found: first name, last name, and phone are pre-filled from the account; a warm 'Welcome back, [Name]!' notice appears; the name and phone fields are locked — they cannot be changed in the form. Account stored values always win.",
      },
      {
        name: "Capacity & Waitlist",
        who: "System",
        desc: "Each program can have a registration capacity set in Sanity. When full, 'Register' becomes 'Join Waitlist.' Waitlisted registrants see their position. When a spot opens and a registrar promotes someone, an approval email is sent automatically.",
        bullets: [
          "Active count = REGISTERED + APPROVED (waitlisted and cancelled don't count against capacity)",
          "When ≤5 spots remain: a 'Only X spots remaining!' warning shows on the form",
          "Waitlist position is displayed to the registrant on the form and in their registration history",
        ],
      },
      {
        name: "Registration Deadline & Closed Flag",
        who: "Registrar (Sanity)",
        desc: "Programs can have a registrationDeadline datetime in Sanity. After this date, the form is replaced with 'Registration closed.' A registrationClosed boolean flag can also close registration manually at any time, even if capacity remains and the deadline hasn't passed.",
      },
      {
        name: "Dana & Stripe Payments",
        who: "Members (pay), System (webhook)",
        desc: "Registration confirms first — always. Dana is a separate invitation shown after the 'You're registered!' confirmation. Four modes: none (free, no step), voluntary (suggested amount, fully editable, skippable), base_plus_dana (fixed cost required + voluntary dana on top), fixed (set price). All payments go through Stripe Checkout — no card data ever touches our server.",
        bullets: [
          "none — no dana step shown. Registration is free. Donation status: WAIVED",
          "voluntary — editable amount, skip option ('I'll contribute another time'). Status starts PENDING",
          "base_plus_dana — fixed base cost shown as a line item + voluntary dana input above it",
          "fixed — set price, no dana framing, straightforward payment",
        ],
      },
      {
        name: "Email Notifications (6 Types)",
        who: "Registrants, Registrar",
        desc: "Six automated email types, all sent via Resend. Email failures are logged but never block the registration response.",
        bullets: [
          "Registration confirmation — REGISTERED variant (with spot) or WAITLISTED variant (with position)",
          "Waitlist approval — when registrar promotes a waitlisted person; includes dana section if applicable",
          "Cancellation notification — sent to registrar whenever any registration is cancelled",
          "Edit request — one-time secure link sent to registrant so they can update their responses",
          "Responses updated — notification to registrar when registrant submits the edit form",
          "Program reminder — sent automatically by cron or manually by registrar",
        ],
      },
      {
        name: "Duplicate Prevention",
        who: "System",
        desc: "A registration is a duplicate if the same userId + programId already exists with a non-cancelled status. Cancelled registrants can re-register. The form shows a friendly 'You're already registered' message for duplicates instead of an error.",
      },
      {
        name: "Per-Program Custom Questions",
        who: "Registrar (setup in Sanity)",
        desc: "Each program can define custom questions in Sanity Studio → Registration tab. Four field types: short text, long text, yes/no, dropdown select. Answers are stored as a JSON object, visible in the registrar table, and exportable as CSV columns.",
      },
      {
        name: "Per-Program Confirmation Email Message",
        who: "Registrar (setup in Sanity)",
        desc: "An optional rich-text block in Sanity (Registration tab → Confirmation message) is included in the confirmation email for confirmed (non-waitlisted) registrants. If blank, the standard email sends as normal. Supports bold, italic, links, and bullets — email-safe subset only.",
      },
    ],
  },

  {
    id: "volunteer",
    title: "Volunteer / Registrar Area",
    who: "REGISTRAR, ADMIN",
    intro:
      "The staff area for managing all program registrations. Accessible at /volunteer. Requires REGISTRAR or ADMIN role. All actions use inline confirmation dialogs — nothing destructive happens on a single click.",
    features: [
      {
        name: "Programs Landing (/volunteer)",
        who: "Registrar",
        desc: "Lists all programs with registrationEnabled = true. Shows counts by status: total, registered, waitlisted, approved. Each program links to its full registration table.",
      },
      {
        name: "Registration Table (/volunteer/programs/[slug])",
        who: "Registrar",
        desc: "All registrants in a filterable table. Columns: name, email, phone, status, donation status, registration date. Filter by status: All / Registered / Waitlisted / Approved / Cancelled. Click any row to expand and see custom field answers + internal notes.",
      },
      {
        name: "Status Actions",
        who: "Registrar",
        desc: "Context-aware action buttons per row. All destructive actions require an inline confirmation before proceeding.",
        bullets: [
          "WAITLISTED → Promote: moves to APPROVED, auto-sets donation status, sends approval email",
          "REGISTERED/APPROVED → Cancel: inline confirm, moves to CANCELLED, notifies registrar by email",
          "CANCELLED → Restore: moves back to REGISTERED",
        ],
      },
      {
        name: "Inline Response Editing",
        who: "Registrar",
        desc: "Click 'Edit' next to the Responses column header to edit a registrant's custom field answers directly in the table. Input types render correctly per Sanity field definition: yes/no → dropdown, select → program options, long text → textarea, short text → text input. Saves without page reload; shows 'Saved ✓' flash on success.",
      },
      {
        name: "Internal Notes",
        who: "Registrar",
        desc: "Each registrant has an internal notes field. Notes are visible only in the registrar table — never shown to members. Click any row to expand the panel and see notes alongside custom field answers.",
      },
      {
        name: "Self-Service Edit Link",
        who: "Registrar (sends), Member (uses)",
        desc: "Registrar clicks 'Send Edit Request' → registrant receives a secure email with a unique link → link opens a pre-filled form showing their current answers → they update and submit → registrar receives a notification. Link expires in 7 days; it is invalidated immediately after first use (single-use only).",
      },
      {
        name: "Program Reminder Email",
        who: "Registrar (manual or cron)",
        desc: "Set a reminderDate in Sanity for a program (Registration tab). The daily cron at 14:00 UTC automatically sends reminders to all active registrants on that date. Registrar can also send manually: per-row for a single person, or bulk ('Send to Remaining') for all un-reminded registrants. Double-sends are prevented: reminderSentAt is stamped on first send and both paths check it.",
      },
      {
        name: "Dana Reminder",
        who: "Registrar",
        desc: "For REGISTERED/APPROVED registrants with PENDING donation status, a 'Send Dana Reminder' button sends a gentle nudge email linking to the program page's dana step. The button is only visible on rows where donation status is PENDING.",
      },
      {
        name: "CSV Export",
        who: "Registrar",
        desc: "Download all registrations for a program as a CSV file. Custom field answers appear as columns (auto-detected across all registrations). Available as a direct link in the table header. Useful for attendance lists, mailing, and record-keeping.",
      },
    ],
  },

  {
    id: "dashboard",
    title: "Member Dashboard",
    who: "Members",
    intro:
      "The member area home — a visual hub that shows today's drop-in Zoom sessions, nav cards for all member resources, pending dana reminders, and staff access panels for those with roles.",
    features: [
      {
        name: "Dashboard Hub (/account/dashboard)",
        who: "All members",
        desc: "Five nav cards in a 2-column grid: Today's Sessions (with live count badge), My Programs, My Library, Our Agreements, My Profile. Below the grid: today's Zoom sessions by day of week (Milwaukee/Central timezone), pending dana reminder if applicable, staff panel for REGISTRAR/ADMIN roles.",
      },
      {
        name: "Today's Sessions",
        who: "Members",
        desc: "Programs shown on the dashboard are those scheduled for today's day of the week. Drop-in programs (weekly sitting groups, classes) show their Zoom link as a join button. Programs without a Zoom link are shown but not clickable.",
      },
      {
        name: "Pending Dana Reminder",
        who: "Members",
        desc: "If any of the member's registrations has donationStatus = PENDING (registered but skipped the dana step), a reminder card appears on the dashboard with a link to complete the offering on the program page.",
      },
      {
        name: "My Programs (/account/dashboard-my-registrations)",
        who: "Members",
        desc: "Complete registration history. Active registrations (REGISTERED, APPROVED, WAITLISTED) shown first; past and cancelled below. Each card shows: program name (links to program page), date/time and location from Sanity, status badge, waitlist position if applicable, and a pending dana prompt with a link.",
      },
      {
        name: "My Library (/account/dashboard-my-library)",
        who: "Members",
        desc: "Curated dharma learning resources. Currently shows 4 hardcoded items. Planned rebuild: pull member-accessible courses and resources dynamically from Sanity based on the member's access level and registration history.",
      },
      {
        name: "My Profile (/account/dashboard-my-profile)",
        who: "Members",
        desc: "Update first name, last name, phone number. Email is display-only — it is the login address and can only be changed by an admin. Changes save immediately via a POST to the profile API.",
      },
      {
        name: "Community Agreements (/account/dashboard-member-care-agreements)",
        who: "Members",
        desc: "Static reference page with RIM's four community care agreements. This is for reference only — members agreed to these once on the welcome page or registration form and are not shown them again.",
      },
    ],
  },

  {
    id: "members",
    title: "Member Management",
    who: "ADMIN only",
    intro:
      "The full member management system. ADMIN-only. View and search all members, edit profiles, assign roles, manage course access, archive or delete members, and import from CSV. Protected at both the proxy and server-component level.",
    features: [
      {
        name: "Member List (/admin/members)",
        who: "Admin",
        desc: "Searchable, filterable list of all active members. Search by name or email — instant, client-side, no round-trip. Filter by role: All / Admins / Registrars / Treasurers / No roles. Table shows name, email, role badges, registration count, joined date. Click any row to open member detail.",
      },
      {
        name: "Archived Members Toggle",
        who: "Admin",
        desc: "Archived members are hidden from the default list. When any exist, a 'Show Archived (N)' button appears. Clicking switches the view to show only archived members — visually muted, with an 'Archived' badge in the name cell.",
      },
      {
        name: "Member Detail (/admin/members/[id])",
        who: "Admin",
        desc: "Edit profile fields (name, phone, email), assign/revoke roles via checkboxes with descriptions, view and manage course access, see full registration history with status badges and links to the registrar table. Archived members show a warning banner at the top.",
      },
      {
        name: "Admin Email Change",
        who: "Admin",
        desc: "Admin can update any member's login email from the member detail page. A two-step confirmation is required: type the new email (amber warning appears), then confirm on save. All of that member's active sessions are immediately deleted — they must re-authenticate with the new address.",
      },
      {
        name: "Archive Member",
        who: "Admin",
        desc: "Available for any member with one or more registrations. Sets archivedAt, immediately kills all their active sessions (logged out on next request). Registration history and all records are fully preserved. Member cannot log in until restored. Confirmation dialog is shown before archiving.",
      },
      {
        name: "Restore Member",
        who: "Admin",
        desc: "Clears archivedAt. Member can log in again immediately. Available from the member detail page (Danger Zone) when a member is in the archived state.",
      },
      {
        name: "Delete Member",
        who: "Admin",
        desc: "Available only for members with zero registrations. Permanently deletes the User record and all related data (sessions, accounts, course access, donations). Cannot be undone. The API blocks deletion if any registrations exist — use Archive instead. A confirmation dialog is shown.",
      },
      {
        name: "Course Access Management",
        who: "Admin",
        desc: "On the member detail page, a searchable list of every course shows this member's access status: 'All Members' (any logged-in user), 'Via Registration: [Program]' (active registration for a linked program), 'Manual Grant' (admin-granted), or 'No Access.' Admins can grant or revoke manual access with inline warnings if access already exists via another path.",
      },
      {
        name: "CSV Import",
        who: "Admin",
        desc: "Import members from a CSV file (Memberstack export or compatible format). Columns matched: Email, First Name, Last Name, Phone. Upsert by email — found members have blank fields filled only (existing data never overwritten); new emails create accounts. Preview first 5 rows before committing. Returns: X new · Y updated · Z skipped.",
      },
    ],
  },

  {
    id: "courses",
    title: "Course Access System",
    who: "Members (access), Admin (management)",
    intro:
      "Member-gated course pages listing their lessons. Access is controlled per-course at two levels and can be granted automatically via program registration or manually by an admin. The /course/* path is protected by proxy.ts.",
    features: [
      {
        name: "Access Levels",
        who: "System",
        desc: "Two levels, set per-course in Sanity Studio → Courses → Access Level. 'Members' — any logged-in user can view (default). 'Registration Required' — must have an active (REGISTERED or APPROVED) registration for a program linked to this course, OR an explicit admin grant.",
      },
      {
        name: "Linking Programs to Courses",
        who: "Admin (Sanity Studio)",
        desc: "In Sanity Studio → Programs → [program] → Content tab → Linked Courses. Add one or more courses. Any member with an active registration for that program automatically gets access to all linked courses — no manual grant needed, no DB write at registration time. Checked dynamically at page render. One program can link to many courses; many programs can link to the same course.",
      },
      {
        name: "Manual Admin Grant / Revoke",
        who: "Admin",
        desc: "From the member detail page → Course Access section, grant or revoke individual course access. Inline warnings appear if the grant is redundant (member already has access via another path). All actions (grant/confirm grant/revoke/confirm revoke) happen inline per course without page reload.",
      },
      {
        name: "Access Check Flow",
        who: "System",
        desc: "At page load for registration_required courses: (1) Sanity query finds all programs linked to this course; (2) DB checks if member has an active registration for any of those programs; (3) falls back to checking the manual CourseAccess grant table. Members-level courses skip all checks — any logged-in user is in.",
      },
    ],
  },

  {
    id: "donations",
    title: "Donation Tracking",
    who: "TREASURER, ADMIN (future UI); System (Stripe webhook, live now)",
    intro:
      "A unified record of every financial contribution to RIM. Stripe registration dana is recorded automatically from day one via webhook. A management UI for manual entry, GiveButter import, and QuickBooks export is designed but not yet built.",
    features: [
      {
        name: "Stripe Dana Integration (Live)",
        who: "Members (pay), System (records)",
        desc: "All Stripe payments via the registration dana flow are recorded automatically in the Donation table via webhook. Full metadata: program, registrant, amount, date, Stripe session ID. This happens on every registration dana payment with no additional action needed.",
      },
      {
        name: "Donation Ledger Model (Live in DB)",
        who: "System",
        desc: "The Donation table in Postgres tracks every contribution regardless of source: STRIPE (automatic), GIVEBUTTER (import), CASH, CHECK, or OTHER (manual). Fields include donor name, email, program, amount, date, notes, and source-specific IDs for deduplication.",
      },
      {
        name: "Donation Management UI (Planned — not yet built)",
        who: "TREASURER, ADMIN",
        desc: "A TREASURER-only area planned at /admin/donations. Will include: donor list with giving history, manual donation entry (cash/check), GiveButter CSV import, donation history with date/source/program filters, and QuickBooks CSV export. No migration needed when built — the data is already accumulating.",
      },
    ],
  },

  {
    id: "nav",
    title: "Navigation",
    who: "All users",
    intro:
      "The global sticky navigation bar at the top of every page. Fully custom — no Webflow class dependencies. Adapts based on whether the user is a guest, logged-in member, or admin.",
    features: [
      {
        name: "Public Mode (Guest or Logged-In, Non-Member Area)",
        who: "Visitors, members on public pages",
        desc: "Shows: Programs link · Get Involved dropdown (Volunteer, Start a Community Group) · Member Area dropdown — 'Hi [Name]' if logged in, 'Member Area' for guests. Member dropdown shows Dashboard/Sign Out when logged in, Login/Join Us for guests. Donate pill always visible.",
      },
      {
        name: "Member Area Mode (/account/* and /admin/*)",
        who: "Logged-in members",
        desc: "When navigating member or admin pages, the nav switches to a minimal mode: My Dashboard · Programs · Admin dropdown (admin-only) · Sign Out · Donate. Designed to reduce noise in the member area.",
      },
      {
        name: "Admin Dropdown",
        who: "ADMIN only",
        desc: "Visible only in member area mode for ADMIN users. Contains three links: Members (/admin/members), Site Architecture (/admin/sitemap), Roadmap (/admin/roadmap). Also accessible in the mobile hamburger menu.",
      },
      {
        name: "Mobile Hamburger Menu",
        who: "All users on mobile",
        desc: "3-bar button with animated → X transition. Opens a flat link list (no nested dropdowns on mobile — all links are flat for simplicity and touch usability). Menu closes automatically on route change or Escape key.",
      },
      {
        name: "Sticky Header",
        who: "All users",
        desc: "Nav is position: sticky, stays at the top of the viewport as you scroll. Height is 90px desktop. No border — the warm background color contrast with the page body separates them visually.",
      },
    ],
  },

  {
    id: "admin-tools",
    title: "Site Administration Tools",
    who: "ADMIN",
    intro:
      "Reference and planning tools for site administrators and developers. All three pages are ADMIN-only. Designed to serve both staff (understanding what exists) and developers (understanding what to build next).",
    features: [
      {
        name: "Site Architecture (/admin/sitemap)",
        who: "Admin, Developer",
        desc: "A living reference showing every page on the site — public, member area, admin, staff, utility — organized by section. Each page shows: access badge, CSS layer (🟢 design system or 🟠 Webflow legacy), and status chips (stub, orphan). Also tracks which features are implemented vs. planned per page, and lists pages not yet built. Must be manually updated when new pages are added.",
      },
      {
        name: "Roadmap (/admin/roadmap)",
        who: "Admin, Developer",
        desc: "Comprehensive planned features list. Organized by category: Do First, Member-Facing, Staff & Admin, Content & Structure, Launch & Infrastructure, CSS Migration. Each item has a status badge (immediate / designed / planned / ongoing / infra) and effort estimate (small / medium / large). Items marked 'Fully Designed' reference FEATURES.md and are ready to implement.",
      },
      {
        name: "Staff Manual (/admin/manual)",
        who: "Admin, Staff",
        desc: "This page. Plain-language reference for every module and feature — written for two audiences: staff who use the site, and developers who build it. Collapsible panels for navigation; system notes section open by default.",
      },
    ],
  },
];

// ─── Notes ────────────────────────────────────────────────────────────────────

const PLANNED_NOTES: NoteItem[] = [
  {
    title: "Member Cancellation Self-Service",
    body: "Members cannot yet cancel their own registrations from My Programs. The cancel button and endpoint are fully designed (FEATURES.md §17b). Until built, members must contact the registrar to cancel.",
  },
  {
    title: "Automated Dana Follow-Up Cron",
    body: "No automatic reminder is sent for members who skipped the dana step. The registrar can send a manual dana reminder from the volunteer table. The automated daily cron version is designed (FEATURES.md §17a) but not yet built.",
  },
  {
    title: "Self-Service Email Change",
    body: "Members cannot change their own login email. Only an admin can (member detail → Email field). A self-service email change flow with verification email is fully designed (FEATURES.md §11b) but not yet built.",
  },
  {
    title: "Donation Management UI",
    body: "The Donation model and Stripe webhook are live and recording — every registration dana payment is being captured. The management UI for TREASURER role (donor list, manual entry, GiveButter import, QuickBooks export) is designed (FEATURES.md §13) but not yet built.",
  },
  {
    title: "My Library — Dynamic Rebuild",
    body: "My Library currently shows 4 hardcoded items, one of which still links to the old Webflow site. The rebuild will pull member-accessible courses dynamically from Sanity based on access level and registration history. Design needed before build.",
  },
  {
    title: "TEACHER / VOLUNTEER Role Wiring",
    body: "Both roles are defined, assignable, and appear in checkboxes on member detail pages. They do not yet unlock any area of the site. TEACHER could unlock a teacher portal; VOLUNTEER could unlock a volunteer coordination area. Design required before build.",
  },
  {
    title: "Neon DB Password Rotation (Pre-Launch)",
    body: "The database password has been in use throughout development and should be rotated before going live. Rotate in the Neon dashboard → update POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING in Vercel env vars.",
  },
  {
    title: "DNS Cutover",
    body: "The site currently lives at rim-next.vercel.app. Before launch: point rootedinmindfulness.org to the Vercel project, update NEXTAUTH_URL in Vercel, update the Stripe webhook endpoint URL in the Stripe Dashboard.",
  },
  {
    title: "Memberstack Decommission",
    body: "Memberstack is the old member platform (~1,462 members). Strategy: no bulk import — real members surface naturally through program registration or direct login. When enough members have migrated organically, export the CSV backup and cancel the Memberstack subscription.",
  },
];

const MINDFULNESS_NOTES: NoteItem[] = [
  {
    title: "One Email = One Identity",
    body: "An email address is the permanent identifier for a community member. Name and phone fields in registration forms are locked and cannot overwrite an existing member's stored data — account values always win. This protects members from data corruption. Never bypass this rule.",
  },
  {
    title: "Registration Data Lives in Sanity, Not the DB",
    body: "Program dates, times, and locations are stored in Sanity CMS — not in Postgres. The Registration table stores only programId and programSlug. When My Programs or the dashboard needs dates, it fetches from Sanity at render time by slug. Sanity = source of truth for programs. Postgres = source of truth for registrations.",
  },
  {
    title: "Archive vs. Delete",
    body: "A member with any registration history should never be deleted — use Archive instead. Archiving preserves all records and simply prevents login. Deleting is permanent and cascades to all related records. The API enforces this: DELETE returns 409 Conflict if registrations exist.",
  },
  {
    title: "Email Failures Never Block Registration",
    body: "All confirmation, approval, reminder, and notification emails are fire-and-forget. If an email fails (Resend error, misconfigured env var, etc.), the registration or status update still succeeds. Errors are logged in Vercel but never shown to the user and never abort the process.",
  },
  {
    title: "Community Philosophy is a Feature",
    body: "Features like the agreements checkpoint, the welcoming archive/reactivation flow, the 'Join or sign in' login framing, and dana as an invitation (not a gate) are deliberate philosophical choices — not defaults. Before adding features that touch how members join, leave, or pay, read FEATURES.md §14.",
  },
  {
    title: "Real Names Are Required",
    body: "First and last name are required at registration and on the welcome page. Anonymous participation is not compatible with how this community works. There is no path to membership without a real name. Do not add a 'username' or 'display name' bypass.",
  },
  {
    title: "RSC Serialization — Never Spread Prisma Results",
    body: "Never pass a spread Prisma 'include' result (...user) as Client Component props. Prisma returns all model fields including Date objects, which fail React 19 RSC serialization silently — the page freezes with no visible error. Always construct props explicitly, naming only needed fields, converting dates to ISO strings.",
  },
  {
    title: "The Cron Secret",
    body: "Both cron routes (send-reminders, cleanup-incomplete-accounts) require the CRON_SECRET env var. Vercel passes it automatically as a Bearer header when the cron fires. Without it, the routes return 401. If a cron silently stops working, check this secret first.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminManualPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAdmin = session.user.roles?.some((r) => r === "ADMIN");
  if (!isAdmin) {
    return (
      <div className="adm-page">
        <div className="adm-content">
          <p className="adm-unauthorized">
            You don&rsquo;t have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="adm-page">
      <div className="adm-content adm-sm-content">

        {/* ── Header ── */}
        <div className="adm-sm-header">
          <div className="adm-sm-header__left">
            <h1 className="adm-sm-title">Staff Manual</h1>
            <p className="adm-sm-subtitle">
              Complete reference for every module and feature.{" "}
              <strong>{MODULES.length} modules</strong> ·{" "}
              <strong>{MODULES.reduce((n, m) => n + m.features.length, 0)} features</strong>.
              Click any section to expand it.
            </p>
          </div>
          <div className="adm-sm-header__links">
            <Link href="/admin/roadmap" className="adm-sm-ext-link">Roadmap →</Link>
            <Link href="/admin/sitemap" className="adm-sm-ext-link">Site Architecture →</Link>
          </div>
        </div>

        {/* ── System Notes (open by default) ── */}
        <details className="adm-man-section adm-man-section--notes" open>
          <summary className="adm-man-summary">
            <div className="adm-man-summary__inner">
              <span className="adm-man-summary__title">System Notes</span>
              <span className="adm-man-summary__count">
                Planned development &amp; things to be mindful of
              </span>
              <span className="adm-man-summary__caret" aria-hidden="true">▾</span>
            </div>
          </summary>
          <div className="adm-man-section__body">
            <div className="adm-man-notes-grid">
              <div className="adm-man-notes-col">
                <h3 className="adm-man-notes__heading">🚧 Planned Development</h3>
                <p className="adm-man-notes__sub">
                  Features that are designed and scoped but not yet built.
                  Items marked &ldquo;Fully Designed&rdquo; in the Roadmap are ready to implement.
                </p>
                {PLANNED_NOTES.map((note) => (
                  <div key={note.title} className="adm-man-note">
                    <div className="adm-man-note__title">{note.title}</div>
                    <p className="adm-man-note__body">{note.body}</p>
                  </div>
                ))}
              </div>
              <div className="adm-man-notes-col">
                <h3 className="adm-man-notes__heading">🧭 System Mindfulness</h3>
                <p className="adm-man-notes__sub">
                  Patterns, constraints, and philosophical choices that shape how the system works.
                  Read these before changing anything foundational.
                </p>
                {MINDFULNESS_NOTES.map((note) => (
                  <div key={note.title} className="adm-man-note adm-man-note--mind">
                    <div className="adm-man-note__title">{note.title}</div>
                    <p className="adm-man-note__body">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>

        {/* ── Module Sections ── */}
        {MODULES.map((mod) => (
          <details key={mod.id} className="adm-man-section">
            <summary className="adm-man-summary">
              <div className="adm-man-summary__inner">
                <span className="adm-man-summary__title">{mod.title}</span>
                <span className="adm-man-summary__who">{mod.who}</span>
                <span className="adm-man-summary__count">
                  {mod.features.length} feature{mod.features.length !== 1 ? "s" : ""}
                </span>
                <span className="adm-man-summary__caret" aria-hidden="true">▾</span>
              </div>
            </summary>
            <div className="adm-man-section__body">
              <p className="adm-man-intro">{mod.intro}</p>
              <div className="adm-man-features">
                {mod.features.map((feat) => (
                  <div key={feat.name} className="adm-man-feature">
                    <div className="adm-man-feature__header">
                      <span className="adm-man-feature__name">{feat.name}</span>
                      {feat.who && (
                        <span className="adm-man-feature__who">{feat.who}</span>
                      )}
                    </div>
                    <p className="adm-man-feature__desc">{feat.desc}</p>
                    {feat.bullets && feat.bullets.length > 0 && (
                      <ul className="adm-man-feature__bullets">
                        {feat.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))}

        {/* ── Footer ── */}
        <div className="adm-sm-footer-note">
          <strong>Keeping this up to date:</strong> Update this manual (and FEATURES.md) at the end of any session where new features are added or existing ones change.
          The authoritative technical reference — implementation details, API signatures, gotchas — lives in <strong>FEATURES.md</strong> at the project root.
          This manual is the plain-language version for staff and future developers.
        </div>

      </div>
    </div>
  );
}
