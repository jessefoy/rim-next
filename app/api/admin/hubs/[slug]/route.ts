import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DEFAULT_COVERAGE_COPY } from "@/lib/programHub";
import { resolveSpacesContainerDrive } from "@/lib/googleFiles";
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
  const { name, slug: newSlug, description, type, status, hasSchedule, conversationsEnabled, assignmentGrantsTeacher, teacherLabel, coverageNoun, coverageVerb, coverageAction, googleDriveId, googleFilesEnabled, appLinks, welcomeHeadline, welcomeBody, homeContent } = body;

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
  if (newSlug && newSlug !== slug) {
    const existing = await db.hub.findUnique({ where: { slug: newSlug } });
    if (existing) {
      return NextResponse.json({ error: "A hub with this slug already exists." }, { status: 409 });
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
      ...(description !== undefined && { description: description || null }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(hasSchedule !== undefined && { hasSchedule: !!hasSchedule }),
      ...(conversationsEnabled !== undefined && { conversationsEnabled: !!conversationsEnabled }),
      ...(assignmentGrantsTeacher !== undefined && { assignmentGrantsTeacher: !!assignmentGrantsTeacher }),
      // teacherLabel: trim + cap at 20, null when empty.  Effective capability
      // for this update = the body's flag if present, otherwise the hub's
      // stored value.  When the effective capability is false, force the label
      // to null so a stale label can't sit on a hub where the capability is
      // off (covers BOTH the explicit-off PATCH AND the "send only label, hub
      // already off" case).
      ...(teacherLabel !== undefined && {
        teacherLabel:
          (assignmentGrantsTeacher !== undefined
            ? !!assignmentGrantsTeacher
            : hub.assignmentGrantsTeacher) === false
            ? null
            : typeof teacherLabel === "string" && teacherLabel.trim().length > 0
              ? teacherLabel.trim().slice(0, 20)
              : null,
      }),
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
      ...(welcomeHeadline !== undefined && { welcomeHeadline: welcomeHeadline || null }),
      ...(welcomeBody !== undefined && { welcomeBody }),
      ...(homeContent !== undefined && { homeContent }),
  };

  // App replacement and hub config are one unit. A failed create can no
  // longer leave a Space with every app link deleted.
  const updated = await db.$transaction(async (tx) => {
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

  return NextResponse.json(updated);
}
