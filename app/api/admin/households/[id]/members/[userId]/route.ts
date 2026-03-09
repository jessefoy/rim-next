import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function hasAccess(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("REGISTRAR");
}

// PATCH /api/admin/households/[id]/members/[userId] — update relationship or isPrimary
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: householdId, userId } = await params;
  const body = await req.json();
  const { isPrimary, relationshipType, relationshipCustom } = body;

  // If setting isPrimary, clear it from all other members first
  if (isPrimary === true) {
    await db.householdMember.updateMany({
      where: { householdId, userId: { not: userId } },
      data: { isPrimary: false },
    });
  }

  const updated = await db.householdMember.update({
    where: { userId },
    data: {
      isPrimary: isPrimary !== undefined ? isPrimary : undefined,
      relationshipType: relationshipType !== undefined ? relationshipType : undefined,
      relationshipCustom:
        relationshipType !== undefined
          ? relationshipType === "OTHER"
            ? (relationshipCustom ?? null)
            : null
          : undefined,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/households/[id]/members/[userId] — remove member from household
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await params;

  await db.householdMember.delete({ where: { userId } });
  return NextResponse.json({ ok: true });
}
