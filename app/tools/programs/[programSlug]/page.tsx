/**
 * /tools/programs/[programSlug] — Program detail with registration table.
 * Role gate: REGISTRAR | ADMIN (handled by tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import VolunteerTable, { SerializedRegistration } from "@/components/registrar/VolunteerTable";
import type { RegistrationField } from "@/components/RegistrationForm";

export const dynamic = "force-dynamic";

export default async function ProgramDetailToolPage({
  params,
}: {
  params: Promise<{ programSlug: string }>;
}) {
  const { programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [program, registrations] = await Promise.all([
    db.program.findUnique({
      where: { slug: programSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        tagline: true,
        registrationCapacity: true,
        danaMode: true,
        reminderDate: true,
        programFormat: true,
        startDatetime: true,
        endDatetime: true,
        registrationFields: true,
      },
    }),
    db.registration.findMany({
      // Exclude held (PENDING_PAYMENT) rows — not real registrations until paid.
      where: { programSlug, status: { not: "PENDING_PAYMENT" } },
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

  return (
    <div className="vol-page">
      <div className="vol-content">

        <div className="vol-header">
          <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
          <div className="vol-header__row">
            <h1 className="vol-header__title">{program.name}</h1>
            <Link href={`/tools/programs/${programSlug}/edit`} className="vol-header__edit-link">
              Edit Program Settings &rarr;
            </Link>
          </div>
        </div>

        <VolunteerTable
          initialRegistrations={serialized}
          programSlug={programSlug}
          programTitle={program.name}
          danaMode={program.danaMode ?? null}
          registrationCapacity={program.registrationCapacity ?? null}
          registrationFields={(program.registrationFields as RegistrationField[] | null) ?? []}
          reminderDate={program.reminderDate?.toISOString() ?? null}
        />

      </div>
    </div>
  );
}
