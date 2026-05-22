/**
 * POST /api/livekit/guest-token
 *
 * Generate a LiveKit room token for a guest (non-member) joining
 * an open-access program. No authentication required — access is
 * controlled by the guest access key in the URL.
 *
 * Body: { programSlug: string, guestKey: string, guestName: string }
 * Returns: { token, wsUrl, roomName, sessionDate, programName }
 *
 * Time-gated by the same window as the member token route. Guests have
 * no role-based bypass — they can only join during the open session
 * window, never outside it.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { getActiveSessionWindow, describeInactiveWindow } from "@/lib/sessionWindow";

export async function POST(req: NextRequest) {
  const { programSlug, guestKey, guestName } = await req.json();

  if (!programSlug || !guestKey || !guestName?.trim()) {
    return NextResponse.json(
      { error: "programSlug, guestKey, and guestName are required" },
      { status: 400 },
    );
  }

  const program = await db.program.findFirst({
    where: {
      slug: programSlug,
      isOpenAccess: true,
      guestAccessKey: guestKey,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      programFormat: true,
      startDatetime: true,
      endDatetime: true,
      recurrenceFreq: true,
      recurrenceInterval: true,
      recurrenceDays: true,
      recurrenceCount: true,
    },
  });

  if (!program) {
    return NextResponse.json(
      { error: "Invalid or expired guest link" },
      { status: 403 },
    );
  }

  const sessionWindow = getActiveSessionWindow(program);
  if (!sessionWindow.active) {
    return NextResponse.json(
      {
        error: "session-closed",
        message: describeInactiveWindow(sessionWindow),
        nextSessionDate: sessionWindow.nextSessionDate,
        nextOpensAt: sessionWindow.nextOpensAt?.toISOString() ?? null,
        nextStartsAt: sessionWindow.nextStartsAt?.toISOString() ?? null,
      },
      { status: 403 },
    );
  }

  const roomName = roomNameForProgram(program.slug, sessionWindow.sessionDate);
  const guestId = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const displayName = guestName.trim();

  // Guests are always Participant-tier: mic + camera only, no screen share, no admin.
  const token = await createRoomToken(
    guestId,
    displayName,
    roomName,
    { roomAdmin: false, canShareScreen: false },
  );

  return NextResponse.json({
    token,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    roomName,
    sessionDate: sessionWindow.sessionDate,
    programName: program.name,
  });
}
