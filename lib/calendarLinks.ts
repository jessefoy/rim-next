// ─── Calendar link utilities ──────────────────────────────────────────────────
// Builds Google Calendar URLs and ICS file content for program events.
// Used by confirmation emails, the program page, and the /api/programs/[slug]/ical route.

const BASE_URL = process.env.NEXTAUTH_URL ?? "https://rim-next.vercel.app";

export interface CalendarEvent {
  title: string;
  startDatetime: string;       // ISO 8601 UTC string, e.g. "2026-06-07T18:00:00.000Z"
  endDatetime?: string | null; // optional; defaults to 1 hour after start
  location?: string | null;
  programSlug: string;
}

/**
 * Convert an ISO 8601 string to the compact iCal / Google Calendar format.
 * Input:  "2026-06-07T18:00:00.000Z"  →  Output: "20260607T180000Z"
 */
function toCalDT(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/**
 * Build a Google Calendar "Add to Calendar" URL.
 * Opens the event creation form with all fields pre-filled.
 */
export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const start = toCalDT(ev.startDatetime);
  const end = ev.endDatetime
    ? toCalDT(ev.endDatetime)
    : toCalDT(new Date(new Date(ev.startDatetime).getTime() + 60 * 60 * 1000).toISOString());

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${start}/${end}`,
    details: `${BASE_URL}/programs/${ev.programSlug}`,
    ...(ev.location ? { location: ev.location } : {}),
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

/**
 * Build ICS file content for a program event.
 * Returns a string suitable for a text/calendar HTTP response.
 */
export function buildIcsContent(ev: CalendarEvent): string {
  const uid   = `${ev.programSlug}@rootedinmindfulness.org`;
  const now   = toCalDT(new Date().toISOString());
  const start = toCalDT(ev.startDatetime);
  const end   = ev.endDatetime
    ? toCalDT(ev.endDatetime)
    : toCalDT(new Date(new Date(ev.startDatetime).getTime() + 60 * 60 * 1000).toISOString());

  const programUrl = `${BASE_URL}/programs/${ev.programSlug}`;

  // iCal special chars: commas and semicolons must be escaped with backslash
  const esc = (s: string) => s.replace(/[,;\\]/g, (c) => "\\" + c);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rooted In Mindfulness//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
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
