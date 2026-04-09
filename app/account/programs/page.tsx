import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import CancelRegistrationButton from "@/components/CancelRegistrationButton";
import AccountLayout from "@/components/AccountLayout";
import { buildDateLabel } from "@/lib/dateLabel";

export const metadata = { title: "My Programs — Rooted In Mindfulness" };
export const dynamic = "force-dynamic";

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

export default async function MyProgramsPage() {
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

  // Look up program metadata from Postgres
  let programMap: Record<string, {
    dateText: string | null;
    startDatetime: Date | null;
    endDatetime: Date | null;
    recurrenceFreq: string | null;
    recurrenceInterval: number | null;
    recurrenceDays: string[];
    locationText: string | null;
  }> = {};

  if (registrations.length > 0) {
    const slugs = [...new Set(registrations.map((r) => r.programSlug).filter(Boolean))];
    const pgPrograms = await db.program.findMany({
      where: { slug: { in: slugs } },
      select: {
        slug: true,
        dateText: true,
        startDatetime: true,
        endDatetime: true,
        recurrenceFreq: true,
        recurrenceInterval: true,
        recurrenceDays: true,
        locationText: true,
      },
    });
    programMap = Object.fromEntries(pgPrograms.map((p) => [p.slug, p]));
  }

  const enriched = registrations.map((r) => ({
    ...r,
    pgProgram: r.programSlug ? programMap[r.programSlug] ?? null : null,
  }));

  const active = enriched.filter((r) => ACTIVE_STATUSES.includes(r.status));
  const past = enriched.filter((r) => r.status === "CANCELLED");

  return (
    <AccountLayout>
      <div className="mr-page">
          <h1 className="mr-heading">My Programs</h1>

          {registrations.length === 0 ? (
            <p className="mr-empty">
              You haven&apos;t registered for any programs yet.{" "}
              <Link href="/community-programs">Explore community programs →</Link>
            </p>
          ) : (
            <>
              {active.length > 0 && (
                <section className="mr-section">
                  <p className="mr-section__label">Active Registrations</p>
                  <div className="mr-cards">
                    {active.map((r) => {
                      const pgProg = r.pgProgram;
                      const dateStr = pgProg?.dateText || buildDateLabel({
                        startDatetime: pgProg?.startDatetime?.toISOString() ?? null,
                        endDatetime: pgProg?.endDatetime?.toISOString() ?? null,
                        recurrenceFreq: pgProg?.recurrenceFreq ?? null,
                        recurrenceInterval: pgProg?.recurrenceInterval ?? null,
                        recurrenceDays: pgProg?.recurrenceDays ?? null,
                      });
                      return (
                        <div key={r.id} className="mr-card">
                          <div className="mr-card__header">
                            <Link href={`/programs/${r.programSlug}`} className="mr-card__title">
                              {r.programTitle}
                            </Link>
                            <StatusBadge status={r.status} />
                          </div>

                          {dateStr && (
                            <p className="mr-card__meta">{dateStr}</p>
                          )}
                          {pgProg?.locationText && (
                            <p className="mr-card__meta">{pgProg.locationText}</p>
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
                      );
                    })}
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
            </>
          )}
      </div>
    </AccountLayout>
  );
}
