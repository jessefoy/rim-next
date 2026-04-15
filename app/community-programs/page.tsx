import { db } from "@/lib/db";
import Link from "next/link";
import ListRow from "@/components/ListRow";
import { buildDateLabel, formatTimeRange } from "@/lib/dateLabel";

export const metadata = {
  title: "Programs and Events — Rooted In Mindfulness",
};

export const dynamic = "force-dynamic";

/** Derive a human-readable format label from the programFormat field. */
function fmtLabel(fmt: string): string {
  switch (fmt) {
    case "virtual":  return "Zoom Only";
    case "hybrid":   return "In-Person & Zoom";
    case "in-person": return "In-Person";
    default:         return fmt;
  }
}

/**
 * Compose the full schedule subtitle.
 * Strategy:
 *   1. dateText has correct recurring labels ("Mondays", "Every Tuesday Morning")
 *      — prefer it for the day/pattern part
 *   2. Add time range from startDatetime/endDatetime (structured data)
 *   3. Always append programFormat label
 *
 * Result: "Mondays · 9:30–10:30am CT | Zoom Only"
 */
function buildSubtitle(program: {
  dateText: string | null;
  timeText: string | null;
  programFormat: string;
  startDatetime: Date | null;
  endDatetime: Date | null;
  recurrenceFreq: string | null;
  recurrenceInterval: number | null;
  recurrenceDays: string[];
}): string | undefined {
  const fmt = fmtLabel(program.programFormat);

  // If dateText is set, use it + add time from datetime fields
  if (program.dateText) {
    let label = program.dateText;
    // Append time range if we have structured datetime (dateText usually only has the day)
    if (program.startDatetime) {
      const timeStr = program.timeText
        || formatTimeRange(program.startDatetime, program.endDatetime);
      label += ` · ${timeStr}`;
    }
    return `${label} | ${fmt}`;
  }

  // No dateText — use fully auto-generated label (includes day + time)
  const autoLabel = buildDateLabel({
    startDatetime: program.startDatetime?.toISOString() ?? null,
    endDatetime: program.endDatetime?.toISOString() ?? null,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
  });

  if (autoLabel) return `${autoLabel} | ${fmt}`;
  return fmt || undefined;
}

export default async function CommunityProgramsPage() {
  const [programs, categories] = await Promise.all([
    db.program.findMany({
      where: { hideFromProgramPageList: false, archivedAt: null },
      include: { category: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.programCategory.findMany({
      where: { hideFromProgramsPage: false },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pl-hero rim-section">
        <div className="rim-container">
          <h1 className="pl-hero__title">Programs and Events</h1>
          <p className="pl-hero__body">
            Sit together, study the teachings, and bring what you find into the rest of your life.
            Our programs are offered in person at the center and online — drop-ins, courses, and
            community groups for every stage of practice. No experience needed. No fees.
          </p>
          <Link href="/community-membership" className="pl-hero__cta">
            Learn How to Join Us
          </Link>
        </div>
      </section>

      {/* ── Program Listings ─────────────────────────────── */}
      <section className="rim-section rim-section--grey">
        <div className="rim-container">
          {categories.map((category) => {
            const categoryPrograms = programs.filter(
              (p) => p.category?.name === category.name
            );
            if (categoryPrograms.length === 0) return null;

            return (
              <div key={category.id} className="pl-cat">
                <h2 className="pl-cat__heading">{category.name}</h2>
                <div className="pl-list">
                  {categoryPrograms.map((program) => (
                    <ListRow
                      key={program.id}
                      title={program.name}
                      subtitle={buildSubtitle(program)}
                      announcement={program.specialAnnouncement ?? undefined}
                      href={`/programs/${program.slug}`}
                      buttonLabel="Learn More"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
