import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  const { name, slug: newSlug, description, type, status, assignmentGrantsTeacher, teacherLabel, appLinks, welcomeHeadline, welcomeBody, homeContent } = body;

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

  // Replace appLinks: delete all, recreate
  if (appLinks !== undefined) {
    await db.hubAppLink.deleteMany({ where: { hubId: hub.id } });
    if (appLinks.length > 0) {
      await db.hubAppLink.createMany({
        data: appLinks.map((link: { toolSlug?: string | null; label: string; href: string; isEnabled?: boolean }, i: number) => ({
          hubId: hub.id,
          toolSlug: link.toolSlug ?? null,
          label: link.label,
          href: link.href,
          order: i,
          isEnabled: link.isEnabled ?? true,
        })),
      });
    }
  }

  const updated = await db.hub.update({
    where: { slug },
    data: {
      ...(name !== undefined && { name }),
      ...(newSlug && newSlug !== slug && { slug: newSlug }),
      ...(description !== undefined && { description: description || null }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
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
      ...(welcomeHeadline !== undefined && { welcomeHeadline: welcomeHeadline || null }),
      ...(welcomeBody !== undefined && { welcomeBody }),
      ...(homeContent !== undefined && { homeContent }),
    },
    include: {
      appLinks: { orderBy: { order: "asc" } },
      members: {
        where: { isCoordinator: true },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      },
    },
  });

  return NextResponse.json(updated);
}
