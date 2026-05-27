import { NextRequest, NextResponse, after } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";
import { EnrollmentSource } from "@prisma/client";
import { enrollMemberInProgramCourse } from "@/lib/enrollment";
import { sendCourseDanaReceiptEmail } from "@/lib/email";

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
  }

  // Other events can be handled here in the future (e.g. payment_intent.payment_failed)

  return NextResponse.json({ received: true });
}

async function handleRegistrationDanaCompleted(session: Stripe.Checkout.Session) {
  const {
    registrationId,
    programId,
    programTitle,
    programSlug,
    donorName,
    donorEmail,
    source,
  } = session.metadata ?? {};

  if (!registrationId) {
    console.error("[stripe/webhook] No registrationId in session metadata:", session.id);
    return;
  }

  const amountCents = session.amount_total ?? 0;

  // Update registration donation status; fetch userId + programId for enrollment
  const updatedReg = await db.registration.update({
    where: { id: registrationId },
    data: {
      donationStatus: "COMPLETED",
      donationAmount: amountCents,
      stripeSessionId: session.id,
    },
    select: { userId: true, programId: true },
  });

  // Enroll in series linked to this program. `after()` keeps the work
  // alive past the response — bare .catch(() => {}) silently lost work
  // to Vercel's serverless teardown (session 96 lesson).
  if (updatedReg.userId && updatedReg.programId) {
    const enrollUserId = updatedReg.userId;
    const enrollProgramId = updatedReg.programId;
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
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

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

  console.log(
    `[stripe/webhook] Donation recorded: ${registrationId} — $${(amountCents / 100).toFixed(2)}`
  );
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
