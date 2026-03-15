/**
 * PUT /api/support/settings/notifications
 *
 * Toggle email notifications for the current support team member.
 * Updates User.supportEmailNotifications.
 */

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  if (!roles.some((r) => ["SUPPORT", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { enabled } = await req.json();

  await db.user.update({
    where: { id: session.user.id },
    data: { supportEmailNotifications: enabled === true },
  });

  return NextResponse.json({ ok: true });
}
