import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * POST /api/account/host-welcome-seen
 *
 * Marks the one-time "you're set up to host" dashboard panel as seen so it
 * doesn't show again. Called when the member dismisses or follows the panel
 * (session 143). Idempotent — setting the timestamp again is harmless.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { hostWelcomeSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
