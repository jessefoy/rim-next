/**
 * POST /api/livekit/guest-token
 *
 * Generate a LiveKit room token for a guest (non-member) joining
 * an open-access program. No authentication required — access is
 * controlled by the guest access key in the URL.
 *
 * Body: { programSlug: string, guestKey: string, guestName: string }
 * Returns: { token: string, wsUrl: string, roomName: string, programName: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";

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
    select: { id: true, slug: true, name: true, programFormat: true },
  });

  if (!program) {
    return NextResponse.json(
      { error: "Invalid or expired guest link" },
      { status: 403 },
    );
  }

  const roomName = roomNameForProgram(program.slug);
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
    programName: program.name,
  });
}
