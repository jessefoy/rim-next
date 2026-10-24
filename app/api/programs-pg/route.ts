/**
 * GET  /api/programs-pg — List all programs (canUseProgramManager: REGISTRAR | ADMIN | GUIDING_TEACHER)
 * POST /api/programs-pg — Create a new program (canUsePrograms: the three roles, or a member of a team with Programs)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { withQuestionIds } from "@/lib/registrationFields";
import { withAskers } from "@/lib/questionAskers";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { centralToUtc } from "@/lib/timezone";
import { computeTimeText, computeDateText } from "@/lib/programUtils";
import { notifyHubOfNewProgramCoverage } from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG, hostingTeamRefusal, supportingTeamRefusal } from "@/lib/programHub";
import { conflictsForProgram } from "@/lib/sessionConflicts";
import { getFlodeskSegment } from "@/lib/flodesk";
import { cleanOffering } from "@/lib/programOffering";
import { parseAnnouncementUntil } from "@/lib/scheduleUtils";
import { cleanOutsideMeetingUrl } from "@/lib/outsideMeeting";
import { normalizeLinkInput } from "@/lib/linkInput";
import { canUseProgramManager, canUsePrograms } from "@/lib/toolAuth";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  if (!session || !canUseProgramManager(session.user.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const programs = await db.program.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { category: true },
  });

  return NextResponse.json(programs);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  // Anyone who may use Programs may create one (2026-10-24).
  if (!session || !(await canUsePrograms(session.user.id, session.user.roles))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }
  // The pull quote is optional; a source cannot stand without its quote.
  const pullQuote = typeof body.pullQuote === "string" ? body.pullQuote.trim() : "";
  const pullQuoteSource = typeof body.pullQuoteSource === "string" ? body.pullQuoteSource.trim() : "";
  if (pullQuoteSource && !pullQuote) {
    return NextResponse.json({ error: "A quote source needs its quote." }, { status: 422 });
  }

  // Category is required; Format is required for the three ways and optional
  // otherwise (lib/programOffering.ts). The editor sends both; so must any caller.
  const offering = cleanOffering(body);
  if (!offering.ok) {
    return NextResponse.json({ error: offering.error }, { status: 422 });
  }

  // The Update's clear-by day: a "YYYY-MM-DD" or nothing.
  const announcementUntil = parseAnnouncementUntil(body.announcementUntil);
  if (announcementUntil === undefined) {
    return NextResponse.json({ error: "Show until needs a date, or leave it empty." }, { status: 422 });
  }

  // An outside room's link: https only, or empty for RIM's Zoom.
  const outsideMeeting = cleanOutsideMeetingUrl(body.outsideMeetingUrl);
  if (!outsideMeeting.ok) {
    return NextResponse.json({ error: outsideMeeting.error }, { status: 422 });
  }

  const existing = await db.program.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A program with this slug already exists" }, { status: 409 });
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
      if (refusal) return NextResponse.json({ error: refusal }, { status: 422 });
    }
  }
  // Who asks each question (lib/questionAskers.ts): kept only for a teacher or
  // one of the supporting teams the program is created with.
  const createTeamSlugs = Array.isArray(body.coverageHubSlugs)
    ? (body.coverageHubSlugs as unknown[]).filter((h): h is string => typeof h === "string" && h.trim().length > 0)
    : [];
  const createTeamIds = new Set(
    createTeamSlugs.length > 0
      ? (await db.hub.findMany({ where: { slug: { in: createTeamSlugs } }, select: { id: true } })).map((h) => h.id)
      : [],
  );
  const createQuestions = withQuestionIds(body.registrationFields, null);
  // As the edit route does: Open entry is on or off, not coerced (2026-10-19).
  if (body.openEntry !== undefined && typeof body.openEntry !== "boolean") {
    return NextResponse.json({ error: "Open entry must be on or off." }, { status: 422 });
  }
  if (requestedHostingHubSlug) {
    // A Hosting team must run sessions and have the Scheduler (2026-10-15).
    const refusal = await hostingTeamRefusal(requestedHostingHubSlug, body.hostingRequired === false ? null : (body.programFormat ?? null));
    if (refusal) return NextResponse.json({ error: refusal }, { status: 422 });
  }

  // Flodesk (mass email), as on the PUT: null = the default rule; a linked
  // segment is verified with Flodesk and named from it, never the request.
  if (body.flodeskSync != null && typeof body.flodeskSync !== "boolean") {
    return NextResponse.json({ error: "The Flodesk setting must be default, on or off." }, { status: 422 });
  }
  let flodeskSegment: { id: string; name: string } | null = null;
  if (body.flodeskSegmentId) {
    try {
      flodeskSegment = await getFlodeskSegment(String(body.flodeskSegmentId));
    } catch {
      return NextResponse.json({ error: "Flodesk didn't answer, so the program wasn't saved. Try again in a moment." }, { status: 503 });
    }
    if (!flodeskSegment) {
      return NextResponse.json({ error: "That Flodesk segment couldn't be found. Choose it again from the list." }, { status: 422 });
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
      recurrenceInterval: body.recurrenceInterval != null ? Number(body.recurrenceInterval) : null,
      recurrenceDays: body.recurrenceDays ?? [],
      recurrenceCount: body.recurrenceCount != null ? Number(body.recurrenceCount) : null,
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
      reminderDate: centralToUtc(body.reminderDate),
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
        return NextResponse.json(
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
          excludeUserId: session.user.id,
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

  return NextResponse.json({ ...program, seatConflicts }, { status: 201 });
}
