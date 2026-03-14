/**
 * POST   /api/programs-pg/[slug]/google-meet — Create Google Meet (writes to Postgres)
 * DELETE /api/programs-pg/[slug]/google-meet — Delete Meet + clear fields in Postgres
 *
 * REGISTRAR | ADMIN only.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createMeeting, deleteCalendarEvent } from "@/lib/google-meet";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, name: true, startDatetime: true, endDatetime: true, calendarEventId: true, meetHostAccount: true },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  if (!program.startDatetime) {
    return NextResponse.json(
      { error: "Program has no Start Date & Time set. Add one first." },
      { status: 400 }
    );
  }

  const endDatetime =
    program.endDatetime?.toISOString() ??
    new Date(program.startDatetime.getTime() + 60 * 60 * 1000).toISOString();

  // If replacing an existing Meet, delete old calendar event first
  if (program.calendarEventId && program.meetHostAccount) {
    try {
      await deleteCalendarEvent({
        calendarEventId: program.calendarEventId,
        roomEmail: program.meetHostAccount,
      });
    } catch (err) {
      console.error("[google-meet-pg] deleteCalendarEvent (pre-replace) error:", err);
    }
  }

  let result;
  try {
    result = await createMeeting({
      title: program.name,
      startDatetime: program.startDatetime.toISOString(),
      endDatetime,
      programSlug: slug,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message ?? "";
    if (msg.startsWith("NO_ROOM_AVAILABLE")) {
      return NextResponse.json(
        { error: "All meeting rooms are booked at that time. Try a different time or ask an admin to add more room accounts." },
        { status: 409 }
      );
    }
    const detail =
      (err as any)?.response?.data?.error?.message ??
      (err as Error).message ??
      "Unknown error";
    console.error("[google-meet-pg] createMeeting error:", err);
    return NextResponse.json({ error: `Meet creation failed: ${detail}` }, { status: 500 });
  }

  // Write back to Postgres
  await db.program.update({
    where: { slug },
    data: {
      zoomLink: result.meetLink,
      meetHostAccount: result.roomEmail,
      calendarEventId: result.calendarEventId,
    },
  });

  return NextResponse.json({
    meetLink: result.meetLink,
    roomEmail: result.roomEmail,
    calendarEventId: result.calendarEventId,
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!session.user.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, calendarEventId: true, meetHostAccount: true },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  if (program.calendarEventId && program.meetHostAccount) {
    try {
      await deleteCalendarEvent({
        calendarEventId: program.calendarEventId,
        roomEmail: program.meetHostAccount,
      });
    } catch (err) {
      console.error("[google-meet-pg DELETE] deleteCalendarEvent error:", err);
    }
  }

  await db.program.update({
    where: { slug },
    data: {
      calendarEventId: null,
      zoomLink: null,
      meetHostAccount: null,
    },
  });

  return NextResponse.json({ success: true });
}
