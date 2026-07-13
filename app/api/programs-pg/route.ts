/**
 * GET  /api/programs-pg — List all programs (REGISTRAR | ADMIN)
 * POST /api/programs-pg — Create a new program (REGISTRAR | ADMIN)
 */

import { NextRequest, NextResponse, after } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { centralToUtc } from "@/lib/timezone";
import { computeTimeText, computeDateText } from "@/lib/programUtils";
import { sanitizeTeacherLabel } from "@/lib/programUtils";
import { notifyHubOfNewProgramCoverage } from "@/lib/email";
import { DEFAULT_HOSTING_HUB_SLUG } from "@/lib/programHub";
import { conflictsForProgram } from "@/lib/sessionConflicts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
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
  if (!session?.user?.roles?.some((r) => ["REGISTRAR", "ADMIN"].includes(r))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
  }
  const pullQuote = typeof body.pullQuote === "string" ? body.pullQuote.trim() : "";
  if (!pullQuote) {
    return NextResponse.json({ error: "Every program needs a pull quote." }, { status: 422 });
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
  if (requestedHostingHubSlug) {
    const hub = await db.hub.findUnique({
      where: { slug: requestedHostingHubSlug },
      select: { id: true },
    });
    if (!hub) {
      return NextResponse.json(
        { error: `Unknown hub: ${requestedHostingHubSlug}` },
        { status: 422 },
      );
    }
  }

  const program = await db.program.create({
    data: {
      name,
      slug,
      tagline: body.tagline || null,
      programImage: body.programImage || null,
      description: body.description || undefined,
      pullQuote,
      pullQuoteSource: typeof body.pullQuoteSource === "string" ? body.pullQuoteSource.trim() || null : null,
      programNotes: body.programNotes || null,
      teacherFacilitators: body.teacherFacilitators ?? [],
      teacherLabel: sanitizeTeacherLabel(body.teacherLabel),
      // `hostingHubSlug`: null defaults to host-team at read time. Coordinator
      // can transfer hosting authority to a different hub (Silent Meditation,
      // etc.) by setting this field via the editor's Hosting & Access tab.
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
      locationLink: body.locationLink || null,
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
      registrationFields: body.registrationFields || undefined,
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
      earlyArrivalMessage: body.earlyArrivalMessage || null,
      hideFromDashboard: body.hideFromDashboard ?? false,
      dayOfWeek: body.dayOfWeek ?? [],
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : null,
      removeFromProgramList: body.removeFromProgramList ?? false,
      dashboardShowAt: centralToUtc(body.dashboardShowAt),
      hideFromProgramPageList: body.hideFromProgramPageList ?? false,
      hideFromWeeklySchedule: body.hideFromWeeklySchedule ?? false,
      isOpenAccess: body.isOpenAccess ?? false,
      guestAccessKey: body.isOpenAccess ? randomBytes(6).toString("hex") : null,
      livekitRoom: (body.programFormat === "virtual" || body.programFormat === "hybrid") ? slug : null,
      recordByDefault: body.recordByDefault ?? false,
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
