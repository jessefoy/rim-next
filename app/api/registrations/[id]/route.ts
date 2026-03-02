import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RegistrationStatus, DonationStatus } from "@prisma/client";
import { sendApprovalEmail } from "@/lib/email";

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
    const { status, notes, donationStatus } = body;

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

    const registration = await db.registration.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(donationStatus && { donationStatus }),
      },
    });

    // Send approval email when a waitlisted person is confirmed
    if (status === "APPROVED" && current.status === "WAITLISTED") {
      await sendApprovalEmail({
        to:           current.email,
        firstName:    current.firstName,
        programTitle: current.programTitle,
        programSlug:  current.programSlug,
      });
    }

    return NextResponse.json({ success: true, registration });
  } catch (error) {
    console.error("Update registration error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
