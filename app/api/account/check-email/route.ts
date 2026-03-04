import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/account/check-email?email=X
// Public — no auth required.
// Used by the registration form: on email blur, pre-fill name/phone for known members.
// Returns { exists: false } or { exists: true, firstName, lastName, phone, agreedToTerms }
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";

  if (!email.includes("@")) {
    return NextResponse.json({ exists: false });
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { firstName: true, lastName: true, phone: true, agreedToTerms: true },
  });

  if (!user) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    phone: user.phone ?? "",
    agreedToTerms: user.agreedToTerms ?? false,
  });
}
