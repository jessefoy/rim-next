/**
 * /tools/programs/[programSlug]/edit — Edit an existing program.
 * Role gate: REGISTRAR | ADMIN (handled by tools/programs/layout.tsx).
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";
import type { ProgramData } from "@/components/registrar/ProgramEditor";
import { toCentralDatetime } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function EditProgramToolPage({
  params,
}: {
  params: Promise<{ programSlug: string }>;
}) {
  const { programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const [program, categories] = await Promise.all([
    db.program.findUnique({
      where: { slug: programSlug },
      include: {
        programTeachers: {
          orderBy: { order: "asc" },
          include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
        },
      },
    }),
    db.programCategory.findMany({ orderBy: { sortOrder: "asc" } }),
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

  const initialData: ProgramData = {
    id: program.id,
    slug: program.slug,
    name: program.name,
    tagline: program.tagline ?? "",
    programImage: program.programImage ?? "",
    description: program.description,
    pullQuote: program.pullQuote ?? "",
    pullQuoteSource: program.pullQuoteSource ?? "",
    specialNotes: program.specialNotes,
    teacherFacilitators: program.teacherFacilitators,
    programTeachers: program.programTeachers?.map((pt) => ({
      id: pt.user.id,
      firstName: pt.user.preferredName || pt.user.firstName || "",
      lastName: pt.user.lastName || "",
    })) ?? [],
    categoryId: program.categoryId ?? "",
    dateText: program.dateText ?? "",
    timeText: program.timeText ?? "",
    programFormat: program.programFormat,
    venue: program.venue,
    locationText: program.locationText ?? "",
    locationLink: program.locationLink ?? "",
    startDatetime: toCentralDatetime(program.startDatetime),
    endDatetime: toCentralDatetime(program.endDatetime),
    recurrenceFreq: program.recurrenceFreq ?? "",
    recurrenceInterval: program.recurrenceInterval?.toString() ?? "",
    recurrenceDays: program.recurrenceDays,
    recurrenceCount: program.recurrenceCount?.toString() ?? "",
    registrationEnabled: program.registrationEnabled,
    registrationClosed: program.registrationClosed,
    registrationCapacity: program.registrationCapacity?.toString() ?? "",
    registrationDeadline: toCentralDatetime(program.registrationDeadline),
    registrationFields: (program.registrationFields as any[]) ?? [],
    confirmationMessage: program.confirmationMessage,
    reminderDate: toCentralDatetime(program.reminderDate),
    reminderMessage: program.reminderMessage,
    danaMode: program.danaMode,
    suggestedDana: program.suggestedDana?.toString() ?? "",
    danaBaseAmount: program.danaBaseAmount?.toString() ?? "",
    danaFixedAmount: program.danaFixedAmount?.toString() ?? "",
    danaMessage: program.danaMessage ?? "",
    danaText: program.danaText ?? "",
    specialAnnouncement: program.specialAnnouncement ?? "",
    earlyArrivalMessage: program.earlyArrivalMessage ?? "",
    hideFromDashboard: program.hideFromDashboard,
    dayOfWeek: program.dayOfWeek,
    sortOrder: program.sortOrder?.toString() ?? "",
    removeFromProgramList: program.removeFromProgramList,
    hideFromProgramPageList: program.hideFromProgramPageList,
    isOpenAccess: program.isOpenAccess,
    guestAccessKey: program.guestAccessKey ?? "",
  };

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href="/tools/programs" className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          basePath="/tools/programs"
          initialData={initialData}
          isEditing={true}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  );
}
