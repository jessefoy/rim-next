import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { dashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";

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
  // Check dayFiltering string first (e.g. "Monday, Wednesday")
  if (program.dayFiltering) {
    return program.dayFiltering
      .split(",")
      .map((d) => d.trim())
      .includes(today);
  }
  // Fall back to dayOfWeek reference array
  if (program.dayOfWeek && program.dayOfWeek.length > 0) {
    return program.dayOfWeek.some((d) => d.name === today);
  }
  return false;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const allPrograms = await sanityClient.fetch<DashboardProgram[]>(dashboardProgramsQuery);
  const today = getMilwaukeeDay();
  const todaysPrograms = allPrograms.filter((p) => programIsToday(p, today));

  const firstName = session.user?.name?.split(" ")[0] ?? session.user?.email?.split("@")[0] ?? "there";

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
                    <div
                      key={program._id}
                      role="listitem"
                      className="program-collection-item w-dyn-item"
                    >
                      <div className="w-layout-grid programlistblock">
                        <div className="dashboard-list-name-and-date-container">
                          <div className="name-day-and-time-block">
                            <div className="dashboard-title-container">
                              <h1 className="event-name">{program.name}</h1>
                            </div>
                            {program.listingDayAndTimeText && (
                              <div className="dashboard-date-time-container">
                                <div className="text-block-46">{program.listingDayAndTimeText}</div>
                              </div>
                            )}
                          </div>
                          {program.dashboardEarlyArrivalMessage && (
                            <h1 className="presession-message">{program.dashboardEarlyArrivalMessage}</h1>
                          )}
                          {program.dashboardSpecialAnnouncement && (
                            <div className="special-program-announcment">
                              <h1 className="special-announcment">{program.dashboardSpecialAnnouncement}</h1>
                            </div>
                          )}
                        </div>
                        <div className="program-links">
                          <Link
                            href={`/account/waiting-room?name=${encodeURIComponent(program.name)}&time=${encodeURIComponent(program.listingDayAndTimeText ?? "")}&zoom=${encodeURIComponent(program.zoomLink ?? "")}`}
                            className="attendance-button w-button"
                          >
                            Join
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
