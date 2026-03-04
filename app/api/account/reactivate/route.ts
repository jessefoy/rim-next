import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Self-service reactivation: clears archivedAt for the authenticated user
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { archivedAt: null },
  });

  return NextResponse.json({ ok: true });
}
