import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatTimeRange } from "@/lib/dateLabel";
import { isOccurrenceOnDate, type ScheduleProgram } from "@/lib/scheduleUtils";

export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
};

const TZ = "America/Chicago";
const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Monday of the current CT week, optionally offset by N weeks. */
function getMondayOfWeek(offset: number = 0): Date {
  const now = new Date();
  const ctNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const day = ctNow.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ctNow);
  monday.setDate(monday.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function fmtLabel(fmt: string | null): string {
  switch (fmt) {
    case "virtual":
      return "Zoom Only";
    case "hybrid":
      return "In-Person & Zoom";
    case "in-person":
      return "In-Person";
    default:
      return fmt ?? "";
  }
}

/** Schedule line per program (no day — already grouped by day). */
function buildScheduleLine(p: {
  timeText: string | null;
  programFormat: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
}): { timeLabel: string; formatLabel: string; scheduleLine: string } {
  const timeLabel =
    p.timeText ||
    (p.startDatetime ? formatTimeRange(p.startDatetime, p.endDatetime) : "");
  const formatLabel = fmtLabel(p.programFormat);
  const scheduleLine = [timeLabel, formatLabel].filter(Boolean).join(" | ");
  return { timeLabel, formatLabel, scheduleLine };
}

/** Time-of-day in CT minutes from midnight, for sorting within a day. */
function timeOfDay(p: {
  startDatetime: Date | null;
  timeText: string | null;
}): number {
  if (p.startDatetime) {
    const ct = new Date(p.startDatetime.toLocaleString("en-US", { timeZone: TZ }));
    return ct.getHours() * 60 + ct.getMinutes();
  }
  if (p.timeText) {
    const m = p.timeText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const ampm = m[3].toUpperCase();
      if (ampm === "PM" && h !== 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return h * 60 + min;
    }
  }
  return 9999;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const isNext = url.searchParams.get("week") === "next";

  const monday = getMondayOfWeek(isNext ? 1 : 0);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDates.push(toDateStr(d));
  }

  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];
  const weekRangeLabel = `${formatShortDate(monday)}–${formatShortDate(sunday)}, ${monday.getFullYear()}`;
  const weekHeadingPrefix = isNext ? "Next Week at" : "This Week at";
  const weekTitle = `${weekHeadingPrefix} Rooted In Mindfulness`;

  const programs = await db.program.findMany({
    where: {
      archivedAt: null,
      hideFromProgramPageList: false,
      hideFromWeeklySchedule: false,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      programImage: true,
      programFormat: true,
      timeText: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
      registrationEnabled: true,
      specialAnnouncement: true,
      danaText: true,
      category: { select: { id: true, slug: true, name: true } },
    },
  });

  const grouped: Array<{
    day: string;
    date: string;
    dateLabel: string;
    programs: Array<Record<string, unknown>>;
  }> = [];

  for (let i = 0; i < 7; i++) {
    const dateStr = weekDates[i];
    const dayDate = new Date(monday);
    dayDate.setDate(dayDate.getDate() + i);

    const dayPrograms = programs
      .filter((p) => isOccurrenceOnDate(p as ScheduleProgram, dateStr))
      .sort((a, b) => timeOfDay(a) - timeOfDay(b))
      .map((p) => {
        const { timeLabel, formatLabel, scheduleLine } = buildScheduleLine(p);
        return {
          id: p.id,
          slug: p.slug,
          name: p.name,
          tagline: p.tagline,
          programImage: p.programImage,
          programFormat: p.programFormat,
          timeLabel,
          formatLabel,
          scheduleLine,
          category: p.category,
          registrationEnabled: p.registrationEnabled,
          specialAnnouncement: p.specialAnnouncement,
          danaText: p.danaText,
          detailHref: `/rim-next/program-detail?slug=${p.slug}`,
        };
      });

    if (dayPrograms.length > 0) {
      grouped.push({
        day: DAY_NAMES[i],
        date: dateStr,
        dateLabel: formatShortDate(dayDate),
        programs: dayPrograms,
      });
    }
  }

  const payload = {
    isNext,
    weekStart,
    weekEnd,
    weekRangeLabel,
    weekHeadingPrefix,
    weekTitle,
    grouped,
  };

  return NextResponse.json(payload, { headers: CORS });
}
