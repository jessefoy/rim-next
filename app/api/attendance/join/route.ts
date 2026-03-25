import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ── CT date utilities (inlined — keep in sync with session/page.tsx) ───────────

function ctDateStrFromDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(date);
}

/** Returns midnight CT for the given Date, as a UTC-based Date object. */
function ctMidnight(date: Date): Date {
  const dateStr = ctDateStrFromDate(date);
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${dateStr}T12:00:00${offset}`);
    if (ctDateStrFromDate(noon) === dateStr) {
      return new Date(`${dateStr}T00:00:00${offset}`);
    }
  }
  return new Date(`${dateStr}T00:00:00-06:00`); // fallback CST
}

/** Shift an anchor ISO datetime to today's equivalent time. */
function shiftToTodayDate(anchorISO: string, today: Date): Date {
  const anchor = new Date(anchorISO);
  const anchorCT = ctDateStrFromDate(anchor);
  const todayCT = ctDateStrFromDate(today);
  if (anchorCT === todayCT) return anchor;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round(
    (new Date(todayCT + "T12:00:00").getTime() - new Date(anchorCT + "T12:00:00").getTime())
    / msPerDay
  );
  return new Date(anchor.getTime() + daysDiff * msPerDay);
}

// ── Session window guard ───────────────────────────────────────────────────────

/**
 * Returns true if `now` falls within 1 hour before startDatetime to 1 hour after
 * endDatetime for the program (shifted to today's occurrence for recurring programs).
 * Returns true if the program has no startDatetime — missing data never blocks attendance.
 */
async function isWithinSessionWindow(slug: string, now: Date): Promise<boolean> {
  const program = await db.program.findUnique({
    where: { slug },
    select: { startDatetime: true, endDatetime: true },
  });

  if (!program?.startDatetime) return true; // no data → allow

  const startToday = shiftToTodayDate(program.startDatetime.toISOString(), now);
  const endToday = program.endDatetime
    ? shiftToTodayDate(program.endDatetime.toISOString(), now)
    : new Date(startToday.getTime() + 3 * 60 * 60_000); // default 3-hour duration

  const windowStart = new Date(startToday.getTime() - 60 * 60_000); // 1h before
  const windowEnd   = new Date(endToday.getTime()   + 60 * 60_000); // 1h after

  return now >= windowStart && now <= windowEnd;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { programId, programSlug } = body ?? {};

  if (!programId || !programSlug) {
    return NextResponse.json(
      { error: "programId and programSlug are required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date();

  // ── Session-ended hard cutoff ──────────────────────────────────────────────
  // If a host has manually closed this session, block new attendance regardless
  // of the time window. Check DB first — faster than a Sanity fetch.
  const sessionDate = ctMidnight(now);
  const existingReport = await db.sessionReport.findUnique({
    where: { programSlug_sessionDate: { programSlug, sessionDate } },
    select: { sessionEndedAt: true },
  });
  if (existingReport?.sessionEndedAt) {
    return NextResponse.json({ ok: true }); // silently blocked — session is closed
  }

  // ── Time window guard ──────────────────────────────────────────────────────
  // Clicks outside the scheduled session window return 200 silently — no error to member.
  const inWindow = await isWithinSessionWindow(programSlug, now);
  if (!inWindow) {
    return NextResponse.json({ ok: true });
  }

  // ── Upsert: update joinedAt if record exists, create if new ──────────────
  const existing = await db.sessionAttendance.findUnique({
    where: { userId_programSlug_sessionDate: { userId, programSlug, sessionDate } },
  });

  if (existing) {
    // Re-click: just freshen the joinedAt timestamp
    await db.sessionAttendance.update({
      where: { id: existing.id },
      data: { joinedAt: now },
    });
    return NextResponse.json({ id: existing.id });
  }

  // ── New attendance record ────────────────────────────────────────────────
  // (Attendance email system removed — isNewMember/returningAfterAbsence
  //  computation and sendFirstTimeAttendeeEmail/sendReturningAfterAbsenceEmail removed.)
  const record = await db.sessionAttendance.create({
    data: {
      userId,
      programId,
      programSlug,
      sessionDate,
      joinedAt: now,
    },
  });

  return NextResponse.json({ id: record.id });
}
