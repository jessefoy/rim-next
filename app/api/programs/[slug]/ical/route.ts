import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildIcsContent } from "@/lib/calendarLinks";
import { resolveLocation } from "@/lib/locations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      startDatetime: true,
      endDatetime: true,
      venue: true,
      locationText: true,
      locationLink: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
    },
  });

  if (!program?.startDatetime) {
    return new NextResponse("No calendar date configured for this program.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const loc = resolveLocation(program.venue, program.locationText, program.locationLink);

  const ics = buildIcsContent({
    title: program.name,
    startDatetime: program.startDatetime.toISOString(),
    endDatetime: program.endDatetime?.toISOString() ?? null,
    location: loc.emailText ?? undefined,
    programSlug: slug,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
    recurrenceCount: program.recurrenceCount,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
