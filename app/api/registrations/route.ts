import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendRegistrationEmail } from "@/lib/email";
import { sanityClient } from "@/lib/sanity";
import { portableTextToEmailHtml, portableTextToEmailText } from "@/lib/portableTextEmail";
import { buildGoogleCalendarUrl, buildIcsUrl } from "@/lib/calendarLinks";

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
      customFields,
      danaMode,
      agreedToTerms,
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
    const now = new Date();
    let resolvedUserId: string;
    // Names and phone used in the Registration record — always taken from the account for
    // existing users so that the registrar always sees the real values, regardless of form input.
    let resolvedFirstName = firstName.trim();
    let resolvedLastName = lastName.trim();
    let resolvedPhone = phone?.trim() ?? null;

    if (body.userId) {
      // Logged-in member: backfill any blank profile fields from registration data
      resolvedUserId = body.userId;
      const existing = await db.user.findUnique({
        where: { id: body.userId },
        select: { firstName: true, lastName: true, phone: true },
      });
      if (existing) {
        const updates: Record<string, unknown> = {};
        if (!existing.firstName && firstName?.trim()) updates.firstName = firstName.trim();
        if (!existing.lastName && lastName?.trim()) updates.lastName = lastName.trim();
        if (!existing.phone && phone?.trim()) updates.phone = phone.trim();
        if (Object.keys(updates).length > 0) {
          await db.user.update({ where: { id: body.userId }, data: updates });
        }
      }
    } else {
      // Guest path: find or create User; set agreedToTerms if checkbox was checked
      let user = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        user = await db.user.create({
          data: {
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() ?? null,
            agreedToTerms: agreedToTerms === true,
            agreedAt: agreedToTerms === true ? now : null,
          },
        });
      } else {
        // Existing account: use the account's stored values for the registration record.
        // Never overwrite existing data from unauthenticated form input.
        resolvedFirstName = user.firstName || firstName.trim();
        resolvedLastName = user.lastName || lastName.trim();
        resolvedPhone = user.phone || phone?.trim() || null;

        // Still fill any genuinely blank fields and handle agreements / restore
        const updates: Record<string, unknown> = {};
        if (!user.firstName && firstName?.trim()) updates.firstName = firstName.trim();
        if (!user.lastName && lastName?.trim()) updates.lastName = lastName.trim();
        if (!user.phone && phone?.trim()) updates.phone = phone.trim();
        if (!user.agreedToTerms && agreedToTerms === true) {
          updates.agreedToTerms = true;
          updates.agreedAt = now;
        }
        // Auto-restore archived members who register for a new program
        if (user.archivedAt) {
          updates.archivedAt = null;
        }
        if (Object.keys(updates).length > 0) {
          user = await db.user.update({ where: { id: user.id }, data: updates });
        }
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
        firstName: resolvedFirstName,
        lastName: resolvedLastName,
        phone: resolvedPhone,
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

    // Fetch program-specific confirmation data from Sanity (fire-and-forget on error)
    let confirmationMessageHtml: string | undefined;
    let confirmationMessageText: string | undefined;
    let googleCalendarUrl: string | undefined;
    let icsUrl: string | undefined;
    try {
      const prog = await sanityClient.fetch<{
        confirmationMessage?: unknown[];
        startDatetime?: string | null;
        endDatetime?: string | null;
        repeatWeeks?: number | null;
      } | null>(
        `*[_type == "programs" && _id == $id && !(_id in path("drafts.**"))][0]{
          confirmationMessage, startDatetime, endDatetime, repeatWeeks
        }`,
        { id: programId }
      );
      if (prog?.confirmationMessage?.length) {
        confirmationMessageHtml = portableTextToEmailHtml(prog.confirmationMessage);
        confirmationMessageText = portableTextToEmailText(prog.confirmationMessage);
      }
      // Build calendar links only for confirmed (not waitlisted) registrations
      if (prog?.startDatetime && registration.status !== "WAITLISTED") {
        googleCalendarUrl = buildGoogleCalendarUrl({
          title: programTitle,
          startDatetime: prog.startDatetime,
          endDatetime: prog.endDatetime,
          location: locationText ?? null,
          programSlug,
          repeatWeeks: prog.repeatWeeks,
        });
        icsUrl = buildIcsUrl(programSlug);
      }
    } catch (err) {
      console.error("[registration] Failed to fetch confirmation data:", err);
    }

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
      confirmationMessageHtml,
      confirmationMessageText,
      googleCalendarUrl,
      icsUrl,
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
