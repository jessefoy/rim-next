/**
 * Saving a program (2026-10-28): the program editor's save, moved here from
 * PUT /api/programs-pg/[slug] unchanged so the RIM Guide saves through exactly
 * the same steps (app/api/guide-mcp/[key]/route.ts). Whoever calls it has
 * already decided the person may save; the person's roles still decide the
 * parts only the registration roles may change, as on the site.
 *
 * Answers with the status and body the route sends back.
 */

import { after } from "next/server";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { withQuestionIds } from "@/lib/registrationFields";
import { askersChanged, withAskers } from "@/lib/questionAskers";
import { checkHelperTeams, cleanHelperTeams, saveHelperTeams, type HelperTeamInput } from "@/lib/programHelpers";
import { countPlacesTaken } from "@/lib/registrationPlaces";
import { EDITOR_FIELD_LABELS, EDITOR_PROGRAM_INCLUDE, editorFieldValue, programToEditorData } from "@/lib/programEditorData";
import { db } from "@/lib/db";
import { clearCoverageNoLongerStaffed, clearOffScheduleCoverage, DEFAULT_HOSTING_HUB_SLUG, getProgramCoverageHubs, hostingTeamRefusal, supportingTeamRefusal } from "@/lib/programHub";
import { centralToUtc, toCentralDatetime } from "@/lib/timezone";
import { computeTimeText, computeDateText } from "@/lib/programUtils";
import { notifyHubOfNewProgramCoverage, sendCoverageClearedEmails, sendSessionsClearedEmail } from "@/lib/email";
import { applyProgramMeetingTopic, applyProgramRecordingSetting, teardownProgramMeetings } from "@/lib/sessionMeeting";
import { conflictsForProgram } from "@/lib/sessionConflicts";
import { EARLY_OPEN_MIN } from "@/lib/sessionWindowConstants";
import { cleanOffering, resolveOffering } from "@/lib/programOffering";
import { ctDateStr, parseAnnouncementUntil, shiftToDate } from "@/lib/scheduleUtils";
import { getFlodeskSegment } from "@/lib/flodesk";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { parseUntil, scheduleRefusal, type SchedulePart } from "@/lib/programSchedule";
import { normalizeLinkInput } from "@/lib/linkInput";
import { canUseProgramManager, canUseRegistration } from "@/lib/toolAuth";
import { emailLocationFor } from "@/lib/locations";
import { hasConcludedOneTime } from "@/lib/programUtils";
import { changedForPeople, updateLines, type UpdateProgram } from "@/lib/programUpdate";
import { renderBlockNoteHtml } from "@/lib/renderRichContent";

/** Who is saving: their id and roles, read for this request. */
export type SaveActor = { id: string; roles: readonly string[] };

/** What a save answers: the HTTP status and the body the editor reads. */
export type SaveReply = { status: number; body: Record<string, unknown> };

const reply = (payload: Record<string, unknown>, init?: { status?: number }): SaveReply => ({
  status: init?.status ?? 200,
  body: payload,
});

/**
 * Carry a program's new name to the copies of it: each registration's and
 * donation's, and the titles of its Zoom meetings that haven't ended.
 * Returns how many meetings Zoom wouldn't rename, so the person is told.
 */
async function applyProgramRename(programId: string, slugs: string[], name: string): Promise<number> {
  await db.registration.updateMany({
    where: { OR: [{ programId }, { programSlug: { in: slugs } }] },
    data: { programTitle: name },
  });
  await db.donation.updateMany({ where: { programId }, data: { programTitle: name } });
  try {
    return (await applyProgramMeetingTopic([...new Set(slugs)], name)).failed;
  } catch (e) {
    console.error("[programSave] renaming Zoom meetings failed", e);
    return 1;
  }
}

