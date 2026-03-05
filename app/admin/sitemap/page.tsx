import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Site Architecture — Admin" };

// ─── Types ──────────────────────────────────────────────────────────────────

type BadgeType = "public" | "cms" | "member" | "admin" | "staff" | "utility" | "dev";
type CssLayer  = "green" | "orange" | "new";
type PageStatus = "active" | "stub" | "orphan" | "repurposed";

interface PageEntry {
  name: string;
  url: string;
  desc: string;
  badge: BadgeType;
  css?: CssLayer;
  status?: PageStatus;
  note?: string;
  features?: string[];   // ✅ implemented
  planned?: string[];    // 🔲 planned / not yet built
}

interface SectionDef {
  id: string;
  title: string;
  desc: string;
  color: string;
  pages: PageEntry[];
  wide?: boolean;
}

// ─── Site Data ───────────────────────────────────────────────────────────────

const SECTIONS: SectionDef[] = [
  {
    id: "public",
    title: "Public Marketing",
    desc: "Visible to anyone — no login required.",
    color: "#3a7a6a",
    pages: [
      {
        name: "Home",
        url: "/",
        badge: "public",
        css: "orange",
        desc: "Hero video, community intro, programs preview, donate and join CTAs.",
        features: ["Hero video", "Programs preview card", "Donate + Join CTAs"],
      },
      {
        name: "Programs Listing",
        url: "/community-programs",
        badge: "public",
        css: "orange",
        desc: "All programs grouped by category. Drop-ins and registration-based programs.",
        features: ["Programs grouped by category", "Links to program detail pages"],
      },
      {
        name: "Community Agreements",
        url: "/community-membership",
        badge: "public",
        css: "orange",
        status: "repurposed",
        note: "was: Memberstack signup form",
        desc: 'Full 4-point community care agreements + "Join or sign in →" button. No longer a signup form.',
        features: ['Full 4-point community care agreements', '"Join or sign in →" CTA'],
      },
      {
        name: "Diversity & Inclusion",
        url: "/diversity",
        badge: "public",
        css: "orange",
        desc: "Statement of welcome and inclusive community intent.",
        features: ["Statement of welcome and inclusion"],
      },
      {
        name: "Donate",
        url: "/donate",
        badge: "public",
        css: "orange",
        desc: "GiveButter-powered donation page with RIM Dana and Teacher Dana widgets.",
        features: ["RIM Dana widget (GiveButter)", "Teacher Dana widget (GiveButter)"],
        planned: ["Replace with native Stripe donation page", "Import GiveButter history into Donation ledger"],
      },
    ],
  },

  {
    id: "cms",
    title: "CMS-Powered Templates (Sanity)",
    desc: "Dynamic routes — each generates many pages from Sanity content. Manage content in Sanity Studio; the template handles display.",
    color: "var(--rim-blue)",
    wide: true,
    pages: [
      {
        name: "Program Detail",
        url: "/programs/[slug]",
        badge: "cms",
        css: "green",
        note: "e.g. /programs/tuesday-drop-in",
        desc: "Hero, floating details card, registration form, Zoom link (members). Dana/payment step if configured.",
        features: [
          "Hero + floating details card",
          "Registration form with email recognition + field locking",
          "Capacity limits and automatic waitlist",
          "Custom per-program questions (configured in Sanity)",
          "Community agreements inline for non-members",
          "Dana / Stripe payment step post-registration",
          "Zoom link shown to logged-in members",
          "dana=success / dana=cancelled result banners",
        ],
        planned: ["Surface drop-in Zoom link on program page for members (not just dashboard)"],
      },
      {
        name: "Dharma Lesson",
        url: "/lessons/[slug]",
        badge: "cms",
        css: "green",
        note: "🟢 lp- prefix",
        desc: "Audio player, video embed, rich PortableText — pull quotes, verse quotes, callout blocks, practice suggestions.",
        features: [
          "Audio player",
          "Video embed",
          "Rich PortableText: pull quotes, verse quotes, callout blocks, practice suggestions",
        ],
      },
      {
        name: "Course Page",
        url: "/course/[slug]",
        badge: "member",
        css: "orange",
        note: "singular /course/ — not /courses/",
        desc: '"members" = all logged-in. "registration_required" = registered for linked program or manual grant.',
        features: [
          "Member access gating (members / registration_required modes)",
          "Auto-access via active registration for a linked program",
          "Manual access grants by admin (CourseAccess DB table)",
          "Lessons listed as clickable cards; section titles as non-linked dividers",
        ],
      },
      {
        name: "Magazine Article",
        url: "/magazine-articles/[slug]",
        badge: "member",
        css: "orange",
        desc: "Long-form article. Shows 'Join or sign in →' wall to logged-out visitors.",
        features: ["Login wall for logged-out visitors"],
      },
      {
        name: "Glossary Term",
        url: "/glossary/[slug]",
        badge: "public",
        css: "orange",
        desc: "Definition for a Dharma term with Pali and Sanskrit names.",
        features: ["Definition with Pali and Sanskrit names"],
      },
      {
        name: "Teacher / Staff Bio",
        url: "/team/[slug]",
        badge: "public",
        css: "orange",
        desc: "Name, title, photo, and bio from Sanity.",
        features: ["Name, title, photo, bio from Sanity"],
      },
      {
        name: "Volunteer Role",
        url: "/volunteer-positions/[slug]",
        badge: "public",
        css: "orange",
        desc: "Description of an open volunteer position, with current volunteers listed.",
        features: ["Role description + current volunteers listed"],
        planned: ["Interest form API endpoint (currently no backend — submissions go nowhere)"],
      },
    ],
  },

  {
    id: "registration",
    title: "Program Registration",
    desc: "Handles the registration flow for programs.",
    color: "#00695c",
    pages: [
      {
        name: "Standalone Registration Form",
        url: "/programs/[slug]/register",
        badge: "public",
        css: "orange",
        desc: "Focused registration page — no nav. Open to all. Non-members see agreements checkbox inline.",
        features: [
          "Email recognition — pre-fills name/phone on blur for known accounts",
          "Field locking for recognized accounts (readOnly — edit via My Profile)",
          "Capacity limits and waitlist",
          "Custom per-program questions",
          "Community agreements checkbox for non-members",
          "Dana / Stripe payment step after confirmation",
          "Registration closed / deadline handling",
        ],
      },
    ],
  },

  {
    id: "auth",
    title: "Authentication & Onboarding",
    desc: "The login and account-creation flow. Magic link only — no passwords.",
    color: "#b06800",
    pages: [
      {
        name: "Join or Sign In",
        url: "/login",
        badge: "public",
        css: "orange",
        desc: 'Enter email → magic link. Handles both new and returning users. "New? You\'ll set up your name after your first sign-in."',
        features: [
          "Magic link via Resend (no password required)",
          '"Join or sign in" framing — works for new and returning members',
          "Brief explanation of magic link for new visitors",
        ],
      },
      {
        name: "Check Your Email",
        url: "/login/check-email",
        badge: "utility",
        css: "orange",
        desc: "Confirmation screen after magic link is sent. 'Check your spam' fallback.",
        features: ["Confirmation screen + spam folder tip"],
      },
      {
        name: "Auth Error",
        url: "/login/error",
        badge: "utility",
        css: "orange",
        desc: "Shown when a magic link has expired or is invalid.",
        features: ["Expired / invalid magic link handling"],
      },
      {
        name: "Community Welcome",
        url: "/account/welcome",
        badge: "member",
        css: "new",
        note: "🟢 wl- prefix · first-time only",
        desc: "Required on first login. Name (required), phone (optional), agreements checkbox. Declining deletes account and signs out.",
        features: [
          "Name (required) + phone (optional) collection",
          "Community agreements checkbox",
          'Explicit decline path — deletes account and signs out immediately',
          "Daily cleanup cron removes abandoned incomplete accounts (48h)",
        ],
      },
    ],
  },

  {
    id: "member",
    title: "Member Area",
    desc: "Login required. Proxy redirects to /login if not authenticated, or /account/welcome if agreedToTerms = false.",
    color: "var(--rim-mid)",
    pages: [
      {
        name: "Dashboard",
        url: "/account/dashboard",
        badge: "member",
        css: "orange",
        desc: "Today's Zoom links for drop-in sessions. Role-based staff cards for ADMIN and REGISTRAR.",
        features: [
          "5 nav cards (Today's Sessions, My Programs, My Library, Our Agreements, My Profile)",
          "Today's drop-in Zoom links (Milwaukee/CT timezone-aware)",
          "Pending dana reminder card for waitlist-promoted members",
          "Staff access panel (ADMIN + REGISTRAR) — invisible to regular members",
        ],
      },
      {
        name: "My Programs",
        url: "/account/dashboard-my-registrations",
        badge: "member",
        css: "new",
        note: "🟢 mr- prefix",
        desc: "Full registration history with status badges, waitlist position, and pending dana prompts.",
        features: [
          "Complete registration history (active + past / cancelled)",
          "Status badges: Registered, Approved, Waitlisted, Cancelled",
          "Waitlist position display",
          "Pending dana prompt with link to complete the offering",
        ],
        planned: ["Cancel registration self-service — cancel button + confirm on each active card"],
      },
      {
        name: "My Library",
        url: "/account/dashboard-my-library",
        badge: "member",
        css: "orange",
        status: "stub",
        note: "hardcoded — one link goes to old Webflow site",
        desc: "Placeholder list of courses and resources. Not driven by Sanity/DB. Has 'work in progress' copy. Needs a proper rebuild.",
        features: ["Static curated list layout (ml- design system)"],
        planned: ["Dynamic rebuild — pull member-accessible courses and resources from Sanity based on access level and registration history"],
      },
      {
        name: "My Profile",
        url: "/account/dashboard-my-profile",
        badge: "member",
        css: "orange",
        desc: "Update name and phone. Email is fixed (it's the magic link identifier).",
        features: [
          "Update name and phone",
          "Email shown as read-only (magic link auth identifier)",
        ],
        planned: ["Self-service email change with verification email to new address (spec in FEATURES.md §11b)"],
      },
      {
        name: "Care Agreements Reference",
        url: "/account/dashboard-member-care-agreements",
        badge: "member",
        css: "orange",
        desc: "Full 4-point community care agreements. Readable anytime from the member nav.",
        features: ["Full 4-point agreements readable anytime from the nav"],
      },
      {
        name: "Reactivate Account",
        url: "/account/reactivate",
        badge: "member",
        css: "new",
        note: "🟢 wl- prefix · archived members only",
        desc: "Self-service reactivation for archived members. Magic link → this page → clears archivedAt → dashboard.",
        features: [
          "Warm welcome-back page for archived members",
          '"Reactivate" button clears archivedAt in one click',
          "Redirects to dashboard on success",
          "Proxy loop guard prevents infinite redirect",
          "Auto-restore also fires when archived member registers for a program",
        ],
      },
    ],
  },

  {
    id: "admin",
    title: "Admin",
    desc: "ADMIN role required. Links appear in member nav for admins.",
    color: "var(--rim-blue)",
    pages: [
      {
        name: "Site Architecture",
        url: "/admin/sitemap",
        badge: "admin",
        css: "new",
        note: "← you are here",
        desc: "Visual reference of every page on the site, organized by function.",
        features: [
          "All pages organized into sections",
          "Access badges, CSS layer, and status chips",
          "Implemented features + planned features per page",
          '"Not Yet Built" section for planned-but-missing work',
        ],
      },
      {
        name: "Member List",
        url: "/admin/members",
        badge: "admin",
        css: "new",
        note: "🟢 adm- prefix",
        desc: "Search and filter all community members. Import via CSV. Click a row to open member detail.",
        features: [
          "Search by name or email (client-side, fast)",
          "Role filter (All / Admins / Registrars / Treasurers / No roles)",
          "Archived toggle — muted rows + Archived badge; hidden by default",
          "CSV import from Memberstack (upsert by email, fills blank fields only, never overwrites)",
        ],
      },
      {
        name: "Member Detail",
        url: "/admin/members/[id]",
        badge: "admin",
        css: "new",
        desc: "Edit profile, assign roles (ADMIN/REGISTRAR), manage course access, view registration history.",
        features: [
          "Edit name, phone; admin email change (two-step confirm, force re-auth)",
          "Assign / revoke roles via checkboxes",
          "Course access — searchable list with status badges (All Members / Via Registration / Manual Grant / No Access)",
          "Archive (immediate session kill) / restore / delete (zero-registration guard)",
          "Archived member banner",
          "Full registration history with status badges",
        ],
        planned: ["Donation history view for this member"],
      },
    ],
  },

  {
    id: "staff",
    title: "Volunteer / Registrar Area",
    desc: "Login required. Typically used by staff with REGISTRAR role.",
    color: "#5a4a8a",
    pages: [
      {
        name: "Registrar Program List",
        url: "/volunteer",
        badge: "staff",
        css: "orange",
        desc: "Lists all programs with registration enabled. Click a program to open its management table.",
        features: [
          "Lists all registration-enabled programs (Sanity)",
          "Registration counts by status (total, registered, waitlisted, approved)",
        ],
      },
      {
        name: "Registration Management Table",
        url: "/volunteer/programs/[slug]",
        badge: "staff",
        css: "orange",
        note: "vol- CSS prefix",
        desc: "Full registrant list for a program. Inline edit, send edit requests, approve/waitlist/cancel, send reminders.",
        features: [
          "Full registrant list with status filter",
          "Promote, cancel, restore actions with inline confirmation dialogs",
          "Inline custom field editing (correct input type per field: text, textarea, dropdown)",
          "Send edit request — token-gated single-use link for registrant self-service",
          "Program reminder email — manual per-row, bulk 'Send to Remaining', daily cron",
          "Dana reminder email — manual per-row nudge for PENDING donation registrants",
          "CSV export with all custom field columns dynamically included",
          "Mobile card layout",
        ],
        planned: ["Automated daily dana follow-up cron (PENDING donations ≥24h old, not yet nudged)"],
      },
      {
        name: "Volunteer Opportunities",
        url: "/volunteerism/volunteer",
        badge: "public",
        css: "orange",
        note: "⚠️ interest form has no backend",
        desc: "Public page listing open volunteer positions. Interest form (login required) has no API endpoint — form submits go nowhere.",
        features: ["Public listing of open volunteer positions"],
        planned: ["Interest form API endpoint — store submission, fire notification, redirect to thank-you"],
      },
      {
        name: "Volunteer Thank You",
        url: "/volunteerism/volunteer-thanks-for-your-interest",
        badge: "utility",
        css: "orange",
        status: "orphan",
        note: "no route leads here currently",
        desc: "Thank-you page after volunteer interest form. Currently unreachable — the form has no action URL and no redirect configured.",
      },
    ],
  },

  {
    id: "kalyana",
    title: "Kalyana Mitta — Community Groups",
    desc: 'Kalyana Mitta = "spiritual friendship." Member-led community groups.',
    color: "#7a5a3a",
    pages: [
      {
        name: "Groups & Events Overview",
        url: "/kalyana-mitta/community-groups-events",
        badge: "public",
        css: "orange",
        desc: "Overview of community groups and how to get involved.",
        features: ["Overview content + how to get involved"],
      },
      {
        name: "Starting a Group — Guidelines",
        url: "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group",
        badge: "public",
        css: "orange",
        desc: "Step-by-step guidelines for starting a new community group.",
        features: ["Step-by-step guidelines for starting a group"],
      },
      {
        name: "Group Application",
        url: "/kalyana-mitta/kalyana-mitta-group-application",
        badge: "member",
        css: "orange",
        desc: "Application form for starting a Kalyana Mitta group. Login required to submit.",
        features: ["Login-required application form"],
        planned: ["Group management page for approved group leaders (see Not Yet Built)"],
      },
    ],
  },

  {
    id: "utility",
    title: "Self-Service & Utility",
    desc: "Functional pages accessed via email link or direct URL — not in any nav.",
    color: "#666",
    pages: [
      {
        name: "Edit My Registration",
        url: "/update/[token]",
        badge: "utility",
        css: "new",
        note: "token-gated · no login needed",
        desc: "Registrant updates their custom field answers without logging in. Link sent via 'Send Edit Request' in registrar table.",
        features: [
          "Token-gated — no login required",
          "Pre-filled with current custom field answers",
          "Single-use token (invalidated immediately on submit)",
          "Notifies registrar by email on submit",
        ],
      },
    ],
  },

  {
    id: "dev",
    title: "Developer / Internal",
    desc: "Not linked in any nav. For development reference only.",
    color: "#b05000",
    pages: [
      {
        name: "Style Guide",
        url: "/style-guide",
        badge: "dev",
        css: "orange",
        desc: "Component kitchen sink: MemberGate, DanaSection, TeacherList, ListRow, SeriesListItem.",
        features: ["Component kitchen sink"],
      },
    ],
  },
];

