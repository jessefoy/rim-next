/**
 * GET /api/host/schedule/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Streams a PDF of the current user's host schedule for the given date range.
 * Default range: today through end of next month.
 *
 * Renders with @react-pdf/renderer (server-side, no headless Chromium) so it
 * works on Vercel's serverless runtime without extra setup.
 */

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { ScheduleDocument } from "./ScheduleDocument";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function parseDate(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw + "T00:00:00");
  return isNaN(d.getTime()) ? fallback : d;
}

function ctDateStr(iso: string): string {
  // YYYY-MM-DD in CT
  const d = new Date(iso);
  const parts = d.toLocaleDateString("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).split("/");
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const defaultFrom = new Date(now);
  defaultFrom.setHours(0, 0, 0, 0);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

  const fromDate = parseDate(fromParam, defaultFrom);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = parseDate(toParam, defaultTo);
  toDate.setHours(23, 59, 59, 999);

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

  const sessions = assignments
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

  const dayMap = new Map<string, typeof sessions>();
  for (const s of sessions) {
    if (!dayMap.has(s.dateStr)) dayMap.set(s.dateStr, []);
    dayMap.get(s.dateStr)!.push(s);
  }
  const days = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateStr, daySessions]) => ({ dateStr, daySessions }));

  const rotGrouped = new Map<string, { name: string; occs: Set<string>; endsOn: string | null }>();
  for (const r of rotationsRaw) {
    if (!rotGrouped.has(r.programSlug)) {
      rotGrouped.set(r.programSlug, {
        name:   programBySlug.get(r.programSlug)?.name ?? r.programSlug,
        occs:   new Set(),
        endsOn: r.endsOn?.toISOString() ?? null,
      });
    }
    rotGrouped.get(r.programSlug)!.occs.add(r.occurrence);
  }
  const rotations = Array.from(rotGrouped.entries()).map(([slug, g]) => {
    const patLabel  = formatOccurrences(g.occs);
    const endsLabel = g.endsOn
      ? new Date(g.endsOn).toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : null;
    return {
      slug,
      name: g.name,
      meta: [patLabel, endsLabel ? `until ${endsLabel}` : null].filter(Boolean).join(" · "),
    };
  });

  const userName = session.user.name || session.user.email?.split("@")[0] || "Host";
  const generatedAt = now.toLocaleDateString("en-US", {
    timeZone: TZ, month: "long", day: "numeric", year: "numeric",
  });

  const buf = await renderToBuffer(
    ScheduleDocument({
      title: "My Host Schedule",
      rangeLabel: `${fmtDateLong(fromDate)} – ${fmtDateLong(toDate)}`,
      rotations,
      days,
      userName,
      generatedAt,
      totalSessions: sessions.length,
    }),
  );

  const filename = `host-schedule_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
