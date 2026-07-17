import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import { listHubActivity, type HubActivityFilter } from "@/lib/hubActivity";

/** Paginated Space activity. `mine=true` means actions authored by me. */
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
  const filter: HubActivityFilter = url.searchParams.get("mine") === "true" ? "mine" : "all";
  const result = await listHubActivity({
    hubId: hub.id,
    hubSlug: slug,
    userId: session.user.id,
    conversationsEnabled: hub.conversationsEnabled,
    filter,
    cursor: url.searchParams.get("cursor"),
    limit: Number.isFinite(rawLimit) ? rawLimit : 30,
  });
  return NextResponse.json(result);
}
