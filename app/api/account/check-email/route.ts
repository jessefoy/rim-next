import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { checkRateLimit, getRequestIp } from "@/lib/rateLimit";

// GET /api/account/check-email?email=X
// Public — no auth required.
// Used by the registration form: on email blur, says whether the address
// belongs to a member, so the form can say the registration will be linked to
// their account and skip agreements they have already given.
// Returns { exists: false } or { exists: true, agreedToTerms }.
//
// It returns no name or phone (2026-10-19 audit): it answered any address,
// former ones included, with the member's name and phone, which undid the
// masking the sign-in page gives a changed address. A signed-in member's form
// fills from their own session instead. Rate-limited per IP.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase() ?? "";

  if (!email.includes("@")) {
    return NextResponse.json({ exists: false });
  }

  const ipCheck = await checkRateLimit(`check-email-ip:${getRequestIp(request)}`, 30, 10 * 60);
  if (!ipCheck.allowed) {
    // The form works without recognition; the registration still links by email.
    return NextResponse.json({ exists: false });
  }

  const select = { agreedToTerms: true } as const;
  let user = await db.user.findUnique({ where: { email }, select });
  if (!user) {
    // A former sign-in address answers for the account that used it.
    const moved = await accountForFormerEmail(email);
    if (moved) user = await db.user.findUnique({ where: { id: moved.id }, select });
  }

  if (!user) {
    return NextResponse.json({ exists: false });
  }

  return NextResponse.json({
    exists: true,
    agreedToTerms: user.agreedToTerms ?? false,
  });
}
