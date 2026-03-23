/**
 * /tools/schedule/session/history/team — Team session journal (shared).
 * Access: any HubMember of host-team hub, or ADMIN.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session Journal — Host Schedule" };

const PAGE_SIZE = 30;

// ── Date helpers ──────────────────────────────────────────────────────────────

function toCTDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
}

function fmtDisplayDate(ctDate: string): string {
  return new Date(ctDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function ctMidnight(ctDate: string): Date {
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${ctDate}T12:00:00${offset}`);
    if (toCTDateStr(noon) === ctDate) return new Date(`${ctDate}T00:00:00${offset}`);
  }
  return new Date(`${ctDate}T00:00:00-06:00`);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamHistoryToolPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;

  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Check membership via direct HubMember query
  const hostHub = await db.hub.findUnique({ where: { slug: "host-team" }, select: { id: true } });
  const hubMember = hostHub
    ? await db.hubMember.findUnique({
        where: { hubId_userId: { hubId: hostHub.id, userId: session.user.id } },
      })
    : null;
  const isMember = !!hubMember;
  const isCoordinator = (hubMember?.isCoordinator ?? false) || isAdmin;

  if (!isMember && !isAdmin) {
    return (
      <div className="sh-access-denied">
        <p>This page is for host team members.</p>
        <Link href="/tools/schedule/session">&larr; Back to today&rsquo;s session</Link>
      </div>
    );
  }

  const todayCT = toCTDateStr(new Date());
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  type AttSess = { programSlug: string; ct_date: string; attendance_count: number };
  const attendanceSessions = await db.$queryRaw<AttSess[]>`
    SELECT
      "programSlug",
      DATE("joinedAt" AT TIME ZONE 'America/Chicago')::text AS ct_date,
      COUNT(*)::int                                          AS attendance_count
    FROM session_attendance
    WHERE DATE("joinedAt" AT TIME ZONE 'America/Chicago') < ${todayCT}::date
    GROUP BY "programSlug", ct_date
    ORDER BY ct_date DESC
  `;

  const todayMidnight = ctMidnight(todayCT);
  const reports = await db.sessionReport.findMany({
    where: { sessionDate: { lt: todayMidnight } },
    include: { host: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { sessionDate: "desc" },
  });

  const reportByKey = new Map(
    reports.map((r) => {
      const ctDate = toCTDateStr(r.sessionDate);
      const hostName = r.host.preferredName || r.host.firstName || "Host";
      return [`${r.programSlug}||${ctDate}`, { ...r, hostName, ctDate }];
    })
  );

  const sessionMap = new Map<string, { programSlug: string; ctDate: string; attendanceCount: number }>();
  for (const a of attendanceSessions) {
    sessionMap.set(`${a.programSlug}||${a.ct_date}`, {
      programSlug: a.programSlug,
      ctDate: a.ct_date,
      attendanceCount: a.attendance_count,
    });
  }
  for (const r of reports) {
    const ctDate = toCTDateStr(r.sessionDate);
    const key = `${r.programSlug}||${ctDate}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { programSlug: r.programSlug, ctDate, attendanceCount: 0 });
    }
  }

  const allSessions = Array.from(sessionMap.values()).sort((a, b) =>
    b.ctDate.localeCompare(a.ctDate)
  );

  const uniqueDates = [...new Set(allSessions.map((s) => s.ctDate))];
  const assignments = uniqueDates.length > 0
    ? await db.hostAssignment.findMany({
        where: {
          sessionDate: { in: uniqueDates.map(ctMidnight) },
          userId: { not: null },
        },
        include: {
          user: { select: { firstName: true, lastName: true, preferredName: true } },
        },
      })
    : [];

  const assignmentByKey = new Map<string, { userId: string; name: string }>();
  for (const a of assignments) {
    if (a.userId && a.sessionDate && a.user) {
      const key = `${a.programSlug}||${toCTDateStr(a.sessionDate)}`;
      assignmentByKey.set(key, {
        userId: a.userId,
        name: a.user.preferredName || a.user.firstName || "Host",
      });
    }
  }

  const uniqueSlugs = [...new Set(allSessions.map((s) => s.programSlug))];
  const pgPrograms = uniqueSlugs.length > 0
    ? await db.program.findMany({
        where: { slug: { in: uniqueSlugs } },
        select: { slug: true, name: true },
      })
    : [];

  const nameBySlug = new Map(pgPrograms.map((p) => [p.slug, p.name]));

  const totalPages = Math.max(1, Math.ceil(allSessions.length / PAGE_SIZE));
  const pageItems = allSessions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const reflectionHtmlMap = new Map<string, string>();
  for (const s of pageItems) {
    const key = `${s.programSlug}||${s.ctDate}`;
    const report = reportByKey.get(key);
    if (report?.reflection) {
      reflectionHtmlMap.set(key, await renderFormattedTextAsync(report.reflection));
    }
  }

  const baseHref = "/tools/schedule/session/history";
  const teamHref = "/tools/schedule/session/history/team";

  return (
    <div className="sh-wrap">
      <div className="sh-header">
        <div className="sh-header__row">
          <h2 className="sh-title">Session Journal</h2>
          {(isCoordinator || isAdmin) && (
            <a href={baseHref} className="sh-view-toggle">Coordinator view &rarr;</a>
          )}
        </div>
        <p className="sh-subtitle">
          A record of the host team&rsquo;s practice together
        </p>
      </div>

      {allSessions.length === 0 ? (
        <div className="sh-empty">
          <p>No sessions recorded yet.</p>
        </div>
      ) : (
        <>
          <div className="sh-journal">
            {pageItems.map((s) => {
              const key = `${s.programSlug}||${s.ctDate}`;
              const report = reportByKey.get(key) ?? null;
              const assignment = assignmentByKey.get(key) ?? null;
              const hostName = assignment?.name ?? report?.hostName ?? null;
              const isMyMissingSession = !report && assignment?.userId === session.user.id;
              const programName = nameBySlug.get(s.programSlug) ?? s.programSlug.replace(/-/g, " ");

              return (
                <div key={key} className="sh-journal__entry">
                  <div className="sh-journal__meta">
                    <span className="sh-journal__program">{programName}</span>
                    <span className="sh-journal__date">{fmtDisplayDate(s.ctDate)}</span>
                    {hostName && (
                      <span className="sh-journal__host">Hosted by {hostName}</span>
                    )}
                    <span className="sh-journal__count">
                      {s.attendanceCount} {s.attendanceCount === 1 ? "person" : "people"}
                    </span>
                  </div>

                  {report?.reflection && (
                    <div
                      className="sh-journal__reflection"
                      dangerouslySetInnerHTML={{ __html: reflectionHtmlMap.get(key) || "" }}
                    />
                  )}

                  {report?.resourceUrl && (
                    <div className="sh-journal__resource">
                      <span className="sh-journal__resource-label">Resource: </span>
                      {report.resourceUrl.startsWith("http") ? (
                        <a
                          href={report.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sh-journal__resource-link"
                        >
                          {report.resourceNote || report.resourceUrl}
                        </a>
                      ) : (
                        <span>{report.resourceNote ? `${report.resourceUrl} — ${report.resourceNote}` : report.resourceUrl}</span>
                      )}
                    </div>
                  )}

                  {!report?.reflection && !report?.resourceUrl && (
                    <p className="sh-journal__quiet">No reflection filed.</p>
                  )}

                  {isMyMissingSession && (
                    <Link
                      href={`/tools/schedule/session/${s.programSlug}/post?date=${s.ctDate}`}
                      className="sh-journal__complete-link"
                    >
                      Complete your report &rarr;
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="sh-pagination">
              {page > 1 && (
                <a href={`${teamHref}?page=${page - 1}`} className="sh-pagination__btn">&larr; Newer</a>
              )}
              <span className="sh-pagination__info">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <a href={`${teamHref}?page=${page + 1}`} className="sh-pagination__btn">Older &rarr;</a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
