import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import {
  sendHostAssignmentConfirmationEmail,
  sendHostAssignmentRemovedEmail,
} from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";
import { isHubCoordinator } from "@/lib/hubAuth";

function fmtDate(d: Date | null): string | null {
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : null;
}

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

// POST /api/host/assignments/reassign
// A manager (HOST_MANAGER/ADMIN), or a coordinator of the session's hub, can
// reassign — swaps the current assignee (if any) for the requester (the
// coordinator/manager takes the session over themselves). Coordinator parity
// with the assign + unclaim paths: scoped to the session's own hub.
//
// Body: { programSlug, sessionDate, currentAssignmentId? }
//   - If currentAssignmentId is provided, the old HostAssignment is deleted
//     (its open sub-requests are cancelled first). The previously assigned
//     host, if any, is notified.
//   - A fresh HostAssignment is created with userId = current user.
//
// Regular HOST uses the sub-request system for coverage transfers — this
// endpoint is reserved for coordinator/manager overrides.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const roles = session.user.roles ?? [];

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
  // Preserve the existing assignment's hub on reassign (session 129) so
  // an AV reassign doesn't accidentally route the new row to host-team.
  // Falls back to the program's primary hub when there's no existing
  // assignment to inherit from.
  let preservedHubSlug: string | null = null;

  // Load the existing assignment first (if any) so the permission check can be
  // scoped to the SESSION's hub.
  let existing: Awaited<ReturnType<typeof db.hostAssignment.findUnique>> = null;
  if (currentAssignmentId) {
    existing = await db.hostAssignment.findUnique({
      where: { id: currentAssignmentId },
    });
    if (!existing) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }
    previousUserId = existing.userId ?? null;
    preservedHubSlug = existing.hubSlug;
  }

  // Resolve the hub this reassign targets: the existing assignment's hub, else
  // the program's primary hosting hub. Gate on manager OR coordinator-of-hub.
  const sessionHubSlug =
    preservedHubSlug ??
    (await db.program.findUnique({
      where: { slug: programSlug },
      select: { hostingHubSlug: true },
    }))?.hostingHubSlug ??
    DEFAULT_HOSTING_HUB_SLUG;

  if (!isManager(roles) && !(await isHubCoordinator(session.user.id, sessionHubSlug))) {
    return Response.json(
      { error: "Only coordinators, Host Managers, and Admins can reassign sessions." },
      { status: 403 },
    );
  }

  if (previousUserId === session.user.id) {
    return Response.json(
      { error: "You're already hosting this session." },
      { status: 409 },
    );
  }

  if (existing) {
    // Atomic cascade-delete. SubRequest.assignmentId FK is Restrict — a
    // bare hostAssignment.delete would FK-violate on any historic non-OPEN
    // SubRequest. SubClaim cascades on SubRequest delete; explicit for
    // clarity. Session 130 follow-up — same FK-pattern fix applied to
    // clear-rotations, release-host, and assignments/[id] DELETE.
    const existingId = existing.id;
    await db.$transaction(async (tx) => {
      await tx.subClaim.deleteMany({
        where: { request: { assignmentId: existingId } },
      });
      await tx.subRequest.deleteMany({
        where: { assignmentId: existingId },
      });
      await tx.hostAssignment.delete({ where: { id: existingId } });
    });
  }

  const fallbackHubSlug = await (async () => {
    if (preservedHubSlug) return preservedHubSlug;
    const program = await db.program.findUnique({
      where: { slug: programSlug },
      select: { hostingHubSlug: true },
    });
    return program?.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG;
  })();

  const created = await db.hostAssignment.create({
    data: {
      programSlug,
      hubSlug: fallbackHubSlug,
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
        select: { name: true },
      });
      const programName = program?.name || programSlug;
      const dateText = fmtDate(parsedDate);
      // Use the created row's hub (session 129) so reassigns in AV /
      // peer-led hubs send their links back to the right scheduler view.
      const hubSlug = created.hubSlug;

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

