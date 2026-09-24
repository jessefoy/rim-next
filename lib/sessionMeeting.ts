/**
 * Per-occurrence Zoom meeting orchestration — server-only.
 *
 * RIM keeps the orchestration; lib/zoom.ts holds the thin Zoom primitives. This
 * is the "get-or-create the meeting for this occurrence on a free seat" layer:
 *   - idempotent on (programSlug, sessionDate) — repeat "join" clicks reuse the
 *     same meeting;
 *   - every pick-and-create runs under one transaction-scoped Postgres advisory
 *     lock, so two overlapping occurrences provisioned at the same instant can't
 *     both take one seat, and two members opening the same occurrence can't
 *     create two meetings (the unique index stays as a backstop);
 *   - seat choice respects the entry windows, not only the session times. A
 *     Zoom seat can run one meeting at a time, and people arrive before a
 *     session starts and linger after it ends, so a seat is preferred only if
 *     no other meeting's window touches this one's. Back-to-back sessions fall
 *     back to sharing a seat only when every seat is otherwise in use, and
 *     truly overlapping sessions never share one (NoSeatAvailableError).
 */

import { db } from "@/lib/db";
import { createMeeting, deleteMeeting, setMeetingAutoRecording } from "@/lib/zoom";
import { EARLY_OPEN_MIN, LATE_GRACE_MIN } from "@/lib/sessionWindowConstants";

/**
 * The Zoom pool seats. ZOOM_SEAT_EMAILS (comma-separated) lists every seat, so
 * a third licensed seat is a settings change, not a code change; the original
 * ZOOM_SEAT_A_EMAIL / ZOOM_SEAT_B_EMAIL pair is still read when it isn't set.
 */
const SEAT_USER_IDS = (
  process.env.ZOOM_SEAT_EMAILS
    ? process.env.ZOOM_SEAT_EMAILS.split(",")
    : [process.env.ZOOM_SEAT_A_EMAIL, process.env.ZOOM_SEAT_B_EMAIL]
)
  .map((s) => s?.trim())
  .filter((s): s is string => !!s);

/** Configured pool seats, in preference order. */
export function zoomSeatIds(): string[] {
  return [...SEAT_USER_IDS];
}

/** Number of configured Zoom pool seats — the max concurrent sessions RIM can host. */
export function zoomSeatCount(): number {
  return SEAT_USER_IDS.length;
}

/** Minutes a seat stays reserved around a meeting: early arrivals + late leavers. */
const SEAT_BUFFER_BEFORE_MS = EARLY_OPEN_MIN * 60_000;
const SEAT_BUFFER_AFTER_MS = LATE_GRACE_MIN * 60_000;

/** One lock key for all seat provisioning (any stable 32-bit integer). */
const SEAT_LOCK_KEY = 74_210_417;

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

  // 1. Reuse if already provisioned (the common case: no lock needed).
  const existing = await db.sessionMeeting.findUnique({
    where: { programSlug_sessionDate: { programSlug, sessionDate } },
  });
  if (existing) return existing;

  if (SEAT_USER_IDS.length === 0) {
    throw new Error(
      "No Zoom pool seats configured (ZOOM_SEAT_EMAILS, or ZOOM_SEAT_A_EMAIL / ZOOM_SEAT_B_EMAIL).",
    );
  }

  // The Zoom meeting this call creates, if any, so a failure after creating
  // it (e.g. the commit) can remove it instead of leaving it on a seat.
  let createdZoomId: number | null = null;

  try {
    return await db.$transaction(
      async (tx) => {
        // Serialize every seat pick. Held until this transaction ends, which
        // includes the Zoom create call (itself capped at 10s): a second
        // provisioner waits here, then sees this one's row. The wait is capped
        // too, so a stuck provisioner can't stall everyone behind it.
        await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '15s'`);
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${SEAT_LOCK_KEY}::bigint)`);

        const again = await tx.sessionMeeting.findUnique({
          where: { programSlug_sessionDate: { programSlug, sessionDate } },
        });
        if (again) return again;

        // 2. Pick a seat. Meetings whose padded windows touch ours make a seat
        //    "tight"; meetings whose actual times overlap ours make it busy.
        const paddedStart = new Date(sessionDate.getTime() - SEAT_BUFFER_BEFORE_MS);
        const paddedEnd = new Date(endTime.getTime() + SEAT_BUFFER_AFTER_MS);
        const nearby = await tx.sessionMeeting.findMany({
          where: {
            sessionDate: { lt: new Date(paddedEnd.getTime() + SEAT_BUFFER_BEFORE_MS) },
            endTime: { gt: new Date(paddedStart.getTime() - SEAT_BUFFER_AFTER_MS) },
          },
          select: { seatUserId: true, sessionDate: true, endTime: true },
        });
        const busy = new Set<string>();
        const tight = new Set<string>();
        for (const m of nearby) {
          if (m.sessionDate < endTime && m.endTime > sessionDate) {
            busy.add(m.seatUserId);
          } else {
            tight.add(m.seatUserId);
          }
        }
        const seatUserId =
          SEAT_USER_IDS.find((s) => !busy.has(s) && !tight.has(s)) ??
          SEAT_USER_IDS.find((s) => !busy.has(s));
        if (!seatUserId) throw new NoSeatAvailableError(SEAT_USER_IDS.length);
        if (tight.has(seatUserId)) {
          console.warn(
            `[sessionMeeting] ${programSlug} @ ${sessionDate.toISOString()} shares seat ${seatUserId} back-to-back; every other seat is in use.`,
          );
        }

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
        createdZoomId = meeting.id;

        // 4. Store the row (the outer catch removes the meeting if this fails).
        return await tx.sessionMeeting.create({
          data: {
            programSlug,
            sessionDate,
            endTime,
            seatUserId,
            zoomMeetingId: String(meeting.id),
            recordToCloud: input.recordToCloud ?? false,
          },
        });
      },
      // The Zoom call happens inside the lock; give it room.
      { maxWait: 20_000, timeout: 30_000 },
    );
  } catch (err) {
    // Backstop for anything that slipped past the lock (e.g. a row written by
    // an older deployment mid-rollout): the unique index keeps one winner.
    const winner = await db.sessionMeeting.findUnique({
      where: { programSlug_sessionDate: { programSlug, sessionDate } },
    });
    if (createdZoomId !== null && winner?.zoomMeetingId !== String(createdZoomId)) {
      const orphan = createdZoomId;
      await deleteMeeting(orphan).catch((e) =>
        console.error("[sessionMeeting] orphan cleanup failed", orphan, e),
      );
    }
    if (winner) return winner;
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

/**
 * Apply a program's Record setting to meetings that already exist and haven't
 * ended, so turning Record on (or off) in the editor affects the next session
 * even when its meeting was provisioned before the change. Returns the count
 * updated; a meeting Zoom refuses is logged and skipped.
 */
export async function applyProgramRecordingSetting(
  programSlug: string,
  recordToCloud: boolean,
): Promise<number> {
  const rows = await db.sessionMeeting.findMany({
    where: { programSlug, endTime: { gt: new Date() }, recordToCloud: { not: recordToCloud } },
  });
  let updated = 0;
  for (const row of rows) {
    try {
      await setMeetingAutoRecording(row.zoomMeetingId, recordToCloud);
      await db.sessionMeeting.update({ where: { id: row.id }, data: { recordToCloud } });
      updated++;
    } catch (e) {
      console.error("[sessionMeeting] recording update failed", row.zoomMeetingId, e);
    }
  }
  return updated;
}
