import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import RegistrationForm, { RegistrationField } from "@/components/RegistrationForm";
import { db } from "@/lib/db";
import { renderFormattedTextAsync } from "@/lib/renderRichContentServer";
import { buildSubtitle } from "@/lib/programUtils";

// Always show fresh data — this page is user-specific
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await db.program.findUnique({ where: { slug }, select: { name: true } });
  return {
    title: p ? `Register — ${p.name} — Rooted In Mindfulness` : "Register",
  };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
      ? db.registration.count({
          // PENDING_PAYMENT holds a seat during checkout — count it so the shown
          // spots-remaining matches the seats actually held.
          where: { programId: program._id, status: { in: ["REGISTERED", "APPROVED", "PENDING_PAYMENT"] } },
        })
      : Promise.resolve(0),
    session?.user?.id
      ? db.user.findUnique({
          where: { id: session.user.id },
          select: { firstName: true, lastName: true, phone: true, email: true },
        })
      : Promise.resolve(null),
    session?.user?.id
      ? db.registration.findFirst({
          where: {
            programId: program._id,
            userId: session.user.id,
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

  const deadlinePassed = !!(
    program.registrationDeadline && new Date(program.registrationDeadline) < new Date()
  );

  const alreadyRegistered = !!existingRegistration;
  const hasPendingDana =
    alreadyRegistered && existingRegistration?.donationStatus === "PENDING";

  // If already registered (and not here to complete dana), show a friendly message
  // rather than redirect — they may have bookmarked the page or arrived from an old link
  const showAlreadyRegistered = alreadyRegistered && !hasPendingDana;

  const headerTitle = hasPendingDana
    ? "Complete Your Dana"
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
          {showAlreadyRegistered ? (
            <div className="rg-already">
              <h2>You&rsquo;re already registered.</h2>
              <p>Your place in this program is confirmed.</p>
              <Link href={`/programs/${slug}`}>Return to the program →</Link>
            </div>
          ) : (
            <>
              {!hasPendingDana && (
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
