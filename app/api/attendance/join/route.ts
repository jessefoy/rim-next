import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import {
  sendFirstTimeAttendeeEmail,
  sendReturningAfterAbsenceEmail,
} from "@/lib/email";

const SIX_WEEKS_MS = 6 * 7 * 24 * 60 * 60 * 1000;

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
  const program = await sanityClient.fetch<{
    startDatetime: string | null;
    endDatetime: string | null;
  } | null>(
    `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0]{
      startDatetime, endDatetime
    }`,
    { slug }
  );

  if (!program?.startDatetime) return true; // no data → allow

  const startToday = shiftToTodayDate(program.startDatetime, now);
  const endToday = program.endDatetime
    ? shiftToTodayDate(program.endDatetime, now)
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

  // ── New record — compute isNewMember / returningAfterAbsence ─────────────
  const priorCount = await db.sessionAttendance.count({ where: { userId } });
  const isNewMember = priorCount === 0;

  let returningAfterAbsence = false;
  if (!isNewMember) {
    const lastRecord = await db.sessionAttendance.findFirst({
      where: { userId },
      orderBy: { joinedAt: "desc" },
      select: { joinedAt: true },
    });
    if (lastRecord && now.getTime() - lastRecord.joinedAt.getTime() >= SIX_WEEKS_MS) {
      returningAfterAbsence = true;
    }
  }

  const record = await db.sessionAttendance.create({
    data: {
      userId,
      programId,
      programSlug,
      sessionDate,
      joinedAt: now,
      isNewMember,
      returningAfterAbsence,
    },
  });

  // ── Automated emails (disabled by default) ────────────────────────────────
  // Gated by ENABLE_ATTENDANCE_EMAILS env var. Do not enable until copy is approved.
  if (process.env.ENABLE_ATTENDANCE_EMAILS === "true") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, preferredName: true },
    });
    if (user) {
      const name = user.preferredName || user.firstName || "there";
      if (isNewMember) {
        sendFirstTimeAttendeeEmail({ to: user.email, firstName: name }).catch(
          (e) => console.error("[attendance/join] first-time email failed:", e)
        );
      } else if (returningAfterAbsence) {
        sendReturningAfterAbsenceEmail({ to: user.email, firstName: name }).catch(
          (e) => console.error("[attendance/join] returning email failed:", e)
        );
      }
    }
  }

  return NextResponse.json({ id: record.id });
}
