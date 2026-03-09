import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function hasAccess(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("REGISTRAR");
}

// POST /api/admin/households/[id]/members — add a member to the household
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || !hasAccess(session.user.roles ?? [])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: householdId } = await params;
  const body = await req.json();
  const { userId, relationshipType, relationshipCustom } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Check if member is already in a household
  const existing = await db.householdMember.findUnique({ where: { userId } });
  if (existing) {
    return NextResponse.json(
      { error: "This member is already in another household. Remove them from that household first." },
      { status: 409 }
    );
  }

  // Verify household exists
  const household = await db.household.findUnique({ where: { id: householdId } });
  if (!household) return NextResponse.json({ error: "Household not found" }, { status: 404 });

  const member = await db.householdMember.create({
    data: {
      householdId,
      userId,
      relationshipType: relationshipType ?? "OTHER",
      relationshipCustom: relationshipType === "OTHER" ? (relationshipCustom ?? null) : null,
      isPrimary: false,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json(member, { status: 201 });
}
