import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// PATCH /api/attendance/[id]/flag — toggles flaggedByHost on a SessionAttendance record.
// Requires HOST, HOST_MANAGER, REGISTRAR, or ADMIN role.

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roles = session.user.roles ?? [];
  const canFlag = roles.some((r) =>
    ["HOST", "HOST_MANAGER", "REGISTRAR", "ADMIN"].includes(r)
  );
  if (!canFlag) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const record = await db.sessionAttendance.findUnique({
    where: { id },
    select: { id: true, flaggedByHost: true },
  });

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.sessionAttendance.update({
    where: { id },
    data: { flaggedByHost: !record.flaggedByHost },
    select: { id: true, flaggedByHost: true },
  });

  return NextResponse.json(updated);
}
