/**
 * POST /api/host/standing-assignments/apply
 *
 * Applies standing assignments for a given month, creating HostAssignment
 * records for every open session that matches a standing assignment pattern.
 *
 * Body: { programSlug?: string, year?: number, month?: number }
 *   programSlug — if provided, only apply for that program. Otherwise all.
 *   year/month  — defaults to current month (CT timezone).
 *
 * Idempotent — skips sessions that already have a HostAssignment.
 * Access: HOST_MANAGER / ADMIN / hub coordinator.
 */

import { after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getEffectiveHostingCapability } from "@/lib/hubMemberAuth";
import { applyStandingAssignments } from "@/lib/applyStandingAssignments";
import { sendStandingAssignmentScheduledEmail } from "@/lib/email";

const TZ = "America/Chicago";

function isManager(roles: string[]) {
  return roles.some((r) => ["HOST_MANAGER", "ADMIN"].includes(r));
}

async function isCoordinator(userId: string): Promise<boolean> {
  const m = await db.hubMember.findFirst({
    where: { userId, hub: { slug: "host-team" }, isCoordinator: true },
  });
  return !!m;
}

async function hasEffectiveHostAccess(userId: string, roles: string[]): Promise<boolean> {
  if (roles.includes("ADMIN")) return true;
  const tentative = roles.includes("HOST") || roles.includes("HOST_MANAGER");
  return getEffectiveHostingCapability(userId, "host-team", tentative);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const roles = session.user.roles ?? [];

  if (!isManager(roles) && !(await isCoordinator(session.user.id))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasEffectiveHostAccess(session.user.id, roles))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { programSlug = null } = body as { programSlug?: string | null };

  const now   = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const year  = body.year  ?? now.getFullYear();
  const month = body.month ?? now.getMonth() + 1;

  const result = await applyStandingAssignments(programSlug, year, month);

  after(async () => {
    for (const [, sessions] of result.byUser) {
      if (sessions.length === 0) continue;
      const { userEmail, firstName } = sessions[0];
      await sendStandingAssignmentScheduledEmail({
        to: userEmail,
        firstName,
        sessions: sessions.map((s) => ({ programName: s.programName, dateLabel: s.dateLabel })),
      });
    }
  });

  return Response.json({ created: result.created });
}
