import { auth } from "@/auth";
import { after } from "next/server";
import { db } from "@/lib/db";
import { fmtSessionDay } from "@/lib/timezone";
import { authorizeSelfClaim } from "@/lib/hubMemberAuth";
import { Prisma } from "@prisma/client";
import {
  sendSubClaimedEmail,
  sendHostAssignmentConfirmationEmail,
  type SubClaimedEmailData,
} from "@/lib/email";
import { extractTextAsync } from "@/lib/renderRichContentServer";
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

  // Capability gate, scoped to the assignment's hub (session 129) so an
  // AV sub-request claim is gated against the AV team — not host-team.
  const roles = session.user.roles ?? [];
  const assignmentHubSlug =
    subRequest.assignment.hubSlug || (await getProgramHubSlug(subRequest.programSlug));
  // The same rule as every self-claim (lib/hubMemberAuth.ts): a member or an
  // oversight role, hosting allowed, enrolled on the team ("covers ⇒ member").
  // It used a role fallback that let a non-member cover and stay off the roster.
  if (!(await authorizeSelfClaim(session.user.id, roles, assignmentHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
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

  // Claim, close the request and move the seat, atomically. The request
  // closes only if it is still open, so two people covering at once can't
  // both win, and a cancel that landed first is respected (2026-10-16 audit).
  const won = await db.$transaction(async (tx) => {
    const closed = await tx.subRequest.updateMany({ where: { id, status: "OPEN" }, data: { status: "CLAIMED" } });
    if (closed.count === 0) return false;
    await tx.subClaim.create({
      data: { requestId: id, claimedById: session.user.id, message: message ?? Prisma.JsonNull },
    });
    await tx.hostAssignment.update({ where: { id: subRequest.assignmentId }, data: { userId: session.user.id } });
    return true;
  });
  if (!won) {
    return Response.json({ error: "Someone has already covered this session, or the request was closed." }, { status: 409 });
  }

  // The request's own date, else its assignment's (older requests were saved
  // undated), in Central Time (2026-10-15).
  const sessionAt = subRequest.sessionDate ?? subRequest.assignment.sessionDate;
  const sessionLabel = fmtSessionDay(sessionAt);

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
  // Two notes, each to the other person (2026-10-16 audit: the claimer's own
  // note was quoted back to them, and the request's note never reached them).
  const claimerNote = message ? (await extractTextAsync(message) || null) : null;
  const requestNote = subRequest.message ? (await extractTextAsync(subRequest.message) || null) : null;

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
          message: claimerNote,
          hubSlug: assignmentHubSlug,
          sessionAt,
        } as SubClaimedEmailData);
      }

      if (claimerForEmail?.email) {
        await sendHostAssignmentConfirmationEmail({
          to: claimerForEmail.email,
          firstName: claimerForEmail.firstName,
          programName,
          dateText: sessionLabel,
          requesterNote: requestNote,
          sessionAt,
          hubSlug: assignmentHubSlug,
        });
      }
    } catch (e) {
      console.error("[sub-claim] notification error:", e);
    }
  });

  return Response.json({ ok: true });
}
