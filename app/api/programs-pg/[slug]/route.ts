/**
 * GET    /api/programs-pg/[slug] — Get single program (REGISTRAR | ADMIN)
 * PUT    /api/programs-pg/[slug] — Update program (REGISTRAR | ADMIN)
 * DELETE /api/programs-pg/[slug] — Delete program (ADMIN only, safety check)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clearCoverageNoLongerStaffed, clearOffScheduleCoverage, DEFAULT_HOSTING_HUB_SLUG, getProgramCoverageHubs, hostingTeamRefusal, supportingTeamRefusal } from "@/lib/programHub";
import { centralToUtc, toCentralDatetime } from "@/lib/timezone";
import { computeTimeText, computeDateText, sanitizeTeacherLabel } from "@/lib/programUtils";
import { notifyHubOfNewProgramCoverage, sendCoverageClearedEmails, sendSessionsClearedEmail } from "@/lib/email";
import { applyProgramRecordingSetting, teardownProgramMeetings } from "@/lib/sessionMeeting";
import { conflictsForProgram } from "@/lib/sessionConflicts";
import { EARLY_OPEN_MIN } from "@/lib/sessionWindowConstants";
import { cleanOffering, resolveOffering } from "@/lib/programOffering";
import { ctDateStr, parseAnnouncementUntil, shiftToDate } from "@/lib/scheduleUtils";
import { getFlodeskSegment } from "@/lib/flodesk";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { normalizeLinkInput } from "@/lib/linkInput";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    include: {
      category: true,
      programCourses: { include: { course: true } },
      programTeachers: {
        orderBy: { order: "asc" },
        include: { user: { select: { id: true, firstName: true, lastName: true, preferredName: true } } },
      },
    },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  return NextResponse.json(program);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await request.json();

  // ── Archive / Restore actions ──
  if (body.action === "archive") {
    const updated = await db.program.update({
      where: { slug },
      data: { archivedAt: new Date() },
    });
    return NextResponse.json(updated);
  }

  if (body.action === "restore") {
    const updated = await db.program.update({
      where: { slug },
      data: { archivedAt: null },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;
  const existing = await db.program.findUnique({ where: { slug } });
  if (!existing) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  const body = await request.json();

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
    return NextResponse.json({ error: "A quote source needs its quote." }, { status: 422 });
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
      return NextResponse.json({ error: offering.error }, { status: 422 });
    }
    offeringData = offering.value;
  }

  // If slug is changing, check uniqueness
  if (body.slug && body.slug !== slug) {
    const conflict = await db.program.findUnique({ where: { slug: body.slug } });
    if (conflict) {
      return NextResponse.json({ error: "A program with this slug already exists" }, { status: 409 });
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
      return NextResponse.json({ error: "Open entry must be on or off." }, { status: 422 });
    }
    data.openEntry = body.openEntry;
  }
  // Flodesk (mass email). flodeskSync: null = the default rule, true/false =
  // override. The segment link is sent only when the coordinator changed it
  // (so a save can't erase a segment created by a registration meanwhile);
  // its name is read from Flodesk, never from the request.
  if (body.flodeskSync !== undefined) {
    if (body.flodeskSync !== null && typeof body.flodeskSync !== "boolean") {
      return NextResponse.json({ error: "The Flodesk setting must be default, on or off." }, { status: 422 });
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
        return NextResponse.json({ error: "Flodesk didn't answer, so the changes weren't saved. Try again in a moment." }, { status: 503 });
      }
      if (!segment) {
        return NextResponse.json({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
      }
      data.flodeskSegmentId = segment.id;
      data.flodeskSegmentName = segment.name;
    }
  }
  if (body.programNotes !== undefined) data.programNotes = body.programNotes || null;
  if (body.teacherFacilitators !== undefined) data.teacherFacilitators = body.teacherFacilitators;
  if (body.teacherLabel !== undefined) data.teacherLabel = sanitizeTeacherLabel(body.teacherLabel);
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
    const fmt = body.programFormat as string;
    if ((fmt === "virtual" || fmt === "hybrid") && !existing.livekitRoom) {
      data.livekitRoom = body.slug ?? slug;
    }
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
      if (refusal) return NextResponse.json({ error: refusal }, { status: 422 });
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
    if (team && needsHost && changed) {
      const refusal = await hostingTeamRefusal(team, format);
      if (refusal) return NextResponse.json({ error: refusal }, { status: 422 });
    }
  }

  if (body.recordByDefault !== undefined) data.recordByDefault = body.recordByDefault !== false;
  // Outside room: https only, or empty for RIM's Zoom. A request that leaves
  // it out leaves it as stored. "Anyone may join from the public page" means
  // nothing without a link, so it is cleared with the link.
  if (body.outsideMeetingUrl !== undefined) {
    const outside = cleanOutsideMeetingUrl(body.outsideMeetingUrl);
    if (!outside.ok) {
      return NextResponse.json({ error: outside.error }, { status: 422 });
    }
    data.outsideMeetingUrl = outside.value;
    if (!outside.value) data.outsideMeetingPublic = false;
  }
  if (body.outsideMeetingPublic !== undefined && data.outsideMeetingPublic === undefined) {
    if (typeof body.outsideMeetingPublic !== "boolean") {
      return NextResponse.json({ error: "Public joining must be on or off." }, { status: 422 });
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
  if (body.recurrenceCount !== undefined) data.recurrenceCount = body.recurrenceCount != null ? Number(body.recurrenceCount) : null;
  if (body.registrationEnabled !== undefined) data.registrationEnabled = body.registrationEnabled;
  if (body.registrationClosed !== undefined) data.registrationClosed = body.registrationClosed;
  if (body.registrationCapacity !== undefined) data.registrationCapacity = body.registrationCapacity != null ? Number(body.registrationCapacity) : null;
  if (body.registrationDeadline !== undefined) data.registrationDeadline = centralToUtc(body.registrationDeadline);
  // "Anyone may join from the public page" is never kept on a program that
  // takes registrations (the editor, this route, the page and /enter agree).
  if ((data.registrationEnabled ?? existing.registrationEnabled) === true) {
    data.outsideMeetingPublic = false;
  }
  if (body.registrationFields !== undefined) data.registrationFields = body.registrationFields || undefined;
  if (body.confirmationMessage !== undefined) data.confirmationMessage = body.confirmationMessage || undefined;
  if (body.reminderDate !== undefined) data.reminderDate = centralToUtc(body.reminderDate);
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
      return NextResponse.json({ error: "Show until needs a date, or leave it empty." }, { status: 422 });
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
    // Clear key when disabling
    if (!body.isOpenAccess) {
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
  const endSource =
    body.endDatetime !== undefined
      ? body.endDatetime
      : toCentralDatetime(existing.endDatetime);
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
      !sameDays(data.recurrenceDays as string[], existing.recurrenceDays));
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
    (data.recurrenceDays !== undefined && !sameDays(data.recurrenceDays as string[], existing.recurrenceDays));

  // (c) slugChanged — meetings are keyed by slug. Move the rows to the new
  //     slug (the Zoom meetings themselves don't use it), so a session that is
  //     open right now keeps its one room instead of /enter opening a second.
  const slugChanged = !!body.slug && body.slug !== slug;
  if (slugChanged) {
    await db.sessionMeeting
      .updateMany({ where: { programSlug: slug }, data: { programSlug: updated.slug } })
      .catch((e) => console.error("[programs-pg] Zoom meeting slug move failed", e));
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
        return NextResponse.json(
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

    await db.programCoverageHub.deleteMany({ where: { programSlug: slug } });
    if (requestedSlugs.length > 0) {
      await db.programCoverageHub.createMany({
        data: requestedSlugs.map((hubSlug) => ({ programSlug: slug, hubSlug })),
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
              excludeUserId: session.user.id,
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
        excludeUserId: session.user.id,
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
          await notifyHubOfNewProgramCoverage({ hubSlug: newHubSlug, programName, programFormat, excludeUserId: session.user.id });
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
          excludeUserId: session.user.id,
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

  return NextResponse.json({ ...updated, seatConflicts, scheduleCleared });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden — ADMIN only" }, { status: 403 });
  }

  const { slug } = await params;
  const program = await db.program.findUnique({
    where: { slug },
    select: { id: true, archivedAt: true },
  });

  if (!program) {
    return NextResponse.json({ error: "Program not found" }, { status: 404 });
  }

  // Safety: must be archived first
  if (!program.archivedAt) {
    return NextResponse.json(
      { error: "Cannot delete — archive the program first." },
      { status: 400 }
    );
  }

  // Safety: cannot delete if active registrations exist
  const activeRegs = await db.registration.count({
    where: { programId: program.id, status: { in: ["REGISTERED", "APPROVED", "WAITLISTED"] } },
  });
  if (activeRegs > 0) {
    return NextResponse.json(
      { error: `Cannot delete — ${activeRegs} active registration(s) exist. Cancel all registrations first.` },
      { status: 400 }
    );
  }

  // Its schedule goes with it: these rows name the program by slug (no
  // database link), so a new program given the same slug would inherit them
  // (2026-10-16 audit). FK-safe: SubClaim → SubRequest → HostAssignment;
  // rotation skips go with their rotations.
  await db.$transaction(async (tx) => {
    const ids = (await tx.hostAssignment.findMany({ where: { programSlug: slug }, select: { id: true } })).map((a) => a.id);
    if (ids.length) {
      await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: ids } } } });
      await tx.subRequest.deleteMany({ where: { assignmentId: { in: ids } } });
      await tx.hostAssignment.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.standingAssignment.deleteMany({ where: { programSlug: slug } });
    await tx.programCoverageHub.deleteMany({ where: { programSlug: slug } });
    await tx.program.delete({ where: { slug } });
  });

  // Tear down any Zoom meetings this program provisioned (Zoom + rows), since
  // SessionMeeting is keyed by slug (no FK) and would otherwise orphan.
  after(async () => {
    try {
      const n = await teardownProgramMeetings(slug, { futureOnly: false });
      if (n > 0) console.log(`[programs-pg] deleted ${slug}; tore down ${n} Zoom meeting(s)`);
    } catch (e) {
      console.error("[programs-pg] Zoom teardown on delete error:", e);
    }
  });

  return NextResponse.json({ success: true });
}
