import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listNoticeFacets, listNotices } from "@/lib/notifications";

/** GET /api/account/notifications: a page of the signed-in person's notices. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const source = url.searchParams.get("source");
  const type = url.searchParams.get("type");
  const cursor = url.searchParams.get("cursor");
  const result = await listNotices({
    userId: session.user.id,
    source,
    type,
    unreadOnly: url.searchParams.get("show") === "unread",
    cursor,
    limit: 40,
  });
  // A new choice brings the pickers' counts for it; a further page doesn't.
  const facets = cursor ? null : await listNoticeFacets({ userId: session.user.id, source, type });
  return NextResponse.json({ ...result, facets });
}
