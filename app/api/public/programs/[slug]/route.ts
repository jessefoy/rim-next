import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { renderContentBodyAsync } from "@/lib/renderRichContentServer";

export const revalidate = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const program = await db.program.findUnique({
    where: { slug, archivedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      tagline: true,
      programImage: true,
      pullQuote: true,
      pullQuoteSource: true,
      description: true,
      programNotes: true,
      programFormat: true,
      venue: true,
      locationText: true,
      locationLink: true,
      dateText: true,
      timeText: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      danaText: true,
      registrationEnabled: true,
      registrationClosed: true,
      registrationDeadline: true,
      specialAnnouncement: true,
      teacherFacilitators: true,
      category: { select: { id: true, slug: true, name: true } },
      programTeachers: {
        orderBy: { order: "asc" },
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              preferredName: true,
              teacherProfile: { select: { slug: true } },
            },
          },
        },
      },
    },
  });

  if (!program) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: CORS });
  }

  const startIso = program.startDatetime?.toISOString() ?? null;
  const endIso = program.endDatetime?.toISOString() ?? null;
  const location = resolveLocation(program.venue, program.locationText, program.locationLink);

  // Schedule label — day/recurrence pattern only, no time
  const autoDateLabel = buildDateLabel({
    startDatetime: startIso,
    endDatetime: endIso,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
  });
  const scheduleLabel = program.dateText || (autoDateLabel?.includes(" · ")
    ? autoDateLabel.split(" · ")[0]
    : autoDateLabel) || null;

  // Time label — separate row
  const timeLabel = program.timeText || (() => {
    if (!program.startDatetime) return null;
    const TZ = "America/Chicago";
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(d);
    const start = fmt(program.startDatetime);
    if (!program.endDatetime) return `${start} CT`;
    return `${fmt(program.startDatetime)}-${fmt(program.endDatetime)} CT`;
  })();

  // Location label
  const locationLabel =
    program.programFormat === "virtual"
      ? `Online (${location.text || "Zoom"}) only`
      : program.programFormat === "hybrid"
        ? `${location.text || "Hybrid"} + Online`
        : location.text || null;

  // Format label
  const formatLabel =
    program.programFormat === "virtual" ? "Zoom Only" :
    program.programFormat === "hybrid" ? "In-Person & Zoom" :
    "In-Person";

  // Teachers
  const teachers = program.programTeachers.length > 0
    ? program.programTeachers.map((pt) => ({
        name: `${pt.user.preferredName || pt.user.firstName || ""} ${pt.user.lastName || ""}`.trim(),
        slug: pt.user.teacherProfile?.slug ?? null,
      }))
    : program.teacherFacilitators.map((name) => ({ name, slug: null }));

  // Registration closed
  const registrationClosed = !!(
    program.registrationClosed ||
    (program.registrationDeadline && new Date(program.registrationDeadline) < new Date())
  );

  // Description → HTML
  const descriptionHtml = program.description
    ? await renderContentBodyAsync(program.description)
    : null;

  // Program notes → HTML
  const programNotesHtml = program.programNotes
    ? await renderContentBodyAsync(program.programNotes)
    : null;

  const payload = {
    id: program.id,
    slug: program.slug,
    name: program.name,
    tagline: program.tagline,
    programImage: program.programImage,
    pullQuote: program.pullQuote,
    pullQuoteSource: program.pullQuoteSource,
    descriptionHtml,
    programNotesHtml,
    programFormat: program.programFormat,
    formatLabel,
    scheduleLabel,
    timeLabel,
    locationLabel,
    locationLink: location.link,
    danaText: program.danaText,
    registrationEnabled: program.registrationEnabled,
    registrationClosed,
    registrationUrl: `https://rim-next.vercel.app/programs/${program.slug}/register`,
    specialAnnouncement: program.specialAnnouncement,
    category: program.category,
    teachers,
    teacherNames: teachers.map((t) => t.name).join(", ") || null,
  };

  return NextResponse.json(payload, { headers: CORS });
}
