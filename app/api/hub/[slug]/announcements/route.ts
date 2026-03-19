import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { getHubMembership, requireCoordinator } from "@/lib/hubAuth";
import { extractBlockNoteText } from "@/lib/renderRichContent";

// GET /api/hub/[slug]/announcements — list active announcements
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const archived = url.searchParams.get("archived") === "true";

  const announcements = await db.hubAnnouncement.findMany({
    where: { hubId: hub.id, status: archived ? "ARCHIVED" : "ACTIVE" },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(announcements);
}

// POST /api/hub/[slug]/announcements — create announcement (coordinator only)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const isAdmin = (session.user.roles ?? []).includes("ADMIN");
  if (!member && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    requireCoordinator(member?.isCoordinator ?? false, session.user.roles ?? []);
  } catch {
    return NextResponse.json({ error: "Coordinators only" }, { status: 403 });
  }

  const { title, body, priority } = await req.json();
  if (!title?.trim() || !extractBlockNoteText(body)?.trim()) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  const ann = await db.hubAnnouncement.create({
    data: {
      hubId:    hub.id,
      authorId: session.user.id,
      title:    title.trim(),
      body:     body,
      priority: priority ?? "NORMAL",
    },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
    },
  });

  return NextResponse.json(ann, { status: 201 });
}
