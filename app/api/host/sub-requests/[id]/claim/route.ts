import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  sendSubClaimedEmail,
  sendHostAssignmentConfirmationEmail,
  type SubClaimedEmailData,
} from "@/lib/email";
import { extractTextAsync } from "@/lib/renderRichContentServer";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { getProgramHubSlug } from "@/lib/programHub";

// POST /api/host/sub-requests/[id]/claim — claim an open sub request
// Body: { message? }
// Side-effect: updates assignment.userId to claimer (so session shows new host)
//
// Capability gate routes by the program's hosting hub. A peer-leader can
// claim a sub for a peer-led sit; a host-team volunteer can claim subs for
// host-team programs. ADMIN bypasses.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
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

  // Capability gate, scoped to the program's hosting hub.
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const programHubSlug = await getProgramHubSlug(subRequest.programSlug);
  const tentativeHost = isAdmin || roles.includes("HOST") || roles.includes("HOST_MANAGER");
  const canClaim = isAdmin
    ? true
    : await getEffectiveHostingCapability(session.user.id, programHubSlug, tentativeHost);
  if (!canClaim) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
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
        message: message ?? Prisma.JsonNull,
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

  // Resolve human-friendly program name (slug isn't great in an email body)
  // and the claimer's email + first name for their own confirmation.
  const [program, claimerForEmail] = await Promise.all([
    db.program.findUnique({
      where:  { slug: subRequest.programSlug },
      select: { name: true },
    }),
    db.user.findUnique({
      where:  { id: session.user.id },
      select: { email: true, firstName: true },
    }),
  ]);
  const programName = program?.name || subRequest.programSlug;
  const requesterNote = message ? (await extractTextAsync(message) || null) : null;

  // Send both emails after the response. The requester gets the existing
  // "your session is covered" email; the claimer gets a confirmation so they
  // have it in their inbox alongside their other host scheduling messages.
  after(async () => {
    try {
      const requester = subRequest.assignment.user;
      if (requester) {
        await sendSubClaimedEmail({
          to: requester.email,
          firstName: requester.firstName,
          claimerName,
          programName,
          sessionDate: sessionLabel,
          message: requesterNote,
        } as SubClaimedEmailData);
      }

      if (claimerForEmail?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: claimerForEmail.email,
          firstName: claimerForEmail.firstName,
          programName,
          dateText: sessionLabel,
          requesterNote,
        });
      }
    } catch (e) {
      console.error("[sub-claim] notification error:", e);
    }
  });

  return Response.json({ ok: true });
}
