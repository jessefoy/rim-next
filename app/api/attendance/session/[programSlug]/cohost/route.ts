import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/** CT midnight for a given Date. */
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
 * POST /api/attendance/session/[programSlug]/cohost
 *
 * Self-marks the authenticated user as a co-host for today's session.
 * Sets isPrimary = true if no HostAssignment exists for this program+date.
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
  const canMark = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!canMark) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { programSlug } = await params;
  const now = new Date();
  const sessionDate = ctMidnight(now);

  // Check whether a HostAssignment exists for this session
  const assignment = await db.hostAssignment.findFirst({
    where: { programSlug, sessionDate, userId: { not: null } },
    select: { id: true },
  });

  const isPrimary = !assignment;

  const coHost = await db.sessionCoHost.upsert({
    where: { programSlug_sessionDate_userId: { programSlug, sessionDate, userId: session.user.id } },
    create: { programSlug, sessionDate, userId: session.user.id, isPrimary },
    update: {}, // Already marked — no-op
    select: { id: true, isPrimary: true },
  });

  return NextResponse.json({ ok: true, isPrimary: coHost.isPrimary });
}
