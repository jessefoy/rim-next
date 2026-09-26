const TZ = "America/Chicago";

export function centralMinute(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find(p => p.type === "hour")!.value) * 60 + Number(parts.find(p => p.type === "minute")!.value);
}

/** Uses the schedule's occurrence dates and CT wall time, including across DST.
 * Already-started gatherings and programs without a reliable start are excluded.
 */
export function nextScheduledStart<T extends { startDatetime: Date | null }>(groups: { dateStr: string; programs: T[] }[], now: Date) {
  const today = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const minute = centralMinute(now);
  const candidates = groups.flatMap(group => group.programs.filter(program =>
    program.startDatetime && (group.dateStr > today || (group.dateStr === today && centralMinute(program.startDatetime) > minute))
  ).map(program => ({ dateStr: group.dateStr, program })));
  candidates.sort((a, b) => a.dateStr.localeCompare(b.dateStr) || centralMinute(a.program.startDatetime!) - centralMinute(b.program.startDatetime!));
  return candidates[0] ?? null;
}
