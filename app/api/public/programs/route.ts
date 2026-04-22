import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildSubtitle } from "@/lib/programUtils";

export const revalidate = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET() {
  const [programs, categories] = await Promise.all([
    db.program.findMany({
      where: { hideFromProgramPageList: false, archivedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        tagline: true,
        programImage: true,
        programFormat: true,
        dateText: true,
        timeText: true,
        startDatetime: true,
        endDatetime: true,
        recurrenceFreq: true,
        recurrenceInterval: true,
        recurrenceDays: true,
        registrationEnabled: true,
        specialAnnouncement: true,
        danaText: true,
        category: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.programCategory.findMany({
      where: { hideFromProgramsPage: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    }),
  ]);

  const payload = {
    programs: programs.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
      programImage: p.programImage,
      programFormat: p.programFormat,
      scheduleLabel: buildSubtitle(p),
      category: p.category,
      registrationEnabled: p.registrationEnabled,
      specialAnnouncement: p.specialAnnouncement,
      danaText: p.danaText,
    })),
    categories,
  };

  return NextResponse.json(payload, { headers: CORS });
}
