import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sanityClient } from "@/lib/sanity";
import { programsBySlugArrayQuery } from "@/lib/queries";
import { redirect } from "next/navigation";
import Link from "next/link";
import CancelRegistrationButton from "@/components/CancelRegistrationButton";

export const metadata = { title: "My Programs — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

interface SanityProgram {
  slug: string;
  name: string;
  dateText?: string;
  locationText?: string;
  zoomLink?: string;
}

const ACTIVE_STATUSES = ["REGISTERED", "APPROVED", "WAITLISTED"];

const STATUS_LABELS: Record<string, string> = {
  REGISTERED: "Registered",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  CANCELLED: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    REGISTERED: "mr-badge mr-badge--green",
    APPROVED: "mr-badge mr-badge--blue",
    WAITLISTED: "mr-badge mr-badge--amber",
    CANCELLED: "mr-badge mr-badge--gray",
  };
  return (
    <span className={classMap[status] ?? "mr-badge mr-badge--gray"}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default async function MyRegistrationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const registrations = await db.registration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      programSlug: true,
      programTitle: true,
      status: true,
      donationStatus: true,
      waitlistPosition: true,
      createdAt: true,
    },
  });

  let sanityMap: Record<string, SanityProgram> = {};
  if (registrations.length > 0) {
    const slugs = [...new Set(registrations.map((r) => r.programSlug).filter(Boolean))];
    const sanityPrograms = await sanityClient.fetch<SanityProgram[]>(
      programsBySlugArrayQuery,
      { slugs }
    );
    sanityMap = Object.fromEntries(sanityPrograms.map((p) => [p.slug, p]));
  }

  const enriched = registrations.map((r) => ({
    ...r,
    sanity: r.programSlug ? sanityMap[r.programSlug] : null,
  }));

  const active = enriched.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const past = enriched.filter((r) => r.status === "CANCELLED");

  if (registrations.length === 0) {
    return (
      <div className="page-wrapper">
        <div className="lp-content mr-page">
          <h1 className="mr-heading">My Programs</h1>
          <p className="mr-empty">
            You haven&apos;t registered for any programs yet.{" "}
            <Link href="/community-programs">Explore community programs →</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="lp-content mr-page">
        <h1 className="mr-heading">My Programs</h1>

        {active.length > 0 && (
          <section className="mr-section">
            <p className="mr-section__label">Active Registrations</p>
            <div className="mr-cards">
              {active.map((r) => (
                <div key={r.id} className="mr-card">
                  <div className="mr-card__header">
                    <Link href={`/programs/${r.programSlug}`} className="mr-card__title">
                      {r.programTitle}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>

                  {r.sanity?.dateText && (
                    <p className="mr-card__meta">{r.sanity.dateText}</p>
                  )}
                  {r.sanity?.locationText && (
                    <p className="mr-card__meta">{r.sanity.locationText}</p>
                  )}

                  {r.status === "WAITLISTED" && r.waitlistPosition != null && (
                    <p className="mr-card__waitlist">Position #{r.waitlistPosition} on waitlist</p>
                  )}

                  {r.donationStatus === "PENDING" && (
                    <div className="mr-card__dana">
                      <span>A spot opened up — please complete your dana offering.</span>
                      <Link href={`/programs/${r.programSlug}/register`} className="mr-card__dana-link">
                        Complete dana offering →
                      </Link>
                    </div>
                  )}

                  <p className="mr-card__date">
                    Registered {new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>

                  <div className="mr-card__actions">
                    <CancelRegistrationButton id={r.id} programTitle={r.programTitle} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className="mr-section">
            <p className="mr-section__label">Past / Cancelled</p>
            <div className="mr-cards">
              {past.map((r) => (
                <div key={r.id} className="mr-card mr-card--muted">
                  <div className="mr-card__header">
                    <Link href={`/programs/${r.programSlug}`} className="mr-card__title">
                      {r.programTitle}
                    </Link>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mr-card__date">
                    Registered {new Date(r.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mr-footer-note">
          Need help with a registration?{" "}
          <a href="mailto:hello@rootedinmindfulness.org">Contact us</a>.
        </p>
      </div>
    </div>
  );
}
