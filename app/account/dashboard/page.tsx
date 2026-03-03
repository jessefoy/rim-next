import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { dashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import ListRow from "@/components/ListRow";
import { db } from "@/lib/db";

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
// Multiple roles can point to the same href — deduplicated by href before rendering
const STAFF_LINKS: Record<string, { label: string; href: string; description: string }[]> = {
  REGISTRAR: [
    { label: "Registrations", href: "/volunteer", description: "View and manage program registrations" },
  ],
  ADMIN: [
    { label: "Registrations", href: "/volunteer", description: "View and manage program registrations" },
    { label: "Members", href: "/admin/members", description: "Manage members and assign permissions" },
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

  const firstName = session.user?.name?.split(" ")[0] ?? session.user?.email?.split("@")[0] ?? "there";

  // Collect unique staff links for this user's roles (deduplicated by href)
  const roles: string[] = session.user.roles ?? [];
  // Collect all links from each role, flatten, then deduplicate by href
  const allLinks = roles.flatMap((r) => STAFF_LINKS[r] ?? []);
  const staffLinks = Object.values(
    Object.fromEntries(allLinks.map((l) => [l.href, l]))
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

        {/* ── Pending dana reminder — shown when promoted from waitlist ── */}
        {pendingDanaRegistrations.length > 0 && (
          <div className="db-dana-reminder">
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
        )}

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
