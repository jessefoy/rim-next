/**
 * Per-occurrence Zoom meeting orchestration — server-only.
 *
 * RIM keeps the orchestration; lib/zoom.ts holds the thin Zoom primitives. This
 * is the "get-or-create the meeting for this occurrence on a free seat" layer:
 *   - idempotent on (programSlug, sessionDate) — repeat "join" clicks reuse the
 *     same meeting; the unique index makes this SAME-occurrence path race-safe (a
 *     create-race loser deletes its just-created Zoom meeting, never orphaning);
 *   - picks a pool seat with no overlapping meeting (throws NoSeatAvailableError
 *     past the seat count). NOTE: the seat pick is a read-then-create that is NOT
 *     yet serialized across DIFFERENT occurrences — two overlapping occurrences
 *     provisioned in the same instant could both pick one seat. Not reachable
 *     until this is wired to real concurrent provisioning (only the serial
 *     admin self-test calls it today); close it then with a transaction-scoped
 *     advisory lock around pick+create, as the Step-In single-slot path does.
 */

import { db } from "@/lib/db";
import { createMeeting, deleteMeeting } from "@/lib/zoom";

const SEAT_USER_IDS = [
  process.env.ZOOM_SEAT_A_EMAIL,
  process.env.ZOOM_SEAT_B_EMAIL,
].filter(Boolean) as string[];

/** Number of configured Zoom pool seats — the max concurrent sessions RIM can host. */
export function zoomSeatCount(): number {
  return SEAT_USER_IDS.length;
}

/** Thrown when every pool seat is already hosting during the requested window. */
export class NoSeatAvailableError extends Error {
  constructor(seatCount: number) {
    super(
      `All ${seatCount} Zoom seat(s) are busy during this time — RIM supports up to ${seatCount} concurrent sessions.`,
    );
    this.name = "NoSeatAvailableError";
  }
}

export interface ProvisionInput {
  programSlug: string;
  /** Canonical occurrence start instant (the occurrence key). */
  sessionDate: Date;
  /** Occurrence end instant. */
  endTime: Date;
  topic: string;
  recordToCloud?: boolean;
}

/**
 * Return the Zoom meeting for an occurrence, creating it on a free seat if it
 * doesn't exist yet. Idempotent on (programSlug, sessionDate).
 */
export async function getOrCreateSessionMeeting(input: ProvisionInput) {
  const { programSlug, sessionDate, endTime } = input;

  // 1. Reuse if already provisioned.
  const existing = await db.sessionMeeting.findUnique({
    where: { programSlug_sessionDate: { programSlug, sessionDate } },
  });
  if (existing) return existing;

  if (SEAT_USER_IDS.length === 0) {
    throw new Error(
      "No Zoom pool seats configured (ZOOM_SEAT_A_EMAIL / ZOOM_SEAT_B_EMAIL).",
    );
  }

  // 2. Pick a seat with no overlapping meeting.
  const overlapping = await db.sessionMeeting.findMany({
    where: { sessionDate: { lt: endTime }, endTime: { gt: sessionDate } },
    select: { seatUserId: true },
  });
  const busy = new Set(overlapping.map((m) => m.seatUserId));
  // NOTE (see header): this pick is not yet lock-serialized across different
  // overlapping occurrences — add a transaction-scoped advisory lock when wired
  // to real concurrent provisioning.
  const seatUserId = SEAT_USER_IDS.find((s) => !busy.has(s));
  if (!seatUserId) throw new NoSeatAvailableError(SEAT_USER_IDS.length);

  // 3. Create the Zoom meeting on that seat.
  const durationMinutes = Math.max(
    1,
    Math.round((endTime.getTime() - sessionDate.getTime()) / 60_000),
  );
  const meeting = await createMeeting({
    seatUserId,
    topic: input.topic,
    startTime: sessionDate.toISOString(),
    durationMinutes,
    recordToCloud: input.recordToCloud,
  });

  // 4. Store the row. If we lost a create race, delete our orphan + return the winner.
  try {
    return await db.sessionMeeting.create({
      data: {
        programSlug,
        sessionDate,
        endTime,
        seatUserId,
        zoomMeetingId: String(meeting.id),
        recordToCloud: input.recordToCloud ?? false,
      },
    });
  } catch (err) {
    const winner = await db.sessionMeeting.findUnique({
      where: { programSlug_sessionDate: { programSlug, sessionDate } },
    });
    if (winner) {
      await deleteMeeting(meeting.id).catch((e) =>
        console.error("[sessionMeeting] orphan cleanup failed", meeting.id, e),
      );
      return winner;
    }
    throw err;
  }
}

/** Tear down an occurrence's meeting: delete the Zoom meeting, then the row. Returns false if there was nothing to delete. */
export async function deleteSessionMeeting(
  programSlug: string,
  sessionDate: Date,
): Promise<boolean> {
  const row = await db.sessionMeeting.findUnique({
    where: { programSlug_sessionDate: { programSlug, sessionDate } },
  });
  if (!row) return false;
  await deleteMeeting(row.zoomMeetingId).catch((e) =>
    console.error("[sessionMeeting] zoom delete failed", row.zoomMeetingId, e),
  );
  await db.sessionMeeting.delete({ where: { id: row.id } });
  return true;
}

/**
 * Tear down a program's provisioned meetings (Zoom + rows). Used when a program
 * stops using Zoom, leaves virtual/hybrid format, or is deleted. `futureOnly`
 * keeps past occurrences as a record (used on settings changes); pass false to
 * remove everything (used on program delete). Returns the count removed.
 */
export async function teardownProgramMeetings(
  programSlug: string,
  opts: { futureOnly: boolean; notBefore?: Date },
): Promise<number> {
  // `notBefore` lets a caller protect occurrences whose entry window is already
  // open (a host may be staging in the room) — see the schedule-edit teardown,
  // which passes now + EARLY_OPEN_MIN so it never deletes a meeting out from
  // under a host who's already in it.
  const where = opts.futureOnly
    ? { programSlug, sessionDate: { gte: opts.notBefore ?? new Date() } }
    : { programSlug };
  const rows = await db.sessionMeeting.findMany({ where });
  for (const row of rows) {
    await deleteMeeting(row.zoomMeetingId).catch((e) =>
      console.error("[sessionMeeting] zoom delete failed", row.zoomMeetingId, e),
    );
  }
  if (rows.length > 0) {
    await db.sessionMeeting.deleteMany({
      where: { id: { in: rows.map((r) => r.id) } },
    });
  }
  return rows.length;
}
