/**
 * POST /api/host/programs/[slug]/clear-rotations
 *
 * Per-program rotation cleanup — two modes:
 *
 *   mode: "clear"
 *     Deletes all future HostAssignment rows for this program (sessionDate >= today).
 *     StandingAssignment rotation rules are untouched — they will re-fill on the
 *     next save or cron run. Use when redoing the schedule for one program while
 *     keeping the rotation patterns.
 *
 *   mode: "reset"
 *     Same as "clear" PLUS deletes all StandingAssignment records for this program.
 *     The rotation grid for this program becomes empty. Use when tearing down the
 *     rotation structure and starting fresh.
 *
 * Both modes preserve past HostAssignment records (sessionDate < today).
 * Affected hosts are NOT emailed (this is a coordinator-level bulk operation,
 * not a per-host release — email would be noisy and unexpected).
 *
 * Body: { mode: "clear" | "reset" }
 * Returns: { deletedAssignments: number, deletedRotations: number }
 *
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { auth } from "@/auth";
import { sendCoverageClearedEmails } from "@/lib/email";
import { after } from "next/server";
import { db } from "@/lib/db";

import { canManageHubCoverage } from "@/lib/hubAuth";
import { getProgramHubSlug } from "@/lib/programHub";
import { ctStartOfToday } from "@/lib/timezone";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  const { slug: programSlug } = await params;
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode as string | undefined;
  const bodyHubSlug = body?.hubSlug as string | undefined;

  if (mode !== "clear" && mode !== "reset") {
    return Response.json({ error: "mode must be 'clear' or 'reset'" }, { status: 400 });
  }

  // Hub scope (session 129 audit fix). Body wins so a coordinator
  // clearing rotations from their own hub's RotationsClient affects
  // only that hub. Defaults to the program's primary hosting hub for
  // backward compat with any caller that didn't yet pass hubSlug.
  const programHubSlug = await getProgramHubSlug(programSlug);
  const targetHubSlug = bodyHubSlug || programHubSlug;

  // One rule for managing a team's coverage (lib/hubAuth.ts, 2026-10-15).
  if (!(await canManageHubCoverage(session.user.id, roles, targetHubSlug))) {
    return Response.json({ error: "You don't have permission to do that on this team's schedule." }, { status: 403 });
  }

  // CT-anchored today cutoff — past sessions are never touched
  const todayCt = ctStartOfToday(); // Central midnight, not UTC (2026-10-15)

  let deletedAssignments = 0;
  let deletedRotations   = 0;
  let clearedRows: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[] = [];

  // Atomic cleanup. SubRequest.assignmentId FK is Restrict (no cascade),
  // so the parent HostAssignment delete will FK-violate if any SubRequest
  // (any status — OPEN, CLAIMED, CANCELLED) still references the row.
  // The pre-session-130 version cancelled OPEN sub-requests with
  // updateMany and left non-OPEN ones in place — that was the bug Jesse
  // hit (HTTP 500) on programs with historic sub-requests. Matches the
  // canonical pattern in /api/host/assignments/clear/route.ts.
  await db.$transaction(async (tx) => {
    const futureAssns = await tx.hostAssignment.findMany({
      where: { programSlug, hubSlug: targetHubSlug, sessionDate: { gte: todayCt } },
      select: { id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true },
    });
    clearedRows = futureAssns;
    const futureAssnIds = futureAssns.map((a) => a.id);

    if (futureAssnIds.length > 0) {
      await tx.subClaim.deleteMany({
        where: { request: { assignmentId: { in: futureAssnIds } } },
      });
      await tx.subRequest.deleteMany({
        where: { assignmentId: { in: futureAssnIds } },
      });
      const assignResult = await tx.hostAssignment.deleteMany({
        where: { id: { in: futureAssnIds } },
      });
      deletedAssignments = assignResult.count;
    }

    if (mode === "reset") {
      const rotResult = await tx.standingAssignment.deleteMany({
        where: { programSlug, hubSlug: targetHubSlug },
      });
      deletedRotations = rotResult.count;
    }
  });

  // The people taken off these sessions are told (2026-10-16 audit).
  if (clearedRows.length) {
    const program = await db.program.findUnique({ where: { slug: programSlug }, select: { name: true } });
    const programName = program?.name ?? programSlug;
    after(() =>
      sendCoverageClearedEmails({
        rows: clearedRows,
        reason: (team) => `The ${team}'s upcoming schedule for ${programName} has been cleared.`,
        excludeUserId: session.user.id,
      }),
    );
  }

  // Diagnostic log to correlate with the client's `[reset]` console output
  // when a coordinator reports the action "not working." Session 130
  // follow-up. Visible in `vercel logs` for the deployment.
  console.log("[reset-rotations]", {
    programSlug,
    targetHubSlug,
    mode,
    deletedAssignments,
    deletedRotations,
    userId: session.user.id,
  });

  return Response.json({ deletedAssignments, deletedRotations });
}