// ─── Transition / Gap data ────────────────────────────────────────────────────

const NOT_YET_BUILT = [
  {
    name: "My Programs — Cancel Registration",
    url: "/api/account/registrations/[id]/cancel (missing)",
    desc: "Allow members to cancel their own registration from the My Programs page. Needs a cancel button + confirm UX on mr-card, plus a new PATCH endpoint that validates the registration belongs to the current user and fires a cancellation notification to the registrar.",
  },
  {
    name: "Automated Dana Follow-Up Email Cron",
    url: "/api/cron/send-dana-nudges (missing)",
    desc: "Daily cron that gently nudges registrants whose donationStatus is PENDING (registered ≥24h ago, not already nudged). Needs danaNudgeSentAt DateTime? on Registration + new cron route + sendDanaNudgeEmail() + vercel.json entry. Manual 'Send Dana Reminder' button already exists in the registrar table.",
  },
  {
    name: "Self-Service Email Change",
    url: "/api/account/request-email-change + /api/account/confirm-email-change (missing)",
    desc: "Allow members to update their own login email from My Profile. Requires a verification email to the new address before any change is made. Needs 3 new User fields (pendingEmail, emailChangeToken, emailChangeExpiresAt), 2 new API routes, an email template, and My Profile UI. Full spec in FEATURES.md §11b.",
  },
  {
    name: "Donation Management System",
    url: "/admin/donations (missing)",
    desc: "Admin area for viewing all donations, entering manual cash/check donations, importing GiveButter history, and exporting to QuickBooks. The Donation DB model and Stripe webhook writing are already live — only the UI needs to be built. Full spec in FEATURES.md §13.",
  },
  {
    name: "Kalyana Mitta Group Detail Form",
    url: "/kalyana-mitta/kalyana-mitta-group-detail-form",
    desc: "Would let approved group leaders manage their group details. Not yet built.",
  },
  {
    name: "Access Denied / 401 Page",
    url: "e.g. /access-denied",
    desc: "No unauthorized-access error page exists. Users who fail role checks currently get an inline 'no permission' message with no graceful redirect.",
  },
  {
    name: "Volunteer Interest Form — API Endpoint",
    url: "/api/volunteer-interest (missing)",
    desc: "The form on /volunteerism/volunteer has no working backend. Needs an API route that stores the submission and redirects to the thank-you page.",
  },
  {
    name: "My Library — Dynamic Version",
    url: "/account/dashboard-my-library (needs rebuild)",
    desc: "Current page is hardcoded and links to the old Webflow site. Should pull member-accessible courses and resources from Sanity based on access level and registration history.",
  },
];


