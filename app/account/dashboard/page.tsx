import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { dashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "My Dashboard — Rooted In Mindfulness" };

// No caching — always show fresh program data
export const dynamic = "force-dynamic";

interface DashboardProgram {
  _id: string;
  name: string;
  sortOrder?: number;
  dayOfWeek?: { name: string }[];
  dayFiltering?: string;
  listingDayAndTimeText?: string;
  zoomLink?: string;
  dashboardSpecialAnnouncement?: string;
  dashboardEarlyArrivalMessage?: string;
}

function getMilwaukeeDay(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
  }).format(new Date());
}

function programIsToday(program: DashboardProgram, today: string): boolean {
  if (program.dayFiltering) {
    return program.dayFiltering
      .split(",")
      .map((d) => d.trim())
      .includes(today);
  }
  if (program.dayOfWeek && program.dayOfWeek.length > 0) {
    return program.dayOfWeek.some((d) => d.name === today);
  }
  return false;
}

// Role → human label + destination
const STAFF_LINKS: Record<string, { label: string; href: string; description: string; external?: boolean }[]> = {
  REGISTRAR: [
    { label: "Registrations", href: "/volunteer", description: "View and manage program registrations" },
    { label: "Members", href: "/admin/members", description: "Look up and edit member profiles" },
    { label: "Sanity Studio", href: "https://rooted-in-mindfulness.sanity.studio/", description: "Edit site content and programs", external: true },
  ],
  ADMIN: [
    { label: "Registrations", href: "/volunteer", description: "View and manage program registrations" },
    { label: "Members", href: "/admin/members", description: "Manage members and assign permissions" },
    { label: "Sanity Studio", href: "https://rooted-in-mindfulness.sanity.studio/", description: "Edit site content and programs", external: true },
  ],
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [allPrograms, pendingDanaRegistrations] = await Promise.all([
    sanityClient.fetch<DashboardProgram[]>(dashboardProgramsQuery),
    session.user?.id
      ? db.registration.findMany({
          where: { userId: session.user.id, donationStatus: "PENDING" },
          select: { id: true, programTitle: true, programSlug: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const today = getMilwaukeeDay();
  const todaysPrograms = allPrograms.filter((p) => programIsToday(p, today));
  const todayCount = todaysPrograms.length;

  const firstName = session.user?.name?.split(" ")[0] ?? session.user?.email?.split("@")[0] ?? "there";

  const roles: string[] = session.user.roles ?? [];
  const allLinks = roles.flatMap((r) => STAFF_LINKS[r] ?? []);
  const staffLinks = Object.values(Object.fromEntries(allLinks.map((l) => [l.href, l])));

  return (
    <div className="page-wrapper">
      <div className="db-page">

        {/* ── Welcome ── */}
        <div className="db-welcome">
          <h1 className="db-welcome__greeting">Welcome back, {firstName}.</h1>
          <p className="db-welcome__sub">Your member area — sessions, programs, and practice resources.</p>
        </div>

        {/* ── Nav card grid ── */}
        <div className="db-nav">
          <Link href="#today" className="db-nav__card">
            <p className="db-nav__label">
              Member Area
              {todayCount > 0 ? (
                <span className="db-nav__badge">{todayCount} today</span>
              ) : (
                <span className="db-nav__badge db-nav__badge--empty">Nothing today</span>
              )}
            </p>
            <p className="db-nav__title">Today&apos;s Sessions</p>
            <p className="db-nav__desc">Join today&apos;s drop-in Zoom programs</p>
          </Link>

          <Link href="/account/dashboard-my-registrations" className="db-nav__card">
            <p className="db-nav__label">Member Area</p>
            <p className="db-nav__title">My Programs</p>
            <p className="db-nav__desc">Your registered programs and history</p>
          </Link>

          <Link href="/account/dashboard-my-library" className="db-nav__card">
            <p className="db-nav__label">Practice Resources</p>
            <p className="db-nav__title">My Library</p>
            <p className="db-nav__desc">Courses, lessons, and dharma resources</p>
          </Link>

          <Link href="/account/dashboard-member-care-agreements" className="db-nav__card">
            <p className="db-nav__label">Community</p>
            <p className="db-nav__title">Our Agreements</p>
            <p className="db-nav__desc">The values we practice together</p>
          </Link>

          <Link href="/account/dashboard-my-profile" className="db-nav__card">
            <p className="db-nav__label">Account</p>
            <p className="db-nav__title">My Profile</p>
            <p className="db-nav__desc">Update your name and contact info</p>
          </Link>
        </div>

        {/* ── Today's sessions ── */}
        <div id="today" className="db-section">
          <p className="db-section__label">Today&apos;s Sessions — {today}</p>
          {todaysPrograms.length === 0 ? (
            <p className="db-section__empty">
              No programs scheduled for today. See you next time.
            </p>
          ) : (
            <div className="db-staff__links">
              {todaysPrograms.map((program) => (
                program.zoomLink ? (
                  <a
                    key={program._id}
                    href={program.zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="db-staff__card"
                  >
                    <span className="db-staff__card-title">{program.name}</span>
                    {program.listingDayAndTimeText && (
                      <span className="db-staff__card-desc">{program.listingDayAndTimeText}</span>
                    )}
                    {program.dashboardSpecialAnnouncement && (
                      <span className="db-staff__card-desc" style={{ color: "var(--rim-mid)", fontStyle: "italic" }}>
                        {program.dashboardSpecialAnnouncement}
                      </span>
                    )}
                  </a>
                ) : (
                  <div key={program._id} className="db-staff__card" style={{ opacity: 0.5 }}>
                    <span className="db-staff__card-title">{program.name}</span>
                    {program.listingDayAndTimeText && (
                      <span className="db-staff__card-desc">{program.listingDayAndTimeText}</span>
                    )}
                    <span className="db-staff__card-desc">No Zoom link available</span>
                  </div>
                )
              ))}
            </div>
          )}
        </div>

        {/* ── Pending dana reminder ── */}
        {pendingDanaRegistrations.length > 0 && (
          <div className="db-section">
            <div className="db-dana-reminder" style={{ marginTop: 0 }}>
              <p className="db-dana-reminder__label">Dana Offering Pending</p>
              <p className="db-dana-reminder__desc">
                A spot opened up for the following program{pendingDanaRegistrations.length > 1 ? "s" : ""}.
                Visit the program page to complete your dana offering.
              </p>
              <div className="db-dana-reminder__items">
                {pendingDanaRegistrations.map((r) => (
                  <Link
                    key={r.id}
                    href={`/programs/${r.programSlug}/register`}
                    className="db-dana-reminder__item"
                  >
                    {r.programTitle}
                    <span className="db-dana-reminder__arrow">→</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Staff access panel ── */}
        {staffLinks.length > 0 && (
          <div className="db-section">
            <p className="db-section__label">Staff Access</p>
            <div className="db-staff__links">
              {staffLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="db-staff__card"
                  >
                    <span className="db-staff__card-title">{link.label}</span>
                    <span className="db-staff__card-desc">{link.description}</span>
                  </a>
                ) : (
                  <Link key={link.href} href={link.href} className="db-staff__card">
                    <span className="db-staff__card-title">{link.label}</span>
                    <span className="db-staff__card-desc">{link.description}</span>
                  </Link>
                )
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
