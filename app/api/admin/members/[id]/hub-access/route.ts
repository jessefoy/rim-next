import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// POST /api/admin/members/[id]/hub-access — grant hub access to a member
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { hubSlug } = body;

  if (!hubSlug || typeof hubSlug !== "string") {
    return NextResponse.json({ error: "hubSlug is required" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Upsert — granting access that already exists is a no-op
  const record = await db.userHubAccess.upsert({
    where: { userId_hubSlug: { userId: id, hubSlug } },
    create: { userId: id, hubSlug, grantedById: session.user.id },
    update: {},
  });

  return NextResponse.json({ ok: true, hubSlug: record.hubSlug, grantedAt: record.grantedAt.toISOString() });
}
