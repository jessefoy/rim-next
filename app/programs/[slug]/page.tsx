import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildGoogleCalendarUrl, buildIcsUrl, describeRecurrence } from "@/lib/calendarLinks";
import { resolveLocation } from "@/lib/locations";
import { buildDateLabel } from "@/lib/dateLabel";
import { renderContentBodyAsync, renderFormattedTextAsync } from "@/lib/renderRichContentServer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: program ? `${program.name} — Rooted In Mindfulness` : "Program Not Found",
  };
}

export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ dana?: string; session_id?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const [program, session] = await Promise.all([
    db.program.findUnique({
      where: { slug },
      include: { category: true },
    }),
    auth(),
  ]);

  if (!program || program.archivedAt) notFound();

  const useBuiltInForm = !!program.registrationEnabled;
  const registrationClosed = !!(
    program.registrationClosed ||
    (program.registrationDeadline && new Date(program.registrationDeadline) < new Date())
  );

  // DB queries — only when built-in form is active
  const [activeCount, userProfile, existingRegistration] = await Promise.all([
    useBuiltInForm && program.registrationCapacity
      ? db.registration.count({
          where: { programId: program.id, status: { in: ["REGISTERED", "APPROVED"] } },
        })
      : Promise.resolve(0),
    useBuiltInForm && session?.user?.id
      ? db.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true, phone: true, email: true },
        })
      : Promise.resolve(null),
    useBuiltInForm && session?.user?.id
      ? db.registration.findFirst({
          where: {
            programId: program.id,
            userId: session.user.id,
            status: { not: "CANCELLED" },
          },
        })
      : Promise.resolve(null),
  ]);

  const spotsRemaining =
    useBuiltInForm && program.registrationCapacity
      ? Math.max(0, program.registrationCapacity - activeCount)
      : null;
  const showLowSpots = spotsRemaining !== null && spotsRemaining > 0 && spotsRemaining <= 5;

  // Resolve location from venue + programFormat
  const location = resolveLocation(program.venue, program.locationText, program.locationLink);
  const showWhere = program.programFormat !== "virtual" && !!location.text;
  const startIso = program.startDatetime?.toISOString() ?? null;
  const endIso = program.endDatetime?.toISOString() ?? null;
  const dateLabel = program.dateText || buildDateLabel({
    startDatetime: startIso,
    endDatetime: endIso,
    recurrenceFreq: program.recurrenceFreq,
    recurrenceInterval: program.recurrenceInterval,
    recurrenceDays: program.recurrenceDays,
  });
  const hasDetails = !!(dateLabel || showWhere || program.danaText);
  const hasFacilitators = program.teacherFacilitators.length > 0;
  const hasDescription = !!program.description;
  const hasSpecialNotes = !!program.specialNotes;

  const descriptionHtml = hasDescription ? await renderContentBodyAsync(program.description) : "";
  const specialNotesHtml = hasSpecialNotes ? await renderFormattedTextAsync(program.specialNotes) : "";

  return (
    <div className="pg-page">

      {/* ── Hero header ── */}
      <header className="pg-hero">
        <div className="pg-hero__inner">
          {program.category && (
            <Link href="/community-programs" className="pg-hero__category">
              {program.category.name}
            </Link>
          )}
          <h1 className="pg-hero__title">{program.name}</h1>
          {program.tagline && (
            <p className="pg-hero__tagline">{program.tagline}</p>
          )}
        </div>
      </header>

      {/* ── Content column ── */}
      <div className="lp-content">

        {/* Dana result banners — shown after Stripe redirects back */}
        {resolvedSearch?.dana === "success" && (
          <div className="pg-dana-result pg-dana-result--success">
            ✓ Thank you — your dana offering has been received.
          </div>
        )}
        {resolvedSearch?.dana === "cancelled" && (
          <div className="pg-dana-result pg-dana-result--cancelled">
            Your registration is confirmed. You can return anytime to complete your dana offering.
          </div>
        )}

        {/* Details card */}
        {hasDetails && (
          <div className="pg-details">
            {dateLabel && (
              <div className="pg-details__row">
                <span className="pg-details__label">Schedule</span>
                <span className="pg-details__value">{dateLabel}</span>
              </div>
            )}
            {showWhere && (
              <div className="pg-details__row">
                <span className="pg-details__label">Where</span>
                <span className="pg-details__value">
                  {location.text}
                  {location.link && (
                    <a
                      href={location.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pg-details__link"
                    >
                      {" "}↗
                    </a>
                  )}
                </span>
              </div>
            )}
            {program.danaText && (
              <div className="pg-details__row">
                <span className="pg-details__label">Dana</span>
                <span className="pg-details__value">{program.danaText}</span>
              </div>
            )}
            {/* ── Registration CTA ── */}
            {useBuiltInForm && (
              <div className="pg-details__row pg-details__row--cta">
                <span className="pg-details__label"></span>
                <div className="pg-register-cta">
                  {registrationClosed ? (
                    <span className="pg-register-status">Registration is now closed.</span>
                  ) : existingRegistration?.donationStatus === "PENDING" ? (
                    <Link href={`/programs/${slug}/register`} className="pg-register-btn pg-register-btn--secondary">
                      Complete Dana →
                    </Link>
                  ) : existingRegistration?.status === "WAITLISTED" ? (
                    <span className="pg-register-status">You&rsquo;re on the waitlist.</span>
                  ) : existingRegistration ? (
                    <>
                      <span className="pg-register-status">✓ You&rsquo;re registered.</span>
                      {startIso && (() => {
                        const rec = describeRecurrence(
                          program.recurrenceFreq,
                          program.recurrenceInterval,
                          program.recurrenceDays,
                          program.recurrenceCount,
                        );
                        return (
                          <div className="pg-calendar-links">
                            <a
                              href={buildGoogleCalendarUrl({
                                title: program.name,
                                startDatetime: startIso,
                                endDatetime: endIso,
                                location: location.emailText ?? undefined,
                                programSlug: slug,
                                recurrenceFreq: program.recurrenceFreq,
                                recurrenceInterval: program.recurrenceInterval,
                                recurrenceDays: program.recurrenceDays,
                                recurrenceCount: program.recurrenceCount,
                              })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pg-calendar-link"
                            >
                              {rec.googleLabel
                                ? `+ Google Calendar (${rec.googleLabel})`
                                : `+ Google Calendar`}
                            </a>
                            <a
                              href={buildIcsUrl(slug)}
                              className="pg-calendar-link"
                            >
                              {rec.icsLabel
                                ? `+ Apple / Outlook (${rec.icsLabel})`
                                : `+ Apple / Outlook`}
                            </a>
                          </div>
                        );
                      })()}
                    </>
                  ) : spotsRemaining === 0 ? (
                    <>
                      <Link href={`/programs/${slug}/register`} className="pg-register-btn">
                        Join Waitlist →
                      </Link>
                      <p className="pg-capacity pg-capacity--full">
                        This program is fully booked — submitting will add you to the waitlist.
                      </p>
                    </>
                  ) : (
                    <>
                      <Link href={`/programs/${slug}/register`} className="pg-register-btn">
                        Register →
                      </Link>
                      {showLowSpots && (
                        <p className="pg-capacity pg-capacity--low">
                          {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} remaining.
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pull quote */}
        {program.pullQuote && (
          <figure className="lp-pullquote">
            {program.pullQuote}
            {program.pullQuoteSource && (
              <cite className="lp-pullquote__cite">— {program.pullQuoteSource}</cite>
            )}
          </figure>
        )}

        {/* Program description — Tiptap JSON rendered to HTML */}
        {hasDescription && (
          <div className="lp-body" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        )}

        {/* Special notes */}
        {hasSpecialNotes && (
          <div className="pg-notes">
            <div className="lp-body" dangerouslySetInnerHTML={{ __html: specialNotesHtml }} />
          </div>
        )}

        {/* Facilitators — plain text names from Postgres */}
        {hasFacilitators && (
          <>
            <hr className="lp-divider" />
            <p className="lp-label">Facilitators</p>
            <div className="pg-facilitators">
              {program.teacherFacilitators.map((name, i) => (
                <span key={i} className="pg-facilitator">{name}</span>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
