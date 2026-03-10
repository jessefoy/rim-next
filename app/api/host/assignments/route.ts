import { auth } from "@/auth";
import { db } from "@/lib/db";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// GET /api/host/assignments
// Query params:
//   ?month=YYYY-MM  — filter to sessions in that month (optional)
//   (no param)      — returns all assignments
// Returns sessions with derived status (unclaimed / claimed / sub_needed)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  const hasHubAccess = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!hasHubAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // e.g. "2026-03"

  let dateFilter: { sessionDate?: { gte: Date; lte: Date } } = {};
  if (monthParam) {
    const [year, month] = monthParam.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    dateFilter = { sessionDate: { gte: start, lte: end } };
  }

  const where = isManager(roles)
    ? dateFilter
    : { userId: session.user.id, ...dateFilter };

  const assignments = await db.hostAssignment.findMany({
    where,
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
      },
      subRequests: {
        where: { status: "OPEN" },
        select: { id: true, message: true },
        take: 1,
      },
    },
    orderBy: [{ sessionDate: "asc" }, { programSlug: "asc" }],
  });

  return Response.json(
    assignments.map((a) => {
      const openSub = a.subRequests[0] ?? null;
      const status: "unclaimed" | "claimed" | "sub_needed" = !a.userId
        ? "unclaimed"
        : openSub
          ? "sub_needed"
          : "claimed";

      return {
        id: a.id,
        programSlug: a.programSlug,
        sessionDate: a.sessionDate?.toISOString() ?? null,
        notes: a.notes,
        createdAt: a.createdAt.toISOString(),
        status,
        hostUserId: a.userId ?? null,
        hostName: a.user
          ? (a.user.preferredName ||
              [a.user.firstName, a.user.lastName].filter(Boolean).join(" ") ||
              a.user.email)
          : null,
        subRequestId: openSub?.id ?? null,
        subMessage: openSub?.message ?? null,
      };
    })
  );
}

// POST /api/host/assignments — create a session or assign a host (HOST_MANAGER/ADMIN only)
// Body: { programSlug, sessionDate?, userId? (null = unclaimed), notes? }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isManager(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug) {
    return Response.json({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, userId, sessionDate, notes } = body as {
    programSlug: string;
    userId?: string | null;
    sessionDate?: string | null;
    notes?: string | null;
  };

  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  // App-level uniqueness check: one session per (programSlug, sessionDate)
  const existing = await db.hostAssignment.findFirst({
    where: {
      programSlug,
      sessionDate: parsedDate,
    },
  });
  if (existing) {
    return Response.json(
      { error: "A session already exists for this program on that date." },
      { status: 409 }
    );
  }

  // If assigning a specific user, verify they have hub access
  if (userId) {
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { roles: true },
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
  }

  const assignment = await db.hostAssignment.create({
    data: {
      programSlug,
      userId: userId ?? null,
      sessionDate: parsedDate,
      notes: notes ?? null,
      assignedBy: session.user.id,
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, preferredName: true, email: true },
      },
    },
  });

  return Response.json({
    id: assignment.id,
    programSlug: assignment.programSlug,
    sessionDate: assignment.sessionDate?.toISOString() ?? null,
    notes: assignment.notes,
    createdAt: assignment.createdAt.toISOString(),
    status: "unclaimed",
    hostUserId: assignment.userId ?? null,
    hostName: assignment.user
      ? (assignment.user.preferredName ||
          [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(" ") ||
          assignment.user.email)
      : null,
  });
}
