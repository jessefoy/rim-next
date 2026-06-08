/**
 * Session-window helper for LiveKit room access.
 *
 * Computes whether a program has an active session right now — i.e. whether
 * the room should be reachable. The window opens EARLY_OPEN_MIN (30) minutes
 * before the program's start time — the host prep + emergency-entry window —
 * and closes LATE_GRACE_MIN (30) minutes after the program's end time. If
 * endDatetime is null, falls back to FALLBACK_DURATION_MIN (90) minutes. All
 * three live in ./sessionWindowConstants (shared with the dashboard entry
 * tiers and the Scheduler "Enter room" link, so the timing can't drift).
 *
 * Used by /api/livekit/token and /api/livekit/guest-token to refuse token
 * issuance outside the window. ADMIN and GUIDING_TEACHER bypass at the
 * route level (safety override; mirrors hasEndAllAuthority).
 *
 * Returns the active sessionDate so the token + chat code can build a
 * per-date room name. Per-date room names mean each session of a
 * recurring program starts with a clean chat history.
 */
import { db } from "./db";
import {
  ctDateStr,
  isOccurrenceOnDate,
  nextOccurrenceOnOrAfter,
  shiftToDate,
  type ScheduleProgram,
} from "./scheduleUtils";
import {
  EARLY_OPEN_MIN,
  LATE_GRACE_MIN,
  FALLBACK_DURATION_MIN,
} from "./sessionWindowConstants";

const TZ = "America/Chicago";

/**
 * Shift uses scheduleUtils.shiftToDate to stay aligned with the schedule
 * tool that creates HostAssignment rows. That helper has a known DST drift
 * (24-hour increments, not wall-clock-preserving across DST boundaries) —
 * the entire schedule subsystem has the same drift, so this helper inherits
 * it deliberately. Forking to a DST-correct shift here would mismatch the
 * timestamps the rest of the codebase produces. Fixing shiftToDate
 * platform-wide is a separate undertaking.
 */

export type SessionWindowReason =
  | "before-window"
  | "after-window"
  | "no-session-today"
  | "no-future-session";

export interface ActiveSessionWindow {
  active: true;
  /**
   * ISO timestamp matching the program's start moment shifted to today.
   * Aligns with the value the schedule tool writes to
   * HostAssignment.sessionDate, so `new Date(sessionDate)` lookups in
   * resolveSessionRole hit existing rows exactly. roomNameForProgram
   * strips this to the first 10 chars (YYYY-MM-DD) for the room suffix.
   */
  sessionDate: string;
  opensAt: Date;
  closesAt: Date;
  startsAt: Date;
  endsAt: Date;
}

export interface InactiveSessionWindow {
  active: false;
  reason: SessionWindowReason;
  /** ISO timestamp of the next session start, or null if no future session
   *  is scheduled. Format matches ActiveSessionWindow.sessionDate. */
  nextSessionDate: string | null;
  nextStartsAt: Date | null;
  nextOpensAt: Date | null;
}

export type SessionWindow = ActiveSessionWindow | InactiveSessionWindow;

/**
 * Decide whether a program has a session open for entry right now.
 *
 * Edge case: programs that genuinely cross midnight are not handled — the
 * helper only checks today's CT date, not yesterday's. No RIM program
 * currently runs past midnight CT, so this is a known limitation rather
 * than a real-world issue.
 */
export function getActiveSessionWindow(
  program: ScheduleProgram,
  now: Date = new Date(),
): SessionWindow {
  if (!program.startDatetime) {
    return {
      active: false,
      reason: "no-future-session",
      nextSessionDate: null,
      nextStartsAt: null,
      nextOpensAt: null,
    };
  }

  const todayCT = ctDateStr(now.toISOString());
  const anchorIso = program.startDatetime.toISOString();

  if (isOccurrenceOnDate(program, todayCT)) {
    const startsAt = shiftToDate(anchorIso, todayCT);
    const endsAt = program.endDatetime
      ? shiftToDate(program.endDatetime.toISOString(), todayCT)
      : new Date(startsAt.getTime() + FALLBACK_DURATION_MIN * 60_000);
    const opensAt = new Date(startsAt.getTime() - EARLY_OPEN_MIN * 60_000);
    const closesAt = new Date(endsAt.getTime() + LATE_GRACE_MIN * 60_000);

    if (now >= opensAt && now <= closesAt) {
      return {
        active: true,
        sessionDate: startsAt.toISOString(),
        opensAt,
        closesAt,
        startsAt,
        endsAt,
      };
    }
    if (now < opensAt) {
      return {
        active: false,
        reason: "before-window",
        nextSessionDate: startsAt.toISOString(),
        nextStartsAt: startsAt,
        nextOpensAt: opensAt,
      };
    }
    // Past today's close — fall through to find a later occurrence.
  }

  // Look for the next future occurrence starting tomorrow (or today if no
  // session happened today). Cap at 90 days; programs that never run again
  // return no-future-session.
  const todayPastWindow = isOccurrenceOnDate(program, todayCT);
  const searchFromMs =
    new Date(todayCT + "T12:00:00Z").getTime() +
    (todayPastWindow ? 24 * 60 * 60 * 1000 : 0);
  const searchFromCT = ctDateStr(new Date(searchFromMs).toISOString());
  const nextDate = nextOccurrenceOnOrAfter(program, searchFromCT);

  if (!nextDate) {
    return {
      active: false,
      reason: todayPastWindow ? "after-window" : "no-future-session",
      nextSessionDate: null,
      nextStartsAt: null,
      nextOpensAt: null,
    };
  }

  const nextStartsAt = shiftToDate(anchorIso, nextDate);
  const nextOpensAt = new Date(nextStartsAt.getTime() - EARLY_OPEN_MIN * 60_000);

  return {
    active: false,
    reason: todayPastWindow ? "after-window" : "no-session-today",
    nextSessionDate: nextStartsAt.toISOString(),
    nextStartsAt,
    nextOpensAt,
  };
}

