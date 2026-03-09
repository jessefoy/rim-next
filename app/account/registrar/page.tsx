import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity";
import { db } from "@/lib/db";
import Link from "next/link";
import AccountLayout from "@/components/AccountLayout";

const volunteerProgramsQuery = `*[_type == "programs" && !(_id in path("drafts.**"))] | order(sortOrder asc) {
  _id, name, slug, tagline, registrationCapacity
}`;

interface SanityProgram {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  registrationCapacity?: number | null;
}

export default async function RegistrarPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const isAuthorized = session.user.roles?.some((r) =>
    ["REGISTRAR", "ADMIN"].includes(r)
  );
  if (!isAuthorized) {
    return (
      <AccountLayout>
        <div className="vol-page">
          <div className="vol-content">
            <p className="vol-unauthorized">
              You don&rsquo;t have permission to access this area.
            </p>
          </div>
        </div>
      </AccountLayout>
    );
  }

  const programs = await sanityClient.fetch<SanityProgram[]>(volunteerProgramsQuery);

  // Get registration counts grouped by program + status, and pending dana counts — in parallel
  const [counts, pendingDanaRows] = await Promise.all([
    db.registration.groupBy({
      by: ["programId", "status"],
      _count: { _all: true },
    }),
    db.registration.groupBy({
      by: ["programId"],
      where: { donationStatus: "PENDING" },
      _count: { _all: true },
    }),
  ]);

  const pendingDanaByProgram = Object.fromEntries(
    pendingDanaRows.map((r) => [r.programId, r._count._all])
  );

  const programsWithCounts = programs.map((p) => {
    const rows = counts.filter((c) => c.programId === p._id);
    const byStatus = Object.fromEntries(rows.map((c) => [c.status, c._count._all]));
    const confirmedCount = (byStatus.REGISTERED ?? 0) + (byStatus.APPROVED ?? 0);
    const waitlistedCount = byStatus.WAITLISTED ?? 0;
    const pendingDanaCount = pendingDanaByProgram[p._id] ?? 0;
    const capacityPct =
      p.registrationCapacity
        ? Math.min(100, Math.round((confirmedCount / p.registrationCapacity) * 100))
        : null;
    const spotOpened = !!p.registrationCapacity
      && confirmedCount < p.registrationCapacity
      && waitlistedCount > 0;
    const needsAttention = waitlistedCount > 0 || pendingDanaCount > 0 || spotOpened;
    return { ...p, byStatus, confirmedCount, waitlistedCount, pendingDanaCount, capacityPct, needsAttention, spotOpened };
  });

  return (
    <AccountLayout>
      <div className="vol-page">
        <div className="vol-content">

          <header className="vol-header">
            <p className="lp-label">Volunteer Admin</p>
            <h1 className="vol-header__title">Registrations</h1>
          </header>

          {programsWithCounts.length === 0 ? (
            <p className="vol-empty">
              No programs found. Create one in{" "}
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
                  href={`/account/registrar/${p.slug.current}`}
                  className={`vol-card${p.needsAttention ? " vol-card--attention" : ""}`}
                >
                  <div className="vol-card__main">
                    <h2 className="vol-card__title">{p.name}</h2>
                    {p.tagline && <p className="vol-card__tagline">{p.tagline}</p>}
                    {p.registrationCapacity && p.capacityPct !== null && (
                      <div className="vol-capacity">
                        <div className="vol-capacity__bar">
                          <div
                            className={`vol-capacity__fill${
                              p.capacityPct >= 100
                                ? " vol-capacity__fill--full"
                                : p.capacityPct >= 80
                                ? " vol-capacity__fill--near"
                                : ""
                            }`}
                            style={{ width: `${p.capacityPct}%` }}
                          />
                        </div>
                        <span className="vol-capacity__label">
                          {p.confirmedCount} / {p.registrationCapacity}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="vol-card__signals">
                    {p.spotOpened && (
                      <span className="vol-signal vol-signal--spot-open">
                        ↑ Spot open · {p.waitlistedCount} waiting
                      </span>
                    )}
                    {!p.spotOpened && p.waitlistedCount > 0 && (
                      <span className="vol-signal vol-signal--amber">
                        {p.waitlistedCount} waitlisted
                      </span>
                    )}
                    {p.pendingDanaCount > 0 && (
                      <span className="vol-signal vol-signal--amber">
                        {p.pendingDanaCount} dana pending
                      </span>
                    )}
                    {!p.needsAttention && p.confirmedCount > 0 && (
                      <span className="vol-signal vol-signal--clear">
                        {p.confirmedCount} confirmed
                      </span>
                    )}
                    {!p.needsAttention && p.confirmedCount === 0 && (
                      <span className="vol-signal vol-signal--empty">No registrations</span>
                    )}
                    <span className="vol-card__arrow">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

        </div>
      </div>
    </AccountLayout>
  );
}
