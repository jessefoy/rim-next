/**
 * GET  /api/programs-pg — List all programs (REGISTRAR | ADMIN)
 * POST /api/programs-pg — Create a new program (REGISTRAR | ADMIN)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { centralToUtc } from "@/lib/timezone";
import { computeTimeText, computeDateText } from "@/lib/programUtils";
import { sendNewProgramNeedsHostEmail } from "@/lib/email";
import { getHubNotificationRecipients } from "@/lib/toolAuth";

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
      teacherFacilitators: body.teacherFacilitators ?? [],
      categoryId: body.categoryId || null,
      // dateText / timeText are server-computed from the source fields so they
      // never drift. Any value the client sends is ignored.
      dateText: computeDateText(
        body.startDatetime,
        body.recurrenceFreq,
        body.recurrenceDays ?? [],
        body.recurrenceInterval,
      ) || null,
      timeText: computeTimeText(body.startDatetime, body.endDatetime) || null,
      programFormat: body.programFormat || "in-person",
      venue: body.venue || "at-rim",
      locationText: body.locationText || null,
      locationLink: body.locationLink || null,
      startDatetime: centralToUtc(body.startDatetime),
      endDatetime: centralToUtc(body.endDatetime),
      recurrenceFreq: body.recurrenceFreq || null,
      recurrenceInterval: body.recurrenceInterval != null ? Number(body.recurrenceInterval) : null,
      recurrenceDays: body.recurrenceDays ?? [],
      recurrenceCount: body.recurrenceCount != null ? Number(body.recurrenceCount) : null,
      registrationEnabled: body.registrationEnabled ?? false,
      registrationClosed: body.registrationClosed ?? false,
      registrationCapacity: body.registrationCapacity != null ? Number(body.registrationCapacity) : null,
      registrationDeadline: centralToUtc(body.registrationDeadline),
      registrationFields: body.registrationFields || undefined,
      confirmationMessage: body.confirmationMessage || undefined,
      reminderDate: centralToUtc(body.reminderDate),
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
      dashboardShowAt: centralToUtc(body.dashboardShowAt),
      hideFromProgramPageList: body.hideFromProgramPageList ?? false,
      hideFromWeeklySchedule: body.hideFromWeeklySchedule ?? false,
      isOpenAccess: body.isOpenAccess ?? false,
      guestAccessKey: body.isOpenAccess ? randomBytes(6).toString("hex") : null,
      livekitRoom: (body.programFormat === "virtual" || body.programFormat === "hybrid") ? slug : null,
    },
  });

  // Handle teacher assignments if provided
  const teacherIds: string[] = body.teacherIds ?? [];
  if (teacherIds.length > 0) {
    await db.programTeacher.createMany({
      data: teacherIds.map((userId: string, index: number) => ({
        programId: program.id,
        userId,
        order: index,
      })),
    });
  }

  // Notify the host team when a new virtual/hybrid program lands.
  // In-person programs don't need host coverage on the LiveKit side, so we
  // only fire for virtual/hybrid. Recipients exclude the registrar who
  // created it (no point notifying yourself). `after()` keeps the work
  // alive past the response so Vercel doesn't kill the in-flight emails.
  if (program.programFormat === "virtual" || program.programFormat === "hybrid") {
    after(async () => {
      try {
        const recipients = await getHubNotificationRecipients("host-team", {
          excludeUserId: session.user.id,
        });
        const formatLabel =
          program.programFormat === "virtual"
            ? "Virtual"
            : "In-person and virtual";

        await Promise.all(
          recipients.map((u) =>
            sendNewProgramNeedsHostEmail({
              to: u.email,
              firstName: u.firstName,
              programName: program.name,
              programFormat: formatLabel,
            }),
          ),
        );
      } catch (e) {
        console.error("[programs-pg] new-program notification error:", e);
      }
    });
  }

  return NextResponse.json(program, { status: 201 });
}