/**
 * Build a human-readable explanation for an inactive window. Plain English
 * for the /session/[slug] page error state.
 */
export function describeInactiveWindow(w: InactiveSessionWindow): string {
  if (w.reason === "before-window" && w.nextStartsAt) {
    const time = w.nextStartsAt.toLocaleTimeString("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
    });
    return `This session isn't open yet — it begins at ${time}.`;
  }
  if (w.reason === "after-window") {
    return "This session has ended.";
  }
  if (w.reason === "no-session-today" && w.nextSessionDate && w.nextStartsAt) {
    const day = w.nextStartsAt.toLocaleDateString("en-US", {
      timeZone: TZ,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const time = w.nextStartsAt.toLocaleTimeString("en-US", {
      timeZone: TZ,
      hour: "numeric",
      minute: "2-digit",
    });
    return `No session right now. The next one is ${day} at ${time}.`;
  }
  return "This program has no upcoming sessions.";
}

export type SessionDateAssertion =
  | { ok: true; window: ActiveSessionWindow }
  | { ok: false; status: number; error: string; message: string };

/**
 * Server-side defense-in-depth check for action routes (mute-participant,
 * mute-all, end-session, step-in, chat). Verifies the program has an open
 * session and the caller-supplied `sessionDate` matches it. ADMIN and
 * GUIDING_TEACHER bypass — same safety-override model as the token routes.
 *
 * Without this, an authorized client could POST an arbitrary `sessionDate`
 * (e.g. yesterday's, tomorrow's, or a fabricated one) and have the action
 * routes construct a roomName the server would target. The blast radius
 * for mute/end is low (empty rooms; deleting empty LiveKit rooms is a
 * no-op), but step-in WRITES a HostAssignment — that one matters.
 *
 * Returns the resolved window on success so callers can avoid a second
 * computation when they need the canonical sessionDate.
 */
export async function assertSessionDateInWindow(
  programSlug: string,
  sessionDate: string | undefined,
  roles: string[],
): Promise<SessionDateAssertion> {
  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
    },
  });
  if (!program) {
    return { ok: false, status: 404, error: "not-found", message: "Program not found" };
  }

  const isAdminOrGT = roles.includes("ADMIN") || roles.includes("GUIDING_TEACHER");
  const window = getActiveSessionWindow(program);

  if (window.active) {
    if (sessionDate && sessionDate !== window.sessionDate && !isAdminOrGT) {
      return {
        ok: false,
        status: 403,
        error: "session-date-mismatch",
        message: "This action targets a different session than the one currently open.",
      };
    }
    return { ok: true, window };
  }

  if (isAdminOrGT) {
    // Bypass: synthesize an active window for the caller-supplied or
    // computed sessionDate, mirroring the token route's bypass shape.
    const fallback = sessionDate
      ? sessionDate
      : program.startDatetime
        ? shiftToDate(
            program.startDatetime.toISOString(),
            ctDateStr(new Date().toISOString()),
          ).toISOString()
        : new Date().toISOString();
    return {
      ok: true,
      window: {
        active: true,
        sessionDate: fallback,
        opensAt: new Date(),
        closesAt: new Date(),
        startsAt: new Date(),
        endsAt: new Date(),
      },
    };
  }

  return {
    ok: false,
    status: 403,
    error: "session-closed",
    message: describeInactiveWindow(window),
  };
}
