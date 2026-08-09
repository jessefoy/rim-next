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

  const [program, categories, hubs, coverageRows] = await Promise.all([
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
    // Active hubs feed the Hosting & Access tab dropdown. Coordinator
    // chooses which hub hosts this program's live sessions; the dropdown
    // shows every active hub so the field is discoverable as new hubs
    // come online (Silent Meditation, Recovery Dharma, etc.).
    //
    // The Auxiliary coverage section filters by `usesScheduler` — true
    // when the hub has an enabled HubAppLink with toolSlug = "schedule".
    // That's the authoritative source of "this hub uses the Scheduler"
    // (a coordinator added the link to their sidebar). Slot it as a
    // derived boolean below the findMany so the editor can filter.
    db.hub.findMany({
      where: { status: "ACTIVE" },
      select: {
        slug: true,
        name: true,
        // `hasSchedule` flags hosting-style hubs (host-team, peer-led-
        // silent-meditation) — those that run the live session, own
        // LiveKit, hold dharma authority. Only these are valid choices
        // for the "Hosting team" dropdown.
        hasSchedule: true,
        // `appliesToFormats` (virtual/hybrid for hosting hubs, in-person/
        // hybrid for AV+greeter) lets the Auxiliary fieldset filter
        // by overlap with the program's `programFormat` so a virtual-
        // only program doesn't show AV/Greeter checkboxes.
        appliesToFormats: true,
        // A Scheduler HubAppLink is the authoritative "uses the
        // Scheduler tool" signal — required for a hub to appear as
        // auxiliary coverage.
        appLinks: {
          where: { toolSlug: "schedule", isEnabled: true },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
    // Auxiliary-coverage rows for this program (session 129). Empty array
    // when no auxiliary hubs are tagged. Editor renders these as checked
    // checkboxes in the "Auxiliary role coverage" section.
    db.programCoverageHub.findMany({
      where: { programSlug },
      select: { hubSlug: true },
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

  // Future HostAssignment count drives the mid-flight change warning when
  // a coordinator transfers hosting to another hub. The grandfather policy
  // keeps existing future assignments valid; the warning surfaces how many
  // assignments are about to grandfather so the coordinator's decision is
  // informed. Standing rotations live in a separate table and aren't part
  // of this count — they ride forward on the new hub automatically.
  const futureHostAssignmentCount = await db.hostAssignment.count({
    where: {
      programSlug,
      sessionDate: { gte: new Date() },
    },
  });

  const initialData: ProgramData = {
    id: program.id,
    slug: program.slug,
    name: program.name,
    tagline: program.tagline ?? "",
    programImage: program.programImage ?? "",
    description: program.description,
    pullQuote: program.pullQuote ?? "",
    pullQuoteSource: program.pullQuoteSource ?? "",
    teacherFacilitators: program.teacherFacilitators,
    programTeachers: program.programTeachers?.map((pt) => ({
      id: pt.user.id,
      firstName: pt.user.preferredName || pt.user.firstName || "",
      lastName: pt.user.lastName || "",
    })) ?? [],
    teacherLabel: program.teacherLabel ?? null,
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
    danaMessage: program.danaMessage ?? null,
    danaText: program.danaText ?? "",
    specialAnnouncement: program.specialAnnouncement ?? "",
    earlyArrivalMessage: program.earlyArrivalMessage ?? "",
    hideFromDashboard: program.hideFromDashboard,
    dayOfWeek: program.dayOfWeek,
    sortOrder: program.sortOrder?.toString() ?? "",
    removeFromProgramList: program.removeFromProgramList,
    dashboardShowAt: toCentralDatetime(program.dashboardShowAt),
    hideFromProgramPageList: program.hideFromProgramPageList,
    hideFromWeeklySchedule: program.hideFromWeeklySchedule,
    hideWhenPast: program.hideWhenPast,
    isOpenAccess: program.isOpenAccess,
    guestAccessKey: program.guestAccessKey ?? "",
    programNotes: program.programNotes ?? null,
    hostingHubSlug: program.hostingHubSlug ?? null,
    hostingRequired: program.hostingRequired ?? true,
    recordByDefault: program.recordByDefault ?? false,
    coverageHubSlugs: coverageRows.map((r) => r.hubSlug),
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
          categories={categories.map((c) => ({ id: c.id, slug: c.slug, name: c.name, kind: c.kind ?? null }))}
          hubs={hubs.map((h) => ({
            slug: h.slug,
            name: h.name,
            hasSchedule: h.hasSchedule,
            appliesToFormats: h.appliesToFormats,
            usesScheduler: h.appLinks.length > 0,
          }))}
          futureHostAssignmentCount={futureHostAssignmentCount}
        />
      </div>
    </div>
  );
}
