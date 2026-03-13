import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";

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
    await handleCheckoutCompleted(session);
  }

  // Other events can be handled here in the future (e.g. payment_intent.payment_failed)

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
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

  // Update registration donation status
  await db.registration.update({
    where: { id: registrationId },
    data: {
      donationStatus: "COMPLETED",
      donationAmount: amountCents,
      stripeSessionId: session.id,
    },
  });

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
