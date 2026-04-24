import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildSubtitle } from "@/lib/programUtils";

export const revalidate = 300;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
  "Vercel-CDN-Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
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

  const mappedPrograms = programs.map((p) => ({
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
  }));

  // Grouped by category — categories with no programs are excluded
  const grouped = categories
    .map((cat) => ({
      ...cat,
      programs: mappedPrograms.filter((p) => p.category?.id === cat.id),
    }))
    .filter((g) => g.programs.length > 0);

  const payload = {
    programs: mappedPrograms,
    categories,
    grouped,
  };

  return NextResponse.json(payload, { headers: CORS });
}
