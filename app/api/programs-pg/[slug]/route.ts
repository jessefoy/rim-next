/**
 * GET    /api/programs-pg/[slug] — Get single program (REGISTRAR | ADMIN)
 * PUT    /api/programs-pg/[slug] — Update program (REGISTRAR | ADMIN)
 * DELETE /api/programs-pg/[slug] — Delete program (ADMIN only, safety check)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    include: { category: true, programCourses: { include: { course: true } } },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const existing = await db.program.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const body = await request.json();

  // If slug is changing, check uniqueness
  if (body.slug && body.slug !== slug) {
    const conflict = await db.program.findUnique({ where: { slug: body.slug } });
    if (conflict) {
      return NextResponse.json({ error: "A program with this slug already exists" }, { status: 409 });
    }
  }

  const data: Record<string, unknown> = {};

  // Only update fields that are present in the request body
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.tagline !== undefined) data.tagline = body.tagline || null;
  if (body.programImage !== undefined) data.programImage = body.programImage || null;
  if (body.description !== undefined) data.description = body.description || undefined;
  if (body.pullQuote !== undefined) data.pullQuote = body.pullQuote || null;
  if (body.pullQuoteSource !== undefined) data.pullQuoteSource = body.pullQuoteSource || null;
  if (body.specialNotes !== undefined) data.specialNotes = body.specialNotes || undefined;
  if (body.teacherFacilitators !== undefined) data.teacherFacilitators = body.teacherFacilitators;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  if (body.dateText !== undefined) data.dateText = body.dateText || null;
  if (body.programFormat !== undefined) data.programFormat = body.programFormat;
  if (body.venue !== undefined) data.venue = body.venue;
  if (body.locationText !== undefined) data.locationText = body.locationText || null;
  if (body.locationLink !== undefined) data.locationLink = body.locationLink || null;
  if (body.zoomLink !== undefined) data.zoomLink = body.zoomLink || null;
  if (body.meetHostAccount !== undefined) data.meetHostAccount = body.meetHostAccount || null;
  if (body.calendarEventId !== undefined) data.calendarEventId = body.calendarEventId || null;
  if (body.startDatetime !== undefined) data.startDatetime = body.startDatetime ? new Date(body.startDatetime) : null;
  if (body.endDatetime !== undefined) data.endDatetime = body.endDatetime ? new Date(body.endDatetime) : null;
  if (body.recurrenceFreq !== undefined) data.recurrenceFreq = body.recurrenceFreq || null;
  if (body.recurrenceInterval !== undefined) data.recurrenceInterval = body.recurrenceInterval != null ? Number(body.recurrenceInterval) : null;
  if (body.recurrenceDays !== undefined) data.recurrenceDays = body.recurrenceDays;
  if (body.recurrenceCount !== undefined) data.recurrenceCount = body.recurrenceCount != null ? Number(body.recurrenceCount) : null;
  if (body.registrationEnabled !== undefined) data.registrationEnabled = body.registrationEnabled;
  if (body.registrationClosed !== undefined) data.registrationClosed = body.registrationClosed;
  if (body.registrationCapacity !== undefined) data.registrationCapacity = body.registrationCapacity != null ? Number(body.registrationCapacity) : null;
  if (body.registrationDeadline !== undefined) data.registrationDeadline = body.registrationDeadline ? new Date(body.registrationDeadline) : null;
  if (body.registrationFields !== undefined) data.registrationFields = body.registrationFields || undefined;
  if (body.confirmationMessage !== undefined) data.confirmationMessage = body.confirmationMessage || undefined;
  if (body.reminderDate !== undefined) data.reminderDate = body.reminderDate ? new Date(body.reminderDate) : null;
  if (body.reminderMessage !== undefined) data.reminderMessage = body.reminderMessage || undefined;
  if (body.danaMode !== undefined) data.danaMode = body.danaMode;
  if (body.suggestedDana !== undefined) data.suggestedDana = body.suggestedDana != null ? Number(body.suggestedDana) : null;
  if (body.danaBaseAmount !== undefined) data.danaBaseAmount = body.danaBaseAmount != null ? Number(body.danaBaseAmount) : null;
  if (body.danaFixedAmount !== undefined) data.danaFixedAmount = body.danaFixedAmount != null ? Number(body.danaFixedAmount) : null;
  if (body.danaMessage !== undefined) data.danaMessage = body.danaMessage || null;
  if (body.danaText !== undefined) data.danaText = body.danaText || null;
  if (body.specialAnnouncement !== undefined) data.specialAnnouncement = body.specialAnnouncement || null;
  if (body.earlyArrivalMessage !== undefined) data.earlyArrivalMessage = body.earlyArrivalMessage || null;
  if (body.hideFromDashboard !== undefined) data.hideFromDashboard = body.hideFromDashboard;
  if (body.dayOfWeek !== undefined) data.dayOfWeek = body.dayOfWeek;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder != null ? Number(body.sortOrder) : null;
  if (body.removeFromProgramList !== undefined) data.removeFromProgramList = body.removeFromProgramList;
  if (body.hideFromProgramPageList !== undefined) data.hideFromProgramPageList = body.hideFromProgramPageList;

  const updated = await db.program.update({
    where: { slug },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    include: { _count: { select: { registrations: true } } },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Safety check: cannot delete if active registrations exist
  if (program._count.registrations > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${program._count.registrations} registration(s) exist. Cancel or remove them first.` },
      { status: 409 }
    );
  }

  await db.program.delete({ where: { slug } });

  return NextResponse.json({ success: true });
}
