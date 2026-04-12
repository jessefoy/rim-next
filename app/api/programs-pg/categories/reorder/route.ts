import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * PATCH /api/programs-pg/categories/reorder
 * Body: { orderedIds: string[] }
 * Sets sortOrder = index for each category ID in order.
 * Requires REGISTRAR or ADMIN role.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const roles = (session.user.roles ?? []) as string[];
  if (!roles.includes("ADMIN") && !roles.includes("REGISTRAR")) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 });
  }

  // Update each category's sortOrder to its position in the array
  await Promise.all(
    orderedIds.map((id: string, index: number) =>
      db.programCategory.update({
        where: { id },
        data: { sortOrder: index + 1 },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
