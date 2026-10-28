import { auth } from "@/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { startConversation } from "@/lib/teamActions";

// Team-wide emails go one at a time after the response (sendEachPaced),
// so the function needs room past the usual limit (2026-10-19).
export const maxDuration = 60;

// GET /api/hub/[slug]/conversations — list threads
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
  if ((!hub?.conversationsEnabled || !canAccessHub(member, session.user.roles ?? []))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "OPEN";

  // Translate the legacy ?status= param to the canonical archivedAt filter:
  //   "OPEN"   (default) — non-archived threads (active feed)
  //   "CLOSED"           — archived threads (the "Archived" tab in HubConvClient)
  // Trashed threads (deletedAt set) never appear here regardless of param —
  // they live at /trash.
  const archiveFilter =
    statusParam === "CLOSED"
      ? { archivedAt: { not: null } }
      : { archivedAt: null };

  const threads = await db.hubConversationThread.findMany({
    where: { hubId: hub.id, deletedAt: null, ...archiveFilter },
    include: {
      author: { select: { firstName: true, lastName: true, preferredName: true } },
      _count:  { select: { replies: true } },
    },
    orderBy: [
      { isPinned: "desc" },
      { pinnedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });

  return NextResponse.json(threads);
}

// POST /api/hub/[slug]/conversations — create thread (any member)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  // The step itself (lib/teamActions.ts) is shared with the RIM Guide.
  const result = await startConversation({ id: session.user.id, roles: session.user.roles ?? [], name: session.user.name, email: session.user.email }, slug, await req.json().catch(() => ({})));
  return NextResponse.json(result.body, { status: result.status });
}
