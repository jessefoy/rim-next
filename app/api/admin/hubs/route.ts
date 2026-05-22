import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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
  if (!roles.includes("ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, description, type, status, assignmentGrantsTeacher, teacherLabel, appLinks } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
  }

  // Check slug uniqueness
  const existing = await db.hub.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: "A hub with this slug already exists." }, { status: 409 });
  }

  // teacherLabel only meaningful when assignmentGrantsTeacher is true;
  // strip it otherwise so we don't store dead state. Sanitize: trim, max 20.
  const grantsTeacher = !!assignmentGrantsTeacher;
  const sanitizedLabel =
    grantsTeacher && typeof teacherLabel === "string" && teacherLabel.trim().length > 0
      ? teacherLabel.trim().slice(0, 20)
      : null;

  const hub = await db.hub.create({
    data: {
      name,
      slug,
      description: description || null,
      type: type || "OPERATIONAL",
      status: status || "ACTIVE",
      assignmentGrantsTeacher: grantsTeacher,
      teacherLabel: sanitizedLabel,
      conversationCategories: ["General"],
      appLinks: appLinks?.length
        ? {
            create: appLinks.map((link: { toolSlug?: string | null; label: string; href: string; isEnabled?: boolean }, i: number) => ({
              toolSlug: link.toolSlug ?? null,
              label: link.label,
              href: link.href,
              order: i,
              isEnabled: link.isEnabled ?? true,
            })),
          }
        : undefined,
    },
    include: {
      _count: { select: { members: true } },
      appLinks: { orderBy: { order: "asc" } },
    },
  });

  return NextResponse.json(hub, { status: 201 });
}
