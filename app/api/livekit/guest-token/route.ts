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
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";
import { getActiveSessionWindow, describeInactiveWindow } from "@/lib/sessionWindow";

export async function POST(req: NextRequest) {
  const { programSlug, guestKey, guestName } = await req.json();

  if (!programSlug || !guestKey || !guestName?.trim()) {
    return NextResponse.json(
      { error: "programSlug, guestKey, and guestName are required" },
      { status: 400 },
    );
  }

  // Rate-limit guest-token minting per IP so a leaked guest link can't be used
  // to spin up unlimited identities (which would otherwise sidestep the
  // per-identity chat limit). Fail-open on DB error. (Pre-launch hardening.)
  const rl = await checkRateLimit(`guest-token:${getRequestIp(req)}`, 10, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many join attempts. Please wait a moment and try again." },
      { status: 429 },
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

  // Session ban — guests mint a fresh identity per join, so the display name
  // is the only stable handle. Case-insensitive match per-roomName. A renamed
  // guest slips this (documented limitation); the host can remove again.
  const ban = await db.sessionBan.findFirst({
    where: {
      roomName,
      name: { equals: displayName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (ban) {
    return NextResponse.json(
      {
        error: "removed-from-session",
        message: "You were removed from this session by its host.",
      },
      { status: 403 },
    );
  }

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
