/**
 * /tools/schedule/print — Personal host schedule for print / PDF export.
 *
 * Shows the current user's assigned sessions in a clean, print-friendly layout.
 * Default date range: today → end of next month.
 *
 * Accepts ?from=YYYY-MM-DD&to=YYYY-MM-DD to narrow or widen the range.
 * The PrintControls client component handles date input + window.print().
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ctDateStr } from "@/lib/scheduleUtils";
import PrintControls from "./PrintControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Print My Schedule — Tools" };

const TZ = "America/Chicago";

type OccurrenceKey = "FIRST" | "SECOND" | "THIRD" | "FOURTH" | "FIFTH" | "LAST" | "ALL";
const OCC_ORD: Record<OccurrenceKey, string> = {
  FIRST: "1st", SECOND: "2nd", THIRD: "3rd", FOURTH: "4th",
  FIFTH: "5th", LAST: "last", ALL: "every",
};

function formatOccurrences(occs: Set<string>): string {
  if (occs.has("ALL")) return "every session";
  const ordered: OccurrenceKey[] = ["FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "LAST"];
  const present = ordered.filter(o => occs.has(o));
  if (present.length === 0) return "";
  if (present.length === ordered.length) return "every session";
  return `${present.map(o => OCC_ORD[o]).join(" & ")} of the month`;
}

function parseDate(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw + "T00:00:00");
  return isNaN(d.getTime()) ? fallback : d;
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function fmtDateDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: TZ, weekday: "short", month: "long", day: "numeric",
  });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ, hour: "numeric", minute: "2-digit",
  });
}

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { from: fromParam, to: toParam } = await searchParams;

  // CT-local "now"
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));

  // Default range: today → end of next month
  const defaultFrom = new Date(now);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const fromDate = parseDate(fromParam, defaultFrom);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = parseDate(toParam, defaultTo);
  toDate.setHours(23, 59, 59, 999);

  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr   = toDate.toISOString().slice(0, 10);

  const [assignments, rotationsRaw, pgPrograms] = await Promise.all([
    db.hostAssignment.findMany({
      where: {
        userId: session.user.id,
        sessionDate: { gte: fromDate, lte: toDate },
      },
      orderBy: { sessionDate: "asc" },
      select: { programSlug: true, sessionDate: true },
    }),
    db.standingAssignment.findMany({
      where: {
        userId: session.user.id,
        OR: [{ endsOn: null }, { endsOn: { gte: now } }],
      },
      orderBy: [{ programSlug: "asc" }, { occurrence: "asc" }],
    }),
    db.program.findMany({
      where: { archivedAt: null },
      select: { slug: true, name: true, programFormat: true },
    }),
  ]);

  const programBySlug = new Map(pgPrograms.map(p => [p.slug, p]));

  // Build session rows
  interface PrintSession {
    dateStr:     string; // YYYY-MM-DD (CT)
    dateLabel:   string; // "Thu, May 8"
    programName: string;
    timeLabel:   string;
    formatLabel: string;
  }

  const sessions: PrintSession[] = assignments
    .filter(a => a.sessionDate != null)
    .map(a => {
      const iso = a.sessionDate!.toISOString();
      const p = programBySlug.get(a.programSlug);
      const fmt = p?.programFormat;
      return {
        dateStr:     ctDateStr(iso),
        dateLabel:   fmtDateDay(iso),
        programName: p?.name ?? a.programSlug,
        timeLabel:   fmtTime(iso),
        formatLabel: fmt === "virtual" ? "Virtual"
                   : fmt === "hybrid"  ? "In-person & virtual"
                   : "",
      };
    });

  // Group by date
  const dayMap = new Map<string, PrintSession[]>();
  for (const s of sessions) {
    if (!dayMap.has(s.dateStr)) dayMap.set(s.dateStr, []);
    dayMap.get(s.dateStr)!.push(s);
  }
  const days = Array.from(dayMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  // Group rotations by program slug
  const rotGrouped = new Map<string, { name: string; occs: Set<string>; endsOn: string | null }>();
  for (const r of rotationsRaw) {
    if (!rotGrouped.has(r.programSlug)) {
      rotGrouped.set(r.programSlug, {
        name:  programBySlug.get(r.programSlug)?.name ?? r.programSlug,
        occs:  new Set(),
        endsOn: r.endsOn?.toISOString() ?? null,
      });
    }
    rotGrouped.get(r.programSlug)!.occs.add(r.occurrence);
  }

  const userName = session.user.name || session.user.email?.split("@")[0] || "Host";
  const generatedAt = now.toLocaleDateString("en-US", {
    timeZone: TZ, month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div className="hs-print-page">

      {/* Header */}
      <div className="hs-print-header">
        <p className="hs-print-header__title">My Host Schedule</p>
        <p className="hs-print-header__range">
          {fmtDateLong(fromDate)} – {fmtDateLong(toDate)}
        </p>
      </div>

      {/* Controls (hidden at print time) */}
      <PrintControls fromStr={fromStr} toStr={toStr} />

      {/* Standing rotations */}
      {rotGrouped.size > 0 && (
        <div className="hs-print-section">
          <p className="hs-print-section__heading">Standing Rotations</p>
          <div className="hs-print-rot">
            {Array.from(rotGrouped.entries()).map(([slug, g]) => {
              const patLabel  = formatOccurrences(g.occs);
              const endsLabel = g.endsOn
                ? new Date(g.endsOn).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : null;
              const meta = [patLabel, endsLabel ? `until ${endsLabel}` : null]
                .filter(Boolean).join(" · ");
              return (
                <div key={slug} className="hs-print-rot__row">
                  <span className="hs-print-rot__name">{g.name}</span>
                  <span className="hs-print-rot__pat">{meta}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sessions */}
      <div className="hs-print-section">
        <p className="hs-print-section__heading">
          Sessions ({sessions.length})
        </p>
        {days.length === 0 ? (
          <p className="hs-print-empty">
            No sessions assigned in this date range.
          </p>
        ) : (
          days.map(([dateStr, daySessions]) => (
            <div key={dateStr} className="hs-print-day">
              <p className="hs-print-day__heading">{daySessions[0].dateLabel}</p>
              {daySessions.map((s, i) => (
                <div key={i} className="hs-print-session">
                  <span className="hs-print-session__name">{s.programName}</span>
                  <span className="hs-print-session__time">{s.timeLabel}</span>
                  {s.formatLabel && (
                    <span className="hs-print-session__fmt">{s.formatLabel}</span>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="hs-print-footer">
        Schedule for {userName} · Generated {generatedAt} · rootedinmindfulness.org
      </div>
    </div>
  );
}
