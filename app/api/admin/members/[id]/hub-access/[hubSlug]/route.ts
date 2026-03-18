import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// DELETE /api/admin/members/[id]/hub-access/[hubSlug] — revoke hub access
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; hubSlug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id, hubSlug } = await params;

  const record = await db.userHubAccess.findUnique({
    where: { userId_hubSlug: { userId: id, hubSlug } },
  });

  if (!record) {
    return NextResponse.json({ error: "Access record not found" }, { status: 404 });
  }

  await db.userHubAccess.delete({
    where: { userId_hubSlug: { userId: id, hubSlug } },
  });

  return NextResponse.json({ ok: true });
}
