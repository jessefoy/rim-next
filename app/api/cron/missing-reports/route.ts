import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendMissingReportEmail } from "@/lib/email";

// ─── GET /api/cron/missing-reports ────────────────────────────────────────────
// Daily cron (23:00 UTC via vercel.json — 3+ hours after sessions typically end).
// For each virtual/hybrid session that occurred today with no SessionReport filed,
// sends one notification email to every host-team coordinator.
//
// Idempotent: only sends if no SessionReport exists for that (programSlug, sessionDate).
// Vercel passes CRON_SECRET as: Authorization: Bearer <secret>

const SITE_URL = process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app";

function toCTDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(d);
}

function ctMidnight(ctDate: string): Date {
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${ctDate}T12:00:00${offset}`);
    if (toCTDateStr(noon) === ctDate) return new Date(`${ctDate}T00:00:00${offset}`);
  }
  return new Date(`${ctDate}T00:00:00-06:00`);
}

function fmtDisplayDate(ctDate: string): string {
  return new Date(ctDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayCT = toCTDateStr(now);
  const todayMidnight = ctMidnight(todayCT);

  // ── Find all sessions that occurred today ─────────────────────────────────
  // Sessions = distinct (programSlug, ct_date) from SessionAttendance where ct_date = today
  type AttSess = { programSlug: string; ct_date: string };
  const todaySessions = await db.$queryRaw<AttSess[]>`
    SELECT DISTINCT
      "programSlug",
      DATE("joinedAt" AT TIME ZONE 'America/Chicago')::text AS ct_date
    FROM session_attendance
    WHERE DATE("joinedAt" AT TIME ZONE 'America/Chicago') = ${todayCT}::date
  `;

  if (todaySessions.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, notified: 0 });
  }

  // ── Check which sessions have a report ────────────────────────────────────
  const slugsToday = [...new Set(todaySessions.map((s) => s.programSlug))];
  const existingReports = await db.sessionReport.findMany({
    where: {
      programSlug: { in: slugsToday },
      sessionDate: todayMidnight,
    },
    select: { programSlug: true },
  });
  const reportedSlugs = new Set(existingReports.map((r) => r.programSlug));

  const missingSessions = todaySessions.filter((s) => !reportedSlugs.has(s.programSlug));

  if (missingSessions.length === 0) {
    return NextResponse.json({ ok: true, checked: todaySessions.length, notified: 0 });
  }

  // ── Fetch coordinator emails from host-team hub ───────────────────────────
  const hostTeamHub = await db.hub.findUnique({
    where: { slug: "host-team" },
    include: {
      members: {
        where: { isCoordinator: true },
        include: {
          user: { select: { email: true, firstName: true } },
        },
      },
    },
  });

  const coordinators = hostTeamHub?.members ?? [];

  if (coordinators.length === 0) {
    // No coordinators configured — log and exit cleanly
    console.warn("[missing-reports] No coordinators found for host-team hub");
    return NextResponse.json({ ok: true, checked: todaySessions.length, notified: 0 });
  }

  // ── Fetch program names and assigned hosts for missing sessions ───────────
  const uniqueMissingSlugs = [...new Set(missingSessions.map((s) => s.programSlug))];

  const [pgPrograms, assignments] = await Promise.all([
    db.program.findMany({
      where: { slug: { in: uniqueMissingSlugs } },
      select: { slug: true, name: true },
    }),
    db.hostAssignment.findMany({
      where: {
        programSlug: { in: uniqueMissingSlugs },
        sessionDate: todayMidnight,
        userId: { not: null },
      },
      include: {
        user: { select: { firstName: true, lastName: true, preferredName: true } },
      },
    }),
  ]);

  const nameBySlug = new Map(pgPrograms.map((p) => [p.slug, p.name]));
  const hostBySlug = new Map(
    assignments
      .filter((a) => a.userId && a.user)
      .map((a) => [
        a.programSlug,
        a.user!.preferredName || a.user!.firstName || "Host",
      ])
  );

  // ── Send one email per missing session per coordinator ────────────────────
  let notified = 0;

  for (const session of missingSessions) {
    const programName =
      nameBySlug.get(session.programSlug) ?? session.programSlug.replace(/-/g, " ");
    const assignedHostName = hostBySlug.get(session.programSlug) ?? null;
    const dateDisplay = fmtDisplayDate(session.ct_date);
    const detailUrl = `${SITE_URL}/tools/schedule/session/history?detail_slug=${encodeURIComponent(session.programSlug)}&detail_date=${session.ct_date}`;

    for (const coord of coordinators) {
      await sendMissingReportEmail({
        to: coord.user.email,
        programName,
        sessionDateDisplay: dateDisplay,
        assignedHostName,
        detailUrl,
      });
      notified++;
    }
  }

  console.log(
    `[missing-reports] ${todayCT} — ${todaySessions.length} sessions checked, ` +
    `${missingSessions.length} missing, ${notified} emails sent`
  );

  return NextResponse.json({
    ok: true,
    checked: todaySessions.length,
    missing: missingSessions.length,
    notified,
  });
}
