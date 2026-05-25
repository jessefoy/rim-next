import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import {
  sendHostAssignmentConfirmationEmail,
  sendHostAssignmentRemovedEmail,
} from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : null;
}

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// POST /api/host/assignments/reassign
// HOST_MANAGER or ADMIN only. Swaps the current assignee (if any) for the
// requester on the given session.
//
// Body: { programSlug, sessionDate, currentAssignmentId? }
//   - If currentAssignmentId is provided, the old HostAssignment is deleted
//     (its open sub-requests are cancelled first). The previously assigned
//     host, if any, is notified.
//   - A fresh HostAssignment is created with userId = current user.
//
// Regular HOST uses the sub-request system for coverage transfers — this
// endpoint is reserved for managerial overrides.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];
  if (!isManager(roles)) {
    return Response.json(
      { error: "Only Host Managers and Admins can reassign sessions." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.programSlug) {
    return Response.json({ error: "programSlug is required" }, { status: 400 });
  }

  const { programSlug, sessionDate, currentAssignmentId } = body as {
    programSlug: string;
    sessionDate?: string | null;
    currentAssignmentId?: string | null;
  };

  const parsedDate = sessionDate ? new Date(sessionDate) : null;

  let previousUserId: string | null = null;

  if (currentAssignmentId) {
    const existing = await db.hostAssignment.findUnique({
      where: { id: currentAssignmentId },
    });
    if (!existing) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }
    previousUserId = existing.userId ?? null;

    if (previousUserId === session.user.id) {
      return Response.json(
        { error: "You're already hosting this session." },
        { status: 409 },
      );
    }

    await db.subRequest.updateMany({
      where: { assignmentId: existing.id, status: "OPEN" },
      data: { status: "CANCELLED" },
    });

    await db.hostAssignment.delete({ where: { id: existing.id } });
  }

  const created = await db.hostAssignment.create({
    data: {
      programSlug,
      userId: session.user.id,
      sessionDate: parsedDate,
      assignedBy: session.user.id,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
  });

  // Symmetric host notifications:
  //   - new host (the manager) gets a confirmation email
  //   - previously assigned host, if any, gets a "no longer hosting" email
  // Resolve program name + manager name once, then dispatch both in after().
  const newHostId = session.user.id;
  const displacedId = previousUserId;
  after(async () => {
    try {
      const program = await db.program.findUnique({
        where:  { slug: programSlug },
        select: { name: true, hostingHubSlug: true },
      });
      const programName = program?.name || programSlug;
      const dateText = fmtDate(parsedDate);
      const hubSlug = program?.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;

      const newHost = await db.user.findUnique({
        where:  { id: newHostId },
        select: { email: true, firstName: true, lastName: true, preferredName: true },
      });

      if (newHost?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: newHost.email,
          firstName: newHost.firstName,
          programName,
          dateText,
          hubSlug,
        });
      }

      if (displacedId && displacedId !== newHostId) {
        const displaced = await db.user.findUnique({
          where:  { id: displacedId },
          select: { email: true, firstName: true },
        });
        if (displaced?.email) {
          const byName =
            newHost?.preferredName ||
            [newHost?.firstName, newHost?.lastName].filter(Boolean).join(" ") ||
            "A coordinator";
          await sendHostAssignmentRemovedEmail({
            to: displaced.email,
            firstName: displaced.firstName,
            programName,
            dateText,
            byName,
            hubSlug,
          });
        }
      }
    } catch (e) {
      console.error("[host-assignment reassign] notification error:", e);
    }
  });

  return Response.json({
    id: created.id,
    programSlug: created.programSlug,
    sessionDate: created.sessionDate?.toISOString() ?? null,
    status: "claimed",
    hostUserId: created.userId,
    hostName: created.user
      ? (created.user.preferredName ||
          [created.user.firstName, created.user.lastName].filter(Boolean).join(" ") ||
          null)
      : null,
  });
}

