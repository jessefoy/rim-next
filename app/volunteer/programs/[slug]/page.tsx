import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity";
import { db } from "@/lib/db";
import Link from "next/link";
import VolunteerTable, { SerializedRegistration } from "@/components/VolunteerTable";

const programForVolunteerQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, tagline, registrationCapacity, danaMode
}`;

interface SanityProgram {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  registrationCapacity?: number | null;
  danaMode?: string | null;
}

export default async function VolunteerProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const isAuthorized = session.user.roles?.some((r) =>
    ["REGISTRAR", "ADMIN"].includes(r)
  );
  if (!isAuthorized) {
    return (
      <div className="vol-page">
        <div className="vol-content">
          <p className="vol-unauthorized">You don&rsquo;t have permission to access this area.</p>
        </div>
      </div>
    );
  }

  const { slug } = await params;

  const [program, registrations] = await Promise.all([
    sanityClient.fetch<SanityProgram | null>(programForVolunteerQuery, { slug }),
    db.registration.findMany({
      where: { programSlug: slug },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!program) {
    return (
      <div className="vol-page">
        <div className="vol-content">
          <p className="vol-empty">Program not found.</p>
        </div>
      </div>
    );
  }

  // Serialize dates for client component
  const serialized: SerializedRegistration[] = registrations.map((r) => ({
    id: r.id,
    programId: r.programId,
    programSlug: r.programSlug,
    programTitle: r.programTitle,
    userId: r.userId,
    email: r.email,
    firstName: r.firstName,
    lastName: r.lastName,
    phone: r.phone,
    customFields: r.customFields as Record<string, string> | null,
    status: r.status,
    waitlistPosition: r.waitlistPosition,
    notes: r.notes,
    donationStatus: r.donationStatus,
    donationAmount: r.donationAmount,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="vol-page">
      <div className="vol-content">

        <div className="vol-header">
          <Link href="/volunteer" className="vol-back">← Programs</Link>
          <p className="lp-label">Volunteer Admin</p>
          <h1 className="vol-header__title">{program.name}</h1>
        </div>

        <VolunteerTable
          initialRegistrations={serialized}
          programSlug={slug}
          programTitle={program.name}
          danaMode={program.danaMode ?? null}
          registrationCapacity={program.registrationCapacity ?? null}
        />

      </div>
    </div>
  );
}
