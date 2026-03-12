import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** CT midnight for a given Date — mirrors the join route logic. */
function ctMidnight(date: Date): Date {
  const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(date);
  for (const offset of ["-05:00", "-06:00"]) {
    const noon = new Date(`${dateStr}T12:00:00${offset}`);
    const check = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(noon);
    if (check === dateStr) return new Date(`${dateStr}T00:00:00${offset}`);
  }
  return new Date(`${dateStr}T00:00:00-06:00`); // fallback CST
}

/**
 * POST /api/attendance/session/[programSlug]/end
 *
 * Sets sessionEndedAt on today's SessionReport (creating a stub record if none exists).
 * After this timestamp is set, /api/attendance/join treats the session as closed.
 *
 * Auth: HOST, HOST_MANAGER, ADMIN only.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ programSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canEnd = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!canEnd) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { programSlug } = await params;
  const now = new Date();
  const sessionDate = ctMidnight(now);

  const report = await db.sessionReport.upsert({
    where: { programSlug_sessionDate: { programSlug, sessionDate } },
    create: {
      programSlug,
      sessionDate,
      hostId: session.user.id,
      sessionEndedAt: now,
    },
    update: {
      sessionEndedAt: now,
    },
    select: { sessionEndedAt: true },
  });

  return NextResponse.json({ ok: true, sessionEndedAt: report.sessionEndedAt?.toISOString() });
}
