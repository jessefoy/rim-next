/**
 * The Flodesk program-segment rules, free of server code so the Program
 * Manager can show the same answer the server acts on. See lib/flodesk.ts.
 */

/** Private and Service programs never feed a mailing list unless switched on. */
const EXCLUDED_BY_DEFAULT = new Set(["PRIVATE", "SERVICE"]);

export function programUsesFlodesk(p: {
  registrationEnabled: boolean;
  offeringCategory: string | null;
  flodeskSync: boolean | null;
}): boolean {
  if (p.flodeskSync !== null) return p.flodeskSync;
  return p.registrationEnabled && !EXCLUDED_BY_DEFAULT.has(p.offeringCategory ?? "");
}

/**
 * "Day of Mindfulness 06/06/26": Jesse's existing naming. An ongoing program
 * (repeats with no end) or one with no date gets its name alone.
 */
export function programSegmentName(p: {
  name: string;
  startDatetime: Date | string | null;
  recurrenceFreq: string | null;
  recurrenceCount: number | null;
}): string {
  const ongoing = !!p.recurrenceFreq && !p.recurrenceCount;
  const start = p.startDatetime ? new Date(p.startDatetime) : null;
  if (!start || Number.isNaN(start.getTime()) || ongoing) return p.name.trim();
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(start);
  return `${p.name.trim()} ${date}`;
}

