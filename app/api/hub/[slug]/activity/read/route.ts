import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { markHubUpdatesRead } from "@/lib/hubActivity";

/**
 * POST /api/hub/[slug]/activity/read — mark Updates items read.
 * Body: { keys: string[] } for items opened, or { all: true, asOf, keys?: [...] }
 * for "Mark all as read" (the keys being the Needs-you items on screen,
 * which the read point doesn't cover). Only a team member has read state:
 * a guiding teacher looking in on a team they aren't on has none.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, roles)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!member) return NextResponse.json({ ok: true });

  const body = (await req.json().catch(() => null)) as { keys?: unknown; all?: unknown; asOf?: unknown } | null;
  const keys = Array.isArray(body?.keys) ? body.keys.filter((k): k is string => typeof k === "string") : [];
  // "Mark all as read" covers what was on screen: the page's load time.
  const asOf = typeof body?.asOf === "string" && !Number.isNaN(Date.parse(body.asOf)) ? new Date(body.asOf) : null;
  await markHubUpdatesRead({ hubId: hub.id, userId: session.user.id, keys, all: body?.all === true, asOf });
  return NextResponse.json({ ok: true });
}
