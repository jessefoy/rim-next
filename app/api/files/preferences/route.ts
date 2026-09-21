import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filesViewer, isCrossSiteRequest, resolvePlace } from "@/lib/googleFiles";
import { isFileSort } from "@/lib/fileOrganization";
export async function PATCH(req: NextRequest) {
  if (isCrossSiteRequest(req)) return NextResponse.json({ error: "Open this from within RIM." }, { status: 403 });
  const viewer = filesViewer(await auth());
  if (!viewer) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.place !== "string" || !isFileSort(body.sort)) return NextResponse.json({ error: "Choose a valid sort order." }, { status: 400 });
  try {
    const place = await resolvePlace(viewer.userId, viewer.roles, body.place);
    if (!place) return NextResponse.json({ error: "You don't have access to these files." }, { status: 404 });
    const key = { userId: viewer.userId, placeKey: place.key };
    await db.googleFileViewPreference.upsert({ where: { userId_placeKey: key }, create: { ...key, sort: body.sort }, update: { sort: body.sort } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "We couldn't save your sort order. Please try again." }, { status: 502 });
  }
}
