import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * POST /api/attendance/session/[programSlug]/cohost-report
 *
 * Saves a co-host reflection for a session.
 * Creates or updates SessionCoHostReport for the current user.
 *
 * Auth: HOST, HOST_MANAGER, ADMIN only.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canSubmit = roles.some((r) => ["HOST", "HOST_MANAGER", "ADMIN"].includes(r));
  if (!canSubmit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { programSlug } = await params;
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { sessionDate, reflection } = body as {
    sessionDate: string;
    reflection: object | null;
  };

  const sessionDateParsed = new Date(sessionDate);
  if (isNaN(sessionDateParsed.getTime())) {
    return NextResponse.json({ error: "Invalid sessionDate" }, { status: 400 });
  }

  await db.sessionCoHostReport.upsert({
    where: {
      programSlug_sessionDate_userId: {
        programSlug,
        sessionDate: sessionDateParsed,
        userId: session.user.id,
      },
    },
    create: {
      programSlug,
      sessionDate: sessionDateParsed,
      userId: session.user.id,
      reflection: reflection ?? Prisma.JsonNull,
    },
    update: {
      reflection: reflection ?? Prisma.JsonNull,
    },
  });

  return NextResponse.json({ ok: true });
}
