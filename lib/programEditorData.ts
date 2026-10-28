/**
 * A program as the program editor holds it (2026-10-24, Phase 2 safe saves).
 * One mapping for the edit page, which hands it to the editor, and the save
 * route, which compares it field by field when someone else saved in the
 * meantime. Moved from app/tools/programs/[programSlug]/edit/page.tsx.
 */

import type { Prisma } from "@prisma/client";
import type { ProgramData } from "@/lib/programTypes";
import { toCentralDatetime } from "@/lib/timezone";
import { hasOpenEntry, resolveOffering } from "@/lib/programOffering";

/** What the edit page and the save route load for this. */
export const EDITOR_PROGRAM_INCLUDE = {
  // The old category, for the offering's fallback while its own fields are empty.
  category: { select: { slug: true, kind: true } },
  programTeachers: {
    orderBy: { order: "asc" },
    include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
  },
  // Teams that prepare (2026-10-24, lib/programHelpers.ts).
  helpers: { select: { hubId: true, canReach: true } },
} satisfies Prisma.ProgramInclude;

type EditorProgram = Prisma.ProgramGetPayload<{ include: typeof EDITOR_PROGRAM_INCLUDE }>;

export function programToEditorData(program: EditorProgram, coverageHubSlugs: string[]): ProgramData {
  const offering = resolveOffering(program);
  return {
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
    categoryId: program.categoryId ?? "",
    // The offering's own fields, or (until the migration has filled them) the
    // values its old category implies, so the dropdowns open on a sensible choice.
    offeringCategory: offering.category ?? "",
    offeringFormat: offering.format ?? "",
    silentMeditation: offering.silentMeditation,
    hostedByVolunteers: offering.hostedByVolunteers,
    // Its own setting; while still empty, the answer the old rule gave.
    openEntry: hasOpenEntry(program),
    flodeskSync: program.flodeskSync ?? null,
    flodeskSegmentId: program.flodeskSegmentId ?? null,
    flodeskSegmentName: program.flodeskSegmentName ?? null,
    offeringFromLegacy: offering.source === "legacy-category",
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
    // A series' end date and "shown first" (2026-10-28), as the setup holds them.
    recurrenceUntil: program.recurrenceUntil ? program.recurrenceUntil.toISOString().slice(0, 10) : "",
    listFirst: program.listFirst != null,
    registrationEnabled: program.registrationEnabled,
    registrationClosed: program.registrationClosed,
    registrationCapacity: program.registrationCapacity?.toString() ?? "",
    registrationDeadline: toCentralDatetime(program.registrationDeadline),
    registrationOpensAt: toCentralDatetime(program.registrationOpensAt),
    registrationFields: (program.registrationFields as any[]) ?? [],
    confirmationMessage: program.confirmationMessage,
    followUpEnabled: program.followUpEnabled,
    followUpMessage: program.followUpMessage ?? null,
    reminderDate: toCentralDatetime(program.reminderDate),
    reminderDaysBefore: program.reminderDaysBefore?.toString() ?? "",
    reminderMessage: program.reminderMessage,
    danaMode: program.danaMode,
    suggestedDana: program.suggestedDana?.toString() ?? "",
    danaBaseAmount: program.danaBaseAmount?.toString() ?? "",
    danaFixedAmount: program.danaFixedAmount?.toString() ?? "",
    danaMessage: program.danaMessage ?? null,
    danaText: program.danaText ?? "",
    specialAnnouncement: program.specialAnnouncement ?? "",
    announcementUntil: program.announcementUntil
      ? program.announcementUntil.toLocaleDateString("en-CA", { timeZone: "America/Chicago" })
      : "",
    earlyArrivalMessage: program.earlyArrivalMessage ?? "",
    hideFromDashboard: program.hideFromDashboard,
    dayOfWeek: program.dayOfWeek,
    sortOrder: program.sortOrder?.toString() ?? "",
    removeFromProgramList: program.removeFromProgramList,
    dashboardShowAt: toCentralDatetime(program.dashboardShowAt),
    hideFromProgramPageList: program.hideFromProgramPageList,
    hideFromWeeklySchedule: program.hideFromWeeklySchedule,
    hideWhenPast: program.hideWhenPast,
    archived: program.archivedAt !== null,
    isOpenAccess: program.isOpenAccess,
    guestAccessKey: program.guestAccessKey ?? "",
    programNotes: program.programNotes ?? null,
    hostingHubSlug: program.hostingHubSlug ?? null,
    hostingRequired: program.hostingRequired ?? true,
    recordByDefault: program.recordByDefault ?? false,
    outsideMeetingUrl: program.outsideMeetingUrl ?? "",
    outsideMeetingPublic: program.outsideMeetingPublic,
    // Sorted, so the same teams always compare the same.
    coverageHubSlugs: [...coverageHubSlugs].sort(),
    helperTeams: program.helpers
      .map((h) => ({ hubId: h.hubId, canReach: h.canReach }))
      .sort((a, b) => a.hubId.localeCompare(b.hubId)),
  };
}

