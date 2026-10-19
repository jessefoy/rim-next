import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { fmtSessionDay } from "@/lib/timezone";
import { Prisma } from "@prisma/client";
import { sendSubRequestEmail, type SubRequestEmailData, sendEachPaced } from "@/lib/email";
import { extractTextAsync } from "@/lib/renderRichContentServer";
import { getHubNotificationRecipients } from "@/lib/toolAuth";
import { canManageHubCoverage } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

// (The GET listing every team's open requests was removed 2026-10-15: no
// caller used it, and it ignored teams.)

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.assignmentId) {
    return Response.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const { assignmentId, message } = body as {
    assignmentId: string;
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
      { error: "This team uses open sign-up. Cancel your sign-up instead of asking for cover." },
      { status: 400 },
    );
  }

  const roles = session.user.roles ?? [];
  // Owner, a manager, OR a coordinator of the assignment's hub can open a cover
  // request. Coordinator parity with assign / remove / reassign / clear (session
  // 142 completed the coordinator-as-manager-for-their-own-hub model — this was
  // the one remaining manager-or-own-only coverage action). Scoped to THIS
  // assignment's hub, so a coordinator only acts on their own team; a plain host
  // still acts only on their own assignment. (Greeter/multi-claim hubs are
  // already rejected above — open sign-up has no sub-request flow.)
  // The person whose session it is may always ask (even while paused: they're
  // stepping back); managers and the team's coordinator may ask for them.
  const canManage = await canManageHubCoverage(session.user.id, roles, assignmentHubSlug);
  if (!canManage && assignment.userId !== session.user.id) {
    return Response.json({ error: "You can only request subs for your own assignments" }, { status: 403 });
  }

  // The request's date is the assignment's own (2026-10-15: the browser never
  // sent one, so every request was undated in emails and Updates).
  const sessionDate = assignment.sessionDate;

  // One open request per assignment (older requests were saved undated).
  const existing = await db.subRequest.findFirst({
    where: { assignmentId, status: "OPEN" },
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
      sessionDate,
      // Whose session it is (a coordinator may ask on their behalf).
      requestedById: assignment.userId ?? session.user.id,
      message: message ?? Prisma.JsonNull,
    },
  });

  const requesterName = assignment.user
    ? [assignment.user.firstName].filter(Boolean).join(" ") || assignment.user.email
    : "Someone";
  const sessionLabel = fmtSessionDay(sessionDate);

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
          canCover: true,
        }),
        db.program.findUnique({
          where: { slug: assignment.programSlug },
          select: { name: true },
        }),
      ]);
      const programName = program?.name || assignment.programSlug;

      const messageText = message ? (await extractTextAsync(message as any) || null) : null;
      // Not to the coordinator who asked on someone's behalf, either.
      const others = recipientUsers.filter((u) => u.id !== session.user.id);
      await sendEachPaced(others, (u) =>
        sendSubRequestEmail({
          to: u.email,
          firstName: u.firstName,
          requesterName,
          programName,
          sessionDate: sessionLabel,
          message: messageText,
          subRequestId: subRequest.id,
          sessionAt: sessionDate,
          hubSlug: assignmentHubSlug,
        } as SubRequestEmailData),
        "sub-request-posted",
      );
    } catch (e) {
      console.error("[sub-requests] notification error:", e);
    }
  });

  return Response.json({ id: subRequest.id, ok: true });
}
