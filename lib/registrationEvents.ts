/**
 * The Registration app's history (2026-10-23): one row for each thing a
 * person or the system did to a program's registrations, shown in the
 * program's History tab and on each person's card. RegistrationEvent in
 * schema.prisma.
 *
 * Recording is best-effort: a failure is logged and never undoes, or fails,
 * the change the registrar made. Registering itself is not recorded here;
 * the registration's own createdAt says when someone signed up.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const REGISTRATION_EVENT_KINDS = [
  "status-changed",
  "dana-changed",
  "answers-edited",
  "note-added",
  "edit-link-sent",
  "reminder-sent",
  "reminders-sent",
  "dana-reminder-sent",
  "confirmation-resent",
  "deleted",
  "downloaded",
  "added",
  "message-sent",
  "printed",
  "settings-changed",
  // What the person did themselves, or the system did: the history reads
  // these with the person's name (or RIM's) in front.
  "dana-given",
  "dana-declined",
  "dana-waived-by-silence",
  "answers-changed-by-them",
] as const;

/** Kinds the person did themselves: the history names them, not an actor. */
export const SELF_EVENT_KINDS: readonly string[] = ["dana-given", "dana-declined", "answers-changed-by-them"];
export type RegistrationEventKind = (typeof REGISTRATION_EVENT_KINDS)[number];

export interface RegistrationEventInput {
  kind: RegistrationEventKind;
  programId?: string | null;
  programSlug: string;
  registrationId?: string | null;
  actorId?: string | null;
  detail?: Prisma.InputJsonValue;
}

export async function recordRegistrationEvent(event: RegistrationEventInput): Promise<void> {
  try {
    await db.registrationEvent.create({
      data: {
        kind: event.kind,
        programId: event.programId ?? null,
        programSlug: event.programSlug,
        registrationId: event.registrationId ?? null,
        actorId: event.actorId ?? null,
        ...(event.detail !== undefined ? { detail: event.detail } : {}),
      },
    });
  } catch (err) {
    console.error("[registrationEvents] record failed:", err);
  }
}

const STATUS_WORDS: Record<string, string> = {
  REGISTERED: "registered",
  APPROVED: "registered",
  WAITLISTED: "waiting",
  CANCELLED: "cancelled",
  PENDING_PAYMENT: "holding a place for dana",
};

const DANA_WORDS: Record<string, string> = {
  NOT_REQUIRED: "not asked",
  PENDING: "not finished",
  COMPLETED: "received",
  WAIVED: "no dana",
};

/** A staff member's name as history and notes show it. */
export function staffName(u: {
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
} | null | undefined): string {
  if (!u) return "Someone";
  return [u.preferredName || u.firstName, u.lastName].filter(Boolean).join(" ") || "Someone";
}

function detailOf(detail: unknown): Record<string, unknown> {
  return detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {};
}

/** The plain sentence a history row reads as, after the actor's name. */
export function describeRegistrationEvent(kind: string, detail: unknown): string {
  const d = detailOf(detail);
  switch (kind) {
    case "status-changed": {
      const from = STATUS_WORDS[String(d.from)] ?? "";
      const to = STATUS_WORDS[String(d.to)] ?? String(d.to ?? "");
      if (d.from === "WAITLISTED" && (d.to === "REGISTERED" || d.to === "APPROVED")) return "offered a place (emailed)";
      if (d.from === "CANCELLED") return `restored the registration (${to})`;
      if (d.to === "CANCELLED") return d.emailed ? "cancelled the registration (emailed)" : "cancelled the registration";
      return from ? `changed ${from} to ${to}` : `set it to ${to}`;
    }
    case "dana-changed":
      return `marked dana ${DANA_WORDS[String(d.to)] ?? String(d.to ?? "")}`;
    case "answers-edited":
      return "edited the answers";
    case "note-added":
      return d.forTeacher ? "wrote a note, for the teacher too" : "wrote a note";
    case "edit-link-sent":
      return "sent a link to change their answers";
    case "reminder-sent":
      return "sent the reminder";
    case "reminders-sent": {
      const n = typeof d.count === "number" ? d.count : 0;
      return `sent the reminder to ${n === 1 ? "1 person" : `${n} people`}${d.scheduled ? ", as scheduled" : ""}`;
    }
    case "dana-reminder-sent":
      return "sent a dana reminder";
    case "confirmation-resent":
      return "sent the confirmation again";
    case "deleted":
      return `deleted the record of ${typeof d.name === "string" ? d.name : "a cancelled registration"}`;
    case "downloaded":
      return "downloaded the spreadsheet";
    case "dana-given":
      return "gave dana online";
    case "dana-declined":
      return "chose not to give dana";
    case "dana-waived-by-silence":
      return "marked no dana: a day passed without a choice";
    case "answers-changed-by-them":
      return "changed their answers from the emailed link";
    case "settings-changed": {
      const c = (d.changes && typeof d.changes === "object" ? d.changes : {}) as Record<string, { from?: unknown; to?: unknown }>;
      const parts: string[] = [];
      if (c.closed) parts.push(c.closed.to ? "closed registration" : "reopened registration");
      if (c.places) parts.push(typeof c.places.to === "number" ? `set places to ${c.places.to}` : "removed the limit on places");
      if (c.closes) {
        parts.push(typeof c.closes.to === "string"
          ? `set the closing date to ${new Date(c.closes.to).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric" })}`
          : "removed the closing date");
      }
      if (c.mailingList) {
        parts.push(`set the mailing list to ${c.mailingList.to === true ? "on" : c.mailingList.to === false ? "off" : "automatic"}`);
      }
      return parts.length ? parts.join(", ") : "changed the registration settings";
    }
    case "printed":
      return "opened the sign-in list to print";
    case "added":
      return d.status === "WAITLISTED" ? "added them to the waiting list" : "added them";
    case "message-sent": {
      const n = typeof d.count === "number" ? d.count : 0;
      const subject = typeof d.subject === "string" ? `: ${d.subject}` : "";
      return `sent a message to ${n === 1 ? "1 person" : `${n} people`}${subject}`;
    }
    default:
      return kind;
  }
}
