import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { resolveDanaCharge } from "@/lib/programUtils";

// POST /api/stripe/checkout
// Creates a Stripe Checkout session for a program registration's dana.
// Body: { registrationId, amountCents, programSlug, donorName, donorEmail }
// Returns: { url } — redirect to Stripe hosted checkout page.
//
// The server decides what is charged. The amount in the body is only a
// request: a fixed-amount program is charged its fixed amount, "base + dana"
// must meet its base, and only voluntary dana (and the extra above a base)
// takes the member's figure. Titles come from the database, not the browser.

// Registrations that can still make an online offering. WAITLISTED rows wait
// for promotion; CANCELLED rows are done.
const PAYABLE_STATUSES = new Set(["PENDING_PAYMENT", "REGISTERED", "APPROVED"]);

export async function POST(request: NextRequest) {
  try {
    const {
      registrationId,
      amountCents,
      programSlug,
      donorName,
      donorEmail,
    } = await request.json();

    if (!registrationId || !programSlug) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const registration = await db.registration.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        email: true,
        userId: true,
        firstName: true,
        lastName: true,
        status: true,
        programId: true,
        programSlug: true,
        donationStatus: true,
        stripeSessionId: true,
        program: {
          select: {
            name: true,
            danaMode: true,
            danaFixedAmount: true,
            danaBaseAmount: true,
          },
        },
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

    // Ownership mirrors the decline endpoint: the signed-in owner, or a guest
    // whose email matches the registration.
    const session = await auth();
    const isOwnerByAccount =
      !!session?.user?.id && registration.userId === session.user.id;
    const isOwnerByEmail =
      typeof donorEmail === "string" &&
      registration.email === donorEmail.trim().toLowerCase();
    if (!isOwnerByAccount && !isOwnerByEmail) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    if (!PAYABLE_STATUSES.has(registration.status)) {
      return NextResponse.json(
        { error: "This registration can't take an offering right now." },
        { status: 409 }
      );
    }

    if (registration.donationStatus === "COMPLETED") {
      return NextResponse.json(
        { error: "Donation already completed for this registration" },
        { status: 409 }
      );
    }

    if (!registration.program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    const charge = resolveDanaCharge(registration.program, Number(amountCents));
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: 400 });
    }

    const programTitle = registration.program.name;
    const baseUrl =
      (process.env.NEXTAUTH_URL || "https://rim-next.vercel.app").trim().replace(/\/$/, "");

    // A registration payment and a gift are different things, legally and to
    // the member, so they're separate lines. Pure dana gets Stripe's "Donate"
    // button; anything that includes a registration payment keeps "Pay".
    const lineItems = [];
    if (charge.feeCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: charge.feeCents,
          product_data: {
            name: `Registration for ${programTitle}`,
            description: "Payment for participation in the program.",
          },
        },
        quantity: 1,
      });
    }
    if (charge.giftCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          unit_amount: charge.giftCents,
          product_data: {
            name: `Dana for ${programTitle}`,
            description:
              "Dana is the Buddhist practice of generosity. Thank you for your offering.",
          },
        },
        quantity: 1,
      });
    }

    // Everything the webhook needs to finish (or, if the held row was lost,
    // restore) the registration and write an accurate receipt. Mirrored onto
    // the PaymentIntent so it's visible on the payment itself in Stripe.
    const metadata = {
      registrationId,
      programId: registration.programId ?? "",
      programTitle,
      programSlug,
      donorName: (typeof donorName === "string" ? donorName : "") ||
        `${registration.firstName} ${registration.lastName}`.trim(),
      donorEmail: registration.email,
      firstName: registration.firstName,
      lastName: registration.lastName,
      danaMode: registration.program.danaMode ?? "none",
      feeCents: String(charge.feeCents),
      giftCents: String(charge.giftCents),
      source: "registration_dana",
    };

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      // Bound the checkout window. For a required-payment registration the
      // PENDING_PAYMENT row holds a seat until this expires; Stripe fires
      // `checkout.session.expired` at this time, which releases the hold.
      // 60 min (Stripe minimum is 30) — generous for deciding, short enough to
      // free a held seat promptly. Harmless for voluntary-give (those rows are
      // already REGISTERED and survive expiry).
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      submit_type: charge.feeCents === 0 ? "donate" : "pay",
      line_items: lineItems,
      customer_email: registration.email,
      success_url: `${baseUrl}/programs/${programSlug}?dana=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/programs/${programSlug}?dana=cancelled`,
      metadata,
      payment_intent_data: {
        description: charge.feeCents > 0
          ? `Registration${charge.giftCents > 0 ? " and dana" : ""} for ${programTitle}`
          : `Dana for ${programTitle}`,
        metadata,
      },
    });

    // Stamp the checkout on the registration. The expiry handler releases a
    // held seat only when the expiring checkout is this one, so an older,
    // abandoned checkout can't delete a hold a newer checkout is using.
    await db.registration.update({
      where: { id: registrationId },
      data: { stripeSessionId: checkout.id },
    });

    // Close the checkout this one replaces, so a member can't pay twice from
    // two open tabs. Done after the stamp above: its "expired" event then finds
    // a different current checkout and releases nothing.
    const previous = registration.stripeSessionId;
    if (previous && previous !== checkout.id) {
      await stripe.checkout.sessions.expire(previous).catch((e) => {
        // Already completed or already expired: nothing to close.
        console.warn("[stripe/checkout] previous checkout not expired", previous, e?.message ?? e);
      });
    }

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[stripe/checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
