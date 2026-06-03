import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";

// Daily backstop for the registration → dana flow. The real-time mechanisms are
// the Stripe `checkout.session.expired` webhook (releases a held seat at the
// 60-min checkout expiry) and the decline endpoint / completion webhook. This
// cron catches the rows those miss.
//
// Two sweeps:
//
//   1. Release abandoned holds. A PENDING_PAYMENT row is a required-payment
//      registration held only as the Stripe anchor. If the `expired` event was
//      ever missed, delete the row older than 2h (well past the 60-min expiry).
//      No account exists for a guest hold, so there's no orphan; a member's
//      account is their own and untouched.
//
//   2. Finalize abandoned voluntary registrations. A voluntary registration is
//      real (REGISTERED) the moment it's submitted, but its confirmation email
//      is deferred to the give/decline choice. If someone closed the tab without
//      choosing, the row sits REGISTERED + donationStatus PENDING with no email
//      sent. After 24h, treat the abandonment as a decline: mark WAIVED and send
//      the confirmation. The WAIVED flip makes this idempotent (finalized once).
//
// Schedule: see vercel.json. Vercel passes CRON_SECRET as
// Authorization: Bearer <secret>.

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();

  // 1. Release abandoned holds (backstop for a missed `expired` event).
  const holdCutoff = new Date(now - 2 * 60 * 60 * 1000); // 2 hours ago
  const { count: holdsReleased } = await db.registration.deleteMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: holdCutoff } },
  });

  // 2. Finalize voluntary registrations abandoned before the dana choice.
  const voluntaryCutoff = new Date(now - 24 * 60 * 60 * 1000); // 24 hours ago
  const stale = await db.registration.findMany({
    where: {
      status: "REGISTERED",
      donationStatus: "PENDING",
      createdAt: { lt: voluntaryCutoff },
    },
    select: { id: true },
  });

  let finalized = 0;
  for (const r of stale) {
    // The where-guard makes the WAIVED transition happen at most once, so the
    // confirmation can't be re-sent on a later run.
    const res = await db.registration.updateMany({
      where: { id: r.id, status: "REGISTERED", donationStatus: "PENDING" },
      data: { donationStatus: "WAIVED" },
    });
    if (res.count > 0) {
      try {
        await sendRegistrationConfirmation(r.id);
        finalized++;
      } catch (err) {
        console.error(
          `[cleanup-pending-registrations] confirmation failed for ${r.id}`,
          err,
        );
      }
    }
  }

  console.log(
    `[cleanup-pending-registrations] Released ${holdsReleased} hold(s); finalized ${finalized} voluntary registration(s).`,
  );
  return NextResponse.json({ ok: true, holdsReleased, finalized });
}
