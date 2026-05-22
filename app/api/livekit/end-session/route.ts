import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { endRoom, roomNameForProgram } from "@/lib/livekit";
import { resolveSessionRole } from "@/lib/livekitAuth";
import { assertSessionDateInWindow } from "@/lib/sessionWindow";

/**
 * POST /api/livekit/end-session
 *
 * End a session for all participants by deleting the LiveKit room. Gated
 * on `hasEndAllAuthority`, which is held by (see lib/livekitAuth.ts):
 *   • the assigned Session Host (HostAssignment row), OR
 *   • ADMIN as safety override, OR
 *   • GUIDING_TEACHER as safety override, OR
 *   • the Teacher when no Host is assigned (teacher-teaching-alone fallback).
 *
 * HOST_MANAGER and Host Volunteers without an assignment do NOT end sessions
 * — they hold Co-host capability (mute, share, Bell mode) but not End-for-
 * All. If they need to end a session, they Step-In first (writes the
 * HostAssignment, creating an audit trail).
 *
 * Body: { programSlug: string, sessionDate?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, sessionDate } = await req.json();
  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  const roles = session.user.roles ?? [];

  // Defense-in-depth: refuse if sessionDate doesn't line up with the current
  // open window (or no window is open and the caller isn't ADMIN/GT). This
  // closes the hole where a client could POST an arbitrary sessionDate to
  // target a room they were never connected to.
  const assertion = await assertSessionDateInWindow(programSlug, sessionDate, roles);
  if (!assertion.ok) {
    return NextResponse.json(
      { error: assertion.error, message: assertion.message },
      { status: assertion.status },
    );
  }
  const effectiveSessionDate = assertion.window.sessionDate;

  // Re-resolve at call time — this is the authoritative auth gate. The
  // teacher-fallback in resolveSessionRole is reactive at token-issue, so a
  // teacher's token issued when no host was assigned carries the End button
  // label; if a host later claims the session, the teacher's token is stale
  // (still shows "End") but this server-side re-check will reject the call.
  // Stale UI button → 403 → mild confusion, no security issue.
  const { hasEndAllAuthority } = await resolveSessionRole(
    session.user.id,
    programSlug,
    effectiveSessionDate,
    roles,
  );
  if (!hasEndAllAuthority) {
    return NextResponse.json(
      { error: "Only the assigned host can end this session" },
      { status: 403 },
    );
  }

  const roomName = roomNameForProgram(programSlug, effectiveSessionDate);

  try {
    await endRoom(roomName);
    return NextResponse.json({ ok: true, roomName });
  } catch (e) {
    console.error("[livekit] endRoom failed:", e);
    return NextResponse.json({ error: "Failed to end session" }, { status: 500 });
  }
}
