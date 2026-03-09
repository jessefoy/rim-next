import { NextRequest, NextResponse } from "next/server";
import { sanityClient } from "@/lib/sanity";
import { buildIcsContent } from "@/lib/calendarLinks";
import { resolveLocation } from "@/lib/locations";

const icalQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  name, "slug": slug.current, startDatetime, endDatetime,
  venue, locationText, locationLink,
  recurrenceFreq, recurrenceInterval, recurrenceDays, recurrenceCount
}`;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const program = await sanityClient.fetch<{
    name: string;
    slug: string;
    startDatetime?: string | null;
    endDatetime?: string | null;
    venue?: string | null;
    locationText?: string | null;
    locationLink?: string | null;
    recurrenceFreq?: string | null;
    recurrenceInterval?: number | null;
    recurrenceDays?: string[] | null;
    recurrenceCount?: number | null;
  } | null>(icalQuery, { slug });

  if (!program?.startDatetime) {
    return new NextResponse("No calendar date configured for this program.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const loc = resolveLocation(program.venue, program.locationText, program.locationLink);

  const ics = buildIcsContent({
    title: program.name,
    startDatetime: program.startDatetime,
    endDatetime: program.endDatetime,
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
