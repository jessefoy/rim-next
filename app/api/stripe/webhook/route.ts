import { NextRequest, NextResponse, after } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";
import { EnrollmentSource } from "@prisma/client";
import {
  enrollMemberInProgramCourse,
  enrollMemberInOnboardingSeries,
} from "@/lib/enrollment";
import { sendCourseDanaReceiptEmail, sendRegistrationDanaReceiptEmail } from "@/lib/email";
import { sendRegistrationConfirmation } from "@/lib/registrationConfirmation";
import { resolveDanaCharge } from "@/lib/programUtils";

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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    // Re-read the session from Stripe instead of trusting the event body's
    // shape. Stripe renders an event in the API version set on the webhook
    // destination (the old sandbox one was 2013-02-13; the new one is a
    // 2026 "dahlia" release), while this code is typed for the SDK's pinned
    // version. A fresh retrieve always comes back in the pinned version, so a
    // destination's version setting can never change what RIM reads.
    // If Stripe can't be reached, fail so Stripe retries the delivery.
    const eventSessionId = (event.data.object as { id?: string }).id;
    if (!eventSessionId) {
      return NextResponse.json({ received: true });
    }
    try {
      event.data.object = await stripe.checkout.sessions.retrieve(eventSessionId);
    } catch (err) {
      console.error("[stripe/webhook] Could not re-read checkout session; asking Stripe to retry", eventSessionId, err);
      return NextResponse.json({ error: "Temporary failure" }, { status: 500 });
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const source = (session.metadata?.source ?? "") as string;

    // Route by source — courses and programs use the same Stripe webhook
    // but write to different tables. New sources go here.
    if (source === "course_dana") {
      await handleCourseDanaCompleted(session);
    } else {
      // Default / legacy: registration-dana flow. event.created is when the
      // payment completed; Stripe may deliver (or retry) this event later.
      await handleRegistrationDanaCompleted(session, new Date(event.created * 1000));
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

async function handleRegistrationDanaCompleted(
  session: Stripe.Checkout.Session,
  paidAt: Date,
) {
  const meta = session.metadata ?? {};
  const {
    registrationId,
    programId,
    programTitle,
    donorName,
    donorEmail,
    source,
  } = meta;

  if (!registrationId) {
    console.error("[stripe/webhook] No registrationId in session metadata:", session.id);
    return;
  }

  const amountCents = session.amount_total ?? 0;
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const regSelect = {
    userId: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    status: true,
    donationStatus: true,
    programId: true,
    programSlug: true,
    programTitle: true,
  } as const;

  // Load the registration's pre-state. For a provisional (required-payment) row
  // this is where it becomes real; for a voluntary row it just records the gift.
  let reg = await db.registration.findUnique({
    where: { id: registrationId },
    select: regSelect,
  });
  if (!reg) {
    // The money has been taken, so the person must end up registered and
    // receipted. A held row can be cleared before payment lands (an old
    // checkout expiring, the daily sweep); restore it from what the checkout
    // carried rather than dropping the payment on the floor. Questionnaire
    // answers weren't in the checkout, so the note tells the registrar to ask.
    const email = (meta.donorEmail || session.customer_email || "").trim().toLowerCase();
    const programSlug = meta.programSlug;
    if (!email || !programSlug) {
      console.error(
        "[stripe/webhook] PAYMENT WITHOUT REGISTRATION and not enough metadata to restore it:",
        { registrationId, sessionId: session.id, paymentIntentId },
      );
      return;
    }
    const [fallbackFirst, ...fallbackRest] = (meta.donorName || "").trim().split(/\s+/);
    try {
      reg = await db.registration.create({
        data: {
          id: registrationId,
          programId: programId || null,
          programSlug,
          programTitle: programTitle || programSlug,
          email,
          firstName: meta.firstName || fallbackFirst || "",
          lastName: meta.lastName || fallbackRest.join(" "),
          status: "PENDING_PAYMENT", // promoted to REGISTERED just below
          donationStatus: "PENDING",
          notes:
            "<p>Restored automatically when payment arrived: the held registration had been cleared before the payment completed. Registration questions were not recovered, so please ask the registrant for their answers.</p>",
        },
        select: regSelect,
      });
    } catch (err) {
      // A concurrent delivery restored it first: use that row.
      const winner = await db.registration.findUnique({ where: { id: registrationId }, select: regSelect });
      if (!winner) throw err;
      reg = winner;
    }
    console.error(
      `[stripe/webhook] Restored a cleared registration from its payment: ${registrationId} (${email})`,
    );
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

  // A second, different payment for a registration that was already paid
  // (e.g. two checkouts completed before the older one could be closed). The
  // money is real, so it's recorded and receipted, but the member is already
  // registered: no second confirmation, and the registration's amount adds up.
  const isAdditionalPayment =
    !donationAlreadyExisted && reg.donationStatus === "COMPLETED";
  if (isAdditionalPayment) {
    console.error(
      `[stripe/webhook] Additional payment for an already-paid registration ${registrationId} (session ${session.id}); recorded and receipted, please review.`,
    );
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
      donationAmount: isAdditionalPayment
        ? { increment: amountCents }
        : donationAlreadyExisted
        ? undefined
        : amountCents,
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
        notes: `Registration dana — ${source ?? "registration_dana"}${splitNote(meta)}`,
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
        notes: `Registration dana — ${source ?? "registration_dana"}${splitNote(meta)}`,
      },
    });
  }

  // Confirmation email — only on the first completion. Now that the registration
  // is REGISTERED + paid, the "you're registered" moment lands here. Gated on the
  // donation pre-check so a redelivered webhook doesn't double-send.
  //
  // The dana receipt is its own email: it's the record a member files, and it
  // separates any registration payment from the gift. The split comes from the
  // checkout's metadata (decided server-side there); for sessions created
  // before that metadata existed, it's recomputed from the program.
  if (!donationAlreadyExisted) {
    let feeCents = Number(meta.feeCents);
    let giftCents = Number(meta.giftCents);
    if (!Number.isFinite(feeCents) || !Number.isFinite(giftCents) || feeCents + giftCents !== amountCents) {
      const program = reg.programId
        ? await db.program.findUnique({
            where: { id: reg.programId },
            select: { danaMode: true, danaFixedAmount: true, danaBaseAmount: true },
          })
        : null;
      const charge = program ? resolveDanaCharge(program, amountCents) : null;
      feeCents = charge?.ok ? Math.min(charge.feeCents, amountCents) : 0;
      giftCents = amountCents - feeCents;
    }
    const receipt = {
      to: reg.email,
      firstName: reg.firstName,
      programTitle: reg.programTitle,
      totalCents: amountCents,
      feeCents,
      giftCents,
      paidAt,
    };
    after(async () => {
      if (!isAdditionalPayment) {
        try {
          await sendRegistrationConfirmation(registrationId);
        } catch (err) {
          console.error("[stripe/webhook] registration confirmation email failed", err);
        }
      }
      try {
        await sendRegistrationDanaReceiptEmail(receipt);
      } catch (err) {
        console.error("[stripe/webhook] registration dana receipt email failed", err);
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

  // Only release the hold if THIS checkout is the registration's current one.
  // A member who abandons a checkout and starts another reuses the same row;
  // when the first checkout later expires it must not delete the hold the
  // second is paying against. (Rows from before checkouts were stamped have a
  // null stripeSessionId and keep the old behavior.)
  const { count } = await db.registration.deleteMany({
    where: {
      id: registrationId,
      status: "PENDING_PAYMENT",
      OR: [{ stripeSessionId: session.id }, { stripeSessionId: null }],
    },
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

/** "(registration $X, dana $Y)" for the ledger, when the checkout recorded a split. */
function splitNote(meta: Stripe.Metadata): string {
  const fee = Number(meta.feeCents);
  const gift = Number(meta.giftCents);
  if (!Number.isFinite(fee) || !Number.isFinite(gift) || fee === 0) return "";
  return ` (registration $${(fee / 100).toFixed(2)}, dana $${(gift / 100).toFixed(2)})`;
}
