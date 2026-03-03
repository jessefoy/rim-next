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
      },
      {
        name: "Programs Listing",
        url: "/community-programs",
        badge: "public",
        css: "orange",
        desc: "All programs grouped by category. Drop-ins and registration-based programs.",
      },
      {
        name: "Community Agreements",
        url: "/community-membership",
        badge: "public",
        css: "orange",
        status: "repurposed",
        note: "was: Memberstack signup form",
        desc: 'Full 4-point community care agreements + "Join or sign in →" button. No longer a signup form.',
      },
      {
        name: "Diversity & Inclusion",
        url: "/diversity",
        badge: "public",
        css: "orange",
        desc: "Statement of welcome and inclusive community intent.",
      },
      {
        name: "Donate",
        url: "/donate",
        badge: "public",
        css: "orange",
        desc: "GiveButter-powered donation page with RIM Dana and Teacher Dana widgets.",
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
      },
      {
        name: "Dharma Lesson",
        url: "/lessons/[slug]",
        badge: "cms",
        css: "green",
        note: "🟢 lp- prefix",
        desc: "Audio player, video embed, rich PortableText — pull quotes, verse quotes, callout blocks, practice suggestions.",
      },
      {
        name: "Course Page",
        url: "/course/[slug]",
        badge: "member",
        css: "orange",
        note: "singular /course/ — not /courses/",
        desc: '"members" = all logged-in. "registration_required" = registered for linked program or manual grant.',
      },
      {
        name: "Magazine Article",
        url: "/magazine-articles/[slug]",
        badge: "member",
        css: "orange",
        desc: "Long-form article. Shows 'Join or sign in →' wall to logged-out visitors.",
      },
      {
        name: "Glossary Term",
        url: "/glossary/[slug]",
        badge: "public",
        css: "orange",
        desc: "Definition for a Dharma term with Pali and Sanskrit names.",
      },
      {
        name: "Teacher / Staff Bio",
        url: "/team/[slug]",
        badge: "public",
        css: "orange",
        desc: "Name, title, photo, and bio from Sanity.",
      },
      {
        name: "Volunteer Role",
        url: "/volunteer-positions/[slug]",
        badge: "public",
        css: "orange",
        desc: "Description of an open volunteer position, with current volunteers listed.",
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
      },
      {
        name: "Check Your Email",
        url: "/login/check-email",
        badge: "utility",
        css: "orange",
        desc: "Confirmation screen after magic link is sent. 'Check your spam' fallback.",
      },
      {
        name: "Auth Error",
        url: "/login/error",
        badge: "utility",
        css: "orange",
        desc: "Shown when a magic link has expired or is invalid.",
      },
      {
        name: "Community Welcome",
        url: "/account/welcome",
        badge: "member",
        css: "new",
        note: "🟢 wl- prefix · first-time only",
        desc: "Required on first login. Name (required), phone (optional), agreements checkbox. Declining deletes account and signs out.",
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
        desc: "Today's Zoom links for drop-in sessions. Role-based staff cards for ADMIN, REGISTRAR, TEACHER.",
      },
      {
        name: "My Library",
        url: "/account/dashboard-my-library",
        badge: "member",
        css: "orange",
        status: "stub",
        note: "hardcoded — one link goes to old Webflow site",
        desc: "Placeholder list of courses and resources. Not driven by Sanity/DB. Has 'work in progress' copy. Needs a proper rebuild.",
      },
      {
        name: "My Profile",
        url: "/account/dashboard-my-profile",
        badge: "member",
        css: "orange",
        desc: "Update name and phone. Email is fixed (it's the magic link identifier).",
      },
      {
        name: "Care Agreements Reference",
        url: "/account/dashboard-member-care-agreements",
        badge: "member",
        css: "orange",
        desc: "Full 4-point community care agreements. Readable anytime from the member nav.",
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
      },
      {
        name: "Member List",
        url: "/admin/members",
        badge: "admin",
        css: "new",
        note: "🟢 adm- prefix",
        desc: "Search and filter all community members. Import via CSV. Click a row to open member detail.",
      },
      {
        name: "Member Detail",
        url: "/admin/members/[id]",
        badge: "admin",
        css: "new",
        desc: "Edit profile, assign roles (ADMIN/REGISTRAR/TREASURER/TEACHER/VOLUNTEER), manage course access, view registration history.",
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
      },
      {
        name: "Registration Management Table",
        url: "/volunteer/programs/[slug]",
        badge: "staff",
        css: "orange",
        note: "vol- CSS prefix",
        desc: "Full registrant list for a program. Inline edit, send edit requests, approve/waitlist/cancel, send reminders.",
      },
      {
        name: "Volunteer Opportunities",
        url: "/volunteerism/volunteer",
        badge: "public",
        css: "orange",
        note: "⚠️ interest form has no backend",
        desc: "Public page listing open volunteer positions. Interest form (login required) has no API endpoint — form submits go nowhere.",
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
      },
      {
        name: "Starting a Group — Guidelines",
        url: "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group",
        badge: "public",
        css: "orange",
        desc: "Step-by-step guidelines for starting a new community group.",
      },
      {
        name: "Group Application",
        url: "/kalyana-mitta/kalyana-mitta-group-application",
        badge: "member",
        css: "orange",
        desc: "Application form for starting a Kalyana Mitta group. Login required to submit.",
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
      },
    ],
  },
];

// ─── Transition / Gap data ────────────────────────────────────────────────────

const NOT_YET_BUILT = [
  {
    name: "Kalyana Mitta Group Detail Form",
    url: "/kalyana-mitta/kalyana-mitta-group-detail-form",
    desc: "Tracked in pages-inventory.md as ⚠️ not built. Would let group leaders manage their group details once approved.",
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
          <code>/account/welcome</code> ·{" "}
          <code>/admin/*</code> · <code>/update/[token]</code>
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
