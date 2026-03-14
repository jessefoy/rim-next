/**
 * /account/hub/registrar/programs/[programSlug]/edit — Edit an existing program.
 * REGISTRAR | ADMIN only.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getHubMembership } from "@/lib/hubAuth";
import Link from "next/link";
import ProgramEditor from "@/components/registrar/ProgramEditor";
import type { ProgramData } from "@/components/registrar/ProgramEditor";

export const dynamic = "force-dynamic";

function toLocalDatetime(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditProgramPage({
  params,
}: {
  params: Promise<{ slug: string; programSlug: string }>;
}) {
  const { slug, programSlug } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const { hub, member, isAdmin } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub || (!member && !isAdmin)) redirect("/account/dashboard");

  const roles = session.user.roles ?? [];
  const isRegistrar = roles.includes("REGISTRAR") || roles.includes("ADMIN");
  if (!isRegistrar) redirect(`/account/hub/${slug}/programs`);

  const [program, categories] = await Promise.all([
    db.program.findUnique({ where: { slug: programSlug } }),
    db.programCategory.findMany({ orderBy: { name: "asc" } }),
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

  // Serialize for the client component — convert Dates to datetime-local strings
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
    categoryId: program.categoryId ?? "",
    dateText: program.dateText ?? "",
    programFormat: program.programFormat,
    venue: program.venue,
    locationText: program.locationText ?? "",
    locationLink: program.locationLink ?? "",
    zoomLink: program.zoomLink ?? "",
    meetHostAccount: program.meetHostAccount ?? "",
    calendarEventId: program.calendarEventId ?? "",
    startDatetime: toLocalDatetime(program.startDatetime),
    endDatetime: toLocalDatetime(program.endDatetime),
    recurrenceFreq: program.recurrenceFreq ?? "",
    recurrenceInterval: program.recurrenceInterval?.toString() ?? "",
    recurrenceDays: program.recurrenceDays,
    recurrenceCount: program.recurrenceCount?.toString() ?? "",
    registrationEnabled: program.registrationEnabled,
    registrationClosed: program.registrationClosed,
    registrationCapacity: program.registrationCapacity?.toString() ?? "",
    registrationDeadline: toLocalDatetime(program.registrationDeadline),
    registrationFields: (program.registrationFields as any[]) ?? [],
    confirmationMessage: program.confirmationMessage,
    reminderDate: toLocalDatetime(program.reminderDate),
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
  };

  return (
    <div className="vol-page">
      <div className="vol-content">
        <div className="vol-header">
          <Link href={`/account/hub/${slug}/programs`} className="vol-back">&larr; Programs</Link>
        </div>
        <ProgramEditor
          hubSlug={slug}
          initialData={initialData}
          isEditing={true}
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name }))}
        />
      </div>
    </div>
  );
}
