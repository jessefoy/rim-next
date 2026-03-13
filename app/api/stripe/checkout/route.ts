import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";

// POST /api/stripe/checkout
// Creates a Stripe Checkout session for a registration dana payment.
// Body: { registrationId, amountCents, programTitle, programSlug, donorName, donorEmail }
// Returns: { url } — redirect to Stripe hosted checkout page.

export async function POST(request: NextRequest) {
  try {
    const {
      registrationId,
      amountCents,
      programTitle,
      programSlug,
      donorName,
      donorEmail,
    } = await request.json();

    if (!registrationId || !amountCents || !programTitle || !programSlug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (typeof amountCents !== "number" || amountCents < 100) {
      return NextResponse.json(
        { error: "Amount must be at least $1.00" },
        { status: 400 }
      );
    }

    // Verify registration exists, belongs to this program, and email matches the donor
    const registration = await db.registration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        email: true,
        programId: true,
        programTitle: true,
        programSlug: true,
        donationStatus: true,
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    if (registration.programSlug !== programSlug) {
      return NextResponse.json({ error: "Program mismatch" }, { status: 400 });
    }

    // Verify the requester owns this registration (lightweight auth for guest flow)
    if (donorEmail && registration.email !== donorEmail.trim().toLowerCase()) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    if (registration.donationStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Donation already completed for this registration" },
        { status: 409 }
      );
    }

    const baseUrl =
      process.env.NEXTAUTH_URL || "https://rim-next.vercel.app";

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Dana — ${programTitle}`,
              description:
                "Dana is the Buddhist practice of generosity. Thank you for your offering.",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: donorEmail || undefined,
      success_url: `${baseUrl}/programs/${programSlug}?dana=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/programs/${programSlug}?dana=cancelled`,
      metadata: {
        // For QuickBooks reconciliation and donation tracking
        registrationId,
        programId: registration.programId,
        programTitle,
        programSlug,
        donorName: donorName || "",
        donorEmail: donorEmail || "",
        source: "registration_dana",
      },
    });

    // Stamp the checkout session ID on the registration
    await db.registration.update({
      where: { id: registrationId },
      data: { stripeSessionId: session.id },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
