import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { dashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import ListRow from "@/components/ListRow";

export const metadata = { title: "Dashboard — Rooted In Mindfulness" };

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
const STAFF_LINKS: Record<string, { label: string; href: string; description: string }> = {
  REGISTRAR: {
    label: "Registrations",
    href: "/volunteer",
    description: "View and manage program registrations",
  },
  ADMIN: {
    label: "Registrations",
    href: "/volunteer",
    description: "View and manage program registrations",
  },
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allPrograms = await sanityClient.fetch<DashboardProgram[]>(dashboardProgramsQuery);
  const today = getMilwaukeeDay();
  const todaysPrograms = allPrograms.filter((p) => programIsToday(p, today));

  const firstName = session.user?.name?.split(" ")[0] ?? session.user?.email?.split("@")[0] ?? "there";

  // Collect unique staff links for this user's roles (deduplicated by href)
  const roles: string[] = session.user.roles ?? [];
  const staffLinks = Object.values(
    Object.fromEntries(
      roles
        .filter((r) => r in STAFF_LINKS)
        .map((r) => [STAFF_LINKS[r].href, STAFF_LINKS[r]])
    )
  );

  return (
    <div className="page-wrapper">
      <div className="dashboard-section">
        <div className="dashboard-content">
          <h2 className="heading-50">Welcome {firstName}!</h2>
          <h4 className="heading-40">Today&apos;s Zoom Session Links:</h4>
          <div className="todays-offering">
            <div className="programs-collection-list-wrapper w-dyn-list">
              <div role="list" className="programs-collection-list w-dyn-items">
                {todaysPrograms.length === 0 ? (
                  <div className="w-dyn-empty">
                    <div>No programs scheduled for today ({today}).</div>
                  </div>
                ) : (
                  todaysPrograms.map((program) => (
                    <ListRow
                      key={program._id}
                      title={program.name}
                      subtitle={program.listingDayAndTimeText}
                      note={program.dashboardEarlyArrivalMessage}
                      announcement={program.dashboardSpecialAnnouncement}
                      href={program.zoomLink}
                      buttonLabel="Join Zoom"
                      external
                      disabled={!program.zoomLink}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Staff access panel (visible only if user has elevated roles) ── */}
        {staffLinks.length > 0 && (
          <div className="db-staff">
            <p className="db-staff__label">Staff Access</p>
            <div className="db-staff__links">
              {staffLinks.map((link) => (
                <Link key={link.href} href={link.href} className="db-staff__card">
                  <span className="db-staff__card-title">{link.label}</span>
                  <span className="db-staff__card-desc">{link.description}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
