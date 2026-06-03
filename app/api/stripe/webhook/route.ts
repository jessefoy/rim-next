import { NextRequest, NextResponse, after } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";
import { EnrollmentSource } from "@prisma/client";
import {
  enrollMemberInProgramCourse,
  enrollMemberInOnboardingSeries,
} from "@/lib/enrollment";
import { sendCourseDanaReceiptEmail } from "@/lib/email";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";

// POST /api/stripe/webhook
// Receives Stripe webhook events and updates the database.
// Must be registered in Stripe Dashboard → Developers → Webhooks.
// Required env var: STRIPE_WEBHOOK_SECRET

// IMPORTANT: Next.js must NOT parse the body — Stripe needs the raw bytes
// for signature verification. We read the raw buffer manually.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error("[stripe/webhook] Missing signature or webhook secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe/webhook] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // ── Handle events ──────────────────────────────────────────────────────────

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const source = (session.metadata?.source ?? "") as string;

    // Route by source — courses and programs use the same Stripe webhook
    // but write to different tables. New sources go here.
    if (source === "course_dana") {
      await handleCourseDanaCompleted(session);
    } else {
      // Default / legacy: registration-dana flow.
      await handleRegistrationDanaCompleted(session);
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const source = (session.metadata?.source ?? "") as string;
    // Only registration-dana has a provisional row to release. Course
    // self-enroll creates no row until completion, so there's nothing to clean.
    if (source !== "course_dana") {
      await handleRegistrationDanaExpired(session);
    }
  }

  // Other events can be handled here in the future (e.g. payment_intent.payment_failed)

  return NextResponse.json({ received: true });
}

async function handleRegistrationDanaCompleted(session: Stripe.Checkout.Session) {
  const {
    registrationId,
    programId,
    programTitle,
    donorName,
    donorEmail,
    source,
  } = session.metadata ?? {};

  if (!registrationId) {
    console.error("[stripe/webhook] No registrationId in session metadata:", session.id);
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Load the registration's pre-state. For a provisional (required-payment) row
  // this is where it becomes real; for a voluntary row it just records the gift.
  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    select: {
      userId: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      donationStatus: true,
      programId: true,
    },
  });
  if (!reg) {
    console.error("[stripe/webhook] Registration not found:", registrationId);
    return;
  }

  // Idempotency anchor: the Donation row keyed by payment_intent is the
  // authoritative "this payment is already processed" marker (Stripe can
  // deliver the same event twice). Gate the one-time side-effect — the
  // confirmation email — on whether it already existed BEFORE this delivery.
  let donationAlreadyExisted = false;
  if (paymentIntentId) {
    const existing = await db.donation.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true },
    });
    donationAlreadyExisted = !!existing;
  }

  // Ensure an account exists. A brand-new guest on a required-payment program
  // has no account until now — completing payment is what makes them a member.
  let userId = reg.userId;
  if (!userId) {
    let user = await db.user.findUnique({ where: { email: reg.email } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: reg.email,
          firstName: reg.firstName,
          lastName: reg.lastName,
          phone: reg.phone,
          // The registration form required the community-agreements checkbox to
          // reach checkout, so agreement is implied at account creation.
          agreedToTerms: true,
          agreedAt: new Date(),
        },
      });
      // New member → onboarding series.
      const newUserId = user.id;
      after(async () => {
        try {
          await enrollMemberInOnboardingSeries(newUserId);
        } catch (err) {
          console.error("[stripe/webhook] enrollMemberInOnboardingSeries failed", err);
        }
      });
    }
    userId = user.id;
  }

  // Complete the registration: link the account, promote a provisional row to
  // REGISTERED (leave an already-confirmed voluntary / approved row as-is), and
  // record the gift. Idempotent on redelivery (sets the same values).
  await db.registration.update({
    where: { id: registrationId },
    data: {
      userId,
      status: reg.status === "PENDING_PAYMENT" ? "REGISTERED" : reg.status,
      donationStatus: "COMPLETED",
      donationAmount: amountCents,
      stripeSessionId: session.id,
    },
  });

  // Enroll in series linked to this program (idempotent upsert). `after()` keeps
  // the work alive past the response — bare .catch(() => {}) silently lost work
  // to Vercel's serverless teardown (session 96 lesson).
  const enrollProgramId = reg.programId ?? programId ?? null;
  if (userId && enrollProgramId) {
    const enrollUserId = userId;
    after(async () => {
      try {
        await enrollMemberInProgramCourse(enrollUserId, enrollProgramId);
      } catch (err) {
        console.error(
          "[stripe/webhook] enrollMemberInProgramCourse failed",
          err,
        );
      }
    });
  }

  // Write to the Donation ledger — upsert for idempotency (Stripe can deliver webhooks twice)
  if (paymentIntentId) {
    await db.donation.upsert({
      where: { stripePaymentIntentId: paymentIntentId },
      create: {
        source: "STRIPE",
        amountCents,
        currency: session.currency ?? "usd",
        donatedAt: new Date(),
        donorName: donorName || null,
        donorEmail: donorEmail || session.customer_email || null,
        programId: programId || null,
        programTitle: programTitle || null,
        registrationId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
        notes: `Registration dana — ${source ?? "registration_dana"}`,
      },
      update: {}, // already exists — no-op
    });
  } else {
    // No payment intent (e.g. $0 session) — create without unique key
    await db.donation.create({
      data: {
        source: "STRIPE",
        amountCents,
        currency: session.currency ?? "usd",
        donatedAt: new Date(),
        donorName: donorName || null,
        donorEmail: donorEmail || session.customer_email || null,
        programId: programId || null,
        programTitle: programTitle || null,
        registrationId,
        stripeCheckoutSessionId: session.id,
        notes: `Registration dana — ${source ?? "registration_dana"}`,
      },
    });
  }

  // Confirmation email — only on the first completion. Now that the registration
  // is REGISTERED + paid, the "you're registered" moment lands here. Gated on the
  // donation pre-check so a redelivered webhook doesn't double-send.
  if (!donationAlreadyExisted) {
    after(async () => {
      try {
        await sendRegistrationConfirmation(registrationId);
      } catch (err) {
        console.error("[stripe/webhook] registration confirmation email failed", err);
      }
    });
  }

  console.log(
    `[stripe/webhook] Registration dana ${donationAlreadyExisted ? "redelivery" : "completed"}: ${registrationId} — $${(amountCents / 100).toFixed(2)}`
  );
}

