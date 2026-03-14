/**
 * /account/hub/registrar/programs/[programSlug] — Program detail with VolunteerTable.
 *
 * Only REGISTRAR | ADMIN can access (stakeholders see list page only).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { sanityClient } from "@/lib/sanity";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";
import VolunteerTable, { SerializedRegistration } from "@/components/registrar/VolunteerTable";
import CreateMeetButton from "@/components/registrar/CreateMeetButton";
import type { RegistrationField } from "@/components/RegistrationForm";

export const dynamic = "force-dynamic";

const programForVolunteerQuery = `*[_type == "programs" && slug.current == $slug && !(_id in path("drafts.**"))][0] {
  _id, name, slug, tagline, registrationCapacity, danaMode, reminderDate,
  programFormat, startDatetime, endDatetime, zoomLink, meetHostAccount, calendarEventId,
  registrationFields[] { _key, label, fieldType, required, options }
}`;

interface SanityProgram {
  _id: string;
  name: string;
  slug: { current: string };
  tagline?: string;
  registrationCapacity?: number | null;
  danaMode?: string | null;
  reminderDate?: string | null;
  programFormat?: string | null;
  startDatetime?: string | null;
  endDatetime?: string | null;
  zoomLink?: string | null;
  meetHostAccount?: string | null;
  calendarEventId?: string | null;
  registrationFields?: RegistrationField[];
}

export default async function RegistrarProgramDetailPage({
  params,
}: {
  params: Promise<{ slug: string; programSlug: string }>;
}) {
  const { slug, programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  // Only REGISTRAR | ADMIN can access detail pages
  const roles = session.user.roles ?? [];
  const isRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  if (!isRegistrar) redirect(`/account/hub/${slug}/programs`);

  const [program, registrations] = await Promise.all([
    sanityClient.fetch<SanityProgram | null>(programForVolunteerQuery, { slug: programSlug }),
    db.registration.findMany({
      where: { programSlug },
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
    reminderSentAt: r.reminderSentAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const base = `/account/hub/${slug}/programs`;

  return (
    <div className="vol-page">
      <div className="vol-content">

        <div className="vol-header">
          <Link href={base} className="vol-back">&larr; Programs</Link>
          <h1 className="vol-header__title">{program.name}</h1>
        </div>

        {(program.programFormat === "virtual" || program.programFormat === "hybrid") && (
          <div className="vol-meet-section">
            <CreateMeetButton
              programSlug={programSlug}
              existingLink={program.zoomLink ?? null}
              existingHostAccount={program.meetHostAccount ?? null}
              hasStartDatetime={!!program.startDatetime}
            />
          </div>
        )}

        <VolunteerTable
          initialRegistrations={serialized}
          programSlug={programSlug}
          programTitle={program.name}
          danaMode={program.danaMode ?? null}
          registrationCapacity={program.registrationCapacity ?? null}
          registrationFields={program.registrationFields ?? []}
          reminderDate={program.reminderDate ?? null}
        />

      </div>
    </div>
  );
}