// ─── Badge + CSS config ───────────────────────────────────────────────────────

const BADGES: Record<BadgeType, { label: string; cls: string; legendDesc: string }> = {
  public:  { label: "Public",  cls: "adm-sm-badge--public",  legendDesc: "Anyone can visit" },
  cms:     { label: "CMS",     cls: "adm-sm-badge--cms",     legendDesc: "Template — content in Sanity Studio" },
  member:  { label: "Member",  cls: "adm-sm-badge--member",  legendDesc: "Login required" },
  admin:   { label: "Admin",   cls: "adm-sm-badge--admin",   legendDesc: "ADMIN role required" },
  staff:   { label: "Staff",   cls: "adm-sm-badge--staff",   legendDesc: "Login required — registrar/staff" },
  utility: { label: "Utility", cls: "adm-sm-badge--utility", legendDesc: "Functional — not in nav" },
  dev:     { label: "Dev",     cls: "adm-sm-badge--dev",     legendDesc: "Development reference only" },
};

const CSS_LAYERS: Record<CssLayer, { label: string; cls: string }> = {
  green:  { label: "🟢 Design System", cls: "adm-sm-css--green" },
  orange: { label: "🟠 Webflow",       cls: "adm-sm-css--orange" },
  new:    { label: "🟢 New",           cls: "adm-sm-css--green" },
};

