import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse, after } from "next/server";
import { enrollMemberInOnboardingSeries } from "@/lib/enrollment";
import { sendLegacyWelcomeBackEmail } from "@/lib/email";
import { toProperName } from "@/lib/nameCase";
import { addVerifiedMemberToFlodesk } from "@/lib/flodesk";
import { RIM_SUPPORT_EMAIL } from "@/lib/locations";

// POST — save name/phone and mark community agreements accepted
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const firstName = toProperName(String(body.firstName ?? ""));
  const lastName = toProperName(String(body.lastName ?? ""));
  const phone = (body.phone ?? "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First and last name are required." }, { status: 400 });
  }

  // Read the pre-update state so we know whether this is a returning legacy
  // member being promoted out of the quiet pool (drives the welcome-back letter).
  const before = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, isLegacyUnclaimed: true },
  });

  await db.user.update({
    where: { id: session.user.id },
    data: {
      firstName,
      lastName,
      phone: phone || null,
      agreedToTerms: true,
      agreedAt: new Date(),
      // Promotion: a legacy import (or any pre-staged account) becomes a real
      // member the moment it crosses the agreement gate. No-op for everyone else.
      isLegacyUnclaimed: false,
    },
  });

  // Crossing the agreements, signed in (so the address is proven), makes a
  // member: Flodesk's Members segment, once.
  await addVerifiedMemberToFlodesk(session.user.id);

  // Auto-enroll in onboarding series. `after()` keeps the work alive past
  // the response (session 96 — Vercel tears the function down otherwise).
  after(async () => {
    try {
      await enrollMemberInOnboardingSeries(session.user.id);
    } catch (err) {
      console.error(
        "[account/complete-profile] enrollMemberInOnboardingSeries failed",
        err,
      );
    }
  });

  // Returning legacy member → the one-time "welcome back" letter (the returning
  // counterpart of join-welcome, which only fires on the /join door).
  if (before?.isLegacyUnclaimed) {
    const to = before.email;
    after(async () => {
      try {
        await sendLegacyWelcomeBackEmail({ to, firstName });
      } catch (err) {
        console.error("[account/complete-profile] sendLegacyWelcomeBackEmail failed", err);
      }
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE — member explicitly declined; remove their account entirely
//
// Only for the Welcome page's decline: someone who has never agreed, on an
// account with nothing attached (2026-10-19 audit). It deleted any signed-in
// account on request, skipping the admin delete's schedule release and its
// care with other people's replies. An account with a role, a team, a
// conversation or a registration is left for an admin, and the Welcome page
// says so beside the button.
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      agreedToTerms: true,
      roles: true,
      _count: { select: { hubMemberships: true, hubThreads2: true, registrations: true } },
    },
  });
  if (!user) return NextResponse.json({ ok: true });
  if (
    user.agreedToTerms ||
    user.roles.length > 0 ||
    user._count.hubMemberships > 0 ||
    user._count.hubThreads2 > 0 ||
    user._count.registrations > 0
  ) {
    return NextResponse.json(
      { error: `This account is kept, because it's connected to RIM. If you'd like it removed, write to ${RIM_SUPPORT_EMAIL} and we'll help.` },
      { status: 409 },
    );
  }

  // Cascade deletes: Sessions, Accounts, CourseAccess, etc.
  // Registrations use onDelete: SetNull — registration records are preserved with userId = null.
  await db.user.delete({ where: { id: session.user.id } });

  return NextResponse.json({ ok: true });
}
