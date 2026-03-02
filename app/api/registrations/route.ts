import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRegistrationEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programId,
      programSlug,
      programTitle,
      registrationCapacity,
      dateText,
      timeText,
      locationText,
      email,
      firstName,
      lastName,
      phone,
      comments,
      customFields,
      danaMode,
    } = body;

    if (!programId || !email?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Count confirmed (non-cancelled, non-waitlisted) registrations
    const activeCount = await db.registration.count({
      where: {
        programId,
        status: { in: ["REGISTERED", "APPROVED"] },
      },
    });

    const hasCapacity = registrationCapacity == null || activeCount < registrationCapacity;
    const spotsRemaining =
      registrationCapacity != null ? Math.max(0, registrationCapacity - activeCount) : null;

    // Resolve user — use provided userId (logged-in) or find/create by email
    const normalizedEmail = email.trim().toLowerCase();
    let resolvedUserId: string;
    if (body.userId) {
      resolvedUserId = body.userId;
    } else {
      let user = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        user = await db.user.create({
          data: {
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() ?? null,
          },
        });
      }
      resolvedUserId = user.id;
    }

    // Prevent duplicate registration
    const existing = await db.registration.findFirst({
      where: {
        programId,
        userId: resolvedUserId,
        status: { not: "CANCELLED" },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Already registered for this program" },
        { status: 409 }
      );
    }

    // Calculate waitlist position if needed
    let waitlistPosition: number | null = null;
    if (!hasCapacity) {
      waitlistPosition =
        (await db.registration.count({
          where: { programId, status: "WAITLISTED" },
        })) + 1;
    }

    const registration = await db.registration.create({
      data: {
        programId,
        programSlug,
        programTitle,
        userId: resolvedUserId,
        email: normalizedEmail,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone?.trim() ?? null,
        comments: comments?.trim() ?? null,
        customFields: customFields ?? undefined,
        status: hasCapacity ? "REGISTERED" : "WAITLISTED",
        waitlistPosition,
        // WAIVED if no dana practice; NOT_REQUIRED if waitlisted (promoted later); else PENDING
        donationStatus: !hasCapacity
          ? "NOT_REQUIRED"
          : !danaMode || danaMode === "none"
          ? "WAIVED"
          : "PENDING",
      },
    });

    // Send confirmation email — fire-and-forget, never blocks the response
    await sendRegistrationEmail({
      to:              normalizedEmail,
      firstName:       firstName.trim(),
      programTitle,
      programSlug,
      status:          registration.status as "REGISTERED" | "WAITLISTED",
      waitlistPosition: registration.waitlistPosition,
      dateText:        dateText ?? null,
      timeText:        timeText ?? null,
      locationText:    locationText ?? null,
    });

    return NextResponse.json({
      success: true,
      status: registration.status,
      registrationId: registration.id,
      // After this registration, spots remaining (for client feedback)
      spotsRemaining: spotsRemaining !== null ? Math.max(0, spotsRemaining - 1) : null,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
