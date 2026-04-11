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
  const startIso = program.startDatetime?.toISOString() ?? null;
  const endIso = program.endDatetime?.toISOString() ?? null;

  // ── Time label (always a separate row) ──
  // Format: "9:30-10:30 AM" or "9:30 AM" (if no end time)
  const timeLabel = (() => {
    if (!program.startDatetime) return null;
    const TZ = "America/Chicago";
    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
        .format(d)
        .replace(/:00/, "");  // "9:00 AM" → "9 AM", "9:30 AM" stays
    const start = fmt(program.startDatetime);
    if (!program.endDatetime) return start;
    const end = fmt(program.endDatetime);
    return `${start}-${end}`;
  })();

  // ── Schedule label (day/recurrence pattern, no time) ──
  const scheduleLabel = (() => {
    // Manual override → use as-is
    if (program.dateText) return program.dateText;
    // Auto-generate from recurrence fields
    const full = buildDateLabel({
      startDatetime: startIso,
      endDatetime: endIso,
      recurrenceFreq: program.recurrenceFreq,
      recurrenceInterval: program.recurrenceInterval,
      recurrenceDays: program.recurrenceDays,
    });
    if (!full) return null;
    // When showing time separately, strip the " · time" portion from auto-generated label
    if (timeLabel && full.includes(" · ")) return full.split(" · ")[0];
    return full;
  })();

  // ── Location label ──
  const locationLabel =
    program.programFormat === "virtual"
      ? `Online (${location.text || "Zoom"}) only`
      : program.programFormat === "hybrid"
        ? `${location.text || "Hybrid"} + Online`
        : location.text;
  const showLocation = !!(locationLabel);

  const hasDetails = !!(scheduleLabel || timeLabel || showLocation || program.danaText);
  const hasFacilitators = program.teacherFacilitators.length > 0;
  const hasDescription = !!program.description;
  const hasSpecialNotes = !!program.specialNotes;

  const descriptionHtml = hasDescription ? await renderContentBodyAsync(program.description) : "";
  const specialNotesHtml = hasSpecialNotes ? await renderFormattedTextAsync(program.specialNotes) : "";

  return (
    <div className="pg-page">

      {/* ── Hero header ── */}
      <header
        className="pg-hero"
        style={{ backgroundImage: `url(${program.programImage || "/images/Bodhi-Leaves.jpg"})` }}
      >
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

        {/* ── Pull quote card — floats up into hero ── */}
        {program.pullQuote && (
          <figure className="pg-quote">
            <blockquote className="pg-quote__text">{program.pullQuote}</blockquote>
            {program.pullQuoteSource && (
              <figcaption className="pg-quote__source">~ {program.pullQuoteSource}</figcaption>
            )}
          </figure>
        )}

        {/* ── Program description ── */}
        {hasDescription && (
          <div className="prog-description" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
        )}

        {/* ── Special notes callout ── */}
        {hasSpecialNotes && (
          <div className="pg-notes">
            <div className="prog-description" dangerouslySetInnerHTML={{ __html: specialNotesHtml }} />
          </div>
        )}

        {/* ── Details section ── */}
        {hasDetails && (
          <section className="pg-details-section">
            <h2 className="pg-section-heading">Details:</h2>
            {scheduleLabel && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </span>
                <span className="pg-detail-row__text">{scheduleLabel}</span>
              </div>
            )}
            {timeLabel && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </span>
                <span className="pg-detail-row__text">{timeLabel}</span>
              </div>
            )}
            {showLocation && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                <span className="pg-detail-row__text">
                  {locationLabel}
                  {location.link && (
                    <a href={location.link} target="_blank" rel="noopener noreferrer" className="pg-detail-row__link"> ↗</a>
                  )}
                </span>
              </div>
            )}
            {program.danaText && (
              <div className="pg-detail-row">
                <span className="pg-detail-row__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </span>
                <span className="pg-detail-row__text">{program.danaText}</span>
              </div>
            )}
          </section>
        )}

        {/* ── Facilitators section ── */}
        {hasFacilitators && (
          <section className="pg-facilitators-section">
            <h2 className="pg-section-heading">Facilitators:</h2>
            <div className="pg-facilitators">
              {program.teacherFacilitators.map((name, i) => (
                <span key={i} className="pg-facilitator">{name}</span>
              ))}
            </div>
          </section>
        )}

        {/* ── Registration CTA card ── */}
        {useBuiltInForm && (
          <div className="pg-cta-card">
            {registrationClosed ? (
              <>
                <h3 className="pg-cta-card__heading">Registration Closed</h3>
                <p className="pg-cta-card__text">Registration for this program is now closed.</p>
              </>
            ) : existingRegistration?.donationStatus === "PENDING" ? (
              <>
                <h3 className="pg-cta-card__heading">Complete Your Dana</h3>
                <p className="pg-cta-card__text">Your registration is confirmed. You can complete your dana offering below.</p>
                <Link href={`/programs/${slug}/register`} className="pg-cta-card__btn">
                  Complete Dana →
                </Link>
              </>
            ) : existingRegistration?.status === "WAITLISTED" ? (
              <>
                <h3 className="pg-cta-card__heading">On the Waitlist</h3>
                <p className="pg-cta-card__text">You&rsquo;re on the waitlist. We&rsquo;ll reach out if a spot opens up.</p>
              </>
            ) : existingRegistration ? (
              <>
                <h3 className="pg-cta-card__heading">You&rsquo;re Registered</h3>
                <p className="pg-cta-card__text">You&rsquo;re all set for this program.</p>
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
                <h3 className="pg-cta-card__heading">Program Full</h3>
                <p className="pg-cta-card__text">This program is fully booked — submitting will add you to the waitlist.</p>
                <Link href={`/programs/${slug}/register`} className="pg-cta-card__btn">
                  Join Waitlist →
                </Link>
              </>
            ) : (
              <>
                <h3 className="pg-cta-card__heading">Register</h3>
                <Link href={`/programs/${slug}/register`} className="pg-cta-card__btn">
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
        )}

        {/* ── No registration — open program CTA ── */}
        {!useBuiltInForm && (
          <div className="pg-cta-card">
            <h3 className="pg-cta-card__heading">No Registration Required</h3>
            <p className="pg-cta-card__text">
              As a RIM community member, you have access to this offering.
              A zoom link is accessible in your <Link href="/account/dashboard" className="pg-cta-card__link">dashboard</Link>.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
