import { NextRequest, NextResponse } from "next/server";
import stripe from "@/lib/stripe";
import { db } from "@/lib/db";
import { auth } from "@/auth";

/**
 * POST /api/courses/[slug]/checkout — Course dana self-enroll
 *
 * Creates a Stripe Checkout session for a course that has
 * `selfEnrollDanaRequired = true`. The webhook (`/api/stripe/webhook`)
 * creates the SeriesEnrollment + Donation row on payment success.
 *
 * Body: { amountCents }
 * Returns: { url } — redirect target for Stripe-hosted checkout.
 *
 * Auth required — courses don't have a guest dana flow. The signed-in
 * user's identity becomes the enrolled member when Stripe completes.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const { slug } = await params;
    const { amountCents } = await request.json();

    if (typeof amountCents !== "number" || amountCents < 100) {
      return NextResponse.json(
        { error: "Amount must be at least $1.00" },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const userRoles = session.user.roles ?? [];
    const isAdmin = userRoles.includes("ADMIN");

    const course = await db.course.findUnique({
      where: { slug, isActive: true },
      select: {
        id: true,
        title: true,
        slug: true,
        allowSelfEnroll: true,
        selfEnrollDanaRequired: true,
        requiredRoles: true,
      },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (!course.allowSelfEnroll || !course.selfEnrollDanaRequired) {
      return NextResponse.json(
        { error: "This course doesn't use the dana self-enroll path." },
        { status: 400 }
      );
    }

    if (course.requiredRoles.length > 0 && !isAdmin) {
      const hasRole = course.requiredRoles.some((r) => userRoles.includes(r));
      if (!hasRole) {
        return NextResponse.json(
          { error: "This course is offered to specific community members." },
          { status: 403 }
        );
      }
    }

    // Already enrolled? Friendly response rather than charging twice.
    const existing = await db.seriesEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You're already enrolled in this course." },
        { status: 409 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, preferredName: true, email: true },
    });
    if (!user?.email) {
      return NextResponse.json({ error: "Account missing email" }, { status: 400 });
    }
    const donorName = [user.preferredName || user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    const baseUrl =
      (process.env.NEXTAUTH_URL || "https://rim-next.vercel.app").trim().replace(/\/$/, "");

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Dana — ${course.title}`,
              description:
                "Dana is the Buddhist practice of generosity. Thank you for your offering.",
            },
          },
          quantity: 1,
        },
      ],
      customer_email: user.email,
      success_url: `${baseUrl}/course/${course.slug}?dana=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/course/${course.slug}?dana=cancelled`,
      metadata: {
        // The webhook keys on `source` to route between program-dana
        // and course-dana handlers.
        source: "course_dana",
        courseId: course.id,
        courseSlug: course.slug,
        courseTitle: course.title,
        userId,
        donorName,
        donorEmail: user.email,
      },
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("[courses/checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
