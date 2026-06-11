import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { assertSessionDateInWindow } from "@/lib/sessionWindow";

/**
 * POST /api/livekit/remove-participant
 *
 * Server-side remove a participant from a room — the emergency control for a
 * disruptive or unsafe presence. Co-host tier or higher, same gate as mute.
 *
 * Two modes (the client confirms before calling either):
 *   banForSession: false → removed now; can rejoin (the cooled-off case)
 *   banForSession: true  → a SessionBan row is written first; the token
 *                          route refuses members by identity and the
 *                          guest-token route refuses guests by display name
 *                          for the rest of this session's room.
 *
 * Guests get a fresh identity per join, so a guest ban keys on display name —
 * renameable by a determined person (documented limitation; remove again).
 * ADMIN / GUIDING_TEACHER are exempt from ban enforcement at the token route,
 * and you cannot remove yourself.
 *
 * Body: { programSlug, sessionDate?, participantIdentity, participantName?,
 *         banForSession? }
 * Returns: { ok: true, removed: boolean }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, participantIdentity, participantName, sessionDate, banForSession } =
    await req.json();
  if (!programSlug || !participantIdentity) {
    return NextResponse.json(
      { error: "programSlug and participantIdentity required" },
      { status: 400 },
    );
  }
  if (participantIdentity === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const roles = session.user.roles ?? [];
  const assertion = await assertSessionDateInWindow(programSlug, sessionDate, roles);
  if (!assertion.ok) {
    return NextResponse.json(
      { error: assertion.error, message: assertion.message },
      { status: assertion.status },
    );
  }
  const effectiveSessionDate = assertion.window.sessionDate;

  const { isCoHost } = await resolveSessionRole(
    session.user.id,
    programSlug,
    effectiveSessionDate,
    roles,
  );
  if (!isCoHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roomName = roomNameForProgram(programSlug, effectiveSessionDate);

  // Write the ban BEFORE the kick: if the SDK call races with the participant
  // leaving, the ban still holds for any rejoin attempt. The name is stored
  // ONLY for guest identities — guest-token enforcement matches by name, and
  // storing it on member rows would collaterally block a legitimate guest who
  // happens to share the removed member's name (reviewer finding). Members
  // are enforced by identity alone.
  if (banForSession) {
    const isGuestIdentity = participantIdentity.startsWith("guest-");
    await db.sessionBan.create({
      data: {
        roomName,
        identity: participantIdentity,
        name:
          isGuestIdentity && typeof participantName === "string" && participantName.trim()
            ? participantName.trim()
            : null,
        bannedById: session.user.id,
      },
    });
  }

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);

  // Same benign-no-op posture as mute: if the target just left, the desired
  // end-state already holds (and the ban row, if requested, is written).
  let removed = false;
  try {
    await svc.removeParticipant(roomName, participantIdentity);
    removed = true;
  } catch (e) {
    console.error("[livekit] remove-participant failed:", e);
  }

  return NextResponse.json({ ok: true, removed });
}
