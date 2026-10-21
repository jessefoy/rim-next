import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse, after } from "next/server";
import { canAccessHub, effectiveCoordinator, getHubMembership, requireCoordinator } from "@/lib/hubAuth";
import { sendHubWelcomeEmail, hubHomeUrl } from "@/lib/email";

// No list GET (2026-10-19 audit): it returned every member's email and the
// coordinator's private note to any member, and nothing called it. The
// Members page builds its own list.

/** POST /api/hub/[slug]/members — add a member (coordinator or admin) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const isCoordinator = effectiveCoordinator(member, roles);
  try { requireCoordinator(isCoordinator, roles); }
  catch { return NextResponse.json({ error: "Coordinator required" }, { status: 403 }); }

  const body = await req.json();
  const { userId, position, isCoordinator: makeCoordinator } = body as {
    userId?: string;
    position?: string;
    isCoordinator?: boolean;
  };
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, archivedAt: true, firstName: true, email: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.archivedAt) {
    return NextResponse.json({ error: "This member is archived" }, { status: 422 });
  }

  const existing = await db.hubMember.findUnique({
    where: { hubId_userId: { hubId: hub.id, userId } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  const newMember = await db.hubMember.create({
    data: {
      hubId: hub.id,
      userId,
      position: position ?? null,
      isCoordinator: !!makeCoordinator,
    },
    include: { user: { select: { firstName: true, lastName: true, preferredName: true, title: true, email: true, avatarUrl: true, emailVerified: true } } },
  });

  // Welcome email — wrapped in after() so the in-flight Resend call survives
  // the response teardown.  Bare `.catch(() => {})` (the previous pattern)
  // was silently killed by Vercel's serverless lifecycle (the symptom Jesse
  // caught in the first peer-led hub test: Nancy didn't get her welcome
  // email).  Errors are now logged via console.error rather than swallowed.
  if (newMember.user.email) {
    const email = newMember.user.email;
    const firstName = newMember.user.firstName;
    after(async () => {
      try {
        await sendHubWelcomeEmail({
          to: email,
          firstName,
          hubName: hub.name,
          hubUrl: hubHomeUrl(slug),
        });
      } catch (e) {
        console.error("[hub-members] welcome email error:", e);
      }
    });
  }

  return NextResponse.json({
    id:            newMember.id,
    userId:        newMember.userId,
    isCoordinator: newMember.isCoordinator,
    position:      newMember.position,
    status:        newMember.status,
    hostingCapability:     newMember.hostingCapability,
    communicationsEnabled: newMember.communicationsEnabled,
    pausedAt:        newMember.pausedAt?.toISOString() ?? null,
    pausedById:      newMember.pausedById,
    pauseNote:       newMember.pauseNote,
    coordinatorNote: newMember.coordinatorNote,
    joinedAt:        newMember.joinedAt.toISOString(),
    // Only coordinators add members, so they may see this (as on the Members page).
    signedIn:        newMember.user.emailVerified !== null,
    user: {
      firstName:     newMember.user.firstName,
      lastName:      newMember.user.lastName,
      preferredName: newMember.user.preferredName,
      title:         newMember.user.title,
      email:         newMember.user.email,
      avatarUrl:     newMember.user.avatarUrl,
    },
  }, { status: 201 });
}
