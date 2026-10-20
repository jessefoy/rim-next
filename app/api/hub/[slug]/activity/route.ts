import { auth } from "@/auth";
import { hubLeadAllowed } from "@/lib/googleFiles";
import { NextResponse } from "next/server";
import { canAccessHub, getHubMembership } from "@/lib/hubAuth";
import {
  listHubActivity,
  parseHubActivityFolder,
  parseHubActivityShow,
  readPointOf,
  type HubActivityFolder,
  type HubActivitySourceKey,
} from "@/lib/hubActivity";

/** A type for the For you folder ("for-you" itself is not a type). */
function sourceOf(f: HubActivityFolder): HubActivitySourceKey | "all" {
  return f === "for-you" ? "all" : f;
}

/** A page of a team's Updates, for one folder (type), all or unread. */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const roles = session.user.roles ?? [];
  const { hub, member } = await getHubMembership(slug, session.user.id, roles);
  if (!hub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessHub(member, roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
  const result = await listHubActivity({
    hubId: hub.id,
    hubSlug: slug,
    viewer: {
      userId: session.user.id,
      roles,
      isLead: hubLeadAllowed(roles, member),
      readPoint: readPointOf(member),
    },
    conversationsEnabled: hub.conversationsEnabled,
    filesEnabled: hub.googleFilesEnabled && Boolean(hub.googleDriveId),
    folder: parseHubActivityFolder(url.searchParams.get("folder")),
    source: sourceOf(parseHubActivityFolder(url.searchParams.get("source"))),
    show: parseHubActivityShow(url.searchParams.get("show")),
    cursor: url.searchParams.get("cursor"),
    limit: Number.isFinite(rawLimit) ? rawLimit : 30,
  });
  return NextResponse.json(result);
}
