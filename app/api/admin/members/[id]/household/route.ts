import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

// GET /api/admin/members/[id]/household — returns the member's household (if any)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("REGISTRAR")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: userId } = await params;

  const hm = await db.householdMember.findUnique({
    where: { userId },
    include: {
      household: {
        select: { id: true, name: true },
      },
    },
  });

  if (!hm) return NextResponse.json(null);

  return NextResponse.json({ id: hm.household.id, name: hm.household.name });
}
