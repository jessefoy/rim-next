import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

/**
 * POST /api/livekit/token
 *
 * Generate a LiveKit room token for an authenticated user.
 * Host permissions are granted if the user is the assigned host for this session.
 *
 * Body: { programSlug: string, sessionDate?: string }
 * Returns: { token: string, roomName: string, wsUrl: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { programSlug, sessionDate, testRoom } = await req.json();
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");

  // Test mode: any authenticated user can join a test room directly
  // (for /admin/livekit-test — the page itself is admin-gated)
  if (testRoom) {
    const userName = session.user.name || "Member";
    const token = await createRoomToken(session.user.id, userName, testRoom, isAdmin);
    return NextResponse.json({
      token,
      roomName: testRoom,
      wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    });
  }

  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  // Look up caller's avatar
  const caller = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });

  // Look up the program
  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, name: true, programFormat: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Determine if this user is the assigned host for this session.
  // ADMIN always gets host controls.
  let tentativeHost = isAdmin;

  if (!tentativeHost) {
    // Check HostAssignment for this program + date
    const assignment = await db.hostAssignment.findFirst({
      where: {
        programSlug: program.slug,
        userId: session.user.id,
        ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      },
    });
    if (assignment) tentativeHost = true;

    if (roles.includes("HOST_MANAGER")) tentativeHost = true;

    // Teachers assigned to this program get host controls
    if (!tentativeHost) {
      const programTeacher = await db.programTeacher.findFirst({
        where: { programId: program.id, userId: session.user.id },
      });
      if (programTeacher) tentativeHost = true;
    }
  }

  // Hub authority: if a host-team HubMember record exists for this user, it
  // can revoke a tentative grant (status !== ACTIVE or hostingCapability false).
  // ADMIN bypasses the hub check entirely. Teachers or one-off HostAssignments
  // with no HubMember record fall through to the tentative decision.
  const isHost = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, "host-team", tentativeHost);

  // Host team flag (used by client to show "step in" option) — also respects
  // the effective hub authority.
  const tentativeHostTeam = tentativeHost || roles.includes("HOST") || roles.includes("HOST_MANAGER");
  const isHostTeam = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, "host-team", tentativeHostTeam);

  // Teachers get high-fidelity audio (bells, dharma talks, music)
  const isTeacher = roles.includes("TEACHER");
  const needsHiFiAudio = isHost || isTeacher;

  const roomName = roomNameForProgram(program.slug, sessionDate);
  const userName = session.user.name || "Member";

  // Seed avatar into participant metadata so it's present from the moment they connect
  const initialMeta = caller?.avatarUrl
    ? JSON.stringify({ avatarUrl: caller.avatarUrl })
    : undefined;

  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    isHost,
    initialMeta,
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isHost,
    isHostTeam,
    needsHiFiAudio,
    avatarUrl: caller?.avatarUrl ?? null,
  });
}
