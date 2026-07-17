import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { DEFAULT_COVERAGE_COPY } from "@/lib/programHub";
import { provisionHubSpaceStorage } from "@/lib/googleFiles";
import { getToolBySlug, isToolCompatibleWithHub } from "@/lib/toolRegistry";

type AppLinkInput = {
  toolSlug?: string | null;
  label: string;
  href: string;
  isEnabled?: boolean;
  isPrimary?: boolean;
};

/** GET /api/admin/hubs — list all hubs with member count (ADMIN only) */
export async function GET() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const hubs = await db.hub.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { members: true } },
      appLinks: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(hubs);
}

/** POST /api/admin/hubs — create a new hub (ADMIN only) */
export async function POST(req: Request) {
  const session = await auth();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN") || !session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const creatorId = session.user.id;

  const body = await req.json();
  const { name, slug, description, type, status, hasSchedule, conversationsEnabled, assignmentGrantsTeacher, teacherLabel, coverageNoun, coverageVerb, coverageAction, appLinks } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.hub.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A hub with this slug already exists." }, { status: 409 });
  }

  if (appLinks !== undefined && !Array.isArray(appLinks)) {
    return NextResponse.json({ error: "Apps must be a list." }, { status: 400 });
  }
  const requestedAppLinks = (appLinks ?? []) as AppLinkInput[];
  const seenTools = new Set<string>();
  for (const link of requestedAppLinks) {
    if (!link.toolSlug) continue;
    if (seenTools.has(link.toolSlug)) {
      return NextResponse.json({ error: "Each app can be installed only once per Space." }, { status: 400 });
    }
    seenTools.add(link.toolSlug);
    if (!getToolBySlug(link.toolSlug) || !isToolCompatibleWithHub(link.toolSlug, slug)) {
      return NextResponse.json(
        { error: "That app is not designed for this Space. Add it as a custom link only if navigation is all you need." },
        { status: 400 },
      );
    }
  }
  const requestedPrimary = requestedAppLinks.filter((link) => link.isPrimary);
  if (requestedPrimary.length > 1) {
    return NextResponse.json({ error: "A Space can have only one primary app." }, { status: 400 });
  }
  if (requestedPrimary.some((link) => !link.toolSlug || link.isEnabled === false || !getToolBySlug(link.toolSlug)?.canBePrimary)) {
    return NextResponse.json({ error: "The primary app must be an enabled, registered app." }, { status: 400 });
  }
  const defaultPrimaryIndex = requestedAppLinks.findIndex((link) => {
    const tool = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
    return Boolean(tool?.canBePrimary && link.isEnabled !== false);
  });
  const normalizedAppLinks = requestedAppLinks.map((link, index) => ({
    ...link,
    isPrimary: requestedPrimary.length > 0 ? Boolean(link.isPrimary) : index === defaultPrimaryIndex,
  }));
  const enabledRegisteredApps = normalizedAppLinks.filter(
    (link) => link.toolSlug && link.isEnabled !== false && getToolBySlug(link.toolSlug),
  );
  if (enabledRegisteredApps.length > 0 && !enabledRegisteredApps.some((link) => link.isPrimary)) {
    return NextResponse.json(
      { error: "Choose one enabled app as the primary app for this Space." },
      { status: 400 },
    );
  }

  // teacherLabel only meaningful when assignmentGrantsTeacher is true;
  // strip it otherwise so we don't store dead state. Sanitize: trim, max 20.
  const grantsTeacher = !!assignmentGrantsTeacher;
  const sanitizedLabel =
    grantsTeacher && typeof teacherLabel === "string" && teacherLabel.trim().length > 0
      ? teacherLabel.trim().slice(0, 20)
      : null;

  // Coverage strings: trim, cap at 40. Empty input falls through to the
  // host-team default for that field, so clearing an input in the form
  // restores "Host" / "hosting" / "host this" rather than leaving an empty
  // string in the column (which is non-nullable per the schema).
  const cleanCoverageInput = (raw: unknown, fallback: string): string => {
    if (typeof raw !== "string") return fallback;
    const t = raw.trim();
    return t.length > 0 ? t.slice(0, 40) : fallback;
  };

  const hub = await db.hub.create({
    data: {
      name,
      slug,
      description: description || null,
      type: type || "OPERATIONAL",
      status: status || "ACTIVE",
      hasSchedule: !!hasSchedule,
      conversationsEnabled: conversationsEnabled !== false,
      assignmentGrantsTeacher: grantsTeacher,
      teacherLabel: sanitizedLabel,
      coverageNoun:   cleanCoverageInput(coverageNoun,   DEFAULT_COVERAGE_COPY.noun),
      coverageVerb:   cleanCoverageInput(coverageVerb,   DEFAULT_COVERAGE_COPY.verb),
      coverageAction: cleanCoverageInput(coverageAction, DEFAULT_COVERAGE_COPY.action),
      conversationCategories: ["General"],
      appLinks: normalizedAppLinks.length
        ? {
            create: normalizedAppLinks.map((link, i) => {
              const registered = link.toolSlug ? getToolBySlug(link.toolSlug) : null;
              return {
                toolSlug: registered?.slug ?? null,
                label: registered?.label ?? link.label.trim(),
                href: registered?.path ?? link.href.trim(),
                order: i,
                isEnabled: link.isEnabled ?? true,
                isPrimary: link.isPrimary,
              };
            }),
          }
        : undefined,
      // Bootstrap the creating admin as the first coordinator + active
      // member.  Closes the catch-22 introduced in session 128 when ADMIN
      // lost its content-access bypass: without this row, the admin who
      // just created a hub couldn't enter it without then clicking the
      // "+ Add me as coordinator" affordance on the edit page.  Values
      // mirror /admin/hubs/[slug]/add-me-as-coordinator so behavior is
      // identical between the two entry points.
      members: {
        create: {
          userId: creatorId,
          isCoordinator: true,
          status: "ACTIVE",
          hostingCapability: true,
          communicationsEnabled: true,
          position: "Coordinator",
        },
      },
    },
    include: {
      _count: { select: { members: true } },
      appLinks: { orderBy: { order: "asc" } },
    },
  });

  // Auto-provision the hub's Files storage — a folder in the "RIM — Spaces"
  // container drive — so a new Space is Files-ready with no manual Google
  // step (the automation Jesse asked for). Best-effort: a provisioning
  // failure (e.g. the container drive isn't set up yet) must not fail hub
  // creation; the admin can provision later from the edit page.
  try {
    const result = await provisionHubSpaceStorage(hub, creatorId);
    if (!result.ok) {
      console.warn(`[hub-create] Files not provisioned for ${hub.slug}: ${result.error}`);
    }
  } catch (e) {
    console.error(`[hub-create] provisioning threw for ${hub.slug}`, e);
  }

  return NextResponse.json(hub, { status: 201 });
}
