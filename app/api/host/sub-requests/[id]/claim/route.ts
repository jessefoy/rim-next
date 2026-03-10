import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendSubClaimedEmail,
  type SubClaimedEmailData,
} from "@/lib/email";

function hasHubAccess(roles: string[]) {
  return roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
}

// POST /api/host/sub-requests/[id]/claim — claim an open sub request
// Body: { message? }
// Side-effect: updates assignment.userId to claimer (so session shows new host)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasHubAccess(session.user.roles ?? [])) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { message } = body as { message?: string };

  const subRequest = await db.subRequest.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          user: { select: { id: true, email: true, firstName: true } },
        },
      },
    },
  });

  if (!subRequest) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (subRequest.status !== "OPEN") {
    return Response.json({ error: "This request is no longer open" }, { status: 409 });
  }
  // Can't claim your own request
  if (subRequest.assignment.userId === session.user.id) {
    return Response.json({ error: "You cannot claim your own sub request" }, { status: 409 });
  }

  // Fetch claimer's name for notifications
  const claimer = await db.user.findUnique({
    where: { id: session.user.id },
    select: { firstName: true, lastName: true, email: true },
  });
  const claimerName =
    [claimer?.firstName, claimer?.lastName].filter(Boolean).join(" ") ||
    claimer?.email ||
    "Someone";

  // Create claim + flip status + update assignment.userId to claimer atomically
  await db.$transaction([
    db.subClaim.create({
      data: {
        requestId: id,
        claimedById: session.user.id,
        message: message ?? null,
      },
    }),
    db.subRequest.update({
      where: { id },
      data: { status: "CLAIMED" },
    }),
    db.hostAssignment.update({
      where: { id: subRequest.assignmentId },
      data: { userId: session.user.id },
    }),
  ]);

  const sessionLabel = subRequest.sessionDate
    ? subRequest.sessionDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  // Notify original host (fire-and-forget)
  void (async () => {
    try {
      const requester = subRequest.assignment.user;
      if (!requester) return;

      await db.alert.create({
        data: {
          userId: requester.id,
          type: "SUB_CLAIMED",
          message: `${claimerName} will cover your session${sessionLabel ? ` on ${sessionLabel}` : ""}`,
          linkUrl: "/account/host/schedule",
        },
      });

      await sendSubClaimedEmail({
        to: requester.email,
        firstName: requester.firstName,
        claimerName,
        programName: subRequest.programSlug,
        sessionDate: sessionLabel,
        message: message ?? null,
      } as SubClaimedEmailData);
    } catch (e) {
      console.error("[sub-claim] notification error:", e);
    }
  })();

  return Response.json({ ok: true });
}
