/**
 * GET  /api/programs-pg — List all programs (REGISTRAR | ADMIN)
 * POST /api/programs-pg — Create a new program (REGISTRAR | ADMIN)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const programs = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { category: true },
  });

  return NextResponse.json(programs);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }

  const existing = await db.program.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A program with this slug already exists" }, { status: 409 });
  }

  const program = await db.program.create({
    data: {
      name,
      slug,
      tagline: body.tagline || null,
      programImage: body.programImage || null,
      description: body.description || undefined,
      pullQuote: body.pullQuote || null,
      pullQuoteSource: body.pullQuoteSource || null,
      specialNotes: body.specialNotes || undefined,
      teacherFacilitators: body.teacherFacilitators ?? [],
      categoryId: body.categoryId || null,
      dateText: body.dateText || null,
      programFormat: body.programFormat || "in-person",
      venue: body.venue || "at-rim",
      locationText: body.locationText || null,
      locationLink: body.locationLink || null,
      zoomLink: body.zoomLink || null,
      meetHostAccount: body.meetHostAccount || null,
      calendarEventId: body.calendarEventId || null,
      startDatetime: body.startDatetime ? new Date(body.startDatetime) : null,
      endDatetime: body.endDatetime ? new Date(body.endDatetime) : null,
      recurrenceFreq: body.recurrenceFreq || null,
      recurrenceInterval: body.recurrenceInterval != null ? Number(body.recurrenceInterval) : null,
      recurrenceDays: body.recurrenceDays ?? [],
      recurrenceCount: body.recurrenceCount != null ? Number(body.recurrenceCount) : null,
      registrationEnabled: body.registrationEnabled ?? false,
      registrationClosed: body.registrationClosed ?? false,
      registrationCapacity: body.registrationCapacity != null ? Number(body.registrationCapacity) : null,
      registrationDeadline: body.registrationDeadline ? new Date(body.registrationDeadline) : null,
      registrationFields: body.registrationFields || undefined,
      confirmationMessage: body.confirmationMessage || undefined,
      reminderDate: body.reminderDate ? new Date(body.reminderDate) : null,
      reminderMessage: body.reminderMessage || undefined,
      danaMode: body.danaMode || "none",
      suggestedDana: body.suggestedDana != null ? Number(body.suggestedDana) : null,
      danaBaseAmount: body.danaBaseAmount != null ? Number(body.danaBaseAmount) : null,
      danaFixedAmount: body.danaFixedAmount != null ? Number(body.danaFixedAmount) : null,
      danaMessage: body.danaMessage || null,
      danaText: body.danaText || null,
      specialAnnouncement: body.specialAnnouncement || null,
      earlyArrivalMessage: body.earlyArrivalMessage || null,
      hideFromDashboard: body.hideFromDashboard ?? false,
      dayOfWeek: body.dayOfWeek ?? [],
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : null,
      removeFromProgramList: body.removeFromProgramList ?? false,
      hideFromProgramPageList: body.hideFromProgramPageList ?? false,
    },
  });

  return NextResponse.json(program, { status: 201 });
}
