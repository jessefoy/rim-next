import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { allVirtualProgramsQuery } from "@/lib/queries";

/**
 * GET /api/cron/seed-host-sessions
 *
 * Daily cron (2:00 AM UTC) — reads all virtual/hybrid programs from Sanity,
 * generates session dates within the next 60 days, and creates unclaimed
 * HostAssignment records (userId = null) for any dates not already in the DB.
 *
 * Safe to run any number of times — purely additive; deduplicates by
 * (programSlug, same calendar day) using a same-day range check rather than
 * exact datetime match, so manually-created sessions are not duplicated.
 *
 * recurrenceCount edge cases (all three handled explicitly):
 *   null        → ongoing program; generate all within window, no DB pre-count
 *   >= 1        → bounded; count ALL existing HostAssignment records for this
 *                 slug (any status, any date) toward the total; if already at
 *                 limit, skip entirely; generate only recurrenceCount - existingCount more
 *
 * Planning nudge: when a calendar month enters the 60-day window for the first
 * time (had zero sessions before this run, now has some), an UNASSIGNED_SESSION
 * alert is created for every hub member (HOST / HOST_MANAGER / ADMIN). Deduplicated
 * to fire at most once per user per announced month within the current calendar month.
 *
 * Vercel passes CRON_SECRET automatically as: Authorization: Bearer <secret>
 */

interface SanityProgram {
  _id: string;
  name: string;
  slug: string;
  startDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  recurrenceCount?: number | null;
}

const DAY_CODES: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

/**
 * Parse wall-clock date/time parts directly from a Sanity ISO datetime string,
 * ignoring the timezone offset. e.g. "2026-03-12T19:00:00.000-06:00" → day=12, hour=19.
 *
 * Why: Sanity datetimes are entered in CT. Vercel/Node runs in UTC. If we called
 * new Date(iso).getDay() we'd get the UTC day, which is wrong for evening sessions
 * (a Thursday 7pm CT event is technically Friday 1am UTC). Extracting the wall-clock
 * parts and building the date with new Date(y, m, d, h, min) in UTC-server-time ensures
 * the stored datetime lands on the correct calendar day for CT users.
 */
function parseWallClock(
  iso: string,
): { year: number; month: number; date: number; hours: number; minutes: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    year: +m[1],
    month: +m[2] - 1, // 0-indexed
    date: +m[3],
    hours: +m[4],
    minutes: +m[5],
  };
}

/** Returns "YYYY-MM" string for a Date. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Generate all candidate session datetimes for a program within [windowStart, windowEnd].
 * Does NOT apply recurrenceCount capping — caller handles that.
 */
