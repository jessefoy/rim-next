import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Site Architecture — Admin" };

// ─── Types ──────────────────────────────────────────────────────────────────

type BadgeType = "public" | "cms" | "member" | "admin" | "staff" | "utility" | "dev";

interface PageEntry {
  name: string;
  url: string;
  desc: string;
  badge: BadgeType;
  note?: string; // optional secondary note (e.g. "🟢 design system" or "many pages")
}

interface SectionDef {
  id: string;
  title: string;
  desc: string;
  color: string; // CSS custom property or hex for section accent
  pages: PageEntry[];
  wide?: boolean; // span full width on desktop grid
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
        desc: "Hero video, community intro, programs preview, donate and join CTAs.",
      },
      {
        name: "Programs Listing",
        url: "/community-programs",
        badge: "public",
        desc: "All programs grouped by category. Drop-ins and registration-based programs.",
      },
      {
        name: "Community Agreements",
        url: "/community-membership",
        badge: "public",
        desc: 'Full 4-point community care agreements with a "Join or sign in →" button. Not a signup form.',
      },
      {
        name: "Diversity & Inclusion",
        url: "/diversity",
        badge: "public",
        desc: "Statement of welcome and inclusive community intent.",
      },
      {
        name: "Donate",
        url: "/donate",
        badge: "public",
        desc: "GiveButter-powered donation page.",
      },
    ],
  },

  {
    id: "cms",
    title: "CMS-Powered Templates (Sanity)",
    desc: "Dynamic routes — each generates many individual pages automatically from Sanity content. Edit content in Sanity Studio; the page template handles display.",
    color: "var(--rim-blue)",
    wide: true,
    pages: [
      {
        name: "Program Detail",
        url: "/programs/[slug]",
        badge: "cms",
        note: "many pages — e.g. /programs/tuesday-drop-in",
        desc: "Hero, floating details card, registration form, and (for logged-in members) Zoom link. Dana/payment step if configured.",
      },
      {
        name: "Dharma Lesson",
        url: "/lessons/[slug]",
        badge: "cms",
        note: "🟢 design system · lp- prefix",
        desc: "Audio player, video embed, rich PortableText body with pull quotes, verse quotes, callout blocks, and practice suggestions.",
      },
      {
        name: "Class Recording",
        url: "/class-recording/[slug]",
        badge: "cms",
        note: "🟢 design system · cr- prefix",
        desc: "Audio/video recording with description. Same rich content blocks as lessons.",
      },
      {
        name: "Course Page",
        url: "/course/[slug]",
        badge: "member",
        note: "singular /course/ — not /courses/",
        desc: 'Gated by access level. "members" = all logged-in users. "registration_required" = must be registered for the linked program or have a manual grant.',
      },
      {
        name: "Magazine Article",
        url: "/magazine-articles/[slug]",
        badge: "member",
        desc: "Long-form article or blog post. Shows a join wall to logged-out visitors.",
      },
      {
        name: "Glossary Term",
        url: "/glossary/[slug]",
        badge: "public",
        desc: "Definition for a Dharma term with Pali and Sanskrit names.",
      },
      {
        name: "Teacher / Staff Bio",
        url: "/team/[slug]",
        badge: "public",
        desc: "Name, title, photo, and bio for a teacher or staff member.",
      },
      {
        name: "Volunteer Role",
        url: "/volunteer-positions/[slug]",
        badge: "public",
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
        desc: "Focused registration experience — no nav or footer. Open to all; no login required. Non-members see the agreements checkbox inline.",
      },
    ],
  },

  {
    id: "auth",
    title: "Authentication & Onboarding",
    desc: "The login and account-creation flow. Magic link — no passwords.",
    color: "#b06800",
    pages: [
      {
        name: "Join or Sign In",
        url: "/login",
        badge: "public",
        desc: 'Enter email → receive magic link. Handles both new and returning users. "New to RIM? You\'ll set up your name after your first sign-in."',
      },
      {
        name: "Check Your Email",
        url: "/login/check-email",
        badge: "utility",
        desc: "Confirmation screen shown after the magic link is sent.",
      },
      {
        name: "Auth Error",
        url: "/login/error",
        badge: "utility",
        desc: "Shown when a magic link has expired or is invalid.",
      },
      {
        name: "Community Welcome",
        url: "/account/welcome",
        badge: "member",
        note: "wl- CSS prefix · first-time only",
        desc: "Required threshold page on first login. Collects name (required), phone (optional), and community agreements checkbox. Declining deletes the account.",
      },
    ],
  },

  {
    id: "member",
    title: "Member Area",
    desc: "Login required. Redirects to /login if not authenticated. On first login, always passes through /account/welcome.",
    color: "var(--rim-mid)",
    pages: [
      {
        name: "Dashboard",
        url: "/account/dashboard",
        badge: "member",
        desc: "Today's Zoom links for drop-in sessions. Staff roles show additional cards (e.g. registrar, teacher links).",
      },
      {
        name: "My Library",
        url: "/account/dashboard-my-library",
        badge: "member",
        desc: "Courses, recordings, and resources the member has access to.",
      },
      {
        name: "My Profile",
        url: "/account/dashboard-my-profile",
        badge: "member",
        desc: "Update name and phone number. Email is fixed (used for magic link).",
      },
      {
        name: "Care Agreements Reference",
        url: "/account/dashboard-member-care-agreements",
        badge: "member",
        desc: "Full 4-point community care agreements, readable any time from the member nav.",
      },
    ],
  },

  {
    id: "admin",
    title: "Admin",
    desc: "ADMIN role required. Accessible via Member Area nav when logged in as admin.",
    color: "var(--rim-blue)",
    pages: [
      {
        name: "Site Architecture",
        url: "/admin/sitemap",
        badge: "admin",
        note: "← you are here",
        desc: "Visual reference of every page on the site, organized by function.",
      },
      {
        name: "Member List",
        url: "/admin/members",
        badge: "admin",
        note: "adm- CSS prefix",
        desc: "Search and filter all community members. Import via CSV. Click a row to view member detail.",
      },
      {
        name: "Member Detail",
        url: "/admin/members/[id]",
        badge: "admin",
        desc: "Edit profile, assign roles (ADMIN / REGISTRAR / TREASURER / TEACHER / VOLUNTEER), manage course access, and view registration history.",
      },
    ],
  },

  {
    id: "staff",
    title: "Volunteer / Registrar Area",
    desc: "Login required. Typically used by staff with the REGISTRAR role, but accessible to any logged-in user.",
    color: "#5a4a8a",
    pages: [
      {
        name: "Registrar Program List",
        url: "/volunteer",
        badge: "staff",
        desc: "Lists all programs with registration enabled. Click a program to open its registration table.",
      },
      {
        name: "Registration Management Table",
        url: "/volunteer/programs/[slug]",
        badge: "staff",
        note: "vol- CSS prefix",
        desc: "Full registrant list for a program. Inline edit, send edit requests, approve/waitlist/cancel, send reminders, bulk reminder.",
      },
      {
        name: "Volunteer Opportunities",
        url: "/volunteerism/volunteer",
        badge: "public",
        desc: "Public page listing open volunteer positions and a volunteer interest form (login required to submit).",
      },
      {
        name: "Volunteer Thank You",
        url: "/volunteerism/volunteer-thanks-for-your-interest",
        badge: "utility",
        desc: "Confirmation page shown after volunteer interest form is submitted.",
      },
    ],
  },

  {
    id: "kalyana",
    title: "Kalyana Mitta — Community Groups",
    desc: "Kalyana Mitta means 'spiritual friendship.' These pages support member-led community groups.",
    color: "#7a5a3a",
    pages: [
      {
        name: "Groups & Events Overview",
        url: "/kalyana-mitta/community-groups-events",
        badge: "public",
        desc: "Overview of community groups and how to get involved.",
      },
      {
        name: "Starting a Group — Guidelines",
        url: "/kalyana-mitta/guidelines-for-starting-a-kalyana-mitta-group",
        badge: "public",
        desc: "Step-by-step guidelines for starting a new community group.",
      },
      {
        name: "Group Application",
        url: "/kalyana-mitta/kalyana-mitta-group-application",
        badge: "member",
        desc: "Application form for starting a Kalyana Mitta group. Login required to submit.",
      },
    ],
  },

  {
    id: "utility",
    title: "Self-Service & Utility",
    desc: "Functional pages that aren't in the nav — accessed via email links or direct URL.",
    color: "#666",
    pages: [
      {
        name: "Edit My Registration",
        url: "/update/[token]",
        badge: "utility",
        note: "token-gated · no login needed",
        desc: "Lets a registrant update their custom field answers without logging in. Link sent via 'Send Edit Request' in the registrar table.",
      },
    ],
  },

  {
    id: "dev",
    title: "Developer / Internal",
    desc: "Not in any nav. For development reference only.",
    color: "#b05000",
    pages: [
      {
        name: "Style Guide",
        url: "/style-guide",
        badge: "dev",
        desc: "Component kitchen sink: MemberGate, DanaSection, TeacherList, ListRow, SeriesListItem. Visual reference for existing UI patterns.",
      },
    ],
  },
];

