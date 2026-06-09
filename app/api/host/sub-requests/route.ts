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
import { isHubCoordinator } from "@/lib/hubAuth";
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

  // Resolve the assignment's hub (session 129). The capability gate and
  // the notification recipient pool both route by the assignment's own
  // hub — an AV sub-request notifies AV teammates, not host-team. Fall
  // back to the program's primary hub for legacy rows whose hubSlug
  // somehow didn't get backfilled.
  const assignmentHubSlug =
    assignment.hubSlug || (await getProgramHubSlug(assignment.programSlug));

  // Sub-requests don't apply to multi-claim hubs (greeter — open
  // sign-up). The user just cancels their own signup directly.
  const hub = await db.hub.findUnique({
    where: { slug: assignmentHubSlug },
    select: { allowsMultipleAssignments: true },
  });
  if (hub?.allowsMultipleAssignments) {
    return Response.json(
      { error: "This hub uses open sign-up — cancel your signup instead of asking for a sub." },
      { status: 400 },
    );
  }

  const roles = session.user.roles ?? [];
  if (!(await hasEffectiveHostAccess(session.user.id, roles, assignmentHubSlug))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  // Owner, a manager, OR a coordinator of the assignment's hub can open a cover
  // request. Coordinator parity with assign / remove / reassign / clear (session
  // 142 completed the coordinator-as-manager-for-their-own-hub model — this was
  // the one remaining manager-or-own-only coverage action). Scoped to THIS
  // assignment's hub, so a coordinator only acts on their own team; a plain host
  // still acts only on their own assignment. (Greeter/multi-claim hubs are
  // already rejected above — open sign-up has no sub-request flow.)
  const isManager = roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
  const canManage =
    isManager || (await isHubCoordinator(session.user.id, assignmentHubSlug));
  if (!canManage && assignment.userId !== session.user.id) {
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
      // Resolve the human-readable program name (slugs look ugly in email
      // bodies — "Jesse needs a sub for good-evening-silent-meditation"
      // versus "Jesse needs a sub for Good Evening Silent Meditation").
      // Per CLAUDE.md: resolve Program.name from the slug before sending
      // any host email.
      const [recipientUsers, program] = await Promise.all([
        getHubNotificationRecipients(assignmentHubSlug, {
          excludeUserId: assignment.userId ?? undefined,
        }),
        db.program.findUnique({
          where: { slug: assignment.programSlug },
          select: { name: true },
        }),
      ]);
      const programName = program?.name || assignment.programSlug;

      const messageText = message ? (await extractTextAsync(message as any) || null) : null;
      await Promise.all(
        recipientUsers.map((u) =>
          sendSubRequestEmail({
            to: u.email,
            firstName: u.firstName,
            requesterName,
            programName,
            sessionDate: sessionLabel,
            message: messageText,
            subRequestId: subRequest.id,
            hubSlug: assignmentHubSlug,
          } as SubRequestEmailData)
        )
      );
    } catch (e) {
      console.error("[sub-requests] notification error:", e);
    }
  });

  return Response.json({ id: subRequest.id, ok: true });
}
