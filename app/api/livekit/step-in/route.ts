import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createRoomToken, roomNameForProgram } from "@/lib/livekit";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";

/**
 * POST /api/livekit/step-in
 *
 * Emergency host takeover: a host-team member (HOST, HOST_MANAGER, ADMIN)
 * claims host controls for a session that has no host present.
 *
 * - Creates/updates HostAssignment for this session
 * - Returns a new token with roomAdmin: true
 * - The client reconnects with the new token
 *
 * Body: { programSlug: string, sessionDate?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const tentativeHostTeam = isAdmin || roles.includes("HOST") || roles.includes("HOST_MANAGER");

  // Respect hub authority: a host-team HubMember record can revoke the grant
  // even if the system role is still present. ADMIN bypasses.
  const canStepIn = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, "host-team", tentativeHostTeam);

  if (!canStepIn) {
    return NextResponse.json(
      { error: "Only host team members can step in" },
      { status: 403 },
    );
  }

  const { programSlug, sessionDate } = await req.json();
  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Update the existing HostAssignment to this user, or create one if none exists.
  // HostAssignment is @@unique([programSlug, sessionDate]) — one assignment per session.
  await db.hostAssignment.upsert({
    where: {
      programSlug_sessionDate: {
        programSlug,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(0),
      },
    },
    create: {
      programSlug,
      userId: session.user.id,
      ...(sessionDate ? { sessionDate: new Date(sessionDate) } : {}),
      notes: `Emergency step-in by ${session.user.name || session.user.id}`,
    },
    update: {
      userId: session.user.id,
      notes: `Emergency step-in by ${session.user.name || session.user.id}`,
    },
  });

  // Generate a new token: stepping in upserts the HostAssignment, so this
  // user is now the Session Host (full grant: roomAdmin + screen share).
  //
  // Seed `host: true` in the token metadata so the Host badge renders on
  // their tile in every other client's view. Without this, the stepper-in
  // would appear to themselves as Session Host but to other participants
  // as just a regular member — the symptom Jesse saw in real-world use.
  // Mirrors the seedMeta pattern in /api/livekit/token.
  const roomName = roomNameForProgram(programSlug, sessionDate);
  const userName = session.user.name || "Host";

  // Stepping in makes the caller the Session Host. They may also be a
  // ProgramTeacher (already teaching this program before stepping in to
  // run the room) — preserve that signal if so. cohost is never set on a
  // Step-In token because the caller is now host. Reuses the `program`
  // already fetched above.
  const teacher = await db.programTeacher.findFirst({
    where: { programId: program.id, userId: session.user.id },
    select: { id: true },
  });
  const isProgramTeacher = !!teacher;

  const caller = await db.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true },
  });
  const seedMeta: {
    avatarUrl?: string;
    host?: boolean;
    teacher?: boolean;
  } = { host: true };
  if (isProgramTeacher) seedMeta.teacher = true;
  if (caller?.avatarUrl) seedMeta.avatarUrl = caller.avatarUrl;
  const initialMeta = JSON.stringify(seedMeta);

  const token = await createRoomToken(
    session.user.id,
    userName,
    roomName,
    { roomAdmin: true, canShareScreen: true },
    initialMeta,
  );

  return NextResponse.json({
    token,
    roomName,
    wsUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    isSessionHost: true,
    isCoHost: true,
    isProgramTeacher,
  });
}
