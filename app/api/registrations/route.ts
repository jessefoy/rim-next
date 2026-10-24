import { NextRequest, NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { auth } from "@/auth";
import { looksAutomated, BOT_RETRY_MESSAGE } from "@/lib/botCheck";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";
import {
  enrollMemberInOnboardingSeries,
  enrollMemberInProgramCourse,
} from "@/lib/enrollment";
import { toProperName } from "@/lib/nameCase";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import { fmtOpensAt, registrationWindow } from "@/lib/registrationWindow";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      programId,
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
    // The program's slug and title come from here too: the Zoom door and My
    // Home read the stored slug as proof of registration, so a slug from the
    // request let a free registration claim a paid or full program's room
    // (2026-10-19 audit).
    const pgProgram = await db.program.findUnique({
      where: { id: programId },
      select: {
        slug: true,
        name: true,
        archivedAt: true,
        registrationEnabled: true,
        registrationClosed: true,
        registrationDeadline: true,
        registrationOpensAt: true,
        registrationCapacity: true,
        danaMode: true,
        danaFixedAmount: true,
        danaBaseAmount: true,
      },
    });
    if (!pgProgram || pgProgram.archivedAt || !pgProgram.registrationEnabled) {
      return NextResponse.json(
        { error: "This program isn't taking registrations." },
        { status: 404 },
      );
    }
    // The same rule the register page shows (lib/registrationWindow.ts):
    // closed by the coordinator or past its deadline, or not open yet.
    // Checked before anything is written.
    const regWindow = registrationWindow(pgProgram);
    if (regWindow === "closed") {
      return NextResponse.json(
        { error: "Registration for this program has closed." },
        // Not 409: the form reads 409 as "already registered".
        { status: 403 },
      );
    }
    if (regWindow === "notYet" && pgProgram.registrationOpensAt) {
      return NextResponse.json(
        { error: `Registration for this program opens on ${fmtOpensAt(pgProgram.registrationOpensAt)}, Central time.` },
        { status: 403 },
      );
    }
    const programSlug = pgProgram.slug;
    const programTitle = pgProgram.name;
    const registrationCapacity = pgProgram.registrationCapacity ?? null;

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
    // The person's own hold is their seat, not someone else's: counted, it put
    // a member coming back to the last seat onto the waitlist behind their own
    // hold (2026-10-19 audit). Matched by account, or a guest by email.
    const session = await auth();
    const sessionUserId = session?.user?.id ?? null;
    const [takenCount, ownHolds] = await Promise.all([
      countPlacesTaken(programId),
      db.registration.count({
        where: {
          programId,
          status: "PENDING_PAYMENT",
          ...(sessionUserId ? { userId: sessionUserId } : { email: email.trim().toLowerCase() }),
        },
      }),
    ]);
    const activeCount = takenCount - ownHolds;

    const hasCapacity = registrationCapacity == null || activeCount < registrationCapacity;
    const spotsRemaining =
      registrationCapacity != null ? Math.max(0, registrationCapacity - activeCount) : null;

    // A provisional (held) registration requires payment AND has a seat: the row
    // exists only as the Stripe anchor until payment confirms. A required-payment
    // program that's FULL takes the normal waitlist path instead.
    const isProvisional = requiresPayment && hasCapacity;

    // Resolve the person: the signed-in member from the session, never from
    // the request (a userId in the body was trusted until 2026-10-13, which let
    // an unauthenticated request attach a registration to any account and
    // fill its blank profile fields). Anyone not signed in is a guest by email.
    // A guest registration creates a member account and sends email, so a bot
    // is refused before anything is written (lib/botCheck.ts). Signed-in
    // members proved who they are and are not checked.
    if (!sessionUserId && looksAutomated(body)) {
      console.warn("[registrations POST] automated registration refused");
      return NextResponse.json({ error: BOT_RETRY_MESSAGE }, { status: 400 });
    }
    let normalizedEmail = email.trim().toLowerCase();
    // What the form is told the address is. Normally the registration's own;
    // for a former address it stays the one typed, so the current address
    // isn't revealed to whoever typed the old one (lib/formerEmail.ts).
    let responseEmail: string | null = null;
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

    if (sessionUserId) {
      // Signed-in member: backfill any blank profile fields from registration data
      resolvedUserId = sessionUserId;
      const existing = await db.user.findUnique({
        where: { id: sessionUserId },
        select: { email: true, firstName: true, lastName: true, phone: true },
      });
      if (existing) {
        // The registration carries the account's own address (the form shows
        // it read-only), so its emails go to the member who registered.
        if (existing.email) normalizedEmail = existing.email.trim().toLowerCase();
        const updates: Record<string, unknown> = {};
        if (!existing.firstName && firstName?.trim()) updates.firstName = firstName.trim();
        if (!existing.lastName && lastName?.trim()) updates.lastName = lastName.trim();
        if (!existing.phone && phone?.trim()) updates.phone = phone.trim();
        if (Object.keys(updates).length > 0) {
          await db.user.update({ where: { id: sessionUserId }, data: updates });
        }
      }
    } else {
      // Guest path: find the account by email. An address the account used to
      // sign in with (lib/formerEmail.ts) links to that account, and the
      // registration takes its current address, so no second account is made.
      let user = await db.user.findUnique({ where: { email: normalizedEmail } });
      if (!user) {
        const moved = await accountForFormerEmail(normalizedEmail);
        if (moved) {
          user = await db.user.findUnique({ where: { id: moved.id } });
          if (user) {
            responseEmail = normalizedEmail;
            normalizedEmail = user.email.trim().toLowerCase();
          }
        }
      }
      if (user) {
        // Existing account: link it and use its stored values for the record.
        // Never overwrite existing data from unauthenticated form input.
        resolvedUserId = user.id;
        resolvedFirstName = user.firstName || firstName.trim();
        resolvedLastName = user.lastName || lastName.trim();
        resolvedPhone = user.phone || phone?.trim() || null;

        // Fill genuinely blank fields. Agreeing and un-archiving are left to
        // the person once they sign in (the Welcome and Reactivate pages): a
        // signed-out form can't show the address is theirs (2026-10-19 audit).
        const updates: Record<string, unknown> = {};
        if (!user.firstName && firstName?.trim()) updates.firstName = firstName.trim();
        if (!user.lastName && lastName?.trim()) updates.lastName = lastName.trim();
        if (!user.phone && phone?.trim()) updates.phone = phone.trim();
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
      // The address the confirmation goes to (a signed-in member's own), so
      // the form never names a different one.
      email: responseEmail ?? normalizedEmail,
      requiresPayment,
      // After this registration, spots remaining (for client feedback)
      spotsRemaining: spotsRemaining !== null ? Math.max(0, spotsRemaining - 1) : null,
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
