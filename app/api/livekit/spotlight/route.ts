import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { assertSessionDateInWindow } from "@/lib/sessionWindow";

/**
 * POST /api/livekit/spotlight
 *
 * Host "Spotlight" (Zoom parity): set or clear the room-wide spotlighted
 * participant. Stored in the LiveKit room metadata as `{ spotlight: identity | null }`
 * so every client — including late-joiners, who read room metadata on connect —
 * reflects it. Co-host tier or higher (ADMIN, HOST_MANAGER, ProgramTeacher, or
 * Session Host), re-checked server-side via resolveSessionRole.
 *
 * Body: { programSlug: string, identity: string | null, sessionDate?: string }
 * Returns: { ok: true }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, identity, sessionDate } = await req.json();
  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
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

  // null clears the spotlight; a non-empty string sets it. Room metadata is not
  // used for anything else, so we own the whole object.
  const spotlight = typeof identity === "string" && identity.length > 0 ? identity : null;

  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;
  const httpUrl = wsUrl.replace("wss://", "https://");
  const svc = new RoomServiceClient(httpUrl, process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const roomName = roomNameForProgram(programSlug, effectiveSessionDate);

  try {
    await svc.updateRoomMetadata(roomName, JSON.stringify({ spotlight }));
  } catch (e) {
    console.error("[livekit] spotlight failed:", e);
    return NextResponse.json({ error: "Failed to set spotlight" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
