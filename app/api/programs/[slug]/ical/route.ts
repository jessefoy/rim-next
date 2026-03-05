import { NextRequest, NextResponse } from "next/server";
import { sanityClient } from "@/lib/sanity";
import { buildIcsContent } from "@/lib/calendarLinks";

const icalQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  name, "slug": slug.current, startDatetime, endDatetime, locationText, repeatWeeks
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
    locationText?: string | null;
    repeatWeeks?: number | null;
  } | null>(icalQuery, { slug });

  if (!program?.startDatetime) {
    return new NextResponse("No calendar date configured for this program.", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  const ics = buildIcsContent({
    title: program.name,
    startDatetime: program.startDatetime,
    endDatetime: program.endDatetime,
    location: program.locationText,
    programSlug: slug,
    repeatWeeks: program.repeatWeeks,
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
