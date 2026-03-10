import { auth } from "@/auth";
import { db } from "@/lib/db";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// GET /api/host/assignments — all assignments (HOST_MANAGER/ADMIN)
// or own assignments only (HOST)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const where = isManager(roles)
    ? {}
    : { userId: session.user.id };

  const assignments = await db.hostAssignment.findMany({
    where,
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true, email: true } },
    },
    orderBy: [{ programSlug: "asc" }, { sessionDate: "asc" }],
  });

  return Response.json(
    assignments.map((a) => ({
      id: a.id,
      programSlug: a.programSlug,
      sessionDate: a.sessionDate?.toISOString() ?? null,
      notes: a.notes,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    }))
  );
}

// POST /api/host/assignments — create an assignment (HOST_MANAGER/ADMIN only)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug || !body?.userId) {
    return Response.json({ error: "programSlug and userId are required" }, { status: 400 });
  }

  const { programSlug, userId, sessionDate, notes } = body as {
    programSlug: string;
    userId: string;
    sessionDate?: string | null;
    notes?: string | null;
  };

  // Check user has hub access (HOST or HOST_MANAGER)
  const targetUser = await db.user.findUnique({
    where: { id: userId },
    select: { roles: true, firstName: true, lastName: true },
  });
  if (!targetUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  const targetHasAccess = targetUser.roles.some((r) =>
    ["HOST", "HOST_MANAGER", "ADMIN"].includes(r)
  );
  if (!targetHasAccess) {
    return Response.json(
      { error: "This member does not have the Host role. Assign the Host role first." },
      { status: 422 }
    );
  }

  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  try {
    const assignment = await db.hostAssignment.create({
      data: {
        programSlug,
        userId,
        sessionDate: parsedDate,
        notes: notes ?? null,
        assignedBy: session.user.id,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, preferredName: true, email: true } },
      },
    });

    return Response.json({
      id: assignment.id,
      programSlug: assignment.programSlug,
      sessionDate: assignment.sessionDate?.toISOString() ?? null,
      notes: assignment.notes,
      createdAt: assignment.createdAt.toISOString(),
      user: assignment.user,
    });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      return Response.json(
        { error: "This host is already assigned to this program/session." },
        { status: 409 }
      );
    }
    console.error("[assignments] create error:", e);
    return Response.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
