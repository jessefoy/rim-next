import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse, after } from "next/server";
import { canAccessHub, effectiveCoordinator, getHubMembership, requireCoordinator } from "@/lib/hubAuth";
import { sendHubWelcomeEmail, hubHomeUrl } from "@/lib/email";

// GET /api/hub/[slug]/members — list hub members
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!canAccessHub(member, session.user.roles ?? [])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await db.hubMember.findMany({
    where: { hubId: hub.id },
    include: {
      user: { select: { firstName: true, lastName: true, preferredName: true, title: true, email: true, avatarUrl: true } },
    },
    orderBy: [{ isCoordinator: "desc" }, { joinedAt: "asc" }],
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      userId: m.userId,
      isCoordinator: m.isCoordinator,
      position: m.position,
      status: m.status,
      hostingCapability: m.hostingCapability,
      communicationsEnabled: m.communicationsEnabled,
      pausedAt: m.pausedAt?.toISOString() ?? null,
      pausedById: m.pausedById,
      pauseNote: m.pauseNote,
      coordinatorNote: m.coordinatorNote,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        preferredName: m.user.preferredName,
        title: m.user.title,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
      },
    }))
  );
}

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
    include: { user: { select: { firstName: true, lastName: true, preferredName: true, title: true, email: true, avatarUrl: true } } },
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
