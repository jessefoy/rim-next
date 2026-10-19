import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  DEFAULT_COVERAGE_COPY,
  DEFAULT_HOSTING_HUB_SLUG,
  resolveHostingHubSlug,
} from "@/lib/programHub";
import { resolveSpacesContainerDrive } from "@/lib/googleFiles";
import { retargetTeamLink } from "@/lib/linkInput";
import { ctDateStr } from "@/lib/scheduleUtils";
import { sendCoverageClearedEmails } from "@/lib/email";
import { getToolBySlug, isToolCompatibleWithHub } from "@/lib/toolRegistry";
import type { Prisma } from "@prisma/client";

type AppLinkInput = {
  toolSlug?: string | null;
  label: string;
  href: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
};

/** GET /api/admin/hubs/[slug] — fetch one hub with appLinks (ADMIN only) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;

  const hub = await db.hub.findUnique({
    where: { slug },
    include: {
      appLinks: { orderBy: { order: "asc" } },
      members: {
        where: { isCoordinator: true },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });

  if (!hub) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  return NextResponse.json(hub);
}

/** PATCH /api/admin/hubs/[slug] — update hub + replace appLinks (ADMIN only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { slug } = await params;
  const body = await req.json();
  const { name, slug: newSlug, description, type, status, hasSchedule, conversationsEnabled, coverageNoun, coverageVerb, coverageAction, googleDriveId, googleFilesEnabled, appLinks, allowsMultipleAssignments, appliesToFormats, confirmCoverageClear } = body;

  // Coverage strings: trim, cap at 40. Empty input falls through to the
  // host-team default for that field — clearing an input in the form
  // restores "Host" / "hosting" / "host this" rather than leaving an empty
  // string in the column (which is non-nullable per the schema).
  const cleanCoverageInput = (raw: unknown, fallback: string): string => {
    if (typeof raw !== "string") return fallback;
    const t = raw.trim();
    return t.length > 0 ? t.slice(0, 40) : fallback;
  };

  const hub = await db.hub.findUnique({ where: { slug } });
  if (!hub) {
    return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  }

  // If slug is changing, check uniqueness
  const renaming = !!newSlug && newSlug !== slug;
  if (renaming) {
    // The Hosting Team's slug is the default every unassigned program
    // falls back to (Program.hostingHubSlug null), so it can't move.
    if (slug === DEFAULT_HOSTING_HUB_SLUG) {
      return NextResponse.json({ error: "The Hosting Team's address can't change: every program without a hosting team is hosted by it." }, { status: 400 });
    }
    const existing = await db.hub.findUnique({ where: { slug: newSlug } });
    if (existing) {
      return NextResponse.json({ error: "A hub with this slug already exists." }, { status: 409 });
    }
  }

  // ── Scheduler settings (2026-10-15 audit, step 3) ──────────────────────
  // Open sign-up and the formats a team staffs, set here rather than by a
  // migration. Each change keeps the schedule consistent or says why not.
  const FORMATS = ["virtual", "in-person", "hybrid"];
  let nextFormats: string[] | undefined;
  if (appliesToFormats !== undefined) {
    if (!Array.isArray(appliesToFormats)) {
      return NextResponse.json({ error: "Formats must be a list." }, { status: 400 });
    }
    nextFormats = FORMATS.filter((f) => appliesToFormats.includes(f));
    if (nextFormats.length === 0) {
      return NextResponse.json({ error: "Choose at least one kind of session this team staffs." }, { status: 400 });
    }
  }
  const nextMulti = allowsMultipleAssignments === undefined ? hub.allowsMultipleAssignments : !!allowsMultipleAssignments;
  const now = new Date();
  if (nextMulti !== hub.allowsMultipleAssignments) {
    const future = await db.hostAssignment.findMany({
      where: { hubSlug: slug, sessionDate: { gte: now } },
      select: { id: true, programSlug: true, sessionDate: true, userId: true },
    });
    if (!nextMulti) {
      // Back to one person per session: refuse while any session has more.
      const perSession = new Map<string, number>();
      for (const a of future) {
        if (!a.userId) continue;
        // One session = program + Central day (lib/timezone.ts ctDayBounds).
        const k = `${a.programSlug}::${a.sessionDate ? ctDateStr(a.sessionDate.toISOString()) : ""}`;
        perSession.set(k, (perSession.get(k) ?? 0) + 1);
      }
      const crowded = [...perSession.values()].filter((n) => n > 1).length;
      if (crowded > 0) {
        return NextResponse.json(
          { error: `${crowded} upcoming session${crowded === 1 ? " has" : "s have"} more than one person signed up. Take people off those sessions first, or leave open sign-up on.` },
          { status: 409 },
        );
      }
    } else {
      // To open sign-up: open sign-up teams don't use cover requests.
      const open = await db.subRequest.count({
        where: { status: "OPEN", assignmentId: { in: future.map((a) => a.id) } },
      });
      if (open > 0) {
        return NextResponse.json(
          { error: `${open} cover request${open === 1 ? " is" : "s are"} still open on this team. Close ${open === 1 ? "it" : "them"} first: open sign-up teams don't use cover requests.` },
          { status: 409 },
        );
      }
    }
  }

  // Formats leaving the team's set: the programs in those formats leave
  // its schedule. A program it hosts can't (move its hosting team first);
  // coverage it gives elsewhere is cleared, after a confirmation that says
  // how much.
  const droppedFormats = nextFormats ? hub.appliesToFormats.filter((f) => !nextFormats!.includes(f)) : [];
  let programsLeaving: string[] = [];
  if (droppedFormats.length > 0) {
    const affected = await db.program.findMany({
      where: { archivedAt: null, programFormat: { in: droppedFormats } },
      select: { slug: true, name: true, hostingHubSlug: true, hostingRequired: true },
    });
    const covering = new Set(
      (await db.programCoverageHub.findMany({ where: { hubSlug: slug }, select: { programSlug: true } })).map((r) => r.programSlug),
    );
    const hosted = affected.filter((p) => resolveHostingHubSlug(p) === slug && p.hostingRequired);
    if (hosted.length > 0) {
      return NextResponse.json(
        { error: `This team hosts ${hosted.map((p) => p.name).join(", ")}, in a format you're removing. Move ${hosted.length === 1 ? "that program" : "those programs"} to another hosting team first.` },
        { status: 409 },
      );
    }
    programsLeaving = affected.filter((p) => covering.has(p.slug)).map((p) => p.slug);
    if (programsLeaving.length > 0 && !confirmCoverageClear) {
      const [assignments, rotations] = await Promise.all([
        db.hostAssignment.count({ where: { hubSlug: slug, programSlug: { in: programsLeaving }, OR: [{ sessionDate: null }, { sessionDate: { gte: now } }] } }),
        db.standingAssignment.count({ where: { hubSlug: slug, programSlug: { in: programsLeaving } } }),
      ]);
      if (assignments + rotations > 0) {
        return NextResponse.json(
          {
            requiresConfirmation: true,
            error: `This team will stop staffing ${programsLeaving.length} program${programsLeaving.length === 1 ? "" : "s"}. ${assignments} upcoming session${assignments === 1 ? "" : "s"} and ${rotations} rotation rule${rotations === 1 ? "" : "s"} for ${programsLeaving.length === 1 ? "it" : "them"} will be cleared.`,
          },
          { status: 409 },
        );
      }
    }
  }

  if (appLinks !== undefined && !Array.isArray(appLinks)) {
    return NextResponse.json({ error: "Apps must be a list." }, { status: 400 });
  }
  let normalizedAppLinks: AppLinkInput[] | undefined;
  if (appLinks !== undefined) {
    const installed = await db.hubAppLink.findMany({
      where: { hubId: hub.id, toolSlug: { not: null } },
      select: { toolSlug: true, label: true, href: true },
    });
    const existingToolSlugs = new Set(installed.flatMap((link) => link.toolSlug ? [link.toolSlug] : []));
    const seenToolSlugs = new Set<string>();
    const effectiveSlug = newSlug || slug;
    for (const link of appLinks as AppLinkInput[]) {
      if (!link.toolSlug) continue;
      if (seenToolSlugs.has(link.toolSlug)) {
        return NextResponse.json({ error: "Each app can be installed only once per Space." }, { status: 400 });
      }
      seenToolSlugs.add(link.toolSlug);
      const known = getToolBySlug(link.toolSlug);
      const compatible = known && isToolCompatibleWithHub(link.toolSlug, effectiveSlug);
      // Preserve a pre-existing incompatible installation during ordinary
      // edits. New installs (and slug changes that would make an app newly
      // incompatible) are refused instead of silently widening app scope.
      const grandfathered = effectiveSlug === slug && existingToolSlugs.has(link.toolSlug);
      if (!compatible && !grandfathered) {
        return NextResponse.json(
          { error: "That app is not designed for this Space. Existing installations are preserved, but new incompatible installations are blocked." },
          { status: 400 },
        );
      }
    }

    const existingByTool = new Map(installed.flatMap((link) => link.toolSlug ? [[link.toolSlug, link]] : []));
    const requested = appLinks as AppLinkInput[];
    const requestedPrimary = requested.filter((link) => link.isPrimary);
    if (requestedPrimary.length > 1) {
      return NextResponse.json({ error: "A Space can have only one primary app." }, { status: 400 });
    }
    if (requestedPrimary.some((link) => !link.toolSlug || link.isEnabled === false || !getToolBySlug(link.toolSlug)?.canBePrimary)) {
      return NextResponse.json({ error: "The primary app must be an enabled, registered app." }, { status: 400 });
    }
    const defaultPrimaryIndex = requested.findIndex((link) => {
      const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
      return Boolean(tool?.canBePrimary && link.isEnabled !== false);
    });
    normalizedAppLinks = requested.map((link, index) => {
      if (!link.toolSlug) return { ...link, label: link.label.trim(), href: link.href.trim() };
      const existing = existingByTool.get(link.toolSlug);
      const registered = getToolBySlug(link.toolSlug);
      return {
        ...link,
        label: existing?.label ?? registered?.label ?? link.label.trim(),
        href: existing?.href ?? registered?.path ?? link.href.trim(),
        isPrimary: requestedPrimary.length > 0 ? Boolean(link.isPrimary) : index === defaultPrimaryIndex,
      };
    });
    const enabledRegisteredApps = normalizedAppLinks.filter(
      (link) => link.toolSlug && link.isEnabled !== false && getToolBySlug(link.toolSlug),
    );
    if (enabledRegisteredApps.length > 0 && !enabledRegisteredApps.some((link) => link.isPrimary)) {
      return NextResponse.json(
        { error: "Choose one enabled app as the primary app for this Space." },
        { status: 400 },
      );
    }
  }

  // ── A team stops scheduling (2026-10-16 audit) ──────────────────────────
  // Archiving it, turning its Scheduler off, or turning off "runs live
  // sessions" used to leave its programs on no schedule and its rotations
  // still firing. Programs it hosts must move first; its own upcoming
  // sessions and rotations are cleared after a confirmation that counts them.
  const schedulerOnNow = (await db.hubAppLink.count({ where: { hubId: hub.id, toolSlug: "schedule", isEnabled: true } })) > 0;
  const schedulerOnNext = normalizedAppLinks !== undefined
    ? normalizedAppLinks.some((l) => l.toolSlug === "schedule" && l.isEnabled !== false)
    : schedulerOnNow;
  const activeNext = (status ?? hub.status) === "ACTIVE";
  const stopsScheduling = hub.status === "ACTIVE" && schedulerOnNow && !(activeNext && schedulerOnNext);
  const stopsHosting = hub.hasSchedule && (hasSchedule === false || stopsScheduling);
  if (stopsHosting) {
    const hosted = (await db.program.findMany({
      where: { archivedAt: null, hostingRequired: true },
      select: { name: true, hostingHubSlug: true },
    })).filter((p) => resolveHostingHubSlug(p) === slug);
    if (hosted.length > 0) {
      return NextResponse.json(
        { error: `This team hosts ${hosted.map((p) => p.name).join(", ")}. Move ${hosted.length === 1 ? "that program" : "those programs"} to another hosting team first.` },
        { status: 409 },
      );
    }
  }
  if (!hub.hasSchedule && hasSchedule === true) {
    const covering = await db.programCoverageHub.count({ where: { hubSlug: slug } });
    if (covering > 0) {
      return NextResponse.json(
        { error: `This team is a supporting team on ${covering} program${covering === 1 ? "" : "s"}. Untick it there first, then make it a team that runs sessions.` },
        { status: 409 },
      );
    }
  }
  let clearWholeSchedule = false;
  if (stopsScheduling) {
    const [upcoming, rules] = await Promise.all([
      db.hostAssignment.count({ where: { hubSlug: slug, OR: [{ sessionDate: null }, { sessionDate: { gte: now } }] } }),
      db.standingAssignment.count({ where: { hubSlug: slug } }),
    ]);
    if (upcoming + rules > 0) {
      if (!confirmCoverageClear) {
        return NextResponse.json(
          {
            requiresConfirmation: true,
            error: `This team will stop scheduling. Its ${upcoming} upcoming session${upcoming === 1 ? "" : "s"} and ${rules} rotation rule${rules === 1 ? "" : "s"} will be cleared, and the people on them told.`,
          },
          { status: 409 },
        );
      }
      clearWholeSchedule = true;
    }
  }

  // Google Drive mapping (RIM_GoogleWorkspace.md) — one merged authority.
  // The drive id is admin config, not member input (a foreign id is inert:
  // the service account can only reach drives it manages; the picker +
  // /admin/google-test give visibility). Compute the effective post-PATCH
  // drive once; the update block below enforces the invariants that hang
  // off it — enabled ⇒ mapped, and a root-folder scope never outlives its
  // drive — regardless of which keys this PATCH body carried.
  const nextGoogleDriveId =
    googleDriveId !== undefined
      ? typeof googleDriveId === "string" && googleDriveId.trim().length > 0
        ? googleDriveId.trim()
        : null
      : hub.googleDriveId;

  // Server-side invariant guard (not just the client picker's filter): a hub
  // must never be mapped WHOLE-DRIVE onto the managed "RIM — Spaces"
  // container: that would put a whole-drive place on a drive that also holds
  // folder-scoped Spaces, defeating the per-folder isolation gate (see
  // lib/googleFiles.ts::resolvePlaceForFile).
  // Only checked on an actual drive CHANGE to a new non-null drive.
  if (
    googleDriveId !== undefined &&
    nextGoogleDriveId &&
    nextGoogleDriveId !== hub.googleDriveId
  ) {
    const container = await resolveSpacesContainerDrive();
    if (nextGoogleDriveId === container?.id) {
      return NextResponse.json(
        {
          error:
            "That drive is managed automatically — use “Set up files for this team” instead of mapping it here.",
        },
        { status: 400 },
      );
    }
  }

  const updateData: Prisma.HubUpdateInput = {
      ...(name !== undefined && { name }),
      ...(newSlug && newSlug !== slug && { slug: newSlug }),
      // The one line under the team's name on its Home (2026-10-13).
      ...(description !== undefined && {
        description: typeof description === "string" ? description.replace(/\s+/g, " ").trim().slice(0, 200) || null : null,
      }),
      ...(type !== undefined && { type }),
      ...(allowsMultipleAssignments !== undefined && { allowsMultipleAssignments: nextMulti }),
      ...(nextFormats && { appliesToFormats: nextFormats }),
      ...(status !== undefined && { status }),
      ...(hasSchedule !== undefined && { hasSchedule: !!hasSchedule }),
      ...(conversationsEnabled !== undefined && { conversationsEnabled: !!conversationsEnabled }),
      // The teacher-pill settings (assignmentGrantsTeacher, teacherLabel) were
      // retired 2026-10-16 (Jesse): they did nothing once sessions moved to
      // Zoom. Their columns stay on the record; nothing sets them.
      ...(coverageNoun   !== undefined && { coverageNoun:   cleanCoverageInput(coverageNoun,   DEFAULT_COVERAGE_COPY.noun) }),
      ...(coverageVerb   !== undefined && { coverageVerb:   cleanCoverageInput(coverageVerb,   DEFAULT_COVERAGE_COPY.verb) }),
      ...(coverageAction !== undefined && { coverageAction: cleanCoverageInput(coverageAction, DEFAULT_COVERAGE_COPY.action) }),
      // Google Drive mapping — see nextGoogleDriveId above. Touching either
      // mapping key re-derives the enabled flag, so PATCH {googleDriveId: ""}
      // alone can't leave a stale enabled=true; and a drive change/clear
      // always resets the folder scope that belonged to the old drive.
      ...(googleDriveId !== undefined && { googleDriveId: nextGoogleDriveId }),
      ...((googleDriveId !== undefined || googleFilesEnabled !== undefined) && {
        googleFilesEnabled:
          nextGoogleDriveId !== null &&
          (googleFilesEnabled !== undefined
            ? !!googleFilesEnabled
            : hub.googleFilesEnabled),
      }),
      ...(googleDriveId !== undefined &&
        nextGoogleDriveId !== hub.googleDriveId && { googleRootFolderId: null }),
  };

  // App replacement and hub config are one unit. A failed create can no
  // longer leave a Space with every app link deleted.
  const clearedRows: { userId: string | null; hubSlug: string; programSlug: string; sessionDate: Date | null }[] = [];
  const updated = await db.$transaction(async (tx) => {
    // Moving to open sign-up: an empty single-seat row would read as a
    // blank name on the session; with no row it reads "no one yet".
    // FK-safe (SubClaim → SubRequest → HostAssignment): an emptied seat
    // often still carries its cancelled cover request.
    if (nextMulti && !hub.allowsMultipleAssignments) {
      const empty = (await tx.hostAssignment.findMany({
        where: { hubSlug: slug, userId: null, sessionDate: { gte: now } },
        select: { id: true },
      })).map((a) => a.id);
      if (empty.length) {
        await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: empty } } } });
        await tx.subRequest.deleteMany({ where: { assignmentId: { in: empty } } });
        await tx.hostAssignment.deleteMany({ where: { id: { in: empty } } });
      }
    }
    // Programs whose format left the team's set leave its schedule
    // (confirmed above), in this same transaction so the save and the
    // clear land together.
    if (programsLeaving.length || clearWholeSchedule) {
      const leavingRows = await tx.hostAssignment.findMany({
        where: {
          hubSlug: slug,
          ...(clearWholeSchedule ? {} : { programSlug: { in: programsLeaving } }),
          OR: [{ sessionDate: null }, { sessionDate: { gte: now } }],
        },
        select: { id: true, userId: true, hubSlug: true, programSlug: true, sessionDate: true },
      });
      clearedRows.push(...leavingRows);
      const leaving = leavingRows.map((a) => a.id);
      if (leaving.length) {
        await tx.subClaim.deleteMany({ where: { request: { assignmentId: { in: leaving } } } });
        await tx.subRequest.deleteMany({ where: { assignmentId: { in: leaving } } });
        await tx.hostAssignment.deleteMany({ where: { id: { in: leaving } } });
      }
      const rot = await tx.standingAssignment.deleteMany({
        where: { hubSlug: slug, ...(clearWholeSchedule ? {} : { programSlug: { in: programsLeaving } }) },
      });
      console.log(`[admin hubs] ${slug}: cleared ${leaving.length} upcoming session(s) and ${rot.count} rotation(s) ${clearWholeSchedule ? "(team stopped scheduling)" : `on ${programsLeaving.join(", ")} (format no longer staffed)`}`);
    }
    // A new address carries everything that names the team by its slug
    // (these join by text, not by a database link), or its programs,
    // schedule and files would fall away from it.
    if (renaming) {
      await tx.program.updateMany({ where: { hostingHubSlug: slug }, data: { hostingHubSlug: newSlug } });
      await tx.programCoverageHub.updateMany({ where: { hubSlug: slug }, data: { hubSlug: newSlug } });
      await tx.hostAssignment.updateMany({ where: { hubSlug: slug }, data: { hubSlug: newSlug } });
      await tx.standingAssignment.updateMany({ where: { hubSlug: slug }, data: { hubSlug: newSlug } });
      // The coverage notices too: the team's gap history in Updates, and the
      // daily pass's once-a-day records, which would otherwise send again
      // (2026-10-19 audit).
      await tx.coverageNotice.updateMany({ where: { hubSlug: slug }, data: { hubSlug: newSlug } });
      await tx.googleFileTransfer.updateMany({ where: { placeKey: `hub:${slug}` }, data: { placeKey: `hub:${newSlug}` } });
      await tx.googleFileMeta.updateMany({ where: { placeKey: `hub:${slug}` }, data: { placeKey: `hub:${newSlug}` } });
      await tx.googleFilePin.updateMany({ where: { placeKey: `hub:${slug}` }, data: { placeKey: `hub:${newSlug}` } });
      await tx.googleFilePreference.updateMany({ where: { placeKey: `hub:${slug}` }, data: { placeKey: `hub:${newSlug}` } });
      await tx.googleFileViewPreference.updateMany({ where: { placeKey: `hub:${slug}` }, data: { placeKey: `hub:${newSlug}` } });
    }
    if (normalizedAppLinks !== undefined) {
      await tx.hubAppLink.deleteMany({ where: { hubId: hub.id } });
      if (normalizedAppLinks.length > 0) {
        await tx.hubAppLink.createMany({
          data: normalizedAppLinks.map((link, i) => ({
            hubId: hub.id,
            toolSlug: link.toolSlug ?? null,
            label: link.label,
            href: link.href,
            order: i,
            isEnabled: link.isEnabled ?? true,
            isPrimary: link.isPrimary ?? false,
          })),
        });
      }
    }
    // Custom links that point at this team's pages, in any Space, follow
    // the new address too (only RIM's own links; lib/linkInput.ts).
    if (renaming) {
      const ownOrigins = [process.env.NEXTAUTH_URL, "https://rootedinmindfulness.org", "https://www.rootedinmindfulness.org"]
        .flatMap((u) => { try { return u ? [new URL(u.trim()).origin] : []; } catch { return []; } });
      // Every Space's custom links: another team may link to this one.
      const custom = await tx.hubAppLink.findMany({ where: { toolSlug: null }, select: { id: true, href: true } });
      for (const link of custom) {
        const href = retargetTeamLink(link.href, slug, newSlug, ownOrigins);
        if (href !== link.href) await tx.hubAppLink.update({ where: { id: link.id }, data: { href } });
      }
    }
    return tx.hub.update({
      where: { slug },
      data: updateData,
      include: {
        appLinks: { orderBy: { order: "asc" } },
        members: {
          where: { isCoordinator: true },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
    });
  });

  // Tell the people taken off sessions (lib/email.ts sendCoverageClearedEmails).
  if (clearedRows.length) {
    const effective = renaming ? newSlug : slug;
    after(() =>
      sendCoverageClearedEmails({
        rows: clearedRows.map((r) => ({ ...r, hubSlug: effective })),
        reason: (team) =>
          clearWholeSchedule
            ? `The ${team} has stopped scheduling sessions for now.`
            : `The ${team} no longer covers the programs below.`,
        excludeUserId: session!.user.id,
      }),
    );
  }

  return NextResponse.json(updated);
}
