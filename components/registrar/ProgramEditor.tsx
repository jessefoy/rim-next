"use client";

/**
 * ProgramEditor — creating and editing a program, as one page in seven
 * sections (Phase 2, 2026-10-24): About; When and where; Who's helping; How
 * people join; What we tell them; Dana; Where it appears. Each section is its
 * own memoized component in ./program-editor/, so typing in one redraws only
 * that one. This file holds the program's state, the save, the section list
 * and the unsaved-changes guard. RIM_ProgramEditor.md.
 *
 * CSS prefix: pe-
 */

import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { cleanOffering, isPubliclyListedCategory } from "@/lib/programOffering";
import { activeAnnouncement, monthlyPatternPhrase } from "@/lib/scheduleUtils";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { isHtmlString, renderBlockNoteHtml } from "@/lib/renderRichContent";
import { SaveNote } from "@/components/FormDone";
import { editorFieldValue } from "@/lib/programEditorData";
import { useNavigationDrawer } from "@/components/hooks/useNavigationDrawer";
import {
  DEFAULT_HOSTING_HUB_SLUG,
  SECTIONS,
  goToSection,
  listingReasonOf,
  nowCentral,
  sectionDomId,
  toEditorString,
  type AskerOption,
  type Category,
  type EditorHub,
  type RegistrationField,
  type SectionId,
  type TeacherItem,
} from "./program-editor/shared";
import AboutSection from "./program-editor/AboutSection";
import WhenWhereSection from "./program-editor/WhenWhereSection";
import HelpingSection from "./program-editor/HelpingSection";
import JoinSection from "./program-editor/JoinSection";
import TellSection from "./program-editor/TellSection";
import DanaSection from "./program-editor/DanaSection";
import AppearsSection from "./program-editor/AppearsSection";
import NoticePanel from "./program-editor/NoticePanel";
import ReadyPanel from "./program-editor/ReadyPanel";
import UpdatePanel, { type UpdateOffer } from "./program-editor/UpdatePanel";
import { UPDATE_KINDS, type UpdateKind } from "@/lib/programUpdate";
import { ASKED_BY_REGISTRATION, ASKED_BY_TEACHER, askedByTeam } from "@/lib/questionAskers";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface Props {
  hubSlug?: string;
  /** Base path for navigation (e.g. "/tools/programs"). Falls back to hub-based path if not set. */
  basePath?: string;
  initialData?: ProgramData;
  isEditing: boolean;
  /** The Registrar, Admin and Guiding Teacher roles (2026-10-24): the
   *  guest-link reset and the link to Program Categories. A team member
   *  using Programs sees and copies the guest link. Off unless passed. */
  canManage?: boolean;
  categories: Category[];
  /** Active hubs for Who's helping. Filtered by role:
   *  - Hosting team dropdown: hubs where `hasSchedule` is true
   *    (hosting-style hubs that run live sessions — host-team,
   *    peer-led-silent-meditation).
   *  - Auxiliary fieldset: hubs where `hasSchedule` is false AND
   *    `usesScheduler` is true AND `appliesToFormats` overlaps with
   *    the program's `programFormat` (pure auxiliary hubs like AV
   *    and greeter that staff supporting roles, only relevant to
   *    in-person or hybrid programs).
   *  These two filters give clean, non-overlapping menus. */
  hubs: EditorHub[];
  /** Count of HostAssignment rows for this program with `sessionDate >= now`.
   *  Drives the mid-flight change warning when a coordinator switches
   *  `hostingHubSlug`. Zero or unset means no warning. Only meaningful in
   *  edit mode. */
  futureHostAssignmentCount?: number;
  /** May email the people registered when posting a notice (canUseRegistration). */
  canEmailRegistered?: boolean;
  /** People with a place, for the notice's email box; null when it isn't shown. */
  registeredCount?: number | null;
  /** Teams that may prepare (active, with Helping with), and any the program
   *  has (`active: false` when that team is no longer active). */
  prepTeams?: { id: string; slug: string; name: string; active?: boolean }[];
  /** May choose who asks each question and which teams prepare: the
   *  registration roles (canUseRegistration), since that decides who sees
   *  people's answers and details (2026-10-24). */
  canDecideAskers?: boolean;
  /** A new program copied from this one (lib/programCopy.ts, Phase 4): said
   *  at the top, and Save asks for the new dates. */
  copiedFrom?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─── Schedule auto-generation helpers ────────────────────────────────────────

const DAY_FULL: Record<string, string> = {
  SU: "Sundays", MO: "Mondays", TU: "Tuesdays", WE: "Wednesdays",
  TH: "Thursdays", FR: "Fridays", SA: "Saturdays",
};
const DAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const DAY_ABBR_FROM_INDEX = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Format CT calendar parts as "September 10, 2026" (withYear) or "September 10". */
function fmtCalendarDate(y: number, m: number, d: number, withYear: boolean): string {
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/**
 * Multi-day date-range label from start/end CT calendar parts:
 *   same month → "September 10–13, 2026"; same year → "September 28 – October 1,
 *   2026"; spans years → "December 30, 2026 – January 2, 2027".
 */
function fmtDateRange(
  s: { y: number; m: number; d: number },
  e: { y: number; m: number; d: number },
): string {
  if (s.y === e.y && s.m === e.m) {
    return `${fmtCalendarDate(s.y, s.m, s.d, false)}–${e.d}, ${e.y}`;
  }
  if (s.y === e.y) {
    return `${fmtCalendarDate(s.y, s.m, s.d, false)} – ${fmtCalendarDate(e.y, e.m, e.d, false)}, ${e.y}`;
  }
  return `${fmtCalendarDate(s.y, s.m, s.d, true)} – ${fmtCalendarDate(e.y, e.m, e.d, true)}`;
}

/** Derive the time display string from datetime-local values (YYYY-MM-DDTHH:mm). */
function computeTimeText(start: string, end: string): string {
  if (!start) return "";
  const parseTime = (dt: string) => {
    const t = dt.split("T")[1];
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    return { h, m };
  };
  const fmt = (h: number, m: number) => {
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const mStr = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
    return { str: `${h12}${mStr}`, ampm };
  };
  const s = parseTime(start);
  if (!s) return "";
  const { str: sStr, ampm: sAmpm } = fmt(s.h, s.m);

  // Multi-day span — show the start time as an arrival cue, not "4–12 PM".
  if (end && end.split("T")[0] !== start.split("T")[0]) {
    return `Begins ${sStr} ${sAmpm} CT`;
  }

  if (end) {
    const e = parseTime(end);
    if (e) {
      const { str: eStr, ampm: eAmpm } = fmt(e.h, e.m);
      if (sAmpm === eAmpm) return `${sStr}–${eStr} ${eAmpm} CT`;
      return `${sStr} ${sAmpm}–${eStr} ${eAmpm} CT`;
    }
  }
  return `${sStr} ${sAmpm} CT`;
}

/** Derive the schedule label from recurrence settings and start/end date. */
function computeDateText(start: string, freq: string, days: string[], interval: string, end?: string): string {
  if (freq === "WEEKLY") {
    const ordered = [...days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    const names = ordered.map((d) => DAY_FULL[d] ?? d);
    const prefix = interval && Number(interval) > 1 ? `Every ${interval} weeks: ` : "";
    if (names.length === 0) return `${prefix}Weekly`;
    if (names.length === 1) return `${prefix}${names[0]}`;
    if (names.length === 2) return `${prefix}${names[0]} and ${names[1]}`;
    const last = names[names.length - 1];
    return `${prefix}${names.slice(0, -1).join(", ")}, and ${last}`;
  }
  if (freq === "DAILY") {
    const n = Number(interval);
    return !interval || n <= 1 ? "Daily" : `Every ${n} days`;
  }
  if (freq === "MONTHLY") {
    const sDate = start ? start.split("T")[0] : "";
    const phrase = sDate ? monthlyPatternPhrase(sDate) : "";
    const n = Number(interval);
    if (!phrase) return !interval || n <= 1 ? "Monthly" : `Every ${n} months`;
    const cap = phrase.charAt(0).toUpperCase() + phrase.slice(1);
    return !interval || n <= 1 ? `${cap} of the month` : `Every ${n} months on the ${phrase}`;
  }
  // One-time — derive from the start date, as a range when it spans multiple days
  if (!start) return "";
  const startDate = start.split("T")[0];
  if (!startDate) return "";
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const endDate = end ? end.split("T")[0] : "";
  if (endDate && endDate !== startDate) {
    const [ey, em, ed] = endDate.split("-").map(Number);
    return fmtDateRange({ y: sy, m: sm, d: sd }, { y: ey, m: em, d: ed });
  }
  return fmtCalendarDate(sy, sm, sd, true);
}

/** Derive dayOfWeek array from recurrence or start date — never manually set. */
function deriveDayOfWeek(freq: string, days: string[], start: string): string[] {
  if (freq === "WEEKLY" && days.length > 0) return days;
  if (freq === "DAILY") return DAY_ABBR_FROM_INDEX; // every day
  if (start) {
    const datePart = start.split("T")[0];
    if (datePart) {
      const [y, m, d] = datePart.split("-").map(Number);
      return [DAY_ABBR_FROM_INDEX[new Date(y, m - 1, d).getDay()]];
    }
  }
  return [];
}

/** A stable empty list, so the memoized sections don't redraw. */
const NO_PREP_TEAMS: { id: string; slug: string; name: string; active?: boolean }[] = [];

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProgramEditor({
  hubSlug,
  basePath: basePathProp,
  initialData,
  isEditing,
  canManage = false,
  categories,
  hubs,
  futureHostAssignmentCount = 0,
  canEmailRegistered = false,
  registeredCount = null,
  prepTeams = NO_PREP_TEAMS,
  canDecideAskers = false,
  copiedFrom,
}: Props) {
  const basePath = basePathProp ?? `/account/hub/${hubSlug}/programs`;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedAt, setSavedAt] = useState("");
  const [success, setSuccess] = useState(false);
  const [justCreated, setJustCreated] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  // Send an update to the people registered (Phase 4 slice 3): offered by the
  // save route when the time, place or confirmation message changed; later
  // saves add to it until it's sent or closed.
  const [updateOffer, setUpdateOffer] = useState<(UpdateOffer & { slug: string }) | null>(null);
  const [updateAnswer, setUpdateAnswer] = useState("");
  const [updateSeq, setUpdateSeq] = useState(0);
  const closeUpdate = useCallback((answer: string | null) => {
    setUpdateOffer(null);
    setUpdateAnswer(answer ?? "");
  }, []);
  // A new or grown offer is brought into view under the Save bar.
  useEffect(() => {
    if (updateSeq > 0) document.getElementById("pe-update")?.scrollIntoView({ block: "nearest" });
  }, [updateSeq]);

  // ── State ────────────────────────────────────────────────────────────────

  const [name, setName] = useState(initialData?.name ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [tagline, setTagline] = useState(initialData?.tagline ?? "");
  const [programImage, setProgramImage] = useState(initialData?.programImage ?? "");
  // Lazy migration: convert legacy BlockNote JSON description to HTML on load.
  const [description, setDescription] = useState<string>(() => {
    const initial = initialData?.description;
    if (isHtmlString(initial)) return initial;
    return renderBlockNoteHtml(initial) || "";
  });
  const [pullQuote, setPullQuote] = useState(initialData?.pullQuote ?? "");
  const [pullQuoteSource, setPullQuoteSource] = useState(initialData?.pullQuoteSource ?? "");
  const [programNotes, setProgramNotes] = useState<string>(toEditorString(initialData?.programNotes));
  // No field shows this any more; it's sent as it was loaded.
  const [teacherFacilitatorsText] = useState(initialData?.teacherFacilitators?.join(", ") ?? "");
  const [selectedTeachers, setSelectedTeachers] = useState<TeacherItem[]>(initialData?.programTeachers ?? []);

  const [categoryId] = useState(initialData?.categoryId ?? "");
  const [offeringCategory, setOfferingCategory] = useState(initialData?.offeringCategory ?? "");
  const [offeringFormat, setOfferingFormat] = useState(initialData?.offeringFormat ?? "");
  const [silentMeditation, setSilentMeditation] = useState(initialData?.silentMeditation ?? false);
  const [hostedByVolunteers, setHostedByVolunteers] = useState(initialData?.hostedByVolunteers ?? false);
  const [openEntry, setOpenEntry] = useState(initialData?.openEntry ?? false);
  // dateText / timeText are server-computed on save (always recomputed from
  // start/end/recurrence). The editor mirrors them locally as a live preview.
  const [dateText, setDateText] = useState(initialData?.dateText ?? "");
  const [timeText, setTimeText] = useState(initialData?.timeText ?? "");

  const [programFormat, setProgramFormat] = useState(initialData?.programFormat ?? "in-person");
  const [venue, setVenue] = useState(initialData?.venue ?? "at-rim");
  const [locationText, setLocationText] = useState(initialData?.locationText ?? "");
  const [locationLink, setLocationLink] = useState(initialData?.locationLink ?? "");
  const [startDatetime, setStartDatetime] = useState(initialData?.startDatetime ?? "");
  const [endDatetime, setEndDatetime] = useState(initialData?.endDatetime ?? "");
  const [recurrenceFreq, setRecurrenceFreq] = useState(initialData?.recurrenceFreq ?? "");
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialData?.recurrenceInterval ?? "");
  const [recurrenceDays, setRecurrenceDays] = useState<string[]>(initialData?.recurrenceDays ?? []);
  const [recurrenceCount, setRecurrenceCount] = useState(initialData?.recurrenceCount ?? "");

  const [registrationEnabled, setRegistrationEnabled] = useState(initialData?.registrationEnabled ?? false);
  const [registrationClosed, setRegistrationClosed] = useState(initialData?.registrationClosed ?? false);
  // The mailing list (Flodesk) is set in the Registration app (2026-10-24), so
  // the editor neither shows nor sends it.
  const [registrationCapacity, setRegistrationCapacity] = useState(initialData?.registrationCapacity ?? "");
  const [registrationDeadline, setRegistrationDeadline] = useState(initialData?.registrationDeadline ?? "");
  const [registrationOpensAt, setRegistrationOpensAt] = useState(initialData?.registrationOpensAt ?? "");
  const [notYetPicked, setNotYetPicked] = useState(false);
  const [registrationFields, setRegistrationFields] = useState<RegistrationField[]>(
    initialData?.registrationFields ?? []
  );
  const [confirmationMessage, setConfirmationMessage] = useState<string>(toEditorString(initialData?.confirmationMessage));
  const [reminderDate, setReminderDate] = useState(initialData?.reminderDate ?? "");
  // Days before the first session (Phase 4): a new program starts at 2, or
  // as its shape says (lib/programShapes.ts; none for a drop-in).
  const [reminderDaysBefore, setReminderDaysBefore] = useState(isEditing ? initialData?.reminderDaysBefore ?? "" : initialData?.reminderDaysBefore ?? "2");
  // The reminder's timing chosen here (TellSection), kept while its box is
  // emptied to retype it; Save asks for the number.
  const [reminderModePicked, setReminderModePicked] = useState<"days" | "date" | "none" | null>(null);
  const [reminderMessage, setReminderMessage] = useState<string>(toEditorString(initialData?.reminderMessage));
  // The note after a one-time program ends (Phase 4, lib/followUp.ts).
  const [followUpEnabled, setFollowUpEnabled] = useState<boolean>(initialData?.followUpEnabled ?? false);
  const [followUpMessage, setFollowUpMessage] = useState<string>(toEditorString(initialData?.followUpMessage));

  const [danaMode, setDanaMode] = useState(initialData?.danaMode ?? "none");
  const [suggestedDana, setSuggestedDana] = useState(initialData?.suggestedDana ?? "");
  const [danaBaseAmount, setDanaBaseAmount] = useState(initialData?.danaBaseAmount ?? "");
  const [danaFixedAmount, setDanaFixedAmount] = useState(initialData?.danaFixedAmount ?? "");
  const [danaMessage, setDanaMessage] = useState<string>(toEditorString(initialData?.danaMessage));
  const [danaText, setDanaText] = useState(initialData?.danaText ?? "");

  // The notice is posted with Post a notice (NoticePanel), apart from Save,
  // so the editor neither holds nor sends it (2026-10-24).
  const [earlyArrivalMessage, setEarlyArrivalMessage] = useState(initialData?.earlyArrivalMessage ?? "");
  const [hideFromDashboard] = useState(initialData?.hideFromDashboard ?? false);

  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? "");
  const [removeFromProgramList, setRemoveFromProgramList] = useState(initialData?.removeFromProgramList ?? false);
  const [dashboardShowAt, setDashboardShowAt] = useState(initialData?.dashboardShowAt ?? "");
  const [hideFromProgramPageList, setHideFromProgramPageList] = useState(initialData?.hideFromProgramPageList ?? false);
  const [hideFromWeeklySchedule, setHideFromWeeklySchedule] = useState(initialData?.hideFromWeeklySchedule ?? false);
  const [hideWhenPast, setHideWhenPast] = useState(initialData?.hideWhenPast ?? true);

  const [isOpenAccess, setIsOpenAccess] = useState(initialData?.isOpenAccess ?? false);
  const [guestAccessKey, setGuestAccessKey] = useState(initialData?.guestAccessKey ?? "");

  // Hosting hub — which volunteer/peer-leader team hosts the live session
  // for this program. Empty string in state represents the "default (host-
  // team)" choice and serialises to null over the wire. Coordinator can
  // transfer hosting to a different hub under Who's helping; the mid-flight
  // warning fires when the choice changes and future HostAssignment rows
  // exist on this program.
  const initialHostingHubSlug = initialData?.hostingHubSlug ?? "";
  const [hostingHubSlug, setHostingHubSlug] = useState<string>(initialHostingHubSlug);

  // "No host needed" — self-led / community-led programs (Recovery Dharma,
  // drop-in groups). When true, this program is excluded from the Scheduler,
  // rotations, and host notifications. Stored as `hostingRequired` (the
  // inverse); the checkbox is phrased positively as "No host needed".
  const initialHostingRequired = initialData?.hostingRequired ?? true;
  const [hostingRequired, setHostingRequired] = useState<boolean>(initialHostingRequired);
  const [recordByDefault, setRecordByDefault] = useState<boolean>(initialData?.recordByDefault ?? false);
  // Where it meets online (2026-10-14): RIM's Zoom, or someone else's room. Only
  // the link is stored; the choice is derived from it.
  const [roomChoice, setRoomChoice] = useState<"rim" | "outside">(
    initialData?.outsideMeetingUrl ? "outside" : "rim",
  );
  const [outsideUrl, setOutsideUrl] = useState(initialData?.outsideMeetingUrl ?? "");
  const [outsidePublic, setOutsidePublic] = useState(initialData?.outsideMeetingPublic ?? false);
  const [outsideUrlError, setOutsideUrlError] = useState("");
  // Layer 2: Zoom seat conflicts returned by the save route (non-blocking warning).
  const [seatConflicts, setSeatConflicts] = useState<{ message: string; capacity: number }[]>([]);
  // What a schedule change cleared (sessions on days the program no longer
  // meets, and rotations for those weekdays), said beside Save (2026-10-16).
  const [scheduleCleared, setScheduleCleared] = useState<{ sessions: number; rotations: number } | null>(null);
  // Zoom meetings already made that kept the old name after a rename
  // (lib/programSave.ts, 2026-10-28), said at the top of the page.
  const [meetingsNotRenamed, setMeetingsNotRenamed] = useState(0);
  // Pick up the overlap warning from a just-created program (see the create
  // branch of save). Read once, then cleared.
  useEffect(() => {
    if (!isEditing || !initialData?.slug) return;
    // Just created (Jesse, 2026-10-26): said beside Save as the editor opens.
    try {
      const createdKey = `pe-created:${initialData.slug}`;
      if (sessionStorage.getItem(createdKey)) {
        sessionStorage.removeItem(createdKey);
        setJustCreated(true);
        setSuccess(true);
      }
    } catch {
      // Storage unavailable: the editor opening on the program says enough.
    }
    const key = `pe-seat-conflicts:${initialData.slug}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      sessionStorage.removeItem(key);
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSeatConflicts(parsed);
    } catch {
      // Unreadable or unavailable storage: nothing to show.
    }
  }, [isEditing, initialData?.slug]);

  // Auxiliary-hub coverage. A program's primary hub (hostingHubSlug above)
  // runs the live session; auxiliary hubs schedule supporting roles —
  // AV volunteer, greeters — for the in-person component. Each checked
  // slug here becomes a ProgramCoverageHub row on save.
  const [coverageHubSlugs, setCoverageHubSlugs] = useState<string[]>(
    initialData?.coverageHubSlugs ?? [],
  );
  // Teams that prepare (2026-10-24, lib/programHelpers.ts), sorted by team id.
  const [helperTeams, setHelperTeams] = useState<{ hubId: string; canReach: boolean }[]>(
    initialData?.helperTeams ?? [],
  );

  // Who may ask a registration question (lib/questionAskers.ts): the
  // registration team, the teacher when one is linked, and each supporting
  // team ticked under Who's helping that staffs this format.
  // A question given to the teacher before one is linked (a shape's, Phase 4)
  // keeps saying so, rather than showing the registration team; offered for
  // as long as the page is open once any question asked the teacher.
  const [startedAskingTeacher] = useState(() => (initialData?.registrationFields ?? []).some((f) => f.askedBy === ASKED_BY_TEACHER));
  const asksTeacher = startedAskingTeacher || registrationFields.some((f) => f.askedBy === ASKED_BY_TEACHER);
  const askerOptions = useMemo((): AskerOption[] => {
    const options: AskerOption[] = [{ value: ASKED_BY_REGISTRATION, label: "The registration team" }];
    if (selectedTeachers.length === 1) {
      const t = selectedTeachers[0];
      options.push({ value: ASKED_BY_TEACHER, label: `The teacher, ${`${t.firstName} ${t.lastName}`.trim()}` });
    } else if (selectedTeachers.length > 1) {
      options.push({ value: ASKED_BY_TEACHER, label: "The teachers" });
    } else if (asksTeacher) {
      options.push({ value: ASKED_BY_TEACHER, label: "The teacher, once one is chosen (the registration team until then)" });
    }
    for (const h of hubs) {
      if (
        coverageHubSlugs.includes(h.slug) && !h.hasSchedule && !!h.usesScheduler &&
        h.slug !== (hostingHubSlug || DEFAULT_HOSTING_HUB_SLUG) &&
        (h.appliesToFormats ?? []).includes(programFormat)
      ) {
        options.push({ value: askedByTeam(h.id), label: `The ${h.name}` });
      }
    }
    for (const h of helperTeams) {
      const team = prepTeams.find((t) => t.id === h.hubId);
      if (team && team.active !== false && !options.some((o) => o.value === askedByTeam(team.id))) {
        options.push({ value: askedByTeam(team.id), label: `The ${team.name}` });
      }
    }
    return options;
  }, [selectedTeachers, asksTeacher, hubs, coverageHubSlugs, hostingHubSlug, programFormat, helperTeams, prepTeams]);

  // ── Unsaved changes tracking ────────────────────────────────────────────
  const [dirty, setDirty] = useState(false);
  const [pendingNav, setPendingNav] = useState<string | null>(null);
  // The leave-without-saving dialog takes focus (Stay, its first button),
  // keeps Tab and Shift-Tab inside it, closes on Escape (= stay), and gives
  // focus back to whatever opened it.
  const leaveDialogRef = useNavigationDrawer(pendingNav !== null, () => setPendingNav(null));

  // A new edit after a save: "Saved" no longer describes the page. Stable
  // (no dependencies), so passing it never redraws a section.
  const markDirty = useCallback(() => { setDirty(true); setSuccess(false); }, []);
  // Any change inside the editor marks it unsaved, except moving around it
  // (the Jump to menu) and Post a notice, which saves on its own.
  const onEdit = useCallback((e: React.SyntheticEvent) => {
    if ((e.target as HTMLElement).closest?.("[data-pe-nav], [data-pe-separate]")) return;
    markDirty();
  }, [markDirty]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  /** Wrap navigation — if dirty, show confirmation instead of navigating */
  function guardedNavigate(href: string) {
    if (dirty) {
      setPendingNav(href);
    } else {
      router.push(href);
    }
  }

  // ── Where the reader is: the section nearest the top of the screen ───────
  const [currentSection, setCurrentSection] = useState<SectionId>("about");
  // The last section whose top has passed a line just under the site header.
  // (Asking which sections are in view marked the one above after a jump,
  // since its end was still showing.)
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: SectionId = SECTIONS[0].id;
      for (const s of SECTIONS) {
        const el = document.getElementById(sectionDomId(s.id));
        if (el && el.getBoundingClientRect().top <= 220) current = s.id;
      }
      setCurrentSection(current);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  const jumpTo = useCallback((id: SectionId, focus = true) => {
    setCurrentSection(id);
    goToSection(id, { focus });
  }, []);

  // Auto-generate slug from name
  useEffect(() => {
    // A copy keeps the free address it was given while its name is still the
    // original's (whose address that name makes), then follows its own.
    if (!isEditing && !slugTouched && name) {
      setSlug(copiedFrom && name === copiedFrom ? initialData?.slug ?? slugify(name) : slugify(name));
    }
  }, [name, isEditing, slugTouched, copiedFrom, initialData?.slug]);

  // Live preview only — server recomputes these on every save.
  useEffect(() => {
    const computed = computeDateText(startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval, endDatetime);
    setDateText(computed);
  }, [startDatetime, recurrenceFreq, recurrenceDays, recurrenceInterval, endDatetime]);

  useEffect(() => {
    const computed = computeTimeText(startDatetime, endDatetime);
    setTimeText(computed);
  }, [startDatetime, endDatetime]);

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSave() {
    await doSave();
  }

  // ── What a save sends: every field, in the save route's terms ──────────────
  function buildPayload(): Record<string, unknown> {
    return {
      // A copy keeps the original's mailing-list choice (set in the
      // Registration app, so the editor otherwise never sends it): without it
      // an original kept off the list would copy as on (review, 2026-10-24).
      ...(!isEditing && typeof initialData?.flodeskSync === "boolean" ? { flodeskSync: initialData.flodeskSync } : {}),
      name,
      slug,
      tagline,
      programImage: programImage || null,
      description,
      pullQuote: pullQuote.trim(),
      pullQuoteSource: pullQuoteSource.trim(),
      programNotes,
      teacherFacilitators: teacherFacilitatorsText
        ? teacherFacilitatorsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      teacherIds: selectedTeachers.map((t) => t.id),
      categoryId: categoryId || null,
      offeringCategory,
      offeringFormat,
      silentMeditation,
      hostedByVolunteers,
      openEntry,
      dateText,
      timeText,
      programFormat,
      venue,
      locationText,
      locationLink,
      startDatetime: startDatetime || null,
      endDatetime: endDatetime || null,
      recurrenceFreq: recurrenceFreq || null,
      recurrenceInterval: recurrenceInterval ? Number(recurrenceInterval) : null,
      recurrenceDays,
      recurrenceCount: recurrenceCount ? Number(recurrenceCount) : null,
      registrationEnabled,
      registrationClosed,
      registrationCapacity: registrationCapacity ? Number(registrationCapacity) : null,
      registrationDeadline: registrationDeadline || null,
      registrationOpensAt: registrationOpensAt || null,
      registrationFields: registrationFields.length > 0 ? registrationFields : null,
      confirmationMessage,
      reminderDate: reminderDate || null,
      reminderDaysBefore: reminderDaysBefore.trim() === "" ? null : Number(reminderDaysBefore),
      reminderMessage,
      followUpEnabled,
      followUpMessage,
      danaMode,
      suggestedDana: suggestedDana ? Number(suggestedDana) : null,
      danaBaseAmount: danaBaseAmount ? Number(danaBaseAmount) : null,
      danaFixedAmount: danaFixedAmount ? Number(danaFixedAmount) : null,
      danaMessage,
      danaText,
      earlyArrivalMessage,
      hideFromDashboard,
      dayOfWeek: deriveDayOfWeek(recurrenceFreq, recurrenceDays, startDatetime),
      sortOrder: sortOrder ? Number(sortOrder) : null,
      removeFromProgramList,
      dashboardShowAt: dashboardShowAt || null,
      hideFromProgramPageList,
      hideFromWeeklySchedule,
      hideWhenPast,
      isOpenAccess,
      // Empty string serialises as null (the implicit "host-team" default).
      // Server-side `getProgramHubSlug` falls through to host-team when null.
      hostingHubSlug: hostingHubSlug || null,
      // "No host needed" toggle (stored as the inverse). When false the
      // program is self-led and excluded from the Scheduler + rotations.
      hostingRequired,
      recordByDefault,
      // The outside room: empty means RIM's Zoom. Kept as stored for an
      // in-person program (readers ignore it there), so switching the format
      // back doesn't lose the link.
      // An in-person program keeps an unfinished link out of the save
      // (undefined leaves what is stored) rather than failing on a field
      // that isn't on screen.
      outsideMeetingUrl:
        roomChoice === "outside"
          ? (() => {
              const check = cleanOutsideMeetingUrl(outsideUrl);
              return check.ok ? check.value : undefined;
            })()
          : null,
      outsideMeetingPublic: roomChoice === "outside" && outsidePublic && !registrationEnabled,
      // Auxiliary hubs providing role coverage. Empty array means no
      // additional coverage. Server replaces the full set on each save.
      // Only ticked teams the list still shows: a team hidden by a format
      // change isn't sent, so it's unticked rather than refused
      // (2026-10-16 review).
      helperTeams: [...helperTeams].sort((a, b) => a.hubId.localeCompare(b.hubId)),
      coverageHubSlugs: coverageHubSlugs.filter((slug) => {
        const h = hubs.find((x) => x.slug === slug);
        return !!h && !h.hasSchedule && !!h.usesScheduler &&
          h.slug !== (hostingHubSlug || DEFAULT_HOSTING_HUB_SLUG) &&
          (h.appliesToFormats ?? []).includes(programFormat);
      }),
    };
  }
  // The payload as last saved (or as the page opened), and the program as the
  // save route then held it: a save sends only the difference, with each
  // changed field's value then (Phase 2 safe saves, 2026-10-24).
  const savedPayloadRef = useRef<Record<string, unknown> | null>(null);
  if (savedPayloadRef.current === null) savedPayloadRef.current = buildPayload();
  const loadedDataRef = useRef<ProgramData | null>(initialData ?? null);

  async function doSave() {
    setError("");
    setSuccess(false);

    // The quote is optional (2026-10-02): a program without one renders a
    // quote-less hero. A source cannot stand without its quote.
    // Problems are said beside Save, where the person is looking, naming the
    // section to go to (the page doesn't scroll away from the answer).
    if (!pullQuote.trim() && pullQuoteSource.trim()) {
      setError("Under About: a quote source needs its quote. Add the quote, or clear the source.");
      return;
    }

    // A copy starts without dates (lib/programCopy.ts): it needs its own.
    if (copiedFrom && !startDatetime) {
      setError("Under When and where: set this program’s dates. A copy starts without them.");
      return;
    }

    // Category is required; Format is required for the three ways (Foundations,
    // Ongoing Learning & Practice, Immersion) and optional otherwise.
    const offeringCheck = cleanOffering({ offeringCategory, offeringFormat, silentMeditation, hostedByVolunteers });
    if (!offeringCheck.ok) {
      setError(`Under Where it appears: ${offeringCheck.error}`);
      return;
    }

    // "Not open yet" needs a date still ahead; one already past would simply
    // be open.
    if (registrationEnabled && !registrationClosed && notYetPicked && !(registrationOpensAt && registrationOpensAt > nowCentral())) {
      setError("Under How people join: choose when registration opens, a date still ahead. Or choose Open.");
      return;
    }
    // It would close before it opened, and never be open.
    if (registrationEnabled && registrationOpensAt && registrationDeadline && registrationDeadline <= registrationOpensAt) {
      setError("Under How people join: the closing date comes before registration opens. Move one of them.");
      return;
    }

    // "Days before" needs its number (lib/reminderSchedule.ts).
    {
      const n = Number(reminderDaysBefore);
      const daysChosen = reminderModePicked === "days" || (reminderModePicked === null && reminderDaysBefore.trim() !== "");
      if (daysChosen && !(reminderDaysBefore.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 60)) {
        setError("Under Messages to those who register: choose how many days before the first session the reminder goes, from 1 to 60.");
        return;
      }
    }

    // The note after needs its words.
    if (followUpEnabled && !recurrenceFreq && !followUpMessage.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "").trim()) {
      setError("Under Messages to those who register: write the note sent after the program, or turn it off.");
      return;
    }

    // An outside room needs its link, and only an https link is kept.
    const outsideOnline =
      roomChoice === "outside" && (programFormat === "virtual" || programFormat === "hybrid");
    if (outsideOnline) {
      const check = cleanOutsideMeetingUrl(outsideUrl);
      const problem = !check.ok
        ? check.error
        : !check.value
          ? "Paste the outside meeting link, or choose RIM’s Zoom."
          : "";
      if (problem) {
        // Said under the link itself too, so take them there.
        setOutsideUrlError(problem);
        const field = document.getElementById("pe-outside-url");
        field?.scrollIntoView({ block: "center" });
        field?.focus({ preventScroll: true });
        setError(`Under When and where: ${problem}`);
        return;
      }
    }

    setSaving(true);

    try {
      const full = buildPayload();
      let payload: Record<string, unknown> = full;
      if (isEditing) {
        // Safe saves (2026-10-24): only what changed since the page opened (or
        // since the last save), each with its value then, so the save route
        // can refuse a field someone else changed meanwhile and keep theirs.
        const before = savedPayloadRef.current ?? {};
        // The date and time words are worked out by the server from the
        // schedule (it ignores what's sent), and by this page after it opens,
        // so they never count as a change.
        const changed = Object.keys(full).filter(
          (k) => k !== "dateText" && k !== "timeText" && JSON.stringify(full[k]) !== JSON.stringify(before[k]),
        );
        if (changed.length === 0) {
          setDirty(false);
          setSuccess(true);
          setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
          return;
        }
        payload = Object.fromEntries(changed.map((k) => [k, full[k]]));
        const loaded = loadedDataRef.current;
        if (loaded) {
          payload._base = Object.fromEntries(changed.map((k) => [k, editorFieldValue(loaded, k) ?? null]));
        }
      }

      const url = isEditing ? `/api/programs-pg/${initialData?.slug}` : "/api/programs-pg";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to save");
        return;
      }

      if (isEditing) {
        // Update guestAccessKey from response if it was generated
        const updated = await res.json();
        // The next save compares against this one.
        savedPayloadRef.current = full;
        if (updated.editorData) {
          loadedDataRef.current = updated.editorData as ProgramData;
          // Questions keep the ids the save gave them (lib/registrationFields.ts),
          // so a question added here and reworded before the page reloads keeps
          // its answers, and who asks each as the server kept it
          // (lib/questionAskers.ts drops a team no longer on the program).
          // Matched by position: the save keeps the order.
          const saved = ((updated.editorData as ProgramData).registrationFields ?? []) as RegistrationField[];
          const asSaved = (f: RegistrationField, i: number): RegistrationField => {
            const { askedBy: _drop, ...rest } = f;
            void _drop;
            return {
              ...rest,
              ...(f._key || saved[i]?._key ? { _key: f._key || saved[i]._key } : {}),
              ...(saved[i]?.askedBy ? { askedBy: saved[i].askedBy } : {}),
            };
          };
          if (Array.isArray(full.registrationFields) && full.registrationFields.length === saved.length) {
            const keyed = (full.registrationFields as RegistrationField[]).map(asSaved);
            savedPayloadRef.current = { ...full, registrationFields: keyed };
            setRegistrationFields((prev) => (prev.length === keyed.length ? prev.map(asSaved) : prev));
          }
        }
        if (updated.updateOffer) {
          const o = updated.updateOffer as { kinds: UpdateKind[]; count: number | null; lines?: Partial<Record<UpdateKind, string>> };
          setUpdateAnswer("");
          setUpdateOffer((prev) => ({
            kinds: UPDATE_KINDS.filter((k) => prev?.kinds.includes(k) || o.kinds.includes(k)),
            count: o.count,
            // Each kind this save changed takes this save's line, or none.
            lines: Object.fromEntries(
              UPDATE_KINDS.map((k) => [k, o.kinds.includes(k) ? o.lines?.[k] : prev?.lines[k]]).filter(([, v]) => v),
            ),
            programName: updated.name,
            slug: updated.slug,
            seq: updateSeq + 1,
          }));
          setUpdateSeq((n) => n + 1);
        }
        setSeatConflicts(updated.seatConflicts ?? []);
        setScheduleCleared(updated.scheduleCleared ?? null);
        setMeetingsNotRenamed(typeof updated.meetingsNotRenamed === "number" ? updated.meetingsNotRenamed : 0);
        if (updated.guestAccessKey && !guestAccessKey) {
          setGuestAccessKey(updated.guestAccessKey);
        }
        // Clear key if open access was disabled
        if (!isOpenAccess) {
          setGuestAccessKey("");
        }
        setDirty(false);
        // Saved: the menu now reads "Not open yet" from the date itself.
        setNotYetPicked(false);
        setSuccess(true);
        setSavedAt(new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        // The save went through this fetch, not through the router, so the
        // Next.js client router cache still holds the list page and this
        // edit page as they were rendered before it. Without a refresh,
        // "← Programs" or browser back shows the old values (Jesse saw a
        // program saved to Foundations listed as Immersion, 2026-10-09).
        router.refresh();
        // If slug changed, redirect to new URL
        if (slug !== initialData?.slug) {
          router.push(`${basePath}/${slug}/edit`);
        }
      } else {
        const created = await res.json();
        // The create response carries the overlap check too; hand it to the
        // edit page we're about to open, so a first save warns like later ones.
        if (Array.isArray(created.seatConflicts) && created.seatConflicts.length > 0) {
          try {
            sessionStorage.setItem(`pe-seat-conflicts:${created.slug}`, JSON.stringify(created.seatConflicts));
          } catch {
            // Storage unavailable: the warning appears on the next save instead.
          }
        }
        try {
          sessionStorage.setItem(`pe-created:${created.slug}`, "1");
        } catch {
          // Storage unavailable: no "Created" line, nothing else lost.
        }
        router.push(`${basePath}/${created.slug}/edit`);
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pe-editor pe-editor--sections" onChangeCapture={onEdit} onInputCapture={onEdit}>
      {/* ── Unsaved changes confirmation dialog ── */}
      {pendingNav && (
        <div className="pe-overlay" onClick={() => setPendingNav(null)}>
          <div
            ref={leaveDialogRef as RefObject<HTMLDivElement | null>}
            className="pe-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pe-leave-title"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="pe-dialog__text" id="pe-leave-title">You have unsaved changes. Leave without saving?</p>
            <div className="pe-dialog__actions">
              <button type="button" className="pe-btn pe-btn--primary" onClick={() => setPendingNav(null)}>
                Stay on this page
              </button>
              <button
                type="button"
                className="app-act"
                onClick={() => { setDirty(false); router.push(pendingNav); }}
              >
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pe-editor__header">
        <h2 className="pe-editor__title">{isEditing ? "Edit Program" : "New Program"}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginLeft: "auto" }}>
          {isEditing && slug && (
            <a href={`/programs/${slug}`} target="_blank" rel="noopener noreferrer" className="app-act">
              View program page →
            </a>
          )}
        </div>
      </div>

      {scheduleCleared && (
        <div className="pe-msg" role="status" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
          This program now meets on a different schedule.{" "}
          {scheduleCleared.sessions > 0 && (
            <>
              {scheduleCleared.sessions} upcoming {scheduleCleared.sessions === 1 ? "session" : "sessions"} on
              days it no longer meets {scheduleCleared.sessions === 1 ? "was" : "were"} cleared, and the people
              scheduled for them are emailed.{" "}
            </>
          )}
          {scheduleCleared.rotations > 0 && (
            <>
              {scheduleCleared.rotations} {scheduleCleared.rotations === 1 ? "rotation" : "rotations"} that
              no longer {scheduleCleared.rotations === 1 ? "fits" : "fit"} the schedule {scheduleCleared.rotations === 1 ? "was" : "were"} removed;
              set up the new days in the Scheduler&rsquo;s Rotations tab.
            </>
          )}
        </div>
      )}
      {meetingsNotRenamed > 0 && (
        <div className="pe-msg" role="status" style={{ background: "var(--color-warning-bg)", color: "var(--color-warning)" }}>
          The new name is saved. Zoom didn&rsquo;t take it yet for {meetingsNotRenamed === 1 ? "the session already set up" : `the ${meetingsNotRenamed} sessions already set up`},
          so {meetingsNotRenamed === 1 ? "it is" : "they are"} given the new name when the session opens.
        </div>
      )}
      {seatConflicts.length > 0 && (
        <div
          className="pe-msg"
          role="status"
          style={{
            background: "var(--color-warning-bg)",
            color: "var(--color-warning)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            alignItems: "flex-start",
          }}
        >
          <strong style={{ fontSize: "var(--text-ui)" }}>
            This overlaps other online sessions on Zoom
          </strong>
          {seatConflicts.map((c, i) => (
            <span key={i} style={{ fontSize: "var(--text-xs)", lineHeight: "var(--lh-body)" }}>
              {c.message}
            </span>
          ))}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--rim-mid)" }}>
            Your change was saved. If these sessions need to run at the same time,
            move one of them, or ask an administrator about adding a Zoom room.
            Otherwise, people joining the later one will find no room free.
          </span>
          <button
            type="button"
            className="app-act"
            onClick={() => setSeatConflicts([])}
          >
            Dismiss
          </button>
        </div>
      )}

      {copiedFrom && (
        <div className="pe-copied" role="note">
          <p className="pe-copied__title">A copy of {copiedFrom}</p>
          <p className="pe-copied__text">
            It keeps the words, questions, teachers, helpers, dana and settings. It starts without the dates,
            the people registered, the closing and opening dates, the notice and the guest link, and with its own address.
            Set the new dates under When and where; nothing is created until you save.
            {(initialData?.coverageHubSlugs ?? []).length > 0 ? " The teams under Teachers and teams are told when you save." : ""}
          </p>
        </div>
      )}

      {isEditing && initialData?.slug && (() => {
        // Where a notice shows (Jesse, 2026-10-26: only the lists the program
        // is on): Programs & Events by the editor's own listing rule; This
        // Week by its own (app/this-week/page.tsx); My Home on the program's
        // rows for those coming, teaching or helping that day.
        const onCatalog = listingReasonOf({
          isArchived: initialData?.archived ?? false,
          hideFromProgramPageList, offeringCategory,
          categoryHidden: !!categories.find((c) => c.id === categoryId)?.hidden,
          hideWhenPast, recurrenceFreq, startDatetime, endDatetime,
        }) === null;
        const onWeek = !(initialData?.archived ?? false) && !hideFromProgramPageList && !hideFromWeeklySchedule &&
          isPubliclyListedCategory(offeringCategory);
        const where = [
          "the program’s page",
          ...(onCatalog ? ["Programs & Events"] : []),
          ...(onWeek ? ["This Week"] : []),
          "My Home",
        ];
        const noticePlaces = `${where.slice(0, -1).join(", ")} and ${where[where.length - 1]}`;
        return (
        <NoticePanel
          slug={initialData.slug}
          // The notice as the public pages show it: one past its last day is
          // gone (the stored day is a Central "YYYY-MM-DD", read at noon UTC).
          initialNotice={activeAnnouncement({
            specialAnnouncement: initialData.specialAnnouncement,
            announcementUntil: initialData.announcementUntil ? `${initialData.announcementUntil}T12:00:00Z` : null,
          }) ?? ""}
          initialUntil={initialData.announcementUntil ?? ""}
          canEmail={canEmailRegistered}
          registeredCount={registeredCount}
          places={noticePlaces}
        />
        );
      })()}

      <ReadyPanel
        hasDescription={description.replace(/<[^>]+>/g, "").trim().length > 0}
        startDatetime={startDatetime} dateText={dateText} timeText={timeText} programFormat={programFormat}
        teacherNames={selectedTeachers.map((t) => `${t.firstName} ${t.lastName}`.trim()).join(", ")}
        hostingRequired={hostingRequired}
        registrationEnabled={registrationEnabled} registrationClosed={registrationClosed}
        registrationOpensAt={registrationOpensAt} notYetPicked={notYetPicked}
        registrationDeadline={registrationDeadline}
        registrationCapacity={registrationCapacity} questionCount={registrationFields.length}
        openEntry={openEntry} offeringCategory={offeringCategory}
        listingReason={listingReasonOf({
          isArchived: initialData?.archived ?? false,
          hideFromProgramPageList, offeringCategory,
          categoryHidden: !!categories.find((c) => c.id === categoryId)?.hidden,
          hideWhenPast, recurrenceFreq, startDatetime, endDatetime,
        })}
      />

      <div className="pe-layout">
        {/* The sections, beside the form on wide screens; Jump to on phones. */}
        <nav className="pe-index" aria-label="Sections of this program" data-pe-nav>
          <ol className="pe-index__list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${sectionDomId(s.id)}`}
                  className="pe-index__link"
                  aria-current={currentSection === s.id ? "location" : undefined}
                  onClick={(e) => { e.preventDefault(); jumpTo(s.id); }}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="pe-layout__main">
          <label className="pe-jump" data-pe-nav>
            <span className="pe-jump__label">Jump to</span>
            <select
              className="pe-select"
              value={currentSection}
              onChange={(e) => jumpTo(e.target.value as SectionId, false)}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
          </label>

          <AboutSection
            isEditing={isEditing}
            name={name} setName={setName}
            slug={slug} setSlug={setSlug} setSlugTouched={setSlugTouched}
            tagline={tagline} setTagline={setTagline}
            programImage={programImage} setProgramImage={setProgramImage} setError={setError}
            description={description} setDescription={setDescription}
            pullQuote={pullQuote} setPullQuote={setPullQuote}
            pullQuoteSource={pullQuoteSource} setPullQuoteSource={setPullQuoteSource}
            programNotes={programNotes} setProgramNotes={setProgramNotes}
            markDirty={markDirty}
          />

          <WhenWhereSection
            isEditing={isEditing} canManage={canManage} savedSlug={initialData?.slug ?? ""}
            programFormat={programFormat} setProgramFormat={setProgramFormat}
            venue={venue} setVenue={setVenue}
            locationText={locationText} setLocationText={setLocationText}
            locationLink={locationLink} setLocationLink={setLocationLink}
            earlyArrivalMessage={earlyArrivalMessage} setEarlyArrivalMessage={setEarlyArrivalMessage}
            startDatetime={startDatetime} setStartDatetime={setStartDatetime}
            endDatetime={endDatetime} setEndDatetime={setEndDatetime}
            recurrenceFreq={recurrenceFreq} setRecurrenceFreq={setRecurrenceFreq}
            recurrenceInterval={recurrenceInterval} setRecurrenceInterval={setRecurrenceInterval}
            recurrenceDays={recurrenceDays} setRecurrenceDays={setRecurrenceDays}
            recurrenceCount={recurrenceCount} setRecurrenceCount={setRecurrenceCount}
            dateText={dateText} timeText={timeText}
            roomChoice={roomChoice} setRoomChoice={setRoomChoice}
            outsideUrl={outsideUrl} setOutsideUrl={setOutsideUrl}
            outsideUrlError={outsideUrlError} setOutsideUrlError={setOutsideUrlError}
            outsidePublic={outsidePublic} setOutsidePublic={setOutsidePublic}
            registrationEnabled={registrationEnabled} openEntry={openEntry} noHostNeeded={!hostingRequired}
            recordByDefault={recordByDefault} setRecordByDefault={setRecordByDefault}
            isOpenAccess={isOpenAccess} setIsOpenAccess={setIsOpenAccess}
            guestAccessKey={guestAccessKey} setGuestAccessKey={setGuestAccessKey}
            markDirty={markDirty}
          />

          <HelpingSection
            isEditing={isEditing} hubs={hubs} programFormat={programFormat}
            futureHostAssignmentCount={futureHostAssignmentCount}
            selectedTeachers={selectedTeachers} setSelectedTeachers={setSelectedTeachers}
            hostingRequired={hostingRequired} setHostingRequired={setHostingRequired}
            initialHostingRequired={initialHostingRequired}
            hostingHubSlug={hostingHubSlug} setHostingHubSlug={setHostingHubSlug}
            initialHostingHubSlug={initialHostingHubSlug}
            coverageHubSlugs={coverageHubSlugs} setCoverageHubSlugs={setCoverageHubSlugs}
            prepTeams={prepTeams} helperTeams={helperTeams} setHelperTeams={setHelperTeams}
            canDecideAskers={canDecideAskers}
            markDirty={markDirty}
          />

          <JoinSection
            registrationEnabled={registrationEnabled} setRegistrationEnabled={setRegistrationEnabled}
            registrationClosed={registrationClosed} setRegistrationClosed={setRegistrationClosed}
            openEntry={openEntry} setOpenEntry={setOpenEntry}
            registrationCapacity={registrationCapacity} setRegistrationCapacity={setRegistrationCapacity}
            registrationDeadline={registrationDeadline} setRegistrationDeadline={setRegistrationDeadline}
            registrationOpensAt={registrationOpensAt} setRegistrationOpensAt={setRegistrationOpensAt}
            notYetPicked={notYetPicked} setNotYetPicked={setNotYetPicked}
            askerOptions={askerOptions}
            canDecideAskers={canDecideAskers}
            registrationFields={registrationFields} setRegistrationFields={setRegistrationFields}
            programFormat={programFormat} roomChoice={roomChoice} outsideUrl={outsideUrl}
            offeringCategory={offeringCategory} offeringFormat={offeringFormat}
            markDirty={markDirty}
          />

          <TellSection
            confirmationMessage={confirmationMessage} setConfirmationMessage={setConfirmationMessage}
            reminderDate={reminderDate} setReminderDate={setReminderDate}
            reminderDaysBefore={reminderDaysBefore} setReminderDaysBefore={setReminderDaysBefore}
            reminderModePicked={reminderModePicked} setReminderModePicked={setReminderModePicked}
            startDatetime={startDatetime}
            endDatetime={endDatetime} recurrenceFreq={recurrenceFreq}
            followUpEnabled={followUpEnabled} setFollowUpEnabled={setFollowUpEnabled}
            followUpMessage={followUpMessage} setFollowUpMessage={setFollowUpMessage}
            reminderMessage={reminderMessage} setReminderMessage={setReminderMessage}
            markDirty={markDirty}
          />

          <DanaSection
            danaMode={danaMode} setDanaMode={setDanaMode}
            suggestedDana={suggestedDana} setSuggestedDana={setSuggestedDana}
            danaBaseAmount={danaBaseAmount} setDanaBaseAmount={setDanaBaseAmount}
            danaFixedAmount={danaFixedAmount} setDanaFixedAmount={setDanaFixedAmount}
            danaMessage={danaMessage} setDanaMessage={setDanaMessage}
            danaText={danaText} setDanaText={setDanaText}
            markDirty={markDirty}
          />

          <AppearsSection
            canManage={canManage} categories={categories} categoryId={categoryId}
            offeringFromLegacy={initialData?.offeringFromLegacy ?? false}
            isArchived={initialData?.archived ?? false}
            offeringCategory={offeringCategory} setOfferingCategory={setOfferingCategory}
            offeringFormat={offeringFormat} setOfferingFormat={setOfferingFormat}
            silentMeditation={silentMeditation} setSilentMeditation={setSilentMeditation}
            hostedByVolunteers={hostedByVolunteers} setHostedByVolunteers={setHostedByVolunteers}
            sortOrder={sortOrder} setSortOrder={setSortOrder}
            hideFromProgramPageList={hideFromProgramPageList} setHideFromProgramPageList={setHideFromProgramPageList}
            hideFromWeeklySchedule={hideFromWeeklySchedule} setHideFromWeeklySchedule={setHideFromWeeklySchedule}
            hideWhenPast={hideWhenPast} setHideWhenPast={setHideWhenPast}
            removeFromProgramList={removeFromProgramList} setRemoveFromProgramList={setRemoveFromProgramList}
            dashboardShowAt={dashboardShowAt} setDashboardShowAt={setDashboardShowAt}
            openEntry={openEntry} programFormat={programFormat} recurrenceFreq={recurrenceFreq}
            startDatetime={startDatetime} endDatetime={endDatetime}
            markDirty={markDirty}
          />

          {/* ── Actions bar ── */}
          <div className="pe-actions">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name || !slug}
              className="pe-btn pe-btn--primary"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => guardedNavigate(basePath)}
              className="app-act"
            >
              Cancel
            </button>
            {/* The answer beside the button, and it stays (2026-10-19: it showed at
                the top of a long page for three seconds). */}
            <SaveNote status={saving ? "saving" : error ? "error" : success ? "saved" : "idle"} saved={justCreated && !savedAt ? `Created. It’s saved.${seatConflicts.length > 0 ? " Read the note at the top of the page." : ""}` : `Saved at ${savedAt}.${scheduleCleared || meetingsNotRenamed > 0 || seatConflicts.length > 0 ? " Read the note at the top of the page." : ""}${updateOffer ? " The people registered haven’t heard: see below." : ""}`} problem={error} />
          </div>
          {updateOffer && <UpdatePanel slug={updateOffer.slug} offer={updateOffer} onDone={closeUpdate} />}
          {updateAnswer && <p className="pe-update__done" role="status">{updateAnswer}</p>}
        </div>
      </div>
    </div>
  );
}
