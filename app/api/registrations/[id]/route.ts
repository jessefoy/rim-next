import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { RegistrationStatus, DonationStatus } from "@prisma/client";
import {
  sendApprovalEmail,
  sendCancellationNotificationEmail,
  sendDanaReminderEmail,
} from "@/lib/email";

// ─── PATCH — update status, notes, donationStatus, or send dana reminder ─────

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
    const { action, status, notes, donationStatus, danaMode } = body;

    // ── Special action: send dana reminder email ──────────────────────────────
    if (action === "sendDanaReminder") {
      const reg = await db.registration.findUnique({ where: { id } });
      if (!reg) {
        return NextResponse.json({ error: "Registration not found" }, { status: 404 });
      }
      if (reg.donationStatus !== "PENDING") {
        return NextResponse.json(
          { error: "Dana reminder only applies to registrations with PENDING dana" },
          { status: 400 }
        );
      }
      await sendDanaReminderEmail({
        to:           reg.email,
        firstName:    reg.firstName,
        programTitle: reg.programTitle,
        programSlug:  reg.programSlug,
      });
      return NextResponse.json({ ok: true });
    }

    // ── Standard field updates ────────────────────────────────────────────────

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

// ─── DELETE — permanently remove a CANCELLED registration ─────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;

    const registration = await db.registration.findUnique({ where: { id } });
    if (!registration) {
      return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    }

    // Guard: only CANCELLED records may be permanently deleted
    if (registration.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only CANCELLED registrations may be deleted. Cancel it first." },
        { status: 400 }
      );
    }

    await db.registration.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete registration error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
