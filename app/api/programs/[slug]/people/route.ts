import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { canUseRegistration } from "@/lib/toolAuth";
import { accountForFormerEmail } from "@/lib/formerEmail";
import { toProperName } from "@/lib/nameCase";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";
import { enrollMemberInProgramCourse } from "@/lib/enrollment";
import { addRegistrationToFlodesk } from "@/lib/flodesk";
import { sendDanaReminderEmail } from "@/lib/email";
import { recordRegistrationEvent } from "@/lib/registrationEvents";

// ─── POST /api/programs/[slug]/people ────────────────────────────────────────
// The Registration app's "Add a person" (2026-10-23): someone who phoned,
// wrote, or signed up on paper. Follows the public registration POST
// (app/api/registrations/route.ts) where it matters: the program's own
// record decides the place and the dana, an existing account (or a former
// address of one) is linked and its names kept, a new person becomes a
// member, a place gives course access, and the confirmation goes through the
// one choke point. Unlike the public form it may add after registration has
// closed (that is what it's for), and the registration team says how dana
// was given. No one is ever charged here.
//
// "They'll give online" keeps the system's rule that a registered person
// whose dana is not finished hasn't had their confirmation yet: they get the
// dana link now, and the confirmation comes once, when they give (the Stripe
// webhook) or decline, or after a day for a voluntary program (the cleanup
// cron). Sending it now as well sent it twice (review, 2026-10-23).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session || !canUseRegistration(session.user.roles)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Fill in their name and email." }, { status: 400 });
  }
  const firstName = toProperName(typeof body.firstName === "string" ? body.firstName : "").trim();
  const lastName = toProperName(typeof body.lastName === "string" ? body.lastName : "").trim();
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" && body.phone.trim() ? body.phone.trim() : null;
  const dana = body.dana === "given" || body.dana === "none" ? body.dana : "online";
  const sendConfirmation = body.sendConfirmation !== false;
  // What the page showed: a place, or the waiting list. If that changed since
  // it loaded, say so rather than record dana for a place they didn't get.
  const expectPlace = body.expectPlace !== false;

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "Fill in their first name, last name and email." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That email address doesn't look complete." }, { status: 400 });
  }

  const program = await db.program.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      archivedAt: true,
      registrationEnabled: true,
      registrationCapacity: true,
      danaMode: true,
      danaFixedAmount: true,
      danaBaseAmount: true,
    },
  });
  if (!program || program.archivedAt || !program.registrationEnabled) {
    return NextResponse.json({ error: "This program isn't taking registrations." }, { status: 404 });
  }

  // The person: their account by address, or by an address they used to use.
  let user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true },
  });
  if (!user) {
    const moved = await accountForFormerEmail(email);
    if (moved) {
      user = await db.user.findUnique({
        where: { id: moved.id },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      });
    }
  }

  // Already here, by account or by address? Say where they are rather than
  // adding them twice. A place held while they pay online is theirs: adding
  // them beside it made two registrations once the payment finished.
  const existing = await db.registration.findMany({
    where: {
      programId: program.id,
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        { email: { equals: email, mode: "insensitive" as const } },
      ],
    },
    select: { status: true },
  });
  const has = (...s: string[]) => existing.some((r) => s.includes(r.status));
  const refusal = has("PENDING_PAYMENT")
    ? "They're paying online right now, and their place is held. Wait for that to finish, or try again in an hour."
    : has("REGISTERED", "APPROVED")
    ? "They're already registered."
    : has("WAITLISTED")
    ? "They're already on the waiting list."
    : has("CANCELLED")
    ? "Their registration was cancelled; restore it from their card."
    : null;
  if (refusal) return NextResponse.json({ error: refusal }, { status: 409 });

  // The place, counted as the public form counts it: a held place is taken.
  const [taken, waiting] = await Promise.all([
    db.registration.count({
      where: { programId: program.id, status: { in: ["REGISTERED", "APPROVED", "PENDING_PAYMENT"] } },
    }),
    db.registration.count({ where: { programId: program.id, status: "WAITLISTED" } }),
  ]);
  const hasPlace = program.registrationCapacity == null || taken < program.registrationCapacity;
  const status = hasPlace ? "REGISTERED" : "WAITLISTED";
  if (hasPlace !== expectPlace) {
    return NextResponse.json(
      { error: hasPlace ? "A place has opened since this page loaded. Reload the page, then add them." : "The program filled since this page loaded. Reload the page, then add them." },
      { status: 409 },
    );
  }

  // Dana: the program decides whether it's asked; the team says how it went.
  const requiresPayment =
    (program.danaMode === "fixed" && (program.danaFixedAmount ?? 0) > 0) ||
    (program.danaMode === "base_plus_dana" && (program.danaBaseAmount ?? 0) > 0);
  const asksDana = program.danaMode === "voluntary" || requiresPayment;
  const donationStatus = !hasPlace
    ? "NOT_REQUIRED" // waiting: asked when offered a place
    : !asksDana
    ? "WAIVED"
    : dana === "given"
    ? "COMPLETED"
    : dana === "none"
    ? "WAIVED"
    : "PENDING";

  // A new person becomes a member, as on the public form; they agree to the
  // agreements themselves when they first sign in.
  let userId = user?.id ?? null;
  if (user) {
    const updates: Record<string, string> = {};
    if (!user.firstName) updates.firstName = firstName;
    if (!user.lastName) updates.lastName = lastName;
    if (!user.phone && phone) updates.phone = phone;
    if (Object.keys(updates).length) await db.user.update({ where: { id: user.id }, data: updates });
  } else {
    const created = await db.user.create({
      data: { email, firstName, lastName, phone, agreedToTerms: false },
      select: { id: true },
    });
    userId = created.id;
  }

  const registration = await db.registration.create({
    data: {
      programId: program.id,
      programSlug: program.slug,
      programTitle: program.name,
      userId,
      email: user?.email.trim().toLowerCase() ?? email,
      firstName: user?.firstName || firstName,
      lastName: user?.lastName || lastName,
      phone: user?.phone || phone,
      status,
      waitlistPosition: hasPlace ? null : waiting + 1,
      donationStatus,
    },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  await recordRegistrationEvent({
    kind: "added",
    programId: program.id,
    programSlug: program.slug,
    registrationId: registration.id,
    actorId: session.user.id,
    detail: { status, donationStatus, emailed: sendConfirmation || (status === "REGISTERED" && donationStatus === "PENDING") },
  });

  // Course access comes with the place, except a price still to be paid: as
  // on the public form, the webhook gives it on payment.
  const awaitsPayment = requiresPayment && donationStatus === "PENDING";
  if (status === "REGISTERED" && userId && !awaitsPayment) {
    const enrollUserId = userId;
    after(async () => {
      try {
        await enrollMemberInProgramCourse(enrollUserId, program.id);
      } catch (err) {
        console.error("[programs/people] enrollMemberInProgramCourse failed", err);
      }
    });
  }

  if (status === "REGISTERED" && donationStatus === "PENDING") {
    // Giving online: the dana link now; the confirmation follows the choice.
    await sendDanaReminderEmail({
      to: registration.email,
      firstName: registration.firstName,
      programTitle: program.name,
      programSlug: program.slug,
      registrationId: registration.id,
    });
  } else if (sendConfirmation) {
    // The choke point: their confirmation (or waiting-list email), support@'s
    // notice, and the program's mailing list.
    await sendRegistrationConfirmation(registration.id);
  } else {
    // No email, but a registered person still joins the program's mailing list.
    await addRegistrationToFlodesk(registration.id);
  }

  return NextResponse.json({
    ok: true,
    status,
    name: `${registration.firstName} ${registration.lastName}`.trim(),
    email: registration.email,
  });
}
