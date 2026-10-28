// ─── Calendar link utilities ──────────────────────────────────────────────────
// Builds Google Calendar URLs and ICS file content for program events.
// Used by confirmation emails, the program page, and the /api/programs/[slug]/ical route.
//
// The calendar says what the site says (2026-10-28): the first session is the
// first real session, each event lasts one session (a repeating program's
// end time is on its first day, never its End date), it repeats on the same
// days the site does (weekly days, the monthly "2nd Wednesday"), and it ends
// on the series' last session by the site's own rule. Times are Central, so a
// weekly event keeps its time across the time change.

import { ctDateStr, isOccurrenceOnDate, lastOccurrenceDate, nextOccurrenceOnOrAfter, getDayOfWeekOccurrenceInMonth, getTotalDayOfWeekOccurrencesInMonth, dateToDayCode, shiftToDate, type ScheduleProgram } from "./scheduleUtils";
import { centralToUtc, toCentralDatetime } from "./timezone";

const BASE_URL =
  (process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app").trim().replace(/\/$/, "");

const TZID = "America/Chicago";

export interface CalendarEvent {
  title: string;
  startDatetime: string;             // ISO 8601 UTC string, e.g. "2026-06-07T18:00:00.000Z"
  endDatetime?: string | null;       // optional; defaults to 1 hour after start
  location?: string | null;
  programSlug: string;
  // Recurrence — all optional; leave blank for single events
  recurrenceFreq?: string | null;     // "DAILY" | "WEEKLY" | "MONTHLY" (any case)
  recurrenceInterval?: number | null; // every N days/weeks/months — default 1
  recurrenceDays?: string[] | null;   // weekly days: ["MO","WE","FR"] etc.
  recurrenceCount?: number | null;    // total sessions including the first; null = ongoing
  recurrenceUntil?: string | Date | null; // ends on this Central day (2026-10-28)
}

interface CalendarTimes {
  /** Central wall-clock times, "YYYYMMDDTHHMMSS". */
  start: string;
  end: string;
  rrule: string | null;
}

/** "2026-10-30T19:00" (Central) → "20261030T190000". */
const localCal = (centralLocal: string) => centralLocal.replace(/[-:]/g, "") + "00";

/**
 * The event as a calendar should hold it: the first real session, one
 * session long, and the rule that repeats it the way the site does.
 */
function calendarTimes(ev: CalendarEvent): CalendarTimes {
  const freq = ev.recurrenceFreq ? ev.recurrenceFreq.toUpperCase() : null;
  const anchor = new Date(ev.startDatetime);
  const endIn = ev.endDatetime ? new Date(ev.endDatetime) : null;

  if (!freq) {
    const end = endIn ?? new Date(anchor.getTime() + 60 * 60 * 1000);
    return { start: localCal(toCentralDatetime(anchor)), end: localCal(toCentralDatetime(end)), rrule: null };
  }

  const schedule: ScheduleProgram = {
    id: "", name: ev.title, slug: ev.programSlug, programFormat: null,
    startDatetime: anchor, endDatetime: endIn,
    recurrenceFreq: freq, recurrenceInterval: ev.recurrenceInterval ?? null,
    recurrenceDays: ev.recurrenceDays ?? [], recurrenceCount: ev.recurrenceCount ?? null,
    recurrenceUntil: ev.recurrenceUntil ? new Date(ev.recurrenceUntil) : null,
  };
  const anchorDay = ctDateStr(anchor.toISOString());
  // The first real session: the start's day when it is one, else the next.
  const firstDay = isOccurrenceOnDate(schedule, anchorDay)
    ? anchorDay
    : nextOccurrenceOnOrAfter(schedule, anchorDay, 400) ?? anchorDay;
  const start = shiftToDate(anchor.toISOString(), firstDay);
  // One session long: the end's time on the first session's day.
  let end = endIn ? shiftToDate(endIn.toISOString(), firstDay) : new Date(start.getTime() + 60 * 60 * 1000);
  if (end <= start) end = new Date(start.getTime() + 60 * 60 * 1000);

  const parts = [`FREQ=${freq}`];
  const interval = ev.recurrenceInterval ?? 1;
  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (freq === "WEEKLY") {
    const days = ev.recurrenceDays?.length ? ev.recurrenceDays : [dateToDayCode(anchorDay)];
    // Weeks run Monday to Sunday, as on the site.
    parts.push(`BYDAY=${days.join(",")}`, "WKST=MO");
  }
  if (freq === "MONTHLY") {
    const n = getDayOfWeekOccurrenceInMonth(firstDay);
    const last = n === getTotalDayOfWeekOccurrencesInMonth(firstDay);
    parts.push(`BYDAY=${last ? "-1" : n}${dateToDayCode(firstDay)}`);
  }
  const lastDay = lastOccurrenceDate(schedule);
  if (lastDay) {
    // UNTIL is in UTC when the start carries a time zone.
    const untilUtc = centralToUtc(`${lastDay}T23:59`);
    if (untilUtc) parts.push(`UNTIL=${untilUtc.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`);
  }
  return {
    start: localCal(toCentralDatetime(start)),
    end: localCal(toCentralDatetime(end)),
    rrule: `RRULE:${parts.join(";")}`,
  };
}

/**
 * Build a Google Calendar "Add to Calendar" URL.
 * Opens the event creation form with all fields pre-filled, repeating as the
 * program does.
 */
export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const t = calendarTimes(ev);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${t.start}/${t.end}`,
    ctz: TZID,
    details: `${BASE_URL}/programs/${ev.programSlug}`,
    ...(ev.location ? { location: ev.location } : {}),
    ...(t.rrule ? { recur: t.rrule } : {}),
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

/**
 * Build the URL for downloading this program's .ics file.
 * Points to our GET /api/programs/[slug]/ical endpoint.
 */
export function buildIcsUrl(programSlug: string): string {
  return `${BASE_URL}/api/programs/${programSlug}/ical`;
}

/** Central time for calendars that need it spelled out (US rules since 2007). */
const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  `TZID:${TZID}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/**
 * Build ICS file content for a program event.
 * Returns a string suitable for a text/calendar HTTP response.
 * Includes the repeat rule for multi-session programs (courses, series).
 */
export function buildIcsContent(ev: CalendarEvent): string {
  const uid = `${ev.programSlug}@rootedinmindfulness.org`;
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const t = calendarTimes(ev);

  const programUrl = `${BASE_URL}/programs/${ev.programSlug}`;

  // iCal special chars: commas and semicolons must be escaped with backslash
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => "\\" + c);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rooted In Mindfulness//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...VTIMEZONE,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${TZID}:${t.start}`,
    `DTEND;TZID=${TZID}:${t.end}`,
    ...(t.rrule ? [t.rrule] : []),
    `SUMMARY:${esc(ev.title)}`,
    ...(ev.location ? [`LOCATION:${esc(ev.location)}`] : []),
    `URL:${programUrl}`,
    `DESCRIPTION:${programUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // iCal requires CRLF line endings
  return lines.join("\r\n");
}
