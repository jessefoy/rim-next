import { db } from "@/lib/db";
import Link from "next/link";
import { formatTimeRange } from "@/lib/dateLabel";
import { isOccurrenceOnDate, type ScheduleProgram } from "@/lib/scheduleUtils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week } = await searchParams;
  const label = week === "next" ? "Next Week" : "This Week";
  return { title: `${label} at Rooted In Mindfulness` };
}

const TZ = "America/Chicago";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Get Monday of the current week in CT */
function getMondayOfWeek(offset: number = 0): Date {
  const now = new Date();
  const ctNow = new Date(now.toLocaleString("en-US", { timeZone: TZ }));
  const day = ctNow.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ctNow);
  monday.setDate(monday.getDate() + diffToMonday + (offset * 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Today in CT as YYYY-MM-DD — the key the day groups are compared against. */
function todayInCT(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
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
    case "virtual":  return "Zoom Only";
    case "hybrid":   return "In-Person & Zoom";
    case "in-person": return "In-Person";
    default:         return fmt ?? "";
  }
}

/**
 * The time alone — no format, no timezone. The hero states the timezone once
 * for the whole page, so repeating "CT" on every row is noise.
 */
function buildTimeLabel(program: {
  timeText: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
}): string {
  const time = program.timeText
    || (program.startDatetime
      ? formatTimeRange(program.startDatetime, program.endDatetime)
      : "");
  return time.replace(/\s*\bCT\b\s*$/, "").trim();
}

export default async function ThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const isNextWeek = week === "next";
  const monday = getMondayOfWeek(isNextWeek ? 1 : 0);
  const todayStr = todayInCT();

  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    weekDates.push(toDateStr(d));
  }

  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const dateRange = `${formatShortDate(monday)}–${formatShortDate(sunday)}, ${monday.getFullYear()}`;

  const programs = await db.program.findMany({
    where: { archivedAt: null, hideFromProgramPageList: false, hideFromWeeklySchedule: false },
    include: { category: true },
  });

  /** Extract time-of-day in minutes from midnight (CT) for sorting */
  function timeOfDay(p: { startDatetime: Date | null; timeText: string | null }): number {
    // Prefer startDatetime — convert to CT and extract hours+minutes
    if (p.startDatetime) {
      const ct = new Date(p.startDatetime.toLocaleString("en-US", { timeZone: TZ }));
      return ct.getHours() * 60 + ct.getMinutes();
    }
    // Fallback: parse timeText like "7:00 PM" or "9:30-10:30 AM"
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
    return 9999; // no time info — sort to bottom
  }

  // Group programs by day, sorted by time of day within each day
  const dayGroups: {
    dayName: string;
    date: Date;
    dateStr: string;
    isToday: boolean;
    programs: typeof programs;
  }[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = weekDates[i];
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    const dayPrograms = programs
      .filter((p) => isOccurrenceOnDate(p as ScheduleProgram, dateStr))
      .sort((a, b) => timeOfDay(a) - timeOfDay(b));
    if (dayPrograms.length > 0) {
      dayGroups.push({
        dayName: DAY_NAMES[i],
        date,
        dateStr,
        isToday: dateStr === todayStr,
        programs: dayPrograms,
      });
    }
  }

  const hasToday = dayGroups.some((g) => g.isToday);

  return (
    <div className="pl-page">
      {/* ── Hero ────────────────────────────────────────── */}
      <section
        className="pp-hero"
        style={{
          ["--pp-hero-image" as string]: "url('/images/Bodhi-Leaves.jpg')",
          ["--pp-hero-position" as string]: "center 40%",
        }}
      >
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">Weekly schedule</p>
          <h1 className="pp-hero__title">
            {isNextWeek ? "Next week at" : "This week at"} Rooted In Mindfulness
          </h1>
          <p className="pp-hero__body">
            {dateRange}. All times are Central&nbsp;(CT).
          </p>
          <div className="pp-hero__actions">
            <Link
              href="/this-week"
              className={`pp-btn ${isNextWeek ? "pp-btn--onblue-ghost" : "pp-btn--onblue"}`}
              aria-current={!isNextWeek ? "page" : undefined}
            >
              This week
            </Link>
            <Link
              href="/this-week?week=next"
              className={`pp-btn ${isNextWeek ? "pp-btn--onblue" : "pp-btn--onblue-ghost"}`}
              aria-current={isNextWeek ? "page" : undefined}
            >
              Next week
            </Link>
            {hasToday && (
              <a href="#today" className="pp-hero__link">
                Jump to today <span aria-hidden="true">↓</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Schedule ─────────────────────────────────────── */}
      <section className="pl-catalog">
        <div className="rim-container">
          {dayGroups.length === 0 ? (
            <p className="tw-empty">No programs scheduled for this week.</p>
          ) : (
            dayGroups.map(({ dayName, date, dateStr, isToday, programs: dayPrograms }) => (
              <div
                key={dayName}
                id={isToday ? "today" : undefined}
                className={`pl-cat tw-day${isToday ? " tw-day--today" : ""}`}
              >
                <div className="pl-cat__header tw-day-heading">
                  <time
                    className="tw-day-heading__date"
                    dateTime={dateStr}
                    aria-label={formatShortDate(date)}
                  >
                    <span className="tw-day-heading__month">
                      {date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                    </span>
                    <span className="tw-day-heading__day">{date.getDate()}</span>
                  </time>
                  <h2 className="pl-cat__heading tw-day-heading__title">
                    {dayName}
                    {isToday && <span className="tw-today-pill">Today</span>}
                  </h2>
                </div>
                <div className="pl-grid">
                  {dayPrograms.map((program) => {
                    const time = buildTimeLabel(program);
                    const format = fmtLabel(program.programFormat);
                    return (
                      <Link
                        key={program.id}
                        href={`/programs/${program.slug}`}
                        className="pl-card pl-card--time"
                      >
                        <div className="pl-card__content">
                          {time && <span className="pl-card__time">{time}</span>}
                          <div className="pl-card__main">
                            <h3 className="pl-card__title">{program.name}</h3>
                            {format && (
                              <div className="pl-card__meta">
                                <span className="pl-card__format">{format}</span>
                              </div>
                            )}
                          </div>
                          <span className="pl-card__action" aria-hidden="true">→</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
          <p className="tw-footer">Schedule is subject to change.</p>
        </div>
      </section>
    </div>
  );
}