/**
 * Each save field (the editor's payload key) as the editor first held it,
 * for the save route's same-field check. Two programs compare equal on a
 * field when nobody changed it in between.
 */
export function editorFieldValue(data: ProgramData, key: string): unknown {
  switch (key) {
    case "teacherIds":
      return (data.programTeachers ?? []).map((t) => t.id);
    default:
      return (data as unknown as Record<string, unknown>)[key];
  }
}

/** The save fields people know by name, for "someone else changed …". */
export const EDITOR_FIELD_LABELS: Record<string, string> = {
  name: "the name", slug: "the web address", tagline: "the tagline", programImage: "the image",
  description: "the description", pullQuote: "the quote", pullQuoteSource: "the quote's source",
  programNotes: "the program notes", teacherFacilitators: "the teacher names", teacherIds: "the teachers",
  categoryId: "the old category", offeringCategory: "the category", offeringFormat: "the format",
  silentMeditation: "silent meditation", hostedByVolunteers: "hosted by volunteers", openEntry: "open entry",
  flodeskSync: "the mailing list", flodeskSegmentId: "the mailing-list segment",
  dateText: "the date words", timeText: "the time words", programFormat: "in person or online",
  venue: "the venue", locationText: "the location", locationLink: "the location link",
  startDatetime: "the start", endDatetime: "the end", recurrenceFreq: "how often it repeats",
  recurrenceInterval: "how often it repeats", recurrenceDays: "the days", recurrenceCount: "how many times", recurrenceUntil: "when the series ends", listFirst: "shown first",
  registrationEnabled: "registration on or off", registrationClosed: "registration open or closed",
  registrationCapacity: "the places", registrationDeadline: "the closing date", registrationOpensAt: "when registration opens",
  registrationFields: "the questions", confirmationMessage: "the confirmation message",
  followUpEnabled: "the note after", followUpMessage: "the note after's words",
  reminderDate: "the reminder date", reminderDaysBefore: "when the reminder goes", reminderMessage: "the reminder message", danaMode: "the dana setting",
  suggestedDana: "the suggested dana", danaBaseAmount: "the base amount", danaFixedAmount: "the fixed amount",
  danaMessage: "the dana message", danaText: "the dana words", specialAnnouncement: "the notice",
  announcementUntil: "the notice's end date", earlyArrivalMessage: "the session note",
  hideFromDashboard: "Today on My Home", dayOfWeek: "the days", sortOrder: "the sort order",
  removeFromProgramList: "the programs list", dashboardShowAt: "when it shows on My Home",
  hideFromProgramPageList: "the public listing", hideFromWeeklySchedule: "This Week",
  hideWhenPast: "hiding after its date", isOpenAccess: "guest access", hostingHubSlug: "the hosting team",
  hostingRequired: "No host needed", recordByDefault: "recording", outsideMeetingUrl: "the outside meeting link",
  outsideMeetingPublic: "joining from the public page", coverageHubSlugs: "the supporting teams",
  helperTeams: "the teams that prepare",
};
