import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { roomNameForProgram, sessionDisplayName } from "@/lib/livekit";

/**
 * POST /api/livekit/chat
 *
 * Persist a chat message sent inside a LiveKit session room. Sender identity
 * is server-determined for members (session.user.id); guests must include a
 * valid guestKey + their LiveKit identity.
 *
 * Body: {
 *   programSlug: string,
 *   sessionDate?: string,
 *   body: string,
 *   toIdentities?: string[],      // empty / omitted = broadcast
 *   // guest-only:
 *   guestKey?: string,
 *   guestIdentity?: string,
 *   guestName?: string,
 * }
 */
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const {
    programSlug,
    sessionDate,
    body,
    toIdentities,
    guestKey,
    guestIdentity,
    guestName,
  } = payload as {
    programSlug?: string;
    sessionDate?: string;
    body?: string;
    toIdentities?: string[];
    guestKey?: string;
    guestIdentity?: string;
    guestName?: string;
  };

  if (!programSlug || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "programSlug and body required" }, { status: 400 });
  }
  if (body.length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 chars)" }, { status: 400 });
  }

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, slug: true, isOpenAccess: true, guestAccessKey: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  let fromUserId: string | null = null;
  let fromIdentity: string;
  let fromName: string;

  const session = await auth();
  if (session?.user?.id) {
    fromUserId = session.user.id;
    fromIdentity = session.user.id;
    // Full name (first + last) to match the tile/roster display, not just first.
    const u = await db.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, lastName: true, preferredName: true },
    });
    fromName = sessionDisplayName(u, session.user.name || "Member");
  } else {
    if (!program.isOpenAccess || !guestKey || guestKey !== program.guestAccessKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!guestIdentity || !guestName) {
      return NextResponse.json({ error: "guestIdentity and guestName required" }, { status: 400 });
    }
    // A guest may only ever speak as their own server-issued identity, which
    // always carries the `guest-` prefix (see the guest-token route). Without
    // this check a guest could pass a member's userId — a cuid, harvestable
    // from the broadcast roster — as guestIdentity and persist a message
    // "from" that member. Member identities never start with `guest-`.
    // (Audit CHAT-1. The stronger fix — bind to the verified LiveKit token —
    // is a follow-up; this closes the member-impersonation vector.)
    if (!guestIdentity.startsWith("guest-")) {
      return NextResponse.json({ error: "Invalid guest identity" }, { status: 403 });
    }
    fromIdentity = guestIdentity;
    fromName = guestName.trim().slice(0, 60);
  }

  const recipients = Array.isArray(toIdentities)
    ? toIdentities.filter((s) => typeof s === "string" && s.length > 0).slice(0, 16)
    : [];

  const roomName = roomNameForProgram(programSlug, sessionDate);

  const saved = await db.sessionChatMessage.create({
    data: {
      roomName,
      programSlug,
      sessionDate: sessionDate ? new Date(sessionDate) : null,
      fromUserId,
      fromIdentity,
      fromName,
      body: body.trim(),
      toIdentities: recipients,
    },
  });

  return NextResponse.json({
    id: saved.id,
    roomName: saved.roomName,
    fromUserId: saved.fromUserId,
    fromIdentity: saved.fromIdentity,
    fromName: saved.fromName,
    body: saved.body,
    toIdentities: saved.toIdentities,
    sentAt: saved.sentAt.toISOString(),
  });
}

/**
 * GET /api/livekit/chat?programSlug=&sessionDate=&guestKey=&guestIdentity=
 *
 * Returns the last 100 messages for the room. Private DMs are filtered server
 * side — only sender or listed recipients see them.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const programSlug = url.searchParams.get("programSlug");
  const sessionDate = url.searchParams.get("sessionDate") || undefined;
  const guestKey = url.searchParams.get("guestKey") || undefined;
  const guestIdentity = url.searchParams.get("guestIdentity") || undefined;

  if (!programSlug) {
    return NextResponse.json({ error: "programSlug required" }, { status: 400 });
  }

  const program = await db.program.findFirst({
    where: { slug: programSlug },
    select: { id: true, isOpenAccess: true, guestAccessKey: true },
  });
  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  let callerIdentity: string;
  const session = await auth();
  if (session?.user?.id) {
    callerIdentity = session.user.id;
  } else {
    if (!program.isOpenAccess || !guestKey || guestKey !== program.guestAccessKey || !guestIdentity) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Scope guest reads to their own guest-prefixed identity. Without this a
    // guest could pass a member's userId as guestIdentity and read every DM
    // addressed to or sent by that member (the filter below matches on
    // callerIdentity). Member identities are cuids and never match `guest-`.
    // (Audit CHAT-1.)
    if (!guestIdentity.startsWith("guest-")) {
      return NextResponse.json({ error: "Invalid guest identity" }, { status: 403 });
    }
    callerIdentity = guestIdentity;
  }

  const roomName = roomNameForProgram(programSlug, sessionDate);

  const rows = await db.sessionChatMessage.findMany({
    where: {
      roomName,
      OR: [
        { toIdentities: { equals: [] } },
        { toIdentities: { has: callerIdentity } },
        { fromIdentity: callerIdentity },
      ],
    },
    orderBy: { sentAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      fromUserId: m.fromUserId,
      fromIdentity: m.fromIdentity,
      fromName: m.fromName,
      body: m.body,
      toIdentities: m.toIdentities,
      sentAt: m.sentAt.toISOString(),
    })),
  });
}
