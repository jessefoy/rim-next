/**
 * A program as its setup and editor hold it (moved here 2026-10-28 from the
 * retired one-page editor, components/registrar/ProgramEditor.tsx): the shape
 * the shapes, copies, drafts, the walk-through and the save share. Values are
 * as typed (strings for numbers and Central "YYYY-MM-DDTHH:mm" times);
 * lib/programEditorData.ts maps a stored program into it.
 */

/** A question on the registration form. */
export interface RegistrationField {
  /** The question's id, set by the save route; kept through edits (lib/registrationFields.ts). */
  _key?: string;
  /** Who asks it (lib/questionAskers.ts): "teacher", "team:<hubId>", or absent for the registration team. */
  askedBy?: string;
  label: string;
  fieldType: "shortText" | "longText" | "yesNo" | "select";
  required: boolean;
  options: string[];
}

export interface ProgramData {
  id?: string;
  slug: string;
  name: string;
  tagline: string;
  programImage: string;
  description: any;
  pullQuote: string;
  pullQuoteSource: string;
  programNotes: any;
  teacherFacilitators: string[];
  programTeachers: { id: string; firstName: string; lastName: string }[];
  /** The OLD category (ProgramCategory), kept until the migration is verified. */
  categoryId: string;
  /** Offering Category and Format (lib/programOffering.ts), as codes. */
  offeringCategory: string;
  offeringFormat: string;
  silentMeditation: boolean;
  hostedByVolunteers: boolean;
  /** Open entry: its own setting (anyone signed in may join without registering). Filled from the old rule while it is still empty. */
  openEntry: boolean;
  /** True when the three values above were filled in from the old category rather than saved on the program. */
  offeringFromLegacy?: boolean;
  /** Flodesk (mass email): null = the default rule; the program's segment once linked or created.
   *  Set in the Registration app, not in the editor (2026-10-24); kept for lib/programEditorData.ts. */
  flodeskSync?: boolean | null;
  flodeskSegmentId?: string | null;
  flodeskSegmentName?: string | null;
  dateText: string;
  timeText: string;
  programFormat: string;
  venue: string;
  locationText: string;
  locationLink: string;
  startDatetime: string;
  endDatetime: string;
  recurrenceFreq: string;
  recurrenceInterval: string;
  recurrenceDays: string[];
  recurrenceCount: string;
  /** A series that ends on a date, "YYYY-MM-DD" (Central), or "" (2026-10-28). */
  recurrenceUntil?: string;
  /** Shown first in its section on Programs & Events (2026-10-28). */
  listFirst?: boolean;
  registrationEnabled: boolean;
  registrationClosed: boolean;
  registrationCapacity: string;
  registrationDeadline: string;
  /** "Opens on", a Central "YYYY-MM-DDTHH:mm", or "". */
  registrationOpensAt: string;
  registrationFields: RegistrationField[];
  confirmationMessage: any;
  reminderDate: string;
  /** The note after a one-time program ends (lib/followUp.ts). */
  followUpEnabled?: boolean;
  followUpMessage?: any;
  /** Days before the first session, as typed, or "" (lib/reminderSchedule.ts). */
  reminderDaysBefore?: string;
  reminderMessage: any;
  danaMode: string;
  suggestedDana: string;
  danaBaseAmount: string;
  danaFixedAmount: string;
  danaMessage: any;
  danaText: string;
  specialAnnouncement: string;
  /** "YYYY-MM-DD" (a CT day) or "". */
  announcementUntil: string;
  earlyArrivalMessage: string;
  hideFromDashboard: boolean;
  dayOfWeek: string[];
  sortOrder: string;
  removeFromProgramList: boolean;
  dashboardShowAt: string;
  hideFromProgramPageList: boolean;
  hideFromWeeklySchedule: boolean;
  hideWhenPast: boolean;
  /** Read-only: the program is archived (archivedAt set). Edit page only. */
  archived?: boolean;
  isOpenAccess: boolean;
  guestAccessKey: string;
  /** Which hub hosts this program. Null = "host-team" (the implicit default).
   *  Coordinator can transfer hosting to another hub under Who's helping. */
  hostingHubSlug: string | null;
  /** "No host needed" — when false, the program is self-led / community-led
   *  (Recovery Dharma, drop-in groups) and is excluded from the Scheduler,
   *  rotation generation, and the new-program-needs-host email. Default true. */
  hostingRequired?: boolean;
  recordByDefault?: boolean;
  /** The outside room's link (2026-10-14): empty = RIM's Zoom. lib/outsideMeeting.ts. */
  outsideMeetingUrl?: string;
  /** Anyone may join from the public program page, through RIM's door. */
  outsideMeetingPublic?: boolean;
  /** Auxiliary hubs providing supporting-role coverage for this program
   *  (session 129 — AV + Greeter). Empty array is the default; each slug
   *  here gets a row in program_coverage_hubs on save. Primary hub
   *  (hostingHubSlug) is implicit and never appears in this list. */
  coverageHubSlugs?: string[];
  /** Teams that prepare (2026-10-24, lib/programHelpers.ts), sorted by team id. */
  helperTeams?: { hubId: string; canReach: boolean }[];
}
