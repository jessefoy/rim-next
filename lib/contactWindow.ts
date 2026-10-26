/**
 * How long a teacher, and a team that prepares, keep a program's list of who
 * came, with their email and phone, after it ends (Jesse, 2026-10-26): 30
 * days, time for a thank-you and any follow-up; then it closes to them. The
 * registration team (and the Guiding Teacher, who works in Registration)
 * keeps it as always.
 *
 * A one-time program ends on its last day (its end, or its start), or when
 * it's archived first (cancelled). A weekly or monthly series with a set
 * number of sessions ends on its last session (Jesse, 2026-10-26; the caller passes it,
 * lib/scheduleUtils.ts lastOccurrenceEnd), or when archived first; any
 * other repeating program when it's archived. Pure, no imports.
 */

export const CONTACT_DAYS_AFTER = 30;

export interface ContactWindowProgram {
  startDatetime: Date | string | null;
  endDatetime: Date | string | null;
  recurrenceFreq: string | null;
  archivedAt: Date | string | null;
}

/** When the list closes to teachers and helping teams, or null while the
 *  program hasn't ended. */
export function contactsCloseAt(p: ContactWindowProgram, lastSessionEnd?: Date | null): Date | null {
  const archived = p.archivedAt ? new Date(p.archivedAt) : null;
  const last = p.endDatetime ?? p.startDatetime;
  const lastDay = !p.recurrenceFreq && last
    ? new Date(last)
    : p.recurrenceFreq && lastSessionEnd
      ? lastSessionEnd
      : null;
  const ended =
    archived && lastDay ? (archived < lastDay ? archived : lastDay) : (archived ?? lastDay);
  if (!ended) return null;
  return new Date(ended.getTime() + CONTACT_DAYS_AFTER * 24 * 60 * 60 * 1000);
}

/** Whether the list has closed to teachers and helping teams. */
export function contactsClosed(p: ContactWindowProgram, now: Date = new Date(), lastSessionEnd?: Date | null): boolean {
  const at = contactsCloseAt(p, lastSessionEnd);
  return !!at && now >= at;
}

/** Whether the program has ended (its list may still be open for its 30
 *  days): archived, past its last day, or past a series' last class. */
export function hasEnded(p: ContactWindowProgram, now: Date = new Date(), lastSessionEnd?: Date | null): boolean {
  if (p.archivedAt) return true;
  const at = contactsCloseAt(p, lastSessionEnd);
  if (!at) return false;
  const ended = new Date(at.getTime() - CONTACT_DAYS_AFTER * 24 * 60 * 60 * 1000);
  return now > ended;
}
