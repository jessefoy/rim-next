import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata = { title: "Roadmap — Admin" };

// ─── Types ──────────────────────────────────────────────────────────────────

type Effort  = "small" | "medium" | "large";
type RStatus = "immediate" | "designed" | "planned" | "ongoing" | "infra";

interface RoadmapItem {
  name: string;
  desc: string;
  effort: Effort;
  status: RStatus;
  ref?: string;        // FEATURES.md / MEMORY.md reference
  files?: string[];    // new files / changes needed
}

interface RoadmapSection {
  id: string;
  title: string;
  desc: string;
  color: string;
  items: RoadmapItem[];
}

// ─── Effort / Status config ───────────────────────────────────────────────────

const EFFORT: Record<Effort, { label: string; cls: string }> = {
  small:  { label: "Small",  cls: "adm-rm-effort--small"  },
  medium: { label: "Medium", cls: "adm-rm-effort--medium" },
  large:  { label: "Large",  cls: "adm-rm-effort--large"  },
};

const STATUS: Record<RStatus, { label: string; cls: string }> = {
  immediate: { label: "⚡ Do first",     cls: "adm-rm-status--immediate" },
  designed:  { label: "✏️ Fully designed", cls: "adm-rm-status--designed"  },
  planned:   { label: "📋 Planned",       cls: "adm-rm-status--planned"   },
  ongoing:   { label: "🔄 Ongoing",       cls: "adm-rm-status--ongoing"   },
  infra:     { label: "🔧 Infra",         cls: "adm-rm-status--infra"     },
};

// ─── Roadmap Data ─────────────────────────────────────────────────────────────

