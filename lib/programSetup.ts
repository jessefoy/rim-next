/**
 * Setting up a program, step by step (2026-10-28, Phase 2). The questions, in
 * the order a person decides them, as plain functions over the program's
 * editor values: when each step applies, what it needs before Continue, and
 * how its answer reads in the trail and the review. The walk-through, the
 * review and (later) the RIM Guide read this one file, so they can't disagree.
 * Design: mockups/program-setup-2026-10-28/ (CONCEPT.md, BUILD_PLAN.md).
 *
 * A draft holds the editor's own values (ProgramData, the shape the shapes,
 * copies and the save already use) plus `recurrenceUntil`, `listFirst` and
 * `setup`, the walk-through's own choices that the values can't say yet ("not
 * chosen", which one of the month). Publish turns it into the save's body
 * (setupToBody) and makes the program through createProgram.
 *
 * No server imports: the walk-through runs it in the browser.
 */

import type { ProgramData } from "@/components/registrar/ProgramEditor";
import { centralToUtc } from "@/lib/timezone";
import { isOccurrenceOnDate, lastOccurrenceDate, monthlyPatternPhrase, type ScheduleProgram } from "@/lib/scheduleUtils";
import { deriveDayOfWeek, slugify } from "@/lib/programUtils";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

export type Often = "once" | "days" | "weekly" | "biweekly" | "monthly";
export type Ends = "never" | "count" | "date";

/** The walk-through's own choices. */
export interface SetupChoices {
  often: Often | null;
  /** Monthly: which one of the month (1 to 4, or "last") and which day (0 = Sunday). */
  monthWeek: 1 | 2 | 3 | 4 | "last" | null;
  monthDay: number | null;
  ends: Ends | null;
  /** "come" = open entry, "register", "both". */
  join: "come" | "register" | "both" | null;
  /** "team" = a hosting team runs it, "none" = no host needed. */
  host: "team" | "none" | null;
  noTeacher: boolean;
  room: "rim" | "outside";
  /** Registration opens when published, or on a date; closes when it begins, or on a date. */
  opens: "publish" | "date";
  closes: "begins" | "date";
  limit: "none" | "some";
  remind: "days" | "date" | "none";
  /** The time of each session (or a stay's arrival and leaving), "HH:mm", Central. */
  timeFrom: string;
  timeTo: string;
  /** The step to come back to, and the steps reached. */
  at: string;
  seen: string[];
  /** An answer that needs choosing again after a change, and why (by step). */
  redo?: Record<string, string>;
  /** A copy's suggested address, kept while its name is still the original's. */
  copySlug?: string;
  copyName?: string;
}

export type SetupData = ProgramData & {
  /** A series that ends on a date, "YYYY-MM-DD" (Central), or "". */
  recurrenceUntil: string;
  /** Shown first in its section on Programs & Events. */
  listFirst: boolean;
  setup: SetupChoices;
};

