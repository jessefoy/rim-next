import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import AccountLayout from "@/components/AccountLayout";

export const metadata = { title: "My Teams - Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

type TeamRow = { slug: string; name: string; archived: boolean; coordinator: boolean };

function TeamList({ teams }: { teams: TeamRow[] }) {
  return (
    <ul className="rim-destination-list">
      {teams.map((team) => (
        <li key={team.slug}>
          <Link href={`/account/hub/${team.slug}`}>
            <span>
              {team.name}
              {team.coordinator && <span className="rim-team-role">Coordinator</span>}
              {team.archived && <small>Archived</small>}
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// My Teams (Jesse, 2026-10-12): a member sees only the teams they belong to
// that are not archived, with Coordinator marked where they hold it. A
// guiding teacher sees their own teams, then every other team they oversee
// (archived last, marked). Someone with no team sees what teams are and how
// to volunteer; the rail hides My Teams for them (components/AccountLayout).
// The door into a team is unchanged: membership or GUIDING_TEACHER
// (lib/hubAuth.ts canAccessHub). ADMIN alone never reveals team content.
export default async function TeamsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;
  const isTeacher = (session.user.roles ?? []).includes("GUIDING_TEACHER");
  const hubs = await db.hub.findMany({
    where: isTeacher ? {} : { members: { some: { userId } }, status: "ACTIVE" },
    select: {
      slug: true,
      name: true,
      status: true,
      members: { where: { userId }, select: { isCoordinator: true, status: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = hubs.map((h) => ({
    slug: h.slug,
    name: h.name,
    archived: h.status === "ARCHIVED",
    coordinator: h.members.some((m) => m.isCoordinator && m.status === "ACTIVE"),
    member: h.members.length > 0,
  }));
  const mine = rows.filter((r) => r.member && !r.archived);
  const overseen = isTeacher
    ? rows.filter((r) => !mine.includes(r)).sort((a, b) => Number(a.archived) - Number(b.archived))
    : [];

  return (
    <AccountLayout>
      <div className="ac-member-page rim-directory">
        <header className="ac-page-head">
          <div>
            <h1 className="ac-page-title">My Teams</h1>
            {(mine.length > 0 || overseen.length > 0) && (
              <p className="ac-page-sub">Choose a team to find its conversations, files, and shared work.</p>
            )}
          </div>
        </header>

        {isTeacher ? (
          <>
            {mine.length > 0 && (
              <section aria-labelledby="teams-mine">
                <h2 id="teams-mine" className="rim-teams__label">Your teams</h2>
                <TeamList teams={mine} />
              </section>
            )}
            {overseen.length > 0 && (
              <section aria-labelledby="teams-overseen">
                <h2 id="teams-overseen" className="rim-teams__label">Teams you oversee</h2>
                <TeamList teams={overseen} />
              </section>
            )}
          </>
        ) : mine.length > 0 ? (
          <TeamList teams={mine} />
        ) : (
          <section className="rim-empty rim-teams-empty" aria-labelledby="teams-empty-title">
            <h2 id="teams-empty-title">You are not part of a team yet.</h2>
            <p>
              Teams are the volunteers who help RIM run: hosting gatherings on Zoom,
              greeting people at the door, running the sound and video, and more. Each
              team has its own space here for its conversations and shared files.
            </p>
            <p>If you would like to help, the volunteer page describes what is needed now.</p>
            <div className="pp-actions">
              <Link href="/volunteerism/volunteer" className="pp-btn">
                Volunteer with RIM <span aria-hidden="true">→</span>
              </Link>
              <Link href="/account/dashboard" className="pp-btn pp-btn--ghost">
                Back to My Home
              </Link>
            </div>
          </section>
        )}
      </div>
    </AccountLayout>
  );
}
