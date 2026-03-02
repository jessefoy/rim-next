import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity";
import { db } from "@/lib/db";
import Link from "next/link";

const volunteerProgramsQuery = `*[_type == "programs" && !(_id in path("drafts.**")) && registrationEnabled == true] | order(sortOrder asc) {
  _id, name, slug, tagline, registrationCapacity
}`;

interface SanityProgram {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  registrationCapacity?: number | null;
}

export default async function VolunteerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAuthorized = session.user.roles?.some((r) =>
    ["REGISTRAR", "ADMIN"].includes(r)
  );
  if (!isAuthorized) {
    return (
      <div className="vol-page">
        <div className="vol-content">
          <p className="vol-unauthorized">
            You don&rsquo;t have permission to access this area.
          </p>
        </div>
      </div>
    );
  }

  const programs = await sanityClient.fetch<SanityProgram[]>(volunteerProgramsQuery);

  // Get registration counts grouped by program + status in one query
  const counts = await db.registration.groupBy({
    by: ["programId", "status"],
    _count: { _all: true },
  });

  const programsWithCounts = programs.map((p) => {
    const rows = counts.filter((c) => c.programId === p._id);
    const byStatus = Object.fromEntries(rows.map((c) => [c.status, c._count._all]));
    const total = rows.reduce((sum, c) => sum + c._count._all, 0);
    return { ...p, byStatus, total };
  });

  return (
    <div className="vol-page">
      <div className="vol-content">

        <header className="vol-header">
          <p className="lp-label">Volunteer Admin</p>
          <h1 className="vol-header__title">Registrations</h1>
        </header>

        {programsWithCounts.length === 0 ? (
          <p className="vol-empty">
            No programs have registration enabled yet. Enable a program in{" "}
            <a href="https://rooted-in-mindfulness.sanity.studio/" target="_blank" rel="noopener noreferrer">
              Sanity Studio
            </a>
            .
          </p>
        ) : (
          <div className="vol-programs">
            {programsWithCounts.map((p) => (
              <Link
                key={p._id}
                href={`/volunteer/programs/${p.slug.current}`}
                className="vol-card"
              >
                <div className="vol-card__main">
                  <h2 className="vol-card__title">{p.name}</h2>
                  {p.tagline && <p className="vol-card__tagline">{p.tagline}</p>}
                </div>
                <div className="vol-card__stats">
                  <span className="vol-stat">
                    <span className="vol-stat__num">{p.total}</span>
                    <span className="vol-stat__label">total</span>
                  </span>
                  {(p.byStatus.REGISTERED ?? 0) > 0 && (
                    <span className="vol-badge vol-badge--registered">
                      {p.byStatus.REGISTERED} registered
                    </span>
                  )}
                  {(p.byStatus.WAITLISTED ?? 0) > 0 && (
                    <span className="vol-badge vol-badge--waitlisted">
                      {p.byStatus.WAITLISTED} waitlisted
                    </span>
                  )}
                  {(p.byStatus.APPROVED ?? 0) > 0 && (
                    <span className="vol-badge vol-badge--approved">
                      {p.byStatus.APPROVED} approved
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
