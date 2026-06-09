import { NextRequest, NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";
import {
  enrollMemberInOnboardingSeries,
  enrollMemberInProgramCourse,
} from "@/lib/enrollment";
import { toProperName } from "@/lib/nameCase";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programId,
      programSlug,
      programTitle,
      email,
      phone,
      customFields,
      agreedToTerms,
    } = body;
    // Normalize the entered name once; downstream writes read these (their
    // existing .trim() calls are harmless no-ops on an already-clean value).
    const firstName = toProperName(typeof body.firstName === "string" ? body.firstName : "");
    const lastName = toProperName(typeof body.lastName === "string" ? body.lastName : "");

    if (!programId || !email?.trim() || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Fetch program from Postgres — never trust the client for capacity or dana.
    // The dana fields decide whether payment is REQUIRED (which makes this a
    // provisional, held registration) vs optional/none (a real registration).
    // Email content is loaded separately inside sendRegistrationConfirmation.
    const pgProgram = await db.program.findUnique({
      where: { id: programId },
      select: {
        registrationCapacity: true,
        danaMode: true,
        danaFixedAmount: true,
        danaBaseAmount: true,
      },
    });
    const registrationCapacity = pgProgram?.registrationCapacity ?? null;

    // Dana shape, derived server-side (not from the client body):
    //  - requiresPayment: a price must be paid before the registration is real
    //    (fixed / base_plus_dana with an amount configured).
    //  - invitesDana: an optional ask (voluntary) — the registration is valid
    //    whether or not they give, but completion waits for the give/decline
    //    choice so the "you're registered" moment lands after the choice.
    const danaMode = pgProgram?.danaMode ?? "none";
    const requiresPayment =
      (danaMode === "fixed" && (pgProgram?.danaFixedAmount ?? 0) > 0) ||
      (danaMode === "base_plus_dana" && (pgProgram?.danaBaseAmount ?? 0) > 0);
    const invitesDana = danaMode === "voluntary";

    // Count seats taken. PENDING_PAYMENT holds a seat during the active checkout
    // window (released automatically on abandonment — see the expiry handler).
    const activeCount = await db.registration.count({
      where: {
        programId,
        status: { in: ["REGISTERED", "APPROVED", "PENDING_PAYMENT"] },
      },
    });

    const hasCapacity = registrationCapacity == null || activeCount < registrationCapacity;
    const spotsRemaining =
      registrationCapacity != null ? Math.max(0, registrationCapacity - activeCount) : null;

    // A provisional (held) registration requires payment AND has a seat: the row
    // exists only as the Stripe anchor until payment confirms. A required-payment
    // program that's FULL takes the normal waitlist path instead.
    const isProvisional = requiresPayment && hasCapacity;

    // Resolve user — use provided userId (logged-in) or find by email.
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();
    // null for a brand-new guest on the provisional path: we DON'T create an
    // account until they actually pay (the Stripe webhook creates it). Existing
    // accounts are always linked; only new-account creation is deferred.
    let resolvedUserId: string | null = null;
    // Names/phone stored on the registration — taken from the account for existing
    // users so the registrar always sees the real values, regardless of form input.
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
      // Guest path: find the account by email.
      const user = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (user) {
        // Existing account: link it and use its stored values for the record.
        // Never overwrite existing data from unauthenticated form input.
        resolvedUserId = user.id;
        resolvedFirstName = user.firstName || firstName.trim();
        resolvedLastName = user.lastName || lastName.trim();
        resolvedPhone = user.phone || phone?.trim() || null;

        // Fill genuinely blank fields and handle agreements / restore.
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
          await db.user.update({ where: { id: user.id }, data: updates });
        }
      } else if (isProvisional) {
        // Brand-new guest on the provisional path: DON'T create an account yet.
        // They become a member only if they complete payment — the Stripe webhook
        // creates the account (and records agreement; the form required the
        // checkbox to reach here). The registration row snapshots their details.
        resolvedUserId = null;
      } else {
        // Brand-new guest on a free/voluntary registration — a real member now.
        const created = await db.user.create({
          data: {
            email: normalizedEmail,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone?.trim() ?? null,
            agreedToTerms: agreedToTerms === true,
            agreedAt: agreedToTerms === true ? now : null,
          },
        });
        resolvedUserId = created.id;
        // Auto-enroll new member in onboarding series. `after()` keeps the work
        // alive past the response (session 96 — bare .catch(() => {}) silently
        // lost work to Vercel's serverless teardown).
        if (agreedToTerms === true) {
          const newUserId = created.id;
          after(async () => {
            try {
              await enrollMemberInOnboardingSeries(newUserId);
            } catch (err) {
              console.error(
                "[registrations POST] enrollMemberInOnboardingSeries failed",
                err,
              );
            }
          });
        }
      }
    }

    // Duplicate / retry resolution. Match by account when we have one, else by
    // the email on the held guest row (provisional guests have no account yet).
    const personWhere: Prisma.RegistrationWhereInput = resolvedUserId
      ? { userId: resolvedUserId }
      : { email: normalizedEmail, userId: null };

    // Already a real (confirmed / waitlisted / approved) registration → duplicate.
    const confirmedDup = await db.registration.findFirst({
      where: {
        programId,
        ...personWhere,
        status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] },
      },
      select: { id: true },
    });
    if (confirmedDup) {
      return NextResponse.json(
        { error: "Already registered for this program" },
        { status: 409 }
      );
    }

    // Provisional path: reuse an existing held row (abandoned-then-retried)
    // instead of stacking duplicates — refresh its snapshot and return its id.
    if (isProvisional) {
      const heldRow = await db.registration.findFirst({
        where: { programId, ...personWhere, status: "PENDING_PAYMENT" },
        select: { id: true },
      });
      if (heldRow) {
        await db.registration.update({
          where: { id: heldRow.id },
          data: {
            firstName: resolvedFirstName,
            lastName: resolvedLastName,
            phone: resolvedPhone,
            customFields: customFields ?? undefined,
          },
        });
        return NextResponse.json({
          success: true,
          status: "PENDING_PAYMENT",
          registrationId: heldRow.id,
          requiresPayment: true,
          spotsRemaining: spotsRemaining !== null ? Math.max(0, spotsRemaining - 1) : null,
        });
      }
    }

    // Calculate waitlist position if needed
    let waitlistPosition: number | null = null;
    if (!hasCapacity) {
      waitlistPosition =
        (await db.registration.count({
          where: { programId, status: "WAITLISTED" },
        })) + 1;
    }

    const status: "PENDING_PAYMENT" | "REGISTERED" | "WAITLISTED" = !hasCapacity
      ? "WAITLISTED"
      : isProvisional
      ? "PENDING_PAYMENT"
      : "REGISTERED";

    const donationStatus: "NOT_REQUIRED" | "PENDING" | "WAIVED" = !hasCapacity
      ? "NOT_REQUIRED" // waitlisted — held until promoted
      : requiresPayment
      ? "PENDING" // owed; cleared by the Stripe webhook on payment
      : invitesDana
      ? "PENDING" // optional ask; cleared by give (webhook) or decline (endpoint)
      : "WAIVED"; // no dana practice

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
        status,
        waitlistPosition,
        donationStatus,
      },
    });

    if (status === "REGISTERED") {
      // A real registration (free 'none' or voluntary). Course access is a
      // consequence of registering, independent of the optional dana — enroll now.
      if (resolvedUserId) {
        const enrollUserId = resolvedUserId;
        const enrollProgramId = programId;
        after(async () => {
          try {
            await enrollMemberInProgramCourse(enrollUserId, enrollProgramId);
          } catch (err) {
            console.error(
              "[registrations POST] enrollMemberInProgramCourse failed",
              err,
            );
          }
        });
      }

      if (!invitesDana) {
        // 'none' (or required-but-misconfigured → WAIVED): no dana choice to wait
        // for, so the registration is complete now — send the confirmation.
        // Awaited intentionally so a failure surfaces in the response.
        await sendRegistrationConfirmation(registration.id);
      }
      // invitesDana (voluntary): the confirmation is deferred to the dana choice —
      // the decline endpoint or the Stripe webhook — so the "you're registered"
      // moment lands after they give or decline, not before.
    } else if (status === "WAITLISTED") {
      // Waitlisted is a definite state — send the waitlist email now.
      await sendRegistrationConfirmation(registration.id);
    }
    // PENDING_PAYMENT: no account, no enrollment, no email here. The Stripe
    // webhook completes the registration on payment; abandonment auto-expires.

    return NextResponse.json({
      success: true,
      status,
      registrationId: registration.id,
      requiresPayment,
      // After this registration, spots remaining (for client feedback)
      spotsRemaining: spotsRemaining !== null ? Math.max(0, spotsRemaining - 1) : null,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
