import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { listHubActivity, type HubActivityFilter } from "@/lib/hubActivity";

/** Paginated, source-aware Space Updates. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const { hub, member } = await getHubMembership(slug, session.user.id, session.user.roles ?? []);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, session.user.roles ?? [])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
  const rawFilter = url.searchParams.get("filter");
  const filter: HubActivityFilter = rawFilter === "new" || rawFilter === "for-me" ? rawFilter : "all";
  const rawNewSince = url.searchParams.get("newSince");
  const parsedNewSince = rawNewSince ? new Date(rawNewSince) : null;
  const newSince = parsedNewSince && !Number.isNaN(parsedNewSince.getTime())
    ? parsedNewSince
    : member?.activitySeenAt ?? null;
  const result = await listHubActivity({
    hubId: hub.id,
    hubSlug: slug,
    userId: session.user.id,
    conversationsEnabled: hub.conversationsEnabled,
    filter,
    newSince,
    cursor: url.searchParams.get("cursor"),
    limit: Number.isFinite(rawLimit) ? rawLimit : 30,
  });
  return NextResponse.json(result);
}