// ─── Badge config ─────────────────────────────────────────────────────────────

const BADGES: Record<BadgeType, { label: string; cls: string; legendDesc: string }> = {
  public:  { label: "Public",    cls: "adm-sm-badge--public",  legendDesc: "Anyone can visit — no login needed" },
  cms:     { label: "CMS",       cls: "adm-sm-badge--cms",     legendDesc: "Dynamic template — content managed in Sanity Studio" },
  member:  { label: "Member",    cls: "adm-sm-badge--member",  legendDesc: "Login required" },
  admin:   { label: "Admin",     cls: "adm-sm-badge--admin",   legendDesc: "ADMIN role required" },
  staff:   { label: "Staff",     cls: "adm-sm-badge--staff",   legendDesc: "Login required — registrar/staff area" },
  utility: { label: "Utility",   cls: "adm-sm-badge--utility", legendDesc: "Functional page — not in site navigation" },
  dev:     { label: "Dev",       cls: "adm-sm-badge--dev",     legendDesc: "Development reference only" },
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
          <span className="adm-sm-legend__label">Page types:</span>
          {(Object.entries(BADGES) as [BadgeType, typeof BADGES[BadgeType]][]).map(([key, b]) => (
            <div key={key} className="adm-sm-legend__item">
              <span className={`adm-sm-badge ${b.cls}`}>{b.label}</span>
              <span className="adm-sm-legend__desc">{b.legendDesc}</span>
            </div>
          ))}
        </div>

        {/* ── Sections grid ── */}
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
                  const isExternal = pg.url.includes("[");
                  return (
                    <div key={pg.url} className="adm-sm-page">
                      <div className="adm-sm-page__top">
                        <span className={`adm-sm-badge ${badge.cls}`}>{badge.label}</span>
                        <span className="adm-sm-page__name">{pg.name}</span>
                        {pg.note && (
                          <span className="adm-sm-page__note">{pg.note}</span>
                        )}
                      </div>
                      <div className="adm-sm-page__bottom">
                        {isExternal ? (
                          <span className="adm-sm-page__url adm-sm-page__url--template">{pg.url}</span>
                        ) : (
                          <a
                            href={pg.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="adm-sm-page__url"
                          >
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

        {/* ── Footer note ── */}
        <div className="adm-sm-footer-note">
          <strong>Sanity CMS types:</strong> programs · lessons · classRecordings · courses ·
          magazineArticles · glossaryTerms · team · volunteerPositions ·
          programCategories · richContent (shared block schema)
        </div>

      </div>
    </div>
  );
}
