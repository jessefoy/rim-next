/**
 * Copy a program (2026-10-24, Phase 4 slice 5): a new program that starts as
 * an earlier one (next year's retreat from this year's), through the create
 * path. The editor opens with the copy as its first values; nothing exists
 * until Save, and Save asks for the new dates.
 *
 * Kept: the words, the questions (with new ids), the teachers and helpers,
 * the dana, and the settings. Never kept: the people (nothing of theirs is in
 * the editor's values), the address (a free one is suggested), the dates,
 * the guest link, the mailing-list segment (its on/off choice is kept),
 * archived, a set reminder date (the reminder is counted in days before
 * instead), the closing and opening dates, closed, My Home's show-from date
 * (and the hiding it ended), and the notice. Pure, no imports.
 */

import type { ProgramData } from "@/lib/programTypes";

/** The address for the copy: the original's with the first free number. A
 *  copy's own "-2" is dropped first ("retreat-2" → "retreat-3"); longer
 *  numbers are part of the name ("retreat-2025" → "retreat-2025-2"). */
export function freeSlug(base: string, taken: Set<string>): string {
  const root = base.replace(/-\d$/, "") || "program";
  for (let n = 2; ; n++) {
    const candidate = `${root}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The copy's starting values. `canDecideAskers` (the registration roles):
 * without it every question is the registration team's and no team
 * prepares, as the create route requires.
 */
export function copyForNew(source: ProgramData, opts: { slug: string; canDecideAskers: boolean }): ProgramData {
  const questions = (source.registrationFields ?? []).map((q) => {
    // New ids at the first save; the answers stay with the original.
    const { _key: _k, ...rest } = q;
    void _k;
    if (opts.canDecideAskers) return rest;
    const { askedBy: _a, ...plain } = rest;
    void _a;
    return plain;
  });
  return {
    ...source,
    id: undefined,
    slug: opts.slug,
    startDatetime: "",
    endDatetime: "",
    dateText: "",
    timeText: "",
    registrationClosed: false,
    registrationDeadline: "",
    registrationOpensAt: "",
    registrationFields: questions,
    reminderDate: "",
    // Reminded on a set date before: reminded 2 days before now (the default).
    reminderDaysBefore: source.reminderDaysBefore || (source.reminderDate ? "2" : ""),
    specialAnnouncement: "",
    announcementUntil: "",
    dashboardShowAt: "",
    // Hidden from My Home until a date: without the date that would be hidden
    // for good, so the copy starts shown (review, 2026-10-24).
    removeFromProgramList: source.dashboardShowAt ? false : source.removeFromProgramList,
    guestAccessKey: "",
    flodeskSegmentId: null,
    flodeskSegmentName: null,
    archived: false,
    helperTeams: opts.canDecideAskers ? source.helperTeams ?? [] : [],
  };
}
