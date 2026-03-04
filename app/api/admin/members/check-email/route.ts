import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// GET /api/admin/members/check-email?email=X&excludeId=Y
// Returns { available: true } or { available: false, error: "..." }
// Used for real-time conflict detection in the admin member detail email field.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const email     = searchParams.get("email")?.trim().toLowerCase() ?? "";
  const excludeId = searchParams.get("excludeId") ?? "";

  if (!email.includes("@")) {
    return NextResponse.json({ available: false, error: "Invalid email address" });
  }

  const conflict = await db.user.findFirst({
    where: { email, id: { not: excludeId } },
    select: { id: true },
  });

  if (conflict) {
    return NextResponse.json({
      available: false,
      error: "That email address is already used by another member.",
    });
  }

  return NextResponse.json({ available: true });
}
