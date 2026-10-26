import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { helpingTeamAccess, myHelpingTeams } from "@/lib/programHelpers";
import { hasConcludedOneTime } from "@/lib/programUtils";
import { contactsClosed, hasEnded } from "@/lib/contactWindow";
import { lastOccurrenceEnd } from "@/lib/scheduleUtils";
import { programWhen } from "@/lib/registrationDesk";

export const metadata = { title: "Helping with - Tools" };
export const dynamic = "force-dynamic";

// Helping with (2026-10-24, Phase 3 slice 5): the programs this team prepares
// for, with how many are coming. Scoped by the team (?hub=), which the person
// must be an active member of (or the guiding teacher). Without a team: the
// person's own teams with the app, or straight to the one.
export default async function HelpingPage({ searchParams }: { searchParams: Promise<{ hub?: string }> }) {
  const { hub } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const team = await helpingTeamAccess(session.user.id, session.user.roles, hub);
  if (!team) {
    const mine = await myHelpingTeams(session.user.id);
    if (mine.length === 1 && !hub) redirect(`/tools/helping?hub=${encodeURIComponent(mine[0].slug)}`);
    return (
      <div className="vol-page">
        <div className="vol-content hlp-page">
          <h1 className="vol-header__title">Helping with</h1>
          {mine.length > 0 ? (
            <>
              <p className="hlp-why">Choose a team.</p>
              <ul className="rim-destination-list">
                {mine.map((t) => (
                  <li key={t.id}>
                    <Link href={`/tools/helping?hub=${encodeURIComponent(t.slug)}`}>
                      <span>{t.name}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="hlp-why">Helping with opens from a team that prepares for programs. You aren&rsquo;t on one with it installed.</p>
          )}
        </div>
      </div>
    );
  }

  const now = new Date();
  const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const rows = await db.programHelper.findMany({
    where: { hubId: team.id, program: { OR: [{ archivedAt: null }, { archivedAt: { gte: since } }] } },
    select: {
      program: {
        select: {
          id: true, slug: true, name: true, programFormat: true, dateText: true, startDatetime: true, endDatetime: true,
          recurrenceFreq: true, recurrenceInterval: true, recurrenceDays: true, recurrenceCount: true, archivedAt: true,
        },
      },
    },
  });
  const all = rows
    .map((r) => r.program)
    .sort((a, b) => (a.startDatetime?.getTime() ?? Infinity) - (b.startDatetime?.getTime() ?? Infinity));
  const isOver = (p: (typeof all)[number]) => !!p.archivedAt || hasConcludedOneTime(p) || hasEnded(p, now, lastOccurrenceEnd(p));
  const programs = all.filter((p) => !isOver(p));
  // Ended within their 30 days (lib/contactWindow.ts), newest first (Jesse, 2026-10-26).
  const ended = all.filter((p) => isOver(p) && !contactsClosed(p, now, lastOccurrenceEnd(p))).reverse();
  const counts = new Map(
    (programs.length
      ? await db.registration.groupBy({
          by: ["programSlug"],
          where: { programSlug: { in: programs.map((p) => p.slug) }, status: { in: ["REGISTERED", "APPROVED"] } },
          _count: { _all: true },
        })
      : []
    ).map((c) => [c.programSlug, c._count._all]),
  );
  const qs = `?hub=${encodeURIComponent(team.slug)}`;

  return (
    <div className="vol-page">
      <div className="vol-content hlp-page">
        <h1 className="vol-header__title">Helping with</h1>
        <p className="hlp-why">
          The programs the {team.name} prepares for. Each shows how many are coming and what they told the team. Dana isn&rsquo;t shown here.
        </p>
        {programs.length === 0 ? (
          <section className="hlp-panel">
            <p className="hlp-state">No program to help with right now.</p>
            {ended.length === 0 && <p className="hlp-note">A program adds this team under Teachers and teams, in its editor.</p>}
          </section>
        ) : (
          <ul className="rim-destination-list">
            {programs.map((p) => {
              const n = counts.get(p.slug) ?? 0;
              return (
                <li key={p.slug}>
                  <Link href={`/tools/helping/${p.slug}${qs}`}>
                    <span>
                      {p.name}
                      <small>{[programWhen(p), `${n} coming`].filter(Boolean).join(" · ")}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {ended.length > 0 && (
          <section aria-labelledby="hlp-ended">
            <h2 id="hlp-ended" className="hlp-panel__title">Ended</h2>
            <p className="hlp-note">Each stays here for 30 days after it ends.</p>
            <ul className="rim-destination-list">
              {ended.map((p) => (
                <li key={p.slug}>
                  <Link href={`/tools/helping/${p.slug}${qs}`}>
                    <span>
                      {p.name}
                      {programWhen(p) && <small>{programWhen(p)}</small>}
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
