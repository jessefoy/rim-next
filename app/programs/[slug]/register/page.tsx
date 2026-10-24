import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import Link from "next/link";
import RegistrationForm, { RegistrationField } from "@/components/RegistrationForm";
import { db } from "@/lib/db";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { buildSubtitle } from "@/lib/programUtils";
import { registrationResumeKeyValid } from "@/lib/registrationLink";
import { fmtOpensAt, registrationWindow } from "@/lib/registrationWindow";

// Always show fresh data — this page is user-specific
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.program.findUnique({ where: { slug }, select: { name: true, archivedAt: true } });
  return {
    title: p && !p.archivedAt ? `Register - ${p.name} - Rooted In Mindfulness` : "Register",
  };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string; t?: string }>;
}) {
  const { slug } = await params;
  const { r, t } = await searchParams;
  // Only a link RIM signed (the approval and dana-reminder emails) resumes a
  // registration for someone signed out (lib/registrationLink.ts).
  const resumeId = r && registrationResumeKeyValid(r, t) ? r : undefined;

  const [pgProgram, session] = await Promise.all([
    db.program.findUnique({ where: { slug } }),
    auth(),
  ]);

  // Guard: unknown or archived program
  if (!pgProgram || pgProgram.archivedAt) redirect("/programs");

  // Guard: registration not enabled on this program — send to program page
  if (!pgProgram.registrationEnabled) redirect(`/programs/${slug}`);

  // Adapt Postgres shape to the RegistrationForm's expected `program` prop
  const program = {
    _id: pgProgram.id,
    slug: { current: pgProgram.slug },
    name: pgProgram.name,
    registrationCapacity: pgProgram.registrationCapacity,
    registrationDeadline: pgProgram.registrationDeadline?.toISOString() ?? null,
    danaMode: pgProgram.danaMode,
    suggestedDana: pgProgram.suggestedDana,
    danaBaseAmount: pgProgram.danaBaseAmount,
    danaFixedAmount: pgProgram.danaFixedAmount,
    danaMessageHtml: pgProgram.danaMessage
      ? await renderFormattedTextAsync(pgProgram.danaMessage).catch(() => "")
      : null,
    registrationFields: (pgProgram.registrationFields as RegistrationField[] | null) ?? undefined,
    dateText: pgProgram.dateText,
    locationText: pgProgram.locationText,
  };

  // Fetch user-specific data in parallel
  const [activeCount, userProfile, existingRegistration] = await Promise.all([
    program.registrationCapacity
      ? // The shared count: a place held during checkout is taken, so the
        // spots shown match the places actually held.
        countPlacesTaken(program._id)
      : Promise.resolve(0),
    session?.user?.id
      ? db.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true, phone: true, email: true },
        })
      : resumeId
      ? // A guest finishing a registration from its email: the form needs
        // their details for the dana step (checkout matches the email).
        db.registration.findFirst({
          where: { id: resumeId, programId: program._id, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
          select: { firstName: true, lastName: true, email: true },
        })
      : Promise.resolve(null),
    session?.user?.id || resumeId
      ? db.registration.findFirst({
          where: {
            programId: program._id,
            // The signed-in member's own, or, for a guest arriving from the
            // waitlist-approval or dana-reminder email, the registration that
            // email named (lib/email.ts registrationResumeUrl; 2026-10-19
            // audit: a guest otherwise got a fresh form that answered
            // "already registered").
            ...(session?.user?.id ? { userId: session.user.id } : { id: resumeId }),
            // Exclude a held (PENDING_PAYMENT) row: a registrant mid-checkout
            // resubmits to resume (the POST reuses their held row) rather than
            // being shown the "already registered" / pending-dana resume state.
            status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] },
          },
        })
      : Promise.resolve(null),
  ]);

  const spotsRemaining = program.registrationCapacity
    ? Math.max(0, program.registrationCapacity - activeCount)
    : null;

  const alreadyRegistered = !!existingRegistration;
  const hasPendingDana =
    alreadyRegistered && existingRegistration?.donationStatus === "PENDING";

  // Closed by the coordinator or past its deadline: the same rule the
  // registration API refuses with (2026-10-19 audit; the page used to check
  // only the deadline). A registrant finishing their dana is not turned away,
  // since that step goes to checkout, not to a new registration.
  // One rule (lib/registrationWindow.ts) for closed and not open yet.
  const regWindow = registrationWindow(pgProgram);
  const deadlinePassed = !hasPendingDana && regWindow === "closed";
  const notOpenYet = !hasPendingDana && regWindow === "notYet";

  // If already registered (and not here to complete dana), show a friendly message
  // rather than redirect — they may have bookmarked the page or arrived from an old link
  const showAlreadyRegistered = alreadyRegistered && !hasPendingDana;

  const headerTitle = hasPendingDana
    ? "Complete Your Dana"
    : deadlinePassed
    ? "Register"
    : spotsRemaining === 0
    ? "Join the Waitlist"
    : "Register";
  const scheduleLabel = buildSubtitle(pgProgram);

  return (
    <div className="rg-page">

      {/* ── Header ── */}
      <header
        className="rg-header"
        style={{ backgroundImage: `url(${pgProgram.programImage || "/images/Bodhi-Leaves.jpg"})` }}
      >
        <div className="rg-header__inner">
          <Link href={`/programs/${slug}`} className="rg-header__back">
            <span aria-hidden="true">←</span> Back to program
          </Link>
          <p className="rg-header__eyebrow">{headerTitle}</p>
          <h1 className="rg-header__title">{program.name}</h1>
          {scheduleLabel && <p className="rg-header__meta">{scheduleLabel}</p>}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="rg-content">
        <section className="rg-card">
          {showAlreadyRegistered && existingRegistration?.status === "WAITLISTED" ? (
            // A waitlisted registration isn't a confirmed place (2026-10-19
            // review); the words are the form's own waitlist answer.
            <div className="rg-already">
              <h2>You&rsquo;re on the waitlist</h2>
              <p>This program is currently full. We&rsquo;ll reach out if a spot opens up.</p>
              <Link href={`/programs/${slug}`} className="pp-btn pp-btn--ghost">Return to the program <span aria-hidden="true">→</span></Link>
            </div>
          ) : showAlreadyRegistered ? (
            <div className="rg-already">
              <h2>You&rsquo;re already registered.</h2>
              <p>Your place in this program is confirmed.</p>
              <Link href={`/programs/${slug}`} className="pp-btn pp-btn--ghost">Return to the program <span aria-hidden="true">→</span></Link>
            </div>
          ) : notOpenYet && pgProgram.registrationOpensAt ? (
            <div className="rg-already">
              <h2>Registration opens on {fmtOpensAt(pgProgram.registrationOpensAt)}</h2>
              <p>Come back then to sign up. Times are Central.</p>
              <Link href={`/programs/${slug}`} className="pp-btn pp-btn--ghost">Return to the program <span aria-hidden="true">→</span></Link>
            </div>
          ) : (
            <>
              {!hasPendingDana && !deadlinePassed && (
                <div className="rg-card__intro">
                  <h2>{spotsRemaining === 0 ? "Add your name" : "Your information"}</h2>
                  <p>
                    {spotsRemaining === 0
                      ? "Tell us how to reach you. We’ll be in touch if a place becomes available."
                      : "Tell us how to reach you. We’ll send the program details and confirmation by email."}
                  </p>
                </div>
              )}
              <RegistrationForm
                program={program}
                spotsRemaining={spotsRemaining}
                userProfile={userProfile}
                sessionUserId={session?.user?.id ?? null}
                alreadyRegistered={alreadyRegistered}
                existingDonationStatus={existingRegistration?.donationStatus ?? null}
                existingRegistrationId={existingRegistration?.id ?? null}
                deadlinePassed={deadlinePassed}
              />
            </>
          )}
        </section>
      </div>

    </div>
  );
}
