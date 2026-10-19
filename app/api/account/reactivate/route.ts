import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Self-service reactivation: clears archivedAt for the authenticated user
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Coming back lifts an Inactive status too, or the next registry save would
  // read the stale Inactive as a new archive and release their schedule
  // (2026-10-19 audit).
  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: { archivedAt: null },
    }),
    db.user.updateMany({
      where: { id: session.user.id, memberStatus: "INACTIVE" },
      data: { memberStatus: "ACTIVE" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
