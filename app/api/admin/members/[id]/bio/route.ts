import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

/**
 * PATCH /api/admin/members/[id]/bio
 *
 * ADMIN-only: edit any member's bio.
 * Body: { bio: unknown | null }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { bio } = await req.json();

  await db.user.update({
    where: { id },
    data: { bio: bio ?? Prisma.JsonNull },
  });

  return NextResponse.json({ ok: true });
}