const STATUS_LABELS: Record<PageStatus, { label: string; cls: string }> = {
  active:     { label: "",             cls: "" },
  stub:       { label: "⚠️ Stub",      cls: "adm-sm-status--stub" },
  orphan:     { label: "⚠️ Orphan",    cls: "adm-sm-status--orphan" },
  repurposed: { label: "↩ Repurposed", cls: "adm-sm-status--repurposed" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminSitemapPage() {
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

  const totalPages = SECTIONS.reduce((sum, s) => sum + s.pages.length, 0);

  return (
    <div className="adm-page">
      <div className="adm-content adm-sm-content">

        {/* ── Header ── */}
        <div className="adm-sm-header">
          <div className="adm-sm-header__left">
            <Link href="/admin/members" className="adm-back">← Members</Link>
            <h1 className="adm-sm-title">Site Architecture</h1>
            <p className="adm-sm-subtitle">
              Every page on the site, organized by function.{" "}
              <strong>{totalPages} pages</strong> across{" "}
              <strong>{SECTIONS.length} sections</strong>.
              Includes stubs, orphans, and what was left behind from Webflow.
            </p>
          </div>
          <div className="adm-sm-header__links">
            <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer" className="adm-sm-ext-link">
              Sanity Studio ↗
            </a>
            <a href="https://rim-next.vercel.app" target="_blank" rel="noopener noreferrer" className="adm-sm-ext-link">
              Live Site ↗
            </a>
            <Link href="/admin/roadmap" className="adm-sm-ext-link">
              Roadmap →
            </Link>
            <Link href="/admin/manual" className="adm-sm-ext-link">
              Manual →
            </Link>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="adm-sm-legend">
          <span className="adm-sm-legend__label">Access:</span>
          {(Object.entries(BADGES) as [BadgeType, typeof BADGES[BadgeType]][]).map(([key, b]) => (
            <div key={key} className="adm-sm-legend__item">
              <span className={`adm-sm-badge ${b.cls}`}>{b.label}</span>
              <span className="adm-sm-legend__desc">{b.legendDesc}</span>
            </div>
          ))}
          <div className="adm-sm-legend__divider" />
          <span className="adm-sm-legend__label">CSS:</span>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-css adm-sm-css--green">🟢 Design System</span>
            <span className="adm-sm-legend__desc">No Webflow dependency</span>
          </div>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-css adm-sm-css--orange">🟠 Webflow</span>
            <span className="adm-sm-legend__desc">Still uses Webflow CSS classes</span>
          </div>
          <div className="adm-sm-legend__divider" />
          <span className="adm-sm-legend__label">Status:</span>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-status adm-sm-status--stub">⚠️ Stub</span>
            <span className="adm-sm-legend__desc">Exists but incomplete or hardcoded</span>
          </div>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-status adm-sm-status--orphan">⚠️ Orphan</span>
            <span className="adm-sm-legend__desc">May not be reachable in current build</span>
          </div>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-status adm-sm-status--repurposed">↩ Repurposed</span>
            <span className="adm-sm-legend__desc">Was something else; function changed</span>
          </div>
          <div className="adm-sm-legend__divider" />
          <span className="adm-sm-legend__label">Features:</span>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-feat-dot adm-sm-feat-dot--done" />
            <span className="adm-sm-legend__desc">Implemented</span>
          </div>
          <div className="adm-sm-legend__item">
            <span className="adm-sm-feat-dot adm-sm-feat-dot--planned" />
            <span className="adm-sm-legend__desc">Planned / not yet built</span>
          </div>
        </div>

        {/* ── Active sections grid ── */}
        <div className="adm-sm-grid">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              className={`adm-sm-section${section.wide ? " adm-sm-section--wide" : ""}`}
              style={{ "--section-color": section.color } as React.CSSProperties}
            >
              <div className="adm-sm-section__head">
                <h2 className="adm-sm-section__title">{section.title}</h2>
                <p className="adm-sm-section__desc">{section.desc}</p>
              </div>

              <div className="adm-sm-pages">
                {section.pages.map((pg) => {
                  const badge = BADGES[pg.badge];
                  const isTemplate = pg.url.includes("[");
                  const statusInfo = pg.status ? STATUS_LABELS[pg.status] : null;
                  const cssInfo = pg.css ? CSS_LAYERS[pg.css] : null;
                  return (
                    <div
                      key={pg.url}
                      className={`adm-sm-page${pg.status && pg.status !== "active" ? " adm-sm-page--flagged" : ""}`}
                    >
                      <div className="adm-sm-page__top">
                        <span className={`adm-sm-badge ${badge.cls}`}>{badge.label}</span>
                        {cssInfo && (
                          <span className={`adm-sm-css ${cssInfo.cls}`}>{cssInfo.label}</span>
                        )}
                        {statusInfo && statusInfo.label && (
                          <span className={`adm-sm-status ${statusInfo.cls}`}>{statusInfo.label}</span>
                        )}
                        <span className="adm-sm-page__name">{pg.name}</span>
                        {pg.note && <span className="adm-sm-page__note">{pg.note}</span>}
                      </div>
                      <div className="adm-sm-page__bottom">
                        {isTemplate ? (
                          <span className="adm-sm-page__url adm-sm-page__url--template">{pg.url}</span>
                        ) : (
                          <a href={pg.url} target="_blank" rel="noopener noreferrer" className="adm-sm-page__url">
                            {pg.url} ↗
                          </a>
                        )}
                        <p className="adm-sm-page__desc">{pg.desc}</p>

                        {/* ── Feature lists ── */}
                        {(pg.features?.length || pg.planned?.length) ? (
                          <div className="adm-sm-feature-block">
                            {pg.features?.map((f) => (
                              <div key={f} className="adm-sm-feat adm-sm-feat--done">{f}</div>
                            ))}
                            {pg.planned?.map((p) => (
                              <div key={p} className="adm-sm-feat adm-sm-feat--planned">{p}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Not Yet Built ── */}
        <div className="adm-sm-gap-section">
          <div className="adm-sm-gap-section__head adm-sm-gap-section__head--todo">
            <h2 className="adm-sm-gap-section__title">⚠️ Not Yet Built</h2>
            <p className="adm-sm-gap-section__desc">
              Features and pages that are planned or needed but don&apos;t exist yet in rim-next.
            </p>
          </div>
          <div className="adm-sm-gap-list">
            {NOT_YET_BUILT.map((item) => (
              <div key={item.url} className="adm-sm-gap-item">
                <div className="adm-sm-gap-item__name">{item.name}</div>
                <code className="adm-sm-gap-item__url">{item.url}</code>
                <p className="adm-sm-gap-item__desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="adm-sm-footer-note">
          <strong>CSS migration goal:</strong> Migrate all 🟠 Webflow pages to 🟢 Design System, then
          remove <code>normalize.css</code>, <code>webflow.css</code>, and <code>rim.webflow.css</code>{" "}
          from <code>app/layout.tsx</code>. Currently 🟢:{" "}
          <code>/lessons/[slug]</code> · <code>/programs/[slug]</code> ·{" "}
          <code>/account/welcome</code> · <code>/account/reactivate</code> ·{" "}
          <code>/account/dashboard*</code> · <code>/admin/*</code> · <code>/update/[token]</code>
          <br /><br />
          <strong>Sanity CMS types:</strong>{" "}
          programs · lessons · courses · magazineArticles ·
          glossaryTerms · team · volunteerPositions · programCategories ·
          richContent (shared block schema)
        </div>

      </div>
    </div>
  );
}
