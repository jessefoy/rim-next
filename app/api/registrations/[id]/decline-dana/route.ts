import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";

// POST /api/registrations/[id]/decline-dana
//
// The voluntary "No thank you" path. Completes a voluntary registration without
// a gift: marks the dana WAIVED and sends the confirmation — so the
// "you're registered" moment lands after the give/decline choice, not at submit.
//
// Only valid for a real, voluntary registration (status REGISTERED, dana still
// PENDING). Provisional required-payment rows pay via Stripe; they never decline.
//
// Ownership mirrors /api/stripe/checkout: a logged-in member must own the
// registration; a guest must match the registration's email.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const providedEmail: string | undefined =
      typeof body?.email === "string" ? body.email : undefined;

    const registration = await db.registration.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        donationStatus: true,
      },
    });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Ownership: logged-in owner OR matching guest email.
    const session = await auth();
    const isOwnerByAccount =
      !!session?.user?.id && registration.userId === session.user.id;
    const isOwnerByEmail =
      !!providedEmail &&
      registration.email === providedEmail.trim().toLowerCase();
    if (!isOwnerByAccount && !isOwnerByEmail) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Already gave — nothing to decline.
    if (registration.donationStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "A dana offering has already been completed for this registration" },
        { status: 409 }
      );
    }

    // Flip PENDING → WAIVED exactly once. The where-guard makes a double-click
    // (or any re-call) a no-op, so the confirmation can't be sent twice.
    const result = await db.registration.updateMany({
      where: { id, status: "REGISTERED", donationStatus: "PENDING" },
      data: { donationStatus: "WAIVED" },
    });

    if (result.count > 0) {
      // First transition — the registration is now complete; send the confirmation.
      await sendRegistrationConfirmation(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[registrations decline-dana] Error:", error);
    return NextResponse.json({ error: "Could not complete" }, { status: 500 });
  }
}
