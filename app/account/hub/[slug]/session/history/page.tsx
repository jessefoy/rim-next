/**
 * /account/hub/[slug]/session/history — Coordinator session history view.
 * Access: isCoordinator on host-team HubMember, or ADMIN.
 *
 * Shows all past sessions with report status, attendance count, assigned host,
 * and full detail including flagged people (coordinator only).
 */

import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session History — Host Team Hub" };

const PAGE_SIZE = 30;

// ── Date helpers ──────────────────────────────────────────────────────────────

function toCTDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
}

function fmtDisplayDate(ctDate: string): string {
  return new Date(ctDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function ctMidnight(ctDate: string): Date {
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${ctDate}T12:00:00${offset}`);
    if (toCTDateStr(noon) === ctDate) return new Date(`${ctDate}T00:00:00${offset}`);
  }
  return new Date(`${ctDate}T00:00:00-06:00`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionEntry {
  programSlug: string;
  programName: string;
  ctDate: string;
  attendanceCount: number;
  report: {
    id: string;
    hostId: string;
    hostName: string;
    submittedByAssignedHost: boolean | null;
    reflection: string | null;
    resourceUrl: string | null;
    resourceNote: string | null;
    submittedAt: Date;
  } | null;
  assignedHost: { userId: string; name: string } | null;
}

interface AttendanceRow {
  id: string;
  userId: string;
  displayName: string;
  joinedAt: Date;
  isNewMember: boolean;
  returningAfterAbsence: boolean;
  flaggedByHost: boolean;
  postSessionNote: string | null;
  postSessionAction: string;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchSessionList(todayCT: string): Promise<SessionEntry[]> {
  // ── Source 1: Sessions with attendance records ─────────────────────────────
  // Group SessionAttendance by (programSlug, CT date), past sessions only.
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

  // ── Source 2: All past SessionReports ─────────────────────────────────────
  const todayMidnight = ctMidnight(todayCT);
  const reports = await db.sessionReport.findMany({
    where: { sessionDate: { lt: todayMidnight } },
    include: { host: { select: { firstName: true, lastName: true, preferredName: true } } },
    orderBy: { sessionDate: "desc" },
  });

  const reportByKey = new Map(
    reports.map((r) => {
      const key = `${r.programSlug}||${toCTDateStr(r.sessionDate)}`;
      const hostName = r.host.preferredName || r.host.firstName || "Host";
      return [key, { ...r, hostName }];
    })
  );

  // ── Build unified session map ──────────────────────────────────────────────
  // Start from attendance sessions, add any report-only sessions
  const sessionMap = new Map<string, { programSlug: string; ctDate: string; attendanceCount: number }>();
  for (const a of attendanceSessions) {
    sessionMap.set(`${a.programSlug}||${a.ct_date}`, {
      programSlug: a.programSlug,
      ctDate: a.ct_date,
      attendanceCount: a.attendance_count,
    });
  }
  // Add report-only sessions (report filed but no attendance tracked)
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

  // ── Fetch HostAssignments for all session dates ────────────────────────────
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

  // ── Fetch program names from Postgres ─────────────────────────────────────
  const uniqueSlugs = [...new Set(allSessions.map((s) => s.programSlug))];
  const pgPrograms = uniqueSlugs.length > 0
    ? await db.program.findMany({
        where: { slug: { in: uniqueSlugs } },
        select: { slug: true, name: true },
      })
    : [];

  const nameBySlug = new Map(pgPrograms.map((p) => [p.slug, p.name]));

  // ── Assemble final entries ─────────────────────────────────────────────────
  return allSessions.map((s) => {
    const key = `${s.programSlug}||${s.ctDate}`;
    const report = reportByKey.get(key) ?? null;
    return {
      programSlug: s.programSlug,
      programName: nameBySlug.get(s.programSlug) ?? s.programSlug.replace(/-/g, " "),
      ctDate: s.ctDate,
      attendanceCount: s.attendanceCount,
      report: report
        ? {
            id: report.id,
            hostId: report.hostId,
            hostName: report.hostName,
            submittedByAssignedHost: report.submittedByAssignedHost,
            reflection: report.reflection,
            resourceUrl: report.resourceUrl,
            resourceNote: report.resourceNote,
            submittedAt: report.submittedAt,
          }
        : null,
      assignedHost: assignmentByKey.get(key) ?? null,
    };
  });
}

async function fetchSessionDetail(programSlug: string, ctDate: string): Promise<AttendanceRow[]> {
  const sessionDate = ctMidnight(ctDate);
  const records = await db.sessionAttendance.findMany({
    where: { programSlug, sessionDate },
    include: {
      user: { select: { firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: { joinedAt: "asc" },
  });

  return records.map((a) => {
    const u = a.user;
    const first = u?.preferredName || u?.firstName || "";
    const last  = u?.lastName ? u.lastName.slice(0, 1) + "." : "";
    return {
      id: a.id,
      userId: a.userId,
      displayName: [first, last].filter(Boolean).join(" ") || "Unknown",
      joinedAt: a.joinedAt,
      isNewMember: a.isNewMember,
      returningAfterAbsence: a.returningAfterAbsence,
      flaggedByHost: a.flaggedByHost,
      postSessionNote: a.postSessionNote,
      postSessionAction: a.postSessionAction,
    };
  });
}

// ── Action label ──────────────────────────────────────────────────────────────

function actionLabel(action: string): string {
  switch (action) {
    case "GENTLE_FOLLOWUP": return "Gentle follow-up";
    case "JESSE_ONLY":      return "Jesse only";
    case "TECHNICAL_ISSUE": return "Technical issue";
    default:                return "";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SessionHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string; detail_slug?: string; detail_date?: string }>;
}) {
  const { slug } = await params;
  const { page: pageStr, detail_slug: detailSlug, detail_date: detailDate } = await searchParams;

  if (slug !== "host-team") notFound();

  const session = await auth();
  if (!session) redirect("/login");

  const roles = session.user.roles ?? [];
  const { member } = await getHubMembership(slug, session.user.id, roles);

  const isAdmin = roles.includes("ADMIN");
  const isCoordinator = (member?.isCoordinator ?? false) || isAdmin;

  if (!isCoordinator && !isAdmin) {
    return (
      <div className="sh-access-denied">
        <p>This view is for host team coordinators only.</p>
        <Link href={`/account/hub/${slug}/session`}>← Back to today&rsquo;s session</Link>
      </div>
    );
  }

  const todayCT = toCTDateStr(new Date());
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  // Fetch all sessions
  const allSessions = await fetchSessionList(todayCT);

  // Detail view
  const showDetail = !!(detailSlug && detailDate);
  let detailEntry: SessionEntry | null = null;
  let detailAttendance: AttendanceRow[] = [];

  if (showDetail) {
    detailEntry = allSessions.find(
      (s) => s.programSlug === detailSlug && s.ctDate === detailDate
    ) ?? null;
    if (detailEntry) {
      detailAttendance = await fetchSessionDetail(detailSlug, detailDate);
    }
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(allSessions.length / PAGE_SIZE));
  const offset = (page - 1) * PAGE_SIZE;
  const pageItems = allSessions.slice(offset, offset + PAGE_SIZE);

  const baseHref = `/account/hub/${slug}/session/history`;
  const teamHref = `/account/hub/${slug}/session/history/team`;

  return (
    <div className="sh-wrap">
      {/* ── Header ── */}
      <div className="sh-header">
        <div className="sh-header__row">
          <h2 className="sh-title">Session History</h2>
          <a href={teamHref} className="sh-view-toggle">Team view →</a>
        </div>
        <p className="sh-subtitle">
          Coordinator view — {allSessions.length} session{allSessions.length !== 1 ? "s" : ""} on record
        </p>
      </div>

      {/* ── Detail panel ── */}
      {showDetail && detailEntry && (
        <div className="sh-detail">
          <Link
            href={`${baseHref}?page=${page}`}
            className="sh-detail__back"
          >
            ← Back to list
          </Link>

          <div className="sh-detail__head">
            <h3 className="sh-detail__name">{detailEntry.programName}</h3>
            <p className="sh-detail__date">{fmtDisplayDate(detailEntry.ctDate)}</p>
          </div>

          <div className="sh-detail__meta">
            <div className="sh-detail__meta-row">
              <span className="sh-detail__label">Assigned host</span>
              <span>{detailEntry.assignedHost?.name ?? <em>Unassigned</em>}</span>
            </div>
            <div className="sh-detail__meta-row">
              <span className="sh-detail__label">Attendance</span>
              <span>{detailEntry.attendanceCount}</span>
            </div>
            {detailEntry.report && (
              <>
                <div className="sh-detail__meta-row">
                  <span className="sh-detail__label">Report filed by</span>
                  <span>
                    {detailEntry.report.hostName}
                    {detailEntry.report.submittedByAssignedHost === false && (
                      <span className="sh-detail__sub-note"> (not the assigned host)</span>
                    )}
                  </span>
                </div>
                <div className="sh-detail__meta-row">
                  <span className="sh-detail__label">Filed at</span>
                  <span>{detailEntry.report.submittedAt.toLocaleDateString("en-US", {
                    timeZone: "America/Chicago",
                    month: "short", day: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })}</span>
                </div>
              </>
            )}
          </div>

          {/* Reflection */}
          {detailEntry.report?.reflection && (
            <div className="sh-detail__section">
              <h4 className="sh-detail__section-title">Reflection</h4>
              <p className="sh-detail__text">{detailEntry.report.reflection}</p>
            </div>
          )}

          {/* Resource */}
          {detailEntry.report?.resourceUrl && (
            <div className="sh-detail__section">
              <h4 className="sh-detail__section-title">Resource shared</h4>
              {detailEntry.report.resourceUrl.startsWith("http") ? (
                <a
                  href={detailEntry.report.resourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sh-detail__link"
                >
                  {detailEntry.report.resourceUrl}
                </a>
              ) : (
                <p className="sh-detail__text">{detailEntry.report.resourceUrl}</p>
              )}
              {detailEntry.report.resourceNote && (
                <p className="sh-detail__note">{detailEntry.report.resourceNote}</p>
              )}
            </div>
          )}

          {/* Flagged people — coordinator only */}
          {detailAttendance.filter((a) => a.flaggedByHost).length > 0 && (
            <div className="sh-detail__section sh-detail__section--sensitive">
              <h4 className="sh-detail__section-title">Flagged people</h4>
              {detailAttendance.filter((a) => a.flaggedByHost).map((a) => (
                <div key={a.id} className="sh-flagged-item">
                  <div className="sh-flagged-item__name">{a.displayName}</div>
                  {actionLabel(a.postSessionAction) && (
                    <div className="sh-flagged-item__routing">
                      {actionLabel(a.postSessionAction)}
                    </div>
                  )}
                  {a.postSessionNote && (
                    <p className="sh-flagged-item__note">{a.postSessionNote}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* All attendees */}
          {detailAttendance.length > 0 && (
            <div className="sh-detail__section">
              <h4 className="sh-detail__section-title">
                Attendees ({detailAttendance.length})
              </h4>
              <div className="sh-attendee-list">
                {detailAttendance.map((a) => (
                  <span key={a.id} className="sh-attendee">
                    {a.displayName}
                    {a.isNewMember && <span className="sh-attendee__badge sh-attendee__badge--new">New</span>}
                    {a.returningAfterAbsence && !a.isNewMember && (
                      <span className="sh-attendee__badge sh-attendee__badge--returning">Returning</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!detailEntry.report && (
            <div className="sh-detail__missing">
              No post-session report was filed for this session.{" "}
              <Link
                href={`/account/hub/${slug}/session/${detailEntry.programSlug}/post?date=${detailEntry.ctDate}`}
                className="sh-detail__file-link"
              >
                File a report now →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Session list ── */}
      {!showDetail && (
        <>
          {allSessions.length === 0 ? (
            <div className="sh-empty">
              <p>No past sessions on record yet.</p>
            </div>
          ) : (
            <>
              <div className="sh-list">
                <div className="sh-list__head">
                  <span>Session</span>
                  <span>Date</span>
                  <span>Host</span>
                  <span className="sh-list__col--num">In</span>
                  <span>Report</span>
                </div>
                {pageItems.map((s) => {
                  const href = `${baseHref}?detail_slug=${encodeURIComponent(s.programSlug)}&detail_date=${s.ctDate}&page=${page}`;
                  return (
                    <Link key={`${s.programSlug}||${s.ctDate}`} href={href} className="sh-list__row">
                      <span className="sh-list__name">{s.programName}</span>
                      <span className="sh-list__date">{fmtDisplayDate(s.ctDate)}</span>
                      <span className="sh-list__host">{s.assignedHost?.name ?? <em className="sh-list__unassigned">—</em>}</span>
                      <span className="sh-list__col--num sh-list__count">{s.attendanceCount}</span>
                      <span>
                        {s.report
                          ? <span className="sh-status sh-status--ok">Submitted</span>
                          : <span className="sh-status sh-status--missing">Missing</span>
                        }
                      </span>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="sh-pagination">
                  {page > 1 && (
                    <a href={`${baseHref}?page=${page - 1}`} className="sh-pagination__btn">← Newer</a>
                  )}
                  <span className="sh-pagination__info">Page {page} of {totalPages}</span>
                  {page < totalPages && (
                    <a href={`${baseHref}?page=${page + 1}`} className="sh-pagination__btn">Older →</a>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