// A required-payment checkout that expired without completing. Release the
// provisional hold so the seat frees up and nothing lingers. The status guard
// deletes ONLY a still-held PENDING_PAYMENT row — never a REGISTERED one — so a
// voluntary-give session that expired (its registration is valid and intact) or
// a payment that completed via a different/duplicate event is left untouched.
// Provisional guest rows have no account (deferred to payment), so there's no
// orphan to clean; a logged-in member's account is their own and stays.
async function handleRegistrationDanaExpired(session: Stripe.Checkout.Session) {
  const { registrationId } = session.metadata ?? {};
  if (!registrationId) return;

  const { count } = await db.registration.deleteMany({
    where: { id: registrationId, status: "PENDING_PAYMENT" },
  });

  if (count > 0) {
    console.log(`[stripe/webhook] Expired hold released: ${registrationId}`);
  }
}

// ── Course self-enroll dana (session 123, slice 4) ──────────────────────────
async function handleCourseDanaCompleted(session: Stripe.Checkout.Session) {
  const {
    courseId,
    courseSlug,
    courseTitle,
    userId,
    donorName,
    donorEmail,
  } = session.metadata ?? {};

  if (!courseId || !userId) {
    console.error(
      "[stripe/webhook] course_dana session missing courseId or userId:",
      session.id
    );
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Pre-check whether this payment_intent has already been ledgered.
  // Stripe can deliver the same webhook twice; we use this to decide
  // whether to send the receipt email below (the DB writes themselves
  // are idempotent — this gates the side-effect that isn't).
  let donationAlreadyExisted = false;
  if (paymentIntentId) {
    const existing = await db.donation.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
      select: { id: true },
    });
    donationAlreadyExisted = !!existing;
  }

  // SeriesEnrollment + Donation atomically — if the ledger write fails,
  // the member doesn't end up enrolled-without-receipt and vice versa.
  await db.$transaction(async (tx) => {
    await tx.seriesEnrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {},
      create: {
        userId,
        courseId,
        enrollmentSource: EnrollmentSource.SELF,
      },
    });

    if (paymentIntentId) {
      await tx.donation.upsert({
        where: { stripePaymentIntentId: paymentIntentId },
        create: {
          source: "STRIPE",
          amountCents,
          currency: session.currency ?? "usd",
          donatedAt: new Date(),
          userId,
          donorName: donorName || null,
          donorEmail: donorEmail || session.customer_email || null,
          courseId,
          courseTitle: courseTitle || null,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          notes: "Course self-enroll dana",
        },
        update: {},
      });
    } else {
      // No payment_intent (e.g. $0 session — checkout endpoint guards against
      // this, but the fallback exists for safety). No unique key, so we
      // can't dedup; rely on the checkout-endpoint guard.
      await tx.donation.create({
        data: {
          source: "STRIPE",
          amountCents,
          currency: session.currency ?? "usd",
          donatedAt: new Date(),
          userId,
          donorName: donorName || null,
          donorEmail: donorEmail || session.customer_email || null,
          courseId,
          courseTitle: courseTitle || null,
          stripeCheckoutSessionId: session.id,
          notes: "Course self-enroll dana ($0 session)",
        },
      });
    }
  });

  // Receipt email — fire-and-forget via after() so the webhook returns
  // promptly to Stripe. Gated on donationAlreadyExisted so a duplicate
  // webhook delivery doesn't double-send (sendTemplatedEmail has no
  // dedup of its own).
  const recipientEmail = donorEmail || session.customer_email;
  if (!donationAlreadyExisted && recipientEmail && courseSlug && courseTitle) {
    after(async () => {
      try {
        await sendCourseDanaReceiptEmail({
          to: recipientEmail,
          firstName: (donorName || "").split(" ")[0] || "friend",
          courseTitle,
          courseSlug,
          amountCents,
        });
      } catch (err) {
        console.error("[stripe/webhook] course-dana receipt email failed:", err);
      }
    });
  }

  console.log(
    `[stripe/webhook] Course dana ${donationAlreadyExisted ? "redelivery" : "completed"}: ${courseSlug} / user ${userId} — $${(amountCents / 100).toFixed(2)}`
  );
}
