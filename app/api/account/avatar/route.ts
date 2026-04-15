import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * PATCH /api/account/avatar
 *
 * Save or clear the current user's avatarUrl (presence photo).
 * Used from profile settings and from inside a video session.
 *
 * Body: { avatarUrl: string | null }
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { avatarUrl } = await req.json();

  await db.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: avatarUrl ?? null },
  });

  return NextResponse.json({ ok: true, avatarUrl });
}
