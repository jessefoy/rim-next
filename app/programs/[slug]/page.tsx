import { sanityClient } from "@/lib/sanity";
import { programBySlugQuery, allProgramSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeacherList from "@/components/TeacherList";
import { db } from "@/lib/db";
import { buildGoogleCalendarUrl, buildIcsUrl, describeRecurrence } from "@/lib/calendarLinks";

export const revalidate = 60;

interface Teacher {
  name: string;
  slug: { current: string };
  title?: string;
  bioPicture?: { asset: { url: string } };
}

interface Program {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  dateText?: string;
  startDatetime?: string | null;
  endDatetime?: string | null;
  recurrenceFreq?: string | null;
  recurrenceInterval?: number | null;
  recurrenceDays?: string[] | null;
  recurrenceCount?: number | null;
  locationText?: string;
  locationLink?: string;
  danaText?: string;
  registrationClosed?: boolean;
  registrationEnabled?: boolean;
  registrationCapacity?: number | null;
  registrationDeadline?: string | null;
  danaMode?: string | null;
  suggestedDana?: number | null;
  danaBaseAmount?: number | null;
  danaFixedAmount?: number | null;
  danaMessage?: string | null;
  registrationFields?: any[];
  zoomLink?: string;
  quote?: string;
  quoteSource?: string;
  programDescription?: any[];
  specialNotes?: any[];
  programCategory?: { name: string; slug: { current: string } };
  teacherFacilitators?: Teacher[];
  dayOfWeek?: { name: string; slug: { current: string } }[];
  largeProgramImage?: { asset: { url: string } };
}

/* Shared PortableText component map — same custom blocks as lesson page */
const portableTextComponents = {
  types: {
    practiceCallout: ({ value }: any) => (
      <div className="lp-callout">
        <p className="lp-callout__title">{value.title || "Practice Suggestion"}</p>
        {value.content && (
          <div className="lp-callout__content">
            <PortableText value={value.content} />
          </div>
        )}
      </div>
    ),
    bodyQuote: ({ value }: any) => (
      /* <div> not <blockquote> — avoids Webflow's blockquote element styles */
      <div className="lp-body-quote">
        <p className="lp-body-quote__text">{value.quote}</p>
        {value.attribution && (
          <cite className="lp-body-quote__cite">— {value.attribution}</cite>
        )}
      </div>
    ),
    verseQuote: ({ value }: any) => (
      /* <div> not <blockquote> — avoids Webflow's blockquote element styles */
      <div className="lp-verse-quote">
        <p className="lp-verse-quote__text">{value.quote}</p>
        {value.attribution && (
          <cite className="lp-verse-quote__cite">— {value.attribution}</cite>
        )}
      </div>
    ),
    calloutText: ({ value }: any) => (
      <p className="lp-callout-text">{value.text}</p>
    ),
  },
};

export async function generateStaticParams() {
  const slugs = await sanityClient.fetch<{ slug: string }[]>(allProgramSlugsQuery);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await sanityClient.fetch<Program | null>(programBySlugQuery, { slug });
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
    sanityClient.fetch<Program | null>(programBySlugQuery, { slug }),
    auth(),
  ]);

  if (!program) notFound();

  const useBuiltInForm = !!program.registrationEnabled;
  const registrationClosed = !!(
    program.registrationClosed ||
    (program.registrationDeadline && new Date(program.registrationDeadline) < new Date())
  );

  // DB queries — only when built-in form is active
  const [activeCount, userProfile, existingRegistration] = await Promise.all([
    useBuiltInForm && program.registrationCapacity
      ? db.registration.count({
          where: { programId: program._id, status: { in: ["REGISTERED", "APPROVED"] } },
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
            programId: program._id,
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
  const isFull = spotsRemaining !== null && spotsRemaining === 0;
  const showLowSpots = spotsRemaining !== null && spotsRemaining > 0 && spotsRemaining <= 5;
  const hasDetails = !!(program.dateText || program.locationText || program.danaText);
  const hasFacilitators = !!(program.teacherFacilitators && program.teacherFacilitators.length > 0);
  const hasDescription = !!(program.programDescription && program.programDescription.length > 0);
  const hasSpecialNotes = !!(program.specialNotes && program.specialNotes.length > 0);

  return (
    <div className="pg-page">

      {/* ── Hero header — placeholder for future design refinement ──
          Currently: solid --rim-blue band with category, title, tagline.
          TODO: Explore a more distinctive treatment (texture, image, etc.)
          once the rest of the design system is settled. */}
      <header className="pg-hero">
        <div className="pg-hero__inner">
          {program.programCategory && (
            <Link href="/community-programs" className="pg-hero__category">
              {program.programCategory.name}
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

        {/* Details card — floats up into the hero header (~1/3 overlap).
            Date / time / location / dana / registration CTA.
            Placed first so visitors can quickly assess attendance
            feasibility before reading the full description. */}
        {hasDetails && (
          <div className="pg-details">
            {program.dateText && (
              <div className="pg-details__row">
                <span className="pg-details__label">Schedule</span>
                <span className="pg-details__value">{program.dateText}</span>
              </div>
            )}
            {program.locationText && (
              <div className="pg-details__row">
                <span className="pg-details__label">Where</span>
                <span className="pg-details__value">
                  {program.locationText}
                  {program.locationLink && (
                    <a
                      href={program.locationLink}
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
            {/* ── Registration CTA — built-in form → links to /register page ── */}
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
                      {program.startDatetime && (() => {
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
                                startDatetime: program.startDatetime!,
                                endDatetime: program.endDatetime,
                                location: program.locationText,
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

        {/* Pull quote — editorial style, no box. Sits below the details card. */}
        {program.quote && (
          <figure className="lp-pullquote">
            {program.quote}
            {program.quoteSource && (
              <cite className="lp-pullquote__cite">— {program.quoteSource}</cite>
            )}
          </figure>
        )}

        {/* Program description — PortableText with full custom block support */}
        {hasDescription && (
          <div className="lp-body">
            <PortableText
              value={program.programDescription as any}
              components={portableTextComponents}
            />
          </div>
        )}

        {/* Special notes — additional context (location details, schedule, etc.) */}
        {hasSpecialNotes && (
          <div className="pg-notes">
            <div className="lp-body">
              <PortableText value={program.specialNotes as any} />
            </div>
          </div>
        )}

        {/* Facilitators */}
        {hasFacilitators && (
          <>
            <hr className="lp-divider" />
            <p className="lp-label">Facilitators</p>
            <TeacherList
              teachers={program.teacherFacilitators!}
              variant="program"
            />
          </>
        )}

      </div>
    </div>
  );
}