/** A program with nothing chosen yet: the editor's own defaults. */
export function blankSetup(): SetupData {
  return {
    slug: "", name: "", tagline: "", programImage: "", description: "", pullQuote: "", pullQuoteSource: "", programNotes: "",
    teacherFacilitators: [], programTeachers: [], categoryId: "",
    offeringCategory: "", offeringFormat: "", silentMeditation: false, hostedByVolunteers: false, openEntry: false,
    dateText: "", timeText: "", programFormat: "in-person", venue: "at-rim", locationText: "", locationLink: "",
    startDatetime: "", endDatetime: "", recurrenceFreq: "", recurrenceInterval: "", recurrenceDays: [], recurrenceCount: "",
    registrationEnabled: false, registrationClosed: false, registrationCapacity: "", registrationDeadline: "", registrationOpensAt: "",
    registrationFields: [], confirmationMessage: "", reminderDate: "", reminderDaysBefore: "2", reminderMessage: "",
    followUpEnabled: false, followUpMessage: "",
    danaMode: "none", suggestedDana: "", danaBaseAmount: "", danaFixedAmount: "", danaMessage: "", danaText: "",
    specialAnnouncement: "", announcementUntil: "", earlyArrivalMessage: "", hideFromDashboard: false, dayOfWeek: [], sortOrder: "",
    removeFromProgramList: false, dashboardShowAt: "", hideFromProgramPageList: false, hideFromWeeklySchedule: false, hideWhenPast: true,
    isOpenAccess: false, guestAccessKey: "", hostingHubSlug: null, hostingRequired: true, recordByDefault: false,
    outsideMeetingUrl: "", outsideMeetingPublic: false, coverageHubSlugs: [], helperTeams: [],
    recurrenceUntil: "", listFirst: false,
    setup: {
      often: null, monthWeek: null, monthDay: null, ends: null, join: null, host: null, noTeacher: false, room: "rim",
      opens: "publish", closes: "begins", limit: "none", remind: "days", timeFrom: "19:00", timeTo: "20:00", at: "name", seen: [],
    },
  };
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORD = ["", "1st", "2nd", "3rd", "4th"];
const weekdayOf = (ymd: string) => new Date(ymd + "T12:00:00Z").getUTCDay();

/** The walk-through's choices read from the program's values (a shape, a copy). */
export function choicesFrom(d: ProgramData & Partial<Pick<SetupData, "recurrenceUntil" | "listFirst">>, base?: Partial<SetupChoices>): SetupChoices {
  const freq = (d.recurrenceFreq || "").toUpperCase();
  const startDay = d.startDatetime ? d.startDatetime.slice(0, 10) : "";
  const endDay = d.endDatetime ? d.endDatetime.slice(0, 10) : "";
  let often: Often | null = null;
  if (freq === "WEEKLY") often = Number(d.recurrenceInterval || 1) === 2 ? "biweekly" : "weekly";
  else if (freq === "MONTHLY") often = "monthly";
  else if (!freq && startDay) often = endDay && endDay !== startDay ? "days" : "once";
  let monthWeek: SetupChoices["monthWeek"] = null;
  let monthDay: number | null = null;
  if (often === "monthly" && startDay) {
    monthDay = weekdayOf(startDay);
    const phrase = monthlyPatternPhrase(startDay);
    monthWeek = phrase.startsWith("last") ? "last" : (Number(phrase[0]) as 1 | 2 | 3 | 4);
  }
  const count = Number(d.recurrenceCount || 0);
  const ends: Ends | null = often && often !== "once" && often !== "days"
    ? (count >= 2 ? "count" : d.recurrenceUntil ? "date" : startDay ? "never" : null)
    : null;
  const join = d.registrationEnabled && d.openEntry ? "both" : d.registrationEnabled ? "register" : d.openEntry ? "come" : null;
  return {
    often, monthWeek, monthDay, ends, join,
    host: d.hostingRequired === false ? "none" : "team",
    noTeacher: false,
    room: d.outsideMeetingUrl ? "outside" : "rim",
    opens: d.registrationOpensAt ? "date" : "publish",
    closes: d.registrationDeadline ? "date" : "begins",
    limit: d.registrationCapacity ? "some" : "none",
    remind: d.reminderDaysBefore ? "days" : d.reminderDate ? "date" : "none",
    timeFrom: d.startDatetime ? d.startDatetime.slice(11, 16) : "19:00",
    timeTo: d.endDatetime ? d.endDatetime.slice(11, 16) : "20:00",
    at: "name",
    seen: [],
    ...base,
  };
}

// ─── The schedule ──────────────────────────────────────────────────────────

const day = (local: string) => (local ? local.slice(0, 10) : "");

/** The schedule as the site's one rule reads it (lib/scheduleUtils.ts). */
export function scheduleOf(d: SetupData): ScheduleProgram {
  return {
    id: "", name: d.name, slug: d.slug, programFormat: d.programFormat,
    startDatetime: centralToUtc(d.startDatetime), endDatetime: centralToUtc(d.endDatetime),
    recurrenceFreq: d.recurrenceFreq || null,
    recurrenceInterval: d.recurrenceInterval ? Number(d.recurrenceInterval) : null,
    recurrenceDays: d.recurrenceDays,
    recurrenceCount: d.recurrenceCount ? Number(d.recurrenceCount) : null,
    recurrenceUntil: d.recurrenceUntil ? new Date(d.recurrenceUntil + "T12:00:00Z") : null,
  };
}

const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd + "T12:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

/** Every session day ("YYYY-MM-DD"), from the first, up to `max`. */
export function sessionDays(d: SetupData, max = 400): string[] {
  const first = day(d.startDatetime);
  if (!first) return [];
  if (!d.recurrenceFreq) return [first];
  const p = scheduleOf(d);
  const last = lastOccurrenceDate(p);
  const out: string[] = [];
  for (let i = 0; i < 3660 && out.length < max; i++) {
    const ymd = addDays(first, i);
    if (last && ymd > last) break;
    if (isOccurrenceOnDate(p, ymd)) out.push(ymd);
  }
  return out;
}

/** Does the pattern meet on this day (the first session's choice, before there is one)? */
export function patternFits(s: SetupChoices, days: string[], ymd: string): boolean {
  const wd = weekdayOf(ymd);
  if (s.often === "weekly" || s.often === "biweekly") return days.includes(DAY_CODES[wd]);
  if (s.often === "monthly") {
    if (s.monthDay == null || !s.monthWeek || wd !== s.monthDay) return false;
    const n = Math.ceil(Number(ymd.slice(8, 10)) / 7);
    const isLast = Number(addDays(ymd, 7).slice(8, 10)) < Number(ymd.slice(8, 10));
    // A day that is both the 4th and the last of its month is read as "the
    // last" (lib/scheduleUtils.ts, from the first session), so a 4th starts
    // in a month with five of that day.
    return s.monthWeek === "last" ? isLast : s.monthWeek === 4 ? n === 4 && !isLast : n === s.monthWeek;
  }
  return true;
}

export function fmtTime(hm: string): string {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""} ${h >= 12 ? "PM" : "AM"}`;
}
/** "7 to 7:45 PM", or "11:30 AM to 1 PM" when the half of the day changes. */
export function timeRange(from: string, to: string): string {
  if (!from || !to) return "";
  const a = fmtTime(from), b = fmtTime(to);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} to ${b}` : `${a} to ${b}`;
}
/** Minutes from `from` to `to`, the same day. */
export function minutesBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const m = (x: string) => Number(x.slice(0, 2)) * 60 + Number(x.slice(3, 5));
  return m(to) - m(from);
}
export function lengthWords(mins: number | null): string {
  if (mins == null) return "";
  if (mins <= 0) return "ends before it begins";
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h ? `${h} hour${h > 1 ? "s" : ""}` : "", m ? `${m} minutes` : ""].filter(Boolean).join(" ");
}
export function fmtLong(ymd: string): string {
  return `${DAY_NAMES[weekdayOf(ymd)]}, ${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}
export function fmtShort(ymd: string): string {
  return `${DAY_NAMES[weekdayOf(ymd)].slice(0, 3)} ${MONTHS[Number(ymd.slice(5, 7)) - 1].slice(0, 3)} ${Number(ymd.slice(8, 10))}`;
}
function dayList(codes: string[]): string {
  const names = DAY_CODES.map((c, i) => (codes.includes(c) ? DAY_NAMES[i] + "s" : null)).filter(Boolean) as string[];
  // Monday first, as on This Week.
  if (names[0] === "Sundays") names.push(names.shift()!);
  return names.length < 3 ? names.join(" and ") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

/** The pattern alone: "Fridays", "Every other Wednesday", "The last Sunday of each month". */
export function patternWords(d: SetupData): string {
  const s = d.setup;
  if (s.often === "weekly" && d.recurrenceDays.length) return dayList(d.recurrenceDays);
  if (s.often === "biweekly" && d.recurrenceDays.length) return "Every other " + dayList(d.recurrenceDays).replace(/s( and |, |$)/g, "$1");
  if (s.often === "monthly" && s.monthDay != null && s.monthWeek) {
    return `The ${s.monthWeek === "last" ? "last" : ORD[s.monthWeek]} ${DAY_NAMES[s.monthDay]} of each month`;
  }
  return "";
}

/** The one sentence that says what the schedule is. */
export function scheduleSentence(d: SetupData): string {
  const s = d.setup;
  const t = timeRange(d.setup.timeFrom, d.setup.timeTo);
  const first = day(d.startDatetime);
  if (s.often === "once") return first ? `${fmtLong(first)}${t ? ", " + t : ""}.` : "";
  if (s.often === "days") {
    const last = day(d.endDatetime);
    return first && last ? `${fmtLong(first)}, from ${fmtTime(d.setup.timeFrom)}, to ${fmtLong(last)}, ${fmtTime(d.setup.timeTo)}.` : "";
  }
  const pattern = patternWords(d);
  return pattern ? `${pattern}${t ? ", " + t : ""}.` : "";
}

/**
 * Put the walk-through's schedule choices into the program's values: the
 * first day and times into the start and end (a repeating program's end is
 * on its first day; a stay's on its last), the pattern into the recurrence,
 * and how it ends into the count or the end date. Called after every change.
 */
export function applySchedule(d: SetupData, lastDay?: string): SetupData {
  const s = d.setup;
  const first = day(d.startDatetime);
  const last = s.often === "days" ? (lastDay ?? day(d.endDatetime)) : first;
  const next: SetupData = { ...d };
  next.startDatetime = first ? `${first}T${s.timeFrom}` : "";
  next.endDatetime = first && last ? `${last}T${s.timeTo}` : "";
  if (s.often === "weekly" || s.often === "biweekly") {
    next.recurrenceFreq = "WEEKLY";
    next.recurrenceInterval = s.often === "biweekly" ? "2" : "1";
  } else if (s.often === "monthly") {
    next.recurrenceFreq = "MONTHLY";
    next.recurrenceInterval = "1";
    next.recurrenceDays = [];
  } else {
    next.recurrenceFreq = "";
    next.recurrenceInterval = "";
    next.recurrenceDays = [];
  }
  if (!repeats(next) || s.ends === "never" || !s.ends) {
    next.recurrenceCount = "";
    next.recurrenceUntil = "";
  } else if (s.ends === "count") next.recurrenceUntil = "";
  else if (s.ends === "date") next.recurrenceCount = "";
  return next;
}

// ─── The steps ─────────────────────────────────────────────────────────────

export const SETUP_SECTIONS = [
  { id: "about", name: "About" },
  { id: "when", name: "When and where" },
  { id: "teams", name: "Teachers and teams" },
  { id: "join", name: "How people join" },
  { id: "tell", name: "Messages to those who register" },
  { id: "dana", name: "Dana" },
  { id: "appears", name: "Where it appears" },
] as const;
export type SetupSection = (typeof SETUP_SECTIONS)[number]["id"];

export const online = (d: SetupData) => d.programFormat === "virtual" || d.programFormat === "hybrid";
export const inPerson = (d: SetupData) => d.programFormat !== "virtual";
export const repeats = (d: SetupData) => ["weekly", "biweekly", "monthly"].includes(d.setup.often ?? "");
export const registers = (d: SetupData) => d.registrationEnabled;

export interface SetupStep {
  id: string;
  sec: SetupSection;
  /** The question, as asked. */
  q: (d: SetupData) => string;
  applies?: (d: SetupData) => boolean;
  /** What it needs before Continue, said plainly; null when it can go on. */
  need?: (d: SetupData) => string | null;
  /** Worth a look, but not blocking. */
  look?: (d: SetupData) => string | null;
  optional?: boolean;
  /** The answer, short, for the trail. */
  answer: (d: SetupData) => string;
  /** The answer as a sentence, for the review and the program's page. */
  says?: (d: SetupData) => string;
}

const CATEGORY_NAMES: Record<string, string> = {
  FOUNDATIONS: "Foundations", ONGOING_LEARNING_PRACTICE: "Ongoing Learning & Practice", IMMERSION: "Immersion",
  COMMUNITY_GROUP: "Community Group", SPECIAL_EVENT: "Special Event", SERVICE: "Service", PRIVATE: "Private",
};
export const FORMAT_NAMES: Record<string, string> = {
  DROP_IN: "Drop-in", CLASS: "Class", COURSE: "Course", WORKSHOP: "Workshop", DAY_OF_MINDFULNESS: "Day of mindfulness", RETREAT: "Retreat",
};
const THREE_WAYS = ["FOUNDATIONS", "ONGOING_LEARNING_PRACTICE", "IMMERSION"];
/** Rich text as words, whether stored as HTML or (an older program, copied) as blocks. */
const plain = (value: unknown) => {
  const html = typeof value === "string" ? value : value ? renderBlockNoteHtml(value) : "";
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
};
const whole = (v: string | undefined, min: number, max = 100_000) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
};
const sessionsWord = (n: number) => `${n} session${n === 1 ? "" : "s"}`;

export const SETUP_STEPS: SetupStep[] = [
  // ═══ About ═══
  { id: "name", sec: "about", q: () => "What is it called?",
    need: (d) => (d.name.trim() ? null : "Give it a name to go on."),
    answer: (d) => d.name, says: (d) => `It's called ${d.name}.` },
  { id: "line", sec: "about", q: () => "Say what it is, in one line.", optional: true,
    answer: (d) => d.tagline || "No line yet",
    says: (d) => (d.tagline ? `Its line: “${d.tagline}”` : "It has no one-line description yet.") },
  { id: "describe", sec: "about", q: () => "Tell people about it.",
    look: (d) => (plain(d.description) ? null : "Without a description the program's page has nothing to read. You can come back to it before you publish."),
    answer: (d) => (plain(d.description) ? "Description written" : "No description yet"),
    says: (d) => (plain(d.description) ? `The description is written${d.programImage ? ", with a picture" : ""}.` : "There's no description yet.") },
  { id: "extras", sec: "about", optional: true, q: () => "Anything more for its page?",
    need: (d) => (d.pullQuoteSource.trim() && !d.pullQuote.trim() ? "Add the quote, or clear who said it." : null),
    answer: (d) => [d.pullQuote && "A quote", plain(d.programNotes) && "Notes"].filter(Boolean).join(" and ") || "Nothing more",
    says: (d) => (d.pullQuote || plain(d.programNotes) ? `${[d.pullQuote && "A quote", plain(d.programNotes) && "notes"].filter(Boolean).join(" and ")} on its page.` : "No quote or notes on its page.") },

  // ═══ When and where ═══
  { id: "where", sec: "when", q: () => "Where does it meet?",
    answer: (d) => ({ "in-person": "In person", virtual: "Online", hybrid: "In person and online" }[d.programFormat] ?? "") },
  { id: "place", sec: "when", applies: inPerson, q: () => "Where, in person?",
    need: (d) => (d.venue === "other" && !d.locationText.trim() ? "Write the place and its address." : null),
    answer: (d) => (d.venue === "other" ? d.locationText || "Somewhere else" : "At RIM") },
  { id: "room", sec: "when", applies: online, q: () => "Which online room?",
    need: (d) => {
      if (d.setup.room !== "outside") return null;
      const c = cleanOutsideMeetingUrl(d.outsideMeetingUrl ?? "");
      return !c.ok ? c.error : !c.value ? "Paste the meeting link, or choose RIM's Zoom." : null;
    },
    answer: (d) => (d.setup.room === "outside" ? "Someone else's meeting" : "RIM's Zoom" + (d.recordByDefault ? ", recorded" : "")) },
  { id: "often", sec: "when", q: () => "How often does it meet?",
    need: (d) => (d.setup.often ? null : "Choose how often it meets."),
    answer: (d) => ({ once: "Once", days: "Several days in a row", weekly: "Every week", biweekly: "Every other week", monthly: "Once a month" }[d.setup.often ?? "once"] ?? "") },
  { id: "days", sec: "when", applies: repeats, q: (d) => (d.setup.often === "monthly" ? "Which day of the month?" : "On which days?"),
    need: (d) => (d.setup.often === "monthly"
      ? (d.setup.monthWeek && d.setup.monthDay != null ? null : "Choose which one and which day.")
      : d.recurrenceDays.length ? null : "Choose at least one day."),
    answer: (d) => patternWords(d) },
  { id: "time", sec: "when", q: (d) => (d.setup.often === "days" ? "What time does it begin and end?" : "What time?"),
    need: (d) => {
      const mins = minutesBetween(d.setup.timeFrom, d.setup.timeTo);
      return d.setup.often !== "days" && mins != null && mins <= 0 ? "It ends before it begins. Check the times, AM and PM too." : null;
    },
    look: (d) => {
      const mins = minutesBetween(d.setup.timeFrom, d.setup.timeTo);
      return d.setup.often !== "days" && mins != null && mins > 240 ? `That's ${lengthWords(mins)}. Is that right? If you meant the afternoon or evening, check AM and PM.` : null;
    },
    answer: (d) => timeRange(d.setup.timeFrom, d.setup.timeTo) },
  { id: "first", sec: "when", q: (d) => (d.setup.often === "once" ? "Which day?" : d.setup.often === "days" ? "Which days?" : "When is the first session?"),
    need: (d) => (!day(d.startDatetime) ? "Choose the day." : d.setup.often === "days" && !(day(d.endDatetime) > day(d.startDatetime)) ? "Choose the last day." : null),
    answer: (d) => {
      const f = day(d.startDatetime);
      if (!f) return "Not chosen yet";
      if (d.setup.often === "days") return day(d.endDatetime) > f ? `${fmtShort(f)} to ${fmtShort(day(d.endDatetime))}` : `From ${fmtShort(f)}`;
      return (repeats(d) ? "Starting " : "") + fmtLong(f);
    } },
  { id: "ends", sec: "when", applies: repeats, q: () => "When does it end?",
    need: (d) => (!d.setup.ends ? "Choose how it ends."
      : d.setup.ends === "count" && !whole(d.recurrenceCount, 2, 200) ? "How many sessions? A whole number, at least 2."
      : d.setup.ends === "date" && !d.recurrenceUntil ? "Choose the last session." : null),
    answer: (d) => {
      if (d.setup.ends === "never") return "Goes on";
      const n = sessionDays(d);
      return n.length ? `${sessionsWord(n.length)}, to ${fmtShort(n[n.length - 1])}` : "Once the first session is chosen";
    } },
  { id: "daynote", sec: "when", optional: true, q: () => "A line for the day itself?",
    answer: (d) => d.earlyArrivalMessage || "No line",
    says: (d) => (d.earlyArrivalMessage ? `On the day: “${d.earlyArrivalMessage}”` : "No line for the day.") },

  // ═══ Teachers and teams ═══
  { id: "teachers", sec: "teams", q: () => "Who teaches it?",
    need: (d) => (d.programTeachers.length || d.setup.noTeacher ? null : "Choose a teacher, or tick “No teacher for this one.”"),
    answer: (d) => (d.programTeachers.length ? d.programTeachers.map((t) => `${t.firstName} ${t.lastName}`).join(", ") : "No teacher"),
    says: (d) => (d.programTeachers.length ? `Taught by ${d.programTeachers.map((t) => `${t.firstName} ${t.lastName}`).join(" and ")}.` : "No teacher.") },
  { id: "host", sec: "teams", applies: online, q: () => "Does a host run the online room?",
    need: (d) => (d.setup.host ? null : "Choose who hosts it."),
    answer: (d) => (d.setup.host === "none" ? "No host needed" : !d.hostingHubSlug ? "The Hosting Team hosts" : "Its hosting team hosts"),
    says: (d) => (d.setup.host === "none" ? "No host: it's self-led. The room still opens at session times." : !d.hostingHubSlug ? "The Hosting Team hosts each session." : "Its hosting team hosts each session.") },
  { id: "support", sec: "teams", optional: true, q: () => "Which teams help at each session?",
    answer: (d) => ((d.coverageHubSlugs ?? []).length ? `${(d.coverageHubSlugs ?? []).length} team${(d.coverageHubSlugs ?? []).length > 1 ? "s" : ""}` : "No other teams") },
  { id: "prepare", sec: "teams", optional: true, q: () => "Does a team prepare for it?",
    answer: (d) => ((d.helperTeams ?? []).length ? "A team prepares" : "No team prepares") },

  // ═══ How people join ═══
  { id: "join", sec: "join", q: () => "How do people join?",
    need: (d) => (d.setup.join ? null : "Choose how people join."),
    answer: (d) => ({ come: "They just come", register: "They register first", both: "Register, or just come" }[d.setup.join ?? "come"] ?? ""),
    says: (d) => ({ come: "People just come: anyone signed in may join, with no sign-up.", register: "People register first.", both: "People can register, and anyone signed in may also just come." }[d.setup.join ?? "come"] ?? "") },
  { id: "guests", sec: "join", applies: online, optional: true, q: () => "And people without a RIM account?",
    answer: (d) => (d.outsideMeetingPublic ? "Anyone, from the page" : d.isOpenAccess ? "Guests with the link" : "Members only"),
    says: (d) => (d.outsideMeetingPublic ? "Anyone can join from the program's page." : d.isOpenAccess ? "Guests can join with the guest link, around session times." : "Only people with a RIM account can join.") },
  { id: "opens", sec: "join", applies: registers, q: () => "When can people register?",
    need: (d) => (d.setup.opens === "date" && !d.registrationOpensAt ? "Choose the day registration opens." : d.setup.closes === "date" && !d.registrationDeadline ? "Choose the last day to register." : null),
    answer: (d) => `${d.setup.opens === "date" && d.registrationOpensAt ? "Opens " + fmtShort(day(d.registrationOpensAt)) : "Opens when published"}, ${d.setup.closes === "date" && d.registrationDeadline ? "closes " + fmtShort(day(d.registrationDeadline)) : "until it begins"}`,
    says: (d) => `Registration opens ${d.setup.opens === "date" && d.registrationOpensAt ? "on " + fmtLong(day(d.registrationOpensAt)) : "as soon as it's published"}, and stays open ${d.setup.closes === "date" && d.registrationDeadline ? "through " + fmtLong(day(d.registrationDeadline)) : "until it begins"}.` },
  { id: "places", sec: "join", applies: registers, q: () => "How many places?",
    need: (d) => (d.setup.limit === "some" && !whole(d.registrationCapacity, 1) ? "How many places? A whole number." : null),
    answer: (d) => (d.setup.limit === "some" ? `${d.registrationCapacity} places` : "No limit"),
    says: (d) => (d.setup.limit === "some" ? `${d.registrationCapacity} places, then a waiting list.` : "No limit on places.") },
  { id: "questions", sec: "join", applies: registers, optional: true, q: () => "What would you like to ask them?",
    need: (d) => (d.registrationFields.some((f) => !f.label.trim()) ? "Each question needs its words, or remove it." : d.registrationFields.some((f) => f.fieldType === "select" && f.options.filter(Boolean).length < 2) ? "A choice needs at least two answers to choose from." : null),
    answer: (d) => (d.registrationFields.length ? `${d.registrationFields.length} question${d.registrationFields.length === 1 ? "" : "s"}` : "No questions"),
    says: (d) => (d.registrationFields.length ? `${d.registrationFields.length} question${d.registrationFields.length > 1 ? "s" : ""} on the form: ${d.registrationFields.map((f) => `“${f.label}”`).join(", ")}.` : "No questions on the form.") },

  // ═══ Messages to those who register ═══
  { id: "confirm", sec: "tell", applies: registers, optional: true, q: () => "What should the confirmation say?",
    answer: (d) => (plain(d.confirmationMessage) ? "Confirmation written" : "The confirmation, as it comes"),
    says: (d) => (plain(d.confirmationMessage) ? `The confirmation adds: “${plain(d.confirmationMessage).slice(0, 140)}”` : "The confirmation has the day, the time and how to join.") },
  { id: "reminder", sec: "tell", applies: registers, q: () => "When should the reminder go?",
    need: (d) => (d.setup.remind === "days" && !whole(d.reminderDaysBefore, 1, 60) ? "Choose a whole number of days, from 1 to 60." : d.setup.remind === "date" && !d.reminderDate ? "Choose the day." : null),
    answer: (d) => ({ days: `${d.reminderDaysBefore} days before`, date: d.reminderDate ? "On " + fmtShort(day(d.reminderDate)) : "On a date", none: "No reminder" }[d.setup.remind]),
    says: (d) => ({ days: `A reminder goes ${d.reminderDaysBefore} days before the first session.`, date: `A reminder goes on ${d.reminderDate ? fmtLong(day(d.reminderDate)) : "a date"}.`, none: "No reminder." }[d.setup.remind]) },
  { id: "after", sec: "tell", applies: (d) => registers(d) && !repeats(d), optional: true, q: () => "A note the day after it ends?",
    need: (d) => (d.followUpEnabled && !plain(d.followUpMessage) ? "Write the note, or choose No note." : null),
    answer: (d) => (d.followUpEnabled ? "A note the day after" : "No note after"),
    says: (d) => (d.followUpEnabled ? "A note goes the day after it ends." : "No note after.") },

  // ═══ Dana ═══
  { id: "dana", sec: "dana", q: () => "How is dana offered?",
    answer: (d) => ({ none: "No dana step", voluntary: "Dana invited" + (d.suggestedDana ? `, $${d.suggestedDana} suggested` : ""), base_plus_dana: `$${d.danaBaseAmount || "?"} plus dana`, fixed: `$${d.danaFixedAmount || "?"}` }[d.danaMode] ?? ""),
    says: (d) => ({ none: "There's no dana step.", voluntary: `Dana is invited${d.suggestedDana ? `, with $${d.suggestedDana} suggested` : ""}.`, base_plus_dana: `$${d.danaBaseAmount || "?"}, plus dana as people choose.`, fixed: `A fixed $${d.danaFixedAmount || "?"}.` }[d.danaMode] ?? ""),
    need: (d) => (d.danaMode === "base_plus_dana" && !(Number(d.danaBaseAmount) > 0) ? "Write the set amount." : d.danaMode === "fixed" && !(Number(d.danaFixedAmount) > 0) ? "Write the amount." : null) },
  { id: "danaWords", sec: "dana", applies: (d) => d.danaMode !== "none", optional: true, q: () => "What do people read when they give?",
    answer: (d) => (plain(d.danaMessage) ? "Dana words written" : "No dana words"),
    says: (d) => (plain(d.danaMessage) ? `At the dana step: “${plain(d.danaMessage).slice(0, 140)}”` : "No words at the dana step yet.") },

  // ═══ Where it appears ═══
  { id: "category", sec: "appears", q: () => "Which of RIM's ways does it belong to?",
    need: (d) => (d.offeringCategory ? null : "Choose where it belongs. It's how it's listed."),
    answer: (d) => CATEGORY_NAMES[d.offeringCategory] ?? "",
    says: (d) => (["PRIVATE", "SERVICE"].includes(d.offeringCategory) ? `It's ${CATEGORY_NAMES[d.offeringCategory]}, so it's never listed.` : `It belongs to ${CATEGORY_NAMES[d.offeringCategory] ?? ""}.`) },
  { id: "kind", sec: "appears", q: () => "What kind of offering is it?",
    need: (d) => (d.offeringFormat || !THREE_WAYS.includes(d.offeringCategory) ? null : "Choose what kind it is. Foundations, Ongoing Learning & Practice and Immersion each need one."),
    answer: (d) => [FORMAT_NAMES[d.offeringFormat] ?? "No kind", d.silentMeditation && d.offeringFormat === "DROP_IN" && "silent", d.hostedByVolunteers && "hosted by volunteers"].filter(Boolean).join(", "),
    says: (d) => `${d.offeringFormat ? `It's a ${FORMAT_NAMES[d.offeringFormat].toLowerCase()}` : "It has no kind"}${d.silentMeditation && d.offeringFormat === "DROP_IN" ? ", a silent sit" : ""}${d.hostedByVolunteers ? ", hosted by volunteers" : ""}.` },
  { id: "show", sec: "appears", optional: true, q: () => "Where should people find it?",
    answer: (d) => [
      !d.hideFromProgramPageList && !["PRIVATE", "SERVICE"].includes(d.offeringCategory) && "Programs & Events" + (d.listFirst ? " (first)" : ""),
      !d.hideFromProgramPageList && !d.hideFromWeeklySchedule && "This Week",
      online(d) && !d.removeFromProgramList && "My Home",
    ].filter(Boolean).join(", ") || "Only by its link",
    says: (d) => {
      const w = [
        !d.hideFromProgramPageList && !["PRIVATE", "SERVICE"].includes(d.offeringCategory) && "Programs & Events",
        !d.hideFromProgramPageList && !d.hideFromWeeklySchedule && "This Week",
        online(d) && !d.removeFromProgramList && "My Home on the days it meets",
      ].filter(Boolean);
      return (w.length ? `People find it on ${w.join(", ")}.` : "Only people with its link can find it.") + (d.listFirst ? " It's shown first in its section." : "");
    } },
];

/** The steps that apply to this program, in order. */
export function liveSteps(d: SetupData, section?: SetupSection): SetupStep[] {
  return SETUP_STEPS.filter((st) => (!st.applies || st.applies(d)) && (!section || st.sec === section));
}

/** Everything Publish needs that isn't there yet, each with its step. */
export function missingForPublish(d: SetupData): { step: SetupStep; need: string }[] {
  return liveSteps(d).flatMap((st) => {
    const need = st.need?.(d);
    return need ? [{ step: st, need }] : [];
  });
}

// ─── Publish: the save's body ──────────────────────────────────────────────

/** The address from the name, unless one was chosen. */
export function slugFor(d: SetupData): string {
  if (d.setup.copySlug && d.name.trim() === (d.setup.copyName ?? "").trim()) return d.setup.copySlug;
  return slugify(d.name);
}

/**
 * The body createProgram takes, as the editor's Save builds it (keep the two
 * in step until the old editor retires in Phase 3): every value from the
 * draft, with the walk-through's choices applied.
 */
export function setupToBody(d: SetupData, opts: { supportingTeams: string[]; hostingTeams: string[] }): Record<string, unknown> {
  const reg = d.registrationEnabled;
  return {
    ...(typeof d.flodeskSync === "boolean" ? { flodeskSync: d.flodeskSync } : {}),
    name: d.name.trim(),
    slug: slugFor(d),
    tagline: d.tagline,
    programImage: d.programImage || null,
    description: d.description,
    pullQuote: d.pullQuote.trim(),
    pullQuoteSource: d.pullQuoteSource.trim(),
    programNotes: d.programNotes,
    teacherFacilitators: d.teacherFacilitators,
    teacherIds: d.programTeachers.map((t) => t.id),
    categoryId: d.categoryId || null,
    offeringCategory: d.offeringCategory,
    offeringFormat: d.offeringFormat,
    silentMeditation: d.offeringFormat === "DROP_IN" && d.silentMeditation,
    hostedByVolunteers: d.hostedByVolunteers,
    openEntry: d.openEntry,
    programFormat: d.programFormat,
    venue: d.venue,
    locationText: d.venue === "other" ? d.locationText : "",
    locationLink: d.venue === "other" ? d.locationLink : "",
    startDatetime: d.startDatetime || null,
    endDatetime: d.endDatetime || null,
    recurrenceFreq: d.recurrenceFreq || null,
    recurrenceInterval: d.recurrenceInterval ? Number(d.recurrenceInterval) : null,
    recurrenceDays: d.recurrenceDays,
    recurrenceCount: d.recurrenceCount ? Number(d.recurrenceCount) : null,
    recurrenceUntil: d.recurrenceUntil || null,
    registrationEnabled: reg,
    registrationClosed: false,
    registrationCapacity: reg && d.setup.limit === "some" && d.registrationCapacity ? Number(d.registrationCapacity) : null,
    registrationDeadline: reg && d.setup.closes === "date" && d.registrationDeadline ? d.registrationDeadline : null,
    registrationOpensAt: reg && d.setup.opens === "date" && d.registrationOpensAt ? d.registrationOpensAt : null,
    registrationFields: reg && d.registrationFields.length > 0 ? d.registrationFields : null,
    confirmationMessage: d.confirmationMessage,
    reminderDate: reg && d.setup.remind === "date" && d.reminderDate ? d.reminderDate : null,
    reminderDaysBefore: reg && d.setup.remind === "days" && d.reminderDaysBefore ? Number(d.reminderDaysBefore) : null,
    reminderMessage: d.reminderMessage,
    followUpEnabled: reg && !d.recurrenceFreq && !!d.followUpEnabled,
    followUpMessage: d.followUpMessage,
    danaMode: d.danaMode,
    suggestedDana: d.suggestedDana ? Number(d.suggestedDana) : null,
    danaBaseAmount: d.danaBaseAmount ? Number(d.danaBaseAmount) : null,
    danaFixedAmount: d.danaFixedAmount ? Number(d.danaFixedAmount) : null,
    danaMessage: d.danaMessage,
    danaText: d.danaText,
    earlyArrivalMessage: d.earlyArrivalMessage,
    hideFromDashboard: d.hideFromDashboard,
    dayOfWeek: deriveDayOfWeek(d.recurrenceFreq, d.recurrenceDays, d.startDatetime),
    removeFromProgramList: d.removeFromProgramList,
    dashboardShowAt: d.removeFromProgramList && d.dashboardShowAt ? d.dashboardShowAt : null,
    hideFromProgramPageList: d.hideFromProgramPageList,
    hideFromWeeklySchedule: d.hideFromWeeklySchedule,
    hideWhenPast: d.hideWhenPast,
    listFirst: d.listFirst,
    isOpenAccess: online(d) && d.isOpenAccess,
    // A hosting team only for an online program, and only one that staffs
    // its format; an in-person program keeps the default.
    hostingHubSlug: online(d) && d.setup.host === "team" && d.hostingHubSlug && opts.hostingTeams.includes(d.hostingHubSlug) ? d.hostingHubSlug : null,
    hostingRequired: online(d) ? d.setup.host !== "none" : true,
    recordByDefault: online(d) && d.setup.room === "rim" && !!d.recordByDefault,
    outsideMeetingUrl: online(d) && d.setup.room === "outside" ? d.outsideMeetingUrl || null : null,
    outsideMeetingPublic: online(d) && d.setup.room === "outside" && !!d.outsideMeetingPublic && !reg,
    helperTeams: [...(d.helperTeams ?? [])].sort((a, b) => a.hubId.localeCompare(b.hubId)),
    coverageHubSlugs: (d.coverageHubSlugs ?? []).filter((slug) => opts.supportingTeams.includes(slug)),
  };
}
