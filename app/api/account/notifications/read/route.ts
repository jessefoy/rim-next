import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { markNoticesRead } from "@/lib/notifications";

/**
 * POST /api/account/notifications/read
 * Body: { ids: string[] } for notices opened, or { all: true, asOf } for
 * "Mark all as read" (asOf: when the page loaded, so what arrived since stays
 * unread). Only ever the signed-in person's own notices.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown; asOf?: unknown; source?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === "string") : [];
  const asOf = typeof body?.asOf === "string" && !Number.isNaN(Date.parse(body.asOf)) ? new Date(body.asOf) : null;
  const source = typeof body?.source === "string" ? body.source : null;
  await markNoticesRead({ userId: session.user.id, ids, all: body?.all === true, asOf, source });
  return NextResponse.json({ ok: true });
}
