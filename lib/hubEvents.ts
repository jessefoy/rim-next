/**
 * The record of what happens on a team's schedule (2026-10-19, the Updates
 * inbox). Most schedule changes overwrite or delete their row (a claim fills
 * an empty seat, a cancellation deletes a sign-up), so Updates could not show
 * them. Every Scheduler write records one line here, beside the change.
 *
 * Who sees what (Jesse, 2026-10-19):
 *   - Taking a session, being put on one, a rotation set up: the whole team.
 *   - Leaving a session outright, being taken off, a rotation ended, leaving
 *     the team: the team's leads and the person themselves. The team sees
 *     the need ("needs a greeter", from coverage_notices), never who left.
 *     Asking for a sub is not leaving: the team is being asked, so it is
 *     named to everyone (sub_requests, read directly).
 *
 * Always record against the session's own team (the assignment's or the
 * rotation's hubSlug), never the viewer's.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ctDateStr } from "@/lib/scheduleUtils";

/**
 * The sessions a change emptied, as "program~YYYY-MM-DD" (Central day), for an
 * event's detail.sessions. Updates' Needs you keys a reopened session by the
 * latest event that emptied it, so a session filled and emptied again is
 * news again even when no gap notice went out.
 */
export function emptiedSessionKeys(rows: { programSlug: string; sessionDate: Date | null; userId?: string | null }[]): string[] {
  return [...new Set(rows.flatMap((r) =>
    r.sessionDate && r.userId !== null ? [`${r.programSlug}~${ctDateStr(r.sessionDate.toISOString())}`] : [],
  ))];
}

export type HubEventKind =
  | "session-taken"
  | "session-assigned"
  | "session-left"
  | "sessions-released"
  | "rotation-set"
  | "rotation-ended"
  | "member-left";

export const HUB_EVENT_KINDS: readonly HubEventKind[] = [
  "session-taken",
  "session-assigned",
  "session-left",
  "sessions-released",
  "rotation-set",
  "rotation-ended",
  "member-left",
];

/** Kinds only the team's leads (and the person they are about) see. */
export const LEADS_ONLY_EVENT_KINDS: readonly HubEventKind[] = [
  "session-left",
  "sessions-released",
  "rotation-ended",
  "member-left",
];

export interface HubEventInput {
  hubSlug: string;
  kind: HubEventKind;
  actorId: string | null;
  subjectUserId: string | null;
  programSlug?: string | null;
  sessionDate?: Date | null;
  count?: number | null;
  detail?: Prisma.InputJsonValue;
}

type Writer = Prisma.TransactionClient | typeof db;

function row(e: HubEventInput) {
  return {
    hubSlug: e.hubSlug,
    kind: e.kind,
    actorId: e.actorId,
    subjectUserId: e.subjectUserId,
    programSlug: e.programSlug ?? null,
    sessionDate: e.sessionDate ?? null,
    count: e.count ?? null,
    ...(e.detail !== undefined ? { detail: e.detail } : {}),
  };
}

/**
 * Record events. Pass the transaction when the change has one, so the record
 * and the change commit together. Without one, a failure is logged and never
 * undoes the change the person made.
 */
export async function recordHubEvents(writer: Writer, events: HubEventInput[]): Promise<void> {
  const rows = events.filter((e) => e.hubSlug).map(row);
  if (rows.length === 0) return;
  if (writer === db) {
    try {
      await db.hubEvent.createMany({ data: rows });
    } catch (err) {
      console.error("[hubEvents] record failed:", err);
    }
    return;
  }
  await writer.hubEvent.createMany({ data: rows });
}

export function recordHubEvent(writer: Writer, event: HubEventInput): Promise<void> {
  return recordHubEvents(writer, [event]);
}
