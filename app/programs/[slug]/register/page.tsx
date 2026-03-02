import { sanityClient } from "@/lib/sanity";
import { programBySlugQuery } from "@/lib/queries";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import RegistrationForm, { RegistrationField } from "@/components/RegistrationForm";
import { db } from "@/lib/db";

// Always show fresh data — this page is user-specific
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await sanityClient.fetch<{ name: string } | null>(
    `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] { name }`,
    { slug }
  );
  return {
    title: p ? `Register — ${p.name} — Rooted In Mindfulness` : "Register",
  };
}

interface RegisterProgram {
  _id: string;
  name: string;
  slug: { current: string };
  registrationEnabled?: boolean;
  registrationCapacity?: number | null;
  registrationDeadline?: string | null;
  danaMode?: string | null;
  suggestedDana?: number | null;
  danaBaseAmount?: number | null;
  danaFixedAmount?: number | null;
  danaMessage?: string | null;
  registrationFields?: RegistrationField[];
  dateText?: string | null;
  timeText?: string | null;
  locationText?: string | null;
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [program, session] = await Promise.all([
    sanityClient.fetch<RegisterProgram | null>(programBySlugQuery, { slug }),
    auth(),
  ]);

  // Guard: unknown program
  if (!program) redirect("/programs");

  // Guard: registration not enabled on this program — send to program page
  if (!program.registrationEnabled) redirect(`/programs/${slug}`);

  // Fetch user-specific data in parallel
  const [activeCount, userProfile, existingRegistration] = await Promise.all([
    program.registrationCapacity
      ? db.registration.count({
          where: { programId: program._id, status: { in: ["REGISTERED", "APPROVED"] } },
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
            status: { not: "CANCELLED" },
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

  return (
    <div className="rg-page">

      {/* ── Header ── */}
      <header className="rg-header">
        <Link href={`/programs/${slug}`} className="rg-header__back">
          ← Back to Program
        </Link>
        <p className="rg-header__program-name">{program.name}</p>
        <h1 className="rg-header__title">{headerTitle}</h1>
      </header>

      {/* ── Content ── */}
      <div className="rg-content">
        {showAlreadyRegistered ? (
          <div className="rg-already">
            <p>You&rsquo;re already registered for this program.</p>
            <Link href={`/programs/${slug}`}>← Back to Program</Link>
          </div>
        ) : (
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
        )}
      </div>

    </div>
  );
}
