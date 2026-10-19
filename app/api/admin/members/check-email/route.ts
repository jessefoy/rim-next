import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { accountForFormerEmail } from "@/lib/formerEmail";

// GET /api/admin/members/check-email?email=X&excludeId=Y
// Returns { available: true } or { available: false, error: "..." }
// Used for real-time conflict detection in the admin member detail email field.
// ADMIN + REGISTRAR, the same people who can save the field (it was ADMIN
// only, so a registrar's "Unauthorized" blocked every save once they touched
// the email; 2026-10-19 audit). It answers as the save does, former
// addresses included.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => r === "ADMIN" || r === "REGISTRAR")) {
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

  const formerOwner = await accountForFormerEmail(email);
  if (formerOwner && formerOwner.id !== excludeId) {
    return NextResponse.json({
      available: false,
      error: "That address used to belong to another member's account.",
    });
  }

  return NextResponse.json({ available: true });
}
