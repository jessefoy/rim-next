import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  sendSubRequestEmail,
  type SubRequestEmailData,
} from "@/lib/email";
import { extractTextAsync } from "@/lib/renderRichContentServer";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { DEFAULT_HOSTING_HUB_SLUG, getProgramHubSlug } from "@/lib/programHub";

/**
 * Capability gate, scoped to a specific hub. For the program-aware POST
 * handler, callers pass the program's `hostingHubSlug`. The GET handler
 * (list-all-open sub-requests) keeps the legacy host-team gate — broadening
 * it to "host-capable in any hub" is a Slice 2 concern when the second
 * hosting hub goes live and its surface is wired into the schedule tool.
 */
async function hasEffectiveHostAccess(
  userId: string,
  roles: string[],
  hubSlug: string = DEFAULT_HOSTING_HUB_SLUG,
): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, hubSlug, tentative);
}

// GET /api/host/sub-requests — all OPEN sub requests (visible to all hub members)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, session.user.roles ?? []))) {
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

  // Resolve the program's hosting hub. The capability gate and the
  // notification recipient pool both route through it — a peer-leader in
  // `peer-led-silent-meditation` requesting a sub for a peer-led sit
  // notifies their hub, not host-team.
  const programHubSlug = await getProgramHubSlug(assignment.programSlug);

  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles, programHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
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

  // Send emails after the response. `after()` keeps the work alive past
  // Response.json() — without it, Vercel tears the function down and the
  // in-flight Resend calls get killed (the symptom: emails arrive
  // intermittently, or not at all).
  after(async () => {
    try {
      const recipientUsers = await getHubNotificationRecipients(programHubSlug, {
        excludeUserId: assignment.userId ?? undefined,
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
            subRequestId: subRequest.id,
          } as SubRequestEmailData)
        )
      );
    } catch (e) {
      console.error("[sub-requests] notification error:", e);
    }
  });

  return Response.json({ id: subRequest.id, ok: true });
}
