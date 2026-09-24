import Link from "next/link";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import stripe from "@/lib/stripe";
import { buildSubtitle } from "@/lib/programUtils";
import { resolveLocation } from "@/lib/locations";
import { buildGoogleCalendarUrl, buildIcsUrl } from "@/lib/calendarLinks";

/**
 * /programs/[slug]/thank-you — where Stripe returns a member after a
 * registration payment or dana gift.
 *
 * Everything shown comes from the server: the Checkout Session is retrieved
 * from Stripe by its id and must belong to this program, so the amount, the
 * program, and the email can't be changed by editing the address. The page can
 * load before the webhook has finished the registration (usually a few
 * seconds), so it trusts Stripe's payment status for "you're registered".
 *
 * One dominant next step: My Home for programs that meet online (that's where
 * the Join button lives), the calendar for in-person ones.
 *
 * Copy is provisional pending Jesse's read-aloud.
 */

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Thank You — Rooted In Mindfulness",
  // The URL carries a Checkout Session id.
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
};

const usd = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;

  const [program, viewer] = await Promise.all([
    db.program.findUnique({
      where: { slug },
      select: {
        name: true,
        slug: true,
        programFormat: true,
        venue: true,
        locationText: true,
        locationLink: true,
        dateText: true,
        timeText: true,
        startDatetime: true,
        endDatetime: true,
        recurrenceFreq: true,
        recurrenceInterval: true,
        recurrenceDays: true,
      },
    }),
    auth(),
  ]);

  // Confirm the payment with Stripe. Anything that doesn't check out (no id,
  // a session for another program, Stripe unreachable) falls back to a plain
  // thank-you that claims nothing specific.
  let checkout: {
    paid: boolean;
    totalCents: number;
    feeCents: number;
    giftCents: number;
    email: string | null;
  } | null = null;
  if (program && sessionId && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    try {
      const s = await stripe.checkout.sessions.retrieve(sessionId);
      if (s.metadata?.programSlug === slug && s.metadata?.source === "registration_dana") {
        const total = s.amount_total ?? 0;
        const fee = Number(s.metadata.feeCents);
        const gift = Number(s.metadata.giftCents);
        const splitKnown = Number.isFinite(fee) && Number.isFinite(gift) && fee + gift === total;
        checkout = {
          paid: s.payment_status === "paid" || s.payment_status === "no_payment_required",
          totalCents: total,
          feeCents: splitKnown ? fee : 0,
          giftCents: splitKnown ? gift : total,
          email: s.metadata.donorEmail || s.customer_details?.email || s.customer_email || null,
        };
      }
    } catch (err) {
      console.error("[thank-you] could not confirm checkout session", sessionId, err);
    }
  }

  if (!program || !checkout) {
    return (
      <Shell eyebrow="Thank you" title="Thank you">
        <p className="pp-card__body">
          If you just registered, your confirmation will arrive by email in a few
          minutes. If it doesn&rsquo;t, write to{" "}
          <a href="mailto:support@rootedinmindfulness.org" className="ty-inline-link">
            support@rootedinmindfulness.org
          </a>{" "}
          and we&rsquo;ll check for you.
        </p>
        <div className="pp-actions">
          <Link href={program ? `/programs/${program.slug}` : "/community-programs"} className="pp-btn">
            {program ? "Back to the program page" : "See programs and events"}
          </Link>
        </div>
      </Shell>
    );
  }

  const online = program.programFormat === "virtual" || program.programFormat === "hybrid";
  const inPerson = program.programFormat === "in-person" || program.programFormat === "hybrid";
  const loc = resolveLocation(program.venue, program.locationText, program.locationLink);
  const when = buildSubtitle(program)?.split(" | ")[0] ?? null;
  const where = [
    inPerson ? loc.text : null,
    online ? "Online on Zoom" : null,
  ].filter(Boolean).join(" and ");

  const googleUrl = program.startDatetime
    ? buildGoogleCalendarUrl({
        title: program.name,
        startDatetime: program.startDatetime.toISOString(),
        endDatetime: program.endDatetime?.toISOString() ?? null,
        location: loc.emailText ?? null,
        programSlug: program.slug,
      })
    : null;
  const icsUrl = program.startDatetime ? buildIcsUrl(program.slug) : null;

  const thanks =
    checkout.giftCents > 0
      ? `Thank you for your dana of ${usd(checkout.giftCents)}.${
          checkout.feeCents > 0
            ? ` Your payment of ${usd(checkout.totalCents)} also included ${usd(checkout.feeCents)} for registration.`
            : ""
        }`
      : `Your payment of ${usd(checkout.totalCents)} has been received.`;

  if (!checkout.paid) {
    return (
      <Shell eyebrow="Almost done" title="We're confirming your payment">
        <p className="pp-card__body">
          Stripe is still confirming it. Your confirmation will arrive by email in a
          few minutes{checkout.email ? <>, at <strong className="ty-email">{checkout.email}</strong></> : null}.
        </p>
        <div className="pp-actions">
          <Link href={`/programs/${program.slug}`} className="pp-btn">Back to the program page</Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell eyebrow="Registered" title={`You're registered for ${program.name}`} lead={thanks}>
      {(when || where) && (
        <dl className="ty-facts">
          {when && (
            <>
              <dt>When</dt>
              <dd>{when}</dd>
            </>
          )}
          {where && (
            <>
              <dt>Where</dt>
              <dd>
                {where}
                {inPerson && loc.link && (
                  <>
                    {" "}
                    <a href={loc.link} target="_blank" rel="noopener noreferrer" className="ty-inline-link">
                      Directions
                    </a>
                  </>
                )}
              </dd>
            </>
          )}
        </dl>
      )}

      <p className="pp-card__body">
        Two emails are on their way to{" "}
        {checkout.email ? <strong className="ty-email">{checkout.email}</strong> : "you"}: your
        confirmation, and a receipt to keep for your records.
      </p>
      {online && (
        <p className="pp-card__body">
          On the day, the Join button appears on My Home a few minutes before the
          session begins.{!viewer?.user ? " You'll sign in with your email." : ""}
        </p>
      )}

      <div className="pp-actions">
        {online ? (
          <Link href="/account/dashboard" className="pp-btn">Go to My Home</Link>
        ) : googleUrl ? (
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="pp-btn">
            Add to Google Calendar
          </a>
        ) : null}
        {online && googleUrl && (
          <a href={googleUrl} target="_blank" rel="noopener noreferrer" className="pp-link">
            Add to Google Calendar
          </a>
        )}
        {icsUrl && (
          <a href={icsUrl} className="pp-link">Apple or Outlook calendar</a>
        )}
        <Link href={`/programs/${program.slug}`} className="pp-link">Back to the program page</Link>
      </div>
    </Shell>
  );
}

/** The page frame: the flat hero used by the sign-in pages, then one card. */
function Shell({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pp-page">
      <section className="pp-hero pp-hero--flat pp-hero--short">
        <div className="rim-container pp-hero__inner">
          <p className="pp-hero__eyebrow">{eyebrow}</p>
          <h1 className="pp-hero__title">{title}</h1>
          {lead && <p className="pp-hero__body">{lead}</p>}
        </div>
      </section>
      <section className="pp-section pp-section--last">
        <div className="rim-container">
          <div className="pp-card ty-card">{children}</div>
        </div>
      </section>
    </div>
  );
}
