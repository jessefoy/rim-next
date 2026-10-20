import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { listNotices } from "@/lib/notifications";

/** GET /api/account/notifications: a page of the signed-in person's notices. */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const result = await listNotices({
    userId: session.user.id,
    source: url.searchParams.get("source"),
    unreadOnly: url.searchParams.get("show") === "unread",
    cursor: url.searchParams.get("cursor"),
    limit: 40,
  });
  return NextResponse.json(result);
}
