import { auth } from "@/auth";
import { sanityClient } from "@/lib/sanity";
import { dashboardProgramsQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
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
      </div>
    </div>
  );
}
