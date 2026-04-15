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

/** Build schedule subtitle: "9:30-10:30 AM CT | Zoom Only" (no day — we're already grouped by day) */
function buildScheduleLine(program: {
  timeText: string | null;
  programFormat: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
}): string {
  const time = program.timeText
    || (program.startDatetime
      ? formatTimeRange(program.startDatetime, program.endDatetime)
      : "");
  const fmt = fmtLabel(program.programFormat);
  return [time, fmt].filter(Boolean).join(" | ");
}

export default async function ThisWeekPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const isNextWeek = week === "next";
  const monday = getMondayOfWeek(isNextWeek ? 1 : 0);

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
    where: { archivedAt: null, hideFromProgramPageList: false },
    include: { category: true },
  });

  // Group programs by day
  const dayGroups: { dayName: string; programs: typeof programs }[] = [];
  for (let i = 0; i < 7; i++) {
    const dateStr = weekDates[i];
    const dayPrograms = programs
      .filter((p) => isOccurrenceOnDate(p as ScheduleProgram, dateStr))
      .sort((a, b) => {
        if (!a.startDatetime) return 1;
        if (!b.startDatetime) return -1;
        return a.startDatetime.getTime() - b.startDatetime.getTime();
      });
    if (dayPrograms.length > 0) {
      dayGroups.push({ dayName: DAY_NAMES[i], programs: dayPrograms });
    }
  }

  return (
    <>
      {/* ── Hero ────────────────────────────────────────── */}
      <section className="tw-hero rim-section">
        <div className="rim-container">
          <h1 className="tw-hero__title">
            {isNextWeek ? "Next Week at" : "This Week at"}
            <br />Rooted In Mindfulness
          </h1>
          <p className="tw-hero__subtitle">All Times are Central Time (CT)</p>
          <p className="tw-hero__range">{dateRange}</p>
          <div className="tw-hero__nav">
            <Link
              href="/this-week"
              className={`tw-nav-btn${!isNextWeek ? " tw-nav-btn--active" : ""}`}
            >
              This Week
            </Link>
            <Link
              href="/this-week?week=next"
              className={`tw-nav-btn${isNextWeek ? " tw-nav-btn--active" : ""}`}
            >
              Next Week
            </Link>
          </div>
        </div>
      </section>

      {/* ── Schedule ─────────────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          {dayGroups.length === 0 ? (
            <p className="tw-empty">No programs scheduled for this week.</p>
          ) : (
            dayGroups.map(({ dayName, programs: dayPrograms }) => (
              <div key={dayName} className="pl-cat">
                <h2 className="pl-cat__heading">{dayName}</h2>
                <div className="pl-list">
                  {dayPrograms.map((program) => (
                    <Link
                      key={program.id}
                      href={`/programs/${program.slug}`}
                      className="lr-row tw-row-link"
                    >
                      <div className="lr-info">
                        <p className="lr-name">{program.name}</p>
                        <p className="lr-schedule">
                          {buildScheduleLine(program)}
                          {program.category && (
                            <span className="tw-cat-tag"> · {program.category.name}</span>
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
          <p className="tw-footer">Schedule is subject to change.</p>
        </div>
      </section>
    </>
  );
}
