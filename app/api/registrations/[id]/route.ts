import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RegistrationStatus, DonationStatus } from "@prisma/client";
import { sendApprovalEmail, sendCancellationNotificationEmail } from "@/lib/email";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, donationStatus, danaMode } = body;

    // Validate enum values if provided
    if (status && !Object.values(RegistrationStatus).includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (donationStatus && !Object.values(DonationStatus).includes(donationStatus)) {
      return NextResponse.json({ error: "Invalid donationStatus" }, { status: 400 });
    }

    // Fetch current record so we can detect status transitions
    const current = await db.registration.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Detect waitlist promotion (WAITLISTED → APPROVED or REGISTERED)
    const isPromotion =
      current.status === "WAITLISTED" &&
      (status === "APPROVED" || status === "REGISTERED");

    // Auto-set donationStatus on promotion unless caller explicitly overrides it.
    // If danaMode is provided and is not "none", the promoted member needs to complete dana.
    let resolvedDonationStatus: DonationStatus | undefined = donationStatus as DonationStatus | undefined;
    if (isPromotion && !donationStatus) {
      resolvedDonationStatus =
        danaMode && danaMode !== "none" ? "PENDING" : "WAIVED";
    }

    const registration = await db.registration.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(resolvedDonationStatus && { donationStatus: resolvedDonationStatus }),
      },
    });

    // Send approval email when promoted from waitlist
    if (isPromotion) {
      await sendApprovalEmail({
        to:           current.email,
        firstName:    current.firstName,
        programTitle: current.programTitle,
        programSlug:  current.programSlug,
        danaMode:     danaMode ?? null,
      });
    }

    // Notify registrar when any registration is cancelled
    const isCancellation = status === "CANCELLED" && current.status !== "CANCELLED";
    if (isCancellation) {
      await sendCancellationNotificationEmail({
        registrantName:  `${current.firstName} ${current.lastName}`,
        registrantEmail: current.email,
        programTitle:    current.programTitle,
        programSlug:     current.programSlug,
      });
    }

    return NextResponse.json({ success: true, registration });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
