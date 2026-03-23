import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  sendSubRequestEmail,
  type SubRequestEmailData,
} from "@/lib/email";
import { extractTextAsync } from "@/lib/renderRichContentServer";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

// GET /api/host/sub-requests — all OPEN sub requests (visible to all hub members)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await db.subRequest.findMany({
    where: { status: "OPEN" },
    include: {
      assignment: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
      claim: {
        include: {
          claimedBy: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json(
    requests.map((r) => ({
      id: r.id,
      programSlug: r.programSlug,
      sessionDate: r.sessionDate?.toISOString() ?? null,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      requester: r.assignment.user,
      assignmentId: r.assignmentId,
      claim: r.claim
        ? {
            id: r.claim.id,
            claimedBy: r.claim.claimedBy,
            message: r.claim.message,
            createdAt: r.claim.createdAt.toISOString(),
          }
        : null,
    }))
  );
}

// POST /api/host/sub-requests — create a sub request
// Body: { assignmentId, sessionDate?, message? }
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId) {
    return Response.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const { assignmentId, sessionDate, message } = body as {
    assignmentId: string;
    sessionDate?: string | null;
    message?: unknown;
  };

  // Verify assignment belongs to this user (or is HOST_MANAGER/ADMIN)
  const assignment = await db.hostAssignment.findUnique({
    where: { id: assignmentId },
    include: { user: { select: { id: true, firstName: true, email: true } } },
  });
  if (!assignment) {
    return Response.json({ error: "Assignment not found" }, { status: 404 });
  }
  const roles = session.user.roles ?? [];
  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  if (!isManager && assignment.userId !== session.user.id) {
    return Response.json({ error: "You can only request subs for your own assignments" }, { status: 403 });
  }

  // Check no existing open request for this assignment+date
  const existing = await db.subRequest.findFirst({
    where: { assignmentId, sessionDate: sessionDate ? new Date(sessionDate) : null, status: "OPEN" },
  });
  if (existing) {
    return Response.json(
      { error: "An open sub request already exists for this session." },
      { status: 409 }
    );
  }

  const subRequest = await db.subRequest.create({
    data: {
      assignmentId,
      programSlug: assignment.programSlug,
      sessionDate: sessionDate ? new Date(sessionDate) : null,
      message: message ?? Prisma.JsonNull,
    },
  });

  const requesterName = assignment.user
    ? [assignment.user.firstName].filter(Boolean).join(" ") || assignment.user.email
    : "Someone";
  const sessionLabel = sessionDate
    ? new Date(sessionDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  // Create alerts + send emails in background
  void (async () => {
    try {
      const recipientUsers = await db.user.findMany({
        where: {
          roles: { hasSome: ["HOST", "HOST_MANAGER", "ADMIN"] },
          archivedAt: null,
          ...(assignment.userId ? { NOT: { id: assignment.userId } } : {}),
        },
        select: { id: true, email: true, firstName: true },
      });
      await db.alert.createMany({
        data: recipientUsers.map((u) => ({
          userId: u.id,
          type: "SUB_REQUEST" as const,
          message: `${requesterName} needs a sub${sessionLabel ? ` on ${sessionLabel}` : ""} for ${assignment.programSlug}`,
          linkUrl: "/tools/schedule",
        })),
        skipDuplicates: true,
      });

      const messageText = message ? (await extractTextAsync(message as any) || null) : null;
      await Promise.all(
        recipientUsers.map((u) =>
          sendSubRequestEmail({
            to: u.email,
            firstName: u.firstName,
            requesterName,
            programName: assignment.programSlug,
            sessionDate: sessionLabel,
            message: messageText,
          } as SubRequestEmailData)
        )
      );
    } catch (e) {
      console.error("[sub-requests] notification error:", e);
    }
  })();

  return Response.json({ id: subRequest.id, ok: true });
}