/** Save the fields the editor sent; see the route for the request's shape. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveProgram(actor: SaveActor, slug: string, body: any): Promise<SaveReply> {
  const existing = await db.program.findUnique({ where: { slug } });
  if (!existing) {
    return reply({ error: "Program not found" }, { status: 404 });
  }


  // Safe saves (2026-10-24, Phase 2). The editor sends only the fields that
  // changed, with `_base`: each one as it was when the editor opened. If
  // anyone has changed one of those same fields since (in another editor, or
  // in Registration's settings), nothing is saved and the editor says which.
  // Changes to other fields meanwhile are kept: they aren't in this save.
  const base = body._base && typeof body._base === "object" && !Array.isArray(body._base)
    ? (body._base as Record<string, unknown>)
    : null;
  delete body._base;
  if (base && Object.keys(base).length > 0) {
    const [now, coverageNow] = await Promise.all([
      db.program.findUnique({ where: { id: existing.id }, include: EDITOR_PROGRAM_INCLUDE }),
      db.programCoverageHub.findMany({ where: { programSlug: slug }, select: { hubSlug: true } }),
    ]);
    if (now) {
      const stored = programToEditorData(now, coverageNow.map((r) => r.hubSlug));
      const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      const changedMeanwhile = Object.keys(base).filter((k) => !same(editorFieldValue(stored, k), base[k]));
      if (changedMeanwhile.length > 0) {
        const names = [...new Set(changedMeanwhile.map((k) => EDITOR_FIELD_LABELS[k] ?? "a detail"))];
        const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
        return reply(
          {
            error: `Someone else changed ${list} since you opened this program, so nothing was saved. Your changes are still here. Reload the page to see theirs, then make yours again.`,
            conflict: true,
            fields: changedMeanwhile,
          },
          { status: 409 },
        );
      }
    }
  }

  // The pull quote is optional; a source cannot stand without its quote. Both
  // are resolved against what is stored when the request leaves one out.
  const resolvedPullQuote =
    body.pullQuote !== undefined
      ? (typeof body.pullQuote === "string" ? body.pullQuote.trim() : "")
      : existing.pullQuote?.trim() ?? "";
  const resolvedPullQuoteSource =
    body.pullQuoteSource !== undefined
      ? (typeof body.pullQuoteSource === "string" ? body.pullQuoteSource.trim() : "")
      : existing.pullQuoteSource?.trim() ?? "";
  if (resolvedPullQuoteSource && !resolvedPullQuote) {
    return reply({ error: "A quote source needs its quote." }, { status: 422 });
  }

  // Category and Format (lib/programOffering.ts). Checked only when the request
  // carries any of the four offering fields (the editor always does); a field
  // the request leaves out is taken from what is stored (or, for a program not
  // yet migrated, from what its old category means). Category is required, and
  // Format is required for the three ways.
  const touchesOffering = ["offeringCategory", "offeringFormat", "silentMeditation", "hostedByVolunteers"].some(
    (k) => body[k] !== undefined
  );
  let offeringData: Record<string, unknown> = {};
  if (touchesOffering) {
    const oldCategory = existing.categoryId
      ? await db.programCategory.findUnique({ where: { id: existing.categoryId }, select: { slug: true, kind: true } })
      : null;
    const stored = resolveOffering({ ...existing, category: oldCategory });
    const offering = cleanOffering({
      offeringCategory: body.offeringCategory !== undefined ? body.offeringCategory : stored.category,
      offeringFormat: body.offeringFormat !== undefined ? body.offeringFormat : stored.format,
      silentMeditation: body.silentMeditation !== undefined ? body.silentMeditation : stored.silentMeditation,
      hostedByVolunteers: body.hostedByVolunteers !== undefined ? body.hostedByVolunteers : stored.hostedByVolunteers,
    });
    if (!offering.ok) {
      return reply({ error: offering.error }, { status: 422 });
    }
    offeringData = offering.value;
  }

  // If slug is changing, check uniqueness
  if (body.slug && body.slug !== slug) {
    const conflict = await db.program.findUnique({ where: { slug: body.slug } });
    if (conflict) {
      return reply({ error: "A program with this slug already exists" }, { status: 409 });
    }
    // Registrations, the schedule and cover requests find their program by
    // its slug, so a program's address is permanent once any of them exist
    // (CLAUDE.md). Changing it here orphaned them all: the roster and CSV
    // emptied, reminders stopped, registrants lost Join (2026-10-19 audit).
    const [registrations, sessions, rotations, requests] = await Promise.all([
      db.registration.count({ where: { OR: [{ programSlug: slug }, { programId: existing.id }] } }),
      db.hostAssignment.count({ where: { programSlug: slug } }),
      db.standingAssignment.count({ where: { programSlug: slug } }),
      db.subRequest.count({ where: { programSlug: slug } }),
    ]);
    if (registrations + sessions + rotations + requests > 0) {
      return reply(
        { error: "This program's address can't change now: registrations or its schedule already use it. Keep the address, or make a new program." },
        { status: 409 },
      );
    }
  }

  const data: Record<string, unknown> = {};

  // Only update fields that are present in the request body
  if (body.name !== undefined) data.name = body.name;
  if (body.slug !== undefined) data.slug = body.slug;
  if (body.tagline !== undefined) data.tagline = body.tagline || null;
  if (body.programImage !== undefined) data.programImage = body.programImage || null;
  if (body.description !== undefined) data.description = body.description || undefined;
  if (body.pullQuote !== undefined) data.pullQuote = resolvedPullQuote || null;
  if (body.pullQuoteSource !== undefined) data.pullQuoteSource = resolvedPullQuoteSource || null;
  Object.assign(data, offeringData);
  // Open entry: its own setting (access without registering). Category and
  // Format never set it. A request that leaves it out leaves it as stored.
  if (body.openEntry !== undefined) {
    if (typeof body.openEntry !== "boolean") {
      return reply({ error: "Open entry must be on or off." }, { status: 422 });
    }
    data.openEntry = body.openEntry;
  }
  // Flodesk (mass email). flodeskSync: null = the default rule, true/false =
  // override. The segment link is sent only when the coordinator changed it
  // (so a save can't erase a segment created by a registration meanwhile);
  // its name is read from Flodesk, never from the request.
  if (body.flodeskSync !== undefined) {
    if (body.flodeskSync !== null && typeof body.flodeskSync !== "boolean") {
      return reply({ error: "The Flodesk setting must be default, on or off." }, { status: 422 });
    }
    data.flodeskSync = body.flodeskSync;
  }
  if (body.flodeskSegmentId !== undefined) {
    if (body.flodeskSegmentId === null || body.flodeskSegmentId === "") {
      data.flodeskSegmentId = null;
      data.flodeskSegmentName = null;
    } else {
      let segment: { id: string; name: string } | null;
      try {
        segment = await getFlodeskSegment(String(body.flodeskSegmentId));
      } catch {
        return reply({ error: "Flodesk didn't answer, so the changes weren't saved. Try again in a moment." }, { status: 503 });
      }
      if (!segment) {
        return reply({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
      }
      data.flodeskSegmentId = segment.id;
      data.flodeskSegmentName = segment.name;
    }
  }
  if (body.programNotes !== undefined) data.programNotes = body.programNotes || null;
  if (body.teacherFacilitators !== undefined) data.teacherFacilitators = body.teacherFacilitators;
  if (body.hostingHubSlug !== undefined) {
    // Empty string from the form (or the "Host Team (default)" option that
    // sends ""/null) normalises to null. Null is the implicit default and
    // resolves to "host-team" at read time via getProgramHubSlug.
    const raw = body.hostingHubSlug;
    const requestedSlug =
      typeof raw === "string" && raw.trim() ? raw.trim() : null;
    // Validate non-null slugs against the hub table to prevent orphan state
    // (typo / stale client / payload tampering). Null is always accepted.
    data.hostingHubSlug = requestedSlug;
  }
  // "No host needed" toggle. Default true; false = self-led (excluded from the
  // Scheduler + rotations + host notifications). Coerce to a real boolean.
  if (body.hostingRequired !== undefined) data.hostingRequired = body.hostingRequired !== false;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId || null;
  // dateText / timeText are server-computed below from the source fields,
  // so we ignore whatever the client sends here.
  if (body.programFormat !== undefined) {
    data.programFormat = body.programFormat;
    // (livekitRoom was set here for the retired LiveKit room; nothing reads it.)
  }
  // Teams that prepare (2026-10-24, lib/programHelpers.ts): a newly added team
  // must be active and have Helping with installed. Checked before any write.
  let helperTeams: HelperTeamInput[] | null = null;
  if (body.helperTeams !== undefined) {
    helperTeams = cleanHelperTeams(body.helperTeams);
    if (!helperTeams) return reply({ error: "The teams that prepare weren\u2019t understood. Reload the page and try again." }, { status: 422 });
    // Which teams prepare, and whether they can reach people, decides who
    // sees people's details: the registration roles only (2026-10-24;
    // Programs shows no one's details otherwise).
    if (!canUseRegistration(actor.roles)) {
      const stored = (await db.programHelper.findMany({ where: { programId: existing.id }, select: { hubId: true, canReach: true } }))
        .map((h) => ({ hubId: h.hubId, canReach: h.canReach }))
        .sort((a, b) => a.hubId.localeCompare(b.hubId));
      if (JSON.stringify(stored) !== JSON.stringify(helperTeams)) {
        return reply({ error: "Only the registration team can choose the teams that prepare, since they see who\u2019s coming. Nothing was saved." }, { status: 403 });
      }
    }
    const refusal = await checkHelperTeams(existing.id, helperTeams);
    if (refusal) return reply({ error: refusal }, { status: 422 });
  }
  // A newly ticked supporting team must be one that staffs this format (the
  // editor's rule, enforced here too; 2026-10-16 audit). Checked before any
  // write, so a refusal saves nothing. Teams already ticked are left to the
  // coverage cleanup.
  if (Array.isArray(body.coverageHubSlugs)) {
    const format = (data.programFormat ?? existing.programFormat) as string | null;
    const already = new Set((await db.programCoverageHub.findMany({ where: { programSlug: slug }, select: { hubSlug: true } })).map((r) => r.hubSlug));
    const asked = (body.coverageHubSlugs as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0);
    for (const hubSlug of asked.filter((h) => !already.has(h))) {
      const refusal = await supportingTeamRefusal(hubSlug, format);
      if (refusal) return reply({ error: refusal }, { status: 422 });
    }
  }
  // A Hosting team a program names must run sessions, have the Scheduler,
  // and staff the program's format (lib/programHub.ts hostingTeamRefusal;
  // 2026-10-15/16). Checked when the team, the format or "No host needed"
  // changes, so an unrelated edit still saves. The default (no team named:
  // the Hosting Team) isn't checked: an in-person program is simply hosted
  // by no one online.
  {
    const team = data.hostingHubSlug !== undefined ? (data.hostingHubSlug as string | null) : existing.hostingHubSlug;
    const format = (data.programFormat ?? existing.programFormat) as string | null;
    const needsHost = data.hostingRequired !== undefined ? data.hostingRequired !== false : existing.hostingRequired;
    const changed =
      (data.hostingHubSlug !== undefined && data.hostingHubSlug !== existing.hostingHubSlug) ||
      (data.programFormat !== undefined && data.programFormat !== existing.programFormat) ||
      (data.hostingRequired !== undefined && data.hostingRequired !== existing.hostingRequired);
    // With "No host needed" the team is still checked, without its format, as
    // the create route does; the edit skipped it, so an unknown team could be
    // stored (2026-10-19 audit).
    if (team && changed) {
      const refusal = await hostingTeamRefusal(team, needsHost ? format : null);
      if (refusal) return reply({ error: refusal }, { status: 422 });
    }
  }

  if (body.recordByDefault !== undefined) data.recordByDefault = body.recordByDefault !== false;
  // Outside room: https only, or empty for RIM's Zoom. A request that leaves
  // it out leaves it as stored. "Anyone may join from the public page" means
  // nothing without a link, so it is cleared with the link.
  if (body.outsideMeetingUrl !== undefined) {
    const outside = cleanOutsideMeetingUrl(body.outsideMeetingUrl);
    if (!outside.ok) {
      return reply({ error: outside.error }, { status: 422 });
    }
    data.outsideMeetingUrl = outside.value;
    if (!outside.value) data.outsideMeetingPublic = false;
  }
  if (body.outsideMeetingPublic !== undefined && data.outsideMeetingPublic === undefined) {
    if (typeof body.outsideMeetingPublic !== "boolean") {
      return reply({ error: "Public joining must be on or off." }, { status: 422 });
    }
    data.outsideMeetingPublic =
      body.outsideMeetingPublic &&
      !!(data.outsideMeetingUrl !== undefined ? data.outsideMeetingUrl : existing.outsideMeetingUrl);
  }
  if (body.venue !== undefined) data.venue = body.venue;
  if (body.locationText !== undefined) data.locationText = body.locationText || null;
  // Tidied like every link box: a bare "www.google.com/maps/…" gets https://.
  if (body.locationLink !== undefined) data.locationLink = normalizeLinkInput(body.locationLink ?? "") || null;
  if (body.startDatetime !== undefined) data.startDatetime = centralToUtc(body.startDatetime);
  if (body.endDatetime !== undefined) data.endDatetime = centralToUtc(body.endDatetime);
  if (body.recurrenceFreq !== undefined) data.recurrenceFreq = body.recurrenceFreq || null;
  if (body.recurrenceInterval !== undefined) data.recurrenceInterval = body.recurrenceInterval != null ? Number(body.recurrenceInterval) : null;
  if (body.recurrenceDays !== undefined) data.recurrenceDays = body.recurrenceDays;
  if (body.recurrenceCount !== undefined) data.recurrenceCount = body.recurrenceCount != null && body.recurrenceCount !== "" ? Number(body.recurrenceCount) : null;
  // A series that ends on a date (2026-10-28): "YYYY-MM-DD", Central.
  if (body.recurrenceUntil !== undefined) {
    const until = parseUntil(body.recurrenceUntil);
    if (until === undefined) return reply({ error: "Under When and where: the end date wasn't understood. Choose it again. Nothing was saved." }, { status: 422 });
    data.recurrenceUntil = until;
  }
  // The schedule can't mean something other than it says (lib/programSchedule.ts):
  // checked whenever this save changes it, on the schedule as it would be.
  const SCHEDULE_FIELDS: Record<string, SchedulePart> = {
    startDatetime: "start", endDatetime: "end", recurrenceFreq: "freq", recurrenceInterval: "interval",
    recurrenceDays: "days", recurrenceCount: "count", recurrenceUntil: "until",
  };
  if (Object.keys(SCHEDULE_FIELDS).some((f) => body[f] !== undefined)) {
    const freqNow = (data.recurrenceFreq !== undefined ? data.recurrenceFreq : existing.recurrenceFreq) as string | null;
    // Moving a repeating program's first session carries its end time along:
    // the end is the time each session ends, on the first session's day, and
    // the editor sends only the start when only the start changed.
    if (freqNow && data.startDatetime && body.endDatetime === undefined && existing.endDatetime) {
      const newDay = ctDateStr((data.startDatetime as Date).toISOString());
      if (ctDateStr(existing.endDatetime.toISOString()) !== newDay) {
        data.endDatetime = shiftToDate(existing.endDatetime.toISOString(), newDay);
      }
    }
    const changedParts = new Set(Object.entries(SCHEDULE_FIELDS).filter(([f]) => body[f] !== undefined).map(([, part]) => part));
    if (data.endDatetime !== undefined) changedParts.add("end");
    const pick = <T,>(f: string, stored: T): T => (data[f] !== undefined ? (data[f] as T) : stored);
    const startAt = pick<Date | null>("startDatetime", existing.startDatetime);
    const endAt = pick<Date | null>("endDatetime", existing.endDatetime);
    const untilAt = pick<Date | null>("recurrenceUntil", existing.recurrenceUntil);
    const refusal = scheduleRefusal(
      {
        start: startAt ? toCentralDatetime(startAt) : null,
        end: endAt ? toCentralDatetime(endAt) : null,
        freq: pick<string | null>("recurrenceFreq", existing.recurrenceFreq),
        interval: pick<number | null>("recurrenceInterval", existing.recurrenceInterval),
        days: pick<string[]>("recurrenceDays", existing.recurrenceDays),
        count: pick<number | null>("recurrenceCount", existing.recurrenceCount),
        until: untilAt ? ctDateStr(untilAt.toISOString()) : null,
      },
      { freq: existing.recurrenceFreq, interval: existing.recurrenceInterval },
      changedParts,
    );
    if (refusal) return reply({ error: refusal }, { status: 422 });
  }
  if (body.registrationEnabled !== undefined) data.registrationEnabled = body.registrationEnabled;
  if (body.registrationClosed !== undefined) data.registrationClosed = body.registrationClosed;
  if (body.registrationCapacity !== undefined) data.registrationCapacity = body.registrationCapacity != null ? Number(body.registrationCapacity) : null;
  // Places never fewer than the places taken (registered, and held while
  // paying), as in the Registration app's settings (2026-10-24).
  if (
    typeof data.registrationCapacity === "number" &&
    data.registrationCapacity !== existing.registrationCapacity
  ) {
    const taken = await countPlacesTaken(existing.id);
    if (data.registrationCapacity < taken) {
      return reply(
        // The number only for those who can open Registration: Programs shows no one's count.
        { error: canUseRegistration(actor.roles)
            ? `${taken} ${taken === 1 ? "place is" : "places are"} already taken, so Capacity can't be fewer than ${taken}. Nothing was saved.`
            : "Capacity can't be fewer than the places already taken. Nothing was saved." },
        { status: 422 },
      );
    }
  }
  if (body.registrationDeadline !== undefined) data.registrationDeadline = centralToUtc(body.registrationDeadline);
  // "Opens on" (2026-10-24): taking sign-ups from then (lib/registrationWindow.ts).
  if (body.registrationOpensAt !== undefined) data.registrationOpensAt = centralToUtc(body.registrationOpensAt);
  {
    // Never closing before it opens: it would never be open.
    const opens = (data.registrationOpensAt !== undefined ? data.registrationOpensAt : existing.registrationOpensAt) as Date | null;
    const closes = (data.registrationDeadline !== undefined ? data.registrationDeadline : existing.registrationDeadline) as Date | null;
    if (opens && closes && closes <= opens) {
      return reply({ error: "The closing date comes before registration opens. Move one of them. Nothing was saved." }, { status: 422 });
    }
  }
  // "Anyone may join from the public page" is never kept on a program that
  // takes registrations (the editor, this route, the page and /enter agree).
  if ((data.registrationEnabled ?? existing.registrationEnabled) === true) {
    data.outsideMeetingPublic = false;
  }
  // Each question keeps its id (lib/registrationFields.ts). Removing every
  // question clears them; `|| undefined` used to leave them in place.
  // Who asks each question (lib/questionAskers.ts) is kept only for a teacher,
  // a supporting team or a team that prepares, as the program has them after
  // this save. A team taken off hands its questions to the registration team
  // now, so adding it again later doesn't quietly bring them back.
  const teamsChange = Array.isArray(body.coverageHubSlugs) || helperTeams !== null;
  if (body.registrationFields !== undefined || (teamsChange && Array.isArray(existing.registrationFields))) {
    const coverageSlugs = Array.isArray(body.coverageHubSlugs)
      ? (body.coverageHubSlugs as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0)
      : (await db.programCoverageHub.findMany({ where: { programSlug: slug }, select: { hubSlug: true } })).map((r) => r.hubSlug);
    const teamIds = new Set([
      ...(coverageSlugs.length > 0
        ? (await db.hub.findMany({ where: { slug: { in: coverageSlugs } }, select: { id: true } })).map((h) => h.id)
        : []),
      ...(helperTeams ?? (await db.programHelper.findMany({ where: { programId: existing.id }, select: { hubId: true } }))).map((h) => h.hubId),
    ]);
    if (body.registrationFields !== undefined) {
      const keyed = withQuestionIds(body.registrationFields, existing.registrationFields);
      // Who asks a question decides who reads its answers: the registration
      // roles only (2026-10-24).
      if (keyed && !canUseRegistration(actor.roles) && askersChanged(keyed as { _key?: unknown; label?: unknown; askedBy?: unknown }[], existing.registrationFields)) {
        return reply({ error: "Only the registration team can choose who asks a question, since that decides who reads the answers. Nothing was saved." }, { status: 403 });
      }
      data.registrationFields = keyed
        ? (withAskers(keyed as Record<string, unknown>[], teamIds) as Prisma.InputJsonObject[])
        : Prisma.DbNull;
    } else {
      const stored = existing.registrationFields as Record<string, unknown>[];
      const kept = withAskers(stored, teamIds);
      if (JSON.stringify(kept) !== JSON.stringify(stored)) data.registrationFields = kept as Prisma.InputJsonObject[];
    }
  }
  if (body.confirmationMessage !== undefined) data.confirmationMessage = body.confirmationMessage || undefined;
  // The note after a program ends (lib/followUp.ts).
  if (body.followUpEnabled !== undefined) {
    if (typeof body.followUpEnabled !== "boolean") return reply({ error: "The note after must be on or off." }, { status: 422 });
    data.followUpEnabled = body.followUpEnabled;
  }
  if (body.followUpMessage !== undefined) data.followUpMessage = body.followUpMessage || Prisma.DbNull;
  if (body.reminderDate !== undefined) data.reminderDate = centralToUtc(body.reminderDate);
  // Reminders counted from the start (lib/reminderSchedule.ts): whole days, or none.
  if (body.reminderDaysBefore !== undefined) {
    const n = body.reminderDaysBefore;
    if (n !== null && !(typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 60)) {
      return reply({ error: "Under Messages to those who register: the reminder's days before must be a whole number from 1 to 60. Nothing was saved." }, { status: 422 });
    }
    data.reminderDaysBefore = n;
  }
  if (body.reminderMessage !== undefined) data.reminderMessage = body.reminderMessage || undefined;
  if (body.danaMode !== undefined) data.danaMode = body.danaMode;
  if (body.suggestedDana !== undefined) data.suggestedDana = body.suggestedDana != null ? Number(body.suggestedDana) : null;
  if (body.danaBaseAmount !== undefined) data.danaBaseAmount = body.danaBaseAmount != null ? Number(body.danaBaseAmount) : null;
  if (body.danaFixedAmount !== undefined) data.danaFixedAmount = body.danaFixedAmount != null ? Number(body.danaFixedAmount) : null;
  if (body.danaMessage !== undefined) data.danaMessage = body.danaMessage || null;
  if (body.danaText !== undefined) data.danaText = body.danaText || null;
  if (body.specialAnnouncement !== undefined) data.specialAnnouncement = body.specialAnnouncement || null;
  if (body.announcementUntil !== undefined) {
    const until = parseAnnouncementUntil(body.announcementUntil);
    if (until === undefined) {
      return reply({ error: "Show until needs a date, or leave it empty." }, { status: 422 });
    }
    data.announcementUntil = until;
  }
  if (body.earlyArrivalMessage !== undefined) data.earlyArrivalMessage = body.earlyArrivalMessage || null;
  if (body.hideFromDashboard !== undefined) data.hideFromDashboard = body.hideFromDashboard;
  if (body.dayOfWeek !== undefined) data.dayOfWeek = body.dayOfWeek;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder != null ? Number(body.sortOrder) : null;
  if (body.removeFromProgramList !== undefined) data.removeFromProgramList = body.removeFromProgramList;
  if (body.dashboardShowAt !== undefined) data.dashboardShowAt = centralToUtc(body.dashboardShowAt);
  if (body.hideFromProgramPageList !== undefined) data.hideFromProgramPageList = body.hideFromProgramPageList;
  if (body.hideFromWeeklySchedule !== undefined) data.hideFromWeeklySchedule = body.hideFromWeeklySchedule;
  if (body.hideWhenPast !== undefined) data.hideWhenPast = body.hideWhenPast;
  if (body.isOpenAccess !== undefined) {
    data.isOpenAccess = body.isOpenAccess;
    // Auto-generate guest key when enabling open access for the first time
    if (body.isOpenAccess && !existing.guestAccessKey) {
      data.guestAccessKey = randomBytes(6).toString("hex");
    }
    // Clear key when disabling. Only for the three roles (2026-10-24): for
    // anyone else turning guest access off and on keeps the same link, since
    // a new link is the role-only reset (the door still refuses it while off).
    if (!body.isOpenAccess && canUseProgramManager(actor.roles)) {
      data.guestAccessKey = null;
    }
  }

  // Recompute dateText / timeText from the merged source values (incoming
  // body fields override existing ones; everything else falls back to the
  // stored program). These are caches of the source fields and must be
  // refreshed on every save so they never drift.
  const startSource =
    body.startDatetime !== undefined
      ? body.startDatetime
      : toCentralDatetime(existing.startDatetime);
  // The end may have moved with the first session (above), not only by the body.
  const endSource =
    body.endDatetime !== undefined
      ? body.endDatetime
      : toCentralDatetime((data.endDatetime as Date | undefined) ?? existing.endDatetime);
  const freqSource =
    body.recurrenceFreq !== undefined ? body.recurrenceFreq : existing.recurrenceFreq;
  const daysSource =
    body.recurrenceDays !== undefined ? body.recurrenceDays : existing.recurrenceDays;
  const intervalSource =
    body.recurrenceInterval !== undefined
      ? body.recurrenceInterval
      : existing.recurrenceInterval;

  data.dateText = computeDateText(startSource, freqSource, daysSource, intervalSource, endSource) || null;
  data.timeText = computeTimeText(startSource, endSource) || null;

  // Detect hub transfer and run cleanup BEFORE program.update so the two
  // become a coherent unit. If cleanup throws (FK violation, network blip),
  // the transfer doesn't commit and the coordinator can retry. Doing the
  // update first and then cleaning up would mean a cleanup failure leaves
  // the program on the new hub with orphan rules on the old hub — exactly
  // the bug session 130 is fixing.
  //
  // Session 130: without this clause, transferring a program leaves the
  // rotation rules in the old hub. The cron walks them daily and keeps
  // re-creating HostAssignments under the old hubSlug — invisible in every
  // UI view but surfacing as ghost emails to hosts who can no longer manage
  // them. The heal_orphan_standing_assignments_v1 migration cleans up
  // existing damage; this clause prevents it from recurring.
  const oldHubSlug = existing.hostingHubSlug ?? "host-team";
  const newHubSlug =
    data.hostingHubSlug !== undefined
      ? ((data.hostingHubSlug as string | null) ?? "host-team")
      : oldHubSlug;
  const hubChanged = data.hostingHubSlug !== undefined && oldHubSlug !== newHubSlug;

  // Flip to "No host needed" (true→false): the program no longer carries
  // coverage, so its FUTURE assignments + rotations must be cleared too —
  // otherwise grandfathered rows surface as ghosts (a host's "open early as
  // host" on the dashboard, the cross-hub staffing view). Both a flip to
  // self-led and a hub transfer clear only the (old) HOSTING team's coverage:
  // "No host needed" concerns the host alone, and greeter / AV sign-ups stay,
  // since those teams still staff the program (RIM_Scheduler.md; 2026-10-15,
  // it had cleared every team's). Past rows stay as history. Self-led fires
  // only on the true→false edge.
  const becameSelfLed =
    data.hostingRequired === false && existing.hostingRequired === true;

  // Sessions the old hosting team loses here, to tell the people on them.
  const hostingCleared: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[] = [];
  let updated;
  if (hubChanged || becameSelfLed) {
    const futureCutoff = new Date(); // strictly future — past stays as history
    // Atomic: cleanup + program.update in one transaction. If anything
    // throws, both roll back together and the route returns 500.
    //
    // Deletion order: SubClaim → SubRequest → HostAssignment, then
    // StandingAssignment. SubRequest.assignmentId FK is Restrict, so the
    // SubRequest row must go before its HostAssignment. SubClaim cascades
    // on SubRequest delete but we delete explicitly for consistency with
    // /api/host/assignments/clear/route.ts.
    const assnWhere = becameSelfLed
      // Self-led: clear future-dated rows AND any legacy null-sessionDate
      // ("standing") rows — the dashboard treats null as "today," so leaving
      // them would re-surface a ghost "open early as host." Past-dated rows
      // (concrete history) stay.
      ? { programSlug: slug, hubSlug: oldHubSlug, OR: [{ sessionDate: null }, { sessionDate: { gte: futureCutoff } }] }
      : { programSlug: slug, hubSlug: oldHubSlug, sessionDate: { gte: futureCutoff } };
    const standingWhere = { programSlug: slug, hubSlug: oldHubSlug };

    updated = await db.$transaction(async (tx) => {
      const futureAssns = await tx.hostAssignment.findMany({
        where: assnWhere,
        select: { id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true },
      });
      hostingCleared.push(...futureAssns);
      const futureAssnIds = futureAssns.map((a) => a.id);

      if (futureAssnIds.length > 0) {
        await tx.subClaim.deleteMany({
          where: { request: { assignmentId: { in: futureAssnIds } } },
        });
        await tx.subRequest.deleteMany({
          where: { assignmentId: { in: futureAssnIds } },
        });
        await tx.hostAssignment.deleteMany({
          where: { id: { in: futureAssnIds } },
        });
      }

      await tx.standingAssignment.deleteMany({ where: standingWhere });

      return tx.program.update({ where: { slug }, data });
    });

    console.log(becameSelfLed ? "[program-self-led]" : "[program-transfer]", {
      programSlug: slug,
      ...(becameSelfLed
        ? { clearedHub: oldHubSlug, message: "the hosting team's future HostAssignments + rotations cleared (No host needed); greeter/AV kept" }
        : { from: oldHubSlug, to: newHubSlug, message: "orphan rules + future HostAssignments purged on old hub" }),
    });
  } else {
    updated = await db.program.update({ where: { slug }, data });
  }

  // Teams that prepare: the whole set the editor sent, saved right after the
  // program (by its id, so an address change can't drop them), before any
  // later step that can still refuse, so the questions they ask and the
  // teams themselves never disagree.
  if (helperTeams !== null) await saveHelperTeams(existing.id, helperTeams);

  // A new name reaches every copy of it (2026-10-28, Jesse: a rename must
  // come through everywhere, as if it were made once): the name each
  // registration and donation keeps (My Home, reminders, the update page, the
  // donation records) and the title of each Zoom meeting already made that
  // hasn't ended. Emails and notices already sent stay as they were sent, and
  // Flodesk can't rename a segment, so the mailing list keeps its first name.
  let meetingsNotRenamed = 0;
  if (typeof data.name === "string" && data.name !== existing.name) {
    meetingsNotRenamed = await applyProgramRename(existing.id, [slug, updated.slug], updated.name);
  }

  // ── Zoom meeting integrity on save (Layer 1) ────────────────────────────
  // Tear down this program's FUTURE Zoom meetings (fire-and-forget; past stays
  // as record) in two cases — they're recreated correctly on the next join:
  //   (a) leftVirtual   — the program went in-person, so it has no online room.
  //   (b) scheduleMoved — start/end/recurrence changed while still virtual or
  //       hybrid, so any already-provisioned meeting now sits at the OLD time.
  //       Left in place it lingers on its seat (a stale "busy" slot that can
  //       collide with another program) and on Zoom.
  const leftVirtual =
    data.programFormat === "in-person" &&
    (existing.programFormat === "virtual" || existing.programFormat === "hybrid");

  const fmtNow = (data.programFormat ?? existing.programFormat) as string;
  const stillVirtual = fmtNow === "virtual" || fmtNow === "hybrid";
  const ms = (d: Date | string | null | undefined) =>
    d == null ? null : (d instanceof Date ? d : new Date(d)).getTime();
  const sameDays = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();
  // Any change to when the program meets (also clears off-day coverage below).
  const scheduleChanged =
    (data.startDatetime !== undefined &&
      ms(data.startDatetime as Date | null) !== ms(existing.startDatetime)) ||
    (data.endDatetime !== undefined &&
      ms(data.endDatetime as Date | null) !== ms(existing.endDatetime)) ||
    (data.recurrenceFreq !== undefined &&
      (data.recurrenceFreq ?? null) !== (existing.recurrenceFreq ?? null)) ||
    (data.recurrenceInterval !== undefined &&
      (data.recurrenceInterval ?? null) !== (existing.recurrenceInterval ?? null)) ||
    (data.recurrenceCount !== undefined &&
      (data.recurrenceCount ?? null) !== (existing.recurrenceCount ?? null)) ||
    (data.recurrenceDays !== undefined &&
      !sameDays(data.recurrenceDays as string[], existing.recurrenceDays)) ||
    (data.recurrenceUntil !== undefined &&
      ms(data.recurrenceUntil as Date | null) !== ms(existing.recurrenceUntil));
  const scheduleMoved = stillVirtual && scheduleChanged;
  // Which DAYS it meets changed (not just the time of day): the start's
  // Central date, the pattern, or a one-time program's end date. A time-only
  // edit can't leave a session on a day the program no longer meets.
  const ctDay = (d: Date | string | null | undefined) =>
    d == null ? null : ctDateStr((d instanceof Date ? d : new Date(d)).toISOString());
  const recurringNow = (data.recurrenceFreq !== undefined ? data.recurrenceFreq : existing.recurrenceFreq) ?? null;
  const daysChanged =
    (data.startDatetime !== undefined && ctDay(data.startDatetime as Date | null) !== ctDay(existing.startDatetime)) ||
    (!recurringNow && data.endDatetime !== undefined && ctDay(data.endDatetime as Date | null) !== ctDay(existing.endDatetime)) ||
    (data.recurrenceFreq !== undefined && (data.recurrenceFreq ?? null) !== (existing.recurrenceFreq ?? null)) ||
    (data.recurrenceInterval !== undefined && (data.recurrenceInterval ?? null) !== (existing.recurrenceInterval ?? null)) ||
    (data.recurrenceCount !== undefined && (data.recurrenceCount ?? null) !== (existing.recurrenceCount ?? null)) ||
    (data.recurrenceDays !== undefined && !sameDays(data.recurrenceDays as string[], existing.recurrenceDays)) ||
    (data.recurrenceUntil !== undefined && ctDay(data.recurrenceUntil as Date | null) !== ctDay(existing.recurrenceUntil));

  // (c) slugChanged — meetings are keyed by slug. Move the rows to the new
  //     slug (the Zoom meetings themselves don't use it), so a session that is
  //     open right now keeps its one room instead of /enter opening a second.
  const slugChanged = !!body.slug && body.slug !== slug;
  if (slugChanged) {
    await db.sessionMeeting
      .updateMany({ where: { programSlug: slug }, data: { programSlug: updated.slug } })
      .catch((e) => console.error("[programs-pg] Zoom meeting slug move failed", e));
    // Its supporting teams follow it (a change is refused above once anything
    // else uses the address).
    // A stale row already under the new address would collide with the move.
    await db.programCoverageHub.deleteMany({ where: { programSlug: updated.slug } });
    await db.programCoverageHub.updateMany({ where: { programSlug: slug }, data: { programSlug: updated.slug } });
  }

  // (e) movedOutside — the program now meets in someone else's room, so the
  //     RIM meetings already made for it would only hold seats. Same teardown.
  const movedOutside =
    stillVirtual && !!data.outsideMeetingUrl && !existing.outsideMeetingUrl;

  if (leftVirtual || scheduleMoved || movedOutside) {
    after(async () => {
      try {
        const n = await teardownProgramMeetings(updated.slug, {
          futureOnly: true,
          // Don't delete a meeting whose entry window is already open — a host
          // could be staging in it. Those age out on the next save / via cleanup.
          notBefore: new Date(Date.now() + EARLY_OPEN_MIN * 60_000),
        });
        if (n > 0)
          console.log(
            `[programs-pg] tore down ${n} future Zoom meeting(s) for ${updated.slug} (${leftVirtual ? "left virtual/hybrid" : movedOutside ? "moved to an outside room" : "schedule changed"})`,
          );
      } catch (e) {
        console.error("[programs-pg] Zoom teardown error:", e);
      }
    });
  }

  // (d) Record changed — apply it to meetings already provisioned for this
  //     program that haven't ended (a meeting keeps the setting it was created
  //     with otherwise). Skipped when those meetings are being torn down.
  if (
    stillVirtual &&
    !scheduleMoved &&
    data.recordByDefault !== undefined &&
    data.recordByDefault !== existing.recordByDefault
  ) {
    const recordToCloud = data.recordByDefault === true;
    after(async () => {
      try {
        const n = await applyProgramRecordingSetting(updated.slug, recordToCloud);
        if (n > 0)
          console.log(`[programs-pg] set recording ${recordToCloud ? "on" : "off"} for ${n} existing Zoom meeting(s) of ${updated.slug}`);
      } catch (e) {
        console.error("[programs-pg] Zoom recording update error:", e);
      }
    });
  }

  // Handle teacher assignments if provided
  if (body.teacherIds !== undefined) {
    const teacherIds: string[] = body.teacherIds ?? [];
    // Delete existing assignments and recreate in order
    await db.programTeacher.deleteMany({ where: { programId: updated.id } });
    if (teacherIds.length > 0) {
      await db.programTeacher.createMany({
        data: teacherIds.map((userId: string, index: number) => ({
          programId: updated.id,
          userId,
          order: index,
        })),
      });
    }
  }

  // Auxiliary-hub coverage (session 129). Full-replace semantics: the
  // client sends the complete desired set; we delete all existing rows
  // for this program and recreate. Slugs are validated against existing
  // hubs to prevent orphan rows from stale or tampered payloads.
  // Teams a covering-team change left out (for the coverage cleanup below).
  let removedCoverage: string[] = [];
  if (body.coverageHubSlugs !== undefined) {
    const requestedSlugs: string[] = Array.isArray(body.coverageHubSlugs)
      ? body.coverageHubSlugs.filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
      : [];
    if (requestedSlugs.length > 0) {
      const validHubs = await db.hub.findMany({
        where: { slug: { in: requestedSlugs } },
        select: { slug: true },
      });
      const validSlugs = new Set(validHubs.map((h) => h.slug));
      const unknown = requestedSlugs.filter((s) => !validSlugs.has(s));
      if (unknown.length > 0) {
        return reply(
          { error: `Unknown auxiliary hub(s): ${unknown.join(", ")}` },
          { status: 422 },
        );
      }
    }
    // Diff BEFORE the full-replace so we notify only hubs that are NEWLY
    // covering this program — not on every save (session 146 follow-on:
    // every hub gets the same new-coverage heads-up the host team gets).
    const existingRows = await db.programCoverageHub.findMany({
      where: { programSlug: slug },
      select: { hubSlug: true },
    });
    const existingSet = new Set(existingRows.map((r) => r.hubSlug));
    removedCoverage = [...existingSet].filter((h) => !requestedSlugs.includes(h));

    // Under the program's slug as saved: the old address, when it just
    // changed, was dropping the supporting teams (2026-10-19 audit).
    await db.programCoverageHub.deleteMany({ where: { programSlug: { in: [slug, updated.slug] } } });
    if (requestedSlugs.length > 0) {
      await db.programCoverageHub.createMany({
        data: requestedSlugs.map((hubSlug) => ({ programSlug: updated.slug, hubSlug })),
      });
    }

    const addedSlugs = requestedSlugs.filter((s) => !existingSet.has(s));
    if (addedSlugs.length > 0) {
      after(async () => {
        try {
          for (const hubSlug of addedSlugs) {
            await notifyHubOfNewProgramCoverage({
              hubSlug,
              programName: updated.name,
              programFormat: updated.programFormat,
              excludeUserId: actor.id,
            });
          }
        } catch (e) {
          console.error("[programs-pg] coverage-add notification error:", e);
        }
      });
    }
  }

  // A new start time moves every future assignment to the new time on its
  // own day, with its cover request, so "who is hosting this session" still
  // finds the assigned person (2026-10-15: assignments kept the old time, and
  // the Zoom door, which matches the exact start, no longer found the host).
  const startMoved =
    data.startDatetime !== undefined &&
    !!updated.startDatetime &&
    ms(data.startDatetime as Date | null) !== ms(existing.startDatetime);
  if (startMoved) {
    try {
      const newStartIso = updated.startDatetime!.toISOString();
      const future = await db.hostAssignment.findMany({
        where: { programSlug: updated.slug, sessionDate: { gte: new Date() } },
        select: { id: true, sessionDate: true },
      });
      const moves = future
        .map((a) => ({ id: a.id, from: a.sessionDate!, to: shiftToDate(newStartIso, ctDateStr(a.sessionDate!.toISOString())) }))
        .filter((m) => m.to.getTime() !== m.from.getTime());
      if (moves.length) {
        await db.$transaction(
          moves.flatMap((m) => [
            db.hostAssignment.update({ where: { id: m.id }, data: { sessionDate: m.to } }),
            db.subRequest.updateMany({ where: { assignmentId: m.id, sessionDate: m.from }, data: { sessionDate: m.to } }),
          ]),
        );
        console.log(`[programs-pg] ${updated.slug}: moved ${moves.length} future assignment(s) to the new start time`);
      }
    } catch (e) {
      console.error("[programs-pg] re-timing assignments failed", e);
    }
  }

  // Tell the people the hosting change took off sessions (2026-10-16 audit).
  if (hostingCleared.length) {
    const programName = updated.name;
    after(() =>
      sendCoverageClearedEmails({
        rows: hostingCleared,
        reason: (team) => becameSelfLed
          ? `${programName} no longer needs anyone from the ${team}.`
          : `${programName} is now covered by another team.`,
        excludeUserId: actor.id,
      }),
    );
  }

  // A team newly responsible for running this program hears about it, as a
  // newly ticked supporting team does (2026-10-16 audit): the program moved
  // to it, began needing a host again, or moved into a format it staffs.
  {
    const formats = new Map(
      (await db.hub.findMany({ where: { slug: { in: [oldHubSlug, newHubSlug] } }, select: { slug: true, appliesToFormats: true } }))
        .map((h) => [h.slug, h.appliesToFormats]),
    );
    const staffedBefore = existing.hostingRequired && (formats.get(oldHubSlug) ?? []).includes(existing.programFormat ?? "");
    const staffedAfter = updated.hostingRequired && (formats.get(newHubSlug) ?? []).includes(updated.programFormat ?? "");
    if (staffedAfter && (hubChanged || !staffedBefore)) {
      const programName = updated.name, programFormat = updated.programFormat;
      after(async () => {
        try {
          await notifyHubOfNewProgramCoverage({ hubSlug: newHubSlug, programName, programFormat, excludeUserId: actor.id });
        } catch (e) {
          console.error("[programs-pg] new hosting team notification error:", e);
        }
      });
    }
  }

  // A team that no longer staffs this program (unticked, or the format left
  // its set) loses its future coverage, so no sign-ups or rotation emails go
  // out for sessions nobody on that team can see (2026-10-15 audit).
  // Judged only for the teams this save changed: a team unticked, the old
  // hosting team, or every staffing team when the format changed.
  try {
    const affected = new Set<string>(removedCoverage);
    if (hubChanged) affected.add(oldHubSlug);
    if (data.programFormat !== undefined && data.programFormat !== existing.programFormat) {
      affected.add(oldHubSlug);
      affected.add(updated.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG);
      for (const h of await getProgramCoverageHubs(updated.slug)) affected.add(h);
    }
    const cleared = await clearCoverageNoLongerStaffed(updated.slug, [...affected]);
    for (const c of cleared) {
      console.log(`[programs-pg] ${updated.slug}: cleared ${c.assignments} future assignment(s) and ${c.rotations} rotation(s) on ${c.hubSlug}, which no longer staffs it`);
    }
    const clearedRows = cleared.flatMap((c) => c.rows);
    if (clearedRows.length) {
      const programName = updated.name;
      after(() =>
        sendCoverageClearedEmails({
          rows: clearedRows,
          reason: (team) => `The ${team} no longer covers ${programName}.`,
          excludeUserId: actor.id,
        }),
      );
    }
  } catch (e) {
    console.error("[programs-pg] coverage cleanup failed", e);
  }

  // A schedule change (start date, days, frequency, count, or a one-time
  // program's end) can leave sessions on days the program no longer meets.
  // They are cleared, with rotations set for those weekdays, and the people
  // who had them are told (Jesse, 2026-10-16: "they should be cleared").
  // The editor shows what was cleared beside its Save.
  let scheduleCleared: { sessions: number; rotations: number } | null = null;
  if (daysChanged) {
    try {
      const result = await clearOffScheduleCoverage(updated.slug);
      if (result.sessions.length || result.rotations) {
        scheduleCleared = { sessions: result.sessions.length, rotations: result.rotations };
        console.log(`[programs-pg] ${updated.slug}: schedule changed; cleared ${result.sessions.length} session(s) and ${result.rotations} rotation(s) on days it no longer meets`);
        const byPerson = new Map<string, { userId: string; hubSlug: string; dates: Date[] }>();
        for (const c of result.sessions) {
          if (!c.userId) continue;
          const key = `${c.userId}::${c.hubSlug}`;
          const entry = byPerson.get(key) ?? { userId: c.userId, hubSlug: c.hubSlug, dates: [] };
          entry.dates.push(c.sessionDate);
          byPerson.set(key, entry);
        }
        const programName = updated.name;
        after(async () => {
          for (const p of byPerson.values()) {
            try {
              const user = await db.user.findUnique({ where: { id: p.userId }, select: { email: true, firstName: true, archivedAt: true } });
              if (!user?.email || user.archivedAt) continue;
              await sendSessionsClearedEmail({ to: user.email, firstName: user.firstName, programName, sessionDates: p.dates, hubSlug: p.hubSlug });
            } catch (e) {
              console.error("[programs-pg] sessions-cleared email failed", e);
            }
          }
        });
      }
    } catch (e) {
      console.error("[programs-pg] clearing off-schedule sessions failed", e);
    }
  }

  // Layer 2: surface any Zoom seat conflict this schedule creates with other
  // virtual/hybrid programs (non-blocking — the coordinator decides what to do).
  const seatConflicts = stillVirtual
    ? await conflictsForProgram(updated.slug).catch((e) => {
        console.error("[programs-pg] seat-conflict check failed", e);
        return [];
      })
    : [];

  // The program as the editor now holds it, so its next save compares against
  // this save rather than against when the page opened.
  const [forEditor, coverageAfter] = await Promise.all([
    db.program.findUnique({ where: { id: updated.id }, include: EDITOR_PROGRAM_INCLUDE }),
    db.programCoverageHub.findMany({ where: { programSlug: updated.slug }, select: { hubSlug: true } }),
  ]);
  const editorData = forEditor ? programToEditorData(forEditor, coverageAfter.map((r) => r.hubSlug)) : null;

  // Send an update to the people registered (Phase 4 slice 3,
  // lib/programUpdate.ts): when the time, the place or the confirmation
  // message changed and people have a place, offer a drafted update. The
  // count and the draft only for those who may send it (Registration's
  // Message people); anyone else is told the people registered haven't heard.
  let updateOffer: { kinds: string[]; count: number | null; lines?: Record<string, string> } | null = null;
  if (!updated.archivedAt && !hasConcludedOneTime(updated)) {
    const asUpdate = (p: typeof existing): UpdateProgram => ({
      startDatetime: p.startDatetime, endDatetime: p.endDatetime,
      recurrenceFreq: p.recurrenceFreq, recurrenceInterval: p.recurrenceInterval,
      recurrenceDays: p.recurrenceDays, recurrenceCount: p.recurrenceCount, recurrenceUntil: p.recurrenceUntil,
      programFormat: p.programFormat, place: emailLocationFor(p).emailText,
      // An older message (BlockNote JSON) as HTML, so the first save of it
      // in the new editor isn't taken for a change.
      confirmationMessage: renderBlockNoteHtml(p.confirmationMessage),
    });
    const kinds = changedForPeople(asUpdate(existing), asUpdate(updated));
    if (kinds.length > 0) {
      const placed = await db.registration.findMany({
        where: { programSlug: updated.slug, status: { in: ["REGISTERED", "APPROVED"] } },
        select: { email: true },
      });
      const count = new Set(placed.map((r) => r.email.trim().toLowerCase())).size;
      if (count > 0) {
        updateOffer = canUseRegistration(actor.roles)
          ? { kinds, count, lines: updateLines({ ...asUpdate(updated), dateText: updated.dateText, timeText: updated.timeText }, kinds, asUpdate(existing)) as Record<string, string> }
          : { kinds, count: null };
      }
    }
  }

  return reply({ ...updated, seatConflicts, scheduleCleared, editorData, updateOffer, meetingsNotRenamed });
}

/**
 * Creating a program (2026-10-28): the editor's create, moved here from POST
 * /api/programs-pg unchanged, so the RIM Guide creates through the same
 * steps. Answers 201 with the new program.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProgram(actor: SaveActor, body: any): Promise<SaveReply> {
  const { name, slug } = body;

  if (!name || !slug) {
    return reply({ error: "Name and slug are required" }, { status: 400 });
  }
  // The schedule can't mean something other than it says (lib/programSchedule.ts).
  const createUntil = parseUntil(body.recurrenceUntil);
  if (createUntil === undefined) return reply({ error: "Under When and where: the end date wasn't understood. Choose it again. Nothing was saved." }, { status: 422 });
  const createRefusal = scheduleRefusal({
    start: body.startDatetime || null,
    end: body.endDatetime || null,
    freq: body.recurrenceFreq || null,
    interval: body.recurrenceInterval != null && body.recurrenceInterval !== "" ? Number(body.recurrenceInterval) : null,
    days: Array.isArray(body.recurrenceDays) ? body.recurrenceDays : [],
    count: body.recurrenceCount != null && body.recurrenceCount !== "" ? Number(body.recurrenceCount) : null,
    until: createUntil ? ctDateStr(createUntil.toISOString()) : null,
  });
  if (createRefusal) return reply({ error: createRefusal }, { status: 422 });
  // The pull quote is optional; a source cannot stand without its quote.
  const pullQuote = typeof body.pullQuote === "string" ? body.pullQuote.trim() : "";
  const pullQuoteSource = typeof body.pullQuoteSource === "string" ? body.pullQuoteSource.trim() : "";
  if (pullQuoteSource && !pullQuote) {
    return reply({ error: "A quote source needs its quote." }, { status: 422 });
  }

  // Category is required; Format is required for the three ways and optional
  // otherwise (lib/programOffering.ts). The editor sends both; so must any caller.
  const offering = cleanOffering(body);
  if (!offering.ok) {
    return reply({ error: offering.error }, { status: 422 });
  }

  // The Update's clear-by day: a "YYYY-MM-DD" or nothing.
  const announcementUntil = parseAnnouncementUntil(body.announcementUntil);
  if (announcementUntil === undefined) {
    return reply({ error: "Show until needs a date, or leave it empty." }, { status: 422 });
  }

  // An outside room's link: https only, or empty for RIM's Zoom.
  const outsideMeeting = cleanOutsideMeetingUrl(body.outsideMeetingUrl);
  if (!outsideMeeting.ok) {
    return reply({ error: outsideMeeting.error }, { status: 422 });
  }

  const existing = await db.program.findUnique({ where: { slug } });
  if (existing) {
    return reply({ error: "A program with this slug already exists" }, { status: 409 });
  }

  // Validate `hostingHubSlug` against the hub table when supplied. Null /
  // empty stays the default (host-team). Prevents orphan state where a
  // typo or stale client writes a slug that doesn't resolve to any hub —
  // schedule filtering would silently return zero programs, and the
  // hub-grants-teacher path would degrade quietly.
  const requestedHostingHubSlug =
    typeof body.hostingHubSlug === "string" && body.hostingHubSlug.trim()
      ? body.hostingHubSlug.trim()
      : null;
  // Each supporting team must be one that staffs this format (the editor's
  // rule, enforced here too; 2026-10-16 audit), checked before the program is
  // created so a refusal leaves nothing behind.
  if (Array.isArray(body.coverageHubSlugs)) {
    for (const hubSlug of (body.coverageHubSlugs as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0)) {
      const refusal = await supportingTeamRefusal(hubSlug, body.programFormat || "in-person");
      if (refusal) return reply({ error: refusal }, { status: 422 });
    }
  }
  // Reminders counted from the start (lib/reminderSchedule.ts): whole days, or none.
  if (body.reminderDaysBefore != null && !(typeof body.reminderDaysBefore === "number" && Number.isInteger(body.reminderDaysBefore) && body.reminderDaysBefore >= 1 && body.reminderDaysBefore <= 60)) {
    return reply({ error: "Under Messages to those who register: the reminder's days before must be a whole number from 1 to 60." }, { status: 422 });
  }
  // Teams that prepare (lib/programHelpers.ts), checked before anything is created.
  const createHelpers = body.helperTeams !== undefined ? cleanHelperTeams(body.helperTeams) : [];
  if (!createHelpers) return reply({ error: "The teams that prepare weren\u2019t understood. Reload the page and try again." }, { status: 422 });
  {
    const refusal = await checkHelperTeams(null, createHelpers);
    if (refusal) return reply({ error: refusal }, { status: 422 });
  }
  // Who asks each question (lib/questionAskers.ts): kept only for a teacher,
  // a supporting team or a team that prepares that the program is created with.
  const createTeamSlugs = Array.isArray(body.coverageHubSlugs)
    ? (body.coverageHubSlugs as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    : [];
  const createTeamIds = new Set(
    createTeamSlugs.length > 0
      ? (await db.hub.findMany({ where: { slug: { in: createTeamSlugs } }, select: { id: true } })).map((h) => h.id)
      : [],
  );
  for (const h of createHelpers) createTeamIds.add(h.hubId);
  const createQuestions = withQuestionIds(body.registrationFields, null);
  // Who asks a question, and which teams prepare, decide who sees people's
  // answers and details: the registration roles only (2026-10-24).
  if (!canUseRegistration(actor.roles) && (createHelpers.length > 0 || (createQuestions && askersChanged(createQuestions as { _key?: unknown; label?: unknown; askedBy?: unknown }[], null)))) {
    return reply({ error: "Only the registration team can choose who asks a question or which teams prepare, since that decides who sees people\u2019s answers. Nothing was saved." }, { status: 403 });
  }
  // As the edit route does: Open entry is on or off, not coerced (2026-10-19).
  if (body.openEntry !== undefined && typeof body.openEntry !== "boolean") {
    return reply({ error: "Open entry must be on or off." }, { status: 422 });
  }
  if (requestedHostingHubSlug) {
    // A Hosting team must run sessions and have the Scheduler (2026-10-15).
    const refusal = await hostingTeamRefusal(requestedHostingHubSlug, body.hostingRequired === false ? null : (body.programFormat ?? null));
    if (refusal) return reply({ error: refusal }, { status: 422 });
  }

  // Flodesk (mass email), as on the PUT: null = the default rule; a linked
  // segment is verified with Flodesk and named from it, never the request.
  if (body.flodeskSync != null && typeof body.flodeskSync !== "boolean") {
    return reply({ error: "The Flodesk setting must be default, on or off." }, { status: 422 });
  }
  let flodeskSegment: { id: string; name: string } | null = null;
  if (body.flodeskSegmentId) {
    try {
      flodeskSegment = await getFlodeskSegment(String(body.flodeskSegmentId));
    } catch {
      return reply({ error: "Flodesk didn't answer, so the program wasn't saved. Try again in a moment." }, { status: 503 });
    }
    if (!flodeskSegment) {
      return reply({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
    }
  }

  const program = await db.program.create({
    data: {
      flodeskSync: typeof body.flodeskSync === "boolean" ? body.flodeskSync : null,
      flodeskSegmentId: flodeskSegment?.id ?? null,
      flodeskSegmentName: flodeskSegment?.name ?? null,
      name,
      slug,
      tagline: body.tagline || null,
      programImage: body.programImage || null,
      description: body.description || undefined,
      pullQuote: pullQuote || null,
      pullQuoteSource: pullQuoteSource || null,
      ...offering.value,
      // Open entry is its own setting, off unless the editor turns it on.
      openEntry: body.openEntry === true,
      programNotes: body.programNotes || null,
      teacherFacilitators: body.teacherFacilitators ?? [],
      // `hostingHubSlug`: null defaults to host-team at read time. Coordinator
      // can transfer hosting authority to a different hub (Silent Meditation,
      // etc.) by setting this field under the editor's Who's helping.
      // Slug validated above; non-existent slugs were already rejected with 422.
      hostingHubSlug: requestedHostingHubSlug,
      // "No host needed" — default true (needs coverage). False = self-led /
      // community-led; excluded from the Scheduler + rotation generation + the
      // notification below.
      hostingRequired: body.hostingRequired ?? true,
      categoryId: body.categoryId || null,
      // dateText / timeText are server-computed from the source fields so they
      // never drift. Any value the client sends is ignored.
      dateText: computeDateText(
        body.startDatetime,
        body.recurrenceFreq,
        body.recurrenceDays ?? [],
        body.recurrenceInterval,
        body.endDatetime,
      ) || null,
      timeText: computeTimeText(body.startDatetime, body.endDatetime) || null,
      programFormat: body.programFormat || "in-person",
      venue: body.venue || "at-rim",
      locationText: body.locationText || null,
      locationLink: normalizeLinkInput(body.locationLink ?? "") || null,
      startDatetime: centralToUtc(body.startDatetime),
      endDatetime: centralToUtc(body.endDatetime),
      recurrenceFreq: body.recurrenceFreq || null,
      recurrenceInterval: body.recurrenceInterval != null && body.recurrenceInterval !== "" ? Number(body.recurrenceInterval) : null,
      recurrenceDays: body.recurrenceDays ?? [],
      recurrenceCount: body.recurrenceCount != null && body.recurrenceCount !== "" ? Number(body.recurrenceCount) : null,
      recurrenceUntil: createUntil,
      // Shown first in its section (2026-10-28): after any already shown first.
      listFirst: body.listFirst === true
        ? ((await db.program.aggregate({ where: { listFirst: { not: null }, archivedAt: null }, _max: { listFirst: true } }))._max.listFirst ?? 0) + 1
        : null,
      registrationEnabled: body.registrationEnabled ?? false,
      registrationClosed: body.registrationClosed ?? false,
      registrationCapacity: body.registrationCapacity != null ? Number(body.registrationCapacity) : null,
      registrationDeadline: centralToUtc(body.registrationDeadline),
      // "Opens on" (2026-10-24): taking sign-ups from then (lib/registrationWindow.ts).
      registrationOpensAt: centralToUtc(body.registrationOpensAt),
      registrationFields: createQuestions
        ? (withAskers(createQuestions as Record<string, unknown>[], createTeamIds) as Prisma.InputJsonObject[])
        : undefined,
      confirmationMessage: body.confirmationMessage || undefined,
      followUpEnabled: body.followUpEnabled === true,
      followUpMessage: body.followUpMessage || undefined,
      reminderDate: centralToUtc(body.reminderDate),
      reminderDaysBefore: typeof body.reminderDaysBefore === "number" ? body.reminderDaysBefore : null,
      reminderMessage: body.reminderMessage || undefined,
      danaMode: body.danaMode || "none",
      suggestedDana: body.suggestedDana != null ? Number(body.suggestedDana) : null,
      danaBaseAmount: body.danaBaseAmount != null ? Number(body.danaBaseAmount) : null,
      danaFixedAmount: body.danaFixedAmount != null ? Number(body.danaFixedAmount) : null,
      danaMessage: body.danaMessage || null,
      danaText: body.danaText || null,
      specialAnnouncement: body.specialAnnouncement || null,
      announcementUntil,
      earlyArrivalMessage: body.earlyArrivalMessage || null,
      hideFromDashboard: body.hideFromDashboard ?? false,
      dayOfWeek: body.dayOfWeek ?? [],
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : null,
      removeFromProgramList: body.removeFromProgramList ?? false,
      dashboardShowAt: centralToUtc(body.dashboardShowAt),
      hideFromProgramPageList: body.hideFromProgramPageList ?? false,
      hideFromWeeklySchedule: body.hideFromWeeklySchedule ?? false,
      hideWhenPast: body.hideWhenPast ?? true,
      isOpenAccess: body.isOpenAccess ?? false,
      guestAccessKey: body.isOpenAccess ? randomBytes(6).toString("hex") : null,
      recordByDefault: body.recordByDefault ?? false,
      outsideMeetingUrl: outsideMeeting.value,
      // Never on a program that takes registrations.
      outsideMeetingPublic:
        !!outsideMeeting.value && body.outsideMeetingPublic === true && body.registrationEnabled !== true,
    },
  });

  // Teams that prepare, right after the program, before any later step that
  // can still refuse (lib/programHelpers.ts).
  if (createHelpers.length > 0) await saveHelperTeams(program.id, createHelpers);

  // Handle teacher assignments if provided
  const teacherIds: string[] = body.teacherIds ?? [];
  if (teacherIds.length > 0) {
    await db.programTeacher.createMany({
      data: teacherIds.map((userId: string, index: number) => ({
        programId: program.id,
        userId,
        order: index,
      })),
    });
  }

  // Auxiliary-hub coverage (session 129). New programs may declare
  // coverage hubs immediately. Validated against the hub table; unknown
  // slugs return 422 and the program creation is rolled back at the
  // application level by letting the error bubble.
  let createdCoverageSlugs: string[] = [];
  if (Array.isArray(body.coverageHubSlugs) && body.coverageHubSlugs.length > 0) {
    const requestedSlugs: string[] = body.coverageHubSlugs.filter(
      (s: unknown): s is string => typeof s === "string" && s.trim().length > 0,
    );
    if (requestedSlugs.length > 0) {
      const validHubs = await db.hub.findMany({
        where: { slug: { in: requestedSlugs } },
        select: { slug: true },
      });
      const validSlugs = new Set(validHubs.map((h) => h.slug));
      const unknown = requestedSlugs.filter((s) => !validSlugs.has(s));
      if (unknown.length > 0) {
        // The program row already exists at this point; leave it but
        // surface the bad slug so the editor can show an error.
        return reply(
          { error: `Unknown auxiliary hub(s): ${unknown.join(", ")}` },
          { status: 422 },
        );
      }
      await db.programCoverageHub.createMany({
        data: requestedSlugs.map((hubSlug) => ({ programSlug: slug, hubSlug })),
      });
      createdCoverageSlugs = requestedSlugs;
    }
  }

  // Notify every team that now covers this program — the same heads-up across
  // all hubs (the shared-base principle). The PRIMARY host hub fires only for
  // virtual/hybrid + hostingRequired (LiveKit-relevant; "No host needed"
  // self-led programs have no one to notify). Each AUXILIARY coverage hub
  // (AV / greeter / …) is notified because it was explicitly tagged —
  // independent of the primary's format / hostingRequired gate. Same email,
  // each hub's own coverage noun; recipients exclude the creator + staged /
  // legacy members. after() keeps the sends alive past the response.
  after(async () => {
    try {
      // Auxiliary hubs were explicitly tagged → always notify. The primary
      // host hub fires only for virtual/hybrid + hostingRequired (LiveKit-
      // relevant; self-led has no one to notify). The Set dedupes if a hub is
      // somehow both primary and auxiliary, so no one gets two emails.
      const notifyHubs = new Set<string>(createdCoverageSlugs);
      if (
        program.hostingRequired &&
        (program.programFormat === "virtual" || program.programFormat === "hybrid")
      ) {
        notifyHubs.add(program.hostingHubSlug ?? DEFAULT_HOSTING_HUB_SLUG);
      }
      for (const hubSlug of notifyHubs) {
        await notifyHubOfNewProgramCoverage({
          hubSlug,
          programName: program.name,
          programFormat: program.programFormat,
          excludeUserId: actor.id,
        });
      }
    } catch (e) {
      console.error("[programs-pg] new-program notification error:", e);
    }
  });

  // Layer 2: surface any Zoom seat conflict this new schedule creates with other
  // virtual/hybrid programs (non-blocking).
  const isVirtual =
    program.programFormat === "virtual" || program.programFormat === "hybrid";
  const seatConflicts = isVirtual
    ? await conflictsForProgram(program.slug).catch((e) => {
        console.error("[programs-pg] seat-conflict check failed", e);
        return [];
      })
    : [];

  return reply({ ...program, seatConflicts }, { status: 201 });
}

/**
 * Archiving or restoring a program: PATCH /api/programs-pg/[slug]'s action,
 * shared with the RIM Guide. Whoever calls it has checked the three roles.
 */
export async function setProgramArchived(slug: string, archived: boolean): Promise<SaveReply> {
  const existing = await db.program.findUnique({ where: { slug }, select: { id: true } });
  if (!existing) return reply({ error: "Program not found" }, { status: 404 });
  const updated = await db.program.update({ where: { slug }, data: { archivedAt: archived ? new Date() : null } });
  return reply({ ...updated });
}