function generateCandidates(
  program: SanityProgram,
  windowStart: Date,
  windowEnd: Date,
): Date[] {
  if (!program.startDatetime) return [];

  const wc = parseWallClock(program.startDatetime);
  if (!wc) return [];

  // Build the first occurrence as a wall-clock date (UTC on Vercel = correct calendar day)
  const startWall = new Date(wc.year, wc.month, wc.date, wc.hours, wc.minutes, 0, 0);
  const freq = program.recurrenceFreq ?? null;

  // ── Single event (no recurrence freq) ──────────────────────────────────────
  if (!freq) {
    return startWall >= windowStart && startWall <= windowEnd ? [startWall] : [];
  }

  const interval = Math.max(1, program.recurrenceInterval ?? 1);
  const candidates: Date[] = [];

  // ── Weekly recurrence ───────────────────────────────────────────────────────
  if (freq === "weekly") {
    // Which days of the week to generate (wall-clock day codes from Sanity)
    // Fallback: same day of week as startWall if recurrenceDays is empty
    const targetDays: number[] =
      program.recurrenceDays && program.recurrenceDays.length > 0
        ? [
            ...new Set(
              program.recurrenceDays
                .map((d) => DAY_CODES[d])
                .filter((n) => n !== undefined),
            ),
          ].sort((a, b) => a - b)
        : [startWall.getDay()];

    // Start the week cursor at the Sunday of startWall's week (midnight)
    const weekCursor = new Date(startWall);
    weekCursor.setDate(startWall.getDate() - startWall.getDay());
    weekCursor.setHours(0, 0, 0, 0);

    while (weekCursor <= windowEnd) {
      for (const dayNum of targetDays) {
        const candidate = new Date(weekCursor);
        candidate.setDate(weekCursor.getDate() + dayNum);
        candidate.setHours(wc.hours, wc.minutes, 0, 0);

        if (candidate < startWall) continue;    // before the first occurrence
        if (candidate < windowStart) continue;  // before today
        if (candidate > windowEnd) continue;    // outside window

        candidates.push(new Date(candidate));
      }
      // Advance by interval weeks
      weekCursor.setDate(weekCursor.getDate() + 7 * interval);
    }
  }

  // ── Monthly recurrence ──────────────────────────────────────────────────────
  else if (freq === "monthly") {
    let cursor = new Date(startWall);

    while (cursor <= windowEnd) {
      if (cursor >= startWall && cursor >= windowStart) {
        candidates.push(new Date(cursor));
      }
      // Advance by interval months (same wall-clock day of month)
      const nextRaw = cursor.getMonth() + interval;
      cursor = new Date(
        cursor.getFullYear() + Math.floor(nextRaw / 12),
        nextRaw % 12,
        wc.date,
        wc.hours,
        wc.minutes,
        0,
        0,
      );
    }
  }

  return candidates;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Window: start of today → today + 60 days
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  // ── Pre-query: which months in the window already have sessions? ─────────────
  // Used to detect when a month "just entered the window" (was empty before this run).
  const existingSessionMonths = new Set<string>();
  const preExisting = await db.hostAssignment.findMany({
    where: { sessionDate: { gte: windowStart, lte: windowEnd } },
    select: { sessionDate: true },
  });
  for (const a of preExisting) {
    if (a.sessionDate) existingSessionMonths.add(monthKey(a.sessionDate));
  }

  // ── Fetch all virtual/hybrid programs from Sanity ───────────────────────────
  const programs = await sanityClient.fetch<SanityProgram[]>(allVirtualProgramsQuery);

  let sessionsCreated = 0;
  const newlySeededMonths = new Set<string>(); // months that got any new sessions this run

  for (const program of programs) {
    if (!program.startDatetime) continue;

    // ── Determine how many new sessions we may create ───────────────────────
    // recurrenceCount null → ongoing → no cap
    // recurrenceCount >= 1 → bounded → count ALL existing records for this slug (any status, any date)
    const rCount = program.recurrenceCount ?? null;
    let remaining: number | null = null; // null = no cap

    if (rCount !== null) {
      const existingCount = await db.hostAssignment.count({
        where: { programSlug: program.slug },
      });
      if (existingCount >= rCount) continue; // fully seeded — nothing left to generate
      remaining = rCount - existingCount;
    }

    // ── Generate candidate dates within window ───────────────────────────────
    const candidates = generateCandidates(program, windowStart, windowEnd);
    if (candidates.length === 0) continue;

    // ── Seed sessions (dedup by same calendar day) ───────────────────────────
    // Uses a day-range check rather than exact datetime so manually-created sessions
    // (stored at midnight UTC) are not duplicated by auto-generated ones (stored at
    // the program's wall-clock time).
    let seededThisProgram = 0;

    for (const candidate of candidates) {
      if (remaining !== null && seededThisProgram >= remaining) break;

      const dayStart = new Date(
        candidate.getFullYear(),
        candidate.getMonth(),
        candidate.getDate(),
        0, 0, 0, 0,
      );
      const dayEnd = new Date(
        candidate.getFullYear(),
        candidate.getMonth(),
        candidate.getDate(),
        23, 59, 59, 999,
      );

      const exists = await db.hostAssignment.findFirst({
        where: {
          programSlug: program.slug,
          sessionDate: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true },
      });
      if (exists) continue;

      await db.hostAssignment.create({
        data: {
          programSlug: program.slug,
          sessionDate: candidate,
          userId: null,
          assignedBy: null,
        },
      });

      sessionsCreated++;
      seededThisProgram++;
      newlySeededMonths.add(monthKey(candidate));
    }
  }

  // ── Planning nudge: alert hub members when a new month enters the window ────
  // A month is "new" if it had zero sessions before this run AND got some sessions now.
  let alertsCreated = 0;

  const newMonthsNeedingAlert = [...newlySeededMonths].filter(
    (mk) => !existingSessionMonths.has(mk),
  );

  if (newMonthsNeedingAlert.length > 0) {
    const hubMembers = await db.user.findMany({
      where: {
        roles: { hasSome: ["HOST", "HOST_MANAGER", "ADMIN"] },
        archivedAt: null,
      },
      select: { id: true },
    });

    const calMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    for (const mk of newMonthsNeedingAlert) {
      const [yr, mo] = mk.split("-").map(Number);
      const monthStart = new Date(yr, mo - 1, 1);
      const monthEnd = new Date(yr, mo, 0, 23, 59, 59, 999);

      const monthLabel = new Date(yr, mo - 1, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      // Count unclaimed sessions in this month for the alert message
      const unclaimedCount = await db.hostAssignment.count({
        where: { sessionDate: { gte: monthStart, lte: monthEnd }, userId: null },
      });

      const message = `${monthLabel} sessions are now open for claiming. ${unclaimedCount} session${unclaimedCount !== 1 ? "s" : ""} need${unclaimedCount === 1 ? "s" : ""} a host.`;
      const linkUrl = "/account/host/schedule";

      for (const member of hubMembers) {
        // Dedup: at most one alert per user per announced month within the current cal month
        const dup = await db.alert.findFirst({
          where: {
            userId: member.id,
            type: "UNASSIGNED_SESSION",
            linkUrl,
            message: { contains: monthLabel },
            createdAt: { gte: calMonthStart },
          },
        });
        if (dup) continue;

        await db.alert.create({
          data: {
            userId: member.id,
            type: "UNASSIGNED_SESSION",
            message,
            linkUrl,
          },
        });
        alertsCreated++;
      }
    }
  }

  return NextResponse.json({
    sessionsCreated,
    alertsCreated,
    newMonthsSeeded: [...newlySeededMonths],
  });
}
