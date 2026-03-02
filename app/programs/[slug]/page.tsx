import { sanityClient } from "@/lib/sanity";
import { programBySlugQuery, allProgramSlugsQuery } from "@/lib/queries";
import { PortableText } from "@portabletext/react";
import { auth } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import TeacherList from "@/components/TeacherList";
import MemberGate from "@/components/MemberGate";
import RegistrationForm, { RegistrationField } from "@/components/RegistrationForm";
import { db } from "@/lib/db";

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
  timeText?: string;
  locationText?: string;
  locationLink?: string;
  danaText?: string;
  registrationRequired?: boolean;
  registrationClosed?: boolean;
  filloutRegistrationFormId?: string;
  registrationEnabled?: boolean;
  registrationCapacity?: number | null;
  registrationDeadline?: string | null;
  danaMode?: string | null;
  suggestedDana?: number | null;
  danaBaseAmount?: number | null;
  danaFixedAmount?: number | null;
  danaMessage?: string | null;
  registrationFields?: RegistrationField[];
  zoomLink?: string;
  zoomLinkText?: string;
  quote?: string;
  quoteSource?: string;
  programDescription?: any[];
  specialNotes?: any[];
  signedOutInstructions?: any[];
  signedInInstructions?: any[];
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

  const isLoggedIn = !!session;
  const useBuiltInForm = !!program.registrationEnabled;
  const deadlinePassed = !!(
    program.registrationDeadline && new Date(program.registrationDeadline) < new Date()
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
  const hasDetails = !!(program.dateText || program.timeText || program.locationText || program.danaText);
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
                <span className="pg-details__label">Date</span>
                <span className="pg-details__value">{program.dateText}</span>
              </div>
            )}
            {program.timeText && (
              <div className="pg-details__row">
                <span className="pg-details__label">Time</span>
                <span className="pg-details__value">{program.timeText}</span>
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
            {program.registrationRequired && (
              <div className="pg-details__row pg-details__row--cta">
                <span className="pg-details__label"></span>
                <a href="#registration-section" className="pg-details__reg-cta">
                  ↓ Please Register to Attend
                </a>
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

        {/* Registration section */}
        <div id="registration-section" className="pg-registration">

          {/* ── Built-in registration form (new system) ── */}
          {useBuiltInForm && (
            <div className="pg-registration__inner">
              <p className="lp-label">{spotsRemaining === 0 ? "Join Waitlist" : "Register"}</p>
              {program.signedInInstructions && (
                <div className="lp-body">
                  <PortableText value={program.signedInInstructions as any} />
                </div>
              )}
              <RegistrationForm
                program={program}
                spotsRemaining={spotsRemaining}
                userProfile={userProfile}
                sessionUserId={session?.user?.id ?? null}
                alreadyRegistered={!!existingRegistration}
                existingDonationStatus={existingRegistration?.donationStatus ?? null}
                existingRegistrationId={existingRegistration?.id ?? null}
                deadlinePassed={deadlinePassed}
              />
            </div>
          )}

          {/* ── Legacy path (Fillout / auth-gated) ── */}
          {!useBuiltInForm && (
            <>
              {/* Logged out */}
              {!isLoggedIn && (
                <MemberGate signedOutInstructions={program.signedOutInstructions} />
              )}

              {/* Logged in + registration required + not closed */}
              {isLoggedIn && program.registrationRequired && !program.registrationClosed && (
                <div className="pg-registration__inner">
                  <p className="lp-label">Register</p>
                  {program.signedInInstructions && (
                    <div className="lp-body">
                      <PortableText value={program.signedInInstructions as any} />
                    </div>
                  )}
                  {program.filloutRegistrationFormId && (
                    <div className="pg-fillout">
                      <div
                        style={{ width: "100%", height: "500px" }}
                        data-fillout-id={program.filloutRegistrationFormId}
                        data-fillout-embed-type="standard"
                        data-fillout-inherit-parameters=""
                        data-fillout-dynamic-resize=""
                      />
                      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
                      <script src="https://server.fillout.com/embed/v1/" />
                    </div>
                  )}
                </div>
              )}

              {/* Logged in + no registration required */}
              {isLoggedIn && !program.registrationRequired && (
                <div className="pg-registration__inner">
                  <p className="lp-label">No Registration Required</p>
                  {program.signedInInstructions && (
                    <div className="lp-body">
                      <PortableText value={program.signedInInstructions as any} />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

        </div>

      </div>
    </div>
  );
}