const SECTIONS: RoadmapSection[] = [
  {
    id: "immediate",
    title: "Do First",
    desc: "Blocking or near-blocking items — needed before real-world use or for end-to-end verification.",
    color: "#c0392b",
    items: [
      {
        name: "Community Onboarding — End-to-End Verification",
        effort: "small",
        status: "immediate",
        ref: "FEATURES.md §14 · MEMORY.md Next Steps #6",
        desc: "The onboarding system is built but needs to be verified end-to-end with a clean account. Delete the jesse@rootedinmindfulness.org test account (zero registrations — use the Member Detail danger zone), then walk through the full flow: magic link → /account/welcome → dashboard. Also verify the registration form agreements path.",
        files: ["No code changes — admin action only"],
      },
      {
        name: "Rotate Neon DB Password",
        effort: "small",
        status: "immediate",
        ref: "MEMORY.md",
        desc: "The current database password has been in use throughout development. Rotate it in the Neon dashboard and update POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING in Vercel before go-live. This is a one-time infra step.",
        files: ["Neon dashboard → reset password", "Vercel → update env vars"],
      },
    ],
  },

  {
    id: "member",
    title: "Member-Facing Features",
    desc: "Features that members will directly experience in the member area or on program pages.",
    color: "var(--rim-mid)",
    items: [
      {
        name: "Cancel Registration (My Programs)",
        effort: "medium",
        status: "designed",
        ref: "FEATURES.md §17b",
        desc: "Allow members to cancel their own registration from the My Programs page. Cancel button + inline confirmation on each active mr-card. On confirm: sets status to CANCELLED and fires cancellation notification email to the registrar. Validates that the registration belongs to the current user.",
        files: [
          "app/api/account/registrations/[id]/cancel/route.ts — new PATCH",
          "app/account/dashboard-my-registrations/page.tsx — cancel button on mr-card",
        ],
      },
      {
        name: "Self-Service Email Change",
        effort: "medium",
        status: "designed",
        ref: "FEATURES.md §11b / §17c",
        desc: "Allow members to update their own login email from My Profile. Full verification flow: member enters new email → receives a confirmation link → clicks it → email updates, all sessions killed, must re-login with new address. Prevents account takeover: verification must come from the new address.",
        files: [
          "prisma/schema.prisma — add pendingEmail, emailChangeToken, emailChangeExpiresAt to User",
          "app/api/account/request-email-change/route.ts — new POST",
          "app/api/account/confirm-email-change/route.ts — new GET",
          "lib/email.ts — sendEmailChangeVerificationEmail()",
          "app/account/dashboard-my-profile/page.tsx — UI",
        ],
      },
      {
        name: "Animated Program Hero (pg-hero botanical drift)",
        effort: "small",
        status: "planned",
        ref: "MEMORY.md · pg-hero prompt saved",
        desc: "CSS + SVG animated botanical elements drifting subtly in the program page hero (pg-hero). Prefers-reduced-motion must be respected — animation is purely decorative. Design prompt is saved; paste it into a new session to implement.",
        files: [
          "public/css/custom.css — pg-hero animation + SVG keyframes",
          "app/programs/[slug]/page.tsx — add SVG elements to hero",
        ],
      },
      {
        name: "Drop-In Zoom Link on Program Pages",
        effort: "small",
        status: "planned",
        ref: "FEATURES.md §14",
        desc: "For programs that are drop-in (weekly sitting groups, classes), surface the Zoom link directly on the program detail page for logged-in members — not just on the dashboard. Consistent UX: member should be able to join from wherever they land.",
        files: [
          "app/programs/[slug]/page.tsx — show Zoom link section for logged-in members",
        ],
      },
    ],
  },

  {
    id: "staff",
    title: "Staff & Admin Tools",
    desc: "Features for staff (registrar, admin, treasurer) to manage registrations, donations, and member records.",
    color: "#5a4a8a",
    items: [
      {
        name: "Automated Dana Follow-Up Cron",
        effort: "small",
        status: "designed",
        ref: "FEATURES.md §17a",
        desc: "Daily cron that sends a gentle follow-up email to registrants whose donationStatus is PENDING (registered ≥24h ago, not already nudged). Same pattern as the existing send-reminders cron. Manual 'Send Dana Reminder' already exists in the registrar table — this just automates it.",
        files: [
          "prisma/schema.prisma — add danaNudgeSentAt DateTime? to Registration",
          "app/api/cron/send-dana-nudges/route.ts — new cron GET",
          "lib/email.ts — sendDanaNudgeEmail()",
          "vercel.json — add cron entry",
        ],
      },
      {
        name: "Donation Management System",
        effort: "large",
        status: "designed",
        ref: "FEATURES.md §13",
        desc: "TREASURER-only area for viewing all donations across all sources (Stripe, GiveButter, cash, check), entering manual donations, importing GiveButter history, and exporting to QuickBooks. The Donation DB model and Stripe webhook writing are already live — only the UI needs to be built. No migration needed.",
        files: [
          "app/admin/donations/page.tsx — donor list + search",
          "app/admin/donations/new/page.tsx — manual entry form",
          "app/api/admin/donations/route.ts — GET (list) + POST (manual entry)",
          "app/api/admin/donations/import/route.ts — GiveButter CSV import",
        ],
      },
      {
        name: "TEACHER / VOLUNTEER Role Wiring",
        effort: "medium",
        status: "planned",
        ref: "FEATURES.md §2",
        desc: "Both roles are defined in the Prisma Role enum and can be assigned via the admin Member Detail page. Neither role currently unlocks anything. TEACHER could unlock a teacher portal (lesson uploads, program links, bios). VOLUNTEER could unlock a volunteer coordination area. Needs design before build.",
        files: ["No files yet — design required"],
      },
      {
        name: "Volunteer Interest Form — API Endpoint",
        effort: "small",
        status: "planned",
        ref: "FEATURES.md §15 · Sitemap Not Yet Built",
        desc: "The form on /volunteerism/volunteer currently has no backend — submissions go nowhere. Needs an API route to store the submission (or email it to staff) and redirect to the thank-you page.",
        files: [
          "app/api/volunteer-interest/route.ts — new POST",
          "/volunteerism/volunteer — wire form action",
        ],
      },
    ],
  },

  {
    id: "content",
    title: "Content & Structure",
    desc: "Pages and features that need to be built or rebuilt. Content currently hardcoded, orphaned, or missing.",
    color: "#7a5a3a",
    items: [
      {
        name: "My Library — Dynamic Rebuild",
        effort: "medium",
        status: "planned",
        ref: "FEATURES.md §6d · Sitemap Not Yet Built",
        desc: "Current My Library page is hardcoded (4 items) and one link still goes to the old Webflow site. Should pull member-accessible courses and resources from Sanity based on the member's access level (all members vs. registration_required) and registration history.",
        files: [
          "app/account/dashboard-my-library/page.tsx — rewrite as dynamic",
          "lib/queries.ts — GROQ query for member-accessible courses",
        ],
      },
      {
        name: "Kalyana Mitta Group Detail Form",
        effort: "medium",
        status: "planned",
        ref: "Sitemap Not Yet Built",
        desc: "Allows approved group leaders to manage their group details after approval. Currently the application form exists but there is no management interface for approved groups.",
        files: [
          "/kalyana-mitta/kalyana-mitta-group-detail-form — new page",
          "API endpoint for group detail management",
        ],
      },
      {
        name: "Access Denied / 401 Page",
        effort: "small",
        status: "planned",
        ref: "Sitemap Not Yet Built",
        desc: "No graceful unauthorized-access error page exists. Users who fail role checks currently get an inline message only. A dedicated /access-denied page would improve clarity and allow proper redirect flows.",
        files: ["app/access-denied/page.tsx — new page"],
      },
    ],
  },

  {
    id: "launch",
    title: "Launch & Infrastructure",
    desc: "One-time infra steps required before or shortly after switching the real domain to rim-next.",
    color: "#4a4a4a",
    items: [
      {
        name: "Set course accessLevel in Sanity",
        effort: "small",
        status: "infra",
        ref: "MEMORY.md Next Steps #12",
        desc: "Any course that should require a program registration to access needs accessLevel = 'registration_required' set manually in Sanity Studio → Courses → [course] → Access Level. Currently only essential-dharma-study-resources is explicitly set. Other courses default to 'members' (open to all logged-in users).",
        files: ["Sanity Studio → Courses → [each course] → Access Level"],
      },
      {
        name: "DNS Cutover",
        effort: "small",
        status: "infra",
        ref: "MEMORY.md Next Steps #14",
        desc: "Point rootedinmindfulness.org to the rim-next Vercel project. Add the domain in Vercel, update DNS records in GoDaddy, verify SSL. Update NEXTAUTH_URL env var to the real domain. Update Stripe webhook endpoint URL in the Stripe Dashboard. Update Resend sending domain email if needed.",
        files: [
          "Vercel → Add domain: rootedinmindfulness.org",
          "GoDaddy → update A/CNAME records",
          "Vercel → update NEXTAUTH_URL",
          "Stripe Dashboard → update webhook endpoint URL",
        ],
      },
      {
        name: "Decommission Memberstack",
        effort: "small",
        status: "infra",
        ref: "MEMORY.md Next Steps #15",
        desc: "After real members have naturally migrated through participation (registered for programs, logged in via magic link), Memberstack can be cancelled. No bulk import needed — organic migration is the strategy. Export the final Memberstack member list as a CSV backup before cancelling.",
        files: ["Memberstack dashboard — export CSV backup → cancel subscription"],
      },
    ],
  },

  {
    id: "css",
    title: "CSS Migration (Ongoing)",
    desc: "Goal: migrate all 🟠 Webflow pages to 🟢 design system, then remove normalize.css, webflow.css, and rim.webflow.css from app/layout.tsx.",
    color: "#b06800",
    items: [
      {
        name: "Homepage",
        effort: "large",
        status: "ongoing",
        desc: "Hero video, intro text, programs preview, CTA buttons. Heaviest Webflow dependency — many nested Webflow layout classes. Recommend doing this last, after all other pages are migrated.",
        files: ["app/page.tsx — full rewrite with home- prefix"],
      },
      {
        name: "Programs Listing",
        effort: "medium",
        status: "ongoing",
        desc: "Programs grouped by category. Remove Webflow grid/layout classes. Migrate to design-system layout with pl- prefix.",
        files: ["app/community-programs/page.tsx"],
      },
      {
        name: "Course Page",
        effort: "medium",
        status: "ongoing",
        desc: "Currently uses Webflow classes from the original course page (course-header, f-container-regular, etc.). Kept as-is intentionally — was a pre-existing page. Migrate to co- prefix.",
        files: ["app/course/[slug]/page.tsx"],
      },
      {
        name: "Magazine Article, Glossary, Team Bio, Volunteer Role",
        effort: "medium",
        status: "ongoing",
        desc: "Four CMS-template pages that still use Webflow classes. Can be migrated together since they share the same reading-column lp- utilities.",
        files: [
          "app/magazine-articles/[slug]/page.tsx",
          "app/glossary/[slug]/page.tsx",
          "app/team/[slug]/page.tsx",
          "app/volunteer-positions/[slug]/page.tsx",
        ],
      },
      {
        name: "Login, Auth Error, Check Email",
        effort: "small",
        status: "ongoing",
        desc: "Authentication flow pages. Simple layouts — mostly a centered form or message. Low Webflow dependency.",
        files: [
          "app/login/page.tsx",
          "app/login/error/page.tsx",
          "app/login/check-email/page.tsx",
        ],
      },
      {
        name: "Registrar + Volunteer Pages",
        effort: "medium",
        status: "ongoing",
        desc: "vol- CSS prefix already in use for the table. The outer page wrappers and program list still use some Webflow classes.",
        files: [
          "app/volunteer/page.tsx",
          "app/volunteer/programs/[slug]/page.tsx",
        ],
      },
      {
        name: "Public Marketing (Community Agreements, Diversity, Donate, Kalyana Mitta)",
        effort: "large",
        status: "ongoing",
        desc: "A collection of mostly-static pages with deep Webflow structural markup. Lower priority than member-area and functional pages.",
        files: [
          "app/community-membership/page.tsx",
          "app/diversity/page.tsx",
          "app/donate/page.tsx",
          "app/kalyana-mitta/*/page.tsx",
        ],
      },
    ],
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AdminRoadmapPage() {
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

  const totalItems = SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

  return (
    <div className="adm-page">
      <div className="adm-content adm-sm-content">

        {/* ── Header ── */}
        <div className="adm-sm-header">
          <div className="adm-sm-header__left">
            <Link href="/admin/sitemap" className="adm-back">← Site Architecture</Link>
            <h1 className="adm-sm-title">Roadmap</h1>
            <p className="adm-sm-subtitle">
              Everything planned but not yet built.{" "}
              <strong>{totalItems} items</strong> across{" "}
              <strong>{SECTIONS.length} categories</strong>.
              Fully designed items have detailed specs in FEATURES.md.
            </p>
          </div>
          <div className="adm-sm-header__links">
            <a href="https://github.com/jessefoy/rim-next" target="_blank" rel="noopener noreferrer" className="adm-sm-ext-link">
              GitHub ↗
            </a>
            <Link href="/admin/sitemap" className="adm-sm-ext-link">
              Site Architecture →
            </Link>
            <Link href="/admin/manual" className="adm-sm-ext-link">
              Manual →
            </Link>
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="adm-sm-legend">
          <span className="adm-sm-legend__label">Status:</span>
          {(Object.entries(STATUS) as [RStatus, typeof STATUS[RStatus]][]).map(([key, s]) => (
            <div key={key} className="adm-sm-legend__item">
              <span className={`adm-rm-status ${s.cls}`}>{s.label}</span>
            </div>
          ))}
          <div className="adm-sm-legend__divider" />
          <span className="adm-sm-legend__label">Effort:</span>
          {(Object.entries(EFFORT) as [Effort, typeof EFFORT[Effort]][]).map(([key, e]) => (
            <div key={key} className="adm-sm-legend__item">
              <span className={`adm-rm-effort ${e.cls}`}>{e.label}</span>
            </div>
          ))}
        </div>

        {/* ── Sections ── */}
        {SECTIONS.map((section) => (
          <div
            key={section.id}
            className="adm-rm-section"
            style={{ "--section-color": section.color } as React.CSSProperties}
          >
            <div className="adm-rm-section__head">
              <h2 className="adm-rm-section__title">{section.title}</h2>
              <p className="adm-rm-section__desc">{section.desc}</p>
            </div>

            <div className="adm-rm-items">
              {section.items.map((item) => {
                const effortInfo = EFFORT[item.effort];
                const statusInfo = STATUS[item.status];
                return (
                  <div key={item.name} className="adm-rm-item">
                    <div className="adm-rm-item__top">
                      <span className={`adm-rm-status ${statusInfo.cls}`}>{statusInfo.label}</span>
                      <span className={`adm-rm-effort ${effortInfo.cls}`}>{effortInfo.label}</span>
                      <span className="adm-rm-item__name">{item.name}</span>
                    </div>

                    <p className="adm-rm-item__desc">{item.desc}</p>

                    {item.ref && (
                      <p className="adm-rm-item__ref">📖 {item.ref}</p>
                    )}

                    {item.files && item.files.length > 0 && (
                      <ul className="adm-rm-item__files">
                        {item.files.map((f) => (
                          <li key={f}><code>{f}</code></li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ── Footer ── */}
        <div className="adm-sm-footer-note">
          <strong>How to use this page:</strong> Items marked ✏️ Fully designed have complete specs in FEATURES.md — ready to implement without additional planning.
          Items marked 📋 Planned are scoped but details need to be worked out in a session.
          Items marked 🔧 Infra are not code changes — they are configuration or admin tasks.
          <br /><br />
          <strong>Effort guide:</strong> Small = a few hours (new endpoint or page with clear spec). Medium = a day (multi-file feature). Large = multiple sessions (full subsystem).
        </div>

      </div>
    </div>
  );
}
